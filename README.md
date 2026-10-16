# TaskBoard — DevOps Final Capstone

A complete React/Vite + FastAPI + PostgreSQL project that takes a task from a local dashboard to a tested, scanned, monitored Kubernetes release. The original classroom narrative is preserved in [docs/CLASSROOM_GUIDE.md](docs/CLASSROOM_GUIDE.md). Start here for commands that match the implementation.

## Architecture

```mermaid
flowchart LR
  Developer --> GitHub --> Actions[GitHub Actions]
  Actions --> Tests[pytest + React build + Helm checks]
  Tests --> Images[Docker images]
  Images --> Trivy[Trivy HIGH/CRITICAL gate]
  Trivy --> GHCR[GHCR commit SHA tags]
  Terraform --> VPC[AWS VPC + private managed nodes]
  VPC --> EKS
  GHCR --> Helm --> EKS
  EKS --> Ingress[Ingress controller]
  Ingress --> React[React / Nginx]
  Ingress --> API[FastAPI]
  React --> API --> PostgreSQL[(PostgreSQL PVC)]
  API --> Prometheus --> Grafana
```

Terraform provisions infrastructure separately before CD is enabled. CI never runs Terraform apply. The chart deploys frontend/backend Deployments and Services, PostgreSQL StatefulSet and persistent volume, Secret/ConfigMap, backend HPA, optional Ingress and optional ServiceMonitor. The browser uses `/api/tasks` and `/api/tasks/stats`; Nginx or Ingress routes these to the backend. The pipeline indicator explains stages; actual run status is in GitHub Actions.

| Directory | Responsibility |
|---|---|
| `frontend/` | Responsive JSX dashboard, CRUD modal, filters, KPI cards, activity, loading/error/empty states |
| `backend/app/` | Validated FastAPI API, SQLAlchemy sessions, explicit demo seed |
| `backend/alembic/` | Deterministic schema migrations |
| `backend/tests/` | Isolated SQLite tests; actual runtime uses PostgreSQL |
| `.github/workflows/` | Tests → build both images → scan both → publish → optional deploy |
| `terraform/` | VPC, two public/private subnet pairs, one NAT gateway, EKS, managed nodes, EBS CSI, IAM/OIDC |
| `helm/taskboard/` | Configurable Kubernetes application package |
| `k8s/` | Namespace, EKS storage class, optional CD RBAC bootstrap |
| `monitoring/` | Prometheus/Grafana stack values and dashboard JSON |
| `scripts/` | Verification and bounded read-only load generator |
| `troubleshooting/` | Isolated deliberate image and Service failures |

## Prerequisites

For Compose: Docker Engine/Desktop with Docker Compose. For direct development: Python 3.12+, Node 22+ and npm, PostgreSQL 17. Kubernetes work needs kubectl, Helm 3, a cluster with a dynamic StorageClass, an Ingress controller for Ingress, and Metrics Server for HPA. AWS work needs Terraform >=1.5.7, AWS CLI v2, AWS credentials with provisioning permissions, and an AWS account. EKS, NAT, nodes, load balancers, and volumes incur charges until cleaned up.

## Run the full stack locally

```bash
docker compose up --build
```

- Dashboard: http://localhost:3000
- Swagger: http://localhost:8000/docs
- Liveness: http://localhost:8000/health
- DB readiness: http://localhost:8000/ready
- Prometheus metrics: http://localhost:8000/metrics

Only frontend 3000 and backend 8000 bind to host loopback; PostgreSQL stays on the internal Compose network. The database persists in `postgres-data`. Demo credentials are `taskboard/taskboard`, database `taskboard`; these are classroom defaults. Optional root `.env` (ignored by Git): `POSTGRES_PASSWORD=...` and `SEED_DEMO=false`. Use URL-safe DB credentials in Compose/Helm because the connection string interpolates them; for arbitrary passwords percent-encode the password in a directly supplied DATABASE_URL. Changing environment variables does not rotate the password of an existing PostgreSQL volume.

Backend startup runs `alembic upgrade head`, optionally seeds, then executes Uvicorn as a non-root user. PostgreSQL advisory locks serialize concurrent migration and seed execution. A database seed marker ensures the six demo tasks are inserted once even if tasks are later edited/deleted. Schema creation is never hidden in FastAPI startup; failures stop container startup.

