let activeViewName = "notes";
let settingsDrawerOpen = false;

const PROMPT_SAFE_VIEWS = new Set(["notes", "hub", "friends", "chats", "communities"]);

export function syncBlastGuidanceState(viewName, isSettingsDrawerOpen) {
  activeViewName = String(viewName || "notes");
  settingsDrawerOpen = Boolean(isSettingsDrawerOpen);
}

export function isBlastGuidanceSafe() {
  return !settingsDrawerOpen && PROMPT_SAFE_VIEWS.has(activeViewName);
}
