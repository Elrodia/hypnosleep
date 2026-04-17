import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSession,
  getSessionById,
  listSessions,
  updateSession,
  deleteSession,
  _clearSessionStore,
} from '@/modules/sessions/sessions.service';
import type { CreateSessionInput } from '@/modules/sessions/sessions.types';

const sampleSession: CreateSessionInput = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  userId: 'user-123',
  title: 'Peaceful Sleep',
  category: 'sleep',
  durationSec: 900,
  voiceId: 'en-US-AnaNeural',
  backgroundSound: 'rain',
  status: 'generating',
};

describe('Sessions Service', () => {
  beforeEach(() => {
    _clearSessionStore();
  });

  describe('createSession', () => {
    it('should create a session with correct defaults', async () => {
      const session = await createSession(sampleSession);

      expect(session.id).toBe(sampleSession.id);
      expect(session.userId).toBe(sampleSession.userId);
      expect(session.title).toBe('Peaceful Sleep');
      expect(session.status).toBe('generating');
      expect(session.scriptText).toBeNull();
      expect(session.audioUrl).toBeNull();
      expect(session.playCount).toBe(0);
      expect(session.isTemplate).toBe(false);
      expect(session.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('getSessionById', () => {
    it('should return an existing session', async () => {
      await createSession(sampleSession);
      const found = await getSessionById(sampleSession.id);
      expect(found.id).toBe(sampleSession.id);
    });

    it('should throw NOT_FOUND for non-existent session', async () => {
      await expect(
        getSessionById('non-existent-id'),
      ).rejects.toThrow('Session not found');
    });
  });

  describe('listSessions', () => {
    it('should list sessions filtered by userId', async () => {
      await createSession(sampleSession);
      await createSession({
        ...sampleSession,
        id: '550e8400-e29b-41d4-a716-446655440001',
        userId: 'user-456',
        title: 'Other User Session',
      });

      const result = await listSessions({ userId: 'user-123' });
      expect(result.sessions).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.sessions[0].title).toBe('Peaceful Sleep');
    });

    it('should filter by category', async () => {
      await createSession(sampleSession);
      await createSession({
        ...sampleSession,
        id: '550e8400-e29b-41d4-a716-446655440002',
        category: 'confidence',
        title: 'Confidence Boost',
      });

      const result = await listSessions({
        userId: 'user-123',
        category: 'confidence',
      });
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].title).toBe('Confidence Boost');
    });

    it('should paginate results', async () => {
      // Create 5 sessions
      for (let i = 0; i < 5; i++) {
        await createSession({
          ...sampleSession,
          id: `550e8400-e29b-41d4-a716-44665544000${i}`,
          title: `Session ${i}`,
        });
      }

      const page1 = await listSessions({ userId: 'user-123', page: 1, limit: 2 });
      expect(page1.sessions).toHaveLength(2);
      expect(page1.total).toBe(5);

      const page3 = await listSessions({ userId: 'user-123', page: 3, limit: 2 });
      expect(page3.sessions).toHaveLength(1);
    });
  });

  describe('updateSession', () => {
    it('should update session status and audio URL', async () => {
      await createSession(sampleSession);

      const updated = await updateSession(sampleSession.id, {
        status: 'ready',
        audioUrl: 'https://audio.hypnosleep.app/sessions/user-123/test.mp3',
        scriptText: 'Generated script text...',
      });

      expect(updated.status).toBe('ready');
      expect(updated.audioUrl).toBe('https://audio.hypnosleep.app/sessions/user-123/test.mp3');
      expect(updated.scriptText).toBe('Generated script text...');
    });

    it('should throw NOT_FOUND when updating non-existent session', async () => {
      await expect(
        updateSession('non-existent-id', { status: 'ready' }),
      ).rejects.toThrow('Session not found');
    });
  });

  describe('deleteSession', () => {
    it('should delete an existing session', async () => {
      await createSession(sampleSession);
      await deleteSession(sampleSession.id);

      await expect(
        getSessionById(sampleSession.id),
      ).rejects.toThrow('Session not found');
    });

    it('should throw NOT_FOUND when deleting non-existent session', async () => {
      await expect(
        deleteSession('non-existent-id'),
      ).rejects.toThrow('Session not found');
    });
  });
});
