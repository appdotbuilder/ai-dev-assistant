import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { projectsTable, filesTable, sessionsTable } from '../db/schema';
import { type CreateFileInput } from '../schema';
import { getFiles } from '../handlers/get_files';

describe('getFiles', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper to create a session for testing
  const createTestSession = async () => {
    const sessionResult = await db.insert(sessionsTable)
      .values({
        id: 'test-session-1',
        browser_fingerprint: 'test-fingerprint',
        ip_address: '127.0.0.1',
        user_agent: 'test-agent',
        status: 'active',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      })
      .returning()
      .execute();
    return sessionResult[0];
  };

  // Helper to create a project for testing
  const createTestProject = async (sessionId: string) => {
    const projectResult = await db.insert(projectsTable)
      .values({
        id: 'test-project-1',
        name: 'Test Project',
        description: 'A test project',
        type: 'react',
        session_id: sessionId
      })
      .returning()
      .execute();
    return projectResult[0];
  };

  // Helper to create a file for testing
  const createTestFile = async (fileData: Partial<CreateFileInput> & { project_id: string; is_deleted?: boolean }) => {
    const content = fileData.content || 'console.log("Hello World");';
    const fileResult = await db.insert(filesTable)
      .values({
        id: `file-${Date.now()}-${Math.random()}`,
        project_id: fileData.project_id,
        name: fileData.name || 'test.js',
        path: fileData.path || '/test.js',
        content: content,
        type: fileData.type || 'js',
        size: content.length,
        is_deleted: fileData.is_deleted || false
      })
      .returning()
      .execute();
    return fileResult[0];
  };

  it('should return empty array for project with no files', async () => {
    const session = await createTestSession();
    const project = await createTestProject(session.id);

    const result = await getFiles(project.id);

    expect(result).toEqual([]);
  });

  it('should return files for a project', async () => {
    const session = await createTestSession();
    const project = await createTestProject(session.id);

    // Create test files
    const file1 = await createTestFile({
      project_id: project.id,
      name: 'index.js',
      path: '/index.js',
      content: 'console.log("Hello");',
      type: 'js'
    });

    const file2 = await createTestFile({
      project_id: project.id,
      name: 'styles.css',
      path: '/styles.css',
      content: 'body { margin: 0; }',
      type: 'css'
    });

    const result = await getFiles(project.id);

    expect(result).toHaveLength(2);
    
    // Verify first file
    const resultFile1 = result.find(f => f.name === 'index.js');
    expect(resultFile1).toBeDefined();
    expect(resultFile1?.project_id).toBe(project.id);
    expect(resultFile1?.path).toBe('/index.js');
    expect(resultFile1?.content).toBe('console.log("Hello");');
    expect(resultFile1?.type).toBe('js');
    expect(resultFile1?.size).toBe('console.log("Hello");'.length);
    expect(resultFile1?.is_deleted).toBe(false);
    expect(resultFile1?.created_at).toBeInstanceOf(Date);
    expect(resultFile1?.updated_at).toBeInstanceOf(Date);

    // Verify second file
    const resultFile2 = result.find(f => f.name === 'styles.css');
    expect(resultFile2).toBeDefined();
    expect(resultFile2?.project_id).toBe(project.id);
    expect(resultFile2?.type).toBe('css');
    expect(resultFile2?.content).toBe('body { margin: 0; }');
  });

  it('should exclude deleted files by default', async () => {
    const session = await createTestSession();
    const project = await createTestProject(session.id);

    // Create active file
    await createTestFile({
      project_id: project.id,
      name: 'active.js',
      path: '/active.js',
      content: 'console.log("active");',
      type: 'js',
      is_deleted: false
    });

    // Create deleted file
    await createTestFile({
      project_id: project.id,
      name: 'deleted.js',
      path: '/deleted.js',
      content: 'console.log("deleted");',
      type: 'js',
      is_deleted: true
    });

    const result = await getFiles(project.id);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('active.js');
    expect(result[0].is_deleted).toBe(false);
  });

  it('should return files only for the specified project', async () => {
    const session = await createTestSession();
    
    // Create two projects
    const project1Result = await db.insert(projectsTable)
      .values({
        id: 'project-1',
        name: 'Project 1',
        type: 'react',
        session_id: session.id
      })
      .returning()
      .execute();
    const project1 = project1Result[0];

    const project2Result = await db.insert(projectsTable)
      .values({
        id: 'project-2',
        name: 'Project 2',
        type: 'vue',
        session_id: session.id
      })
      .returning()
      .execute();
    const project2 = project2Result[0];

    // Create files for both projects
    await createTestFile({
      project_id: project1.id,
      name: 'project1-file.js',
      path: '/project1-file.js',
      type: 'js'
    });

    await createTestFile({
      project_id: project2.id,
      name: 'project2-file.js',
      path: '/project2-file.js',
      type: 'js'
    });

    // Get files for project1 only
    const result = await getFiles(project1.id);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('project1-file.js');
    expect(result[0].project_id).toBe(project1.id);
  });

  it('should handle various file types correctly', async () => {
    const session = await createTestSession();
    const project = await createTestProject(session.id);

    // Create files of different types
    const fileTypes = [
      { name: 'script.js', type: 'js' as const },
      { name: 'types.ts', type: 'ts' as const },
      { name: 'component.jsx', type: 'jsx' as const },
      { name: 'component.tsx', type: 'tsx' as const },
      { name: 'styles.css', type: 'css' as const },
      { name: 'styles.scss', type: 'scss' as const },
      { name: 'index.html', type: 'html' as const },
      { name: 'config.json', type: 'json' as const },
      { name: 'readme.md', type: 'md' as const }
    ];

    for (const fileType of fileTypes) {
      await createTestFile({
        project_id: project.id,
        name: fileType.name,
        path: `/${fileType.name}`,
        type: fileType.type,
        content: `// ${fileType.name} content`
      });
    }

    const result = await getFiles(project.id);

    expect(result).toHaveLength(fileTypes.length);
    
    // Verify each file type is present
    fileTypes.forEach(expectedType => {
      const file = result.find(f => f.name === expectedType.name);
      expect(file).toBeDefined();
      expect(file?.type).toBe(expectedType.type);
    });
  });

  it('should handle nonexistent project gracefully', async () => {
    const result = await getFiles('nonexistent-project-id');

    expect(result).toEqual([]);
  });
});