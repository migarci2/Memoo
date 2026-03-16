output "artifact_registry_repository" {
  description = "Artifact Registry repository name."
  value       = google_artifact_registry_repository.containers.id
}

output "artifact_registry_host" {
  description = "Artifact Registry host for docker login."
  value       = "${var.region}-docker.pkg.dev"
}

output "api_service_url" {
  description = "Public Cloud Run URL for the API service."
  value       = google_cloud_run_v2_service.api.uri
}

output "agent_service_url" {
  description = "Public Cloud Run URL for the Stagehand agent service."
  value       = google_cloud_run_v2_service.agent.uri
}

output "api_public_base_url" {
  description = "Base URL for the API including the /api prefix."
  value       = "${google_cloud_run_v2_service.api.uri}/api"
}

output "web_service_url" {
  description = "Public Cloud Run URL for the web service."
  value       = google_cloud_run_v2_service.web.uri
}

output "sandbox_public_host" {
  description = "Public HTTPS host used by the sandbox reverse proxy."
  value       = local.sandbox_public_host
}

output "sandbox_public_url" {
  description = "noVNC URL consumed by the frontend."
  value       = local.sandbox_public_url
}

output "sandbox_public_ip" {
  description = "Reserved public IP for the sandbox VM."
  value       = google_compute_address.sandbox.address
}

output "sandbox_private_ip" {
  description = "Private IP used by the API service to reach the sandbox CDP port."
  value       = google_compute_instance.sandbox.network_interface[0].network_ip
}

output "evidence_bucket_name" {
  description = "GCS bucket for stored evidence artifacts."
  value       = google_storage_bucket.evidence.name
}

output "cloudsql_connection_name" {
  description = "Cloud SQL connection name used by Cloud Run."
  value       = google_sql_database_instance.main.connection_name
}

output "monthly_budget_name" {
  description = "Billing budget resource name, if enabled."
  value       = try(google_billing_budget.monthly[0].name, null)
}
