/**
 * Vite multi-page configuration for independent experiment entry points.
 * Each HTML file is built at the same path used by the development server.
 */

import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  appType: 'mpa',
  build: {
    rolldownOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        cpuMycelium: resolve(import.meta.dirname, 'demos/cpu-mycelium/index.html'),
        proceduralNetwork: resolve(
          import.meta.dirname,
          'demos/procedural-network/index.html',
        ),
        myceliumLandscape: resolve(
          import.meta.dirname,
          'demos/mycelium-landscape/index.html',
        ),
      },
    },
  },
});
