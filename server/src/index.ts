import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createSessionInputSchema,
  createProjectInputSchema,
  updateProjectInputSchema,
  createFileInputSchema,
  updateFileInputSchema,
  aiChatInputSchema,
  createVersionInputSchema,
  createDeploymentInputSchema,
  shareProjectInputSchema
} from './schema';

// Import handlers
import { createSession } from './handlers/create_session';
import { getSession } from './handlers/get_session';
import { createProject } from './handlers/create_project';
import { getProjects } from './handlers/get_projects';
import { updateProject } from './handlers/update_project';
import { deleteProject } from './handlers/delete_project';
import { createFile } from './handlers/create_file';
import { updateFile } from './handlers/update_file';
import { getFiles } from './handlers/get_files';
import { deleteFile } from './handlers/delete_file';
import { aiChat } from './handlers/ai_chat';
import { getChatHistory } from './handlers/get_chat_history';
import { createVersion } from './handlers/create_version';
import { getVersions } from './handlers/get_versions';
import { rollbackVersion } from './handlers/rollback_version';
import { shareProject } from './handlers/share_project';
import { getCollaborations } from './handlers/get_collaborations';
import { createDeployment } from './handlers/create_deployment';
import { getDeployments } from './handlers/get_deployments';
import { getTemplates } from './handlers/get_templates';
import { createTemplate } from './handlers/create_template';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      service: 'Cloud AI Web Development Assistant'
    };
  }),

  // Session Management
  createSession: publicProcedure
    .input(createSessionInputSchema)
    .mutation(({ input }) => createSession(input)),

  getSession: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(({ input }) => getSession(input.sessionId)),

  // Project Management
  createProject: publicProcedure
    .input(createProjectInputSchema)
    .mutation(({ input }) => createProject(input)),

  getProjects: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(({ input }) => getProjects(input.sessionId)),

  updateProject: publicProcedure
    .input(updateProjectInputSchema)
    .mutation(({ input }) => updateProject(input)),

  deleteProject: publicProcedure
    .input(z.object({ projectId: z.string(), sessionId: z.string() }))
    .mutation(({ input }) => deleteProject(input.projectId, input.sessionId)),

  // File Management
  createFile: publicProcedure
    .input(createFileInputSchema)
    .mutation(({ input }) => createFile(input)),

  updateFile: publicProcedure
    .input(updateFileInputSchema)
    .mutation(({ input }) => updateFile(input)),

  getFiles: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ input }) => getFiles(input.projectId)),

  deleteFile: publicProcedure
    .input(z.object({ fileId: z.string(), sessionId: z.string() }))
    .mutation(({ input }) => deleteFile(input.fileId, input.sessionId)),

  // AI Chat & Code Generation
  aiChat: publicProcedure
    .input(aiChatInputSchema)
    .mutation(({ input }) => aiChat(input)),

  getChatHistory: publicProcedure
    .input(z.object({ 
      sessionId: z.string(), 
      projectId: z.string().optional() 
    }))
    .query(({ input }) => getChatHistory(input.sessionId, input.projectId)),

  // Version Control
  createVersion: publicProcedure
    .input(createVersionInputSchema)
    .mutation(({ input }) => createVersion(input)),

  getVersions: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ input }) => getVersions(input.projectId)),

  rollbackVersion: publicProcedure
    .input(z.object({ 
      projectId: z.string(), 
      versionId: z.string(), 
      sessionId: z.string() 
    }))
    .mutation(({ input }) => rollbackVersion(input.projectId, input.versionId, input.sessionId)),

  // Collaboration
  shareProject: publicProcedure
    .input(shareProjectInputSchema)
    .mutation(({ input }) => shareProject(input)),

  getCollaborations: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ input }) => getCollaborations(input.projectId)),

  // Deployment
  createDeployment: publicProcedure
    .input(createDeploymentInputSchema)
    .mutation(({ input }) => createDeployment(input)),

  getDeployments: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ input }) => getDeployments(input.projectId)),

  // Templates
  getTemplates: publicProcedure
    .query(() => getTemplates()),

  createTemplate: publicProcedure
    .input(z.object({
      projectId: z.string(),
      name: z.string(),
      description: z.string(),
      tags: z.array(z.string())
    }))
    .mutation(({ input }) => createTemplate(
      input.projectId, 
      input.name, 
      input.description, 
      input.tags
    ))
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      // CORS configuration for web development tools
      cors({
        origin: [
          'http://localhost:3000',
          'http://localhost:5173',
          'https://dev.example.com',
          /\.vercel\.app$/,
          /\.netlify\.app$/
        ],
        credentials: true,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id']
      })(req, res, next);
    },
    router: appRouter,
    createContext() {
      // Context could include session validation, rate limiting, etc.
      return {
        timestamp: new Date().toISOString(),
        requestId: Math.random().toString(36).substring(7)
      };
    },
  });
  
  server.listen(port);
  console.log(`🚀 Cloud AI Web Development Assistant API`);
  console.log(`📡 TRPC server listening at port: ${port}`);
  console.log(`🔗 Endpoint: http://localhost:${port}`);
  console.log(`📋 Features: AI Chat, Live Preview, Version Control, Collaboration`);
}

start().catch(console.error);