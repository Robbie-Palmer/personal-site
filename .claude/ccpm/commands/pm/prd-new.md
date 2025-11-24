---
allowed-tools: Bash, Read, Write, LS
---

# PRD New

Launch brainstorming for new product requirement document.

## Usage

```text
/pm:prd-new <feature_name>
```

## Prerequisites

Run the setup task to validate the name and create the directory structure:

```bash
mise run //:ccpm:prd:new $ARGUMENTS
```

This will:

- Validate feature name format (kebab-case)
- Check for existing PRD and prompt for overwrite
- Create `.claude/prds/` directory if needed
- Copy template to `.claude/prds/$ARGUMENTS.md` with frontmatter filled in

If the task succeeds, the template file is ready for you to fill in. If it fails, the error message will guide you.

## Goal

Conduct a product management brainstorming session and create a comprehensive PRD for **$ARGUMENTS**.

## Instructions

1. **Discovery Phase**
   - Ask clarifying questions about the feature/product
   - Understand the problem being solved
   - Identify target users and use cases
   - Gather constraints and requirements

2. **Fill Template**
   - The template has been copied to: `.claude/prds/$ARGUMENTS.md`
   - Placeholders already replaced (feature name, created datetime)
   - Fill in all sections with comprehensive content (no placeholder text)

3. **Quality Check**
   - All sections complete
   - User stories include acceptance criteria
   - Success criteria are measurable
   - Dependencies clearly identified
   - Out of scope items explicitly listed

4. **Completion**
   - Confirm: "✅ PRD created: .claude/prds/$ARGUMENTS.md"
   - Show brief summary
   - Suggest: "Ready to create implementation epic? Run: /pm:prd-parse $ARGUMENTS"
