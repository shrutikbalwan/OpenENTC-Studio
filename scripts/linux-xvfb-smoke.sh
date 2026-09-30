#!/usr/bin/env bash
set -u

binary_path=${1:?usage: linux-xvfb-smoke.sh /path/to/openentc-studio}
log_path=${2:-linux-xvfb-smoke.log}

xvfb-run -a timeout 10s "$binary_path" >"$log_path" 2>&1
launch_status=$?
printf '{"launchStatus":%s,"logPath":"%s"}\n' "$launch_status" "$log_path"
sed -n '1,20p' "$log_path"

# timeout(1) status 124 means the desktop process remained alive for the full bound.
if [[ "$launch_status" -ne 124 && "$launch_status" -ne 0 ]]; then
  exit 1
fi
