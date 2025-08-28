import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { deploymentsTable, projectsTable, versionsTable, sessionsTable, templatesTable } from '../db/schema';
import { type CreateDeploymentInput } from '../schema';
import { createDeployment } from '../handlers/create_deployment';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Helper function to create prerequisite data
const createTestSession = async () => {
  const sessionId = randomUUID();
  await db.insert(sessionsTable).values({
    id: sessionId,
    browser_fingerprint: 'test-fingerprint',
    ip_address: '127.0.0.1',
    user_agent: 'test-agent',
    status: 'active',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
  }).execute();
  return sessionId;
};

const createTestTemplate = async () => {
  const templateId = randomUUID();
  await db.insert(templatesTable).values({
    id: templateId,
    name: 'React Template',
    description: 'A React template for testing',
    type: 'react',
    files: [
      { path: 'index.html', content: '<html></html>', type: 'html' },
      { path: 'src/App.tsx', content: 'export default function App() { return <div>Hello</div>; }', type: 'tsx' }
    ],
    tags: ['react', 'typescript'],
    is_featured: false,
    usage_count: 0
  }).execute();
  return templateId;
};

const createTestProject = async (sessionId: string, templateId: string) => {
  const projectId = randomUUID();
  await db.insert(projectsTable).values({
    id: projectId,
    name: 'Test Project',
    description: 'A project for testing',
    type: 'react',
    template_id: templateId,
    session_id: sessionId,
    is_public: false
  }).execute();
  return projectId;
};

const createTestVersion = async (projectId: string) => {
  const versionId = randomUUID();
  await db.insert(versionsTable).values({
    id: versionId,
    project_id: projectId,
    commit_hash: 'abc123',
    message: 'Initial version',
    author: 'Test Author',
    file_changes: [
      {
        file_id: randomUUID(),
        action: 'created',
        content_before: null,
        content_after: 'console.log("Hello");'
      }
    ]
  }).execute();
  return versionId;
};

