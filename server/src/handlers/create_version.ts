import { db } from '../db';
import { versionsTable, projectsTable } from '../db/schema';
import { type CreateVersionInput, type Version } from '../schema';
import { randomUUID, createHash } from 'crypto';
import { eq } from 'drizzle-orm';

export const createVersion = async (input: CreateVersionInput): Promise<Version> => {
  try {
    // Verify the project exists
    const project = await db.select()
      .from(projectsTable)
      .where(eq(projectsTable.id, input.project_id))
      .execute();

    if (project.length === 0) {
      throw new Error(`Project with id ${input.project_id} not found`);
    }

    const versionId = randomUUID();
    const now = new Date();
    
    // Generate a commit hash based on changes and timestamp
    const changeString = JSON.stringify(input.file_changes);
    const commitHash = createHash('sha256')
      .update(changeString + now.toISOString() + input.project_id)
      .digest('hex')
      .substring(0, 8);

    // Insert version record
    const result = await db.insert(versionsTable)
      .values({
        id: versionId,
        project_id: input.project_id,
        commit_hash: commitHash,
        message: input.message,
        author: input.author,
        created_at: now,
        file_changes: input.file_changes
      })
      .returning()
      .execute();

    // Convert the result to match our schema type
    const version = result[0];
    return {
      ...version,
      file_changes: version.file_changes as typeof input.file_changes
    };
  } catch (error) {
    console.error('Version creation failed:', error);
    throw error;
  }
};