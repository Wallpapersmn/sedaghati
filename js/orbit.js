// Avatar stage interactions
(function () {
  const stage = document.getElementById("orbitSystem");
  if (!stage) return;
  // subtle pause on hover for rings
  stage.addEventListener("mouseenter", () => {
    stage.querySelectorAll(".ring, .ring-dot").forEach((el) => {
      el.style.animationPlayState = "paused";
    });
  });
  stage.addEventListener("mouseleave", () => {
    stage.querySelectorAll(".ring, .ring-dot").forEach((el) => {
      el.style.animationPlayState = "running";
    });
  });
})();
