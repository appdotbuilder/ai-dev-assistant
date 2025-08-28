import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/utils/trpc';
import type { Project, AiChat, AiChatInput } from '../../../server/src/schema';

interface AIChatProps {
  sessionId: string;
  currentProject: Project | null;
  onCodeGenerated: (code: string, fileName: string) => void;
}

interface ChatMessage extends AiChat {
  isUser?: boolean;
}

export function AIChat({ sessionId, currentProject, onCodeGenerated }: AIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'gpt-4' | 'claude-3' | 'gemini-pro' | 'custom'>('gpt-4');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const loadChatHistory = useCallback(async () => {
    try {
      const history = await trpc.getChatHistory.query({
        sessionId,
        projectId: currentProject?.id
      });
      setMessages(history);
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  }, [sessionId, currentProject?.id]);

  useEffect(() => {
    loadChatHistory();
  }, [loadChatHistory]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMessage.trim()) return;

    const userMessage = currentMessage;
    setCurrentMessage('');
    setIsLoading(true);

    // Add user message to chat
    const userChatMessage: ChatMessage = {
      id: Date.now().toString(),
      session_id: sessionId,
      project_id: currentProject?.id || null,
      message: userMessage,
      response: '',
      model: selectedModel,
      tokens_used: 0,
      created_at: new Date(),
      context_files: null,
      isUser: true
    };

    setMessages((prev: ChatMessage[]) => [...prev, userChatMessage]);

    try {
      const chatInput: AiChatInput = {
        session_id: sessionId,
        project_id: currentProject?.id,
        message: userMessage,
        model: selectedModel,
        context_files: currentProject ? [currentProject.id] : undefined
      };

      const aiResponse = await trpc.aiChat.mutate(chatInput);
      
      // Add AI response to chat
      setMessages((prev: ChatMessage[]) => [...prev, aiResponse]);

      // Check if response contains code that should be applied
      if (aiResponse.response.includes('```') && currentProject) {
        const codeBlocks = extractCodeBlocks(aiResponse.response);
        if (codeBlocks.length > 0) {
          // For demo, we'll just log the code
          codeBlocks.forEach(block => {
            console.log('Generated code:', block.code);
            onCodeGenerated(block.code, block.filename || 'generated.js');
          });
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Add error message
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        session_id: sessionId,
        project_id: currentProject?.id || null,
        message: '',
        response: 'Sorry, I encountered an error. Please try again.',
        model: selectedModel,
        tokens_used: 0,
        created_at: new Date(),
        context_files: null
      };
      setMessages((prev: ChatMessage[]) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const extractCodeBlocks = (text: string) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const blocks = [];
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      blocks.push({
        language: match[1] || 'javascript',
        code: match[2].trim(),
        filename: `generated.${getFileExtension(match[1] || 'javascript')}`
      });
    }

    return blocks;
  };

  const getFileExtension = (language: string) => {
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'js': return 'js';
      case 'typescript':
      case 'ts': return 'ts';
      case 'jsx': return 'jsx';
      case 'tsx': return 'tsx';
      case 'css': return 'css';
      case 'html': return 'html';
      case 'json': return 'json';
      default: return 'txt';
    }
  };

  const getModelIcon = (model: string) => {
    switch (model) {
      case 'gpt-4': return '🚀';
      case 'claude-3': return '🧠';
      case 'gemini-pro': return '💎';
      case 'custom': return '⚙️';
      default: return '🤖';
    }
  };

  const getModelColor = (model: string) => {
    switch (model) {
      case 'gpt-4': return 'bg-green-100 text-green-800';
      case 'claude-3': return 'bg-blue-100 text-blue-800';
      case 'gemini-pro': return 'bg-purple-100 text-purple-800';
      case 'custom': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Mock AI responses for demonstration
  const generateMockResponse = (message: string): string => {
    const responses = {
      'hello': "Hello! I'm your AI coding assistant. I can help you with:\n\n• Writing and debugging code\n• Explaining programming concepts\n• Creating project structures\n• Optimizing performance\n• Adding new features\n\nWhat would you like to work on today?",
      'create': "I'd be happy to help you create something! Here's a sample React component:\n\n```jsx\nfunction WelcomeComponent() {\n  const [count, setCount] = useState(0);\n  \n  return (\n    <div className=\"welcome-card\">\n      <h2>Welcome to your project!</h2>\n      <p>You've clicked {count} times</p>\n      <button onClick={() => setCount(count + 1)}>\n        Click me!\n      </button>\n    </div>\n  );\n}\n\nexport default WelcomeComponent;\n```\n\nThis creates a simple interactive component with state management. Would you like me to explain any part of this code?",
      'help': "I'm here to help! You can ask me about:\n\n🔹 **Code Generation**: 'Create a login form', 'Add a navbar'\n🔹 **Debugging**: 'Fix this error', 'Why isn't this working?'\n🔹 **Best Practices**: 'How to optimize this?', 'Is this secure?'\n🔹 **Learning**: 'Explain async/await', 'What are React hooks?'\n\nJust type your question naturally - I understand context from your current project!",
      'default': `I understand you're asking about: "${message}"\n\nBased on your ${currentProject?.type || 'web'} project, here are some suggestions:\n\n• Consider breaking down complex problems into smaller parts\n• Make sure to follow best practices for ${currentProject?.type || 'web development'}\n• Don't forget to test your code as you go\n\nCould you provide more specific details about what you'd like me to help with?`
    };

    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) return responses.hello;
    if (lowerMessage.includes('create') || lowerMessage.includes('build') || lowerMessage.includes('make')) return responses.create;
    if (lowerMessage.includes('help') || lowerMessage === '?') return responses.help;
    return responses.default;
  };

  // Add initial welcome message if no messages
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        session_id: sessionId,
        project_id: currentProject?.id || null,
        message: '',
        response: `👋 Hi there! I'm your AI coding assistant. I'm here to help you with your ${currentProject?.type || 'web development'} project.\n\n🚀 **What I can do:**\n• Generate code snippets and components\n• Debug and fix issues\n• Explain programming concepts\n• Suggest best practices\n• Help with project architecture\n\n💬 **Just ask me anything!** For example:\n• "Create a responsive navigation bar"\n• "Help me fix this JavaScript error"\n• "Explain how React hooks work"\n• "Add authentication to my app"\n\nWhat would you like to work on?`,
        model: selectedModel,
        tokens_used: 0,
        created_at: new Date(),
        context_files: null
      };
      setMessages([welcomeMessage]);
    }
  }, [messages.length, sessionId, currentProject, selectedModel]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">🤖 AI Code Assistant</h2>
          <p className="text-slate-600 mt-1">
            Get intelligent help with coding, debugging, and project architecture
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm text-slate-600">AI Model:</span>
          <Select value={selectedModel} onValueChange={(value: 'gpt-4' | 'claude-3' | 'gemini-pro' | 'custom') => setSelectedModel(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4">🚀 GPT-4</SelectItem>
              <SelectItem value="claude-3">🧠 Claude-3</SelectItem>
              <SelectItem value="gemini-pro">💎 Gemini Pro</SelectItem>
              <SelectItem value="custom">⚙️ Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Chat Area */}
        <div className="lg:col-span-3">
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  <span>{getModelIcon(selectedModel)}</span>
                  <span>AI Conversation</span>
                  {currentProject && (
                    <Badge variant="outline">
                      📁 {currentProject.name}
                    </Badge>
                  )}
                </span>
                <Badge className={getModelColor(selectedModel)}>
                  {selectedModel.toUpperCase()}
                </Badge>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col p-0">
              <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((msg: ChatMessage) => (
                    <div key={msg.id} className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] ${
                        msg.isUser 
                          ? 'bg-blue-600 text-white rounded-l-lg rounded-tr-lg' 
                          : 'bg-slate-100 text-slate-900 rounded-r-lg rounded-tl-lg'
                      } p-4`}>
                        {msg.isUser ? (
                          <p className="whitespace-pre-wrap">{msg.message}</p>
                        ) : (
                          <div>
                            <div className="whitespace-pre-wrap">{msg.response}</div>
                            {msg.tokens_used > 0 && (
                              <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-500">
                                Tokens used: {msg.tokens_used}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="mt-2 text-xs opacity-75">
                          {msg.created_at.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 text-slate-900 rounded-r-lg rounded-tl-lg p-4 max-w-[80%]">
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          <span className="text-sm">AI is thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              
              <div className="p-4 border-t">
                <form onSubmit={handleSendMessage} className="flex space-x-2">
                  <Textarea
                    value={currentMessage}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCurrentMessage(e.target.value)}
                    placeholder="Ask me anything about your code... (Press Ctrl+Enter to send)"
                    className="flex-1 min-h-[60px] max-h-[120px]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                  />
                  <Button 
                    type="submit" 
                    disabled={isLoading || !currentMessage.trim()}
                    className="self-end bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    <span className="mr-2">💬</span>
                    Send
                  </Button>
                </form>
                <p className="text-xs text-slate-500 mt-2">
                  💡 Pro tip: Mention specific files or features for more contextual help
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">⚡ Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start text-left h-auto p-3"
                onClick={() => setCurrentMessage('Create a responsive navigation component')}
              >
                <div>
                  <div className="font-medium">🧭 Navigation</div>
                  <div className="text-xs text-slate-500">Create nav component</div>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full justify-start text-left h-auto p-3"
                onClick={() => setCurrentMessage('Help me debug this JavaScript error')}
              >
                <div>
                  <div className="font-medium">🐛 Debug Help</div>
                  <div className="text-xs text-slate-500">Fix code issues</div>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full justify-start text-left h-auto p-3"
                onClick={() => setCurrentMessage('Optimize my code for better performance')}
              >
                <div>
                  <div className="font-medium">⚡ Optimize</div>
                  <div className="text-xs text-slate-500">Improve performance</div>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full justify-start text-left h-auto p-3"
                onClick={() => setCurrentMessage('Add authentication to my application')}
              >
                <div>
                  <div className="font-medium">🔐 Auth</div>
                  <div className="text-xs text-slate-500">Add login system</div>
                </div>
              </Button>
            </CardContent>
          </Card>

          {/* Context Info */}
          {currentProject && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📋 Context</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Project:</span>
                    <Badge variant="outline">{currentProject.name}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Type:</span>
                    <Badge className="bg-blue-100 text-blue-800">{currentProject.type}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">AI Model:</span>
                    <Badge className={getModelColor(selectedModel)}>{selectedModel}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">💡 Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-slate-600">
                <div className="flex items-start space-x-2">
                  <span>🎯</span>
                  <span>Be specific about what you want to achieve</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span>📄</span>
                  <span>Mention file names for targeted help</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span>🔍</span>
                  <span>Ask for explanations of complex concepts</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span>⚡</span>
                  <span>Use Ctrl+Enter to send quickly</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}