(function () {
  const canvas = document.getElementById("sceneCanvas");
  if (!canvas || !window.THREE) return;

  let scene, camera, renderer, raycaster, mouse;
  let currentScene = "park";
  let rotatingRoots = [];
  let placedModels = []; // user-dropped models
  let theta = 0.55, phi = 0.72, radius = 24;
  let isDraggingCam = false, prevX = 0, prevY = 0;
  let groundPlane = null;

  // Library state: { id, name, url, sizeLabel }
  const library = [];
  let dragModelId = null;
  let lastPlacedItem = null; // re-place after day/night rebuild

  function isNightMode() {
    return document.body.classList.contains("night-mode");
  }

  const sceneMeta = {
    park: { titleKey: "scene_park_title", descKey: "scene_park_desc" },
    square: { titleKey: "scene_square_title", descKey: "scene_square_desc" },
    public: { titleKey: "scene_public_title", descKey: "scene_public_desc" }
  };

  function ensureGLTFLoader(cb) {
    if (window.THREE && THREE.GLTFLoader) return cb();
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js";
    s.onload = cb;
    s.onerror = cb;
    document.head.appendChild(s);
  }

  function updateCam() {
    camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
    camera.position.y = radius * Math.cos(phi);
    camera.position.z = radius * Math.sin(phi) * Math.cos(theta);
    camera.lookAt(0, 2, 0);
  }

  function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(48, canvas.clientWidth / canvas.clientHeight, 0.1, 300);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, (window.innerWidth < 768 ? 1.15 : 2)));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (THREE.ACESFilmicToneMapping) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
    }
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // camera orbit
    canvas.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      isDraggingCam = true;
      prevX = e.clientX; prevY = e.clientY;
    });
    window.addEventListener("mouseup", () => { isDraggingCam = false; });
    window.addEventListener("mousemove", (e) => {
      if (!isDraggingCam) return;
      theta -= (e.clientX - prevX) * 0.005;
      phi = Math.max(0.2, Math.min(1.35, phi + (e.clientY - prevY) * 0.005));
      prevX = e.clientX; prevY = e.clientY;
      updateCam();
    });
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      radius = Math.max(10, Math.min(45, radius + e.deltaY * 0.02));
      updateCam();
    }, { passive: false });

    window.resetCam = () => { theta = 0.55; phi = 0.72; radius = 24; updateCam(); };
    document.getElementById("resetCam")?.addEventListener("click", window.resetCam);
    document.getElementById("clearPlaced")?.addEventListener("click", function () { clearPlacedModels(true); });

    document.querySelectorAll(".scene-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".scene-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        currentScene = tab.dataset.scene;
        // keep library; rebuild environment but re-add placed? For simplicity clear placed on scene switch
        clearPlacedModels();
        buildScene(currentScene);
        updateLabels();
      });
    });

    window.updateSceneLabels = updateLabels;
    setupLibraryUI();
    loadDefaultModels();
    updateCam();
    buildScene("park");
    animate();
  }

  // ---------- Default models: every file listed in assets/models/list.js ----------
  function modelsBasePath() {
    // works from index.html at root
    return "assets/models/";
  }

  function loadDefaultModels() {
    const base = modelsBasePath();

    function applyFiles(files) {
      if (!files || !files.length) return;
      files.forEach(function (file) {
        if (!/\.(glb|gltf)$/i.test(file)) return;
        const id = "file-" + file.replace(/[^\w.-]+/g, "-");
        if (library.some(function (x) { return x.id === id || x.url === base + file; })) return;
        const name = file.replace(/\.(glb|gltf)$/i, "");
        const item = {
          id: id,
          name: name,
          nameEn: name,
          url: base + file,
          sizeLabel: "پوشه",
          isTemplate: true
        };
        library.push(item);
      });
      renderLibrary();
      requestAnimationFrame(function () {
        library.filter(function (x) { return x.isTemplate; }).forEach(function (item) {
          if (!document.getElementById("thumb-" + item.id) || !document.getElementById("thumb-" + item.id).querySelector("canvas")) {
            renderThumb(item);
          }
        });
      });
    }

    // 1) already injected
    if (window.SADEGHATI_MODELS && window.SADEGHATI_MODELS.length) {
      applyFiles(window.SADEGHATI_MODELS);
      return;
    }

    // 2) load list.js generated from folder contents
    const s = document.createElement("script");
    s.src = base + "list.js";
    s.onload = function () {
      applyFiles(window.SADEGHATI_MODELS || []);
    };
    s.onerror = function () {
      console.warn("assets/models/list.js not found — add GLB files and regenerate list.js");
    };
    document.head.appendChild(s);
  }

  // ---------- Library UI ----------
  function setupLibraryUI() {
    const input = document.getElementById("modelUpload");
    const viewport = document.getElementById("sceneViewport");
    const overlay = document.getElementById("dropOverlay");

    input?.addEventListener("change", (e) => {
      const files = Array.from(e.target.files || []);
      files.forEach(addFileToLibrary);
      input.value = "";
    });

    // Drag from library cards onto viewport
    viewport?.addEventListener("dragover", (e) => {
      if (!dragModelId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      overlay?.classList.add("active");
    });
    viewport?.addEventListener("dragleave", (e) => {
      if (!viewport.contains(e.relatedTarget)) overlay?.classList.remove("active");
    });
    viewport?.addEventListener("drop", (e) => {
      e.preventDefault();
      overlay?.classList.remove("active");
      const id = e.dataTransfer.getData("text/model-id") || dragModelId;
      dragModelId = null;
      if (!id) return;
      const item = library.find((m) => m.id === id);
      if (!item) return;
      const rect = canvas.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      placeModelAt(item, ndcX, ndcY);
    });
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function addFileToLibrary(file) {
    const name = file.name.replace(/\.(glb|gltf)$/i, "");
    const url = URL.createObjectURL(file);
    const id = "m_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    const item = { id, name, url, sizeLabel: formatSize(file.size), file };
    // One active model identity in library list can grow, but scene shows only latest
    library.push(item);
    renderLibrary();
    requestAnimationFrame(() => renderThumb(item));
    // Immediately spawn at center of current map (replaces previous)
    if (scene) placeModelAtCenter(item);
  }

  function renderLibrary() {
    const list = document.getElementById("modelList");
    const empty = document.getElementById("libEmpty");
    if (!list) return;
    list.querySelectorAll(".model-card").forEach((el) => el.remove());
    if (empty) empty.style.display = library.length ? "none" : "block";

    library.forEach((item) => {
      const card = document.createElement("div");
      card.className = "model-card";
      card.draggable = true;
      card.dataset.id = item.id;
      const label = (document.body.dataset.lang === "en" && item.nameEn) ? item.nameEn : item.name;
      const tag = item.isTemplate ? (document.body.dataset.lang === "en" ? "Template" : "الگو") : (item.sizeLabel + " · GLB");
      card.innerHTML = `
        <div class="model-thumb" id="thumb-${item.id}"></div>
        <div class="model-meta">
          <strong title="${label}">${label}</strong>
          <span>${tag}</span>
        </div>
        <button type="button" class="model-remove" title="حذف" aria-label="remove">&times;</button>
      `;
      card.addEventListener("dragstart", (e) => {
        dragModelId = item.id;
        e.dataTransfer.setData("text/model-id", item.id);
        e.dataTransfer.effectAllowed = "copy";
        card.classList.add("dragging");
      });
      card.addEventListener("dragend", () => {
        card.classList.remove("dragging");
        dragModelId = null;
        document.getElementById("dropOverlay")?.classList.remove("active");
      });
      card.querySelector(".model-remove").addEventListener("click", (e) => {
        e.stopPropagation();
        removeFromLibrary(item.id);
      });
      list.appendChild(card);
    });
  }

  function removeFromLibrary(id) {
    const idx = library.findIndex((m) => m.id === id);
    if (idx < 0) return;
    if (!library[idx].isTemplate && library[idx].url.startsWith("blob:")) {
      URL.revokeObjectURL(library[idx].url);
    }
    library.splice(idx, 1);
    renderLibrary();
  }

  function renderThumb(item) {
    const host = document.getElementById("thumb-" + item.id);
    if (!host || !THREE.GLTFLoader) return;
    const w = 48, h = 48;
    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = w; thumbCanvas.height = h;
    host.appendChild(thumbCanvas);
    const r = new THREE.WebGLRenderer({ canvas: thumbCanvas, antialias: true, alpha: true });
    r.setSize(w, h, false);
    const s = new THREE.Scene();
    const c = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    s.add(new THREE.AmbientLight(0xffffff, 0.8));
    const d = new THREE.DirectionalLight(0xffe8c0, 0.9);
    d.position.set(2, 3, 4);
    s.add(d);
    const loader = new THREE.GLTFLoader();
    loader.load(item.url, (gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      model.scale.setScalar(1.4 / maxDim);
      box.setFromObject(model);
      const center = new THREE.Vector3();
      box.getCenter(center);
      model.position.sub(center);
      s.add(model);
      c.position.set(1.2, 1.0, 1.8);
      c.lookAt(0, 0, 0);
      let frame = 0;
      function spin() {
        if (!host.isConnected) { r.dispose(); return; }
        model.rotation.y += 0.03;
        r.render(s, c);
        if (frame++ < 120) requestAnimationFrame(spin);
        else r.render(s, c);
      }
      spin();
    }, undefined, () => {
      host.textContent = "3D";
      host.style.fontSize = "0.7rem";
      host.style.fontWeight = "700";
    });
  }

  // ---------- Place model: always center, one per map, no auto-spin ----------
  function getGroundY(x, z) {
    const origin = new THREE.Vector3(x, 50, z);
    const dir = new THREE.Vector3(0, -1, 0);
    raycaster.set(origin, dir);
    const hits = raycaster.intersectObjects(scene.children, true);
    for (let i = 0; i < hits.length; i++) {
      const h = hits[i];
      let p = h.object;
      let isPlaced = false;
      while (p) {
        if (p.userData && p.userData.isUserPlaced) { isPlaced = true; break; }
        p = p.parent;
      }
      if (isPlaced) continue;
      if (h.face && h.face.normal && h.face.normal.y < 0.35) continue;
      return h.point.y;
    }
    return 0;
  }

  function smartFitModel(model) {
    model.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (!isFinite(maxDim) || maxDim < 1e-6) {
      return { scale: 1, height: 1, width: 1 };
    }
    const aspectH = size.y / maxDim;
    let target;
    if (aspectH > 0.65) target = 3.2;
    else if (aspectH < 0.35) target = 2.4;
    else target = 2.8;
    if (maxDim > 50) target *= 1.15;
    if (maxDim < 0.5) target = Math.min(target, 2.2);
    const scale = target / maxDim;
    model.scale.multiplyScalar(scale);
    model.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(model);
    box.getCenter(center);
    box.getSize(size);
    model.position.x -= center.x;
    model.position.z -= center.z;
    return { scale, height: size.y, width: Math.max(size.x, size.z), minY: box.min.y, maxY: box.max.y };
  }

  function placeModelAt(item, ndcX, ndcY) {
    // Always spawn at designed center of current map (ignore drop XY)
    placeModelAtCenter(item);
  }

  function placeModelAtCenter(item) {
    if (!THREE.GLTFLoader) {
      ensureGLTFLoader(() => placeModelAtCenter(item));
      return;
    }

    // Only ONE model per map — replace previous
    clearPlacedModels();

    const loader = new THREE.GLTFLoader();
    loader.load(
      item.url,
      (gltf) => {
        // ensure still only one (race-safe)
        clearPlacedModels();

        const model = gltf.scene;
        model.traverse((c) => {
          if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
            if (c.material) {
              const mats = Array.isArray(c.material) ? c.material : [c.material];
              mats.forEach((m) => {
                if (m.map && THREE.sRGBEncoding) m.map.encoding = THREE.sRGBEncoding;
                m.needsUpdate = true;
              });
            }
          }
        });

        smartFitModel(model);

        const root = new THREE.Group();
        root.add(model);
        root.position.set(0, 0, 0);
        root.userData.isUserPlaced = true;
        root.userData.spin = false; // no auto rotation
        root.userData.sourceName = item.name;
        lastPlacedItem = item;

        scene.add(root);
        root.updateMatrixWorld(true);

        // Smart ground distance at center
        const worldBox = new THREE.Box3().setFromObject(root);
        const gy = getGroundY(0, 0);
        root.position.y += (gy - worldBox.min.y) + 0.02;

        // Refine with footprint samples around center
        root.updateMatrixWorld(true);
        const wb = new THREE.Box3().setFromObject(root);
        const hx = Math.max(0.25, (wb.max.x - wb.min.x) * 0.3);
        const hz = Math.max(0.25, (wb.max.z - wb.min.z) * 0.3);
        const samples = [
          getGroundY(0, 0),
          getGroundY(hx, 0),
          getGroundY(-hx, 0),
          getGroundY(0, hz),
          getGroundY(0, -hz)
        ];
        const avgGround = samples.reduce((a, b) => a + b, 0) / samples.length;
        root.updateMatrixWorld(true);
        const wb2 = new THREE.Box3().setFromObject(root);
        root.position.y += (avgGround - wb2.min.y) + 0.02;

        placedModels.push(root);
        // NOT added to rotatingRoots — stays fixed; camera orbits around map
      },
      undefined,
      (err) => console.warn("Model load failed", item.name, err)
    );
  }

  function clearPlacedModels(full) {
    placedModels.forEach((root) => {
      scene.remove(root);
      rotatingRoots = rotatingRoots.filter((r) => r !== root);
      root.traverse((c) => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
          else c.material.dispose();
        }
      });
    });
    placedModels = [];
    if (full) lastPlacedItem = null;
  }

  // ---------- Scene build (environment) ----------
  function clearScene() {
    rotatingRoots = [];
    placedModels = [];
    while (scene.children.length) {
      const obj = scene.children[0];
      scene.remove(obj);
      obj.traverse?.((c) => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
          else c.material.dispose();
        }
      });
    }
  }



  // ---------- Realistic helpers ----------
  function noise2D(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  function fbm(x, y, oct) {
    let v = 0, a = 0.5, f = 1;
    for (let i = 0; i < oct; i++) {
      v += a * noise2D(x * f, y * f);
      f *= 2; a *= 0.5;
    }
    return v;
  }

  function makeTex(size, paintFn, repeat) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(size, size);
    const d = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const col = paintFn(x / size, y / size, x, y);
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat || 1, repeat || 1);
    tex.anisotropy = 8;
    if (renderer && renderer.capabilities) tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  const TEX = {};
  function T(key, fn) {
    if (!TEX[key]) TEX[key] = fn();
    return TEX[key];
  }

  function skyDome(top, mid, bot) {
    const geo = new THREE.SphereGeometry(120, 32, 16);
    // invert
    const c = document.createElement("canvas");
    c.width = 8; c.height = 32;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, 32);
    g.addColorStop(0, top);
    g.addColorStop(0.45, mid);
    g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 8, 32);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, fog: false });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
  }

  function lights(warm) {
    if (warm === undefined) warm = true;
    // low ambient — let directional do the work (more cinematic)
    scene.add(new THREE.AmbientLight(warm ? 0xc8b8a4 : 0x9aa8b8, 0.12));
    const sun = new THREE.DirectionalLight(warm ? 0xffe0b0 : 0xdde6f5, 2.1);
    sun.position.set(22, 40, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 100;
    sun.shadow.camera.left = -32;
    sun.shadow.camera.right = 32;
    sun.shadow.camera.top = 32;
    sun.shadow.camera.bottom = -32;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.04;
    scene.add(sun);
    const bounce = new THREE.DirectionalLight(warm ? 0x7a9ab0 : 0xb09070, 0.35);
    bounce.position.set(-20, 8, -16);
    scene.add(bounce);
    const hemi = new THREE.HemisphereLight(
      warm ? 0xe8dcc8 : 0xb0bcc8,
      warm ? 0x2a3020 : 0x1a1e24,
      0.55
    );
    scene.add(hemi);
  }

  function ground(texType, size) {
    if (size === undefined) size = 70;
    let map, rough = 0.92, metal = 0.02, col = 0xffffff;
    if (texType === "grass") {
      map = T("grass", function () {
        return makeTex(512, function (u, v, x, y) {
          const n = fbm(u * 10, v * 10, 5);
          const n2 = fbm(u * 28 + 3, v * 28, 3);
          const blade = n2 > 0.62 ? 1 : 0;
          const r = 34 + n * 40 + blade * 12;
          const g = 58 + n * 50 + blade * 18;
          const b = 28 + n * 22;
          return [r, g, b];
        }, 18);
      });
      rough = 0.97;
    } else if (texType === "plaza") {
      map = T("plaza", function () {
        return makeTex(512, function (u, v, x, y) {
          // stone tiles
          const tx = Math.floor(u * 12);
          const ty = Math.floor(v * 12);
          const fx = (u * 12) % 1;
          const fy = (v * 12) % 1;
          const grout = (fx < 0.06 || fy < 0.06) ? 0.7 : 1;
          const n = fbm(tx * 1.7 + u * 4, ty * 2.1 + v * 4, 4);
          const base = 95 + n * 35;
          return [base * grout * 1.05, base * grout * 0.96, base * grout * 0.85];
        }, 5);
      });
      rough = 0.78; metal = 0.04;
    } else if (texType === "urban") {
      map = T("urban", function () {
        return makeTex(512, function (u, v) {
          const n = fbm(u * 8, v * 8, 5);
          const crack = fbm(u * 40, v * 40, 2) > 0.78 ? 0.75 : 1;
          const base = 42 + n * 28;
          return [base * crack, base * crack * 1.02, base * crack * 1.08];
        }, 7);
      });
      rough = 0.72; metal = 0.06;
    } else {
      map = T("dirt", function () {
        return makeTex(256, function (u, v) {
          const n = fbm(u * 12, v * 12, 5);
          return [90 + n * 50, 72 + n * 40, 48 + n * 28];
        }, 6);
      });
    }
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(size / 2, 128),
      new THREE.MeshStandardMaterial({ map: map, color: col, roughness: rough, metalness: metal })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    scene.add(mesh);
    // soft contact shadow disc at center
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.22,
      depthWrite: false
    });
    const contact = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32), shadowMat);
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.03;
    scene.add(contact);
    scene.fog = new THREE.Fog(scene.background.getHex(), 28, 95);
    return mesh;
  }

  function mat(color, opts) {
    opts = opts || {};
    return new THREE.MeshStandardMaterial({
      color: color,
      roughness: opts.roughness != null ? opts.roughness : 0.6,
      metalness: opts.metalness != null ? opts.metalness : 0.1,
      emissive: opts.emissive != null ? opts.emissive : 0x000000,
      emissiveIntensity: opts.emissiveIntensity != null ? opts.emissiveIntensity : 0
    });
  }

  function addTree(x, z, scale) {
    if (scale === undefined) scale = 1;
    const g = new THREE.Group();
    // bark texture trunk
    const trunkMat = mat(0x3d2a1c, { roughness: 0.95, metalness: 0 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.22 * scale, 2.8 * scale, 8), trunkMat);
    trunk.position.y = 1.4 * scale;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    g.add(trunk);
    // realistic-ish canopy: darker underside, varied greens, flattened spheres
    const layers = [
      { y: 2.5, r: 1.15, c: 0x1e3d24, sy: 0.55 },
      { y: 3.1, r: 1.0, c: 0x2a5230, sy: 0.5 },
      { y: 3.6, r: 0.8, c: 0x356338, sy: 0.48 },
      { y: 4.05, r: 0.55, c: 0x3f7340, sy: 0.45 }
    ];
    layers.forEach(function (L) {
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(L.r * scale, 10, 8),
        mat(L.c, { roughness: 0.9, metalness: 0 })
      );
      leaf.position.y = L.y * scale;
      leaf.scale.y = L.sy;
      leaf.castShadow = true;
      leaf.receiveShadow = true;
      g.add(leaf);
    });
    g.position.set(x, 0, z);
    // tiny random lean
    g.rotation.z = (Math.random() - 0.5) * 0.08;
    g.rotation.x = (Math.random() - 0.5) * 0.06;
    scene.add(g);
  }

  function addLamp(x, z) {
    const g = new THREE.Group();
    const metal = mat(0x2a2a2c, { metalness: 0.75, roughness: 0.32 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 4.4, 10), metal);
    pole.position.y = 2.2; pole.castShadow = true; g.add(pole);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.85, 8), metal);
    arm.rotation.z = Math.PI / 2; arm.position.set(0.35, 4.25, 0); g.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.2), metal);
    head.position.set(0.7, 4.2, 0); g.add(head);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.04, 0.16),
      mat(0xfff5e0, { emissive: 0xffe0a8, emissiveIntensity: 0.7, roughness: 0.25 })
    );
    glass.position.set(0.7, 4.13, 0); g.add(glass);
    const light = new THREE.SpotLight(0xffe8c0, 0.9, 18, Math.PI / 5, 0.45, 1.5);
    light.position.set(0.7, 4.15, 0);
    light.target.position.set(0.7, 0, 0);
    g.add(light); g.add(light.target);
    g.position.set(x, 0, z);
    scene.add(g);
  }

  function buildPark() {
    const night = isNightMode();
    if (night) {
      scene.background = new THREE.Color(0x0a0e16);
      skyDome("#050810", "#0c1422", "#151a14");
      lights(false);
    } else {
      scene.background = new THREE.Color(0x87a0b0);
      skyDome("#6a8aad", "#b8c8d4", "#d4c8b0");
      lights(true);
    }
    ground("grass", 75);

    // dirt path
    const pathMat = new THREE.MeshStandardMaterial({
      map: T("path", function () {
        return makeTex(256, function (u, v) {
          const n = fbm(u * 14, v * 6, 5);
          const r = 100 + n * 40, g = 82 + n * 32, b = 55 + n * 22;
          return [r, g, b];
        }, 3);
      }),
      roughness: 0.95,
      metalness: 0.0
    });
    const path = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 42), pathMat);
    path.rotation.x = -Math.PI / 2; path.position.y = 0.035; path.receiveShadow = true;
    scene.add(path);
    [-1.5, 1.5].forEach(function (ox) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 42), mat(0x6a645c, { roughness: 0.88 }));
      curb.position.set(ox, 0.06, 0); curb.receiveShadow = true; scene.add(curb);
    });

    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const r = 11 + (i % 5) * 2.2 + Math.random();
      addTree(Math.cos(a) * r, Math.sin(a) * r, 0.9 + Math.random() * 0.5);
    }
    addTree(-7.5, 5.5, 1.2); addTree(8.2, 4.8, 1.05); addTree(-5.5, -8, 1.15);

    // wood benches
    [-1, 1].forEach(function (side) {
      const g = new THREE.Group();
      const wood = mat(0x4a3224, { roughness: 0.85, metalness: 0.02 });
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.5), wood);
      seat.position.y = 0.48; seat.castShadow = true; g.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.45, 0.06), wood);
      back.position.set(0, 0.75, -0.24); g.add(back);
      const iron = mat(0x1e1e20, { metalness: 0.6, roughness: 0.4 });
      [-1, 1].forEach(function (lx) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.48, 0.4), iron);
        leg.position.set(lx * 1.0, 0.24, 0); g.add(leg);
      });
      g.position.set(side * 4.8, 0, 3.5); scene.add(g);
    });

    addLamp(-7, -6); addLamp(7, -6); addLamp(-7, 9); addLamp(7, 9);

    // concrete pedestal
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.7, 0.35, 64),
      mat(0x9a948a, { roughness: 0.65, metalness: 0.08 })
    );
    base.position.y = 0.175; base.castShadow = true; base.receiveShadow = true; scene.add(base);
  }

  function buildSquare() {
    const night = isNightMode();
    if (night) {
      scene.background = new THREE.Color(0x0b0f18);
      skyDome("#060a12", "#10182a", "#1a1814");
      lights(false);
    } else {
      scene.background = new THREE.Color(0x8a9aaa);
      skyDome("#5a7a98", "#a8b8c4", "#c8bca8");
      lights(true);
    }
    ground("plaza", 80);

    // fountain
    const stone = mat(0x9a9084, { roughness: 0.5, metalness: 0.12 });
    const b1 = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.6, 0.5, 64), stone);
    b1.position.y = 0.25; b1.castShadow = true; b1.receiveShadow = true; scene.add(b1);
    const b2 = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.5, 0.65, 48), stone);
    b2.position.y = 0.7; b2.castShadow = true; scene.add(b2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x3d6a7a, metalness: 0.7, roughness: 0.08, transparent: true, opacity: 0.78
    });
    const w1 = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.0, 0.06, 64), waterMat);
    w1.position.y = 0.48; scene.add(w1);
    const w2 = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.05, 48), waterMat);
    w2.position.y = 1.02; scene.add(w2);

    // buildings — muted real facades
    const blocks = [
      [-15, -5, 8, 10, 0x6b6358], [15, -4, 7, 12, 0x5c564c],
      [-15, 8, 7, 9, 0x645e54], [15, 7, 8, 11, 0x565048],
      [-17, 1.5, 5, 7, 0x5a544a], [17, 1, 5, 8, 0x524c44]
    ];
    blocks.forEach(function (f) {
      const x = f[0], z = f[1], w = f[2], h = f[3], col = f[4];
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 6), mat(col, { roughness: 0.88, metalness: 0.04 }));
      b.position.set(x, h / 2, z); b.castShadow = true; b.receiveShadow = true; scene.add(b);
      for (let row = 1.4; row < h - 1.2; row += 1.7) {
        for (let cx = -w * 0.3; cx <= w * 0.3; cx += 1.15) {
          const lit = Math.random() > 0.4;
          const win = new THREE.Mesh(
            new THREE.PlaneGeometry(0.5, 0.7),
            mat(lit ? 0xffe4b8 : 0x151c28, {
              emissive: lit ? 0xffd090 : 0x000000,
              emissiveIntensity: lit ? 0.35 : 0,
              roughness: 0.35
            })
          );
          win.position.set(x > 0 ? x - w / 2 - 0.02 : x + w / 2 + 0.02, row, z + cx);
          win.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;
          scene.add(win);
        }
      }
    });

    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const bollard = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.12, 0.85, 12),
        mat(0x7a7268, { metalness: 0.4, roughness: 0.38 })
      );
      bollard.position.set(Math.cos(a) * 8, 0.42, Math.sin(a) * 8);
      bollard.castShadow = true; scene.add(bollard);
    }
    addLamp(-10, -10); addLamp(10, -10); addLamp(-10, 10); addLamp(10, 10);
  }

  function buildPublic() {
    const night = isNightMode();
    if (night) {
      scene.background = new THREE.Color(0x06080c);
      skyDome("#03050a", "#0a1018", "#12141a");
      lights(false);
    } else {
      scene.background = new THREE.Color(0x6a7888);
      skyDome("#7a90a8", "#b0bcc8", "#c8c0b0");
      lights(true);
    }
    ground("urban", 70);

    const concrete = mat(0x555c66, { roughness: 0.7, metalness: 0.1 });
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 9.9, 0.45, 64), concrete);
    platform.position.y = 0.22; platform.receiveShadow = true; platform.castShadow = true; scene.add(platform);

    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.48), mat(0x3a404a, { roughness: 0.55, metalness: 0.18 }));
      bench.position.set(Math.cos(a) * 6.4, 0.5, Math.sin(a) * 6.4);
      bench.rotation.y = -a + Math.PI / 2;
      bench.castShadow = true; scene.add(bench);
    }

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const px = Math.cos(a) * 13, pz = Math.sin(a) * 13;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 6, 12), mat(0x2c3038, { metalness: 0.5, roughness: 0.38 }));
      pillar.position.set(px, 3, pz); pillar.castShadow = true; scene.add(pillar);
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 12, 12),
        mat(0xffecd0, { emissive: 0xffd8a0, emissiveIntensity: 0.9, roughness: 0.2 })
      );
      glow.position.set(px, 5.7, pz); scene.add(glow);
      const pl = new THREE.PointLight(0xffe4b8, 0.45, 12, 2);
      pl.position.set(px, 5.6, pz); scene.add(pl);
    }

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.25;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(9, 1.4, 0.3), mat(0x3a4048, { roughness: 0.8 }));
      wall.position.set(Math.cos(a) * 17, 0.7, Math.sin(a) * 17);
      wall.rotation.y = -a + Math.PI / 2;
      wall.receiveShadow = true; scene.add(wall);
    }
  }

  function buildScene(name) {
    const keep = lastPlacedItem;
    clearScene();
    // clearScene wipes placedModels but we keep lastPlacedItem reference
    lastPlacedItem = keep;
    if (name === "park") buildPark();
    else if (name === "square") buildSquare();
    else buildPublic();
    // restore user model after environment rebuild
    if (lastPlacedItem) {
      placeModelAtCenter(lastPlacedItem);
    }
  }

  // Day / Night from site theme
  window.addEventListener("site:timechange", function () {
    if (!scene) return;
    buildScene(currentScene);
  });

  function updateLabels() {
    const lang = document.body.dataset.lang || "fa";
    const data = sceneMeta[currentScene];
    const t = window.i18n?.translations?.[lang];
    if (!t) return;
    const titleEl = document.getElementById("sceneTitle");
    const descEl = document.getElementById("sceneDesc");
    if (titleEl) titleEl.textContent = t[data.titleKey] || "";
    if (descEl) descEl.textContent = t[data.descKey] || "";
  }

  function animate() {
    requestAnimationFrame(animate);
    const t = performance.now() * 0.001;
    rotatingRoots.forEach((root) => {
      if (root.userData.spin !== false) root.rotation.y = t * 0.35;
    });
    renderer.render(scene, camera);
  }

  function resizeScene() {
    if (!camera || !renderer || !canvas) return;
    const parent = canvas.parentElement;
    const w = Math.max(1, (parent && parent.clientWidth) || canvas.clientWidth || 1);
    const h = Math.max(1, (parent && parent.clientHeight) || canvas.clientHeight || 1);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
  }
  if (window.ResizeObserver) {
    new ResizeObserver(resizeScene).observe(canvas.parentElement || canvas);
  }
  window.addEventListener("resize", resizeScene, { passive: true });
  window.addEventListener("orientationchange", function () { setTimeout(resizeScene, 250); });

  ensureGLTFLoader(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !scene) {
        init();
        observer.disconnect();
      }
    }, { threshold: 0.1 });
    observer.observe(document.getElementById("showcase3d"));
  });
})();
