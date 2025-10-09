#!/usr/bin/env bash
set -euo pipefail

SESSION_NAME="${1:-}"
if [[ -z "${SESSION_NAME}" ]]; then
  exit 0
fi

TARGET_SESSION="cmux"
if [[ "${SESSION_NAME}" != "${TARGET_SESSION}" ]]; then
  exit 0
fi

WORKSPACE_DIR="/root/workspace"
DEV_SCRIPT="${WORKSPACE_DIR}/scripts/dev.sh"
MAINTENANCE_SCRIPT="${WORKSPACE_DIR}/scripts/maintenance.sh"
STATE_DIR="/var/tmp/cmux-tmux-hooks"
DEV_WINDOW_NAME="dev"
MAINTENANCE_WINDOW_NAME="maintenance"
MAINTENANCE_MARKER="${STATE_DIR}/${SESSION_NAME}-maintenance.launched"

mkdir -p "${STATE_DIR}"

list_windows() {
  tmux list-windows -t "${SESSION_NAME}" -F '#{window_name}' 2>/dev/null || true
}

window_exists() {
  local window_name="$1"
  list_windows | grep -Fx "${window_name}" >/dev/null 2>&1
}

maybe_start_dev_script() {
  if [[ ! -x "${DEV_SCRIPT}" ]]; then
    return
  fi

  if window_exists "${DEV_WINDOW_NAME}"; then
    return
  fi

  tmux new-window -d -t "${SESSION_NAME}" -n "${DEV_WINDOW_NAME}" \
    "bash -lc 'cd ${WORKSPACE_DIR} && ./scripts/dev.sh'"
}

maybe_start_maintenance_script() {
  if [[ ! -x "${MAINTENANCE_SCRIPT}" ]]; then
    return
  fi

  if [[ -f "${MAINTENANCE_MARKER}" ]]; then
    return
  fi

  if window_exists "${MAINTENANCE_WINDOW_NAME}"; then
    return
  fi

  tmux new-window -d -t "${SESSION_NAME}" -n "${MAINTENANCE_WINDOW_NAME}" \
    "bash -lc 'cd ${WORKSPACE_DIR} && ./scripts/maintenance.sh'"

  touch "${MAINTENANCE_MARKER}"
}

maybe_start_dev_script
maybe_start_maintenance_script