describe('createDeployment', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a deployment successfully', async () => {
    // Setup prerequisite data
    const sessionId = await createTestSession();
    const templateId = await createTestTemplate();
    const projectId = await createTestProject(sessionId, templateId);
    const versionId = await createTestVersion(projectId);

    const input: CreateDeploymentInput = {
      project_id: projectId,
      version_id: versionId,
      config: {
        environment: 'production',
        build_command: 'npm run build',
        output_dir: 'dist'
      }
    };

    const result = await createDeployment(input);

    // Verify deployment fields
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('string');
    expect(result.project_id).toBe(projectId);
    expect(result.version_id).toBe(versionId);
    expect(result.status).toBe('pending');
    expect(result.url).toBe(null);
    expect(result.build_logs).toBe('Starting deployment...\n');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.deployed_at).toBe(null);
    expect(result.config).toEqual({
      environment: 'production',
      build_command: 'npm run build',
      output_dir: 'dist'
    });
  });

  it('should create deployment without config', async () => {
    // Setup prerequisite data
    const sessionId = await createTestSession();
    const templateId = await createTestTemplate();
    const projectId = await createTestProject(sessionId, templateId);
    const versionId = await createTestVersion(projectId);

    const input: CreateDeploymentInput = {
      project_id: projectId,
      version_id: versionId
    };

    const result = await createDeployment(input);

    // Verify deployment is created with null config
    expect(result.config).toBe(null);
    expect(result.status).toBe('pending');
    expect(result.project_id).toBe(projectId);
    expect(result.version_id).toBe(versionId);
  });

  it('should save deployment to database', async () => {
    // Setup prerequisite data
    const sessionId = await createTestSession();
    const templateId = await createTestTemplate();
    const projectId = await createTestProject(sessionId, templateId);
    const versionId = await createTestVersion(projectId);

    const input: CreateDeploymentInput = {
      project_id: projectId,
      version_id: versionId,
      config: { platform: 'vercel' }
    };

    const result = await createDeployment(input);

    // Query database to verify deployment was saved
    const deployments = await db.select()
      .from(deploymentsTable)
      .where(eq(deploymentsTable.id, result.id))
      .execute();

    expect(deployments).toHaveLength(1);
    const savedDeployment = deployments[0];
    
    expect(savedDeployment.id).toBe(result.id);
    expect(savedDeployment.project_id).toBe(projectId);
    expect(savedDeployment.version_id).toBe(versionId);
    expect(savedDeployment.status).toBe('pending');
    expect(savedDeployment.url).toBe(null);
    expect(savedDeployment.build_logs).toBe('Starting deployment...\n');
    expect(savedDeployment.created_at).toBeInstanceOf(Date);
    expect(savedDeployment.deployed_at).toBe(null);
    expect(savedDeployment.config).toEqual({ platform: 'vercel' });
  });

  it('should throw error when project does not exist', async () => {
    // Setup only version without corresponding project
    const sessionId = await createTestSession();
    const templateId = await createTestTemplate();
    const projectId = await createTestProject(sessionId, templateId);
    const versionId = await createTestVersion(projectId);
    const nonExistentProjectId = randomUUID();

    const input: CreateDeploymentInput = {
      project_id: nonExistentProjectId,
      version_id: versionId
    };

    await expect(createDeployment(input)).rejects.toThrow(/Project with id .* not found/i);
  });

  it('should throw error when version does not exist', async () => {
    // Setup project without corresponding version
    const sessionId = await createTestSession();
    const templateId = await createTestTemplate();
    const projectId = await createTestProject(sessionId, templateId);
    const nonExistentVersionId = randomUUID();

    const input: CreateDeploymentInput = {
      project_id: projectId,
      version_id: nonExistentVersionId
    };

    await expect(createDeployment(input)).rejects.toThrow(/Version with id .* not found/i);
  });

  it('should throw error when version does not belong to project', async () => {
    // Setup two projects with versions
    const sessionId = await createTestSession();
    const templateId = await createTestTemplate();
    
    const projectId1 = await createTestProject(sessionId, templateId);
    const versionId1 = await createTestVersion(projectId1);
    
    const projectId2 = await createTestProject(sessionId, templateId);
    // Try to deploy project2 with version from project1

    const input: CreateDeploymentInput = {
      project_id: projectId2,
      version_id: versionId1 // This version belongs to project1, not project2
    };

    await expect(createDeployment(input)).rejects.toThrow(/Version .* does not belong to project/i);
  });

  it('should create multiple deployments for same project version', async () => {
    // Setup prerequisite data
    const sessionId = await createTestSession();
    const templateId = await createTestTemplate();
    const projectId = await createTestProject(sessionId, templateId);
    const versionId = await createTestVersion(projectId);

    const input: CreateDeploymentInput = {
      project_id: projectId,
      version_id: versionId,
      config: { attempt: 1 }
    };

    const deployment1 = await createDeployment(input);
    
    // Create second deployment for same version
    const input2: CreateDeploymentInput = {
      project_id: projectId,
      version_id: versionId,
      config: { attempt: 2 }
    };

    const deployment2 = await createDeployment(input2);

    // Both deployments should be created successfully
    expect(deployment1.id).not.toBe(deployment2.id);
    expect(deployment1.project_id).toBe(deployment2.project_id);
    expect(deployment1.version_id).toBe(deployment2.version_id);
    expect(deployment1.config).toEqual({ attempt: 1 });
    expect(deployment2.config).toEqual({ attempt: 2 });

    // Verify both are in database
    const allDeployments = await db.select()
      .from(deploymentsTable)
      .where(eq(deploymentsTable.project_id, projectId))
      .execute();

    expect(allDeployments).toHaveLength(2);
  });

  it('should handle complex config objects', async () => {
    // Setup prerequisite data
    const sessionId = await createTestSession();
    const templateId = await createTestTemplate();
    const projectId = await createTestProject(sessionId, templateId);
    const versionId = await createTestVersion(projectId);

    const complexConfig = {
      platform: 'netlify',
      environment: {
        NODE_ENV: 'production',
        API_URL: 'https://api.example.com',
        FEATURE_FLAGS: ['flag1', 'flag2']
      },
      build: {
        command: 'npm run build',
        output: 'build',
        functions: 'netlify/functions'
      },
      redirects: [
        { from: '/old-path', to: '/new-path', status: 301 },
        { from: '/api/*', to: '/.netlify/functions/api/:splat', status: 200 }
      ]
    };

    const input: CreateDeploymentInput = {
      project_id: projectId,
      version_id: versionId,
      config: complexConfig
    };

    const result = await createDeployment(input);

    // Verify complex config is preserved
    expect(result.config).toEqual(complexConfig);

    // Verify it's saved correctly in database
    const savedDeployments = await db.select()
      .from(deploymentsTable)
      .where(eq(deploymentsTable.id, result.id))
      .execute();

    expect(savedDeployments[0].config).toEqual(complexConfig);
  });
});