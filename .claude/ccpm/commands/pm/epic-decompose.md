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

Read epic requirements and create numbered task files from template.

## Prerequisites

- Epic exists: `.claude/epics/$ARGUMENTS/epic.md`
- Confirm before overwriting existing tasks

## Instructions

1. **Read Epic**
   - Load `.claude/epics/$ARGUMENTS/epic.md`
   - Analyze technical approach and task breakdown preview
   - Identify discrete, concrete tasks

2. **Create Task Files**
   - For each task, copy template: `.claude/ccpm/templates/task-template.md`
   - Save as: `.claude/epics/$ARGUMENTS/{number}.md` (001.md, 002.md, etc.)
   - Replace placeholders:
     - `TASK_TITLE` → Task name
     - `CREATED_DATETIME` → Current ISO datetime (`date -u +"%Y-%m-%dT%H:%M:%SZ"`)
     - `UPDATED_DATETIME` → Same as created
   - Fill in all sections:
     - Description: What needs to be done
     - Acceptance Criteria: Specific, testable requirements
     - Technical Details: Implementation approach, files affected
     - Effort Estimate: T-shirt size (XS/S/M/L/XL)
   - Set `depends_on` to task numbers that must complete first (e.g., [001, 002])
   - Set `parallel: true` if can run concurrently, `false` if sequential

3. **Update Epic**
   - Add task list to epic.md:

     ```markdown
     ## Tasks Created
     - [ ] 001.md - Title (parallel: true/false)
     - [ ] 002.md - Title (parallel: true/false)

     Total: {count} | Parallel: {count} | Sequential: {count}
     ```

4. **Output**
   - Confirm: "✅ Created {count} tasks for epic: $ARGUMENTS"
   - Suggest: "Next: /pm:epic-sync $ARGUMENTS"
