import { db } from '../db';
import { sessionsTable } from '../db/schema';
import { type Session } from '../schema';
import { eq } from 'drizzle-orm';

export const getSession = async (sessionId: string): Promise<Session | null> => {
  try {
    // First, check if session exists
    const sessions = await db.select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId))
      .execute();

    if (sessions.length === 0) {
      return null;
    }

    const session = sessions[0];

    // Update the last_activity timestamp to keep the session alive
    await db.update(sessionsTable)
      .set({
        last_activity: new Date()
      })
      .where(eq(sessionsTable.id, sessionId))
      .execute();

    // Return the session with updated last_activity
    return {
      ...session,
      last_activity: new Date(),
      metadata: session.metadata as Record<string, any> | null
    };
  } catch (error) {
    console.error('Session retrieval failed:', error);
    throw error;
  }
};