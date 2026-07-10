param([string] $NodePath = "node")

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
& $NodePath (Join-Path $PSScriptRoot "run-eve-cultnet-witness.mjs")
if ($LASTEXITCODE -ne 0) { throw "Sai Eve plugin witness failed with exit code $LASTEXITCODE" }
