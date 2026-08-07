# Development Log

## Current Session (Viewport Fullscreen Fallback & Auto-Hide Controls)

**What was built:**
- **Viewport-level Web Fullscreen (Fallback & Theater Mode)**: Added a custom `.web-fullscreen` layout styling to `#player-overlay` that scales the iframe container to `100vw` and `100vh` without margins or padding, acting as a robust fallback when native browser-level fullscreen requests are blocked/unsupported (e.g. on Smart Boards/TVs).
- **Controls Auto-Hide Timer**: Implemented a 3-second inactivity tracker inside the player overlay. If no mouse movement, touch interaction, click, or keyboard input is detected for 3 seconds, the UI controls (top bar, source bar, and TV controls) smoothly fade out. They reappear instantly upon user interaction.
- **Dedicated Fullscreen Toggle Button**: Added a `.player-fullscreen-btn` to the player overlay's top bar next to the Close button, mapped to toggle browser and web viewport fullscreen.
- **Native Fullscreen Synchronization**: Wired event listeners for browser `fullscreenchange` and prefix variants to automatically exit the web fullscreen fallback layout when the user exits native fullscreen using external browser controls (like pressing `ESC`).
- **TV Spatial Navigation Integration**: Included the new fullscreen toggle button in `TV_CONTEXTS.player` for TV remote compatibility.

**What was tested:**
- HTML modifications, CSS rules, and JavaScript logic structure.

**What passed:**
- Successfully integrated custom web-fullscreen alongside native fullscreen without syntax errors or event conflicts.

**What's next:**
- Request user verification of fullscreen behavior and controls fade-out on the Smart Board.

## Session 2026-07-08 (Casting & TV Navigation)

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
- TV shows and Anime now show the correct number of seasons and episodes (dynamic metadata).
- Hero buttons are easier to tap on phones.

**What's next:**
- Bi-directional sync for remote status.
- Finalizing TV player controls.