(function () {
  var canvas = document.getElementById("heroCanvas");
  if (!canvas || !window.THREE) return;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  camera.position.set(0, 0, 28);

  var renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true,
    powerPreference: "default"
  });
  renderer.setClearColor(0x000000, 0);

  scene.add(new THREE.AmbientLight(0xfff5e8, 0.7));
  var dir = new THREE.DirectionalLight(0xffe8c8, 1.0);
  dir.position.set(6, 12, 10);
  scene.add(dir);
  var back = new THREE.DirectionalLight(0xc9a87c, 0.4);
  back.position.set(-8, -3, -6);
  scene.add(back);

  var textGroup = new THREE.Group();
  scene.add(textGroup);

  function createTextMesh(text) {
    var fontSize = 140;
    var fontFamily = "Vazirmatn, Tahoma, sans-serif";
    var color = "#c9a87c";
    var depth = 1.0;

    var measure = document.createElement("canvas");
    var mctx = measure.getContext("2d");
    mctx.font = "800 " + fontSize + "px " + fontFamily;
    var metrics = mctx.measureText(text);
    var tw = Math.ceil(metrics.width) + 80;
    var th = fontSize + 80;

    var c = document.createElement("canvas");
    c.width = tw;
    c.height = th;
    var ctx = c.getContext("2d");
    ctx.font = "800 " + fontSize + "px " + fontFamily;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(text, tw / 2, th / 2);
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "rgba(60,40,20,0.3)";
    ctx.fillText(text, tw / 2 + 3, th / 2 + 5);

    var texture = new THREE.CanvasTexture(c);
    texture.needsUpdate = true;

    var group = new THREE.Group();
    // unit plane then scale to fit viewport in fitTextToView
    var aspect = tw / th;
    var planeH = 4;
    var planeW = planeH * aspect;

    var frontMat = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      metalness: 0.25,
      roughness: 0.4,
      side: THREE.DoubleSide
    });
    var plane = new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeH), frontMat);
    group.add(plane);

    for (var i = 1; i <= 5; i++) {
      var layerMat = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        opacity: 0.12 + (1 - i / 5) * 0.2,
        metalness: 0.3,
        roughness: 0.5,
        side: THREE.DoubleSide
      });
      var layer = new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeH), layerMat);
      layer.position.z = -i * (depth / 5);
      group.add(layer);
    }

    group.userData.baseW = planeW;
    group.userData.baseH = planeH;
    return group;
  }

  // Wait briefly for font
  var mesh = createTextMesh("صداقتی");
  textGroup.add(mesh);

  // particles
  var particleGeo = new THREE.BufferGeometry();
  var count = window.innerWidth < 768 ? 60 : 140;
  var positions = new Float32Array(count * 3);
  for (var i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 40;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 22;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 18 - 2;
  }
  particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  var particles = new THREE.Points(
    particleGeo,
    new THREE.PointsMaterial({ color: 0xd4b896, size: 0.12, transparent: true, opacity: 0.45 })
  );
  scene.add(particles);

  // --- input: mouse + touch (pointer events) ---
  var pointerX = 0;
  var pointerY = 0;
  var targetRotX = 0;
  var targetRotY = 0;
  var dragging = false;
  var lastPX = 0;
  var lastPY = 0;
  var rotY = 0;
  var rotX = 0;

  function onPointerMove(e) {
    var rect = canvas.getBoundingClientRect();
    var cx = (e.clientX - rect.left) / Math.max(1, rect.width);
    var cy = (e.clientY - rect.top) / Math.max(1, rect.height);
    pointerX = cx * 2 - 1;
    pointerY = cy * 2 - 1;

    if (dragging) {
      rotY += (e.clientX - lastPX) * 0.005;
      rotX += (e.clientY - lastPY) * 0.004;
      rotX = Math.max(-0.6, Math.min(0.6, rotX));
      lastPX = e.clientX;
      lastPY = e.clientY;
    }
  }

  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", function (e) {
    dragging = true;
    lastPX = e.clientX;
    lastPY = e.clientY;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  });
  canvas.addEventListener("pointerup", function (e) {
    dragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
  });
  canvas.addEventListener("pointercancel", function () { dragging = false; });
  canvas.addEventListener("pointermove", onPointerMove, { passive: true });

  // also follow without drag on desktop
  window.addEventListener("mousemove", function (e) {
    if (dragging) return;
    pointerX = (e.clientX / window.innerWidth) * 2 - 1;
    pointerY = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  var hero = document.getElementById("hero");
  var heroContent = document.querySelector(".hero-content");

  function fitTextToView() {
    // Scale text so width fits ~70% of visible frustum width at z=0
    var vFov = (camera.fov * Math.PI) / 180;
    var dist = camera.position.z;
    var visibleH = 2 * Math.tan(vFov / 2) * dist;
    var visibleW = visibleH * camera.aspect;
    var baseW = mesh.userData.baseW || 10;
    var maxW = visibleW * (window.innerWidth < 768 ? 0.78 : 0.62);
    var maxH = visibleH * 0.28;
    var s = Math.min(maxW / baseW, maxH / (mesh.userData.baseH || 4), 2.2);
    textGroup.scale.setScalar(Math.max(0.35, s));
  }

  function resizeHero() {
    var parent = canvas.parentElement || canvas;
    var w = Math.max(1, parent.clientWidth || window.innerWidth);
    var h = Math.max(1, parent.clientHeight || window.innerHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    var dpr = Math.min(window.devicePixelRatio || 1, w < 768 ? 1.25 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    fitTextToView();
  }

  function onScroll() {
    if (!hero) return;
    var rect = hero.getBoundingClientRect();
    var progress = Math.min(1, Math.max(0, -rect.top / (rect.height * 0.65)));
    var opacity = 1 - progress;
    textGroup.position.y = progress * 6;
    var base = textGroup.scale.x;
    // keep fit scale, only shrink slightly on scroll
    canvas.style.opacity = String(opacity);
    if (heroContent) heroContent.style.opacity = String(Math.max(0, 1 - progress * 1.4));
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  var clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    var t = clock.getElapsedTime();

    targetRotY = pointerX * 0.35 + rotY;
    targetRotX = pointerY * 0.2 + rotX;
    textGroup.rotation.y += (targetRotY - textGroup.rotation.y) * 0.08;
    textGroup.rotation.x += (targetRotX - textGroup.rotation.x) * 0.08;
    textGroup.position.y += Math.sin(t * 0.9) * 0.008;

    particles.rotation.y = t * 0.03;
    renderer.render(scene, camera);
  }

  resizeHero();
  window.addEventListener("resize", resizeHero, { passive: true });
  window.addEventListener("orientationchange", function () {
    setTimeout(resizeHero, 250);
  });
  // refit after fonts load
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      // rebuild text with font available
      textGroup.clear();
      mesh = createTextMesh("صداقتی");
      textGroup.add(mesh);
      fitTextToView();
    });
  }
  animate();
})();
