export {
  synthesizeVoice,
  synthesizeVoiceChunks,
  splitScriptIntoChunks,
  type TtsOptions,
  type ChunkProgressCallback,
} from './audio.tts.js';
export {
  mixWithBackground,
  probeDuration,
  concatMp3Files,
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
  type AudioProgressCallback,
} from './audio.service.js';
