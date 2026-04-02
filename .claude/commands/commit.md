---
allowed-tools: Bash(git status*), Bash(git diff*), Bash(git log*), Bash(git add*), Bash(git commit*)
description: Create a conventional commit with proper message format. Use when user says "commit", "коммит", "закоммить".
---

Create a git commit following the project's conventional commit format.

## Steps

1. Run `git status` and `git diff --staged` to see what's changed. If nothing is staged, run `git diff` to see unstaged changes.

2. If nothing is staged, stage the relevant files. Do NOT use `git add -A` or `git add .`. Stage specific files by name. Never stage:
   - `.env` files
   - `node_modules/`
   - `dist/`, `.next/`, `.turbo/`
   - Files with hardcoded secrets or API keys
   - `docker-compose.override.yml`

3. Run `git log --oneline -10` to see the recent commit message style.

4. Create a commit message following this format:
   ```
   <type>(<scope>): <short description>
   ```

   Types:
   - `feat:` — new feature or endpoint
   - `fix:` — bug fix
   - `chore:` — maintenance, dependency updates, config changes
   - `refactor:` — code restructuring without behavior change
   - `docs:` — documentation changes
   - `test:` — adding or updating tests
   - `style:` — formatting, linting fixes (no logic change)

   Scopes (optional):
   - `api` — backend (NestJS)
   - `web` — frontend (Next.js)
   - `bracket` — bracket engine package
   - `db` — database migrations
   - `auth` — authentication
   - `i18n` — translations

   Rules:
   - Message in English
   - First letter lowercase after the colon
   - No period at the end
   - Keep under 72 characters
   - Focus on WHAT changed, not HOW

   Good examples:
   - `feat(api): add tournament creation endpoint`
   - `fix(bracket): correct bye handling for odd players`
   - `chore(web): update tailwind config`
   - `refactor(api): move bracket logic to service layer`
   - `docs: add database schema documentation`

5. Create the commit. Use a HEREDOC for the message:
   ```
   git commit -m "$(cat <<'EOF'
   type(scope): description
   EOF
   )"
   ```

6. Run `git status` after commit to verify success. Show the user the commit hash and message.
