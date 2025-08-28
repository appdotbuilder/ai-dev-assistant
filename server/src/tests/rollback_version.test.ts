import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { projectsTable, sessionsTable, filesTable, versionsTable } from '../db/schema';
import { rollbackVersion } from '../handlers/rollback_version';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

describe('rollbackVersion', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const createTestSession = async () => {
    const sessionId = randomUUID();
    await db.insert(sessionsTable)
      .values({
        id: sessionId,
        browser_fingerprint: 'test-fingerprint',
        ip_address: '127.0.0.1',
        user_agent: 'test-agent',
        status: 'active',
        created_at: new Date(),
        last_activity: new Date(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        metadata: null
      })
      .execute();
    return sessionId;
  };

  const createTestProject = async (sessionId: string) => {
    const projectId = randomUUID();
    await db.insert(projectsTable)
      .values({
        id: projectId,
        name: 'Test Project',
        description: 'A test project',
        type: 'react',
        template_id: null,
        session_id: sessionId,
        created_at: new Date(),
        updated_at: new Date(),
        is_public: false,
        preview_url: null,
        deployment_url: null
      })
      .execute();
    return projectId;
  };

  const createTestFile = async (projectId: string, fileId: string, content: string = 'initial content') => {
    await db.insert(filesTable)
      .values({
        id: fileId,
        project_id: projectId,
        name: 'test.js',
        path: '/test.js',
        content: content,
        type: 'js',
        size: content.length,
        created_at: new Date(),
        updated_at: new Date(),
        is_deleted: false
      })
      .execute();
  };

  const createTestVersion = async (projectId: string, fileChanges: any[]) => {
    const versionId = randomUUID();
    await db.insert(versionsTable)
      .values({
        id: versionId,
        project_id: projectId,
        commit_hash: `commit-${Date.now()}`,
        message: 'Test version',
        author: 'test-author',
        created_at: new Date(),
        file_changes: fileChanges
      })
      .execute();
    return versionId;
  };

  it('should rollback file modifications successfully', async () => {
    const sessionId = await createTestSession();
    const projectId = await createTestProject(sessionId);
    const fileId = randomUUID();

    // Create initial file
    await createTestFile(projectId, fileId, 'original content');

    // Create a version that modified the file
    const versionId = await createTestVersion(projectId, [
      {
        file_id: fileId,
        action: 'modified',
        content_before: 'original content',
        content_after: 'modified content'
      }
    ]);

    // Update file to modified state
    await db.update(filesTable)
      .set({ 
        content: 'modified content',
        size: 'modified content'.length,
        updated_at: new Date()
      })
      .where(eq(filesTable.id, fileId))
      .execute();

    // Rollback to the version
    const result = await rollbackVersion(projectId, versionId, sessionId);

    expect(result).toBe(true);

    // Verify file content was rolled back
    const files = await db.select()
      .from(filesTable)
      .where(eq(filesTable.id, fileId))
      .execute();

    expect(files).toHaveLength(1);
    expect(files[0].content).toBe('original content');
    expect(files[0].size).toBe('original content'.length);
  });

  it('should rollback file creation by marking file as deleted', async () => {
    const sessionId = await createTestSession();
    const projectId = await createTestProject(sessionId);
    const fileId = randomUUID();

    // Create file
    await createTestFile(projectId, fileId, 'new file content');

    // Create version that represents file creation
    const versionId = await createTestVersion(projectId, [
      {
        file_id: fileId,
        action: 'created',
        content_before: null,
        content_after: 'new file content'
      }
    ]);

    // Rollback the creation
    const result = await rollbackVersion(projectId, versionId, sessionId);

    expect(result).toBe(true);

    // Verify file is marked as deleted
    const files = await db.select()
      .from(filesTable)
      .where(eq(filesTable.id, fileId))
      .execute();

    expect(files).toHaveLength(1);
    expect(files[0].is_deleted).toBe(true);
  });

  it('should rollback file deletion by restoring file', async () => {
    const sessionId = await createTestSession();
    const projectId = await createTestProject(sessionId);
    const fileId = randomUUID();

    // Create file first
    await createTestFile(projectId, fileId, 'content to restore');

    // Mark file as deleted
    await db.update(filesTable)
      .set({ is_deleted: true })
      .where(eq(filesTable.id, fileId))
      .execute();

    // Create version that represents file deletion
    const versionId = await createTestVersion(projectId, [
      {
        file_id: fileId,
        action: 'deleted',
        content_before: 'content to restore',
        content_after: null
      }
    ]);

    // Rollback the deletion
    const result = await rollbackVersion(projectId, versionId, sessionId);

    expect(result).toBe(true);

    // Verify file is restored
    const files = await db.select()
      .from(filesTable)
      .where(eq(filesTable.id, fileId))
      .execute();

    expect(files).toHaveLength(1);
    expect(files[0].is_deleted).toBe(false);
    expect(files[0].content).toBe('content to restore');
  });

  it('should create new rollback version entry', async () => {
    const sessionId = await createTestSession();
    const projectId = await createTestProject(sessionId);
    const fileId = randomUUID();

    await createTestFile(projectId, fileId, 'original content');

    const versionId = await createTestVersion(projectId, [
      {
        file_id: fileId,
        action: 'modified',
        content_before: 'original content',
        content_after: 'modified content'
      }
    ]);

    const initialVersionCount = await db.select()
      .from(versionsTable)
      .where(eq(versionsTable.project_id, projectId))
      .execute();

    await rollbackVersion(projectId, versionId, sessionId);

    // Verify new rollback version was created
    const finalVersionCount = await db.select()
      .from(versionsTable)
      .where(eq(versionsTable.project_id, projectId))
      .execute();

    expect(finalVersionCount).toHaveLength(initialVersionCount.length + 1);

    // Find the rollback version
    const rollbackVersions = finalVersionCount.filter(v => 
      v.message.startsWith('Rollback to version:') && v.author === 'system'
    );

    expect(rollbackVersions).toHaveLength(1);
    expect(rollbackVersions[0].message).toBe('Rollback to version: Test version');
  });

  it('should update project updated_at timestamp', async () => {
    const sessionId = await createTestSession();
    const projectId = await createTestProject(sessionId);
    const fileId = randomUUID();

    await createTestFile(projectId, fileId);

    const versionId = await createTestVersion(projectId, [
      {
        file_id: fileId,
        action: 'modified',
        content_before: 'original',
        content_after: 'modified'
      }
    ]);

    const initialProject = await db.select()
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId))
      .execute();

    const initialUpdatedAt = initialProject[0].updated_at;

    // Wait a bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    await rollbackVersion(projectId, versionId, sessionId);

    const updatedProject = await db.select()
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId))
      .execute();

    expect(updatedProject[0].updated_at > initialUpdatedAt).toBe(true);
  });

  it('should handle multiple file changes in single rollback', async () => {
    const sessionId = await createTestSession();
    const projectId = await createTestProject(sessionId);
    const fileId1 = randomUUID();
    const fileId2 = randomUUID();

    // Create two files
    await createTestFile(projectId, fileId1, 'file1 original');
    await createTestFile(projectId, fileId2, 'file2 original');

    // Create version with changes to both files
    const versionId = await createTestVersion(projectId, [
      {
        file_id: fileId1,
        action: 'modified',
        content_before: 'file1 original',
        content_after: 'file1 modified'
      },
      {
        file_id: fileId2,
        action: 'modified',
        content_before: 'file2 original',
        content_after: 'file2 modified'
      }
    ]);

    // Update both files
    await db.update(filesTable)
      .set({ content: 'file1 modified', size: 'file1 modified'.length })
      .where(eq(filesTable.id, fileId1))
      .execute();

    await db.update(filesTable)
      .set({ content: 'file2 modified', size: 'file2 modified'.length })
      .where(eq(filesTable.id, fileId2))
      .execute();

    const result = await rollbackVersion(projectId, versionId, sessionId);

    expect(result).toBe(true);

    // Verify both files were rolled back
    const files = await db.select()
      .from(filesTable)
      .where(eq(filesTable.project_id, projectId))
      .execute();

    const file1 = files.find(f => f.id === fileId1);
    const file2 = files.find(f => f.id === fileId2);

    expect(file1?.content).toBe('file1 original');
    expect(file2?.content).toBe('file2 original');
  });

  it('should throw error for non-existent project', async () => {
    const sessionId = await createTestSession();
    const nonExistentProjectId = randomUUID();
    const versionId = randomUUID();

    expect(rollbackVersion(nonExistentProjectId, versionId, sessionId))
      .rejects.toThrow(/project not found or access denied/i);
  });

  it('should throw error for wrong session', async () => {
    const sessionId1 = await createTestSession();
    const sessionId2 = await createTestSession();
    const projectId = await createTestProject(sessionId1);
    const versionId = randomUUID();

    expect(rollbackVersion(projectId, versionId, sessionId2))
      .rejects.toThrow(/project not found or access denied/i);
  });

  it('should throw error for non-existent version', async () => {
    const sessionId = await createTestSession();
    const projectId = await createTestProject(sessionId);
    const nonExistentVersionId = randomUUID();

    expect(rollbackVersion(projectId, nonExistentVersionId, sessionId))
      .rejects.toThrow(/version not found/i);
  });

  it('should throw error for version from different project', async () => {
    const sessionId = await createTestSession();
    const projectId1 = await createTestProject(sessionId);
    const projectId2 = await createTestProject(sessionId);
    const fileId = randomUUID();

    await createTestFile(projectId1, fileId);

    // Create version for project1
    const versionId = await createTestVersion(projectId1, [
      {
        file_id: fileId,
        action: 'modified',
        content_before: 'original',
        content_after: 'modified'
      }
    ]);

    // Try to rollback project2 using project1's version
    expect(rollbackVersion(projectId2, versionId, sessionId))
      .rejects.toThrow(/version not found/i);
  });
});