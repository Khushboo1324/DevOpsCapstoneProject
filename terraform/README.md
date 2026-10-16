# TaskBoard infrastructure

Run the root README Terraform section. Defaults: ap-south-1, Kubernetes 1.35, two private AL2023 t3.medium managed nodes, two AZs, one NAT gateway. This is a paid classroom cluster, not a free-tier promise.

```bash
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform fmt -check
terraform validate
terraform plan
# Explicit user action only:
terraform apply
terraform output -raw configure_kubectl
```

IAM roles: VPC/EKS modules create control plane and managed-node roles; the EBS CSI service-account IRSA role attaches AWS's EBS CSI managed policy. Optional GitHub OIDC role trusts only your repository's `production` environment, can describe only this cluster, and has namespace-scoped EKS edit access. `k8s/deploy-rbac.yaml` grants that group access to the optional ServiceMonitor CR. Configure GitHub protected main/environment branch policies.

EBS CSI installs through EKS addons. Apply `k8s/storageclass-eks.yaml` after cluster creation and set `postgres.storageClass=taskboard-gp3`. Node groups live in private subnets; NAT permits image pulls. Default public API endpoint is IAM authenticated; restrict `public_access_cidrs` for your runner arrangement. Control-plane logs have seven-day retention. AL2023 avoids deprecated AL2 images.

For safe local static validation without a Terraform binary:

```bash
docker run --rm -v "$PWD:/workspace" -w /workspace hashicorp/terraform:1.13.5 init -backend=false
docker run --rm -v "$PWD:/workspace" -w /workspace hashicorp/terraform:1.13.5 validate
```

The provider lockfile includes reviewed provider selections and checksums. To refresh cross-platform checksums use `terraform providers lock -platform=darwin_arm64 -platform=linux_amd64 -platform=linux_arm64`. State, tfvars, plans, caches are ignored. For real collaboration configure an encrypted remote backend; do not share local state via Git.

Cleanup requires deleting Helm/controller-created load balancers and classroom PVCs before `terraform destroy`. Inspect the destroy plan, preserve backups, and check for retained EBS resources. No apply or destroy is ever executed automatically.

References: [EKS module inputs](https://github.com/terraform-aws-modules/terraform-aws-eks/tree/v21.25.0), [VPC module](https://github.com/terraform-aws-modules/terraform-aws-vpc/tree/v6.0.1), [EKS platform versions](https://docs.aws.amazon.com/eks/latest/userguide/platform-versions.html).
