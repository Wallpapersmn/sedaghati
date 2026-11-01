// Shared navbar behavior for sub-pages
(function () {
  const menuToggle = document.getElementById("menuToggle");
  const navLinks = document.querySelector(".nav-links");
  menuToggle?.addEventListener("click", () => {
    navLinks?.classList.toggle("open");
  });
  navLinks?.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => navLinks.classList.remove("open"));
  });

  // Theme / lang / color — reuse same storage keys
  const body = document.body;
  const themeToggle = document.getElementById("themeToggle");
  const langToggle = document.getElementById("langToggle");
  const colorThemeBtn = document.getElementById("colorThemeBtn");
  const colorPanel = document.getElementById("colorPanel");

  const savedMode = localStorage.getItem("mode") || "day";
  const savedColor = localStorage.getItem("colorTheme") || "cream";
  const savedLang = localStorage.getItem("lang") || "fa";

  if (savedMode === "night") body.classList.add("night-mode");
  body.classList.remove("theme-cream", "theme-milky", "theme-khaki", "theme-earthy", "theme-sand");
  body.classList.add("theme-" + savedColor);
  body.dataset.lang = savedLang;
  document.documentElement.lang = savedLang;
  document.documentElement.dir = savedLang === "fa" ? "rtl" : "ltr";

  themeToggle?.addEventListener("click", () => {
    const willBeNight = !body.classList.contains("night-mode");
    body.classList.toggle("night-mode", willBeNight);
    localStorage.setItem("mode", willBeNight ? "night" : "day");
    window.dispatchEvent(new CustomEvent("site:timechange", { detail: { night: willBeNight } }));
  });

  langToggle?.addEventListener("click", () => {
    const next = body.dataset.lang === "fa" ? "en" : "fa";
    body.dataset.lang = next;
    document.documentElement.lang = next;
    document.documentElement.dir = next === "fa" ? "rtl" : "ltr";
    localStorage.setItem("lang", next);
    if (window.i18n) window.i18n.setLanguage(next);
  });

  colorThemeBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    colorPanel?.classList.toggle("open");
  });

  document.querySelectorAll(".color-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      const theme = btn.dataset.theme;
      body.classList.remove("theme-cream", "theme-milky", "theme-khaki", "theme-earthy", "theme-sand");
      body.classList.add("theme-" + theme);
      localStorage.setItem("colorTheme", theme);
      colorPanel?.classList.remove("open");
    });
  });

  document.addEventListener("click", (e) => {
    if (colorPanel && !colorPanel.contains(e.target) && e.target !== colorThemeBtn) {
      colorPanel.classList.remove("open");
    }
  });
})();
