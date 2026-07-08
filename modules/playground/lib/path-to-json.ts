import * as fs from 'fs';
import * as path from 'path';

/**
 * Represents a file in the template structure
 */
export interface TemplateFile {
  filename: string;
  fileExtension: string;
  content: string;
}

/**
 * Represents a folder in the template structure which can contain files and other folders
 */
export interface TemplateFolder {
  folderName: string;
  items: (TemplateFile | TemplateFolder)[];
}

/**
 * Type representing either a file or folder in the template structure
 */
export type TemplateItem = TemplateFile | TemplateFolder;

/**
 * Options for scanning template directories
 */
interface ScanOptions {
  /**
   * Files to ignore (exact filenames with extensions)
   */
  ignoreFiles?: string[];
  
  /**
   * Folders to ignore (exact folder names)
   */
  ignoreFolders?: string[];
  
  /**
   * File patterns to ignore (regex patterns)
   */
  ignorePatterns?: RegExp[];
  
  /**
   * Maximum size of file to include content (in bytes)
   * Files larger than this will have a placeholder message instead of content
   */
  maxFileSize?: number;
}

/**
 * Scans a template directory and returns a structured JSON representation
 * 
 * @param templatePath - Path to the template directory
 * @param options - Scanning options to customize behavior
 * @returns Promise resolving to the template structure as JSON
 */
