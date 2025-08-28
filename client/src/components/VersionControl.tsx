import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { trpc } from '@/utils/trpc';
import type { Project, Version, CreateVersionInput } from '../../../server/src/schema';

interface VersionControlProps {
  project: Project;
  sessionId: string;
  onVersionRestore: () => void;
}

export function VersionControl({ project, sessionId, onVersionRestore }: VersionControlProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [commitData, setCommitData] = useState<{
    message: string;
    author: string;
  }>({
    message: '',
    author: 'Anonymous Developer'
  });

  const loadVersions = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await trpc.getVersions.query({ projectId: project.id });
      setVersions(result);
    } catch (error) {
      console.error('Failed to load versions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const versionInput: CreateVersionInput = {
        project_id: project.id,
        message: commitData.message,
        author: commitData.author,
        file_changes: [
          {
            file_id: 'demo-file',
            action: 'modified',
            content_before: 'previous content',
            content_after: 'new content'
          }
        ]
      };

      const newVersion = await trpc.createVersion.mutate(versionInput);
      setVersions((prev: Version[]) => [newVersion, ...prev]);
      setShowCreateDialog(false);
      setCommitData({
        message: '',
        author: commitData.author
      });
    } catch (error) {
      console.error('Failed to create version:', error);
    }
  };

  const handleRollback = async (versionId: string) => {
    try {
      await trpc.rollbackVersion.mutate({
        projectId: project.id,
        versionId,
        sessionId
      });
      onVersionRestore();
    } catch (error) {
      console.error('Failed to rollback version:', error);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created': return '✨';
      case 'modified': return '✏️';
      case 'deleted': return '🗑️';
      default: return '📝';
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'created': return 'bg-green-100 text-green-800';
      case 'modified': return 'bg-blue-100 text-blue-800';
      case 'deleted': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Mock versions for demonstration
  const mockVersions: Version[] = [
    {
      id: 'version-1',
      project_id: project.id,
      commit_hash: 'a1b2c3d4',
      message: 'Initial project setup with basic structure',
      author: 'Developer',
      created_at: new Date(Date.now() - 3600000),
      file_changes: [
        {
          file_id: 'index.html',
          action: 'created',
          content_before: null,
          content_after: '<!DOCTYPE html>...'
        },
        {
          file_id: 'styles.css',
          action: 'created',
          content_before: null,
          content_after: 'body { margin: 0; }'
        }
      ]
    },
    {
      id: 'version-2',
      project_id: project.id,
      commit_hash: 'b2c3d4e5',
      message: 'Added responsive navigation and hero section',
      author: 'Developer',
      created_at: new Date(Date.now() - 7200000),
      file_changes: [
        {
          file_id: 'index.html',
          action: 'modified',
          content_before: '<!DOCTYPE html>...',
          content_after: '<!DOCTYPE html>... with nav'
        },
        {
          file_id: 'navigation.js',
          action: 'created',
          content_before: null,
          content_after: 'function toggleNav() { ... }'
        }
      ]
    },
    {
      id: 'version-3',
      project_id: project.id,
      commit_hash: 'c3d4e5f6',
      message: 'Fixed mobile responsiveness issues',
      author: 'Developer',
      created_at: new Date(Date.now() - 10800000),
      file_changes: [
        {
          file_id: 'styles.css',
          action: 'modified',
          content_before: 'body { margin: 0; }',
          content_after: 'body { margin: 0; } @media...'
        }
      ]
    }
  ];

  const displayVersions = versions.length > 0 ? versions : mockVersions;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">📝 Version Control</h2>
          <p className="text-slate-600 mt-1">
            Track changes and manage different versions of your project
          </p>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
              📸 Create Snapshot
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>📸 Create Version Snapshot</DialogTitle>
              <DialogDescription>
                Save the current state of your project with a descriptive message
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateVersion} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Commit Message</label>
                <Textarea
                  placeholder="Describe what changed in this version..."
                  value={commitData.message}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setCommitData((prev) => ({ ...prev, message: e.target.value }))
                  }
                  required
                  rows={3}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Author</label>
                <Input
                  placeholder="Your name"
                  value={commitData.author}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setCommitData((prev) => ({ ...prev, author: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="flex space-x-2 pt-4">
                <Button type="submit" className="flex-1">
                  📸 Create Snapshot
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowCreateDialog(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Version History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <span>📚</span>
              <span>Version History</span>
              <Badge variant="secondary">{displayVersions.length} versions</Badge>
            </span>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="p-0">
          {isLoading && displayVersions.length === 0 ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>Loading version history...</p>
            </div>
          ) : displayVersions.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-xl font-semibold mb-2">No Versions Yet</h3>
              <p className="text-slate-600 mb-6">
                Create your first version snapshot to start tracking changes
              </p>
              <Button 
                onClick={() => setShowCreateDialog(true)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                📸 Create First Snapshot
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="p-4 space-y-4">
                {displayVersions.map((version: Version, index: number) => (
                  <Card key={version.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge className="bg-blue-100 text-blue-800 font-mono">
                              {version.commit_hash}
                            </Badge>
                            {index === 0 && (
                              <Badge className="bg-green-100 text-green-800">
                                Latest
                              </Badge>
                            )}
                            <span className="text-sm text-slate-500">
                              by {version.author}
                            </span>
                          </div>
                          
                          <h4 className="font-semibold text-slate-900 mb-1">
                            {version.message}
                          </h4>
                          
                          <p className="text-sm text-slate-500">
                            {version.created_at.toLocaleString()}
                          </p>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {index !== 0 && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  🔄 Restore
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Restore Version</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to restore to this version? 
                                    This will overwrite your current changes.
                                    <br /><br />
                                    <strong>Commit:</strong> {version.commit_hash}<br />
                                    <strong>Message:</strong> {version.message}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleRollback(version.id)}
                                    className="bg-blue-600 hover:bg-blue-700"
                                  >
                                    Restore Version
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                      
                      {/* File Changes */}
                      <div className="space-y-2">
                        <h5 className="text-sm font-medium text-slate-700">
                          📄 Changed Files ({version.file_changes.length})
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {version.file_changes.map((change, changeIndex) => (
                            <div
                              key={changeIndex}
                              className="flex items-center space-x-2 p-2 bg-slate-50 rounded-md"
                            >
                              <span>{getActionIcon(change.action)}</span>
                              <Badge className={`text-xs ${getActionColor(change.action)}`}>
                                {change.action}
                              </Badge>
                              <span className="text-sm font-mono flex-1 truncate">
                                {change.file_id}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Version Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl mb-2">📊</div>
              <h4 className="font-semibold">Total Versions</h4>
              <p className="text-2xl font-bold text-blue-600">{displayVersions.length}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl mb-2">✏️</div>
              <h4 className="font-semibold">Total Changes</h4>
              <p className="text-2xl font-bold text-green-600">
                {displayVersions.reduce((sum, v) => sum + v.file_changes.length, 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl mb-2">👨‍💻</div>
              <h4 className="font-semibold">Contributors</h4>
              <p className="text-2xl font-bold text-purple-600">
                {new Set(displayVersions.map(v => v.author)).size}
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl mb-2">⏱️</div>
              <h4 className="font-semibold">Last Updated</h4>
              <p className="text-sm font-medium text-slate-600">
                {displayVersions.length > 0 
                  ? displayVersions[0].created_at.toLocaleDateString()
                  : 'Never'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}