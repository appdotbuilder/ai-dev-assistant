import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { filesTable, projectsTable, sessionsTable } from '../db/schema';
import { type CreateFileInput } from '../schema';
import { createFile } from '../handlers/create_file';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Test data setup
const testSessionId = 'test-session-123';
const testProjectId = 'test-project-123';

const testFileInput: CreateFileInput = {
  project_id: testProjectId,
  name: 'index.js',
  path: '/src/index.js',
  content: 'console.log("Hello, World!");', // This is 29 bytes
  type: 'js'
};

describe('createFile', () => {
  beforeEach(async () => {
    await createDB();
    
    // Create test session first
    await db.insert(sessionsTable).values({
      id: testSessionId,
      browser_fingerprint: 'test-fingerprint',
      ip_address: '127.0.0.1',
      user_agent: 'test-agent',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    }).execute();

    // Create test project
    await db.insert(projectsTable).values({
      id: testProjectId,
      name: 'Test Project',
      type: 'react',
      session_id: testSessionId
    }).execute();
  });

  afterEach(resetDB);

  it('should create a file successfully', async () => {
    const result = await createFile(testFileInput);

    // Verify returned file structure
    expect(result.id).toBeDefined();
    expect(result.project_id).toEqual(testProjectId);
    expect(result.name).toEqual('index.js');
    expect(result.path).toEqual('/src/index.js');
    expect(result.content).toEqual('console.log("Hello, World!");');
    expect(result.type).toEqual('js');
    expect(result.size).toEqual(29); // Length of the content in bytes
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.is_deleted).toBe(false);
  });

  it('should save file to database', async () => {
    const result = await createFile(testFileInput);

    // Query database to verify file was saved
    const savedFiles = await db.select()
      .from(filesTable)
      .where(eq(filesTable.id, result.id))
      .execute();

    expect(savedFiles).toHaveLength(1);
    const savedFile = savedFiles[0];
    
    expect(savedFile.project_id).toEqual(testProjectId);
    expect(savedFile.name).toEqual('index.js');
    expect(savedFile.path).toEqual('/src/index.js');
    expect(savedFile.content).toEqual('console.log("Hello, World!");');
    expect(savedFile.type).toEqual('js');
    expect(savedFile.size).toEqual(29);
    expect(savedFile.is_deleted).toBe(false);
  });

  it('should calculate file size correctly for different content types', async () => {
    const testCases = [
      { content: '', expectedSize: 0 },
      { content: 'a', expectedSize: 1 },
      { content: 'Hello 世界', expectedSize: 12 }, // UTF-8 encoded
      { content: JSON.stringify({ key: 'value' }), expectedSize: 15 }
    ];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const input = {
        ...testFileInput,
        path: `/test-${i}.txt`,
        name: `test-${i}.txt`,
        content: testCase.content
      };

      const result = await createFile(input);
      expect(result.size).toEqual(testCase.expectedSize);
    }
  });

  it('should handle different file types', async () => {
    const fileTypes = [
      { type: 'ts' as const, name: 'app.ts', path: '/src/app.ts' },
      { type: 'css' as const, name: 'styles.css', path: '/src/styles.css' },
      { type: 'html' as const, name: 'index.html', path: '/index.html' },
      { type: 'json' as const, name: 'package.json', path: '/package.json' }
    ];

    for (const fileType of fileTypes) {
      const input = {
        project_id: testProjectId,
        ...fileType,
        content: `/* ${fileType.type} content */`
      };

      const result = await createFile(input);
      
      expect(result.type).toEqual(fileType.type);
      expect(result.name).toEqual(fileType.name);
      expect(result.path).toEqual(fileType.path);
    }
  });

  it('should throw error if project does not exist', async () => {
    const input = {
      ...testFileInput,
      project_id: 'non-existent-project'
    };

    expect(createFile(input)).rejects.toThrow(/project.*not found/i);
  });

  it('should throw error if file path already exists in project', async () => {
    // Create first file
    await createFile(testFileInput);

    // Try to create another file with the same path
    const duplicateInput = {
      ...testFileInput,
      name: 'different-name.js',
      content: 'different content'
    };

    expect(createFile(duplicateInput)).rejects.toThrow(/file.*already exists/i);
  });

  it('should allow same path in different projects', async () => {
    // Create second project
    const secondProjectId = 'test-project-456';
    await db.insert(projectsTable).values({
      id: secondProjectId,
      name: 'Second Test Project',
      type: 'vue',
      session_id: testSessionId
    }).execute();

    // Create file in first project
    await createFile(testFileInput);

    // Create file with same path in second project
    const secondProjectInput = {
      ...testFileInput,
      project_id: secondProjectId
    };

    const result = await createFile(secondProjectInput);
    
    expect(result.project_id).toEqual(secondProjectId);
    expect(result.path).toEqual(testFileInput.path);
  });

  it('should allow creating file with same path as deleted file', async () => {
    // Create and then mark file as deleted
    const result1 = await createFile(testFileInput);
    
    await db.update(filesTable)
      .set({ is_deleted: true })
      .where(eq(filesTable.id, result1.id))
      .execute();

    // Should be able to create new file with same path
    const newFileInput = {
      ...testFileInput,
      content: 'New content for recreated file'
    };

    const result2 = await createFile(newFileInput);
    
    expect(result2.id).not.toEqual(result1.id);
    expect(result2.path).toEqual(testFileInput.path);
    expect(result2.content).toEqual('New content for recreated file');
  });

  it('should handle files with complex paths', async () => {
    const complexPaths = [
      '/src/components/Header/Header.tsx',
      '/public/assets/images/logo.png',
      '/docs/api/v1/README.md',
      '/src/utils/helpers/string.utils.js'
    ];

    for (const path of complexPaths) {
      const input = {
        project_id: testProjectId,
        path,
        name: path.split('/').pop() || 'file',
        content: `Content for ${path}`,
        type: 'js' as const
      };

      const result = await createFile(input);
      expect(result.path).toEqual(path);
    }
  });

  it('should handle large file content', async () => {
    // Create a large file (1MB of content)
    const largeContent = 'a'.repeat(1024 * 1024);
    
    const input = {
      ...testFileInput,
      path: '/large-file.txt',
      content: largeContent
    };

    const result = await createFile(input);
    
    expect(result.size).toEqual(1024 * 1024);
    expect(result.content.length).toEqual(1024 * 1024);
  });
});