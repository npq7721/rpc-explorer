#!/usr/bin/env bash
set -euo pipefail

mkdir -p "$HOME/.raptoreumcore"

cp /app/raptoreum.conf "$HOME/.raptoreumcore/raptoreum.conf"

exec raptoreumd -printtoconsole
