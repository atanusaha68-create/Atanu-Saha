import { useState, type FormEvent } from 'react';
import { CheckCircle2, Plus, X } from 'lucide-react';
import {
  BANGLADESH_LOCATIONS,
  COMMON_PHYSICAL_PROBLEMS,
} from '../shared/bangladeshData';
import type { Gender, PatientUser, TriageHistoryItem } from '../shared/types';
import { updateProfile } from '../lib/api';

interface ProfileViewProps {
  user: PatientUser | null;
  triageHistory: TriageHistoryItem[];
  onUpdated: (user: PatientUser) => void;
  onGoToAuth: () => void;
  onOpenHistoryItem: (item: TriageHistoryItem) => void;
}

export function ProfileView({
  user,
  triageHistory,
  onUpdated,
  onGoToAuth,
  onOpenHistoryItem,
}: ProfileViewProps) {
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [age, setAge] = useState(user ? String(user.age) : '');
  const [gender, setGender] = useState<Gender>(user?.gender ?? 'Male');
  const [bloodGroup, setBloodGroup] = useState(user?.bloodGroup ?? 'O+');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [division, setDivision] = useState(user?.division ?? 'Dhaka');
  const [area, setArea] = useState(user?.area ?? 'Dhanmondi');
  const [physicalProblems, setPhysicalProblems] = useState<string[]>(
    user?.physicalProblems ?? []
  );
  const [drugHistory, setDrugHistory] = useState<string[]>(user?.drugHistory ?? []);
  const [drugDraft, setDrugDraft] = useState('');

  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 pb-24">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Patient Medical Profile
          </h1>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Sign in or register an account to save your age, chronic physical problems, and drug
            history for faster specialist triage.
          </p>
          <button
            type="button"
            onClick={onGoToAuth}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0B6E5B] text-white text-sm font-semibold hover:bg-[#085647] transition-colors cursor-pointer"
          >
            Sign In or Register
          </button>
        </div>
      </main>
    );
  }

  const divEntry =
    BANGLADESH_LOCATIONS.find((d) => d.division === division) ?? BANGLADESH_LOCATIONS[0];

  function handleDivisionChange(nextDiv: string) {
    setDivision(nextDiv);
    const found = BANGLADESH_LOCATIONS.find((d) => d.division === nextDiv);
    if (found && found.areas.length > 0) {
      setArea(found.areas[0]);
    }
  }

  function toggleProblem(cond: string) {
    setPhysicalProblems((prev) =>
      prev.includes(cond) ? prev.filter((p) => p !== cond) : [...prev, cond]
    );
  }

  function addDrug() {
    const cleaned = drugDraft.trim();
    if (!cleaned) return;
    if (!drugHistory.includes(cleaned)) {
      setDrugHistory((prev) => [...prev, cleaned]);
    }
    setDrugDraft('');
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedNotice(false);
    const parsedAge = Number(age);
    if (!fullName.trim()) {
      setError('Full name is required.');
      return;
    }
    if (!Number.isFinite(parsedAge) || parsedAge < 1 || parsedAge > 120) {
      setError('Age must be between 1 and 120.');
      return;
    }

    setSaving(true);
    try {
      const res = await updateProfile({
        fullName: fullName.trim(),
        age: Math.round(parsedAge),
        gender,
        bloodGroup,
        phone: phone.trim(),
        division,
        area,
        physicalProblems,
        drugHistory,
      });
      onUpdated(res.user);
      setSavedNotice(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-24 md:pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              Patient Medical Profile
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Account: <span className="font-medium text-slate-800">{user.username}</span> ·{' '}
              {user.email}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800"
            >
              {error}
            </div>
          )}

          {savedNotice && (
            <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-sm text-[#0B6E5B] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Medical profile updated and saved.</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="prof-name"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Full Name
                </label>
                <input
                  id="prof-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="prof-age"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Age
                  </label>
                  <input
                    id="prof-age"
                    type="number"
                    min={1}
                    max={120}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="prof-gender"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Gender
                  </label>
                  <select
                    id="prof-gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value as Gender)}
                    className="w-full min-h-[44px] px-2 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="prof-blood"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Blood
                  </label>
                  <select
                    id="prof-blood"
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full min-h-[44px] px-2 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                  >
                    {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="prof-division"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Division
                </label>
                <select
                  id="prof-division"
                  value={division}
                  onChange={(e) => handleDivisionChange(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                >
                  {BANGLADESH_LOCATIONS.map((loc) => (
                    <option key={loc.division} value={loc.division}>
                      {loc.division}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="prof-area"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Area
                </label>
                <select
                  id="prof-area"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                >
                  {divEntry.areas.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="prof-phone"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Phone
                </label>
                <input
                  id="prof-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                />
              </div>
            </div>

            <div>
              <span className="block text-sm font-medium text-slate-700 mb-2">
                Recorded Physical Problems
              </span>
              <div className="flex flex-wrap gap-2">
                {COMMON_PHYSICAL_PROBLEMS.map((cond) => {
                  const active = physicalProblems.includes(cond);
                  return (
                    <button
                      key={cond}
                      type="button"
                      onClick={() => toggleProblem(cond)}
                      aria-pressed={active}
                      className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#0B6E5B] text-white border-[#0B6E5B]'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {cond}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor="prof-drug"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Drug History / Active Medications
              </label>
              <div className="flex gap-2">
                <input
                  id="prof-drug"
                  type="text"
                  value={drugDraft}
                  onChange={(e) => setDrugDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addDrug();
                    }
                  }}
                  placeholder="Add medication & dose"
                  className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                />
                <button
                  type="button"
                  onClick={addDrug}
                  className="min-h-[44px] px-4 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>Add</span>
                </button>
              </div>
              {drugHistory.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {drugHistory.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDrugHistory((prev) => prev.filter((item) => item !== d))}
                      aria-label={`Remove ${d}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-medium text-slate-800 hover:bg-slate-200 cursor-pointer"
                    >
                      <span>{d}</span>
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="min-h-[46px] px-6 py-2.5 rounded-xl bg-[#0B6E5B] hover:bg-[#085647] disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              {saving ? 'Saving Changes...' : 'Save Medical Profile'}
            </button>
          </form>
        </section>

        <aside className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-slate-900">
            Saved Symptom Triage History
          </h2>
          {triageHistory.length === 0 ? (
            <p className="text-sm text-slate-500">
              No saved symptom assessments yet. Your checks from the Symptom Triage page will appear
              here.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {triageHistory.map((item) => (
                <li key={item.id} className="py-3.5 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    onClick={() => onOpenHistoryItem(item)}
                    className="w-full text-left group cursor-pointer space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900 group-hover:text-[#0B6E5B]">
                        {item.result.specialistTitle} ({item.result.departmentName})
                      </span>
                      <span className="text-xs text-slate-500 tabular-nums">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2">
                      {item.input.chiefComplaint || item.input.selectedSymptoms.join(', ')}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </main>
  );
}
