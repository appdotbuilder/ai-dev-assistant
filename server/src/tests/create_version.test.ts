import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { versionsTable, projectsTable, sessionsTable } from '../db/schema';
import { type CreateVersionInput } from '../schema';
import { createVersion } from '../handlers/create_version';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Test project and session data
const testSessionId = randomUUID();
const testProjectId = randomUUID();

// Complete test input with all required fields
const testInput: CreateVersionInput = {
  project_id: testProjectId,
  message: 'Initial commit with basic structure',
  author: 'test-user',
  file_changes: [
    {
      file_id: 'file-1',
      action: 'created',
      content_before: null,
      content_after: 'console.log("Hello world");'
    },
    {
      file_id: 'file-2',
      action: 'modified',
      content_before: 'const x = 1;',
      content_after: 'const x = 2;'
    }
  ]
};

describe('createVersion', () => {
  beforeEach(async () => {
    await createDB();
    
    // Create prerequisite session
    await db.insert(sessionsTable).values({
      id: testSessionId,
      browser_fingerprint: 'test-fingerprint',
      ip_address: '127.0.0.1',
      user_agent: 'test-agent',
      status: 'active',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    }).execute();

    // Create prerequisite project
    await db.insert(projectsTable).values({
      id: testProjectId,
      name: 'Test Project',
      description: 'A test project for version control',
      type: 'react',
      session_id: testSessionId
    }).execute();
  });

  afterEach(resetDB);

  it('should create a version with all required fields', async () => {
    const result = await createVersion(testInput);

    // Verify all fields are present and correct
    expect(result.project_id).toEqual(testProjectId);
    expect(result.message).toEqual('Initial commit with basic structure');
    expect(result.author).toEqual('test-user');
    expect(result.file_changes).toEqual(testInput.file_changes);
    expect(result.id).toBeDefined();
    expect(result.commit_hash).toBeDefined();
    expect(result.commit_hash).toHaveLength(8);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save version to database correctly', async () => {
    const result = await createVersion(testInput);

    // Verify version was saved to database
    const versions = await db.select()
      .from(versionsTable)
      .where(eq(versionsTable.id, result.id))
      .execute();

    expect(versions).toHaveLength(1);
    const savedVersion = versions[0];
    
    expect(savedVersion.project_id).toEqual(testProjectId);
    expect(savedVersion.message).toEqual('Initial commit with basic structure');
    expect(savedVersion.author).toEqual('test-user');
    expect(savedVersion.commit_hash).toEqual(result.commit_hash);
    expect(savedVersion.file_changes).toEqual(testInput.file_changes);
    expect(savedVersion.created_at).toBeInstanceOf(Date);
  });

  it('should generate unique commit hashes for different inputs', async () => {
    const input1: CreateVersionInput = {
      ...testInput,
      message: 'First commit',
      file_changes: [{ file_id: 'file-1', action: 'created', content_before: null, content_after: 'content1' }]
    };

    const input2: CreateVersionInput = {
      ...testInput,
      message: 'Second commit',
      file_changes: [{ file_id: 'file-2', action: 'created', content_before: null, content_after: 'content2' }]
    };

    const result1 = await createVersion(input1);
    const result2 = await createVersion(input2);

    expect(result1.commit_hash).not.toEqual(result2.commit_hash);
    expect(result1.commit_hash).toHaveLength(8);
    expect(result2.commit_hash).toHaveLength(8);
  });

  it('should handle complex file changes correctly', async () => {
    const complexInput: CreateVersionInput = {
      project_id: testProjectId,
      message: 'Complex refactoring with multiple file operations',
      author: 'advanced-user',
      file_changes: [
        {
          file_id: 'component-1',
          action: 'created',
          content_before: null,
          content_after: 'function Component() { return <div>New</div>; }'
        },
        {
          file_id: 'style-1',
          action: 'modified',
          content_before: '.old { color: red; }',
          content_after: '.new { color: blue; background: white; }'
        },
        {
          file_id: 'unused-file',
          action: 'deleted',
          content_before: 'old content that is no longer needed',
          content_after: null
        }
      ]
    };

    const result = await createVersion(complexInput);

    expect(result.file_changes).toHaveLength(3);
    expect(result.file_changes[0].action).toEqual('created');
    expect(result.file_changes[1].action).toEqual('modified');
    expect(result.file_changes[2].action).toEqual('deleted');
    expect(result.file_changes[2].content_after).toBeNull();
    expect(result.message).toEqual('Complex refactoring with multiple file operations');
  });

  it('should handle empty file changes array', async () => {
    const emptyChangesInput: CreateVersionInput = {
      project_id: testProjectId,
      message: 'Empty commit for testing purposes',
      author: 'test-author',
      file_changes: []
    };

    const result = await createVersion(emptyChangesInput);

    expect(result.file_changes).toEqual([]);
    expect(result.message).toEqual('Empty commit for testing purposes');
    expect(result.commit_hash).toBeDefined();
    expect(result.commit_hash).toHaveLength(8);
  });

  it('should throw error when project does not exist', async () => {
    const invalidInput: CreateVersionInput = {
      project_id: 'non-existent-project-id',
      message: 'This should fail',
      author: 'test-user',
      file_changes: []
    };

    await expect(createVersion(invalidInput)).rejects.toThrow(/Project with id non-existent-project-id not found/i);
  });

  it('should handle special characters in commit message and author', async () => {
    const specialCharsInput: CreateVersionInput = {
      project_id: testProjectId,
      message: 'Fix bug #123: Handle "quotes" & <special> chars in commit message',
      author: 'user@example.com',
      file_changes: [
        {
          file_id: 'special-file',
          action: 'modified',
          content_before: 'const msg = "old";',
          content_after: 'const msg = "new & improved";'
        }
      ]
    };

    const result = await createVersion(specialCharsInput);

    expect(result.message).toEqual('Fix bug #123: Handle "quotes" & <special> chars in commit message');
    expect(result.author).toEqual('user@example.com');
    expect(result.file_changes[0].content_after).toEqual('const msg = "new & improved";');
  });
});