import { useState } from 'react';
import { Stethoscope } from 'lucide-react';
import { getDoctorPortraitUrl } from '../lib/portraits';
import type { PortraitKey } from '../shared/types';

interface DoctorAvatarProps {
  name: string;
  portraitKey: PortraitKey;
  size?: 'md' | 'lg';
}

export function DoctorAvatar({ name, portraitKey, size = 'md' }: DoctorAvatarProps) {
  const [failed, setFailed] = useState(false);
  const src = getDoctorPortraitUrl(portraitKey);
  const dimensions = size === 'lg' ? 'w-24 h-24 sm:w-28 sm:h-28' : 'w-16 h-16 sm:w-20 sm:h-20';

  if (failed) {
    return (
      <div
        className={`${dimensions} shrink-0 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800`}
        aria-label={name}
      >
        <Stethoscope className="w-7 h-7" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${dimensions} shrink-0 rounded-xl object-cover object-top border border-slate-200 bg-slate-100`}
    />
  );
}
