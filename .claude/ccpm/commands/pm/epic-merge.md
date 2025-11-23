---
allowed-tools: Bash, Read, Write
---

# Epic Merge

Merge completed epic from worktree back to main branch.

## Usage

```text
/pm:epic-merge <epic_name>

```text

## Quick Check

1. **Verify worktree exists:**
   ```bash
   git worktree list | grep "epic-$ARGUMENTS" || echo "❌ No worktree for epic: $ARGUMENTS"
   ```

1. **Check for active agents:**
   Read `.claude/epics/$ARGUMENTS/execution-status.md`
   If active agents exist: "⚠️ Active agents detected. Stop them first with: /pm:epic-stop $ARGUMENTS"

## Instructions

### 1. Pre-Merge Validation

Navigate to worktree and check status:

```bash
cd ../epic-$ARGUMENTS

# Check for uncommitted changes
if [[ $(git status --porcelain) ]]; then
  echo "⚠️ Uncommitted changes in worktree:"
  git status --short
  echo "Commit or stash changes before merging"
  exit 1
fi

# Check branch status
git fetch origin
git status -sb

```text

### 2. Run Tests (Optional)

Run your project's test suite. Check `.mise.toml` for the test task or run tests manually.

```bash
mise run test  # or whatever your project uses
```

### 3. Update Epic Documentation

Get current datetime: `date -u +"%Y-%m-%dT%H:%M:%SZ"`

Update `.claude/epics/$ARGUMENTS/epic.md`:

- Set status to "completed"
- Update completion date
- Add final summary

### 4. Attempt Merge

```bash
# Return to main repository
cd {main-repo-path}

# Ensure main is up to date
git checkout main
git pull origin main

# Attempt merge
echo "Merging epic/$ARGUMENTS to main..."
git merge epic/$ARGUMENTS --no-ff -m "Merge epic: $ARGUMENTS

Completed features:
# Generate feature list
feature_list=""
if [ -d ".claude/epics/$ARGUMENTS" ]; then
  cd .claude/epics/$ARGUMENTS
  for task_file in [0-9]*.md; do
    [ -f "$task_file" ] || continue
    task_name=$(grep '^name:' "$task_file" | cut -d: -f2 | sed 's/^ *//')
    feature_list="$feature_list\n- $task_name"
  done
  cd - > /dev/null
fi

echo "$feature_list"

# Extract epic issue number
epic_github_line=$(grep 'github:' .claude/epics/$ARGUMENTS/epic.md 2>/dev/null || true)
if [ -n "$epic_github_line" ]; then
  epic_issue=$(echo "$epic_github_line" | grep -oE '[0-9]+' || true)
  if [ -n "$epic_issue" ]; then
    echo "\nCloses epic #$epic_issue"
  fi
fi"

```text

### 5. Handle Merge Conflicts

If merge fails with conflicts:

```bash
# Check conflict status
git status

echo "
❌ Merge conflicts detected!

Conflicts in:
$(git diff --name-only --diff-filter=U)

Options:
1. Resolve manually:
   - Edit conflicted files
   - git add {files}
   - git commit
   
2. Abort merge:
   git merge --abort
   
3. Get help:
   /pm:epic-resolve $ARGUMENTS

Worktree preserved at: ../epic-$ARGUMENTS
"
exit 1

```text

### 6. Post-Merge Cleanup

If merge succeeds:

```bash
# Push to remote
git push origin main

# Clean up worktree
git worktree remove ../epic-$ARGUMENTS
echo "✅ Worktree removed: ../epic-$ARGUMENTS"

# Delete branch
git branch -d epic/$ARGUMENTS
git push origin --delete epic/$ARGUMENTS 2>/dev/null || true

# Archive epic locally
mkdir -p .claude/epics/archived/
mv .claude/epics/$ARGUMENTS .claude/epics/archived/
echo "✅ Epic archived: .claude/epics/archived/$ARGUMENTS"

```text

### 7. Update GitHub Issues

Close related issues:

```bash
# Get issue numbers from epic
# Extract epic issue number
epic_github_line=$(grep 'github:' .claude/epics/archived/$ARGUMENTS/epic.md 2>/dev/null || true)
if [ -n "$epic_github_line" ]; then
  epic_issue=$(echo "$epic_github_line" | grep -oE '[0-9]+$' || true)
else
  epic_issue=""
fi

# Close epic issue
gh issue close $epic_issue -c "Epic completed and merged to main"

# Close task issues
for task_file in .claude/epics/archived/$ARGUMENTS/[0-9]*.md; do
  [ -f "$task_file" ] || continue
  # Extract task issue number
  task_github_line=$(grep 'github:' "$task_file" 2>/dev/null || true)
  if [ -n "$task_github_line" ]; then
    issue_num=$(echo "$task_github_line" | grep -oE '[0-9]+$' || true)
  else
    issue_num=""
  fi
  if [ ! -z "$issue_num" ]; then
    gh issue close $issue_num -c "Completed in epic merge"
  fi
done

```text

### 8. Final Output

```text

✅ Epic Merged Successfully: $ARGUMENTS

Summary:
  Branch: epic/$ARGUMENTS → main
  Commits merged: {count}
  Files changed: {count}
  Issues closed: {count}
  
Cleanup completed:
  ✓ Worktree removed
  ✓ Branch deleted
  ✓ Epic archived
  ✓ GitHub issues closed
  
Next steps:
  - Deploy changes if needed
  - Start new epic: /pm:prd-new {feature}
  - View completed work: git log --oneline -20

```text

## Conflict Resolution Help

If conflicts need resolution:

```text

The epic branch has conflicts with main.

This typically happens when:
- Main has changed since epic started
- Multiple epics modified same files
- Dependencies were updated

To resolve:
1. Open conflicted files
2. Look for <<<<<<< markers
3. Choose correct version or combine
4. Remove conflict markers
5. git add {resolved files}
6. git commit
7. git push

Or abort and try later:
  git merge --abort

```text

## Important Notes

- Always check for uncommitted changes first
- Run tests before merging if appropriate
- Use --no-ff to preserve epic history
- Archive epic data instead of deleting
- Close GitHub issues to maintain sync
