(function () {
  const body = document.body;
  const themeToggle = document.getElementById("themeToggle");
  const langToggle = document.getElementById("langToggle");
  const colorThemeBtn = document.getElementById("colorThemeBtn");
  const colorPanel = document.getElementById("colorPanel");
  const colorOptions = document.querySelectorAll(".color-option");

  const savedMode = localStorage.getItem("mode") || "day";
  const savedColor = localStorage.getItem("colorTheme") || "cream";
  const savedLang = localStorage.getItem("lang") || "fa";

  if (savedMode === "night") body.classList.add("night-mode");
  else body.classList.remove("night-mode");

  body.classList.remove("theme-cream", "theme-milky", "theme-khaki", "theme-earthy", "theme-sand");
  body.classList.add("theme-" + savedColor);

  if (window.i18n) window.i18n.setLanguage(savedLang);

  // Create theme transition overlay once
  let veil = document.getElementById("themeVeil");
  if (!veil) {
    veil = document.createElement("div");
    veil.id = "themeVeil";
    veil.className = "theme-veil";
    veil.innerHTML = '<div class="theme-veil-orb"></div><div class="theme-veil-label"></div>';
    document.body.appendChild(veil);
  }

  function playThemeTransition(toNight) {
    const label = veil.querySelector(".theme-veil-label");
    const lang = body.dataset.lang || "fa";
    label.textContent = toNight
      ? (lang === "fa" ? "شب" : "Night")
      : (lang === "fa" ? "روز" : "Day");
    veil.classList.toggle("to-night", toNight);
    veil.classList.toggle("to-day", !toNight);
    veil.classList.add("active");
    // mid-swap for 3D after half animation
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("site:timechange", { detail: { night: toNight } }));
    }, 380);
    setTimeout(() => veil.classList.remove("active"), 900);
  }

  themeToggle?.addEventListener("click", () => {
    const willBeNight = !body.classList.contains("night-mode");
    playThemeTransition(willBeNight);
    // delay class swap slightly for nicer wipe
    setTimeout(() => {
      body.classList.toggle("night-mode", willBeNight);
      localStorage.setItem("mode", willBeNight ? "night" : "day");
    }, 320);
  });

  langToggle?.addEventListener("click", () => {
    const next = body.dataset.lang === "fa" ? "en" : "fa";
    window.i18n.setLanguage(next);
    localStorage.setItem("lang", next);
  });

  colorThemeBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    colorPanel.classList.toggle("open");
  });

  colorOptions.forEach((btn) => {
    btn.addEventListener("click", () => {
      const theme = btn.dataset.theme;
      body.classList.remove("theme-cream", "theme-milky", "theme-khaki", "theme-earthy", "theme-sand");
      body.classList.add("theme-" + theme);
      localStorage.setItem("colorTheme", theme);
      colorOptions.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      colorPanel.classList.remove("open");
    });
  });

  document.addEventListener("click", (e) => {
    if (colorPanel && !colorPanel.contains(e.target) && e.target !== colorThemeBtn) {
      colorPanel.classList.remove("open");
    }
  });
})();