```bash
# Show the actual table and migration version.
docker compose exec postgres psql -U taskboard -d taskboard -c 'SELECT id,title,status,priority FROM tasks;'
docker compose exec postgres psql -U taskboard -d taskboard -c 'SELECT * FROM alembic_version;'
# Stop; preserve data.
docker compose down
# Reset ALL demo DB data (optional).
docker compose down -v
```

## Direct development

With PostgreSQL reachable on localhost:5432:

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL='postgresql+psycopg://taskboard:taskboard@localhost:5432/taskboard'
alembic upgrade head
python -m app.seed  # optional, idempotent
uvicorn app.main:app --reload --port 8000
```

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Vite listens on 3000 and proxies relative `/api` requests to localhost:8000. Stop the Compose frontend first to free port 3000. The Compose database has no host port; use your own local PostgreSQL or an explicit temporary development port mapping.

## API contract

| Method | Path | Result |
|---|---|---|
| GET | `/` | Application information |
| GET | `/health` | Cheap process liveness, no DB dependency |
| GET | `/ready` | Executes `SELECT 1`; returns 503 on DB failure |
| GET | `/metrics` | Prometheus instrumentator metrics |
| GET | `/api/tasks` | Tasks newest first; optional `status` and `priority` filters |
| GET | `/api/tasks/stats` | `total`, `todo`, `in_progress`, `done`, `high_priority` |
| GET | `/api/tasks/{id}` | One task, or 404 |
| POST | `/api/tasks` | Validated task; returns 201 |
| PUT | `/api/tasks/{id}` | Full replacement of editable fields; 404 if absent |
| DELETE | `/api/tasks/{id}` | Delete; returns 204 or 404 |

Statuses: `Todo`, `In Progress`, `Done`. Priorities: `Low`, `Medium`, `High`. Title is required; description defaults to empty, assignee to `Unassigned`, status to `Todo`, priority to `Medium`. IDs and timestamps are server controlled; invalid fields return 422. Activity reflects current tasks ordered by their last update; it is not a permanent audit log.

```bash
curl -X POST http://localhost:8000/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Ship the capstone","priority":"High","assignee":"Team"}'
```

This classroom app has no authentication. Keep the demo private; add application authentication, TLS, authorization, backups, and external secret management before a production deployment. PostgreSQL in Kubernetes teaches persistence; managed RDS is a more suitable production database choice and is deliberately outside this Terraform scope.

## Test and build

```bash
cd backend
source .venv/bin/activate
pytest -q
cd ../frontend
npm install
npm run build
cd ..
docker compose config --quiet
docker build -t taskboard-backend:local ./backend
docker build -t taskboard-frontend:local ./frontend
helm lint ./helm/taskboard
helm template taskboard ./helm/taskboard --namespace taskboard
helm template taskboard ./helm/taskboard --namespace taskboard -f helm/taskboard/values-dev.yaml
```

With the Compose stack already running, `python3 scripts/smoke_test.py` checks real PostgreSQL CRUD through the Nginx proxy and removes its own test task.

Tests use a fresh in-memory SQLite engine/session override per test. No production PostgreSQL is required. They exercise CRUD, validation, 404s, filters, empty/populated stats, metrics, Swagger, ready success/failure, and seed idempotency. The runtime, Compose, and Kubernetes use PostgreSQL. `scripts/verify.sh` combines checks when dependencies/tooling are available; activate the backend virtualenv first.

## Git and CI/CD

This starting directory was not a Git checkout. Initialize it and create your own remote:

```bash
git init
git add .
git commit -m "Build TaskBoard DevOps capstone"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Pull requests run tests/build/Helm rendering and Terraform static validation, and never publish or deploy. Pushes to main and manual runs on main proceed to publication after tests pass. Publication uses GitHub-native `GITHUB_TOKEN` and `packages: write`; no manual GHCR password is needed. Both images are built locally, both scanned, then both pushed. A failed scan prevents publication. Tags are the **exact commit SHA**:

```text
ghcr.io/<lowercase-owner>/<lowercase-repo>-backend:<commit-sha>
ghcr.io/<lowercase-owner>/<lowercase-repo>-frontend:<commit-sha>
```

Trivy scans the runtime container filesystem for fixable HIGH/CRITICAL OS/library vulnerabilities and fails CI on findings. Unfixed vulnerabilities are excluded from the gate (`ignore-unfixed: true`), not proof of absence; inspect scanner output and refresh base images/dependencies regularly. This container scan differs from source-level SAST, dependency-only scanning, secret scanning, and runtime protection. No blanket CVE suppression file is included. Node build tooling is absent from the final frontend image.

