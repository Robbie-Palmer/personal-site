# CCPM - GitHub Issues Project Management

Lightweight project management using GitHub Issues, local markdown files, and bidirectional sync.

## Quick Start

```bash
# 1. Create a Product Requirements Document
/pm:prd-new feature-name

# 2. Convert PRD to Epic
/pm:prd-parse feature-name

# 3. Break Epic into Tasks
/pm:epic-decompose feature-name

# 4. Sync to GitHub (creates issues with full content)
/pm:epic-sync feature-name

# 5. Work in isolated worktree
cd ../epic-feature-name
# Make commits, implement tasks

# 6. Post progress updates
/pm:issue-sync 123
```

## Key Features

### Full Content Sync

GitHub issues contain complete task details, not just titles. You can import and work on any machine:

```bash
# On another machine
git clone <repo>
/pm:import          # Pulls all issues with full content
# Now you have complete .claude/epics/ structure
```

### Metadata Encoding

- Local frontmatter (`depends_on`, `parallel`) → GitHub labels (`depends:123`, `parallel`)
- GitHub labels + content → Reconstructed local frontmatter on import
- No data loss in either direction

### Worktree Support

Each epic gets an isolated worktree for parallel work:

```text
../epic-auth/       # Work on auth feature
../epic-payments/   # Work on payments feature
```

## Commands

### Core Workflow

- `/pm:prd-new <name>` - Create PRD
- `/pm:prd-parse <name>` - PRD → Epic
- `/pm:epic-decompose <name>` - Epic → Tasks
- `/pm:epic-sync <name>` - Push to GitHub
- `/pm:import` - Pull from GitHub
- `/pm:sync` - Bidirectional sync
- `/pm:issue-sync <number>` - Post progress

### Management

- `/pm:status` - Project overview
- `/pm:epic-refresh <name>` - Update epic progress
- `/pm:epic-merge <name>` - Merge completed epic
- `/pm:init` - Initialize CCPM
- `/pm:help` - Documentation

## File Structure

```text
.claude/
├── prds/
│   └── feature-name.md           # Product requirements
├── epics/
│   └── feature-name/
│       ├── epic.md               # Epic overview
│       ├── 123.md                # Task (GitHub issue #123)
│       └── 124.md                # Task (GitHub issue #124)
└── ccpm/
    ├── commands/pm/              # 12 PM commands
    ├── rules/                    # 2 safety rules
    └── README.md                 # This file

../epic-feature-name/             # Worktree for isolated work
```

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
- Size: S/M/L
- Hours: 4-8
```

## Bidirectional Sync

**Local → GitHub:**

1. Strip frontmatter from task files
2. Create GitHub issues with full content (all sections)
3. Encode metadata as labels: `depends:123`, `parallel`, `epic:name`

**GitHub → Local:**

1. Fetch issues with full JSON metadata
2. Parse body for structured content
3. Reconstruct frontmatter from labels + dates
4. Create local files with issue numbers as filenames

**Result:** Complete task files can be recreated from GitHub alone.

## Integration with mise.toml

Commands describe goals, not exact bash commands. Claude uses your project's tooling:

```toml
# If you want shortcuts, add to .mise.toml:
[tasks."pm:status"]
run = "find .claude/epics -name '*.md' | wc -l"

[tasks."pm:list"]
run = "ls .claude/epics/*/epic.md"
```

## Philosophy

- **Goal-oriented commands** - Describe WHAT, not HOW
- **Trust Claude** - Knows git, bash, gh CLI, can read files
- **Full content sync** - No data loss across machines
- **Minimal** - 21 files, 128KB total
