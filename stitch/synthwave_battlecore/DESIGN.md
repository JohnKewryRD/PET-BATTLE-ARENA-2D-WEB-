# Design System Documentation: The Synthetic Pulse

## 1. Overview & Creative North Star
This design system is engineered for high-stakes, competitive visibility. Moving beyond the "flat" aesthetic of typical web-based dashboards, this system is built on the **Creative North Star: The Synthetic Pulse.** 

The UI is not a static frame; it is a living, breathing digital atmosphere. By leveraging deep tonal shifts, intentional asymmetry, and "light-leak" glow effects, we create a high-tech environment that feels premium and "streamer-ready." We break the rigid grid through overlapping HUD elements and varying levels of transparency, ensuring the interface feels like an advanced overlay rather than a secondary container.

## 2. Colors
Our palette is rooted in the depth of deep space, punctuated by high-energy neon emitters.

### Surface Hierarchy & Nesting
To achieve a "High-End Editorial" feel, we abandon traditional borders in favor of **Tonal Nesting**. Depth is created by stacking surface tiers:
*   **Base Layer:** `background` (#150822) is the canvas.
*   **Primary Containers:** Use `surface-container-low` (#1b0c2a) for major HUD sections.
*   **In-Card Elements:** Use `surface-container-high` (#29173b) for nested stats or energy bars.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to define sections. Boundaries must be defined by shifts in background tokens. A `surface-container-low` card sitting on a `surface` background provides all the definition needed.

### The "Glass & Gradient" Rule
To move beyond "out-of-the-box" gaming UIs, use Glassmorphism for floating overlays (e.g., the Wave Indicator or Pet Detail cards). 
*   **Glass Specs:** `surface` colors at 40-60% opacity + `backdrop-filter: blur(12px)`.
*   **Signature Textures:** Use linear gradients for energy bars, transitioning from `primary` (#99f7ff) to `primary-container` (#00f1fe). This provides a "liquid light" effect that flat colors cannot replicate.

## 3. Typography
The typography strategy balances the brutalist tech-edge of **Space Grotesk** with the clean, functional legibility of **Manrope**.

*   **Display & Headlines (Space Grotesk):** These are the "hero" moments. Use `display-lg` for Wave transitions. The wide character stance of Space Grotesk communicates a futuristic, authoritative tone.
*   **Body & Labels (Manrope):** Essential for OBS browser sources. Manrope’s geometric clarity ensures stats (Energy, Diamonds, Pet Health) remain legible even at lower stream resolutions.
*   **Hierarchy Note:** Use `on-surface-variant` (#b7a4c7) for secondary "flavor text" or timestamps to ensure the primary information (white/cyan) maintains the highest visual "z-index" through contrast.

## 4. Elevation & Depth
In this design system, light *is* depth. We do not use traditional drop shadows to mimic sunlight; we use ambient glows to mimic neon illumination.

*   **The Layering Principle:** Stack `surface-container-lowest` (#000000) inside `surface-container` to create "wells" of depth for input fields or progress bar tracks.
*   **Ambient Shadows:** For floating HUD elements, use extra-diffused shadows. The shadow color should be a tinted version of the primary glow: `rgba(153, 247, 255, 0.08)` for Cyan elements.
*   **The "Ghost Border" Fallback:** When a container needs absolute definition (like the Arena boundary), use the `outline-variant` (#51425f) at **20% opacity**. Never use 100% opaque lines.
*   **Neon Emitters:** Any element using `primary` or `secondary` tokens should have a subtle outer glow (`box-shadow: 0 0 15px [color]`) to simulate the high-tech neon request.

## 5. Components

### HUD Energy Bars (Progress Bars)
*   **Track:** `surface-container-lowest` (#000000) with a `DEFAULT` (0.25rem) radius.
*   **Fill:** A horizontal gradient from `primary` to `primary-container`.
*   **Glow:** The fill should have a `secondary` glow if the energy is critical (using the `error` token logic).

### Statistic Cards
*   **Background:** Glassmorphic `surface-container-low` at 60% opacity.
*   **Corner Radius:** `lg` (0.5rem) for a modern, refined look.
*   **Spacing:** Use `spacing.3` (0.6rem) for internal padding to keep the UI tight and "streamer-dense."
*   **Separation:** Forbid dividers. Use `spacing.2` (0.4rem) of vertical white space to separate line items.

### Wave Indicators
*   **Typography:** `display-lg` (Space Grotesk).
*   **Styling:** Use a `secondary` (#ff51fa) text-shadow to create a "vibrating" neon effect.
*   **Positioning:** Overlap the top edge of the arena frame to break the grid and create an editorial, layered composition.

### Buttons (Primary Action)
*   **Base:** `secondary_container` (#a900a9).
*   **Text:** `on-secondary_container` (#fff5f9).
*   **State:** On hover, transition to `secondary` (#ff51fa) with a `16px` diffused glow.

### Input Fields (For Admin/Chat)
*   **Surface:** `surface-container-lowest`.
*   **Indicator:** Instead of a full border, use a 2px bottom-bar in `primary` (#99f7ff) when active.

## 6. Do's and Don'ts

### Do
*   **Do** use `spacing.20` and `spacing.24` for large architectural gaps to let the neon "breathe."
*   **Do** use `secondary` (Magenta) and `tertiary` (Purple) to highlight "Hostile" or "Wave" events, while `primary` (Cyan) remains for "Player" or "Friendly" actions.
*   **Do** apply `backdrop-blur` to any element that sits over the 2D Arena play area to maintain legibility.

### Don't
*   **Don't** use pure white (#FFFFFF). Use `on-surface` (#f1dfff) to maintain the atmospheric purple tint.
*   **Don't** use `xl` (0.75rem) rounding on every element. Use `sm` and `md` for a more "precision-tooled" tech feel.
*   **Don't** use standard "Drop Shadows." If it doesn't look like light is emitting from the source, it doesn't belong in this design system.
*   **Don't** align everything to a center axis. Offset HUD elements (e.g., stats in top-right, energy in top-left) to create a dynamic, broadcast-ready layout.