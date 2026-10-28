// Per-game layout orientation: Auto (follow the screen), Landscape or Portrait.
// This only changes the layout; it never rotates the page.
//
// Include in <head> so the layout is known before the first paint:
//   <script src="../orientation.js" data-key="zombiematching"></script>
//
// Sets on <html>:
//   data-orientation="landscape" | "portrait"            (layout in effect)
//   data-orientation-setting="auto" | "landscape" | "portrait"
// Any <select data-orientation-select> on the page is bound to the setting.
// Fires "layoutorientationchange" on window whenever the layout flips.
(() => {
  const CHOICES = ["auto", "landscape", "portrait"];
  const key = `${document.currentScript?.dataset.key || location.pathname}-orientation`;
  const root = document.documentElement;
  const portraitScreen = window.matchMedia("(orientation: portrait)");
  let setting = "auto";
  try { setting = localStorage.getItem(key) || "auto"; } catch (_) {}
  if (!CHOICES.includes(setting)) setting = "auto";

  function layout() {
    return setting === "auto" ? (portraitScreen.matches ? "portrait" : "landscape") : setting;
  }

  function apply() {
    root.dataset.orientationSetting = setting;
    const next = layout();
    if (root.dataset.orientation === next) return;
    root.dataset.orientation = next;
    window.dispatchEvent(new CustomEvent("layoutorientationchange", { detail: { layout: next } }));
  }

  function syncSelects() {
    document.querySelectorAll("select[data-orientation-select]").forEach(select => { select.value = setting; });
  }

  function set(value) {
    if (!CHOICES.includes(value)) return;
    setting = value;
    try { localStorage.setItem(key, value); } catch (_) {}
    apply();
    syncSelects();
  }

  portraitScreen.addEventListener("change", apply);
  apply();

  function bind() {
    document.querySelectorAll("select[data-orientation-select]").forEach(select => {
      select.value = setting;
      select.addEventListener("change", () => set(select.value));
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();

  window.GameOrientation = {
    get setting() { return setting; },
    get layout() { return layout(); },
    set
  };
})();
