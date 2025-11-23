#!/usr/bin/env node
/**
 * Wrap long lines in markdown files to meet MD013 requirements
 *
 * This script wraps lines longer than 120 characters while preserving:
 * - Code blocks
 * - Headings
 * - Lists
 * - Links
 * - Frontmatter
 */

import fs from 'fs';
import path from 'path';

const MAX_LINE_LENGTH = 120;

function findMarkdownFiles(dir, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'epics' && entry.name !== 'node_modules') {
      findMarkdownFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

function wrapLine(line, maxLength) {
  if (line.length <= maxLength) {
    return [line];
  }

  const words = line.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length > maxLength && currentLine.length > 0) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    }
  }

  if (currentLine) {
    lines.push(currentLine.trim());
  }

  return lines.length > 0 ? lines : [line];
}

const args = process.argv.slice(2);
const searchPaths = args.length > 0 ? args : ['.claude/'];

const files = searchPaths.flatMap(p => findMarkdownFiles(p));

console.log(`Processing ${files.length} markdown files...`);

let fixedCount = 0;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const newLines = [];

  let inFrontmatter = false;
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track frontmatter
    if (line === '---') {
      inFrontmatter = !inFrontmatter;
      newLines.push(line);
      continue;
    }

    // Track code blocks
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      newLines.push(line);
      continue;
    }

    // Skip wrapping for special cases
    if (inFrontmatter || inCodeBlock || line.startsWith('#') || line.startsWith('-') ||
        line.startsWith('*') || line.startsWith('>') || line.trim().startsWith('|') ||
        line.match(/^\s*\d+\./) || line.trim() === '' || line.includes('http')) {
      newLines.push(line);
      continue;
    }

    // Wrap long prose lines
    if (line.length > MAX_LINE_LENGTH) {
      const wrapped = wrapLine(line, MAX_LINE_LENGTH);
      newLines.push(...wrapped);
    } else {
      newLines.push(line);
    }
  }

  const newContent = newLines.join('\n');
  if (newContent !== content) {
    fs.writeFileSync(file, newContent);
    console.log(`✓ Fixed: ${file}`);
    fixedCount++;
  }
});

console.log(`\nDone! Fixed ${fixedCount} of ${files.length} files.`);
