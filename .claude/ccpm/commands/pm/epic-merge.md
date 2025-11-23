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

- Epic worktree exists at `../epic-$ARGUMENTS`
- Epic branch `epic/$ARGUMENTS` exists
- All tasks are completed (check epic.md status)
- No active agents running (check execution-status.md if it exists)

## Steps

1. **Validate State**
   - Verify worktree exists and has no uncommitted changes
   - Check epic completion status
   - Run tests if configured in mise.toml

2. **Merge to Main**
   - Update main branch from remote
   - Merge epic branch with `--no-ff` (preserve history)
   - Include epic summary in merge commit message
   - Handle conflicts if they occur (abort and report if needed)

3. **Update Epic Documentation**
   - Mark epic as completed
   - Update completion timestamp
   - Archive to `.claude/epics/archived/$ARGUMENTS`

4. **Close GitHub Issues**
   - Extract epic and task issue numbers from frontmatter
   - Close epic issue with completion comment
   - Close all related task issues

5. **Cleanup**
   - Remove worktree
   - Delete local and remote epic branch
   - Push changes to main

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
