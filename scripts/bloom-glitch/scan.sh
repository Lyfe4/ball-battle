#!/usr/bin/env bash
# Proto only: runs tune.ts for each variant line in a file, appending to an output log.
# scan.sh <seeds> <variants-file> <log> [extra tune args...]
seeds=$1; file=$2; log=$3; shift 3
while IFS= read -r v; do
  [ -z "$v" ] && continue
  node scripts/bloom-glitch/tune.ts "$seeds" "$v" "$@" >> "$log" 2>&1
  echo "---" >> "$log"
done < "$file"
