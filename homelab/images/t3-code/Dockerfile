FROM node@sha256:2c87ef9bd3c6a3bd4b472b4bec2ce9d16354b0c574f736c476489d09f560a203

ARG T3_VERSION=0.0.38
ARG CODEX_VERSION=0.153.2
ARG CLAUDE_CODE_VERSION=2.1.260
ARG OPENCODE_VERSION=1.18.27

LABEL org.opencontainers.image.source="https://github.com/Robbie-Palmer/personal-site"
LABEL org.opencontainers.image.description="Pinned t3-code runtime for the remote development K3s cluster"

RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
      build-essential \
      ca-certificates \
      curl \
      dnsutils \
      gh \
      git \
      iproute2 \
      jq \
      less \
      netcat-openbsd \
      openssh-client \
      procps \
      python3 \
      ripgrep \
      tini \
      unzip \
    && npm install --global \
      "t3@${T3_VERSION}" \
      "@openai/codex@${CODEX_VERSION}" \
      "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
      "opencode-ai@${OPENCODE_VERSION}" \
    && npm cache clean --force \
    && apt-get purge --yes --auto-remove build-essential python3 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 2000 t3code \
    && useradd --uid 2000 --gid 2000 --create-home --shell /bin/bash t3code

ENV HOME=/data/home
ENV T3CODE_HOME=/data/home/.t3
ENV T3CODE_HOST=0.0.0.0
ENV T3CODE_PORT=3773
ENV T3CODE_NO_BROWSER=true

WORKDIR /data/workspaces
USER 2000:2000
EXPOSE 3773

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["t3", "serve", "--host=0.0.0.0", "--port=3773", "--base-dir=/data/home/.t3", "/data/workspaces"]
