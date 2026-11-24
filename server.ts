import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  BANGLADESH_LOCATIONS,
  DEPARTMENTS,
  DOCTORS,
  getDepartmentById,
} from './src/shared/bangladeshData';
import type {
  Appointment,
  DepartmentId,
  Gender,
  PatientUser,
  TriageHistoryItem,
  TriageInput,
  TriageResult,
  UrgencyLevel,
} from './src/shared/types';
import { evaluateSymptomsLocally, rankDoctorsForTriage } from './src/lib/triage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const STORE_PATH = path.resolve(DATA_DIR, 'store.json');

interface StoredUser extends PatientUser {
  passwordHash: string;
  passwordSalt: string;
}

interface SessionRecord {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: number;
}

interface DatabaseStore {
  users: StoredUser[];
  sessions: SessionRecord[];
  triageHistory: TriageHistoryItem[];
  appointments: Appointment[];
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const computed = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  if (computed.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(computed, expected);
}

function toSafeUser(user: StoredUser): PatientUser {
  const { passwordHash: _ph, passwordSalt: _ps, ...safe } = user;
  return safe;
}

function buildInitialStore(): DatabaseStore {
  const demoSalt = crypto.randomBytes(16).toString('hex');
  const demoSecret = crypto.randomBytes(24).toString('hex');
  const demoUser: StoredUser = {
    id: 'user-demo-rafiq',
    username: 'rafiq_ahmed',
    email: 'rafiq.ahmed@example.com',
    fullName: 'Rafiqul Ahmed',
    age: 42,
    gender: 'Male',
    bloodGroup: 'B+',
    division: 'Dhaka',
    area: 'Dhanmondi',
    phone: '+880 1711-004821',
    physicalProblems: ['Hypertension (High BP)', 'Type 2 Diabetes'],
    drugHistory: ['Metformin 500mg (twice daily)', 'Amlodipine 5mg (morning)'],
    createdAt: '2026-10-12T08:00:00.000Z',
    passwordSalt: demoSalt,
    passwordHash: hashPassword(demoSecret, demoSalt),
  };

  const sampleTriageInput: TriageInput = {
    patientName: 'Rafiqul Ahmed',
    age: 42,
    gender: 'Male',
    division: 'Dhaka',
    area: 'Dhanmondi',
    physicalProblems: ['Hypertension (High BP)', 'Type 2 Diabetes'],
    drugHistory: ['Metformin 500mg (twice daily)', 'Amlodipine 5mg (morning)'],
    chiefComplaint:
      'Mild chest tightness and breathlessness when climbing stairs for the last 2 days.',
    selectedSymptoms: ['Chest tightness or pain', 'Shortness of breath'],
    duration: '2 days',
    severity: 'Moderate',
  };

  const sampleResult = evaluateSymptomsLocally(sampleTriageInput);

  const sampleAppointment: Appointment = {
    id: 'apt-seed-1',
    userId: demoUser.id,
    doctorId: 'doc-card-dhk-1',
    doctorName: 'Prof. Dr. Mahbubur Rahman',
    departmentName: 'Cardiology',
    hospital: 'Labaid Specialized Hospital',
    area: 'Dhanmondi',
    division: 'Dhaka',
    feeBdt: 1500,
    patientName: 'Rafiqul Ahmed',
    patientAge: 42,
    date: '2026-11-26',
    timeSlot: '6:15 PM',
    chiefComplaintSummary: 'Chest tightness and exertional shortness of breath (2 days)',
    drugHistorySummary: 'Metformin 500mg, Amlodipine 5mg',
    status: 'Confirmed',
    createdAt: '2026-11-22T11:30:00.000Z',
  };

  return {
    users: [demoUser],
    sessions: [],
    triageHistory: [
      {
        id: 'tri-seed-1',
        userId: demoUser.id,
        createdAt: '2026-11-22T11:15:00.000Z',
        input: sampleTriageInput,
        result: sampleResult,
      },
    ],
    appointments: [sampleAppointment],
  };
}

function ensureStore(): DatabaseStore {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!STORE_PATH.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Invalid store path');
  }
  if (!fs.existsSync(STORE_PATH)) {
    const seeded = buildInitialStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(seeded, null, 2), 'utf-8');
    return seeded;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as DatabaseStore;
    if (!Array.isArray(parsed.users)) {
      throw new Error('Corrupt store');
    }
    return parsed;
  } catch {
    const seeded = buildInitialStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(seeded, null, 2), 'utf-8');
    return seeded;
  }
}

