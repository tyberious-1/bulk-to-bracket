// Shared by parse.js, gamesum.js, howwon.js, timeline.js and plan_check.js. Commander decks are named after their commander (the .dck `Name=` line, which
// to_dck.js sets and the precon copies must set), and Forge prints that name as the player: "Ai(2)-Quintorius, History Chaser".
// A mirror pod (the same list four times) needs different names, so it adds a one-character suffix (" A", " #2"); that suffix
// is stripped here. An older mirror log used a short name with no comma ("Quintorius A"): it matches the card's first segment.
const playerName = (p) => p.replace(/^Ai\(\d+\)-/, "");
const baseName = (p) => playerName(p).replace(/\s+#?[A-Z0-9]$/, "");
// True when `card` (the name after "cast ") is that player's commander. The comma-less fallback only applies to short names,
// so "Saheeli, Sublime Artificer" in the Saheeli deck is not mistaken for the commander.
function isCommanderCast(player, card) {
  const b = baseName(player);
  return card === b || (!b.includes(",") && card.split(",")[0] === b);
}
// Short label for reports: the name before the first comma, keeping a one-character seat suffix, so a pod with the builder's
// deck ("... B") and the precon ("... P") of the same commander reports "Bello B" and "Bello P", not one merged "Bello".
function shortName(p) {
  const name = playerName(p);
  const suffix = (name.match(/\s#?[A-Z0-9]$/) || [""])[0];
  return name.split(",")[0].replace(/\s#?[A-Z0-9]$/, "") + suffix;
}
// The clock before a draw, in ms, for a log. FORGE_CLOCK_MS when set (run_sim.sh sets it from FORGE_OPTS "-c <seconds>").
// A parser run by hand on an old log has no env: games that hit the clock all end on exactly the same whole-second time, the
// longest in the log, so two or more such games name the clock; otherwise it is Forge's default 120 s. (Before 2026-11-26 a
// hand run of a "-c 900" log called every game over 120 s a timeout: 13 of 16 in one pod, really 2.)
function clockMs(logText) {
  if (Number(process.env.FORGE_CLOCK_MS)) return Number(process.env.FORGE_CLOCK_MS);
  const ms = [...String(logText).matchAll(/^Game Result: .*? in (\d+) ms\./gm)].map((m) => Number(m[1]));
  const longest = ms.length ? Math.max(...ms) : 0;
  return longest > 120000 && longest % 1000 === 0 && ms.filter((x) => x === longest).length >= 2 ? longest : 120000;
}
module.exports = { playerName, baseName, isCommanderCast, shortName, clockMs };
