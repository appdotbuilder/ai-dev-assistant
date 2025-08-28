import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  projectsTable, 
  filesTable, 
  sessionsTable, 
  aiChatsTable, 
  versionsTable, 
  collaborationsTable, 
  deploymentsTable 
} from '../db/schema';
import { deleteProject } from '../handlers/delete_project';
import { eq } from 'drizzle-orm';

const testSessionId = 'test-session-123';
const testProjectId = 'test-project-456';
const otherSessionId = 'other-session-789';
const otherProjectId = 'other-project-101';

describe('deleteProject', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  async function createTestData() {
    // Create test sessions
    await db.insert(sessionsTable).values([
      {
        id: testSessionId,
        browser_fingerprint: 'test-fingerprint',
        ip_address: '127.0.0.1',
        user_agent: 'test-agent',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      },
      {
        id: otherSessionId,
        browser_fingerprint: 'other-fingerprint',
        ip_address: '127.0.0.2',
        user_agent: 'other-agent',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    ]).execute();

    // Create test projects
    await db.insert(projectsTable).values([
      {
        id: testProjectId,
        name: 'Test Project',
        type: 'react',
        session_id: testSessionId
      },
      {
        id: otherProjectId,
        name: 'Other Project',
        type: 'vanilla',
        session_id: otherSessionId
      }
    ]).execute();

    // Create test files
    await db.insert(filesTable).values([
      {
        id: 'file-1',
        project_id: testProjectId,
        name: 'index.js',
        path: '/src/index.js',
        content: 'console.log("test");',
        type: 'js',
        size: 20
      },
      {
        id: 'file-2',
        project_id: testProjectId,
        name: 'style.css',
        path: '/src/style.css',
        content: 'body { margin: 0; }',
        type: 'css',
        size: 18
      },
      {
        id: 'file-3',
        project_id: otherProjectId,
        name: 'other.js',
        path: '/other.js',
        content: 'console.log("other");',
        type: 'js',
        size: 21
      }
    ]).execute();

    // Create test AI chats
    await db.insert(aiChatsTable).values([
      {
        id: 'chat-1',
        session_id: testSessionId,
        project_id: testProjectId,
        message: 'Help me with this code',
        response: 'Here is some help',
        model: 'gpt-4',
        tokens_used: 50
      },
      {
        id: 'chat-2',
        session_id: otherSessionId,
        project_id: otherProjectId,
        message: 'Other chat',
        response: 'Other response',
        model: 'claude-3',
        tokens_used: 30
      }
    ]).execute();

    // Create test versions
    await db.insert(versionsTable).values([
      {
        id: 'version-1',
        project_id: testProjectId,
        commit_hash: 'abc123',
        message: 'Initial commit',
        author: 'test-author',
        file_changes: []
      }
    ]).execute();

    // Create test collaborations
    await db.insert(collaborationsTable).values([
      {
        id: 'collab-1',
        project_id: testProjectId,
        session_id: otherSessionId,
        role: 'viewer',
        permissions: ['read']
      }
    ]).execute();

    // Create test deployments
    await db.insert(deploymentsTable).values([
      {
        id: 'deploy-1',
        project_id: testProjectId,
        version_id: 'version-1',
        status: 'deployed'
      }
    ]).execute();
  }

  it('should successfully delete project and all related data when owner', async () => {
    await createTestData();

    const result = await deleteProject(testProjectId, testSessionId);

    expect(result).toBe(true);

    // Verify project is deleted
    const projects = await db.select()
      .from(projectsTable)
      .where(eq(projectsTable.id, testProjectId))
      .execute();
    expect(projects).toHaveLength(0);

    // Verify files are soft deleted
    const files = await db.select()
      .from(filesTable)
      .where(eq(filesTable.project_id, testProjectId))
      .execute();
    expect(files).toHaveLength(2);
    files.forEach(file => {
      expect(file.is_deleted).toBe(true);
    });

    // Verify AI chats are deleted
    const chats = await db.select()
      .from(aiChatsTable)
      .where(eq(aiChatsTable.project_id, testProjectId))
      .execute();
    expect(chats).toHaveLength(0);

    // Verify versions are deleted
    const versions = await db.select()
      .from(versionsTable)
      .where(eq(versionsTable.project_id, testProjectId))
      .execute();
    expect(versions).toHaveLength(0);

    // Verify collaborations are deleted
    const collaborations = await db.select()
      .from(collaborationsTable)
      .where(eq(collaborationsTable.project_id, testProjectId))
      .execute();
    expect(collaborations).toHaveLength(0);

    // Verify deployments are deleted
    const deployments = await db.select()
      .from(deploymentsTable)
      .where(eq(deploymentsTable.project_id, testProjectId))
      .execute();
    expect(deployments).toHaveLength(0);
  });

  it('should not delete project if session does not own it', async () => {
    await createTestData();

    // Try to delete test project with other session ID
    const result = await deleteProject(testProjectId, otherSessionId);

    expect(result).toBe(false);

    // Verify project still exists
    const projects = await db.select()
      .from(projectsTable)
      .where(eq(projectsTable.id, testProjectId))
      .execute();
    expect(projects).toHaveLength(1);

    // Verify files are not soft deleted
    const files = await db.select()
      .from(filesTable)
      .where(eq(filesTable.project_id, testProjectId))
      .execute();
    expect(files).toHaveLength(2);
    files.forEach(file => {
      expect(file.is_deleted).toBe(false);
    });

    // Verify other data still exists
    const chats = await db.select()
      .from(aiChatsTable)
      .where(eq(aiChatsTable.project_id, testProjectId))
      .execute();
    expect(chats).toHaveLength(1);
  });

  it('should return false when project does not exist', async () => {
    await createTestData();

    const result = await deleteProject('non-existent-project', testSessionId);

    expect(result).toBe(false);

    // Verify other projects are unaffected
    const projects = await db.select()
      .from(projectsTable)
      .execute();
    expect(projects).toHaveLength(2);
  });

  it('should not affect other projects when deleting one project', async () => {
    await createTestData();

    const result = await deleteProject(testProjectId, testSessionId);

    expect(result).toBe(true);

    // Verify other project and its data remain untouched
    const otherProjects = await db.select()
      .from(projectsTable)
      .where(eq(projectsTable.id, otherProjectId))
      .execute();
    expect(otherProjects).toHaveLength(1);

    const otherFiles = await db.select()
      .from(filesTable)
      .where(eq(filesTable.project_id, otherProjectId))
      .execute();
    expect(otherFiles).toHaveLength(1);
    expect(otherFiles[0].is_deleted).toBe(false);

    const otherChats = await db.select()
      .from(aiChatsTable)
      .where(eq(aiChatsTable.project_id, otherProjectId))
      .execute();
    expect(otherChats).toHaveLength(1);
  });

  it('should handle project with no associated files or data', async () => {
    // Create minimal test data
    await db.insert(sessionsTable).values({
      id: testSessionId,
      browser_fingerprint: 'test-fingerprint',
      ip_address: '127.0.0.1',
      user_agent: 'test-agent',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }).execute();

    await db.insert(projectsTable).values({
      id: testProjectId,
      name: 'Empty Project',
      type: 'react',
      session_id: testSessionId
    }).execute();

    const result = await deleteProject(testProjectId, testSessionId);

    expect(result).toBe(true);

    // Verify project is deleted
    const projects = await db.select()
      .from(projectsTable)
      .where(eq(projectsTable.id, testProjectId))
      .execute();
    expect(projects).toHaveLength(0);
  });

  it('should update file timestamps when soft deleting', async () => {
    await createTestData();

    const beforeDelete = new Date();
    await new Promise(resolve => setTimeout(resolve, 10)); // Small delay

    const result = await deleteProject(testProjectId, testSessionId);

    expect(result).toBe(true);

    const files = await db.select()
      .from(filesTable)
      .where(eq(filesTable.project_id, testProjectId))
      .execute();

    files.forEach(file => {
      expect(file.is_deleted).toBe(true);
      expect(file.updated_at.getTime()).toBeGreaterThan(beforeDelete.getTime());
    });
  });
});