---
name: Video frame-rate integrity
description: Prevent browser-based video encoding from silently reducing source frame rates.
---

Browser playback callback rate does not necessarily equal source frame rate, and real-time canvas or MediaRecorder pipelines can fall behind high-resolution 60 fps footage, especially in software-rendered environments. Do not treat a browser test that merely completes as proof that the output retained its source frame rate.

Browser-created fragmented MP4 can have an empty conventional timing table while valid frame timing lives in fragment sample runs. Inspect fragment timing before declaring a prepared edit incompatible or trying to encode it again.

**Why:** a valid finished edit was unnecessarily sent through a second encoder because its fragmented MP4 timing was missed.

**How to apply:** use actual container timing, including fragments, and verify encoded output rather than inferring source frame rate from playback callbacks.

**Why:** High-resolution 60 fps browser encoding produced substantially lower output frame rates despite changing the hidden decode surface and using direct video capture.

**How to apply:** Read source frame-rate metadata where possible and verify the encoded file's actual rate. If a compatible same-resolution source cannot be re-encoded without dropping frames, preserve the original or fail explicitly rather than silently lowering frame rate.

Prefer explicitly supported codec/container combinations before generic MediaRecorder MIME types; a browser may accept a generic MP4 request yet emit a container/codec pairing it cannot play. A final editor render already encoded at its storage profile should go straight to publication rather than through a second encoder.

**Why:** A browser test produced an MP4 carrying VP9/Opus that the same browser could not decode, while the app’s real final-render path intentionally avoids another encode.

**How to apply:** Keep codec selection ordered from explicit compatible combinations to generic fallbacks, and test the rendered Blob’s actual playback and upload handoff without adding unnecessary re-encoding.

Use independently validated source fixtures for export checks. A declared timeline duration, a completed progress bar or the existence of a Blob is not proof of valid frame timing.

**Why:** when both the synthetic source and the feature under test rely on browser recording, an incomplete output alone cannot identify which stage failed.

**How to apply:** probe the source before opening the editor, then measure the output's decoded frames, timestamps and audio. Distinguish a failed automation selector from an application failure, and leave unmeasured export properties explicitly unverified.

Use explicit output timestamps for studio rendering instead of treating elapsed rendering time as video time.

**Why:** slow canvas rendering can finish a wall-clock recording with almost no encoded timeline while still reporting a successful download. A completed download is not evidence of a complete video.

**How to apply:** encode every planned frame with backpressure, check the finished media independently, and preserve the tap-started playback audio context for preview and retries even when encoding uses an offline audio mix.
