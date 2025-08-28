import { db } from '../db';
import { projectsTable, versionsTable, filesTable } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const rollbackVersion = async (projectId: string, versionId: string, sessionId: string): Promise<boolean> => {
  try {
    // 1. Verify the project exists and belongs to the session
    const projects = await db.select()
      .from(projectsTable)
      .where(and(
        eq(projectsTable.id, projectId),
        eq(projectsTable.session_id, sessionId)
      ))
      .execute();

    if (projects.length === 0) {
      throw new Error('Project not found or access denied');
    }

    // 2. Get the target version to rollback to
    const targetVersions = await db.select()
      .from(versionsTable)
      .where(and(
        eq(versionsTable.id, versionId),
        eq(versionsTable.project_id, projectId)
      ))
      .execute();

    if (targetVersions.length === 0) {
      throw new Error('Version not found');
    }

    const targetVersion = targetVersions[0];
    const fileChanges = targetVersion.file_changes as Array<{
      file_id: string;
      action: 'created' | 'modified' | 'deleted';
      content_before: string | null;
      content_after: string | null;
    }>;

    // 3. Get current files for creating rollback version entry (including deleted ones)
    const currentFiles = await db.select()
      .from(filesTable)
      .where(eq(filesTable.project_id, projectId))
      .execute();

    // 4. Apply rollback changes to files
    const rollbackChanges: Array<{
      file_id: string;
      action: 'created' | 'modified' | 'deleted';
      content_before: string | null;
      content_after: string | null;
    }> = [];

    for (const change of fileChanges) {
      const currentFile = currentFiles.find(f => f.id === change.file_id);

      if (change.action === 'created') {
        // Original action was create, so rollback should delete
        if (currentFile) {
          await db.update(filesTable)
            .set({ 
              is_deleted: true,
              updated_at: new Date()
            })
            .where(eq(filesTable.id, change.file_id))
            .execute();

          rollbackChanges.push({
            file_id: change.file_id,
            action: 'deleted',
            content_before: currentFile.content,
            content_after: null
          });
        }
      } else if (change.action === 'modified') {
        // Original action was modify, rollback to content_before
        if (currentFile && change.content_before !== null) {
          await db.update(filesTable)
            .set({ 
              content: change.content_before,
              size: change.content_before.length,
              updated_at: new Date()
            })
            .where(eq(filesTable.id, change.file_id))
            .execute();

          rollbackChanges.push({
            file_id: change.file_id,
            action: 'modified',
            content_before: currentFile.content,
            content_after: change.content_before
          });
        }
      } else if (change.action === 'deleted') {
        // Original action was delete, rollback should restore
        if (change.content_before !== null) {
          // Check if file exists in database (including deleted ones)
          const existingFiles = await db.select()
            .from(filesTable)
            .where(eq(filesTable.id, change.file_id))
            .execute();

          if (existingFiles.length > 0) {
            // File exists but is marked deleted, restore it
            await db.update(filesTable)
              .set({ 
                content: change.content_before,
                size: change.content_before.length,
                is_deleted: false,
                updated_at: new Date()
              })
              .where(eq(filesTable.id, change.file_id))
              .execute();
          } else {
            // File doesn't exist at all, need to recreate it
            // Get file info from another version or use defaults
            const allVersions = await db.select()
              .from(versionsTable)
              .where(eq(versionsTable.project_id, projectId))
              .execute();

            // Find file details from version history
            let fileName = 'restored_file';
            let filePath = '/restored_file';
            let fileType: 'js' | 'ts' | 'jsx' | 'tsx' | 'css' | 'scss' | 'html' | 'json' | 'md' = 'js';

            for (const version of allVersions) {
              const versionChanges = version.file_changes as Array<{
                file_id: string;
                action: string;
                content_before?: string | null;
                content_after?: string | null;
                file_name?: string;
                file_path?: string;
                file_type?: string;
              }>;

              const fileChange = versionChanges.find(c => c.file_id === change.file_id);
              if (fileChange) {
                // Try to extract file info from the change or use sensible defaults
                fileName = fileChange.file_name || `file_${change.file_id.slice(0, 8)}`;
                filePath = fileChange.file_path || `/${fileName}`;
                
                // Determine file type from extension
                const ext = fileName.split('.').pop()?.toLowerCase();
                if (ext && ['js', 'ts', 'jsx', 'tsx', 'css', 'scss', 'html', 'json', 'md'].includes(ext)) {
                  fileType = ext as typeof fileType;
                }
                break;
              }
            }

            await db.insert(filesTable)
              .values({
                id: change.file_id,
                project_id: projectId,
                name: fileName,
                path: filePath,
                content: change.content_before,
                type: fileType,
                size: change.content_before.length,
                created_at: new Date(),
                updated_at: new Date(),
                is_deleted: false
              })
              .execute();
          }

          rollbackChanges.push({
            file_id: change.file_id,
            action: 'created',
            content_before: null,
            content_after: change.content_before
          });
        }
      }
    }

    // 5. Create new version entry for the rollback operation
    const rollbackVersionId = randomUUID();
    const commitHash = `rollback-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    await db.insert(versionsTable)
      .values({
        id: rollbackVersionId,
        project_id: projectId,
        commit_hash: commitHash,
        message: `Rollback to version: ${targetVersion.message}`,
        author: 'system',
        created_at: new Date(),
        file_changes: rollbackChanges
      })
      .execute();

    // 6. Update project's updated_at timestamp
    await db.update(projectsTable)
      .set({ updated_at: new Date() })
      .where(eq(projectsTable.id, projectId))
      .execute();

    return true;
  } catch (error) {
    console.error('Version rollback failed:', error);
    throw error;
  }
};