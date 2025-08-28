import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/utils/trpc';
import type { Template, Project } from '../../../server/src/schema';

interface TemplateGalleryProps {
  sessionId: string;
  onCreateProject: (project: Project) => void;
}

export function TemplateGallery({ sessionId, onCreateProject }: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [creatingFromTemplate, setCreatingFromTemplate] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await trpc.getTemplates.query();
      setTemplates(result);
      setFilteredTemplates(result);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Filter templates based on search and type
  useEffect(() => {
    let filtered = templates;

    if (searchQuery) {
      filtered = filtered.filter((template: Template) => 
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((template: Template) => template.type === typeFilter);
    }

    setFilteredTemplates(filtered);
  }, [templates, searchQuery, typeFilter]);

  const handleCreateFromTemplate = async (template: Template) => {
    try {
      setCreatingFromTemplate(template.id);
      
      const newProject = await trpc.createProject.mutate({
        name: `${template.name} Project`,
        description: `Created from ${template.name} template`,
        type: template.type,
        template_id: template.id,
        session_id: sessionId
      });

      onCreateProject(newProject);
    } catch (error) {
      console.error('Failed to create project from template:', error);
    } finally {
      setCreatingFromTemplate(null);
    }
  };

  const getTemplateIcon = (type: string) => {
    switch (type) {
      case 'react': return '⚛️';
      case 'vue': return '💚';
      case 'angular': return '🅰️';
      case 'vanilla': return '🍦';
      case 'node': return '📗';
      default: return '📋';
    }
  };

  const getTemplateColor = (type: string) => {
    switch (type) {
      case 'react': return 'bg-blue-100 text-blue-800';
      case 'vue': return 'bg-green-100 text-green-800';
      case 'angular': return 'bg-red-100 text-red-800';
      case 'vanilla': return 'bg-yellow-100 text-yellow-800';
      case 'node': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Mock featured templates for demonstration since backend returns empty array
  const mockFeaturedTemplates: Template[] = [
    {
      id: 'template-1',
      name: 'React Dashboard',
      description: 'Modern dashboard with charts, tables, and responsive design',
      type: 'react',
      files: [],
      tags: ['dashboard', 'charts', 'responsive'],
      is_featured: true,
      created_at: new Date(),
      usage_count: 1250
    },
    {
      id: 'template-2',
      name: 'Landing Page',
      description: 'Beautiful landing page with hero section, features, and contact form',
      type: 'vanilla',
      files: [],
      tags: ['landing', 'marketing', 'responsive'],
      is_featured: true,
      created_at: new Date(),
      usage_count: 890
    },
    {
      id: 'template-3',
      name: 'Vue E-commerce',
      description: 'Complete e-commerce solution with shopping cart and checkout',
      type: 'vue',
      files: [],
      tags: ['ecommerce', 'shopping', 'vue3'],
      is_featured: true,
      created_at: new Date(),
      usage_count: 675
    },
    {
      id: 'template-4',
      name: 'Node.js API',
      description: 'RESTful API with authentication, validation, and database integration',
      type: 'node',
      files: [],
      tags: ['api', 'rest', 'authentication'],
      is_featured: false,
      created_at: new Date(),
      usage_count: 445
    },
    {
      id: 'template-5',
      name: 'Angular Portfolio',
      description: 'Professional portfolio website with projects showcase',
      type: 'angular',
      files: [],
      tags: ['portfolio', 'professional', 'showcase'],
      is_featured: true,
      created_at: new Date(),
      usage_count: 320
    },
    {
      id: 'template-6',
      name: 'Blog Template',
      description: 'Clean and minimal blog template with markdown support',
      type: 'vanilla',
      files: [],
      tags: ['blog', 'markdown', 'clean'],
      is_featured: false,
      created_at: new Date(),
      usage_count: 280
    }
  ];

  // Use mock templates if backend returns empty
  const displayTemplates = filteredTemplates.length > 0 ? filteredTemplates : 
    (searchQuery || typeFilter !== 'all') ? [] : mockFeaturedTemplates;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">🎯 Template Gallery</h2>
        <p className="text-slate-600 mt-1">
          Start your project with pre-built templates and best practices
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="🔍 Search templates..."
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
        
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">🔧 All Types</SelectItem>
            <SelectItem value="react">⚛️ React</SelectItem>
            <SelectItem value="vue">💚 Vue.js</SelectItem>
            <SelectItem value="angular">🅰️ Angular</SelectItem>
            <SelectItem value="vanilla">🍦 Vanilla JS</SelectItem>
            <SelectItem value="node">📗 Node.js</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-slate-200 rounded w-3/4"></div>
                <div className="h-4 bg-slate-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-4 bg-slate-200 rounded w-full"></div>
                  <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                  <div className="h-8 bg-slate-200 rounded w-full"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : displayTemplates.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold mb-2">No Templates Found</h3>
            <p className="text-slate-600 mb-6">
              {searchQuery || typeFilter !== 'all' 
                ? 'Try adjusting your search criteria'
                : 'Templates are being loaded from the cloud'
              }
            </p>
            {(searchQuery || typeFilter !== 'all') && (
              <div className="space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setSearchQuery('')}
                >
                  Clear Search
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setTypeFilter('all')}
                >
                  Show All Types
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Featured Templates Section */}
          {displayTemplates.some(t => t.is_featured) && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-slate-900 flex items-center">
                ⭐ Featured Templates
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayTemplates.filter(template => template.is_featured).map((template: Template) => (
                  <Card key={template.id} className="hover:shadow-lg transition-shadow duration-200">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center space-x-2">
                          <span>{getTemplateIcon(template.type)}</span>
                          <span className="truncate">{template.name}</span>
                        </CardTitle>
                        <Badge className="bg-yellow-100 text-yellow-800">
                          ⭐ Featured
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getTemplateColor(template.type)}>
                          {template.type}
                        </Badge>
                        <Badge variant="outline" className="text-slate-600">
                          {template.usage_count} uses
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      <p className="text-slate-600 text-sm mb-4 line-clamp-2">
                        {template.description}
                      </p>
                      
                      <div className="flex flex-wrap gap-1 mb-4">
                        {template.tags.slice(0, 3).map((tag: string) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {template.tags.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{template.tags.length - 3}
                          </Badge>
                        )}
                      </div>

                      <Button 
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                        onClick={() => handleCreateFromTemplate(template)}
                        disabled={creatingFromTemplate === template.id}
                      >
                        {creatingFromTemplate === template.id 
                          ? '🚀 Creating...' 
                          : '✨ Use This Template'
                        }
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* All Templates Section */}
          {displayTemplates.some(t => !t.is_featured) && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-slate-900 flex items-center">
                📋 All Templates
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayTemplates.filter(template => !template.is_featured).map((template: Template) => (
                  <Card key={template.id} className="hover:shadow-lg transition-shadow duration-200">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center space-x-2">
                        <span>{getTemplateIcon(template.type)}</span>
                        <span className="truncate">{template.name}</span>
                      </CardTitle>
                      <div className="flex items-center space-x-2">
                        <Badge className={getTemplateColor(template.type)}>
                          {template.type}
                        </Badge>
                        <Badge variant="outline" className="text-slate-600">
                          {template.usage_count} uses
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      <p className="text-slate-600 text-sm mb-4 line-clamp-2">
                        {template.description}
                      </p>
                      
                      <div className="flex flex-wrap gap-1 mb-4">
                        {template.tags.slice(0, 3).map((tag: string) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {template.tags.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{template.tags.length - 3}
                          </Badge>
                        )}
                      </div>

                      <Button 
                        className="w-full"
                        variant="outline"
                        onClick={() => handleCreateFromTemplate(template)}
                        disabled={creatingFromTemplate === template.id}
                      >
                        {creatingFromTemplate === template.id 
                          ? '🚀 Creating...' 
                          : '✨ Use Template'
                        }
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}