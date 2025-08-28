import { z } from 'zod';

// Enums for various system entities
export const projectTypeEnum = z.enum(['react', 'vanilla', 'vue', 'angular', 'node']);
export const fileTypeEnum = z.enum(['js', 'ts', 'jsx', 'tsx', 'css', 'scss', 'html', 'json', 'md']);
export const sessionStatusEnum = z.enum(['active', 'inactive', 'expired']);
export const collaborationRoleEnum = z.enum(['owner', 'editor', 'viewer']);
export const deploymentStatusEnum = z.enum(['pending', 'building', 'deployed', 'failed']);
export const aiModelEnum = z.enum(['gpt-4', 'claude-3', 'gemini-pro', 'custom']);

// Project schema
export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  type: projectTypeEnum,
  template_id: z.string().nullable(),
  session_id: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  is_public: z.boolean(),
  preview_url: z.string().nullable(),
  deployment_url: z.string().nullable()
});

export type Project = z.infer<typeof projectSchema>;

// File schema
export const fileSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  path: z.string(),
  content: z.string(),
  type: fileTypeEnum,
  size: z.number().int(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  is_deleted: z.boolean()
});

export type File = z.infer<typeof fileSchema>;

// Session schema
export const sessionSchema = z.object({
  id: z.string(),
  browser_fingerprint: z.string(),
  ip_address: z.string(),
  user_agent: z.string(),
  status: sessionStatusEnum,
  created_at: z.coerce.date(),
  last_activity: z.coerce.date(),
  expires_at: z.coerce.date(),
  metadata: z.record(z.any()).nullable()
});

export type Session = z.infer<typeof sessionSchema>;

// AI Chat schema
export const aiChatSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  project_id: z.string().nullable(),
  message: z.string(),
  response: z.string(),
  model: aiModelEnum,
  tokens_used: z.number().int(),
  created_at: z.coerce.date(),
  context_files: z.array(z.string()).nullable()
});

export type AiChat = z.infer<typeof aiChatSchema>;

// Version control schema
export const versionSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  commit_hash: z.string(),
  message: z.string(),
  author: z.string(),
  created_at: z.coerce.date(),
  file_changes: z.array(z.object({
    file_id: z.string(),
    action: z.enum(['created', 'modified', 'deleted']),
    content_before: z.string().nullable(),
    content_after: z.string().nullable()
  }))
});

export type Version = z.infer<typeof versionSchema>;

// Collaboration schema
export const collaborationSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  session_id: z.string(),
  role: collaborationRoleEnum,
  invited_at: z.coerce.date(),
  last_active: z.coerce.date().nullable(),
  permissions: z.array(z.string())
});

export type Collaboration = z.infer<typeof collaborationSchema>;

// Deployment schema
export const deploymentSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  version_id: z.string(),
  status: deploymentStatusEnum,
  url: z.string().nullable(),
  build_logs: z.string().nullable(),
  created_at: z.coerce.date(),
  deployed_at: z.coerce.date().nullable(),
  config: z.record(z.any()).nullable()
});

export type Deployment = z.infer<typeof deploymentSchema>;

// Template schema
export const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: projectTypeEnum,
  files: z.array(z.object({
    path: z.string(),
    content: z.string(),
    type: fileTypeEnum
  })),
  tags: z.array(z.string()),
  is_featured: z.boolean(),
  created_at: z.coerce.date(),
  usage_count: z.number().int()
});

export type Template = z.infer<typeof templateSchema>;

// Input schemas
export const createProjectInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  type: projectTypeEnum,
  template_id: z.string().optional(),
  session_id: z.string()
});

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;

export const updateProjectInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  is_public: z.boolean().optional()
});

export type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>;

export const createFileInputSchema = z.object({
  project_id: z.string(),
  name: z.string().min(1).max(255),
  path: z.string(),
  content: z.string(),
  type: fileTypeEnum
});

export type CreateFileInput = z.infer<typeof createFileInputSchema>;

export const updateFileInputSchema = z.object({
  id: z.string(),
  content: z.string().optional(),
  name: z.string().min(1).max(255).optional(),
  path: z.string().optional()
});

export type UpdateFileInput = z.infer<typeof updateFileInputSchema>;

export const createSessionInputSchema = z.object({
  browser_fingerprint: z.string(),
  ip_address: z.string(),
  user_agent: z.string(),
  metadata: z.record(z.any()).optional()
});

export type CreateSessionInput = z.infer<typeof createSessionInputSchema>;

export const aiChatInputSchema = z.object({
  session_id: z.string(),
  project_id: z.string().optional(),
  message: z.string().min(1),
  model: aiModelEnum.optional(),
  context_files: z.array(z.string()).optional()
});

export type AiChatInput = z.infer<typeof aiChatInputSchema>;

export const createVersionInputSchema = z.object({
  project_id: z.string(),
  message: z.string().min(1),
  author: z.string(),
  file_changes: z.array(z.object({
    file_id: z.string(),
    action: z.enum(['created', 'modified', 'deleted']),
    content_before: z.string().nullable(),
    content_after: z.string().nullable()
  }))
});

export type CreateVersionInput = z.infer<typeof createVersionInputSchema>;

export const createDeploymentInputSchema = z.object({
  project_id: z.string(),
  version_id: z.string(),
  config: z.record(z.any()).optional()
});

export type CreateDeploymentInput = z.infer<typeof createDeploymentInputSchema>;

export const shareProjectInputSchema = z.object({
  project_id: z.string(),
  session_id: z.string(),
  role: collaborationRoleEnum,
  permissions: z.array(z.string()).optional()
});

export type ShareProjectInput = z.infer<typeof shareProjectInputSchema>;