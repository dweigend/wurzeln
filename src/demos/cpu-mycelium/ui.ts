/**
 * Owns DOM access and button listeners for the CPU mycelium demo.
 * Simulation and rendering state stay outside; callbacks report user intent and
 * the returned setters update only visible UI state.
 */

import { formatInteger, getRequiredElement } from '../../lib/ui.ts';

type CpuMyceliumUiCallbacks = Readonly<{
  onRestart: () => void;
  onTogglePause: () => void;
}>;

type CpuMyceliumStats = Readonly<{
  tipCount: number;
  edgeCount: number;
  fusionCount: number;
  seed: number;
}>;

export type CpuMyceliumUi = Readonly<{
  canvas: HTMLCanvasElement;
  setPaused: (paused: boolean) => void;
  setStats: (stats: CpuMyceliumStats) => void;
  dispose: () => void;
}>;

export function createDemoUi(callbacks: CpuMyceliumUiCallbacks): CpuMyceliumUi {
  const canvas = getRequiredElement('scene', HTMLCanvasElement);
  const restartButton = getRequiredElement('restart-button', HTMLButtonElement);
  const pauseButton = getRequiredElement('pause-button', HTMLButtonElement);
  const tipCount = getRequiredElement('tip-count', HTMLElement);
  const edgeCount = getRequiredElement('edge-count', HTMLElement);
  const fusionCount = getRequiredElement('fusion-count', HTMLElement);
  const seedValue = getRequiredElement('seed-value', HTMLElement);

  restartButton.addEventListener('click', callbacks.onRestart);
  pauseButton.addEventListener('click', callbacks.onTogglePause);

  return {
    canvas,
    setPaused: (paused): void => {
      pauseButton.textContent = paused ? 'Weiter' : 'Pausieren';
    },
    setStats: (stats): void => {
      tipCount.textContent = formatInteger(stats.tipCount);
      edgeCount.textContent = formatInteger(stats.edgeCount);
      fusionCount.textContent = formatInteger(stats.fusionCount);
      seedValue.textContent = formatInteger(stats.seed);
    },
    dispose: (): void => {
      restartButton.removeEventListener('click', callbacks.onRestart);
      pauseButton.removeEventListener('click', callbacks.onTogglePause);
    },
  };
}
