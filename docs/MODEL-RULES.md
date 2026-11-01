# Model rules: what the lint enforces and why

Status: **proposed**, part of the art direction chantier (round 1; mechanics added in round 2, 2026-11-01). Owner: agents. Date: 2026-10-31.

Brian's feedback on the first mocks: some parts are not physically plausible, and some go
through other parts. The lint (`npm run lint`, `tools/lint/`) turns that feedback into checks. It
gates every model in `models/` and `concepts/` in CI (`.github/workflows/lint.yml`). Each model
gets a report (`out/lint/<id>.md` + `.json`) and a picture of the faulty parts (`out/lint/<id>.png`).
`out/lint/README.md` is the summary, which also goes into the CI job summary.

A model with `arffornia.status: "mock"` (the six legacy mocks) is reported but does not gate.
Every other status gates. `--strict` makes mocks gate too.

## Checks

| Check | Rule | Why |
|---|---|---|
| `overlap` | Two parts may touch, or one may sit at most **1 px** into another (a seat or a weld). Deeper overlap is an error unless the two are one compound (`name#n`) or a waiver gives the reason. | Parts that pass through each other are what Brian saw. A 1 px seat is how real parts are mounted. |
| `hidden` (warn) | A part entirely inside another one (unless the outer part is `glass*`). | It is invisible and costs triangles. |
| `zfight` | Two drawn faces that are coplanar, point the same way and overlap. Bottom faces lying on the ground are exempt. | They flicker in game. |
| `floating` | Every part must connect, through touching or seated parts, to something on the ground (y = 0). | Floating parts are the "not physical" problem. |
| `stability` | The centre of mass (by volume) must sit over the ground contact hull. | A machine that would tip over looks wrong even when every part is connected. |
| `footprint` | Everything stays inside the claimed block grid (`arffornia.footprint` × `height`), at rest **and** at every animation sample. | Multiblocks are placed on the grid. A part that leaves it clips into the neighbour. |
| `sweep` | Animations are sampled at 80 Hz. Two parts that move relative to each other must never interpenetrate by more than the seat, and nothing may come loose at any 20 Hz tick. The report gives the time. | Arms through housings and pistons through lids happen only in motion. A static check cannot see them. |
| `cantilever` | A part that does not rest on the ground is judged against what holds it (its supports: the neighbours that still reach the ground without it). **Overhang**: its horizontal reach past the contact patch, against its vertical thickness: warning above **6:1**, error above **10:1** (overhangs under 4 px are ignored). **Seat load**: the volume it carries (itself and every part that hangs only through it) × the lever arm from their centre of mass to the patch, divided by the patch area × the patch depth (its vertical extent or its length along the lever, whichever is larger), in px: warning above **60**, error above **150**. Checked at rest and at 4 Hz in every animation. | Brian: a long arm on a 1 px seat passed the old lint. The overhang rule catches thin beams; the seat rule catches a heavy part hung on an edge or a corner, which a slender-ratio rule cannot see. Bigger parts need proportionally bigger seats, as in real structures (the square-cube law). |
| `belt` | Belts and gears declared in `arffornia.belts` / `arffornia.gears`. Pulleys turn about parallel axes in one plane (1°, 1.5 px). Every straight run lies in that plane and is **tangent** to two pulleys: the distance from each pulley centre to the run's inner face equals the radius within **0.75 px**, and the run reaches its tangent point (1 px gap at most). Each pulley has a run arriving and one leaving. **Wrap angle** on the small pulley, `180° − 2·asin((R − r)/C)` (crossed: `180° + 2·asin((R + r)/C)`): warning under **150°**, error under **120°**. The pulleys must not touch. **Speed**: when the drive is animated, rim speeds `ω·r` match within **5%**, in the same direction for an open belt and the opposite one for a crossed belt or meshing gears. Gear centres sit at the sum of the pitch radii (1.5 px). | A belt that does not touch its wheel, or a wheel that turns faster than its belt allows, is the "not real machinery" look. 120° is the usual minimum wrap for V-belts; flat belts want 150° or more. |
| `kinematics` | Joints declared in `arffornia.joints` (`revolute`, `prismatic`, `fixed` or `free` with a why). A hinge only turns about its axis (0.5°), with no translation (0.25 px), inside `min`/`max`. A slide only translates along its axis, inside its limits. A hinge pivot sits on a part that moves **and** a part that holds it (1.5 px): no hinges in thin air. **Scale** over 5% is an error (parts do not grow) unless the joint is `free` with a reason (a flame, a glow, a fluid). No part moves more than **2 px in one 1/80 s step** (no step keys, no teleport). A looping animation closes (0.5 px at the seam). A `deploy`/`setup`/`unfold` animation ends on the bind pose and starts where `packaged` ends. An animated bone with no declared joint is a warning. | Brian asked for animations that are possible: no parts through each other (the `sweep`), but also no arms that bend the wrong way, stretch, pop or snap. Oritech's machines deploy from a `packaged` pose and then blend into `idle` (5 ticks), so the two ends of the deploy must meet those poses. |
| `deploy` | A machine (`arffornia.kind` not `scenery`) bigger than one block, with `arffornia.tier` ≥ 2 (`deployFromTier`), has a `packaged` animation and a `deploy` animation. Without `arffornia.tier` it is a warning: the rule cannot be checked. | Brian's decision P6 (2026-11-01): every multiblock from tier 2 unfolds when it forms, like Oritech's machines. The `kinematics` check then verifies the two seams. |
| `ports` | Each port in `arffornia.ports` (`id`, `kind`, `face`, `cell`) has a collar element `port_<id>`. The collar is flush with the boundary, centred on the block cell within 1 px, and 6–16 px across. | Belts and pipes from the next block must meet the machine. Same-size collars read at a glance. |
| `texel` | Every face is mapped at **32 px per block** (D5, chosen by Brian). An error past ±25% of that density, a warning past ±10%. | Mixed texel density is the first thing that makes a model look cheap. |
| `budget` | Triangles, elements, animated bones and texture pixels per size class (`tools/lint/rules.json`). A warning at 80%. | A factory has dozens of each machine on screen. |
| `meta` | The footprint is declared, every waiver has a reason, and no waiver is unused. | Waivers must stay honest. |

