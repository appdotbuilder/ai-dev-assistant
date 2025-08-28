import { db } from '../db';
import { filesTable } from '../db/schema';
import { type UpdateFileInput, type File } from '../schema';
import { eq } from 'drizzle-orm';

export const updateFile = async (input: UpdateFileInput): Promise<File> => {
  try {
    // First, verify the file exists
    const existingFile = await db.select()
      .from(filesTable)
      .where(eq(filesTable.id, input.id))
      .execute();

    if (existingFile.length === 0) {
      throw new Error('File not found');
    }

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.content !== undefined) {
      updateData.content = input.content;
      updateData.size = Buffer.byteLength(input.content, 'utf8');
    }

    if (input.name !== undefined) {
      updateData.name = input.name;
    }

    if (input.path !== undefined) {
      updateData.path = input.path;
    }

    // Update the file
    const result = await db.update(filesTable)
      .set(updateData)
      .where(eq(filesTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('File update failed:', error);
    throw error;
  }
};