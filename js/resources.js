function updateCoinDisplay(player) {
  const coinTotal = document.querySelector(`[data-player-coins="${player}"]`);
  coinTotal.textContent = String(playerCoins[player]);
  coinTotal.parentElement.setAttribute("aria-label", `Player ${player} coins: ${playerCoins[player]}`);
}

function updateRenownDisplay(player) {
  const renownTotal = document.querySelector(`[data-player-renown="${player}"]`);
  renownTotal.textContent = String(playerRenown[player]);
  renownTotal.parentElement.setAttribute("aria-label", `Player ${player} renown: ${playerRenown[player]}`);
}


function buildResourcePools() {
  document.querySelectorAll(".resource-pool").forEach((pool, poolIndex) => {
    const player = poolIndex + 1;
    const resourceList = pool.querySelector(".resource-list");
    const capacity = document.createElement("div");
    capacity.className = "resource-capacity";
    capacity.dataset.player = String(player);
    resourceList.before(capacity);

    const coinItem = document.createElement("div");
    coinItem.className = "resource-item coin-item";
    coinItem.setAttribute("aria-label", `Player ${player} coins: ${playerCoins[player]}`);
    coinItem.innerHTML = `<span class="resource-icon coin-icon" aria-hidden="true"></span><strong class="resource-count" data-player-coins="${player}">${playerCoins[player]}</strong>`;
    resourceList.append(coinItem);

    const renownItem = document.createElement("div");
    renownItem.className = "resource-item renown-item";
    renownItem.setAttribute("aria-label", `Player ${player} renown: ${playerRenown[player]}`);
    renownItem.innerHTML = `<span class="resource-icon renown-icon" aria-hidden="true"></span><strong class="resource-count" data-player-renown="${player}">${playerRenown[player]}</strong>`;
    resourceList.append(renownItem);

    crops.forEach((crop) => {
      const item = document.createElement("div");
      item.className = "resource-item";
      item.hidden = true;
      item.dataset.player = String(player);
      item.dataset.crop = crop.name;
      item.setAttribute("role", "button");
      item.tabIndex = -1;
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
    updateResourceCapacity(player);
  });
}

function maxResources(player) {
  return BASE_MAX_RESOURCES + playerUpgrades[player].storage;
}

function updateResourceCapacity(player) {
  const capacity = document.querySelector(`.resource-capacity[data-player="${player}"]`);
  if (!capacity) return;
  capacity.textContent = `${totalResources(player)} / ${maxResources(player)}`;
  capacity.setAttribute("aria-label", `Player ${player} resources: ${totalResources(player)} of ${maxResources(player)}`);
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

  item.getAnimations().forEach((animation) => animation.cancel());

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
  updateResourceCapacity(player);
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
    await item.animate(
      [
        { opacity: 0, transform: "translateY(10px) scale(0.6)" },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ],
      { duration: 260, easing: "cubic-bezier(0.2, 0.9, 0.3, 1.25)", fill: "both" },
    ).finished;
    item.getAnimations().forEach((animation) => animation.cancel());
  }
}

function totalResources(player) {
  return Object.values(playerResources[player]).reduce((total, amount) => total + amount, 0);
}

function updateDiscardSelection() {
  document.querySelectorAll(".resource-item[data-crop]").forEach((item) => {
    const isCurrentPlayer = Number(item.dataset.player) === currentPlayer;
    const hasResource = playerResources[currentPlayer][item.dataset.crop] > 0;
    item.classList.toggle("is-discard-option", pendingDiscardCount > 0 && isCurrentPlayer && hasResource);
    item.tabIndex = pendingDiscardCount > 0 && isCurrentPlayer && hasResource ? 0 : -1;
    item.setAttribute("aria-disabled", String(!(pendingDiscardCount > 0 && isCurrentPlayer && hasResource)));
  });
}

function beginDiscardSelection() {
  pendingDiscardCount = Math.max(0, totalResources(currentPlayer) - maxResources(currentPlayer));
  if (pendingDiscardCount === 0) return;
  turnAnnouncement.textContent = `Choose ${pendingDiscardCount} resource${pendingDiscardCount === 1 ? "" : "s"} to discard`;
  turnAnnouncement.classList.add("is-discarding");
  updateDiscardSelection();
}

async function discardResource(item) {
  if (discardAnimationRunning || pendingDiscardCount === 0 || Number(item.dataset.player) !== currentPlayer) return;
  const cropName = item.dataset.crop;
  if (playerResources[currentPlayer][cropName] === 0) return;
  discardAnimationRunning = true;
  FarmAi.record(FarmAi.actionKeys("discard", cropName));
  const marketSlotIndex = playerUpgradeSlots[currentPlayer].findIndex((itemKey) => itemKey === "market");
  const marketSlot = marketSlotIndex >= 0
    ? document.querySelector(`.upgrade-slots.player-${currentPlayer === 1 ? "one" : "two"}-upgrade-slots .upgrade-slot:nth-child(${marketSlotIndex + 1})`)
    : null;
  const crop = crops.find((entry) => entry.name === cropName);
  const marketPayment = marketSlot && crop ? Math.floor(crop.marketValue / 2) : 0;
  try {
    if (marketPayment) {
      await animateFlyingIcon(item, marketSlot, item.querySelector(".resource-icon"));
    }
    playerResources[currentPlayer][cropName] -= 1;
    pendingDiscardCount -= 1;
    await updateResourcePool(currentPlayer, cropName);
    if (marketPayment) {
      const coinItem = document.querySelector(`.resource-pool.${currentPlayer === 1 ? "player-one" : "player-two"}-pool .coin-item`);
      await animateFlyingIcon(marketSlot, coinItem, coinItem.querySelector(".coin-icon"));
      playerCoins[currentPlayer] += marketPayment;
      earnedCoins[currentPlayer] += marketPayment;
      soldResources[currentPlayer][cropName] += 1;
      updateCoinDisplay(currentPlayer);
    }
    if (pendingDiscardCount === 0) {
      turnAnnouncement.classList.remove("is-discarding");
      announceTurn();
      updateDiscardSelection();
    } else {
      turnAnnouncement.textContent = `Choose ${pendingDiscardCount} resource${pendingDiscardCount === 1 ? "" : "s"} to discard`;
      updateDiscardSelection();
    }
  } finally {
    discardAnimationRunning = false;
  }
  renderTools();
  renderOrders();
}
