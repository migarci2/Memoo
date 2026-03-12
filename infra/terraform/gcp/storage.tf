resource "google_storage_bucket" "evidence" {
  name                        = local.storage_bucket_name
  project                     = var.project_id
  location                    = var.storage_location
  uniform_bucket_level_access = true
  force_destroy               = false

  versioning {
    enabled = true
  }

  labels = local.common_labels

  depends_on = [google_project_service.required]
}

resource "google_storage_bucket_iam_member" "public_reader" {
  count  = var.evidence_bucket_public ? 1 : 0
  bucket = google_storage_bucket.evidence.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

resource "google_storage_bucket_iam_member" "api_object_admin" {
  bucket = google_storage_bucket.evidence.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.api.email}"
}
