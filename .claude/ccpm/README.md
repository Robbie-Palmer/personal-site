# CCPM - Claude Code Project Management

Lightweight project management using GitHub Issues as source of truth, with local markdown files for offline work.

Forked from https://github.com/automazeio/ccpm

## Quick Start

```bash
# 1. Create a Product Requirements Document (committed to git)
/pm:prd-new feature-name
git add .claude/prds/feature-name.md
git commit -m "docs: add feature PRD"

# 2. Convert PRD to Epic (local working copy)
/pm:prd-parse feature-name

# 3. Break Epic into Tasks (local working copy)
/pm:epic-decompose feature-name

# 4. Sync to GitHub (creates issues - now source of truth)
/pm:epic-sync feature-name

# 5. Work in isolated worktree
cd ../epic-feature-name
# Make commits, implement tasks

# 6. Post progress updates to GitHub
/pm:issue-sync 123
```

## Design Philosophy

**Project management is separate from code execution.** PRDs live in git as documentation.
Epics and tasks live in GitHub Issues as the source of truth for work tracking.
Local `.claude/epics/` files are working copies only (gitignored).
This follows traditional project management models where PRDs are documentation and epics / tasks are in a separate work tracking system.

## Workflow

**On your machine:**

```bash
/pm:prd-new auth        # Create PRD, commit to git
/pm:epic-decompose auth # Create tasks locally
/pm:epic-sync auth      # Push to GitHub (source of truth)
cd ../epic-auth         # Work in worktree
```

**On another machine:**

```bash
git pull                # Get PRDs
/pm:import              # Pull epics/tasks from GitHub
cd ../epic-auth         # Continue work
```

**On any branch:**

```bash
git checkout -b feature/auth
/pm:import              # Issues exist independently of branches
# Work on issue #123 from any branch
```

## Commands

### Core Workflow

- `/pm:prd-new <name>` - Create PRD (commit to git)
- `/pm:prd-parse <name>` - PRD → Epic (local)
- `/pm:epic-decompose <name>` - Epic → Tasks (local)
- `/pm:epic-sync <name>` - Push to GitHub (→ source of truth)
- `/pm:import` - Pull from GitHub
- `/pm:sync` - Bidirectional sync
- `/pm:issue-sync <number>` - Post progress

### Management

- `/pm:epic-refresh <name>` - Update epic progress
- `/pm:epic-merge <name>` - Merge completed epic

## File Structure

```text
.claude/
├── prds/
│   └── feature-name.md           # Committed to git (documentation)
├── epics/                        # Gitignored (working copies)
│   └── feature-name/
│       ├── epic.md               # Working copy from GitHub
│       ├── 123.md                # Working copy (issue #123)
│       └── 124.md                # Working copy (issue #124)
└── ccpm/
    ├── commands/pm/              # 9 PM commands
    ├── rules/                    # 2 safety rules
    └── README.md                 # This file

../epic-feature-name/             # Worktree for isolated work
```

- GitHub Issues = source of truth for epics/tasks
- Local .claude/epics/ = working copies only (gitignored)

## Task File Format

```markdown
---
name: Task Title
status: open
created: 2025-01-15T10:00:00Z
updated: 2025-01-16T14:30:00Z
github: https://github.com/user/repo/issues/123
depends_on: [121, 122]
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

## How Sync Works

**Local → GitHub (epic-sync, sync):**

1. Strip frontmatter from local task files
2. Create/update GitHub issues with full content
3. Encode metadata as labels: `depends:123`, `parallel`, `epic:name`
4. GitHub is now source of truth

**GitHub → Local (import, sync):**

1. Fetch issues with full JSON metadata
2. Parse body for structured content
3. Reconstruct frontmatter from labels + dates
4. Write to local `.claude/epics/` (working copies)

**Result:** Work online/offline, GitHub is always source of truth.

## Integration with mise.toml

Commands describe goals, not exact bash commands. Claude uses your project's tooling:

```toml
# If you want shortcuts, add to .mise.toml:
[tasks."pm:status"]
run = "gh issue list --label epic"

[tasks."pm:my-issues"]
run = "gh issue list --assignee @me"
```

## Summary

- **PRDs (git)** - Documentation, committed and versioned
- **Epics/Tasks (GitHub)** - Work tracking, issues are source of truth
- **Local files** - Working copies for offline work (gitignored)
- **Bidirectional sync** - Work offline, sync when online
