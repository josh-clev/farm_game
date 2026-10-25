function showVictory(player) {
  victoryPlayer.textContent = `Player ${player}`;
  victorySummary.innerHTML = `<table><thead><tr><th>Resource</th><th>Player 1</th><th>Player 2</th></tr></thead><tbody>${crops.map((crop) => `<tr><th>${crop.name}</th><td>${soldResources[1][crop.name]}</td><td>${soldResources[2][crop.name]}</td></tr>`).join("")}</tbody><tfoot><tr><th>Coins earned</th><td>${earnedCoins[1]}</td><td>${earnedCoins[2]}</td></tr></tfoot></table>`;
  victoryScreen.hidden = false;
}

async function startGame(againstAi, trainAi = false) {
  if (againstAi) FarmAi.start(trainAi);
  exportAiGameButton.hidden = !againstAi || !FarmAi.training;
  mainMenu.hidden = true;
  gameScene.hidden = false;
  turnAnnouncement.hidden = false;
  await announceRound();
  announceTurn();
}
playButton.addEventListener("click", () => startGame(false));
playAiButton.addEventListener("click", () => startGame(true));
trainAiButton.hidden = !window.FarmGameData.aiTrainingEnabled;
trainAiButton.addEventListener("click", () => startGame(true, true));
importAiButton.hidden = !window.FarmGameData.aiTrainingEnabled;
importAiButton.addEventListener("click", () => importAiInput.click());
importAiInput.addEventListener("change", async () => {
  if (!importAiInput.files.length) return;
  try {
    const merged = await FarmAi.importFiles(importAiInput.files);
    trainingStatus.textContent = merged
      ? `Merged ${merged} training file${merged === 1 ? "" : "s"}. Export to save the combined model.`
      : "These training files were already included.";
    exportAiButton.hidden = !FarmAi.hasTrainingData();
  } catch (error) {
    trainingStatus.textContent = error.message;
  }
  trainingStatus.hidden = false;
  importAiInput.value = "";
});
exportAiButton.hidden = !window.FarmGameData.aiTrainingEnabled || !FarmAi.hasTrainingData();
exportAiButton.addEventListener("click", FarmAi.exportModel);
exportAiGameButton.addEventListener("click", FarmAi.exportModel);
returnMenuButton.addEventListener("click", () => {
  location.reload();
});

function setDesktopPreviewRatio() {
  document.documentElement.style.setProperty("--preview-ratio", String(4 / 3));
}

setDesktopPreviewRatio();
window.addEventListener("resize", setDesktopPreviewRatio);
buildResourcePools();
orders = createRoundOrders(currentRound);
renderOrders();

loadGraphic("grass-background", (source) => {
  document.documentElement.style.setProperty("--grass-image", `url("${source}")`);
});

loadGraphic("plot", (source) => {
  document.documentElement.style.setProperty("--plot-image", `url("${source}")`);
});

loadGraphic("next-turn-button", (source) => {
  document.documentElement.style.setProperty("--next-turn-image", `url("${source}")`);
});

loadGraphic("water_icon", (source) => {
  document.documentElement.style.setProperty("--water-icon-image", `url("${source}")`);
  document.documentElement.classList.add("water-icon-loaded");
});

loadGraphic("harvest_icon", (source) => {
  document.documentElement.style.setProperty("--harvest-icon-image", `url("${source}")`);
  document.documentElement.classList.add("harvest-icon-loaded");
});

loadGraphic("coin_icon", (source) => {
  document.documentElement.style.setProperty("--coin-icon-image", `url("${source}")`);
});

loadGraphic("renown", (source) => {
  document.documentElement.style.setProperty("--renown-icon-image", `url("${source}")`);
});

for (let index = 0; index < 20; index += 1) {
  const plot = document.createElement("button");
  const row = Math.floor(index / 5);
  const column = index % 5;
  plot.className = "plot";
  plot.type = "button";
  plot.dataset.plot = String(index);
  plot.setAttribute("aria-label", `Farm plot ${index + 1}`);

  if (row === 3 && column === 0) {
    plot.classList.add("player-one-plot");
    plot.setAttribute("aria-label", `Farm plot ${index + 1}, Player 1 territory`);
  } else if (row === 3 && column === 4) {
    plot.classList.add("player-two-plot");
    plot.setAttribute("aria-label", `Farm plot ${index + 1}, Player 2 territory`);
  }

  grid.append(plot);
}

const neutralPlots = [...grid.querySelectorAll(".plot:not(.player-one-plot):not(.player-two-plot)")];

for (let index = neutralPlots.length - 1; index > 0; index -= 1) {
  const randomIndex = Math.floor(Math.random() * (index + 1));
  [neutralPlots[index], neutralPlots[randomIndex]] = [neutralPlots[randomIndex], neutralPlots[index]];
}

