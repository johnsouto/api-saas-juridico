Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\\..")).Path
$backendRoot = Join-Path $repoRoot "backend"
Set-Location $repoRoot

$venvPath = Join-Path $repoRoot ".venv"
if (-not (Test-Path (Join-Path $venvPath "Scripts\\python.exe"))) {
    python -m venv $venvPath
}

$activateScript = Join-Path $venvPath "Scripts\\Activate.ps1"
. $activateScript

python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt -r backend/requirements-dev.txt pytest pytest-asyncio ruff tzdata

Set-Location $backendRoot
python -m ruff check app tests tests_api
python -m pytest tests -q
python -m pytest tests_api -q
