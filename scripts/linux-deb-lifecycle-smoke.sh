#!/usr/bin/env bash
set -u

deb_path=${1:?usage: linux-deb-lifecycle-smoke.sh /path/to/package.deb}
package_name=${2:-open-entc-studio}
executable_name=${3:-openentc-studio}
install_log=$(mktemp)
launch_log=$(mktemp)
remove_log=$(mktemp)
cleanup() {
  rm -f "$install_log" "$launch_log" "$remove_log"
}
trap cleanup EXIT

DEBIAN_FRONTEND=noninteractive sudo -n dpkg -i "$deb_path" >"$install_log" 2>&1
install_status=$?
dpkg-query -W -f='${Status}\n' "$package_name" > /dev/null 2>&1
installed_status=$?

DEBIAN_FRONTEND=noninteractive sudo -n dpkg -i "$deb_path" >>"$install_log" 2>&1
reinstall_status=$?

timeout 5s "$executable_name" >"$launch_log" 2>&1
launch_status=$?

DEBIAN_FRONTEND=noninteractive sudo -n dpkg -r "$package_name" >"$remove_log" 2>&1
remove_status=$?
dpkg-query -W -f='${Status}\n' "$package_name" > /dev/null 2>&1
absent_status=$?

printf '{"installStatus":%s,"installedStatus":%s,"reinstallStatus":%s,"launchStatus":%s,"removeStatus":%s,"absentStatus":%s}\n' \
  "$install_status" "$installed_status" "$reinstall_status" "$launch_status" "$remove_status" "$absent_status"
printf '%s\n' '--- install log ---'
sed -n '1,12p' "$install_log"
printf '%s\n' '--- launch log ---'
sed -n '1,12p' "$launch_log"
printf '%s\n' '--- remove log ---'
sed -n '1,12p' "$remove_log"

if [[ "$install_status" -ne 0 || "$installed_status" -ne 0 || "$reinstall_status" -ne 0 || "$remove_status" -ne 0 || "$absent_status" -eq 0 ]]; then
  exit 1
fi
