import { db } from '../db';
import { projectsTable, templatesTable, filesTable, sessionsTable } from '../db/schema';
import { type CreateProjectInput, type Project } from '../schema';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';

export const createProject = async (input: CreateProjectInput): Promise<Project> => {
  try {
    // Verify that the session exists
    const session = await db.select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, input.session_id))
      .execute();

    if (session.length === 0) {
      throw new Error(`Session with id ${input.session_id} not found`);
    }

    const projectId = randomUUID();
    const now = new Date();
    const previewUrl = `https://preview.dev/${projectId}`;

    // If template_id is provided, verify it exists
    let template = null;
    if (input.template_id) {
      const templateResult = await db.select()
        .from(templatesTable)
        .where(eq(templatesTable.id, input.template_id))
        .execute();

      if (templateResult.length === 0) {
        throw new Error(`Template with id ${input.template_id} not found`);
      }
      
      template = templateResult[0];
      
      // Increment template usage count
      await db.update(templatesTable)
        .set({ usage_count: template.usage_count + 1 })
        .where(eq(templatesTable.id, input.template_id))
        .execute();
    }

    // Create the project
    const result = await db.insert(projectsTable)
      .values({
        id: projectId,
        name: input.name,
        description: input.description || null,
        type: input.type,
        template_id: input.template_id || null,
        session_id: input.session_id,
        created_at: now,
        updated_at: now,
        is_public: false,
        preview_url: previewUrl,
        deployment_url: null
      })
      .returning()
      .execute();

    const project = result[0];

    // If template was provided, create files from template
    if (template && template.files) {
      const templateFiles = template.files as Array<{
        path: string;
        content: string;
        type: string;
      }>;

      for (const templateFile of templateFiles) {
        const fileId = randomUUID();
        const fileName = templateFile.path.split('/').pop() || templateFile.path;
        
        await db.insert(filesTable)
          .values({
            id: fileId,
            project_id: projectId,
            name: fileName,
            path: templateFile.path,
            content: templateFile.content,
            type: templateFile.type as any,
            size: templateFile.content.length,
            created_at: now,
            updated_at: now,
            is_deleted: false
          })
          .execute();
      }
    }

    return project;
  } catch (error) {
    console.error('Project creation failed:', error);
    throw error;
  }
};