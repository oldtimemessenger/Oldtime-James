---
name: Live media topology
description: Removed Live rooms/calls, preserved account updates, and socket session-revocation verification.
---

Remove public Live rooms and broadcast media. One-to-one calling remains disabled; reject legacy call socket events without forwarding or persistence. Do not restore either media feature unless the user explicitly asks. Preserve the shared account socket for chat and notification updates and voice notes. Preserve historical chat/call records during feature removal; a separately authorized full fresh launch follows the Cloudflare data-erasure policy.

**Why:** The user said these live media features would not be used; removing them reduces unnecessary media code without disrupting core communication.

**How to apply:** Remove room/broadcast UI, media clients, room state and room-signaling handlers. Keep the authenticated account socket and its chat/notification events, keep legacy calls disabled, and keep voice notes. Do not delete historical records as part of feature removal; separately authorized fresh-launch erasure follows the Cloudflare policy.

Treat HTTP session revocation and an existing socket's shutdown as separate verification requirements.

**Why:** A local Cloudflare check showed no active database session while the connection-close check still did not complete with either of two clients. A deleted session row alone does not prove the existing transport has stopped.

**How to apply:** On auth/runtime changes, verify the connected client stops receiving private updates and closes or reauthenticates after logout, password changes, and account deletion; do not weaken that check merely because HTTP access is denied.
