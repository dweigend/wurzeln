/**
 * Owns controls, diagnostics, and DOM listeners for the procedural-network demo.
 * Network creation and rendering stay outside; callbacks expose validated user
 * intent while setters update only presentation state.
 */

import { VOLUME_POINT_COUNT_LIMITS } from '../../lib/settings.ts';
import { formatDecimal, formatInteger, getRequiredElement } from '../../lib/ui.ts';

type ProceduralNetworkUiCallbacks = Readonly<{
  onRestart: () => void;
  onTogglePause: () => void;
  onPointCountChange: (pointCount: number) => void;
  onVolumeSizeChange: (sizeMeters: number) => void;
}>;

type ProceduralNetworkStats = Readonly<{
  framesPerSecond: number;
  p95Milliseconds: number;
  hyphaCount: number;
  reinforcedHyphaCount: number;
  triangleCount: number;
  generationMilliseconds: number;
}>;

export type ProceduralNetworkUi = Readonly<{
  canvas: HTMLCanvasElement;
  getPointCount: () => number;
  getVolumeSizeMeters: () => number;
  setPaused: (paused: boolean) => void;
  setStats: (stats: ProceduralNetworkStats) => void;
  dispose: () => void;
}>;

export function createDemoUi(callbacks: ProceduralNetworkUiCallbacks): ProceduralNetworkUi {
  const elements = getElements();
  const previewPointCount = (): void => {
    elements.pointValue.value = elements.pointSlider.value;
  };
  const changePointCount = (): void => {
    callbacks.onPointCountChange(Number(elements.pointSlider.value));
  };
  const changeVolumeSize = (): void => {
    const sizeMeters = Number(elements.volumeSlider.value);
    elements.volumeValue.value = `${formatDecimal(sizeMeters)} m`;
    callbacks.onVolumeSizeChange(sizeMeters);
  };

  elements.pointSlider.min = String(VOLUME_POINT_COUNT_LIMITS.minimum);
  elements.pointSlider.max = String(VOLUME_POINT_COUNT_LIMITS.maximum);
  previewPointCount();
  elements.volumeValue.value = `${formatDecimal(Number(elements.volumeSlider.value))} m`;
  elements.restartButton.addEventListener('click', callbacks.onRestart);
  elements.pauseButton.addEventListener('click', callbacks.onTogglePause);
  elements.pointSlider.addEventListener('input', previewPointCount);
  elements.pointSlider.addEventListener('change', changePointCount);
  elements.volumeSlider.addEventListener('input', changeVolumeSize);

  return {
    canvas: elements.canvas,
    getPointCount: (): number => Number(elements.pointSlider.value),
    getVolumeSizeMeters: (): number => Number(elements.volumeSlider.value),
    setPaused: (paused): void => {
      elements.pauseButton.textContent = paused ? 'Weiter' : 'Pausieren';
    },
    setStats: (stats): void => setStats(elements, stats),
    dispose: (): void => {
      elements.restartButton.removeEventListener('click', callbacks.onRestart);
      elements.pauseButton.removeEventListener('click', callbacks.onTogglePause);
      elements.pointSlider.removeEventListener('input', previewPointCount);
      elements.pointSlider.removeEventListener('change', changePointCount);
      elements.volumeSlider.removeEventListener('input', changeVolumeSize);
    },
  };
}

type ProceduralNetworkElements = Readonly<{
  canvas: HTMLCanvasElement;
  volumeSlider: HTMLInputElement;
  volumeValue: HTMLOutputElement;
  pointSlider: HTMLInputElement;
  pointValue: HTMLOutputElement;
  restartButton: HTMLButtonElement;
  pauseButton: HTMLButtonElement;
  fpsValue: HTMLElement;
  p95Value: HTMLElement;
  hyphaValue: HTMLElement;
  cordValue: HTMLElement;
  triangleValue: HTMLElement;
  generationValue: HTMLElement;
}>;

function getElements(): ProceduralNetworkElements {
  return {
    canvas: getRequiredElement('scene', HTMLCanvasElement),
    volumeSlider: getRequiredElement('volume-slider', HTMLInputElement),
    volumeValue: getRequiredElement('volume-value', HTMLOutputElement),
    pointSlider: getRequiredElement('point-slider', HTMLInputElement),
    pointValue: getRequiredElement('point-value', HTMLOutputElement),
    restartButton: getRequiredElement('restart-button', HTMLButtonElement),
    pauseButton: getRequiredElement('pause-button', HTMLButtonElement),
    fpsValue: getRequiredElement('fps-value', HTMLElement),
    p95Value: getRequiredElement('p95-value', HTMLElement),
    hyphaValue: getRequiredElement('hypha-value', HTMLElement),
    cordValue: getRequiredElement('cord-value', HTMLElement),
    triangleValue: getRequiredElement('triangle-value', HTMLElement),
    generationValue: getRequiredElement('generation-value', HTMLElement),
  };
}

function setStats(elements: ProceduralNetworkElements, stats: ProceduralNetworkStats): void {
  elements.fpsValue.textContent = formatDecimal(stats.framesPerSecond);
  elements.p95Value.textContent = `${formatDecimal(stats.p95Milliseconds)} ms`;
  elements.hyphaValue.textContent = formatInteger(stats.hyphaCount);
  elements.cordValue.textContent = formatInteger(stats.reinforcedHyphaCount);
  elements.triangleValue.textContent = formatInteger(stats.triangleCount);
  elements.generationValue.textContent = `${formatDecimal(stats.generationMilliseconds)} ms`;
}
