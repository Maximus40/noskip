#!/usr/bin/env bash
# Applies every migration to a fresh database and runs the SQL test suite (RLS, RPCs, time helpers).
#
# Two modes:
#   DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db
#       → runs against a Supabase stack started with `supabase start` after `supabase db reset`
#         (migrations already applied, real auth schema). Every test file rolls back.
#   npm run test:db
#       → no Supabase stack: boots a throwaway local PostgreSQL (initdb) and loads
#         supabase/tests/local/supabase-shim.sql to mimic Supabase roles and the auth schema.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATIONS="$ROOT/supabase/migrations"
TESTS="$ROOT/supabase/tests/database"
SHIM="$ROOT/supabase/tests/local/supabase-shim.sql"
TEST_DB="noskip_test"

run_psql() { psql -X -q -v ON_ERROR_STOP=1 "$@"; }

if [[ -n "${DB_URL:-}" ]]; then
  URL="$DB_URL"
  USE_SHIM=0
else
  PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
  if [[ -z "$PG_BIN" || ! -x "$PG_BIN/initdb" ]]; then
    PG_BIN="$(dirname "$(command -v initdb || true)")"
  fi
  [[ -x "$PG_BIN/initdb" ]] || { echo "initdb introuvable : installe PostgreSQL ou passe DB_URL." >&2; exit 1; }
  PORT="${PG_PORT:-54329}"
  DATA="${PG_DATA:-/var/tmp/noskip-pg}"
  as_pg() { if [[ "$(id -u)" == "0" ]]; then su postgres -c "$*"; else bash -c "$*"; fi; }
  # The SQL tests open sessions "earlier today" (up to 2 h ago, Paris time). Right after
  # midnight in Paris that falls on the previous day and the "today" checks fail, so when
  # libfaketime is installed the throwaway server then runs at 12:00 (Paris) the same day.
  # Never for --prepare-only (the week simulation compares server and script clocks).
  FAKETIME_LIB="$(ls /usr/lib/*/faketime/libfaketime.so.1 2>/dev/null | head -1 || true)"
  CLOCK=real
  if [[ -n "$FAKETIME_LIB" && "${1:-}" != "--prepare-only" && 10#$(TZ=Europe/Paris date +%H) -lt 4 ]]; then
    CLOCK="@$(TZ=Europe/Paris date +%F) 11:00:00"
  fi
  if pg_isready -q -h localhost -p "$PORT" 2>/dev/null && [[ "$(cat "$DATA/clock" 2>/dev/null || echo real)" != "$CLOCK" ]]; then
    as_pg "$PG_BIN/pg_ctl -D $DATA/data -m fast -w stop >/dev/null"
  fi
  if ! pg_isready -q -h localhost -p "$PORT" 2>/dev/null; then
    if [[ ! -f "$DATA/data/PG_VERSION" ]]; then
      mkdir -p "$DATA"; [[ "$(id -u)" == "0" ]] && chown postgres:postgres "$DATA"
      as_pg "$PG_BIN/initdb -D $DATA/data -U postgres --auth=trust -E UTF8 >/dev/null"
    fi
    ENVS=""
    [[ "$CLOCK" != "real" ]] && ENVS="LD_PRELOAD=$FAKETIME_LIB FAKETIME='$CLOCK' "
    as_pg "${ENVS}$PG_BIN/pg_ctl -D $DATA/data -o '-p $PORT -k $DATA -c listen_addresses=localhost' -l $DATA/log -w start >/dev/null"
    echo "$CLOCK" > "$DATA/clock"
    [[ "$CLOCK" != "real" ]] && echo "(horloge de test fixée à 12:00 Paris : il est juste après minuit)"
  fi
  ADMIN_URL="postgresql://postgres@localhost:$PORT/postgres"
  URL="postgresql://postgres@localhost:$PORT/$TEST_DB"
  USE_SHIM=1
fi

if [[ "$USE_SHIM" == "1" ]]; then
  run_psql "$ADMIN_URL" -c "drop database if exists $TEST_DB with (force)" -c "create database $TEST_DB"
  run_psql "$URL" -f "$SHIM"
  for f in "$MIGRATIONS"/*.sql; do
    echo "→ migration $(basename "$f")"
    run_psql "$URL" -f "$f"
  done
fi

if [[ "${1:-}" == "--prepare-only" ]]; then
  echo "Base prête : $URL"
  exit 0
fi

PASS=0
for f in "$TESTS"/*.sql; do
  out="$(run_psql "$URL" -o /dev/null -f "$f" 2>&1)" || { echo "$out" | grep -v '^NOTICE:  ok - ' >&2; echo "✗ $(basename "$f")" >&2; exit 1; }
  n="$(grep -c 'NOTICE:  ok - ' <<<"$out" || true)"
  PASS=$((PASS + n))
  [[ "$n" -gt 0 ]] && echo "✓ $(basename "$f") ($n)"
done
echo "SQL tests: $PASS assertions passed."
if [[ "$USE_SHIM" == "1" ]]; then
  run_psql "$ADMIN_URL" -c "drop database if exists $TEST_DB with (force)"
fi
