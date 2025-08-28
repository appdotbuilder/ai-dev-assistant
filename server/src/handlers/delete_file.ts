import { db } from '../db';
import { filesTable, projectsTable } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export async function deleteFile(fileId: string, sessionId: string): Promise<boolean> {
  try {
    // First, verify that the file exists and belongs to a project owned by the session
    const fileWithProject = await db.select({
      file_id: filesTable.id,
      project_session_id: projectsTable.session_id,
      is_deleted: filesTable.is_deleted
    })
    .from(filesTable)
    .innerJoin(projectsTable, eq(filesTable.project_id, projectsTable.id))
    .where(eq(filesTable.id, fileId))
    .execute();

    if (fileWithProject.length === 0) {
      throw new Error('File not found');
    }

    const fileData = fileWithProject[0];

    // Verify session ownership
    if (fileData.project_session_id !== sessionId) {
      throw new Error('Unauthorized: File belongs to a different session');
    }

    // Check if file is already deleted
    if (fileData.is_deleted) {
      throw new Error('File is already deleted');
    }

    // Soft delete the file by setting is_deleted flag
    const result = await db.update(filesTable)
      .set({ 
        is_deleted: true,
        updated_at: new Date()
      })
      .where(eq(filesTable.id, fileId))
      .returning({ id: filesTable.id })
      .execute();

    return result.length > 0;
  } catch (error) {
    console.error('File deletion failed:', error);
    throw error;
  }
}