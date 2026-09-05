# t3-code runtime image

This image packages the headless t3-code server and its supported coding-agent
CLIs, mise, Doppler, and the native libraries required by headless browser
tests. The base image uses an immutable digest, every top-level npm package
uses an explicit version, and the deployment uses the release tag
`0.0.38-agent-tools-3`. Increment that release suffix for every image change.
After the first registry publish, replacing the tag in the manifests with its
registry digest adds another immutability check.

The process runs as UID/GID `2000:2000`. Kubernetes mounts the encrypted data
volume at `/data`; t3 state and provider authentication live under
`/data/home`, while repositories and worktrees live under `/data/workspaces`.
Neither the image nor its build context contains credentials.

The deployment enables the OpenCode and Grok providers in T3's persisted
settings. The remote-development overlay declares OpenRouter's GLM 5.3 Flash
model through `OPENCODE_CONFIG_CONTENT`. Doppler injects
`OPENROUTER_API_KEY`; the key never appears in the OpenCode configuration or
image. Grok's device-login state lives under `/data/home/.grok`.

Run repository tasks with `mise run`. Mise installs versions declared by each
repository on first use and keeps them under `/data/home/.local/share/mise`.
For this repository, run `mise install --include-task-tools --monorepo` and
`mise run //:install` after cloning. The second command installs the locked
pnpm dependencies and activates the Husky hooks. Playwright downloads its
version-matched Chromium build into the persistent cache when
`mise run //ui:test:e2e:install` runs. System Chromium remains available to
Puppeteer and Lighthouse through `PUPPETEER_EXECUTABLE_PATH`.

Build and inspect it with:

```bash
mise run //homelab:t3-image-build
mise run //homelab:t3-image-check
```

The `t3-code image` GitHub workflow publishes the checked image to GHCR from
`main` with repository-scoped package permission. During first commissioning,
or if GHCR is unavailable, load the checked local image directly into the
remote node with `mise run //homelab:t3-image-load-remote`.

To update, change one or more version arguments in the Dockerfile, increment
the release suffix in the image tasks and manifests, then build and test it.
After publishing, deploy the new reference with the context-guarded task. A
rollback restores the previous image reference from Git and reapplies the
overlay; neither operation replaces the persistent volume.
