# Showpilot: notes for AI coding sessions

Showpilot is a public, MIT-licensed tool that turns a short TypeScript script into a polished product demo video:
Playwright drives the real app, a planner works out the camera and cursor, Kokoro narrates locally, Remotion renders.
Read README.md, CONTRIBUTING.md (layout and workflow) and docs/decisions.md (why things are the way they are) first.

## Working rules
- **Git:** branch from `main` for every change (`feat/…`, `fix/…`, `docs/…`); never commit to `main` directly. Push the
  branch and open a PR that links its issue. Merge with a merge commit only after CI passes **and the maintainer
  says so**.
- **No AI attribution** in commits, PR descriptions or code (no Co-Authored-By lines for AI tools).
- **Run `npm run ci` before pushing.** For changes to recording or rendering, also run the example end to end
  (`record`, then `render --still` or a full render) and look at the result.
- **Docs and CHANGELOG** (under *Unreleased*) change in the same PR as the behaviour.
- **Decisions:** add a short entry to docs/decisions.md when a choice isn't obvious from the code.
- **Nothing personal or machine-specific** in the repo: no absolute paths, drive letters, names of private projects,
  or private notes. Example data is fictional and says so.
- **Heavy stages never run together** (voice, record, render, dub hold a lock in SHOWPILOT_HOME); don't work around it.
- **Cross-platform:** Windows, macOS and Linux. Use `path` for paths, no shell-specific commands in code.
