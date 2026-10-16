output "cluster_name" {
  value = module.eks.cluster_name
}
output "cluster_endpoint" {
  value = module.eks.cluster_endpoint
}
output "vpc_id" {
  value = module.vpc.vpc_id
}
output "configure_kubectl" {
  value = "aws eks update-kubeconfig --region ${var.region} --name ${module.eks.cluster_name}"
}
output "github_deploy_role_arn" {
  value = try(aws_iam_role.github[0].arn, null)
}
