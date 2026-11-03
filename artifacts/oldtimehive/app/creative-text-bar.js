import { textPreset } from "./creative-text-effects.js";

// Contextual text controls shown above the keyboard while typing on the canvas. Presets map to
// the real renderer text effects (layer.textEffect); everything else drives the same layer fields
// as the sheet inspector, so project state stays in one place.
const COLORS = ["#ffffff", "#17191d", "#e5262f", "#f2b705", "#2f9e6f", "#2a7de1", "#8a4fd6", "#f06aa8"];
const ALIGNS = ["left", "center", "right"];

export function bindTextBar({ root, editor, q, layer, duplicate, remove, record, changed }) {
  const bar = q("text-bar");
  if (!bar) return { refresh() {}, dispose() {} };
  const editable = () => { const item = layer(); return item?.kind === "text" && !item.locked ? item : null; };
  const fire = (name, value) => {
    const el = q(name); if (!el) return;
    el.onfocus?.(); el.value = value; el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const fonts = q("text-fonts"), colors = q("text-colors"), custom = q("text-custom"), size = q("text-size");
  for (const option of q("font").options) {
    const b = document.createElement("button"); b.type = "button"; b.className = "cs-font"; b.dataset.font = option.value;
    b.textContent = option.textContent; b.style.fontFamily = option.value;
    b.onclick = () => { fire("font", option.value); refresh(); };
    fonts.append(b);
  }
  for (const color of COLORS) {
    const b = document.createElement("button"); b.type = "button"; b.className = "cs-swatch"; b.dataset.color = color;
    b.style.setProperty("--swatch", color); b.setAttribute("aria-label", `Text color ${color}`);
    b.onclick = () => { fire("color", color); refresh(); };
    colors.append(b);
  }
  const applyPreset = name => {
    const item = editable(); if (!item) return;
    record(); Object.assign(item, textPreset(name)); changed(); refresh();
  };
  bar.querySelectorAll("[data-cs-preset]").forEach(b => b.onclick = () => applyPreset(b.dataset.csPreset));
  root.querySelectorAll("[data-ce-text-preset]").forEach(b => b.onclick = () => applyPreset(b.dataset.ceTextPreset));
  let customRecorded = false;
  custom.oninput = () => {
    if (!editable()) return;
    if (!customRecorded) { q("color").onfocus?.(); customRecorded = true; }
    q("color").value = custom.value; q("color").dispatchEvent(new Event("input", { bubbles: true })); refresh();
  };
  custom.onchange = () => { customRecorded = false; };
  custom.onblur = () => { customRecorded = false; };
  let sizeRecorded = false;
  size.oninput = () => {
    const item = editable(); if (!item) return;
    if (!sizeRecorded) { record(); sizeRecorded = true; }
    item.fontSize = Number(size.value); changed(false);
  };
  size.onchange = () => { sizeRecorded = false; };
  size.onblur = () => { sizeRecorded = false; };
  for (const [id, field] of [["effect-strength", "amount"], ["effect-color", "color"]]) {
    const input = q(id);
    let recorded = false;
    input.oninput = () => {
      const item = editable(); if (!item) return;
      if (!recorded) { record(); recorded = true; }
      item.textEffect = { name: "plain", ...item.textEffect,
        [field]: field === "amount" ? Math.max(0, Math.min(1, Number(input.value) / 100)) : input.value };
      changed(false); refresh();
    };
    input.onchange = input.onblur = () => { recorded = false; };
  }
  q("text-align").onclick = () => {
    const item = editable(); if (!item) return;
    fire("align", ALIGNS[(ALIGNS.indexOf(item.align || "center") + 1) % 3]); refresh();
  };
  q("text-bg").onclick = () => {
    const box = q("background-on"); box.checked = !box.checked; box.dispatchEvent(new Event("change", { bubbles: true })); refresh();
  };
  q("text-dup").onclick = () => { duplicate(); refresh(); };
  q("text-del").onclick = () => remove();
  // Taps on buttons must not blur the inline editor (that would drop the keyboard).
  bar.addEventListener("pointerdown", event => { if (event.target.closest("button")) event.preventDefault(); });
  function refresh() {
    const item = layer(), typing = editor.classList.contains("is-typing");
    bar.hidden = !typing || item?.kind !== "text";
    if (bar.hidden) return;
    fonts.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.font === (item.font || "Manrope"))));
    const color = (item.color || "#ffffff").toLowerCase();
    colors.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.color === color)));
    if (/^#[0-9a-f]{6}$/.test(color)) custom.value = color;
    bar.querySelectorAll("[data-cs-preset]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.csPreset === (item.textEffect?.name || "plain"))));
    if (document.activeElement !== q("effect-strength")) q("effect-strength").value = String(Math.round((item.textEffect?.amount ?? .6) * 100));
    if (document.activeElement !== q("effect-color")) q("effect-color").value = item.textEffect?.color || "#b51e29";
    q("text-bg").setAttribute("aria-pressed", String(!!item.backgroundOn));
    q("text-align").dataset.align = item.align || "center";
    if (document.activeElement !== size) size.value = String(item.fontSize || 64);
  }
  const mo = new MutationObserver(refresh); mo.observe(editor, { attributes: true, attributeFilter: ["class"] });
  return { refresh, dispose() { mo.disconnect(); } };
}
