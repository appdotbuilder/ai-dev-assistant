import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { projectsTable, sessionsTable, collaborationsTable } from '../db/schema';
import { getProjects } from '../handlers/get_projects';

describe('getProjects', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when session has no projects', async () => {
    // Create a session with no projects
    await db.insert(sessionsTable).values({
      id: 'session1',
      browser_fingerprint: 'fingerprint1',
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }).execute();

    const result = await getProjects('session1');
    expect(result).toEqual([]);
  });

  it('should return projects owned by session', async () => {
    // Create session
    await db.insert(sessionsTable).values({
      id: 'session1',
      browser_fingerprint: 'fingerprint1',
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }).execute();

    // Create project owned by session
    await db.insert(projectsTable).values({
      id: 'project1',
      name: 'My React App',
      description: 'A React project',
      type: 'react',
      session_id: 'session1',
      created_at: new Date(),
      updated_at: new Date()
    }).execute();

    const result = await getProjects('session1');
    
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('project1');
    expect(result[0].name).toBe('My React App');
    expect(result[0].description).toBe('A React project');
    expect(result[0].type).toBe('react');
    expect(result[0].session_id).toBe('session1');
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
  });

  it('should return projects shared through collaboration', async () => {
    // Create two sessions
    await db.insert(sessionsTable).values([
      {
        id: 'owner_session',
        browser_fingerprint: 'fingerprint1',
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      },
      {
        id: 'collaborator_session',
        browser_fingerprint: 'fingerprint2',
        ip_address: '192.168.1.2',
        user_agent: 'Mozilla/5.0',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    ]).execute();

    // Create project owned by first session
    await db.insert(projectsTable).values({
      id: 'project1',
      name: 'Shared Project',
      description: 'A shared Vue project',
      type: 'vue',
      session_id: 'owner_session',
      created_at: new Date(),
      updated_at: new Date()
    }).execute();

    // Share project with second session
    await db.insert(collaborationsTable).values({
      id: 'collab1',
      project_id: 'project1',
      session_id: 'collaborator_session',
      role: 'editor',
      invited_at: new Date(),
      permissions: ['read', 'write']
    }).execute();

    // Get projects for collaborator session
    const result = await getProjects('collaborator_session');
    
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('project1');
    expect(result[0].name).toBe('Shared Project');
    expect(result[0].type).toBe('vue');
    expect(result[0].session_id).toBe('owner_session'); // Original owner
  });

  it('should return both owned and shared projects without duplicates', async () => {
    // Create sessions
    await db.insert(sessionsTable).values([
      {
        id: 'session1',
        browser_fingerprint: 'fingerprint1',
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      },
      {
        id: 'session2',
        browser_fingerprint: 'fingerprint2',
        ip_address: '192.168.1.2',
        user_agent: 'Mozilla/5.0',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    ]).execute();

    // Create projects
    await db.insert(projectsTable).values([
      {
        id: 'owned_project',
        name: 'Owned Project',
        description: 'Project owned by session1',
        type: 'react',
        session_id: 'session1',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'shared_project',
        name: 'Shared Project',
        description: 'Project shared with session1',
        type: 'node',
        session_id: 'session2',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]).execute();

    // Share second project with session1
    await db.insert(collaborationsTable).values({
      id: 'collab1',
      project_id: 'shared_project',
      session_id: 'session1',
      role: 'viewer',
      invited_at: new Date(),
      permissions: ['read']
    }).execute();

    const result = await getProjects('session1');
    
    expect(result).toHaveLength(2);
    
    const projectIds = result.map(p => p.id).sort();
    expect(projectIds).toEqual(['owned_project', 'shared_project']);
    
    const ownedProject = result.find(p => p.id === 'owned_project');
    expect(ownedProject?.name).toBe('Owned Project');
    expect(ownedProject?.session_id).toBe('session1');
    
    const sharedProject = result.find(p => p.id === 'shared_project');
    expect(sharedProject?.name).toBe('Shared Project');
    expect(sharedProject?.session_id).toBe('session2');
  });

  it('should handle projects with all optional fields populated', async () => {
    // Create session
    await db.insert(sessionsTable).values({
      id: 'session1',
      browser_fingerprint: 'fingerprint1',
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }).execute();

    // Create project with all fields
    await db.insert(projectsTable).values({
      id: 'project1',
      name: 'Full Project',
      description: 'A complete project',
      type: 'angular',
      template_id: 'template123',
      session_id: 'session1',
      created_at: new Date(),
      updated_at: new Date(),
      is_public: true,
      preview_url: 'https://preview.example.com',
      deployment_url: 'https://app.example.com'
    }).execute();

    const result = await getProjects('session1');
    
    expect(result).toHaveLength(1);
    expect(result[0].template_id).toBe('template123');
    expect(result[0].is_public).toBe(true);
    expect(result[0].preview_url).toBe('https://preview.example.com');
    expect(result[0].deployment_url).toBe('https://app.example.com');
  });

  it('should return projects for non-existent session', async () => {
    const result = await getProjects('non_existent_session');
    expect(result).toEqual([]);
  });

  it('should handle multiple collaborations on same project correctly', async () => {
    // Create sessions
    await db.insert(sessionsTable).values([
      {
        id: 'owner',
        browser_fingerprint: 'fingerprint1',
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      },
      {
        id: 'collaborator',
        browser_fingerprint: 'fingerprint2',
        ip_address: '192.168.1.2',
        user_agent: 'Mozilla/5.0',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      },
      {
        id: 'other_session',
        browser_fingerprint: 'fingerprint3',
        ip_address: '192.168.1.3',
        user_agent: 'Mozilla/5.0',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    ]).execute();

    // Create project
    await db.insert(projectsTable).values({
      id: 'project1',
      name: 'Multi-Collab Project',
      type: 'vanilla',
      session_id: 'owner',
      created_at: new Date(),
      updated_at: new Date()
    }).execute();

    // Add multiple collaborations (including one for our target session)
    await db.insert(collaborationsTable).values([
      {
        id: 'collab1',
        project_id: 'project1',
        session_id: 'collaborator',
        role: 'editor',
        invited_at: new Date(),
        permissions: ['read', 'write']
      },
      {
        id: 'collab2',
        project_id: 'project1',
        session_id: 'other_session',
        role: 'viewer',
        invited_at: new Date(),
        permissions: ['read']
      }
    ]).execute();

    const result = await getProjects('collaborator');
    
    // Should return only one instance of the project despite multiple collaborations
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('project1');
    expect(result[0].name).toBe('Multi-Collab Project');
  });
});