export type Gender = 'Male' | 'Female' | 'Other';

export type UrgencyLevel = 'routine' | 'priority' | 'urgent';

export type PortraitKey = 'male_senior' | 'female_specialist' | 'male_young';

export type DepartmentId =
  | 'cardiology'
  | 'dermatology'
  | 'neurology'
  | 'gastroenterology'
  | 'pulmonology'
  | 'endocrinology'
  | 'orthopedics'
  | 'ent'
  | 'medicine'
  | 'gynecology'
  | 'pediatrics'
  | 'ophthalmology';

export interface DepartmentInfo {
  id: DepartmentId;
  name: string;
  bengaliName: string;
  specialistTitle: string;
  summary: string;
  commonSymptoms: string[];
  prepChecklist: string[];
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Doctor {
  id: string;
  name: string;
  degrees: string;
  departmentId: DepartmentId;
  specialistTitle: string;
  hospital: string;
  chamberAddress: string;
  chamberPhone: string;
  division: string;
  area: string;
  coordinates: Coordinates;
  experienceYears: number;
  bmdcReg: string;
  feeBdt: number;
  visitingDays: string;
  visitingHours: string;
  availableSlots: string[];
  availableToday: boolean;
  languages: string[];
  focusAreas: string[];
  bio: string;
  portraitKey: PortraitKey;
}

export interface PatientUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  age: number;
  gender: Gender;
  bloodGroup: string;
  division: string;
  area: string;
  phone: string;
  physicalProblems: string[];
  drugHistory: string[];
  createdAt: string;
}

export interface TriageInput {
  patientName: string;
  age: number;
  gender: Gender;
  division: string;
  area: string;
  physicalProblems: string[];
  drugHistory: string[];
  chiefComplaint: string;
  selectedSymptoms: string[];
  duration: string;
  severity: 'Mild' | 'Moderate' | 'Severe';
}

export interface TriageResult {
  source: 'gemini' | 'local';
  primaryDepartmentId: DepartmentId;
  specialistTitle: string;
  departmentName: string;
  bengaliName: string;
  secondaryDepartmentId?: DepartmentId;
  secondarySpecialistTitle?: string;
  urgency: UrgencyLevel;
  urgencyReason: string;
  clinicalSummary: string;
  medicationConsiderations: string;
  questionsForDoctor: string[];
  prepChecklist: string[];
  matchedSignals: string[];
}

export interface TriageHistoryItem {
  id: string;
  userId: string;
  createdAt: string;
  input: TriageInput;
  result: TriageResult;
}

export interface Appointment {
  id: string;
  userId: string;
  doctorId: string;
  doctorName: string;
  departmentName: string;
  hospital: string;
  area: string;
  division: string;
  feeBdt: number;
  patientName: string;
  patientAge: number;
  date: string;
  timeSlot: string;
  chiefComplaintSummary: string;
  drugHistorySummary: string;
  status: 'Confirmed' | 'Cancelled';
  createdAt: string;
}
