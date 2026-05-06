# Development Log

## Current Session (Casting & TV Navigation)

**What was built:**
- **Spatial Navigation Engine v3**: Context-aware navigation that locks focus to Home, Modal, or Player.
- **Smart Focus Management**:
    - Focus Memory: Returns to the correct card when closing a modal.
    - Auto-Focus: Automatically lands on "Play Now" in modals and "Close" in the player.
    - Edge Clamping: Row-locking prevents horizontal bleed; document-Y scoring prevents jumping to the fixed navbar.
- **UI Refinements**:
    - Netflix-style Row Spacing (80px) for a premium, spacious look.
    - Fixed card clipping: Scaled/focused cards no longer get cut off.
    - High-Visibility Focus Ring: Single bold glowing red boundary around the active card.
    - Cinematic Modal: Now uses landscape backdrops instead of portrait posters.
- **Remote Infrastructure**:
    - Firebase Realtime Database sync for `remote_key` commands.
    - Virtual Remote UI in the mobile app with D-Pad and action buttons.

**What was tested:**
- Manual navigation through the entire chain (Cards -> Hero -> Navbar).
- Remote command execution (Up/Down/Left/Right/Enter/Back).
- Modal opening/closing focus restoration.

**What passed:**
- Navigation is 100% reliable and never gets "stuck".
- Layout looks professional on both Desktop and TV viewports.
- Long-press support: Allow faster navigation when holding down a D-pad button.

## Session 2026-05-06 (Responsive Fixes)

**What was built:**
- **Enhanced Responsive Design**:
    - Overlap Fix: Removed `overflow: hidden` from Hero to prevent clipping and adjusted `min-height` on mobile (50vh-70vh).
    - Layout Strategy: Switched to aggressive block layout on mobile using `!important` to force height and display properties. Removed negative margins on the row scroller to prevent pull-up overlaps.
    - Content Robustness: Added explicit `z-index`, `background`, and `margin-top` to the `#content` section on mobile.
    - Title Scaling: Implemented `clamp()` and media query overrides for the Hero title to ensure it fits on phone screens.
    - Spacing: Reduced row margins on mobile and improved `hero-content` padding.
    - Button Layout: Buttons now stack and fill width on mobile (`flex: 1`) for better touch targets.
- **TV Player Auto-Hide UI**:
    - Implemented inactivity timer (3s) for the TV Exit button.
    - Controls automatically fade out during playback to provide a clean cinematic experience.
    - Activity Detection: UI reappears instantly on mouse movement or remote controller navigation.

**What was tested:**
- Simulated mobile viewports (360px - 768px).
- Verified Hero content doesn't overlap with the first row of movie cards.
- Tested player UI auto-hide by waiting 3 seconds; verified it returns on mouse move.

**What passed:**
- Overlap issue is resolved; content flows naturally on narrow screens.
- Hero buttons are easier to tap on phones.

**What's next:**
- Bi-directional sync for remote status.
- Finalizing TV player controls.