function saveStore(store: DatabaseStore): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      result[key] = decodeURIComponent(val);
    }
  }
  return result;
}

function setSessionCookie(res: Response, token: string): void {
  res.setHeader(
    'Set-Cookie',
    `sp_session=${encodeURIComponent(token)}; Path=/; Max-Age=${7 * 24 * 3600}; HttpOnly; Secure; SameSite=None; Partitioned`
  );
}

function clearSessionCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    'sp_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None; Partitioned'
  );
}

function extractSessionToken(req: Request): { token: string | null; viaCookie: boolean } {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) {
      return { token: bearer, viaCookie: false };
    }
  }
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.sp_session) {
    return { token: cookies.sp_session, viaCookie: true };
  }
  return { token: null, viaCookie: false };
}

function verifyMutationOrigin(req: Request): boolean {
  const xRequestedWith = req.headers['x-requested-with'];
  if (xRequestedWith === 'XMLHttpRequest') {
    return true;
  }
  const origin = req.headers.origin;
  const host = (req.headers['x-forwarded-host'] || req.headers.host) as string | undefined;
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      return originHost === host;
    } catch {
      return false;
    }
  }
  return false;
}

interface AuthedRequest extends Request {
  authUser?: StoredUser;
  authToken?: string;
}

function authenticateOptional(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const { token } = extractSessionToken(req);
  if (!token) {
    next();
    return;
  }
  const store = ensureStore();
  const now = Date.now();
  const session = store.sessions.find((s) => s.token === token && s.expiresAt > now);
  if (session) {
    const user = store.users.find((u) => u.id === session.userId);
    if (user) {
      req.authUser = user;
      req.authToken = token;
    }
  }
  next();
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const { token, viaCookie } = extractSessionToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (
    viaCookie &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
    !verifyMutationOrigin(req)
  ) {
    res.status(403).json({ error: 'Invalid request origin.' });
    return;
  }
  const store = ensureStore();
  const now = Date.now();
  const session = store.sessions.find((s) => s.token === token && s.expiresAt > now);
  if (!session) {
    res.status(401).json({ error: 'Session expired or invalid.' });
    return;
  }
  const user = store.users.find((u) => u.id === session.userId);
  if (!user) {
    res.status(401).json({ error: 'User account not found.' });
    return;
  }
  req.authUser = user;
  req.authToken = token;
  next();
}

function sanitizeStringArray(arr: unknown, maxItems = 20, maxLen = 80): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((item): item is string => typeof item === 'string')
    .map((s) => s.trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeTriageInput(body: unknown): { input?: TriageInput; error?: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'Invalid symptom intake payload.' };
  }
  const raw = body as Record<string, unknown>;
  const patientName =
    typeof raw.patientName === 'string' ? raw.patientName.trim().slice(0, 80) : '';
  const age = Number(raw.age);
  const gender: Gender =
    raw.gender === 'Female' || raw.gender === 'Other' ? raw.gender : 'Male';
  const division =
    typeof raw.division === 'string' &&
    BANGLADESH_LOCATIONS.some((d) => d.division === raw.division)
      ? raw.division
      : 'Dhaka';
  const divisionEntry = BANGLADESH_LOCATIONS.find((d) => d.division === division)!;
  const area =
    typeof raw.area === 'string' && divisionEntry.areas.includes(raw.area)
      ? raw.area
      : divisionEntry.areas[0];
  const physicalProblems = sanitizeStringArray(raw.physicalProblems, 15, 80);
  const drugHistory = sanitizeStringArray(raw.drugHistory, 20, 100);
  const chiefComplaint =
    typeof raw.chiefComplaint === 'string' ? raw.chiefComplaint.trim().slice(0, 1500) : '';
  const selectedSymptoms = sanitizeStringArray(raw.selectedSymptoms, 15, 80);
  const duration =
    typeof raw.duration === 'string' ? raw.duration.trim().slice(0, 50) : '2–3 days';
  const severity: 'Mild' | 'Moderate' | 'Severe' =
    raw.severity === 'Mild' || raw.severity === 'Severe' ? raw.severity : 'Moderate';

  if (!patientName) {
    return { error: 'Please enter the patient name.' };
  }
  if (!Number.isFinite(age) || age < 0 || age > 120) {
    return { error: 'Please enter a valid patient age between 0 and 120.' };
  }
  if (!chiefComplaint && selectedSymptoms.length === 0) {
    return { error: 'Please describe your symptoms or select at least one symptom.' };
  }

  return {
    input: {
      patientName,
      age: Math.round(age),
      gender,
      division,
      area,
      physicalProblems,
      drugHistory,
      chiefComplaint,
      selectedSymptoms,
      duration,
      severity,
    },
  };
}

