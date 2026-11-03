# Releasing

A release is a version PR, a tag, and a GitHub release. Publishing to npm then happens from the *Publish to npm*
workflow, once npm's trusted publishing is set up (below). Until then, publish from your own computer.

1. **Version PR.** On a branch, raise `version` in `package.json` (`npm version X.Y.Z --no-git-tag-version`), and turn
   *Unreleased* in `CHANGELOG.md` into `## [X.Y.Z] - date`, with a fresh empty *Unreleased* above it. Merge it after CI passes.
2. **Release.** On `main`, `gh release create vX.Y.Z --title "Showpilot X.Y.Z" --notes-file <the version's changelog entry>`.
   Never move or delete a pushed tag.
3. **npm.** The *Publish to npm* workflow runs on the release. It checks the tag matches `package.json`, runs `npm run ci`,
   and runs `npm publish --provenance --access public`, so the npm page links to this exact commit.

Before any publish, `npm pack --dry-run` lists exactly what would be uploaded: `bin/`, `src/` (without tests or
compiled Python), the README and the LICENSE.

## Trusted publishing (the way to publish from CI)

npm no longer lets a token publish on its own: a token without the "bypass two-factor" option makes `npm publish` ask
for a one-time code, which CI can't give (that's what happened to the 0.2.0 run, `EOTP`), and tokens that bypass it stop
working for direct publishing in January 2027. Trusted publishing needs no token:

1. Publish the package once from your own computer (see below), so that it exists.
2. On npmjs.com: the `showpilot` package → Settings → **Trusted Publisher** → GitHub Actions. Enter the owner
   `vijaykumargowdakk`, the repository `showpilot`, and the workflow file `publish.yml`.
3. Delete the `NPM_TOKEN` repository secret and the old token on npmjs.com, and remove the `NODE_AUTH_TOKEN` line from
   `.github/workflows/publish.yml`. The workflow already has `id-token: write`, which trusted publishing uses.

## Publishing from your own computer

In the repository root, on an up-to-date `main`:

```sh
npm login                          # opens the browser; use your authenticator
npm publish --access public        # runs the checks first, then asks for a one-time code
```

On Windows PowerShell, use `npm.cmd` if scripts are disabled. Set `SHOWPILOT_HOME` first if you want the checks to
keep their files off the C: drive. Versions published this way have no provenance link; CI releases do.
