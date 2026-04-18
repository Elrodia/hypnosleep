/**
 * Queue registry — single import point for all BullMQ plumbing.
 *
 * The audio worker is bootstrapped from `server.ts`; downstream code
 * should import the queue and event-bus helpers from here rather
 * than reaching into individual files, so that a future split into
 * a separate worker process only touches this module.
 */
export {
  enqueueAudioGeneration,
  getJobStatus,
  closeQueue,
} from './audio-generation.queue.js';
export { createAudioGenerationWorker } from './audio-generation.worker.js';
export { generationBus } from './events.bus.js';
export type { AudioGenerationJobData } from '../modules/ai/ai.types.js';
export type { ProgressEvent, ProgressStep } from './events.bus.js';
