data "aws_availability_zones" "available" {
  state = "available"
}
data "aws_partition" "current" {}
locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 2)
}
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "6.0.1"

  name                 = var.cluster_name
  cidr                 = "10.42.0.0/16"
  azs                  = local.azs
  public_subnets       = ["10.42.0.0/24", "10.42.1.0/24"]
  private_subnets      = ["10.42.10.0/24", "10.42.11.0/24"]
  enable_nat_gateway   = true
  single_nat_gateway   = true
  enable_dns_hostnames = true
  public_subnet_tags   = { "kubernetes.io/role/elb" = "1" }
  private_subnet_tags  = { "kubernetes.io/role/internal-elb" = "1" }
}
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "21.25.0"

  name                                     = var.cluster_name
  kubernetes_version                       = var.kubernetes_version
  endpoint_public_access                   = true
  endpoint_private_access                  = true
  endpoint_public_access_cidrs             = var.public_access_cidrs
  enable_cluster_creator_admin_permissions = true
  vpc_id                                   = module.vpc.vpc_id
  subnet_ids                               = module.vpc.private_subnets
  enable_irsa                              = true
  cloudwatch_log_group_retention_in_days   = 7
  addons = {
    vpc-cni            = { before_compute = true }
    kube-proxy         = {}
    coredns            = {}
    aws-ebs-csi-driver = { service_account_role_arn = aws_iam_role.ebs.arn }
  }
  eks_managed_node_groups = {
    classroom = {
      ami_type       = "AL2023_x86_64_STANDARD"
      instance_types = var.node_instance_types
      min_size       = 2
      max_size       = 3
      desired_size   = 2
      disk_size      = 20
    }
  }
  access_entries = var.github_repository == "" ? {} : {
    github_deploy = {
      principal_arn     = aws_iam_role.github[0].arn
      kubernetes_groups = ["taskboard-deploy"]
      policy_associations = {
        taskboard = {
          policy_arn   = "arn:${data.aws_partition.current.partition}:eks::aws:cluster-access-policy/AmazonEKSEditPolicy"
          access_scope = { type = "namespace", namespaces = ["taskboard"] }
        }
      }
    }
  }
}
# The EKS module manages control-plane and node IAM roles. EBS uses IRSA.
resource "aws_iam_role" "ebs" {
  name = "${var.cluster_name}-ebs-csi"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = module.eks.oidc_provider_arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${replace(module.eks.cluster_oidc_issuer_url, "https://", "")}:sub" = "system:serviceaccount:kube-system:ebs-csi-controller-sa"
          "${replace(module.eks.cluster_oidc_issuer_url, "https://", "")}:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })
}
resource "aws_iam_role_policy_attachment" "ebs" {
  role       = aws_iam_role.ebs.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
}
# OIDC is account-wide. Reuse the ARN if another repository already created it.
resource "aws_iam_openid_connect_provider" "github" {
  count          = var.github_repository != "" && var.github_oidc_provider_arn == "" ? 1 : 0
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}
resource "aws_iam_role" "github" {
  count = var.github_repository == "" ? 0 : 1
  name  = "${var.cluster_name}-github-deploy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = var.github_oidc_provider_arn != "" ? var.github_oidc_provider_arn : aws_iam_openid_connect_provider.github[0].arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = { StringEquals = {
        "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:environment:production"
      } }
    }]
  })
}
resource "aws_iam_role_policy" "github" {
  count = var.github_repository == "" ? 0 : 1
  role  = aws_iam_role.github[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["eks:DescribeCluster"]
      Resource = module.eks.cluster_arn
    }]
  })
}