neutralPlots.slice(0, 4).forEach((plot) => plantCrop(plot, pickRandomCrop()));
queueNextCropSpawn();

grid.addEventListener("pointerup", (event) => {
  if (gameScene.inert) return;
  if (pendingUpgradePurchase) return;
  const plot = event.target.closest(".plot");
  if (!plot) return;

  const harvester = event.target.closest(".auto-harvester");
  if (harvester) {
    requestAutoHarvesterRecharge(harvester);
    return;
  }

  if (selectedTool && plot.classList.contains("can-use-tool")) {
    useTool(plot);
    return;
  }

  grid.querySelector(".is-selected")?.classList.remove("is-selected");
  plot.classList.add("is-selected");
});


toolButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (gameScene.inert) return;
    if (pendingDiscardCount > 0 || pendingUpgradePurchase) return;
    const tool = button.dataset.tool;
    selectedTool = selectedTool === tool ? null : tool;
    renderTools();
  });
});

function chooseAiUpgradeReplacement() {
  const upgrades = playerUpgradeSlots[2].map((itemKey, slotIndex) => ({
    slotIndex,
    upgrade: shopItems[itemKey]?.upgrade,
  }));
  return (upgrades.find(({ upgrade }) => upgrade !== "storage" && upgrade !== "market") || upgrades[0]).slotIndex;
}

function beginUpgradeReplacement(shopSlotIndex) {
  pendingUpgradePurchase = { shopSlotIndex };
  document.querySelectorAll(".confirmation-box").forEach((box) => box.remove());
  turnAnnouncement.textContent = "Choose an upgrade to replace";
  turnAnnouncement.classList.add("is-discarding");
  renderUpgradeSlots();
  renderShop();
  renderTools();
}

async function purchaseShopItem(slotIndex, replacementSlotIndex = null) {
  const card = shopCards[slotIndex];
  const slot = shopSlots[slotIndex];
  const item = shopItems[slot.itemKey];
  if (slot.purchased || playerCoins[currentPlayer] < item.price) return false;
  if (item.upgrade && playerUpgradeSlots[currentPlayer].includes(slot.itemKey)) return false;
  let upgradeSlotIndex = null;
  if (item.upgrade) {
    upgradeSlotIndex = playerUpgradeSlots[currentPlayer].indexOf(null);
    if (upgradeSlotIndex < 0 && replacementSlotIndex === null) {
      if (currentPlayer === 2 && gameScene.inert) replacementSlotIndex = chooseAiUpgradeReplacement();
      else {
        beginUpgradeReplacement(slotIndex);
        return false;
      }
    }
    if (upgradeSlotIndex < 0) upgradeSlotIndex = replacementSlotIndex;
  }
  FarmAi.record([FarmAi.itemKey(item)]);
  playerCoins[currentPlayer] -= item.price;
  slot.purchased = true;
  updateCoinDisplay(currentPlayer);
  if (item.upgrade) {
    const replacedItemKey = playerUpgradeSlots[currentPlayer][upgradeSlotIndex];
    const replacedUpgrade = replacedItemKey ? shopItems[replacedItemKey].upgrade : null;
    if (replacedUpgrade) {
      playerUpgrades[currentPlayer][replacedUpgrade] = 0;
      if (replacedUpgrade in turnActions && turnActions[replacedUpgrade] > 0) {
        turnActions[replacedUpgrade] -= 1;
      }
    }
    playerUpgradeSlots[currentPlayer][upgradeSlotIndex] = slot.itemKey;
    playerUpgrades[currentPlayer][item.upgrade] = 1;
    if (item.upgrade in turnActions) turnActions[item.upgrade] += 1;
    if (item.upgrade === "storage" || replacedUpgrade === "storage") {
      updateResourceCapacity(currentPlayer);
      beginDiscardSelection();
    }
    pendingUpgradePurchase = null;
    turnAnnouncement.classList.remove("is-discarding");
    if (pendingDiscardCount === 0) announceTurn();
    renderUpgradeSlots();
  } else if (item.seedCrop) {
    selectedTool = `seed:${item.seedCrop}`;
  } else {
    selectedTool = item.tool;
  }
  await slideCardAway(card, card.parentElement, ".shop-card", 360, "up");
  renderTools();
  renderShop();
  return true;
}

document.querySelectorAll(".upgrade-slot").forEach((upgradeSlot) => {
  activateOnPress(upgradeSlot, () => {
    if (!pendingUpgradePurchase || Number(upgradeSlot.dataset.player) !== currentPlayer) return;
    purchaseShopItem(pendingUpgradePurchase.shopSlotIndex, Number(upgradeSlot.dataset.slot));
  });
});

