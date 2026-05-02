#!/usr/bin/env bash
# Fresh-clone setup for {{REPO_NAME}}.
#
# Detects the toolchain in use (mise / asdf / uv / poetry / npm / pnpm) and
# installs deps so a `make test` / equivalent works immediately after clone.
#
# Run:
#   ./scripts/setup.sh
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

step() {
  echo
  echo "── $* ──"
}

# ── Toolchain selection ──
if [[ -f .tool-versions ]] && command -v mise >/dev/null 2>&1; then
  step "mise install"
  mise install
elif [[ -f .tool-versions ]] && command -v asdf >/dev/null 2>&1; then
  step "asdf install"
  asdf install
elif [[ -f .python-version ]]; then
  echo "found .python-version (no asdf/mise) — assuming pyenv or system python"
fi

# ── Python deps ──
if [[ -f pyproject.toml ]]; then
  if grep -q '^\[tool.poetry\]' pyproject.toml 2>/dev/null && command -v poetry >/dev/null 2>&1; then
    step "poetry install"
    poetry install
  elif command -v uv >/dev/null 2>&1; then
    step "uv sync"
    uv sync
  fi
fi

if [[ -f requirements.txt && ! -f pyproject.toml ]]; then
  if command -v uv >/dev/null 2>&1; then
    step "uv pip install -r requirements.txt"
    uv pip install -r requirements.txt
  else
    step "pip install -r requirements.txt"
    pip install -r requirements.txt
  fi
fi

# ── Node deps ──
if [[ -f pnpm-lock.yaml ]] && command -v pnpm >/dev/null 2>&1; then
  step "pnpm install"
  pnpm install
elif [[ -f yarn.lock ]] && command -v yarn >/dev/null 2>&1; then
  step "yarn install"
  yarn install
elif [[ -f package-lock.json ]] && command -v npm >/dev/null 2>&1; then
  step "npm ci"
  npm ci
elif [[ -f package.json ]] && command -v npm >/dev/null 2>&1; then
  step "npm install"
  npm install
fi

# ── Go / Rust ──
if [[ -f go.mod ]]; then
  step "go mod download"
  go mod download
fi
if [[ -f Cargo.toml ]]; then
  step "cargo fetch"
  cargo fetch
fi

# ── Env file scaffolding ──
if [[ -f .env.example && ! -f .env ]]; then
  step "cp .env.example .env"
  cp .env.example .env
  echo "  -> .env created from template; fill in secret values before running."
fi

echo
echo "setup: done"
