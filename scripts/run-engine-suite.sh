#!/bin/sh
# Runs every engine-level test script and prints one result line each.
cd "$(dirname "$0")/.." || exit 1
for s in test game-test calls-test sichuan-test special-hands mcr-test persist-test restart-test coach-test whynot-test win-test examples-test chi-pon-race-test concurrent-calls-test meld-view-test; do
  f=scripts/$s.ts
  [ -f "$f" ] || f=scripts/$s.tsx
  npx tsx "$f" > "/tmp/suite-$s.log" 2>&1
  code=$?
  echo "$s: exit $code  $(grep -v '^npm notice' "/tmp/suite-$s.log" | tail -1 | cut -c1-120)"
done
