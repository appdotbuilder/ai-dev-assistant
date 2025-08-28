import { db } from '../db';
import { filesTable } from '../db/schema';
import { type File } from '../schema';
import { eq, and } from 'drizzle-orm';

export const getFiles = async (projectId: string): Promise<File[]> => {
  try {
    // Query files for the specific project, excluding deleted files
    const results = await db.select()
      .from(filesTable)
      .where(
        and(
          eq(filesTable.project_id, projectId),
          eq(filesTable.is_deleted, false)
        )
      )
      .execute();

    // Return files with proper type conversions
    return results.map(file => ({
      ...file,
      // All fields are already in the correct format from the database
      // size is integer, created_at/updated_at are Date objects, is_deleted is boolean
    }));
  } catch (error) {
    console.error('Failed to fetch files:', error);
    throw error;
  }
};