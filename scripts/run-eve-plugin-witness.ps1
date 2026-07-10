param(
  [string] $EveRoot = "E:\Projects\Eve",
  [string] $OutputPath = "artifacts\eve-plugin\runtime-witness.json",
  [string] $NodePath = "node"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$output = if ([IO.Path]::IsPathRooted($OutputPath)) { $OutputPath } else { Join-Path $repoRoot $OutputPath }
$launcher = Join-Path $EveRoot "tools\plugins\run-sidecar-witness.mjs"

& $NodePath $launcher `
  --advertisement (Join-Path $repoRoot "plugins\sai-vn.plugin-advertisement.json") `
  --fixture (Join-Path $repoRoot "plugins\sai-vn.plugin-abi-fixture.json") `
  --output $output `
  --witness-id "sai.vn.owner-sidecar" `
  --cwd $repoRoot `
  --command $NodePath `
  -- "src/eve-sidecar.cjs"
if ($LASTEXITCODE -ne 0) { throw "Sai Eve plugin witness failed with exit code $LASTEXITCODE" }

Write-Host "Sai Eve plugin witness: $output"
