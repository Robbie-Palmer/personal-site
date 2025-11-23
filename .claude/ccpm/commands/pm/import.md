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

## Steps

1. **Fetch Issues**
   - Get issues with JSON: `number,title,body,state,labels,createdAt,updatedAt`
   - Filter by provided options

2. **Identify Untracked**
   - Search local files for existing `github:` URLs
   - Skip already imported issues

3. **Categorize by Labels**
   - `epic` label → Create epic structure
   - `task` + `epic:{name}` → Create task in that epic
   - Other issues → Ask user or create in "imported" epic

4. **Create Local Files**

For each issue:

- Parse GitHub body for structured content (Description, Acceptance Criteria, etc.)
- Reconstruct frontmatter:

  ```yaml
  name: {issue title}
  status: {open|closed}
  created: {GitHub createdAt}
  updated: {GitHub updatedAt}
  github: {issue URL}
  depends_on: [{extract from depends:NNN labels}]
  parallel: {true if has parallel label}
  conflicts_with: []
  imported: true
  ```

- Combine frontmatter + GitHub body content into local `.md` file
- Use issue number as filename: `{issue_number}.md`

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
