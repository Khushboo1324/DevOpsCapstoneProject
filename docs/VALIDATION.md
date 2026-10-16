# TaskBoard validation record

Local checks performed on 16 October 2026 (Asia/Kolkata). AWS provisioning and cloud deployment were not executed.

| Check | Actual result |
|---|---|
| Python 3.12 host `cd backend && .venv/bin/pytest -q` | **14 passed** after dependency security fixes; one upstream TestClient/httpx deprecation warning |
| Same pytest suite in final backend image | **14 passed** |
| `npm install` / final frontend build | **Passed** with Vite 6.4.4; ~209 KB JS, ~16.5 KB CSS before gzip |
| npm dependency audit | **0 vulnerabilities** after upgrading Vite 6.4.1 → 6.4.4 |
| `docker compose config --quiet` | **Passed** |
| `docker compose build` | **Both images built**; each affected image rebuilt after final source/dependency changes |
| `docker compose up -d --wait` | **All three services healthy** |
| Real PostgreSQL/Nginx integration smoke | **Passed**: UI response, task create/read/update/delete/stats, `/health`, `/ready`, `/docs`, `/metrics` |
| Seed rerun / backend restart | **Six demo rows remained**, no duplicates |
| Trivy 0.69.3 frontend final image | **0 fixable HIGH/CRITICAL vulnerabilities** |
| Trivy backend initial image | Found two Starlette HIGH CVEs; fixed by compatible FastAPI 0.143.3 / Starlette 1.8.0 / instrumentator 8.1.0 upgrade |
| Trivy backend final image | **0 fixable HIGH/CRITICAL vulnerabilities** |
| GitHub Actions `actionlint` 1.7.7 | **Passed**, explicit workflow path used because directory is not yet a Git checkout |
| `helm lint helm/taskboard` | **Passed**; informational optional chart icon recommendation only |
| Helm default, dev, dev+ServiceMonitor render | **Passed** |
| kubeconform 0.7.0 default render | **9 valid, 0 invalid, 0 errors** |
| kubeconform dev + ServiceMonitor | **10 valid, 0 invalid, 0 errors, 1 skipped** (custom ServiceMonitor schema) |
| kubectl client dry-run schema validation | **Passed** for default/dev render, bootstrap and lab YAML; no resources created by these checks |
| Local Minikube actual default Helm install | **Deployed**, five ready Pods, 5Gi PVC Bound, frontend-to-backend proxy and six PostgreSQL seed rows verified |
| Local HPA | Present with two backend replicas; CPU target unknown because resource metrics are unavailable; no CPU scale-out claimed |
| Bounded load helper | **4 successful GETs, 0 errors**, duration 2s, workers 1, cap 2 RPS |
| Terraform 1.13.5 container `fmt -check` | **Passed** |
| Terraform `init -backend=false` | **Passed**, modules/providers downloaded; generated provider lockfile included |
| Terraform `validate` | **Success: configuration is valid** |
| Terraform provider locks | Signed provider checksums recorded for darwin_arm64, linux_amd64 and linux_arm64 |
| Grafana dashboard | JSON parsed; request/latency series names confirmed against live instrumentator output |
| Browser QA | Chrome displayed the connected dashboard with six tasks and correct KPI values; screenshot reviewed. Native automation later lost the window, so modal interactions and mobile viewport behavior are not claimed as browser-tested |

Commands requiring host networking/Docker/Kubernetes access were rerun with approved sandbox escalation when necessary. Early host DNS installation failures were resolved on retry. The final dependency sets, builds, tests and scans succeeded. PostgreSQL startup may briefly restart backend Pods before the DB accepts connections; migrations fail visibly and Kubernetes retries, then both replicas become ready.

## Reproduce

```bash
cd backend
source .venv/bin/activate
pytest -q
cd ../frontend
npm ci
npm run build
cd ..
docker compose config --quiet
docker compose up --build -d --wait
python3 scripts/smoke_test.py
helm lint helm/taskboard
helm template taskboard helm/taskboard -n taskboard
helm template taskboard helm/taskboard -n taskboard -f helm/taskboard/values-dev.yaml --set serviceMonitor.enabled=true
```

Terraform was validated in a disposable `hashicorp/terraform:1.13.5` container mounted to `terraform/`; this did not need AWS credentials. See terraform/README.md for the equivalent commands. Image scans used `--scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1`. Scanner results depend on the current vulnerability database and image/dependency versions; they are observations, not a permanent security guarantee.

## External execution still pending

GitHub-hosted Actions and GHCR publication; AWS account plan/apply, EKS and OIDC configuration; an Ingress controller and DNS/TLS; Metrics Server and observed CPU scaling; Prometheus Operator/kube-prometheus-stack, ServiceMonitor discovery and live Grafana display; live troubleshooting lab exercise. No AWS apply/destroy was run. Local Kubernetes validation used the existing **Minikube** context, not AWS.

Compose remains available on localhost:3000/8000. The local Minikube TaskBoard release is also installed in its own namespace; use root README port-forward commands (choose alternate host ports while Compose runs). Stop or uninstall using the documented cleanup steps when finished.
