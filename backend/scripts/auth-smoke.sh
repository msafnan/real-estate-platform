#!/usr/bin/env bash
# End-to-end smoke test for the Session 3 auth flow.
# Prereqs: a reachable Postgres (DATABASE_URL set), migration applied, and the
# API running on $BASE (default http://localhost:4000).
#
# Usage:
#   npm run prisma:migrate         # once, applies init_auth migration
#   npm run dev                    # in another terminal
#   bash scripts/auth-smoke.sh
set -euo pipefail

BASE="${BASE:-http://localhost:4000}"
JAR="$(mktemp)"
EMAIL="smoke+$(date +%s)@example.com"
PASS="Password123"

say() { printf '\n=== %s ===\n' "$1"; }

say "register ($EMAIL)"
REG=$(curl -s -c "$JAR" -X POST "$BASE/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"name\":\"Smoke Test\",\"password\":\"$PASS\"}")
echo "$REG"
ACCESS=$(echo "$REG" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')

say "access protected route /me (expect user)"
curl -s "$BASE/api/auth/me" -H "Authorization: Bearer $ACCESS"; echo

say "login"
LOGIN=$(curl -s -c "$JAR" -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
echo "$LOGIN"

say "refresh (rotates cookie, new access token)"
curl -s -b "$JAR" -c "$JAR" -X POST "$BASE/api/auth/refresh"; echo

say "logout (204)"
curl -s -o /dev/null -w "%{http_code}\n" -b "$JAR" -c "$JAR" -X POST "$BASE/api/auth/logout"

say "refresh AFTER logout (expect 401 — token revoked)"
curl -s -b "$JAR" -X POST "$BASE/api/auth/refresh"; echo

rm -f "$JAR"
echo -e "\nDone."
