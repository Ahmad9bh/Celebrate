param(
  [string]$Owner = "Ahmad9bh",
  [string]$Repo = "Celebrate",
  [int]$ProjectNumber = 1,
  [string]$FieldName = "Status",
  [ValidateSet('labels-to-project','project-to-labels','both')]
  [string]$Direction = 'labels-to-project',
  [switch]$OrgScope
)

# Mapping between issue labels and Project single-select options
$StatusMap = @{
  "status:todo"        = "Todo"
  "status:in-progress" = "In Progress"
  "status:review"      = "Review"
  "status:done"        = "Done"
}

function Write-Info($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Write-Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Write-Err($m){ Write-Host "[ERROR] $m" -ForegroundColor Red }

${script:GhCmd} = "gh"
function Ensure-GhCli { if (Get-Command gh -ErrorAction SilentlyContinue) { ${script:GhCmd} = "gh"; return $true } Write-Err "GitHub CLI (gh) not found."; return $false }
if (-not (Ensure-GhCli)) { exit 1 }
try { & ${script:GhCmd} auth status 1>$null 2>$null } catch { & ${script:GhCmd} auth login }

# Helper to run GraphQL via gh api
function Gh-QL($query, $vars) {
  $varsJson = $vars | ConvertTo-Json -Depth 10 -Compress
  $body = @{ query = $query; variables = ($vars | ConvertTo-Json -Depth 10) } | ConvertTo-Json -Depth 50
  $tmp = New-TemporaryFile
  $body | Set-Content -Path $tmp -Encoding UTF8
  $res = & ${script:GhCmd} api graphql --input "$tmp" 2>$null
  Remove-Item $tmp -ErrorAction SilentlyContinue
  return ($res | ConvertFrom-Json)
}

# 1) Fetch project, field and options
$nodeKind = $OrgScope.IsPresent ? 'organization' : 'user'
$projQuery = @"
query($login:String!, $number:Int!){
  $nodeKind(login:$login){
    projectV2(number:$number){ id title fields(first:50){ nodes{ id name __typename ... on ProjectV2SingleSelectField { options { id name } } } } }
  }
}
"@
$projRes = Gh-QL $projQuery @{ login = $Owner; number = $ProjectNumber }
if (-not $projRes.data) { Write-Err "Unable to query project. Ensure gh auth scopes include 'project' and 'read:project'."; exit 1 }
$project = $projRes.data.$nodeKind.projectV2
if (-not $project) { Write-Err "Project number $ProjectNumber not found for $nodeKind '$Owner'"; exit 1 }
$projectId = $project.id
$field = $project.fields.nodes | Where-Object { $_.name -eq $FieldName }
if (-not $field) { Write-Err "Field '$FieldName' not found in project."; exit 1 }
if ($field.__typename -ne 'ProjectV2SingleSelectField') { Write-Err "Field '$FieldName' is not a single-select field."; exit 1 }
$optionIndex = @{}
$field.options | ForEach-Object { $optionIndex[$_.name] = $_.id }

# Helpers for issues <-> labels
function Get-OpenIssuesWithLabels {
  $issuesJson = & ${script:GhCmd} issue list -R "$Owner/$Repo" --limit 200 --state open --json number,labels,title | ConvertFrom-Json
  return $issuesJson
}
function Get-IssueNodeId([int]$num) {
  $q = @"
query($owner:String!,$name:String!,$number:Int!){ repository(owner:$owner,name:$name){ issue(number:$number){ id } } }
"@
  $r = Gh-QL $q @{ owner = $Owner; name = $Repo; number = $num }
  return $r.data.repository.issue.id
}

# Mutations
function Ensure-Item-In-Project([string]$contentId){
  $q = @"
mutation($projectId:ID!,$contentId:ID!){ addProjectV2ItemById(input:{projectId:$projectId, contentId:$contentId}){ item { id } } }
"@
  $r = Gh-QL $q @{ projectId = $projectId; contentId = $contentId }
  return $r.data.addProjectV2ItemById.item.id
}
function Set-Item-Status([string]$itemId,[string]$optionName){
  if (-not $optionIndex.ContainsKey($optionName)) { Write-Warn "Unknown option '$optionName' in project field '$FieldName'"; return }
  $optId = $optionIndex[$optionName]
  $q = @"
mutation($projectId:ID!,$itemId:ID!,$fieldId:ID!,$opt: String!){ updateProjectV2ItemFieldValue(input:{projectId:$projectId,itemId:$itemId,fieldId:$fieldId,value:{singleSelectOptionId:$opt}}){ clientMutationId } }
"@
  [void](Gh-QL $q @{ projectId = $projectId; itemId = $itemId; fieldId = $field.id; opt = $optId })
}

# Optional: read project items with issues and current status to sync project->labels
function Get-Project-Items {
  $acc = @()
  $cursor = $null
  do {
    $q = @"
query($login:String!,$number:Int!,$after:String){
  $nodeKind(login:$login){ projectV2(number:$number){ items(first:50, after:$after){ pageInfo{ hasNextPage endCursor } nodes{ id content{ __typename ... on Issue { number } } fieldValues(first:50){ nodes{ __typename ... on ProjectV2ItemFieldSingleSelectValue { field{ ... on ProjectV2SingleSelectField { name } } name } } } } } } }
}
"@
    $r = Gh-QL $q @{ login = $Owner; number = $ProjectNumber; after = $cursor }
    $page = $r.data.$nodeKind.projectV2.items
    $acc += $page.nodes
    $cursor = $page.pageInfo.endCursor
  } while ($page.pageInfo.hasNextPage)
  return $acc
}

if ($Direction -eq 'labels-to-project' -or $Direction -eq 'both') {
  Write-Info "Sync: labels -> project"
  $issues = Get-OpenIssuesWithLabels
  foreach ($iss in $issues) {
    $statusLabel = $iss.labels | Where-Object { $StatusMap.ContainsKey($_.name) } | Select-Object -First 1
    if (-not $statusLabel) { continue }
    $optionName = $StatusMap[$statusLabel.name]
    $issueNodeId = Get-IssueNodeId -num ([int]$iss.number)
    $itemId = Ensure-Item-In-Project -contentId $issueNodeId
    Set-Item-Status -itemId $itemId -optionName $optionName
    Write-Info "Set project status for issue #$($iss.number) -> '$optionName'"
  }
}

if ($Direction -eq 'project-to-labels' -or $Direction -eq 'both') {
  Write-Info "Sync: project -> labels"
  $items = Get-Project-Items
  foreach ($it in $items) {
    $issueNumber = $it.content.number
    if (-not $issueNumber) { continue }
    $status = $it.fieldValues.nodes | Where-Object { $_.__typename -eq 'ProjectV2ItemFieldSingleSelectValue' -and $_.field.name -eq $FieldName } | Select-Object -First 1
    if (-not $status -or -not $status.name) { continue }
    # Map option back to label (reverse map)
    $label = ($StatusMap.GetEnumerator() | Where-Object { $_.Value -eq $status.name } | Select-Object -First 1).Key
    if (-not $label) { continue }
    # Remove other status:* labels and add the mapped label
    $existing = & ${script:GhCmd} issue view -R "$Owner/$Repo" $issueNumber --json labels | ConvertFrom-Json
    $current = @()
    if ($existing -and $existing.labels) { $current = $existing.labels | ForEach-Object { $_.name } }
    foreach ($sl in $current) { if ($sl -like 'status:*' -and $sl -ne $label) { & ${script:GhCmd} issue edit -R "$Owner/$Repo" $issueNumber --remove-label $sl 1>$null } }
    & ${script:GhCmd} issue edit -R "$Owner/$Repo" $issueNumber --add-label $label 1>$null
    Write-Info "Set labels for issue #$issueNumber -> '$label'"
  }
}

Write-Host "\nSync complete." -ForegroundColor Green
