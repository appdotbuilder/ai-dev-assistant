import { db } from '../db';
import { projectsTable, filesTable, aiChatsTable, versionsTable, collaborationsTable, deploymentsTable } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export async function deleteProject(projectId: string, sessionId: string): Promise<boolean> {
  try {
    // First, verify that the project exists and belongs to the session
    const projects = await db.select()
      .from(projectsTable)
      .where(and(
        eq(projectsTable.id, projectId),
        eq(projectsTable.session_id, sessionId)
      ))
      .execute();

    if (projects.length === 0) {
      return false; // Project not found or doesn't belong to this session
    }

    // Soft delete all associated files
    await db.update(filesTable)
      .set({
        is_deleted: true,
        updated_at: new Date()
      })
      .where(eq(filesTable.project_id, projectId))
      .execute();

    // Delete related AI chats (hard delete as they're tied to this specific project context)
    await db.delete(aiChatsTable)
      .where(eq(aiChatsTable.project_id, projectId))
      .execute();

    // Delete collaboration records (hard delete)
    await db.delete(collaborationsTable)
      .where(eq(collaborationsTable.project_id, projectId))
      .execute();

    // Delete deployments (hard delete)
    await db.delete(deploymentsTable)
      .where(eq(deploymentsTable.project_id, projectId))
      .execute();

    // Delete versions (hard delete)
    await db.delete(versionsTable)
      .where(eq(versionsTable.project_id, projectId))
      .execute();

    // Finally, delete the project itself (hard delete)
    await db.delete(projectsTable)
      .where(eq(projectsTable.id, projectId))
      .execute();

    return true;
  } catch (error) {
    console.error('Project deletion failed:', error);
    throw error;
  }
}