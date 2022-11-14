#!/usr/bin/env bash
set -euo pipefail

APP_LOG=/applogs/app.log

graceful_shutdown() {
  echo "Container is shutting down. gracefully shutting down rpc explorer"
  kill -q -w "$child" 2>/dev/null
}

trap graceful_shutdown 1 2 3 4 5 6 15
exec rpc-explorer --max_old_space_size=$BTCEXP_OLD_SPACE_MAX_SIZE >> $APP_LOG &
child=$!
echo "running rpc explorer at @ $child"
wait "$child"