const appRoot = document.getElementById('app-root');

appRoot.innerHTML = `
  <div class="container">
    <header>
      <h1>⠠⠃⠗⠇ Braille3D Studio</h1>
      <p class="subtitle">Professional Braille STL Generator for 3D Printing</p>
    </header>

    <div class="main-content">
      <div class="panel controls-panel">
        <h2 style="margin-bottom: 20px; color: #333;">Configuration</h2>
        <div class="form-group">
          <label for="text-input">Text to Convert (Max 4 lines)</label>
          <textarea id="text-input" placeholder="Enter your text here... (Line 1)&#10;(Line 2)&#10;(Line 3)&#10;(Line 4)">Hello World\nWelcome to\nBraille3D\nStudio</textarea>
          <div class="info-text">Each line will be automatically translated to braille</div>
        </div>

        <div class="form-group">
          <label for="braille-grade">Braille Grade</label>
          <select id="braille-grade">
            <option value="2" selected>Grade 2 (Contracted - Recommended)</option>
            <option value="1">Grade 1 (Uncontracted)</option>
          </select>
          <div class="info-text">Grade 2 is standard for most applications</div>
        </div>

        <div class="form-group">
          <label>Shape Type</label>
          <div class="shape-selector">
            <button class="shape-btn active" data-shape="card">📇 Business Card</button>
            <button class="shape-btn" data-shape="cylinder">🔲 Cylinder</button>
          </div>
        </div>

        <div class="braille-preview-container">
          <div class="braille-preview-label">Braille Translation Preview:</div>
          <div class="braille-preview" id="braille-preview"></div>
        </div>

        <div class="expert-section">
          <div class="toggle-group">
            <input type="checkbox" id="expert-mode" />
            <label for="expert-mode" style="margin-bottom: 0; cursor: pointer;">
              <strong>Expert Mode</strong> - Advanced Parameters
            </label>
          </div>

          <div class="expert-params hidden" id="expert-params">
            <div class="param-section card-params">
              <h4>Card Dimensions</h4>
              <div class="param-grid">
                <div class="param-input">
                  <label>Card Width (mm)</label>
                  <input type="number" id="card-width" value="88" step="1" min="50" max="150">
                </div>
                <div class="param-input">
                  <label>Card Height (mm)</label>
                  <input type="number" id="card-height" value="51" step="1" min="30" max="100">
                </div>
                <div class="param-input">
                  <label>Plate Thickness (mm)</label>
                  <input type="number" id="plate-thickness" value="3" step="0.5" min="2" max="10">
                </div>
                <div class="param-input">
                  <label>Grid Columns</label>
                  <input type="number" id="grid-columns" value="14" step="1" min="8" max="20">
                </div>
                <div class="param-input">
                  <label>Grid Rows</label>
                  <input type="number" id="grid-rows" value="4" step="1" min="1" max="6">
                </div>
              </div>
            </div>

            <div class="param-section cylinder-params" style="display:none;">
              <h4>Cylinder Dimensions</h4>
              <div class="param-grid">
                <div class="param-input">
                  <label>Diameter (mm)</label>
                  <input type="number" id="cylinder-diameter" value="31.35" step="0.1" min="20" max="100">
                </div>
                <div class="param-input">
                  <label>Height (mm)</label>
                  <input type="number" id="cylinder-height" value="51" step="1" min="20" max="200">
                </div>
                <div class="param-input">
                  <label>Cutout Radius (mm)</label>
                  <input type="number" id="cutout-radius" value="13" step="1" min="0" max="30">
                </div>
                <div class="param-input">
                  <label>Cutout Sides</label>
                  <input type="number" id="cutout-sides" value="12" step="1" min="3" max="20">
                </div>
                <div class="param-input">
                  <label>Seam Offset (deg)</label>
                  <input type="number" id="seam-offset" value="355" step="1" min="0" max="360">
                </div>
              </div>
            </div>

            <div class="param-section">
              <h4>Braille Dot Geometry</h4>
              <div class="param-grid">
                <div class="param-input">
                  <label>Dot Height (mm)</label>
                  <input type="number" id="dot-height" value="1.0" step="0.1" min="0.1" max="2">
                </div>
                <div class="param-input">
                  <label>Dot Base Diameter (mm)</label>
                  <input type="number" id="dot-diameter" value="1.8" step="0.1" min="0.5" max="3">
                </div>
                <div class="param-input">
                  <label>Dot Top Diameter (mm)</label>
                  <input type="number" id="dot-top" value="0.4" step="0.1" min="0.1" max="2">
                </div>
                <div class="param-input">
                  <label>Cell Width (mm)</label>
                  <input type="number" id="cell-width" value="6.5" step="0.1" min="4" max="10">
                </div>
                <div class="param-input">
                  <label>Line Spacing (mm)</label>
                  <input type="number" id="line-spacing" value="10.0" step="0.1" min="8" max="15">
                </div>
                <div class="param-input">
                  <label>Dot Spacing (mm)</label>
                  <input type="number" id="dot-spacing" value="2.5" step="0.1" min="1.5" max="4">
                </div>
              </div>
            </div>

            <div class="param-section">
              <h4>Counter Plate</h4>
              <div class="param-grid">
                <div class="param-input">
                  <label>Counter Dot Diameter (mm)</label>
                  <input type="number" id="counter-diameter" value="1.6" step="0.1" min="0.5" max="3">
                </div>
                <div class="param-input">
                  <label>Recess Depth (mm)</label>
                  <input type="number" id="counter-depth" value="0.8" step="0.1" min="0.1" max="2">
                </div>
                <div class="param-input full-width">
                  <label>
                    <input type="checkbox" id="use-bowl" checked>
                    Use Bowl Recess (vs Hemisphere)
                  </label>
                </div>
                <div class="param-input full-width">
                  <label>
                    <input type="checkbox" id="indicator-shapes" checked>
                    Add Row Indicators (Triangle & Character)
                  </label>
                </div>
              </div>
            </div>

            <div class="param-section">
              <h4>Position Adjustments</h4>
              <div class="param-grid">
                <div class="param-input">
                  <label>X Offset (mm)</label>
                  <input type="number" id="x-offset" value="0" step="0.1" min="-10" max="10">
                </div>
                <div class="param-input">
                  <label>Y Offset (mm)</label>
                  <input type="number" id="y-offset" value="0" step="0.1" min="-10" max="10">
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="generate-section">
          <label>Plate Type</label>
          <div class="plate-selector">
            <button class="plate-btn active" data-plate="emboss">Embossing Plate</button>
            <button class="plate-btn" data-plate="counter">Counter Plate</button>
          </div>
          <button class="generate-btn" id="generate-btn">Generate 3D Model</button>
          <div class="status-message" id="status-message"></div>
          <div class="stats-display" id="stats-display" style="display:none;">
            <div id="stats-vertices">Vertices: 0</div>
            <div id="stats-faces">Faces: 0</div>
            <div id="stats-dots">Braille Dots: 0</div>
          </div>
        </div>

        <div class="download-section" id="download-section">
          <h3 style="margin-bottom: 10px;">Files Ready!</h3>
          <div class="download-buttons">
            <button class="download-btn" id="download-stl">💾 Download STL</button>
          </div>
        </div>
      </div>

      <div class="panel preview-panel">
        <h2 style="margin-bottom: 15px; color: #333;">3D Preview</h2>
        <div id="canvas-container">
          <div class="canvas-controls">
            <button class="canvas-btn" id="reset-view">🔄 Reset View</button>
            <button class="canvas-btn" id="toggle-wireframe">⬚ Wireframe</button>
            <button class="canvas-btn" id="auto-rotate">🔄 Auto Rotate</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="loading-overlay" id="loading-overlay">
    <div class="loading-content">
      <div class="spinner"></div>
      <p id="loading-text">Initializing Braille library...</p>
    </div>
  </div>
`;

