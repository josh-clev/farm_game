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

Open the game and choose **Train AI** from the main menu; no command is required. The game records Player 1's farm actions, purchases, and order completions. After 20 total turns, it measures the change in Player 1's coins plus five times renown and updates action and consecutive-action averages. The browser saves the model locally and applies it during the session. Use **Export AI training** during a training game or from the main menu after training data has been saved, then replace `js/ai-model.js` with the downloaded file and commit it. A static game cannot write directly to its repository files.

For automatic repository updates during local development, run `node scripts/serve.mjs --train-ai`, open `http://127.0.0.1:4173/`, and choose **Train AI**. The server writes the aggregate model to `js/ai-model.js` after each update. This optional write endpoint is disabled without `--train-ai`. Use the same browser profile while gathering examples. No personal data or raw move history is exported.

Before shipping, set `aiTrainingEnabled` to `false` in `js/game-data.js` to hide training controls and disable collection. The shipped **Play against AI** mode continues to use the bundled model.

The opponent starts with a rule-based policy, then uses the learned action and action-pair outcomes to adjust its choices. New shop items with existing `upgrade`, `seedCrop`, or supported `tool` properties are categorized from their properties rather than an item list. A new kind of item effect still needs game rules and an AI target-selection rule. This small delayed-reward learner needs many varied play-test games; its averages are correlations and do not prove that an action caused later gains.
