#!/usr/bin/env bash
# Generate a concept round from a TSV (group, ref, title, tier, mechanism, predict) into out/concepts/<round>/<ref>.png.
#   tools/pix/round.sh tools/pix/rounds/r4-smelter.tsv [only-refs-regex]
# Existing images are skipped, so the script can be re-run after an interruption.
set -euo pipefail
cd "$(dirname "$0")/../.."
TSV=$1
FILTER=${2:-.}
ROUND=$(basename "$TSV" .tsv)
OUT=out/concepts/$ROUND
mkdir -p "$OUT"

STYLE="A modded Minecraft machine made in Blockbench, in the spirit of the Create and Immersive Engineering mods: blocky cube geometry, crisp 16x16 pixel-art textures. The working process is visible from outside, with clearly marked input and output ports. Three-quarter isometric view, whole machine in frame, plain light grey background, no text."
era() {
  case $1 in
    0|1) echo "Primitive era: rough stone, clay, timber, leather and wrought iron, a few signal-orange painted iron plates with rivets, warm fire glow." ;;
    2|3) echo "Heavy industry era: warm anthracite riveted steel frame, chipped signal-orange painted panels, copper pipes with flanges, amber heat glow, smoke." ;;
    4|5) echo "Clean engineering era: brushed blue-grey steel, clean signal-orange enamel panels with seams, bolted covers, cable trays, gauges, white status LEDs, electric arcs." ;;
    6|7) echo "Control era: graphite structure, signal-orange panels with glass inserts, teal lights and screens, fluids visible in glass." ;;
    8|9) echo "Endgame era: polished graphite and white ceramic, smooth bevels, signal-orange accent bands, violet or cyan energy, levitating parts, transparent glass so the hot core is visible, never a sealed opaque shell. It must still read as a furnace that melts metal." ;;
  esac
}

seed=$(( $(cksum <<<"$ROUND" | cut -d" " -f1) % 100000 ))
while IFS=$'\t' read -r group ref title tier mech _; do
  [[ $group == \#* || -z $group ]] && continue
  seed=$((seed + 1))
  [[ $ref =~ $FILTER ]] || continue
  [ -f "$OUT/$ref.png" ] && continue
  prompt="$STYLE $(era "$tier") The machine: $title, $mech."
  tmp=$(mktemp -d)
  tools/pix/lab.sh "$seed" "$tmp" "$prompt" >/dev/null
  mv "$tmp"/*.png "$OUT/$ref.png"
  rmdir "$tmp"
  printf '%s\t%s\t%s\n' "$ref" "$seed" "$prompt" >> "$OUT/prompts.tsv"
  echo "$ref done"
done < "$TSV"
