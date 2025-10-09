#!/usr/bin/env bash
set -euo pipefail

resolve_session_name() {
  local value="$1"
  if [[ -z "${value}" ]]; then
    echo ""
    return
  fi

  if [[ "${value}" =~ ^\$[0-9]+$ ]]; then
    tmux display-message -p -t "${value}" '#S' 2>/dev/null || echo ""
    return
  fi

  echo "${value}"
}

HOOK_NAME="${1:-}"
RAW_SESSION_ARG="${2:-}"
RAW_CLIENT_ARG="${3:-}"

SESSION_NAME="$(resolve_session_name "${RAW_SESSION_ARG}")"
if [[ -z "${SESSION_NAME}" ]]; then
  SESSION_NAME="$(resolve_session_name "${RAW_CLIENT_ARG}")"
fi

log "[cmux] start-core-scripts.sh hook='${HOOK_NAME}' rawSession='${RAW_SESSION_ARG}' rawClient='${RAW_CLIENT_ARG}' resolved='${SESSION_NAME}'"

if [[ -z "${SESSION_NAME}" ]]; then
  log "[cmux] Unable to resolve session name, skipping"
  exit 0
fi

TARGET_SESSION="cmux"
if [[ "${SESSION_NAME}" != "${TARGET_SESSION}" ]]; then
  log "[cmux] Session '${SESSION_NAME}' did not match target '${TARGET_SESSION}', skipping"
  exit 0
fi

WORKSPACE_DIR="/root/workspace"
DEV_SCRIPT="${WORKSPACE_DIR}/scripts/dev.sh"
MAINTENANCE_SCRIPT="${WORKSPACE_DIR}/scripts/maintenance.sh"
CMUX_RUNTIME_DIR="/var/tmp/cmux-scripts"
DEV_OVERRIDE_SCRIPT="${CMUX_RUNTIME_DIR}/dev-script.sh"
MAINTENANCE_OVERRIDE_SCRIPT="${CMUX_RUNTIME_DIR}/maintenance-script.sh"
STATE_DIR="/var/tmp/cmux-tmux-hooks"
LOG_FILE="${STATE_DIR}/start-core-scripts.log"
DEV_WINDOW_NAME="dev"
MAINTENANCE_WINDOW_NAME="maintenance"
MAINTENANCE_MARKER="${STATE_DIR}/${SESSION_NAME}-maintenance.launched"

mkdir -p "${STATE_DIR}"
touch "${LOG_FILE}"

log() {
  local message="$1"
  local timestamp="$(date '+%Y-%m-%dT%H:%M:%S%z')"
  echo "${timestamp} ${message}" >> "${LOG_FILE}"
  echo "${message}" >&2
}

list_windows() {
  tmux list-windows -t "${SESSION_NAME}" -F '#{window_name}' 2>/dev/null || true
}

window_exists() {
  local window_name="$1"
  list_windows | grep -Fx "${window_name}" >/dev/null 2>&1
}

maybe_start_dev_script() {
  if window_exists "${DEV_WINDOW_NAME}"; then
    log "[cmux] Dev window already exists"
    return
  fi

  local command
  if [[ -f "${DEV_OVERRIDE_SCRIPT}" ]]; then
    command="cd ${WORKSPACE_DIR} && bash -eu -o pipefail ${DEV_OVERRIDE_SCRIPT}"
    log "[cmux] Using override dev script ${DEV_OVERRIDE_SCRIPT}"
  elif [[ -x "${DEV_SCRIPT}" ]]; then
    command="cd ${WORKSPACE_DIR} && ./scripts/dev.sh"
    log "[cmux] Using default dev script ${DEV_SCRIPT}"
  else
    log "[cmux] No dev script available"
    return
  fi

  tmux new-window -d -t "${SESSION_NAME}" -n "${DEV_WINDOW_NAME}" \
    "bash -lc '${command}'"
  log "[cmux] Launched dev window"
}

maybe_start_maintenance_script() {
  if [[ -f "${MAINTENANCE_MARKER}" ]]; then
    log "[cmux] Maintenance marker present, skipping"
    return
  fi

  if window_exists "${MAINTENANCE_WINDOW_NAME}"; then
    log "[cmux] Maintenance window already exists"
    return
  fi

  local command
  if [[ -f "${MAINTENANCE_OVERRIDE_SCRIPT}" ]]; then
    command="cd ${WORKSPACE_DIR} && bash -eu -o pipefail ${MAINTENANCE_OVERRIDE_SCRIPT}"
    log "[cmux] Using override maintenance script ${MAINTENANCE_OVERRIDE_SCRIPT}"
  elif [[ -x "${MAINTENANCE_SCRIPT}" ]]; then
    command="cd ${WORKSPACE_DIR} && ./scripts/maintenance.sh"
    log "[cmux] Using default maintenance script ${MAINTENANCE_SCRIPT}"
  else
    log "[cmux] No maintenance script available"
    return
  fi

  tmux new-window -d -t "${SESSION_NAME}" -n "${MAINTENANCE_WINDOW_NAME}" \
    "bash -lc '${command}'"
  log "[cmux] Launched maintenance window"

  touch "${MAINTENANCE_MARKER}"
  log "[cmux] Maintenance marker created at ${MAINTENANCE_MARKER}"
}

maybe_start_dev_script
maybe_start_maintenance_script
log "[cmux] start-core-scripts.sh completed"