export async function scanTemplateDirectory(
  templatePath: string,
  options: ScanOptions = {}
): Promise<TemplateFolder> {
  // Set default options
  const defaultOptions: ScanOptions = {
    ignoreFiles: [
      'package-lock.json',
      'yarn.lock',
      '.DS_Store',
      'thumbs.db',
      '.gitignore',
      '.npmrc',
      '.yarnrc',
      '.env',
      '.env.local',
      '.env.development',
      '.env.production'
    ],
    ignoreFolders: [
      'node_modules',
      '.git',
      '.vscode',
      '.idea',
      'dist',
      'build',
      'coverage'
    ],
    ignorePatterns: [
      /^\..+\.swp$/,  // Vim swap files
      /^\.#/,         // Emacs backup files
      /~$/            // Backup files
    ],
    maxFileSize: 1024 * 1024 // 1MB
  };
  
  // Merge provided options with defaults
  const mergedOptions: ScanOptions = {
    ignoreFiles: [...(defaultOptions.ignoreFiles || []), ...(options.ignoreFiles || [])],
    ignoreFolders: [...(defaultOptions.ignoreFolders || []), ...(options.ignoreFolders || [])],
    ignorePatterns: [...(defaultOptions.ignorePatterns || []), ...(options.ignorePatterns || [])],
    maxFileSize: options.maxFileSize !== undefined ? options.maxFileSize : defaultOptions.maxFileSize
  };

  // Validate the input path
  if (!templatePath) {
    throw new Error('Template path is required');
  }

  // Check if the template path exists
  try {
    const stats = await fs.promises.stat(templatePath);
    if (!stats.isDirectory()) {
      throw new Error(`'${templatePath}' is not a directory`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      try {
        console.log(`Template directory '${templatePath}' does not exist. Creating default template files...`);
        await createDefaultTemplate(templatePath);
      } catch (initError) {
        throw new Error(`Failed to initialize default template at '${templatePath}': ${(initError as Error).message}`);
      }
    } else {
      throw error;
    }
  }

  // Get the folder name from the path
  const folderName = path.basename(templatePath);

  // Process the directory and return the result
  return processDirectory(folderName, templatePath, mergedOptions);
}

async function createDefaultTemplate(templatePath: string): Promise<void> {
  const folderName = path.basename(templatePath);
  
  // Ensure parent directory exists (vibecode-starters)
  const parentDir = path.dirname(templatePath);
  await fs.promises.mkdir(parentDir, { recursive: true });
  
  // Create target directory
  await fs.promises.mkdir(templatePath, { recursive: true });

  const files: Record<string, string> = {};

  if (folderName === "react-ts") {
    files["package.json"] = JSON.stringify({
      name: "react-starter",
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "tsc && vite build"
      },
      dependencies: {
        react: "^18.3.1",
        "react-dom": "^18.3.1"
      },
      devDependencies: {
        "@types/react": "^18.3.3",
        "@types/react-dom": "^18.3.0",
        "@vitejs/plugin-react": "^4.3.1",
        "typescript": "^5.2.2",
        "vite": "^5.3.1"
      }
    }, null, 2);
    
    files["index.html"] = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React + TS</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

    files["vite.config.ts"] = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`;

    files["src/main.tsx"] = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`;

    files["src/index.css"] = `:root {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  line-height: 1.5;
  font-weight: 400;
  color-scheme: light dark;
  color: #213547;
  background-color: #ffffff;
  margin: 0;
  padding: 0;
}

@media (prefers-color-scheme: dark) {
  :root {
    color: #f3f4f6;
    background-color: #0f172a;
  }
}

body {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 320px;
  min-height: 100vh;
  background: linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%);
}

@media (prefers-color-scheme: dark) {
  body {
    background: linear-gradient(135deg, #020617 0%, #0f172a 100%);
  }
}

.card {
  padding: 2.5rem;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 24px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
  text-align: center;
  max-width: 400px;
  width: 90%;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

@media (prefers-color-scheme: dark) {
  .card {
    background: rgba(30, 41, 59, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.05);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  }
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
}

h1 {
  font-size: 2.25rem;
  font-weight: 800;
  margin-top: 0;
  margin-bottom: 0.5rem;
  background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

@media (prefers-color-scheme: dark) {
  h1 {
    background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}

p {
  color: #64748b;
  margin-bottom: 2rem;
  font-size: 1rem;
}

@media (prefers-color-scheme: dark) {
  p {
    color: #94a3b8;
  }
}

button {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border: none;
  border-radius: 12px;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
  transition: transform 0.1s ease, box-shadow 0.2s ease, opacity 0.2s;
}

button:hover {
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
}

button:active {
  transform: scale(0.97);
}
`;

    files["src/App.tsx"] = `import React, { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="card">
      <h1>Vibecode React App</h1>
      <p>Start editing to see changes.</p>
      <button onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
    </div>
  )
}

export default App;`;

  } else if (folderName === "nextjs-new") {
    files["package.json"] = JSON.stringify({
      name: "nextjs-starter",
      version: "0.1.0",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start"
      },
      dependencies: {
        next: "14.2.4",
        react: "^18",
        "react-dom": "^18"
      },
      devDependencies: {
        typescript: "^5",
        "@types/node": "^20",
        "@types/react": "^18",
        "@types/react-dom": "^18"
      }
    }, null, 2);

    files[".babelrc"] = JSON.stringify({
      presets: ["next/babel"]
    }, null, 2);

    files["app/layout.tsx"] = `import React from 'react'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'sans-serif' }}>{children}</body>
    </html>
  )
}`;

    files["app/page.tsx"] = `import React from 'react'

export default function Home() {
  return (
    <main style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Vibecode Next.js App</h1>
      <p>Welcome to your Next.js application!</p>
    </main>
  )
}`;

  } else if (folderName === "express-simple") {
    files["package.json"] = JSON.stringify({
      name: "express-starter",
      version: "1.0.0",
      main: "index.js",
      scripts: {
        start: "node index.js"
      },
      dependencies: {
        express: "^4.19.2"
      }
    }, null, 2);

    files["index.js"] = `const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello from Vibecode Express Starter!');
});

app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});`;

  } else if (folderName === "vue") {
    files["package.json"] = JSON.stringify({
      name: "vue-starter",
      version: "0.0.0",
      private: true,
      type: "module",
      scripts: {
        dev: "vite",
        build: "vite build"
      },
      dependencies: {
        vue: "^3.4.29"
      },
      devDependencies: {
        "@vitejs/plugin-vue": "^5.0.5",
        vite: "^5.3.1"
      }
    }, null, 2);

    files["index.html"] = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Vue Starter</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>`;

    files["src/main.js"] = `import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')`;

    files["src/App.vue"] = `<template>
  <div style="text-align: center; padding: 2rem; font-family: sans-serif;">
    <h1>Vibecode Vue App</h1>
    <button @click="count++">Count: {{ count }}</button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const count = ref(0)
</script>`;

    files["vite.config.js"] = `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
})`;

  } else if (folderName === "hono-nodejs-starter") {
    files["package.json"] = JSON.stringify({
      name: "hono-starter",
      type: "module",
      scripts: {
        dev: "node --watch src/index.js",
        start: "node src/index.js"
      },
      dependencies: {
        "@hono/node-server": "^1.11.2",
        hono: "^4.4.7"
      }
    }, null, 2);

    files["src/index.js"] = `import { serve } from '@hono/node-server'
import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

const port = 3000
console.log(\`Server is running on port \${port}\`)

serve({
  fetch: app.fetch,
  port
})`;

  } else {
    files["package.json"] = JSON.stringify({
      name: "vibecode-starter",
      version: "1.0.0",
      scripts: {
        start: "echo 'Run config here'"
      }
    }, null, 2);
    
    files["README.md"] = `# Vibecode Starter\nCreated automatically.`;
  }

  for (const [filePath, fileContent] of Object.entries(files)) {
    const fullPath = path.join(templatePath, filePath);
    const fileDir = path.dirname(fullPath);
    await fs.promises.mkdir(fileDir, { recursive: true });
    await fs.promises.writeFile(fullPath, fileContent, "utf8");
  }
}

