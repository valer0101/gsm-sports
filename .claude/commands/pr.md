---
allowed-tools: Bash(git status*), Bash(git diff*), Bash(git log*), Bash(git push*), Bash(git rev-parse*), Bash(git branch*), Bash(gh pr create*), Bash(gh pr view*)
description: Create a pull request on GitHub with proper title and description. Use when user says "PR", "pull request", "создай PR".
---

Create a GitHub pull request for the current branch.

## Steps

1. Run these commands to understand the current state:
   - `git branch --show-current` — get current branch name
   - `git status` — check for uncommitted changes
   - `git log main..HEAD --oneline` — see all commits on this branch
   - `git diff main...HEAD --stat` — see changed files

2. If there are uncommitted changes, warn the user and suggest running `/commit` first.

3. Push the branch to remote:
   ```
   git push -u origin <branch-name>
   ```

4. Analyze all commits and changed files to create:
   - **Title**: Short (under 70 chars), starts with type prefix (`feat:`, `fix:`, etc.)
   - **Body**: Summary of what changed and why

5. Create the PR using `gh pr create`:
   ```
   gh pr create --title "title" --body "$(cat <<'EOF'
   ## Summary
   - bullet points of changes

   ## Changed areas
   - [ ] Backend (apps/api)
   - [ ] Frontend (apps/web)
   - [ ] Bracket engine (packages/bracket-engine)
   - [ ] Shared types (packages/shared-types)
   - [ ] Database migrations
   - [ ] Documentation

   ## Test plan
   - [ ] How to test these changes

   EOF
   )"
   ```

6. Return the PR URL to the user.

7. Suggest: "Run `/code-review <PR_NUMBER>` to review this PR."
