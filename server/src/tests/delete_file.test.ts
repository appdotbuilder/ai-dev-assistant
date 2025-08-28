import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { filesTable, projectsTable, sessionsTable } from '../db/schema';
import { deleteFile } from '../handlers/delete_file';
import { eq } from 'drizzle-orm';

const testSession = {
  id: 'test-session-1',
  browser_fingerprint: 'test-fingerprint',
  ip_address: '127.0.0.1',
  user_agent: 'test-agent',
  status: 'active' as const,
  expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
};

const testProject = {
  id: 'test-project-1',
  name: 'Test Project',
  description: 'A test project',
  type: 'react' as const,
  template_id: null,
  session_id: testSession.id,
  is_public: false,
  preview_url: null,
  deployment_url: null
};

const testFile = {
  id: 'test-file-1',
  project_id: testProject.id,
  name: 'test.js',
  path: '/src/test.js',
  content: 'console.log("test");',
  type: 'js' as const,
  size: 20,
  is_deleted: false
};

describe('deleteFile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should successfully delete a file', async () => {
    // Setup test data
    await db.insert(sessionsTable).values(testSession).execute();
    await db.insert(projectsTable).values(testProject).execute();
    await db.insert(filesTable).values(testFile).execute();

    // Delete the file
    const result = await deleteFile(testFile.id, testSession.id);

    // Verify deletion was successful
    expect(result).toBe(true);

    // Verify file is marked as deleted in database
    const deletedFile = await db.select()
      .from(filesTable)
      .where(eq(filesTable.id, testFile.id))
      .execute();

    expect(deletedFile).toHaveLength(1);
    expect(deletedFile[0].is_deleted).toBe(true);
    expect(deletedFile[0].updated_at).toBeInstanceOf(Date);
  });

  it('should throw error when file does not exist', async () => {
    // Setup session only
    await db.insert(sessionsTable).values(testSession).execute();

    // Try to delete non-existent file
    await expect(deleteFile('non-existent-file', testSession.id))
      .rejects.toThrow(/File not found/i);
  });

  it('should throw error when session does not own the file', async () => {
    // Setup test data
    await db.insert(sessionsTable).values(testSession).execute();
    await db.insert(projectsTable).values(testProject).execute();
    await db.insert(filesTable).values(testFile).execute();

    // Create another session
    const otherSession = {
      ...testSession,
      id: 'other-session-1',
      browser_fingerprint: 'other-fingerprint'
    };
    await db.insert(sessionsTable).values(otherSession).execute();

    // Try to delete file with different session
    await expect(deleteFile(testFile.id, otherSession.id))
      .rejects.toThrow(/Unauthorized: File belongs to a different session/i);
  });

  it('should throw error when file is already deleted', async () => {
    // Setup test data with already deleted file
    const deletedFile = { ...testFile, is_deleted: true };
    
    await db.insert(sessionsTable).values(testSession).execute();
    await db.insert(projectsTable).values(testProject).execute();
    await db.insert(filesTable).values(deletedFile).execute();

    // Try to delete already deleted file
    await expect(deleteFile(testFile.id, testSession.id))
      .rejects.toThrow(/File is already deleted/i);
  });

  it('should verify file ownership through project relationship', async () => {
    // Create multiple sessions and projects to test ownership verification
    const session2 = {
      ...testSession,
      id: 'test-session-2',
      browser_fingerprint: 'fingerprint-2'
    };
    
    const project2 = {
      ...testProject,
      id: 'test-project-2',
      name: 'Project 2',
      session_id: session2.id
    };

    const file2 = {
      ...testFile,
      id: 'test-file-2',
      project_id: project2.id,
      name: 'other.js'
    };

    // Setup both sessions, projects, and files
    await db.insert(sessionsTable).values([testSession, session2]).execute();
    await db.insert(projectsTable).values([testProject, project2]).execute();
    await db.insert(filesTable).values([testFile, file2]).execute();

    // Verify session1 can delete its own file
    const result1 = await deleteFile(testFile.id, testSession.id);
    expect(result1).toBe(true);

    // Verify session1 cannot delete session2's file
    await expect(deleteFile(file2.id, testSession.id))
      .rejects.toThrow(/Unauthorized: File belongs to a different session/i);

    // Verify session2 can delete its own file
    const result2 = await deleteFile(file2.id, session2.id);
    expect(result2).toBe(true);
  });

  it('should update the updated_at timestamp when deleting', async () => {
    // Setup test data
    await db.insert(sessionsTable).values(testSession).execute();
    await db.insert(projectsTable).values(testProject).execute();
    await db.insert(filesTable).values(testFile).execute();

    // Get original timestamp
    const originalFile = await db.select()
      .from(filesTable)
      .where(eq(filesTable.id, testFile.id))
      .execute();
    
    const originalUpdatedAt = originalFile[0].updated_at;

    // Wait a bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    // Delete the file
    await deleteFile(testFile.id, testSession.id);

    // Verify updated_at was changed
    const updatedFile = await db.select()
      .from(filesTable)
      .where(eq(filesTable.id, testFile.id))
      .execute();

    expect(updatedFile[0].updated_at).toBeInstanceOf(Date);
    expect(updatedFile[0].updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });
});