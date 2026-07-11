# Bootstrap Infrastructure

Terraform configuration for foundational trust and control-plane resources.

This root is intentionally separate from `infra/`. It manages project IAM,
Workload Identity Federation, and the service account used by GitHub Actions to
manage those resources. That identity is powerful enough to change project IAM,
so it must not be available to routine Cloudflare, Neon, PostHog, or Pages
deployments.

## GitHub Actions

The `.github/workflows/infra-bootstrap.yml` workflow uses the
`production-infra-bootstrap` environment and runs only by manual dispatch. Use
it for reviewing or applying changes to foundational IAM, identity trust, and
provider bootstrap resources.

The environment needs:

- `TF_API_TOKEN`
- `GCP_PROJECT_ID`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_TERRAFORM_SERVICE_ACCOUNT`

The GCP values are identifiers for the current bootstrap resources, not
secrets. Store them as unmasked Doppler values so
`scripts/sync-doppler-github-envs.sh` publishes them as GitHub environment
variables.

## Local Commands

Authenticate local Google credentials before running Terraform:

```bash
gcloud auth login --update-adc
gcloud config set project recipe-site-499720
```

Then run via mise:

```bash
mise run //infra-bootstrap:plan
mise run //infra-bootstrap:apply
```
