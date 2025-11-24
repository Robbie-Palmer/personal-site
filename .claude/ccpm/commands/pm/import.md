---
allowed-tools: Bash, Read, Write, LS
---

# Import

Import GitHub issues to local markdown files, reconstructing full structure.

## Usage

```text
/pm:import [--epic <epic_name>] [--label <label>]
```

Options:

- `--epic` - Import into specific epic
- `--label` - Import only issues with label
- No args - Import all untracked issues

## Goal

Pull GitHub issues and create local markdown files with frontmatter + full content.

## Instructions

Run the import task:

```bash
mise run //:ccpm:import [$ARGUMENTS] [--label <label>]
```

Options:

- First argument: Epic name (optional - imports only that epic's issues)
- `--label`: Import only issues with specific label (optional)
- No args: Import all untracked issues

This will:

- Fetch all GitHub issues as JSON
- Skip issues already tracked locally
- Categorize by labels (epic, task, epic:name)
- Reconstruct frontmatter from GitHub metadata
- Create local files with full content
- Mark with `imported: true`

## Expected Output

```text
📥 Import Complete

Imported:
  Epics: {count}
  Tasks: {count}

Created:
  .claude/epics/{epic_1}/
    - {count} tasks with full content
  .claude/epics/{epic_2}/
    - {count} tasks with full content

Skipped (already tracked): {count}

All files ready for local development!
```

## Important

- Preserve all GitHub content in local files
- Reconstruct frontmatter from GitHub metadata (labels, dates, etc.)
- Mark with `imported: true` in frontmatter
- Don't overwrite existing local files
