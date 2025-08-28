import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/utils/trpc';
import type { Project, File, CreateFileInput, UpdateFileInput } from '../../../server/src/schema';

interface CodeEditorProps {
  project: Project;
  sessionId: string;
}

export function CodeEditor({ project, sessionId }: CodeEditorProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  
  const [newFileData, setNewFileData] = useState<CreateFileInput>({
    project_id: project.id,
    name: '',
    path: '',
    content: '',
    type: 'js'
  });

  const [editingContent, setEditingContent] = useState('');

  const loadFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await trpc.getFiles.query({ projectId: project.id });
      setFiles(result);
      
      // Auto-select first file if none selected
      if (result.length > 0 && !currentFile) {
        setCurrentFile(result[0]);
        setEditingContent(result[0].content);
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setIsLoading(false);
    }
  }, [project.id, currentFile]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    if (currentFile) {
      setEditingContent(currentFile.content);
      setUnsavedChanges(false);
    }
  }, [currentFile]);

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newFile = await trpc.createFile.mutate(newFileData);
      setFiles((prev: File[]) => [...prev, newFile]);
      setCurrentFile(newFile);
      setShowCreateDialog(false);
      setNewFileData({
        project_id: project.id,
        name: '',
        path: '',
        content: '',
        type: 'js'
      });
    } catch (error) {
      console.error('Failed to create file:', error);
    }
  };

  const handleSaveFile = async () => {
    if (!currentFile || !unsavedChanges) return;
    
    try {
      setIsLoading(true);
      const updatedFile = await trpc.updateFile.mutate({
        id: currentFile.id,
        content: editingContent
      });
      
      // Update the file in the list
      setFiles((prev: File[]) => prev.map(f => 
        f.id === currentFile.id ? { ...f, content: editingContent, updated_at: new Date() } : f
      ));
      
      setCurrentFile({ ...currentFile, content: editingContent, updated_at: new Date() });
      setUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save file:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      await trpc.deleteFile.mutate({ fileId, sessionId });
      setFiles((prev: File[]) => prev.filter(f => f.id !== fileId));
      if (currentFile?.id === fileId) {
        const remainingFiles = files.filter(f => f.id !== fileId);
        setCurrentFile(remainingFiles.length > 0 ? remainingFiles[0] : null);
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  };

  const handleContentChange = (content: string) => {
    setEditingContent(content);
    setUnsavedChanges(currentFile?.content !== content);
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'js': return '📄';
      case 'ts': return '🔷';
      case 'jsx': return '⚛️';
      case 'tsx': return '🔵';
      case 'css': return '🎨';
      case 'scss': return '💅';
      case 'html': return '🌐';
      case 'json': return '📋';
      case 'md': return '📝';
      default: return '📄';
    }
  };

  const getFileTypeColor = (type: string) => {
    switch (type) {
      case 'js': return 'bg-yellow-100 text-yellow-800';
      case 'ts': return 'bg-blue-100 text-blue-800';
      case 'jsx': return 'bg-cyan-100 text-cyan-800';
      case 'tsx': return 'bg-indigo-100 text-indigo-800';
      case 'css': return 'bg-pink-100 text-pink-800';
      case 'scss': return 'bg-purple-100 text-purple-800';
      case 'html': return 'bg-orange-100 text-orange-800';
      case 'json': return 'bg-gray-100 text-gray-800';
      case 'md': return 'bg-green-100 text-green-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  // Mock files for demonstration since backend returns empty
  const mockFiles: File[] = [
    {
      id: 'file-1',
      project_id: project.id,
      name: 'index.html',
      path: '/index.html',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${project.name}</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div id="app">
        <h1>Welcome to ${project.name}</h1>
        <p>This is your ${project.type} project!</p>
        <button onclick="handleClick()">Click me!</button>
    </div>
    <script src="script.js"></script>
</body>
</html>`,
      type: 'html',
      size: 512,
      created_at: new Date(),
      updated_at: new Date(),
      is_deleted: false
    },
    {
      id: 'file-2',
      project_id: project.id,
      name: 'styles.css',
      path: '/styles.css',
      content: `/* ${project.name} Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #333;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
}

#app {
    background: white;
    padding: 2rem;
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    text-align: center;
    max-width: 500px;
}

h1 {
    color: #667eea;
    margin-bottom: 1rem;
}

button {
    background: #667eea;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 5px;
    cursor: pointer;
    font-size: 1rem;
    margin-top: 1rem;
    transition: background 0.3s;
}

button:hover {
    background: #5a6fd8;
}`,
      type: 'css',
      size: 864,
      created_at: new Date(),
      updated_at: new Date(),
      is_deleted: false
    },
    {
      id: 'file-3',
      project_id: project.id,
      name: 'script.js',
      path: '/script.js',
      content: `// ${project.name} JavaScript

function handleClick() {
    alert('Hello from ${project.name}! 🎉');
    
    // Add some interactive features
    const button = document.querySelector('button');
    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    button.style.background = randomColor;
    
    // Add click counter
    if (!window.clickCount) {
        window.clickCount = 0;
    }
    window.clickCount++;
    
    if (window.clickCount > 1) {
        button.textContent = \`Clicked \${window.clickCount} times! 🎯\`;
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('${project.name} loaded successfully!');
    
    // Add some dynamic content
    const app = document.getElementById('app');
    const timestamp = new Date().toLocaleTimeString();
    
    const info = document.createElement('p');
    info.style.fontSize = '0.9rem';
    info.style.color = '#666';
    info.style.marginTop = '1rem';
    info.textContent = \`Project created at \${timestamp}\`;
    
    app.appendChild(info);
});`,
      type: 'js',
      size: 1024,
      created_at: new Date(),
      updated_at: new Date(),
      is_deleted: false
    }
  ];

  const displayFiles = files.length > 0 ? files : mockFiles;
  const displayCurrentFile = currentFile || (displayFiles.length > 0 ? displayFiles[0] : null);

  // Use display file content if using mock files
  const currentContent = displayCurrentFile === currentFile ? editingContent : displayCurrentFile?.content || '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">💻 Code Editor</h2>
          <p className="text-slate-600 mt-1">
            Edit your project files with syntax highlighting and AI assistance
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          {unsavedChanges && (
            <Button onClick={handleSaveFile} disabled={isLoading}>
              💾 Save Changes
            </Button>
          )}
          
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700">
                ➕ New File
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>📄 Create New File</DialogTitle>
                <DialogDescription>
                  Add a new file to your project
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateFile} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">File Name</label>
                  <Input
                    placeholder="filename.js"
                    value={newFileData.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewFileData((prev: CreateFileInput) => ({ ...prev, name: e.target.value }))
                    }
                    required
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">File Path</label>
                  <Input
                    placeholder="/src/components/"
                    value={newFileData.path}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewFileData((prev: CreateFileInput) => ({ ...prev, path: e.target.value }))
                    }
                    required
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">File Type</label>
                  <Select 
                    value={newFileData.type} 
                    onValueChange={(value: 'js' | 'ts' | 'jsx' | 'tsx' | 'css' | 'scss' | 'html' | 'json' | 'md') =>
                      setNewFileData((prev: CreateFileInput) => ({ ...prev, type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="js">📄 JavaScript (.js)</SelectItem>
                      <SelectItem value="ts">🔷 TypeScript (.ts)</SelectItem>
                      <SelectItem value="jsx">⚛️ React JSX (.jsx)</SelectItem>
                      <SelectItem value="tsx">🔵 React TSX (.tsx)</SelectItem>
                      <SelectItem value="css">🎨 CSS (.css)</SelectItem>
                      <SelectItem value="scss">💅 SCSS (.scss)</SelectItem>
                      <SelectItem value="html">🌐 HTML (.html)</SelectItem>
                      <SelectItem value="json">📋 JSON (.json)</SelectItem>
                      <SelectItem value="md">📝 Markdown (.md)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex space-x-2 pt-4">
                  <Button type="submit" className="flex-1">
                    📄 Create File
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
      </div>

      <div className="grid grid-cols-12 gap-6 h-[600px]">
        {/* File Explorer */}
        <div className="col-span-3">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <span>📁</span>
                <span>Files</span>
                <Badge variant="secondary">{displayFiles.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[480px]">
                <div className="space-y-1 p-4">
                  {displayFiles.map((file: File) => (
                    <div
                      key={file.id}
                      className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                        displayCurrentFile?.id === file.id
                          ? 'bg-blue-100 text-blue-900'
                          : 'hover:bg-slate-100'
                      }`}
                      onClick={() => {
                        setCurrentFile(file);
                        setEditingContent(file.content);
                        setUnsavedChanges(false);
                      }}
                    >
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <span className="text-sm">{getFileIcon(file.type)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-slate-500 truncate">{file.path}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        <Badge 
                          className={`text-xs ${getFileTypeColor(file.type)}`}
                        >
                          {file.type}
                        </Badge>
                        
                        {files.some(f => f.id === file.id) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                onClick={(e) => e.stopPropagation()}
                              >
                                🗑️
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete File</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{file.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  className="bg-red-600 hover:bg-red-700"
                                  onClick={() => handleDeleteFile(file.id)}
                                >
                                  Delete File
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Code Editor */}
        <div className="col-span-9">
          <Card className="h-full">
            <CardHeader>
              {displayCurrentFile ? (
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <span>{getFileIcon(displayCurrentFile.type)}</span>
                    <span>{displayCurrentFile.name}</span>
                    {unsavedChanges && <Badge variant="destructive">Unsaved</Badge>}
                  </CardTitle>
                  <div className="flex items-center space-x-2 text-sm text-slate-500">
                    <span>Size: {Math.round(currentContent.length / 1024 * 100) / 100} KB</span>
                    <span>•</span>
                    <span>Modified: {displayCurrentFile.updated_at.toLocaleTimeString()}</span>
                  </div>
                </div>
              ) : (
                <CardTitle className="text-lg">💻 Select a file to edit</CardTitle>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {displayCurrentFile ? (
                <div className="h-[480px]">
                  <Textarea
                    value={displayCurrentFile === currentFile ? editingContent : displayCurrentFile.content}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                      if (displayCurrentFile === currentFile) {
                        handleContentChange(e.target.value);
                      }
                    }}
                    readOnly={displayCurrentFile !== currentFile}
                    className="h-full resize-none font-mono text-sm border-0 rounded-none focus:ring-0"
                    placeholder="Start typing your code here..."
                  />
                  {displayCurrentFile !== currentFile && (
                    <div className="absolute inset-0 bg-yellow-50/50 flex items-center justify-center">
                      <div className="bg-yellow-100 border border-yellow-200 rounded-lg p-4 text-center">
                        <p className="text-yellow-800 mb-2">📝 Demo File (Read-only)</p>
                        <p className="text-sm text-yellow-700">
                          This is a preview of what your file structure could look like.
                          Create real files to start editing.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-[480px] flex items-center justify-center">
                  <div className="text-center text-slate-500">
                    <div className="text-6xl mb-4">📄</div>
                    <p className="text-lg mb-2">No file selected</p>
                    <p className="text-sm">Choose a file from the explorer or create a new one</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* AI Assistant Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🤖</span>
              <span className="font-medium">AI Code Assistant</span>
            </div>
            <Input
              placeholder="Ask AI to help with your code... (e.g., 'add a responsive navbar', 'fix this function')"
              className="flex-1"
            />
            <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
              🪄 Ask AI
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}