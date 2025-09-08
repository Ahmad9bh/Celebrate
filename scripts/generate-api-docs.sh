#!/usr/bin/env bash
set -euo pipefail

SOURCE_SPEC="docs/openapi.yaml"
OUT_DIR="docs/site"

# Allow overrides via flags: -s <spec> -o <outdir>
while getopts ":s:o:" opt; do
  case $opt in
    s) SOURCE_SPEC="$OPTARG" ;;
    o) OUT_DIR="$OPTARG" ;;
    *) echo "Usage: $0 [-s path/to/openapi.yaml] [-o out/dir]" ; exit 1 ;;
  esac
done

if [[ ! -f "$SOURCE_SPEC" ]]; then
  echo "[ERROR] Spec not found: $SOURCE_SPEC" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
cp "$SOURCE_SPEC" "$OUT_DIR/openapi.yaml"

cat > "$OUT_DIR/index.html" <<'HTML'
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
HTML

echo "[INFO] Wrote $OUT_DIR/index.html and $OUT_DIR/openapi.yaml"
