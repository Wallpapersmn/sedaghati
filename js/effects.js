(function () {
  // ===== Custom unique cursor =====
  const isTouch = matchMedia("(hover: none), (pointer: coarse)").matches;
  if (!isTouch) {
    document.documentElement.classList.add("has-custom-cursor");
    const dot = document.createElement("div");
    const ring = document.createElement("div");
    const trail = document.createElement("div");
    dot.className = "cursor-dot";
    ring.className = "cursor-ring";
    trail.className = "cursor-trail";
    document.body.appendChild(trail);
    document.body.appendChild(ring);
    document.body.appendChild(dot);

    let mx = 0, my = 0, rx = 0, ry = 0, tx = 0, ty = 0;
    let hovering = false;

    window.addEventListener("mousemove", (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px)`;
    }, { passive: true });

    function loop() {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      tx += (mx - tx) * 0.08;
      ty += (my - ty) * 0.08;
      ring.style.transform = `translate(${rx}px, ${ry}px) scale(${hovering ? 1.55 : 1})`;
      trail.style.transform = `translate(${tx}px, ${ty}px)`;
      requestAnimationFrame(loop);
    }
    loop();

    const hoverSel = "a, button, .btn, .btn-resume, .scene-tab, .model-card, .orbit-link, .skill-card, .portfolio-card, .social-btn, .upload-btn, input, textarea, .color-option, .theme-toggle, .lang-toggle, .color-theme-btn";
    document.addEventListener("mouseover", (e) => {
      if (e.target.closest(hoverSel)) {
        hovering = true;
        document.documentElement.classList.add("cursor-hover");
      }
    });
    document.addEventListener("mouseout", (e) => {
      if (e.target.closest(hoverSel)) {
        hovering = false;
        document.documentElement.classList.remove("cursor-hover");
      }
    });
    document.addEventListener("mousedown", () => document.documentElement.classList.add("cursor-down"));
    document.addEventListener("mouseup", () => document.documentElement.classList.remove("cursor-down"));
  }

  // ===== Scroll progress + reveal =====
  let bar = document.getElementById("scrollProgress");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "scrollProgress";
    bar.className = "scroll-progress";
    document.body.appendChild(bar);
  }

  function onScroll() {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    const p = h > 0 ? window.scrollY / h : 0;
    bar.style.transform = `scaleX(${p})`;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Magnetic buttons
  document.querySelectorAll(".btn, .btn-resume, .scene-tab, .social-btn, .upload-btn").forEach((btn) => {
    btn.classList.add("mag-btn");
    btn.addEventListener("mousemove", (e) => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      btn.style.transform = `translate(${x * 0.18}px, ${y * 0.22}px)`;
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "";
    });
  });

  // Smooth section reveal (if not already)
  document.querySelectorAll(".section-title, .skill-card, .portfolio-card, .timeline-item, .contact-minimal, .model-library").forEach((el) => {
    if (el.dataset.revealReady) return;
    el.dataset.revealReady = "1";
    el.classList.add("reveal-on-scroll");
  });
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add("revealed");
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal-on-scroll").forEach((el) => io.observe(el));
})();
