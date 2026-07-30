#!/usr/bin/env bash
# Correctness checks for Session 5 search/filter/sort/keyset-pagination.
# Prereqs: seeded DB, API running on $BASE.
set -euo pipefail
BASE="${BASE:-http://localhost:4000}"
S="$BASE/api/properties/search"
say() { printf '\n=== %s ===\n' "$1"; }

say "filter city=Austin type=house 300k-700k, sort=price_asc, limit=3 (ascending)"
P1=$(curl -s "$S?city=Austin&type=house&minBudget=300000&maxBudget=700000&sort=price_asc&limit=3")
echo "$P1" | grep -o '"price":[0-9]*' | head -3
CUR=$(sed -n 's/.*"nextCursor":"\([^"]*\)".*/\1/p' <<<"$P1")

say "page 2 via cursor (prices keep ascending, no dupes/gaps)"
curl -s "$S?city=Austin&type=house&minBudget=300000&maxBudget=700000&sort=price_asc&limit=3&cursor=$CUR" \
  | grep -o '"price":[0-9]*' | head -3

say "sort=price_desc (descending)"
curl -s "$S?city=Austin&sort=price_desc&limit=4" | grep -o '"price":[0-9]*' | head -4

say "bedrooms=5 is a minimum (all >= 5)"
curl -s "$S?city=Dallas&bedrooms=5&limit=5" | grep -o '"bedrooms":[0-9]*' | head -5

say "invalid minBudget>maxBudget (expect 400)"
curl -s -o /dev/null -w "status=%{http_code}\n" "$S?minBudget=900000&maxBudget=100000"

echo -e "\nDone."
