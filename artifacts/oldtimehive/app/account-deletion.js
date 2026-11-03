// Deletion is deliberately separate from "Clear all app data".
export function openAccountDeletion({ request, accountId, currentAccountId, onDeleted, toast }) {
  if (document.querySelector(".account-deletion-dialog")) return;
  const dialog = document.createElement("dialog");
  dialog.className = "account-deletion-dialog";
  dialog.setAttribute("aria-labelledby", "account-deletion-title");
  dialog.innerHTML = `<form>
    <h2 id="account-deletion-title">Delete account?</h2>
    <p>This permanently deletes your Oldtime account, posts, stories and personal account data. You will be signed out on all devices. This cannot be undone.</p>
    <label>Current password<input name="password" type="password" autocomplete="current-password" minlength="8" maxlength="128" required></label>
    <label class="account-deletion-consent"><input name="confirm" type="checkbox" required> I understand this is permanent.</label>
    <p class="account-deletion-error" role="alert" hidden></p>
    <div class="account-deletion-actions"><button type="button" data-cancel>Cancel</button><button type="submit">Delete account</button></div>
  </form>`;
  document.body.append(dialog);
  let busy = false;
  const close = () => { if (!busy) { dialog.close(); dialog.remove(); } };
  dialog.querySelector("[data-cancel]").onclick = close;
  dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
  dialog.querySelector("form").onsubmit = async event => {
    event.preventDefault();
    if (busy || !event.currentTarget.reportValidity()) return;
    const error = dialog.querySelector("[role=alert]");
    if (!accountId || currentAccountId() !== accountId) {
      error.textContent = "Your account changed. Close this window and try again."; error.hidden = false; return;
    }
    const password = dialog.querySelector("[name=password]");
    const currentPassword = password.value;
    busy = true; error.hidden = true;
    dialog.querySelectorAll("input,button").forEach(control => { control.disabled = true; });
    dialog.querySelector("[type=submit]").textContent = "Deleting…";
    try {
      const result = await request("/api/account", { method: "DELETE", body: JSON.stringify({ currentPassword, confirmation: "DELETE" }) });
      if (result?.ok !== true) throw new Error("Deletion was not confirmed. Please try again.");
      password.value = "";
      dialog.close(); dialog.remove();
      onDeleted();
      toast("Your account has been deleted.");
    } catch (failure) {
      error.textContent = failure?.message || "Your account could not be deleted. Try again.";
      error.hidden = false;
      password.value = "";
    } finally {
      busy = false;
      dialog.querySelectorAll("input,button").forEach(control => { control.disabled = false; });
      dialog.querySelector("[type=submit]").textContent = "Delete account";
    }
  };
  dialog.showModal();
}
