variable "region" {
  type    = string
  default = "ap-south-1"
}
variable "cluster_name" {
  type    = string
  default = "taskboard-capstone"
}
variable "kubernetes_version" {
  type    = string
  default = "1.35"
}
variable "public_access_cidrs" {
  description = "EKS public endpoint allowlist. Use your IP/32 and self-hosted CI egress CIDRs."
  type        = list(string)
  # Public HTTPS endpoint still requires AWS IAM authentication. Restrict before real use.
  default = ["0.0.0.0/0"]
}
variable "github_repository" {
  description = "Optional GitHub owner/repo; empty disables OIDC deploy role creation."
  type        = string
  default     = ""
  validation {
    condition     = var.github_repository == "" || can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "Use owner/repo or an empty string."
  }
}
variable "github_oidc_provider_arn" {
  description = "Existing token.actions.githubusercontent.com IAM provider ARN, if the account has one."
  type        = string
  default     = ""
}
variable "node_instance_types" {
  type    = list(string)
  default = ["t3.medium"]
}
