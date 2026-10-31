# Model rules: what the lint enforces and why

Status: **proposed**, part of the art direction chantier (round 1). Owner: agents. Date: 2026-10-31.

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

## Thresholds

`tools/lint/rules.json`. Changing a threshold is an art direction decision: the PR says why.
Unit tests: `npm test` (each check catches its defect on a synthetic model, and a clean model
passes).

## Not covered yet

- Cantilever strength (a long arm held by a 1 px seat passes). A contact-area rule is the next step.
- Belts and drive chains as tangents between two wheels (rotated boxes). This needs a tangent
  helper in the kit.
- Opening the files in the Blockbench desktop app. The pipeline reads `.bbmodel` directly, so
  element rotations follow `render/bbmodel.js`.
