import { db } from '../db';
import { templatesTable, projectsTable, filesTable } from '../db/schema';
import { type Template } from '../schema';
import { randomUUID } from 'crypto';
import { eq, and } from 'drizzle-orm';

export async function createTemplate(projectId: string, name: string, description: string, tags: string[]): Promise<Template> {
  try {
    // First, verify the project exists and get its details
    const projects = await db.select()
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId))
      .execute();

    if (projects.length === 0) {
      throw new Error(`Project with id ${projectId} not found`);
    }

    const project = projects[0];

    // Get all non-deleted files from the project
    const files = await db.select()
      .from(filesTable)
      .where(
        and(
          eq(filesTable.project_id, projectId),
          eq(filesTable.is_deleted, false)
        )
      )
      .execute();

    // Transform files into template file format
    const templateFiles = files.map(file => ({
      path: file.path,
      content: file.content,
      type: file.type
    }));

    // Insert the template
    const templateId = randomUUID();
    const result = await db.insert(templatesTable)
      .values({
        id: templateId,
        name: name,
        description: description,
        type: project.type, // Use the project's type
        files: templateFiles,
        tags: tags || [],
        is_featured: false
      })
      .returning()
      .execute();

    // Convert JSON fields back to proper types
    const template = result[0];
    return {
      ...template,
      files: template.files as Array<{
        path: string;
        content: string;
        type: "js" | "ts" | "jsx" | "tsx" | "css" | "scss" | "html" | "json" | "md";
      }>,
      tags: template.tags as string[]
    };
  } catch (error) {
    console.error('Template creation failed:', error);
    throw error;
  }
};