function createOrder(rewardType = "coins") {
  const minimumValue = currentRound >= 5 ? 65 : currentRound === 4 ? 50 : currentRound === 3 ? 35 : currentRound === 2 ? 30 : 0;
  const maximumValue = currentRound === 1 ? 80 : currentRound === 2 ? 90 : currentRound === 3 ? 120 : currentRound === 4 ? 160 : Infinity;
  let items = [];
  let fullReward = 0;
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const ingredientCount = Math.random() < 0.55 ? 1 : 2;
    const availableCrops = [...crops];
    const candidateItems = [];
    for (let index = 0; index < ingredientCount; index += 1) {
      const cropIndex = Math.floor(Math.random() * availableCrops.length);
      const [crop] = availableCrops.splice(cropIndex, 1);
      candidateItems.push({ crop: crop.name, amount: 1 + Math.floor(Math.random() * 3) });
    }
    const candidateValue = candidateItems.reduce((total, item) => {
      const crop = crops.find((candidate) => candidate.name === item.crop);
      return total + item.amount * crop.marketValue;
    }, 0);
    if (candidateValue >= minimumValue && candidateValue <= maximumValue) {
      items = candidateItems;
      fullReward = candidateValue;
      break;
    }
  }
  if (items.length === 0) {
    items = [{ crop: crops[0].name, amount: Math.max(1, Math.ceil(minimumValue / crops[0].marketValue)) }];
    fullReward = items[0].amount * crops[0].marketValue;
  }
  const resourceCount = items.reduce((total, item) => total + item.amount, 0);
  const rewardRate = resourceCount >= 5 ? 0.25 : resourceCount >= 4 ? 0.15 : resourceCount >= 3 ? 0.10 : 0;
  const reward = Math.ceil(fullReward * (1 + rewardRate));
  const coinReward = rewardType === "renown" ? 0 : rewardType === "mixed" ? Math.floor(reward / 2) : reward;
  const renownReward = rewardType === "coins" ? 0 : Math.floor((reward - coinReward) / 5);
  return { id: nextOrderId++, items, coinReward, renownReward, rewardType, filled: false };
}

function canFillOrder(order) {
  return order.items.every(
    (item) => playerResources[currentPlayer][item.crop] >= item.amount,
  );
}

function renderOrders() {
  orderRoundCount.textContent = String(currentRound);
  orderRoundCount.setAttribute("aria-label", `Round ${currentRound}`);
  const refreshCount = document.querySelector(".order-refresh-count");
  refreshCount.textContent = String(turnsUntilOrderRefresh);
  refreshCount.setAttribute("aria-label", `${turnsUntilOrderRefresh} turns until order refresh`);
  refreshCount.classList.toggle("is-warning", turnsUntilOrderRefresh <= 5);
  orderList.replaceChildren(
    ...orders.flatMap((order, orderIndex) => {
      if (order.filled) return [];
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
      const rewards = [
        order.coinReward > 0 ? `<span class="order-reward-part"><span class="coin-icon" aria-hidden="true"></span>${order.coinReward}</span>` : "",
        order.renownReward > 0 ? `<span class="order-reward-part"><span class="renown-icon" aria-hidden="true"></span>${order.renownReward}</span>` : "",
      ].join("");
      button.innerHTML = `<span class="order-items">${ingredients}</span><strong class="order-reward">${rewards}</strong>`;
      button.setAttribute(
        "aria-label",
        `${order.items.map((item) => `${item.amount} ${item.crop}`).join(" and ")}, reward ${order.coinReward} coins and ${order.renownReward} renown`,
      );
      button.querySelectorAll(".order-icon").forEach((icon) => {
        loadGraphic(`${icon.dataset.crop}_icon`, (source) => {
          icon.textContent = "";
          icon.style.backgroundImage = `url("${source}")`;
        });
      });
      return [button];
    }),
  );
}

function roundRewardTypes(round) {
  if (round === 1) return ["coins", "coins", "coins", "mixed", "mixed"];
  const types = round === 2
    ? ["coins", "coins", "coins", "mixed", "renown"]
    : ["coins", "coins", "renown", "mixed", "mixed"];
  for (let index = types.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [types[index], types[swapIndex]] = [types[swapIndex], types[index]];
  }
  return types;
}

function createRoundOrders(round) {
  const rewardTypes = roundRewardTypes(round);
  let generatedOrders = [];
  for (let attempt = 0; attempt < 100; attempt += 1) {
    generatedOrders = rewardTypes.map((type) => createOrder(type));
    const requestedCrops = new Set(generatedOrders.flatMap((order) => order.items.map((item) => item.crop)));
    if (requestedCrops.size >= 3) return generatedOrders;
  }
  return generatedOrders;
}

