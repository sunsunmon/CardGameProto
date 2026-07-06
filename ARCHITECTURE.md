# TCG2 Project Structure

This project is still plain HTML/CSS/JavaScript. No bundler is required.

## Runtime Load Order

Scripts are loaded in this order from `index.html`:

1. `js/data/cards.js`
   Card definitions and card/deck factory helpers.
2. `js/systems/audio.js`
   Sound effects and battle music handling.
3. `js/systems/animations.js`
   Shared visual effects and combat animations.
4. `js/core/game.js`
   Base game state, turn flow, collection, guide, tutorial, and core UI events.
5. `js/ui/card-inspector.js`
   Card detail viewer.
6. `js/features/battlefield-overlay.js`
   Current main gameplay overlay: hand lanes, board spell logic, discard viewer,
   responsive rails, combat overrides, passive icons, and drag previews.

Keep this order unless a module is explicitly refactored to remove its dependency
on previous modules.

## CSS Layers

1. `css/base.css`
   Main layout and original component styles.
2. `css/card-viewer.css`
   Card detail viewer styles.
3. `css/board-spacing.css`
   Board grid spacing normalization.
4. `css/battlefield-overlay.css`
   Current main gameplay/mobile/discard/tutorial/card overlay styles.
5. `css/card-back.css`
   Card back image and deck/discard stack visual overrides.

## Where New Features Should Go

- New cards or ability data: `js/data/cards.js`
- Sound or music behavior: `js/systems/audio.js`
- Reusable visual effects: `js/systems/animations.js`
- Card detail viewer behavior: `js/ui/card-inspector.js`
- Current combat/spell/drag/board behavior: `js/features/battlefield-overlay.js`
- Broad app flow such as new menus, guide, tutorial entry, or end screen:
  `js/core/game.js`

## Next Refactor Targets

`js/features/battlefield-overlay.js` is intentionally kept intact in this pass to
avoid changing gameplay behavior while the project is actively moving. The next
safe split is:

1. Move card rendering helpers into `js/ui/render-card.js`.
2. Move combat resolution into `js/systems/combat.js`.
3. Move spell targeting and spell effects into `js/systems/spells.js`.
4. Move discard viewer into `js/ui/discard-viewer.js`.
5. Move tutorial focus/step behavior into `js/systems/tutorial.js`.

Do those one at a time and run `node --check` after each JS move.