Deploy is disabled until repository variable `ENABLE_DEPLOY=true`. The deploy job uses the `production` GitHub Environment and AWS OIDC, configures EKS kubectl, then runs `helm upgrade --install --atomic --wait` using both SHA-tagged images. Failed readiness rolls back Helm. Review/approval rules can be enabled on the GitHub Environment. Protect main and restrict the production environment's deployment branches to main.

| GitHub variable | Required value |
|---|---|
| `ENABLE_DEPLOY` | `true` only after cluster bootstrap and images are pullable |
| `AWS_ROLE_ARN` | Terraform `github_deploy_role_arn` output |
| `AWS_REGION` | `ap-south-1` by default |
| `EKS_CLUSTER_NAME` | Terraform cluster name output |
| `TASKBOARD_HOST` | Ingress DNS name; default `taskboard.local` |
| `INGRESS_CLASS` | Installed controller's class; default `nginx` |
| `ENABLE_MONITORING` | `true` after Prometheus Operator CRDs and CD ServiceMonitor RBAC exist; default `false` |

No AWS access-key secrets are required. The OIDC trust is restricted to your owner/repo and the `production` environment; AWS permissions only allow describing this EKS cluster, while its access entry permits namespace-scoped Kubernetes edits. Bootstrap the namespace/Secret/StorageClass/controller as the Terraform administrator. The deploy role cannot create namespaces or cluster-scoped prerequisites.

For the simplest classroom GHCR pull experience, set both packages' visibility to **public**. Private images require a Kubernetes pull Secret with a GitHub credential permitted to read packages, configured through `imagePullSecrets` in a local values override; never commit the credential. The workflow's publish token is not automatically available to Kubernetes nodes.

## Terraform: AWS VPC and EKS

Terraform is complete infrastructure code, but no AWS apply/destroy is performed by this project or CI.

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit github_repository and public_access_cidrs for your environment.
terraform fmt -check
terraform init
terraform validate
terraform plan
terraform apply  # YOU run this after reviewing the plan and cost
terraform output -raw configure_kubectl
# Execute the command printed above to configure your kubectl.
cd ..
```

The pinned VPC/EKS modules manage Internet gateway, route tables, two public/private subnet pairs, a single NAT gateway, EKS control-plane/node IAM roles, AL2023 managed nodes in private subnets, and API access entries. EBS CSI uses a service-account-specific IAM role via IRSA. Two `t3.medium` nodes are a classroom starting point; a full Prometheus stack may need larger nodes. A max node-group size is a limit, not a cluster autoscaler; HPA scales Pods within available node capacity. Single NAT is cheaper but not highly available. Public EKS API defaults to all IPs with IAM authentication so hosted GitHub runners work; restrict the CIDRs and use a runner with stable/VPC egress for tighter network access. No node SSH port is opened.

Set `github_repository` before apply for optional OIDC role creation. If this AWS account already has GitHub's OIDC provider, set `github_oidc_provider_arn` to reuse it. The Terraform identity receives cluster-admin for bootstrap. State is ignored by Git; for a team use an encrypted, access-controlled remote state backend. Commit the generated `.terraform.lock.hcl` after reviewing it.

## Bootstrap Kubernetes and deploy Helm

Use a local cluster with the images loaded (for example `kind load docker-image taskboard-backend:local taskboard-frontend:local`) or override image repositories/tags with real registry images. Docker Desktop Kubernetes may need images loaded according to its image-store setup. Default chart images are intentionally local, not invented public GHCR packages.

```bash
kubectl apply -f k8s/namespace.yaml
helm upgrade --install taskboard ./helm/taskboard \
  --namespace taskboard --create-namespace
kubectl get pods,svc,pvc -n taskboard
helm list -n taskboard
kubectl port-forward -n taskboard svc/taskboard-frontend 3000:8080
# In another terminal, for Swagger/metrics:
kubectl port-forward -n taskboard svc/taskboard-backend 8000:8000
```

On EKS apply the included gp3 class; the EBS CSI add-on/IRSA are created by Terraform:

```bash
kubectl apply -f k8s/storageclass-eks.yaml
# Create a DB password Secret interactively without putting it in a file or shell history.
read -r -s DB_PASSWORD
printf '%s' "$DB_PASSWORD" | kubectl create secret generic taskboard-db \
  -n taskboard --from-file=password=/dev/stdin
