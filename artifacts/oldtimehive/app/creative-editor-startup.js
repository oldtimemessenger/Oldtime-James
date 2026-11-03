export function shouldAutoStartCamera({
  startCamera = false,
  hasSource = false,
  hasInitialProject = false,
  hasBackground = false,
  hasSaveHandler = false,
  preferMediaPicker = false
} = {}) {
  return !preferMediaPicker &&
    !hasSource &&
    !hasInitialProject &&
    !hasBackground &&
    (startCamera || !hasSaveHandler);
}
