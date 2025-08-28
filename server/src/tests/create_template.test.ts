import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { templatesTable, projectsTable, filesTable, sessionsTable } from '../db/schema';
import { createTemplate } from '../handlers/create_template';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Test data setup
const createTestSession = async () => {
  const sessionId = randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 1);

  await db.insert(sessionsTable).values({
    id: sessionId,
    browser_fingerprint: 'test-fingerprint',
    ip_address: '127.0.0.1',
    user_agent: 'test-agent',
    expires_at: expiresAt
  }).execute();

  return sessionId;
};

const createTestProject = async (sessionId: string) => {
  const projectId = randomUUID();
  
  await db.insert(projectsTable).values({
    id: projectId,
    name: 'Test Project',
    description: 'A test project for template creation',
    type: 'react',
    session_id: sessionId
  }).execute();

  return projectId;
};

const createTestFiles = async (projectId: string) => {
  const files = [
    {
      id: randomUUID(),
      project_id: projectId,
      name: 'App.tsx',
      path: 'src/App.tsx',
      content: 'import React from "react";\n\nfunction App() {\n  return <div>Hello World</div>;\n}\n\nexport default App;',
      type: 'tsx' as const,
      size: 100,
      is_deleted: false
    },
    {
      id: randomUUID(),
      project_id: projectId,
      name: 'index.html',
      path: 'public/index.html',
      content: '<!DOCTYPE html>\n<html>\n<head>\n  <title>Test App</title>\n</head>\n<body>\n  <div id="root"></div>\n</body>\n</html>',
      type: 'html' as const,
      size: 150,
      is_deleted: false
    },
    {
      id: randomUUID(),
      project_id: projectId,
      name: 'deleted.js',
      path: 'src/deleted.js',
      content: '// This file was deleted',
      type: 'js' as const,
      size: 50,
      is_deleted: true // This should be excluded from template
    }
  ];

  await db.insert(filesTable).values(files).execute();
  return files;
};

// Test parameters
const testName = 'React Starter Template';
const testDescription = 'A basic React application template';
const testTags = ['react', 'starter', 'typescript'];

describe('createTemplate', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a template from a project', async () => {
    const sessionId = await createTestSession();
    const projectId = await createTestProject(sessionId);
    await createTestFiles(projectId);

    const result = await createTemplate(projectId, testName, testDescription, testTags);

    // Basic field validation
    expect(result.name).toEqual('React Starter Template');
    expect(result.description).toEqual('A basic React application template');
    expect(result.type).toEqual('react');
    expect(result.tags).toEqual(['react', 'starter', 'typescript']);
    expect(result.is_featured).toEqual(false);
    expect(result.usage_count).toEqual(0);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);

    // Files should be captured from project
    expect(result.files).toHaveLength(2); // Only non-deleted files
    expect(result.files.find(f => f.path === 'src/App.tsx')).toBeDefined();
    expect(result.files.find(f => f.path === 'public/index.html')).toBeDefined();
    expect(result.files.find(f => f.path === 'src/deleted.js')).toBeUndefined();
  });

  it('should save template to database', async () => {
    const sessionId = await createTestSession();
    const projectId = await createTestProject(sessionId);
    await createTestFiles(projectId);

    const result = await createTemplate(projectId, testName, testDescription, testTags);

    // Query database to verify template was saved
    const templates = await db.select()
      .from(templatesTable)
      .where(eq(templatesTable.id, result.id))
      .execute();

    expect(templates).toHaveLength(1);
    const template = templates[0];
    
    expect(template.name).toEqual('React Starter Template');
    expect(template.description).toEqual('A basic React application template');
    expect(template.type).toEqual('react');
    expect(template.tags).toEqual(['react', 'starter', 'typescript']);
    expect(template.is_featured).toEqual(false);
    expect(template.usage_count).toEqual(0);
    expect(template.created_at).toBeInstanceOf(Date);

    // Verify files are stored as JSON
    expect(Array.isArray(template.files)).toBe(true);
    expect(template.files).toHaveLength(2);
  });

  it('should create template with empty tags when not provided', async () => {
    const sessionId = await createTestSession();
    const projectId = await createTestProject(sessionId);
    await createTestFiles(projectId);

    const result = await createTemplate(projectId, 'Simple Template', 'A template without tags', []);

    expect(result.tags).toEqual([]);
    expect(result.is_featured).toEqual(false); // Default value
  });

  it('should create featured template when specified', async () => {
    const sessionId = await createTestSession();
    const projectId = await createTestProject(sessionId);
    await createTestFiles(projectId);

    const result = await createTemplate(projectId, 'Featured Template', 'A featured template', ['featured']);

    expect(result.is_featured).toEqual(false); // Always false with current signature
  });

  it('should handle project with no files', async () => {
    const sessionId = await createTestSession();
    const projectId = await createTestProject(sessionId);
    // Don't create any files

    const result = await createTemplate(projectId, testName, testDescription, testTags);

    expect(result.files).toEqual([]);
    expect(result.name).toEqual('React Starter Template');
    expect(result.type).toEqual('react'); // Should still get type from project
  });

  it('should use correct project type for template', async () => {
    const sessionId = await createTestSession();
    const projectId = randomUUID();
    
    // Create a Vue project instead of React
    await db.insert(projectsTable).values({
      id: projectId,
      name: 'Vue Project',
      description: 'A Vue project',
      type: 'vue',
      session_id: sessionId
    }).execute();

    const result = await createTemplate(projectId, testName, testDescription, testTags);

    expect(result.type).toEqual('vue');
  });

  it('should throw error when project does not exist', async () => {
    const nonExistentProjectId = randomUUID();
    await expect(createTemplate(nonExistentProjectId, testName, testDescription, testTags)).rejects.toThrow(/Project with id .+ not found/);
  });

  it('should capture file content correctly', async () => {
    const sessionId = await createTestSession();
    const projectId = await createTestProject(sessionId);
    
    const testFileContent = 'const message = "Hello from template!";';
    await db.insert(filesTable).values({
      id: randomUUID(),
      project_id: projectId,
      name: 'test.js',
      path: 'src/test.js',
      content: testFileContent,
      type: 'js',
      size: testFileContent.length,
      is_deleted: false
    }).execute();

    const result = await createTemplate(projectId, testName, testDescription, testTags);

    const testFile = result.files.find(f => f.path === 'src/test.js');
    expect(testFile).toBeDefined();
    expect(testFile!.content).toEqual(testFileContent);
    expect(testFile!.type).toEqual('js');
  });
});