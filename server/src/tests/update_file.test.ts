import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { sessionsTable, projectsTable, filesTable } from '../db/schema';
import { type UpdateFileInput, type CreateSessionInput, type CreateProjectInput, type CreateFileInput } from '../schema';
import { updateFile } from '../handlers/update_file';
import { eq } from 'drizzle-orm';

// Test data setup helpers
const createTestSession = async (): Promise<string> => {
  const sessionInput: CreateSessionInput = {
    browser_fingerprint: 'test-fingerprint',
    ip_address: '127.0.0.1',
    user_agent: 'test-agent'
  };

  const result = await db.insert(sessionsTable)
    .values({
      id: 'test-session-id',
      browser_fingerprint: sessionInput.browser_fingerprint,
      ip_address: sessionInput.ip_address,
      user_agent: sessionInput.user_agent,
      status: 'active',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    })
    .returning()
    .execute();

  return result[0].id;
};

const createTestProject = async (sessionId: string): Promise<string> => {
  const projectInput: CreateProjectInput = {
    name: 'Test Project',
    description: 'A test project',
    type: 'react',
    session_id: sessionId
  };

  const result = await db.insert(projectsTable)
    .values({
      id: 'test-project-id',
      name: projectInput.name,
      description: projectInput.description,
      type: projectInput.type,
      session_id: projectInput.session_id
    })
    .returning()
    .execute();

  return result[0].id;
};

const createTestFile = async (projectId: string): Promise<string> => {
  const fileInput: CreateFileInput = {
    project_id: projectId,
    name: 'test.js',
    path: '/src/test.js',
    content: 'console.log("hello");',
    type: 'js'
  };

  const result = await db.insert(filesTable)
    .values({
      id: 'test-file-id',
      project_id: fileInput.project_id,
      name: fileInput.name,
      path: fileInput.path,
      content: fileInput.content,
      type: fileInput.type,
      size: Buffer.byteLength(fileInput.content, 'utf8'),
      is_deleted: false
    })
    .returning()
    .execute();

  return result[0].id;
};

