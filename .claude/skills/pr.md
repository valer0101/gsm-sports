---
allowed-tools: Bash(git status*), Bash(git diff*), Bash(git log*), Bash(git push*), Bash(git rev-parse*), Bash(git branch*), Bash(gh pr create*), Bash(gh pr view*)
description: Create a pull request on GitHub with proper title and description
---

Create a GitHub PR for the current branch.

## Steps

1. Check state: branch name, uncommitted changes, commits, changed files.
2. If uncommitted changes → warn, suggest `/commit`.
3. Push: `git push -u origin <branch>`.
4. Create PR with `gh pr create` — title under 70 chars with type prefix, body with Summary + Changed areas + Test plan.
5. Return PR URL.
6. Suggest `/code-review <PR#>`.
