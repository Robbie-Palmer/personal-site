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

## Instructions

Run the refresh task:

```bash
mise run //:ccpm:epic:refresh $ARGUMENTS
```

This will:

- Count total and closed tasks
- Calculate progress percentage
- Determine status (backlog/in-progress/completed)
- Update epic.md frontmatter
- Report changes

## Expected Output

```text
🔄 Epic refreshed: $ARGUMENTS

Tasks: {closed}/{total} completed
Progress: {old}% → {new}%
Status: {old_status} → {new_status}
GitHub: Synced ✓

Next: {/pm:epic-merge if complete, /pm:next otherwise}
```
