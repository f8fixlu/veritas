#!/usr/bin/env bash
set -euo pipefail

# Veritas GitHub publishing (Linux/macOS)
# Usage: bash scripts/publish.sh [-Message "..."] [--dry-run]

REPO_URL="https://github.com/f8fixlu/veritas.git"
MESSAGE=""
DRY_RUN=0

cd "$(dirname "$0")/.."

strip_dashes() { echo "${1#--}" | sed 's/^-//'; }

while [[ $# -gt 0 ]]; do
  key="$(strip_dashes "$1" | tr '[:upper:]' '[:lower:]')"
  case "$key" in
    message|m)
      MESSAGE="$2"
      shift 2
      ;;
    dryrun)
      DRY_RUN=1
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: bash scripts/publish.sh [-Message \"...\"] [-DryRun]"
      exit 1
      ;;
  esac
done

git rev-parse --is-inside-work-tree >/dev/null 2>&1 ||
  { echo "error: not a git repository." >&2; exit 1; }

NAME="$(git config user.name || true)"
EMAIL="$(git config user.email || true)"
if [ -z "$NAME" ] || [ -z "$EMAIL" ]; then
  echo "error: set your git identity first:" >&2
  echo '  git config --global user.name "Your Name"' >&2
  echo '  git config --global user.email "you@example.com"' >&2
  exit 1
fi

# 1. Stage everything (gitignore decides what is excluded)
git add -A

# 2. Commit when there is something to commit
if [ -n "$(git diff --cached --name-only)" ]; then
  if [ -z "$MESSAGE" ]; then
    if [ -t 0 ]; then
      read -r -p "Commit message: " MESSAGE
    fi
  fi
  if [ -z "$MESSAGE" ]; then
    echo "error: a commit message is required." >&2
    exit 1
  fi
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "[dry-run] git commit -m \"$MESSAGE\""
  else
    git commit -m "$MESSAGE"
  fi
else
  echo "[ok] nothing new to commit - working tree clean."
fi

# 3. Point origin at the Veritas repository
if git remote | grep -qx "origin"; then
  REMOTE_URL="$(git remote get-url origin)"
  case "$REMOTE_URL" in
    *f8fixlu/veritas*)
      echo "[ok] origin already points at $REPO_URL"
      ;;
    *)
      if [ "$DRY_RUN" -eq 1 ]; then
        echo "[dry-run] git remote set-url origin $REPO_URL (was $REMOTE_URL)"
      else
        git remote set-url origin "$REPO_URL"
        echo "[ok] updated origin -> $REPO_URL"
      fi
      ;;
  esac
else
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "[dry-run] git remote add origin $REPO_URL"
  else
    git remote add origin "$REPO_URL"
    echo "[ok] added origin -> $REPO_URL"
  fi
fi

# 4. GitHub default branch
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "main" ]; then
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "[dry-run] rename branch '$BRANCH' to 'main'"
    BRANCH="main"
  else
    git branch -M main
    BRANCH="main"
    echo "[ok] renamed branch to main"
  fi
fi

# 5. Push (fails fast instead of hanging when no credentials are stored,
#    then retries once with the credential helper allowed to prompt)
if [ "$DRY_RUN" -eq 1 ]; then
  echo "[dry-run] git push -u origin $BRANCH"
else
  export GIT_TERMINAL_PROMPT=0
  if git push -u origin "$BRANCH"; then
    echo ""
    echo "== Published to https://github.com/f8fixlu/veritas =="
  else
    echo "[..] push failed without terminal prompt - retrying with credentials..."
    unset GIT_TERMINAL_PROMPT
    if git push -u origin "$BRANCH"; then
      echo ""
      echo "== Published to https://github.com/f8fixlu/veritas =="
    else
      echo "" >&2
      echo "Push failed - GitHub did not accept the credentials on this machine." >&2
      echo "Easiest fix: run 'gh auth login' once, or add a Personal Access Token / SSH key," >&2
      echo "then re-run: npm run publish" >&2
      exit 1
    fi
  fi
fi

# 6. Release tag derived from package.json so the tag always matches the
#    version reported by the app footer (v1.02 style). Idempotent: untouched
#    when it already points at HEAD, otherwise moved to the new release.
VERSION="$(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo '')"
if [ -z "$VERSION" ]; then
  echo "warning: could not read version from package.json - skipping release tag." >&2
else
  TAG="v$VERSION"
  TARGET="$(git rev-parse -q --verify "refs/tags/$TAG" 2>/dev/null || echo '')"
  HEAD_SHA="$(git rev-parse HEAD)"
  TAGGED=0
  if [ -n "$TARGET" ] && [ "$TARGET" = "$HEAD_SHA" ]; then
    echo "[ok] tag $TAG already points at HEAD"
  else
    if [ -n "$TARGET" ]; then
      echo "[..] moving existing tag $TAG ($TARGET) to HEAD ($HEAD_SHA)"
    else
      echo "[..] creating release tag $TAG"
    fi
    if [ "$DRY_RUN" -eq 1 ]; then
      echo "[dry-run] git tag ${TARGET:+-f} $TAG"
      echo "[dry-run] git push origin $TAG ${TARGET:+-f}"
    else
      if [ -n "$TARGET" ]; then
        git tag -f "$TAG"
      else
        git tag "$TAG"
      fi
      if git push origin "$TAG" ${TARGET:+-f}; then
        TAGGED=1
      else
        echo "warning: code was pushed but the tag '$TAG' did not - push it manually:" >&2
        echo "  git push origin $TAG ${TARGET:+-f}" >&2
      fi
    fi
  fi
  if [ "$DRY_RUN" -eq 0 ] && [ "$TAGGED" -eq 1 ]; then
    echo ""
    echo "== Tagged $TAG on origin =="
  fi
fi
