---
allowed-tools: Bash(gh issue view:*), Bash(gh search:*), Bash(gh issue list:*), Bash(gh pr comment:*), Bash(gh pr diff:*), Bash(gh pr view:*), Bash(gh pr list:*), Bash(gh api:*)
description: Code review a pull request. Use when user says "code review", "review PR", "проверь PR", "ревью".
---

Provide a code review for the given pull request.

**Agent assumptions (applies to all agents and subagents):**
- All tools are functional and will work without error.
- Only call a tool if it is required to complete the task.

## Steps

1. Launch a haiku agent to check if any of the following are true:
    - The pull request is closed
    - The pull request is a draft
    - The pull request does not need code review (e.g. automated PR, trivial change)
    - Claude has already reviewed this PR **and there are no new commits since the last review**:
      1. Run `gh pr view <PR> --comments` and find the most recent "## Code review" comment.
      2. Run `gh pr view <PR> --json commits` and find the latest commit timestamp.
      3. If review is more recent than latest commit → skip (already reviewed).

   If any condition is true, stop and do not proceed.

2. Launch a haiku agent to return a list of file paths for all relevant CLAUDE.md files.

3. Launch a sonnet agent to view the pull request and return a summary of the changes.

4. Launch 4 agents in parallel to independently review the changes:

   **Agents 1 + 2: CLAUDE.md compliance (sonnet)**
   Audit changes for CLAUDE.md compliance. Key rules to enforce:
   - **NO business logic in controllers** — controllers must only call service methods
   - **DTOs required** for request bodies with `class-validator` decorators
   - **No `console.log`** in backend code — use NestJS `Logger`
   - **TypeORM** patterns: use repository pattern, no raw SQL with string concatenation
   - **Guards** on protected endpoints (`@UseGuards(JwtAuthGuard)`)
   - **Frontend**: components must use React Query for data fetching, Zustand for state

   **Agent 3: Bug & logic agent (opus)**
   Scan for obvious bugs in the diff. Flag only significant bugs. Pay special attention to:
   - JWT/auth bypass vulnerabilities
   - SQL injection via TypeORM raw queries
   - Sensitive data exposure (tokens, keys in logs or responses)
   - Bracket logic errors (wrong winner propagation, bye handling)
   - Missing null checks on database results

   **Agent 4: Architecture compliance (sonnet)**
   Check the diff against project architecture from `docs/`:
   - Backend modules follow controller → service → TypeORM pattern
   - Database access goes through TypeORM repositories only
   - API routes follow REST conventions from `docs/04-API-DESIGN.md`
   - New sport modules follow the generic sport module pattern

   **CRITICAL: HIGH SIGNAL issues only.** Flag:
   - Code that will fail to compile or produce wrong results
   - Clear CLAUDE.md violations (quote the exact rule)
   - Security vulnerabilities

   Do NOT flag: style concerns, subjective suggestions, linter-catchable issues.

5. For each issue from agents 3 and 4, launch parallel subagents to **validate** the issue with high confidence.

6. Filter out unvalidated issues.

7. Output a summary:
    - If issues found: list each with description
    - If no issues: "No issues found. Checked for bugs, CLAUDE.md compliance, architecture, and security."

   If `--comment` argument was NOT provided, stop here.
   If `--comment` IS provided and NO issues, post summary comment via `gh pr comment`.
   If `--comment` IS provided and issues found, continue to step 8.

8. Post inline comments using `gh api` for each issue:
    - For small fixes: include a GitHub suggestion block
    - For larger fixes: describe the issue and suggested fix
    - **Only ONE comment per unique issue**

## False positives (do NOT flag):
- Pre-existing issues
- Pedantic nitpicks
- Linter-catchable issues
- Issues silenced by eslint-disable comments

## Comment format for no issues:

---

## Code review

No issues found. Checked for bugs, CLAUDE.md compliance, architecture compliance, and security.

---
