import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { projectsTable, sessionsTable } from '../db/schema';
import { type UpdateProjectInput } from '../schema';
import { updateProject } from '../handlers/update_project';
import { eq } from 'drizzle-orm';

describe('updateProject', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper to create a session for foreign key requirements
  const createTestSession = async () => {
    const sessionData = {
      id: 'test-session-id',
      browser_fingerprint: 'test-fingerprint',
      ip_address: '127.0.0.1',
      user_agent: 'test-agent',
      status: 'active' as const,
      created_at: new Date(),
      last_activity: new Date(),
      expires_at: new Date(Date.now() + 3600000), // 1 hour from now
      metadata: null
    };

    await db.insert(sessionsTable).values(sessionData).execute();
    return sessionData;
  };

  // Helper to create a test project
  const createTestProject = async (sessionId: string) => {
    const projectData = {
      id: 'test-project-id',
      name: 'Original Project',
      description: 'Original description',
      type: 'react' as const,
      template_id: null,
      session_id: sessionId,
      created_at: new Date(),
      updated_at: new Date(),
      is_public: false,
      preview_url: null,
      deployment_url: null
    };

    await db.insert(projectsTable).values(projectData).execute();
    return projectData;
  };

  it('should update project name', async () => {
    const session = await createTestSession();
    const project = await createTestProject(session.id);

    const updateInput: UpdateProjectInput = {
      id: project.id,
      name: 'Updated Project Name'
    };

    const result = await updateProject(updateInput);

    expect(result.id).toEqual(project.id);
    expect(result.name).toEqual('Updated Project Name');
    expect(result.description).toEqual(project.description);
    expect(result.is_public).toEqual(project.is_public);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > project.updated_at).toBe(true);
  });

  it('should update project description', async () => {
    const session = await createTestSession();
    const project = await createTestProject(session.id);

    const updateInput: UpdateProjectInput = {
      id: project.id,
      description: 'Updated description'
    };

    const result = await updateProject(updateInput);

    expect(result.id).toEqual(project.id);
    expect(result.name).toEqual(project.name);
    expect(result.description).toEqual('Updated description');
    expect(result.is_public).toEqual(project.is_public);
  });

  it('should update project description to null', async () => {
    const session = await createTestSession();
    const project = await createTestProject(session.id);

    const updateInput: UpdateProjectInput = {
      id: project.id,
      description: null
    };

    const result = await updateProject(updateInput);

    expect(result.description).toBeNull();
    expect(result.name).toEqual(project.name);
    expect(result.is_public).toEqual(project.is_public);
  });

  it('should update project visibility', async () => {
    const session = await createTestSession();
    const project = await createTestProject(session.id);

    const updateInput: UpdateProjectInput = {
      id: project.id,
      is_public: true
    };

    const result = await updateProject(updateInput);

    expect(result.id).toEqual(project.id);
    expect(result.name).toEqual(project.name);
    expect(result.description).toEqual(project.description);
    expect(result.is_public).toBe(true);
  });

  it('should update multiple fields simultaneously', async () => {
    const session = await createTestSession();
    const project = await createTestProject(session.id);

    const updateInput: UpdateProjectInput = {
      id: project.id,
      name: 'New Name',
      description: 'New description',
      is_public: true
    };

    const result = await updateProject(updateInput);

    expect(result.id).toEqual(project.id);
    expect(result.name).toEqual('New Name');
    expect(result.description).toEqual('New description');
    expect(result.is_public).toBe(true);
    expect(result.type).toEqual(project.type);
    expect(result.session_id).toEqual(project.session_id);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > project.updated_at).toBe(true);
  });

  it('should persist changes in database', async () => {
    const session = await createTestSession();
    const project = await createTestProject(session.id);

    const updateInput: UpdateProjectInput = {
      id: project.id,
      name: 'Persisted Name',
      description: 'Persisted description'
    };

    await updateProject(updateInput);

    // Verify changes are persisted by querying database directly
    const projects = await db.select()
      .from(projectsTable)
      .where(eq(projectsTable.id, project.id))
      .execute();

    expect(projects).toHaveLength(1);
    expect(projects[0].name).toEqual('Persisted Name');
    expect(projects[0].description).toEqual('Persisted description');
    expect(projects[0].updated_at).toBeInstanceOf(Date);
    expect(projects[0].updated_at > project.updated_at).toBe(true);
  });

  it('should update only updated_at when no other fields provided', async () => {
    const session = await createTestSession();
    const project = await createTestProject(session.id);

    const updateInput: UpdateProjectInput = {
      id: project.id
    };

    const result = await updateProject(updateInput);

    expect(result.id).toEqual(project.id);
    expect(result.name).toEqual(project.name);
    expect(result.description).toEqual(project.description);
    expect(result.is_public).toEqual(project.is_public);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > project.updated_at).toBe(true);
  });

  it('should throw error when project does not exist', async () => {
    const updateInput: UpdateProjectInput = {
      id: 'non-existent-project',
      name: 'Updated Name'
    };

    await expect(updateProject(updateInput)).rejects.toThrow(/not found/i);
  });

  it('should preserve unchanged fields', async () => {
    const session = await createTestSession();
    const project = await createTestProject(session.id);

    const updateInput: UpdateProjectInput = {
      id: project.id,
      name: 'Only Name Updated'
    };

    const result = await updateProject(updateInput);

    // Verify unchanged fields are preserved
    expect(result.type).toEqual(project.type);
    expect(result.template_id).toEqual(project.template_id);
    expect(result.session_id).toEqual(project.session_id);
    expect(result.created_at).toEqual(project.created_at);
    expect(result.preview_url).toEqual(project.preview_url);
    expect(result.deployment_url).toEqual(project.deployment_url);
  });
});