#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT/backend"
python -m pytest -q
cd "$ROOT/frontend"
npm ci
npm run build
cd "$ROOT"
docker compose config --quiet
helm lint ./helm/taskboard
helm template taskboard ./helm/taskboard --namespace taskboard >/dev/null
helm template taskboard ./helm/taskboard --namespace taskboard -f helm/taskboard/values-dev.yaml --set serviceMonitor.enabled=true >/dev/null
if command -v terraform >/dev/null 2>&1; then
  cd terraform
  terraform fmt -check
  terraform init -backend=false
  terraform validate
fi
