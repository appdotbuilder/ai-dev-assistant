import { db } from '../db';
import { collaborationsTable } from '../db/schema';
import { type Collaboration } from '../schema';
import { eq } from 'drizzle-orm';

export async function getCollaborations(projectId: string): Promise<Collaboration[]> {
  try {
    // Query all collaborations for the specified project
    const results = await db.select()
      .from(collaborationsTable)
      .where(eq(collaborationsTable.project_id, projectId))
      .execute();

    // Transform the results to match the expected schema
    return results.map(collaboration => ({
      id: collaboration.id,
      project_id: collaboration.project_id,
      session_id: collaboration.session_id,
      role: collaboration.role,
      invited_at: collaboration.invited_at,
      last_active: collaboration.last_active,
      permissions: collaboration.permissions as string[]
    }));
  } catch (error) {
    console.error('Failed to fetch collaborations:', error);
    throw error;
  }
}