function setDebugRound(round) {
  currentRound = Math.max(1, Math.floor(Number(round) || 1));
  orders = createRoundOrders(currentRound);
  renderOrders();
}

function closeRoundDebugMenu() {
  document.querySelector(".round-debug-menu")?.remove();
  orderRoundCount.setAttribute("aria-expanded", "false");
}

function openRoundDebugMenu() {
  if (document.querySelector(".round-debug-menu")) {
    closeRoundDebugMenu();
    return;
  }
  const menu = document.createElement("div");
  menu.className = "round-debug-menu";
  menu.setAttribute("role", "dialog");
  menu.setAttribute("aria-label", "Round debug menu");
  menu.innerHTML = `<label for="round-debug-input">Round</label><input id="round-debug-input" type="number" min="1" step="1" value="${currentRound}">`;
  orderRoundCount.parentElement.append(menu);
  orderRoundCount.setAttribute("aria-expanded", "true");
  const input = menu.querySelector("input");
  input.focus();
  input.select();
  input.addEventListener("change", () => setDebugRound(input.value));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      setDebugRound(input.value);
      closeRoundDebugMenu();
    }
    if (event.key === "Escape") closeRoundDebugMenu();
  });
}

async function refreshOrders() {
  orderList.style.minHeight = "";
  await Promise.all(
    [...orderList.querySelectorAll(".order-card")].map((card) =>
      slideCardAway(card, orderList, ".order-card", 420, "down"),
    ),
  );
  currentRound += 1;
  orders = createRoundOrders(currentRound);
  renderOrders();
  await announceRound();
  animateCardLayout(orderList, ".order-card", new Map(), new Set(orders.map((order) => String(order.id))));
}

async function fillOrder(orderIndex) {
  const order = orders[orderIndex];
  if (!order || order.filled || !canFillOrder(order)) return;
  const card = orderList.querySelector(`[data-order="${orderIndex}"]`);
  if (!card) return;
  FarmAi.record(["fill-order", ...order.items.map((item) => `fill-order:${item.crop}`)]);

  const runTransactionAnimation = async (animation) => {
    try {
      await animation;
    } catch (error) {
      // Animations are cosmetic and must never leave a sale partially applied.
      if (error?.name !== "AbortError") console.error(error);
    }
  };

  for (const item of order.items) {
    const sourceIcon = document.querySelector(
      `.resource-count[data-player="${currentPlayer}"][data-crop="${item.crop}"]`,
    )?.parentElement.querySelector(".resource-icon");
    const targetIcon = card.querySelector(`.order-icon[data-crop="${cropSlug(item.crop)}"]`);
    await Promise.all(Array.from({ length: item.amount }, (_, amount) => new Promise((resolve) => {
      window.setTimeout(async () => {
        await runTransactionAnimation(animateFlyingIcon(sourceIcon, targetIcon, sourceIcon, 1120));
        resolve();
      }, amount * 180);
    })));
    playerResources[currentPlayer][item.crop] -= item.amount;
    soldResources[currentPlayer][item.crop] += item.amount;
    await updateResourcePool(currentPlayer, item.crop);
    targetIcon.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.35)" }, { transform: "scale(1)" }],
      { duration: 440, easing: "ease-out" },
    );
  }

  for (const [resource, amount, orderIconClass, playerAttr, poolIconClass, updateDisplay] of [
    ["coins", order.coinReward, ".coin-icon", "data-player-coins", ".coin-icon", updateCoinDisplay],
    ["renown", order.renownReward, ".renown-icon", "data-player-renown", ".renown-icon", updateRenownDisplay],
  ]) {
    if (!amount) continue;
    const rewardIcon = card.querySelector(`.order-reward ${orderIconClass}`);
    const target = document.querySelector(`[${playerAttr}="${currentPlayer}"]`)
      ?.parentElement.querySelector(poolIconClass);
    await runTransactionAnimation(animateFlyingIcon(rewardIcon, target, target, 1120));
    if (resource === "coins") playerCoins[currentPlayer] += amount;
    else playerRenown[currentPlayer] += amount;
    if (resource === "coins") earnedCoins[currentPlayer] += amount;
    updateDisplay(currentPlayer);
    if (playerRenown[currentPlayer] >= 50) showVictory(currentPlayer);
  }
  order.filled = true;
  renderShop();
  if (orders.every((candidate) => candidate.filled)) {
    orderList.style.minHeight = `${orderList.offsetHeight}px`;
  }
  await slideCardAway(card, orderList, ".order-card", 720, "down");
}
