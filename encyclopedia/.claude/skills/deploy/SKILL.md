---
name: deploy
description: Commits all current changes, builds the encyclopedia for GitHub Pages, and deploys the dist/ folder to the gh-pages branch. Use when the user wants to deploy the latest version of the encyclopedia site.
disable-model-invocation: true
allowed-tools: Bash, Read, Glob, Grep
context: fork
agent: general-purpose
---

# Deploy Encyclopedia to GitHub Pages

Run all steps from the project root: `/Users/dkuznetsov/Work/English/encyclopedia`

```
Deploy Progress:
- [ ] Step 1: Commit changes
- [ ] Step 2: Build for GitHub Pages
- [ ] Step 3: Deploy dist/ to gh-pages branch
```

## Step 1: Commit changes

1. Run `git status --porcelain`.
2. If there are no changes (output is empty), skip to Step 2 and note "No changes to commit."
3. If there are changes:
   a. Run `git add -A` to stage everything.
   b. Run `git diff --cached --stat` and `git diff --cached` to understand the diff.
   c. Generate a concise, meaningful commit message. Use conventional format: `type(scope): description`. Common types: feat, fix, content, style, refactor, chore.
   d. Commit using:
      ```
      git commit -m "$(cat <<'EOF'
      <your generated message>
      EOF
      )"
      ```
   e. Push the commit to origin/master: `git push origin master`
4. Print the commit hash and message.

## Step 2: Build for GitHub Pages

1. Run `yarn build:ghpages` from the project root.
2. If the build fails, **stop immediately**. Report the error output and do NOT proceed to Step 3.
3. Verify `dist/index.html` and `dist/404.html` both exist after the build.

## Step 3: Deploy dist/ to gh-pages branch

Deploy the contents of `dist/` to the `gh-pages` branch using a temporary worktree:

```bash
DIST_DIR="$(pwd)/dist"
DEPLOY_DIR="$(mktemp -d)"

git worktree add "$DEPLOY_DIR" gh-pages

cd "$DEPLOY_DIR"
git rm -rf . > /dev/null 2>&1 || true

cp -a "$DIST_DIR"/. "$DEPLOY_DIR"/

cd "$DEPLOY_DIR"
git add -A
git commit -m "deploy: update GitHub Pages site"
git push origin gh-pages

cd /Users/dkuznetsov/Work/English/encyclopedia
git worktree remove "$DEPLOY_DIR" --force
```

If any command fails, report the error and attempt to clean up the worktree before stopping.

## Final report

After all steps complete, print a summary:

```
--- Deploy Complete ---
Commit:  <hash> <message>  (or "No changes to commit")
Build:   OK
Deploy:  Pushed to gh-pages
URL:     https://aiclaudelib.github.io/langupedia/
```
