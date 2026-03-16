resource "google_compute_network" "main" {
  name                    = "${local.name_prefix}-vpc"
  auto_create_subnetworks = false
  project                 = var.project_id

  depends_on = [google_project_service.required]
}

resource "google_compute_subnetwork" "main" {
  name                     = "${local.name_prefix}-subnet"
  project                  = var.project_id
  region                   = var.region
  network                  = google_compute_network.main.id
  ip_cidr_range            = var.network_cidr
  private_ip_google_access = true
}

resource "google_vpc_access_connector" "serverless" {
  name          = "${local.name_prefix}-serverless"
  project       = var.project_id
  region        = var.region
  network       = google_compute_network.main.name
  ip_cidr_range = var.vpc_connector_cidr
  machine_type  = var.vpc_connector_machine_type
  min_instances = var.vpc_connector_min_instances
  max_instances = var.vpc_connector_max_instances

  depends_on = [google_project_service.required]
}
