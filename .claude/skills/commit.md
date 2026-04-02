---
allowed-tools: Bash(git status*), Bash(git diff*), Bash(git log*), Bash(git add*), Bash(git commit*)
description: Create a conventional commit with proper message format
---

Create a git commit following the project's conventional commit format.

## Steps

1. Run `git status` and `git diff --staged` to see what's changed. If nothing is staged, run `git diff` to see unstaged changes.

2. If nothing is staged, stage the relevant files. Do NOT use `git add -A` or `git add .`. Stage specific files by name. Never stage:
   - `.env` files
   - `node_modules/`, `dist/`, `.next/`, `.turbo/`
   - Files with hardcoded secrets or API keys

3. Run `git log --oneline -10` to see the recent commit message style.

4. Create a commit message: `<type>(<scope>): <short description>`

   Types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `style`
   Scopes: `api`, `web`, `bracket`, `db`, `auth`, `i18n`

   Rules: English, lowercase after colon, no period, under 72 chars.

5. Create the commit with HEREDOC. Run `git status` after to verify.
