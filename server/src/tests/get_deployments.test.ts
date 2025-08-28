import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { deploymentsTable, projectsTable, versionsTable, sessionsTable } from '../db/schema';
import { getDeployments } from '../handlers/get_deployments';
// Generate simple test IDs without uuid dependency
const generateTestId = () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

describe('getDeployments', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no deployments exist for project', async () => {
    const projectId = generateTestId();
    
    const result = await getDeployments(projectId);
    
    expect(result).toEqual([]);
  });

  it('should fetch deployments for a specific project', async () => {
    // Create prerequisite session
    const sessionId = generateTestId();
    await db.insert(sessionsTable).values({
      id: sessionId,
      browser_fingerprint: 'test-fingerprint',
      ip_address: '127.0.0.1',
      user_agent: 'Test Agent',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    }).execute();

    // Create prerequisite project
    const projectId = generateTestId();
    await db.insert(projectsTable).values({
      id: projectId,
      name: 'Test Project',
      type: 'react',
      session_id: sessionId
    }).execute();

    // Create prerequisite version
    const versionId = generateTestId();
    await db.insert(versionsTable).values({
      id: versionId,
      project_id: projectId,
      commit_hash: 'abc123def456',
      message: 'Initial version',
      author: 'test-author',
      file_changes: []
    }).execute();

    // Create test deployments with slight delay to ensure proper ordering
    const deployment1Id = generateTestId();
    const deployedAt = new Date();
    
    // Create first deployment
    await db.insert(deploymentsTable).values({
      id: deployment1Id,
      project_id: projectId,
      version_id: versionId,
      status: 'deployed',
      url: 'https://example.com/app1',
      build_logs: 'Build successful',
      deployed_at: deployedAt,
      config: { environment: 'production' }
    }).execute();

    // Small delay to ensure different created_at timestamps
    await new Promise(resolve => setTimeout(resolve, 1));

    const deployment2Id = generateTestId();
    await db.insert(deploymentsTable).values({
      id: deployment2Id,
      project_id: projectId,
      version_id: versionId,
      status: 'pending',
      url: null,
      build_logs: null,
      deployed_at: null,
      config: { environment: 'staging' }
    }).execute();

    const result = await getDeployments(projectId);

    expect(result).toHaveLength(2);
    
    // Should be ordered by created_at desc (newest first)
    const firstDeployment = result[0];
    const secondDeployment = result[1];

    // Verify first deployment (newest - pending)
    expect(firstDeployment.id).toEqual(deployment2Id);
    expect(firstDeployment.project_id).toEqual(projectId);
    expect(firstDeployment.version_id).toEqual(versionId);
    expect(firstDeployment.status).toEqual('pending');
    expect(firstDeployment.url).toBeNull();
    expect(firstDeployment.build_logs).toBeNull();
    expect(firstDeployment.deployed_at).toBeNull();
    expect(firstDeployment.config).toEqual({ environment: 'staging' });
    expect(firstDeployment.created_at).toBeInstanceOf(Date);

    // Verify second deployment (older - deployed)
    expect(secondDeployment.id).toEqual(deployment1Id);
    expect(secondDeployment.project_id).toEqual(projectId);
    expect(secondDeployment.version_id).toEqual(versionId);
    expect(secondDeployment.status).toEqual('deployed');
    expect(secondDeployment.url).toEqual('https://example.com/app1');
    expect(secondDeployment.build_logs).toEqual('Build successful');
    expect(secondDeployment.deployed_at).toEqual(deployedAt);
    expect(secondDeployment.config).toEqual({ environment: 'production' });
    expect(secondDeployment.created_at).toBeInstanceOf(Date);
  });

  it('should only return deployments for the specified project', async () => {
    // Create prerequisite session
    const sessionId = generateTestId();
    await db.insert(sessionsTable).values({
      id: sessionId,
      browser_fingerprint: 'test-fingerprint',
      ip_address: '127.0.0.1',
      user_agent: 'Test Agent',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }).execute();

    // Create two projects
    const project1Id = generateTestId();
    const project2Id = generateTestId();
    await db.insert(projectsTable).values([
      {
        id: project1Id,
        name: 'Project 1',
        type: 'react',
        session_id: sessionId
      },
      {
        id: project2Id,
        name: 'Project 2',
        type: 'vue',
        session_id: sessionId
      }
    ]).execute();

    // Create versions for both projects
    const version1Id = generateTestId();
    const version2Id = generateTestId();
    await db.insert(versionsTable).values([
      {
        id: version1Id,
        project_id: project1Id,
        commit_hash: 'abc123',
        message: 'Version 1',
        author: 'test-author',
        file_changes: []
      },
      {
        id: version2Id,
        project_id: project2Id,
        commit_hash: 'def456',
        message: 'Version 2',
        author: 'test-author',
        file_changes: []
      }
    ]).execute();

    // Create deployments for both projects
    await db.insert(deploymentsTable).values([
      {
        id: generateTestId(),
        project_id: project1Id,
        version_id: version1Id,
        status: 'deployed',
        url: 'https://example.com/project1',
        build_logs: 'Project 1 build logs',
        deployed_at: new Date(),
        config: null
      },
      {
        id: generateTestId(),
        project_id: project2Id,
        version_id: version2Id,
        status: 'failed',
        url: null,
        build_logs: 'Project 2 failed logs',
        deployed_at: null,
        config: null
      }
    ]).execute();

    // Query deployments for project1 only
    const result = await getDeployments(project1Id);

    expect(result).toHaveLength(1);
    expect(result[0].project_id).toEqual(project1Id);
    expect(result[0].status).toEqual('deployed');
    expect(result[0].url).toEqual('https://example.com/project1');
    expect(result[0].build_logs).toEqual('Project 1 build logs');
  });

  it('should handle deployments with various status types', async () => {
    // Create prerequisite data
    const sessionId = generateTestId();
    await db.insert(sessionsTable).values({
      id: sessionId,
      browser_fingerprint: 'test-fingerprint',
      ip_address: '127.0.0.1',
      user_agent: 'Test Agent',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }).execute();

    const projectId = generateTestId();
    await db.insert(projectsTable).values({
      id: projectId,
      name: 'Test Project',
      type: 'node',
      session_id: sessionId
    }).execute();

    const versionId = generateTestId();
    await db.insert(versionsTable).values({
      id: versionId,
      project_id: projectId,
      commit_hash: 'abc123',
      message: 'Test version',
      author: 'test-author',
      file_changes: []
    }).execute();

    // Create deployments with different statuses
    await db.insert(deploymentsTable).values([
      {
        id: generateTestId(),
        project_id: projectId,
        version_id: versionId,
        status: 'pending',
        url: null,
        build_logs: null,
        deployed_at: null,
        config: null
      },
      {
        id: generateTestId(),
        project_id: projectId,
        version_id: versionId,
        status: 'building',
        url: null,
        build_logs: 'Starting build process...',
        deployed_at: null,
        config: { build_env: 'production' }
      },
      {
        id: generateTestId(),
        project_id: projectId,
        version_id: versionId,
        status: 'deployed',
        url: 'https://deployed.example.com',
        build_logs: 'Build completed successfully',
        deployed_at: new Date(),
        config: { cdn: 'cloudfront' }
      },
      {
        id: generateTestId(),
        project_id: projectId,
        version_id: versionId,
        status: 'failed',
        url: null,
        build_logs: 'Error: Build failed due to syntax error',
        deployed_at: null,
        config: null
      }
    ]).execute();

    const result = await getDeployments(projectId);

    expect(result).toHaveLength(4);
    
    // Verify we have all status types
    const statuses = result.map(d => d.status);
    expect(statuses).toContain('pending');
    expect(statuses).toContain('building');
    expect(statuses).toContain('deployed');
    expect(statuses).toContain('failed');

    // Find the deployed one and verify it has the expected fields
    const deployedDeployment = result.find(d => d.status === 'deployed');
    expect(deployedDeployment).toBeDefined();
    expect(deployedDeployment!.url).toEqual('https://deployed.example.com');
    expect(deployedDeployment!.build_logs).toEqual('Build completed successfully');
    expect(deployedDeployment!.deployed_at).toBeInstanceOf(Date);
    expect(deployedDeployment!.config).toEqual({ cdn: 'cloudfront' });

    // Find the failed one and verify it has error logs
    const failedDeployment = result.find(d => d.status === 'failed');
    expect(failedDeployment).toBeDefined();
    expect(failedDeployment!.url).toBeNull();
    expect(failedDeployment!.build_logs).toContain('Build failed');
    expect(failedDeployment!.deployed_at).toBeNull();
  });
});