data "google_compute_image" "debian" {
  family  = "debian-12"
  project = "debian-cloud"
}

resource "google_compute_address" "sandbox" {
  name    = "${local.name_prefix}-sandbox-ip"
  project = var.project_id
  region  = var.region
}

resource "google_compute_firewall" "sandbox_https" {
  name    = "${local.name_prefix}-sandbox-https"
  project = var.project_id
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = var.sandbox_ingress_cidrs
  target_tags   = ["${local.name_prefix}-sandbox"]
}

resource "google_compute_firewall" "sandbox_cdp" {
  name    = "${local.name_prefix}-sandbox-cdp"
  project = var.project_id
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["9223"]
  }

  source_ranges = [var.network_cidr, var.vpc_connector_cidr]
  target_tags   = ["${local.name_prefix}-sandbox"]
}

resource "google_compute_firewall" "sandbox_ssh" {
  count   = length(var.sandbox_ssh_cidrs) > 0 ? 1 : 0
  name    = "${local.name_prefix}-sandbox-ssh"
  project = var.project_id
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = var.sandbox_ssh_cidrs
  target_tags   = ["${local.name_prefix}-sandbox"]
}

resource "google_compute_instance" "sandbox" {
  name         = local.sandbox_instance
  project      = var.project_id
  zone         = var.zone
  machine_type = var.sandbox_machine_type
  tags         = ["${local.name_prefix}-sandbox"]

  boot_disk {
    initialize_params {
      image = data.google_compute_image.debian.self_link
      size  = var.sandbox_boot_disk_size_gb
      type  = "pd-balanced"
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.main.id

    access_config {
      nat_ip = google_compute_address.sandbox.address
    }
  }

  metadata_startup_script = templatefile("${path.module}/templates/sandbox-startup.sh.tftpl", {
    artifact_registry_host = "${var.region}-docker.pkg.dev"
    image                  = var.sandbox_image
    public_host            = local.sandbox_public_host
    resolution             = var.sandbox_resolution
  })

  service_account {
    email  = google_service_account.sandbox.email
    scopes = ["cloud-platform"]
  }

  labels = local.common_labels

  depends_on = [
    google_project_iam_member.sandbox_artifact_reader,
    google_project_iam_member.sandbox_logging_writer,
    google_project_iam_member.sandbox_metrics_writer,
    google_artifact_registry_repository.containers,
  ]
}
