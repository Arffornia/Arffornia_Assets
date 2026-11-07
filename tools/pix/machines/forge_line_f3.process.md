# Forge line F3 (tier 2): process sheet

Concept r5 F3 (reheating furnace, hammer, rolling mill, plate stack). Ingots in, plates out.

| Step | What happens | Real-world basis | Part in the model | Animation |
|---|---|---|---|---|
| Power in | a shaft enters at the back (rotation port) | line shafting | port collar, gearbox | shaft turns |
| Distribution | the gearbox output drives a roller chain, a belt up to the hammer cam, a belt to the mill | belt and chain drives in 19th c. mills | sprockets, pulleys, chain, belts | all turn at declared ratios |
| Fuel in | coal slides down an inclined chute into the furnace firebox | gravity-fed coal chute | chute from the fuel port | firebox glow |
| Load | an ingot enters the reheating furnace (west port) | reheating furnace | furnace door, glowing mouth | |
| Heat | the ingot comes out glowing and rolls along live rollers | live roller table | rollers driven by the chain | rollers turn, billet travels |
| Forge | a cam lifts the hammer ram and lets it fall on the billet; three blows flatten it | cam-lifted drop hammer (trip hammer, vertical) | frame, guides, ram with tappet arm, cam on a shaft | ram rises with the cam, drops on release |
| Roll | two rolls, geared together, squeeze the billet into a plate | two-high rolling mill with pinion stand | housing, rolls, pinion gears | rolls counter-rotate |
| Output | plates stack on the exit table (east port) | cooling bed | plate stack, port | billet lands on the stack |
| Byproduct | flue gas | | furnace stack | smoke, sparks at each blow |

Checks:
1. Material path: west port, furnace, rollers, anvil, rolls, stack, east port. Each step has a part and motion. Pass.
2. Power through ports only: one rotation port, everything turning is linked by chain, belts, gears or the gearbox drive. Pass.
3. Plausibility: coal and fire stay inside the brick furnace; the hammer falls by gravity; the cam only lifts;
   the rolls grip in the direction of travel (bottom roll top surface moves east, top roll opposite). Pass.
4. Tier 2: one line, one furnace, no doubling. Pass.

Loop 1: passed.
