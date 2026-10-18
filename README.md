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

Open the game and choose **Train AI** from the main menu; no command is required. The game records both Player 1's and the AI's farm actions, purchases, order completions, and discards separately. After 20 total turns, it measures each player's change in coins plus five times renown, then updates action and consecutive-action averages. The AI uses both sets of outcomes during the session. The browser saves the model locally.

Use **Export AI training** during a training game to download `ai-model.js`. To combine several exports, choose **Import AI training** on the main menu, select multiple exported files, then export the combined model. Reimporting the same export or a later snapshot from the same browser will not count its earlier results twice. Replace `js/ai-model.js` with the combined export and commit it to ship those results. Older version 1 exports can be imported, but partially overlapping version 1 snapshots cannot be identified as duplicates; prefer the newest export from each old play-test browser. A static game cannot write directly to its repository files.

For automatic repository updates during local development, run `node scripts/serve.mjs --train-ai`, open `http://127.0.0.1:4173/`, and choose **Train AI**. The server merges the model into `js/ai-model.js` after each update. This optional write endpoint is disabled without `--train-ai`. No personal data or raw move history is exported.

Before shipping, set `aiTrainingEnabled` to `false` in `js/game-data.js` to hide training controls and disable collection. The shipped **Play against AI** mode continues to use the bundled model.

The opponent starts with a rule-based policy, then uses the learned action and action-pair outcomes to adjust its choices. New shop items with existing `upgrade`, `seedCrop`, or supported `tool` properties are categorized from their properties rather than an item list. A new kind of item effect still needs game rules and an AI target-selection rule. This small delayed-reward learner needs many varied play-test games; its averages are correlations and do not prove that an action caused later gains.
