import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyMicrophoneError,
  MAX_AUDIO_BYTES,
  normalizeAudioMimeType,
  pickSupportedAudioMimeType,
  validateAudioBlobSize,
} from './voice';

test('classifies NotAllowedError and PermissionDeniedError as denied permission with guidance', () => {
  const err1 = Object.assign(new Error('Permission dismissed'), { name: 'NotAllowedError' });
  const res1 = classifyMicrophoneError(err1);
  assert.equal(res1.permissionStatus, 'denied');
  assert.match(res1.message, /permission was denied or blocked/i);

  const err2 = Object.assign(new Error('Blocked'), { name: 'SecurityError' });
  const res2 = classifyMicrophoneError(err2);
  assert.equal(res2.permissionStatus, 'denied');
});

test('classifies NotFoundError and NotReadableError distinctly without crashing', () => {
  const missing = classifyMicrophoneError(
    Object.assign(new Error('Requested device not found'), { name: 'NotFoundError' })
  );
  assert.match(missing.message, /No microphone was detected/i);
  assert.equal(missing.permissionStatus, undefined);

  const busy = classifyMicrophoneError(
    Object.assign(new Error('Could not start audio source'), { name: 'NotReadableError' })
  );
  assert.match(busy.message, /busy or locked/i);
});

test('handles unknown or non-Error thrown values safely', () => {
  const res = classifyMicrophoneError(null);
  assert.match(res.message, /Unable to access the microphone/i);
});

test('validates empty and oversized audio recordings', () => {
  assert.match(validateAudioBlobSize(0) ?? '', /too short or silent/i);
  assert.match(validateAudioBlobSize(50) ?? '', /too short or silent/i);
  assert.equal(validateAudioBlobSize(2048), null);
  assert.match(validateAudioBlobSize(MAX_AUDIO_BYTES + 1) ?? '', /10 MB limit/i);
});

test('picks first supported MIME type safely even if browser check throws', () => {
  const picked = pickSupportedAudioMimeType((mime) => {
    if (mime.includes('opus')) throw new Error('bad query');
    return mime === 'audio/mp4';
  });
  assert.equal(picked, 'audio/mp4');
  assert.equal(normalizeAudioMimeType('audio/x-m4a;codecs=aac'), 'audio/mp4');
  assert.equal(normalizeAudioMimeType('audio/webm;codecs=opus'), 'audio/webm');
});
