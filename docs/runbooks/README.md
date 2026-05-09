# Runbooks

Operational procedures: what to do when production needs human hands.

## Why runbooks

When something is on fire at 02:00, the engineer on-call doesn't have time to figure out the deploy steps from scratch or guess the right backup-restore command. A runbook is the cold-start manual.

## When to write one

Write a runbook the first time a procedure is followed manually. The author of the fix is the right person to capture the steps — memory is freshest then.

Specifically:
- Recurring deploys / migrations / config rollouts.
- Recovery from any incident class (DB outage, certificate expiry, queue backlog, lost admin account).
- Routine ops: rotating secrets, rebuilding the production index, restoring a backup.

## Format

Each runbook is a single Markdown file with:

```
# <Procedure name>

**Trigger:** When does this runbook apply?
**Last tested:** <date> · <person>
**Estimated time:** <minutes>
**Risk level:** Low / Medium / High

## Prerequisites
What access / tools / knowledge you need before starting.

## Steps
1. ...
2. ...

## Verification
How do you know it worked?

## Rollback
What to do if it didn't.

## Notes
Gotchas, common mistakes.
```

## Index

| Runbook | Purpose | Risk |
|---------|---------|------|
| [deploy-production.md](./deploy-production.md) | Deploy api + web to production hosting | Medium |
| _More to come — restore-from-backup, rotate-jwt-secret, tournament-day-checklist…_ | | |
