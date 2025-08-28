import { db } from '../db';
import { versionsTable } from '../db/schema';
import { type Version } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const getVersions = async (projectId: string): Promise<Version[]> => {
  try {
    // Query versions for the project, ordered by creation date descending
    const results = await db.select()
      .from(versionsTable)
      .where(eq(versionsTable.project_id, projectId))
      .orderBy(desc(versionsTable.created_at))
      .execute();

    // Cast results to match the expected schema type (file_changes comes as unknown from JSON field)
    return results as Version[];
  } catch (error) {
    console.error('Failed to fetch versions:', error);
    throw error;
  }
};