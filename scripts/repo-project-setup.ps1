param(
  [string]$Owner = "Ahmad9bh",
  [string]$Repo = "Celebrate",
  [string]$ProjectTitle = "Phase 1 - Backend APIs",
  [switch]$OrgScope # if set, treat Owner as an org login instead of a user
)

function Write-Info($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Write-Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Write-Err($m){ Write-Host "[ERROR] $m" -ForegroundColor Red }

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
  if (Get-Command gh -ErrorAction SilentlyContinue) { ${script:GhCmd} = "gh"; return $true }
  $ghPath = Find-GhPath
  if ($ghPath) { ${script:GhCmd} = $ghPath; $env:Path += ";" + (Split-Path $ghPath); return $true }
  Write-Err "GitHub CLI (gh) not found. Install from https://github.com/cli/cli/releases/latest"
  return $false
}
if (-not (Ensure-GhCli)) { exit 1 }

# Ensure proper scopes (project + read:project)
try { & ${script:GhCmd} auth status 1>$null 2>$null } catch { & ${script:GhCmd} auth login }

# Choose scope switches for gh project commands
$ownerFlag = @('--owner', $Owner)
if ($OrgScope) { $ownerFlag = @('--owner', $Owner) } # same flag but indicates org login value

# Find or create project under specified owner/org
Write-Info "Ensuring project '$ProjectTitle' exists for $([string]($OrgScope ? 'org' : 'user')) '$Owner'"
$plist = & ${script:GhCmd} project list @ownerFlag --format json | ConvertFrom-Json
$proj = $plist | Where-Object { $_.title -eq $ProjectTitle } | Select-Object -First 1
if (-not $proj) {
  $created = & ${script:GhCmd} project create @ownerFlag "$ProjectTitle" --format json | ConvertFrom-Json
  $proj = $created
  if ($proj -and $proj.number) { Write-Info ("Created project number {0}" -f $proj.number) } else { Write-Warn "Project created but number not returned; ensure token scopes include 'project' and 'read:project'" }
} else {
  Write-Info "Found project number $($proj.number)"
}
$projNumber = $proj.number

# Add all open issues from the repo milestone with the same title (if it exists)
Write-Info "Collecting issues for repo $Owner/$Repo"
$issuesJson = & ${script:GhCmd} issue list -R "$Owner/$Repo" --limit 200 --json number,title,url,milestone,state | ConvertFrom-Json
$milestoneIssues = $issuesJson | Where-Object { $_.milestone.title -eq $ProjectTitle -and $_.state -eq 'OPEN' }
if (-not $milestoneIssues -or $milestoneIssues.Count -eq 0) {
  Write-Warn "No OPEN issues found in milestone '$ProjectTitle'. Adding all OPEN issues as fallback."
  $milestoneIssues = $issuesJson | Where-Object { $_.state -eq 'OPEN' }
}

foreach ($it in $milestoneIssues) {
  Write-Info "Adding issue #$($it.number) to project $projNumber"
  & ${script:GhCmd} project item-add $projNumber @ownerFlag --url $it.url 1>$null
}

$projectUrl = "https://github.com/users/$Owner/projects/$projNumber"
Write-Host "\nProject ready: $projectUrl" -ForegroundColor Green
