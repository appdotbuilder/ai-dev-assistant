import { db } from '../db';
import { deploymentsTable } from '../db/schema';
import { type Deployment } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const getDeployments = async (projectId: string): Promise<Deployment[]> => {
  try {
    // Query deployments for the project, ordered by creation date (newest first)
    const results = await db.select()
      .from(deploymentsTable)
      .where(eq(deploymentsTable.project_id, projectId))
      .orderBy(desc(deploymentsTable.created_at))
      .execute();

    // Return deployments with properly typed config field
    return results.map(deployment => ({
      id: deployment.id,
      project_id: deployment.project_id,
      version_id: deployment.version_id,
      status: deployment.status,
      url: deployment.url,
      build_logs: deployment.build_logs,
      created_at: deployment.created_at,
      deployed_at: deployment.deployed_at,
      config: deployment.config as Record<string, any> | null
    }));
  } catch (error) {
    console.error('Failed to fetch deployments:', error);
    throw error;
  }
};