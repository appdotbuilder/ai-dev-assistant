import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { projectsTable, sessionsTable, templatesTable, filesTable } from '../db/schema';
import { type CreateProjectInput } from '../schema';
import { createProject } from '../handlers/create_project';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

describe('createProject', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create a test session
  const createTestSession = async () => {
    const sessionId = randomUUID();
    const expires = new Date();
    expires.setHours(expires.getHours() + 24);
    
    await db.insert(sessionsTable)
      .values({
        id: sessionId,
        browser_fingerprint: 'test-fingerprint',
        ip_address: '127.0.0.1',
        user_agent: 'test-agent',
        status: 'active',
        expires_at: expires,
        metadata: null
      })
      .execute();
    
    return sessionId;
  };

  // Helper function to create a test template
  const createTestTemplate = async () => {
    const templateId = randomUUID();
    const templateFiles = [
      {
        path: 'index.html',
        content: '<html><body>Hello World</body></html>',
        type: 'html'
      },
      {
        path: 'style.css',
        content: 'body { margin: 0; }',
        type: 'css'
      }
    ];

    await db.insert(templatesTable)
      .values({
        id: templateId,
        name: 'Test Template',
        description: 'A template for testing',
        type: 'react',
        files: templateFiles,
        tags: ['test', 'basic'],
        is_featured: false,
        usage_count: 5
      })
      .execute();

    return { templateId, templateFiles };
  };

  it('should create a project without template', async () => {
    const sessionId = await createTestSession();
    
    const testInput: CreateProjectInput = {
      name: 'My Test Project',
      description: 'A project for testing',
      type: 'react',
      session_id: sessionId
    };

    const result = await createProject(testInput);

    // Verify returned project
    expect(result.name).toEqual('My Test Project');
    expect(result.description).toEqual('A project for testing');
    expect(result.type).toEqual('react');
    expect(result.session_id).toEqual(sessionId);
    expect(result.template_id).toBeNull();
    expect(result.is_public).toBe(false);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.preview_url).toMatch(/^https:\/\/preview\.dev\/.+/);
    expect(result.deployment_url).toBeNull();
  });

  it('should save project to database', async () => {
    const sessionId = await createTestSession();
    
    const testInput: CreateProjectInput = {
      name: 'Database Test Project',
      type: 'vue',
      session_id: sessionId
    };

    const result = await createProject(testInput);

    // Query database to verify project was saved
    const projects = await db.select()
      .from(projectsTable)
      .where(eq(projectsTable.id, result.id))
      .execute();

    expect(projects).toHaveLength(1);
    expect(projects[0].name).toEqual('Database Test Project');
    expect(projects[0].type).toEqual('vue');
    expect(projects[0].session_id).toEqual(sessionId);
    expect(projects[0].description).toBeNull();
    expect(projects[0].created_at).toBeInstanceOf(Date);
  });

  it('should create project with template and initialize files', async () => {
    const sessionId = await createTestSession();
    const { templateId, templateFiles } = await createTestTemplate();
    
    const testInput: CreateProjectInput = {
      name: 'Templated Project',
      description: 'Project created from template',
      type: 'react',
      template_id: templateId,
      session_id: sessionId
    };

    const result = await createProject(testInput);

    // Verify project was created with template reference
    expect(result.template_id).toEqual(templateId);

    // Verify files were created from template
    const files = await db.select()
      .from(filesTable)
      .where(eq(filesTable.project_id, result.id))
      .execute();

    expect(files).toHaveLength(2);
    
    // Check first file
    const indexFile = files.find(f => f.name === 'index.html');
    expect(indexFile).toBeDefined();
    expect(indexFile!.path).toEqual('index.html');
    expect(indexFile!.content).toEqual('<html><body>Hello World</body></html>');
    expect(indexFile!.type).toEqual('html');
    expect(indexFile!.size).toEqual(37);
    expect(indexFile!.is_deleted).toBe(false);

    // Check second file
    const cssFile = files.find(f => f.name === 'style.css');
    expect(cssFile).toBeDefined();
    expect(cssFile!.path).toEqual('style.css');
    expect(cssFile!.content).toEqual('body { margin: 0; }');
    expect(cssFile!.type).toEqual('css');
  });

  it('should increment template usage count', async () => {
    const sessionId = await createTestSession();
    const { templateId } = await createTestTemplate();
    
    const testInput: CreateProjectInput = {
      name: 'Usage Count Test',
      type: 'react',
      template_id: templateId,
      session_id: sessionId
    };

    await createProject(testInput);

    // Verify template usage count was incremented
    const template = await db.select()
      .from(templatesTable)
      .where(eq(templatesTable.id, templateId))
      .execute();

    expect(template[0].usage_count).toEqual(6); // Was 5, now should be 6
  });

  it('should throw error when session does not exist', async () => {
    const nonExistentSessionId = randomUUID();
    
    const testInput: CreateProjectInput = {
      name: 'Invalid Session Project',
      type: 'node',
      session_id: nonExistentSessionId
    };

    await expect(createProject(testInput)).rejects.toThrow(/Session with id .+ not found/);
  });

  it('should throw error when template does not exist', async () => {
    const sessionId = await createTestSession();
    const nonExistentTemplateId = randomUUID();
    
    const testInput: CreateProjectInput = {
      name: 'Invalid Template Project',
      type: 'angular',
      template_id: nonExistentTemplateId,
      session_id: sessionId
    };

    await expect(createProject(testInput)).rejects.toThrow(/Template with id .+ not found/);
  });

  it('should handle null description correctly', async () => {
    const sessionId = await createTestSession();
    
    const testInput: CreateProjectInput = {
      name: 'No Description Project',
      description: null,
      type: 'vanilla',
      session_id: sessionId
    };

    const result = await createProject(testInput);
    
    expect(result.description).toBeNull();
    
    // Verify in database
    const project = await db.select()
      .from(projectsTable)
      .where(eq(projectsTable.id, result.id))
      .execute();
    
    expect(project[0].description).toBeNull();
  });

  it('should create unique preview URLs', async () => {
    const sessionId = await createTestSession();
    
    const testInput1: CreateProjectInput = {
      name: 'Project 1',
      type: 'react',
      session_id: sessionId
    };
    
    const testInput2: CreateProjectInput = {
      name: 'Project 2',
      type: 'vue',
      session_id: sessionId
    };

    const result1 = await createProject(testInput1);
    const result2 = await createProject(testInput2);

    expect(result1.preview_url).not.toEqual(result2.preview_url);
    expect(result1.preview_url).toMatch(/^https:\/\/preview\.dev\/.+/);
    expect(result2.preview_url).toMatch(/^https:\/\/preview\.dev\/.+/);
  });

  it('should handle template with complex file structure', async () => {
    const sessionId = await createTestSession();
    const templateId = randomUUID();
    
    // Create template with nested file structure
    const complexTemplateFiles = [
      {
        path: 'src/components/App.tsx',
        content: 'export default function App() { return <div>App</div>; }',
        type: 'tsx'
      },
      {
        path: 'src/styles/main.scss',
        content: '$primary: #007bff;\n\nbody {\n  color: $primary;\n}',
        type: 'scss'
      },
      {
        path: 'package.json',
        content: '{"name": "test-app", "version": "1.0.0"}',
        type: 'json'
      }
    ];

    await db.insert(templatesTable)
      .values({
        id: templateId,
        name: 'Complex Template',
        description: 'Template with nested structure',
        type: 'react',
        files: complexTemplateFiles,
        tags: ['complex', 'nested'],
        is_featured: true,
        usage_count: 0
      })
      .execute();
    
    const testInput: CreateProjectInput = {
      name: 'Complex Structure Project',
      type: 'react',
      template_id: templateId,
      session_id: sessionId
    };

    const result = await createProject(testInput);

    // Verify all files were created with correct paths and names
    const files = await db.select()
      .from(filesTable)
      .where(eq(filesTable.project_id, result.id))
      .execute();

    expect(files).toHaveLength(3);
    
    const appFile = files.find(f => f.name === 'App.tsx');
    expect(appFile).toBeDefined();
    expect(appFile!.path).toEqual('src/components/App.tsx');
    
    const scssFile = files.find(f => f.name === 'main.scss');
    expect(scssFile).toBeDefined();
    expect(scssFile!.path).toEqual('src/styles/main.scss');
    
    const packageFile = files.find(f => f.name === 'package.json');
    expect(packageFile).toBeDefined();
    expect(packageFile!.path).toEqual('package.json');
  });
});