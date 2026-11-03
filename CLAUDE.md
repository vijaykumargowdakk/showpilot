# Showpilot: notes for AI coding sessions

Showpilot is a public, MIT-licensed tool that turns a short TypeScript script into a polished product demo video:
Playwright drives the real app, a planner works out the camera and cursor, Kokoro narrates locally, Remotion renders.

## Read at the start of a session
- **PROJECT_STATUS.md**: what's done, in progress, known issues, and what to do next.
- **docs/decisions.md**: why things are the way they are. Append an entry whenever something decision-worthy happens.
- **FILEMAP.md**: generated tree of every file. Check it before exploring blindly.
- README.md and CONTRIBUTING.md (layout and workflow).

## Working rules
- **FILEMAP first:** read FILEMAP.md before using Glob for file discovery. Use Glob only when it's missing or stale,
  and Grep for searching file *contents*. Don't hand-edit it; `npm run filemap` regenerates it.
- **Git:** branch from `main` for every change (`feat/…`, `fix/…`, `docs/…`, `chore/…`); never commit to `main`
  directly. Commit logical chunks.
  - Push every branch and open a PR that links its issue. Never merge into `main` locally, and never delete a branch
    before its PR is merged.
  - Before pushing, run `npm run ci` and make sure the branch has no conflicts with `main`. For changes to recording
    or rendering, also run the example end to end (`record`, then `render --still` or a full render) and look at it.
  - Merge with a **merge commit**, only after CI passes **and the maintainer says so**. Report CI status and wait.
- **No AI attribution** in commits, PR descriptions, code or repo files: no `Co-Authored-By` trailers for AI tools,
  no "Generated with …" lines.
- **Docs and CHANGELOG** (under *Unreleased*) change in the same PR as the behaviour.
- **docs/decisions.md:** add a short entry when a choice isn't obvious from the code. New entries start with the date
  and say the decision and why, plus the maintainer's input when it came from them. When an entry changes or
  reverses an earlier one, name the one it replaces. Do it as part of the work, not as an afterthought.
- **PROJECT_STATUS.md:** keep it current. Update it when milestones change, work completes or blockers appear.
- **Nothing personal or machine-specific** in the repo: no absolute paths, drive letters, names of private projects,
  or private notes. Planning briefs and other private source material stay outside the repo and aren't referred to.
- **Verify before trusting.** Don't assume external data, AI output or copied code is correct; check it.
- **No placeholder data in production paths.** Example data is fictional and says so.
- **Heavy stages never run together** (voice, record, render, dub hold a lock in SHOWPILOT_HOME); don't work around it.
- **Cross-platform:** Windows, macOS and Linux. Use `path` for paths, no shell-specific commands in code.

The PostToolUse hooks in `.claude/settings.json` regenerate FILEMAP.md and mark edited files for an end-of-turn
review hook.
