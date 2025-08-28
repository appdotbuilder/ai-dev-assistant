import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { sessionsTable } from '../db/schema';
import { type CreateSessionInput } from '../schema';
import { getSession } from '../handlers/get_session';
import { eq } from 'drizzle-orm';

// Test session input
const testSessionInput: CreateSessionInput = {
  browser_fingerprint: 'test-fingerprint-123',
  ip_address: '192.168.1.1',
  user_agent: 'Mozilla/5.0 (Test Browser)',
  metadata: { test: 'data' }
};

describe('getSession', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should retrieve an existing session', async () => {
    // Create a test session first
    const sessionId = 'test-session-123';
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await db.insert(sessionsTable)
      .values({
        id: sessionId,
        browser_fingerprint: testSessionInput.browser_fingerprint,
        ip_address: testSessionInput.ip_address,
        user_agent: testSessionInput.user_agent,
        status: 'active',
        expires_at: expiresAt,
        metadata: testSessionInput.metadata
      })
      .execute();

    const result = await getSession(sessionId);

    // Verify session data
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(sessionId);
    expect(result!.browser_fingerprint).toEqual('test-fingerprint-123');
    expect(result!.ip_address).toEqual('192.168.1.1');
    expect(result!.user_agent).toEqual('Mozilla/5.0 (Test Browser)');
    expect(result!.status).toEqual('active');
    expect(result!.metadata).toEqual({ test: 'data' });
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.last_activity).toBeInstanceOf(Date);
    expect(result!.expires_at).toBeInstanceOf(Date);
  });

  it('should update last_activity timestamp when retrieving session', async () => {
    // Create a session with an old last_activity timestamp
    const sessionId = 'test-session-456';
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    const oldTimestamp = new Date();
    oldTimestamp.setHours(oldTimestamp.getHours() - 1); // 1 hour ago

    await db.insert(sessionsTable)
      .values({
        id: sessionId,
        browser_fingerprint: testSessionInput.browser_fingerprint,
        ip_address: testSessionInput.ip_address,
        user_agent: testSessionInput.user_agent,
        status: 'active',
        expires_at: expiresAt,
        last_activity: oldTimestamp,
        metadata: testSessionInput.metadata
      })
      .execute();

    const result = await getSession(sessionId);

    // Verify that last_activity was updated
    expect(result).not.toBeNull();
    expect(result!.last_activity).toBeInstanceOf(Date);
    expect(result!.last_activity.getTime()).toBeGreaterThan(oldTimestamp.getTime());
  });

  it('should update last_activity in database when retrieving session', async () => {
    // Create a session with an old last_activity timestamp
    const sessionId = 'test-session-789';
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    const oldTimestamp = new Date();
    oldTimestamp.setHours(oldTimestamp.getHours() - 2); // 2 hours ago

    await db.insert(sessionsTable)
      .values({
        id: sessionId,
        browser_fingerprint: testSessionInput.browser_fingerprint,
        ip_address: testSessionInput.ip_address,
        user_agent: testSessionInput.user_agent,
        status: 'active',
        expires_at: expiresAt,
        last_activity: oldTimestamp,
        metadata: testSessionInput.metadata
      })
      .execute();

    // Get the session (should update last_activity)
    await getSession(sessionId);

    // Query the database to verify last_activity was updated
    const updatedSessions = await db.select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId))
      .execute();

    expect(updatedSessions).toHaveLength(1);
    expect(updatedSessions[0].last_activity).toBeInstanceOf(Date);
    expect(updatedSessions[0].last_activity.getTime()).toBeGreaterThan(oldTimestamp.getTime());
  });

  it('should return null for non-existent session', async () => {
    const result = await getSession('non-existent-session');
    expect(result).toBeNull();
  });

  it('should handle sessions with different statuses', async () => {
    // Test with inactive session
    const inactiveSessionId = 'inactive-session-123';
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await db.insert(sessionsTable)
      .values({
        id: inactiveSessionId,
        browser_fingerprint: testSessionInput.browser_fingerprint,
        ip_address: testSessionInput.ip_address,
        user_agent: testSessionInput.user_agent,
        status: 'inactive',
        expires_at: expiresAt,
        metadata: testSessionInput.metadata
      })
      .execute();

    const result = await getSession(inactiveSessionId);

    expect(result).not.toBeNull();
    expect(result!.status).toEqual('inactive');
    expect(result!.last_activity).toBeInstanceOf(Date);
  });

  it('should handle sessions with null metadata', async () => {
    const sessionId = 'null-metadata-session';
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await db.insert(sessionsTable)
      .values({
        id: sessionId,
        browser_fingerprint: testSessionInput.browser_fingerprint,
        ip_address: testSessionInput.ip_address,
        user_agent: testSessionInput.user_agent,
        status: 'active',
        expires_at: expiresAt,
        metadata: null
      })
      .execute();

    const result = await getSession(sessionId);

    expect(result).not.toBeNull();
    expect(result!.metadata).toBeNull();
    expect(result!.last_activity).toBeInstanceOf(Date);
  });

  it('should work with expired sessions', async () => {
    // Test that expired sessions can still be retrieved
    const expiredSessionId = 'expired-session-123';
    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 1); // Expired 1 hour ago

    await db.insert(sessionsTable)
      .values({
        id: expiredSessionId,
        browser_fingerprint: testSessionInput.browser_fingerprint,
        ip_address: testSessionInput.ip_address,
        user_agent: testSessionInput.user_agent,
        status: 'expired',
        expires_at: pastDate,
        metadata: testSessionInput.metadata
      })
      .execute();

    const result = await getSession(expiredSessionId);

    expect(result).not.toBeNull();
    expect(result!.status).toEqual('expired');
    expect(result!.expires_at).toEqual(pastDate);
    expect(result!.last_activity).toBeInstanceOf(Date);
  });
});