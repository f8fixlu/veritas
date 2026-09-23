param(
  [int]$Port = 3000,
  [switch]$NoStart,
  [string]$BackupDir = (Join-Path $env:USERPROFILE "veritas-backups")
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# Veritas safe update for Windows (no service manager - mirrors scripts/update.sh
# minus systemd/sudo; the running server is NOT restarted automatically).
# Backs up the database, auto-syncs to the latest released code (stashing local
# edits, never silently keeping an old checkout), rebuilds, verifies the
# better-sqlite3 native binary matches the current Node, and prints the restart
# command.
#
# Usage (from the project directory):
#   npm run update
#   npm run update -- -Port 8080          # default 3000
#   npm run update -- -NoStart            # same as default; restart is manual here
#   npm run update -- -BackupDir C:\backups
#   powershell -File scripts/update.ps1 -Port 8080 -BackupDir C:\backups

Write-Host ""
Write-Host "== Veritas update ==" -ForegroundColor Cyan

# 0. Pre-flight - fail fast on a misconfigured environment.
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "node not found in PATH - install Node.js 22+ (nodejs.org)."
}
$nodeRaw = (node -v)
$nodeVersion = [version]($nodeRaw -replace "^v", "")
if ($nodeVersion -lt [version]"20.9.0") {
  throw "Node.js 20.9 or newer is required (found $nodeRaw)."
}
Write-Host "[ok] node      : $nodeRaw"
if (-not (Test-Path (Join-Path $root "package.json"))) {
  throw "package.json missing in $root - run this from the app directory."
}
if (-not (Test-Path (Join-Path $root "package-lock.json"))) {
  throw "package-lock.json missing - run 'npm install' once to generate it (then commit it)."
}
Write-Host "[ok] app dir   : $root"
$APP_VERSION = try { (Get-Content (Join-Path $root "package.json") | ConvertFrom-Json).version } catch { "?" }
Write-Host "  version    : v$APP_VERSION"

# 1. Environment (.env holds AUTH_SECRET and optional VERITAS_DB_FILE/DATA_DIR).
$envFile = Join-Path $root ".env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$") {
      [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim('"'), "Process")
    }
  }
  Write-Host "[ok] env       : loaded .env"
} else {
  Write-Warning ".env not found - the built-in development AUTH_SECRET will be used."
}

# 2. Database + snapshot data locations (from .env or defaults).
$DB_FILE = if ($env:VERITAS_DB_FILE) { $env:VERITAS_DB_FILE } else { Join-Path $root "prisma\dev.db" }
$DATA_DIR = if ($env:VERITAS_DATA_DIR) { $env:VERITAS_DATA_DIR } else { Join-Path $root "data" }
Write-Host "[ok] db file   : $DB_FILE"
New-Item -ItemType Directory -Path (Split-Path -Parent $DB_FILE) -Force | Out-Null

# 3. Back up the database before touching anything.
$SHA_BEFORE = (git rev-parse --short HEAD 2>$null)
if (-not $SHA_BEFORE) { $SHA_BEFORE = "unknown" }
$STAMP = Get-Date -Format "yyyy-MM-dd-HHmmss"
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
$BACKUP_PATH = Join-Path $BackupDir "veritas-$STAMP.db"
if (Test-Path -LiteralPath $DB_FILE) {
  $sqlite = Get-Command sqlite3 -ErrorAction SilentlyContinue
  if ($sqlite) {
    & $sqlite.Source $DB_FILE ".backup '$BACKUP_PATH'"
    if ($LASTEXITCODE -ne 0) { throw "sqlite3 .backup failed" }
  } else {
    Copy-Item -LiteralPath $DB_FILE -Destination $BACKUP_PATH
  }
  Write-Host "[ok] database backed up: $BACKUP_PATH"
} else {
  Write-Warning "database file not found at $DB_FILE - skipping backup."
  $BACKUP_PATH = ""
}

# 4. Sync to the latest released code automatically (mirrors update.sh: stash
#    local edits, keep diverged history as a backup branch, then reset hard).
$remoteCount = @(git remote 2>$null).Count
if ($remoteCount -gt 0) {
  $BRANCH = (git rev-parse --abbrev-ref HEAD 2>$null)
  if (-not $BRANCH) { $BRANCH = "main" }
  git rev-parse --verify "origin/$BRANCH" *>$null
  if ($LASTEXITCODE -eq 0) {
    git fetch origin $BRANCH
    if ($LASTEXITCODE -eq 0) {
      $HEAD_SHA = (git rev-parse HEAD)
      $REMOTE_SHA = (git rev-parse "origin/$BRANCH")
      if ($HEAD_SHA -eq $REMOTE_SHA) {
        Write-Host "[ok] up to date at $(git rev-parse --short HEAD)"
      } else {
        git merge-base --is-ancestor HEAD "origin/$BRANCH" *>$null
        if ($LASTEXITCODE -ne 0) {
          $BK = "backup/update-$STAMP"
          git branch -f $BK HEAD
          if ($LASTEXITCODE -eq 0) {
            Write-Host "[..] local history diverged - saved as branch '$BK'"
          } else {
            Write-Warning "could not create backup branch $BK - continuing anyway."
          }
        }
        $dirty = (git status --porcelain --untracked-files=no 2>$null)
        $stashMsg = ""
        if ($dirty) {
          $stashMsg = "veritas auto-update $STAMP"
          Write-Host "[..] local edits found - stashing as '$stashMsg'"
          git stash push -m $stashMsg
          if ($LASTEXITCODE -ne 0) { throw "git stash failed" }
        }
        git reset --hard "origin/$BRANCH"
        if ($LASTEXITCODE -ne 0) { throw "could not move the checkout to origin/$BRANCH" }
        Write-Host "[ok] updated to $(git rev-parse --short HEAD)"
        if ($stashMsg) {
          Write-Warning "local edits kept in stash '$stashMsg' (see: git stash list)"
        }
      }
    } else {
      Write-Warning "could not fetch origin/$BRANCH - continuing from the current checkout."
    }
  } else {
    Write-Warning "origin/$BRANCH does not exist - continuing from the current checkout."
  }
} else {
  Write-Warning "no git remote configured - skipping pull (current checkout used)."
}

