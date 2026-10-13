const grid = document.querySelector(".farm-grid");
const nextTurnButton = document.querySelector(".next-turn");
const turnAnnouncement = document.querySelector(".turn-announcement");
const turnBadge = document.querySelector(".turn-badge");
const toolButtons = [...document.querySelectorAll(".tool-button")];
const waterIcons = document.querySelector(".water-icons");
const cutIcons = document.querySelector(".cut-icons");
const actionDock = document.querySelector(".action-dock");
const orderList = document.querySelector(".order-list");
const shopCards = [...document.querySelectorAll(".shop-card")];
const { shopItems, crops } = window.FarmGameData;
const {
  activateOnPress,
  animateCardLayout,
  animateCropAppearance,
  animateFlyingIcon,
  animateTreatment,
  captureCardPositions,
  cropSlug,
  isActionLocked,
  loadGraphic,
  openConfirmation,
  playPoofAt,
  slideCardAway,
} = window.FarmGameUi;
let currentPlayer = 1;
let selectedTool = null;
let turnActions = { water: 3, cut: 1 };
const playerUpgrades = {
  1: { water: 0, cut: 0 },
  2: { water: 0, cut: 0 },
};

const shopItemKeys = Object.keys(shopItems);
function drawShopItem(excludedKeys = new Set()) {
  const choices = shopItemKeys.filter((itemKey) => !excludedKeys.has(itemKey));
  return choices[Math.floor(Math.random() * choices.length)];
}

const initialShopKeys = new Set();
const shopSlots = shopCards.map(() => {
  const itemKey = drawShopItem(initialShopKeys);
  initialShopKeys.add(itemKey);
  return { itemKey, purchased: false };
});

const playerResources = {
  1: Object.fromEntries(crops.map((crop) => [crop.name, 0])),
  2: Object.fromEntries(crops.map((crop) => [crop.name, 0])),
};
const playerCoins = { 1: 10, 2: 10 };
let orders = [];
let spawnTimerPlot = null;
let nextOrderId = 1;

function updateCoinDisplay(player) {
  const coinTotal = document.querySelector(`[data-player-coins="${player}"]`);
  coinTotal.textContent = String(playerCoins[player]);
  coinTotal.parentElement.setAttribute("aria-label", `Player ${player} coins: ${playerCoins[player]}`);
}


function renderShop() {
  shopCards.forEach((card, slotIndex) => {
    const slot = shopSlots[slotIndex];
    const item = shopItems[slot.itemKey];
    card.dataset.item = slot.itemKey;
    card.dataset.layoutKey = String(slotIndex);
    if (card.dataset.renderedItem !== slot.itemKey) {
      card.innerHTML = `<span class="shop-icon" aria-hidden="true"></span><span class="shop-details"><span class="shop-price"><img class="coin-icon" src="assets/coin_icon.png" alt="">${item.price}</span></span>`;
      card.dataset.renderedItem = slot.itemKey;
      loadGraphic(item.asset, (source) => card.querySelector(".shop-icon").style.backgroundImage = `url("${source}")`);
    }
    const unavailable = slot.purchased || playerCoins[currentPlayer] < item.price;
    card.hidden = slot.purchased;
    card.classList.toggle("is-disabled", unavailable);
    card.setAttribute("aria-disabled", String(unavailable));
    card.tabIndex = unavailable ? -1 : 0;
    const selectedItemTool = item.seedCrop ? `seed:${item.seedCrop}` : item.tool;
    card.classList.toggle("is-selected-item", selectedTool === selectedItemTool);
    card.setAttribute("aria-pressed", String(selectedTool === selectedItemTool));
    card.setAttribute(
      "aria-label",
      slot.purchased ? `${item.name}, sold out until next turn` : `${item.name}, costs ${item.price} coins`,
    );
  });
}

function replacePurchasedShopItems() {
  const visibleKeys = new Set(shopSlots.filter((slot) => !slot.purchased).map((slot) => slot.itemKey));
  shopSlots.forEach((slot) => {
    if (!slot.purchased) return;
    slot.itemKey = drawShopItem(new Set([slot.itemKey, ...visibleKeys]));
    visibleKeys.add(slot.itemKey);
    slot.purchased = false;
  });
}

