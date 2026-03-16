locals {
  api_public_base_url = "${google_cloud_run_v2_service.api.uri}/api"
}

resource "google_cloud_run_v2_service" "agent" {
  name     = local.agent_service_name
  project  = var.project_id
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.agent.email
    timeout         = "300s"

    scaling {
      min_instance_count = 0
      max_instance_count = var.agent_max_instances
    }

    vpc_access {
      connector = google_vpc_access_connector.serverless.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = var.agent_image

      ports {
        container_port = 8787
      }

      resources {
        limits = {
          cpu    = var.agent_cpu
          memory = var.agent_memory
        }
      }

      env {
        name = "GOOGLE_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.google_api_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "GEMINI_MODEL"
        value = var.gemini_model
      }

      env {
        name  = "STAGEHAND_MODEL"
        value = local.effective_stagehand_model
      }
    }
  }

  labels = local.common_labels

  depends_on = [
    google_project_iam_member.agent_secret_accessor,
    google_secret_manager_secret_version.google_api_key,
  ]
}

resource "google_cloud_run_v2_service" "api" {
  name     = local.api_service_name
  project  = var.project_id
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.api.email
    timeout         = "300s"

    scaling {
      min_instance_count = 0
      max_instance_count = var.api_max_instances
    }

    vpc_access {
      connector = google_vpc_access_connector.serverless.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    volumes {
      name = "cloudsql"

      cloud_sql_instance {
        instances = [google_sql_database_instance.main.connection_name]
      }
    }

    containers {
      image = var.api_image

      ports {
        container_port = 8000
      }

      resources {
        limits = {
          cpu    = var.api_cpu
          memory = var.api_memory
        }
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      env {
        name  = "APP_ENV"
        value = "production"
      }

      env {
        name  = "APP_DEBUG"
        value = "false"
      }

      env {
        name  = "DB_NAME"
        value = var.db_name
      }

      env {
        name  = "DB_USER"
        value = var.db_user
      }

      env {
        name  = "DB_CLOUDSQL_INSTANCE"
        value = google_sql_database_instance.main.connection_name
      }

      env {
        name = "DB_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_password.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "CORS_ORIGINS"
        value = join(",", var.api_cors_origins)
      }

      env {
        name  = "STORAGE_BACKEND"
        value = "gcs"
      }

      env {
        name  = "STORAGE_BUCKET"
        value = google_storage_bucket.evidence.name
      }

      env {
        name  = "STORAGE_PUBLIC_URL"
        value = var.evidence_bucket_public ? local.storage_public_url : ""
      }

      env {
        name  = "GCS_PROJECT_ID"
        value = var.project_id
      }

      env {
        name = "GOOGLE_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.google_api_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "GEMINI_MODEL"
        value = var.gemini_model
      }

      env {
        name  = "STAGEHAND_ENABLED"
        value = "true"
      }

      env {
        name  = "STAGEHAND_SERVICE_URL"
        value = google_cloud_run_v2_service.agent.uri
      }

      env {
        name  = "STAGEHAND_MODEL"
        value = local.effective_stagehand_model
      }

      env {
        name  = "SANDBOX_CDP_URL"
        value = "http://${google_compute_instance.sandbox.network_interface[0].network_ip}:9223"
      }
    }
  }

  labels = local.common_labels

  depends_on = [
    google_project_iam_member.api_cloudsql_client,
    google_project_iam_member.api_secret_accessor,
    google_storage_bucket_iam_member.api_object_admin,
    google_service_account_iam_member.api_token_creator,
    google_secret_manager_secret_version.db_password,
    google_secret_manager_secret_version.google_api_key,
    google_cloud_run_v2_service.agent,
    google_compute_instance.sandbox,
  ]
}

resource "google_cloud_run_v2_service" "web" {
  name     = local.web_service_name
  project  = var.project_id
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.web.email
    timeout         = "300s"

    scaling {
      min_instance_count = 0
      max_instance_count = var.web_max_instances
    }

    containers {
      image = var.web_image

      ports {
        container_port = 3000
      }

      resources {
        limits = {
          cpu    = var.web_cpu
          memory = var.web_memory
        }
      }

      env {
        name  = "API_BASE_URL_INTERNAL"
        value = local.api_public_base_url
      }

      env {
        name  = "NEXT_PUBLIC_API_BASE_URL"
        value = "/api/proxy"
      }

      env {
        name  = "NEXT_PUBLIC_API_PUBLIC_BASE_URL"
        value = local.api_public_base_url
      }

      env {
        name  = "NEXT_PUBLIC_SANDBOX_NOVNC_URL"
        value = local.sandbox_public_url
      }

      env {
        name  = "NEXT_PUBLIC_GEMINI_API_KEY"
        value = local.public_gemini_api_key
      }

      env {
        name  = "NEXT_PUBLIC_GEMINI_LIVE_MODEL"
        value = var.next_public_gemini_live_model
      }
    }
  }

  labels = local.common_labels

  depends_on = [
    google_cloud_run_v2_service.api,
    google_compute_instance.sandbox,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "api_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "agent_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.agent.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "web_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.web.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
