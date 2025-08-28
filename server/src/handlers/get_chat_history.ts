import { db } from '../db';
import { aiChatsTable } from '../db/schema';
import { type AiChat } from '../schema';
import { eq, and, desc } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export interface GetChatHistoryOptions {
  limit?: number;
  offset?: number;
}

export async function getChatHistory(
  sessionId: string, 
  projectId?: string, 
  options: GetChatHistoryOptions = {}
): Promise<AiChat[]> {
  try {
    const { limit = 50, offset = 0 } = options;

    // Build conditions array
    const conditions: SQL<unknown>[] = [
      eq(aiChatsTable.session_id, sessionId)
    ];

    // Add project filter if specified
    if (projectId !== undefined) {
      conditions.push(eq(aiChatsTable.project_id, projectId));
    }

    // Build query with all conditions at once
    const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);
    
    const results = await db.select()
      .from(aiChatsTable)
      .where(whereCondition)
      .orderBy(desc(aiChatsTable.created_at))
      .limit(limit)
      .offset(offset)
      .execute();

    // Convert results with proper type handling for JSON fields
    return results.map(result => ({
      ...result,
      context_files: result.context_files as string[] | null
    }));
  } catch (error) {
    console.error('Chat history retrieval failed:', error);
    throw error;
  }
}