function buildResourcePools() {
  document.querySelectorAll(".resource-pool").forEach((pool, poolIndex) => {
    const player = poolIndex + 1;
    const resourceList = pool.querySelector(".resource-list");

    const coinItem = document.createElement("div");
    coinItem.className = "resource-item coin-item";
    coinItem.setAttribute("aria-label", `Player ${player} coins: ${playerCoins[player]}`);
    coinItem.innerHTML = `<span class="resource-icon coin-icon" aria-hidden="true"></span><strong class="resource-count" data-player-coins="${player}">${playerCoins[player]}</strong>`;
    resourceList.append(coinItem);

    crops.forEach((crop) => {
      const item = document.createElement("div");
      item.className = "resource-item";
      item.hidden = true;
      item.setAttribute("aria-label", `${crop.name}: 0`);

      const icon = document.createElement("span");
      icon.className = "resource-icon";
      icon.textContent = crop.icon;
      icon.setAttribute("aria-hidden", "true");

      const count = document.createElement("strong");
      count.className = "resource-count";
      count.dataset.player = String(player);
      count.dataset.crop = crop.name;
      count.textContent = "0";

      item.append(icon, count);
      resourceList.append(item);

      loadGraphic(`${cropSlug(crop.name)}_icon`, (source) => {
        icon.textContent = "";
        icon.style.backgroundImage = `url("${source}")`;
      });
    });
  });
}

async function updateResourcePool(player, cropName) {
  const count = document.querySelector(
    `.resource-count[data-player="${player}"][data-crop="${cropName}"]`,
  );
  if (!count) return;

  const item = count.parentElement;
  const pool = item.closest(".resource-pool");
  const previousPoolBounds = pool.getBoundingClientRect();
  const shouldShow = playerResources[player][cropName] > 0;

  if (!shouldShow && !item.hidden) {
    await item.animate(
      [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0, transform: "scale(0.45)" },
      ],
      { duration: 180, easing: "ease-in", fill: "forwards" },
    ).finished;
  }

  count.textContent = String(playerResources[player][cropName]);
  item.hidden = !shouldShow;
  item.setAttribute(
    "aria-label",
    `${cropName}: ${playerResources[player][cropName]}`,
  );

  const nextPoolBounds = pool.getBoundingClientRect();
  const offsetX = previousPoolBounds.left - nextPoolBounds.left;
  const offsetY = previousPoolBounds.top - nextPoolBounds.top;
  const scaleX = previousPoolBounds.width / nextPoolBounds.width;
  const scaleY = previousPoolBounds.height / nextPoolBounds.height;
  pool.animate(
    [
      { transform: `translate(${offsetX}px, ${offsetY}px) scale(${scaleX}, ${scaleY})` },
      { transform: "translate(0, 0) scale(1, 1)" },
    ],
    { duration: 280, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  );

  if (shouldShow) {
    item.animate(
      [
        { opacity: 0, transform: "translateY(10px) scale(0.6)" },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ],
      { duration: 260, easing: "cubic-bezier(0.2, 0.9, 0.3, 1.25)" },
    );
  }
}

async function animateHarvest(plot, cropName) {
  const cropElement = plot.querySelector(".crop");
  if (!cropElement) return;

  const cropBounds = cropElement.getBoundingClientRect();
  const targetPool = document.querySelector(`.resource-pool:nth-of-type(${currentPlayer === 1 ? 1 : 2})`);
  const targetBounds = targetPool.getBoundingClientRect();
  const targetIcon = document.querySelector(
    `.resource-count[data-player="${currentPlayer}"][data-crop="${cropName}"]`,
  )?.parentElement.querySelector(".resource-icon");
  const flyer = cropElement.cloneNode(true);
  flyer.className = "harvest-flyer";
  flyer.style.left = `${cropBounds.left}px`;
  flyer.style.top = `${cropBounds.top}px`;
  flyer.style.width = `${cropBounds.width}px`;
  flyer.style.height = `${cropBounds.height}px`;
  if (targetIcon) {
    flyer.textContent = targetIcon.textContent;
    flyer.style.backgroundImage = getComputedStyle(targetIcon).backgroundImage;
  }
  playPoofAt(cropBounds);
  document.body.append(flyer);
  cropElement.remove();

  const destinationX = targetBounds.left + targetBounds.width / 2 - cropBounds.width / 2;
  const destinationY = targetBounds.top + targetBounds.height / 2 - cropBounds.height / 2;
  const deltaX = destinationX - cropBounds.left;
  const deltaY = destinationY - cropBounds.top;

  await flyer.animate(
    [
      { transform: "translate(0, 0) scale(0.65)", opacity: 0, offset: 0 },
      { transform: "translate(0, -32px) scale(1.15)", opacity: 1, offset: 0.16 },
      { transform: "translate(0, -34px) scale(1.15)", opacity: 1, offset: 0.31 },
      { transform: `translate(${deltaX}px, ${deltaY}px) scale(0.55)`, opacity: 1, offset: 0.88 },
      { transform: `translate(${deltaX}px, ${deltaY}px) scale(0.25)`, opacity: 0, offset: 1 },
    ],
    { duration: 1748, easing: "cubic-bezier(0.45, 0, 0.25, 1)", fill: "forwards" },
  ).finished;

  flyer.remove();
}

