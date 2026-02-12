import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTENT_DIR = path.join(__dirname, '../src/content');
const PUBLIC_DIR = path.join(__dirname, '../public/mermaid');
const TIL_DIR = path.join(CONTENT_DIR, 'til');

// Ensure public/mermaid directory exists
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

let diagramCount = 0;

function renderMermaidToSvg(code, outputPath) {
  const tempFile = path.join('/tmp', `temp-${Date.now()}.mmd`);
  fs.writeFileSync(tempFile, code);

  try {
    execSync(`npx mmdc -i ${tempFile} -o ${outputPath} -b transparent -s 2`, {
      stdio: 'pipe',
    });
    fs.unlinkSync(tempFile);
    return true;
  } catch (error) {
    console.error(`Failed to render mermaid diagram: ${error.message}`);
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    return false;
  }
}

function processMarkdownFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const outputLines = [];
  let inMermaidBlock = false;
  let mermaidCode = [];
  let mermaidStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === '```mermaid') {
      inMermaidBlock = true;
      mermaidStartLine = i;
      mermaidCode = [];
      continue;
    }

    if (inMermaidBlock && line.trim() === '```') {
      inMermaidBlock = false;
      const code = mermaidCode.join('\n');

      // Generate SVG
      const fileName = `diagram-${Date.now()}-${diagramCount++}.svg`;
      const svgPath = path.join(PUBLIC_DIR, fileName);
      const relativePath = `/mermaid/${fileName}`;

      if (renderMermaidToSvg(code, svgPath)) {
        console.log(`✓ Rendered: ${fileName}`);
        outputLines.push('');
        outputLines.push(`![Diagram](${relativePath})`);
        outputLines.push('');
      } else {
        // Fallback to code block if rendering fails
        outputLines.push('```mermaid');
        outputLines.push(...mermaidCode);
        outputLines.push('```');
      }
      continue;
    }

    if (inMermaidBlock) {
      mermaidCode.push(line);
    } else {
      outputLines.push(line);
    }
  }

  // Write back to file
  fs.writeFileSync(filePath, outputLines.join('\n'));
  return diagramCount;
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      processDirectory(filePath);
    } else if (path.extname(file) === '.md') {
      console.log(`Processing: ${filePath}`);
      processMarkdownFile(filePath);
    }
  }
}

// Process TIL directory
console.log('Rendering Mermaid diagrams in TIL entries...\n');
processDirectory(TIL_DIR);
console.log(`\nTotal diagrams rendered: ${diagramCount}`);
