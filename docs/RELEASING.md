# Releasing

A release is a version PR, a tag, and a GitHub release. Publishing to npm happens automatically when the release is
published.

1. **Version PR.** On a branch, raise `version` in `package.json` (`npm version X.Y.Z --no-git-tag-version`), and turn
   *Unreleased* in `CHANGELOG.md` into `## [X.Y.Z] - date`, with a fresh empty *Unreleased* above it. Merge it after CI passes.
2. **Release.** On `main`, `gh release create vX.Y.Z --title "Showpilot X.Y.Z" --notes-file <the version's changelog entry>`.
   Never move or delete a pushed tag.
3. **npm.** The *Publish to npm* workflow runs on the release. It checks the tag matches `package.json`, runs `npm run ci`,
   and runs `npm publish --provenance --access public`, so the npm page links to this exact commit.

## One-time setup for npm

1. Sign in at npmjs.com. Turn on two-factor authentication for your account.
2. Create an **automation** access token (Access Tokens → Generate new token → Classic → Automation), so publishing
   works from CI without a one-time code.
3. In the GitHub repository: Settings → Secrets and variables → Actions → *New repository secret*, named `NPM_TOKEN`.

### The very first publish

The name `showpilot` is free on npm, and the first publish creates it. Either create the release as above, or publish
once from your own computer (`npm login`, then `npm publish --access public` in the repository root; `prepublishOnly`
runs the checks first). Later versions publish from CI.

Before any publish, `npm pack --dry-run` lists exactly what would be uploaded: `bin/`, `src/` (without tests), the
README and the LICENSE.
