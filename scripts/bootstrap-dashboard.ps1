param(
    [switch]$WithSupabase
)

$ErrorActionPreference = "Stop"

function Require-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Missing required command: $Name"
    }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$dashboardDir = Join-Path $repoRoot "dashboard"

Write-Host "==> Installing dashboard dependencies"
Push-Location $dashboardDir
npm install
Pop-Location

if ($WithSupabase) {
    Write-Host "==> Starting local Supabase and applying migrations"
    Require-Command -Name "supabase"
    Push-Location $repoRoot
    supabase start
    supabase db reset
    Pop-Location
}

Write-Host "==> Bootstrap complete"
Write-Host "Run: cd dashboard; npm run dev"
if ($WithSupabase) {
    Write-Host "Supabase local stack is running with fresh migrations."
}
