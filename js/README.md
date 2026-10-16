# JavaScript map

- `game-data.js` owns static crop and shop definitions.
- `ui.js` owns reusable asset loading, input, confirmation, card-layout, and flyer animation helpers.
- `game-state.js` owns shared DOM references and mutable game state.
- `shop.js` owns shop rendering and refresh helpers.
- `resources.js` owns player resource pools, capacity, and discarding.
- `orders.js` owns order creation, rendering, refresh, and sales.
- `farm.js` owns plots, crops, tools, and weather effects.
- `turns.js` owns round and turn announcements.
- `game.js` initializes the game, wires events, and advances turns.

The files are classic scripts loaded in the order listed above. Domain functions use the shared state from `game-state.js`; `game.js` runs last so initialization can call them. This keeps direct `index.html` launching working without a build step.
