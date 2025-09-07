param(
  [string]$Owner = "Ahmad9bh",
  [string]$Repo = "Celebrate",
  [string]$ProjectTitle = "Phase 1 - Backend APIs"
)

function Write-Info($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Write-Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Write-Err($m){ Write-Host "[ERROR] $m" -ForegroundColor Red }

# Resolve gh.exe even if not on PATH
${script:GhCmd} = "gh"
function Find-GhPath {
  $roots = @()
  if ($Env:ProgramFiles) {
    $pf = [string]$Env:ProgramFiles
    $pfChild = Join-Path -Path $pf -ChildPath "GitHub CLI"
    if (Test-Path $pfChild) { $roots += $pfChild }
  }
  if ($Env:LOCALAPPDATA) {
    $la = [string]$Env:LOCALAPPDATA
    $laChild = Join-Path -Path $la -ChildPath "Programs"
    if (Test-Path $laChild) { $roots += $laChild }
  }
  foreach ($root in $roots) {
    $hit = Get-ChildItem -Path $root -Recurse -Filter gh.exe -ErrorAction SilentlyContinue |
      Select-Object -First 1 -Expand FullName
    if ($hit) { return $hit }
  }
  return $null
}
function Ensure-GhCli {
  if (Get-Command gh -ErrorAction SilentlyContinue) {
    ${script:GhCmd} = "gh"
    return $true
  }
  $ghPath = Find-GhPath
  if ($ghPath -and (Test-Path $ghPath)) {
    ${script:GhCmd} = $ghPath
    $env:Path += ";" + (Split-Path $ghPath)
    return $true
  }
  Write-Err "GitHub CLI (gh) not found. Install from https://github.com/cli/cli/releases/latest"
  return $false
}
if (-not (Ensure-GhCli)) { exit 1 }

# Auth check
try { & ${script:GhCmd} auth status 1>$null 2>$null } catch { & ${script:GhCmd} auth login }

# Find or create a user project with the given title
Write-Info "Ensuring project '$ProjectTitle' exists for user $Owner"
$plist = & ${script:GhCmd} project list --owner $Owner --format json | ConvertFrom-Json
$proj = $plist | Where-Object { $_.title -eq $ProjectTitle } | Select-Object -First 1
if (-not $proj) {
  $created = & ${script:GhCmd} project create --owner $Owner "$ProjectTitle" --format json | ConvertFrom-Json
  $proj = $created
  if ($proj -and $proj.number) { Write-Info ("Created project number {0}" -f $proj.number) } else { Write-Warn "Project created but number not returned; ensure token scopes include 'project' and 'read:project'" }
} else {
  Write-Info "Found project number $($proj.number)"
}
$projNumber = $proj.number

# Discover Phase 1 issues by known titles (fallback to label search if needed)
$targets = @(
  "feat(api): input validation and typed errors in backend",
  "feat(api): venues pagination, sorting, and search",
  "feat(bookings): enforce invariants (no double-booking; valid date windows)",
  "feat(payments): webhook idempotency and safety for Stripe events",
  "feat(observability): structured logs for payments, bookings, and admin"
)

$issuesJson = & ${script:GhCmd} issue list -R "$Owner/$Repo" --limit 200 --json number,title,url | ConvertFrom-Json
$match = @()
foreach ($t in $targets) {
  $hit = $issuesJson | Where-Object { $_.title -like "*$t*" } | Select-Object -First 1
  if ($hit) { $match += $hit } else { Write-Warn "Issue not found by title: $t" }
}

if ($match.Count -eq 0) { Write-Warn "No matching Phase 1 issues found. Exiting."; exit 0 }

# Add each issue to the project board
foreach ($it in $match) {
  Write-Info "Adding issue #$($it.number) to project $projNumber"
  # Syntax: gh project item-add <number> --owner <owner> --url <issue-url>
  & ${script:GhCmd} project item-add $projNumber --owner $Owner --url $it.url 1>$null
}

# Print project URL (user project)
$projectUrl = "https://github.com/users/$Owner/projects/$projNumber"
Write-Host "\nProject ready: $projectUrl" -ForegroundColor Green
