---
allowed-tools: Bash, Read, Write, LS
---

# Epic Decompose

Break epic into concrete, actionable tasks.

## Usage

```text
/pm:epic-decompose <feature_name>
```

## Goal

Read epic requirements and create numbered task files with proper frontmatter and structure.

## Prerequisites

- Epic exists: `.claude/epics/$ARGUMENTS/epic.md`
- Confirm before overwriting existing tasks

## Task File Format

Create `.claude/epics/$ARGUMENTS/{number}.md` files:

```markdown
---
name: Task Title
status: open
created: [ISO datetime]
updated: [ISO datetime]
github: [Will be set by epic-sync]
depends_on: [001, 002]
parallel: true
conflicts_with: []
---

# Task: Title

## Description
What needs to be done

## Acceptance Criteria
- [ ] Specific, testable requirements

## Technical Details
- Implementation approach
- Files affected

## Effort Estimate
T-shirt size: XS | S | M | L | XL
```

## After Creating Tasks

Update epic.md with:

```markdown
## Tasks Created
- [ ] 001.md - Title (parallel: true/false)
- [ ] 002.md - Title (parallel: true/false)

Total: {count} | Parallel: {count} | Sequential: {count}
```

## Expected Output

```text
✅ Created {count} tasks for epic: $ARGUMENTS
Next: /pm:epic-sync $ARGUMENTS
```
