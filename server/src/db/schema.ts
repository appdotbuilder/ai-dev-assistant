import { serial, text, pgTable, timestamp, boolean, integer, json, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const projectTypeEnum = pgEnum('project_type', ['react', 'vanilla', 'vue', 'angular', 'node']);
export const fileTypeEnum = pgEnum('file_type', ['js', 'ts', 'jsx', 'tsx', 'css', 'scss', 'html', 'json', 'md']);
export const sessionStatusEnum = pgEnum('session_status', ['active', 'inactive', 'expired']);
export const collaborationRoleEnum = pgEnum('collaboration_role', ['owner', 'editor', 'viewer']);
export const deploymentStatusEnum = pgEnum('deployment_status', ['pending', 'building', 'deployed', 'failed']);
export const aiModelEnum = pgEnum('ai_model', ['gpt-4', 'claude-3', 'gemini-pro', 'custom']);

// Sessions table - core entity for anonymous users
export const sessionsTable = pgTable('sessions', {
  id: text('id').primaryKey(),
  browser_fingerprint: text('browser_fingerprint').notNull(),
  ip_address: text('ip_address').notNull(),
  user_agent: text('user_agent').notNull(),
  status: sessionStatusEnum('status').notNull().default('active'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  last_activity: timestamp('last_activity').defaultNow().notNull(),
  expires_at: timestamp('expires_at').notNull(),
  metadata: json('metadata')
});

// Projects table
export const projectsTable = pgTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  type: projectTypeEnum('type').notNull(),
  template_id: text('template_id'),
  session_id: text('session_id').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  is_public: boolean('is_public').notNull().default(false),
  preview_url: text('preview_url'),
  deployment_url: text('deployment_url')
});

// Files table
export const filesTable = pgTable('files', {
  id: text('id').primaryKey(),
  project_id: text('project_id').notNull(),
  name: text('name').notNull(),
  path: text('path').notNull(),
  content: text('content').notNull(),
  type: fileTypeEnum('type').notNull(),
  size: integer('size').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  is_deleted: boolean('is_deleted').notNull().default(false)
});

// AI Chat table
export const aiChatsTable = pgTable('ai_chats', {
  id: text('id').primaryKey(),
  session_id: text('session_id').notNull(),
  project_id: text('project_id'),
  message: text('message').notNull(),
  response: text('response').notNull(),
  model: aiModelEnum('model').notNull(),
  tokens_used: integer('tokens_used').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  context_files: json('context_files')
});

// Versions table (for version control)
export const versionsTable = pgTable('versions', {
  id: text('id').primaryKey(),
  project_id: text('project_id').notNull(),
  commit_hash: text('commit_hash').notNull(),
  message: text('message').notNull(),
  author: text('author').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  file_changes: json('file_changes').notNull()
});

// Collaboration table
export const collaborationsTable = pgTable('collaborations', {
  id: text('id').primaryKey(),
  project_id: text('project_id').notNull(),
  session_id: text('session_id').notNull(),
  role: collaborationRoleEnum('role').notNull(),
  invited_at: timestamp('invited_at').defaultNow().notNull(),
  last_active: timestamp('last_active'),
  permissions: json('permissions').notNull()
});

// Deployments table
export const deploymentsTable = pgTable('deployments', {
  id: text('id').primaryKey(),
  project_id: text('project_id').notNull(),
  version_id: text('version_id').notNull(),
  status: deploymentStatusEnum('status').notNull(),
  url: text('url'),
  build_logs: text('build_logs'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  deployed_at: timestamp('deployed_at'),
  config: json('config')
});

// Templates table
export const templatesTable = pgTable('templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  type: projectTypeEnum('type').notNull(),
  files: json('files').notNull(),
  tags: json('tags').notNull(),
  is_featured: boolean('is_featured').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  usage_count: integer('usage_count').notNull().default(0)
});

// Relations
export const sessionsRelations = relations(sessionsTable, ({ many }) => ({
  projects: many(projectsTable),
  aiChats: many(aiChatsTable),
  collaborations: many(collaborationsTable)
}));

export const projectsRelations = relations(projectsTable, ({ one, many }) => ({
  session: one(sessionsTable, {
    fields: [projectsTable.session_id],
    references: [sessionsTable.id]
  }),
  template: one(templatesTable, {
    fields: [projectsTable.template_id],
    references: [templatesTable.id]
  }),
  files: many(filesTable),
  versions: many(versionsTable),
  collaborations: many(collaborationsTable),
  deployments: many(deploymentsTable),
  aiChats: many(aiChatsTable)
}));

export const filesRelations = relations(filesTable, ({ one }) => ({
  project: one(projectsTable, {
    fields: [filesTable.project_id],
    references: [projectsTable.id]
  })
}));

export const aiChatsRelations = relations(aiChatsTable, ({ one }) => ({
  session: one(sessionsTable, {
    fields: [aiChatsTable.session_id],
    references: [sessionsTable.id]
  }),
  project: one(projectsTable, {
    fields: [aiChatsTable.project_id],
    references: [projectsTable.id]
  })
}));

export const versionsRelations = relations(versionsTable, ({ one, many }) => ({
  project: one(projectsTable, {
    fields: [versionsTable.project_id],
    references: [projectsTable.id]
  }),
  deployments: many(deploymentsTable)
}));

export const collaborationsRelations = relations(collaborationsTable, ({ one }) => ({
  project: one(projectsTable, {
    fields: [collaborationsTable.project_id],
    references: [projectsTable.id]
  }),
  session: one(sessionsTable, {
    fields: [collaborationsTable.session_id],
    references: [sessionsTable.id]
  })
}));

export const deploymentsRelations = relations(deploymentsTable, ({ one }) => ({
  project: one(projectsTable, {
    fields: [deploymentsTable.project_id],
    references: [projectsTable.id]
  }),
  version: one(versionsTable, {
    fields: [deploymentsTable.version_id],
    references: [versionsTable.id]
  })
}));

export const templatesRelations = relations(templatesTable, ({ many }) => ({
  projects: many(projectsTable)
}));

// TypeScript types for the table schemas
export type Session = typeof sessionsTable.$inferSelect;
export type NewSession = typeof sessionsTable.$inferInsert;

export type Project = typeof projectsTable.$inferSelect;
export type NewProject = typeof projectsTable.$inferInsert;

export type File = typeof filesTable.$inferSelect;
export type NewFile = typeof filesTable.$inferInsert;

export type AiChat = typeof aiChatsTable.$inferSelect;
export type NewAiChat = typeof aiChatsTable.$inferInsert;

export type Version = typeof versionsTable.$inferSelect;
export type NewVersion = typeof versionsTable.$inferInsert;

export type Collaboration = typeof collaborationsTable.$inferSelect;
export type NewCollaboration = typeof collaborationsTable.$inferInsert;

export type Deployment = typeof deploymentsTable.$inferSelect;
export type NewDeployment = typeof deploymentsTable.$inferInsert;

export type Template = typeof templatesTable.$inferSelect;
export type NewTemplate = typeof templatesTable.$inferInsert;

// Export all tables for proper query building
export const tables = {
  sessions: sessionsTable,
  projects: projectsTable,
  files: filesTable,
  aiChats: aiChatsTable,
  versions: versionsTable,
  collaborations: collaborationsTable,
  deployments: deploymentsTable,
  templates: templatesTable
};