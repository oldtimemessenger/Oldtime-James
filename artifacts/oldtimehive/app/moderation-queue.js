// Review queue for authorised reviewers. Decisions are additive (stored in a decision table);
// nothing here deletes or hides user content. Styles: ./moderation-queue.css (import from the host app).
export const MODERATION_FILTERS = [["open", "Open"], ["reviewed", "Reviewed"], ["dismissed", "Dismissed"], ["all", "All"]];
export const MODERATION_NOTE_MAX = 500;
const STATUS_LABEL = { open: "Open", reviewed: "Reviewed", dismissed: "Dismissed" };

const defaultEsc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

function dateText(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

export function reportRowInner(report, esc = defaultEsc, busy = false) {
  const status = STATUS_LABEL[report.status] ? report.status : "open";
  const kind = String(report.kind || "report").replace(/_/g, " ");
  const date = dateText(report.created_at);
  const dis = busy ? "disabled" : "";
  const action = (value, label) => status === value ? "" :
    `<button type="button" class="mq-btn${value === "reviewed" ? " mq-primary" : ""}" data-mq-status="${value}" ${dis}>${label}</button>`;
  return `<div class="mq-row-head">
      <span class="mq-kind">${esc(kind)}</span>
      ${report.category ? `<span class="mq-category">${esc(report.category)}</span>` : ""}
      <span class="mq-status mq-status-${status}" data-testid="status-report">${STATUS_LABEL[status]}</span>
    </div>
    ${report.reason ? `<p class="mq-reason" data-testid="text-report-reason">${esc(report.reason)}</p>` : `<p class="mq-reason mq-muted">No reason given.</p>`}
    <div class="mq-meta">${date ? `<span>${esc(date)}</span>` : ""}
      ${report.post_id ? `<button type="button" class="mq-link" data-mq-post="${esc(report.post_id)}">View post</button>` : ""}
      ${report.place_id ? `<button type="button" class="mq-link" data-mq-place="${esc(report.place_id)}">View place</button>` : ""}
      ${report.comment_id ? `<span class="mq-muted">Comment ${esc(String(report.comment_id).slice(0, 8))}</span>` : ""}
    </div>
    <label class="mq-note"><span class="mq-sr">Reviewer note</span>
      <textarea data-mq-note maxlength="${MODERATION_NOTE_MAX}" rows="2" placeholder="Reviewer note (optional)" ${dis}>${esc(report.note || "")}</textarea></label>
    <div class="mq-actions">${action("reviewed", "Mark reviewed")}${action("dismissed", "Dismiss")}${action("open", "Keep open")}
      <span class="mq-row-msg" role="status" aria-live="polite">${busy ? "Saving…" : ""}</span></div>`;
}

export function belongsInFilter(status, filter) {
  return filter === "all" || status === filter;
}

export function mountModerationQueue({ host, request, esc = defaultEsc, back, openPost, openPlace, toast, alive = () => true } = {}) {
  if (!host || typeof request !== "function") return () => {};
  const root = document.createElement("section");
  root.className = "mq";
  root.setAttribute("aria-labelledby", "mq-title");
  root.innerHTML = `<header class="mq-header">
      <button type="button" class="mq-back" data-mq-back aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5m7 7-7-7 7-7"/></svg></button>
      <h1 id="mq-title">Review queue</h1>
      <label class="mq-filter"><span class="mq-sr">Filter reports</span><select data-mq-filter data-testid="select-report-filter">${MODERATION_FILTERS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label>
    </header>
    <div class="mq-scroll"><div class="mq-state" data-mq-state></div><ol class="mq-list" data-mq-list></ol><div class="mq-more" data-mq-more></div></div>`;
  host.replaceChildren(root);
  const list = root.querySelector("[data-mq-list]");
  const stateEl = root.querySelector("[data-mq-state]");
  const moreEl = root.querySelector("[data-mq-more]");
  const filterEl = root.querySelector("[data-mq-filter]");
  const rows = new Map();
  let filter = "open", nextOffset = 0, hasMore = false, generation = 0, loading = false, disposed = false;
  const live = () => !disposed && root.isConnected && alive();

  const setState = html => { stateEl.innerHTML = html; stateEl.hidden = !html; };
  const renderMore = () => {
    moreEl.innerHTML = hasMore ? `<button type="button" class="mq-btn" data-mq-load-more ${loading ? "disabled" : ""}>${loading ? "Loading…" : "Load more"}</button>` : "";
  };
  const checkEmpty = () => {
    if (!rows.size && !loading) setState(`<div class="mq-empty"><strong>Nothing to review</strong><p>${filter === "open" ? "No open reports right now." : "No reports match this filter."}</p></div>`);
  };
  const addRow = report => {
    const key = String(report?.report_key || "");
    if (!key || rows.has(key)) return;
    const li = document.createElement("li");
    li.className = "mq-row";
    li.dataset.reportKey = key;
    li.innerHTML = reportRowInner(report, esc);
    rows.set(key, { li, report });
    list.append(li);
  };

  async function load({ append = false } = {}) {
    const gen = append ? generation : ++generation;
    loading = true;
    if (!append) {
      rows.clear(); list.replaceChildren(); nextOffset = 0; hasMore = false;
      setState(`<div class="mq-skeleton" role="status"><span></span><span></span><span></span><span class="mq-sr">Loading reports…</span></div>`);
    }
    renderMore();
    try {
      if (!append && gen === 1) {
        const access = await request("/api/moderation/access");
        if (!live() || gen !== generation) return;
        if (!access?.allowed) { loading = false; renderMore(); setState(`<div class="mq-empty"><strong>Not available</strong><p>Your account doesn’t have access to the review queue.</p></div>`); filterEl.disabled = true; return; }
      }
      const result = await request(`/api/moderation/reports?status=${encodeURIComponent(filter)}&offset=${append ? nextOffset : 0}`);
      if (!live() || gen !== generation) return;
      const reports = Array.isArray(result?.reports) ? result.reports : [];
      reports.forEach(addRow);
      hasMore = result?.hasMore === true;
      nextOffset = Number.isSafeInteger(result?.nextOffset) ? result.nextOffset : (append ? nextOffset : 0) + reports.length;
      loading = false;
      setState("");
      checkEmpty();
    } catch (error) {
      if (!live() || gen !== generation) return;
      loading = false;
      const denied = error?.status === 403 || error?.status === 401;
      if (append) toast?.("Couldn’t load more reports. Try again.");
      else setState(`<div class="mq-empty" role="alert"><strong>${denied ? "Not available" : "Couldn’t load reports"}</strong><p>${denied ? "Your account doesn’t have access to the review queue." : "Check your connection and try again."}</p>${denied ? "" : `<button type="button" class="mq-btn" data-mq-retry>Try again</button>`}</div>`);
    }
    renderMore();
  }

  async function decide(key, status) {
    const entry = rows.get(key);
    if (!entry || entry.busy) return;
    const noteEl = entry.li.querySelector("[data-mq-note]");
    const note = String(noteEl?.value || "").slice(0, MODERATION_NOTE_MAX);
    entry.busy = true;
    entry.li.setAttribute("aria-busy", "true");
    entry.li.querySelectorAll("button,textarea").forEach(el => { el.disabled = true; });
    const msg = entry.li.querySelector(".mq-row-msg");
    if (msg) msg.textContent = "Saving…";
    const gen = generation;
    try {
      const result = await request("/api/moderation/reports", { method: "PUT", body: { key, status, note } });
      if (!live() || gen !== generation || rows.get(key) !== entry) return;
      const confirmed = result?.report || {};
      const nextStatus = STATUS_LABEL[confirmed.status] ? confirmed.status : status;
      entry.report = { ...entry.report, ...confirmed, status: nextStatus, note: confirmed.note ?? note };
      entry.busy = false;
      entry.li.removeAttribute("aria-busy");
      if (!belongsInFilter(nextStatus, filter)) {
        rows.delete(key);
        entry.li.remove();
        nextOffset = Math.max(0, nextOffset - 1);
        toast?.(nextStatus === "open" ? "Kept open." : `Marked ${STATUS_LABEL[nextStatus].toLowerCase()}.`);
        checkEmpty();
      } else {
        entry.li.innerHTML = reportRowInner(entry.report, esc);
        const m = entry.li.querySelector(".mq-row-msg"); if (m) m.textContent = "Saved";
      }
    } catch (error) {
      if (!live() || rows.get(key) !== entry) return;
      entry.busy = false;
      entry.li.removeAttribute("aria-busy");
      entry.li.querySelectorAll("button,textarea").forEach(el => { el.disabled = false; });
      if (msg) msg.textContent = "Not saved. Try again.";
      toast?.(error?.message || "Couldn’t save that decision.");
    }
  }

  const onClick = event => {
    const target = event.target instanceof Element ? event.target.closest("button") : null;
    if (!target || !root.contains(target) || target.disabled) return;
    if (target.matches("[data-mq-back]")) return back?.();
    if (target.matches("[data-mq-retry]")) return void load();
    if (target.matches("[data-mq-load-more]")) return void load({ append: true });
    const key = target.closest(".mq-row")?.dataset.reportKey;
    if (target.dataset.mqPost) return openPost?.(target.dataset.mqPost);
    if (target.dataset.mqPlace) return openPlace?.(target.dataset.mqPlace);
    if (key && target.dataset.mqStatus) return void decide(key, target.dataset.mqStatus);
  };
  const onFilter = () => { filter = filterEl.value; void load(); };
  root.addEventListener("click", onClick);
  filterEl.addEventListener("change", onFilter);
  void load();

  return () => {
    disposed = true;
    generation++;
    root.removeEventListener("click", onClick);
    filterEl.removeEventListener("change", onFilter);
    root.remove();
  };
}
