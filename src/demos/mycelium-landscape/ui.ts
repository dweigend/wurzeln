/**
 * Owns controls, layer toggles, diagnostics, and listeners for the landscape demo.
 * World generation and rendering stay outside; getters expose current user input
 * and setters update only DOM presentation state.
 */

import { formatDecimal, formatInteger, getRequiredElement } from '../../lib/ui.ts';

type LandscapeUiCallbacks = Readonly<{
  onSizeChange: () => void;
  onContentsChange: () => void;
  onLayersChange: () => void;
  onGrowNetwork: () => void;
  onNewLandscape: () => void;
}>;

type LandscapeSettings = Readonly<{
  sizeMeters: number;
  treeCount: number;
  pointCount: number;
}>;

type LayerVisibility = Readonly<{
  terrain: boolean;
  trees: boolean;
  subsurface: boolean;
  network: boolean;
}>;

type LandscapeStats = Readonly<{
  framesPerSecond: number;
  p95Milliseconds: number;
  treeCount: number;
  hyphaCount: number;
  triangleCount: number;
}>;

export type LandscapeUi = Readonly<{
  canvas: HTMLCanvasElement;
  getSettings: () => LandscapeSettings;
  getLayerVisibility: () => LayerVisibility;
  showNetwork: () => void;
  setStatus: (status: 'Aktualisiere …' | 'Fehler' | 'Live') => void;
  setStats: (stats: LandscapeStats) => void;
  dispose: () => void;
}>;

export function createDemoUi(callbacks: LandscapeUiCallbacks): LandscapeUi {
  const elements = getElements();
  const updateSize = (): void => {
    updateOutputs(elements);
    callbacks.onSizeChange();
  };
  const updateContents = (): void => {
    updateOutputs(elements);
    callbacks.onContentsChange();
  };
  const handlers = { ...callbacks, updateSize, updateContents };

  addEventListeners(elements, handlers);
  updateOutputs(elements);
  return {
    canvas: elements.canvas,
    getSettings: (): LandscapeSettings => ({
      sizeMeters: Number(elements.sizeSlider.value),
      treeCount: Number(elements.treeSlider.value),
      pointCount: Number(elements.pointSlider.value),
    }),
    getLayerVisibility: (): LayerVisibility => ({
      terrain: elements.terrainToggle.checked,
      trees: elements.treeToggle.checked,
      subsurface: elements.subsurfaceToggle.checked,
      network: elements.networkToggle.checked,
    }),
    showNetwork: (): void => { elements.networkToggle.checked = true; },
    setStatus: (status): void => { elements.statusValue.textContent = status; },
    setStats: (stats): void => setStats(elements, stats),
    dispose: (): void => removeEventListeners(elements, handlers),
  };
}

type LandscapeHandlers = LandscapeUiCallbacks & Readonly<{
  updateSize: () => void;
  updateContents: () => void;
}>;

type LandscapeElements = Readonly<{
  canvas: HTMLCanvasElement;
  sizeSlider: HTMLInputElement;
  sizeValue: HTMLOutputElement;
  treeSlider: HTMLInputElement;
  treeValue: HTMLOutputElement;
  pointSlider: HTMLInputElement;
  pointValue: HTMLOutputElement;
  terrainToggle: HTMLInputElement;
  treeToggle: HTMLInputElement;
  subsurfaceToggle: HTMLInputElement;
  networkToggle: HTMLInputElement;
  growNetworkButton: HTMLButtonElement;
  newLandscapeButton: HTMLButtonElement;
  statusValue: HTMLElement;
  fpsValue: HTMLElement;
  p95Value: HTMLElement;
  treeCountValue: HTMLElement;
  hyphaValue: HTMLElement;
  triangleValue: HTMLElement;
}>;

function getElements(): LandscapeElements {
  return {
    canvas: getRequiredElement('scene', HTMLCanvasElement),
    sizeSlider: getRequiredElement('size-slider', HTMLInputElement),
    sizeValue: getRequiredElement('size-value', HTMLOutputElement),
    treeSlider: getRequiredElement('tree-slider', HTMLInputElement),
    treeValue: getRequiredElement('tree-value', HTMLOutputElement),
    pointSlider: getRequiredElement('point-slider', HTMLInputElement),
    pointValue: getRequiredElement('point-value', HTMLOutputElement),
    terrainToggle: getRequiredElement('terrain-toggle', HTMLInputElement),
    treeToggle: getRequiredElement('tree-toggle', HTMLInputElement),
    subsurfaceToggle: getRequiredElement('subsurface-toggle', HTMLInputElement),
    networkToggle: getRequiredElement('network-toggle', HTMLInputElement),
    growNetworkButton: getRequiredElement('grow-network-button', HTMLButtonElement),
    newLandscapeButton: getRequiredElement('new-landscape-button', HTMLButtonElement),
    statusValue: getRequiredElement('status-value', HTMLElement),
    fpsValue: getRequiredElement('fps-value', HTMLElement),
    p95Value: getRequiredElement('p95-value', HTMLElement),
    treeCountValue: getRequiredElement('tree-count-value', HTMLElement),
    hyphaValue: getRequiredElement('hypha-value', HTMLElement),
    triangleValue: getRequiredElement('triangle-value', HTMLElement),
  };
}

function updateOutputs(elements: LandscapeElements): void {
  elements.sizeValue.value = `${elements.sizeSlider.value} m`;
  elements.treeValue.value = elements.treeSlider.value;
  elements.pointValue.value = elements.pointSlider.value;
}

function setStats(elements: LandscapeElements, stats: LandscapeStats): void {
  elements.fpsValue.textContent = formatDecimal(stats.framesPerSecond);
  elements.p95Value.textContent = `${formatDecimal(stats.p95Milliseconds)} ms`;
  elements.treeCountValue.textContent = formatInteger(stats.treeCount);
  elements.hyphaValue.textContent = formatInteger(stats.hyphaCount);
  elements.triangleValue.textContent = formatInteger(stats.triangleCount);
}

function addEventListeners(
  elements: LandscapeElements,
  handlers: LandscapeHandlers,
): void {
  elements.sizeSlider.addEventListener('input', handlers.updateSize);
  elements.treeSlider.addEventListener('input', handlers.updateContents);
  elements.pointSlider.addEventListener('input', handlers.updateContents);
  elements.terrainToggle.addEventListener('change', handlers.onLayersChange);
  elements.treeToggle.addEventListener('change', handlers.onLayersChange);
  elements.subsurfaceToggle.addEventListener('change', handlers.onLayersChange);
  elements.networkToggle.addEventListener('change', handlers.onLayersChange);
  elements.growNetworkButton.addEventListener('click', handlers.onGrowNetwork);
  elements.newLandscapeButton.addEventListener('click', handlers.onNewLandscape);
}

function removeEventListeners(
  elements: LandscapeElements,
  handlers: LandscapeHandlers,
): void {
  elements.sizeSlider.removeEventListener('input', handlers.updateSize);
  elements.treeSlider.removeEventListener('input', handlers.updateContents);
  elements.pointSlider.removeEventListener('input', handlers.updateContents);
  elements.terrainToggle.removeEventListener('change', handlers.onLayersChange);
  elements.treeToggle.removeEventListener('change', handlers.onLayersChange);
  elements.subsurfaceToggle.removeEventListener('change', handlers.onLayersChange);
  elements.networkToggle.removeEventListener('change', handlers.onLayersChange);
  elements.growNetworkButton.removeEventListener('click', handlers.onGrowNetwork);
  elements.newLandscapeButton.removeEventListener('click', handlers.onNewLandscape);
}
