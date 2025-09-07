param(
  [string]$Repo = "Ahmad9bh/Celebrate",
  # Use a plain hyphen to avoid encoding issues in some shells
  [string]$MilestoneTitle = "Phase 1 - Backend APIs",
  [string]$DueOn = "2025-09-20T00:00:00Z"
)

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "[ERROR] $msg" -ForegroundColor Red }

${script:GhCmd} = "gh"

function Find-GhPath {
  $candidates = @(
    Join-Path $Env:ProgramFiles "GitHub CLI",
    Join-Path $Env:LOCALAPPDATA "Programs"
  ) | Where-Object { $_ -and (Test-Path $_) }

  foreach ($root in $candidates) {
    $hit = Get-ChildItem -Path $root -Recurse -Filter gh.exe -ErrorAction SilentlyContinue |
      Select-Object -First 1 -Expand FullName
    if ($hit) { return $hit }
  }
  return $null
}

function Ensure-GhCli {
  if (Get-Command gh -ErrorAction SilentlyContinue) {
    ${script:GhCmd} = "gh"
    $ver = & ${script:GhCmd} --version 2>$null | Select-Object -First 1
    Write-Info "GitHub CLI detected: $ver"
    return $true
  }
  # Try to discover gh.exe
  $ghPath = Find-GhPath
  if ($ghPath -and (Test-Path $ghPath)) {
    ${script:GhCmd} = $ghPath
    $env:Path += ";" + (Split-Path $ghPath)
    $ver = & ${script:GhCmd} --version 2>$null | Select-Object -First 1
    Write-Info "GitHub CLI detected at: $ghPath ($ver)"
    return $true
  }
  Write-Warn "GitHub CLI (gh) not found."
  Write-Host "Install via MSI: https://github.com/cli/cli/releases/latest, then open a NEW PowerShell window." -ForegroundColor Yellow
  return $false
}

if (-not (Ensure-GhCli)) { exit 1 }

# --- Labels management ---
function Ensure-Label($name, $color, $desc) {
  Write-Info "Ensuring label '$name' exists"
  # gh label create --force will create or update if exists
  & ${script:GhCmd} label create $name --color $color --description $desc --force 1>$null 2>$null
}

# Ensure baseline labels used in Phase 1
Ensure-Label "backend"           "FFD966" "Backend work"
Ensure-Label "api"               "BFD4F2" "HTTP APIs"
Ensure-Label "performance"       "F5AB00" "Perf/scale/indexing"
Ensure-Label "bookings"          "C2E0C6" "Bookings domain"
Ensure-Label "business-logic"    "C5DEF5" "Business rules"
Ensure-Label "payments"          "F9D0C4" "Payments & Stripe"
Ensure-Label "reliability"       "0366D6" "Reliability/Idempotency"
Ensure-Label "observability"     "5319E7" "Logging/metrics/tracing"
Ensure-Label "good-first-review" "D4C5F9" "Small, reviewable change"

# Auth check
try {
  & ${script:GhCmd} auth status -R $Repo 1>$null 2>$null
} catch {
  Write-Warn "You are not authenticated. Running 'gh auth login'..."
  & ${script:GhCmd} auth login
}

# Create milestone if it does not exist
Write-Info "Ensuring milestone '$MilestoneTitle' exists on $Repo"
$existing = & ${script:GhCmd} api repos/$Repo/milestones --jq ".[] | select(.title==\"$MilestoneTitle\") | .number" 2>$null
if (-not $existing) {
  $desc = @"
Scope:
- Validate/sanitize API payloads in backend.
- Add pagination/sorting/search to venues.
- Enforce booking invariants (no double-booking; valid dates).
- Add webhook idempotency for Stripe events.
- Improve structured logging and observability.

Exit criteria:
- All endpoints validate inputs and return typed error shapes.
- Admin/owner/user flows pass backend tests and E2E without flakes.
- Stripe webhook processing is idempotent.
- Logs include traceable context for payments/bookings/admin.
"@
  $res = & ${script:GhCmd} api -X POST repos/$Repo/milestones -f title="$MilestoneTitle" -f description="$desc" -f due_on="$DueOn"
  $msNumber = ($res | ConvertFrom-Json).number
  Write-Info "Created milestone #$msNumber"
} else {
  $msNumber = $existing
  Write-Info "Found milestone #$msNumber"
}

