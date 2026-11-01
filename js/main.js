(function () {
  // Mobile menu
  const menuToggle = document.getElementById("menuToggle");
  const navLinks = document.querySelector(".nav-links");
  menuToggle?.addEventListener("click", () => {
    navLinks.classList.toggle("open");
    menuToggle.classList.toggle("active");
  });

  // Close menu on link click
  navLinks?.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => navLinks.classList.remove("open"));
  });

  // Active nav on scroll
  const sections = document.querySelectorAll("section[id]");
  const navAnchors = document.querySelectorAll(".nav-links a");

  function onScroll() {
    const scrollY = window.scrollY + 100;
    sections.forEach((sec) => {
      const top = sec.offsetTop;
      const height = sec.offsetHeight;
      const id = sec.getAttribute("id");
      if (scrollY >= top && scrollY < top + height) {
        navAnchors.forEach((a) => {
          a.classList.toggle("active", a.getAttribute("href") === "#" + id);
        });
      }
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  // Contact form (front-end only)
  const form = document.getElementById("contactForm");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const lang = document.body.dataset.lang || "fa";
    const msg = window.i18n?.translations?.[lang]?.form_success || "Sent!";
    alert(msg);
    form.reset();
  });

  // Smooth reveal on scroll
  const revealEls = document.querySelectorAll(
    ".skill-card, .timeline-item, .portfolio-card, .profile-info, .orbit-system"
  );
  const revealObs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = "1";
          entry.target.style.transform = "translateY(0)";
          revealObs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  revealEls.forEach((el) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(28px)";
    el.style.transition = "opacity 0.7s ease, transform 0.7s ease";
    revealObs.observe(el);
  });

  // Footer live time
  const timeEl = document.getElementById("footerTime");
  function tickTime() {
    if (!timeEl) return;
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString(document.body.dataset.lang === "fa" ? "fa-IR" : "en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }
  tickTime();
  setInterval(tickTime, 1000);

  // Scroll to top
  const scrollTopBtn = document.getElementById("scrollTop");
  window.addEventListener("scroll", () => {
    if (!scrollTopBtn) return;
    scrollTopBtn.classList.toggle("visible", window.scrollY > 500);
  }, { passive: true });
  scrollTopBtn?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

})();
