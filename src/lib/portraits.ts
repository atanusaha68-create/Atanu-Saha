import type { PortraitKey } from '../shared/types';

export const HERO_CLINIC_IMAGE = '/src/assets/images/hero_dhaka_clinic_1795499304299.jpg';

const PORTRAIT_URLS: Record<PortraitKey, string> = {
  male_senior: '/src/assets/images/doctor_portrait_male_senior_1795499304670.jpg',
  female_specialist: '/src/assets/images/doctor_portrait_female_specialist_1795499305379.jpg',
  male_young: '/src/assets/images/doctor_portrait_male_young_1795499305397.jpg',
};

export function getDoctorPortraitUrl(key: PortraitKey): string {
  return PORTRAIT_URLS[key] ?? PORTRAIT_URLS.male_senior;
}
