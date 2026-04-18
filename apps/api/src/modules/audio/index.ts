export { synthesizeVoice, type TtsOptions } from './audio.tts.js';
export {
  mixWithBackground,
  probeDuration,
  type MixOptions,
  type BackgroundSound,
} from './audio.mixer.js';
export {
  uploadFile,
  getStreamUrl,
  deleteFile,
  buildSessionKey,
} from './audio.s3.js';
export {
  generateAudio,
  type GenerateAudioInput,
  type GeneratedAudio,
} from './audio.service.js';
