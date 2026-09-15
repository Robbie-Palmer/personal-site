#!/usr/bin/env bash
set -euo pipefail

for script in scripts/*.sh scripts/doppler-terraform-env; do
  bash -n "$script"
done

forbidden_resource='resource[[:space:]]+"(neon_project|cloudflare_(zero_trust_)?access_service_token|cloudflare_workers?_secret)"'
if rg -n "$forbidden_resource" --glob '*.tf' .; then
  echo "Credential-bearing provider resources are forbidden in the Work Graph Terraform root." >&2
  exit 1
fi

if rg -n 'database_password|connection_uri|client_secret[[:space:]]*=' --glob '*.tf' .; then
  echo "A credential-bearing Terraform expression crossed the Work Graph state boundary." >&2
  exit 1
fi

echo "Work Graph infrastructure keeps generated credentials outside Terraform configuration."
