import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, unlink, mkdtemp, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { logger } from '../../utils/logger.js';
import { externalApiError } from '../../utils/errors.js';
import type { VoiceId } from '../../config/constants.js';

/**
 * Generates an MP3 audio file from text using Microsoft Edge TTS
 * via the Python `edge-tts` package (called as a subprocess).
 *
 * @param text - The script text to synthesize
 * @param voiceId - Edge TTS voice identifier
 * @returns Buffer containing the MP3 audio data
 */
export async function synthesizeSpeech(
  text: string,
  voiceId: VoiceId,
): Promise<Buffer> {
  const tempDir = await mkdtemp(join(tmpdir(), 'hypnosleep-tts-'));
  const outputPath = join(tempDir, 'output.mp3');

  try {
    await runTts(text, voiceId, outputPath);

    if (!existsSync(outputPath)) {
      throw externalApiError('edge-tts', 'TTS output file was not created');
    }

    const audioBuffer = await readFile(outputPath);

    logger.info(
      { voiceId, textLength: text.length, audioBytes: audioBuffer.length },
      'TTS synthesis complete',
    );

    return audioBuffer;
  } finally {
    // Clean up temp files
    try {
      if (existsSync(outputPath)) await unlink(outputPath);
      await rmdir(tempDir);
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Spawns the Python edge-tts process and waits for completion.
 */
function runTts(
  text: string,
  voiceId: string,
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Determine the TTS script path
    const scriptPath = join(
      import.meta.dirname ?? process.cwd(),
      '..',
      '..',
      'scripts',
      'tts.py',
    );

    const proc = spawn('python3', [scriptPath, '--voice', voiceId, '--output', outputPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Send the text via stdin to avoid shell argument length limits
    proc.stdin.write(text);
    proc.stdin.end();

    let stderr = '';

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        logger.error({ code, stderr }, 'edge-tts process failed');
        reject(
          externalApiError(
            'edge-tts',
            `TTS process exited with code ${code}: ${stderr.slice(0, 200)}`,
          ),
        );
        return;
      }
      resolve();
    });

    proc.on('error', (err) => {
      logger.error({ err }, 'Failed to spawn edge-tts process');
      reject(externalApiError('edge-tts', 'Failed to start TTS subprocess'));
    });
  });
}

/**
 * Mixes the voice audio with a background sound using FFmpeg.
 *
 * @param voiceAudio - Buffer of the voice MP3
 * @param backgroundSound - Name of the background sound (rain, ocean, etc.)
 * @param durationSec - Desired output duration in seconds
 * @returns Buffer containing the mixed MP3 audio
 */
export async function mixAudioWithBackground(
  voiceAudio: Buffer,
  backgroundSound: string,
  durationSec: number,
): Promise<Buffer> {
  if (backgroundSound === 'silence') {
    return voiceAudio;
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'hypnosleep-mix-'));
  const voicePath = join(tempDir, 'voice.mp3');
  const outputPath = join(tempDir, 'mixed.mp3');

  const { writeFile } = await import('node:fs/promises');

  try {
    await writeFile(voicePath, voiceAudio);

    // Background sound files are stored as assets in the project
    const bgPath = join(
      import.meta.dirname ?? process.cwd(),
      '..',
      '..',
      'assets',
      'backgrounds',
      `${backgroundSound}.mp3`,
    );

    await runFfmpegMix(voicePath, bgPath, outputPath, durationSec);

    if (!existsSync(outputPath)) {
      throw externalApiError('ffmpeg', 'Mixed output file was not created');
    }

    const mixedBuffer = await readFile(outputPath);

    logger.info(
      {
        backgroundSound,
        durationSec,
        outputBytes: mixedBuffer.length,
      },
      'Audio mixing complete',
    );

    return mixedBuffer;
  } finally {
    try {
      if (existsSync(voicePath)) await unlink(voicePath);
      if (existsSync(outputPath)) await unlink(outputPath);
      await rmdir(tempDir);
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Runs FFmpeg to mix voice and background audio.
 * Voice is primary, background is looped and mixed at lower volume.
 */
function runFfmpegMix(
  voicePath: string,
  bgPath: string,
  outputPath: string,
  durationSec: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // If background file doesn't exist, just copy voice
    if (!existsSync(bgPath)) {
      logger.warn({ bgPath }, 'Background sound file not found, using voice only');
      const proc = spawn('ffmpeg', [
        '-i', voicePath,
        '-c', 'copy',
        outputPath,
      ]);

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(externalApiError('ffmpeg', `FFmpeg copy failed with code ${code}`));
          return;
        }
        resolve();
      });

      proc.on('error', (err) => {
        reject(externalApiError('ffmpeg', `FFmpeg process error: ${err.message}`));
      });

      return;
    }

    const proc = spawn('ffmpeg', [
      '-i', voicePath,
      '-stream_loop', '-1',
      '-i', bgPath,
      '-t', String(durationSec),
      '-filter_complex',
      '[0:a]volume=1.0[voice];[1:a]volume=0.15[bg];[voice][bg]amix=inputs=2:duration=first:dropout_transition=3[out]',
      '-map', '[out]',
      '-ac', '2',
      '-ar', '44100',
      '-b:a', '192k',
      '-y',
      outputPath,
    ]);

    let stderr = '';
    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        logger.error({ code, stderr: stderr.slice(-500) }, 'FFmpeg mix failed');
        reject(externalApiError('ffmpeg', `FFmpeg exited with code ${code}`));
        return;
      }
      resolve();
    });

    proc.on('error', (err) => {
      reject(externalApiError('ffmpeg', `FFmpeg process error: ${err.message}`));
    });
  });
}
