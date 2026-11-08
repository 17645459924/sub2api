#!/usr/bin/env bash
# Install on the server as /opt/sub2api/deploy.sh (chmod +x).
# Usage: /opt/sub2api/deploy.sh <sha8>
set -euo pipefail

SHA8="${1:?usage: deploy.sh <sha8>}"
[[ "$SHA8" =~ ^[0-9a-f]{8}$ ]] || { echo "bad sha8"; exit 1; }

cd /opt/sub2api
NEW="ghcr.io/17645459924/sub2api:0.2.19-tl-${SHA8}"
CUR_LINE=$(grep -m1 'image: ghcr.io/17645459924/sub2api:' compose.yml)
CUR="${CUR_LINE##*image: }"
echo "current: $CUR"
echo "target:  $NEW"

cp compose.yml "compose.yml.bak-$(date +%Y%m%d%H%M%S)"
sed -i "0,\#image: ${CUR}#s##image: ${NEW}#" compose.yml

docker compose -f compose.yml pull sub2api
docker compose -f compose.yml up -d sub2api

for i in $(seq 1 12); do
  sleep 5
  status=$(docker inspect -f '{{.State.Health.Status}}' sub2api 2>/dev/null || echo none)
  echo "health: $status"
  [ "$status" = "healthy" ] && { echo "deployed $NEW"; exit 0; }
done

echo "not healthy, rolling back to $CUR"
sed -i "0,\#image: ${NEW}#s##image: ${CUR}#" compose.yml
docker compose -f compose.yml up -d sub2api
exit 1
