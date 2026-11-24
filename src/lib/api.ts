import type {
  Appointment,
  Doctor,
  PatientUser,
  TriageHistoryItem,
  TriageInput,
  TriageResult,
} from '../shared/types';

let authTokenInMemory: string | null = null;

export function setAuthToken(token: string | null): void {
  authTokenInMemory = token;
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('X-Requested-With', 'XMLHttpRequest');
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (authTokenInMemory) {
    headers.set('Authorization', `Bearer ${authTokenInMemory}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  const data = (await res.json().catch(() => ({}))) as T & {
    error?: string;
    code?: string;
  };
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`) as Error & {
      code?: string;
      status?: number;
    };
    err.code = data.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

export interface AuthResponse {
  user: PatientUser;
  token: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  fullName: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  bloodGroup: string;
  division: string;
  area: string;
  phone: string;
  physicalProblems: string[];
  drugHistory: string[];
}

export async function fetchCurrentUser(): Promise<{ user: PatientUser | null }> {
  return apiFetch<{ user: PatientUser | null }>('/api/auth/me');
}

export async function loginUser(identifier: string, password: string): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
  setAuthToken(data.token);
  return data;
}

export async function loginDemoUser(): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>('/api/auth/demo', {
    method: 'POST',
  });
  setAuthToken(data.token);
  return data;
}

export async function registerUser(payload: RegisterPayload): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  setAuthToken(data.token);
  return data;
}

export async function logoutUser(): Promise<void> {
  await apiFetch('/api/auth/logout', { method: 'POST' });
  setAuthToken(null);
}

export async function updateProfile(
  payload: Partial<Omit<PatientUser, 'id' | 'username' | 'email' | 'createdAt'>>
): Promise<{ user: PatientUser }> {
  return apiFetch<{ user: PatientUser }>('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function fetchDoctors(params: {
  department?: string;
  division?: string;
  area?: string;
  search?: string;
  maxFee?: number;
}): Promise<{ doctors: Doctor[] }> {
  const qs = new URLSearchParams();
  if (params.department) qs.set('department', params.department);
  if (params.division) qs.set('division', params.division);
  if (params.area) qs.set('area', params.area);
  if (params.search) qs.set('search', params.search);
  if (params.maxFee) qs.set('maxFee', String(params.maxFee));
  return apiFetch<{ doctors: Doctor[] }>(`/api/doctors?${qs.toString()}`);
}

export interface SlotAvailability {
  time: string;
  booked: boolean;
}

export async function fetchDoctorSlots(
  doctorId: string,
  date: string
): Promise<{ date: string; slots: SlotAvailability[] }> {
  return apiFetch<{ date: string; slots: SlotAvailability[] }>(
    `/api/doctors/${encodeURIComponent(doctorId)}/slots?date=${encodeURIComponent(date)}`
  );
}

export interface TriageApiResponse {
  result: TriageResult;
  matchedDoctors: Doctor[];
  historyItem: TriageHistoryItem | null;
}

export async function submitAiTriage(input: TriageInput): Promise<TriageApiResponse> {
  return apiFetch<TriageApiResponse>('/api/triage', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function submitLocalTriage(input: TriageInput): Promise<TriageApiResponse> {
  return apiFetch<TriageApiResponse>('/api/triage/local', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function transcribeAudio(
  audioBase64: string,
  mimeType: string
): Promise<{ transcript: string }> {
  return apiFetch<{ transcript: string }>('/api/transcribe', {
    method: 'POST',
    body: JSON.stringify({ audioBase64, mimeType }),
  });
}

export async function fetchTriageHistory(): Promise<{ history: TriageHistoryItem[] }> {
  return apiFetch<{ history: TriageHistoryItem[] }>('/api/triage/history');
}

export async function fetchAppointments(): Promise<{ appointments: Appointment[] }> {
  return apiFetch<{ appointments: Appointment[] }>('/api/appointments');
}

export async function createAppointment(payload: {
  doctorId: string;
  date: string;
  timeSlot: string;
  patientName: string;
  patientAge: number;
  chiefComplaintSummary: string;
  drugHistorySummary: string;
}): Promise<{ appointment: Appointment }> {
  return apiFetch<{ appointment: Appointment }>('/api/appointments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function cancelAppointment(id: string): Promise<{ appointment: Appointment }> {
  return apiFetch<{ appointment: Appointment }>(`/api/appointments/${encodeURIComponent(id)}/cancel`, {
    method: 'PATCH',
  });
}
