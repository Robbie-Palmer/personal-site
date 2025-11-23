---
allowed-tools: Read, Write, Bash
---

# Epic Refresh

Update epic progress based on task states.

## Usage

```text
/pm:epic-refresh <epic_name>
```

## Goal

Recalculate epic completion percentage and status based on task states, sync with GitHub.

## Steps

1. **Count Tasks**
   - Scan all task files in `.claude/epics/$ARGUMENTS/`
   - Count total, closed, and open tasks

2. **Calculate Progress**
   - Progress = (closed_tasks / total_tasks) * 100
   - Round to nearest integer

3. **Determine Status**
   - `backlog` if 0% and no work started
   - `in-progress` if 0% < progress < 100%
   - `completed` if 100%

4. **Update Epic**
   - Update epic.md frontmatter: status, progress, updated timestamp
   - Preserve all other fields

5. **Sync GitHub**
   - If epic has GitHub issue, update task checkboxes to match local status
   - Checked = closed, unchecked = open

## Expected Output

```text
🔄 Epic refreshed: $ARGUMENTS

Tasks: {closed}/{total} completed
Progress: {old}% → {new}%
Status: {old_status} → {new_status}
GitHub: Synced ✓

Next: {/pm:epic-merge if complete, /pm:next otherwise}
```
