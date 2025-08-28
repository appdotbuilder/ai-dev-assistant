import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { templatesTable } from '../db/schema';
import { getTemplates } from '../handlers/get_templates';

const testTemplate1 = {
  id: 'template-1',
  name: 'React Starter',
  description: 'A basic React application template',
  type: 'react' as const,
  files: [
    {
      path: 'src/App.jsx',
      content: 'import React from "react";\n\nfunction App() {\n  return <h1>Hello World</h1>;\n}\n\nexport default App;',
      type: 'jsx' as const
    },
    {
      path: 'package.json',
      content: '{\n  "name": "react-starter",\n  "version": "1.0.0",\n  "dependencies": {\n    "react": "^18.0.0"\n  }\n}',
      type: 'json' as const
    }
  ],
  tags: ['react', 'frontend', 'starter'],
  is_featured: true,
  usage_count: 150
};

const testTemplate2 = {
  id: 'template-2',
  name: 'Node Express API',
  description: 'Express.js REST API template',
  type: 'node' as const,
  files: [
    {
      path: 'server.js',
      content: 'const express = require("express");\nconst app = express();\n\napp.get("/", (req, res) => {\n  res.json({ message: "Hello World" });\n});\n\napp.listen(3000);',
      type: 'js' as const
    }
  ],
  tags: ['node', 'express', 'backend', 'api'],
  is_featured: false,
  usage_count: 75
};

const testTemplate3 = {
  id: 'template-3',
  name: 'Vue Starter',
  description: 'Basic Vue.js application template',
  type: 'vue' as const,
  files: [
    {
      path: 'src/App.vue',
      content: '<template>\n  <div id="app">\n    <h1>{{ message }}</h1>\n  </div>\n</template>\n\n<script>\nexport default {\n  name: "App",\n  data() {\n    return {\n      message: "Hello Vue!"\n    };\n  }\n};\n</script>',
      type: 'js' as const
    }
  ],
  tags: ['vue', 'frontend'],
  is_featured: true,
  usage_count: 100
};

describe('getTemplates', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no templates exist', async () => {
    const result = await getTemplates();
    
    expect(result).toEqual([]);
  });

  it('should fetch all templates from database', async () => {
    // Insert test templates
    await db.insert(templatesTable).values([
      testTemplate1,
      testTemplate2,
      testTemplate3
    ]).execute();

    const result = await getTemplates();

    expect(result).toHaveLength(3);
    
    // Verify template data
    const reactTemplate = result.find(t => t.id === 'template-1');
    expect(reactTemplate).toBeDefined();
    expect(reactTemplate!.name).toBe('React Starter');
    expect(reactTemplate!.description).toBe('A basic React application template');
    expect(reactTemplate!.type).toBe('react');
    expect(reactTemplate!.is_featured).toBe(true);
    expect(reactTemplate!.usage_count).toBe(150);
    expect(Array.isArray(reactTemplate!.files)).toBe(true);
    expect(Array.isArray(reactTemplate!.tags)).toBe(true);
    expect(reactTemplate!.tags).toEqual(['react', 'frontend', 'starter']);
    expect(reactTemplate!.files).toHaveLength(2);
    expect(reactTemplate!.created_at).toBeInstanceOf(Date);
  });

  it('should return templates ordered by featured status first, then by usage count', async () => {
    // Insert test templates
    await db.insert(templatesTable).values([
      testTemplate1, // featured: true, usage: 150
      testTemplate2, // featured: false, usage: 75
      testTemplate3  // featured: true, usage: 100
    ]).execute();

    const result = await getTemplates();

    expect(result).toHaveLength(3);
    
    // Featured templates should come first
    expect(result[0].is_featured).toBe(true);
    expect(result[1].is_featured).toBe(true);
    expect(result[2].is_featured).toBe(false);
    
    // Among featured templates, higher usage count should come first
    expect(result[0].usage_count).toBe(150); // React Starter
    expect(result[1].usage_count).toBe(100); // Vue Starter
    expect(result[2].usage_count).toBe(75);  // Node Express API
  });

  it('should properly handle template files array structure', async () => {
    // Insert template with multiple files
    await db.insert(templatesTable).values([testTemplate1]).execute();

    const result = await getTemplates();
    const template = result[0];

    expect(template.files).toHaveLength(2);
    
    const appFile = template.files[0];
    expect(appFile.path).toBe('src/App.jsx');
    expect(appFile.type).toBe('jsx');
    expect(appFile.content).toContain('import React');
    
    const packageFile = template.files[1];
    expect(packageFile.path).toBe('package.json');
    expect(packageFile.type).toBe('json');
    expect(packageFile.content).toContain('"name": "react-starter"');
  });

  it('should properly handle template tags array', async () => {
    await db.insert(templatesTable).values([testTemplate1]).execute();

    const result = await getTemplates();
    const template = result[0];

    expect(Array.isArray(template.tags)).toBe(true);
    expect(template.tags).toEqual(['react', 'frontend', 'starter']);
    expect(template.tags).toHaveLength(3);
  });

  it('should handle templates with different project types', async () => {
    await db.insert(templatesTable).values([
      testTemplate1, // react
      testTemplate2, // node
      testTemplate3  // vue
    ]).execute();

    const result = await getTemplates();

    const types = result.map(t => t.type);
    expect(types).toContain('react');
    expect(types).toContain('node');
    expect(types).toContain('vue');
  });

  it('should handle templates with minimal file structure', async () => {
    const minimalTemplate = {
      id: 'minimal-template',
      name: 'Minimal Template',
      description: 'A minimal template',
      type: 'vanilla' as const,
      files: [
        {
          path: 'index.html',
          content: '<!DOCTYPE html><html><head><title>Hello</title></head><body><h1>Hello World</h1></body></html>',
          type: 'html' as const
        }
      ],
      tags: ['minimal'],
      is_featured: false,
      usage_count: 1
    };

    await db.insert(templatesTable).values([minimalTemplate]).execute();

    const result = await getTemplates();
    
    expect(result).toHaveLength(1);
    expect(result[0].files).toHaveLength(1);
    expect(result[0].files[0].type).toBe('html');
    expect(result[0].tags).toEqual(['minimal']);
  });

  it('should handle templates with no tags', async () => {
    const noTagsTemplate = {
      id: 'no-tags-template',
      name: 'No Tags Template',
      description: 'Template without tags',
      type: 'vanilla' as const,
      files: [
        {
          path: 'index.js',
          content: 'console.log("Hello");',
          type: 'js' as const
        }
      ],
      tags: [],
      is_featured: false,
      usage_count: 5
    };

    await db.insert(templatesTable).values([noTagsTemplate]).execute();

    const result = await getTemplates();
    
    expect(result).toHaveLength(1);
    expect(Array.isArray(result[0].tags)).toBe(true);
    expect(result[0].tags).toEqual([]);
  });
});