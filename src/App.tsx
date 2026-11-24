import { useEffect, useState } from 'react';
import {
  fetchAppointments,
  fetchCurrentUser,
  fetchDoctors,
  fetchTriageHistory,
  logoutUser,
  type TriageApiResponse,
} from './lib/api';
import type {
  Appointment,
  Doctor,
  PatientUser,
  TriageHistoryItem,
  TriageInput,
  TriageResult,
} from './shared/types';
import { DOCTORS } from './shared/bangladeshData';
import { AuthScreen } from './components/AuthScreen';
import { AppointmentsView } from './components/AppointmentsView';
import { DashboardTriage } from './components/DashboardTriage';
import { DoctorProfileView } from './components/DoctorProfileView';
import { DoctorSelectionView } from './components/DoctorSelectionView';
import { ProfileView } from './components/ProfileView';
import { TopNav, type AppScreen } from './components/TopNav';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('autostart') === '1' ? 'dashboard' : 'auth';
  });

  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<PatientUser | null>(null);
  const [allDoctors, setAllDoctors] = useState<Doctor[]>(DOCTORS);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [triageHistory, setTriageHistory] = useState<TriageHistoryItem[]>([]);

  const [activeTriageInput, setActiveTriageInput] = useState<TriageInput | null>(null);
  const [activeTriageResult, setActiveTriageResult] = useState<TriageResult | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);

  async function loadAuthenticatedData() {
    try {
      const [aptRes, histRes] = await Promise.all([
        fetchAppointments(),
        fetchTriageHistory(),
      ]);
      setAppointments(aptRes.appointments);
      setTriageHistory(histRes.history);
    } catch {
      // Ignore if session expired
    }
  }

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const [docRes, meRes] = await Promise.allSettled([
          fetchDoctors({}),
          fetchCurrentUser(),
        ]);
        if (!active) return;

        if (docRes.status === 'fulfilled' && docRes.value.doctors.length > 0) {
          setAllDoctors(docRes.value.doctors);
        }

        if (meRes.status === 'fulfilled' && meRes.value.user) {
          setUser(meRes.value.user);
          await loadAuthenticatedData();
          if (active) {
            setScreen((prev) => (prev === 'auth' ? 'dashboard' : prev));
          }
        }
      } finally {
        if (active) setBooting(false);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, []);

  async function handleAuthenticated(authedUser: PatientUser) {
    setUser(authedUser);
    await loadAuthenticatedData();
    setScreen((prev) => (prev === 'auth' ? 'dashboard' : prev));
  }

  async function handleSignOut() {
    try {
      await logoutUser();
    } catch {
      // ignore
    }
    setUser(null);
    setAppointments([]);
    setTriageHistory([]);
    setActiveTriageResult(null);
    setActiveTriageInput(null);
    setSelectedDoctor(null);
    setScreen('auth');
  }

  function handleTriageComplete(input: TriageInput, response: TriageApiResponse) {
    setActiveTriageInput(input);
    setActiveTriageResult(response.result);
    if (response.historyItem) {
      setTriageHistory((prev) => [response.historyItem!, ...prev]);
    }
    setScreen('doctors');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleOpenHistoryItem(item: TriageHistoryItem) {
    setActiveTriageInput(item.input);
    setActiveTriageResult(item.result);
    setScreen('doctors');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleSelectDoctor(doc: Doctor) {
    setSelectedDoctor(doc);
    setScreen('doctor-profile');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleBooked(apt: Appointment) {
    setAppointments((prev) => [apt, ...prev]);
  }

  function handleCancelled(updated: Appointment) {
    setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  }

  const confirmedCount = appointments.filter((a) => a.status === 'Confirmed').length;

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9F8] text-slate-900">
      <TopNav
        activeScreen={screen}
        user={user}
        appointmentCount={confirmedCount}
        onNavigate={(next) => {
          if (next === 'doctors') {
            setSelectedDoctor(null);
          }
          setScreen(next);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onSignOut={handleSignOut}
      />

      {booting ? (
        <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-12">
          <div className="bg-white border border-slate-200 rounded-2xl p-8 space-y-4 animate-pulse">
            <div className="h-6 w-48 bg-slate-200 rounded" />
            <div className="h-4 w-80 bg-slate-100 rounded" />
            <div className="h-48 w-full bg-slate-100 rounded-xl" />
          </div>
        </main>
      ) : (
        <div className="flex-1">
          {screen === 'auth' && (
            <AuthScreen
              onAuthenticated={handleAuthenticated}
              onContinueGuest={() => setScreen('dashboard')}
            />
          )}

          {screen === 'dashboard' && (
            <DashboardTriage
              user={user}
              triageHistory={triageHistory}
              appointments={appointments}
              onTriageComplete={handleTriageComplete}
              onOpenAppointments={() => setScreen('appointments')}
              onOpenProfile={() => setScreen('profile')}
              onOpenHistoryItem={handleOpenHistoryItem}
            />
          )}

          {screen === 'doctors' && (
            <DoctorSelectionView
              allDoctors={allDoctors}
              triageResult={activeTriageResult}
              triageInput={activeTriageInput}
              initialDivision={user?.division}
              initialArea={user?.area}
              onSelectDoctor={handleSelectDoctor}
              onBackToTriage={() => setScreen('dashboard')}
            />
          )}

          {screen === 'doctor-profile' && selectedDoctor && (
            <DoctorProfileView
              doctor={selectedDoctor}
              user={user}
              lastTriageInput={activeTriageInput}
              onBack={() => setScreen('doctors')}
              onAuthenticated={handleAuthenticated}
              onGoToAuth={() => setScreen('auth')}
              onBooked={handleBooked}
              onViewAppointments={() => setScreen('appointments')}
            />
          )}

          {screen === 'appointments' && (
            <AppointmentsView
              user={user}
              appointments={appointments}
              onCancelled={handleCancelled}
              onFindDoctors={() => {
                setActiveTriageResult(null);
                setScreen('doctors');
              }}
              onGoToAuth={() => setScreen('auth')}
            />
          )}

          {screen === 'profile' && (
            <ProfileView
              user={user}
              triageHistory={triageHistory}
              onUpdated={(updated) => setUser(updated)}
              onGoToAuth={() => setScreen('auth')}
              onOpenHistoryItem={handleOpenHistoryItem}
            />
          )}
        </div>
      )}

      <footer className="hidden md:block border-t border-slate-200 bg-white py-5">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>ShasthoPath · Specialist Guidance &amp; Chamber Directory for Bangladesh</span>
          <span>
            Clinical guidance only — for medical emergencies in Bangladesh, call 999 or visit the
            nearest emergency department.
          </span>
        </div>
      </footer>
    </div>
  );
}