# Remove a stray untracked src/app/dashboard directory if it is NOT part of the
# repository (leftover/conflict in the working tree that would break the build).
$strayDash = Join-Path $root "src\app\dashboard"
if (Test-Path -LiteralPath $strayDash) {
  $tracked = @(git ls-files -- "src/app/dashboard" 2>$null)
  if ($tracked.Count -eq 0) {
    Write-Host "[..] removing stray untracked src/app/dashboard"
    Remove-Item -Recurse -Force -LiteralPath $strayDash
  }
}

# 5. Reinstall, migrate, seed, build (under the current node).
function Test-Deps {
  $paths = @(
    "node_modules\next\dist\bin\next",
    "node_modules\.bin\prisma.cmd",
    "node_modules\.bin\tsx.cmd"
  )
  foreach ($p in $paths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $p))) { return $false }
  }
  return $true
}

Write-Host "[..] reinstalling dependencies"
npm ci
if ($LASTEXITCODE -ne 0) {
  Write-Host "warning: npm ci failed - retrying once"
  npm ci
}
if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
if (-not (Test-Path -LiteralPath (Join-Path $root "node_modules\next\dist\bin\next"))) {
  Write-Host "warning: 'next' was not installed by npm ci - retrying once"
  npm ci
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
}
if (-not (Test-Deps)) {
  throw "npm ci failed to install one or more required packages. Run manually: npm ci"
}
Write-Host "[..] applying database schema"
npx prisma db push
if ($LASTEXITCODE -ne 0) { throw "prisma db push failed" }
Write-Host "[..] seeding admin account (idempotent)"
npm run seed
if ($LASTEXITCODE -ne 0) { throw "seed failed" }
Write-Host "[..] building production bundle"
npm run build
if ($LASTEXITCODE -ne 0) { throw "build failed" }
if (-not (Test-Path -LiteralPath (Join-Path $root ".next\BUILD_ID")) -or -not (Test-Path -LiteralPath (Join-Path $root ".next\server"))) {
  throw "production build is incomplete (.next\BUILD_ID missing). Inspect the 'npm run build' output above."
}

# 6. ABI gate - prove the native module loads under this node.
Write-Host "[..] verifying better-sqlite3 against node $nodeRaw"
node -e "require('better-sqlite3'); console.log('OK')"
if ($LASTEXITCODE -ne 0) {
  throw "better-sqlite3 does not load under node $nodeRaw - the native binary and the runtime Node must share an ABI. Do not restart the server; the old build is still live."
}
$NESTED = Join-Path $root "node_modules\@prisma\adapter-better-sqlite3\node_modules\better-sqlite3"
if (Test-Path -LiteralPath (Join-Path $NESTED "build\Release\better_sqlite3.node")) {
  $nestedJs = $NESTED -replace "\\", "/"
  node -e "require('$nestedJs'); console.log('OK')"
  if ($LASTEXITCODE -ne 0) {
    throw "nested better-sqlite3 (under @prisma/adapter-better-sqlite3) does not load under node $nodeRaw - see above."
  }
}
Write-Host "[ok] better-sqlite3 loads cleanly"

# 7. Restart. There is no service manager here, so print the command instead of
#    restarting for you - a still-running server has the previous build loaded.
Write-Host ""
if ($NoStart) {
  Write-Host "== Update ready (NoStart) ==" -ForegroundColor Green
} else {
  Write-Warning "the running server must be restarted to pick up the new build."
}
Write-Host "  restart     : npm start -- -p $Port"

$SHA_AFTER = (git rev-parse --short HEAD 2>$null)
if (-not $SHA_AFTER) { $SHA_AFTER = "unknown" }
Write-Host ""
Write-Host "== Update finished ==" -ForegroundColor Green
Write-Host "  deployed SHA : $SHA_AFTER"
Write-Host "  previous SHA : $SHA_BEFORE"
if ($BACKUP_PATH) { Write-Host "  db backup    : $BACKUP_PATH" }
Write-Host "  rollback     : git checkout $SHA_BEFORE; npm ci; npm run build"
if ($BACKUP_PATH) { Write-Host "                 then restore $BACKUP_PATH and restart the server" }