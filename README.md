# Procedural Root Experiments

Independent Three.js experiments for generative root and mycelium networks.

Open <http://127.0.0.1:5173/> for the plain experiment index.

## Experiments

- `/demos/cpu-mycelium/`: deterministic CPU branching and stable tip fusion.
- `/demos/procedural-network/`: dense mycelial topology with shader-only WebGL2
  growth and traffic-driven remodeling for up to 2,000 points.
- `/demos/mycelium-landscape/`: four-phase WebGL2 MVP with Perlin terrain,
  instanced CC0 birches, dithered soil, and underground mycelial growth.

The procedural network generates one immutable local graph. Approximate flow
through that same graph produces continuous reinforcement values: frequently
used hyphae become cords while weak paths regress. One instanced low-poly tube
draw call animates all geometry analytically in dedicated GLSL3 shader files.
Volume scaling updates a uniform and does not rebuild the topology.

The landscape MVP uses one deterministic height field for the terrain surface,
tree placement, and underground point placement. Tree-root points seed the same
traffic-weighted graph used by the procedural network demo. All animated scene
materials live in dedicated GLSL3 files.

The local `Birch Trees` asset is by Quaternius, distributed under CC0 1.0, and
was downloaded from <https://poly.pizza/m/R7qMWzb7nk>.

## Original CPU Demo

The simulation runs on the CPU at a fixed 15 Hz. Rendering uses one GPU
`InstancedMesh` for all cylindrical edges and one for active tips. This keeps
the graph logic explicit while avoiding one Three.js mesh per branch.

## Run

```bash
bun install
bun run dev
```

Open one of the experiment routes listed above.

## Validate

```bash
bun run check
bun run build
```

## CPU Demo Architecture

- `src/simulation/mycelium-simulation.ts`: deterministic graph growth,
  branching, attraction, and fusion.
- `src/rendering/mycelium-view.ts`: bounded GPU-instanced rendering.
- `src/main.ts`: scene bootstrap, controls, UI, lifecycle, and fixed-step loop.

A compute shader is intentionally not used. Stable junctions and graph edges
are simpler on the CPU at this scale, while Three.js materials and instancing
already execute the expensive vertex and fragment work on the GPU.
