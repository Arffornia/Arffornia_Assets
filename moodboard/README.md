# Moodboard: the Arffornia DA library

Where the art direction is collected before it is decided. Links and our own renders only
(see SPEC D7): no third-party images are committed here.

## What Brian asked for (Chantier 0 notes, 2026-10-31)
- Machines in a **futuristic Satisfactory** style: big, impressive multiblocks that take room,
  so that a base becomes a huge factory. Not over-powered in speed.
- Reference inside the pack: **Oritech** (its particle accelerator and machine silhouettes).
- Watch multiblock performance and chunk borders (a machine straddling two chunks).
- The 3D models of the loading/title previews are "what I wanted"; the block style itself is
  not chosen yet.

## References (why each one)
| Reference | Take | Leave |
|---|---|---|
| [Satisfactory](https://www.satisfactorygame.com/) machine line-up | readable silhouettes per tier, orange/grey industrial palette, scale | photoreal materials (we are voxel) |
| [Oritech](https://modrinth.com/mod/oritech) (in the pack) | futurist multiblocks in Minecraft, the particle accelerator ring | its exact colours (we need our own identity) |
| [Mekanism](https://modrinth.com/mod/mekanism) (in the pack) SPS and fusion reactor | glass + glow showing the process inside | busy GUIs |
| [Create](https://modrinth.com/mod/create) (in the pack) | visible motion: you see the machine work | brass/wood palette |
| [shapez 2](https://shapez2.com/) | clean futurist factory, colour-coded flow, calm UI | — |
| [Dyson Sphere Program](https://store.steampowered.com/app/1366540/) | the "line to orbit" fantasy (our Space Elevator) | — |
| Our previews (`out/scenes/factory-line/*`) | the night/maquette looks Brian liked | — |

## Palette in use (night look)
| Token | Hex | Role |
|---|---|---|
| body | `#2a3640` | machine shells |
| body2 | `#33424e` | secondary parts |
| orange | `#e0703c` | heat, power, the brand (logo table) |
| teal | `#2fd1c1` | logic, light strips, "running" |
| warn | `#f2b134` | hazard stripes |
| steel | `#8a9aa6` | moving metal |

## Next card (proposed)
Three block styles for the same Smelter, rendered by this pipeline at the same camera:
Satisfactory-futurist (current), clean industrial (shapez-like), chunky voxel (vanilla-adjacent).
Brian picks one; the others stay here.