unset DB_PASSWORD
# Only for CI ServiceMonitor creation with the namespace-scoped OIDC role:
kubectl apply -f k8s/deploy-rbac.yaml
```

Use a nonempty URL-safe password for this classroom chart. Keep the same Secret with the PVC across upgrades; changing the Secret alone does not change PostgreSQL's stored user password. External secret management is recommended for production. Default values contain openly labeled demo credentials only.

```bash
export IMAGE_PREFIX='ghcr.io/YOUR_LOWERCASE_OWNER/YOUR_LOWERCASE_REPO'
export IMAGE_TAG='YOUR_COMMIT_SHA'
helm upgrade --install taskboard ./helm/taskboard -n taskboard --create-namespace \
  -f helm/taskboard/values-dev.yaml \
  --set-string backend.image.repository="$IMAGE_PREFIX-backend" \
  --set-string frontend.image.repository="$IMAGE_PREFIX-frontend" \
  --set-string backend.image.tag="$IMAGE_TAG" \
  --set-string frontend.image.tag="$IMAGE_TAG" \
  --set-string postgres.existingSecret=taskboard-db \
  --set-string postgres.storageClass=taskboard-gp3 \
  --atomic --wait --timeout 10m
```

Use a private local values file for environment overrides. CPU/memory requests and limits exist for every component; frontend/backend use non-root users, dropped capabilities, no privilege escalation or service account token. PostgreSQL has one replica, persistent storage, and probes; it is not an HA database. StatefulSet PVCs survive Helm uninstall. Multiple backend replicas serialize migrations; migration errors remain visible in Pod logs. Future incompatible database migrations need an explicit rollout strategy because Helm rollback cannot reverse a schema migration automatically.

## Ingress

An Ingress resource does **not** install a controller. Install a maintained controller that implements Kubernetes Ingress and set `ingress.className` to its class. `nginx` is the development example class; verify your controller's maintenance/support status and installation documentation before using it. EKS additionally needs the chosen controller's AWS load balancer integration and IAM prerequisites; these are separate from the application chart.

```bash
helm upgrade --install taskboard ./helm/taskboard \
  -n taskboard -f helm/taskboard/values-dev.yaml
kubectl get ingress -n taskboard
```

Host `taskboard.local` with paths `/` → frontend and `/api` → backend is valid routing; the hostname is not part of the path. Add `CONTROLLER_IP taskboard.local` to your hosts file for local testing, or point real DNS at the controller's load balancer and override `ingress.host`. TLS is configurable via `ingress.tls`. Until DNS is configured, test with `curl -H 'Host: taskboard.local' http://CONTROLLER_ADDRESS/api/tasks`. Swagger is available through backend port-forward; the app Ingress intentionally routes only `/api` and the frontend.

## HPA and controlled load

Install Metrics Server using its official chart (omit if your cluster already provides it):

```bash
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/
helm repo update
helm upgrade --install metrics-server metrics-server/metrics-server -n kube-system
kubectl top pods -n taskboard
kubectl get hpa -n taskboard
```

The backend HPA targets 60% of the 100m CPU request, from 2 to 5 replicas. Watch in a second terminal:

```bash
kubectl get hpa,pods -n taskboard -w
```

Prefer load from inside the cluster through the backend Service so it spreads across replicas. Run this bounded Job-like Pod; it self-removes when finished:

```bash
kubectl run taskboard-load -n taskboard --rm -i --restart=Never \
  --image=python:3.12-slim \
  --overrides='{"spec":{"activeDeadlineSeconds":330}}' \
  --command -- python - --url http://taskboard-backend:8000/api/tasks --duration 300 --workers 24 --rps 300 \
  < scripts/load_test.py
```

Alternatively `python3 scripts/load_test.py --duration 120 --workers 12 --rps 120` against a backend port-forward or localhost. Ctrl+C stops the local script; `kubectl delete pod taskboard-load -n taskboard` stops the in-cluster run. Hard caps: 600 seconds, 32 workers, 500 RPS, 3-second request timeout; GET only. Empty/light responses may not exceed the CPU threshold; request the task list with demo data, increase within bounds, or temporarily lower the HPA CPU target in a demo values file. Scaling depends on measured CPU, Metrics Server, available node capacity, and stabilization windows; it is not guaranteed just because requests arrive. Port-forward attaches to one Pod and is less suitable for demonstrating balanced scale-out.

## Prometheus and Grafana

