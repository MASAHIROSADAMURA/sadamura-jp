<#
.SYNOPSIS
  Verify sadamura.jp DNS is pointing at GitHub Pages.

.DESCRIPTION
  Day 3 of the setup guide configures A / AAAA / CNAME records at お名前.com.
  Run this script after the records are saved to confirm the values have
  propagated. The script is safe to run repeatedly while waiting for
  propagation (usually < 1 hour, sometimes up to 24 hours).

.PARAMETER Domain
  Domain to check. Defaults to sadamura.jp.

.PARAMETER GhUser
  GitHub username for the `www` CNAME target. Default: PLACEHOLDER.
  Override with -GhUser <yourname>.

.EXAMPLE
  ./check_dns.ps1
  ./check_dns.ps1 -Domain sadamura.jp -GhUser msadamura
#>
[CmdletBinding()]
param(
  [string]$Domain = 'sadamura.jp',
  [string]$GhUser = 'PLACEHOLDER'
)

$ErrorActionPreference = 'Stop'
$expectedA = @('185.199.108.153', '185.199.109.153', '185.199.110.153', '185.199.111.153')
$expectedAAAA = @('2606:50c0:8000::153', '2606:50c0:8001::153', '2606:50c0:8002::153', '2606:50c0:8003::153')

function Write-Step($label, $ok, $detail = '') {
  $icon = if ($ok) { '[OK]  ' } else { '[FAIL]' }
  $color = if ($ok) { 'Green' } else { 'Red' }
  Write-Host "$icon $label" -ForegroundColor $color
  if ($detail) { Write-Host "       $detail" -ForegroundColor DarkGray }
}

Write-Host "DNS preflight for $Domain (using 8.8.8.8)" -ForegroundColor Cyan
Write-Host ('-' * 56)

# A records
try {
  $a = (Resolve-DnsName -Name $Domain -Type A -Server 8.8.8.8 -ErrorAction Stop).IPAddress | Sort-Object
  $missing = $expectedA | Where-Object { $_ -notin $a }
  Write-Step "A records ($Domain)" ($missing.Count -eq 0) (
    if ($missing.Count -eq 0) { "all 4 GitHub Pages IPs present" }
    else { "missing: $($missing -join ', ') | got: $($a -join ', ')" }
  )
} catch {
  Write-Step "A records ($Domain)" $false $_.Exception.Message
}

# AAAA records
try {
  $aaaa = (Resolve-DnsName -Name $Domain -Type AAAA -Server 8.8.8.8 -ErrorAction Stop).IPAddress
  $aaaaLower = $aaaa | ForEach-Object { $_.ToLower() }
  $missingV6 = $expectedAAAA | Where-Object { $_.ToLower() -notin $aaaaLower }
  Write-Step "AAAA records ($Domain)" ($missingV6.Count -eq 0) (
    if ($missingV6.Count -eq 0) { "all 4 GitHub Pages IPv6 present" }
    else { "missing: $($missingV6 -join ', ') | got: $($aaaa -join ', ')" }
  )
} catch {
  Write-Step "AAAA records ($Domain)" $false $_.Exception.Message
}

# CNAME for www
try {
  $cname = (Resolve-DnsName -Name "www.$Domain" -Type CNAME -Server 8.8.8.8 -ErrorAction Stop).NameHost
  $expectedCname = "$GhUser.github.io".ToLower()
  $ok = $cname -and $cname.ToLower().TrimEnd('.') -eq $expectedCname
  Write-Step "CNAME (www.$Domain)" $ok "got: $cname (expected: $expectedCname)"
} catch {
  Write-Step "CNAME (www.$Domain)" $false $_.Exception.Message
}

# HTTP check
Write-Host ''
Write-Host 'HTTP probe' -ForegroundColor Cyan
Write-Host ('-' * 56)

foreach ($scheme in 'https', 'http') {
  $url = "${scheme}://$Domain/"
  try {
    $res = Invoke-WebRequest -Uri $url -Method Head -MaximumRedirection 5 -TimeoutSec 10 -ErrorAction Stop -UseBasicParsing
    Write-Step "$url" ($res.StatusCode -ge 200 -and $res.StatusCode -lt 400) "status: $($res.StatusCode)"
  } catch {
    Write-Step "$url" $false $_.Exception.Message
  }
}

# TLS certificate fingerprint
try {
  $req = [System.Net.HttpWebRequest]::Create("https://$Domain/")
  $req.AllowAutoRedirect = $false
  $req.Timeout = 10000
  $resp = $req.GetResponse()
  $cert = $req.ServicePoint.Certificate
  $issuer = $cert.Issuer
  $resp.Close()
  Write-Step "TLS cert" $true "issuer: $issuer"
} catch {
  Write-Step "TLS cert" $false $_.Exception.Message
}

Write-Host ''
Write-Host 'If any A/AAAA records are missing, wait 5-30 min and re-run.' -ForegroundColor Yellow
Write-Host 'If still failing after 1 hour, check the お名前.com DNS panel.' -ForegroundColor Yellow
