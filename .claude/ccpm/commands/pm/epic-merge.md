---
allowed-tools: Bash, Read, Write
---

# Epic Merge

Merge completed epic from worktree back to main branch.

## Usage

```text
/pm:epic-merge <epic_name>
```

## Goal

Safely merge a completed epic branch to main, close related GitHub issues, and clean up the worktree.

## Prerequisites

Run the merge task:

```bash
mise run //:ccpm:epic:merge $ARGUMENTS
```

This will:

- Validate worktree exists with no uncommitted changes
- Run tests if available in mise.toml
- Merge epic branch to main with `--no-ff`
- Close all GitHub issues (epic + tasks)
- Remove worktree and delete branches
- Archive epic to `.claude/epics/archived/`
- Push to main

If the task succeeds, the epic is merged and cleaned up. If it fails, the error message will guide you.

## Instructions

The mise task handles all deterministic operations. You only need to run it when the epic is complete.

## Expected Output

```text
✅ Epic Merged: $ARGUMENTS

Summary:
  Branch: epic/$ARGUMENTS → main
  Files changed: {count}
  Issues closed: {epic_issue} + {task_count} tasks

Cleanup:
  ✓ Worktree removed
  ✓ Branch deleted
  ✓ Epic archived
  ✓ Pushed to main

Next: Start new epic with /pm:prd-new
```

## Handling Conflicts

If merge conflicts occur:

- Report conflicting files to user
- Suggest manual resolution steps
- Offer to abort merge
- Preserve worktree for investigation
