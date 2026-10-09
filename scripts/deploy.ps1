param(
  [int]$Port = 3000,
  [switch]$Fresh,
  [switch]$NoStart,
  [switch]$InitEnv
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "== Veritas deployment ==" -ForegroundColor Cyan

# Syncs to the latest GitHub release (self-healing a checkout without git
# metadata), then reinstalls, migrates, seeds, builds, and (unless -NoStart)
# starts the server.

# 1. Node version
$nodeRaw = (node -v)
$nodeVersion = [version]($nodeRaw -replace "^v", "")
if ($nodeVersion -lt [version]"20.9.0") {
  throw "Node.js 20.9 or newer is required (found $nodeRaw)."
}
Write-Host "[ok] Node $nodeRaw"

# 2. Environment (.env holds AUTH_SECRET; Next.js loads it automatically).
#    The app refuses to start in production without AUTH_SECRET, so generate
#    one here rather than silently falling back to the public dev secret.
$envFile = Join-Path $root ".env"
if (-not (Test-Path $envFile)) {
  $secret = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  Set-Content -Path $envFile -Value "AUTH_SECRET=$secret" -NoNewline
  Write-Host "[ok] created .env with a generated AUTH_SECRET"
}
Get-Content $envFile | ForEach-Object {
  if ($_ -match "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$") {
    [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim('"'), "Process")
  }
}
Write-Host "[ok] loaded .env"

# 3. Sync to the latest GitHub release (mirrors update.ps1): self-heal a
#    checkout without git metadata, then apply the newest published release tag
#    (vX.Y.Z) — never an unreleased origin/<branch> head. Current state is
#    kept as a snapshot/backup branch so rollback always works.
$repoUrl = "https://github.com/f8fixlu/veritas.git"
$stamp = Get-Date -Format "yyyy-MM-dd-HHmmss"

$gitDir = (git rev-parse --git-dir 2>$null)
if (-not $gitDir) {
  Write-Host "[..] no git repository here - initializing one (current state saved as a snapshot commit)"
  git init -q
  if ($LASTEXITCODE -ne 0) { throw "git init failed" }
  git branch -M main 2>$null
  git config user.name "veritas-deploy"
  git config user.email "deploy@veritas.local"
  git add -A
  git diff --cached --quiet 2>$null
  if ($LASTEXITCODE -ne 0) {
    git commit -q -m "veritas pre-deploy state $stamp"
    if ($LASTEXITCODE -ne 0) { throw "could not create the pre-deploy snapshot commit" }
  }
}
$remotes = @(git remote 2>$null)
if ($remotes.Count -eq 0) {
  Write-Host "[..] no git remote configured - adding origin $repoUrl"
  git remote add origin $repoUrl
  if ($LASTEXITCODE -ne 0) { Write-Warning "could not add origin - using the current checkout." }
  $remotes = @(git remote 2>$null)
}

if ($remotes.Count -gt 0) {
  $branch = (git rev-parse --abbrev-ref HEAD 2>$null)
  if (-not $branch -or $branch -eq "HEAD") { $branch = "main" }
  $target = ""
  git fetch origin --tags
  if ($LASTEXITCODE -eq 0) {
    $releaseTag = (git tag --list 'v[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname | Select-Object -First 1)
    if ($releaseTag) {
      $target = $releaseTag
      Write-Host "[ok] latest released version : $target"
    } else {
      Write-Warning "no release tags found - falling back to origin/$branch."
    }
  } else {
    Write-Warning "could not fetch tags from origin - falling back to origin/$branch."
  }
  if (-not $target) {
    git rev-parse --verify "origin/$branch" *>$null
    if ($LASTEXITCODE -eq 0) { $target = "origin/$branch" }
    else { Write-Warning "origin/$branch does not exist - using the current checkout." }
  }
  if ($target) {
    $HEAD_SHA = (git rev-parse HEAD)
    $TARGET_SHA = (git rev-parse $target)
    if ($HEAD_SHA -eq $TARGET_SHA) {
      Write-Host "[ok] already at the latest release $(git rev-parse --short HEAD)"
    } else {
      git merge-base --is-ancestor HEAD $target *>$null
      if ($LASTEXITCODE -ne 0) {
        $bk = "backup/deploy-$stamp"
        git branch -f $bk HEAD
        if ($LASTEXITCODE -eq 0) {
          Write-Host "[..] kept pre-deploy state as branch '$bk'"
        } else {
          Write-Warning "could not create backup branch $bk - continuing anyway."
        }
      }
      $dirty = (git status --porcelain --untracked-files=no 2>$null)
      if ($dirty) {
        $stashMsg = "veritas auto-deploy $stamp"
        Write-Host "[..] local edits found - stashing as '$stashMsg'"
        git stash push -m $stashMsg
        if ($LASTEXITCODE -ne 0) { throw "git stash failed" }
      }
      git checkout -B $branch $target
      if ($LASTEXITCODE -ne 0) { throw "could not move the checkout to $target" }
      Write-Host "[ok] applied release $target ($(git rev-parse --short HEAD))"
      if ($stashMsg) {
        Write-Warning "local edits kept in stash '$stashMsg' (see: git stash list)"
      }
    }
  }
} else {
  Write-Warning "no git remote configured - using the current checkout."
}

# Remove stray untracked TypeScript files left at the app root. tsconfig.json
# includes "**/*.ts", so `next build` type-checks every top-level .ts/.tsx/.mts
# file in the tree; a working-tree leftover (e.g. backfill-student-codes.ts
# copied out of scripts/ beside package.json) has ../src imports that cannot
# resolve from the root and aborts the build. Only a file that is untracked AND
# shares a basename with a tracked file elsewhere is removed, so real config
# (next.config.ts) and the gitignored next-env.d.ts are never touched.
foreach ($ext in @("*.ts", "*.tsx", "*.mts")) {
  Get-ChildItem -Path (Join-Path $root "*") -Include $ext -File -ErrorAction SilentlyContinue | ForEach-Object {
    $name = $_.Name
    $trackedHere = @(git ls-files --error-unmatch -- $name 2>$null)
    if ($trackedHere.Count -gt 0) { return }
    $trackedElsewhere = @(git ls-files -- "*/$name" 2>$null)
    if ($trackedElsewhere.Count -gt 0) {
      Write-Host "[..] removing stray untracked $name at the app root (duplicate of $($trackedElsewhere[0]))"
      Remove-Item -Force -LiteralPath $_.FullName
    }
  }
}

# 4. Dependencies
if ($Fresh -or -not (Test-Path (Join-Path $root "node_modules"))) {
  Write-Host "[..] installing dependencies (npm ci)"
  npm ci
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
} else {
  Write-Host "[ok] dependencies installed (pass -Fresh to reinstall)"
}

# 5. Database
if ($env:VERITAS_DB_FILE) {
  $dbDir = Split-Path -Parent $env:VERITAS_DB_FILE
  if (-not (Test-Path $dbDir)) {
    New-Item -ItemType Directory -Path $dbDir -Force | Out-Null
  }
  Write-Host "[ok] database file: $($env:VERITAS_DB_FILE)"
}
Write-Host "[..] applying database schema"
npx prisma db push
if ($LASTEXITCODE -ne 0) { throw "prisma db push failed" }

Write-Host "[..] seeding admin account (idempotent)"
npm run seed
if ($LASTEXITCODE -ne 0) { throw "seed failed" }

# 6. Build
Write-Host "[..] building production bundle"
npm run build
if ($LASTEXITCODE -ne 0) { throw "build failed" }

Write-Host ""
Write-Host "== Deployment ready ==" -ForegroundColor Green
if ($NoStart) {
  Write-Host "Start the server with: npm start -- -p $Port"
} else {
  Write-Host "Starting server on http://localhost:$Port (Ctrl+C to stop)"
  npm start -- -p $Port
}
