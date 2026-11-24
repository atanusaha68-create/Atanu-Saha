import { CalendarCheck, ClipboardList, Search, Stethoscope, UserRound } from 'lucide-react';
import type { PatientUser } from '../shared/types';

export type AppScreen =
  | 'auth'
  | 'dashboard'
  | 'doctors'
  | 'doctor-profile'
  | 'appointments'
  | 'profile';

interface TopNavProps {
  activeScreen: AppScreen;
  user: PatientUser | null;
  appointmentCount: number;
  onNavigate: (screen: AppScreen) => void;
  onSignOut: () => void;
}

export function TopNav({
  activeScreen,
  user,
  appointmentCount,
  onNavigate,
  onSignOut,
}: TopNavProps) {
  const navItems: { id: AppScreen; label: string }[] = [
    { id: 'dashboard', label: 'Symptom Triage' },
    { id: 'doctors', label: 'Find Doctors' },
    { id: 'appointments', label: appointmentCount > 0 ? `Visits (${appointmentCount})` : 'Visits' },
    { id: 'profile', label: 'Patient Profile' },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-[#0B6E5B] transition-colors cursor-pointer"
          >
            ShasthoPath
          </button>

          {/* Zone 2: 4 clean single-line text nav links */}
          <nav className="hidden md:flex items-center gap-6" aria-label="Primary navigation">
            {navItems.map((item) => {
              const isActive =
                activeScreen === item.id ||
                (item.id === 'doctors' && activeScreen === 'doctor-profile');
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                    isActive
                      ? 'text-[#0B6E5B] border-[#0B6E5B]'
                      : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            {user ? (
              <button
                type="button"
                onClick={onSignOut}
                className="px-4 py-2 min-h-[40px] text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign Out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('auth')}
                className="px-4 py-2 min-h-[40px] text-xs font-semibold text-white bg-[#0B6E5B] hover:bg-[#085647] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Tab Bar (56px height + 56px header = 112px <= 15% of 844px) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-14 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-4 items-center"
        aria-label="Mobile navigation"
      >
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            activeScreen === 'dashboard' ? 'text-[#0B6E5B]' : 'text-slate-600'
          }`}
        >
          <ClipboardList className="w-5 h-5" aria-hidden="true" />
          <span>Triage</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('doctors')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            activeScreen === 'doctors' || activeScreen === 'doctor-profile'
              ? 'text-[#0B6E5B]'
              : 'text-slate-600'
          }`}
        >
          <Search className="w-5 h-5" aria-hidden="true" />
          <span>Doctors</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('appointments')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            activeScreen === 'appointments' ? 'text-[#0B6E5B]' : 'text-slate-600'
          }`}
        >
          <CalendarCheck className="w-5 h-5" aria-hidden="true" />
          <span>Visits</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate(user ? 'profile' : 'auth')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            activeScreen === 'profile' || activeScreen === 'auth'
              ? 'text-[#0B6E5B]'
              : 'text-slate-600'
          }`}
        >
          {user ? (
            <UserRound className="w-5 h-5" aria-hidden="true" />
          ) : (
            <Stethoscope className="w-5 h-5" aria-hidden="true" />
          )}
          <span>{user ? 'Profile' : 'Sign In'}</span>
        </button>
      </nav>
    </>
  );
}