shopCards.forEach((card) => {
  activateOnPress(card, () => {
    if (gameScene.inert) return;
    if (pendingUpgradePurchase) return;
    const slotIndex = shopCards.indexOf(card);
    const slot = shopSlots[slotIndex];
    const item = shopItems[slot.itemKey];
    if (slot.purchased) return;
    if (playerCoins[currentPlayer] < item.price) return;
    openConfirmation(card, `Buy ${item.name} for ${item.price} coins?`, () => purchaseShopItem(slotIndex));
  });
});

function handleOrderPress(event) {
  if (gameScene.inert) return;
  const order = event.target.closest(".order-card");
  if (!order || event.target.closest(".confirmation-box")) return;
  const orderIndex = Number(order.dataset.order);
  const orderData = orders[orderIndex];
  if (!orderData || !canFillOrder(orderData)) return;
  const rewardSummary = [
    orderData.coinReward > 0 ? `${orderData.coinReward} coins` : "",
    orderData.renownReward > 0 ? `${orderData.renownReward} renown` : "",
  ].filter(Boolean).join(" and ");
  openConfirmation(order, `Sell this order for ${rewardSummary}?`, () => fillOrder(orderIndex));
}

orderList.addEventListener("click", handleOrderPress);
orderRoundCount.addEventListener("click", (event) => {
  if (gameScene.inert) return;
  event.stopPropagation();
  openRoundDebugMenu();
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".round-debug-menu") && !event.target.closest(".order-round-count")) {
    closeRoundDebugMenu();
  }
});
orderList.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  handleOrderPress(event);
});

document.querySelectorAll(".resource-list").forEach((resourceList) => {
  resourceList.addEventListener("click", (event) => {
    if (gameScene.inert) return;
    const item = event.target.closest(".resource-item[data-crop]");
    if (item) discardResource(item);
  });
});

async function advanceTurn() {
  if (isActionLocked() || pendingUpgradePurchase || grid.querySelector(".is-treating") || (getRegularWaterActions() > 0 && hasWaterablePlots()) || pendingDiscardCount > 0) return;
  nextTurnButton.disabled = true;
  FarmAi.finishTurn();
  document.querySelectorAll(".confirmation-box").forEach((box) => box.remove());
  const previousOrderPositions = captureCardPositions(orderList, ".order-card");
  const previousShopPositions = captureCardPositions(document.querySelector(".shop-list"), ".shop-card");
  const enteringShopKeys = new Set(
    shopSlots
      .map((slot, index) => (slot.purchased ? String(index) : null))
      .filter(Boolean),
  );
  replacePurchasedShopItems();
  turnsUntilShopRefresh -= 1;
  let shopWasRefreshed = false;
  if (turnsUntilShopRefresh === 0) {
    turnsUntilShopRefresh = 10;
    shopWasRefreshed = true;
    await refreshShop();
  }
  turnsUntilOrderRefresh -= 1;
  let orderWasRefreshed = false;
  if (turnsUntilOrderRefresh === 0) {
    turnsUntilOrderRefresh = 20;
    orderWasRefreshed = true;
    await refreshOrders();
  }
  const enteringOrderIds = new Set(
    orders.map((order) => String(order.id)).filter((id) => !previousOrderPositions.has(id)),
  );
  advanceCropSpawnTimer();
  grid.querySelectorAll(".plot").forEach((plot) => {
    if (plot.dataset.crop) plot.dataset.turnWatered = "0";
  });
  currentPlayer = currentPlayer === 1 ? 2 : 1;
  FarmAi.syncLock();
  await applyWeatherEvent();
  selectedTool = null;
  turnActions = {
    water: 3 + playerUpgrades[currentPlayer].water,
    cut: 1 + playerUpgrades[currentPlayer].cut,
  };
  renderTools();
  if (!orderWasRefreshed) renderOrders();
  if (!shopWasRefreshed) renderShop();
  requestAnimationFrame(() => {
    if (!orderWasRefreshed) {
      animateCardLayout(orderList, ".order-card", previousOrderPositions, enteringOrderIds);
    }
    if (!shopWasRefreshed) {
      animateCardLayout(document.querySelector(".shop-list"), ".shop-card", previousShopPositions, enteringShopKeys);
    }
  });
  announceTurn();
  if (currentPlayer === 2 && gameScene.inert && victoryScreen.hidden) {
    window.setTimeout(() => FarmAi.playTurn().catch(console.error), 450);
  }
}

nextTurnButton.addEventListener("click", () => {
  if (!gameScene.inert) advanceTurn();
});

renderTools();
renderUpgradeSlots();
announceTurn();
