# GitHub Operations Rule

Standard patterns for GitHub CLI operations.

## Authentication

Don't pre-check authentication. Just run commands and handle failures:

```bash
gh {command} || echo "❌ GitHub CLI failed. Run: gh auth login"
```

## Common Operations

The `gh` CLI auto-detects the repository from git remote.

### Get Issue Details

```bash
gh issue view {number} --json state,title,labels,body
```

### Create Issue

```bash
gh issue create --title "{title}" --body-file {file} --label "{labels}"
```

### Update Issue

```bash
gh issue edit {number} --add-label "{label}"
```

### Add Comment

```bash
gh issue comment {number} --body-file {file}
```

## Error Handling

If any `gh` command fails:

1. Show error: "❌ GitHub operation failed: {command}"
2. Suggest fix: "Run: gh auth login" or check parameters
3. Don't retry automatically
