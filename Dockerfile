FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim@sha256:e5b65587bce7de595f299855d7385fe7fca39b8a74baa261ba1b7147afa78e58
WORKDIR /app
ENV HF_HOME=/state/models
ENV HF_HUB_DISABLE_TELEMETRY=1
ENV DO_NOT_TRACK=1
ENV TOKENIZERS_PARALLELISM=false
COPY pyproject.toml uv.lock /app/
RUN uv sync --locked
COPY scripts /app/scripts
CMD ["uv", "run", "--no-sync", "scripts/service.py"]
