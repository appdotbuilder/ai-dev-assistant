import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { versionsTable, projectsTable, sessionsTable } from '../db/schema';
import { getVersions } from '../handlers/get_versions';
import { eq } from 'drizzle-orm';

describe('getVersions', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when project has no versions', async () => {
    // Create session first (required for project)
    await db.insert(sessionsTable).values({
      id: 'session-1',
      browser_fingerprint: 'fingerprint-1',
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });

    // Create project without versions
    await db.insert(projectsTable).values({
      id: 'project-1',
      name: 'Test Project',
      type: 'react',
      session_id: 'session-1'
    });

    const result = await getVersions('project-1');

    expect(result).toEqual([]);
  });

  it('should return versions ordered by creation date descending', async () => {
    // Create session first (required for project)
    await db.insert(sessionsTable).values({
      id: 'session-1',
      browser_fingerprint: 'fingerprint-1',
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    // Create project
    await db.insert(projectsTable).values({
      id: 'project-1',
      name: 'Test Project',
      type: 'react',
      session_id: 'session-1'
    });

    // Create versions with different timestamps
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    await db.insert(versionsTable).values([
      {
        id: 'version-1',
        project_id: 'project-1',
        commit_hash: 'abc123',
        message: 'First commit',
        author: 'test-author',
        created_at: twoHoursAgo,
        file_changes: [
          {
            file_id: 'file-1',
            action: 'created',
            content_before: null,
            content_after: 'console.log("hello");'
          }
        ]
      },
      {
        id: 'version-2',
        project_id: 'project-1',
        commit_hash: 'def456',
        message: 'Second commit',
        author: 'test-author',
        created_at: oneHourAgo,
        file_changes: [
          {
            file_id: 'file-1',
            action: 'modified',
            content_before: 'console.log("hello");',
            content_after: 'console.log("hello world");'
          }
        ]
      },
      {
        id: 'version-3',
        project_id: 'project-1',
        commit_hash: 'ghi789',
        message: 'Latest commit',
        author: 'test-author',
        created_at: now,
        file_changes: [
          {
            file_id: 'file-2',
            action: 'created',
            content_before: null,
            content_after: 'const x = 1;'
          }
        ]
      }
    ]);

    const result = await getVersions('project-1');

    // Should return 3 versions ordered by creation date descending
    expect(result).toHaveLength(3);
    expect(result[0].id).toEqual('version-3'); // Latest first
    expect(result[1].id).toEqual('version-2'); // Middle
    expect(result[2].id).toEqual('version-1'); // Oldest last

    // Verify the ordering by timestamps
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[1].created_at).toBeInstanceOf(Date);
    expect(result[2].created_at).toBeInstanceOf(Date);
    expect(result[0].created_at.getTime()).toBeGreaterThan(result[1].created_at.getTime());
    expect(result[1].created_at.getTime()).toBeGreaterThan(result[2].created_at.getTime());
  });

  it('should return versions for correct project only', async () => {
    // Create sessions first
    await db.insert(sessionsTable).values([
      {
        id: 'session-1',
        browser_fingerprint: 'fingerprint-1',
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      },
      {
        id: 'session-2',
        browser_fingerprint: 'fingerprint-2',
        ip_address: '192.168.1.2',
        user_agent: 'Mozilla/5.0',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    ]);

    // Create two different projects
    await db.insert(projectsTable).values([
      {
        id: 'project-1',
        name: 'Test Project 1',
        type: 'react',
        session_id: 'session-1'
      },
      {
        id: 'project-2',
        name: 'Test Project 2',
        type: 'vue',
        session_id: 'session-2'
      }
    ]);

    // Create versions for both projects
    await db.insert(versionsTable).values([
      {
        id: 'version-1',
        project_id: 'project-1',
        commit_hash: 'abc123',
        message: 'Project 1 commit',
        author: 'author-1',
        file_changes: [{ file_id: 'file-1', action: 'created', content_before: null, content_after: 'code1' }]
      },
      {
        id: 'version-2',
        project_id: 'project-2',
        commit_hash: 'def456',
        message: 'Project 2 commit',
        author: 'author-2',
        file_changes: [{ file_id: 'file-2', action: 'created', content_before: null, content_after: 'code2' }]
      },
      {
        id: 'version-3',
        project_id: 'project-1',
        commit_hash: 'ghi789',
        message: 'Another Project 1 commit',
        author: 'author-1',
        file_changes: [{ file_id: 'file-3', action: 'created', content_before: null, content_after: 'code3' }]
      }
    ]);

    const result = await getVersions('project-1');

    // Should only return versions for project-1
    expect(result).toHaveLength(2);
    expect(result[0].project_id).toEqual('project-1');
    expect(result[1].project_id).toEqual('project-1');
    expect(result.some(v => v.id === 'version-2')).toBe(false); // Project 2 version should not be included
  });

  it('should return complete version data with proper structure', async () => {
    // Create session first
    await db.insert(sessionsTable).values({
      id: 'session-1',
      browser_fingerprint: 'fingerprint-1',
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    // Create project
    await db.insert(projectsTable).values({
      id: 'project-1',
      name: 'Test Project',
      type: 'react',
      session_id: 'session-1'
    });

    // Create version with complex file changes
    const fileChanges = [
      {
        file_id: 'file-1',
        action: 'created' as const,
        content_before: null,
        content_after: 'const hello = "world";'
      },
      {
        file_id: 'file-2',
        action: 'modified' as const,
        content_before: 'old content',
        content_after: 'new content'
      },
      {
        file_id: 'file-3',
        action: 'deleted' as const,
        content_before: 'deleted content',
        content_after: null
      }
    ];

    await db.insert(versionsTable).values({
      id: 'version-1',
      project_id: 'project-1',
      commit_hash: 'abc123def456',
      message: 'Complex changes commit',
      author: 'test-author@example.com',
      file_changes: fileChanges
    });

    const result = await getVersions('project-1');

    expect(result).toHaveLength(1);
    const version = result[0];

    // Verify all fields are present and correct
    expect(version.id).toEqual('version-1');
    expect(version.project_id).toEqual('project-1');
    expect(version.commit_hash).toEqual('abc123def456');
    expect(version.message).toEqual('Complex changes commit');
    expect(version.author).toEqual('test-author@example.com');
    expect(version.created_at).toBeInstanceOf(Date);
    expect(version.file_changes).toEqual(fileChanges);
  });

  it('should handle non-existent project', async () => {
    const result = await getVersions('non-existent-project');

    expect(result).toEqual([]);
  });

  it('should save versions to database correctly', async () => {
    // Create session first
    await db.insert(sessionsTable).values({
      id: 'session-1',
      browser_fingerprint: 'fingerprint-1',
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    // Create project
    await db.insert(projectsTable).values({
      id: 'project-1',
      name: 'Test Project',
      type: 'react',
      session_id: 'session-1'
    });

    // Create version
    await db.insert(versionsTable).values({
      id: 'version-1',
      project_id: 'project-1',
      commit_hash: 'abc123',
      message: 'Test commit',
      author: 'test-author',
      file_changes: [{ file_id: 'file-1', action: 'created', content_before: null, content_after: 'test' }]
    });

    // Call handler
    const result = await getVersions('project-1');

    // Verify data was retrieved from database correctly
    const dbVersion = await db.select()
      .from(versionsTable)
      .where(eq(versionsTable.id, 'version-1'))
      .execute();

    expect(dbVersion).toHaveLength(1);
    expect(result[0]).toEqual(dbVersion[0] as any);
  });
});