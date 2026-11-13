#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# YourMoneyOurMoney — Google Cloud Run & Cloud SQL Teardown Script
# ==============================================================================
# Usage:
#   ./deploy/teardown.sh
#
# Environment Variables (Optional):
#   PROJECT_ID   GCP Project ID (defaults to active gcloud config project)
#   REGION       GCP Region (default: asia-southeast1)
#   DRY_RUN      Set DRY_RUN=1 to print all gcloud commands without executing
#
# WHAT THIS SCRIPT DOES
#   Deletes everything deploy/deploy.sh created (Cloud Run service + job, Cloud
#   SQL, Artifact Registry, secrets, service account) to stop billing.
#
# ⚠️ DESTRUCTIVE: all Cloud SQL data is permanently lost. You must type the
#    project ID to confirm. Preview first with:  DRY_RUN=1 ./deploy/teardown.sh
#
# REFERENCES
#   - gcloud run services delete  : https://cloud.google.com/sdk/gcloud/reference/run/services/delete
#   - gcloud sql instances delete : https://cloud.google.com/sdk/gcloud/reference/sql/instances/delete
#   - gcloud secrets delete       : https://cloud.google.com/sdk/gcloud/reference/secrets/delete
# ==============================================================================

DRY_RUN="${DRY_RUN:-0}"
REGION="${REGION:-asia-southeast1}"

run_cmd() {
  if [ "$DRY_RUN" = "1" ]; then
    echo "[DRY_RUN] $*"
  else
    echo "+ $*"
    "$@"
  fi
}

if [ "$DRY_RUN" = "1" ]; then
  PROJECT_ID="${PROJECT_ID:-example-gcp-project}"
else
  PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
  if [ -z "$PROJECT_ID" ]; then
    echo "Error: PROJECT_ID is not set and no active gcloud project was found." >&2
    exit 1
  fi
fi

# ------------------------------------------------------------------------------
# Resource names (must match deploy/deploy.sh)
# ------------------------------------------------------------------------------
REPO_NAME="ymom"
SQL_INSTANCE="ymom-pg"
SERVICE_NAME="ymom"
MIGRATE_JOB_NAME="ymom-migrate"
SA_NAME="ymom-runner"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

SECRET_DB_URL="ymom-database-url"
SECRET_SESSION="ymom-session-secret"
SECRET_ADMIN_PASS="ymom-admin-password"
SECRET_DEMO_PASS="ymom-demo-password"

echo "=================================================================="
echo "WARNING: This will permanently delete YourMoneyOurMoney resources in:"
echo "  Project : ${PROJECT_ID}"
echo "  Region  : ${REGION}"
echo "Resources to be deleted:"
echo "  - Cloud Run Service : ${SERVICE_NAME}"
echo "  - Cloud Run Job     : ${MIGRATE_JOB_NAME}"
echo "  - Cloud SQL Instance: ${SQL_INSTANCE} (ALL DATABASE DATA WILL BE LOST)"
echo "  - Artifact Registry : ${REPO_NAME}"
echo "  - Secrets           : ${SECRET_DB_URL}, ${SECRET_SESSION}, ${SECRET_ADMIN_PASS}, ${SECRET_DEMO_PASS}"
echo "  - Service Account   : ${SA_EMAIL}"
echo "=================================================================="

# ------------------------------------------------------------------------------
# Safety confirmation (skipped only in DRY_RUN)
# ------------------------------------------------------------------------------
if [ "$DRY_RUN" != "1" ]; then
  read -r -p "Type the project ID (${PROJECT_ID}) to confirm deletion: " CONFIRM_PROJECT
  if [ "$CONFIRM_PROJECT" != "$PROJECT_ID" ]; then
    echo "Aborted: confirmation did not match ${PROJECT_ID}."
    exit 1
  fi
fi

# ------------------------------------------------------------------------------
# Delete resources (each `|| true` so one missing resource does not stop the rest)
# ------------------------------------------------------------------------------
run_cmd gcloud run services delete "$SERVICE_NAME" --region "$REGION" --project "$PROJECT_ID" --quiet || true
run_cmd gcloud run jobs delete "$MIGRATE_JOB_NAME" --region "$REGION" --project "$PROJECT_ID" --quiet || true
run_cmd gcloud sql instances delete "$SQL_INSTANCE" --project "$PROJECT_ID" --quiet || true
run_cmd gcloud artifacts repositories delete "$REPO_NAME" --location "$REGION" --project "$PROJECT_ID" --quiet || true
run_cmd gcloud secrets delete "$SECRET_DB_URL" --project "$PROJECT_ID" --quiet || true
run_cmd gcloud secrets delete "$SECRET_SESSION" --project "$PROJECT_ID" --quiet || true
run_cmd gcloud secrets delete "$SECRET_ADMIN_PASS" --project "$PROJECT_ID" --quiet || true
run_cmd gcloud secrets delete "$SECRET_DEMO_PASS" --project "$PROJECT_ID" --quiet || true
run_cmd gcloud iam service-accounts delete "$SA_EMAIL" --project "$PROJECT_ID" --quiet || true

echo "Teardown completed."
