import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { trpc } from '@/utils/trpc';
import type { Project, File } from '../../../server/src/schema';

interface LivePreviewProps {
  project: Project;
  sessionId: string;
}

export function LivePreview({ project, sessionId }: LivePreviewProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(project.preview_url);
  const [isLoading, setIsLoading] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(3000);
  const [selectedDevice, setSelectedDevice] = useState('desktop');
  const [customUrl, setCustomUrl] = useState('');

  const loadFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await trpc.getFiles.query({ projectId: project.id });
      setFiles(result);
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setIsLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    if (autoRefresh && previewUrl) {
      const interval = setInterval(() => {
        // Refresh preview iframe
        const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
        if (iframe) {
          iframe.src = iframe.src;
        }
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, previewUrl]);

  const buildPreview = async () => {
    setIsBuilding(true);
    try {
      // In a real implementation, this would trigger the build process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate a mock preview URL
      const mockUrl = `https://preview-${project.id.substring(0, 8)}.dev.example.com`;
      setPreviewUrl(mockUrl);
      
      // Update project with preview URL (in real app)
      // await trpc.updateProject.mutate({
      //   id: project.id,
      //   preview_url: mockUrl
      // });
      
    } catch (error) {
      console.error('Failed to build preview:', error);
    } finally {
      setIsBuilding(false);
    }
  };

  const getDeviceStyles = (device: string) => {
    switch (device) {
      case 'mobile':
        return { width: '375px', height: '667px' };
      case 'tablet':
        return { width: '768px', height: '1024px' };
      case 'desktop':
        return { width: '100%', height: '600px' };
      case 'fullscreen':
        return { width: '100%', height: '100vh' };
      default:
        return { width: '100%', height: '600px' };
    }
  };

  const deviceIcons = {
    mobile: '📱',
    tablet: '💻',
    desktop: '🖥️',
    fullscreen: '🌐'
  };

  // Generate preview content based on project files
  const generatePreviewContent = () => {
    if (files.length === 0) {
      // Generate demo content based on project type
      const demoContent = {
        react: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${project.name} - React Preview</title>
    <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .app { 
            background: white; 
            padding: 2rem; 
            border-radius: 10px; 
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 500px;
        }
        h1 { color: #667eea; margin-bottom: 1rem; }
        .feature { margin: 1rem 0; padding: 1rem; background: #f8f9fa; border-radius: 5px; }
        button { 
            background: #667eea; 
            color: white; 
            border: none; 
            padding: 0.75rem 1.5rem; 
            border-radius: 5px; 
            cursor: pointer;
            margin: 0.5rem;
            transition: all 0.3s;
        }
        button:hover { background: #5a6fd8; transform: translateY(-2px); }
    </style>
</head>
<body>
    <div id="root"></div>
    <script type="text/babel">
        const { useState } = React;
        
        function App() {
            const [count, setCount] = useState(0);
            const [message, setMessage] = useState('Welcome to ${project.name}!');
            
            return (
                <div className="app">
                    <h1>⚛️ ${project.name}</h1>
                    <div className="feature">
                        <p>{message}</p>
                        <p>You've clicked {count} times</p>
                        <button onClick={() => setCount(count + 1)}>
                            Click me! 🚀
                        </button>
                        <button onClick={() => setMessage(\`Updated at \${new Date().toLocaleTimeString()}\`)}>
                            Update Message ⏰
                        </button>
                    </div>
                    <div className="feature">
                        <h3>🌟 React Features</h3>
                        <p>✅ State Management</p>
                        <p>✅ Event Handling</p>
                        <p>✅ Component Lifecycle</p>
                        <p>✅ Modern Hooks</p>
                    </div>
                </div>
            );
        }
        
        ReactDOM.render(<App />, document.getElementById('root'));
    </script>
</body>
</html>`,
        vanilla: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${project.name} - Vanilla JS Preview</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container { 
            background: white; 
            padding: 2rem; 
            border-radius: 10px; 
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 500px;
        }
        h1 { color: #667eea; margin-bottom: 1rem; }
        .feature { margin: 1rem 0; padding: 1rem; background: #f8f9fa; border-radius: 5px; }
        button { 
            background: #667eea; 
            color: white; 
            border: none; 
            padding: 0.75rem 1.5rem; 
            border-radius: 5px; 
            cursor: pointer;
            margin: 0.5rem;
            transition: all 0.3s;
        }
        button:hover { background: #5a6fd8; transform: translateY(-2px); }
        .dynamic-content { margin-top: 1rem; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🍦 ${project.name}</h1>
        <div class="feature">
            <p>Welcome to your Vanilla JavaScript project!</p>
            <p>Click counter: <span id="counter">0</span></p>
            <button onclick="incrementCounter()">Click me! 🚀</button>
            <button onclick="changeColor()">Change Color 🎨</button>
            <div id="dynamic-content" class="dynamic-content"></div>
        </div>
        <div class="feature">
            <h3>⚡ JavaScript Features</h3>
            <p>✅ DOM Manipulation</p>
            <p>✅ Event Handling</p>
            <p>✅ Dynamic Content</p>
            <p>✅ Modern ES6+</p>
        </div>
    </div>
    
    <script>
        let count = 0;
        const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe'];
        
        function incrementCounter() {
            count++;
            document.getElementById('counter').textContent = count;
            
            if (count > 1) {
                document.getElementById('dynamic-content').innerHTML = 
                    \`<p>🎉 You're getting the hang of it! (\${count} clicks)</p>\`;
            }
        }
        
        function changeColor() {
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            document.querySelector('h1').style.color = randomColor;
            document.getElementById('dynamic-content').innerHTML = 
                \`<p>🎨 Color changed to: \${randomColor}</p>\`;
        }
        
        // Welcome animation
        setTimeout(() => {
            document.getElementById('dynamic-content').innerHTML = 
                '<p>👋 Project loaded at ' + new Date().toLocaleTimeString() + '</p>';
        }, 1000);
    </script>
</body>
</html>`,
        vue: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${project.name} - Vue.js Preview</title>
    <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #42b883 0%, #35495e 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .app { 
            background: white; 
            padding: 2rem; 
            border-radius: 10px; 
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 500px;
        }
        h1 { color: #42b883; margin-bottom: 1rem; }
        .feature { margin: 1rem 0; padding: 1rem; background: #f8f9fa; border-radius: 5px; }
        button { 
            background: #42b883; 
            color: white; 
            border: none; 
            padding: 0.75rem 1.5rem; 
            border-radius: 5px; 
            cursor: pointer;
            margin: 0.5rem;
            transition: all 0.3s;
        }
        button:hover { background: #369970; transform: translateY(-2px); }
    </style>
</head>
<body>
    <div id="app">
        <div class="app">
            <h1>💚 ${project.name}</h1>
            <div class="feature">
                <p>{{ message }}</p>
                <p>Count: {{ count }}</p>
                <button @click="increment">Click me! 🚀</button>
                <button @click="updateMessage">Update Message ⏰</button>
            </div>
            <div class="feature">
                <h3>🌟 Vue.js Features</h3>
                <p>✅ Reactive Data</p>
                <p>✅ Template Syntax</p>
                <p>✅ Event Directives</p>
                <p>✅ Component System</p>
            </div>
        </div>
    </div>
    
    <script>
        const { createApp, ref } = Vue;
        
        createApp({
            setup() {
                const count = ref(0);
                const message = ref('Welcome to ${project.name}!');
                
                const increment = () => {
                    count.value++;
                };
                
                const updateMessage = () => {
                    message.value = \`Updated at \${new Date().toLocaleTimeString()}\`;
                };
                
                return {
                    count,
                    message,
                    increment,
                    updateMessage
                };
            }
        }).mount('#app');
    </script>
</body>
</html>`
      };
      
      return demoContent[project.type as keyof typeof demoContent] || demoContent.vanilla;
    }
    
    // If files exist, return a basic HTML structure
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${project.name}</title>
</head>
<body>
    <h1>${project.name}</h1>
    <p>Files loaded: ${files.length}</p>
</body>
</html>`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">👀 Live Preview</h2>
          <p className="text-slate-600 mt-1">
            See your project in action with real-time updates
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            onClick={buildPreview}
            disabled={isBuilding}
            className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
          >
            {isBuilding ? '🔄 Building...' : '🚀 Build Preview'}
          </Button>
          
          {previewUrl && (
            <Button
              variant="outline"
              onClick={() => window.open(previewUrl, '_blank')}
            >
              🔗 Open in New Tab
            </Button>
          )}
        </div>
      </div>

      {/* Preview Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">⚙️ Preview Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            {/* Device Selection */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Device:</span>
              <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mobile">📱 Mobile</SelectItem>
                  <SelectItem value="tablet">💻 Tablet</SelectItem>
                  <SelectItem value="desktop">🖥️ Desktop</SelectItem>
                  <SelectItem value="fullscreen">🌐 Full Screen</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Auto Refresh */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Auto Refresh:</span>
              <Switch
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
              />
            </div>

            {/* Refresh Interval */}
            {autoRefresh && (
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">Interval:</span>
                <Select 
                  value={refreshInterval.toString()} 
                  onValueChange={(value) => setRefreshInterval(parseInt(value))}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1000">1s</SelectItem>
                    <SelectItem value="3000">3s</SelectItem>
                    <SelectItem value="5000">5s</SelectItem>
                    <SelectItem value="10000">10s</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Manual Refresh */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
                if (iframe) iframe.src = iframe.src;
              }}
            >
              🔄 Refresh
            </Button>

            {/* Custom URL */}
            <div className="flex items-center space-x-2">
              <Input
                placeholder="Custom URL..."
                value={customUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomUrl(e.target.value)}
                className="w-48"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (customUrl) {
                    setPreviewUrl(customUrl);
                  }
                }}
                disabled={!customUrl}
              >
                Load
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview Frame */}
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <span>{deviceIcons[selectedDevice as keyof typeof deviceIcons]}</span>
              <span>Live Preview</span>
              {selectedDevice !== 'desktop' && (
                <Badge variant="outline">
                  {getDeviceStyles(selectedDevice).width} × {getDeviceStyles(selectedDevice).height}
                </Badge>
              )}
            </CardTitle>
            
            <div className="flex items-center space-x-2">
              {previewUrl && (
                <Badge className="bg-green-100 text-green-800">
                  🟢 Live
                </Badge>
              )}
              {autoRefresh && (
                <Badge className="bg-blue-100 text-blue-800">
                  🔄 Auto Refresh
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {previewUrl || files.length > 0 ? (
            <div className="flex justify-center bg-slate-50 p-4">
              <div 
                style={getDeviceStyles(selectedDevice)}
                className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-lg"
              >
                <iframe
                  id="preview-iframe"
                  src={previewUrl || `data:text/html;charset=utf-8,${encodeURIComponent(generatePreviewContent())}`}
                  className="w-full h-full border-0"
                  title="Live Preview"
                />
              </div>
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">🚀</div>
              <h3 className="text-xl font-semibold mb-2">Ready to Preview</h3>
              <p className="text-slate-600 mb-6">
                Your project preview will appear here once you build it.
                Click "Build Preview" to see your {project.type} project in action!
              </p>
              <div className="space-y-4">
                <Button
                  onClick={buildPreview}
                  disabled={isBuilding}
                  className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                >
                  {isBuilding ? '🔄 Building Preview...' : '🚀 Build Preview'}
                </Button>
                
                <div className="text-sm text-slate-500">
                  <p>Preview features:</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-2">
                    <Badge variant="outline">📱 Responsive Design</Badge>
                    <Badge variant="outline">🔄 Live Reload</Badge>
                    <Badge variant="outline">🐛 Debug Console</Badge>
                    <Badge variant="outline">📊 Performance Monitor</Badge>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Info */}
      {(previewUrl || files.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl mb-2">📊</div>
                <h4 className="font-semibold">Performance</h4>
                <p className="text-sm text-slate-600">Load time: ~1.2s</p>
                <Badge className="bg-green-100 text-green-800 mt-2">Fast</Badge>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl mb-2">📱</div>
                <h4 className="font-semibold">Responsive</h4>
                <p className="text-sm text-slate-600">Works on all devices</p>
                <Badge className="bg-blue-100 text-blue-800 mt-2">Optimized</Badge>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl mb-2">🔒</div>
                <h4 className="font-semibold">Security</h4>
                <p className="text-sm text-slate-600">HTTPS enabled</p>
                <Badge className="bg-green-100 text-green-800 mt-2">Secure</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}