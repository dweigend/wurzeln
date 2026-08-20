# Wurzeln

Three small, independent Three.js demos for root and mycelium networks. The
repository intentionally keeps shared technical code small and leaves concrete
scene, UI, and rendering decisions inside each demo.

## Run

```bash
bun install
bun run dev
```

Open <http://127.0.0.1:5173/> for the demo index.

| Route | Purpose |
| --- | --- |
| `/demos/cpu-mycelium/` | Deterministic CPU branching and stable tip fusion |
| `/demos/procedural-network/` | WebGL2 volume network with GPU growth animation |
| `/demos/mycelium-landscape/` | WebGL2 terrain, instanced trees, and underground mycelium |

The two WebGL2 demos retain the Three.js WebXR button. WebXR requires a
compatible browser, device, and secure context or localhost.

## Validate

```bash
bun run check
bun run build
```

`check` runs strict TypeScript validation and the Bun tests.

## Architecture

```text
src/
├── lib/                         shared contracts and technical core
│   ├── settings.ts             immutable network contracts
│   ├── network-generator.ts    CPU topology and render-data generation
│   ├── network-geometry.ts     shared instanced GPU geometry
│   ├── mycelium-simulation.ts  CPU branching simulation
│   ├── scene.ts                small viewport/control helpers
│   └── ui.ts                   small DOM/format helpers
└── demos/
    ├── cpu-mycelium/            concrete CPU demo adapters
    ├── procedural-network/     concrete volume-network adapters
    └── mycelium-landscape/     concrete terrain/tree/network adapters
```

Each demo follows the same lifecycle without a generic demo manager:

```text
settings or UI input
  → immutable CPU data
  → concrete view adapters
  → render loop
  → dispose()
```

`main.ts` coordinates mutable runtime state. `scene.ts` owns the renderer,
camera, controls, WebXR button, and viewport. `ui.ts` owns DOM listeners.
Concrete views own the scene nodes, geometries, materials, textures, and their
`dispose()` lifecycle.

## Contracts

`NetworkGenerationSettings` is a discriminated union:

- `kind: 'volume'` creates deterministic points inside a normalized volume.
- `kind: 'points'` accepts explicit points and resource origins for landscapes.

Both variants return the same readonly `GeneratedNetwork` contract. Typed
arrays are written during generation and treated as immutable after upload.
External assets are validated when loaded before their data enters a view.

The landscape uses one immutable height field for terrain geometry, tree
placement, and underground point placement. CPU generation and GPU rendering
therefore share the same world-space data.

## Performance contracts

- CPU mycelium updates at a fixed simulation rate and renders bounded
  `InstancedMesh` buffers for edges and active tips.
- Both dense-network demos build topology only when settings change.
- Network growth runs in GLSL; there are no per-hypha JavaScript frame updates.
- Each network is rendered as one instanced mesh and therefore one draw call.
- Landscape trees share geometries and materials through instancing.
- GPU resources are created and disposed by the adapter that owns them.

These are architecture constraints, not optional later optimizations.

## Scope and limits

- The project contains demos, not a reusable world engine or editor.
- There is no manager, registry, factory, persistence, or runtime schema layer.
- Generated topology is CPU work and can pause briefly at the largest settings.
- Rendering requires WebGL2; WebGPU is intentionally not implemented.
- WebXR availability and performance have not been validated on every headset.
- Visibility toggles affect only the corresponding rendered layer. Hidden world
  data remains loaded until the world is rebuilt or the demo is disposed.

## Asset and license

The local **Birch Trees** asset is by Quaternius and distributed under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). It was downloaded
from [Poly Pizza](https://poly.pizza/m/R7qMWzb7nk). No attribution is legally
required, but the source is retained here for provenance.
