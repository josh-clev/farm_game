(function defineFarmAi() {
  "use strict";

  const trainingAllowed = window.FarmGameData.aiTrainingEnabled;
  const legacyTraining = trainingAllowed && location.protocol === "http:"
    && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    && new URLSearchParams(location.search).has("train-ai");
  const storageKey = "farm-game-ai-training-v2";
  const oldStorageKey = "farm-game-ai-training-v1";
  const sourceKey = "farm-game-ai-source-v2";
  const bundled = window.FarmAiModel;
  const emptyStats = () => ({ total: { count: 0, sum: 0 }, actions: {} });
  const emptyModel = () => ({ version: 2, horizon: 20, sources: {} });
  const validEntry = (entry) => Number.isInteger(entry?.count) && entry.count >= 0 && Number.isFinite(entry?.sum);
  const validStats = (stats) => validEntry(stats?.total) && stats.actions
    && typeof stats.actions === "object" && !Array.isArray(stats.actions)
    && Object.keys(stats.actions).length <= 2000
    && Object.entries(stats.actions).every(([key, entry]) => key.length <= 120
      && !["__proto__", "constructor", "prototype"].includes(key) && validEntry(entry));
  function normalize(raw, legacyId) {
    if (raw?.horizon !== 20) return null;
    if (raw.version === 2 && raw.sources && typeof raw.sources === "object"
      && !Array.isArray(raw.sources) && Object.keys(raw.sources).length <= 256
      && Object.entries(raw.sources).every(([id, source]) => /^[a-zA-Z0-9_-]{1,100}$/.test(id)
        && !["__proto__", "constructor", "prototype"].includes(id)
        && validStats(source?.human) && validStats(source?.ai))) return raw;
    if (raw.version === 1 && validStats(raw)) {
      return { version: 2, horizon: 20, sources: { [legacyId]: { human: raw, ai: emptyStats() } } };
    }
    return null;
  }
  function legacyId(raw) {
    let hash = 2166136261;
    for (const character of JSON.stringify(raw)) {
      hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    }
    return `legacy-${(hash >>> 0).toString(16)}`;
  }
  function mergeInto(target, incoming) {
    let changed = false;
    for (const [id, source] of Object.entries(incoming.sources)) {
      const old = target.sources[id];
      const count = (stats) => stats.human.total.count + stats.ai.total.count;
      if (!old || count(source) > count(old)) {
        target.sources[id] = source;
        changed = true;
      }
    }
    return changed;
  }
  function savedModel() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved) return normalize(saved, "legacy-local");
      const old = JSON.parse(localStorage.getItem(oldStorageKey));
      return old ? normalize(old, "legacy-local") : null;
    } catch (_) { return null; }
  }
  function initialModel() {
    const fromBundle = JSON.parse(JSON.stringify(normalize(bundled, "legacy-bundled") || emptyModel()));
    const saved = savedModel();
    if (!saved) return fromBundle;
    if (bundled.version === 1) return saved;
    mergeInto(fromBundle, saved);
    return fromBundle;
  }
  let model = normalize(bundled, "legacy-bundled") || emptyModel();
  let training = legacyTraining;
  if (training) model = initialModel();
  let sourceId = null;
  function getSourceId() {
    if (sourceId) return sourceId;
    try {
      sourceId = localStorage.getItem(sourceKey);
      if (/^local-[a-zA-Z0-9_-]{1,80}$/.test(sourceId || "")) return sourceId;
    } catch (_) { /* Private browsing may disable storage. */ }
    sourceId = `local-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    try { localStorage.setItem(sourceKey, sourceId); } catch (_) { /* Export still works. */ }
    return sourceId;
  }
  function aggregate() {
    const totals = { human: emptyStats(), ai: emptyStats() };
    for (const source of Object.values(model.sources)) {
      for (const role of ["human", "ai"]) {
        const target = totals[role];
        target.total.count += source[role].total.count;
        target.total.sum += source[role].total.sum;
        for (const [key, entry] of Object.entries(source[role].actions)) {
          const combined = target.actions[key] || { count: 0, sum: 0 };
          combined.count += entry.count;
          combined.sum += entry.sum;
          target.actions[key] = combined;
        }
      }
    }
    return totals;
  }
  let summary = aggregate();
  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(model)); } catch (_) { /* Export still works. */ }
    if (location.protocol === "http:" && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      fetch("/__ai-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(model),
      }).catch(() => { /* The static test server has no training endpoint. */ });
    }
  }
  let enabled = false;
  let turnNumber = 0;
  const previousAction = { 1: null, 2: null };
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
    if (!training || !enabled) return;
    const features = [...keys];
    if (previousAction[currentPlayer]) features.push(`pair:${previousAction[currentPlayer]}>${keys[0]}`);
    pending.push({
      turn: turnNumber,
      player: currentPlayer,
      score: playerCoins[currentPlayer] + playerRenown[currentPlayer] * 5,
      features,
    });
    if (pending.length > 250) pending.shift();
    previousAction[currentPlayer] = keys[0];
  }

  function finishTurn() {
    if (!enabled) return;
    turnNumber += 1;
    if (!training) return;
    let changed = false;
    const source = model.sources[getSourceId()] || { human: emptyStats(), ai: emptyStats() };
    model.sources[getSourceId()] = source;
    while (pending.length && turnNumber - pending[0].turn >= 20) {
      const sample = pending.shift();
      const gain = playerCoins[sample.player] + playerRenown[sample.player] * 5 - sample.score;
      const stats = sample.player === 1 ? source.human : source.ai;
      stats.total.count += 1;
      stats.total.sum += gain;
      for (const feature of sample.features) {
        const entry = stats.actions[feature] || { count: 0, sum: 0 };
        entry.count += 1;
        entry.sum += gain;
        stats.actions[feature] = entry;
      }
      changed = true;
    }
    if (changed) {
      summary = aggregate();
      persist();
    }
  }

  function value(keys, prior) {
    const adjustments = [];
    for (const stats of [summary.human, summary.ai]) {
      if (!stats.total.count) continue;
      const average = stats.total.sum / stats.total.count;
      let adjustment = 0;
      for (const key of [...keys, ...(previousAiAction ? [`pair:${previousAiAction}>${keys[0]}`] : [])]) {
        const entry = stats.actions[key];
        if (!entry?.count) continue;
        adjustment += ((entry.sum / entry.count - average) / 8) * Math.min(1, entry.count / 12);
      }
      adjustments.push(adjustment);
    }
    return prior + Math.max(-25, Math.min(25,
      adjustments.reduce((total, adjustment) => total + adjustment, 0) / (adjustments.length || 1)));
  }

  function syncLock() {
    gameScene.inert = enabled && currentPlayer === 2;
  }

  function start(trainAi = false) {
    enabled = true;
    training = trainingAllowed && (trainAi || legacyTraining);
    if (trainingAllowed) {
      model = initialModel();
      summary = aggregate();
    }
    syncLock();
  }

  function hasTrainingData() {
    const saved = savedModel();
    return saved && Object.values(saved.sources).some((source) =>
      source.human.total.count + source.ai.total.count > 0);
  }

  async function buy(slotIndex) {
    const slot = shopSlots[slotIndex];
    const item = shopItems[slot.itemKey];
    if (slot.purchased || playerCoins[2] < item.price) return false;
    const purchased = await purchaseShopItem(slotIndex);
    if (!purchased) return false;
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
        .filter(({ slot, item }) => !slot.purchased
          && item.price <= playerCoins[2]
          && !(item.upgrade && playerUpgradeSlots[2].includes(slot.itemKey)));
      const purchases = options.map((option) => {
        const { item } = option;
        const prior = item.upgrade === "water" ? 42 : item.upgrade === "cut" ? 36
          : item.upgrade === "storage" ? (totalResources(2) >= 4 ? 30 : 12)
          : item.upgrade === "market" ? (totalResources(2) >= maxResources(2) ? 32 : 15)
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
    const combined = training ? model : initialModel();
    const source = `// Play-test model. Sources merge without counting repeat exports twice.\nwindow.FarmAiModel = ${JSON.stringify(combined, null, 2)};\n`;
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "ai-model.js";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importFiles(files) {
    const incoming = [];
    for (const file of files) {
      if (file.size > 1_000_000) throw new Error(`${file.name} is too large`);
      const contents = await file.text();
      const wrapped = contents.match(/^\s*(?:\/\/[^\n]*\n)*window\.FarmAiModel\s*=\s*([\s\S]*);\s*$/);
      let raw;
      try { raw = JSON.parse(wrapped ? wrapped[1] : contents); }
      catch (_) { throw new Error(`${file.name} is not an AI model`); }
      const parsed = normalize(raw, legacyId(raw));
      if (!parsed) throw new Error(`${file.name} has an unsupported model format`);
      incoming.push(parsed);
    }
    model = initialModel();
    let merged = 0;
    for (const parsed of incoming) {
      if (mergeInto(model, parsed)) merged += 1;
    }
    summary = aggregate();
    if (merged) persist();
    return merged;
  }

  window.FarmAi = { get training() { return training; }, start, hasTrainingData, syncLock, finishTurn, playTurn, record, itemKey, actionKeys, exportModel, importFiles };
}());
