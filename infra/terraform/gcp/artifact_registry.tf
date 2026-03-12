resource "google_artifact_registry_repository" "containers" {
  project       = var.project_id
  location      = var.region
  repository_id = local.artifact_repo_name
  description   = "Container images for ${local.name_prefix}"
  format        = "DOCKER"

  labels = local.common_labels

  depends_on = [google_project_service.required]
}
