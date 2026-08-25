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

# 1. Node version
$nodeRaw = (node -v)
$nodeVersion = [version]($nodeRaw -replace "^v", "")
if ($nodeVersion -lt [version]"20.9.0") {
  throw "Node.js 20.9 or newer is required (found $nodeRaw)."
}
Write-Host "[ok] Node $nodeRaw"

# 2. Environment (.env holds AUTH_SECRET; Next.js loads it automatically)
$envFile = Join-Path $root ".env"
if ($InitEnv -and -not (Test-Path $envFile)) {
  $secret = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  Set-Content -Path $envFile -Value "AUTH_SECRET=$secret" -NoNewline
  Write-Host "[ok] created .env with a generated AUTH_SECRET"
}
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$") {
      [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim('"'), "Process")
    }
  }
  Write-Host "[ok] loaded .env"
} else {
  Write-Warning ".env not found - the built-in development AUTH_SECRET will be used."
  Write-Warning "Run 'npm run deploy -- -InitEnv' once to generate a production secret."
}

# 3. Dependencies
if ($Fresh -or -not (Test-Path (Join-Path $root "node_modules"))) {
  Write-Host "[..] installing dependencies (npm ci)"
  npm ci
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
} else {
  Write-Host "[ok] dependencies installed (pass -Fresh to reinstall)"
}

# 4. Database
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

# 5. Build
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
