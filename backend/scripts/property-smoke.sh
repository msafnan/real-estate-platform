#!/usr/bin/env bash
# End-to-end smoke test for Session 4 (Property CRUD + ownership + image upload).
# Prereqs: seeded DB (demo owners), API running on $BASE.
#   npm run dev              # terminal 1
#   bash scripts/property-smoke.sh
set -euo pipefail
BASE="${BASE:-http://localhost:4000}"

# extract a top-level string field from a JSON blob: field <json> <key>
field() { sed -n "s/.*\"$2\":\"\([^\"]*\)\".*/\1/p" <<<"$1" | head -1; }
say() { printf '\n=== %s ===\n' "$1"; }

login() { # email -> token
  curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"Password123\"}"
}

say "login owner1 + owner2"
T1=$(field "$(login owner1@example.com)" accessToken)
T2=$(field "$(login owner2@example.com)" accessToken)
echo "owner1 token: ${T1:0:20}...  owner2 token: ${T2:0:20}..."

say "create property as owner1 (expect 201)"
CREATE=$(curl -s -X POST "$BASE/api/properties" -H "Authorization: Bearer $T1" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Smoke Test Loft","description":"A test listing.","price":425000,"city":"Austin","propertyType":"condo","bedrooms":2,"bathrooms":2}')
echo "$CREATE"
PID=$(field "$CREATE" id)
echo "created id: $PID"

say "GET /api/properties/:id (expect 200)"
curl -s -o /dev/null -w "status=%{http_code}\n" "$BASE/api/properties/$PID"

say "GET list page 1 (limit=2) — capture nextCursor"
PAGE1=$(curl -s "$BASE/api/properties?limit=2")
echo "$PAGE1" | head -c 200; echo
CURSOR=$(field "$PAGE1" nextCursor)
say "GET list page 2 via cursor (expect different rows)"
curl -s -o /dev/null -w "status=%{http_code}\n" "$BASE/api/properties?limit=2&cursor=$CURSOR"

say "update as owner1 (expect 200, price changed)"
curl -s -X PUT "$BASE/api/properties/$PID" -H "Authorization: Bearer $T1" \
  -H 'Content-Type: application/json' -d '{"price":399000}' | head -c 160; echo

say "OWNERSHIP: update as owner2 (expect 403)"
curl -s -o /dev/null -w "status=%{http_code}\n" -X PUT "$BASE/api/properties/$PID" \
  -H "Authorization: Bearer $T2" -H 'Content-Type: application/json' -d '{"price":1}'

say "OWNERSHIP: delete as owner2 (expect 403)"
curl -s -o /dev/null -w "status=%{http_code}\n" -X DELETE "$BASE/api/properties/$PID" \
  -H "Authorization: Bearer $T2"

say "upload a real image to Cloudinary as owner1 (expect 201 + cloudinary URL)"
PNG=$(mktemp --suffix=.png)
base64 -d > "$PNG" <<'B64'
iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC
B64
UP=$(curl -s -X POST "$BASE/api/properties/$PID/images" -H "Authorization: Bearer $T1" \
  -F "images=@$PNG")
echo "$UP" | head -c 260; echo
IMG_ID=$(field "$UP" id)
echo "$UP" | grep -q "res.cloudinary.com" && echo "-> Cloudinary URL present ✔" || echo "-> NO cloudinary URL �’"

say "delete that image as owner1 (expect 204)"
curl -s -o /dev/null -w "status=%{http_code}\n" -X DELETE "$BASE/api/properties/$PID/images/$IMG_ID" \
  -H "Authorization: Bearer $T1"

say "delete property as owner1 (expect 204)"
curl -s -o /dev/null -w "status=%{http_code}\n" -X DELETE "$BASE/api/properties/$PID" \
  -H "Authorization: Bearer $T1"

say "GET deleted property (expect 404)"
curl -s -o /dev/null -w "status=%{http_code}\n" "$BASE/api/properties/$PID"

rm -f "$PNG"
echo -e "\nDone."
