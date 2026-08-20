# Procedural Root Experiments

Independent Three.js experiments for generative root and mycelium networks.

Open <http://127.0.0.1:5173/> for the plain experiment index.

## Experiments

- `/demos/cpu-mycelium/`: deterministic CPU branching and stable tip fusion.
- `/demos/procedural-network/`: connected point topology with shader-only
  WebGL2 growth, reinforcement, and retraction for up to 2,000 points.

The procedural network generates immutable point and connection data once.
One instanced low-poly tube draw call animates all tendrils analytically in
dedicated GLSL3 shader files. Volume scaling updates a uniform and does not
rebuild the topology.

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
