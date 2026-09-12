variable "project" {
  type    = string
  default = "dapup"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "aws_region" {
  type    = string
  default = "us-west-2"
}

# ---- Learning mode ----------------------------------------------------------
# One switch for every "destroy and re-apply must work cleanly" setting.
#   true  : secret deleted immediately (no recovery window), ECR repository
#           deleted even with images, bucket deleted even with objects, RDS
#           deleted without a final snapshot and without deletion protection.
#   false : production posture. 30-day secret recovery, refuse to delete a
#           non-empty registry or bucket, final snapshot + deletion protection.
variable "learning_mode" {
  description = "Relax deletion safeguards so `terraform destroy` succeeds while learning."
  type        = bool
  default     = true
}

# ---- Network ----------------------------------------------------------------
variable "vpc_cidr" {
  description = "Deliberately not 172.31.0.0/16 (the default VPC) so the two can be peered later."
  type        = string
  default     = "10.20.0.0/16"
}

variable "az_count" {
  description = "Availability zones to span. RDS subnet groups need at least 2."
  type        = number
  default     = 2
}

# ---- Database ---------------------------------------------------------------
variable "db_instance_class" {
  description = "Smallest class RDS offers for PostgreSQL."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_engine_version" {
  description = "Major version only; RDS applies minor upgrades in the maintenance window."
  type        = string
  default     = "18"
}

variable "db_allocated_storage_gb" {
  type    = number
  default = 20
}

variable "db_max_allocated_storage_gb" {
  description = "Storage autoscaling ceiling. 0 disables autoscaling."
  type        = number
  default     = 100
}

variable "db_name" {
  type    = string
  default = "dapup"
}

variable "db_username" {
  type    = string
  default = "dapup_admin"
}

variable "db_backup_retention_days" {
  type    = number
  default = 7
}

variable "db_client_security_group_ids" {
  description = <<-EOT
    Security groups allowed to reach PostgreSQL on 5432, besides the bastion.
    Empty today. The API's task security group is added here once the ECS
    service moves into this VPC.
  EOT
  type        = list(string)
  default     = []
}

# ---- Bastion ----------------------------------------------------------------
variable "bastion_enabled" {
  description = "Create the SSM-managed bastion. Set false to save about $7/month when not administering."
  type        = bool
  default     = true
}

variable "bastion_instance_type" {
  type    = string
  default = "t4g.nano"
}

# ---- Student files bucket ---------------------------------------------------
variable "upload_allowed_origins" {
  description = "Browser origins allowed to use presigned PUT/GET URLs directly against the bucket."
  type        = list(string)
  default     = ["https://www.dapup.space", "https://dapup.space"]
}
