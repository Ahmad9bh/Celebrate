param(
  [string]$Owner = "Ahmad9bh",
  [string]$Repo = "Celebrate",
  [string]$MilestoneTitle = "Phase 1 - Backend APIs",
  [string]$DefaultStatus = "status:todo", # status:todo | status:in-progress | status:review | status:done
  [int[]]$IssueNumbers = @() # optional explicit list
)

function Write-Info($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Write-Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Write-Err($m){ Write-Host "[ERROR] $m" -ForegroundColor Red }

# Resolve gh.exe
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
  Write-Err "GitHub CLI (gh) not found."
  return $false
}
if (-not (Ensure-GhCli)) { exit 1 }
try { & ${script:GhCmd} auth status 1>$null 2>$null } catch { & ${script:GhCmd} auth login }

# Ensure status labels exist
$labels = @(
  @{ name = "status:todo";        color = "D4C5F9"; desc = "Not started" },
  @{ name = "status:in-progress"; color = "BFD4F2"; desc = "In progress" },
  @{ name = "status:review";      color = "F9D0C4"; desc = "In review" },
  @{ name = "status:done";        color = "C2E0C6"; desc = "Done" }
)
foreach ($l in $labels) {
  Write-Info "Ensuring label '$($l.name)'"
  & ${script:GhCmd} label create -R "$Owner/$Repo" $l.name --color $l.color --description $l.desc --force 1>$null 2>$null
}

# Determine target issues: explicit list or by milestone
$targets = @()
if ($IssueNumbers.Count -gt 0) {
  $IssueNumbers | ForEach-Object { $targets += @{ number = $_ } }
} else {
  Write-Info "Fetching issues in milestone '$MilestoneTitle'"
  $milestoneIssues = & ${script:GhCmd} issue list -R "$Owner/$Repo" --limit 200 --milestone "$MilestoneTitle" --json number | ConvertFrom-Json
  $targets = $milestoneIssues
}

if ($targets.Count -eq 0) { Write-Warn "No target issues found."; exit 0 }

# Apply default status label; remove other status:* labels if present
foreach ($it in $targets) {
  $n = [int]$it.number
  Write-Info "Labeling issue #$n with '$DefaultStatus'"
  # remove conflicting status:* labels (best-effort)
  $existing = & ${script:GhCmd} issue view -R "$Owner/$Repo" $n --json labels | ConvertFrom-Json
  $statusLabels = @()
  if ($existing -and $existing.labels) {
    $statusLabels = $existing.labels | Where-Object { $_.name -like 'status:*' } | ForEach-Object { $_.name }
  }
  foreach ($sl in $statusLabels) {
    if ($sl -ne $DefaultStatus) {
      & ${script:GhCmd} issue edit -R "$Owner/$Repo" $n --remove-label $sl 1>$null
    }
  }
  & ${script:GhCmd} issue edit -R "$Owner/$Repo" $n --add-label $DefaultStatus 1>$null
}

Write-Host "\nApplied '$DefaultStatus' to $($targets.Count) issue(s)." -ForegroundColor Green
