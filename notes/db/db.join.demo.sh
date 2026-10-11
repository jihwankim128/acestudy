#!/usr/bin/env bash
set -euo pipefail

demo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
demo_name="acestudy-join-$$-${RANDOM}"
demo_image="${ACESTUDY_PG_IMAGE:-postgres:17-alpine}"
demo_id=""
cleanup() {
  if [[ -n "$demo_id" ]]; then
    docker rm -f "$demo_id" >/dev/null
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

# Disposable database, no network or published ports. Trust is limited to this container.
demo_id=$(docker run --rm -d --name "$demo_name" --network none \
  --tmpfs /var/lib/postgresql/data:rw \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=acestudy "$demo_image")

for ((demo_attempt=0; demo_attempt<30; demo_attempt++)); do
  if docker exec "$demo_id" pg_isready -U postgres -d acestudy >/dev/null 2>&1; then
    docker exec -i "$demo_id" psql -X -U postgres -d acestudy < "$demo_dir/db.join.demo.sql"
    exit 0
  fi
  sleep 1
done
printf 'PostgreSQL did not become ready.\n' >&2
exit 1
