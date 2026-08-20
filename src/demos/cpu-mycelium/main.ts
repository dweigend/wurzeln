/**
 * Coordinates the deterministic CPU mycelium demo and its render loop.
 * Simulation, view, scene, and UI own their details and resources; this module
 * owns only mutable demo state and lifecycle ordering.
 */

import './styles.css';

import { Timer } from 'three';
import { MyceliumSimulation } from '../../lib/mycelium-simulation.ts';
import { MyceliumView } from './mycelium-view.ts';
import { createScene, type CpuMyceliumScene } from './scene.ts';
import { createDemoUi, type CpuMyceliumUi } from './ui.ts';

const INITIAL_SEED = 20_260_819;
const STATS_REFRESH_SECONDS = 0.15;

type DemoRuntime = {
  ui: CpuMyceliumUi;
  sceneContext: CpuMyceliumScene;
  simulation: MyceliumSimulation;
  view: MyceliumView;
  timer: Timer;
  seed: number;
  paused: boolean;
  statsElapsedSeconds: number;
};

function start(): () => void {
  let runtime: DemoRuntime;
  const ui = createDemoUi({
    onRestart: (): void => restartSimulation(runtime),
    onTogglePause: (): void => setPaused(runtime, !runtime.paused),
  });
  runtime = createRuntime(ui);
  const resize = (): void => runtime.sceneContext.resize();
  window.addEventListener('resize', resize);
  resize();
  updateStats(runtime);
  runtime.sceneContext.renderer.setAnimationLoop((timeMilliseconds) => {
    renderFrame(runtime, timeMilliseconds);
  });
  return (): void => disposeRuntime(runtime, resize);
}

function createRuntime(ui: CpuMyceliumUi): DemoRuntime {
  const sceneContext = createScene(ui.canvas);
  const simulation = new MyceliumSimulation({ seed: INITIAL_SEED });
  const timer = new Timer();
  timer.connect(document);
  return {
    ui,
    sceneContext,
    simulation,
    view: new MyceliumView(sceneContext.scene, {
      maxEdges: simulation.config.maxEdges,
      maxTips: simulation.config.maxActiveTips,
    }),
    timer,
    seed: INITIAL_SEED,
    paused: false,
    statsElapsedSeconds: STATS_REFRESH_SECONDS,
  };
}

function renderFrame(runtime: DemoRuntime, timeMilliseconds: number): void {
  runtime.timer.update(timeMilliseconds);
  const deltaSeconds = runtime.timer.getDelta();
  if (!runtime.paused) runtime.simulation.update(deltaSeconds);
  runtime.view.update(runtime.simulation);
  runtime.sceneContext.controls.update();
  runtime.sceneContext.renderer.render(runtime.sceneContext.scene, runtime.sceneContext.camera);
  runtime.statsElapsedSeconds += deltaSeconds;
  if (runtime.statsElapsedSeconds < STATS_REFRESH_SECONDS) return;
  runtime.statsElapsedSeconds = 0;
  updateStats(runtime);
}

function restartSimulation(runtime: DemoRuntime): void {
  runtime.seed += 1;
  runtime.simulation.reset(runtime.seed);
  runtime.view.reset();
  updateStats(runtime);
}

function setPaused(runtime: DemoRuntime, paused: boolean): void {
  runtime.paused = paused;
  runtime.ui.setPaused(paused);
}

function updateStats(runtime: DemoRuntime): void {
  runtime.ui.setStats({
    tipCount: runtime.simulation.activeTipCount,
    edgeCount: runtime.simulation.edges.length,
    fusionCount: runtime.simulation.fusionCount,
    seed: runtime.seed,
  });
}

function disposeRuntime(runtime: DemoRuntime, resize: () => void): void {
  runtime.sceneContext.renderer.setAnimationLoop(null);
  window.removeEventListener('resize', resize);
  runtime.ui.dispose();
  runtime.timer.dispose();
  runtime.view.dispose();
  runtime.sceneContext.dispose();
}

const dispose = start();
window.addEventListener('pagehide', dispose, { once: true });
