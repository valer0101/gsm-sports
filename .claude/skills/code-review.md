---
allowed-tools: Bash(gh issue view:*), Bash(gh search:*), Bash(gh issue list:*), Bash(gh pr comment:*), Bash(gh pr diff:*), Bash(gh pr view:*), Bash(gh pr list:*), Bash(gh api:*)
description: Code review a pull request
---

Provide a code review for the given pull request.

**Agent assumptions:** All tools are functional. Only call a tool if required.

## Steps

1. Check if PR should be skipped (closed, draft, already reviewed with no new commits).

2. Find all relevant CLAUDE.md files.

3. Get PR summary.

4. Launch 4 parallel review agents:
   - **Agents 1+2 (sonnet):** CLAUDE.md compliance — no business logic in controllers, DTOs required, no console.log, TypeORM patterns, guards on endpoints.
   - **Agent 3 (opus):** Bugs — auth bypass, SQL injection, null checks, bracket logic errors.
   - **Agent 4 (sonnet):** Architecture — controller→service→TypeORM pattern, REST conventions from docs/04-API-DESIGN.md.

   **HIGH SIGNAL only.** No style concerns, no subjective suggestions.

5. Validate each issue with parallel subagents.

6. Output summary. If `--comment` provided, post inline comments via `gh api`.

## False positives (do NOT flag):
- Pre-existing issues, pedantic nitpicks, linter-catchable issues
