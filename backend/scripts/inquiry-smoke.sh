#!/usr/bin/env bash
# Session 7 — lead/inquiry: duplicate prevention, spam, rate-limit, owner-only.
# Prereqs: seeded DB (owner1/owner2), API running on $BASE.
set -euo pipefail
BASE="${BASE:-http://localhost:4000}"
say() { printf '\n=== %s ===\n' "$1"; }
field() { sed -n "s/.*\"$2\":\"\([^\"]*\)\".*/\1/p" <<<"$1" | head -1; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

login() { curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$1\",\"password\":\"Password123\"}"; }

T1=$(field "$(login owner1@example.com)" accessToken)
T2=$(field "$(login owner2@example.com)" accessToken)

# owner1 creates a fresh property to inquire against
PID=$(field "$(curl -s -X POST "$BASE/api/properties" -H "Authorization: Bearer $T1" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Inquiry Test","description":"x","price":300000,"city":"Austin","propertyType":"condo","bedrooms":1,"bathrooms":1}')" id)
echo "property: $PID"
IURL="$BASE/api/properties/$PID/inquiries"

say "submit inquiry (expect 201)"
code -X POST "$IURL" -H 'Content-Type: application/json' \
  -d '{"inquirerName":"Jane","inquirerEmail":"jane@example.com","message":"Is this available?"}'; echo

say "DUPLICATE: same email same day (expect 409)"
code -X POST "$IURL" -H 'Content-Type: application/json' \
  -d '{"inquirerName":"Jane","inquirerEmail":"jane@example.com","message":"again"}'; echo

say "HONEYPOT: website field filled (expect 200 received:true, not stored)"
curl -s -X POST "$IURL" -H 'Content-Type: application/json' \
  -d '{"inquirerName":"Bot","inquirerEmail":"bot@evil.com","message":"buy","website":"http://spam"}'; echo

say "CONTENT SPAM: 3+ links (expect 200 received:true, not stored)"
curl -s -X POST "$IURL" -H 'Content-Type: application/json' \
  -d '{"inquirerName":"Bot2","inquirerEmail":"bot2@evil.com","message":"http://a http://b http://c"}'; echo

say "VALIDATION: bad email (expect 400)"
code -X POST "$IURL" -H 'Content-Type: application/json' \
  -d '{"inquirerName":"X","inquirerEmail":"not-email","message":"hi"}'; echo

say "OWNER-ONLY list: owner2 (expect 403)"
code "$IURL" -H "Authorization: Bearer $T2"; echo
say "OWNER-ONLY list: anonymous (expect 401)"
code "$IURL"; echo

say "owner1 lists leads (expect 200; should contain jane, NOT bot/bot2)"
LEADS=$(curl -s "$IURL" -H "Authorization: Bearer $T1")
echo "  count: $(grep -o '"id":"' <<<"$LEADS" | wc -l)"
echo "  has jane@example.com? $(grep -q 'jane@example.com' <<<"$LEADS" && echo yes || echo NO)"
echo "  has bot (spam) stored? $(grep -q 'evil.com' <<<"$LEADS" && echo 'YES (bug)' || echo 'no (dropped)')"

say "RATE LIMIT: rapid submits from one IP — expect 429"
echo "(note: limit is 5/15min/IP; the 5 POSTs above already consumed the budget,"
echo " so this whole burst is correctly throttled)"
for i in 1 2 3 4 5 6 7; do
  printf 'req %s -> ' "$i"
  code -X POST "$IURL" -H 'Content-Type: application/json' \
    -d "{\"inquirerName\":\"R$i\",\"inquirerEmail\":\"r$i@example.com\",\"message\":\"hi\"}"; echo
done

# cleanup
curl -s -o /dev/null -X DELETE "$BASE/api/properties/$PID" -H "Authorization: Bearer $T1"
echo -e "\nDone."
