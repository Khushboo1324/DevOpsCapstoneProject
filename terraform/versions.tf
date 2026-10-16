terraform {
  required_version = ">= 1.5.7, < 2.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}
provider "aws" {
  region = var.region
  default_tags {
    tags = { Project = "TaskBoard", Environment = "classroom", ManagedBy = "Terraform" }
  }
}
