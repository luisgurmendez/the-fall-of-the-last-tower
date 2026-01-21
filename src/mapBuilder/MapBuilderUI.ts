/**
 * MapBuilderUI - Creates and manages the map builder HTML UI.
 */

import { MapBuilder } from './MapBuilder';
import { Tool, ToolType } from './tools';
import { TerrainType, TERRAIN_COLORS, JUNGLE_CREATURES, JungleCreatureType } from './MapData';
import { TerrainTool } from './tools/TerrainTool';

/**
 * Create the map builder UI.
 */
export function createMapBuilderUI(container: HTMLElement): { canvas: HTMLCanvasElement; builder: MapBuilder } {
  // Create main layout
  container.innerHTML = `
    <div id="map-builder-container" style="
      display: flex;
      width: 100%;
      height: 100vh;
      background: #1a1a2e;
      font-family: Arial, sans-serif;
    ">
      <!-- Toolbar -->
      <div id="toolbar" style="
        width: 60px;
        background: #16213e;
        border-right: 1px solid #0f3460;
        display: flex;
        flex-direction: column;
        padding: 10px 5px;
        gap: 5px;
      "></div>

      <!-- Main content -->
      <div style="flex: 1; display: flex; flex-direction: column;">
        <!-- Top bar -->
        <div id="top-bar" style="
          height: 50px;
          background: #16213e;
          border-bottom: 1px solid #0f3460;
          display: flex;
          align-items: center;
          padding: 0 15px;
          gap: 15px;
        ">
          <button id="btn-new" class="builder-btn">New</button>
          <button id="btn-save" class="builder-btn">Save</button>
          <button id="btn-load" class="builder-btn">Load</button>
          <div style="width: 1px; height: 30px; background: #0f3460;"></div>
          <button id="btn-play" class="builder-btn builder-btn-primary">Play Map</button>
          <div style="flex: 1;"></div>
          <input id="map-name" type="text" value="Untitled Map" style="
            background: #0f3460;
            border: 1px solid #e94560;
            color: #fff;
            padding: 8px 12px;
            border-radius: 4px;
            width: 200px;
          ">
        </div>

        <!-- Canvas area -->
        <div id="canvas-container" style="flex: 1; position: relative; overflow: hidden;">
          <canvas id="builder-canvas"></canvas>
        </div>
      </div>

      <!-- Properties panel -->
      <div id="properties-panel" style="
        width: 220px;
        background: #16213e;
        border-left: 1px solid #0f3460;
        padding: 15px;
        display: flex;
        flex-direction: column;
        gap: 15px;
        overflow-y: auto;
      ">
        <h3 style="color: #e94560; margin: 0;">Properties</h3>
        <div id="tool-properties"></div>
      </div>
    </div>

    <!-- New Map Modal -->
    <div id="new-map-modal" style="
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        background: #16213e;
        padding: 30px;
        border-radius: 8px;
        border: 1px solid #e94560;
        min-width: 300px;
      ">
        <h3 style="color: #e94560; margin: 0 0 20px 0;">New Map</h3>
        <div class="prop-group">
          <label class="prop-label">Map Size</label>
          <select class="prop-select" id="new-map-size">
            <option value="2000">Small (2000x2000)</option>
            <option value="3000" selected>Medium (3000x3000)</option>
            <option value="4000">Large (4000x4000)</option>
            <option value="6000">Huge (6000x6000)</option>
            <option value="custom">Custom...</option>
          </select>
        </div>
        <div id="custom-size-inputs" style="display: none;">
          <div class="prop-group">
            <label class="prop-label">Width</label>
            <input type="number" class="prop-input" id="new-map-width" value="3000" min="1000" max="10000" step="500">
          </div>
          <div class="prop-group">
            <label class="prop-label">Height</label>
            <input type="number" class="prop-input" id="new-map-height" value="3000" min="1000" max="10000" step="500">
          </div>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button id="new-map-cancel" class="builder-btn" style="flex: 1;">Cancel</button>
          <button id="new-map-create" class="builder-btn builder-btn-primary" style="flex: 1;">Create</button>
        </div>
      </div>
    </div>

    <style>
      .builder-btn {
        background: #0f3460;
        border: 1px solid #e94560;
        color: #fff;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
      }
      .builder-btn:hover {
        background: #e94560;
      }
      .builder-btn-primary {
        background: #e94560;
      }
      .builder-btn-primary:hover {
        background: #ff6b6b;
      }
      .tool-btn {
        width: 50px;
        height: 50px;
        background: #0f3460;
        border: 2px solid transparent;
        border-radius: 8px;
        cursor: pointer;
        font-size: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      .tool-btn:hover {
        background: #1a1a2e;
        border-color: #e94560;
      }
      .tool-btn.active {
        background: #e94560;
        border-color: #ff6b6b;
      }
      .tool-btn[title]:hover::after {
        content: attr(title);
        position: absolute;
        left: 65px;
        background: #0f3460;
        color: #fff;
        padding: 5px 10px;
        border-radius: 4px;
        font-size: 12px;
        white-space: nowrap;
        z-index: 100;
      }
      .prop-group {
        margin-bottom: 10px;
      }
      .prop-label {
        color: #aaa;
        font-size: 12px;
        margin-bottom: 5px;
        display: block;
      }
      .prop-select, .prop-input {
        width: 100%;
        background: #0f3460;
        border: 1px solid #e94560;
        color: #fff;
        padding: 6px;
        border-radius: 4px;
        box-sizing: border-box;
      }
      .terrain-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 5px;
      }
      .terrain-btn {
        width: 100%;
        aspect-ratio: 1;
        border: 2px solid transparent;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        color: #fff;
        text-shadow: 1px 1px 2px #000;
      }
      .terrain-btn.active {
        border-color: #fff;
      }
      .creature-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 5px;
      }
      .creature-btn {
        padding: 8px;
        background: #0f3460;
        border: 2px solid transparent;
        border-radius: 4px;
        cursor: pointer;
        color: #fff;
        font-size: 12px;
        text-align: center;
      }
      .creature-btn:hover {
        background: #1a3a6e;
      }
      .creature-btn.active {
        border-color: #e94560;
        background: #1a3a6e;
      }
      .creature-icon {
        font-size: 20px;
        display: block;
        margin-bottom: 4px;
      }
      .spread-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 5px;
      }
      .spread-btn {
        padding: 6px;
        background: #0f3460;
        border: 2px solid transparent;
        border-radius: 4px;
        cursor: pointer;
        color: #fff;
        font-size: 11px;
      }
      .spread-btn:hover {
        background: #1a3a6e;
      }
      .spread-btn.active {
        border-color: #e94560;
      }
    </style>
  `;

  // Get elements
  const canvas = document.getElementById('builder-canvas') as HTMLCanvasElement;
  const canvasContainer = document.getElementById('canvas-container') as HTMLDivElement;
  const toolbar = document.getElementById('toolbar') as HTMLDivElement;
  const toolProperties = document.getElementById('tool-properties') as HTMLDivElement;
  const mapNameInput = document.getElementById('map-name') as HTMLInputElement;
  const newMapModal = document.getElementById('new-map-modal') as HTMLDivElement;

  // Resize canvas to fit container
  function resizeCanvas() {
    canvas.width = canvasContainer.clientWidth;
    canvas.height = canvasContainer.clientHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Create map builder
  const builder = new MapBuilder({ canvas });

  // Create tool buttons
  const tools = builder.getTools();
  tools.forEach((tool) => {
    const btn = document.createElement('button');
    btn.className = 'tool-btn';
    btn.textContent = tool.icon;
    btn.title = `${tool.name} (${tool.description})`;
    btn.dataset.tool = tool.type;

    if (tool.type === 'select') {
      btn.classList.add('active');
    }

    btn.addEventListener('click', () => {
      builder.setTool(tool.type as ToolType);
    });

    toolbar.appendChild(btn);
  });

  // Update active tool button
  builder.setOnToolChange((tool) => {
    toolbar.querySelectorAll('.tool-btn').forEach((btn) => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.tool === tool.type);
    });
    updateToolProperties(tool);
  });

  // Tool properties panel
  function updateToolProperties(tool: Tool) {
    toolProperties.innerHTML = '';

    if (tool.type === 'terrain') {
      const terrainTool = tool as TerrainTool;

      // Terrain type selector
      const terrainGroup = document.createElement('div');
      terrainGroup.className = 'prop-group';
      terrainGroup.innerHTML = `<label class="prop-label">Terrain Type</label>`;

      const terrainGrid = document.createElement('div');
      terrainGrid.className = 'terrain-grid';

      const terrainTypes: { type: TerrainType; label: string }[] = [
        { type: 'grass', label: 'Grass' },
        { type: 'dirt', label: 'Road' },
        { type: 'water', label: 'Water' },
        { type: 'stone', label: 'Stone' },
        { type: 'sand', label: 'Sand' },
        { type: 'void', label: 'Void' },
      ];
      terrainTypes.forEach(({ type, label }) => {
        const btn = document.createElement('button');
        btn.className = 'terrain-btn';
        btn.style.background = TERRAIN_COLORS[type];
        btn.textContent = label;
        btn.title = type;
        if (type === terrainTool.getTerrainType()) {
          btn.classList.add('active');
        }
        btn.addEventListener('click', () => {
          terrainTool.setTerrainType(type);
          terrainGrid.querySelectorAll('.terrain-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
        });
        terrainGrid.appendChild(btn);
      });

      terrainGroup.appendChild(terrainGrid);
      toolProperties.appendChild(terrainGroup);

      // Brush size
      const brushGroup = document.createElement('div');
      brushGroup.className = 'prop-group';
      brushGroup.innerHTML = `
        <label class="prop-label">Brush Size: <span id="brush-size-val">${terrainTool.getBrushSize()}</span></label>
        <input type="range" class="prop-input" id="brush-size" min="1" max="10" value="${terrainTool.getBrushSize()}">
      `;
      toolProperties.appendChild(brushGroup);

      const brushInput = brushGroup.querySelector('#brush-size') as HTMLInputElement;
      const brushVal = brushGroup.querySelector('#brush-size-val') as HTMLSpanElement;
      brushInput.addEventListener('input', () => {
        terrainTool.setBrushSize(parseInt(brushInput.value));
        brushVal.textContent = brushInput.value;
      });
    }

    if (tool.type === 'wall') {
      // Wall dimensions
      const widthGroup = document.createElement('div');
      widthGroup.className = 'prop-group';
      widthGroup.innerHTML = `
        <label class="prop-label">Wall Width</label>
        <input type="number" class="prop-input" id="wall-width" value="100" min="50" max="500" step="50">
      `;
      toolProperties.appendChild(widthGroup);

      const heightGroup = document.createElement('div');
      heightGroup.className = 'prop-group';
      heightGroup.innerHTML = `
        <label class="prop-label">Wall Height</label>
        <input type="number" class="prop-input" id="wall-height" value="100" min="50" max="500" step="50">
      `;
      toolProperties.appendChild(heightGroup);

      const widthInput = widthGroup.querySelector('#wall-width') as HTMLInputElement;
      const heightInput = heightGroup.querySelector('#wall-height') as HTMLInputElement;

      widthInput.addEventListener('change', () => {
        if ('setWallSize' in tool) {
          (tool as any).setWallSize(parseInt(widthInput.value), parseInt(heightInput.value));
        }
      });
      heightInput.addEventListener('change', () => {
        if ('setWallSize' in tool) {
          (tool as any).setWallSize(parseInt(widthInput.value), parseInt(heightInput.value));
        }
      });

      // Instructions
      const instructions = document.createElement('div');
      instructions.className = 'prop-group';
      instructions.innerHTML = `
        <p style="color: #888; font-size: 12px; margin: 0;">
          Click to place walls.<br>
          Walls block movement.
        </p>
      `;
      toolProperties.appendChild(instructions);
    }

    if (tool.type === 'bush') {
      // Bush count
      const countGroup = document.createElement('div');
      countGroup.className = 'prop-group';
      countGroup.innerHTML = `
        <label class="prop-label">Bush Count: <span id="bush-count-val">5</span></label>
        <input type="range" class="prop-input" id="bush-count" min="3" max="10" value="5">
      `;
      toolProperties.appendChild(countGroup);

      const countInput = countGroup.querySelector('#bush-count') as HTMLInputElement;
      const countVal = countGroup.querySelector('#bush-count-val') as HTMLSpanElement;
      countInput.addEventListener('input', () => {
        if ('setBushCount' in tool) {
          (tool as any).setBushCount(parseInt(countInput.value));
        }
        countVal.textContent = countInput.value;
      });

      // Spread type
      const spreadGroup = document.createElement('div');
      spreadGroup.className = 'prop-group';
      spreadGroup.innerHTML = `<label class="prop-label">Spread Pattern</label>`;

      const spreadGrid = document.createElement('div');
      spreadGrid.className = 'spread-grid';

      const spreads = ['horizontal', 'vertical', 'diagonal', 'cluster'];
      spreads.forEach((spread) => {
        const btn = document.createElement('button');
        btn.className = 'spread-btn';
        if (spread === 'cluster') btn.classList.add('active');
        btn.textContent = spread.charAt(0).toUpperCase() + spread.slice(1);
        btn.addEventListener('click', () => {
          if ('setSpread' in tool) {
            (tool as any).setSpread(spread);
          }
          spreadGrid.querySelectorAll('.spread-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
        });
        spreadGrid.appendChild(btn);
      });

      spreadGroup.appendChild(spreadGrid);
      toolProperties.appendChild(spreadGroup);

      // Instructions
      const instructions = document.createElement('div');
      instructions.className = 'prop-group';
      instructions.innerHTML = `
        <p style="color: #888; font-size: 12px; margin: 0;">
          Click to place bush groups.<br>
          Bushes hide units inside.
        </p>
      `;
      toolProperties.appendChild(instructions);
    }

    if (tool.type === 'jungle') {
      // Get current creature type from tool
      const currentCreatureType = 'getCreatureType' in tool ? (tool as any).getCreatureType() : 'gromp';

      // Creature type selector
      const creatureGroup = document.createElement('div');
      creatureGroup.className = 'prop-group';
      creatureGroup.innerHTML = `<label class="prop-label">Creature Type</label>`;

      const creatureGrid = document.createElement('div');
      creatureGrid.className = 'creature-grid';

      const creatureTypes: JungleCreatureType[] = ['gromp', 'wolf', 'raptor', 'krug', 'blue_buff', 'red_buff', 'dragon', 'baron'];
      creatureTypes.forEach((type) => {
        const info = JUNGLE_CREATURES[type];
        const btn = document.createElement('button');
        btn.className = 'creature-btn';
        if (type === currentCreatureType) btn.classList.add('active');
        btn.innerHTML = `<span class="creature-icon">${info.icon}</span>${info.name}`;
        btn.addEventListener('click', () => {
          if ('setCreatureType' in tool) {
            (tool as any).setCreatureType(type);
          }
          creatureGrid.querySelectorAll('.creature-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
        });
        creatureGrid.appendChild(btn);
      });

      creatureGroup.appendChild(creatureGrid);
      toolProperties.appendChild(creatureGroup);

      // Instructions
      const instructions = document.createElement('div');
      instructions.className = 'prop-group';
      instructions.innerHTML = `
        <p style="color: #888; font-size: 12px; margin: 0;">
          Click to place jungle camps.<br>
          Creatures respawn after cleared.
        </p>
      `;
      toolProperties.appendChild(instructions);
    }

    if (tool.type === 'tower' || tool.type === 'nexus' || tool.type === 'spawn') {
      // Side selector
      const sideGroup = document.createElement('div');
      sideGroup.className = 'prop-group';
      sideGroup.innerHTML = `
        <label class="prop-label">Team</label>
        <select class="prop-select" id="side-select">
          <option value="0">Blue (Ally)</option>
          <option value="1">Red (Enemy)</option>
        </select>
      `;
      toolProperties.appendChild(sideGroup);

      const sideSelect = sideGroup.querySelector('#side-select') as HTMLSelectElement;
      sideSelect.addEventListener('change', () => {
        const side = parseInt(sideSelect.value) as 0 | 1;
        if ('setSide' in tool) {
          (tool as any).setSide(side);
        }
      });
    }

    if (tool.type === 'tower') {
      // Lane selector
      const laneGroup = document.createElement('div');
      laneGroup.className = 'prop-group';
      laneGroup.innerHTML = `
        <label class="prop-label">Lane</label>
        <select class="prop-select" id="lane-select">
          <option value="top">Top</option>
          <option value="mid">Mid</option>
          <option value="bot">Bot</option>
        </select>
      `;
      toolProperties.appendChild(laneGroup);

      const laneSelect = laneGroup.querySelector('#lane-select') as HTMLSelectElement;
      laneSelect.addEventListener('change', () => {
        if ('setLane' in tool) {
          (tool as any).setLane(laneSelect.value);
        }
      });
    }

    if (tool.type === 'lane') {
      // Lane name selector
      const laneGroup = document.createElement('div');
      laneGroup.className = 'prop-group';
      laneGroup.innerHTML = `
        <label class="prop-label">Lane Type</label>
        <select class="prop-select" id="lane-name-select">
          <option value="top">Top Lane</option>
          <option value="mid">Mid Lane</option>
          <option value="bot">Bot Lane</option>
        </select>
      `;
      toolProperties.appendChild(laneGroup);

      const laneSelect = laneGroup.querySelector('#lane-name-select') as HTMLSelectElement;
      laneSelect.addEventListener('change', () => {
        if ('setLaneName' in tool) {
          (tool as any).setLaneName(laneSelect.value);
        }
      });

      // Instructions
      const instructions = document.createElement('div');
      instructions.className = 'prop-group';
      instructions.innerHTML = `
        <p style="color: #888; font-size: 12px; margin: 0;">
          Click to add waypoints.<br>
          Press Enter to finish.<br>
          Press Backspace to undo.<br>
          Press Escape to cancel.
        </p>
      `;
      toolProperties.appendChild(instructions);
    }

    if (tool.type === 'decoration') {
      // Decoration type selector
      const decorGroup = document.createElement('div');
      decorGroup.className = 'prop-group';
      decorGroup.innerHTML = `
        <label class="prop-label">Decoration</label>
        <select class="prop-select" id="decor-select">
          <option value="tree">Tree</option>
          <option value="rock">Rock</option>
          <option value="flower">Flower</option>
          <option value="mushroom">Mushroom</option>
          <option value="stump">Stump</option>
        </select>
      `;
      toolProperties.appendChild(decorGroup);

      const decorSelect = decorGroup.querySelector('#decor-select') as HTMLSelectElement;
      decorSelect.addEventListener('change', () => {
        if ('setDecorationType' in tool) {
          (tool as any).setDecorationType(decorSelect.value);
        }
      });
    }
  }

  // New Map Modal
  const newMapSizeSelect = document.getElementById('new-map-size') as HTMLSelectElement;
  const customSizeInputs = document.getElementById('custom-size-inputs') as HTMLDivElement;
  const newMapWidthInput = document.getElementById('new-map-width') as HTMLInputElement;
  const newMapHeightInput = document.getElementById('new-map-height') as HTMLInputElement;

  newMapSizeSelect.addEventListener('change', () => {
    customSizeInputs.style.display = newMapSizeSelect.value === 'custom' ? 'block' : 'none';
  });

  document.getElementById('btn-new')?.addEventListener('click', () => {
    newMapModal.style.display = 'flex';
  });

  document.getElementById('new-map-cancel')?.addEventListener('click', () => {
    newMapModal.style.display = 'none';
  });

  document.getElementById('new-map-create')?.addEventListener('click', () => {
    let width: number, height: number;

    if (newMapSizeSelect.value === 'custom') {
      width = parseInt(newMapWidthInput.value);
      height = parseInt(newMapHeightInput.value);
    } else {
      width = height = parseInt(newMapSizeSelect.value);
    }

    builder.newMap(width, height);
    mapNameInput.value = 'Untitled Map';
    newMapModal.style.display = 'none';
  });

  document.getElementById('btn-save')?.addEventListener('click', () => {
    builder.saveToFile();
  });

  document.getElementById('btn-load')?.addEventListener('click', () => {
    builder.loadFromFile();
  });

  document.getElementById('btn-play')?.addEventListener('click', () => {
    // Save to localStorage and redirect to play mode
    builder.saveToLocalStorage('customMap');
    window.location.hash = '#play-custom';
    window.location.reload();
  });

  // Map name input
  mapNameInput.addEventListener('change', () => {
    builder.setMapName(mapNameInput.value);
  });

  // Update map name when loaded
  builder.setOnMapChange((mapData) => {
    mapNameInput.value = mapData.name;
  });

  // Initialize tool properties
  updateToolProperties(builder.getCurrentTool());

  // Start the builder
  builder.start();

  // Auto-save every 30 seconds
  setInterval(() => {
    builder.saveToLocalStorage();
  }, 30000);

  return { canvas, builder };
}
