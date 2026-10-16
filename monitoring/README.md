# Monitoring TaskBoard

This stack is a separate infrastructure release, not an application dependency. Use a cluster-admin context for CRD installation. Size nodes for Prometheus/Grafana plus the application; the small EKS defaults may need more RAM.

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace \
  -f monitoring/kube-prometheus-stack-values.yaml --wait --timeout 15m
helm upgrade taskboard ./helm/taskboard -n taskboard --reuse-values \
  --set serviceMonitor.enabled=true --set serviceMonitor.labels.release=monitoring
kubectl get servicemonitor -n taskboard
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090
kubectl port-forward -n monitoring svc/monitoring-grafana 3001:80
```

Run port-forward commands in separate terminals. At localhost:9090/targets verify the TaskBoard backend targets are UP. Grafana is localhost:3001. Get the generated admin password locally (do not commit/share it):

```bash
kubectl get secret monitoring-grafana -n monitoring -o jsonpath='{.data.admin-password}' | base64 --decode
```

Login as `admin`. Import `monitoring/taskboard-dashboard.json` through Grafana Dashboards → New → Import; select the provisioned Prometheus data source. The JSON contains a Prometheus datasource variable, also usable with a sidecar ConfigMap:

```bash
kubectl create configmap taskboard-dashboard -n monitoring \
  --from-file=taskboard.json=monitoring/taskboard-dashboard.json \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl label configmap taskboard-dashboard -n monitoring grafana_dashboard=1 --overwrite
```

The stack values allow discovering ServiceMonitors across namespaces but select `release: monitoring`. Application chart values expose that label; adjust both sides together for another monitoring release. CRDs must exist before enabling ServiceMonitor. For namespace-scoped CI, bootstrap `k8s/deploy-rbac.yaml` as administrator.

Actual metrics, not simulated values:

| Source | Series / use |
|---|---|
| prometheus-fastapi-instrumentator | `http_requests_total{handler,method,status}` for requests and grouped 5xx statuses |
| instrumentator | `http_request_duration_seconds_sum/count{handler}` for mean endpoint latency |
| kubelet/cAdvisor via stack | `container_cpu_usage_seconds_total` for backend CPU cores |
| kube-state-metrics via stack | `kube_deployment_status_replicas_available` and HPA current/desired replicas |

Example: `sum(rate(http_requests_total{namespace="taskboard"}[5m]))`.
The ServiceMonitor attaches namespace/Pod labels. Histogram bucket granularity varies by instrumentation configuration; the dashboard uses mean latency from the provided sum/count series instead of inventing endpoint percentiles. It assumes release name `taskboard` and namespace `taskboard`; edit the deployment/HPA selectors for other names. Empty CPU/replica panels usually mean infrastructure metrics are not scraped. Empty HTTP panels need traffic and at least two scrapes. Health/readiness/metrics requests are excluded. Stack storage is ephemeral and retention is two days for the classroom; configure persistent storage and backups for durable monitoring.

Pin a reviewed kube-prometheus-stack version with `--version` in your environment when reproducing a presentation; CRD upgrade instructions belong to that chart. The application does not bundle or silently install it. Protect Grafana and Prometheus from public access.
