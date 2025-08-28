import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { trpc } from '@/utils/trpc';
import type { Project, Collaboration as CollaborationType, ShareProjectInput } from '../../../server/src/schema';

interface CollaborationProps {
  project: Project;
  sessionId: string;
}

export function Collaboration({ project, sessionId }: CollaborationProps) {
  const [collaborations, setCollaborations] = useState<CollaborationType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareData, setShareData] = useState<{
    role: 'owner' | 'editor' | 'viewer';
    permissions: string[];
  }>({
    role: 'viewer',
    permissions: ['read']
  });

  const loadCollaborations = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await trpc.getCollaborations.query({ projectId: project.id });
      setCollaborations(result);
    } catch (error) {
      console.error('Failed to load collaborations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    loadCollaborations();
    generateShareUrl();
  }, [loadCollaborations]);

  const generateShareUrl = () => {
    const baseUrl = window.location.origin;
    const projectUrl = `${baseUrl}/project/${project.id}?share=${btoa(sessionId)}`;
    setShareUrl(projectUrl);
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const shareInput: ShareProjectInput = {
        project_id: project.id,
        session_id: sessionId,
        role: shareData.role,
        permissions: shareData.permissions
      };

      await trpc.shareProject.mutate(shareInput);
      await loadCollaborations();
      setShowShareDialog(false);
    } catch (error) {
      console.error('Failed to share project:', error);
    }
  };

  const copyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    // In a real app, show toast notification
    alert('Share URL copied to clipboard!');
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return '👑';
      case 'editor': return '✏️';
      case 'viewer': return '👀';
      default: return '👤';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-yellow-100 text-yellow-800';
      case 'editor': return 'bg-blue-100 text-blue-800';
      case 'viewer': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPermissionIcon = (permission: string) => {
    switch (permission) {
      case 'read': return '📖';
      case 'write': return '✏️';
      case 'delete': return '🗑️';
      case 'share': return '🔗';
      case 'admin': return '⚙️';
      default: return '📋';
    }
  };

  // Mock collaborations for demonstration
  const mockCollaborations: CollaborationType[] = [
    {
      id: 'collab-1',
      project_id: project.id,
      session_id: sessionId,
      role: 'owner',
      invited_at: new Date(Date.now() - 86400000),
      last_active: new Date(Date.now() - 1800000),
      permissions: ['read', 'write', 'delete', 'share', 'admin']
    },
    {
      id: 'collab-2',
      project_id: project.id,
      session_id: 'session-2',
      role: 'editor',
      invited_at: new Date(Date.now() - 43200000),
      last_active: new Date(Date.now() - 3600000),
      permissions: ['read', 'write']
    },
    {
      id: 'collab-3',
      project_id: project.id,
      session_id: 'session-3',
      role: 'viewer',
      invited_at: new Date(Date.now() - 21600000),
      last_active: new Date(Date.now() - 7200000),
      permissions: ['read']
    }
  ];

  const displayCollaborations = collaborations.length > 0 ? collaborations : mockCollaborations;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">👥 Collaboration</h2>
          <p className="text-slate-600 mt-1">
            Share your project and work together with others in real-time
          </p>
        </div>
        
        <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700">
              🔗 Share Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>🔗 Share Project</DialogTitle>
              <DialogDescription>
                Invite others to collaborate on your project
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleShare} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Share URL</label>
                <div className="flex space-x-2">
                  <Input
                    value={shareUrl}
                    readOnly
                    className="flex-1 bg-slate-50"
                  />
                  <Button type="button" variant="outline" onClick={copyShareUrl}>
                    📋 Copy
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Default Role</label>
                <Select 
                  value={shareData.role} 
                  onValueChange={(value: 'owner' | 'editor' | 'viewer') =>
                    setShareData((prev) => ({ 
                      ...prev, 
                      role: value,
                      permissions: value === 'owner' ? ['read', 'write', 'delete', 'share', 'admin'] :
                                  value === 'editor' ? ['read', 'write'] : ['read']
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">👀 Viewer - Can view only</SelectItem>
                    <SelectItem value="editor">✏️ Editor - Can edit files</SelectItem>
                    <SelectItem value="owner">👑 Owner - Full access</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Permissions</label>
                <div className="space-y-2">
                  {['read', 'write', 'delete', 'share', 'admin'].map((permission) => (
                    <div key={permission} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span>{getPermissionIcon(permission)}</span>
                        <span className="capitalize">{permission}</span>
                      </div>
                      <Switch
                        checked={shareData.permissions.includes(permission)}
                        disabled={shareData.role === 'owner' || 
                                 (shareData.role === 'viewer' && permission !== 'read') ||
                                 (shareData.role === 'editor' && !['read', 'write'].includes(permission))}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setShareData((prev) => ({
                              ...prev,
                              permissions: [...prev.permissions, permission]
                            }));
                          } else {
                            setShareData((prev) => ({
                              ...prev,
                              permissions: prev.permissions.filter(p => p !== permission)
                            }));
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex space-x-2 pt-4">
                <Button type="submit" className="flex-1">
                  🔗 Share Project
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowShareDialog(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Project Sharing Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>🌐</span>
              <span>Public Access</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Make Project Public</p>
                  <p className="text-sm text-slate-600">
                    Anyone with the link can view this project
                  </p>
                </div>
                <Switch
                  checked={project.is_public}
                  onCheckedChange={async (checked) => {
                    try {
                      await trpc.updateProject.mutate({
                        id: project.id,
                        is_public: checked
                      });
                      // Update local project state
                      project.is_public = checked;
                    } catch (error) {
                      console.error('Failed to update project visibility:', error);
                    }
                  }}
                />
              </div>
              
              {project.is_public && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-center space-x-2">
                    <Badge className="bg-green-100 text-green-800">🌍 Public</Badge>
                    <span className="text-sm text-green-700">
                      Project is publicly accessible
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>🔗</span>
              <span>Share Links</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Project URL</label>
                <div className="flex space-x-2">
                  <Input
                    value={shareUrl}
                    readOnly
                    className="flex-1 text-xs bg-slate-50"
                  />
                  <Button size="sm" variant="outline" onClick={copyShareUrl}>
                    📋
                  </Button>
                </div>
              </div>
              
              {project.preview_url && (
                <div>
                  <label className="text-sm font-medium">Preview URL</label>
                  <div className="flex space-x-2">
                    <Input
                      value={project.preview_url}
                      readOnly
                      className="flex-1 text-xs bg-slate-50"
                    />
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => navigator.clipboard.writeText(project.preview_url!)}
                    >
                      📋
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Collaborators List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <span>👥</span>
              <span>Collaborators</span>
              <Badge variant="secondary">{displayCollaborations.length}</Badge>
            </span>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>Loading collaborators...</p>
            </div>
          ) : displayCollaborations.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-6xl mb-4">👥</div>
              <h3 className="text-xl font-semibold mb-2">No Collaborators Yet</h3>
              <p className="text-slate-600 mb-6">
                Invite others to collaborate on this project
              </p>
              <Button 
                onClick={() => setShowShareDialog(true)}
                className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700"
              >
                🔗 Invite Collaborators
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="p-4 space-y-4">
                {displayCollaborations.map((collab: CollaborationType, index: number) => (
                  <Card key={collab.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                            {getRoleIcon(collab.role)}
                          </div>
                          
                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className="font-semibold">
                                {collab.session_id === sessionId ? 'You' : `User ${index + 1}`}
                              </h4>
                              <Badge className={getRoleColor(collab.role)}>
                                {getRoleIcon(collab.role)} {collab.role}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center space-x-4 text-sm text-slate-500">
                              <span>
                                Joined: {collab.invited_at.toLocaleDateString()}
                              </span>
                              {collab.last_active && (
                                <span>
                                  Last active: {collab.last_active.toLocaleTimeString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {collab.session_id !== sessionId && collab.role !== 'owner' && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="text-red-600">
                                  Remove
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove Collaborator</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to remove this collaborator? 
                                    They will lose access to the project.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction className="bg-red-600 hover:bg-red-700">
                                    Remove Access
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                      
                      {/* Permissions */}
                      <div className="mt-3">
                        <div className="flex flex-wrap gap-2">
                          {collab.permissions.map((permission: string) => (
                            <Badge key={permission} variant="outline" className="text-xs">
                              {getPermissionIcon(permission)} {permission}
                            </Badge>
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

      {/* Collaboration Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl mb-2">👥</div>
              <h4 className="font-semibold">Total Collaborators</h4>
              <p className="text-2xl font-bold text-blue-600">{displayCollaborations.length}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl mb-2">👑</div>
              <h4 className="font-semibold">Owners</h4>
              <p className="text-2xl font-bold text-yellow-600">
                {displayCollaborations.filter(c => c.role === 'owner').length}
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl mb-2">✏️</div>
              <h4 className="font-semibold">Editors</h4>
              <p className="text-2xl font-bold text-blue-600">
                {displayCollaborations.filter(c => c.role === 'editor').length}
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl mb-2">👀</div>
              <h4 className="font-semibold">Viewers</h4>
              <p className="text-2xl font-bold text-green-600">
                {displayCollaborations.filter(c => c.role === 'viewer').length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}