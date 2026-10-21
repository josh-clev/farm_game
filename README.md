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
- `js/ai.js` contains the AI opponent and play-test learner; `js/ai-model.js` is the bundled trained model.
- `assets/` contains the game artwork.

The JavaScript uses ordered classic scripts so the game remains compatible with direct `file://` launching as well as static hosts such as GitHub Pages.

## AI play testing

Run `node scripts/serve.mjs --train-ai` and open `http://127.0.0.1:4173/?train-ai`. Choose **Play against AI**. On this local development URL, the game records Player 1's farm actions, purchases, and order completions. After 20 total turns, it measures the change in Player 1's coins plus five times renown and updates action and consecutive-action averages. The training server writes the aggregate model to `js/ai-model.js` after each update; the browser also keeps a local copy. Review and commit the changed model file after play testing. Training writes are disabled when the server runs without `--train-ai`, on public hosts, and in normal play.

If the training server was not used, reload the same URL and choose **Export AI training** to download `ai-model.js`; replace the repository file with the download. Use the same browser profile while gathering examples. No personal data or raw move history is exported.

The opponent starts with a rule-based policy, then uses the learned action and action-pair outcomes to adjust its choices. New shop items with existing `upgrade`, `seedCrop`, or supported `tool` properties are categorized from their properties rather than an item list. A new kind of item effect still needs game rules and an AI target-selection rule. This small delayed-reward learner needs many varied play-test games; its averages are correlations and do not prove that an action caused later gains.
