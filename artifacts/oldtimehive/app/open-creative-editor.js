let editorModulePromise;

export async function openCreativeEditor(options = {}) {
  let releaseSelection;
  try {
    // Start the native picker inside the original tap. Waiting for the lazy
    // editor import first loses iOS Safari's user activation.
    if (options.destination === "story" && options.mediaPicker && !options.background?.media && !options.initialProject) {
      const input = document.createElement("input");
      input.type = "file"; input.accept = "image/*,video/*"; input.hidden = true;
      document.body.appendChild(input);
      const file = await new Promise(resolve => {
        input.onchange = () => resolve(input.files?.[0] || null);
        input.oncancel = () => resolve(null);
        input.click();
      });
      input.remove();
      if (!file) return null;
      const reference = URL.createObjectURL(file);
      releaseSelection = () => URL.revokeObjectURL(reference);
      const onClose = options.onClose;
      options = {...options, mediaPicker:false, startCamera:false,
        background:{media:reference,kind:file.type.startsWith("video/") ? "video" : "image"},
        onClose:(...args) => { releaseSelection(); onClose?.(...args); }};
    }
    editorModulePromise ??= import("./creative-editor.js").catch(error => {
      editorModulePromise = null;
      throw error;
    });
    const { openCreativeEditor: open } = await editorModulePromise;
    return open(options);
  } catch (error) {
    releaseSelection?.();
    console.error("[Oldtime editor] failed to load", error);
    options.toast?.(error?.message || "The editor could not be opened. Try again.");
    return null;
  }
}
