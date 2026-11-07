# Smelter S3 (tier 2, indirect-fired rotary kiln): process sheet

Concept r5 S3, built on smelter_kiln_v2. Validated by Brian on 2026-11-07.

| Step | What happens | Real-world basis | Part in the model | Animation |
|---|---|---|---|---|
| Power in | a shaft enters at the west port, a gearbox reduces it 2:1, the pinion turns the girth gear | kiln drive train | port collar, gearbox, pinion (8 teeth), ring gear (24 teeth) | shaft, pinion and drum turn at proven ratios |
| Support | the drum rides on two tyres over four rollers | riding rings and support rollers | tyres, rollers on beds | rollers turn, no slip (proven) |
| Load | ore enters the hopper on the feed hood (up port) and tumbles down the tilted drum | rotary kiln feed end | hopper, feed spout | drum turns |
| Fuel | coal slides by gravity down an inclined chute at the back onto the grate | gravity-fed chute | intake (north port), chute | |
| Heat | a row of flames under the drum heats the shell from below | indirect-fired rotary kiln | firebrick trough, grate, flames | flames flicker, sparks |
| Output | hot metal leaves the low end through the discharge hood into the ingot crate (east port) | discharge hood | hood, chute, stream, crate | stream pours |
| Byproduct | flue gas leaves by the hood flue and the feed-end vent | | flue, vent | smoke |
| Deploy | the discharge chute folds against the hood for transport, the fire is out | | chute hinge | chute lowers, fire lights, drum rolls home |

Checks: material path readable (hopper, drum, hood, crate); power only through the shaft port, every
turning part linked and proven; flames stay inside brick, no water near the melt; tier 2, one drum.

Loops: 1) firebox too small and hidden by its door; 2) the coal hopper hid the flames (moved to the back);
3) review: the coal screw had no drive (became a gravity chute), the pinion phase cut the ring gear (fixed,
the lint now proves it), the hopper lid was 1 px thick (replaced by an open intake).
