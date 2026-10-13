# JavaScript map

- `game-data.js` owns static crop and shop definitions.
- `ui.js` owns reusable asset loading, input, confirmation, card-layout, and flyer animation helpers.
- `game.js` owns mutable game state, rules, rendering, and turn orchestration.

The files are classic scripts loaded in that order so the game continues to work when `index.html` is opened directly, without a development server or build step.
