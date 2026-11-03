---
name: Helpful prompts
description: Product guidance on adaptive, unobtrusive suggestions and honest social activity.
---
Tips should have large transparent illustrations and clear, prominent writing. Do not show Add to Home Screen installation instructions or pop-ups inside the app; retain normal PWA capability.

**Why:** the user requested larger transparent artwork, stronger writing and removal of the installation-instruction pop-ups.

**How to apply:** preserve close, Maybe later and Don't show again actions and the existing conservative prompt frequency. Do not restore install nudges without a new request.

Offer occasional dismissible, illustrated suggestions for updating a cover, adding friends (including Blast), posting a note, using features, and understanding privacy, similar in purpose to the Blue Badge suggestion. Use the user's supplied character illustrations. Include an About Blast action alongside inviting friends.

**Why:** the user asked for more useful prompts, “do not be too invasive,” and “teach the algo.” They repeated that walkthroughs should cover the app and “keep track to not keep showing the same stuff it becomes annoying.”

**How to apply:** use completed actions, previously seen guides and explicit dismissals to personalize suggestions, with a conservative cooldown. Keep repeat viewing user-initiated. Do not interrupt typing, calls, composition or unsaved settings. Be clear about device-local preference learning rather than claiming a globally trained recommendation system. Never show invented likes, people or other engagement.

Do not open the profile editor during Community navigation. Keep interest editing an explicit Profile action; Community may show people suggestions without automatically routing into interest editing.

**Why:** the user reported the Edit interests screen flashing when switching to Community.

**How to apply:** avoid Community render-time or navigation-time handlers that launch interest editing, and keep a browser regression check on the Community transition.

Official in-feed announcement cards should use only current, admin-published Oldtime campaigns and real app destinations. Keep them in Community’s For you feed; preserve Home’s media-only behavior. Do not seed mock user posts or borrow other apps’ branding.

**Why:** the user chose reusable announcement cards grounded in Oldtime’s actual features and asked to keep Home behavior unchanged.

**How to apply:** render campaign title, description, and route from the authenticated announcements API, clearly label the card as an official Oldtime update, and respect the existing campaign preferences and dismissals.
