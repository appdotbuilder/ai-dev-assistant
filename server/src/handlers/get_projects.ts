import { db } from '../db';
import { projectsTable, collaborationsTable } from '../db/schema';
import { type Project } from '../schema';
import { eq, or } from 'drizzle-orm';

export async function getProjects(sessionId: string): Promise<Project[]> {
  try {
    // Get all projects where the session is either the owner OR has collaboration access
    const results = await db.select({
      id: projectsTable.id,
      name: projectsTable.name,
      description: projectsTable.description,
      type: projectsTable.type,
      template_id: projectsTable.template_id,
      session_id: projectsTable.session_id,
      created_at: projectsTable.created_at,
      updated_at: projectsTable.updated_at,
      is_public: projectsTable.is_public,
      preview_url: projectsTable.preview_url,
      deployment_url: projectsTable.deployment_url
    })
    .from(projectsTable)
    .leftJoin(collaborationsTable, eq(projectsTable.id, collaborationsTable.project_id))
    .where(
      or(
        eq(projectsTable.session_id, sessionId), // Projects owned by session
        eq(collaborationsTable.session_id, sessionId) // Projects shared with session
      )
    )
    .execute();

    // Remove duplicates that might occur from the left join
    const uniqueProjects = new Map<string, Project>();
    
    for (const result of results) {
      const project: Project = {
        id: result.id,
        name: result.name,
        description: result.description,
        type: result.type,
        template_id: result.template_id,
        session_id: result.session_id,
        created_at: result.created_at,
        updated_at: result.updated_at,
        is_public: result.is_public,
        preview_url: result.preview_url,
        deployment_url: result.deployment_url
      };
      
      uniqueProjects.set(project.id, project);
    }

    return Array.from(uniqueProjects.values());
  } catch (error) {
    console.error('Failed to get projects:', error);
    throw error;
  }
}