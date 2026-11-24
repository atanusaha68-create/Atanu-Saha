import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Calendar, CheckCircle2, Clock, MapPin, Phone } from 'lucide-react';
import { getDepartmentById } from '../shared/bangladeshData';
import type { Appointment, Doctor, PatientUser, TriageInput } from '../shared/types';
import {
  createAppointment,
  fetchDoctorSlots,
  loginDemoUser,
  type SlotAvailability,
} from '../lib/api';
import { DoctorAvatar } from './DoctorAvatar';

interface DoctorProfileViewProps {
  doctor: Doctor;
  user: PatientUser | null;
  lastTriageInput: TriageInput | null;
  onBack: () => void;
  onAuthenticated: (user: PatientUser) => void;
  onGoToAuth: () => void;
  onBooked: (appointment: Appointment) => void;
  onViewAppointments: () => void;
}

function getDefaultDateString(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

export function DoctorProfileView({
  doctor,
  user,
  lastTriageInput,
  onBack,
  onAuthenticated,
  onGoToAuth,
  onBooked,
  onViewAppointments,
}: DoctorProfileViewProps) {
  const dept = getDepartmentById(doctor.departmentId);

  const [date, setDate] = useState(getDefaultDateString());
  const [selectedSlot, setSelectedSlot] = useState(doctor.availableSlots[0] ?? '5:30 PM');
  const [patientName, setPatientName] = useState(
    lastTriageInput?.patientName || user?.fullName || ''
  );
  const [patientAge, setPatientAge] = useState(
    lastTriageInput ? String(lastTriageInput.age) : user ? String(user.age) : ''
  );
  const [complaintNote, setComplaintNote] = useState(
    lastTriageInput?.chiefComplaint ||
      lastTriageInput?.selectedSymptoms.join(', ') ||
      ''
  );
  const [drugNote, setDrugNote] = useState(
    lastTriageInput?.drugHistory.join(', ') ||
      user?.drugHistory.join(', ') ||
      ''
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedAppointment, setConfirmedAppointment] = useState<Appointment | null>(null);
  const [slotStatuses, setSlotStatuses] = useState<SlotAvailability[]>(() =>
    doctor.availableSlots.map((time) => ({ time, booked: false }))
  );

  useEffect(() => {
    let active = true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    fetchDoctorSlots(doctor.id, date)
      .then((res) => {
        if (!active) return;
        setSlotStatuses(res.slots);
        const firstOpen = res.slots.find((s) => !s.booked);
        if (firstOpen) {
          setSelectedSlot((prev) => {
            const current = res.slots.find((s) => s.time === prev);
            return current && !current.booked ? prev : firstOpen.time;
          });
        }
      })
      .catch(() => {
        // Fallback to doctor's schedule if offline
      });
    return () => {
      active = false;
    };
  }, [doctor.id, date, confirmedAppointment]);

  async function handleBook(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!user) {
      setError('Please sign in or use the Demo Patient button below to confirm your booking.');
      return;
    }
    const parsedAge = Number(patientAge || user.age);
    if (!patientName.trim()) {
      setError('Please enter the patient name.');
      return;
    }
    if (!Number.isFinite(parsedAge) || parsedAge < 0 || parsedAge > 120) {
      setError('Please enter a valid patient age.');
      return;
    }
    if (!date) {
      setError('Please choose a chamber visit date.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createAppointment({
        doctorId: doctor.id,
        date,
        timeSlot: selectedSlot,
        patientName: patientName.trim(),
        patientAge: Math.round(parsedAge),
        chiefComplaintSummary: complaintNote.trim() || 'Specialist chamber consultation',
        drugHistorySummary: drugNote.trim() || 'None reported',
      });
      setConfirmedAppointment(res.appointment);
      onBooked(res.appointment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to book appointment.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDemoQuickSignIn() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await loginDemoUser();
      onAuthenticated(res.user);
      if (!patientName) setPatientName(res.user.fullName);
      if (!patientAge) setPatientAge(String(res.user.age));
      if (!drugNote) setDrugNote(res.user.drugHistory.join(', '));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo login unavailable.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-24 md:pb-12 space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 min-h-[40px] text-sm font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        <span>Back to Doctor Selection</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Doctor Detailed Profile (7 cols) */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-start gap-5">
            <DoctorAvatar name={doctor.name} portraitKey={doctor.portraitKey} size="lg" />
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-[#0B6E5B]">
                {dept.name} · {dept.bengaliName}
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
                {doctor.name}
              </h1>
              <p className="text-sm font-medium text-slate-700">{doctor.degrees}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 pt-1 tabular-nums">
                <span>{doctor.experienceYears} years experience</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">BMDC Reg: {doctor.bmdcReg}</span>
                <span aria-hidden="true">·</span>
                <span>{doctor.languages.join(' / ')}</span>
              </div>
            </div>
          </div>

          <p className="text-sm sm:text-base text-slate-700 leading-relaxed">{doctor.bio}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
            <div className="space-y-1.5">
              <h2 className="text-xs font-semibold text-slate-500">Chamber Location &amp; Contact</h2>
              <p className="text-sm font-semibold text-slate-900">{doctor.hospital}</p>
              <p className="text-sm text-slate-600 flex items-start gap-1.5">
                <MapPin className="w-4 h-4 text-[#0B6E5B] shrink-0 mt-0.5" aria-hidden="true" />
                <span>{doctor.chamberAddress}</span>
              </p>
              <p className="text-sm text-slate-700 flex items-center gap-1.5 tabular-nums pt-0.5">
                <Phone className="w-4 h-4 text-[#0B6E5B] shrink-0" aria-hidden="true" />
                <span>Serial Desk: {doctor.chamberPhone}</span>
              </p>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xs font-semibold text-slate-500">
                Availability &amp; Consultation Fee
              </h2>
              <p className="text-sm font-semibold text-slate-900 tabular-nums">
                ৳ {doctor.feeBdt.toLocaleString()} (Chamber Visit)
              </p>
              <p className="text-sm text-slate-600 flex items-center gap-1.5 tabular-nums">
                <Calendar className="w-4 h-4 text-[#0B6E5B] shrink-0" aria-hidden="true" />
                <span>{doctor.visitingDays}</span>
              </p>
              <p className="text-sm text-slate-600 flex items-center gap-1.5 tabular-nums">
                <Clock className="w-4 h-4 text-[#0B6E5B] shrink-0" aria-hidden="true" />
                <span>{doctor.visitingHours}</span>
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Clinical Focus Areas</h2>
            <p className="text-sm text-slate-600">{doctor.focusAreas.join(' · ')}</p>
          </div>
        </section>

        {/* Right: Appointment Booking Form (5 cols) */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-5">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">Book Appointment</h2>
            <p className="text-sm text-slate-600 mt-1">
              Reserve a chamber serial with {doctor.name} at {doctor.area}.
            </p>
          </div>

          {confirmedAppointment ? (
            <div className="p-5 rounded-xl bg-teal-50 border border-teal-200 space-y-3">
              <div className="flex items-center gap-2 text-[#0B6E5B] font-semibold text-sm">
                <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                <span>Chamber Visit Confirmed</span>
              </div>
              <p className="text-sm text-slate-800">
                Appointment booked for <strong>{confirmedAppointment.patientName}</strong> on{' '}
                <span className="font-mono tabular-nums">{confirmedAppointment.date}</span> at{' '}
                <span className="font-mono tabular-nums">{confirmedAppointment.timeSlot}</span>.
              </p>
              <p className="text-xs text-slate-600">
                {confirmedAppointment.hospital} · {confirmedAppointment.area},{' '}
                {confirmedAppointment.division}
              </p>
              <button
                type="button"
                onClick={onViewAppointments}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0B6E5B] hover:bg-[#085647] text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                View My Appointments
              </button>
            </div>
          ) : (
            <form onSubmit={handleBook} className="space-y-4">
              {!user && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs text-slate-700">
                  <p className="font-semibold text-slate-900">
                    Sign in to save your chamber booking
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleDemoQuickSignIn}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#0B6E5B] text-white font-semibold hover:bg-[#085647] cursor-pointer"
                    >
                      Quick Demo Patient Sign In
                    </button>
                    <button
                      type="button"
                      onClick={onGoToAuth}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-semibold hover:bg-slate-100 cursor-pointer"
                    >
                      Login / Register
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800"
                >
                  {error}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label
                    htmlFor="book-patient-name"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Patient Name
                  </label>
                  <input
                    id="book-patient-name"
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="Patient full name"
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="book-patient-age"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Age
                  </label>
                  <input
                    id="book-patient-age"
                    type="number"
                    min={0}
                    max={120}
                    value={patientAge}
                    onChange={(e) => setPatientAge(e.target.value)}
                    placeholder="Age"
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="book-date" className="block text-xs font-medium text-slate-700 mb-1">
                  Visit Date
                </label>
                <input
                  id="book-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                />
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-700 mb-1.5">
                  Select Chamber Time Slot
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {slotStatuses.map(({ time, booked }) => (
                    <button
                      key={time}
                      type="button"
                      disabled={booked}
                      onClick={() => setSelectedSlot(time)}
                      aria-pressed={selectedSlot === time}
                      className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-semibold tabular-nums transition-colors ${
                        booked
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed line-through'
                          : selectedSlot === time
                          ? 'bg-[#0B6E5B] text-white border-[#0B6E5B] cursor-pointer'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 cursor-pointer'
                      }`}
                    >
                      {booked ? `${time} (Booked)` : time}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="book-complaint"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Chief Complaint Summary for Doctor
                </label>
                <textarea
                  id="book-complaint"
                  rows={2}
                  value={complaintNote}
                  onChange={(e) => setComplaintNote(e.target.value)}
                  placeholder="Brief note of symptoms for the specialist"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                />
              </div>

              <div>
                <label
                  htmlFor="book-drugs"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Current Medications / Drug History
                </label>
                <input
                  id="book-drugs"
                  type="text"
                  value={drugNote}
                  onChange={(e) => setDrugNote(e.target.value)}
                  placeholder="e.g. Metformin 500mg, Amlodipine 5mg"
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !user}
                className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-[#0B6E5B] hover:bg-[#085647] disabled:opacity-50 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                {submitting
                  ? 'Confirming Booking...'
                  : `Book Appointment · ৳ ${doctor.feeBdt.toLocaleString()}`}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
