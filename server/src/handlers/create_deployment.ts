import { db } from '../db';
import { deploymentsTable, projectsTable, versionsTable } from '../db/schema';
import { type CreateDeploymentInput, type Deployment } from '../schema';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';

export async function createDeployment(input: CreateDeploymentInput): Promise<Deployment> {
  try {
    // Verify that project exists
    const project = await db.select()
      .from(projectsTable)
      .where(eq(projectsTable.id, input.project_id))
      .limit(1)
      .execute();

    if (project.length === 0) {
      throw new Error(`Project with id ${input.project_id} not found`);
    }

    // Verify that version exists and belongs to the project
    const version = await db.select()
      .from(versionsTable)
      .where(eq(versionsTable.id, input.version_id))
      .limit(1)
      .execute();

    if (version.length === 0) {
      throw new Error(`Version with id ${input.version_id} not found`);
    }

    if (version[0].project_id !== input.project_id) {
      throw new Error(`Version ${input.version_id} does not belong to project ${input.project_id}`);
    }

    // Create deployment record
    const deploymentId = randomUUID();
    const now = new Date();

    const result = await db.insert(deploymentsTable)
      .values({
        id: deploymentId,
        project_id: input.project_id,
        version_id: input.version_id,
        status: 'pending',
        url: null,
        build_logs: 'Starting deployment...\n',
        created_at: now,
        deployed_at: null,
        config: input.config || null
      })
      .returning()
      .execute();

    const deployment = result[0];
    
    return {
      ...deployment,
      created_at: deployment.created_at,
      deployed_at: deployment.deployed_at,
      config: deployment.config as Record<string, any> | null
    };
  } catch (error) {
    console.error('Deployment creation failed:', error);
    throw error;
  }
}