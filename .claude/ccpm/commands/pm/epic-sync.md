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

Run the sync task to create GitHub issues:

```bash
mise run //:ccpm:epic:sync $ARGUMENTS
```

This will:

- Validate epic exists with tasks
- Create GitHub epic issue with full content
- Create task issues with labels (epic:name, parallel, depends:NNN)
- Rename local files to issue numbers
- Update frontmatter with GitHub URLs
- Create worktree at `../epic-$ARGUMENTS`

If the task succeeds, all issues are created and the worktree is ready. If it fails, the error message will
guide you.

## Instructions

After running the mise task, you may want to:

1. **Link Sub-Issues** (if not using gh-sub-issue extension):
   Use GraphQL API to link tasks to epic as sub-issues (see sync.md for details)

2. **Verify Sync**:
   Check that all GitHub issues contain full content and correct labels

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
