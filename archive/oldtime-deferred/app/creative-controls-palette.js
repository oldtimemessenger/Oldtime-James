// Tools theme for the creative editor only. Never touches the project canvas, photos or the rest of the app.
export const TOOLS_THEMES = ["dark", "light"];
export const TOOLS_THEME_KEY = "oldtime.creative.toolsTheme";
export const normalizeToolsTheme = (value) => (TOOLS_THEMES.includes(value) ? value : "dark");
const store = () => { try { return globalThis.localStorage || null; } catch { return null; } };
export function loadToolsTheme(storage = store()) {
  try { return normalizeToolsTheme(storage?.getItem(TOOLS_THEME_KEY)); } catch { return "dark"; }
}
export function saveToolsTheme(theme, storage = store()) {
  try { storage?.setItem(TOOLS_THEME_KEY, normalizeToolsTheme(theme)); return true; } catch { return false; }
}
export function applyToolsTheme(editor, theme) {
  const value = normalizeToolsTheme(theme);
  editor.dataset.ceTools = value;
  editor.querySelectorAll("[data-ce-tools-theme]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.ceToolsTheme === value)));
  return value;
}
export function bindToolsTheme(editor, { storage = store() } = {}) {
  applyToolsTheme(editor, loadToolsTheme(storage));
  const onClick = (event) => {
    const button = event.target.closest?.("[data-ce-tools-theme]"); if (!button || !editor.contains(button)) return;
    saveToolsTheme(applyToolsTheme(editor, button.dataset.ceToolsTheme), storage);
  };
  editor.addEventListener("click", onClick);
  return () => editor.removeEventListener("click", onClick);
}
