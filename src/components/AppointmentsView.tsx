import { useState } from 'react';
import { Calendar, Clock, MapPin } from 'lucide-react';
import type { Appointment, PatientUser } from '../shared/types';
import { cancelAppointment } from '../lib/api';

interface AppointmentsViewProps {
  user: PatientUser | null;
  appointments: Appointment[];
  onCancelled: (updated: Appointment) => void;
  onFindDoctors: () => void;
  onGoToAuth: () => void;
}

export function AppointmentsView({
  user,
  appointments,
  onCancelled,
  onFindDoctors,
  onGoToAuth,
}: AppointmentsViewProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel(id: string) {
    setError(null);
    setCancellingId(id);
    try {
      const res = await cancelAppointment(id);
      onCancelled(res.appointment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to cancel visit.');
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-24 md:pb-12 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
            Chamber Appointments
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Track upcoming specialist visits and clinical notes shared with your doctor.
          </p>
        </div>
        <button
          type="button"
          onClick={onFindDoctors}
          className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0B6E5B] hover:bg-[#085647] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Browse Specialists
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {!user ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Sign in to view and manage your chamber appointments
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Create an account or continue with the Demo Patient profile to reserve slots and review
            your visit history.
          </p>
          <button
            type="button"
            onClick={onGoToAuth}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0B6E5B] text-white text-sm font-semibold hover:bg-[#085647] transition-colors cursor-pointer"
          >
            Go to Sign In
          </button>
        </div>
      ) : appointments.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            No appointments booked yet
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Run a symptom triage check or browse local specialists in your area to book your first
            chamber visit.
          </p>
          <button
            type="button"
            onClick={onFindDoctors}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0B6E5B] text-white text-sm font-semibold hover:bg-[#085647] transition-colors cursor-pointer"
          >
            Find Specialist Doctors
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {appointments.map((apt) => (
            <article
              key={apt.id}
              className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-5"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span
                    className={`font-semibold ${
                      apt.status === 'Confirmed' ? 'text-[#0B6E5B]' : 'text-slate-500'
                    }`}
                  >
                    {apt.status}
                  </span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className="text-slate-600">{apt.departmentName}</span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className="font-mono tabular-nums text-slate-700">
                    ৳ {apt.feeBdt.toLocaleString()}
                  </span>
                </div>

                <h2 className="font-display text-lg font-bold text-slate-900">{apt.doctorName}</h2>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>
                      {apt.hospital}, {apt.area}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{apt.date}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{apt.timeSlot}</span>
                  </span>
                </div>

                <p className="text-xs text-slate-600 pt-1">
                  <span className="font-medium text-slate-800">Complaint:</span>{' '}
                  {apt.chiefComplaintSummary} ·{' '}
                  <span className="font-medium text-slate-800">Medications:</span>{' '}
                  {apt.drugHistorySummary}
                </p>
              </div>

              {apt.status === 'Confirmed' && (
                <div className="shrink-0">
                  <button
                    type="button"
                    disabled={cancellingId === apt.id}
                    onClick={() => handleCancel(apt.id)}
                    aria-label={`Cancel visit with ${apt.doctorName}`}
                    className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors cursor-pointer"
                  >
                    {cancellingId === apt.id ? 'Cancelling...' : 'Cancel Visit'}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
