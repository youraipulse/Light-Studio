#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
TASK_NODE=""
if command -v node >/dev/null 2>&1; then
  if [ "$(node -p 'Number(process.versions.node.split(".")[0])')" -ge 22 ]; then TASK_NODE="$(command -v node)"; fi
fi
if [ -z "$TASK_NODE" ]; then
  mkdir -p .runtime
  TASK_NODE="$PWD/.runtime/node/bin/node"
  if [ ! -x "$TASK_NODE" ]; then
    case "$(uname -s)" in Darwin) TASK_OS=darwin;; Linux) TASK_OS=linux;; *) echo 'Unsupported OS. Use START.cmd on Windows.'; exit 1;; esac
    case "$(uname -m)" in arm64|aarch64) TASK_ARCH=arm64;; x86_64) TASK_ARCH=x64;; *) echo 'A 64-bit x64 or ARM64 system is required.'; exit 1;; esac
    echo 'Downloading portable Node.js 24 LTS...'
    curl -fL --retry 2 'https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt' -o .runtime/SHASUMS256.txt
    TASK_FILE="$(awk -v suffix="-$TASK_OS-$TASK_ARCH.tar.gz" 'index($2,suffix) && substr($2,length($2)-length(suffix)+1)==suffix {print $2;exit}' .runtime/SHASUMS256.txt)"
    [ -n "$TASK_FILE" ] || { echo 'No official Node.js download matched this system.'; exit 1; }
    curl -fL --retry 2 "https://nodejs.org/dist/latest-v24.x/$TASK_FILE" -o ".runtime/$TASK_FILE"
    TASK_EXPECTED="$(awk -v file="$TASK_FILE" '$2==file {print $1}' .runtime/SHASUMS256.txt)"
    if command -v sha256sum >/dev/null 2>&1; then TASK_ACTUAL="$(sha256sum ".runtime/$TASK_FILE" | awk '{print $1}')"; else TASK_ACTUAL="$(shasum -a 256 ".runtime/$TASK_FILE" | awk '{print $1}')"; fi
    [ "$TASK_EXPECTED" = "$TASK_ACTUAL" ] || { echo 'Node.js checksum mismatch.'; exit 1; }
    mkdir -p .runtime/node
    tar -xzf ".runtime/$TASK_FILE" --strip-components=1 -C .runtime/node
  fi
fi
exec "$TASK_NODE" launch.mjs --open
