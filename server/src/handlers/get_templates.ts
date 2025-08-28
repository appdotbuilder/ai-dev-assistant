import { db } from '../db';
import { templatesTable } from '../db/schema';
import { type Template } from '../schema';
import { desc, eq } from 'drizzle-orm';

export const getTemplates = async (): Promise<Template[]> => {
  try {
    // Fetch all templates, ordered by featured first, then by usage count
    const results = await db.select()
      .from(templatesTable)
      .orderBy(
        desc(templatesTable.is_featured),
        desc(templatesTable.usage_count)
      )
      .execute();

    // Return templates with proper type conversion
    return results.map(template => ({
      ...template,
      files: template.files as Array<{
        path: string;
        content: string;
        type: 'js' | 'ts' | 'jsx' | 'tsx' | 'css' | 'scss' | 'html' | 'json' | 'md';
      }>,
      tags: template.tags as string[]
    }));
  } catch (error) {
    console.error('Template fetching failed:', error);
    throw error;
  }
};