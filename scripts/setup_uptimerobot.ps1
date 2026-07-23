<#
.SYNOPSIS
  Register sadamura.jp as a 5-min interval monitor on UptimeRobot.

.DESCRIPTION
  Run after HP is publicly reachable. Free tier covers 50 monitors and
  5-minute intervals, which is plenty for one personal site. The script
  is idempotent — if a monitor already exists it just prints the URL.

.PREREQUISITES
  - Sign up at https://uptimerobot.com/ (free)
  - Settings → API Settings → "Main API Key" → copy
  - Set the key as env var: `$env:UPTIMEROBOT_API_KEY = 'ur123456-...'`

.PARAMETER Url
  Target URL. Default: https://sadamura.jp/

.PARAMETER FriendlyName
  Display name in the dashboard. Default: sadamura.jp

.PARAMETER AlertEmail
  Recipient for downtime alerts (required). Pass via -AlertEmail, or set
  $env:UPTIMEROBOT_ALERT_EMAIL. No hardcoded default — the address is kept
  out of source so it is not exposed when this script is published.

.EXAMPLE
  $env:UPTIMEROBOT_API_KEY = 'ur123456-...'
  ./setup_uptimerobot.ps1
#>
[CmdletBinding()]
param(
  [string]$Url          = 'https://sadamura.jp/',
  [string]$FriendlyName = 'sadamura.jp',
  [string]$AlertEmail   = ''
)

$ErrorActionPreference = 'Stop'
$apiKey = $env:UPTIMEROBOT_API_KEY
if (-not $apiKey) {
  Write-Host 'UPTIMEROBOT_API_KEY env var is not set.' -ForegroundColor Red
  Write-Host 'Set it once per shell session: $env:UPTIMEROBOT_API_KEY = "ur123456-..."' -ForegroundColor Yellow
  exit 1
}

# Alert recipient is required but intentionally has no hardcoded default,
# so the address is not exposed in published source.
if (-not $AlertEmail) { $AlertEmail = $env:UPTIMEROBOT_ALERT_EMAIL }
if (-not $AlertEmail) {
  Write-Host 'Alert email is not set.' -ForegroundColor Red
  Write-Host 'Pass -AlertEmail you@example.com  (or set $env:UPTIMEROBOT_ALERT_EMAIL).' -ForegroundColor Yellow
  exit 1
}

$endpoint = 'https://api.uptimerobot.com/v2'

function Post($path, $body) {
  $body['api_key'] = $apiKey
  $body['format'] = 'json'
  Invoke-RestMethod -Method Post -Uri "$endpoint/$path" -ContentType 'application/x-www-form-urlencoded' -Body $body
}

# 1. Locate (or create) the alert contact for AlertEmail
Write-Host "==> Looking up alert contact: $AlertEmail" -ForegroundColor Cyan
$contacts = Post 'getAlertContacts' @{}
$existingContact = $contacts.alert_contacts | Where-Object { $_.value -eq $AlertEmail } | Select-Object -First 1

if (-not $existingContact) {
  Write-Host '    not found, creating new email alert contact'
  $new = Post 'newAlertContact' @{
    type           = 2          # 2 = email
    value          = $AlertEmail
    friendly_name  = 'Primary alert contact'
  }
  $contactId = $new.alertcontact.id
  Write-Host "    new contact id: $contactId (you may need to confirm the email)"
} else {
  $contactId = $existingContact.id
  Write-Host "    reusing contact id: $contactId"
}

# 2. Check whether the monitor already exists
Write-Host "==> Checking for existing monitor: $Url" -ForegroundColor Cyan
$monitors = Post 'getMonitors' @{ search = $Url }
$existing = $monitors.monitors | Where-Object { $_.url -eq $Url } | Select-Object -First 1

if ($existing) {
  Write-Host "    monitor already exists (id $($existing.id), $($existing.friendly_name))"
  Write-Host "    https://uptimerobot.com/dashboard.php#$($existing.id)"
  exit 0
}

# 3. Create monitor
Write-Host "==> Creating new monitor" -ForegroundColor Cyan
$create = Post 'newMonitor' @{
  friendly_name   = $FriendlyName
  url             = $Url
  type            = 1                    # 1 = HTTP(s)
  sub_type        = 2                    # 2 = HTTPS
  port            = 443
  keyword_type    = 2                    # alert if keyword IS NOT present
  keyword_value   = 'Sadamura'           # both ja/en pages contain this string
  http_method     = 2                    # GET
  interval        = 300                  # 5 min (free tier minimum)
  alert_contacts  = "${contactId}_0_0"   # contact_threshold_recurrence
  http_username   = ''
  http_password   = ''
}

if ($create.stat -eq 'ok') {
  Write-Host "==> ok: monitor created (id $($create.monitor.id))" -ForegroundColor Green
  Write-Host "    https://uptimerobot.com/dashboard.php#$($create.monitor.id)"
  Write-Host ''
  Write-Host 'Suggested follow-up:' -ForegroundColor Yellow
  Write-Host '  - Adjust alert frequency in dashboard (default = first failure)'
  Write-Host '  - Add a public status page (optional, free)'
  Write-Host '  - Add a second monitor for https://sadamura.jp/sitemap-index.xml (catches DNS-only failures)'
} else {
  Write-Host "==> FAIL: $($create | ConvertTo-Json -Depth 4)" -ForegroundColor Red
  exit 1
}
