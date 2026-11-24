import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Calendar, Clock, Mic, Plus, Square, X } from 'lucide-react';
import {
  BANGLADESH_LOCATIONS,
  COMMON_PHYSICAL_PROBLEMS,
  COMMON_SYMPTOM_CHIPS,
} from '../shared/bangladeshData';
import type {
  Appointment,
  Gender,
  PatientUser,
  TriageHistoryItem,
  TriageInput,
} from '../shared/types';
import {
  submitAiTriage,
  submitLocalTriage,
  transcribeAudio,
  type TriageApiResponse,
} from '../lib/api';
import {
  classifyMicrophoneError,
  normalizeAudioMimeType,
  pickSupportedAudioMimeType,
  validateAudioBlobSize,
  type MicPermissionStatus,
} from '../lib/voice';

interface DashboardTriageProps {
  user: PatientUser | null;
  triageHistory: TriageHistoryItem[];
  appointments: Appointment[];
  onTriageComplete: (input: TriageInput, response: TriageApiResponse) => void;
  onOpenAppointments: () => void;
  onOpenProfile: () => void;
  onOpenHistoryItem: (item: TriageHistoryItem) => void;
}

export function DashboardTriage({
  user,
  triageHistory,
  appointments,
  onTriageComplete,
  onOpenAppointments,
  onOpenProfile,
  onOpenHistoryItem,
}: DashboardTriageProps) {
  const [patientName, setPatientName] = useState(user?.fullName ?? '');
  const [age, setAge] = useState(user ? String(user.age) : '');
  const [gender, setGender] = useState<Gender>(user?.gender ?? 'Male');
  const [division, setDivision] = useState(user?.division ?? 'Dhaka');
  const [area, setArea] = useState(user?.area ?? 'Dhanmondi');

  const [physicalProblems, setPhysicalProblems] = useState<string[]>(
    user?.physicalProblems ?? []
  );
  const [customProblemDraft, setCustomProblemDraft] = useState('');

  const [drugHistory, setDrugHistory] = useState<string[]>(user?.drugHistory ?? []);
  const [drugDraft, setDrugDraft] = useState('');

  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [duration, setDuration] = useState('2–3 days');
  const [severity, setSeverity] = useState<'Mild' | 'Moderate' | 'Severe'>('Moderate');

  const [loadingAi, setLoadingAi] = useState(false);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [aiUnavailable, setAiUnavailable] = useState(false);

  // Microphone recording & Gemini audio transcription state
  const [isRequestingMic, setIsRequestingMic] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [micPermission, setMicPermission] = useState<MicPermissionStatus>('unknown');
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  // Sync user defaults when user logs in or profile updates
  useEffect(() => {
    if (user) {
      setPatientName(user.fullName);
      setAge(String(user.age));
      setGender(user.gender);
      setDivision(user.division);
      setArea(user.area);
      setPhysicalProblems(user.physicalProblems);
      setDrugHistory(user.drugHistory);
    }
  }, [user]);

  useEffect(() => {
    isMountedRef.current = true;
    let permissionStatusObj: PermissionStatus | null = null;

    if (
      typeof window !== 'undefined' &&
      (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
    ) {
      setMicPermission('unsupported');
    } else if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((status) => {
          if (!isMountedRef.current) return;
          permissionStatusObj = status;
          setMicPermission(status.state as MicPermissionStatus);
          status.onchange = () => {
            if (!isMountedRef.current) return;
            setMicPermission(status.state as MicPermissionStatus);
            if (status.state === 'granted') {
              setVoiceError(null);
            }
          };
        })
        .catch(() => {
          // Browsers like Firefox/Safari may reject microphone permission queries; getUserMedia handles prompting.
        });
    }

    return () => {
      isMountedRef.current = false;
      if (permissionStatusObj) {
        permissionStatusObj.onchange = null;
      }
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      const recorder = mediaRecorderRef.current;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.onerror = null;
        if (recorder.state !== 'inactive') {
          try {
            recorder.stop();
          } catch {
            // Ignore cleanup stop error
          }
        }
        mediaRecorderRef.current = null;
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    };
  }, []);

  const divisionObj =
    BANGLADESH_LOCATIONS.find((d) => d.division === division) ?? BANGLADESH_LOCATIONS[0];

  function handleDivisionChange(nextDiv: string) {
    setDivision(nextDiv);
    const entry = BANGLADESH_LOCATIONS.find((d) => d.division === nextDiv);
    if (entry && entry.areas.length > 0) {
      setArea(entry.areas[0]);
    }
  }

  function toggleProblem(problem: string) {
    setPhysicalProblems((prev) =>
      prev.includes(problem) ? prev.filter((p) => p !== problem) : [...prev, problem]
    );
  }

  function addCustomProblem() {
    const cleaned = customProblemDraft.trim();
    if (!cleaned) return;
    if (!physicalProblems.includes(cleaned)) {
      setPhysicalProblems((prev) => [...prev, cleaned]);
    }
    setCustomProblemDraft('');
  }

  function addDrug() {
    const cleaned = drugDraft.trim();
    if (!cleaned) return;
    if (!drugHistory.includes(cleaned)) {
      setDrugHistory((prev) => [...prev, cleaned]);
    }
    setDrugDraft('');
  }

  function toggleSymptom(symptom: string) {
    setSelectedSymptoms((prev) =>
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom]
    );
  }

  function validateAndBuildInput(): TriageInput | null {
    setErrorMsg(null);
    const parsedAge = Number(age);
    if (!patientName.trim()) {
      setErrorMsg('Please enter the patient’s name before running symptom triage.');
      return null;
    }
    if (!age.trim() || !Number.isFinite(parsedAge) || parsedAge < 0 || parsedAge > 120) {
      setErrorMsg('Please enter a valid patient age between 0 and 120.');
      return null;
    }
    if (!chiefComplaint.trim() && selectedSymptoms.length === 0) {
      setErrorMsg(
        'Please describe what seems to be the problem in the description box or select your symptoms.'
      );
      return null;
    }
    return {
      patientName: patientName.trim(),
      age: Math.round(parsedAge),
      gender,
      division,
      area,
      physicalProblems,
      drugHistory,
      chiefComplaint: chiefComplaint.trim(),
      selectedSymptoms,
      duration,
      severity,
    };
  }

  async function handleSubmitAi(e: FormEvent) {
    e.preventDefault();
    setAiUnavailable(false);
    const input = validateAndBuildInput();
    if (!input) return;

    setLoadingAi(true);
    try {
      const response = await submitAiTriage(input);
      onTriageComplete(input, response);
    } catch (err) {
      const apiErr = err as Error & { code?: string };
      setErrorMsg(apiErr.message || 'Could not reach AI clinical triage service.');
      if (apiErr.code === 'GEMINI_UNAVAILABLE' || apiErr.code === 'GEMINI_ERROR') {
        setAiUnavailable(true);
      }
    } finally {
      setLoadingAi(false);
    }
  }

  async function handleLocalMatch() {
    setAiUnavailable(false);
    const input = validateAndBuildInput();
    if (!input) return;

    setLoadingLocal(true);
    try {
      const response = await submitLocalTriage(input);
      onTriageComplete(input, response);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to evaluate symptoms.');
    } finally {
      setLoadingLocal(false);
    }
  }

  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : '';
        const commaIdx = dataUrl.indexOf(',');
        resolve(commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl);
      };
      reader.onerror = () => reject(new Error('Unable to read recorded audio.'));
      reader.readAsDataURL(blob);
    });
  }

  function stopStreamAndTimer() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaStreamRef.current?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    mediaStreamRef.current = null;
  }

  async function handleStartRecording() {
    if (isRequestingMic || isRecording || transcribing) {
      return;
    }

    setVoiceError(null);
    setVoiceStatus(null);

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setMicPermission('unsupported');
      setVoiceError(
        'Microphone recording requires a secure (HTTPS) connection. Please type your symptoms below.'
      );
      return;
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setMicPermission('unsupported');
      setVoiceError(
        'Microphone recording is not supported in this browser. Please type your symptoms below.'
      );
      return;
    }

    setIsRequestingMic(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      setMicPermission('granted');
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const chosenMime =
        typeof MediaRecorder.isTypeSupported === 'function'
          ? pickSupportedAudioMimeType((mime) => MediaRecorder.isTypeSupported(mime))
          : undefined;

      let recorder: MediaRecorder;
      try {
        recorder = chosenMime
          ? new MediaRecorder(stream, { mimeType: chosenMime })
          : new MediaRecorder(stream);
      } catch {
        recorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = recorder;

      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            try {
              mediaRecorderRef.current.stop();
            } catch {
              stopStreamAndTimer();
              if (isMountedRef.current) {
                setIsRecording(false);
                setVoiceError('Microphone disconnected during recording. Please try again.');
              }
            }
          }
        };
      });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        stopStreamAndTimer();
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
        if (isMountedRef.current) {
          setIsRecording(false);
          setVoiceError(
            'Microphone recording stopped unexpectedly. Please try again or type your symptoms below.'
          );
        }
      };

      recorder.onstop = async () => {
        stopStreamAndTimer();
        mediaRecorderRef.current = null;
        if (!isMountedRef.current) {
          audioChunksRef.current = [];
          return;
        }

        setIsRecording(false);
        const mimeType = normalizeAudioMimeType(recorder.mimeType || chosenMime);
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        audioChunksRef.current = [];

        const sizeError = validateAudioBlobSize(audioBlob.size);
        if (sizeError) {
          setVoiceError(sizeError);
          return;
        }

        setTranscribing(true);
        try {
          const base64 = await blobToBase64(audioBlob);
          if (!isMountedRef.current) return;
          const { transcript } = await transcribeAudio(base64, mimeType);
          if (!isMountedRef.current) return;
          setChiefComplaint((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
          setVoiceStatus('Voice symptoms transcribed into your description below.');
        } catch (err) {
          if (!isMountedRef.current) return;
          setVoiceError(
            err instanceof Error
              ? err.message
              : 'Unable to transcribe audio recording. Please try again or type your symptoms.'
          );
        } finally {
          if (isMountedRef.current) {
            setTranscribing(false);
          }
        }
      };

      recorder.start(250);
      setRecordingSeconds(0);
      setIsRecording(true);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 89) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              try {
                mediaRecorderRef.current.stop();
              } catch {
                stopStreamAndTimer();
                if (isMountedRef.current) {
                  setIsRecording(false);
                }
              }
            }
            return 90;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      stopStreamAndTimer();
      mediaRecorderRef.current = null;
      if (isMountedRef.current) {
        setIsRecording(false);
        const info = classifyMicrophoneError(err);
        if (info.permissionStatus) {
          setMicPermission(info.permissionStatus);
        }
        setVoiceError(info.message);
      }
    } finally {
      if (isMountedRef.current) {
        setIsRequestingMic(false);
      }
    }
  }

  function handleStopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      try {
        recorder.stop();
      } catch {
        stopStreamAndTimer();
        mediaRecorderRef.current = null;
        setIsRecording(false);
        setVoiceError('Could not finalize recording cleanly. Please try again.');
      }
    }
  }

  const confirmedAppointments = appointments.filter((a) => a.status === 'Confirmed');

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-24 md:pb-12 space-y-8">
      {/* Welcome Summary Row */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-xs font-medium text-[#0B6E5B]">
            Patient Triage &amp; Specialist Guidance
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 mt-1 [text-wrap:balance]">
            {user ? `Welcome, ${user.fullName}` : 'Check Symptoms & Find Your Specialist'}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 mt-2">
            {user ? (
              <>
                <span className="tabular-nums">{user.age} yrs</span>
                <span aria-hidden="true">·</span>
                <span>{user.gender}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {user.area}, {user.division}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {user.drugHistory.length > 0
                    ? `${user.drugHistory.length} recorded medication${user.drugHistory.length > 1 ? 's' : ''}`
                    : 'No recorded medications'}
                </span>
              </>
            ) : (
              <span>
                Enter patient details, physical history, medications, and chief complaint to get
                matched to the right department in Bangladesh.
              </span>
            )}
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenProfile}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
            >
              Edit Medical Profile
            </button>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Symptom & Clinical Intake Form (8 cols on desktop) */}
        <section className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="font-display text-xl font-bold text-slate-900">
              Patient Clinical Intake &amp; Chief Complaint
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Provide accurate details so we recommend the right specialist department and nearby
              doctors.
            </p>
          </div>

          <form onSubmit={handleSubmitAi} className="space-y-8">
            {/* Step 1: Patient & Area */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
                01. Patient Identity &amp; Preferred Location in Bangladesh
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-6">
                  <label
                    htmlFor="intake-name"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Patient Name
                  </label>
                  <input
                    id="intake-name"
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="Full name of the patient"
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label
                    htmlFor="intake-age"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Age (Years)
                  </label>
                  <input
                    id="intake-age"
                    type="number"
                    min={0}
                    max={120}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="e.g. 42"
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label
                    htmlFor="intake-gender"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Gender
                  </label>
                  <select
                    id="intake-gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value as Gender)}
                    className="w-full min-h-[44px] px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="intake-division"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    City / Division
                  </label>
                  <select
                    id="intake-division"
                    value={division}
                    onChange={(e) => handleDivisionChange(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
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
                    htmlFor="intake-area"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Local Area / Thana
                  </label>
                  <select
                    id="intake-area"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                  >
                    {divisionObj.areas.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Step 2: Existing Physical Problems & Drug History */}
            <div className="space-y-5">
              <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
                02. Physical Problems &amp; Drug History
              </h3>

              <div>
                <span className="block text-sm font-medium text-slate-700 mb-2">
                  Known Physical Conditions (Select all that apply)
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
                <div className="flex gap-2 mt-3">
                  <label htmlFor="custom-problem" className="sr-only">
                    Add another physical condition
                  </label>
                  <input
                    id="custom-problem"
                    type="text"
                    value={customProblemDraft}
                    onChange={(e) => setCustomProblemDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomProblem();
                      }
                    }}
                    placeholder="Add another condition (e.g. Fatty liver, Anemia)"
                    className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                  />
                  <button
                    type="button"
                    onClick={addCustomProblem}
                    className="min-h-[44px] px-4 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    <span>Add Condition</span>
                  </button>
                </div>
                {physicalProblems.some((p) => !COMMON_PHYSICAL_PROBLEMS.includes(p)) && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {physicalProblems
                      .filter((p) => !COMMON_PHYSICAL_PROBLEMS.includes(p))
                      .map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => toggleProblem(p)}
                          aria-label={`Remove condition ${p}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-xs font-medium text-teal-900 cursor-pointer"
                        >
                          <span>{p}</span>
                          <X className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="intake-drug"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Drug History &amp; Current Medications
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  List prescription medicines, painkillers (e.g. Naproxen), gastric tablets, or
                  inhalers you are taking or recently took.
                </p>
                <div className="flex gap-2">
                  <input
                    id="intake-drug"
                    type="text"
                    value={drugDraft}
                    onChange={(e) => setDrugDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addDrug();
                      }
                    }}
                    placeholder="e.g. Metformin 500mg, Amlodipine 5mg, Napa Extend"
                    className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                  />
                  <button
                    type="button"
                    onClick={addDrug}
                    className="min-h-[44px] px-4 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    <span>Add Medicine</span>
                  </button>
                </div>
                {drugHistory.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {drugHistory.map((drug) => (
                      <button
                        key={drug}
                        type="button"
                        onClick={() =>
                          setDrugHistory((prev) => prev.filter((d) => d !== drug))
                        }
                        aria-label={`Remove medicine ${drug}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-medium text-slate-800 hover:bg-slate-200 cursor-pointer"
                      >
                        <span>{drug}</span>
                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Step 3: Chief Complaint */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
                03. Chief Complaint — What seems to be the problem?
              </h3>

              <div>
                <span className="block text-sm font-medium text-slate-700 mb-2">
                  Common Symptoms (Tap to include)
                </span>
                <div className="flex flex-wrap gap-2">
                  {COMMON_SYMPTOM_CHIPS.map((sym) => {
                    const active = selectedSymptoms.includes(sym);
                    return (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => toggleSymptom(sym)}
                        aria-pressed={active}
                        className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {sym}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label
                    htmlFor="chief-complaint"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Describe Your Symptoms in Your Own Words (English, বাংলা, or Banglish)
                  </label>

                  {isRecording ? (
                    <button
                      type="button"
                      onClick={handleStopRecording}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-semibold inline-flex items-center gap-2 tabular-nums transition-colors cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                      <span>
                        Stop &amp; Transcribe ({String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:
                        {String(recordingSeconds % 60).padStart(2, '0')})
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={transcribing || isRequestingMic}
                      onClick={handleStartRecording}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 disabled:opacity-60 text-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Mic className="w-3.5 h-3.5 text-[#0B6E5B]" aria-hidden="true" />
                      <span>
                        {isRequestingMic
                          ? 'Allow Microphone...'
                          : transcribing
                            ? 'Transcribing Audio...'
                            : micPermission === 'denied'
                              ? 'Retry Microphone'
                              : 'Speak Symptoms'}
                      </span>
                    </button>
                  )}
                </div>

                {isRecording && (
                  <p aria-live="polite" className="text-xs font-medium text-red-700 mb-2">
                    Listening via microphone — describe your symptoms in English, বাংলা, or Banglish,
                    then press Stop &amp; Transcribe.
                  </p>
                )}

                {micPermission === 'denied' && !voiceError && (
                  <p className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                    Microphone access is currently blocked in your browser. Allow microphone
                    permission for this site to use voice input, or type your symptoms directly
                    below.
                  </p>
                )}

                {voiceStatus && !voiceError && (
                  <p aria-live="polite" className="text-xs font-medium text-[#0B6E5B] mb-2">
                    {voiceStatus}
                  </p>
                )}

                {voiceError && (
                  <div
                    role="alert"
                    className="flex items-start justify-between gap-3 text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2"
                  >
                    <span>{voiceError}</span>
                    <button
                      type="button"
                      onClick={() => setVoiceError(null)}
                      aria-label="Dismiss voice error"
                      className="text-red-700 hover:text-red-900 shrink-0 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                )}

                <textarea
                  id="chief-complaint"
                  rows={4}
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder="Example: I have had fever with chills and general weakness for 3 days, or 'Amar 2 din dhore buker bame betha ar shashkoshto hocche', or 'হাতে ও পায়ে প্রচণ্ড চুলকানি এবং লাল দাগ হয়েছে'..."
                  className="w-full px-3.5 py-3 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="intake-duration"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    How Long Have You Had This?
                  </label>
                  <select
                    id="intake-duration"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B6E5B]/30 focus:border-[#0B6E5B]"
                  >
                    <option value="Started today">Started today</option>
                    <option value="2–3 days">2–3 days</option>
                    <option value="About 1 week">About 1 week</option>
                    <option value="2–4 weeks">2–4 weeks</option>
                    <option value="Over 1 month (Chronic)">Over 1 month (Chronic)</option>
                  </select>
                </div>

                <div>
                  <span className="block text-sm font-medium text-slate-700 mb-1.5">
                    Symptom Severity
                  </span>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
                    {(['Mild', 'Moderate', 'Severe'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setSeverity(lvl)}
                        aria-pressed={severity === lvl}
                        className={`min-h-[38px] text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                          severity === lvl
                            ? lvl === 'Severe'
                              ? 'bg-red-700 text-white'
                              : 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-900 space-y-3"
              >
                <p>{errorMsg}</p>
                {aiUnavailable && (
                  <button
                    type="button"
                    disabled={loadingLocal}
                    onClick={handleLocalMatch}
                    className="min-h-[40px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {loadingLocal
                      ? 'Matching Locally...'
                      : 'Match Using Local Clinical Rules Instead'}
                  </button>
                )}
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="submit"
                disabled={loadingAi || loadingLocal}
                className="flex-1 min-h-[48px] px-6 py-3 rounded-xl bg-[#0B6E5B] hover:bg-[#085647] disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>
                  {loadingAi
                    ? 'Analyzing Symptoms & Medications...'
                    : 'Find Recommended Specialist'}
                </span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                disabled={loadingAi || loadingLocal}
                onClick={handleLocalMatch}
                className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-700 text-sm font-semibold transition-colors cursor-pointer"
              >
                {loadingLocal ? 'Matching...' : 'Quick Local Match'}
              </button>
            </div>
          </form>
        </section>

        {/* Right Side Column: Upcoming Visits & Past Triage Assessments (4 cols) */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Upcoming Chamber Visits
              </h2>
              {confirmedAppointments.length > 0 && (
                <button
                  type="button"
                  onClick={onOpenAppointments}
                  className="text-xs font-semibold text-[#0B6E5B] hover:underline cursor-pointer"
                >
                  View All
                </button>
              )}
            </div>

            {confirmedAppointments.length === 0 ? (
              <p className="text-sm text-slate-500 leading-relaxed">
                {user
                  ? 'No upcoming chamber appointments booked yet. Complete a symptom check to find nearby specialists.'
                  : 'Sign in or register to save chamber bookings and view your upcoming visits.'}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {confirmedAppointments.slice(0, 3).map((apt) => (
                  <li key={apt.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                    <p className="text-sm font-semibold text-slate-900">{apt.doctorName}</p>
                    <p className="text-xs text-slate-600">
                      {apt.departmentName} · {apt.hospital}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-slate-500 tabular-nums pt-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{apt.date}</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{apt.timeSlot}</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="font-display text-lg font-bold text-slate-900 mb-4">
              Recent Symptom Checks
            </h2>

            {triageHistory.length === 0 ? (
              <p className="text-sm text-slate-500 leading-relaxed">
                Your specialist recommendations will appear here once you evaluate symptoms.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {triageHistory.slice(0, 4).map((item) => (
                  <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                    <button
                      type="button"
                      onClick={() => onOpenHistoryItem(item)}
                      className="w-full text-left group cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900 group-hover:text-[#0B6E5B] transition-colors">
                          {item.result.specialistTitle}
                        </span>
                        <span className="text-xs text-slate-500 tabular-nums">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2 mt-1">
                        {item.input.chiefComplaint || item.input.selectedSymptoms.join(', ')}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {item.result.departmentName} · {item.input.area}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
