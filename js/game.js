function showVictory(player) {
  victoryPlayer.textContent = `Player ${player}`;
  victorySummary.innerHTML = `<table><thead><tr><th>Resource</th><th>Player 1</th><th>Player 2</th></tr></thead><tbody>${crops.map((crop) => `<tr><th>${crop.name}</th><td>${soldResources[1][crop.name]}</td><td>${soldResources[2][crop.name]}</td></tr>`).join("")}</tbody><tfoot><tr><th>Coins earned</th><td>${earnedCoins[1]}</td><td>${earnedCoins[2]}</td></tr></tfoot></table>`;
  victoryScreen.hidden = false;
}

playButton.addEventListener("click", async () => {
  mainMenu.hidden = true;
  gameScene.hidden = false;
  turnAnnouncement.hidden = false;
  await announceRound();
  announceTurn();
});
returnMenuButton.addEventListener("click", () => {
  victoryScreen.hidden = true;
  gameScene.hidden = true;
  turnAnnouncement.hidden = true;
  mainMenu.hidden = false;
});

function setDesktopPreviewRatio() {
  document.documentElement.style.setProperty("--preview-ratio", String(4 / 3));
}

setDesktopPreviewRatio();
window.addEventListener("resize", setDesktopPreviewRatio);
buildResourcePools();
orders = Array.from({ length: 5 }, createOrder);
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
  const plot = event.target.closest(".plot");
  if (!plot) return;

  if (selectedTool && plot.classList.contains("can-use-tool")) {
    useTool(plot);
    return;
  }

  grid.querySelector(".is-selected")?.classList.remove("is-selected");
  plot.classList.add("is-selected");
});


toolButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (pendingDiscardCount > 0) return;
    const tool = button.dataset.tool;
    selectedTool = selectedTool === tool ? null : tool;
    renderTools();
  });
});

shopCards.forEach((card) => {
  activateOnPress(card, () => {
    const slotIndex = shopCards.indexOf(card);
    const slot = shopSlots[slotIndex];
    const item = shopItems[slot.itemKey];
    if (slot.purchased) return;
    if (playerCoins[currentPlayer] < item.price) return;
    openConfirmation(card, `Buy ${item.name} for ${item.price} coins?`, async () => {
      playerCoins[currentPlayer] -= item.price;
      slot.purchased = true;
      updateCoinDisplay(currentPlayer);
      if (item.upgrade) {
        playerUpgrades[currentPlayer][item.upgrade] += 1;
        if (item.upgrade in turnActions) turnActions[item.upgrade] += 1;
        if (item.upgrade === "storage") updateResourceCapacity(currentPlayer);
      } else if (item.seedCrop) {
        selectedTool = `seed:${item.seedCrop}`;
      } else {
        selectedTool = item.tool;
      }
      await slideCardAway(card, card.parentElement, ".shop-card", 360, "up");
      renderTools();
    });
  });
});

function handleOrderPress(event) {
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
    const item = event.target.closest(".resource-item[data-crop]");
    if (item) discardResource(item);
  });
});

nextTurnButton.addEventListener("click", async () => {
  if (isActionLocked() || grid.querySelector(".is-treating") || (getRegularWaterActions() > 0 && hasWaterablePlots()) || pendingDiscardCount > 0) return;
  nextTurnButton.disabled = true;
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
});

renderTools();
announceTurn();
