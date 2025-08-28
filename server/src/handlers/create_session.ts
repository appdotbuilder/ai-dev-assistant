import { db } from '../db';
import { sessionsTable } from '../db/schema';
import { type CreateSessionInput, type Session } from '../schema';
import { randomUUID } from 'crypto';

export const createSession = async (input: CreateSessionInput): Promise<Session> => {
  try {
    const sessionId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    // Insert session record
    const result = await db.insert(sessionsTable)
      .values({
        id: sessionId,
        browser_fingerprint: input.browser_fingerprint,
        ip_address: input.ip_address,
        user_agent: input.user_agent,
        status: 'active',
        created_at: now,
        last_activity: now,
        expires_at: expiresAt,
        metadata: input.metadata ?? null
      })
      .returning()
      .execute();

    // Convert the database result to match the expected Session type
    const session = result[0];
    return {
      ...session,
      metadata: session.metadata as Record<string, any> | null
    };
  } catch (error) {
    console.error('Session creation failed:', error);
    throw error;
  }
};