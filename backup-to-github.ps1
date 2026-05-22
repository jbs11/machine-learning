# One-time backup script — run from project root
$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot
$report = Join-Path $PSScriptRoot 'BACKUP_REPORT.txt'

function Log($msg) { Add-Content -Path $report -Value $msg -Encoding UTF8 }
Remove-Item $report -ErrorAction SilentlyContinue
Log "=== Backup $(Get-Date -Format o) ==="

if (-not (Test-Path .git)) {
  git init 2>&1 | ForEach-Object { Log $_ }
  Log 'No .git — initialized. Add remote before push.'
  exit 1
}

Log '--- status ---'
git status 2>&1 | ForEach-Object { Log $_ }
Log '--- diff stat ---'
git diff --stat 2>&1 | ForEach-Object { Log $_ }

git add -A 2>&1 | ForEach-Object { Log $_ }
$secrets = @('.env', '.env.local', 'credentials.json', 'id_rsa', 'id_rsa.pub')
Get-ChildItem -Recurse -Force -File -ErrorAction SilentlyContinue | Where-Object {
  $n = $_.Name
  $n -match '^\.env' -or $n -match 'credential' -or $n -match '\.(pem|key)$' -or $n -eq 'id_rsa'
} | ForEach-Object {
  $rel = $_.FullName.Substring($PSScriptRoot.Length + 1)
  git reset -q -- $rel 2>$null
  Log "SKIPPED: $rel"
}

Log '--- staged ---'
git diff --cached --stat 2>&1 | ForEach-Object { Log $_ }

$msg = @'
Backup: Treasury Yields, nav, chart draw tools

- Treasury Yields page and API
- Sitewide nav links for Treasury Yields
- Chart drawing tools (chart-draw-tools.js) sitewide
- createLwcChart wiring for price/time anchored drawings
'@

git commit -m $msg 2>&1 | ForEach-Object { Log $_ }
Log "BRANCH: $(git branch --show-current 2>&1)"
Log "COMMIT: $(git rev-parse HEAD 2>&1)"
Log "REMOTE: $(git remote get-url origin 2>&1)"
Log '--- push ---'
git push -u origin HEAD 2>&1 | ForEach-Object { Log $_ }
Log "EXIT: $LASTEXITCODE"
Write-Host (Get-Content $report -Raw)