describe('updateFile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update file content', async () => {
    // Setup
    const sessionId = await createTestSession();
    const projectId = await createTestProject(sessionId);
    const fileId = await createTestFile(projectId);

    const updateInput: UpdateFileInput = {
      id: fileId,
      content: 'console.log("updated content");'
    };

    // Execute
    const result = await updateFile(updateInput);

    // Verify
    expect(result.id).toEqual(fileId);
    expect(result.content).toEqual('console.log("updated content");');
    expect(result.size).toEqual(Buffer.byteLength('console.log("updated content");', 'utf8'));
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.name).toEqual('test.js'); // Should remain unchanged
    expect(result.path).toEqual('/src/test.js'); // Should remain unchanged
  });

  it('should update file name', async () => {
    // Setup
    const sessionId = await createTestSession();
    const projectId = await createTestProject(sessionId);
    const fileId = await createTestFile(projectId);

    const updateInput: UpdateFileInput = {
      id: fileId,
      name: 'renamed.js'
    };

    // Execute
    const result = await updateFile(updateInput);

    // Verify
    expect(result.id).toEqual(fileId);
    expect(result.name).toEqual('renamed.js');
    expect(result.content).toEqual('console.log("hello");'); // Should remain unchanged
    expect(result.path).toEqual('/src/test.js'); // Should remain unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update file path', async () => {
    // Setup
    const sessionId = await createTestSession();
    const projectId = await createTestProject(sessionId);
    const fileId = await createTestFile(projectId);

    const updateInput: UpdateFileInput = {
      id: fileId,
      path: '/components/test.js'
    };

    // Execute
    const result = await updateFile(updateInput);

    // Verify
    expect(result.id).toEqual(fileId);
    expect(result.path).toEqual('/components/test.js');
    expect(result.name).toEqual('test.js'); // Should remain unchanged
    expect(result.content).toEqual('console.log("hello");'); // Should remain unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update multiple fields at once', async () => {
    // Setup
    const sessionId = await createTestSession();
    const projectId = await createTestProject(sessionId);
    const fileId = await createTestFile(projectId);

    const updateInput: UpdateFileInput = {
      id: fileId,
      name: 'updated.tsx',
      path: '/components/updated.tsx',
      content: 'export const Component = () => <div>Hello</div>;'
    };

    // Execute
    const result = await updateFile(updateInput);

    // Verify
    expect(result.id).toEqual(fileId);
    expect(result.name).toEqual('updated.tsx');
    expect(result.path).toEqual('/components/updated.tsx');
    expect(result.content).toEqual('export const Component = () => <div>Hello</div>;');
    expect(result.size).toEqual(Buffer.byteLength('export const Component = () => <div>Hello</div>;', 'utf8'));
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save updates to database', async () => {
    // Setup
    const sessionId = await createTestSession();
    const projectId = await createTestProject(sessionId);
    const fileId = await createTestFile(projectId);

    const updateInput: UpdateFileInput = {
      id: fileId,
      content: 'const updated = true;'
    };

    // Execute
    const result = await updateFile(updateInput);

    // Verify database was updated
    const files = await db.select()
      .from(filesTable)
      .where(eq(filesTable.id, fileId))
      .execute();

    expect(files).toHaveLength(1);
    expect(files[0].content).toEqual('const updated = true;');
    expect(files[0].updated_at).toBeInstanceOf(Date);
    expect(files[0].size).toEqual(Buffer.byteLength('const updated = true;', 'utf8'));
  });

  it('should handle empty content update', async () => {
    // Setup
    const sessionId = await createTestSession();
    const projectId = await createTestProject(sessionId);
    const fileId = await createTestFile(projectId);

    const updateInput: UpdateFileInput = {
      id: fileId,
      content: ''
    };

    // Execute
    const result = await updateFile(updateInput);

    // Verify
    expect(result.content).toEqual('');
    expect(result.size).toEqual(0);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent file', async () => {
    const updateInput: UpdateFileInput = {
      id: 'non-existent-file-id',
      content: 'some content'
    };

    // Execute and verify error
    expect(updateFile(updateInput)).rejects.toThrow(/file not found/i);
  });

  it('should handle updating only updated_at when no fields provided', async () => {
    // Setup
    const sessionId = await createTestSession();
    const projectId = await createTestProject(sessionId);
    const fileId = await createTestFile(projectId);

    // Get original file data
    const originalFile = await db.select()
      .from(filesTable)
      .where(eq(filesTable.id, fileId))
      .execute();

    const originalUpdatedAt = originalFile[0].updated_at;

    // Wait a small amount to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 1));

    const updateInput: UpdateFileInput = {
      id: fileId
      // No other fields provided
    };

    // Execute
    const result = await updateFile(updateInput);

    // Verify
    expect(result.id).toEqual(fileId);
    expect(result.content).toEqual('console.log("hello");'); // Should remain unchanged
    expect(result.name).toEqual('test.js'); // Should remain unchanged
    expect(result.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it('should correctly calculate size for unicode content', async () => {
    // Setup
    const sessionId = await createTestSession();
    const projectId = await createTestProject(sessionId);
    const fileId = await createTestFile(projectId);

    const unicodeContent = 'const emoji = "🚀"; // Unicode test';
    const updateInput: UpdateFileInput = {
      id: fileId,
      content: unicodeContent
    };

    // Execute
    const result = await updateFile(updateInput);

    // Verify
    expect(result.content).toEqual(unicodeContent);
    expect(result.size).toEqual(Buffer.byteLength(unicodeContent, 'utf8'));
    
    // Verify the size is correctly calculated (should be larger than character count due to Unicode)
    expect(result.size).toBeGreaterThan(unicodeContent.length);
  });
});