/**
 * Process a directory and its contents recursively
 * 
 * @param folderName - Name of the current folder
 * @param folderPath - Path to the current folder
 * @param options - Scanning options
 * @returns Promise resolving to a TemplateFolder object
 */
async function processDirectory(
  folderName: string, 
  folderPath: string, 
  options: ScanOptions
): Promise<TemplateFolder> {
  try {
    // Read directory contents
    const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
    const items: TemplateItem[] = [];

    // Process each entry in the directory
    for (const entry of entries) {
      const entryName = entry.name;
      const entryPath = path.join(folderPath, entryName);

      // Check if this entry should be skipped
      if (entry.isDirectory()) {
        // Skip ignored folders
        if (options.ignoreFolders?.includes(entryName)) {
          console.log(`Skipping ignored folder: ${entryPath}`);
          continue;
        }
        
        // If it's a directory, process it recursively
        const subFolder = await processDirectory(entryName, entryPath, options);
        items.push(subFolder);
      } else if (entry.isFile()) {
        // Skip ignored files
        if (options.ignoreFiles?.includes(entryName)) {
          console.log(`Skipping ignored file: ${entryPath}`);
          continue;
        }
        
        // Check against regex patterns
        const shouldSkip = options.ignorePatterns?.some(pattern => pattern.test(entryName));
        if (shouldSkip) {
          console.log(`Skipping file matching ignore pattern: ${entryPath}`);
          continue;
        }
        
        // If it's a file, get its details
        try {
          const stats = await fs.promises.stat(entryPath);
          const parsedPath = path.parse(entryName);
          let content: string;
          
          // Check file size before reading content
          if (options.maxFileSize && stats.size > options.maxFileSize) {
            content = `[File content not included: size (${stats.size} bytes) exceeds maximum allowed size (${options.maxFileSize} bytes)]`;
          } else {
            content = await fs.promises.readFile(entryPath, 'utf8');
          }
          
          items.push({
            filename: parsedPath.name,
            fileExtension: parsedPath.ext.replace(/^\./, ''), // Remove leading dot
            content
          });
        } catch (error) {
          console.error(`Error reading file ${entryPath}:`, error);
          // Still include the file but with an error message as content
          const parsedPath = path.parse(entryName);
          items.push({
            filename: parsedPath.name,
            fileExtension: parsedPath.ext.replace(/^\./, ''),
            content: `Error reading file: ${(error as Error).message}`
          });
        }
      }
      // Ignore other types of entries (symlinks, etc.)
    }

    // Return the folder with its items
    return {
      folderName,
      items
    };
  } catch (error) {
    throw new Error(`Error processing directory '${folderPath}': ${(error as Error).message}`);
  }
}

/**
 * Saves the template structure to a JSON file
 * 
 * @param templatePath - Path to the template directory
 * @param outputPath - Path where the JSON file should be saved
 * @param options - Scanning options
 * @returns Promise resolving when the file has been written
 */
export async function saveTemplateStructureToJson(
  templatePath: string, 
  outputPath: string,
  options?: ScanOptions
): Promise<void> {
  try {
    // Scan the template directory
    const templateStructure = await scanTemplateDirectory(templatePath, options);
    
    // Ensure the output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.promises.mkdir(outputDir, { recursive: true });
    
    // Write the JSON file
    const data = await fs.promises.writeFile(
      outputPath, 
      JSON.stringify(templateStructure, null, 2),
      'utf8'
    );
    console.log(`Template structure saved to ${outputPath}`);


    
  } catch (error) {
    throw new Error(`Error saving template structure: ${(error as Error).message}`);
  }
}

export async function readTemplateStructureFromJson(filePath: string): Promise<TemplateFolder> {
  try {
    const data = await fs.promises.readFile(filePath, 'utf8');
    return JSON.parse(data) as TemplateFolder;
  } catch (error) {
    throw new Error(`Error reading template structure: ${(error as Error).message}`);
  }
}

/**
 * Example usage:
 * 
 * // Basic usage with default options
 * const templateStructure = await scanTemplateDirectory('./templates/react-app');
 * 
 * // With custom options
 * const customOptions = {
 *   ignoreFiles: ['README.md', 'CHANGELOG.md'],
 *   ignoreFolders: ['docs', 'examples'],
 *   maxFileSize: 500 * 1024 // 500KB
 * };
 * const templateStructure = await scanTemplateDirectory('./templates/react-app', customOptions);
 * 
 * // Saving directly to a JSON file with custom options
 * await saveTemplateStructureToJson(
 *   './templates/react-app', 
 *   './output/react-app-template.json',
 *   customOptions
 * );
 */