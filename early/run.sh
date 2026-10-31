#!/bin/sh
# Early-window test: static branded image vs a 20 fps GIF-like animation, proven two ways.
#   1. EarlySpriteProbe: our own GL 3.2 core renderer, the way a custom ImmediateWindowProvider draws,
#      every 20 Hz tick dumped to PNG and encoded at 20 fps (what the player sees), plus cost numbers.
#   2. FML's real early window (FML 4.0.39 = NeoForge 21.1.x) playing OUR sprite strip: FML already
#      animates a 28-frame strip (fox_running.png, 256x128 per frame); shadowing that resource on the
#      classpath makes the stock window play the Arffornia press instead. Proof only, not how we ship.
# Needs: Java 21, xvfb-run, Mesa, ffmpeg, node (Playwright), the LWJGL/FML jars in ~/.gradle (any
# NeoForge 21.1 project), and `npm run render` done (out/early/*.png).
set -eu
cd "$(dirname "$0")/.."
OUT=out/early; mkdir -p "$OUT"
C="${GRADLE_USER_HOME:-$HOME/.gradle}/caches/modules-2/files-2.1"
cp_add() { for j in $1; do [ -f "$j" ] && CP="$CP:$j"; done; }
CP=""; for a in lwjgl lwjgl-glfw lwjgl-opengl lwjgl-stb lwjgl-tinyfd; do cp_add "$C/org.lwjgl/$a/3.3.3/*/$a-3.3.3.jar"; cp_add "$C/org.lwjgl/$a/3.3.3/*/$a-3.3.3-natives-linux.jar"; done
LWJGL="${CP#:}"
export LIBGL_ALWAYS_SOFTWARE=1

# backdrops (baked once, like every early-window asset) + the press still for the static variant
ffmpeg -loglevel error -y -i "$OUT/press-20fps.sheet.png" -vf "crop=256:256:0:0" "$OUT/press-still.png"
node early/backdrop.mjs "$OUT"

# 1. own renderer: animated (3 s = 60 ticks) and static
FR=$(node -e "const j=require('./$OUT/press-20fps.sheet.json');console.log(j.cols+' '+j.frames+' '+j.cell[0])")
for mode in anim static; do
  rm -rf "$OUT/probe-$mode"; mkdir -p "$OUT/probe-$mode"
  BD="$OUT/backdrop.png"; [ "$mode" = static ] && BD="$OUT/backdrop.png"
  xvfb-run -a -s "-screen 0 854x480x24 -nocursor" java -cp "$LWJGL" early/EarlySpriteProbe.java "$BD" "$OUT/press-20fps.sheet.png" $FR "$OUT/probe-$mode" 60 $([ "$mode" = static ] && echo static) | tee "$OUT/probe-$mode.txt"
  ffmpeg -loglevel error -y -framerate 20 -i "$OUT/probe-$mode/t%04d.png" -c:v libx264 -pix_fmt yuv420p -crf 18 "$OUT/early-$mode.20fps.mp4"
  cp "$OUT/probe-$mode/t0030.png" "$OUT/early-$mode.png"
done

# 2. FML's real window with our strip shadowing fox_running.png
add() { for j in $1; do [ -f "$j" ] && FCP="$FCP:$j"; done; }
SH="$(mktemp -d)"; cp "$OUT/fml-strip.png" "$SH/fox_running.png"
FCP="$SH"
add "$C/net.neoforged.fancymodloader/loader/4.0.39/*/loader-4.0.39.jar"
add "$C/net.neoforged.fancymodloader/earlydisplay/4.0.39/*/earlydisplay-4.0.39.jar"
for a in lwjgl lwjgl-glfw lwjgl-opengl lwjgl-stb lwjgl-tinyfd; do add "$C/org.lwjgl/$a/3.3.3/*/$a-3.3.3.jar"; add "$C/org.lwjgl/$a/3.3.3/*/$a-3.3.3-natives-linux.jar"; done
add "$C/org.slf4j/slf4j-api/2.0.9/*/slf4j-api-2.0.9.jar"; add "$C/net.sf.jopt-simple/jopt-simple/5.0.4/*/jopt-simple-5.0.4.jar"
add "$C/com.electronwill.night-config/core/3.8.2/*/core-3.8.2.jar"; add "$C/com.electronwill.night-config/toml/3.8.2/*/toml-3.8.2.jar"
add "$C/org.apache.logging.log4j/log4j-api/2.22.1/*/log4j-api-2.22.1.jar"; add "$C/org.apache.logging.log4j/log4j-core/2.22.1/*/log4j-core-2.22.1.jar"
add "$C/cpw.mods/modlauncher/11.0.4/*/modlauncher-11.0.4.jar"; add "$C/cpw.mods/securejarhandler/3.0.8/*/securejarhandler-3.0.8.jar"
add "$C/org.apache.maven/maven-artifact/3.8.5/*/maven-artifact-3.8.5.jar"; add "$C/com.mojang/logging/1.2.7/*/logging-1.2.7.jar"; add "$C/com.google.guava/guava/32.1.2-jre/*/guava-32.1.2-jre.jar"
WORK="$(mktemp -d)"
xvfb-run -a -s "-screen 0 854x480x24 -nocursor" sh -c "
  java -cp '$FCP' early/FmlEarlyWindowShot.java '$WORK/game' 10 > '$WORK/log.txt' 2>&1 &
  JP=\$!
  i=0; while ! grep -q EARLY_WINDOW_SHOWN '$WORK/log.txt' 2>/dev/null; do sleep 0.2; i=\$((i+1)); [ \$i -gt 150 ] && break; done
  sleep 2
  ffmpeg -loglevel error -y -f x11grab -draw_mouse 0 -framerate 20 -video_size 854x480 -i \"\$DISPLAY\" -t 5 -c:v libx264 -pix_fmt yuv420p -crf 18 '$OUT/fml-real-window.20fps.mp4'
  wait \$JP
"
grep -E "EARLY_WINDOW_SHOWN|DONE|Exception" "$WORK/log.txt" | head -5
ffmpeg -loglevel error -y -ss 2.5 -i "$OUT/fml-real-window.20fps.mp4" -frames:v 1 "$OUT/fml-real-window.png"
rm -rf "$WORK" "$SH"
echo "done: $OUT"
