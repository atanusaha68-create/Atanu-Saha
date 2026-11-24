import { AREA_COORDINATES, DEPARTMENTS, getDepartmentById } from '../shared/bangladeshData';
import type {
  Coordinates,
  DepartmentId,
  Doctor,
  TriageInput,
  TriageResult,
  UrgencyLevel,
} from '../shared/types';

interface DepartmentRule {
  id: DepartmentId;
  keywords: string[];
  historyBoostKeywords: string[];
  drugBoostKeywords: string[];
}

const DEPARTMENT_RULES: DepartmentRule[] = [
  {
    id: 'cardiology',
    keywords: [
      'chest pain',
      'chest tightness',
      'chest pressure',
      'palpitation',
      'heart',
      'heartbeat',
      'racing heart',
      'left arm',
      'jaw pain',
      'buk betha',
      'buk-e betha',
      'buke betha',
      'buker betha',
      'buk dhorphor',
      'বুক ব্যথা',
      'বুকে ব্যথা',
      'বুক ধড়ফড়',
      'হার্ট',
      'উচ্চ রক্তচাপ',
      'high bp',
      'hypertension',
    ],
    historyBoostKeywords: ['heart disease', 'hypertension', 'high bp', 'cholesterol'],
    drugBoostKeywords: ['amlodipine', 'losartan', 'bisoprolol', 'atenolol', 'aspirin', 'clopidogrel', 'atorvastatin', 'nitroglycerin'],
  },
  {
    id: 'dermatology',
    keywords: [
      'skin',
      'rash',
      'itching',
      'itchy',
      'itch',
      'eczema',
      'fungal',
      'ringworm',
      'hives',
      'acne',
      'pimple',
      'allergy',
      'blister',
      'scaly',
      'hair fall',
      'hair loss',
      'nail',
      'chulkani',
      'dad',
      'ghao',
      'চুলকানি',
      'চর্ম',
      'র‍্যাশ',
      'দাউদ',
      'এলার্জি',
    ],
    historyBoostKeywords: ['skin allergy', 'eczema'],
    drugBoostKeywords: ['cetirizine', 'fexofenadine', 'betamethasone', 'clotrimazole', 'fluconazole'],
  },
  {
    id: 'gastroenterology',
    keywords: [
      'stomach',
      'abdomen',
      'abdominal',
      'acidity',
      'heartburn',
      'acid reflux',
      'gastric',
      'ulcer',
      'nausea',
      'vomiting',
      'diarrhea',
      'constipation',
      'bloating',
      'jaundice',
      'liver',
      'pet betha',
      'pet-e betha',
      'pete betha',
      'bomi',
      'gastic',
      'পেট ব্যথা',
      'পেটে ব্যথা',
      'গ্যাস্ট্রিক',
      'বমি',
      'বদহজম',
      'জন্ডিস',
    ],
    historyBoostKeywords: ['peptic ulcer', 'acidity', 'liver', 'gastritis'],
    drugBoostKeywords: ['naproxen', 'diclofenac', 'ketorolac', 'ibuprofen', 'aceclofenac', 'omeprazole', 'esomeprazole', 'pantoprazole'],
  },
  {
    id: 'neurology',
    keywords: [
      'headache',
      'migraine',
      'dizzy',
      'dizziness',
      'vertigo',
      'numbness',
      'tingling',
      'seizure',
      'convulsion',
      'tremor',
      'paralysis',
      'weakness on one side',
      'memory',
      'matha betha',
      'matha ghuray',
      'matha ghura',
      'jhim jhim',
      'মাথা ব্যথা',
      'মাথা ঘোরা',
      'ঝিমঝিম',
      'অবশ',
    ],
    historyBoostKeywords: ['migraine', 'stroke', 'epilepsy'],
    drugBoostKeywords: ['sumatriptan', 'amitriptyline', 'pregabalin', 'gabapentin', 'topiramate'],
  },
  {
    id: 'pulmonology',
    keywords: [
      'cough',
      'wheeze',
      'wheezing',
      'asthma',
      'shortness of breath',
      'breathing difficulty',
      'breathless',
      'phlegm',
      'sputum',
      'chest congestion',
      'kashi',
      'shashkoshto',
      'hapani',
      'কাশি',
      'শ্বাসকষ্ট',
      'হাঁপানি',
    ],
    historyBoostKeywords: ['asthma', 'breathing allergy', 'copd'],
    drugBoostKeywords: ['salbutamol', 'montelukast', 'inhaler', 'budesonide', 'theophylline'],
  },
  {
    id: 'endocrinology',
    keywords: [
      'diabetes',
      'blood sugar',
      'glucose',
      'thyroid',
      'goiter',
      'thirst',
      'frequent urination',
      'hormone',
      'pcos',
      'weight gain',
      'weight loss',
      'sugar',
      'ডায়াবেটিস',
      'থাইরয়েড',
      'সুগার',
    ],
    historyBoostKeywords: ['diabetes', 'thyroid'],
    drugBoostKeywords: ['metformin', 'insulin', 'glimepiride', 'sitagliptin', 'levothyroxine', 'thyrox'],
  },
  {
    id: 'orthopedics',
    keywords: [
      'joint',
      'knee',
      'back pain',
      'lower back',
      'neck pain',
      'shoulder',
      'bone',
      'fracture',
      'sprain',
      'arthritis',
      'spine',
      'swollen joint',
      'komor betha',
      'hatu betha',
      'har betha',
      'কোমর ব্যথা',
      'হাঁটু ব্যথা',
      'হাড়',
    ],
    historyBoostKeywords: ['arthritis', 'joint pain'],
    drugBoostKeywords: ['calcium', 'etoricoxib', 'diclofenac'],
  },
  {
    id: 'ent',
    keywords: [
      'ear',
      'earache',
      'hearing',
      'sore throat',
      'tonsil',
      'sinus',
      'nasal',
      'blocked nose',
      'nosebleed',
      'hoarse',
      'swallowing',
      'kan betha',
      'gola betha',
      'কান ব্যথা',
      'গলা ব্যথা',
      'সাইনাস',
    ],
    historyBoostKeywords: ['sinusitis', 'tonsillitis'],
    drugBoostKeywords: ['nasal spray', 'fluticasone'],
  },
  {
    id: 'ophthalmology',
    keywords: [
      'eye',
      'vision',
      'blurry',
      'blurred',
      'red eye',
      'watering eye',
      'cataract',
      'chokh',
      'চোখ',
      'ঝাপসা',
    ],
    historyBoostKeywords: ['glaucoma', 'cataract'],
    drugBoostKeywords: ['eye drop'],
  },
  {
    id: 'gynecology',
    keywords: [
      'period',
      'menstrual',
      'menstruation',
      'pregnancy',
      'pregnant',
      'pelvic',
      'vaginal',
      'irregular cycle',
      'mashik',
      'মাসিক',
      'গর্ভ',
    ],
    historyBoostKeywords: ['pcos', 'pregnancy'],
    drugBoostKeywords: ['folic acid', 'progesterone'],
  },
  {
    id: 'pediatrics',
    keywords: ['infant', 'toddler', 'baby', 'child', 'shishu', 'বাচ্চা', 'শিশু'],
    historyBoostKeywords: [],
    drugBoostKeywords: [],
  },
  {
    id: 'medicine',
    keywords: [
      'fever',
      'chills',
      'weakness',
      'fatigue',
      'body ache',
      'dengue',
      'typhoid',
      'tired',
      'malaise',
      'jor',
      'durbolota',
      'শরীর দুর্বল',
      'জ্বর',
      'দুর্বলতা',
    ],
    historyBoostKeywords: ['kidney disease'],
    drugBoostKeywords: ['paracetamol', 'napa', 'azithromycin', 'cefixime'],
  },
];

