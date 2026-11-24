export type MicPermissionStatus = 'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported';

export interface MicErrorInfo {
  permissionStatus?: MicPermissionStatus;
  message: string;
}

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
export const MIN_AUDIO_BYTES = 100;

export function pickSupportedAudioMimeType(
  isTypeSupported: (mime: string) => boolean
): string | undefined {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  return candidates.find((candidate) => {
    try {
      return isTypeSupported(candidate);
    } catch {
      return false;
    }
  });
}

export function normalizeAudioMimeType(rawMime: string | undefined): string {
  const base = (rawMime ?? 'audio/webm').split(';')[0].trim().toLowerCase();
  if (!base) return 'audio/webm';
  if (base === 'audio/x-m4a') return 'audio/mp4';
  return base;
}

export function validateAudioBlobSize(byteLength: number): string | null {
  if (!Number.isFinite(byteLength) || byteLength < MIN_AUDIO_BYTES) {
    return 'Recording was too short or silent. Please speak into your microphone and try again.';
  }
  if (byteLength > MAX_AUDIO_BYTES) {
    return 'Recording exceeded the 10 MB limit. Please record a shorter description (under 90 seconds).';
  }
  return null;
}

export function classifyMicrophoneError(err: unknown): MicErrorInfo {
  const name =
    err && typeof err === 'object' && 'name' in err && typeof (err as { name: unknown }).name === 'string'
      ? (err as { name: string }).name
      : '';
  const rawMessage =
    err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
      ? (err as { message: string }).message.toLowerCase()
      : '';

  if (
    name === 'NotAllowedError' ||
    name === 'PermissionDeniedError' ||
    name === 'SecurityError' ||
    rawMessage.includes('permission') ||
    rawMessage.includes('denied')
  ) {
    return {
      permissionStatus: 'denied',
      message:
        'Microphone permission was denied or blocked by the browser. Click the camera/microphone icon in your browser address bar to allow microphone access, then try again — or type your symptoms below.',
    };
  }

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return {
      message:
        'No microphone was detected on this device. Connect a microphone or type your symptoms in the box below.',
    };
  }

  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      message:
        'Your microphone is currently busy or locked by another application. Close the other app and try again.',
    };
  }

  if (name === 'NotSupportedError' || name === 'TypeError') {
    return {
      permissionStatus: 'unsupported',
      message:
        'Voice recording could not start in this browser context. Please type your symptoms below.',
    };
  }

  return {
    message:
      'Unable to access the microphone right now. Please check your browser permissions or type your symptoms below.',
  };
}
