(function () {
  var canvas = document.getElementById("heroCanvas");
  if (!canvas || !window.THREE) return;

  var isMobile = function () {
    return window.innerWidth < 768 || ("ontouchstart" in window && window.innerWidth < 1024);
  };

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  // farther on mobile so text never fills the screen
  camera.position.set(0, 0, isMobile() ? 36 : 30);

  var renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true,
    powerPreference: "default"
  });
  renderer.setClearColor(0x000000, 0);

  scene.add(new THREE.AmbientLight(0xfff5e8, 0.75));
  var dir = new THREE.DirectionalLight(0xffe8c8, 1.05);
  dir.position.set(5, 10, 12);
  scene.add(dir);
  var back = new THREE.DirectionalLight(0xc9a87c, 0.35);
  back.position.set(-8, -2, -5);
  scene.add(back);

  var textGroup = new THREE.Group();
  scene.add(textGroup);

  function createTextMesh(text) {
    var fontSize = 160;
    var fontFamily = "Vazirmatn, Tahoma, sans-serif";
    var color = "#c9a87c";

    var measure = document.createElement("canvas");
    var mctx = measure.getContext("2d");
    mctx.font = "800 " + fontSize + "px " + fontFamily;
    var metrics = mctx.measureText(text);
    var tw = Math.ceil(metrics.width) + 100;
    var th = fontSize + 100;

    // limit canvas size for mobile GPU
    var maxSide = isMobile() ? 1024 : 2048;
    var scaleDown = 1;
    if (tw > maxSide) {
      scaleDown = maxSide / tw;
      tw = maxSide;
      th = Math.ceil(th * scaleDown);
      fontSize = Math.floor(fontSize * scaleDown);
    }

    var c = document.createElement("canvas");
    c.width = tw;
    c.height = th;
    var ctx = c.getContext("2d");
    ctx.font = "800 " + fontSize + "px " + fontFamily;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // soft depth layers (fake extrusion look)
    for (var i = 6; i >= 1; i--) {
      ctx.fillStyle = "rgba(90,65,40," + (0.08 + i * 0.03) + ")";
      ctx.fillText(text, tw / 2 + i * 1.2, th / 2 + i * 1.5);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, tw / 2, th / 2);
    // highlight
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillText(text, tw / 2 - 1, th / 2 - 2);

    var texture = new THREE.CanvasTexture(c);
    texture.needsUpdate = true;
    if (texture.minFilter) texture.minFilter = THREE.LinearFilter;

    var group = new THREE.Group();
    // fixed logical size — always fit via textGroup.scale
    var planeH = 3.2;
    var planeW = planeH * (tw / th);

    for (var layer = 0; layer < 4; layer++) {
      var mat = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        opacity: layer === 0 ? 1 : 0.18,
        metalness: 0.2,
        roughness: 0.45,
        side: THREE.DoubleSide,
        depthWrite: layer === 0
      });
      var mesh = new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeH), mat);
      mesh.position.z = -layer * 0.12;
      group.add(mesh);
    }

    group.userData.baseW = planeW;
    group.userData.baseH = planeH;
    return group;
  }

  var mesh = createTextMesh("صداقتی");
  textGroup.add(mesh);

  // fewer particles on mobile
  var count = isMobile() ? 40 : 120;
  var particleGeo = new THREE.BufferGeometry();
  var positions = new Float32Array(count * 3);
  for (var i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 36;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 16 - 2;
  }
  particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  var particles = new THREE.Points(
    particleGeo,
    new THREE.PointsMaterial({ color: 0xd4b896, size: isMobile() ? 0.1 : 0.12, transparent: true, opacity: 0.4 })
  );
  scene.add(particles);

  // pointer / touch
  var pointerX = 0, pointerY = 0;
  var rotY = 0, rotX = 0;
  var dragging = false, lastPX = 0, lastPY = 0;

  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", function (e) {
    dragging = true;
    lastPX = e.clientX;
    lastPY = e.clientY;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  });
  function endDrag(e) {
    dragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
  }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointermove", function (e) {
    var rect = canvas.getBoundingClientRect();
    pointerX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    pointerY = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1;
    if (dragging) {
      rotY += (e.clientX - lastPX) * 0.005;
      rotX += (e.clientY - lastPY) * 0.004;
      rotX = Math.max(-0.5, Math.min(0.5, rotX));
      lastPX = e.clientX;
      lastPY = e.clientY;
    }
  }, { passive: true });

  window.addEventListener("mousemove", function (e) {
    if (dragging) return;
    pointerX = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    pointerY = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
  }, { passive: true });

  var hero = document.getElementById("hero");
  var heroContent = document.querySelector(".hero-content");

  function fitTextToView() {
    var vFov = (camera.fov * Math.PI) / 180;
    var dist = Math.abs(camera.position.z);
    var visibleH = 2 * Math.tan(vFov / 2) * dist;
    var visibleW = visibleH * camera.aspect;

    var baseW = (mesh && mesh.userData.baseW) ? mesh.userData.baseW : 12;
    var baseH = (mesh && mesh.userData.baseH) ? mesh.userData.baseH : 3.2;

    // CRITICAL: mobile must keep full word on screen
    var mobile = isMobile();
    var maxW = visibleW * (mobile ? 0.88 : 0.68);
    var maxH = visibleH * (mobile ? 0.22 : 0.26);

    var s = Math.min(maxW / baseW, maxH / baseH);
    // hard caps — never too big on phones
    if (mobile) s = Math.min(s, 0.95);
    else s = Math.min(s, 1.6);
    // no high minimum floor (this was the bug)
    s = Math.max(s, 0.15);

    textGroup.scale.setScalar(s);
  }

  function resizeHero() {
    var parent = canvas.parentElement || document.getElementById("hero") || canvas;
    var w = Math.max(1, parent.clientWidth || window.innerWidth);
    var h = Math.max(1, parent.clientHeight || window.innerHeight);

    // if layout not ready, use window
    if (w < 50 || h < 50) {
      w = window.innerWidth;
      h = window.innerHeight;
    }

    camera.aspect = w / h;
    camera.position.z = isMobile() ? 36 : 30;
    camera.updateProjectionMatrix();

    var dpr = Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    fitTextToView();
  }

  function onScroll() {
    if (!hero) return;
    var rect = hero.getBoundingClientRect();
    var progress = Math.min(1, Math.max(0, -rect.top / (rect.height * 0.7)));
    canvas.style.opacity = String(1 - progress);
    if (heroContent) heroContent.style.opacity = String(Math.max(0, 1 - progress * 1.5));
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  function animate() {
    requestAnimationFrame(animate);
    var t = performance.now() * 0.001;
    var targetRotY = pointerX * 0.28 + rotY;
    var targetRotX = pointerY * 0.16 + rotX;
    textGroup.rotation.y += (targetRotY - textGroup.rotation.y) * 0.08;
    textGroup.rotation.x += (targetRotX - textGroup.rotation.x) * 0.08;
    textGroup.position.y = Math.sin(t * 0.8) * 0.15;
    particles.rotation.y = t * 0.025;
    renderer.render(scene, camera);
  }

  function boot() {
    resizeHero();
    fitTextToView();
    animate();
  }

  // multiple refits — Android layout settles late
  boot();
  setTimeout(resizeHero, 100);
  setTimeout(resizeHero, 400);
  setTimeout(resizeHero, 1000);

  window.addEventListener("resize", resizeHero, { passive: true });
  window.addEventListener("orientationchange", function () {
    setTimeout(resizeHero, 150);
    setTimeout(resizeHero, 500);
  });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      while (textGroup.children.length) textGroup.remove(textGroup.children[0]);
      mesh = createTextMesh("صداقتی");
      textGroup.add(mesh);
      resizeHero();
    });
  }
})();
