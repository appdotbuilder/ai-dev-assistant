import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { collaborationsTable, projectsTable, sessionsTable } from '../db/schema';
import { getCollaborations } from '../handlers/get_collaborations';

describe('getCollaborations', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return collaborations for a project', async () => {
    // Create test session
    const sessionId = 'test-session-1';
    await db.insert(sessionsTable).values({
      id: sessionId,
      browser_fingerprint: 'test-fingerprint',
      ip_address: '127.0.0.1',
      user_agent: 'test-agent',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    }).execute();

    // Create test project
    const projectId = 'test-project-1';
    await db.insert(projectsTable).values({
      id: projectId,
      name: 'Test Project',
      type: 'react',
      session_id: sessionId
    }).execute();

    // Create test collaboration
    const collaborationId = 'test-collab-1';
    await db.insert(collaborationsTable).values({
      id: collaborationId,
      project_id: projectId,
      session_id: sessionId,
      role: 'editor',
      permissions: ['read', 'write']
    }).execute();

    const result = await getCollaborations(projectId);

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(collaborationId);
    expect(result[0].project_id).toEqual(projectId);
    expect(result[0].session_id).toEqual(sessionId);
    expect(result[0].role).toEqual('editor');
    expect(result[0].permissions).toEqual(['read', 'write']);
    expect(result[0].invited_at).toBeInstanceOf(Date);
  });

  it('should return multiple collaborations for a project', async () => {
    // Create test sessions
    const sessionId1 = 'test-session-1';
    const sessionId2 = 'test-session-2';
    
    await db.insert(sessionsTable).values([
      {
        id: sessionId1,
        browser_fingerprint: 'test-fingerprint-1',
        ip_address: '127.0.0.1',
        user_agent: 'test-agent-1',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      },
      {
        id: sessionId2,
        browser_fingerprint: 'test-fingerprint-2',
        ip_address: '127.0.0.2',
        user_agent: 'test-agent-2',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    ]).execute();

    // Create test project
    const projectId = 'test-project-1';
    await db.insert(projectsTable).values({
      id: projectId,
      name: 'Test Project',
      type: 'react',
      session_id: sessionId1
    }).execute();

    // Create multiple collaborations
    await db.insert(collaborationsTable).values([
      {
        id: 'collab-1',
        project_id: projectId,
        session_id: sessionId1,
        role: 'owner',
        permissions: ['read', 'write', 'admin']
      },
      {
        id: 'collab-2',
        project_id: projectId,
        session_id: sessionId2,
        role: 'viewer',
        permissions: ['read']
      }
    ]).execute();

    const result = await getCollaborations(projectId);

    expect(result).toHaveLength(2);
    
    const ownerCollab = result.find(c => c.role === 'owner');
    const viewerCollab = result.find(c => c.role === 'viewer');
    
    expect(ownerCollab).toBeDefined();
    expect(ownerCollab?.permissions).toEqual(['read', 'write', 'admin']);
    expect(ownerCollab?.session_id).toEqual(sessionId1);
    
    expect(viewerCollab).toBeDefined();
    expect(viewerCollab?.permissions).toEqual(['read']);
    expect(viewerCollab?.session_id).toEqual(sessionId2);
  });

  it('should return empty array for project with no collaborations', async () => {
    // Create test session and project but no collaborations
    const sessionId = 'test-session-1';
    await db.insert(sessionsTable).values({
      id: sessionId,
      browser_fingerprint: 'test-fingerprint',
      ip_address: '127.0.0.1',
      user_agent: 'test-agent',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }).execute();

    const projectId = 'test-project-1';
    await db.insert(projectsTable).values({
      id: projectId,
      name: 'Test Project',
      type: 'react',
      session_id: sessionId
    }).execute();

    const result = await getCollaborations(projectId);

    expect(result).toHaveLength(0);
  });

  it('should return empty array for non-existent project', async () => {
    const result = await getCollaborations('non-existent-project');

    expect(result).toHaveLength(0);
  });

  it('should handle collaborations with null last_active', async () => {
    // Create test session
    const sessionId = 'test-session-1';
    await db.insert(sessionsTable).values({
      id: sessionId,
      browser_fingerprint: 'test-fingerprint',
      ip_address: '127.0.0.1',
      user_agent: 'test-agent',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }).execute();

    // Create test project
    const projectId = 'test-project-1';
    await db.insert(projectsTable).values({
      id: projectId,
      name: 'Test Project',
      type: 'react',
      session_id: sessionId
    }).execute();

    // Create collaboration with null last_active (new collaboration)
    await db.insert(collaborationsTable).values({
      id: 'test-collab-1',
      project_id: projectId,
      session_id: sessionId,
      role: 'editor',
      permissions: ['read', 'write'],
      last_active: null
    }).execute();

    const result = await getCollaborations(projectId);

    expect(result).toHaveLength(1);
    expect(result[0].last_active).toBeNull();
  });

  it('should only return collaborations for the specified project', async () => {
    // Create test sessions
    const sessionId1 = 'test-session-1';
    const sessionId2 = 'test-session-2';
    
    await db.insert(sessionsTable).values([
      {
        id: sessionId1,
        browser_fingerprint: 'test-fingerprint-1',
        ip_address: '127.0.0.1',
        user_agent: 'test-agent-1',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      },
      {
        id: sessionId2,
        browser_fingerprint: 'test-fingerprint-2',
        ip_address: '127.0.0.2',
        user_agent: 'test-agent-2',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    ]).execute();

    // Create two different projects
    const projectId1 = 'test-project-1';
    const projectId2 = 'test-project-2';
    
    await db.insert(projectsTable).values([
      {
        id: projectId1,
        name: 'Test Project 1',
        type: 'react',
        session_id: sessionId1
      },
      {
        id: projectId2,
        name: 'Test Project 2',
        type: 'vue',
        session_id: sessionId2
      }
    ]).execute();

    // Create collaborations for both projects
    await db.insert(collaborationsTable).values([
      {
        id: 'collab-1',
        project_id: projectId1,
        session_id: sessionId1,
        role: 'owner',
        permissions: ['read', 'write', 'admin']
      },
      {
        id: 'collab-2',
        project_id: projectId2,
        session_id: sessionId2,
        role: 'editor',
        permissions: ['read', 'write']
      }
    ]).execute();

    // Query for project1 collaborations only
    const result = await getCollaborations(projectId1);

    expect(result).toHaveLength(1);
    expect(result[0].project_id).toEqual(projectId1);
    expect(result[0].role).toEqual('owner');
  });
});