import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateSymptomsLocally,
  haversineDistanceKm,
  rankDoctorsForTriage,
} from './triage';
import { AREA_COORDINATES, DOCTORS } from '../shared/bangladeshData';
import type { TriageInput } from '../shared/types';

function makeInput(overrides: Partial<TriageInput>): TriageInput {
  return {
    patientName: 'Rafiqul Ahmed',
    age: 42,
    gender: 'Male',
    division: 'Dhaka',
    area: 'Dhanmondi',
    physicalProblems: [],
    drugHistory: [],
    chiefComplaint: '',
    selectedSymptoms: [],
    duration: '3 days',
    severity: 'Moderate',
    ...overrides,
  };
}

test('routes chest pain radiating to left arm to Cardiology with urgent flag', () => {
  const result = evaluateSymptomsLocally(
    makeInput({
      chiefComplaint: 'Severe chest pain radiating to left arm and shortness of breath',
      physicalProblems: ['Hypertension (High BP)'],
      severity: 'Severe',
    })
  );

  assert.equal(result.primaryDepartmentId, 'cardiology');
  assert.equal(result.specialistTitle, 'Cardiologist');
  assert.equal(result.urgency, 'urgent');
});

test('correlates NSAID drug history with stomach burning to Gastroenterology', () => {
  const result = evaluateSymptomsLocally(
    makeInput({
      chiefComplaint: 'Upper stomach burning pain and nausea after meals',
      drugHistory: ['Naproxen 500mg', 'Ketorolac'],
    })
  );

  assert.equal(result.primaryDepartmentId, 'gastroenterology');
  assert.match(result.medicationConsiderations, /NSAID|painkiller/i);
});

test('routes Banglish and Bengali skin complaints to Dermatology', () => {
  const result = evaluateSymptomsLocally(
    makeInput({
      chiefComplaint: 'Sharadin hate paye chulkani ebong lal rash hocche',
      selectedSymptoms: ['Skin rash, itching, or spots'],
    })
  );

  assert.equal(result.primaryDepartmentId, 'dermatology');
  assert.equal(result.specialistTitle, 'Dermatologist');
});

test('routes child under 14 with fever and weakness to Pediatrics', () => {
  const result = evaluateSymptomsLocally(
    makeInput({
      patientName: 'Ayan Karim',
      age: 8,
      chiefComplaint: 'High fever since yesterday with general weakness and low appetite',
      selectedSymptoms: ['Fever & chills', 'General weakness & fatigue'],
    })
  );

  assert.equal(result.primaryDepartmentId, 'pediatrics');
  assert.equal(result.specialistTitle, 'Pediatrician');
});

test('prioritizes exact neighborhood match when ranking local doctors', () => {
  const ranked = rankDoctorsForTriage(DOCTORS, {
    departmentId: 'cardiology',
    division: 'Dhaka',
    area: 'Dhanmondi',
  });

  assert.ok(ranked.length >= 2);
  assert.equal(ranked[0].area, 'Dhanmondi');
  assert.equal(ranked[0].departmentId, 'cardiology');
});

test('sorts specialists by shortest Haversine distance when user coordinates are provided', () => {
  const gulshanCoords = AREA_COORDINATES.Gulshan;
  const distToDhanmondi = haversineDistanceKm(gulshanCoords, AREA_COORDINATES.Dhanmondi);
  assert.ok(distToDhanmondi > 3 && distToDhanmondi < 10);

  const ranked = rankDoctorsForTriage(DOCTORS, {
    departmentId: 'cardiology',
    userCoords: gulshanCoords,
  });

  assert.equal(ranked[0].area, 'Gulshan');
  assert.ok(typeof ranked[0].distanceKm === 'number');
  assert.ok((ranked[0].distanceKm ?? 99) < (ranked[1].distanceKm ?? 0));
});

test('ignores negated chest pain and dry cough in Bengali when recommending Pulmonologist for shortness of breath', () => {
  const result = evaluateSymptomsLocally(
    makeInput({
      physicalProblems: ['Hypertension (High BP)', 'Type 2 Diabetes'],
      drugHistory: ['Metformin 500mg (twice daily)', 'Amlodipine 5mg (morning)'],
      chiefComplaint: 'আমার শ্বাসকষ্ট আছে কিন্তু কোনো বুকে ব্যথা নেই এবং কোনো শুকনো কাশি নেই',
      duration: 'About 1 week',
    })
  );

  assert.equal(result.primaryDepartmentId, 'pulmonology');
  assert.equal(result.specialistTitle, 'Pulmonologist');
  assert.notEqual(result.primaryDepartmentId, 'dermatology');
});

test('routes fever with 7-day chest pain and negated shortness of breath to Pulmonology or Medicine', () => {
  const result = evaluateSymptomsLocally(
    makeInput({
      chiefComplaint: 'আমার জ্বর আছে, সাথে আমার সাত দিন ধরে বুকে ব্যথা আছে কিন্তু কোনো শ্বাসকষ্ট নেই',
      duration: 'About 1 week',
    })
  );

  assert.ok(
    result.primaryDepartmentId === 'pulmonology' || result.primaryDepartmentId === 'medicine'
  );
  assert.notEqual(result.primaryDepartmentId, 'dermatology');
  assert.equal(result.urgency, 'routine');
});

