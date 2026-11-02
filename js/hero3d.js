(function () {
  const canvas = document.getElementById("heroCanvas");
  if (!canvas || !window.THREE) return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 0, 32);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, (window.innerWidth < 768 ? 1.25 : 2)));
  renderer.setClearColor(0x000000, 0);

  // Lights
  scene.add(new THREE.AmbientLight(0xfff5e8, 0.65));
  const dir = new THREE.DirectionalLight(0xffe8c8, 1.0);
  dir.position.set(6, 12, 10);
  scene.add(dir);
  const back = new THREE.DirectionalLight(0xc9a87c, 0.4);
  back.position.set(-8, -3, -6);
  scene.add(back);

  // ---- Build readable 3D text "صداقتی" using canvas texture on a plane group ----
  // This is the cleanest way without external font files.
  function createTextMesh(text, options = {}) {
    const {
      fontSize = 120,
      fontFamily = "Vazirmatn, Tahoma, sans-serif",
      color = "#c9a87c",
      depth = 0.8,
      scale = 0.08
    } = options;

    const padding = 40;
    const measure = document.createElement("canvas");
    const mctx = measure.getContext("2d");
    mctx.font = `800 ${fontSize}px ${fontFamily}`;
    const metrics = mctx.measureText(text);
    const tw = Math.ceil(metrics.width) + padding * 2;
    const th = fontSize + padding * 2;

    const c = document.createElement("canvas");
    c.width = tw;
    c.height = th;
    const ctx = c.getContext("2d");
    ctx.font = `800 ${fontSize}px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(text, tw / 2, th / 2);

    // Soft shadow layer for depth feel
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "rgba(60,40,20,0.35)";
    ctx.fillText(text, tw / 2 + 4, th / 2 + 6);

    const texture = new THREE.CanvasTexture(c);
    texture.needsUpdate = true;
    texture.anisotropy = 4;

    const group = new THREE.Group();

    // Front face
    const frontMat = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      metalness: 0.25,
      roughness: 0.4,
      side: THREE.DoubleSide
    });
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(tw * scale, th * scale),
      frontMat
    );
    group.add(plane);

    // Extruded depth layers (fake extrusion with stacked slightly offset planes)
    const layers = 6;
    for (let i = 1; i <= layers; i++) {
      const layerMat = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        opacity: 0.18 + (1 - i / layers) * 0.25,
        metalness: 0.3,
        roughness: 0.5,
        side: THREE.DoubleSide
      });
      const layer = new THREE.Mesh(
        new THREE.PlaneGeometry(tw * scale, th * scale),
        layerMat
      );
      layer.position.z = -i * (depth / layers);
      group.add(layer);
    }

    // Gold edge glow plane slightly larger
    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = tw;
    glowCanvas.height = th;
    const gctx = glowCanvas.getContext("2d");
    gctx.font = `800 ${fontSize}px ${fontFamily}`;
    gctx.textAlign = "center";
    gctx.textBaseline = "middle";
    gctx.shadowColor = "#e8d5b7";
    gctx.shadowBlur = 28;
    gctx.fillStyle = "rgba(232,213,183,0.5)";
    gctx.fillText(text, tw / 2, th / 2);
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(tw * scale * 1.02, th * scale * 1.02),
      new THREE.MeshBasicMaterial({
        map: glowTex,
        transparent: true,
        opacity: 0.55,
        depthWrite: false
      })
    );
    glow.position.z = 0.05;
    group.add(glow);

    return group;
  }

  // Wait a moment for the font to be available
  const textGroup = createTextMesh("صداقتی", {
    fontSize: 140,
    color: "#c9a87c",
    scale: 0.085,
    depth: 1.2
  });
  scene.add(textGroup);

  // Floating particles
  const particleGeo = new THREE.BufferGeometry();
  const count = 160;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 50;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 28;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 24 - 4;
  }
  particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const particles = new THREE.Points(
    particleGeo,
    new THREE.PointsMaterial({
      color: 0xd4b896,
      size: 0.14,
      transparent: true,
      opacity: 0.5
    })
  );
  scene.add(particles);

  // Mouse interaction
  let mouseX = 0;
  let mouseY = 0;
  let targetRotX = 0;
  let targetRotY = 0;

  document.addEventListener("mousemove", (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = (e.clientY / window.innerHeight) * 2 - 1;
  });

  // Scroll fade — only fade the 3D, leave HTML texts clean
  const hero = document.getElementById("hero");
  const heroContent = document.querySelector(".hero-content");

  function onScroll() {
    const rect = hero.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, -rect.top / (rect.height * 0.65)));
    const opacity = 1 - progress;
    textGroup.position.y = progress * 10;
    textGroup.scale.setScalar(1 - progress * 0.4);
    canvas.style.opacity = String(opacity);
    if (heroContent) {
      heroContent.style.opacity = String(Math.max(0, 1 - progress * 1.4));
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  // Animate
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    targetRotY = mouseX * 0.55;
    targetRotX = mouseY * 0.28;
    textGroup.rotation.y += (targetRotY - textGroup.rotation.y) * 0.07;
    textGroup.rotation.x += (targetRotX - textGroup.rotation.x) * 0.07;

    // gentle float
    textGroup.position.y += Math.sin(t * 0.9) * 0.012;

    particles.rotation.y = t * 0.03;
    particles.rotation.x = Math.sin(t * 0.2) * 0.05;

    renderer.render(scene, camera);
  }
  animate();

  function resizeHero() {
    var w = Math.max(1, window.innerWidth);
    var h = Math.max(1, window.innerHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
  }
  window.addEventListener("resize", resizeHero, { passive: true });
  window.addEventListener("orientationchange", function () { setTimeout(resizeHero, 200); });
})();
