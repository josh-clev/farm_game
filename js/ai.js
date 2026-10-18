(function defineFarmAi() {
  "use strict";

  const trainingAllowed = window.FarmGameData.aiTrainingEnabled;
  const legacyTraining = trainingAllowed && location.protocol === "http:"
    && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    && new URLSearchParams(location.search).has("train-ai");
  const storageKey = "farm-game-ai-training-v1";
  const bundled = window.FarmAiModel;
  let model = bundled;
  let training = legacyTraining;
  function savedModel() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved?.version === 1 && saved.horizon === 20 && saved.actions) return saved;
    } catch (_) { /* Private browsing may disable storage. */ }
    return null;
  }
  if (training) model = savedModel() || bundled;
  let enabled = false;
  let turnNumber = 0;
  let previousAction = null;
  let previousAiAction = null;
  const pending = [];

  function itemKey(item) {
    if (item.upgrade) return `shop:upgrade:${item.upgrade}`;
    if (item.seedCrop) return "shop:seed";
    if (item.tool) return `shop:tool:${item.tool}`;
    return "shop:item";
  }

  function actionKeys(kind, crop) {
    return crop ? [kind, `${kind}:${crop}`] : [kind];
  }

  function record(keys) {
    if (!training || !enabled || currentPlayer !== 1) return;
    const features = [...keys];
    if (previousAction) features.push(`pair:${previousAction}>${keys[0]}`);
    pending.push({ turn: turnNumber, score: playerCoins[1] + playerRenown[1] * 5, features });
    if (pending.length > 250) pending.shift();
    previousAction = keys[0];
  }

  function finishTurn() {
    if (!enabled) return;
    turnNumber += 1;
    if (!training) return;
    let changed = false;
    while (pending.length && turnNumber - pending[0].turn >= 20) {
      const sample = pending.shift();
      const gain = playerCoins[1] + playerRenown[1] * 5 - sample.score;
      model.total.count += 1;
      model.total.sum += gain;
      for (const feature of sample.features) {
        const entry = model.actions[feature] || { count: 0, sum: 0 };
        entry.count += 1;
        entry.sum += gain;
        model.actions[feature] = entry;
      }
      changed = true;
    }
    if (changed) {
      try { localStorage.setItem(storageKey, JSON.stringify(model)); } catch (_) { /* Export still works. */ }
      if (location.protocol === "http:" && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
        fetch("/__ai-training", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(model),
        }).catch(() => { /* The static test server has no training endpoint. */ });
      }
    }
  }

  function value(keys, prior) {
    if (!model.total.count) return prior;
    const average = model.total.sum / model.total.count;
    let adjustment = 0;
    for (const key of [...keys, ...(previousAiAction ? [`pair:${previousAiAction}>${keys[0]}`] : [])]) {
      const entry = model.actions[key];
      if (!entry?.count) continue;
      adjustment += ((entry.sum / entry.count - average) / 8) * Math.min(1, entry.count / 12);
    }
    return prior + Math.max(-25, Math.min(25, adjustment));
  }

  function syncLock() {
    gameScene.inert = enabled && currentPlayer === 2;
  }

  function start(trainAi = false) {
    enabled = true;
    training = trainingAllowed && (trainAi || legacyTraining);
    if (training) model = savedModel() || bundled;
    syncLock();
  }

  function hasTrainingData() {
    return (savedModel()?.total.count || 0) > 0;
  }

  async function buy(slotIndex) {
    const slot = shopSlots[slotIndex];
    const item = shopItems[slot.itemKey];
    if (slot.purchased || playerCoins[2] < item.price) return false;
    await purchaseShopItem(slotIndex);
    previousAiAction = itemKey(item);
    return true;
  }

  function orderDemand(cropName) {
    return orders.filter((order) => !order.filled).reduce((best, order) => {
      const requirement = order.items.find((item) => item.crop === cropName);
      return Math.max(best, requirement ? Math.max(0, requirement.amount - playerResources[2][cropName]) : 0);
    }, 0);
  }

  function bestPlot(tool) {
    const candidates = [...grid.querySelectorAll(".plot")].filter((plot) =>
      canUseTool(plot, tool) && (tool !== "fertiliser" || Number(plot.dataset.water) < Number(plot.dataset.waterNeeded)));
    const exposesCrop = (plot) => {
      if (getPlotOwner(plot) !== null) return false;
      const remainingAfterWater = Number(plot.dataset.waterNeeded) - Number(plot.dataset.water)
        - (tool === "fertiliser" ? 3 : 1);
      if (remainingAfterWater <= 0 || remainingAfterWater > 2) return false;
      const waterLeftThisTurn = tool === "fertiliser" ? 0 : Math.min(
        turnActions.water - 1,
        2 - Number(plot.dataset.turnWatered || 0) - 1,
      );
      return waterLeftThisTurn < remainingAfterWater;
    };
    const safeCandidates = tool === "water" || tool === "fertiliser"
      ? candidates.filter((plot) => !exposesCrop(plot)) : candidates;
    const choices = safeCandidates.length ? safeCandidates : candidates;
    choices.sort((a, b) => {
      const rank = (plot) => {
        const crop = crops.find((entry) => entry.name === plot.dataset.crop);
        const need = orderDemand(plot.dataset.crop);
        const remaining = Number(plot.dataset.waterNeeded) - Number(plot.dataset.water);
        const prior = tool === "cut"
          ? 35 + (crop?.marketValue || 0) + need * 12
          : 20 + (crop?.marketValue || 0) / 3 + need * 7 - remaining * 2;
        const finishingStartedCrop = tool === "water" && remaining === 1
          && Number(plot.dataset.turnWatered || 0) > 0;
        const action = tool === "cut" ? "harvest" : tool;
        return value(actionKeys(action, plot.dataset.crop), prior)
          + (finishingStartedCrop ? 1000 : 0);
      };
      return rank(b) - rank(a);
    });
    return choices[0];
  }

  async function playTurn() {
    if (!enabled || currentPlayer !== 2 || !victoryScreen.hidden) return;
    // The cap protects against unexpected new items creating a non-progressing action loop.
    for (let step = 0; step < 100 && currentPlayer === 2 && victoryScreen.hidden; step += 1) {
      if (pendingDiscardCount) {
        const crop = crops.filter((entry) => playerResources[2][entry.name] > 0)
          .sort((a, b) => (orderDemand(a.name) * 20 + a.marketValue) - (orderDemand(b.name) * 20 + b.marketValue))[0];
        if (!crop) break;
        await discardResource(document.querySelector(`.resource-item[data-player="2"][data-crop="${crop.name}"]`));
        continue;
      }
      const orderIndex = orders.findIndex((order) => !order.filled && canFillOrder(order));
      if (orderIndex >= 0) {
        await fillOrder(orderIndex);
        previousAiAction = "fill-order";
        continue;
      }
      if (turnActions.cut > 0 && totalResources(2) < maxResources(2)) {
        const plot = bestPlot("cut");
        if (plot) {
          selectedTool = "cut";
          await useTool(plot);
          previousAiAction = "harvest";
          continue;
        }
      }
      if (turnActions.water > 0) {
        const plot = bestPlot("water");
        if (plot) {
          selectedTool = "water";
          await useTool(plot);
          previousAiAction = "water";
          continue;
        }
      }
      const options = shopSlots.map((slot, index) => ({ slot, index, item: shopItems[slot.itemKey] }))
        .filter(({ slot, item }) => !slot.purchased && item.price <= playerCoins[2]);
      const purchases = options.map((option) => {
        const { item } = option;
        const prior = item.upgrade === "water" ? 42 : item.upgrade === "cut" ? 36
          : item.upgrade === "storage" ? (totalResources(2) >= 4 ? 30 : 12)
          : item.seedCrop ? (orderDemand(item.seedCrop) ? 28 : 13)
          : item.tool === "fertiliser" ? 20 : 0;
        return { ...option, score: value([itemKey(item)], prior) - item.price / 4 };
      }).sort((a, b) => b.score - a.score);
      const choice = purchases[0];
      if (choice?.score > 13 && await buy(choice.index)) {
        const item = choice.item;
        const tool = item.seedCrop ? `seed:${item.seedCrop}` : item.tool;
        const plot = tool?.startsWith("seed:")
          ? [...grid.querySelectorAll(".plot")].find((candidate) => canPlantSeed(candidate, crops.find((crop) => crop.name === item.seedCrop)))
          : tool === "fertiliser"
          ? bestPlot("fertiliser")
          : null;
        if (plot && tool) {
          selectedTool = tool;
          await useTool(plot);
          previousAiAction = tool.startsWith("seed:") ? "plant" : tool;
        }
        continue;
      }
      break;
    }
    selectedTool = null;
    renderTools();
    if (currentPlayer === 2 && victoryScreen.hidden) await advanceTurn();
  }

  function exportModel() {
    const source = `// Play-test model. Each action stores 20-turn coin + renown outcomes.\nwindow.FarmAiModel = ${JSON.stringify(training ? model : savedModel() || model, null, 2)};\n`;
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "ai-model.js";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  window.FarmAi = { get training() { return training; }, start, hasTrainingData, syncLock, finishTurn, playTurn, record, itemKey, actionKeys, exportModel };
}());
