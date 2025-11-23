---
allowed-tools: Bash, Read, Write, LS
---

# Issue Sync

Post local development progress to GitHub as issue comments.

## Usage

```text
/pm:issue-sync <issue_number>
```

## Goal

Gather local progress updates and post them to GitHub as a formatted comment.

## Prerequisites

- Remote is not CCPM template repo
- Issue exists on GitHub
- Local updates exist: `.claude/epics/*/updates/$ARGUMENTS/`

## Gather From

- `.claude/epics/{epic_name}/updates/$ARGUMENTS/progress.md`
- `.claude/epics/{epic_name}/updates/$ARGUMENTS/notes.md`
- Any other update files

## Comment Format

```markdown
## 🔄 Progress Update

### Completed
{what's done}

### In Progress
{current work}

### Technical Notes
{key decisions}

### Acceptance Criteria
- ✅ {done}
- 🔄 {in progress}
- ⏸️ {blocked}

### Next Steps
{planned}

### Blockers
{any}

---
*Progress: {%} | {timestamp}*
```

## After Posting

- Update task file `updated:` timestamp
- Update progress.md `last_sync:` field
- If complete: set task `status: closed`, recalculate epic progress

## Expected Output

```text
☁️  Synced to Issue #$ARGUMENTS
  Progress: {%}
```
