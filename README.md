# Mycelium Growth Demo

A minimal Three.js experiment for deterministic branching growth and stable
tip-to-tip fusion.

The simulation runs on the CPU at a fixed 15 Hz. Rendering uses one GPU
`InstancedMesh` for all cylindrical edges and one for active tips. This keeps
the graph logic explicit while avoiding one Three.js mesh per branch.

## Run

```bash
bun install
bun run dev
```

Open <http://127.0.0.1:5173>.

## Validate

```bash
bun run check
bun run build
```

## Architecture

- `src/simulation/mycelium-simulation.ts`: deterministic graph growth,
  branching, attraction, and fusion.
- `src/rendering/mycelium-view.ts`: bounded GPU-instanced rendering.
- `src/main.ts`: scene bootstrap, controls, UI, lifecycle, and fixed-step loop.

A compute shader is intentionally not used. Stable junctions and graph edges
are simpler on the CPU at this scale, while Three.js materials and instancing
already execute the expensive vertex and fragment work on the GPU.
