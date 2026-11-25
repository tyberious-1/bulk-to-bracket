#!/bin/bash
# Usage (repo root): bash dev/tools/forge-sim/run_sim.sh <games> <log out> <deck.dck> <deck.dck> [more decks...]
# 2 decks = a duel; 4 decks = a four-player Commander pod. Decks live in dev/tools/forge-sim/work/decks (git-ignored).
# Extra Forge sim options go in FORGE_OPTS (e.g. FORGE_OPTS="-mc on -c 600").
# Stall watchdog: if the log stops growing for FORGE_STALL seconds (default 600) the container is stopped and the parser still
# runs on what was written (an unfinished last game is dropped). It counts awake time only (it adds the poll interval each
# time the size is unchanged), so a sleeping laptop does not trip it. The `timeout 3000` inside the container did NOT protect
# the 2026-11-17 pre-con pod: game 7 stalled before turn 1 and that timeout never fired (the container's clock does not
# advance while the laptop sleeps). FORGE_POLL (default 30) is the poll interval in seconds.
# Needs the image: docker build -t btb-forge dev/tools/forge-sim
W="$(pwd)/dev/tools/forge-sim/work"
GAMES="$1"; LOG="$2"; shift 2
DECKS=""; for d in "$@"; do DECKS="$DECKS $d"; done
STALL="${FORGE_STALL:-600}"; POLL="${FORGE_POLL:-30}"
NAME="btb-forge-run-$$"
trap 'docker stop "$NAME" >/dev/null 2>&1' EXIT INT TERM
: > "$LOG"
docker run --rm --name "$NAME" -v "$W/decks:/root/.forge/decks/commander" btb-forge -c "cd /forge && timeout ${FORGE_TIMEOUT:-21600} java -Djava.awt.headless=true -jar forge-gui-desktop-2.0.16-jar-with-dependencies.jar sim -d $DECKS -f commander -n $GAMES $FORGE_OPTS 2>&1" > "$LOG" &
DPID=$!
last=-1; idle=0
while kill -0 "$DPID" 2>/dev/null; do
  sleep "$POLL"
  size=$(wc -c < "$LOG" | tr -d ' ')
  if [ "$size" = "$last" ]; then idle=$((idle + POLL)); else idle=0; last="$size"; fi
  if [ "$idle" -ge "$STALL" ]; then
    echo "run_sim: log did not grow for ${idle}s (limit ${STALL}s); stopping the container. Results cover the games finished so far." >&2
    docker stop "$NAME" >/dev/null 2>&1
    break
  fi
done
wait "$DPID" 2>/dev/null
CLK=$(echo "$FORGE_OPTS" | sed -n 's/.*-c \([0-9]*\).*/\1/p'); [ -n "$CLK" ] && export FORGE_CLOCK_MS=$((CLK*1000))
node dev/tools/forge-sim/parse.js "$LOG"
