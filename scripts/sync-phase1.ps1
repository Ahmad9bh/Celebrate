param(
  [string]$Owner = "Ahmad9bh",
  [string]$Repo = "Celebrate",
  [string]$ProjectTitle = "Phase 1 - Backend APIs",
  [ValidateSet('labels-to-project','project-to-labels','both')]
  [string]$Direction = 'both',
  [switch]$OrgScope
)

function Write-Info($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Write-Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Write-Err($m){ Write-Host "[ERROR] $m" -ForegroundColor Red }

${script:GhCmd} = "gh"
function Ensure-GhCli { if (Get-Command gh -ErrorAction SilentlyContinue) { ${script:GhCmd} = "gh"; return $true } Write-Err "GitHub CLI (gh) not found."; return $false }
if (-not (Ensure-GhCli)) { exit 1 }
try { & ${script:GhCmd} auth status 1>$null 2>$null } catch { & ${script:GhCmd} auth login }

# Detect project number by title under user or org
$ownerFlag = @('--owner', $Owner)
Write-Info "Detecting project number for '$ProjectTitle' under $([string]($OrgScope.IsPresent ? 'org' : 'user')) '$Owner'"
$plist = & ${script:GhCmd} project list @ownerFlag --format json | ConvertFrom-Json
if (-not $plist) { Write-Err "No projects returned. Ensure gh has scopes: 'project' and 'read:project' (gh auth refresh -s read:project -s project -h github.com)."; exit 1 }
$proj = $plist | Where-Object { $_.title -eq $ProjectTitle } | Select-Object -First 1
if (-not $proj) { Write-Err "Project with title '$ProjectTitle' not found."; exit 1 }
$projNumber = [int]$proj.number
Write-Info "Detected ProjectNumber=$projNumber"

# Delegate to project-status-sync.ps1
$syncPath = Join-Path -Path (Split-Path $MyInvocation.MyCommand.Path -Parent) -ChildPath 'project-status-sync.ps1'
if (-not (Test-Path $syncPath)) { Write-Err "project-status-sync.ps1 not found at $syncPath"; exit 1 }

Write-Info "Syncing ($Direction) for $Owner/$Repo -> Project #$projNumber"
& $syncPath -Owner $Owner -Repo $Repo -ProjectNumber $projNumber -Direction $Direction @PSBoundParameters | Out-Null

Write-Host "\nDone. Synced '$Direction' for project #$projNumber." -ForegroundColor Green
