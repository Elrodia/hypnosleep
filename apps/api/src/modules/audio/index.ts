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
  crossfadeBackgrounds,
  type MixOptions,
  type BackgroundSound,
} from './audio.mixer.js';
export {
  uploadFile,
  getStreamUrl,
  deleteFile,
  buildSessionKey,
  type UploadMetadata,
} from './audio.s3.js';
export {
  getCachedStreamUrl,
  setCachedStreamUrl,
  invalidateAudioCache,
} from './audio.cache.js';
export {
  generateAudio,
  type GenerateAudioInput,
  type GeneratedAudio,
  type AudioProgressCallback,
} from './audio.service.js';