function createOrder() {
  const ingredientCount = Math.random() < 0.55 ? 1 : 2;
  const availableCrops = [...crops];
  const items = [];

  for (let index = 0; index < ingredientCount; index += 1) {
    const cropIndex = Math.floor(Math.random() * availableCrops.length);
    const [crop] = availableCrops.splice(cropIndex, 1);
    items.push({ crop: crop.name, amount: 1 + Math.floor(Math.random() * 3) });
  }

  const fullReward = items.reduce((total, item) => {
    const crop = crops.find((candidate) => candidate.name === item.crop);
    return total + item.amount * crop.marketValue;
  }, 0);
  const reward = Math.max(1, Math.round(fullReward * 0.25));
  return { id: nextOrderId++, items, reward, filled: false };
}

function canFillOrder(order) {
  return order.items.every(
    (item) => playerResources[currentPlayer][item.crop] >= item.amount,
  );
}

function renderOrders() {
  orderList.replaceChildren(
    ...orders.map((order, orderIndex) => {
      const button = document.createElement("div");
      button.className = "order-card";
      button.dataset.order = String(orderIndex);
      button.dataset.layoutKey = String(order.id);
      button.setAttribute("role", "button");
      button.tabIndex = canFillOrder(order) ? 0 : -1;
      button.classList.toggle("is-disabled", !canFillOrder(order));
      button.setAttribute("aria-disabled", String(!canFillOrder(order)));

      const ingredients = order.items
        .map((item) => {
          const crop = crops.find((candidate) => candidate.name === item.crop);
          return `<span class="order-item"><span class="order-icon" data-crop="${cropSlug(crop.name)}" aria-hidden="true">${crop.icon}</span>${item.amount}</span>`;
        })
        .join("");
      button.innerHTML = `<span class="order-items">${ingredients}</span><strong class="order-reward"><span class="coin-icon" aria-hidden="true"></span>${order.reward}</strong>`;
      button.setAttribute(
        "aria-label",
        `${order.items.map((item) => `${item.amount} ${item.crop}`).join(" and ")}, reward ${order.reward} coins`,
      );
      button.querySelectorAll(".order-icon").forEach((icon) => {
        loadGraphic(`${icon.dataset.crop}_icon`, (source) => {
          icon.textContent = "";
          icon.style.backgroundImage = `url("${source}")`;
        });
      });
      return button;
    }),
  );
}

async function fillOrder(orderIndex) {
  const order = orders[orderIndex];
  if (!order || order.filled || !canFillOrder(order)) return;
  const card = orderList.querySelector(`[data-order="${orderIndex}"]`);
  if (!card) return;

  for (const item of order.items) {
    const sourceIcon = document.querySelector(
      `.resource-count[data-player="${currentPlayer}"][data-crop="${item.crop}"]`,
    )?.parentElement.querySelector(".resource-icon");
    const targetIcon = card.querySelector(`.order-icon[data-crop="${cropSlug(item.crop)}"]`);
    for (let amount = 0; amount < item.amount; amount += 1) {
      await animateFlyingIcon(sourceIcon, targetIcon, sourceIcon, 1120);
      playerResources[currentPlayer][item.crop] -= 1;
      await updateResourcePool(currentPlayer, item.crop);
      targetIcon.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.35)" }, { transform: "scale(1)" }],
        { duration: 440, easing: "ease-out" },
      );
    }
  }

  const rewardIcon = card.querySelector(".order-reward .coin-icon");
  const coinTarget = document.querySelector(`[data-player-coins="${currentPlayer}"]`)
    ?.parentElement.querySelector(".coin-icon");
  await animateFlyingIcon(rewardIcon, coinTarget, coinTarget, 1120);
  playerCoins[currentPlayer] += order.reward;
  updateCoinDisplay(currentPlayer);
  order.filled = true;
  renderShop();
  await slideCardAway(card, orderList, ".order-card", 720);
}

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

