import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Navigation,
  Phone,
  Search,
} from 'lucide-react';
import { BANGLADESH_LOCATIONS, DEPARTMENTS } from '../shared/bangladeshData';
import type { Coordinates, Doctor, TriageInput, TriageResult } from '../shared/types';
import { rankDoctorsForTriage } from '../lib/triage';
import { DoctorAvatar } from './DoctorAvatar';

interface DoctorSelectionViewProps {
  allDoctors: Doctor[];
  triageResult: TriageResult | null;
  triageInput: TriageInput | null;
  initialDepartment?: string;
  initialDivision?: string;
  initialArea?: string;
  onSelectDoctor: (doctor: Doctor) => void;
  onBackToTriage: () => void;
}

export function DoctorSelectionView({
  allDoctors,
  triageResult,
  triageInput,
  initialDepartment,
  initialDivision,
  initialArea,
  onSelectDoctor,
  onBackToTriage,
}: DoctorSelectionViewProps) {
  const [departmentFilter, setDepartmentFilter] = useState<string>(
    triageResult?.primaryDepartmentId ?? initialDepartment ?? 'all'
  );
  const [showAllDepartments, setShowAllDepartments] = useState<boolean>(false);
  const [divisionFilter, setDivisionFilter] = useState<string>(
    triageInput?.division ?? initialDivision ?? 'all'
  );
  const [areaFilter, setAreaFilter] = useState<string>(
    triageInput?.area ?? initialArea ?? 'all'
  );

  useEffect(() => {
    if (triageResult) {
      setDepartmentFilter(triageResult.primaryDepartmentId);
      setShowAllDepartments(false);
    }
    if (triageInput) {
      setDivisionFilter(triageInput.division);
      setAreaFilter(triageInput.area);
    }
  }, [triageResult, triageInput]);
  const [maxFee, setMaxFee] = useState<number>(0);
  const [search, setSearch] = useState('');
  const [userCoords, setUserCoords] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);

  const activeDepartmentFilter =
    triageResult && !showAllDepartments ? departmentFilter : departmentFilter;

  const availableAreas = useMemo(() => {
    if (divisionFilter === 'all') {
      return Array.from(new Set(BANGLADESH_LOCATIONS.flatMap((d) => d.areas)));
    }
    return BANGLADESH_LOCATIONS.find((d) => d.division === divisionFilter)?.areas ?? [];
  }, [divisionFilter]);

  const strictDivisionDoctors = useMemo(() => {
    return rankDoctorsForTriage(allDoctors, {
      departmentId: activeDepartmentFilter,
      division: divisionFilter,
      area: areaFilter,
      search,
      maxFee: maxFee > 0 ? maxFee : undefined,
      userCoords,
    });
  }, [allDoctors, activeDepartmentFilter, divisionFilter, areaFilter, search, maxFee, userCoords]);

  // If a recommended department has 0 doctors in the chosen division (e.g. Khulna/Cumilla),
  // automatically widen across Bangladesh while keeping ONLY the recommended specialist department!
  const widenedAcrossBangladesh =
    Boolean(triageResult) &&
    !showAllDepartments &&
    divisionFilter !== 'all' &&
    strictDivisionDoctors.length === 0 &&
    !search.trim() &&
    maxFee === 0;

  const filteredDoctors = useMemo(() => {
    if (!widenedAcrossBangladesh) {
      return strictDivisionDoctors;
    }
    return rankDoctorsForTriage(allDoctors, {
      departmentId: activeDepartmentFilter,
      division: 'all',
      area: 'all',
      userCoords,
    });
  }, [widenedAcrossBangladesh, strictDivisionDoctors, allDoctors, activeDepartmentFilter, userCoords]);

  // Also check if area filter is narrow (e.g., exact neighborhood has 0 docs in that dept, show same city docs clearly)
  const exactAreaDoctors = useMemo(() => {
    if (areaFilter === 'all') return filteredDoctors;
    return filteredDoctors.filter((d) => d.area === areaFilter);
  }, [filteredDoctors, areaFilter]);

  const activeDepartmentInfo = useMemo(
    () => DEPARTMENTS.find((d) => d.id === activeDepartmentFilter),
    [activeDepartmentFilter]
  );

  function handleDivisionChange(nextDiv: string) {
    setDivisionFilter(nextDiv);
    setAreaFilter('all');
  }

  function handleUseCurrentLocation() {
    setLocationNotice(null);
    if (!('geolocation' in navigator)) {
      setLocationNotice(
        'Location services are unavailable in this browser. Choose your city and area manually.'
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setDivisionFilter('all');
        setAreaFilter('all');
        setLocationNotice('Sorting specialists by nearest distance to your current GPS location.');
        setLocating(false);
      },
      () => {
        setLocationNotice(
          'Could not access GPS location. Please select your division and neighborhood below.'
        );
        setLocating(false);
      },
      { timeout: 8000 }
    );
  }

  function resetFilters() {
    if (triageResult && !showAllDepartments) {
      setDepartmentFilter(triageResult.primaryDepartmentId);
    } else {
      setDepartmentFilter('all');
    }
    setDivisionFilter('all');
    setAreaFilter('all');
    setMaxFee(0);
    setSearch('');
    setUserCoords(null);
    setLocationNotice(null);
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-24 md:pb-12 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBackToTriage}
          className="inline-flex items-center gap-2 min-h-[40px] text-sm font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Symptom Triage</span>
        </button>
      </div>

      {/* Specialist Recommendation Summary (when coming from triage) */}
      {triageResult && (
        <section
          aria-label="Specialist department recommendation"
          className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6"
        >
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="space-y-3 max-w-3xl">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold">
                {triageResult.urgency === 'urgent' ? (
                  <span className="inline-flex items-center gap-1.5 text-red-700">
                    <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                    <span>Urgent Evaluation Recommended</span>
                  </span>
                ) : triageResult.urgency === 'priority' ? (
                  <span className="inline-flex items-center gap-1.5 text-amber-700">
                    <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                    <span>Priority Visit (Within 24 Hours)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[#0B6E5B]">
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                    <span>Routine Chamber Consultation</span>
                  </span>
                )}
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="text-slate-500">
                  {triageResult.source === 'gemini'
                    ? 'AI Clinical Triage Assessment'
                    : 'Local Clinical Rules Assessment'}
                </span>
              </div>

              <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 [text-wrap:balance]">
                You should visit a {triageResult.specialistTitle}
              </h1>
              <p className="text-sm font-medium text-[#0B6E5B]">
                Recommended Department: {triageResult.departmentName} · {triageResult.bengaliName}
              </p>
              <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
                {triageResult.clinicalSummary}
              </p>
            </div>

            {triageResult.secondaryDepartmentId && triageResult.secondarySpecialistTitle && (
              <div className="shrink-0 bg-slate-50 border border-slate-200 rounded-xl p-4 lg:w-64 space-y-2">
                <p className="text-xs font-medium text-slate-500">Alternative Department</p>
                <p className="text-sm font-semibold text-slate-900">
                  {triageResult.secondarySpecialistTitle}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowAllDepartments(false);
                    setDepartmentFilter(
                      departmentFilter === triageResult.secondaryDepartmentId
                        ? triageResult.primaryDepartmentId
                        : triageResult.secondaryDepartmentId!
                    );
                  }}
                  className="text-xs font-semibold text-[#0B6E5B] hover:underline cursor-pointer"
                >
                  {departmentFilter === triageResult.secondaryDepartmentId
                    ? `Back to ${triageResult.specialistTitle}s`
                    : `Show ${triageResult.secondarySpecialistTitle}s Instead`}
                </button>
              </div>
            )}
          </div>

          {triageResult.urgency === 'urgent' && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-900">
              <p className="font-semibold">Urgent Red-Flag Guidance</p>
              <p className="mt-1">{triageResult.urgencyReason}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100 text-sm">
            <div className="space-y-1.5">
              <h2 className="font-semibold text-slate-900">Drug History &amp; Medication Note</h2>
              <p className="text-slate-600 leading-relaxed">
                {triageResult.medicationConsiderations}
              </p>
            </div>

            <div className="space-y-1.5">
              <h2 className="font-semibold text-slate-900">Questions to Ask the Doctor</h2>
              <ul className="space-y-1 text-slate-600 list-disc pl-4">
                {triageResult.questionsForDoctor.map((q, idx) => (
                  <li key={idx}>{q}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-1.5">
              <h2 className="font-semibold text-slate-900">What to Bring to the Chamber</h2>
              <ul className="space-y-1 text-slate-600 list-disc pl-4">
                {triageResult.prepChecklist.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Local Specialist Directory & Filter Bar */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900">
              {triageResult && !showAllDepartments && activeDepartmentInfo
                ? `Recommended ${activeDepartmentInfo.specialistTitle}s`
                : 'Local Specialist Doctors in Bangladesh'}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Showing{' '}
              <span className="font-semibold tabular-nums text-slate-900">
                {filteredDoctors.length}
              </span>{' '}
              {triageResult && !showAllDepartments && activeDepartmentInfo
                ? `${activeDepartmentInfo.specialistTitle.toLowerCase()}${filteredDoctors.length === 1 ? '' : 's'}`
                : `specialist${filteredDoctors.length === 1 ? '' : 's'}`}
              {userCoords
                ? ' · sorted nearest to your location'
                : widenedAcrossBangladesh
                ? ' · across Bangladesh'
                : areaFilter !== 'all'
                ? ` · prioritizing ${areaFilter}`
                : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {triageResult && (
              <button
                type="button"
                onClick={() => {
                  if (showAllDepartments) {
                    setShowAllDepartments(false);
                    setDepartmentFilter(triageResult.primaryDepartmentId);
                  } else {
                    setShowAllDepartments(true);
                    setDepartmentFilter('all');
                  }
                }}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
              >
                {showAllDepartments ? 'Show Matched Specialists Only' : 'Browse All 12 Departments'}
              </button>
            )}

            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={locating}
              className={`min-h-[42px] px-4 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer ${
                userCoords
                  ? 'bg-[#0B6E5B] text-white border-[#0B6E5B]'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {locating
                  ? 'Locating...'
                  : userCoords
                  ? 'Sorted by My Location'
                  : 'Use My Current Location'}
              </span>
            </button>
          </div>
        </div>

        {locationNotice && (
          <p className="text-xs font-medium text-[#0B6E5B]">{locationNotice}</p>
        )}

        {/* Filter Controls */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label
              htmlFor="filter-department"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Department
            </label>
            <select
              id="filter-department"
              value={departmentFilter}
              onChange={(e) => {
                const val = e.target.value;
                setDepartmentFilter(val);
                if (triageResult && val === 'all') {
                  setShowAllDepartments(true);
                }
              }}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
            >
              {(!triageResult || showAllDepartments) && (
                <option value="all">All Departments</option>
              )}
              {DEPARTMENTS.filter((dept) => {
                if (!triageResult || showAllDepartments) return true;
                return (
                  dept.id === triageResult.primaryDepartmentId ||
                  dept.id === triageResult.secondaryDepartmentId
                );
              }).map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {triageResult && !showAllDepartments && dept.id === triageResult.primaryDepartmentId
                    ? `Recommended: ${dept.name}`
                    : triageResult &&
                      !showAllDepartments &&
                      dept.id === triageResult.secondaryDepartmentId
                    ? `Secondary: ${dept.name}`
                    : dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-division"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              City / Division
            </label>
            <select
              id="filter-division"
              value={divisionFilter}
              onChange={(e) => handleDivisionChange(e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
            >
              <option value="all">All Divisions</option>
              {BANGLADESH_LOCATIONS.map((loc) => (
                <option key={loc.division} value={loc.division}>
                  {loc.division}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-area" className="block text-xs font-medium text-slate-600 mb-1">
              Neighborhood / Area
            </label>
            <select
              id="filter-area"
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
            >
              <option value="all">All Areas</option>
              {availableAreas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-fee" className="block text-xs font-medium text-slate-600 mb-1">
              Max Chamber Fee
            </label>
            <select
              id="filter-fee"
              value={String(maxFee)}
              onChange={(e) => setMaxFee(Number(e.target.value))}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
            >
              <option value="0">Any Fee</option>
              <option value="1000">Up to ৳ 1,000</option>
              <option value="1300">Up to ৳ 1,300</option>
              <option value="1600">Up to ৳ 1,600</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-search"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Search Doctor / Hospital
            </label>
            <div className="relative">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="filter-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, hospital, focus..."
                className="w-full min-h-[42px] pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
              />
            </div>
          </div>
        </div>

        {widenedAcrossBangladesh ? (
          <p className="text-sm text-slate-600">
            No {activeDepartmentInfo?.name ?? departmentFilter} chamber listed in {divisionFilter}{' '}
            yet; showing verified {activeDepartmentInfo?.specialistTitle ?? 'specialist'}s across
            Bangladesh.
          </p>
        ) : (
          areaFilter !== 'all' &&
          exactAreaDoctors.length === 0 &&
          filteredDoctors.length > 0 && (
            <p className="text-sm text-slate-600">
              No {activeDepartmentInfo?.name ?? departmentFilter} chamber listed directly inside{' '}
              {areaFilter}; showing nearest{' '}
              {activeDepartmentInfo ? `${activeDepartmentInfo.specialistTitle}s` : 'specialists'} in{' '}
              {divisionFilter === 'all' ? 'Bangladesh' : divisionFilter}.
            </p>
          )
        )}

        {/* Doctor List */}
        {filteredDoctors.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
            <p className="font-display text-lg font-semibold text-slate-900">
              No specialist chambers match those exact filters
            </p>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Try clearing the neighborhood or fee limit to view{' '}
              {triageResult && !showAllDepartments && activeDepartmentInfo
                ? `${activeDepartmentInfo.specialistTitle}s`
                : 'specialists'}{' '}
              across nearby areas.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0B6E5B] text-white text-sm font-semibold hover:bg-[#085647] transition-colors cursor-pointer"
            >
              {triageResult && !showAllDepartments
                ? 'Reset Location & Fee Filters'
                : 'Reset All Filters'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredDoctors.map((doc) => {
              const isExactNeighborhood = areaFilter !== 'all' && doc.area === areaFilter;
              return (
                <article
                  key={doc.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-5 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <DoctorAvatar name={doc.name} portraitKey={doc.portraitKey} size="md" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                        <span className="font-semibold text-[#0B6E5B]">{doc.specialistTitle}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{doc.experienceYears} yrs exp</span>
                        {isExactNeighborhood && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-medium text-slate-900">In {doc.area}</span>
                          </>
                        )}
                      </div>
                      <h3 className="font-display text-lg font-bold text-slate-900 leading-snug">
                        {doc.name}
                      </h3>
                      <p className="text-xs text-slate-600">{doc.degrees}</p>
                      <p className="text-sm text-slate-800 font-medium pt-1">{doc.hospital}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>
                            {doc.area}, {doc.division}
                            {doc.distanceKm !== undefined ? ` (${doc.distanceKm} km)` : ''}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Phone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>{doc.chamberPhone}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-0.5 text-xs">
                      <p className="text-slate-900 font-semibold tabular-nums">
                        ৳ {doc.feeBdt.toLocaleString()} Chamber Fee
                      </p>
                      <p className="text-slate-500 tabular-nums">
                        {doc.availableToday
                          ? `Available Today · Next: ${doc.availableSlots[0]}`
                          : `${doc.visitingDays} · ${doc.visitingHours}`}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectDoctor(doc)}
                      aria-label={`View profile for ${doc.name}`}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0B6E5B] hover:bg-[#085647] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>View Profile</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
