import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { aiChatsTable, sessionsTable, projectsTable, filesTable } from '../db/schema';
import { type AiChatInput } from '../schema';
import { aiChat } from '../handlers/ai_chat';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

describe('aiChat', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testSession: { id: string };
  let testProject: { id: string };
  let testFile: { id: string };

  beforeEach(async () => {
    // Create test session
    const sessionId = randomUUID();
    await db.insert(sessionsTable).values({
      id: sessionId,
      browser_fingerprint: 'test-fingerprint',
      ip_address: '127.0.0.1',
      user_agent: 'test-agent',
      status: 'active',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    }).execute();
    testSession = { id: sessionId };

    // Create test project
    const projectId = randomUUID();
    await db.insert(projectsTable).values({
      id: projectId,
      name: 'Test Project',
      description: 'A test project',
      type: 'react',
      session_id: sessionId
    }).execute();
    testProject = { id: projectId };

    // Create test file
    const fileId = randomUUID();
    await db.insert(filesTable).values({
      id: fileId,
      project_id: projectId,
      name: 'App.jsx',
      path: '/src/App.jsx',
      content: 'import React from "react";\n\nexport default function App() {\n  return <div>Hello World</div>;\n}',
      type: 'jsx',
      size: 100
    }).execute();
    testFile = { id: fileId };
  });

  const basicInput: AiChatInput = {
    session_id: '', // Will be set in tests
    message: 'Help me create a React component',
    model: 'gpt-4'
  };

  it('should create AI chat without project context', async () => {
    const input = {
      ...basicInput,
      session_id: testSession.id
    };

    const result = await aiChat(input);

    // Verify return structure
    expect(result.id).toBeDefined();
    expect(result.session_id).toEqual(testSession.id);
    expect(result.project_id).toBeNull();
    expect(result.message).toEqual(input.message);
    expect(result.response).toBeDefined();
    expect(typeof result.response).toBe('string');
    expect(result.model).toEqual('gpt-4');
    expect(result.tokens_used).toBeGreaterThan(0);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.context_files).toBeNull();
  });

  it('should create AI chat with project context', async () => {
    const input = {
      ...basicInput,
      session_id: testSession.id,
      project_id: testProject.id,
      message: 'Debug this React component'
    };

    const result = await aiChat(input);

    // Verify return structure
    expect(result.session_id).toEqual(testSession.id);
    expect(result.project_id).toEqual(testProject.id);
    expect(result.message).toEqual(input.message);
    expect(result.response).toContain('debug');
    expect(result.model).toEqual('gpt-4');
    expect(result.tokens_used).toBeGreaterThan(0);
  });

  it('should create AI chat with context files', async () => {
    const input = {
      ...basicInput,
      session_id: testSession.id,
      project_id: testProject.id,
      message: 'Refactor this code',
      context_files: [testFile.id]
    };

    const result = await aiChat(input);

    expect(result.session_id).toEqual(testSession.id);
    expect(result.project_id).toEqual(testProject.id);
    expect(result.context_files).toEqual([testFile.id]);
    expect(result.response).toContain('context file');
    expect(result.tokens_used).toBeGreaterThan(0);
  });

  it('should use default model when not specified', async () => {
    const input = {
      session_id: testSession.id,
      message: 'Generate a function'
    };

    const result = await aiChat(input);

    expect(result.model).toEqual('gpt-4');
    expect(result.response).toBeDefined();
  });

  it('should use custom model when specified', async () => {
    const input = {
      ...basicInput,
      session_id: testSession.id,
      model: 'claude-3' as const
    };

    const result = await aiChat(input);

    expect(result.model).toEqual('claude-3');
    expect(result.response).toContain('claude-3');
  });

  it('should save chat to database correctly', async () => {
    const input = {
      ...basicInput,
      session_id: testSession.id,
      project_id: testProject.id,
      context_files: [testFile.id]
    };

    const result = await aiChat(input);

    // Verify database record
    const chats = await db.select()
      .from(aiChatsTable)
      .where(eq(aiChatsTable.id, result.id))
      .execute();

    expect(chats).toHaveLength(1);
    const chat = chats[0];
    expect(chat.session_id).toEqual(testSession.id);
    expect(chat.project_id).toEqual(testProject.id);
    expect(chat.message).toEqual(input.message);
    expect(chat.response).toBeDefined();
    expect(chat.model).toEqual('gpt-4');
    expect(chat.tokens_used).toBeGreaterThan(0);
    expect(chat.context_files).toEqual([testFile.id]);
  });

  it('should generate different responses for different message types', async () => {
    const helpInput = {
      session_id: testSession.id,
      message: 'I need help with my code'
    };

    const createInput = {
      session_id: testSession.id,
      message: 'Create a new component for me'
    };

    const debugInput = {
      session_id: testSession.id,
      message: 'Debug this error in my application'
    };

    const helpResult = await aiChat(helpInput);
    const createResult = await aiChat(createInput);
    const debugResult = await aiChat(debugInput);

    expect(helpResult.response).toContain('help');
    expect(createResult.response).toContain('create');
    expect(debugResult.response).toContain('debug');
    
    // Responses should be different
    expect(helpResult.response).not.toEqual(createResult.response);
    expect(createResult.response).not.toEqual(debugResult.response);
  });

  it('should calculate tokens based on message and response length', async () => {
    const shortInput = {
      session_id: testSession.id,
      message: 'Hi'
    };

    const longInput = {
      session_id: testSession.id,
      message: 'Please help me create a comprehensive React application with multiple components, routing, state management, and API integration. I need detailed explanations and examples for each part.'
    };

    const shortResult = await aiChat(shortInput);
    const longResult = await aiChat(longInput);

    expect(longResult.tokens_used).toBeGreaterThan(shortResult.tokens_used);
  });

  it('should throw error for non-existent session', async () => {
    const input = {
      ...basicInput,
      session_id: 'non-existent-session'
    };

    await expect(aiChat(input)).rejects.toThrow(/session not found/i);
  });

  it('should throw error for non-existent project', async () => {
    const input = {
      ...basicInput,
      session_id: testSession.id,
      project_id: 'non-existent-project'
    };

    await expect(aiChat(input)).rejects.toThrow(/project not found/i);
  });

  it('should throw error when project belongs to different session', async () => {
    // Create another session
    const otherSessionId = randomUUID();
    await db.insert(sessionsTable).values({
      id: otherSessionId,
      browser_fingerprint: 'other-fingerprint',
      ip_address: '127.0.0.1',
      user_agent: 'other-agent',
      status: 'active',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }).execute();

    const input = {
      ...basicInput,
      session_id: otherSessionId,
      project_id: testProject.id // This project belongs to testSession, not otherSession
    };

    await expect(aiChat(input)).rejects.toThrow(/project not found or does not belong to session/i);
  });

  it('should throw error when context files are provided without project', async () => {
    const input = {
      ...basicInput,
      session_id: testSession.id,
      context_files: [testFile.id]
    };

    await expect(aiChat(input)).rejects.toThrow(/project id is required when context files are specified/i);
  });

  it('should throw error for non-existent context files', async () => {
    const input = {
      ...basicInput,
      session_id: testSession.id,
      project_id: testProject.id,
      context_files: ['non-existent-file']
    };

    await expect(aiChat(input)).rejects.toThrow(/some context files not found/i);
  });

  it('should throw error when context file belongs to different project', async () => {
    // Create another project
    const otherProjectId = randomUUID();
    await db.insert(projectsTable).values({
      id: otherProjectId,
      name: 'Other Project',
      description: 'Another test project',
      type: 'react',
      session_id: testSession.id
    }).execute();

    const input = {
      ...basicInput,
      session_id: testSession.id,
      project_id: otherProjectId,
      context_files: [testFile.id] // This file belongs to testProject, not otherProject
    };

    await expect(aiChat(input)).rejects.toThrow(/some context files not found/i);
  });

  it('should ignore deleted files in context', async () => {
    // Mark file as deleted
    await db.update(filesTable)
      .set({ is_deleted: true })
      .where(eq(filesTable.id, testFile.id))
      .execute();

    const input = {
      ...basicInput,
      session_id: testSession.id,
      project_id: testProject.id,
      context_files: [testFile.id]
    };

    await expect(aiChat(input)).rejects.toThrow(/some context files not found/i);
  });

  it('should handle multiple context files correctly', async () => {
    // Create another file
    const secondFileId = randomUUID();
    await db.insert(filesTable).values({
      id: secondFileId,
      project_id: testProject.id,
      name: 'utils.js',
      path: '/src/utils.js',
      content: 'export function helper() { return "help"; }',
      type: 'js',
      size: 50
    }).execute();

    const input = {
      ...basicInput,
      session_id: testSession.id,
      project_id: testProject.id,
      context_files: [testFile.id, secondFileId]
    };

    const result = await aiChat(input);

    expect(result.context_files).toEqual([testFile.id, secondFileId]);
    expect(result.response).toContain('2 context file');
  });
});