class Braille3DStudio {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.currentMesh = null;
    this.currentShape = 'card';
    this.currentPlate = 'emboss';
    this.autoRotate = false;
    this.wireframe = false;
    this.brailleTranslations = ['', '', '', ''];
    this.originalLines = ['', '', '', ''];

    this.settings = this.getDefaultSettings();
    this.init();
  }

  getDefaultSettings() {
    return {
      card_width: 88,
      card_height: 51,
      card_thickness: 3.0,
      grid_columns: 14,
      grid_rows: 4,
      cell_spacing: 6.5,
      line_spacing: 10.0,
      dot_spacing: 2.5,
      emboss_dot_base_diameter: 1.8,
      emboss_dot_height: 1.0,
      emboss_dot_flat_hat: 0.4,
      hemi_counter_dot_base_diameter: 1.6,
      bowl_counter_dot_base_diameter: 1.8,
      use_bowl_recess: 1,
      counter_dot_depth: 0.8,
      braille_x_adjust: 0.0,
      braille_y_adjust: 0.0,
      cylinder_diameter: 31.35,
      cylinder_height: 51,
      polygonal_cutout_radius: 13,
      polygonal_cutout_sides: 12,
      seam_offset: 355,
      indicator_shapes: 1,
      hemisphere_subdivisions: 2,
      left_margin: 0,
      right_margin: 0,
      top_margin: 0,
      bottom_margin: 0
    };
  }

  init() {
    this.setupEventListeners();
    this.initThreeJS();
    this.setupBrailleTranslation();
    this.updateShapeParams();
    setTimeout(() => {
      document.getElementById('loading-overlay').classList.remove('active');
    }, 500);
  }

  setupEventListeners() {
    document.getElementById('text-input').addEventListener('input', () => this.translateText());
    document.getElementById('braille-grade').addEventListener('change', () => this.translateText());

    document.querySelectorAll('.shape-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentShape = e.target.dataset.shape;
        this.updateShapeParams();
      });
    });

    document.querySelectorAll('.plate-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        document.querySelectorAll('.plate-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentPlate = e.target.dataset.plate;
      });
    });

    document.getElementById('expert-mode').addEventListener('change', e => {
      document.getElementById('expert-params').classList.toggle('hidden', !e.target.checked);
    });

    document.getElementById('generate-btn').addEventListener('click', () => this.generateModel());
    document.getElementById('reset-view').addEventListener('click', () => this.resetView());
    document.getElementById('toggle-wireframe').addEventListener('click', () => this.toggleWireframe());
    document.getElementById('auto-rotate').addEventListener('click', e => {
      this.autoRotate = !this.autoRotate;
      e.target.classList.toggle('active', this.autoRotate);
      if (this.controls) this.controls.autoRotate = this.autoRotate;
    });
    document.getElementById('download-stl').addEventListener('click', () => this.downloadSTL());

    const paramMap = {
      'card-width': 'card_width',
      'card-height': 'card_height',
      'plate-thickness': 'card_thickness',
      'grid-columns': 'grid_columns',
      'grid-rows': 'grid_rows',
      'cylinder-diameter': 'cylinder_diameter',
      'cylinder-height': 'cylinder_height',
      'cutout-radius': 'polygonal_cutout_radius',
      'cutout-sides': 'polygonal_cutout_sides',
      'seam-offset': 'seam_offset',
      'dot-height': 'emboss_dot_height',
      'dot-diameter': 'emboss_dot_base_diameter',
      'dot-top': 'emboss_dot_flat_hat',
      'cell-width': 'cell_spacing',
      'line-spacing': 'line_spacing',
      'dot-spacing': 'dot_spacing',
      'counter-diameter': 'bowl_counter_dot_base_diameter',
      'counter-depth': 'counter_dot_depth',
      'x-offset': 'braille_x_adjust',
      'y-offset': 'braille_y_adjust'
    };

    Object.entries(paramMap).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', e => { this.settings[key] = parseFloat(e.target.value); this.updateComputedSettings(); });
    });

    document.getElementById('use-bowl')?.addEventListener('change', e => { this.settings.use_bowl_recess = e.target.checked ? 1 : 0; });
    document.getElementById('indicator-shapes')?.addEventListener('change', e => { this.settings.indicator_shapes = e.target.checked ? 1 : 0; });
  }

  updateShapeParams() {
    const cardParams = document.querySelectorAll('.card-params');
    const cylinderParams = document.querySelectorAll('.cylinder-params');
    if (this.currentShape === 'card') { cardParams.forEach(el => el.style.display = 'block'); cylinderParams.forEach(el => el.style.display = 'none'); }
    else { cardParams.forEach(el => el.style.display = 'none'); cylinderParams.forEach(el => el.style.display = 'block'); }
    this.updateComputedSettings();
  }

  updateComputedSettings() {
    const gridWidth = (this.settings.grid_columns - 1) * this.settings.cell_spacing;
    const gridHeight = (this.settings.grid_rows - 1) * this.settings.line_spacing;
    this.settings.left_margin = (this.settings.card_width - gridWidth) / 2;
    this.settings.right_margin = (this.settings.card_width - gridWidth) / 2;
    this.settings.top_margin = (this.settings.card_height - gridHeight) / 2;
    this.settings.bottom_margin = (this.settings.card_height - gridHeight) / 2;
  }

  initThreeJS() {
    const container = document.getElementById('canvas-container');
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f0f0);
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.camera.position.set(100, 100, 150);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 2.0;
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true; this.scene.add(directionalLight);
    const gridHelper = new THREE.GridHelper(200, 20, 0xcccccc, 0xeeeeee); gridHelper.position.y = -10; this.scene.add(gridHelper);
    window.addEventListener('resize', () => {
      const width = container.clientWidth; const height = container.clientHeight;
      this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    });
    this.animate();
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  setupBrailleTranslation() {
    this.brailleTable = {
      'a':'⠁','b':'⠃','c':'⠉','d':'⠙','e':'⠑','f':'⠋','g':'⠛','h':'⠓','i':'⠊','j':'⠚',
      'k':'⠅','l':'⠇','m':'⠍','n':'⠝','o':'⠕','p':'⠏','q':'⠟','r':'⠗','s':'⠎','t':'⠞',
      'u':'⠥','v':'⠧','w':'⠺','x':'⠭','y':'⠽','z':'⠵',' ':'⠀',
      '0':'⠚','1':'⠁','2':'⠃','3':'⠉','4':'⠙','5':'⠑','6':'⠋','7':'⠛','8':'⠓','9':'⠊'
    };
    this.translateText();
  }

  translateText() {
    const text = document.getElementById('text-input').value;
    const lines = text.split('\n').slice(0,4);
    this.originalLines = lines.map(l => l.trim());
    this.brailleTranslations = lines.map(line => line.toLowerCase().split('').map(ch => this.brailleTable[ch] || ch).join(''));
    document.getElementById('braille-preview').textContent = this.brailleTranslations.join('\n');
  }

  resetView() {
    this.camera.position.set(100, 100, 150);
    this.camera.lookAt(0, 0, 0);
    this.controls.reset();
  }

  toggleWireframe() {
    this.wireframe = !this.wireframe;
    if (this.currentMesh) {
      this.currentMesh.traverse(child => { if (child.isMesh) child.material.wireframe = this.wireframe; });
    }
  }

  showStatus(message, type='info') {
    const el = document.getElementById('status-message');
    el.textContent = message; el.className = `status-message ${type} active`;
    if (type !== 'error') setTimeout(() => el.classList.remove('active'), 3000);
  }

  showLoading(message) {
    const overlay = document.getElementById('loading-overlay');
    const text = document.getElementById('loading-text');
    text.textContent = message; overlay.classList.add('active');
  }

  hideLoading() { document.getElementById('loading-overlay').classList.remove('active'); }

  generateModel() {
    this.showLoading('Generating 3D model...');
    if (this.currentMesh) {
      this.scene.remove(this.currentMesh);
      if (this.currentMesh.geometry) this.currentMesh.geometry.dispose();
      if (this.currentMesh.material) this.currentMesh.material.dispose();
      this.currentMesh = null;
    }
    setTimeout(() => {
      try {
        let geometry;
        if (this.currentShape === 'card') geometry = (this.currentPlate === 'emboss') ? this.createEmbossingPlate() : this.createCounterPlate();
        else geometry = (this.currentPlate === 'emboss') ? this.createCylinderEmbossing() : this.createCylinderCounter();
        const material = new THREE.MeshPhongMaterial({ color: this.currentPlate === 'emboss' ? 0x667eea : 0x4ade80, specular: 0x222222, shininess: 30, wireframe: this.wireframe });
        this.currentMesh = new THREE.Mesh(geometry, material);
        this.currentMesh.castShadow = true; this.currentMesh.receiveShadow = true;
        geometry.computeBoundingBox(); const center = new THREE.Vector3(); geometry.boundingBox.getCenter(center); geometry.translate(-center.x, -center.y, -center.z);
        this.scene.add(this.currentMesh);
        this.updateStats(geometry);
        document.getElementById('download-section').classList.add('active');
        this.hideLoading(); this.showStatus('Model generated successfully!', 'success');
      } catch (e) {
        console.error(e); this.hideLoading(); this.showStatus('Error generating model: ' + e.message, 'error');
      }
    }, 50);
  }

  createEmbossingPlate() {
    const s = this.settings;
    const base = new THREE.BoxGeometry(s.card_width, s.card_height, s.card_thickness);
    const dots = [];
    const positions = [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]];
    const colOffsets = [-s.dot_spacing/2, s.dot_spacing/2];
    const rowOffsets = [s.dot_spacing, 0, -s.dot_spacing];
    let dotCount = 0;
    for (let row=0; row<Math.min(s.grid_rows, this.brailleTranslations.length); row++) {
      const line = this.brailleTranslations[row]; if (!line) continue;
      const y = s.card_height/2 - s.top_margin - (row * s.line_spacing);
      const startCol = s.indicator_shapes ? 1 : 0;
      const maxCols = s.grid_columns - (s.indicator_shapes ? 2 : 0);
      for (let col=0; col<Math.min(line.length, maxCols); col++) {
        const ch = line[col]; if (ch === ' ' || ch === '⠀') continue;
        const x = -s.card_width/2 + s.left_margin + ((col + startCol) * s.cell_spacing);
        const pattern = this.brailleCharToDots(ch);
        pattern.forEach((has, i) => {
          if (!has) return; const pos = positions[i];
          const dx = x + colOffsets[pos[1]]; const dy = y + rowOffsets[pos[0]];
          const g = new THREE.CylinderGeometry(s.emboss_dot_flat_hat/2, s.emboss_dot_base_diameter/2, s.emboss_dot_height, 16);
          g.translate(dx + s.braille_x_adjust, dy + s.braille_y_adjust, s.card_thickness/2 + s.emboss_dot_height/2);
          dots.push(g); dotCount++;
        });
      }
    }
    let finalGeo = base;
    if (dots.length > 0) {
      const mergedDots = THREE.BufferGeometryUtils.mergeBufferGeometries(dots);
      finalGeo = THREE.BufferGeometryUtils.mergeBufferGeometries([finalGeo, mergedDots]);
    }
    this.dotCount = dotCount; return finalGeo;
  }

  createCounterPlate() {
    const s = this.settings;
    const base = new THREE.BoxGeometry(s.card_width, s.card_height, s.card_thickness);
    // Placeholder: future CSG subtract for recesses
    return base;
  }

  createCylinderEmbossing() {
    const s = this.settings;
    return new THREE.CylinderGeometry(s.cylinder_diameter/2, s.cylinder_diameter/2, s.cylinder_height, 64);
  }

  createCylinderCounter() {
    const s = this.settings;
    return new THREE.CylinderGeometry(s.cylinder_diameter/2, s.cylinder_diameter/2, s.cylinder_height, 64);
  }

  brailleCharToDots(ch) {
    if (!ch || ch === ' ') return [0,0,0,0,0,0];
    const cp = ch.charCodeAt(0);
    if (cp < 0x2800 || cp > 0x28FF) return [0,0,0,0,0,0];
    const bits = cp - 0x2800; const arr = [];
    for (let i=0;i<6;i++) arr.push((bits & (1<<i)) ? 1 : 0); return arr;
  }

  updateStats(geometry) {
    const stats = document.getElementById('stats-display'); stats.style.display = 'block';
    document.getElementById('stats-vertices').textContent = `Vertices: ${geometry.attributes.position.count}`;
    document.getElementById('stats-faces').textContent = `Faces: ${geometry.index ? geometry.index.count / 3 : 'N/A'}`;
    document.getElementById('stats-dots').textContent = `Braille Dots: ${this.dotCount || 0}`;
  }

  downloadSTL() {
    if (!this.currentMesh) { this.showStatus('No model to download', 'error'); return; }
    const exporter = new THREE.STLExporter();
    const stlString = exporter.parse(this.currentMesh);
    const blob = new Blob([stlString], { type: 'text/plain' });
    let filename = 'braille_';
    if (this.currentPlate === 'emboss') {
      filename += 'embossing_plate_';
      if (this.originalLines[0]) filename += this.originalLines[0].substring(0,20).replace(/\s+/g,'_');
    } else {
      filename += 'counter_plate_' + this.settings.bowl_counter_dot_base_diameter + 'mm';
    }
    filename += '_' + this.currentShape + '.stl';
    saveAs(blob, filename);
    this.showStatus('STL file downloaded!', 'success');
  }
}

window.braille3DStudio = new Braille3DStudio();