for (let index = 0; index < 25; index += 1) {
  const plot = document.createElement("button");
  const row = Math.floor(index / 5);
  const column = index % 5;
  plot.className = "plot";
  plot.type = "button";
  plot.dataset.plot = String(index);
  plot.setAttribute("aria-label", `Farm plot ${index + 1}`);

  if (row >= 3 && column <= 1) {
    plot.classList.add("player-one-plot");
    plot.setAttribute("aria-label", `Farm plot ${index + 1}, Player 1 territory`);
  } else if (row >= 3 && column >= 3) {
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

function pickRandomCrop() {
  const totalWeight = crops.reduce((total, crop) => total + crop.spawnWeight, 0);
  let roll = Math.random() * totalWeight;

  for (const crop of crops) {
    roll -= crop.spawnWeight;
    if (roll < 0) return crop;
  }

  return crops[0];
}

function getPlotOwner(plot) {
  if (plot.classList.contains("player-one-plot")) return 1;
  if (plot.classList.contains("player-two-plot")) return 2;
  return null;
}

function canInteractWithPlot(plot, action) {
  return action === "weed-killer" || getPlotOwner(plot) === null || getPlotOwner(plot) === currentPlayer;
}

function canPlantSeed(plot, crop) {
  return !plot.dataset.crop
    && !plot.querySelector(".spawn-timer")
    && canInteractWithPlot(plot, "plant")
    && Boolean(crop);
}

function plantCrop(plot, crop) {
  const cropIcon = document.createElement("span");
  cropIcon.className = "crop";
  cropIcon.textContent = crop.icon;
  cropIcon.setAttribute("aria-hidden", "true");

  loadGraphic(crop.asset, (source) => {
    cropIcon.textContent = "";
    cropIcon.style.backgroundImage = `url("${source}")`;
  });

  plot.dataset.crop = crop.name;
  plot.dataset.water = "0";
  plot.dataset.turnWatered = "0";
  plot.dataset.waterNeeded = String(crop.waterNeeded);
  plot.append(cropIcon);
  const progress = document.createElement("span");
  progress.className = "crop-progress";
  progress.setAttribute("aria-hidden", "true");
  plot.append(progress);
  plot.setAttribute("aria-label", `${plot.getAttribute("aria-label")}, growing ${crop.name}`);
  updateCropProgress(plot);
  animateCropAppearance(cropIcon);
}

function queueNextCropSpawn() {
  const availablePlots = neutralPlots.filter(
    (plot) => !plot.dataset.crop && !plot.querySelector(".spawn-timer"),
  );
  if (availablePlots.length === 0) return;

  spawnTimerPlot = availablePlots[Math.floor(Math.random() * availablePlots.length)];
  const timer = document.createElement("span");
  timer.className = "spawn-timer";
  timer.textContent = "3";
  timer.dataset.turns = "3";
  timer.setAttribute("aria-hidden", "true");
  spawnTimerPlot.append(timer);
  spawnTimerPlot.setAttribute(
    "aria-label",
    `${spawnTimerPlot.getAttribute("aria-label")}, crop arriving in 3 turns`,
  );
}

function advanceCropSpawnTimer() {
  const timer = spawnTimerPlot?.querySelector(".spawn-timer");
  if (!timer) {
    queueNextCropSpawn();
    return;
  }

  const turnsRemaining = Number(timer.dataset.turns) - 1;
  if (turnsRemaining > 0) {
    timer.dataset.turns = String(turnsRemaining);
    timer.textContent = String(turnsRemaining);
    spawnTimerPlot.setAttribute(
      "aria-label",
      `${spawnTimerPlot.getAttribute("aria-label").replace(/, crop arriving in \d+ turns$/, "")}, crop arriving in ${turnsRemaining} turns`,
    );
    return;
  }

  timer.remove();
  const plot = spawnTimerPlot;
  spawnTimerPlot = null;
  plot.setAttribute(
    "aria-label",
    plot.getAttribute("aria-label").replace(/, crop arriving in \d+ turns$/, ""),
  );
  plantCrop(plot, pickRandomCrop());
  queueNextCropSpawn();
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

function updateCropProgress(plot) {
  const progress = plot.querySelector(".crop-progress");
  if (!progress) return;

  const water = Number(plot.dataset.water);
  const waterNeeded = Number(plot.dataset.waterNeeded);
  progress.dataset.label = `${water}/${waterNeeded}`;
  progress.style.setProperty("--water-progress", String(water / waterNeeded));
  plot.classList.toggle("fully-grown", water >= waterNeeded);
}

function canUseTool(plot, tool) {
  if (!plot.dataset.crop) return false;
  if (!canInteractWithPlot(plot, tool)) return false;

  if (tool === "weed-killer" || tool === "fertiliser") return true;

  const water = Number(plot.dataset.water);
  const waterNeeded = Number(plot.dataset.waterNeeded);
  const turnWatered = Number(plot.dataset.turnWatered || 0);
  return tool === "water"
    ? water < waterNeeded && turnWatered < 2
    : water >= waterNeeded;
}

function updateEligiblePlots() {
  grid.querySelectorAll(".plot").forEach((plot) => {
    const selectedCrop = selectedTool?.startsWith("seed:")
      ? crops.find((crop) => crop.name === selectedTool.slice(5))
      : null;
    const hasUse = selectedCrop
      ? canPlantSeed(plot, selectedCrop)
      : selectedTool === "weed-killer" || selectedTool === "fertiliser"
      ? true
      : turnActions[selectedTool] > 0;
    plot.classList.toggle(
      "can-use-tool",
      Boolean(selectedTool && hasUse && (selectedCrop ? true : canUseTool(plot, selectedTool))),
    );
  });
}

function makeToolIcon(type) {
  const icon = document.createElement("span");
  icon.className = `tool-icon ${type}-icon`;
  icon.textContent = type === "water" ? "🪣" : "✂️";
  return icon;
}

function renderTools() {
  waterIcons.replaceChildren(...Array.from({ length: turnActions.water }, () => makeToolIcon("water")));
  cutIcons.replaceChildren(...Array.from({ length: turnActions.cut }, () => makeToolIcon("cut")));

  toolButtons.forEach((button) => {
    const tool = button.dataset.tool;
    const isSelected = selectedTool === tool;
    button.classList.toggle("is-selected-tool", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
    button.disabled = turnActions[tool] === 0;
    button.setAttribute("aria-label", `${tool === "water" ? "Water" : "Harvest"}: ${turnActions[tool]} remaining`);
  });

  const mustUseWater = turnActions.water > 0;
  nextTurnButton.disabled = mustUseWater;
  nextTurnButton.setAttribute(
    "aria-label",
    mustUseWater ? `Next Turn: use all ${turnActions.water} water actions first` : "Next Turn",
  );

  updateEligiblePlots();
  renderShop();
}

async function removeCrop(plot) {
  const cropElement = plot.querySelector(".crop");
  if (!cropElement) return;

  const cropBounds = cropElement.getBoundingClientRect();
  await cropElement.animate(
    [
      { transform: "translateY(-2%) rotate(0) scale(1)", opacity: 1 },
      { transform: "translateY(12%) rotate(18deg) scale(0)", opacity: 0 },
    ],
    { duration: 360, easing: "cubic-bezier(0.55, 0, 0.8, 0.35)" },
  ).finished;
  playPoofAt(cropBounds);
  cropElement.remove();
  plot.querySelector(".crop-progress")?.remove();
  delete plot.dataset.crop;
  delete plot.dataset.water;
  delete plot.dataset.turnWatered;
  delete plot.dataset.waterNeeded;
  plot.classList.remove("fully-grown");
  plot.setAttribute("aria-label", `Farm plot ${Number(plot.dataset.plot) + 1}`);
}

async function useTool(plot) {
  if (plot.classList.contains("is-treating")) return;
  plot.classList.add("is-treating");
  try {
  const selectedCrop = selectedTool?.startsWith("seed:")
    ? crops.find((crop) => crop.name === selectedTool.slice(5))
    : null;
  if (selectedCrop) {
    if (!canPlantSeed(plot, selectedCrop)) return;
    plantCrop(plot, selectedCrop);
    selectedTool = null;
  } else if (selectedTool === "water") {
    plot.dataset.water = String(Number(plot.dataset.water) + 1);
    plot.dataset.turnWatered = String(Number(plot.dataset.turnWatered || 0) + 1);
    turnActions.water -= 1;
    updateCropProgress(plot);
    renderTools();
    await animateTreatment(plot, "water");
  } else if (selectedTool === "cut") {
    const harvestedCrop = plot.dataset.crop;
    if (plot.classList.contains("is-harvesting")) return;
    plot.classList.add("is-harvesting");
    turnActions.cut -= 1;
    selectedTool = null;
    renderTools();
    await animateHarvest(plot, harvestedCrop);
    plot.querySelector(".crop-progress")?.remove();
    delete plot.dataset.crop;
    delete plot.dataset.water;
    delete plot.dataset.waterNeeded;
    plot.classList.remove("fully-grown");
    playerResources[currentPlayer][harvestedCrop] += 1;
    await updateResourcePool(currentPlayer, harvestedCrop);
    renderOrders();
    plot.setAttribute("aria-label", `Farm plot ${Number(plot.dataset.plot) + 1}`);
    plot.classList.remove("is-harvesting");
  } else if (selectedTool === "weed-killer") {
    selectedTool = null;
    renderTools();
    await animateTreatment(plot, "weed-killer");
    await removeCrop(plot);
  } else if (selectedTool === "fertiliser") {
    plot.dataset.water = String(Number(plot.dataset.water) + 3);
    selectedTool = null;
    updateCropProgress(plot);
    await animateTreatment(plot, "fertiliser");
  }

  if (selectedTool && turnActions[selectedTool] === 0) selectedTool = null;
  renderTools();
  } finally {
    plot.classList.remove("is-treating");
  }
}

toolButtons.forEach((button) => {
  button.addEventListener("click", () => {
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
        turnActions[item.upgrade] += 1;
      } else if (item.seedCrop) {
        selectedTool = `seed:${item.seedCrop}`;
      } else {
        selectedTool = item.tool;
      }
      await slideCardAway(card, card.parentElement, ".shop-card");
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
  openConfirmation(order, `Sell this order for ${orderData.reward} coins?`, () => fillOrder(orderIndex));
}

orderList.addEventListener("click", handleOrderPress);
orderList.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  handleOrderPress(event);
});

function announceTurn() {
  const playerName = `Player ${currentPlayer}`;
  turnAnnouncement.textContent = `${playerName}'s Turn!`;
  turnAnnouncement.classList.toggle("player-one", currentPlayer === 1);
  turnAnnouncement.classList.toggle("player-two", currentPlayer === 2);
  turnBadge.classList.toggle("player-one-badge", currentPlayer === 1);
  turnBadge.classList.toggle("player-two-badge", currentPlayer === 2);
  turnBadge.setAttribute("aria-label", `${playerName}'s turn`);
  actionDock.classList.toggle("player-one-dock", currentPlayer === 1);
  actionDock.classList.toggle("player-two-dock", currentPlayer === 2);

  turnAnnouncement.classList.remove("is-playing");
  void turnAnnouncement.offsetWidth;
  turnAnnouncement.classList.add("is-playing");
}

nextTurnButton.addEventListener("click", () => {
  if (isActionLocked() || turnActions.water > 0) return;
  document.querySelectorAll(".confirmation-box").forEach((box) => box.remove());
  const previousOrderPositions = captureCardPositions(orderList, ".order-card");
  const previousShopPositions = captureCardPositions(document.querySelector(".shop-list"), ".shop-card");
  orders = orders.map((order) => (order.filled ? createOrder() : order));
  const enteringOrderIds = new Set(
    orders.map((order) => String(order.id)).filter((id) => !previousOrderPositions.has(id)),
  );
  const enteringShopKeys = new Set(
    shopSlots
      .map((slot, index) => (slot.purchased ? String(index) : null))
      .filter(Boolean),
  );
  replacePurchasedShopItems();
  advanceCropSpawnTimer();
  grid.querySelectorAll(".plot").forEach((plot) => {
    if (plot.dataset.crop) plot.dataset.turnWatered = "0";
  });
  currentPlayer = currentPlayer === 1 ? 2 : 1;
  selectedTool = null;
  turnActions = {
    water: 3 + playerUpgrades[currentPlayer].water,
    cut: 1 + playerUpgrades[currentPlayer].cut,
  };
  renderTools();
  renderOrders();
  renderShop();
  requestAnimationFrame(() => {
    animateCardLayout(orderList, ".order-card", previousOrderPositions, enteringOrderIds);
    animateCardLayout(document.querySelector(".shop-list"), ".shop-card", previousShopPositions, enteringShopKeys);
  });
  announceTurn();
});

renderTools();
announceTurn();
