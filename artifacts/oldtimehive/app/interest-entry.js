// Shared custom-interest entry for signup, profiles and saved preferences.
export function normalizeInterestWord(input, catalog = []) {
  const value = String(input ?? "").normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!value || value.length > 40 || /[\u0000-\u001f\u007f<>]/u.test(value)) return "";
  const key = value.toLowerCase();
  for (const item of catalog) {
    const id = typeof item === "string" ? item : item.id;
    const label = typeof item === "string" ? item : item.label;
    if (key === String(id).toLowerCase() || key === String(label).toLowerCase()) return id;
  }
  return value;
}

export function bindInterestEntry({ root, picker, selected, catalog, max, attribute, onChange = () => {} }) {
  const doc = root.ownerDocument;
  const entry = doc.createElement("div");
  entry.className = "interest-custom-entry";
  const label = doc.createElement("label");
  label.textContent = "Add your own interest";
  const row = doc.createElement("div");
  const input = doc.createElement("input");
  input.type = "text"; input.maxLength = 40; input.placeholder = "Type an interest";
  input.autocomplete = "off";
  const add = doc.createElement("button");
  add.type = "button"; add.textContent = "Add";
  const status = doc.createElement("p");
  status.className = "interest-entry-status"; status.setAttribute("role", "status");
  label.append(input); row.append(label, add); entry.append(row, status); root.append(entry);
  const buttons = () => [...picker.querySelectorAll(`[${attribute}]`)];
  const paint = () => {
    for (const button of buttons()) {
      const on = selected.has(button.getAttribute(attribute));
      button.classList.toggle("selected", on);
      button.setAttribute("aria-pressed", String(on));
    }
    onChange();
  };
  const ensureButton = value => {
    if (buttons().some(button => button.getAttribute(attribute) === value)) return;
    const button = doc.createElement("button");
    button.type = "button";
    button.className = attribute === "data-profile-interest" ? "profile-interest-option" : "signup-interest";
    button.setAttribute(attribute, value);
    button.textContent = value;
    picker.append(button);
  };
  for (const value of selected) ensureButton(value);
  const addInterest = () => {
    const value = normalizeInterestWord(input.value, catalog);
    if (!value) { status.textContent = "Enter an interest using up to 40 characters."; return; }
    const existing = [...selected].find(item => item.toLowerCase() === value.toLowerCase());
    if (existing) { status.textContent = "This interest is already selected."; return; }
    if (selected.size >= max) { status.textContent = `Choose up to ${max} interests.`; return; }
    ensureButton(value); selected.add(value); input.value = "";
    status.textContent = ""; paint();
  };
  add.onclick = addInterest;
  input.onkeydown = event => { if (event.key === "Enter") { event.preventDefault(); addInterest(); } };
  picker.onclick = event => {
    const button = event.target.closest(`[${attribute}]`);
    if (!button || !picker.contains(button)) return;
    const value = button.getAttribute(attribute);
    if (selected.has(value)) selected.delete(value);
    else if (selected.size < max) selected.add(value);
    else { status.textContent = `Choose up to ${max} interests.`; return; }
    status.textContent = ""; paint();
  };
  paint();
}
