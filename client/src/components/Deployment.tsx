import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { trpc } from '@/utils/trpc';
import type { Project, Deployment as DeploymentType, CreateDeploymentInput } from '../../../server/src/schema';

interface DeploymentProps {
  project: Project;
  sessionId: string;
}

export function Deployment({ project, sessionId }: DeploymentProps) {
  const [deployments, setDeployments] = useState<DeploymentType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [deploymentProgress, setDeploymentProgress] = useState(0);
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  
  const [deployConfig, setDeployConfig] = useState<{
    platform: string;
    domain: string;
    environment: string;
    buildCommand: string;
    outputDir: string;
  }>({
    platform: 'vercel',
    domain: '',
    environment: 'production',
    buildCommand: 'npm run build',
    outputDir: 'dist'
  });

  const loadDeployments = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await trpc.getDeployments.query({ projectId: project.id });
      setDeployments(result);
    } catch (error) {
      console.error('Failed to load deployments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    loadDeployments();
  }, [loadDeployments]);

  const handleDeploy = async () => {
    setIsDeploying(true);
    setDeploymentProgress(0);
    setBuildLogs([]);
    
    try {
      // Simulate deployment process with progress updates
      const steps = [
        'Preparing deployment...',
        'Building project...',
        'Optimizing assets...',
        'Uploading files...',
        'Configuring server...',
        'Deployment complete!'
      ];
      
      for (let i = 0; i < steps.length; i++) {
        setBuildLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${steps[i]}`]);
        setDeploymentProgress((i + 1) * (100 / steps.length));
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      // Create deployment record
      const deploymentInput: CreateDeploymentInput = {
        project_id: project.id,
        version_id: 'latest',
        config: deployConfig
      };
      
      const newDeployment = await trpc.createDeployment.mutate(deploymentInput);
      setDeployments((prev: DeploymentType[]) => [newDeployment, ...prev]);
      setShowConfigDialog(false);
      
    } catch (error) {
      console.error('Failed to deploy:', error);
      setBuildLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Deployment failed: ${error}`]);
    } finally {
      setIsDeploying(false);
      setDeploymentProgress(0);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'deployed': return '✅';
      case 'building': return '🔄';
      case 'pending': return '⏳';
      case 'failed': return '❌';
      default: return '📦';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'deployed': return 'bg-green-100 text-green-800';
      case 'building': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'vercel': return '▲';
      case 'netlify': return '🌐';
      case 'aws': return '☁️';
      case 'github-pages': return '🐙';
      case 'firebase': return '🔥';
      default: return '🚀';
    }
  };

  // Mock deployments for demonstration
  const mockDeployments: DeploymentType[] = [
    {
      id: 'deploy-1',
      project_id: project.id,
      version_id: 'version-1',
      status: 'deployed',
      url: `https://${project.name.toLowerCase().replace(/\s+/g, '-')}-abc123.vercel.app`,
      build_logs: `[Build started]\n[Building ${project.type} project]\n[Optimizing for production]\n[Build completed successfully]\n[Deploying to Vercel]\n[Deployment successful]`,
      created_at: new Date(Date.now() - 3600000),
      deployed_at: new Date(Date.now() - 3300000),
      config: {
        platform: 'vercel',
        environment: 'production',
        buildCommand: 'npm run build',
        outputDir: 'dist'
      }
    },
    {
      id: 'deploy-2',
      project_id: project.id,
      version_id: 'version-2',
      status: 'building',
      url: null,
      build_logs: `[Build started]\n[Installing dependencies]\n[Building ${project.type} project]\n[Optimizing assets...]`,
      created_at: new Date(Date.now() - 1800000),
      deployed_at: null,
      config: {
        platform: 'netlify',
        environment: 'staging',
        buildCommand: 'npm run build:staging',
        outputDir: 'build'
      }
    },
    {
      id: 'deploy-3',
      project_id: project.id,
      version_id: 'version-3',
      status: 'failed',
      url: null,
      build_logs: `[Build started]\n[Installing dependencies]\n[Building ${project.type} project]\n[Error: Build failed - missing dependency]\n[Deployment cancelled]`,
      created_at: new Date(Date.now() - 7200000),
      deployed_at: null,
      config: {
        platform: 'aws',
        environment: 'production',
        buildCommand: 'npm run build',
        outputDir: 'dist'
      }
    }
  ];

  const displayDeployments = deployments.length > 0 ? deployments : mockDeployments;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">🚀 Deployment</h2>
          <p className="text-slate-600 mt-1">
            Deploy your project to the cloud and make it accessible worldwide
          </p>
        </div>
        
        <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700">
              🚀 New Deployment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>🚀 Deploy Project</DialogTitle>
              <DialogDescription>
                Configure and deploy your project to the cloud
              </DialogDescription>
            </DialogHeader>
            
            {isDeploying ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Deployment Progress</span>
                    <span className="text-sm text-slate-600">{Math.round(deploymentProgress)}%</span>
                  </div>
                  <Progress value={deploymentProgress} className="w-full" />
                </div>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">📊 Build Logs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-40 w-full">
                      <div className="space-y-1 font-mono text-sm">
                        {buildLogs.map((log, index) => (
                          <div key={index} className="text-slate-700">
                            {log}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
                
                <div className="flex justify-end">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsDeploying(false);
                      setShowConfigDialog(false);
                    }}
                    disabled={deploymentProgress < 100}
                  >
                    {deploymentProgress < 100 ? 'Deploying...' : 'Close'}
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); handleDeploy(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Platform</label>
                    <Select 
                      value={deployConfig.platform} 
                      onValueChange={(value) =>
                        setDeployConfig((prev) => ({ ...prev, platform: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vercel">▲ Vercel</SelectItem>
                        <SelectItem value="netlify">🌐 Netlify</SelectItem>
                        <SelectItem value="aws">☁️ AWS</SelectItem>
                        <SelectItem value="github-pages">🐙 GitHub Pages</SelectItem>
                        <SelectItem value="firebase">🔥 Firebase</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Environment</label>
                    <Select 
                      value={deployConfig.environment} 
                      onValueChange={(value) =>
                        setDeployConfig((prev) => ({ ...prev, environment: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="development">🛠️ Development</SelectItem>
                        <SelectItem value="staging">🧪 Staging</SelectItem>
                        <SelectItem value="production">🚀 Production</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Custom Domain (Optional)</label>
                  <Input
                    placeholder="my-app.com"
                    value={deployConfig.domain}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setDeployConfig((prev) => ({ ...prev, domain: e.target.value }))
                    }
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Build Command</label>
                    <Input
                      value={deployConfig.buildCommand}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setDeployConfig((prev) => ({ ...prev, buildCommand: e.target.value }))
                      }
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Output Directory</label>
                    <Input
                      value={deployConfig.outputDir}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setDeployConfig((prev) => ({ ...prev, outputDir: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="flex space-x-2 pt-4">
                  <Button type="submit" className="flex-1" disabled={isDeploying}>
                    {isDeploying ? '🚀 Deploying...' : '🚀 Deploy Project'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowConfigDialog(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Deployment Status */}
      {displayDeployments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <span>🌐</span>
                <span>Current Deployment</span>
              </span>
              <Badge className={getStatusColor(displayDeployments[0].status)}>
                {getStatusIcon(displayDeployments[0].status)} {displayDeployments[0].status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-600">Platform:</span>
                  <Badge variant="outline">
                    {getPlatformIcon(displayDeployments[0].config?.platform || 'vercel')} {displayDeployments[0].config?.platform || 'vercel'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Environment:</span>
                  <Badge variant="outline">{displayDeployments[0].config?.environment || 'production'}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Created:</span>
                  <span className="text-sm">{displayDeployments[0].created_at.toLocaleString()}</span>
                </div>
                {displayDeployments[0].deployed_at && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Deployed:</span>
                    <span className="text-sm">{displayDeployments[0].deployed_at.toLocaleString()}</span>
                  </div>
                )}
              </div>
              
              <div className="space-y-3">
                {displayDeployments[0].url && (
                  <div>
                    <label className="text-sm font-medium text-slate-600 block mb-1">Live URL:</label>
                    <div className="flex space-x-2">
                      <Input
                        value={displayDeployments[0].url}
                        readOnly
                        className="flex-1 text-sm bg-slate-50"
                      />
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => window.open(displayDeployments[0].url!, '_blank')}
                      >
                        🔗
                      </Button>
                    </div>
                  </div>
                )}
                
                <div className="flex space-x-2">
                  {displayDeployments[0].url && (
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => window.open(displayDeployments[0].url!, '_blank')}
                    >
                      👀 View Live
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setShowConfigDialog(true)}
                  >
                    🚀 Redeploy
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deployment History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <span>📋</span>
              <span>Deployment History</span>
              <Badge variant="secondary">{displayDeployments.length}</Badge>
            </span>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>Loading deployment history...</p>
            </div>
          ) : displayDeployments.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-6xl mb-4">🚀</div>
              <h3 className="text-xl font-semibold mb-2">No Deployments Yet</h3>
              <p className="text-slate-600 mb-6">
                Deploy your project to make it accessible on the web
              </p>
              <Button 
                onClick={() => setShowConfigDialog(true)}
                className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
              >
                🚀 Create First Deployment
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="p-4 space-y-4">
                {displayDeployments.map((deployment: DeploymentType) => (
                  <Card key={deployment.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2">
                            <Badge className={getStatusColor(deployment.status)}>
                              {getStatusIcon(deployment.status)} {deployment.status}
                            </Badge>
                            <Badge variant="outline">
                              {getPlatformIcon(deployment.config?.platform || 'vercel')} {deployment.config?.platform || 'vercel'}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {deployment.url && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => window.open(deployment.url!, '_blank')}
                            >
                              🔗 Visit
                            </Button>
                          )}
                          
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline">
                                📊 Logs
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Build Logs</DialogTitle>
                                <DialogDescription>
                                  Deployment logs for {deployment.id}
                                </DialogDescription>
                              </DialogHeader>
                              <ScrollArea className="h-96 w-full">
                                <pre className="text-sm font-mono whitespace-pre-wrap p-4 bg-slate-50 rounded">
                                  {deployment.build_logs || 'No logs available'}
                                </pre>
                              </ScrollArea>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-slate-600">Created: </span>
                            <span>{deployment.created_at.toLocaleString()}</span>
                          </div>
                          {deployment.deployed_at && (
                            <div>
                              <span className="text-slate-600">Deployed: </span>
                              <span>{deployment.deployed_at.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                        
                        {deployment.url && (
                          <div className="text-sm">
                            <span className="text-slate-600">URL: </span>
                            <a 
                              href={deployment.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline font-mono"
                            >
                              {deployment.url}
                            </a>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Deployment Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl mb-2">📊</div>
              <h4 className="font-semibold">Total Deployments</h4>
              <p className="text-2xl font-bold text-blue-600">{displayDeployments.length}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl mb-2">✅</div>
              <h4 className="font-semibold">Successful</h4>
              <p className="text-2xl font-bold text-green-600">
                {displayDeployments.filter(d => d.status === 'deployed').length}
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl mb-2">🔄</div>
              <h4 className="font-semibold">In Progress</h4>
              <p className="text-2xl font-bold text-blue-600">
                {displayDeployments.filter(d => ['building', 'pending'].includes(d.status)).length}
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl mb-2">❌</div>
              <h4 className="font-semibold">Failed</h4>
              <p className="text-2xl font-bold text-red-600">
                {displayDeployments.filter(d => d.status === 'failed').length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}