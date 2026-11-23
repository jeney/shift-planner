#!/usr/bin/env bash
# One-time Google Cloud setup for deploying the Shift Planner backend to Cloud Run from GitHub
# Actions. Run it in Google Cloud Shell (https://shell.cloud.google.com), which has gcloud ready:
#
#   bash gcp-setup.sh <your-project-id> [region]
#
# It creates a Docker repository, a deploy service account with the minimum roles, and keyless
# GitHub → Google authentication (Workload Identity Federation) restricted to this repository.
# No keys or secrets are created. At the end it prints the GitHub variables to set.
set -euo pipefail

PROJECT_ID="${1:?usage: bash gcp-setup.sh <project-id> [region]}"
REGION="${2:-europe-west1}"
GITHUB_REPO="${GITHUB_REPO:-jeney/shift-planner}"
SA_NAME="shift-planner-deployer"
SA="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
POOL="github"
PROVIDER="github"

echo "› Project ${PROJECT_ID}, region ${REGION}, repository ${GITHUB_REPO}"
gcloud config set project "${PROJECT_ID}" >/dev/null
PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"

echo "› Enabling APIs (Cloud Run, Artifact Registry, IAM credentials)…"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  iamcredentials.googleapis.com sts.googleapis.com

echo "› Docker repository…"
gcloud artifacts repositories describe shift-planner --location="${REGION}" >/dev/null 2>&1 ||
  gcloud artifacts repositories create shift-planner --repository-format=docker \
    --location="${REGION}" --description="Shift Planner backend images"

echo "› Deploy service account…"
gcloud iam service-accounts describe "${SA}" >/dev/null 2>&1 ||
  gcloud iam service-accounts create "${SA_NAME}" --display-name="Shift Planner deployer"
for role in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" --member="serviceAccount:${SA}" \
    --role="${role}" --condition=None >/dev/null
done

echo "› Keyless GitHub authentication (only ${GITHUB_REPO} may use it)…"
gcloud iam workload-identity-pools describe "${POOL}" --location=global >/dev/null 2>&1 ||
  gcloud iam workload-identity-pools create "${POOL}" --location=global \
    --display-name="GitHub Actions"
gcloud iam workload-identity-pools providers describe "${PROVIDER}" --location=global \
  --workload-identity-pool="${POOL}" >/dev/null 2>&1 ||
  gcloud iam workload-identity-pools providers create-oidc "${PROVIDER}" --location=global \
    --workload-identity-pool="${POOL}" --display-name="GitHub" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
    --attribute-condition="assertion.repository=='${GITHUB_REPO}'"
gcloud iam service-accounts add-iam-policy-binding "${SA}" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${GITHUB_REPO}" \
  >/dev/null

PROVIDER_ID="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"
API_URL="https://shift-planner-api-${PROJECT_NUMBER}.${REGION}.run.app"

cat <<DONE

✔ Done. Now set these GitHub repository variables (they are identifiers, not secrets).
  Either run this where the GitHub CLI is logged in:

    gh variable set GCP_PROJECT_ID --repo ${GITHUB_REPO} --body ${PROJECT_ID}
    gh variable set GCP_REGION --repo ${GITHUB_REPO} --body ${REGION}
    gh variable set GCP_WIF_PROVIDER --repo ${GITHUB_REPO} --body ${PROVIDER_ID}
    gh variable set GCP_SERVICE_ACCOUNT --repo ${GITHUB_REPO} --body ${SA}
    gh variable set API_BASE_URL --repo ${GITHUB_REPO} --body ${API_URL}

  or add them under Settings → Secrets and variables → Actions → Variables.

Then run the "Deploy backend to Cloud Run" workflow (Actions tab), and re-run
"Deploy frontend to GitHub Pages" so the site points at ${API_URL}.

Tip: add a budget alert (Billing → Budgets & alerts), e.g. 1 EUR, for peace of mind.
DONE