function getGeminiClient(apiVersion?: 'v1' | 'v1beta'): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    const err = new Error(
      'Gemini AI service is waiting for a valid GEMINI_API_KEY in Settings > Secrets.'
    ) as Error & { code?: string; status?: number };
    err.code = 'GEMINI_UNAVAILABLE';
    err.status = 503;
    throw err;
  }

  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isModelNotFoundError(err: unknown): boolean {
  const e = err as Error & { status?: number };
  if (e.status === 404) return true;
  const msg = (e.message || '').toLowerCase();
  return (
    msg.includes('404') ||
    msg.includes('not_found') ||
    msg.includes('is not found') ||
    msg.includes('is not supported for generatecontent')
  );
}

function formatGeminiError(
  err: unknown,
  serviceLabel: string
): { status: number; message: string; code: string } {
  const e = err as Error & { code?: string; status?: number };
  let status = typeof e.status === 'number' && e.status >= 400 ? e.status : 502;
  let message = e.message || `Unable to reach ${serviceLabel}.`;

  try {
    const parsed = JSON.parse(message) as {
      error?: { code?: number; message?: string; status?: string };
    };
    if (parsed?.error?.message) {
      const upstreamCode = parsed.error.code;
      if (typeof upstreamCode === 'number' && upstreamCode >= 400) {
        status = upstreamCode;
      }
      message =
        status === 503
          ? `${serviceLabel} is temporarily busy (503). Please try again in a moment.`
          : `${serviceLabel} error (${status}): ${parsed.error.message}`;
    }
  } catch {
    // Keep original message if not JSON
  }

  return {
    status,
    message,
    code: e.code || 'GEMINI_ERROR',
  };
}

