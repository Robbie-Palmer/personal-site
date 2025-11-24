---
allowed-tools: Bash, Read, Write, LS
---

# PRD Parse

Convert PRD to technical implementation epic.

## Usage

```text
/pm:prd-parse <feature_name>
```

## Prerequisites

Run the setup task to validate and prepare:

```bash
mise run //:ccpm:prd:parse $ARGUMENTS
```

This will:

- Verify PRD exists at `.claude/prds/$ARGUMENTS.md`
- Validate PRD frontmatter
- Check for existing epic and prompt for overwrite
- Create `.claude/epics/$ARGUMENTS/` directory
- Copy template to `.claude/epics/$ARGUMENTS/epic.md` with frontmatter filled in

If the task succeeds, the template file is ready for you to fill in. If it fails, the error message will guide you.

## Goal

Convert the PRD into a detailed technical implementation epic for **$ARGUMENTS**.

## Instructions

1. **Read PRD**
   - Load `.claude/prds/$ARGUMENTS.md`
   - Analyze all requirements and constraints
   - Understand user stories and success criteria
   - Extract PRD description from frontmatter

2. **Technical Analysis**
   - **Architecture**: Identify key technical decisions needed, determine technology stack and approaches
   - **Mapping**: Map functional requirements to technical components (Frontend, Backend, Infrastructure)
   - **Integration**: Identify integration points and external dependencies
   - **Risk**: Identify potential technical risks and mitigation strategies

3. **Fill Template**
   - The template has been copied to: `.claude/epics/$ARGUMENTS/epic.md`
   - Placeholders already replaced (feature name, created datetime, prd reference)
   - Fill all sections with comprehensive technical details:
     - **Architecture Decisions**: Technology choices, design patterns, rationale
     - **Technical Approach**: Frontend components, backend services, infrastructure needs
     - **Implementation Strategy**: Development phases, risk mitigation, testing approach
     - **Task Breakdown Preview**: High-level categories (aim for ≤10 total tasks)
     - **Dependencies**: External services, internal teams, prerequisite work
     - **Success Criteria**: Performance benchmarks, quality gates, technical acceptance criteria
     - **Estimated Effort**: Timeline, resources, critical path

4. **Quality Check**
   - All PRD requirements addressed in technical approach
   - Task breakdown categories cover all implementation areas
   - Dependencies are technically accurate and complete
   - Effort estimates are realistic
   - Architecture decisions are justified
   - **Aim for ≤10 tasks total** - simplify and leverage existing functionality where possible

5. **Completion**
   - Confirm: "✅ Epic created: .claude/epics/$ARGUMENTS/epic.md"
   - Show summary:
     - Number of task categories identified
     - Key architecture decisions
     - Estimated effort
   - Suggest: "Ready to break down into tasks? Run: /pm:epic-decompose $ARGUMENTS"