const RED_FLAG_PATTERNS: { pattern: RegExp; reason: string; departmentId?: DepartmentId }[] = [
  {
    pattern: /(chest pain|chest tightness|buk.*betha|বুক.*ব্যথা).*(arm|jaw|sweat|breath|dizzy|radiat)/i,
    reason: 'Chest discomfort accompanied by radiation, sweating, or breathlessness requires immediate cardiac emergency evaluation.',
    departmentId: 'cardiology',
  },
  {
    pattern: /(severe shortness of breath|can'?t breathe|gasping|শ্বাস নিতে পারছি না)/i,
    reason: 'Severe difficulty breathing needs urgent hospital emergency assessment (Call 999 or visit the nearest emergency department).',
    departmentId: 'pulmonology',
  },
  {
    pattern: /(one side weakness|slurred speech|facial droop|unconscious|sudden vision loss|অজ্ঞান)/i,
    reason: 'Sudden neurological deficits such as one-sided weakness, speech trouble, or sudden vision loss require emergency stroke care.',
    departmentId: 'neurology',
  },
  {
    pattern: /(vomiting blood|black stool|blood in stool|রক্ত বমি)/i,
    reason: 'Signs of gastrointestinal bleeding require urgent emergency hospital care.',
    departmentId: 'gastroenterology',
  },
];

const NEGATED_CLAUSE_PATTERN =
  /(?:^|\s)(?:no|not|without|denies|never|neither|nor|কোনো|কোন|নেই|নাই|না|নয়|হয়নি|হচ্ছে\s*না|করছে\s*না|kono|nei|nai|hocche\s*na|hoche\s*na|korche\s*na)(?=$|\s)/i;

const NEGATED_SUFFIX_PATTERN =
  /(?:নেই|নাই|হয়নি|হচ্ছে\s*না|করছে\s*না|nei|nai|hocche\s*na|hoche\s*na|korche\s*না)\s*$/i;

export function extractPositiveSymptomText(text: string): string {
  if (!text.trim()) return '';
  // Split by sentence/clause punctuation and Bengali/English conjunctions so negated parts like
  // "কিন্তু কোনো শ্বাসকষ্ট নেই এবং কোনো শুকনো কাশি নেই" are isolated cleanly.
  const clauses = text
    .split(/(?:[,;।.\n?!]+|\b(?:but|however|although|though|except|and|or|without)\b|(?:কিন্তু|তবে|এবং|আর|অথবা|ছাড়া))/i)
    .map((c) => c.trim())
    .filter(Boolean);

  const positiveClauses: string[] = [];
  for (const clause of clauses) {
    const lower = clause.toLowerCase();
    const isNegatedBengaliOrBanglish =
      /(?:কোনো|কোন|kono)\s+.+/i.test(lower) && NEGATED_SUFFIX_PATTERN.test(lower);
    const endsWithNegation = NEGATED_SUFFIX_PATTERN.test(lower);
    const startsWithEnglishNegation =
      /^(?:no|not|without|denies|never|neither|none)\b/i.test(lower) ||
      /\b(?:no|not having|without|denies|free of|absent)\s+[a-z]/i.test(lower);

    if (isNegatedBengaliOrBanglish || endsWithNegation || startsWithEnglishNegation) {
      continue;
    }
    if (NEGATED_CLAUSE_PATTERN.test(lower) && /(?:নেই|নাই|no\s+)/i.test(lower)) {
      continue;
    }
    positiveClauses.push(clause);
  }

  return positiveClauses.join(' ').toLowerCase();
}

export function evaluateSymptomsLocally(input: TriageInput): TriageResult {
  const positiveChiefText = extractPositiveSymptomText(input.chiefComplaint);
  const selectedText = input.selectedSymptoms.join(' ').toLowerCase();
  const combinedComplaint = `${positiveChiefText} ${selectedText}`.trim();
  const historyText = input.physicalProblems.join(' ').toLowerCase();
  const drugText = input.drugHistory.join(' ').toLowerCase();

  const scores = new Map<DepartmentId, { score: number; signals: string[] }>();
  for (const dept of DEPARTMENTS) {
    scores.set(dept.id, { score: 0, signals: [] });
  }

  // Evaluate active symptom keywords (strongly weighted over passive background conditions)
  for (const rule of DEPARTMENT_RULES) {
    const entry = scores.get(rule.id)!;
    let hasActiveSymptomMatch = false;
    for (const kw of rule.keywords) {
      if (combinedComplaint.includes(kw)) {
        entry.score += kw.includes(' ') ? 8 : 6;
        hasActiveSymptomMatch = true;
        if (!entry.signals.includes(kw)) {
          entry.signals.push(kw);
        }
      }
    }
    for (const hkw of rule.historyBoostKeywords) {
      if (historyText.includes(hkw)) {
        entry.score += hasActiveSymptomMatch ? 2 : 1;
        if (!entry.signals.includes(`History: ${hkw}`)) {
          entry.signals.push(`History: ${hkw}`);
        }
      }
    }
    for (const dkw of rule.drugBoostKeywords) {
      if (drugText.includes(dkw)) {
        entry.score += hasActiveSymptomMatch ? 2 : 1;
        if (!entry.signals.includes(`Medication: ${dkw}`)) {
          entry.signals.push(`Medication: ${dkw}`);
        }
      }
    }
  }

  // Fever + chest pain (without cardiac radiation/history) often points to respiratory infection / pleuritis
  // or systemic illness -> elevate Pulmonology and Internal Medicine
  const hasFever = /(fever|chills|jor|জ্বর)/i.test(combinedComplaint);
  const hasChestPain = /(chest pain|chest tightness|buk.*betha|বুক.*ব্যথা|বুকে ব্যথা)/i.test(
    combinedComplaint
  );
  const hasCardiacHistory =
    /(heart disease|hypertension|high bp|cholesterol)/i.test(historyText) ||
    /(amlodipine|losartan|bisoprolol|atenolol|clopidogrel|nitroglycerin)/i.test(drugText);

  if (hasFever && hasChestPain) {
    const pulm = scores.get('pulmonology')!;
    const med = scores.get('medicine')!;
    pulm.score += 5;
    med.score += 4;
    pulm.signals.push('Fever + chest discomfort (respiratory/pleural evaluation)');
    med.signals.push('Fever + chest discomfort');
    if (!hasCardiacHistory && input.age < 50) {
      // Keep cardiology secondary unless cardiac risk factors exist
      const card = scores.get('cardiology')!;
      card.score = Math.min(card.score, pulm.score - 1);
    }
  }

  // Special clinical interaction rules
  let medicationNote =
    input.drugHistory.length > 0
      ? `Current medications (${input.drugHistory.join(', ')}) have been noted for your specialist to review for dosage adjustments or interactions.`
      : 'No current medications reported. Remember to mention any over-the-counter or herbal remedies during your consultation.';

  const hasNsaid = /(naproxen|diclofenac|ketorolac|ibuprofen|aceclofenac|aspirin|painkiller)/i.test(
    drugText
  );
  const hasStomachComplaint = /(stomach|acidity|gastric|ulcer|abdom|pet|পেট|গ্যাস্ট্রিক)/i.test(
    combinedComplaint
  );
  if (hasNsaid && hasStomachComplaint) {
    const gastro = scores.get('gastroenterology')!;
    gastro.score += 6;
    gastro.signals.push('NSAID + upper GI symptom correlation');
    medicationNote =
      'Important medication note: Painkillers/NSAIDs in your drug history can irritate the stomach lining and worsen ulcer or acidity symptoms. Discuss safer alternatives with a Gastroenterologist.';
  }

  const hasAceInhibitor = /(ramipril|enalapril|lisinopril)/i.test(drugText);
  if (hasAceInhibitor && /(cough|kashi|কাশি)/i.test(combinedComplaint)) {
    medicationNote =
      'Important medication note: ACE-inhibitor blood pressure medicines (such as Ramipril or Enalapril) can sometimes cause a persistent dry cough. Do not stop your BP medicine without a doctor’s guidance.';
  }

  const hasDiabetesDrug = /(metformin|insulin|glimepiride|sitagliptin)/i.test(drugText);
  if (hasDiabetesDrug && /(dizzy|dizziness|sweat|weakness|tingling|numbness)/i.test(combinedComplaint)) {
    const endo = scores.get('endocrinology')!;
    endo.score += 4;
    if (/(tingling|numbness)/i.test(combinedComplaint)) {
      scores.get('neurology')!.score += 3;
    }
    medicationNote =
      'Important medication note: With diabetes medications in your history, check your blood glucose promptly when feeling dizzy, sweaty, or weak to rule out low blood sugar (hypoglycemia).';
  }

  // Pediatric routing for children <= 14: general fever/weakness/respiratory issues go to Pediatrics instead of adult Medicine
  if (input.age > 0 && input.age <= 14) {
    const ped = scores.get('pediatrics')!;
    const med = scores.get('medicine')!;
    ped.score += 10 + med.score;
    ped.signals.push(`Patient age (${input.age} yrs)`);
    med.score = 0;
  }

  // Check red flags (against positive symptoms only)
  let urgency: UrgencyLevel = input.severity === 'Severe' ? 'priority' : 'routine';
  let urgencyReason =
    input.severity === 'Severe'
      ? 'Marked as severe discomfort; arrange a prompt specialist chamber visit within 24 hours.'
      : 'Suitable for a scheduled chamber consultation with the recommended specialist.';

  for (const flag of RED_FLAG_PATTERNS) {
    if (flag.pattern.test(combinedComplaint)) {
      urgency = 'urgent';
      urgencyReason = flag.reason;
      if (flag.departmentId) {
        const target = scores.get(flag.departmentId)!;
        target.score += 8;
        target.signals.push('Urgent clinical red flag');
      }
      break;
    }
  }

  if (
    urgency !== 'urgent' &&
    input.severity === 'Severe' &&
    /(chest|breath|breathing|unconscious|faint|শ্বাসকষ্ট|বুক.*ব্যথা|অজ্ঞান)/i.test(combinedComplaint)
  ) {
    urgency = 'urgent';
    urgencyReason =
      'Severe cardiopulmonary or fainting symptoms warrant immediate evaluation at an emergency department or cardiac hospital.';
  }

  // Sort departments by score
  const ranked = Array.from(scores.entries())
    .sort((a, b) => b[1].score - a[1].score);

  let primaryId: DepartmentId = ranked[0][1].score > 0 ? ranked[0][0] : 'medicine';
  let secondaryId: DepartmentId | undefined =
    ranked[1] && ranked[1][1].score >= 3 && ranked[1][0] !== primaryId
      ? ranked[1][0]
      : undefined;

  // If fever + general weakness with no stronger organ system, Internal Medicine (or Pediatrics if child)
  if (ranked[0][1].score === 0) {
    primaryId = input.age > 0 && input.age <= 14 ? 'pediatrics' : 'medicine';
  }

  const primaryDept = getDepartmentById(primaryId);
  const secondaryDept = secondaryId ? getDepartmentById(secondaryId) : undefined;
  const matchedSignals = scores.get(primaryId)?.signals ?? [];

  const summaryParts = [
    `Based on ${input.patientName || 'the patient'}'s age (${input.age} yrs)`,
    input.physicalProblems.length > 0
      ? `medical history (${input.physicalProblems.join(', ')})`
      : 'symptom profile',
    `and chief complaint, you should visit a ${primaryDept.specialistTitle} (${primaryDept.name} · ${primaryDept.bengaliName}).`,
  ];

  if (secondaryDept) {
    summaryParts.push(
      `If symptoms overlap or initial tests point elsewhere, a ${secondaryDept.specialistTitle} (${secondaryDept.name}) is a helpful secondary consultation.`
    );
  }

  return {
    source: 'local',
    primaryDepartmentId: primaryDept.id,
    specialistTitle: primaryDept.specialistTitle,
    departmentName: primaryDept.name,
    bengaliName: primaryDept.bengaliName,
    secondaryDepartmentId: secondaryDept?.id,
    secondarySpecialistTitle: secondaryDept?.specialistTitle,
    urgency,
    urgencyReason,
    clinicalSummary: summaryParts.join(' '),
    medicationConsiderations: medicationNote,
    questionsForDoctor: [
      `Could my symptoms be related to my existing conditions or current medications?`,
      `Which diagnostic tests (blood work, imaging, or screening) should I complete before follow-up?`,
      `What warning signs mean I should seek urgent hospital care immediately?`,
    ],
    prepChecklist: primaryDept.prepChecklist,
    matchedSignals,
  };
}

export function haversineDistanceKm(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return Math.round(2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 10) / 10;
}

export interface DoctorFilterOptions {
  departmentId?: string;
  division?: string;
  area?: string;
  search?: string;
  maxFee?: number;
  userCoords?: Coordinates | null;
}

export interface RankedDoctor extends Doctor {
  distanceKm?: number;
}

export function rankDoctorsForTriage(
  doctors: Doctor[],
  options: DoctorFilterOptions
): RankedDoctor[] {
  const searchLower = options.search?.trim().toLowerCase() ?? '';
  const referenceCoords =
    options.userCoords ??
    (options.area && options.area !== 'all' ? AREA_COORDINATES[options.area] : undefined);

  const filtered = doctors.filter((doc) => {
    if (options.departmentId && options.departmentId !== 'all' && doc.departmentId !== options.departmentId) {
      return false;
    }
    if (options.division && options.division !== 'all' && doc.division !== options.division) {
      return false;
    }
    if (options.maxFee && options.maxFee > 0 && doc.feeBdt > options.maxFee) {
      return false;
    }
    if (searchLower) {
      const hay = `${doc.name} ${doc.hospital} ${doc.area} ${doc.division} ${doc.specialistTitle} ${doc.focusAreas.join(' ')}`.toLowerCase();
      if (!hay.includes(searchLower)) {
        return false;
      }
    }
    return true;
  });

  const withDistance: RankedDoctor[] = filtered.map((doc) => ({
    ...doc,
    distanceKm: referenceCoords ? haversineDistanceKm(referenceCoords, doc.coordinates) : undefined,
  }));

  // Sort by live/area distance if available, else exact area match, availability today, experience
  return withDistance.sort((a, b) => {
    if (options.userCoords && a.distanceKm !== undefined && b.distanceKm !== undefined) {
      if (a.distanceKm !== b.distanceKm) {
        return a.distanceKm - b.distanceKm;
      }
    }
    const aAreaMatch = options.area && options.area !== 'all' && a.area === options.area ? 1 : 0;
    const bAreaMatch = options.area && options.area !== 'all' && b.area === options.area ? 1 : 0;
    if (aAreaMatch !== bAreaMatch) {
      return bAreaMatch - aAreaMatch;
    }
    if (a.distanceKm !== undefined && b.distanceKm !== undefined && a.distanceKm !== b.distanceKm) {
      return a.distanceKm - b.distanceKm;
    }
    if (a.availableToday !== b.availableToday) {
      return a.availableToday ? -1 : 1;
    }
    return b.experienceYears - a.experienceYears;
  });
}