async function runGeminiTriage(input: TriageInput): Promise<TriageResult> {
  const ai = getGeminiClient();

  const validDeptIds = DEPARTMENTS.map((d) => d.id);
  const departmentListText = DEPARTMENTS.map(
    (d) => `- "${d.id}": ${d.name} (${d.specialistTitle}) — ${d.summary}`
  ).join('\n');

  const prompt = [
    `Patient Intake:`,
    `- Name: ${input.patientName}`,
    `- Age: ${input.age} years, Gender: ${input.gender}`,
    `- Location in Bangladesh: ${input.area}, ${input.division}`,
    `- Existing Physical Problems: ${input.physicalProblems.length ? input.physicalProblems.join(', ') : 'None reported'}`,
    `- Drug History / Current Medications: ${input.drugHistory.length ? input.drugHistory.join(', ') : 'None reported'}`,
    `- Selected Symptoms: ${input.selectedSymptoms.length ? input.selectedSymptoms.join(', ') : 'None'}`,
    `- Chief Complaint (Patient's own words, may be English, Bengali, or Banglish): "${input.chiefComplaint}"`,
    `- Duration: ${input.duration}, Self-rated Severity: ${input.severity}`,
    ``,
    `Available Medical Departments (choose primaryDepartmentId strictly from these exact IDs):`,
    departmentListText,
  ].join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      systemInstruction:
        'You are a careful clinical triage assistant helping patients in Bangladesh choose the most appropriate specialist department. Read English, Bengali, and Banglish descriptions accurately. Pay strict attention to NEGATED symptoms (e.g., "কোনো শ্বাসকষ্ট নেই", "কোনো বুকে ব্যথা নেই", "কোনো শুকনো কাশি নেই", "no chest pain", "without cough") and NEVER treat negated symptoms as present. When fever co-occurs with subacute chest discomfort without cardiac risk factors, prefer pulmonology or medicine. Account for patient age (children <= 14 usually go to pediatrics unless specialized eye/skin/ortho), existing chronic physical problems, and drug history. Never recommend broad unrelated departments; pick the exact primary department and at most one closely related secondary department.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          primaryDepartmentId: {
            type: Type.STRING,
            description: `One of: ${validDeptIds.join(', ')}`,
          },
          secondaryDepartmentId: {
            type: Type.STRING,
            description: `Optional second department ID from: ${validDeptIds.join(', ')}, or empty string if none`,
          },
          urgency: {
            type: Type.STRING,
            description: 'One of: routine, priority, urgent',
          },
          urgencyReason: {
            type: Type.STRING,
            description: '1-2 sentence explanation of urgency level.',
          },
          clinicalSummary: {
            type: Type.STRING,
            description:
              'Clear, reassuring explanation addressed to the patient telling them which specialist they should visit and why.',
          },
          medicationConsiderations: {
            type: Type.STRING,
            description:
              'Practical note reviewing their current drug history or advising what medicines to mention to the doctor.',
          },
          questionsForDoctor: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '3 concise, useful questions the patient should ask the specialist.',
          },
          matchedSignals: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '2-5 key symptoms, conditions, or medications factored into this recommendation.',
          },
        },
        required: [
          'primaryDepartmentId',
          'urgency',
          'urgencyReason',
          'clinicalSummary',
          'medicationConsiderations',
          'questionsForDoctor',
          'matchedSignals',
        ],
      },
    },
  });

  const text = (response.text ?? '').trim();
  if (!text) {
    throw new Error('Empty response from Gemini triage service.');
  }
  const parsed = JSON.parse(text) as {
    primaryDepartmentId?: string;
    secondaryDepartmentId?: string;
    urgency?: string;
    urgencyReason?: string;
    clinicalSummary?: string;
    medicationConsiderations?: string;
    questionsForDoctor?: string[];
    matchedSignals?: string[];
  };

  const primaryDept = getDepartmentById(parsed.primaryDepartmentId ?? 'medicine');
  const secondaryDept =
    parsed.secondaryDepartmentId &&
    parsed.secondaryDepartmentId !== primaryDept.id &&
    DEPARTMENTS.some((d) => d.id === parsed.secondaryDepartmentId)
      ? getDepartmentById(parsed.secondaryDepartmentId)
      : undefined;

  const urgency: UrgencyLevel =
    parsed.urgency === 'urgent' || parsed.urgency === 'priority' ? parsed.urgency : 'routine';

  return {
    source: 'gemini',
    primaryDepartmentId: primaryDept.id as DepartmentId,
    specialistTitle: primaryDept.specialistTitle,
    departmentName: primaryDept.name,
    bengaliName: primaryDept.bengaliName,
    secondaryDepartmentId: secondaryDept?.id as DepartmentId | undefined,
    secondarySpecialistTitle: secondaryDept?.specialistTitle,
    urgency,
    urgencyReason:
      parsed.urgencyReason || 'Schedule a chamber visit with the recommended specialist.',
    clinicalSummary:
      parsed.clinicalSummary ||
      `Based on your symptoms and history, you should visit a ${primaryDept.specialistTitle} (${primaryDept.name}).`,
    medicationConsiderations:
      parsed.medicationConsiderations ||
      'Bring your complete list of current medications and prescriptions to the appointment.',
    questionsForDoctor:
      Array.isArray(parsed.questionsForDoctor) && parsed.questionsForDoctor.length > 0
        ? parsed.questionsForDoctor.slice(0, 4)
        : [
            'Which tests do I need to confirm the cause of my symptoms?',
            'Do any of my current medications need adjustment?',
            'What warning signs mean I should seek urgent care?',
          ],
    prepChecklist: primaryDept.prepChecklist,
    matchedSignals: Array.isArray(parsed.matchedSignals) ? parsed.matchedSignals.slice(0, 6) : [],
  };
}

