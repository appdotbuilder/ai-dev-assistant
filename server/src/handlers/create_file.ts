import { db } from '../db';
import { filesTable, projectsTable } from '../db/schema';
import { type CreateFileInput, type File } from '../schema';
import { randomUUID } from 'crypto';
import { eq, and } from 'drizzle-orm';

export const createFile = async (input: CreateFileInput): Promise<File> => {
  try {
    // First, verify that the project exists
    const project = await db.select()
      .from(projectsTable)
      .where(eq(projectsTable.id, input.project_id))
      .limit(1)
      .execute();

    if (project.length === 0) {
      throw new Error(`Project with id ${input.project_id} not found`);
    }

    // Check if a file with the same path already exists in this project
    const existingFile = await db.select()
      .from(filesTable)
      .where(and(
        eq(filesTable.project_id, input.project_id),
        eq(filesTable.path, input.path),
        eq(filesTable.is_deleted, false)
      ))
      .limit(1)
      .execute();

    if (existingFile.length > 0) {
      throw new Error(`File with path '${input.path}' already exists in this project`);
    }

    // Calculate file size in bytes
    const contentSize = Buffer.byteLength(input.content, 'utf8');
    const fileId = randomUUID();

    // Insert the new file
    const result = await db.insert(filesTable)
      .values({
        id: fileId,
        project_id: input.project_id,
        name: input.name,
        path: input.path,
        content: input.content,
        type: input.type,
        size: contentSize,
        is_deleted: false
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('File creation failed:', error);
    throw error;
  }
};