function Get-IssueNumberByTitle($title) {
  $json = & ${script:GhCmd} issue list -R $Repo --limit 200 --search "$title" --json number,title 2>$null | ConvertFrom-Json
  $hit = $json | Where-Object { $_.title -like "*$title*" } | Select-Object -First 1
  if ($hit) { return $hit.number } else { return $null }
}

function Upsert-Issue($title, $labels, $body) {
  $num = Get-IssueNumberByTitle $title
  if ($num) {
    Write-Info ("Updating existing issue #{0}: {1}" -f $num, $title)
    & ${script:GhCmd} issue edit -R $Repo $num --add-label $labels --milestone "$MilestoneTitle" 1>$null
  } else {
    Write-Info ("Creating issue: {0}" -f $title)
    & ${script:GhCmd} issue create -R $Repo --title $title --label $labels --milestone "$MilestoneTitle" --body $body 1>$null
  }
}

# Issue 1: Input validation
$body1 = @"
Implement request validation for key endpoints in `backend/src/server.ts`.
Use a schema validator (e.g., zod) to validate and coerce payloads for:
- POST /api/venues
- PATCH /api/venues/:id
- POST /api/bookings
- Admin actions (approve/suspend/delete)

Return consistent error shape: `{ error: { code, message, details? } }` and appropriate HTTP status.
Add unit/integration tests for validation happy/negative paths.

Acceptance Criteria
- Invalid payloads return 4xx with structured error body
- Valid payloads are sanitized and persisted
- Tests cover happy + 3 negative cases per endpoint
"@
Upsert-Issue "feat(api): input validation and typed errors in backend" "backend,api,good-first-review" $body1

# Issue 2: Venues pagination/sorting/search
$body2 = @"
Extend `GET /api/venues` with query params:
- `page`, `pageSize` (default 1/20)
- `sort` (name|city|createdAt; support DESC via `sort=-name`)
- `q` (search by name/city)

Return metadata: `{ items, page, pageSize, total, totalPages }`.
Add indexes for common filters (city, status) in Prisma/model layer.
Update E2E/Admin filters as needed.

Acceptance Criteria
- Paginated results with metadata
- Sorting ASC/DESC works
- Tests verify page boundaries, sorting, and search
"@
Upsert-Issue "feat(api): venues pagination, sorting, and search" "backend,api,performance" $body2

# Issue 3: Booking invariants
$body3 = @"
Booking rules:
- Cannot book past dates
- Cannot double-book same venue + isoDay
- (Optional) enforce capacity or per-day constraints

Validate in booking creation path; return 400 on violations.
Add unit/integration tests (past date + double-booking negative cases).

Acceptance Criteria
- Business rules enforced server-side
- Tests cover valid/invalid windows and double-bookings
"@
Upsert-Issue "feat(bookings): enforce invariants (no double-booking; valid date windows)" "backend,bookings,business-logic" $body3

# Issue 4: Stripe webhook idempotency
$body4 = @"
Store processed Stripe `event.id` to ensure idempotency.
Guard booking updates to avoid double-processing.
Add logging around webhook receipt/verification/apply.
Add tests with mocked webhook payloads.

Acceptance Criteria
- Re-sent webhooks do not repeat side-effects
- Logs include event id + booking id + outcome
"@
Upsert-Issue "feat(payments): webhook idempotency and safety for Stripe events" "backend,payments,reliability" $body4

# Issue 5: Structured logs
$body5 = @"
Standardize logs with context fields (request id, user id, booking id, venue id).
Wrap handlers with a logger helper (pino-like shape, or structured console).
Add log lines for:
- Payments: intent created/confirmed, webhook processed/ignored
- Bookings: created/validated/failed
- Admin: approve/suspend/delete venue (id, actor)

Ensure logs do not include PII or secrets.

Acceptance Criteria
- Log lines consistently include context
- Sensitive data is not logged
- Filterable format (NDJSON-like or consistent key/values)
"@
Upsert-Issue "feat(observability): structured logs for payments, bookings, and admin" "backend,observability" $body5

Write-Info "All Phase 1 issues created with milestone '$MilestoneTitle' on $Repo."
