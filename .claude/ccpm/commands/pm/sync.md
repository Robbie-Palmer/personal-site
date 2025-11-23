---
allowed-tools: Bash, Read, Write, LS
---

# Sync

Bidirectional sync between local files and GitHub Issues.

## Usage

```text
/pm:sync [epic_name]
```

If epic_name provided, sync only that epic. Otherwise sync all.

## Goal

Keep local markdown files and GitHub issues in sync, preserving all content in both directions.

## Steps

### 1. Pull from GitHub

- Fetch all epic/task issues with full JSON metadata
- For each issue, compare with local file by issue number

### 2. GitHub → Local (Import changes)

For each GitHub issue:

- Find local file: `.claude/epics/*/{issue_number}.md`
- If no local file exists: Create it (like `/pm:import`)
- If local exists but GitHub is newer (`updatedAt` > local `updated`):
  - Update local file content from GitHub body
  - Update frontmatter from GitHub metadata (state, labels)
  - Preserve local-only fields (notes, etc.)

### 3. Local → GitHub (Export changes)

For each local task file:

- Check if it has `github:` URL
- If no URL: Create new GitHub issue (like `/pm:epic-sync`)
- If URL exists but issue deleted: Mark local as archived
- If local is newer (`updated` > GitHub `updatedAt`):
  - Update GitHub issue body from local content (strip frontmatter)
  - Update labels from frontmatter (`depends_on` → `depends:NNN` labels, `parallel` → `parallel` label)

### 4. Handle Conflicts

If both changed (local `updated` and GitHub `updatedAt` both newer than last sync):

- Show diff of both versions
- Ask user: "Both changed. Keep: (local/github/merge)?"
- Apply choice

### 5. Update Timestamps

Update all synced files with current `updated`/`last_sync` timestamp.

## Expected Output

```text
🔄 Sync Complete

← From GitHub:
  Updated: {count} files
  Created: {count} new files
  Closed: {count} issues

→ To GitHub:
  Updated: {count} issues
  Created: {count} issues

Conflicts resolved: {count}

Status: ✅ All in sync
```

## Important

- GitHub issue bodies have full content (all sections)
- Frontmatter is reconstructed from GitHub metadata on import
- Labels encode metadata: `depends:123`, `parallel`, `epic:name`, `task`
- This enables working across multiple machines seamlessly
