---
allowed-tools: Bash, Read, Write, LS
---

# Sync

Bidirectional sync between local files and GitHub Issues.

## Usage

```text
/pm:sync [epic_name]
```

If epic_name provided, sync only that epic. Otherwise sync all.

## Goal

Keep local markdown files and GitHub issues in sync, preserving all content in both directions.

## Instructions

Run the sync task:

```bash
mise run //:ccpm:sync [$ARGUMENTS]
```

Options:

- Argument: Epic name (optional - syncs only that epic)
- No args: Sync all epics

This will:

### GitHub → Local

- Fetch all GitHub issues
- Create local files for new issues
- Update local files when GitHub is newer
- Preserve frontmatter structure

### Local → GitHub

- Create GitHub issues for unsynced local files
- Update GitHub when local is newer
- Update labels and state

### Conflict Detection

- Detect when both local and GitHub changed
- Report conflicts for manual resolution

## Post-Sync: Link Sub-Issues

After sync, link task issues to epic as sub-issues using GraphQL API:

```bash
# Get epic issue ID
epic_id=$(gh api graphql -f query='query { repository(owner: "OWNER", name: "REPO") { issue(number: EPIC_NUM) { id } } }' --jq '.data.repository.issue.id')

# Link each task
for task_num in TASK_NUM_1 TASK_NUM_2 TASK_NUM_3; do
  task_id=$(gh api graphql -f query="query { repository(owner: \"OWNER\", name: \"REPO\") { issue(number: $task_num) { id } } }" --jq '.data.repository.issue.id')
  gh api graphql -f query="mutation { addSubIssue(input: {issueId: \"$epic_id\", subIssueId: \"$task_id\"}) { issue { number } } }"
done
```

## Expected Output

```text
🔄 Sync Complete

← From GitHub:
  Updated: {count} files
  Created: {count} new files
  Closed: {count} issues

→ To GitHub:
  Updated: {count} issues
  Created: {count} issues

Conflicts resolved: {count}

Status: ✅ All in sync
```

## Important

- Epic issue bodies should contain full epic content WITHOUT redundant task lists (GitHub's sub-issues
  section displays tasks automatically)
- Task issue bodies should contain full task content INCLUDING dependencies listed as "#123" references
- Frontmatter is reconstructed from GitHub metadata on import
- Labels encode metadata: `epic:name`, `task`, `parallel`
- Dependencies between tasks are documented in task issue bodies (e.g., "**Dependencies:** #81, #82")
- Sub-issues must be linked via GraphQL API using the `addSubIssue` mutation
- This enables working across multiple machines seamlessly
