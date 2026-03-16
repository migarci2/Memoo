variable "project_id" {
  description = "Google Cloud project ID."
  type        = string
}

variable "region" {
  description = "Primary GCP region."
  type        = string
  default     = "europe-west1"
}

variable "zone" {
  description = "Primary GCP zone for the sandbox VM."
  type        = string
  default     = "europe-west1-b"
}

variable "prefix" {
  description = "Resource name prefix."
  type        = string
  default     = "memoo"
}

variable "billing_account_id" {
  description = "Billing account ID used for budget alerts."
  type        = string
  default     = ""
}

variable "enable_budget" {
  description = "Whether to create a monthly billing budget with alert thresholds."
  type        = bool
  default     = false
}

variable "monthly_budget_amount_usd" {
  description = "Monthly budget amount in USD for cost alerts."
  type        = number
  default     = 80
}

variable "labels" {
  description = "Common labels applied to supported resources."
  type        = map(string)
  default     = {}
}

variable "api_image" {
  description = "Full Artifact Registry image reference for the API service."
  type        = string
}

variable "web_image" {
  description = "Full Artifact Registry image reference for the web service."
  type        = string
}

variable "sandbox_image" {
  description = "Full Artifact Registry image reference for the sandbox VM container."
  type        = string
}

variable "db_name" {
  description = "Cloud SQL database name."
  type        = string
  default     = "memoo"
}

variable "db_version" {
  description = "Cloud SQL PostgreSQL version."
  type        = string
  default     = "POSTGRES_16"
}

variable "db_user" {
  description = "Cloud SQL application user."
  type        = string
  default     = "memoo"
}

variable "db_tier" {
  description = "Cloud SQL machine tier."
  type        = string
  default     = "db-g1-small"
}

variable "db_disk_size_gb" {
  description = "Cloud SQL disk size."
  type        = number
  default     = 10
}

variable "db_disk_type" {
  description = "Cloud SQL disk type."
  type        = string
  default     = "PD_HDD"
}

variable "db_deletion_protection" {
  description = "Whether the Cloud SQL instance should be deletion protected."
  type        = bool
  default     = true
}

variable "storage_location" {
  description = "Location for the evidence bucket."
  type        = string
  default     = "EU"
}

variable "evidence_bucket_public" {
  description = "Expose uploaded objects publicly."
  type        = bool
  default     = false
}

variable "google_api_key" {
  description = "Gemini API key consumed by the backend."
  type        = string
  sensitive   = true
  default     = ""
}

variable "next_public_gemini_api_key" {
  description = "Gemini API key exposed to the web client. Defaults to google_api_key."
  type        = string
  sensitive   = true
  default     = ""
}

variable "gemini_model" {
  description = "Backend Gemini model."
  type        = string
  default     = "gemini-2.5-flash"
}

variable "next_public_gemini_live_model" {
  description = "Gemini Live model exposed to the web client."
  type        = string
  default     = "gemini-2.5-flash-native-audio-preview-12-2025"
}

variable "api_cors_origins" {
  description = "Allowed origins for API CORS. Browser traffic normally goes through the Next.js proxy."
  type        = list(string)
  default     = ["http://localhost:3000"]
}

variable "network_cidr" {
  description = "Primary subnet CIDR."
  type        = string
  default     = "10.10.0.0/24"
}

variable "vpc_connector_cidr" {
  description = "CIDR reserved for the Serverless VPC Access connector."
  type        = string
  default     = "10.10.1.0/28"
}

variable "sandbox_machine_type" {
  description = "Machine type for the sandbox VM."
  type        = string
  default     = "e2-medium"
}

variable "sandbox_boot_disk_size_gb" {
  description = "Boot disk size for the sandbox VM."
  type        = number
  default     = 20
}

variable "sandbox_resolution" {
  description = "Resolution passed to the sandbox container."
  type        = string
  default     = "1440x900x24"
}

variable "sandbox_domain" {
  description = "Optional custom domain for the sandbox. If empty, Terraform uses sslip.io on the reserved IP."
  type        = string
  default     = ""
}

variable "sandbox_ingress_cidrs" {
  description = "CIDR blocks allowed to reach the sandbox HTTPS endpoint."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "sandbox_ssh_cidrs" {
  description = "CIDR blocks allowed to SSH into the sandbox VM."
  type        = list(string)
  default     = []
}

variable "api_cpu" {
  description = "CPU allocation for the API Cloud Run service."
  type        = string
  default     = "1"
}

variable "api_memory" {
  description = "Memory allocation for the API Cloud Run service."
  type        = string
  default     = "1Gi"
}

variable "api_max_instances" {
  description = "Maximum instance count for the API Cloud Run service."
  type        = number
  default     = 2
}

variable "web_cpu" {
  description = "CPU allocation for the web Cloud Run service."
  type        = string
  default     = "1"
}

variable "web_memory" {
  description = "Memory allocation for the web Cloud Run service."
  type        = string
  default     = "512Mi"
}

variable "web_max_instances" {
  description = "Maximum instance count for the web Cloud Run service."
  type        = number
  default     = 2
}

variable "vpc_connector_machine_type" {
  description = "Machine type for the Serverless VPC Access connector."
  type        = string
  default     = "e2-micro"
}

variable "vpc_connector_min_instances" {
  description = "Minimum number of connector instances."
  type        = number
  default     = 2
}

variable "vpc_connector_max_instances" {
  description = "Maximum number of connector instances."
  type        = number
  default     = 3
}
