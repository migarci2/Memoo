locals {
  name_prefix = lower(replace(var.prefix, "_", "-"))

  common_labels = merge(
    {
      app         = local.name_prefix
      managed_by  = "terraform"
      environment = "prod"
    },
    var.labels,
  )

  api_service_name      = "${local.name_prefix}-api"
  web_service_name      = "${local.name_prefix}-web"
  sandbox_instance      = "${local.name_prefix}-sandbox"
  artifact_repo_name    = "${local.name_prefix}-containers"
  storage_bucket_name   = "${local.name_prefix}-${var.project_id}-evidence"
  storage_public_url    = "https://storage.googleapis.com/${local.storage_bucket_name}"
  sandbox_public_host   = trimspace(var.sandbox_domain) != "" ? trimspace(var.sandbox_domain) : "${google_compute_address.sandbox.address}.sslip.io"
  sandbox_public_url    = "https://${local.sandbox_public_host}/vnc.html?autoconnect=true&resize=scale&reconnect=true&show_dot=false"
  public_gemini_api_key = trimspace(var.next_public_gemini_api_key) != "" ? var.next_public_gemini_api_key : var.google_api_key
}