## Conventions the checks rely on

- **Compound solids**: elements named `stem#k` are one solid. A cylinder (n-gon prism) built from
  overlapping boxes, a band wrapped around a tank, a crown on a furnace. They may overlap each
  other.
- **Waivers** in the model's `arffornia.lint.allow`:
  `{ "a": "glass_tube*", "b": "coil*", "check": "overlap"|"sweep" (optional), "why": "..." }`.
  The `why` is required and is printed in review. Example: "the vacuum tube runs through the
  bore of each magnet".
- **Bind pose is a real pose.** An idle machine shows it in game, so it must pass too. The
  animation at t = 0 is not enough.
- **Glass** (`glass*`) is translucent in the renderer. A part inside glass is not "hidden".
- **Glowmask**: emissive texels live in `<id>_glowmask.png` next to the texture (GeckoLib's
  convention). The albedo carries the material: no PBR in game.

- **Joints**: `arffornia.joints = { "<bone>": { "type": "revolute", "axis": "x", "min": -10, "max": 90 } }`.
  Angles in degrees and distances in px, in the bone's own channel values (what Blockbench shows).
  `min`/`max` are optional (a shaft turns forever). `"free"` needs a `"why"`.
- **Belts**: `arffornia.belts = [{ "id": "main", "pulleys": ["motor_pulley", { "part": "flywheel", "r": 9 }], "segments": ["belt_top", "belt_bottom"], "crossed": false }]`.
  A pulley is an element, a compound stem or a bone. Its axis is the direction all its boxes share;
  its radius is the apothem (half the width across flats) unless `r` (px) is given.
- **Gears**: `arffornia.gears = [{ "a": "gear_a", "b": "gear_b", "ra": 6, "rb": 3 }]`, pitch radii optional.
- **Cantilever waivers** name one part: `{ "a": "antenna*", "check": "cantilever", "why": "..." }`.

## Thresholds

`tools/lint/rules.json`. Changing a threshold is an art direction decision: the PR says why.
Unit tests: `npm test` (each check catches its defect on a synthetic model, and a clean model
passes).

## Not covered yet

- Belts that wrap around a pulley as a chain of rotated boxes (only the straight runs are checked)
  and drive chains with sprockets (declare them as a belt with `r` at the pitch radius).
- Inverse kinematics: the lint checks declared limits, not that an arm can reach its target. A
  2-link arm can be checked by hand with the law of cosines, as Create's mechanical arm does.
- Real dynamics (mass, inertia, torque). The seat-load index is a heuristic for the eye, not a
  stress in MPa.
- Opening the files in the Blockbench desktop app. The pipeline reads `.bbmodel` directly, so
  element rotations follow `render/bbmodel.js`.
