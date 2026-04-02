---
allowed-tools: Bash(git checkout*), Bash(git pull*), Bash(git branch*), Bash(git status*)
description: Create a new feature branch from latest main. Use when user says "branch", "create branch", "new branch", "создай ветку", "новая ветка".
---

Create a new git branch from the latest main.

## Input
The user provides a branch name (e.g., "tournament-api", "add-rankings", "auth-module").
If no prefix is given, add `feature/` prefix automatically.

## Steps

1. Check for uncommitted changes with `git status`. If there are changes:
   - **STOP. Do not switch branches.**
   - Warn the user that there are uncommitted changes
   - Suggest running `/commit` first to save their work
   - Do not proceed until the working tree is clean

2. Switch to main and pull latest:
   ```
   git checkout main
   git pull
   ```

3. Create and switch to the new branch:
   ```
   git checkout -b feature/<branch-name>
   ```

4. Confirm to the user:
   - Branch name
   - That it's based on latest main
   - Ready to start coding
