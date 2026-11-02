(function () {
  var isTouch =
    ("ontouchstart" in window) ||
    (navigator.maxTouchPoints > 0) ||
    matchMedia("(hover: none), (pointer: coarse)").matches;

  // ===== Custom cursor (desktop only) =====
  if (!isTouch) {
    document.documentElement.classList.add("has-custom-cursor");
    var dot = document.createElement("div");
    var ring = document.createElement("div");
    var trail = document.createElement("div");
    dot.className = "cursor-dot";
    ring.className = "cursor-ring";
    trail.className = "cursor-trail";
    document.body.appendChild(trail);
    document.body.appendChild(ring);
    document.body.appendChild(dot);

    var mx = 0, my = 0, rx = 0, ry = 0, tx = 0, ty = 0;
    var hovering = false;

    window.addEventListener("mousemove", function (e) {
      mx = e.clientX;
      my = e.clientY;
      dot.style.transform = "translate(" + mx + "px," + my + "px)";
    }, { passive: true });

    function loop() {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      tx += (mx - tx) * 0.08;
      ty += (my - ty) * 0.08;
      ring.style.transform = "translate(" + rx + "px," + ry + "px) scale(" + (hovering ? 1.55 : 1) + ")";
      trail.style.transform = "translate(" + tx + "px," + ty + "px)";
      requestAnimationFrame(loop);
    }
    loop();

    var hoverSel = "a, button, .btn, .btn-resume, .scene-tab, .model-card, .orbit-link, .skill-card, .portfolio-card, .social-btn, .upload-btn, input, textarea, .color-option, .theme-toggle, .lang-toggle, .color-theme-btn";
    document.addEventListener("mouseover", function (e) {
      if (e.target.closest && e.target.closest(hoverSel)) {
        hovering = true;
        document.documentElement.classList.add("cursor-hover");
      }
    });
    document.addEventListener("mouseout", function (e) {
      if (e.target.closest && e.target.closest(hoverSel)) {
        hovering = false;
        document.documentElement.classList.remove("cursor-hover");
      }
    });
    document.addEventListener("mousedown", function () {
      document.documentElement.classList.add("cursor-down");
    });
    document.addEventListener("mouseup", function () {
      document.documentElement.classList.remove("cursor-down");
    });
  } else {
    document.documentElement.classList.add("is-touch");
  }

  // ===== Scroll progress =====
  var bar = document.getElementById("scrollProgress");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "scrollProgress";
    bar.className = "scroll-progress";
    document.body.appendChild(bar);
  }

  function onScroll() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    var p = h > 0 ? window.scrollY / h : 0;
    bar.style.transform = "scaleX(" + p + ")";
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Magnetic buttons — desktop only (breaks layout on Android)
  if (!isTouch) {
    document.querySelectorAll(".btn, .btn-resume, .scene-tab, .social-btn, .upload-btn").forEach(function (btn) {
      btn.classList.add("mag-btn");
      btn.addEventListener("mousemove", function (e) {
        var r = btn.getBoundingClientRect();
        var x = e.clientX - r.left - r.width / 2;
        var y = e.clientY - r.top - r.height / 2;
        btn.style.transform = "translate(" + x * 0.18 + "px," + y * 0.22 + "px)";
      });
      btn.addEventListener("mouseleave", function () {
        btn.style.transform = "";
      });
    });
  }

  // Reveal on scroll
  document.querySelectorAll(".section-title, .skill-card, .portfolio-card, .timeline-item, .contact-minimal, .model-library").forEach(function (el) {
    if (el.dataset.revealReady) return;
    el.dataset.revealReady = "1";
    el.classList.add("reveal-on-scroll");
  });
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("revealed");
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll(".reveal-on-scroll").forEach(function (el) {
      io.observe(el);
    });
  } else {
    document.querySelectorAll(".reveal-on-scroll").forEach(function (el) {
      el.classList.add("revealed");
    });
  }
})();
