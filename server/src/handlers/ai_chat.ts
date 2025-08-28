import { db } from '../db';
import { aiChatsTable, projectsTable, sessionsTable, filesTable } from '../db/schema';
import { type AiChatInput, type AiChat } from '../schema';
import { randomUUID } from 'crypto';
import { eq, and, inArray } from 'drizzle-orm';

export const aiChat = async (input: AiChatInput): Promise<AiChat> => {
  try {
    // Verify session exists
    const session = await db.select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, input.session_id))
      .execute();

    if (session.length === 0) {
      throw new Error('Session not found');
    }

    // If project_id is provided, verify it exists and belongs to the session
    if (input.project_id) {
      const project = await db.select()
        .from(projectsTable)
        .where(and(
          eq(projectsTable.id, input.project_id),
          eq(projectsTable.session_id, input.session_id)
        ))
        .execute();

      if (project.length === 0) {
        throw new Error('Project not found or does not belong to session');
      }
    }

    // If context_files are provided, verify they exist and belong to the project
    if (input.context_files && input.context_files.length > 0) {
      if (!input.project_id) {
        throw new Error('Project ID is required when context files are specified');
      }

      const contextFiles = await db.select()
        .from(filesTable)
        .where(and(
          eq(filesTable.project_id, input.project_id),
          inArray(filesTable.id, input.context_files),
          eq(filesTable.is_deleted, false)
        ))
        .execute();

      if (contextFiles.length !== input.context_files.length) {
        throw new Error('Some context files not found or do not belong to the project');
      }
    }

    const chatId = randomUUID();
    const model = input.model || 'gpt-4';
    
    // Simulate AI processing - in real implementation, this would call external AI APIs
    const response = generateAiResponse(input.message, model, input.context_files);
    const tokensUsed = calculateTokens(input.message, response);

    // Insert chat record into database
    const result = await db.insert(aiChatsTable)
      .values({
        id: chatId,
        session_id: input.session_id,
        project_id: input.project_id || null,
        message: input.message,
        response: response,
        model: model,
        tokens_used: tokensUsed,
        context_files: input.context_files || null
      })
      .returning()
      .execute();

    const chatRecord = result[0];
    
    // Return properly formatted chat object
    return {
      id: chatRecord.id,
      session_id: chatRecord.session_id,
      project_id: chatRecord.project_id,
      message: chatRecord.message,
      response: chatRecord.response,
      model: chatRecord.model,
      tokens_used: chatRecord.tokens_used,
      created_at: chatRecord.created_at,
      context_files: chatRecord.context_files as string[] | null
    };
  } catch (error) {
    console.error('AI chat processing failed:', error);
    throw error;
  }
};

// Helper function to generate AI response (placeholder implementation)
function generateAiResponse(message: string, model: string, contextFiles?: string[]): string {
  const hasContext = contextFiles && contextFiles.length > 0;
  
  if (message.toLowerCase().includes('help') || message.toLowerCase().includes('assist')) {
    return `I'm here to help you with your development task. Using ${model}, I can assist with code generation, debugging, refactoring, and answering technical questions.${hasContext ? ` I can see you've provided ${contextFiles!.length} context file(s) for reference.` : ''}`;
  }
  
  if (message.toLowerCase().includes('create') || message.toLowerCase().includes('generate')) {
    return `I'll help you create the code you need. Using ${model}, I can generate components, functions, and complete features.${hasContext ? ` Based on your project files, I'll ensure the generated code follows your existing patterns and style.` : ''}`;
  }
  
  if (message.toLowerCase().includes('debug') || message.toLowerCase().includes('error')) {
    return `I'll help you debug the issue. Using ${model}, I can analyze error messages, review code logic, and suggest fixes.${hasContext ? ` I'll examine your provided files to understand the context of the problem.` : ''}`;
  }
  
  return `I understand your request: "${message}". Using ${model}, I'll provide the best assistance possible.${hasContext ? ` I'll reference your ${contextFiles!.length} context file(s) to give you relevant, project-specific guidance.` : ' For more specific help, you can share relevant project files as context.'}`;
}

// Helper function to calculate token usage (placeholder implementation)
function calculateTokens(message: string, response: string): number {
  // Rough estimation: ~4 characters per token for English text
  const messageTokens = Math.ceil(message.length / 4);
  const responseTokens = Math.ceil(response.length / 4);
  return messageTokens + responseTokens;
}