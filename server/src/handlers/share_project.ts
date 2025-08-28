import { db } from '../db';
import { projectsTable, sessionsTable, collaborationsTable } from '../db/schema';
import { type ShareProjectInput, type Collaboration } from '../schema';
import { randomUUID } from 'crypto';
import { eq, and } from 'drizzle-orm';

export const shareProject = async (input: ShareProjectInput): Promise<Collaboration> => {
  try {
    // Verify that the project exists
    const project = await db.select()
      .from(projectsTable)
      .where(eq(projectsTable.id, input.project_id))
      .execute();

    if (project.length === 0) {
      throw new Error('Project not found');
    }

    // Verify that the session exists
    const session = await db.select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, input.session_id))
      .execute();

    if (session.length === 0) {
      throw new Error('Session not found');
    }

    // Check if collaboration already exists for this project and session
    const existingCollaboration = await db.select()
      .from(collaborationsTable)
      .where(and(
        eq(collaborationsTable.project_id, input.project_id),
        eq(collaborationsTable.session_id, input.session_id)
      ))
      .execute();

    if (existingCollaboration.length > 0) {
      throw new Error('Collaboration already exists for this project and session');
    }

    // Default permissions based on role
    const defaultPermissions = {
      owner: ['read', 'write', 'delete', 'share', 'deploy'],
      editor: ['read', 'write'],
      viewer: ['read']
    };

    // Insert collaboration record
    const result = await db.insert(collaborationsTable)
      .values({
        id: randomUUID(),
        project_id: input.project_id,
        session_id: input.session_id,
        role: input.role,
        permissions: input.permissions || defaultPermissions[input.role]
      })
      .returning()
      .execute();

    // Convert the result to match the Collaboration type
    const collaboration = result[0];
    return {
      ...collaboration,
      permissions: collaboration.permissions as string[]
    };
  } catch (error) {
    console.error('Project sharing failed:', error);
    throw error;
  }
};