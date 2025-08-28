import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { sessionsTable } from '../db/schema';
import { type CreateSessionInput } from '../schema';
import { createSession } from '../handlers/create_session';
import { eq } from 'drizzle-orm';

// Simple test input
const testInput: CreateSessionInput = {
  browser_fingerprint: 'test-fingerprint-123',
  ip_address: '192.168.1.1',
  user_agent: 'Mozilla/5.0 (Test Browser)',
  metadata: { theme: 'dark', language: 'en' }
};

describe('createSession', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a session with basic fields', async () => {
    const result = await createSession(testInput);

    // Basic field validation
    expect(result.browser_fingerprint).toEqual('test-fingerprint-123');
    expect(result.ip_address).toEqual('192.168.1.1');
    expect(result.user_agent).toEqual('Mozilla/5.0 (Test Browser)');
    expect(result.status).toEqual('active');
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('string');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.last_activity).toBeInstanceOf(Date);
    expect(result.expires_at).toBeInstanceOf(Date);
    expect(result.metadata).toEqual({ theme: 'dark', language: 'en' });
  });

  it('should create a session without metadata', async () => {
    const inputWithoutMetadata: CreateSessionInput = {
      browser_fingerprint: 'no-metadata-fingerprint',
      ip_address: '10.0.0.1',
      user_agent: 'Test Browser 2.0'
    };

    const result = await createSession(inputWithoutMetadata);

    expect(result.browser_fingerprint).toEqual('no-metadata-fingerprint');
    expect(result.ip_address).toEqual('10.0.0.1');
    expect(result.user_agent).toEqual('Test Browser 2.0');
    expect(result.status).toEqual('active');
    expect(result.metadata).toBeNull();
  });

  it('should save session to database', async () => {
    const result = await createSession(testInput);

    // Query database to verify session was saved
    const sessions = await db.select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, result.id))
      .execute();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].browser_fingerprint).toEqual('test-fingerprint-123');
    expect(sessions[0].ip_address).toEqual('192.168.1.1');
    expect(sessions[0].user_agent).toEqual('Mozilla/5.0 (Test Browser)');
    expect(sessions[0].status).toEqual('active');
    expect(sessions[0].created_at).toBeInstanceOf(Date);
    expect(sessions[0].last_activity).toBeInstanceOf(Date);
    expect(sessions[0].expires_at).toBeInstanceOf(Date);
    expect(sessions[0].metadata).toEqual({ theme: 'dark', language: 'en' });
  });

  it('should set expiration to 24 hours from creation', async () => {
    const beforeCreate = new Date();
    const result = await createSession(testInput);
    const afterCreate = new Date();

    const expectedExpirationMin = new Date(beforeCreate.getTime() + 24 * 60 * 60 * 1000);
    const expectedExpirationMax = new Date(afterCreate.getTime() + 24 * 60 * 60 * 1000);

    expect(result.expires_at.getTime()).toBeGreaterThanOrEqual(expectedExpirationMin.getTime());
    expect(result.expires_at.getTime()).toBeLessThanOrEqual(expectedExpirationMax.getTime());
  });

  it('should set created_at and last_activity to current time', async () => {
    const beforeCreate = new Date();
    const result = await createSession(testInput);
    const afterCreate = new Date();

    expect(result.created_at.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
    expect(result.created_at.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    
    expect(result.last_activity.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
    expect(result.last_activity.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
  });

  it('should generate unique session IDs', async () => {
    const result1 = await createSession(testInput);
    const result2 = await createSession({
      ...testInput,
      browser_fingerprint: 'different-fingerprint'
    });

    expect(result1.id).not.toEqual(result2.id);
    expect(typeof result1.id).toBe('string');
    expect(typeof result2.id).toBe('string');
  });

  it('should handle complex metadata objects', async () => {
    const complexInput: CreateSessionInput = {
      browser_fingerprint: 'complex-metadata-test',
      ip_address: '172.16.0.1',
      user_agent: 'Complex Test Browser',
      metadata: {
        preferences: {
          theme: 'light',
          fontSize: 14,
          enableNotifications: true
        },
        features: ['ai-chat', 'collaboration', 'deployment'],
        lastProjects: [
          { id: 'proj-1', name: 'Test Project 1' },
          { id: 'proj-2', name: 'Test Project 2' }
        ]
      }
    };

    const result = await createSession(complexInput);

    expect(result.metadata).toEqual(complexInput.metadata ?? null);
    
    // Verify complex metadata is properly stored in database
    const sessions = await db.select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, result.id))
      .execute();

    expect(sessions[0].metadata).toEqual(complexInput.metadata ?? null);
  });
});