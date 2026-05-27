# ===========================================================================
# VIBEZCORE -- test-pro-auth.ps1   (volledig automatisch, een commando)
#
# Wat dit doet:
#   1. Leest test-credentials uit .env.test (project-root). Bij eerste run
#      vraagt het email + password en slaat ze op.
#   2. Logt in via Supabase Auth -> access_token.
#   3. Doet 3 controle-calls:
#        TEST 1 -- /api/subscription-status   (control)
#        TEST 2 -- /api/audio-url FREE        (control)
#        TEST 3 -- /api/audio-url PRO/locked  (de bug)
#   4. Print status + body per test.
#
# Run vanuit project-root:
#   powershell -ExecutionPolicy Bypass -File .\scripts\test-pro-auth.ps1
#
# .env.test wordt NIET gecommit (.gitignore). Bevat plaintext credentials --
# alleen voor test-account, niet voor productie-users.
#
# NOTE: dit bestand bewust pure ASCII. PowerShell 5.1 leest .ps1 zonder BOM
# als ANSI; non-ASCII tekens (em-dash, accent, pijl) breken dan parsing.
# Vervang nooit "->" of "--" door non-ASCII varianten.
# ===========================================================================

$ErrorActionPreference = 'Stop'

# Publieke Supabase-config (zelfde als src/services/auth.ts).
# Publishable key is by-design publiek, mag in scripts.
$supabaseUrl = 'https://zotxpyjvcamnlzwdgceh.supabase.co'
$supabaseKey = 'sb_publishable_LZH7TZUskMTphvMIiefiQQ_8As5C_Q2'

$backendBase = 'https://app.vibezcore.com'
$freePath = '/Andrew_Huberman_1._Neural_State_Control_How_to_Direct_Your_Mind_Instead_of_Chasing_It_osg0uy.mp3.mp3'
$lockedPath = '/Carl_Jung_1_The_Journey_to_the_Self_satfq8.mp3.mp3'

# ---- 1. Credentials --------------------------------------------------------

# Simpele email-validatie: minstens 1 char voor @, minstens 1 char tussen
# @ en . , minstens 1 char na de laatste . Geen volledige RFC 5322-check
# (overkill voor dev-validatie), maar vangt typische typo's zoals
# "gmailcom" (mist punt) of "user@" (mist domein).
function Test-EmailFormat([string]$e) {
    if (-not $e) { return $false }
    return ($e.Trim()) -match '^[^@\s]+@[^@\s]+\.[^@\s]+$'
}

$envFile = Join-Path $PSScriptRoot '..\.env.test'
$envFile = [IO.Path]::GetFullPath($envFile)

$email = $null
$password = $null

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*VZ_TEST_EMAIL\s*=\s*(.+)\s*$')    { $email = $Matches[1] }
        if ($_ -match '^\s*VZ_TEST_PASSWORD\s*=\s*(.+)\s*$') { $password = $Matches[1] }
    }
    if ($email -and $password) {
        if (Test-EmailFormat $email) {
            Write-Host ""
            Write-Host "OK: credentials uit $envFile" -ForegroundColor Green
            Write-Host "    account: $email"
        } else {
            Write-Host ""
            Write-Host "WARN: email in .env.test is ongeldig ($email)." -ForegroundColor Yellow
            Write-Host "      Opnieuw vragen + overschrijven."         -ForegroundColor Yellow
            $email = $null
            $password = $null
        }
    }
}

if (-not $email -or -not $password) {
    Write-Host ""
    Write-Host "Geen geldige .env.test. Eenmalig invoeren -- wordt opgeslagen"  -ForegroundColor Yellow
    Write-Host "voor volgende runs. Staat in .gitignore."                       -ForegroundColor Yellow
    Write-Host ""

    # Email met retry-loop (max 3 pogingen) + validatie
    $maxAttempts = 3
    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        $email = Read-Host "  Email"
        if (Test-EmailFormat $email) { break }
        Write-Host "ERR: ongeldig email-formaat (moet bevatten @ en .)" -ForegroundColor Red
        if ($attempt -eq $maxAttempts) {
            Write-Host "ERR: $maxAttempts ongeldige pogingen. Stop." -ForegroundColor Red
            exit 1
        }
    }

    $secure = Read-Host "  Password (verborgen)" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $password = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

    if (-not $password) {
        Write-Host "ERR: password leeg. Stop." -ForegroundColor Red
        exit 1
    }

    @"
VZ_TEST_EMAIL=$email
VZ_TEST_PASSWORD=$password
"@ | Set-Content -Path $envFile -Encoding UTF8

    Write-Host "OK: opgeslagen in $envFile" -ForegroundColor Green
}

# ---- 2. Login via Supabase ------------------------------------------------

