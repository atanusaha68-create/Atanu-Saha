import { useState, type FormEvent } from 'react';
import { ArrowRight, Plus, ShieldCheck, X } from 'lucide-react';
import {
  BANGLADESH_LOCATIONS,
  COMMON_PHYSICAL_PROBLEMS,
} from '../shared/bangladeshData';
import type { Gender, PatientUser } from '../shared/types';
import { loginDemoUser, loginUser, registerUser } from '../lib/api';
import { HERO_CLINIC_IMAGE } from '../lib/portraits';

interface AuthScreenProps {
  onAuthenticated: (user: PatientUser) => void;
  onContinueGuest: () => void;
}

export function AuthScreen({ onAuthenticated, onContinueGuest }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [heroError, setHeroError] = useState(false);

  // Login state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Register state
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('32');
  const [gender, setGender] = useState<Gender>('Male');
  const [bloodGroup, setBloodGroup] = useState('B+');
  const [division, setDivision] = useState('Dhaka');
  const [area, setArea] = useState('Dhanmondi');
  const [phone, setPhone] = useState('');
  const [physicalProblems, setPhysicalProblems] = useState<string[]>([]);
  const [drugHistory, setDrugHistory] = useState<string[]>([]);
  const [drugDraft, setDrugDraft] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDivisionEntry =
    BANGLADESH_LOCATIONS.find((d) => d.division === division) ?? BANGLADESH_LOCATIONS[0];

  function handleDivisionChange(nextDiv: string) {
    setDivision(nextDiv);
    const entry = BANGLADESH_LOCATIONS.find((d) => d.division === nextDiv);
    if (entry && entry.areas.length > 0) {
      setArea(entry.areas[0]);
    }
  }

  function toggleCondition(cond: string) {
    setPhysicalProblems((prev) =>
      prev.includes(cond) ? prev.filter((c) => c !== cond) : [...prev, cond]
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

  async function handleLoginSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!identifier.trim() || !password) {
      setError('Please enter your username or email and password.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await loginUser(identifier, password);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDemoLogin() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await loginDemoUser();
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo login unavailable.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegisterSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsedAge = Number(age);
    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!Number.isFinite(parsedAge) || parsedAge < 1 || parsedAge > 120) {
      setError('Please enter a valid age between 1 and 120.');
      return;
    }
    if (regUsername.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (!regEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await registerUser({
        username: regUsername.trim(),
        email: regEmail.trim(),
        password: regPassword,
        fullName: fullName.trim(),
        age: Math.round(parsedAge),
        gender,
        bloodGroup,
        division,
        area,
        phone: phone.trim(),
        physicalProblems,
        drugHistory,
      });
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 lg:py-12 pb-24 md:pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Editorial Hero Column */}
        <section className="lg:col-span-6 relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 min-h-[320px] lg:min-h-[540px] flex flex-col justify-end">
          {!heroError ? (
            <img
              src={HERO_CLINIC_IMAGE}
              alt="Modern specialist consultation reception lounge in Dhaka"
              referrerPolicy="no-referrer"
              onError={() => setHeroError(true)}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#0B6E5B] to-slate-900" />
          )}
          <div
            className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/55 to-slate-950/15"
            aria-hidden="true"
          />
          <div className="relative z-10 p-6 sm:p-10 text-white space-y-4">
            <p className="text-xs font-medium tracking-wide text-teal-200">
              Bangladesh Specialist Triage · Dhaka · Chattogram · Sylhet · Rajshahi · Khulna
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight [text-wrap:balance]">
              Find the right specialist doctor before visiting a chamber
            </h1>
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-xl">
              Describe your symptoms in English, বাংলা, or Banglish along with your age, existing
              physical conditions, and current medications. ShasthoPath guides you to the exact
              medical department and nearby doctors in your area.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-teal-100">
              <span>12 Medical Departments</span>
              <span aria-hidden="true">·</span>
              <span>24 Verified Chamber Profiles</span>
              <span aria-hidden="true">·</span>
              <span>Drug-History Aware Triage</span>
            </div>
          </div>
        </section>

        {/* Right Login / Registration Panel */}
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col justify-center">
          <div>
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="font-display text-2xl font-bold text-slate-900">
                  {mode === 'login' ? 'Patient Sign In' : 'Create Patient Account'}
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  {mode === 'login'
                    ? 'Access your saved medical history, drug list, and specialist visits.'
                    : 'Register once so your age, conditions, and medications pre-fill every check.'}
                </p>
              </div>
            </div>

            {/* Segmented Mode Switch */}
            <div
              className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-6"
              role="tablist"
              aria-label="Account mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`min-h-[44px] text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Login
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`min-h-[44px] text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                  mode === 'register'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Register
              </button>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800"
              >
                {error}
              </div>
            )}

            {mode === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="login-identifier"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Username or Email
                  </label>
                  <input
                    id="login-identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. rafiq_ahmed or email@example.com"
                    autoComplete="username"
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Password
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-[#0B6E5B] hover:bg-[#085647] disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span>{submitting ? 'Signing In...' : 'Sign In'}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="reg-fullname"
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      Full Name
                    </label>
                    <input
                      id="reg-fullname"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Nusrat Jahan"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="reg-age"
                        className="block text-sm font-medium text-slate-700 mb-1"
                      >
                        Age
                      </label>
                      <input
                        id="reg-age"
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
                        htmlFor="reg-gender"
                        className="block text-sm font-medium text-slate-700 mb-1"
                      >
                        Gender
                      </label>
                      <select
                        id="reg-gender"
                        value={gender}
                        onChange={(e) => setGender(e.target.value as Gender)}
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="reg-username"
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      Username
                    </label>
                    <input
                      id="reg-username"
                      type="text"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      placeholder="e.g. nusrat_dhk"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="reg-email"
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      Email
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="reg-password"
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      Password
                    </label>
                    <input
                      id="reg-password"
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min 6 chars"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="reg-division"
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      City / Division
                    </label>
                    <select
                      id="reg-division"
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
                      htmlFor="reg-area"
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      Local Area
                    </label>
                    <select
                      id="reg-area"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                    >
                      {selectedDivisionEntry.areas.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="reg-blood"
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      Blood Group
                    </label>
                    <select
                      id="reg-blood"
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                    >
                      {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((bg) => (
                        <option key={bg} value={bg}>
                          {bg}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="reg-phone"
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      Mobile Number (Optional)
                    </label>
                    <input
                      id="reg-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+880 17XX-XXXXXX"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                    />
                  </div>
                </div>

                <div>
                  <span className="block text-sm font-medium text-slate-700 mb-1.5">
                    Existing Physical Problems (Optional)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_PHYSICAL_PROBLEMS.slice(0, 6).map((cond) => {
                      const active = physicalProblems.includes(cond);
                      return (
                        <button
                          key={cond}
                          type="button"
                          onClick={() => toggleCondition(cond)}
                          aria-pressed={active}
                          className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
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
                    htmlFor="reg-drug-input"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Current Medications / Drug History (Optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="reg-drug-input"
                      type="text"
                      value={drugDraft}
                      onChange={(e) => setDrugDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addDrug();
                        }
                      }}
                      placeholder="e.g. Metformin 500mg, Napa"
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
                    <div className="flex flex-wrap gap-2 mt-2">
                      {drugHistory.map((drug) => (
                        <button
                          key={drug}
                          type="button"
                          onClick={() =>
                            setDrugHistory((prev) => prev.filter((d) => d !== drug))
                          }
                          aria-label={`Remove ${drug}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-medium text-slate-800 hover:bg-slate-200 cursor-pointer"
                        >
                          <span>{drug}</span>
                          <X className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-[#0B6E5B] hover:bg-[#085647] disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span>{submitting ? 'Creating Account...' : 'Create Patient Account'}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </form>
            )}
          </div>

          <div className="mt-6 pt-5 border-t border-slate-200 space-y-3">
            <button
              type="button"
              disabled={submitting}
              onClick={handleDemoLogin}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-800 transition-colors cursor-pointer"
            >
              Continue as Demo Patient (Rafiqul Ahmed · Dhanmondi)
            </button>
            <div className="flex items-center justify-between gap-4 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#0B6E5B]" aria-hidden="true" />
                <span>Medical data saved privately</span>
              </span>
              <button
                type="button"
                onClick={onContinueGuest}
                className="font-semibold text-[#0B6E5B] hover:underline cursor-pointer"
              >
                Quick Symptom Check without Account
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
