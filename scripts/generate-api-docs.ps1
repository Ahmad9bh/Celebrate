param(
  [string]$SourceSpec = "docs/openapi.yaml",
  [string]$OutDir = "docs/site"
)

function Write-Info($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Write-Err($m){ Write-Host "[ERROR] $m" -ForegroundColor Red }

try {
  $root = Resolve-Path "." | Select-Object -Expand Path
  $specPath = Join-Path $root $SourceSpec
  if (-not (Test-Path $specPath)) { Write-Err "Spec not found: $specPath"; exit 1 }

  $out = Join-Path $root $OutDir
  if (-not (Test-Path $out)) { New-Item -ItemType Directory -Path $out | Out-Null }

  # Copy spec next to index.html for easy deploy on GitHub Pages (docs/ folder root)
  Copy-Item -Path $specPath -Destination (Join-Path $out "openapi.yaml") -Force

  $html = @"
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Celebrate API Docs</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style> body { margin: 0; } #swagger-ui { max-width: 100%; } </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: './openapi.yaml',
        dom_id: '#swagger-ui',
        presets: [SwaggerUIBundle.presets.apis],
      });
    </script>
  </body>
</html>
"@
  $indexPath = Join-Path $out "index.html"
  Set-Content -Path $indexPath -Value $html -Encoding UTF8
  Write-Info "Generated $indexPath (and copied openapi.yaml)"
  Write-Host "\nTo publish with GitHub Pages, configure the repository Pages source to 'docs/' folder." -ForegroundColor Green
} catch {
  Write-Err $_.Exception.Message
  exit 1
}
