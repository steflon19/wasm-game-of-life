import { Universe } from "wasm-game-of-life";
import { memory } from "wasm-game-of-life/wasm_game_of_life_bg";

const CELL_SIZE = 5; // px
const GRID_COLOR = "#161614";
const DEAD_COLOR = "#2c2a33";
const ALIVE_COLOR = "#706e66";

// Construct the universe, and get its width and height.
const universe = Universe.new();
const width = universe.width();
const height = universe.height();

const canvas = document.getElementById("game-of-life-canvas");
canvas.height = (CELL_SIZE + 1) * height + 1;
canvas.width = (CELL_SIZE + 1) * width + 1;

const ctx = canvas.getContext('2d');

const renderCyclesInput = document.getElementById("render-cycles");

// update numeric output when value changes
renderCyclesInput.oninput = function() {
    updateOuput()
};
const updateOuput = () => {
    let output = document.getElementById("render-cycles-numeric")
    output.innerHTML = renderCyclesInput.value
}

const killButton = document.getElementById("kill-button");
killButton.textContent = "☠️";
killButton.addEventListener("click", event => 
    kill());

const kill = () => {
    universe.kill_all();
}

const resetButton = document.getElementById("reset-button");
resetButton.textContent = "↩";

resetButton.addEventListener("click", event => 
    reset());

const reset = () => {
    pause();
    universe.reset()
    play();
};

const playPauseButton = document.getElementById("play-pause");

const play = () => {
  playPauseButton.textContent = "⏸";
  renderLoop();
};

const pause = () => {
  playPauseButton.textContent = "▶";
  cancelAnimationFrame(animationId);
  animationId = null;
};

playPauseButton.addEventListener("click", event => {
  if (isPaused()) {
    play();
  } else {
    pause();
  }
});

/// profiling
const fps = new class {
    constructor() {
      this.fps = document.getElementById("fps");
      this.frames = [];
      this.lastFrameTimeStamp = performance.now();
    }
  
    render() {
      // Convert the delta time since the last frame render into a measure
      // of frames per second.
      const now = performance.now();
      const delta = now - this.lastFrameTimeStamp;
      this.lastFrameTimeStamp = now;
      const fps = 1 / delta * 1000;
  
      // Save only the latest 100 timings.
      this.frames.push(fps);
      if (this.frames.length > 100) {
        this.frames.shift();
      }
  
      // Find the max, min, and mean of our 100 latest timings.
      let min = Infinity;
      let max = -Infinity;
      let sum = 0;
      for (let i = 0; i < this.frames.length; i++) {
        sum += this.frames[i];
        min = Math.min(this.frames[i], min);
        max = Math.max(this.frames[i], max);
      }
      let mean = sum / this.frames.length;
  
      // Render the statistics.
      this.fps.textContent = `
  Frames per Second:
           latest = ${Math.round(fps)}
  avg of last 100 = ${Math.round(mean)}
  min of last 100 = ${Math.round(min)}
  max of last 100 = ${Math.round(max)}
  `.trim();
    }
};

/// end profiling

/// play/pause handling
let animationId = null;
const renderLoop = () => {
    fps.render();
    // debugger;
    canvas.textContent = universe.render();
    
    let cycles = renderCyclesInput.value
    for (let i = 0; i < cycles; i++) {
        universe.tick();
    }
    drawGrid();
    drawCells();
    animationId = requestAnimationFrame(renderLoop);
};

const isPaused = () => {
    return animationId === null;
};

const getIndex = (row, column) => {
    return row * width + column;
};

const drawGrid = () => {
    ctx.beginPath();
    ctx.strokeStyle = GRID_COLOR;
  
    // Vertical lines.
    for (let i = 0; i <= width; i++) {
      ctx.moveTo(i * (CELL_SIZE + 1) + 1, 0);
      ctx.lineTo(i * (CELL_SIZE + 1) + 1, (CELL_SIZE + 1) * height + 1);
    }
  
    // Horizontal lines.
    for (let j = 0; j <= height; j++) {
      ctx.moveTo(0,                           j * (CELL_SIZE + 1) + 1);
      ctx.lineTo((CELL_SIZE + 1) * width + 1, j * (CELL_SIZE + 1) + 1);
    }
  
    ctx.stroke();
};

const bitIsSet = (n, arr) => {
    const byte = Math.floor(n / 8);
    const mask = 1 << (n % 8);
    return (arr[byte] & mask) === mask;
};

const drawCells = () => {
    const cellsPtr = universe.cells();
    // const cells = new Uint8Array(memory.buffer, cellsPtr, width * height);
    const cells = new Uint8Array(memory.buffer, cellsPtr, width * height / 8);
  
    ctx.beginPath();

    // fillstyle is costly. split in two loops
    // Alive cells.
    ctx.fillStyle = ALIVE_COLOR;
    for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
            const idx = getIndex(row, col);
            if (!bitIsSet(idx, cells)) {
                continue;
            }

            ctx.fillRect(
                col * (CELL_SIZE + 1) + 1,
                row * (CELL_SIZE + 1) + 1,
                CELL_SIZE,
                CELL_SIZE
            );
        }
    }

    // Dead cells.
    ctx.fillStyle = DEAD_COLOR;
    for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
            const idx = getIndex(row, col);
            if (bitIsSet(idx, cells)) {
                continue;
            }

            ctx.fillRect(
                col * (CELL_SIZE + 1) + 1,
                row * (CELL_SIZE + 1) + 1,
                CELL_SIZE,
                CELL_SIZE
            );
        }
    }
  
    ctx.stroke();
};

canvas.addEventListener("click", event => {
    const boundingRect = canvas.getBoundingClientRect();
  
    const scaleX = canvas.width / boundingRect.width;
    const scaleY = canvas.height / boundingRect.height;
  
    const canvasLeft = (event.clientX - boundingRect.left) * scaleX;
    const canvasTop = (event.clientY - boundingRect.top) * scaleY;
  
    const row = Math.min(Math.floor(canvasTop / (CELL_SIZE + 1)), height - 1);
    const col = Math.min(Math.floor(canvasLeft / (CELL_SIZE + 1)), width - 1);
  
    if (event.shiftKey) {
        universe.spawn_pulsar(row, col);
    } else if (event.ctrlKey) {
        universe.spawn_glider(row, col);
    } else {
        universe.toggle_cell(row, col);
    }
  
    drawGrid();
    drawCells();
});

drawGrid();
drawCells();
// requestAnimationFrame(renderLoop);
play();

  