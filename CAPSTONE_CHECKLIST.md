# TaskBoard Capstone Completion Checklist

Checked items mean functioning implementation exists. Local execution and external execution are separated below; cloud deployment is not claimed.

## Application
- [x] React/Vite frontend using normal JSX and CSS
- [x] Responsive dark sidebar, branding, workspace/project navigation, header
- [x] KPI cards, task table, status filters, search, priority badges
- [x] Create/edit modal, delete action, recent task activity
- [x] Pipeline stages indicator without fabricated execution status
- [x] Loading, empty, backend-error and mutation feedback states
- [x] Relative `/api/tasks` and `/api/tasks/stats` browser requests
- [x] FastAPI backend with Pydantic validation and SQLAlchemy sessions
- [x] PostgreSQL runtime through environment-based DATABASE_URL
- [x] Task model with all eight requested fields and DB constraints
- [x] Alembic initial migration, upgrade/downgrade and environment configuration
- [x] Full CRUD API, correct 201/204/404/422 behavior
- [x] Stats API with total, todo, in_progress, done, high_priority
- [x] Root information and automatic Swagger `/docs`
- [x] Cheap `/health` liveness endpoint
- [x] `/ready` database query and 503 failure response
- [x] Prometheus instrumentator `/metrics`
- [x] Explicit idempotent demo seed; no duplicate rows on restart
- [x] Concurrent PostgreSQL migration/seed locking for backend replicas

## Engineering
- [x] Meaningful pytest suite: CRUD, filters, stats, validation, missing tasks, health/readiness, metrics, seed
- [x] Isolated per-test DB/session override; no running PostgreSQL required for pytest
- [x] Frontend production build and npm lockfile
- [x] Backend Dockerfile, Python 3.12, non-root UID, migrations before Uvicorn, failure propagation
- [x] Frontend multistage Node build / non-root Nginx runtime
- [x] SPA fallback and proxy headers; internal service hostnames confined to server configuration
- [x] Docker Compose PostgreSQL/backend/frontend, health ordering, private networking, DB volume
- [x] Loopback frontend 3000/backend 8000; no exposed DB port
- [x] .gitignore and per-image .dockerignore exclude generated files/secrets/state
- [x] Saved bounded smoke test and verification helper
- [x] Existing classroom README preserved in docs/CLASSROOM_GUIDE.md

## CI/CD
- [x] Pull request/main/manual triggers with restricted permissions
- [x] TEST job: pytest, frontend build, Helm render/lint, Terraform static validation, Compose config
- [x] Publication requires tests to pass
- [x] Separate frontend/backend GHCR image names
- [x] GITHUB_TOKEN registry authentication; no manual GHCR password
- [x] Both images built and scanned before either is pushed
- [x] Fixable HIGH/CRITICAL findings fail CI; unfixed policy documented
- [x] Exact Git commit SHA tags used for publication and deployment
- [x] Optional main-only deploy job, production environment and AWS OIDC
- [x] Explicit kubectl/Helm setup, EKS kubeconfig, atomic Helm deployment
- [x] Deployment variables and private-image pull requirements documented
- [x] Workflow passed actionlint locally

## Terraform
- [x] AWS provider, versions, variables, examples, outputs and reviewed provider lockfile
- [x] Default ap-south-1, pinned VPC/EKS modules
- [x] VPC, two AZs, public/private subnets, Internet/NAT routing and tags
- [x] EKS plus private AL2023 managed worker node group
- [x] Control-plane/node IAM via module, administrator bootstrap access
- [x] EBS CSI addon and scoped service-account IRSA role
- [x] Optional GitHub OIDC provider/reuse, repository/environment trust and namespace edit access
- [x] EKS endpoint restrictions configurable; kubeconfig output supplied
- [x] Init/plan/apply/destroy and cost/cleanup documentation
- [x] fmt, init -backend=false and validate passed using Terraform container

## Kubernetes
- [x] taskboard namespace bootstrap manifest
- [x] Frontend/backend Deployments and Services with consistent selectors
- [x] Configurable images/replicas/resources and rolling updates
- [x] Startup/liveness/readiness probes, DB-backed backend readiness
- [x] Non-root app/DB Pods, dropped capabilities, no service account token mounting
- [x] PostgreSQL StatefulSet, headless Service, persistent volume claim
- [x] Values-driven demo Secret / existing Secret support and ConfigMap
- [x] EKS gp3 StorageClass manifest and CSI integration instructions
- [x] PostgreSQL-in-Kubernetes versus managed RDS tradeoff documented
- [x] Namespace-scoped optional ServiceMonitor RBAC for CD
- [x] Local Minikube Helm deployment verified: five ready Pods, bound 5Gi PVC, service routing, six seed rows


## Helm
- [x] Chart.yaml, values.yaml, values-dev.yaml, helpers, templates, NOTES
- [x] Default install and development Ingress commands supported
- [x] Release-specific backend proxy target supplied to Nginx via ConfigMap
- [x] Lint and default/dev render passed
- [x] Default Kubernetes schema check: 9 valid resources
- [x] Dev + monitoring schema check: 10 valid resources; ServiceMonitor skipped by generic schema validator
- [x] Optional ServiceMonitor remains absent when Operator CRDs do not exist

## Ingress
- [x] Configurable host/class/annotations/TLS
- [x] Host taskboard.local: `/` frontend and `/api` backend, no path rewrite
- [x] Development render and Kubernetes client schema validation passed
- [x] Controller installation prerequisite and DNS/hosts configuration documented


## HPA
- [x] autoscaling/v2 backend CPU HPA, 2–5 replicas, 60% target, stabilization
- [x] Backend CPU request supports utilization calculations
- [x] Bounded GET load helper, duration/worker/RPS limits, stopping instructions
- [x] Local helper check: four successful requests, zero errors
- [x] HPA resource deployed in local Minikube
- [x] Metrics Server requirement and capacity/scale-out limitations documented

## Monitoring
- [x] Actual request count and latency sum/count series checked on running API
- [x] Configurable ServiceMonitor named Service port, selectors, interval and release label
- [x] Separate kube-prometheus-stack values with cross-namespace monitor discovery
- [x] Grafana import/sidecar-compatible dashboard JSON
- [x] HTTP rate/traffic, mean endpoint latency, 5xx, CPU, replica and HPA panels
- [x] Metric sources and missing-infrastructure-series behavior documented
- [x] Prometheus targets, Grafana access/import, generated password and cleanup instructions

## Troubleshooting
- [x] Isolated taskboard-lab namespace with deliberately nonexistent image tag
- [x] Separate lab workload and intentionally incorrect Service selector
- [x] Diagnose/fix commands, events, labels and EndpointSlice inspection documented
- [x] All lab/bootstrap manifests parsed and passed Kubernetes client dry-run schema checks

## Documentation and final demo
- [x] Root README covers architecture and complete local-to-cloud lifecycle
- [x] Direct backend/frontend, API, Docker, tests, Git and GHCR instructions
- [x] Terraform, Kubernetes, Helm, Ingress, HPA, monitoring, troubleshooting and cleanup
- [x] All GitHub variables and external bootstrap requirements listed without real credentials
- [x] Fifteen-step final demonstration sequence
- [x] docs/VALIDATION.md records actual outcomes and limitations
- [x] No terraform apply/destroy or AWS cloud deployment executed
