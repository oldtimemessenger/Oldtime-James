---
name: Browser audio activation
description: Preserve user-gesture audio activation through asynchronous video export and retries.
---

An audio context started directly by a Publish or Export tap must be passed through rendering and any subsequent video preparation. Unlocking one context does not unlock a different context created after asynchronous work.

**Why:** A reported iPhone error mapped to the renderer's resume timeout before any upload request; the source audit found a separate context created after the tap. This does not establish the underlying device restriction without real-device evidence.

**How to apply:** Initiate audio activation synchronously in the tap handler and carry that same context and readiness promise into the rendering pipeline. Do not bypass audio failures by dropping the soundtrack except for the explicitly authorized original-sound fallback below.

Keep a media element's audio graph and context available across failed publication attempts; release them when the editor disposes of that media element.

**Why:** A media element audio source is bound to its context. Closing that context after an export can break retries on the same element even if the next tap creates a fresh context.

**How to apply:** Stop temporary activation nodes without closing a context retained by an active editor graph; resume the retained context directly in the next tap. Distinguish instrumented browser checks from physical iPhone verification.

Rendering reaching 100% does not mean the audio-dependent pipeline has finished: first-reuse sound archiving may still run afterward.

**Why:** Auditing the added-music case exposed a second context and playback startup after rendering, even when the renderer itself received the tap-started session.

**How to apply:** Carry the session through sound-excerpt recording as well as video export. Separate preview playback from recording, preserve native exception details, and never substitute a silent export for failed music mixing.

For edited-video exports, the user explicitly authorizes publishing without the original source sound if its decoding fails, with a visible warning. Retain selected music if it decodes. Do not silently omit sound, keep a partially decoded original, or convert cancellation into a successful fallback.

**Why:** the user approved this fallback for iOS Cocoa decoder failures after trimming, splitting or changing speed; preserving the edited video is preferable to blocking publication on failed original sound.

**How to apply:** decode original audio continuously from the beginning rather than restarting at each segment in-point. Keep original-audio-decode, music-decode and encode diagnostics distinct, and preserve edits for retries. This exception does not authorize silently dropping selected music.

Upload preparation should parse supported container metadata before attempting hidden video playback. If the source already meets the resolution, frame-rate, and bitrate limits, preserve it without playback-based sampling; only start playback when an actual encode is required.

**Why:** An iPhone publish with added sound failed before any network request when the hidden encoder video called `play()` after asynchronous rendering. The stack located the rejection in the encoder-start path; the screenshot did not include enough media metadata to prove why that export was classified for re-encoding.

**How to apply:** Prefer verified MP4 timing and metadata for pass-through decisions. Do not weaken browser protections or silently upload a file that needs re-encoding; retain the edit and report the actual playback error if encoding cannot safely proceed.

Some iOS Safari sessions can resolve a muted hidden video's `play()` promise, then stop advancing when its audio is restored while `MediaRecorder` remains active. Keeping the element muted is not a safe workaround: in browser verification it removed the source audio from the Web Audio recording path.

**Why:** A production report showed 0 playback seconds with an active recorder and one small chunk; a Chromium check confirmed that permanent muting can produce an output without the original audio.

**How to apply:** Require actual `currentTime` progress after the muted-play/unmute handoff and include paused/ready/media-error state in diagnostics. If playback stalls, only pass through the complete original when its format, dimensions, frame rate, size, and audio track are verified; otherwise keep the edit and fail explicitly. Chromium simulation is not physical iPhone verification.
