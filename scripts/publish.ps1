param(
  [string]$Message,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$repoUrl = "https://github.com/f8fixlu/veritas.git"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

git rev-parse --is-inside-work-tree *> $null
if ($LASTEXITCODE -ne 0) { throw "Not a git repository." }

$name = git config user.name
$email = git config user.email
if (-not $name -or -not $email) {
  throw "Set your git identity first: git config --global user.name `"Your Name`""
}

# 1. Stage everything (gitignore decides what is excluded)
git add -A

# 2. Commit when there is something to commit
$staged = git diff --cached --name-only
if (-not $staged) {
  Write-Host "[ok] nothing new to commit - working tree clean."
} else {
  if (-not $Message) {
    if ($DryRun) { $Message = "(dry-run) changes" }
    else { $Message = Read-Host "Commit message" }
  }
  if (-not $Message) { throw "A commit message is required." }
  if ($DryRun) {
    Write-Host "[dry-run] git commit -m `"$Message`""
  } else {
    git commit -m $Message
    if ($LASTEXITCODE -ne 0) { throw "Commit failed." }
  }
}

# 3. Point origin at the Veritas repository
$hasOrigin = git remote | Where-Object { $_ -eq "origin" }
if (-not $hasOrigin) {
  if ($DryRun) {
    Write-Host "[dry-run] git remote add origin $repoUrl"
  } else {
    git remote add origin $repoUrl
    Write-Host "[ok] added origin -> $repoUrl"
  }
} else {
  $remote = git remote get-url origin
  if ($remote -notlike "*f8fixlu/veritas*") {
    if ($DryRun) {
      Write-Host "[dry-run] git remote set-url origin $repoUrl (was $remote)"
    } else {
      git remote set-url origin $repoUrl
      Write-Host "[ok] updated origin -> $repoUrl"
    }
  } else {
    Write-Host "[ok] origin already points at $repoUrl"
  }
}

# 4. GitHub default branch
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne "main") {
  if ($DryRun) {
    Write-Host "[dry-run] rename branch '$branch' to 'main'"
    $branch = "main"
  } else {
    git branch -M main
    $branch = "main"
    Write-Host "[ok] renamed branch to main"
  }
}

# 5. Push (fails fast instead of hanging when no credentials are stored,
#    then retries once with the credential helper allowed to prompt)
$pushArgs = @("push", "-u", "origin", $branch)
if ($DryRun) {
  Write-Host "[dry-run] git $($pushArgs -join ' ')"
} else {
  $env:GIT_TERMINAL_PROMPT = "0"
  git @pushArgs
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[..] push failed without terminal prompt - retrying with credentials..."
    Remove-Item Env:GIT_TERMINAL_PROMPT -ErrorAction SilentlyContinue
    git @pushArgs
    if ($LASTEXITCODE -ne 0) {
      Write-Warning ""
      Write-Warning "Push failed - GitHub did not accept the credentials on this machine."
      Write-Warning "Easiest fix: run 'gh auth login' once, or add a Personal Access Token / SSH key,"
      Write-Warning "then re-run: npm run publish"
      exit 1
    }
  }
  Write-Host ""
  Write-Host "== Published to https://github.com/f8fixlu/veritas ==" -ForegroundColor Green
}

# 5b. Release tag derived from package.json so the tag matches the version
#     reported by the app footer (v1.02 style). Idempotent: untouched when it
#     already points at HEAD, otherwise moved to the new release.
$version = (node -e "console.log(require('./package.json').version)") 2>$null
if (-not $version) {
  Write-Warning "Could not read version from package.json - skipping release tag."
} else {
  $tag = "v$version"
  $target = (git rev-parse -q --verify "refs/tags/$tag") 2>$null
  $headSha = git rev-parse HEAD
  $tagged = $false
  if (-not $target) { $target = "" }
  if ($target -and $target -eq $headSha) {
    Write-Host "[ok] tag $tag already points at HEAD"
  } else {
    if ($target) {
      Write-Host "[..] moving existing tag $tag ($target) to HEAD ($headSha)"
    } else {
      Write-Host "[..] creating release tag $tag"
    }
    if ($DryRun) {
      Write-Host "[dry-run] git tag $(if ($target) { '-f' }) $tag"
      Write-Host "[dry-run] git push origin $tag $(if ($target) { '-f' })"
    } else {
      if ($target) { git tag -f $tag } else { git tag $tag }
      if ($LASTEXITCODE -ne 0) { throw "Tag creation failed." }
      if ($target) {
        git push origin $tag -f
      } else {
        git push origin $tag
      }
      if ($LASTEXITCODE -ne 0) {
        Write-Warning "Code was pushed but the tag '$tag' did not - push it manually:"
        Write-Warning "  git push origin $tag $(if ($target) { '-f' })"
      } else {
        $tagged = $true
      }
    }
  }
  if (-not $DryRun -and $tagged) {
    Write-Host ""
    Write-Host "== Tagged $tag on origin ==" -ForegroundColor Green
  }
}
