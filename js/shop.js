function renderShop() {
  const refreshCount = document.querySelector(".shop-refresh-count");
  refreshCount.textContent = String(turnsUntilShopRefresh);
  refreshCount.setAttribute("aria-label", `${turnsUntilShopRefresh} turns until shop refresh`);
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

async function refreshShop() {
  const shopList = document.querySelector(".shop-list");
  const visibleCards = shopCards.filter((card) => !card.hidden);
  await Promise.all(visibleCards.map((card) => slideCardAway(card, shopList, ".shop-card", 420, "up")));

  const refreshedKeys = new Set();
  shopSlots.forEach((slot) => {
    slot.itemKey = drawShopItem(refreshedKeys);
    refreshedKeys.add(slot.itemKey);
    slot.purchased = false;
  });
  renderShop();
  animateCardLayout(shopList, ".shop-card", new Map(), new Set(shopCards.map((card) => card.dataset.layoutKey)));
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
