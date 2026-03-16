data "google_project" "current" {
  project_id = var.project_id
}

resource "google_billing_budget" "monthly" {
  count           = var.enable_budget && trimspace(var.billing_account_id) != "" ? 1 : 0
  billing_account = var.billing_account_id
  display_name    = "${local.name_prefix}-monthly-budget"

  budget_filter {
    projects = ["projects/${data.google_project.current.number}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(floor(var.monthly_budget_amount_usd))
    }
  }

  threshold_rules {
    threshold_percent = 0.5
  }

  threshold_rules {
    threshold_percent = 0.8
  }

  threshold_rules {
    threshold_percent = 1.0
  }

  depends_on = [google_project_service.required]
}
