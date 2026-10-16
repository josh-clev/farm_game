# Farm Game

A two-player farming game that runs directly in a web browser with no build step or external dependencies.

## Run locally

Open `index.html` in a modern browser.

## Project structure

- `index.html` contains the game interface.
- `styles.css` contains the responsive layout and visual styling.
- `js/game-data.js` contains static crop and shop definitions.
- `js/ui.js` contains reusable input, confirmation, and animation helpers.
- `js/` separates shared state, shop, resources, orders, farm, and turns; `game.js` wires them together.
- `assets/` contains the game artwork.

The JavaScript uses ordered classic scripts so the game remains compatible with direct `file://` launching as well as static hosts such as GitHub Pages.
