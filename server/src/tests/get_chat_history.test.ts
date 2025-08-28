import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { sessionsTable, projectsTable, aiChatsTable } from '../db/schema';
import { getChatHistory } from '../handlers/get_chat_history';

// Test data
const testSession = {
  id: 'test-session-1',
  browser_fingerprint: 'test-fingerprint',
  ip_address: '127.0.0.1',
  user_agent: 'test-agent',
  status: 'active' as const,
  expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
  metadata: null
};

const testProject = {
  id: 'test-project-1',
  name: 'Test Project',
  description: 'A test project',
  type: 'react' as const,
  template_id: null,
  session_id: 'test-session-1',
  is_public: false,
  preview_url: null,
  deployment_url: null
};

const testChatMessages = [
  {
    id: 'chat-1',
    session_id: 'test-session-1',
    project_id: 'test-project-1',
    message: 'How do I create a React component?',
    response: 'Here is how you create a React component...',
    model: 'gpt-4' as const,
    tokens_used: 150,
    context_files: ['src/App.tsx']
  },
  {
    id: 'chat-2',
    session_id: 'test-session-1',
    project_id: 'test-project-1',
    message: 'Can you help me with CSS styling?',
    response: 'Sure! Here are some CSS tips...',
    model: 'claude-3' as const,
    tokens_used: 120,
    context_files: ['src/styles.css']
  },
  {
    id: 'chat-3',
    session_id: 'test-session-1',
    project_id: null,
    message: 'General programming question',
    response: 'Here is a general answer...',
    model: 'gpt-4' as const,
    tokens_used: 80,
    context_files: null
  }
];

describe('getChatHistory', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should retrieve chat history for a session', async () => {
    // Create prerequisite data
    await db.insert(sessionsTable).values(testSession).execute();
    await db.insert(projectsTable).values(testProject).execute();
    await db.insert(aiChatsTable).values(testChatMessages).execute();

    const result = await getChatHistory('test-session-1');

    expect(result).toHaveLength(3);
    expect(result[0].session_id).toEqual('test-session-1');
    expect(result[0].message).toBeDefined();
    expect(result[0].response).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should filter by project when projectId is provided', async () => {
    // Create prerequisite data
    await db.insert(sessionsTable).values(testSession).execute();
    await db.insert(projectsTable).values(testProject).execute();
    await db.insert(aiChatsTable).values(testChatMessages).execute();

    const result = await getChatHistory('test-session-1', 'test-project-1');

    expect(result).toHaveLength(2);
    result.forEach(chat => {
      expect(chat.project_id).toEqual('test-project-1');
      expect(chat.session_id).toEqual('test-session-1');
    });
  });

  it('should include chats with null project_id when no project filter applied', async () => {
    // Create prerequisite data
    await db.insert(sessionsTable).values(testSession).execute();
    await db.insert(projectsTable).values(testProject).execute();
    await db.insert(aiChatsTable).values(testChatMessages).execute();

    const result = await getChatHistory('test-session-1');

    const generalChat = result.find(chat => chat.project_id === null);
    expect(generalChat).toBeDefined();
    expect(generalChat?.message).toEqual('General programming question');
  });

  it('should respect session privacy boundaries', async () => {
    // Create additional session and chat
    const otherSession = {
      ...testSession,
      id: 'other-session',
      browser_fingerprint: 'other-fingerprint'
    };

    const otherSessionChat = {
      ...testChatMessages[0],
      id: 'other-chat',
      session_id: 'other-session',
      message: 'Private message from other session'
    };

    // Create prerequisite data
    await db.insert(sessionsTable).values([testSession, otherSession]).execute();
    await db.insert(projectsTable).values(testProject).execute();
    await db.insert(aiChatsTable).values([...testChatMessages, otherSessionChat]).execute();

    const result = await getChatHistory('test-session-1');

    expect(result).toHaveLength(3);
    result.forEach(chat => {
      expect(chat.session_id).toEqual('test-session-1');
      expect(chat.message).not.toEqual('Private message from other session');
    });
  });

  it('should support pagination with limit and offset', async () => {
    // Create prerequisite data
    await db.insert(sessionsTable).values(testSession).execute();
    await db.insert(projectsTable).values(testProject).execute();
    await db.insert(aiChatsTable).values(testChatMessages).execute();

    // Test pagination
    const firstPage = await getChatHistory('test-session-1', undefined, { limit: 2, offset: 0 });
    const secondPage = await getChatHistory('test-session-1', undefined, { limit: 2, offset: 2 });

    expect(firstPage).toHaveLength(2);
    expect(secondPage).toHaveLength(1);

    // Ensure no overlap between pages
    const firstPageIds = firstPage.map(chat => chat.id);
    const secondPageIds = secondPage.map(chat => chat.id);
    expect(firstPageIds).not.toContain(secondPageIds[0]);
  });

  it('should return results ordered by created_at descending (most recent first)', async () => {
    // Create prerequisite data with specific timestamps
    await db.insert(sessionsTable).values(testSession).execute();
    await db.insert(projectsTable).values(testProject).execute();

    const now = new Date();
    const chatsWithTimestamps = testChatMessages.map((chat, index) => ({
      ...chat,
      created_at: new Date(now.getTime() + (index * 1000)) // Each chat 1 second apart
    }));

    await db.insert(aiChatsTable).values(chatsWithTimestamps).execute();

    const result = await getChatHistory('test-session-1');

    expect(result).toHaveLength(3);
    // Results should be in descending order (most recent first)
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].created_at.getTime()).toBeGreaterThanOrEqual(
        result[i].created_at.getTime()
      );
    }
  });

  it('should return empty array for non-existent session', async () => {
    const result = await getChatHistory('non-existent-session');
    
    expect(result).toHaveLength(0);
  });

  it('should handle empty project filter correctly', async () => {
    // Create prerequisite data
    await db.insert(sessionsTable).values(testSession).execute();
    await db.insert(projectsTable).values(testProject).execute();
    await db.insert(aiChatsTable).values(testChatMessages).execute();

    // Test with empty string (should be treated as filter)
    const result = await getChatHistory('test-session-1', '');

    // Should find no chats with empty string as project_id
    expect(result).toHaveLength(0);
  });

  it('should use default pagination values when not specified', async () => {
    // Create prerequisite data
    await db.insert(sessionsTable).values(testSession).execute();
    await db.insert(projectsTable).values(testProject).execute();
    await db.insert(aiChatsTable).values(testChatMessages).execute();

    const result = await getChatHistory('test-session-1');

    // Should return all results (under default limit of 50)
    expect(result).toHaveLength(3);
  });
});