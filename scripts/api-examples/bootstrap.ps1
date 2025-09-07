param(
  [string]$Api = "http://localhost:4000",
  [string]$OwnerEmail = "owner.demo@example.com",
  [string]$UserEmail = "user.demo@example.com",
  [int]$Guests = 2
)

function Write-Info($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Write-Err($m){ Write-Host "[ERROR] $m" -ForegroundColor Red }

# Helper: POST JSON and return parsed object
function Post-Json($url, $body, $headers=@{}) {
  $json = $body | ConvertTo-Json -Depth 5
  return Invoke-RestMethod -Uri $url -Method POST -Body $json -ContentType 'application/json' -Headers $headers
}

# 1) Owner login -> get id, mint OWNER jwt (dev-secret)
Write-Info "Logging in owner: $OwnerEmail"
$ownerLogin = Post-Json "$Api/api/auth/login" @{ email = $OwnerEmail }
$ownerId = $ownerLogin.user.id

Write-Info "Minting OWNER JWT for ownerId=$ownerId"
$ownerJwt = node -e "console.log(require('jsonwebtoken').sign({ sub: '$ownerId', role: 'owner', name: 'Owner Demo' }, 'dev-secret', { expiresIn: '1h' }))"
if (-not $ownerJwt) { Write-Err "Failed to mint owner JWT. Ensure 'jsonwebtoken' is installed (npm i)."; exit 1 }

# 2) Create venue
Write-Info "Creating venue as owner"
$venueBody = @{
  name = "Bootstrap Venue"
  description = "Demo venue"
  city = "London"
  country = "UK"
  capacity = 50
  basePrice = 199
  images = @()
  amenities = @('wifi')
  eventTypes = @('wedding')
}
$venue = Post-Json "$Api/api/venues" $venueBody @{ Authorization = "Bearer $ownerJwt" }
$venueId = $venue.id
Write-Info "Venue created: id=$venueId"

# 3) User login
Write-Info "Logging in user: $UserEmail"
$userLogin = Post-Json "$Api/api/auth/login" @{ email = $UserEmail }
$userToken = $userLogin.token

# 4) Create booking for tomorrow
$tomorrow = [DateTime]::UtcNow.AddDays(1).ToString('yyyy-MM-dd')
$bookingBody = @{ venueId = $venueId; date = $tomorrow; guests = $Guests }
$booking = Post-Json "$Api/api/bookings" $bookingBody @{ Authorization = "Bearer $userToken" }
$bookingId = $booking.id
Write-Info "Booking created: id=$bookingId status=$($booking.status)"

# 5) Request payment intent
$intent = Post-Json "$Api/api/payments/intent" @{ bookingId = $bookingId } @{ Authorization = "Bearer $userToken" }
Write-Info "Payment intent clientSecret: $($intent.clientSecret)"

# 6) Simulate webhook success (idempotent)
$eventId = "evt_bootstrap_" + ([Guid]::NewGuid().ToString('N').Substring(0,8))
$event = @{ id = $eventId; type = 'payment_intent.succeeded'; data = @{ object = @{ metadata = @{ bookingId = $bookingId } } } }
$payload = $event | ConvertTo-Json -Depth 6

Write-Info "Posting webhook event id=$eventId"
$headers = @{ 'stripe-signature' = 't=1,v1=test' }
$webhook1 = Invoke-RestMethod -Uri "$Api/api/payments/webhook" -Method POST -Body $payload -ContentType 'application/json' -Headers $headers
Write-Host ("Webhook #1: {0}" -f ($webhook1 | ConvertTo-Json -Depth 5))

Write-Info "Posting same webhook again (should be duplicate)"
$webhook2 = Invoke-RestMethod -Uri "$Api/api/payments/webhook" -Method POST -Body $payload -ContentType 'application/json' -Headers $headers
Write-Host ("Webhook #2: {0}" -f ($webhook2 | ConvertTo-Json -Depth 5))

# 7) Verify booking status
$me = Invoke-RestMethod -Uri "$Api/api/bookings/me" -Headers @{ Authorization = "Bearer $userToken" }
$mine = $me.items | Where-Object { $_.id -eq $bookingId }
Write-Info ("Final booking status: {0}" -f $mine.status)