Write-Host ""
Write-Host "INFO: inloggen bij Supabase..." -ForegroundColor Cyan

$loginBody = @{ email = $email; password = $password } | ConvertTo-Json -Compress
$loginHeaders = @{
    'apikey'       = $supabaseKey
    'Content-Type' = 'application/json'
}

try {
    $loginResp = Invoke-RestMethod `
        -Uri "$supabaseUrl/auth/v1/token?grant_type=password" `
        -Method POST `
        -Headers $loginHeaders `
        -Body $loginBody `
        -ErrorAction Stop
} catch {
    Write-Host "ERR: Supabase login mislukt: $($_.Exception.Message)" -ForegroundColor Red
    $resp = $_.Exception.Response
    if ($resp) {
        try {
            $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
            $body = $sr.ReadToEnd()
            $sr.Close()
            Write-Host "Response body: $body" -ForegroundColor Red
        } catch { }
    }
    Write-Host ""
    Write-Host "Mogelijke oorzaken:" -ForegroundColor Yellow
    Write-Host "  -- Verkeerd password: wis .env.test en run opnieuw"
    Write-Host "  -- Account bestaat niet: registreer in de app eerst"
    Write-Host "  -- Email niet bevestigd: check inbox"
    exit 1
}

$token = $loginResp.access_token
if (-not $token) {
    Write-Host "ERR: geen access_token in Supabase-response." -ForegroundColor Red
    exit 1
}

$head = $token.Substring(0, 12)
$tail = $token.Substring($token.Length - 12)
Write-Host "OK: token verkregen: $head...$tail (len=$($token.Length))" -ForegroundColor Green

# ---- 3. Drie controle-calls -----------------------------------------------

$headers = @{
    'Authorization' = "Bearer $token"
    'Accept'        = 'application/json'
}

function Invoke-TestCall {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Expect
    )
    Write-Host ""
    Write-Host "===========================================================" -ForegroundColor Cyan
    Write-Host " $Name" -ForegroundColor Cyan
    Write-Host " expect: $Expect" -ForegroundColor DarkGray
    Write-Host "===========================================================" -ForegroundColor Cyan
    Write-Host "GET $Url"
    try {
        $r = Invoke-WebRequest -Uri $Url -Headers $headers -Method GET `
                               -UseBasicParsing -ErrorAction Stop
        $color = if ($r.StatusCode -eq 200) { 'Green' } else { 'Yellow' }
        Write-Host "Status: $($r.StatusCode) $($r.StatusDescription)" -ForegroundColor $color
        Write-Host "Body:"
        Write-Host $r.Content
    } catch {
        $resp = $_.Exception.Response
        if ($resp) {
            $sc = [int]$resp.StatusCode
            $color = if ($sc -eq 401 -or $sc -eq 402) { 'Yellow' } else { 'Red' }
            Write-Host "Status: $sc" -ForegroundColor $color
            try {
                $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
                $body = $sr.ReadToEnd()
                $sr.Close()
                Write-Host "Body:"
                Write-Host $body
            } catch {
                Write-Host "(could not read response body)"
            }
        } else {
            Write-Host "Network/connect error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

Invoke-TestCall `
    -Name   "TEST 1: /api/subscription-status (control)" `
    -Url    "$backendBase/api/subscription-status" `
    -Expect "200 met {active:true, tier:monthly, ...}"

$encFree = [uri]::EscapeDataString($freePath)
Invoke-TestCall `
    -Name   "TEST 2: /api/audio-url FREE sessie (control)" `
    -Url    "$backendBase/api/audio-url?path=$encFree" `
    -Expect "200 met {url, expires_at, title}"

$encLocked = [uri]::EscapeDataString($lockedPath)
Invoke-TestCall `
    -Name   "TEST 3: /api/audio-url PRO/locked sessie (de bug)" `
    -Url    "$backendBase/api/audio-url?path=$encLocked" `
    -Expect "200 als backend OK, 401/402 als bug"

# ---- 4. Conclusie-matrix --------------------------------------------------

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host " Decision matrix" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host " TEST1=200  TEST2=200  TEST3=200 -> backend OK, bug in RN client"     -ForegroundColor DarkGray
Write-Host " TEST1=200  TEST2=200  TEST3=401 -> backend-bug in audio-url"         -ForegroundColor DarkGray
Write-Host " TEST1=200  TEST2=200  TEST3=402 -> subscription-query verschilt"     -ForegroundColor DarkGray
Write-Host " TEST1=401  ...                  -> token-issue, herstart script"    -ForegroundColor DarkGray
Write-Host ""
Write-Host " Plak alle drie test-secties (Status + Body) terug in chat."          -ForegroundColor Cyan
Write-Host ""
