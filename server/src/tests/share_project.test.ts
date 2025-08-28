import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { projectsTable, sessionsTable, collaborationsTable } from '../db/schema';
import { type ShareProjectInput } from '../schema';
import { shareProject } from '../handlers/share_project';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Test session data
const testSession = {
  id: randomUUID(),
  browser_fingerprint: 'test-fingerprint',
  ip_address: '192.168.1.1',
  user_agent: 'Test Agent',
  status: 'active' as const,
  expires_at: new Date(Date.now() + 86400000) // 24 hours from now
};

// Test project data
const testProject = {
  id: randomUUID(),
  name: 'Test Project',
  description: 'A test project for sharing',
  type: 'react' as const,
  template_id: null,
  session_id: testSession.id,
  is_public: false,
  preview_url: null,
  deployment_url: null
};

// Test collaboration session data
const testCollabSession = {
  id: randomUUID(),
  browser_fingerprint: 'collab-fingerprint',
  ip_address: '192.168.1.2',
  user_agent: 'Collab Agent',
  status: 'active' as const,
  expires_at: new Date(Date.now() + 86400000)
};

// Test input
const testInput: ShareProjectInput = {
  project_id: testProject.id,
  session_id: testCollabSession.id,
  role: 'editor'
};

describe('shareProject', () => {
  beforeEach(async () => {
    await createDB();
    
    // Create prerequisite session and project
    await db.insert(sessionsTable)
      .values([testSession, testCollabSession])
      .execute();
    
    await db.insert(projectsTable)
      .values(testProject)
      .execute();
  });
  
  afterEach(resetDB);

  it('should create a collaboration with default editor permissions', async () => {
    const result = await shareProject(testInput);

    // Verify basic fields
    expect(result.project_id).toEqual(testProject.id);
    expect(result.session_id).toEqual(testCollabSession.id);
    expect(result.role).toEqual('editor');
    expect(result.id).toBeDefined();
    expect(result.invited_at).toBeInstanceOf(Date);
    expect(result.last_active).toBeNull();
    expect(result.permissions).toEqual(['read', 'write']);
  });

  it('should create collaboration with custom permissions', async () => {
    const customInput = {
      ...testInput,
      permissions: ['read', 'write', 'share']
    };

    const result = await shareProject(customInput);

    expect(result.permissions).toEqual(['read', 'write', 'share']);
    expect(result.role).toEqual('editor');
  });

  it('should create collaboration with owner role and default permissions', async () => {
    const ownerInput = {
      ...testInput,
      role: 'owner' as const
    };

    const result = await shareProject(ownerInput);

    expect(result.role).toEqual('owner');
    expect(result.permissions).toEqual(['read', 'write', 'delete', 'share', 'deploy']);
  });

  it('should create collaboration with viewer role and default permissions', async () => {
    const viewerInput = {
      ...testInput,
      role: 'viewer' as const
    };

    const result = await shareProject(viewerInput);

    expect(result.role).toEqual('viewer');
    expect(result.permissions).toEqual(['read']);
  });

  it('should save collaboration to database', async () => {
    const result = await shareProject(testInput);

    // Query database to verify record was saved
    const collaborations = await db.select()
      .from(collaborationsTable)
      .where(eq(collaborationsTable.id, result.id))
      .execute();

    expect(collaborations).toHaveLength(1);
    expect(collaborations[0].project_id).toEqual(testProject.id);
    expect(collaborations[0].session_id).toEqual(testCollabSession.id);
    expect(collaborations[0].role).toEqual('editor');
    expect(collaborations[0].invited_at).toBeInstanceOf(Date);
  });

  it('should throw error when project does not exist', async () => {
    const invalidInput = {
      ...testInput,
      project_id: randomUUID()
    };

    await expect(shareProject(invalidInput)).rejects.toThrow(/project not found/i);
  });

  it('should throw error when session does not exist', async () => {
    const invalidInput = {
      ...testInput,
      session_id: randomUUID()
    };

    await expect(shareProject(invalidInput)).rejects.toThrow(/session not found/i);
  });

  it('should throw error when collaboration already exists', async () => {
    // Create first collaboration
    await shareProject(testInput);

    // Try to create duplicate collaboration
    await expect(shareProject(testInput)).rejects.toThrow(/collaboration already exists/i);
  });

  it('should allow same project to be shared with different sessions', async () => {
    // Create another session
    const anotherSession = {
      id: randomUUID(),
      browser_fingerprint: 'another-fingerprint',
      ip_address: '192.168.1.3',
      user_agent: 'Another Agent',
      status: 'active' as const,
      expires_at: new Date(Date.now() + 86400000)
    };

    await db.insert(sessionsTable)
      .values(anotherSession)
      .execute();

    // Share with first session
    await shareProject(testInput);

    // Share with second session
    const secondInput = {
      ...testInput,
      session_id: anotherSession.id,
      role: 'viewer' as const
    };

    const result = await shareProject(secondInput);

    expect(result.session_id).toEqual(anotherSession.id);
    expect(result.role).toEqual('viewer');

    // Verify both collaborations exist in database
    const collaborations = await db.select()
      .from(collaborationsTable)
      .where(eq(collaborationsTable.project_id, testProject.id))
      .execute();

    expect(collaborations).toHaveLength(2);
  });

  it('should allow same session to collaborate on different projects', async () => {
    // Create another project
    const anotherProject = {
      id: randomUUID(),
      name: 'Another Project',
      description: 'Another test project',
      type: 'vue' as const,
      template_id: null,
      session_id: testSession.id,
      is_public: false,
      preview_url: null,
      deployment_url: null
    };

    await db.insert(projectsTable)
      .values(anotherProject)
      .execute();

    // Share first project
    await shareProject(testInput);

    // Share second project with same session
    const secondInput = {
      ...testInput,
      project_id: anotherProject.id,
      role: 'owner' as const
    };

    const result = await shareProject(secondInput);

    expect(result.project_id).toEqual(anotherProject.id);
    expect(result.role).toEqual('owner');

    // Verify both collaborations exist for the session
    const collaborations = await db.select()
      .from(collaborationsTable)
      .where(eq(collaborationsTable.session_id, testCollabSession.id))
      .execute();

    expect(collaborations).toHaveLength(2);
  });
});