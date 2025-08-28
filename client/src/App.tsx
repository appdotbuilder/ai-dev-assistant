import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
// Offline mode - no backend required
import { OfflineProjectManager } from '@/components/OfflineProjectManager';
import { CodeEditor } from '@/components/CodeEditor';
import { AIChat } from '@/components/AIChat';
import { LivePreview } from '@/components/LivePreview';
import { VersionControl } from '@/components/VersionControl';
import { Collaboration } from '@/components/Collaboration';
import { TemplateGallery } from '@/components/TemplateGallery';
import { Deployment } from '@/components/Deployment';
import type { Session, Project } from '../../server/src/schema';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('projects');

  // Initialize session on load (offline mode)
  const initializeSession = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Try to get existing session from localStorage
      const existingSessionId = localStorage.getItem('cloud-dev-session');
      
      let sessionData: Session;
      
      if (existingSessionId) {
        const storedSession = localStorage.getItem(`session-data-${existingSessionId}`);
        if (storedSession) {
          try {
            const parsedSession = JSON.parse(storedSession);
            // Check if session is not expired
            if (new Date(parsedSession.expires_at) > new Date()) {
              sessionData = {
                ...parsedSession,
                created_at: new Date(parsedSession.created_at),
                last_activity: new Date(parsedSession.last_activity),
                expires_at: new Date(parsedSession.expires_at)
              };
            } else {
              sessionData = createOfflineSession();
            }
          } catch {
            sessionData = createOfflineSession();
          }
        } else {
          sessionData = createOfflineSession();
        }
      } else {
        sessionData = createOfflineSession();
      }
      
      setSession(sessionData);
      localStorage.setItem('cloud-dev-session', sessionData.id);
      localStorage.setItem(`session-data-${sessionData.id}`, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Failed to initialize session:', error);
      // Create emergency offline session
      const emergencySession = createOfflineSession();
      setSession(emergencySession);
      localStorage.setItem('cloud-dev-session', emergencySession.id);
      localStorage.setItem(`session-data-${emergencySession.id}`, JSON.stringify(emergencySession));
    } finally {
      setIsLoading(false);
    }
  }, []);



  const createOfflineSession = (): Session => {
    const sessionId = Math.random().toString(36).substring(2, 15);
    const fingerprint = generateFingerprint();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
    
    return {
      id: sessionId,
      browser_fingerprint: fingerprint,
      ip_address: '127.0.0.1',
      user_agent: navigator.userAgent,
      status: 'active',
      created_at: now,
      last_activity: now,
      expires_at: expiresAt,
      metadata: {
        timestamp: now.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        offline_mode: true
      }
    };
  };

  const generateFingerprint = (): string => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx?.fillText('fingerprint', 0, 0);
    const canvasFingerprint = canvas.toDataURL();
    
    return btoa(JSON.stringify({
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screen: `${screen.width}x${screen.height}`,
      timezone: new Date().getTimezoneOffset(),
      canvas: canvasFingerprint.substring(0, 50)
    }));
  };

  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-center text-2xl">🚀 Cloud Dev Assistant</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span>Initializing development environment...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-center text-2xl text-red-600">⚠️ Session Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center mb-4">Failed to initialize session. Please refresh the page.</p>
            <Button onClick={() => window.location.reload()} className="w-full">
              Refresh Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                ☁️ Cloud Dev Assistant
              </h1>
              {currentProject && (
                <Badge variant="secondary" className="text-sm">
                  📁 {currentProject.name}
                </Badge>
              )}
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-slate-600">
              <Badge variant="outline">Session: {session.id.substring(0, 8)}...</Badge>
              <Badge variant="outline" className="text-orange-600">
                📱 Offline Mode
              </Badge>
              <Badge variant="outline" className="text-green-600">
                ● Active
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-8 mb-6">
            <TabsTrigger value="projects">📂 Projects</TabsTrigger>
            <TabsTrigger value="templates">🎯 Templates</TabsTrigger>
            <TabsTrigger value="editor">💻 Code</TabsTrigger>
            <TabsTrigger value="preview">👀 Preview</TabsTrigger>
            <TabsTrigger value="ai">🤖 AI Chat</TabsTrigger>
            <TabsTrigger value="versions">📝 History</TabsTrigger>
            <TabsTrigger value="collab">👥 Share</TabsTrigger>
            <TabsTrigger value="deploy">🚀 Deploy</TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="space-y-6">
            <OfflineProjectManager 
              sessionId={session.id}
              currentProject={currentProject}
              onProjectSelect={setCurrentProject}
              onProjectChange={() => {
                // Refresh project data when needed
                if (currentProject) {
                  setCurrentProject({...currentProject});
                }
              }}
            />
          </TabsContent>

          <TabsContent value="templates" className="space-y-6">
            <TemplateGallery 
              sessionId={session.id}
              onCreateProject={(project: Project) => {
                setCurrentProject(project);
                setActiveTab('editor');
              }}
            />
          </TabsContent>

          <TabsContent value="editor" className="space-y-6">
            {currentProject ? (
              <CodeEditor 
                project={currentProject}
                sessionId={session.id}
              />
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="text-6xl mb-4">📝</div>
                  <h3 className="text-xl font-semibold mb-2">No Project Selected</h3>
                  <p className="text-slate-600 mb-4">
                    Select a project or create a new one to start coding
                  </p>
                  <Button onClick={() => setActiveTab('projects')}>
                    Go to Projects
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="preview" className="space-y-6">
            {currentProject ? (
              <LivePreview 
                project={currentProject}
                sessionId={session.id}
              />
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="text-6xl mb-4">👀</div>
                  <h3 className="text-xl font-semibold mb-2">No Project to Preview</h3>
                  <p className="text-slate-600 mb-4">
                    Select a project to see the live preview
                  </p>
                  <Button onClick={() => setActiveTab('projects')}>
                    Go to Projects
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="ai" className="space-y-6">
            <AIChat 
              sessionId={session.id}
              currentProject={currentProject}
              onCodeGenerated={(code: string, fileName: string) => {
                // Handle AI-generated code
                console.log('AI generated code for', fileName, code);
                // Could auto-switch to editor tab and create/update file
              }}
            />
          </TabsContent>

          <TabsContent value="versions" className="space-y-6">
            {currentProject ? (
              <VersionControl 
                project={currentProject}
                sessionId={session.id}
                onVersionRestore={() => {
                  // Refresh project data after version restore
                  if (currentProject) {
                    setCurrentProject({...currentProject, updated_at: new Date()});
                  }
                }}
              />
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="text-6xl mb-4">📝</div>
                  <h3 className="text-xl font-semibold mb-2">No Project History</h3>
                  <p className="text-slate-600 mb-4">
                    Select a project to view its version history
                  </p>
                  <Button onClick={() => setActiveTab('projects')}>
                    Go to Projects
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="collab" className="space-y-6">
            {currentProject ? (
              <Collaboration 
                project={currentProject}
                sessionId={session.id}
              />
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="text-6xl mb-4">👥</div>
                  <h3 className="text-xl font-semibold mb-2">No Project to Share</h3>
                  <p className="text-slate-600 mb-4">
                    Select a project to collaborate with others
                  </p>
                  <Button onClick={() => setActiveTab('projects')}>
                    Go to Projects
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="deploy" className="space-y-6">
            {currentProject ? (
              <Deployment 
                project={currentProject}
                sessionId={session.id}
              />
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="text-6xl mb-4">🚀</div>
                  <h3 className="text-xl font-semibold mb-2">No Project to Deploy</h3>
                  <p className="text-slate-600 mb-4">
                    Select a project to deploy to the cloud
                  </p>
                  <Button onClick={() => setActiveTab('projects')}>
                    Go to Projects
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/50 backdrop-blur-sm mt-12">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <div>
              <p>🌐 Cloud-based AI Web Development Assistant</p>
              <p className="text-xs mt-1 text-orange-600">
                📱 Running in offline mode - All data stored locally
              </p>
              {session && (
                <p className="text-xs mt-1">
                  Session expires: {session.expires_at.toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-4">
              {session && (
                <Badge variant="outline">
                  Last activity: {session.last_activity.toLocaleString()}
                </Badge>
              )}
              {currentProject && (
                <Badge variant="outline">
                  Project updated: {currentProject.updated_at.toLocaleString()}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;