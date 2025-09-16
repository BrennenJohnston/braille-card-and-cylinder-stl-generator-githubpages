const appRoot = document.getElementById('app-root');

appRoot.innerHTML = `
  <div class="container">
    <div class="top-chrome">
      <div class="top-title">Braille Plate & Cylinder STL Generator</div>
      <div class="top-controls">
        <div class="font-controls">
          <button class="font-btn" id="font-dec">A-</button>
          <button class="font-btn" id="font-current">100%</button>
          <button class="font-btn" id="font-inc">A+</button>
          <button class="font-btn" id="font-reset">⟲ Reset font size</button>
        </div>
        <button class="theme-btn" id="theme-toggle">Change Theme to → Dark</button>
        <button class="contrast-btn" id="contrast-toggle">⚡ High Contrast</button>
      </div>
    </div>
    <header>
      <h1>Braille Plate & Cylinder STL Generator</h1>
      <p class="subtitle">Accessible, standards-aligned braille plate and cylinder STL creation</p>
    </header>

    <div class="main-content">
      <div class="panel controls-panel">
        <h2 style="margin-bottom: 20px; color: #333;">Enter Text for Braille Translation</h2>
        <div class="form-group">
          <label for="text-input">Text to Convert (Max 4 lines)</label>
          <textarea id="text-input" placeholder="Enter your text here... (Line 1)&#10;(Line 2)&#10;(Line 3)&#10;(Line 4)">Hello World\nWelcome to\nBraille3D\nStudio</textarea>
          <div class="info-text">Contracted braille uses Grade 2 (UEB). Up to 4 lines. 2 cells are reserved for row indicators; remaining cells available for text.</div>
        </div>

        <div class="form-group">
          <fieldset>
            <legend>Select Language</legend>
            <label style="display:block; margin-bottom:6px;"><input type="radio" name="lang" id="lang-g2" value="g2" checked> English, U.S., contracted (UEB grade 2)</label>
            <label style="display:block;"><input type="radio" name="lang" id="lang-g1" value="g1"> English, U.S., uncontracted (UEB grade 1)</label>
          </fieldset>
          <div class="helper-note">Grade 2 is default for U.S. English</div>
        </div>

        <div class="form-group">
          <label>Select Output Shape</label>
          <div class="shape-selector">
            <button class="shape-btn active" data-shape="card">Flat Card</button>
            <button class="shape-btn" data-shape="cylinder">Cylinder</button>
          </div>
          <div class="helper-note">Any changes here affect both plates.</div>
        </div>

        <div class="braille-preview-container">
          <div class="braille-preview-label">Preview Braille Translation</div>
          <div class="braille-preview" id="braille-preview"></div>
        </div>

        <div class="disclosure">
          <button id="program-desc-toggle">Program Description • More Info ▼</button>
          <div class="content" id="program-desc" style="display:none;">
            This tool generates 3D-printable STL files for braille embossing plates and universal counter plates, and supports cylinder workflows. Translation is powered by Liblouis (UEB).
          </div>
        </div>

        <div class="disclosure">
          <button id="instructions-toggle">Instructions (Cylinder-first workflow) ▼</button>
          <div class="content" id="instructions" style="display:none;">
            <ol>
              <li>Select Cylinder in Output Shape and set cylinder dimensions.</li>
              <li>Enter your text and verify translation in the preview.</li>
              <li>Generate the Embossing Plate and print.</li>
              <li>Switch to Universal Counter Plate and generate/print.</li>
              <li>Use the counter plate to create consistent, recessed impressions.</li>
            </ol>
          </div>
        </div>

        <div class="disclosure">
          <button id="ack-toggle">Acknowledgements ▼</button>
          <div class="content" id="ack" style="display:none;">
            Translation by Liblouis. Thanks to contributors and the braille community for guidance and testing.
          </div>
        </div>

        <div class="expert-section">
          <div class="toggle-group">
            <input type="checkbox" id="expert-mode" />
            <label for="expert-mode" style="margin-bottom: 0; cursor: pointer;">
              <strong>Show Expert Mode ▼</strong>
            </label>
          </div>

          <div class="expert-params hidden" id="expert-params">
            <div class="param-section">
              <h4>Output shape</h4>
              <div class="helper-note">Any changes here affect both plates.</div>
              <div class="shape-selector">
                <button class="shape-btn active" data-shape="card">Flat Card</button>
                <button class="shape-btn" data-shape="cylinder">Cylinder</button>
              </div>
            </div>

            <div class="param-section card-params">
              <h4>Plate Dimensions (flat)</h4>
              <div class="param-grid">
                <div class="param-input">
                  <label>Plate Width (mm)</label>
                  <input type="number" id="card-width" value="88" step="1" min="50" max="150">
                </div>
                <div class="param-input">
                  <label>Plate Height (mm)</label>
                  <input type="number" id="card-height" value="51" step="1" min="30" max="100">
                </div>
                <div class="param-input">
                  <label>Plate Thickness (mm)</label>
                  <input type="number" id="plate-thickness" value="3" step="0.5" min="2" max="10">
                </div>
              </div>
            </div>

            <div class="param-section">
              <h4>Braille Dimensions</h4>
              <div class="param-grid">
                <div class="param-input">
                  <label>Number of Braille Cells (Characters)</label>
                  <input type="number" id="grid-columns" value="14" step="1" min="8" max="30">
                  <div class="section-note">2 cells reserved for row indicators... 12 cells available.</div>
                </div>
                <div class="param-input">
                  <label>Number of Braille Lines</label>
                  <input type="number" id="grid-rows" value="4" step="1" min="1" max="6">
                </div>
                <div class="param-input">
                  <label>Braille Cell Spacing</label>
                  <input type="number" id="cell-width" value="6.5" step="0.1" min="4" max="10">
                </div>
                <div class="param-input">
                  <label>Braille Line Spacing</label>
                  <input type="number" id="line-spacing" value="10.0" step="0.1" min="8" max="15">
                </div>
                <div class="param-input">
                  <label>Braille Dot Spacing</label>
                  <input type="number" id="dot-spacing" value="2.5" step="0.1" min="1.5" max="4">
                </div>
              </div>
            </div>

            <div class="param-section cylinder-params" style="display:none;">
              <h4>Cylinder Dimensions</h4>
              <div class="param-grid">
                <div class="param-input">
                  <label>Cylinder Diameter (mm)</label>
                  <input type="number" id="cylinder-diameter" value="31.35" step="0.1" min="20" max="100">
                </div>
                <div class="param-input">
                  <label>Cylinder Height (mm)</label>
                  <input type="number" id="cylinder-height" value="51" step="1" min="20" max="200">
                </div>
                <div class="param-input">
                  <label>Polygonal Cutout Inscribed Radius (mm)</label>
                  <input type="number" id="cutout-radius" value="13" step="1" min="0" max="30">
                </div>
                <div class="param-input">
                  <label>Cutout Sides</label>
                  <input type="number" id="cutout-sides" value="12" step="1" min="3" max="20">
                </div>
                <div class="param-input">
                  <label>Seam Offset (degrees)</label>
                  <input type="number" id="seam-offset" value="355" step="1" min="0" max="360">
                </div>
              </div>
              <div class="inline-warning" id="cylinder-warning" style="display:none;">Warning: Rotating the seam changes the starting position of rows and indicators.</div>
            </div>

            <div class="param-section">
              <h4>Dot Dimensions (emboss)</h4>
              <div class="param-grid">
                <div class="param-input">
                  <label>Dot height (mm)</label>
                  <input type="number" id="dot-height" value="1.0" step="0.1" min="0.1" max="2">
                </div>
                <div class="param-input">
                  <label>Dot diameter (mm)</label>
                  <input type="number" id="dot-diameter" value="1.8" step="0.1" min="0.5" max="3">
                </div>
                <div class="param-input">
                  <label>Flat hat diameter (mm)</label>
                  <input type="number" id="dot-top" value="0.4" step="0.1" min="0.1" max="2">
                </div>
              </div>
            </div>

            <div class="param-section">
              <h4>Counter Dot Dimensions</h4>
              <div class="param-grid">
                <div class="param-input">
                  <label>Counter Dot Diameter Offset (mm)</label>
                  <input type="number" id="counter-offset" value="0.0" step="0.1" min="-1" max="1">
                  <div class="section-note">Positive increases recess size; negative decreases relative to emboss dot diameter. Counter plate mirrors the emboss dot diameter plus this offset.</div>
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
              <h4>Positioning</h4>
              <div class="param-grid">
                <div class="param-input">
                  <label>X Adjust</label>
                  <input type="number" id="x-offset" value="0" step="0.1" min="-10" max="10">
                </div>
                <div class="param-input">
                  <label>Y Adjust</label>
                  <input type="number" id="y-offset" value="0" step="0.1" min="-10" max="10">
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="generate-section">
          <label>Select Plate to Generate</label>
          <div class="plate-selector">
            <button class="plate-btn active" data-plate="emboss">Embossing Plate</button>
            <button class="plate-btn" data-plate="counter">Universal Counter Plate</button>
          </div>
          <div class="helper-note">Embossing creates raised braille dots. Universal Counter creates recessed dots.</div>
          <button class="generate-btn" id="generate-btn">Generate STL</button>
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
    this.apiBaseUrl = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || '';
    this.fontScale = 1.0;
    this.worker = null;
    this.workerReady = false;
    this.pendingMessages = new Map();
    this.messageSeq = 1;
    this.grade = 'g2'; // g1 or g2
    this.serverStlBlob = null;

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
    // Top chrome controls
    const updateFontUi = () => {
      const pct = Math.round(this.fontScale * 100);
      document.getElementById('font-current').textContent = pct + '%';
      document.body.style.fontSize = pct + '%';
    };
    document.getElementById('font-inc').addEventListener('click', () => { this.fontScale = Math.min(1.8, this.fontScale + 0.1); updateFontUi(); });
    document.getElementById('font-dec').addEventListener('click', () => { this.fontScale = Math.max(0.7, this.fontScale - 0.1); updateFontUi(); });
    document.getElementById('font-reset').addEventListener('click', () => { this.fontScale = 1.0; updateFontUi(); });
    updateFontUi();

    document.getElementById('theme-toggle').addEventListener('click', e => {
      document.body.classList.toggle('dark-theme');
      const isDark = document.body.classList.contains('dark-theme');
      e.target.textContent = 'Change Theme to → ' + (isDark ? 'Light' : 'Dark');
    });
    document.getElementById('contrast-toggle').addEventListener('click', e => {
      document.body.classList.toggle('high-contrast');
      e.target.classList.toggle('active', document.body.classList.contains('high-contrast'));
    });

    // Disclosures
    const hookDisclosure = (btnId, contentId) => {
      const btn = document.getElementById(btnId); const content = document.getElementById(contentId);
      if (btn && content) btn.addEventListener('click', () => { content.style.display = content.style.display === 'none' ? 'block' : 'none'; });
    };
    hookDisclosure('program-desc-toggle', 'program-desc');
    hookDisclosure('instructions-toggle', 'instructions');
    hookDisclosure('ack-toggle', 'ack');

    // Text + language
    document.getElementById('text-input').addEventListener('input', () => this.translateText());
    const langG2 = document.getElementById('lang-g2');
    const langG1 = document.getElementById('lang-g1');
    if (langG2) langG2.addEventListener('change', () => { if (langG2.checked) { this.grade = 'g2'; this.translateText(); } });
    if (langG1) langG1.addEventListener('change', () => { if (langG1.checked) { this.grade = 'g1'; this.translateText(); } });

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
      'counter-offset': 'counter_plate_dot_size_offset',
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

    // Cylinder warning on seam change
    const seamEl = document.getElementById('seam-offset');
    if (seamEl) seamEl.addEventListener('change', () => {
      const warn = document.getElementById('cylinder-warning');
      if (warn) warn.style.display = (parseFloat(seamEl.value) !== 355) ? 'block' : 'none';
    });
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
    try {
      this.worker = new Worker('static/liblouis-worker.js');
      this.worker.onmessage = (e) => {
        const { id, type, result } = e.data || {};
        if (!id) return;
        const resolver = this.pendingMessages.get(id);
        if (resolver) {
          this.pendingMessages.delete(id);
          resolver(result);
        }
      };
      this.callWorker('init', {}).then(res => {
        this.workerReady = !!(res && res.success);
        this.translateText();
      }).catch(() => { this.workerReady = false; this.translateText(); });
    } catch (e) {
      console.warn('Liblouis worker failed to initialize, falling back to naive mapping', e);
      this.worker = null;
      this.workerReady = false;
      this.translateText();
    }
  }

  callWorker(type, data) {
    return new Promise((resolve) => {
      const id = this.messageSeq++;
      this.pendingMessages.set(id, resolve);
      this.worker.postMessage({ id, type, data });
      // Add safety timeout
      setTimeout(() => { if (this.pendingMessages.has(id)) { this.pendingMessages.delete(id); resolve({ success: false, error: 'timeout' }); } }, 8000);
    });
  }

  translateText() {
    const text = document.getElementById('text-input').value;
    const rawLines = text.split('\n').slice(0,4);
    this.originalLines = rawLines.map(l => l.trim());
    const doRender = (joined) => {
      const lines = (joined || '').split('\n').slice(0,4);
      this.brailleTranslations = lines;
      document.getElementById('braille-preview').textContent = this.brailleTranslations.join('\n');
    };
    if (this.worker && this.workerReady) {
      this.callWorker('translate', { text, grade: this.grade }).then(res => {
        if (res && res.success) doRender(res.translation); else doRender(text);
      }).catch(() => doRender(text));
    } else {
      // Fallback: identity (no translation)
      doRender(text);
    }
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
        // Try server generation in background if available
        this.serverStlBlob = null;
        this.tryServerGeneration().finally(() => {
          this.hideLoading(); this.showStatus('Model generated successfully!', 'success');
        });
      } catch (e) {
        console.error(e); this.hideLoading(); this.showStatus('Error generating model: ' + e.message, 'error');
      }
    }, 50);
  }

  async tryServerGeneration() {
    try {
      if (!this.apiBaseUrl) return;
      if (this.currentShape !== 'card') return; // Backend only supports flat plates
      if (this.currentPlate === 'emboss') {
        const lines = this.buildBrailleLinesForServer();
        const resp = await fetch(this.apiBaseUrl + '/generate_braille_stl', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ braille_lines: lines })
        });
        if (resp.ok) this.serverStlBlob = await resp.blob();
      } else {
        const body = {
          emboss_dot_base_diameter: this.settings.emboss_dot_base_diameter,
          counter_plate_dot_size_offset: this.settings.counter_plate_dot_size_offset || 0,
        };
        const resp = await fetch(this.apiBaseUrl + '/generate_counter_plate_stl', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (resp.ok) this.serverStlBlob = await resp.blob();
      }
    } catch (e) {
      console.warn('Server STL generation failed or unavailable', e);
    }
  }

  buildBrailleLinesForServer() {
    const availableColumns = Math.max(0, (this.settings.grid_columns || 14) - 2);
    const lines = [];
    for (let i = 0; i < 4; i++) {
      const line = (this.brailleTranslations[i] || '').slice(0, availableColumns);
      lines.push(line);
    }
    return lines;
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
    let blobPromise;
    if (this.serverStlBlob) {
      blobPromise = Promise.resolve(this.serverStlBlob);
    } else {
      const exporter = new THREE.STLExporter();
      const stlString = exporter.parse(this.currentMesh);
      blobPromise = Promise.resolve(new Blob([stlString], { type: 'text/plain' }));
    }
    let filename = 'braille_';
    if (this.currentPlate === 'emboss') {
      filename += 'embossing_plate_';
      if (this.originalLines[0]) filename += this.originalLines[0].substring(0,20).replace(/\s+/g,'_');
    } else {
      filename += 'counter_plate';
    }
    filename += '_' + this.currentShape + '.stl';
    blobPromise.then(blob => { saveAs(blob, filename); this.showStatus('STL file downloaded!', 'success'); });
  }
}

window.braille3DStudio = new Braille3DStudio();



