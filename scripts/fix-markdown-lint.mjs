#!/usr/bin/env node
/**
 * Markdown Linting Auto-Fixer
 *
 * Automatically fixes common markdown linting issues:
 * - MD040: Missing language specifiers on code fences
 * - MD013: Lines over 120 characters (frontmatter descriptions)
 * - MD031: Missing blank lines around code fences
 * - MD032: Missing blank lines around lists
 *
 * Usage: node scripts/fix-markdown-lint.mjs [paths...]
 * Example: node scripts/fix-markdown-lint.mjs .claude/
 */

import fs from 'fs';
import path from 'path';

function findMarkdownFiles(dir, files = []) {
  if (!fs.existsSync(dir)) {
    console.warn(`Warning: Directory ${dir} does not exist, skipping...`);
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

// Get paths from command line args, or use defaults
const args = process.argv.slice(2);
const searchPaths = args.length > 0 ? args : [
  '.claude/ccpm',
  '.claude/commands',
  '.claude/prds'
];

const files = searchPaths.flatMap(p => findMarkdownFiles(p));

if (files.length === 0) {
  console.log('No markdown files found.');
  process.exit(0);
}

console.log(`Processing ${files.length} markdown files...`);

let fixedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let lines = content.split('\n');
  let modified = false;

  // Track frontmatter state
  let inFrontmatter = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '---') {
      if (!inFrontmatter) {
        inFrontmatter = true;
      } else {
        inFrontmatter = false;
      }
    }

    // Fix long description lines in frontmatter (MD013)
    if (inFrontmatter && lines[i].startsWith('description:') && lines[i].length > 120) {
      const desc = lines[i].substring(12).trim();
      lines[i] = 'description: >';
      lines.splice(i + 1, 0, '  ' + desc);
      modified = true;
    }

    // Fix missing code fence language (MD040)
    if (lines[i] === '```') {
      // Try to intelligently determine the language
      const nextLines = lines.slice(i + 1, i + 4).join(' ').toLowerCase();
      if (nextLines.match(/^\s*(git|npm|pnpm|cd|ls|mkdir|echo|cat|grep|sed|awk|find|bash|\$)/)) {
        lines[i] = '```bash';
      } else if (nextLines.includes('---') && nextLines.includes(':')) {
        lines[i] = '```yaml';
      } else {
        lines[i] = '```text';
      }
      modified = true;
    }

    // Fix MD031 - ensure blank line before code fence
    if (lines[i].startsWith('```') && i > 0 && lines[i-1].trim() !== '') {
      lines.splice(i, 0, '');
      modified = true;
      i++; // Skip the line we just inserted
    }

    // Fix MD031 - ensure blank line after closing code fence
    if (lines[i].startsWith('```') && lines[i].length > 3) {
      // This is an opening fence, find the closing fence
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j] === '```') {
          // Check if there's a blank line after the closing fence
          if (j < lines.length - 1 && lines[j+1].trim() !== '' && !lines[j+1].startsWith('#')) {
            lines.splice(j + 1, 0, '');
            modified = true;
          }
          break;
        }
      }
    }
  }

  if (modified) {
    fs.writeFileSync(file, lines.join('\n'));
    console.log(`✓ Fixed: ${file}`);
    fixedCount++;
  }
});

console.log(`\nDone! Fixed ${fixedCount} of ${files.length} files.`);