Install `kube-prometheus-stack` separately from the application. See [monitoring/README.md](monitoring/README.md) for full commands, dashboard import, metrics provenance and queries. ServiceMonitor is disabled by default so a base install works without Operator CRDs. Enable it after stack installation:

```bash
helm upgrade taskboard ./helm/taskboard -n taskboard --reuse-values \
  --set serviceMonitor.enabled=true --set serviceMonitor.labels.release=monitoring
```

The ServiceMonitor targets the backend Service's named `http` port at `/metrics`; its configurable release label must match Prometheus's selector. Instrumentation excludes health, readiness, and metrics requests, keeping traffic measurements useful. Grafana includes request rate, per-endpoint traffic/mean latency, 5xx errors, CPU, available replicas, HPA current/desired replicas. CPU requires kubelet/cAdvisor scraping; replica/HPA series require kube-state-metrics. These are supplied by the monitoring stack, not by FastAPI.

## Troubleshooting labs

Both exercises are isolated in `taskboard-lab`; they do not change TaskBoard workloads.

```bash
kubectl apply -f troubleshooting/broken-image.yaml
kubectl get pods -n taskboard-lab
kubectl describe pod -n taskboard-lab POD_NAME
kubectl get events -n taskboard-lab --sort-by=.lastTimestamp
# Fix the deliberately nonexistent tag:
kubectl set image deployment/broken-image -n taskboard-lab \
  web=nginxinc/nginx-unprivileged:stable-alpine
kubectl rollout status deployment/broken-image -n taskboard-lab
```

```bash
kubectl apply -f troubleshooting/broken-service.yaml
kubectl get svc -n taskboard-lab
kubectl get endpoints -n taskboard-lab
kubectl get endpointslices -n taskboard-lab
kubectl get pods -n taskboard-lab --show-labels
# The Service has exercise=service-lab-typo; Pods have exercise=service-lab.
kubectl patch service broken-service -n taskboard-lab \
  --type=merge -p '{"spec":{"selector":{"exercise":"service-lab"}}}'
kubectl get endpointslices -n taskboard-lab
kubectl port-forward -n taskboard-lab svc/broken-service 8081:80
# Open localhost:8081; stop port-forward with Ctrl+C.
```

For actual app problems: `kubectl logs -n taskboard deployment/taskboard-backend`, `kubectl describe pod`, inspect PVC binding, Secret references, image pull permissions, Service selectors, and `/ready`. `helm history taskboard -n taskboard` and `helm rollback taskboard REVISION -n taskboard` demonstrate release recovery (review database schema compatibility first).

## Final demonstration

1. Open the dashboard and create/edit/filter/delete a task.
2. Open `/docs` and exercise API CRUD; inspect the PostgreSQL `tasks` table with the Compose command above.
3. Change a UI label, commit, push to main, and show test/build results.
4. Show both Docker images, both Trivy scans, and both SHA-tagged GHCR packages.
5. Explain Terraform VPC/EKS modules and review `terraform plan` before applying yourself.
6. Configure EKS kubectl, bootstrap, then deploy the exact SHA via Helm/CD.
7. Show `kubectl get pods,svc -n taskboard` and `helm list -n taskboard`.
8. Open TaskBoard through Ingress with the configured host.
9. Watch HPA and generate bounded load; explain any CPU/capacity limits.
10. Show Prometheus targets and Grafana's traffic/latency/error/CPU/replica charts.
11. Diagnose and fix both isolated troubleshooting exercises.

## Cleanup

```bash
docker compose down        # retain local DB data
# Optional irreversible local demo-data reset:
docker compose down -v
kubectl delete namespace taskboard-lab
helm uninstall taskboard -n taskboard
# Back up first; only when intentionally discarding the classroom database:
kubectl delete pvc -n taskboard -l app.kubernetes.io/name=taskboard
helm uninstall monitoring -n monitoring
# Uninstall your Ingress/controller load balancer before VPC destruction.
# Delete its external load balancers and any retained volumes/snapshots if required.
cd terraform
terraform plan -destroy
terraform destroy         # YOU execute this after reviewing destruction
```

Check AWS for orphaned load balancers, EBS volumes/snapshots, NAT gateways, and EIPs. Do not delete account-shared GitHub OIDC infrastructure still used by other repositories. No cloud provisioning or destruction is automatically executed. See [CAPSTONE_CHECKLIST.md](CAPSTONE_CHECKLIST.md) and [docs/VALIDATION.md](docs/VALIDATION.md) for implementation and verification status.
