---
allowed-tools: Bash, Read, Write, LS
---

# Epic Sync

Push epic and tasks to GitHub as issues with full content.

## Usage

```text
/pm:epic-sync <feature_name>
```

## Goal

Sync local epic and task files to GitHub Issues, preserving all content so issues can be imported back on other machines.

## Prerequisites

- Epic exists: `.claude/epics/$ARGUMENTS/epic.md`
- Tasks exist: `.claude/epics/$ARGUMENTS/001.md`, `002.md`, etc.
- Remote is not the CCPM template repo

## Steps

1. **Create Epic Issue**
   - Strip frontmatter from epic.md
   - Create GitHub issue with full markdown content (all sections: Description, Requirements, etc.)
   - Labels: `epic,epic:$ARGUMENTS`

2. **Create Task Issues**
   - For each task file: Strip frontmatter, include ALL content (Description, Acceptance Criteria, Technical Details,
     Effort Estimate)
   - Labels: `task,epic:$ARGUMENTS`
   - If `depends_on` has values, add labels: `depends:001`, `depends:002`
   - If `parallel: true`, add label: `parallel`
   - Use `gh-sub-issue` extension if available for parent/child relationships

3. **Rename & Update Local Files**
   - Rename `001.md` → `{issue_number}.md`
   - Update `depends_on`/`conflicts_with` to use real issue numbers
   - Set `github:` field to issue URL
   - Update `updated:` timestamp

4. **Update Epic**
   - Add GitHub URL to epic frontmatter
   - Update "Tasks Created" section with real issue numbers

5. **Create Worktree**
   - Create worktree at `../epic-$ARGUMENTS` on branch `epic/$ARGUMENTS`

## Important: Content Preservation

GitHub issue bodies MUST contain all task content so they can be imported back:

- ✅ Include: Description, Acceptance Criteria, Technical Details, Effort Estimate
- ❌ Exclude: Frontmatter (reconstructed from GitHub metadata on import)

## Expected Output

```text
✅ Synced to GitHub
  - Epic: #{number} - Full content preserved
  - Tasks: {count} sub-issues - All sections included
  - Worktree: ../epic-$ARGUMENTS

Issues can be imported on other machines with /pm:import
```
