import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { Project } from '../../../server/src/schema';

interface OfflineProjectManagerProps {
  sessionId: string;
  currentProject: Project | null;
  onProjectSelect: (project: Project | null) => void;
  onProjectChange: () => void;
}

interface CreateProjectInput {
  name: string;
  description: string | null;
  type: 'react' | 'vanilla' | 'vue' | 'angular' | 'node';
  session_id: string;
}

export function OfflineProjectManager({ sessionId, currentProject, onProjectSelect, onProjectChange }: OfflineProjectManagerProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState<CreateProjectInput>({
    name: '',
    description: null,
    type: 'react',
    session_id: sessionId
  });

  // Load projects from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('offline-projects');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const userProjects = parsed.filter((p: Project) => p.session_id === sessionId);
        setProjects(userProjects.map((p: any) => ({
          ...p,
          created_at: new Date(p.created_at),
          updated_at: new Date(p.updated_at)
        })));
      } catch (error) {
        console.error('Failed to load offline projects:', error);
      }
    }
  }, [sessionId]);

  const saveProjectsToStorage = (projectList: Project[]) => {
    const allProjects = JSON.parse(localStorage.getItem('offline-projects') || '[]');
    const otherProjects = allProjects.filter((p: Project) => p.session_id !== sessionId);
    const updatedProjects = [...otherProjects, ...projectList];
    localStorage.setItem('offline-projects', JSON.stringify(updatedProjects));
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const newProject: Project = {
        id: Math.random().toString(36).substring(2, 15),
        name: formData.name,
        description: formData.description,
        type: formData.type,
        template_id: null,
        session_id: sessionId,
        created_at: new Date(),
        updated_at: new Date(),
        is_public: false,
        preview_url: null,
        deployment_url: null
      };

      const updatedProjects = [...projects, newProject];
      setProjects(updatedProjects);
      saveProjectsToStorage(updatedProjects);
      
      setShowCreateDialog(false);
      setFormData({
        name: '',
        description: null,
        type: 'react',
        session_id: sessionId
      });
      onProjectSelect(newProject);
      onProjectChange();
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProject = (projectId: string) => {
    const updatedProjects = projects.filter(p => p.id !== projectId);
    setProjects(updatedProjects);
    saveProjectsToStorage(updatedProjects);
    
    if (currentProject?.id === projectId) {
      onProjectSelect(null);
    }
    onProjectChange();
  };

  const getProjectTypeIcon = (type: string) => {
    switch (type) {
      case 'react': return '⚛️';
      case 'vue': return '💚';
      case 'angular': return '🅰️';
      case 'vanilla': return '🍦';
      case 'node': return '📗';
      default: return '📁';
    }
  };

  const getProjectTypeColor = (type: string) => {
    switch (type) {
      case 'react': return 'bg-blue-100 text-blue-800';
      case 'vue': return 'bg-green-100 text-green-800';
      case 'angular': return 'bg-red-100 text-red-800';
      case 'vanilla': return 'bg-yellow-100 text-yellow-800';
      case 'node': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">📂 Project Manager</h2>
          <p className="text-slate-600 mt-1">
            Manage your web development projects (Offline Mode)
          </p>
          <Badge variant="outline" className="mt-2 text-orange-600">
            🔄 Offline Mode - Data stored locally
          </Badge>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              ✨ New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>🚀 Create New Project</DialogTitle>
              <DialogDescription>
                Set up a new web development project in offline mode
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Project Name</label>
                <Input
                  placeholder="My Awesome Project"
                  value={formData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev: CreateProjectInput) => ({ ...prev, name: e.target.value }))
                  }
                  required
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700">Project Type</label>
                <Select 
                  value={formData.type} 
                  onValueChange={(value: 'react' | 'vanilla' | 'vue' | 'angular' | 'node') =>
                    setFormData((prev: CreateProjectInput) => ({ ...prev, type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="react">⚛️ React</SelectItem>
                    <SelectItem value="vue">💚 Vue.js</SelectItem>
                    <SelectItem value="angular">🅰️ Angular</SelectItem>
                    <SelectItem value="vanilla">🍦 Vanilla JS</SelectItem>
                    <SelectItem value="node">📗 Node.js</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Description (Optional)</label>
                <Textarea
                  placeholder="Describe your project..."
                  value={formData.description || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setFormData((prev: CreateProjectInput) => ({
                      ...prev,
                      description: e.target.value || null
                    }))
                  }
                  rows={3}
                />
              </div>

              <div className="flex space-x-2 pt-4">
                <Button type="submit" disabled={isLoading} className="flex-1">
                  {isLoading ? 'Creating...' : '🚀 Create Project'}
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

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold mb-2">No Projects Yet</h3>
            <p className="text-slate-600 mb-6">
              Create your first project to start building amazing web applications
            </p>
            <Button 
              onClick={() => setShowCreateDialog(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              ✨ Create Your First Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project: Project) => (
            <Card 
              key={project.id} 
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                currentProject?.id === project.id 
                  ? 'ring-2 ring-blue-500 shadow-lg' 
                  : 'hover:shadow-md'
              }`}
              onClick={() => onProjectSelect(project)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <span>{getProjectTypeIcon(project.type)}</span>
                    <span className="truncate">{project.name}</span>
                  </CardTitle>
                  {currentProject?.id === project.id && (
                    <Badge className="bg-blue-100 text-blue-800">Active</Badge>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={getProjectTypeColor(project.type)}>
                    {project.type}
                  </Badge>
                  <Badge variant="outline" className="text-orange-600">
                    📱 Offline
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent>
                {project.description && (
                  <p className="text-slate-600 text-sm mb-3 line-clamp-2">
                    {project.description}
                  </p>
                )}
                
                <div className="space-y-2 text-xs text-slate-500">
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span>{project.created_at.toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Updated:</span>
                    <span>{project.updated_at.toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex space-x-2 mt-4">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onProjectSelect(project);
                    }}
                  >
                    Select
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-red-600 hover:text-red-700"
                        onClick={(e) => e.stopPropagation()}
                      >
                        🗑️
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Project</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{project.name}"? 
                          This action cannot be undone and will permanently delete 
                          all local files and history.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          className="bg-red-600 hover:bg-red-700"
                          onClick={() => handleDeleteProject(project.id)}
                        >
                          Delete Project
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}