function recordTriageHistory(
  userId: string,
  input: TriageInput,
  result: TriageResult
): TriageHistoryItem {
  const store = ensureStore();
  const item: TriageHistoryItem = {
    id: `tri-${crypto.randomUUID().slice(0, 8)}`,
    userId,
    createdAt: new Date().toISOString(),
    input,
    result,
  };
  store.triageHistory.unshift(item);
  if (store.triageHistory.length > 100) {
    store.triageHistory = store.triageHistory.slice(0, 100);
  }
  saveStore(store);
  return item;
}

async function startServer(): Promise<void> {
  ensureStore();
  const app = express();
  app.set('trust proxy', 1);

  const ALLOWED_AUDIO_MIME_TYPES = new Set([
    'audio/webm',
    'audio/mp3',
    'audio/mpeg',
    'audio/wav',
    'audio/wave',
    'audio/ogg',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/aac',
    'audio/flac',
  ]);

  app.post('/api/transcribe', express.json({ limit: '15mb' }), async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const rawMime = typeof body.mimeType === 'string' ? body.mimeType.trim().toLowerCase() : '';
    const baseMime = rawMime.split(';')[0].trim();
    const rawAudio =
      typeof body.audioBase64 === 'string' ? body.audioBase64.trim() : '';
    const audioBase64 = rawAudio.replace(/^data:[^;]+;base64,/, '').trim();

    if (!audioBase64) {
      res.status(400).json({ error: 'Recorded audio data is required.' });
      return;
    }
    if (audioBase64.length > 16 * 1024 * 1024) {
      res.status(400).json({ error: 'Audio recording is too large (maximum 10 MB).' });
      return;
    }
    const normalizedMime = baseMime === 'audio/x-m4a' ? 'audio/mp4' : baseMime;
    const mimeType = ALLOWED_AUDIO_MIME_TYPES.has(normalizedMime) ? normalizedMime : 'audio/webm';

    const audioContents = {
      parts: [
        {
          inlineData: {
            mimeType,
            data: audioBase64,
          },
        },
        {
          text: 'Listen to the spoken patient symptoms and transcribe them accurately in the original spoken language (Bengali বাংলা script if spoken in Bengali, or English if spoken in English). Return ONLY the plain transcript text with no commentary, labels, or quotes.',
        },
      ],
    };

    try {
      let response;
      try {
        const aiBeta = getGeminiClient('v1beta');
        response = await aiBeta.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: audioContents,
        });
      } catch (primaryErr) {
        if (!isModelNotFoundError(primaryErr)) {
          throw primaryErr;
        }
        const aiDefault = getGeminiClient();
        response = await aiDefault.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: audioContents,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });
      }

      const transcript = (response.text ?? '').trim();
      if (!transcript) {
        res.status(422).json({
          error:
            'Could not detect clear speech in the recording. Please try speaking closer to the microphone.',
        });
        return;
      }
      res.json({ transcript });
    } catch (err) {
      const formatted = formatGeminiError(err, 'Audio transcription service');
      res.status(formatted.status).json({
        error: formatted.message,
        code: formatted.code,
      });
    }
  });

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/auth/register', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const username =
      typeof body.username === 'string' ? body.username.trim().toLowerCase().slice(0, 40) : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 80) : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const fullName =
      typeof body.fullName === 'string' ? body.fullName.trim().slice(0, 80) : '';
    const age = Number(body.age);
    const gender: Gender =
      body.gender === 'Female' || body.gender === 'Other' ? body.gender : 'Male';
    const bloodGroup =
      typeof body.bloodGroup === 'string' ? body.bloodGroup.trim().slice(0, 6) : 'O+';
    const division =
      typeof body.division === 'string' &&
      BANGLADESH_LOCATIONS.some((d) => d.division === body.division)
        ? body.division
        : 'Dhaka';
    const divEntry = BANGLADESH_LOCATIONS.find((d) => d.division === division)!;
    const area =
      typeof body.area === 'string' && divEntry.areas.includes(body.area)
        ? body.area
        : divEntry.areas[0];
    const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 24) : '';
    const physicalProblems = sanitizeStringArray(body.physicalProblems, 15, 80);
    const drugHistory = sanitizeStringArray(body.drugHistory, 20, 100);

    if (!username || username.length < 3 || !/^[a-z0-9_.-]+$/.test(username)) {
      res.status(400).json({
        error: 'Username must be at least 3 characters (letters, numbers, _, ., -).',
      });
      return;
    }
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (!password || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }
    if (!fullName) {
      res.status(400).json({ error: 'Please enter your full name.' });
      return;
    }
    if (!Number.isFinite(age) || age < 1 || age > 120) {
      res.status(400).json({ error: 'Please enter a valid age between 1 and 120.' });
      return;
    }

    const store = ensureStore();
    if (store.users.some((u) => u.username === username || u.email === email)) {
      res.status(409).json({ error: 'An account with this username or email already exists.' });
      return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const newUser: StoredUser = {
      id: `user-${crypto.randomUUID().slice(0, 8)}`,
      username,
      email,
      fullName,
      age: Math.round(age),
      gender,
      bloodGroup,
      division,
      area,
      phone,
      physicalProblems,
      drugHistory,
      createdAt: new Date().toISOString(),
      passwordSalt: salt,
      passwordHash: hashPassword(password, salt),
    };

    const token = crypto.randomBytes(32).toString('hex');
    store.users.push(newUser);
    store.sessions.push({
      token,
      userId: newUser.id,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
    });
    saveStore(store);

    setSessionCookie(res, token);
    res.status(201).json({ user: toSafeUser(newUser), token });
  });

  app.post('/api/auth/login', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const identifier =
      typeof body.identifier === 'string' ? body.identifier.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!identifier || !password) {
      res.status(400).json({ error: 'Please enter both username/email and password.' });
      return;
    }

    const store = ensureStore();
    const user = store.users.find(
      (u) => u.username === identifier || u.email === identifier
    );
    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid username/email or password.' });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    store.sessions.push({
      token,
      userId: user.id,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
    });
    saveStore(store);

    setSessionCookie(res, token);
    res.json({ user: toSafeUser(user), token });
  });

  app.post('/api/auth/demo', (_req, res) => {
    const store = ensureStore();
    const demoUser = store.users.find((u) => u.id === 'user-demo-rafiq') ?? store.users[0];
    if (!demoUser) {
      res.status(404).json({ error: 'Demo patient profile unavailable.' });
      return;
    }
    const token = crypto.randomBytes(32).toString('hex');
    store.sessions.push({
      token,
      userId: demoUser.id,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
    });
    saveStore(store);

    setSessionCookie(res, token);
    res.json({ user: toSafeUser(demoUser), token });
  });

  app.post('/api/auth/logout', authenticateOptional, (req: AuthedRequest, res) => {
    if (req.authToken) {
      const store = ensureStore();
      store.sessions = store.sessions.filter((s) => s.token !== req.authToken);
      saveStore(store);
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', authenticateOptional, (req: AuthedRequest, res) => {
    res.json({ user: req.authUser ? toSafeUser(req.authUser) : null });
  });

  app.put('/api/profile', requireAuth, (req: AuthedRequest, res) => {
    const body = req.body as Record<string, unknown>;
    const store = ensureStore();
    const user = store.users.find((u) => u.id === req.authUser!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (typeof body.fullName === 'string' && body.fullName.trim()) {
      user.fullName = body.fullName.trim().slice(0, 80);
    }
    if (body.age !== undefined) {
      const age = Number(body.age);
      if (!Number.isFinite(age) || age < 1 || age > 120) {
        res.status(400).json({ error: 'Age must be between 1 and 120.' });
        return;
      }
      user.age = Math.round(age);
    }
    if (body.gender === 'Male' || body.gender === 'Female' || body.gender === 'Other') {
      user.gender = body.gender;
    }
    if (typeof body.bloodGroup === 'string') {
      user.bloodGroup = body.bloodGroup.trim().slice(0, 6);
    }
    if (typeof body.phone === 'string') {
      user.phone = body.phone.trim().slice(0, 24);
    }
    if (
      typeof body.division === 'string' &&
      BANGLADESH_LOCATIONS.some((d) => d.division === body.division)
    ) {
      user.division = body.division;
      const divEntry = BANGLADESH_LOCATIONS.find((d) => d.division === body.division)!;
      if (typeof body.area === 'string' && divEntry.areas.includes(body.area)) {
        user.area = body.area;
      } else {
        user.area = divEntry.areas[0];
      }
    }
    if (Array.isArray(body.physicalProblems)) {
      user.physicalProblems = sanitizeStringArray(body.physicalProblems, 15, 80);
    }
    if (Array.isArray(body.drugHistory)) {
      user.drugHistory = sanitizeStringArray(body.drugHistory, 20, 100);
    }

    saveStore(store);
    res.json({ user: toSafeUser(user) });
  });

  app.get('/api/doctors', (req, res) => {
    const departmentId =
      typeof req.query.department === 'string' ? req.query.department : 'all';
    const division = typeof req.query.division === 'string' ? req.query.division : 'all';
    const area = typeof req.query.area === 'string' ? req.query.area : 'all';
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const maxFee = req.query.maxFee ? Number(req.query.maxFee) : undefined;
    const lat = req.query.lat ? Number(req.query.lat) : undefined;
    const lng = req.query.lng ? Number(req.query.lng) : undefined;
    const userCoords =
      lat !== undefined && lng !== undefined && Number.isFinite(lat) && Number.isFinite(lng)
        ? { lat, lng }
        : undefined;

    const doctors = rankDoctorsForTriage(DOCTORS, {
      departmentId,
      division,
      area,
      search,
      maxFee: Number.isFinite(maxFee) ? maxFee : undefined,
      userCoords,
    });
    res.json({ doctors });
  });

  app.get('/api/doctors/:id', (req, res) => {
    const doc = DOCTORS.find((d) => d.id === req.params.id);
    if (!doc) {
      res.status(404).json({ error: 'Doctor profile not found.' });
      return;
    }
    res.json({ doctor: doc });
  });

  app.get('/api/doctors/:id/slots', (req, res) => {
    const doc = DOCTORS.find((d) => d.id === req.params.id);
    if (!doc) {
      res.status(404).json({ error: 'Doctor profile not found.' });
      return;
    }
    const date = typeof req.query.date === 'string' ? req.query.date.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'Valid YYYY-MM-DD date query parameter is required.' });
      return;
    }
    const store = ensureStore();
    const takenSlots = new Set(
      store.appointments
        .filter(
          (a) => a.doctorId === doc.id && a.date === date && a.status === 'Confirmed'
        )
        .map((a) => a.timeSlot)
    );
    const slots = doc.availableSlots.map((time) => ({
      time,
      booked: takenSlots.has(time),
    }));
    res.json({ date, slots });
  });

  app.post('/api/triage', authenticateOptional, async (req: AuthedRequest, res) => {
    const { input, error } = sanitizeTriageInput(req.body);
    if (!input) {
      res.status(400).json({ error });
      return;
    }

    try {
      const result = await runGeminiTriage(input);
      const historyItem = req.authUser
        ? recordTriageHistory(req.authUser.id, input, result)
        : null;
      const matchedDoctors = rankDoctorsForTriage(DOCTORS, {
        departmentId: result.primaryDepartmentId,
        division: input.division,
        area: input.area,
      });
      res.json({ result, matchedDoctors, historyItem });
    } catch (err) {
      const formatted = formatGeminiError(err, 'AI clinical triage service');
      const message =
        formatted.status === 503
          ? 'AI clinical triage service is temporarily busy (503). Please try again in a moment or use Local Clinical Rules below.'
          : formatted.message;

      res.status(formatted.status).json({
        error: message,
        code: formatted.code,
      });
    }
  });

  app.post('/api/triage/local', authenticateOptional, (req: AuthedRequest, res) => {
    const { input, error } = sanitizeTriageInput(req.body);
    if (!input) {
      res.status(400).json({ error });
      return;
    }

    const result = evaluateSymptomsLocally(input);
    const historyItem = req.authUser
      ? recordTriageHistory(req.authUser.id, input, result)
      : null;
    const matchedDoctors = rankDoctorsForTriage(DOCTORS, {
      departmentId: result.primaryDepartmentId,
      division: input.division,
      area: input.area,
    });
    res.json({ result, matchedDoctors, historyItem });
  });

  app.get('/api/triage/history', requireAuth, (req: AuthedRequest, res) => {
    const store = ensureStore();
    const items = store.triageHistory.filter((item) => item.userId === req.authUser!.id);
    res.json({ history: items });
  });

  app.get('/api/appointments', requireAuth, (req: AuthedRequest, res) => {
    const store = ensureStore();
    const appointments = store.appointments.filter((a) => a.userId === req.authUser!.id);
    res.json({ appointments });
  });

  app.post('/api/appointments', requireAuth, (req: AuthedRequest, res) => {
    const body = req.body as Record<string, unknown>;
    const doctorId = typeof body.doctorId === 'string' ? body.doctorId : '';
    const date = typeof body.date === 'string' ? body.date.trim() : '';
    const timeSlot = typeof body.timeSlot === 'string' ? body.timeSlot.trim() : '';
    const patientName =
      typeof body.patientName === 'string' && body.patientName.trim()
        ? body.patientName.trim().slice(0, 80)
        : req.authUser!.fullName;
    const patientAge = Number(body.patientAge ?? req.authUser!.age);
    const chiefComplaintSummary =
      typeof body.chiefComplaintSummary === 'string'
        ? body.chiefComplaintSummary.trim().slice(0, 400)
        : 'Specialist consultation';
    const drugHistorySummary =
      typeof body.drugHistorySummary === 'string'
        ? body.drugHistorySummary.trim().slice(0, 300)
        : req.authUser!.drugHistory.join(', ') || 'None reported';

    const doctor = DOCTORS.find((d) => d.id === doctorId);
    if (!doctor) {
      res.status(404).json({ error: 'Selected doctor was not found.' });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'Please select a valid appointment date.' });
      return;
    }
    if (!doctor.availableSlots.includes(timeSlot)) {
      res.status(400).json({ error: 'Please select one of the doctor’s available time slots.' });
      return;
    }
    if (!Number.isFinite(patientAge) || patientAge < 0 || patientAge > 120) {
      res.status(400).json({ error: 'Invalid patient age.' });
      return;
    }

    const dept = getDepartmentById(doctor.departmentId);
    const store = ensureStore();
    const conflict = store.appointments.some(
      (a) =>
        a.doctorId === doctor.id &&
        a.date === date &&
        a.timeSlot === timeSlot &&
        a.status === 'Confirmed'
    );
    if (conflict) {
      res.status(409).json({
        error: 'This time slot is already booked for that date. Please pick another slot.',
      });
      return;
    }

    const newAppointment: Appointment = {
      id: `apt-${crypto.randomUUID().slice(0, 8)}`,
      userId: req.authUser!.id,
      doctorId: doctor.id,
      doctorName: doctor.name,
      departmentName: dept.name,
      hospital: doctor.hospital,
      area: doctor.area,
      division: doctor.division,
      feeBdt: doctor.feeBdt,
      patientName,
      patientAge: Math.round(patientAge),
      date,
      timeSlot,
      chiefComplaintSummary,
      drugHistorySummary,
      status: 'Confirmed',
      createdAt: new Date().toISOString(),
    };

    store.appointments.unshift(newAppointment);
    saveStore(store);
    res.status(201).json({ appointment: newAppointment });
  });

  app.patch('/api/appointments/:id/cancel', requireAuth, (req: AuthedRequest, res) => {
    const store = ensureStore();
    const appointment = store.appointments.find(
      (a) => a.id === req.params.id && a.userId === req.authUser!.id
    );
    if (!appointment) {
      res.status(404).json({ error: 'Appointment not found.' });
      return;
    }
    appointment.status = 'Cancelled';
    saveStore(store);
    res.json({ appointment });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`ShasthoPath server listening on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
