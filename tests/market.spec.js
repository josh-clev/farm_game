const { test, expect } = require('@playwright/test');

async function showMarket(page) {
  await page.evaluate(() => {
    shopSlots[0].itemKey = 'market';
    shopSlots[0].purchased = false;
    playerCoins[1] = 100;
    updateCoinDisplay(1);
    renderShop();
  });
  return page.locator('.shop-card').first();
}

for (const viewport of [
  { name: 'iphone-390x844', width: 390, height: 844 },
  { name: 'ipad-820x1180', width: 820, height: 1180 },
]) {
  test(`${viewport.name} shows the orange Market upgrade and missing-art placeholder`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.locator('.turn-announcement')).toHaveText("Player 1's Turn!", { timeout: 4000 });
    const market = await showMarket(page);

    await expect(market).toHaveAttribute('aria-label', 'Market, costs 40 coins');
    await expect(market).toHaveClass(/is-upgrade/);
    await expect(market.locator('.shop-icon')).toHaveClass(/is-missing-graphic/);
    await expect(market.locator('.shop-icon')).toHaveCSS('background-image', 'none');
    await expect(market).toBeInViewport();
    expect(await market.evaluate((card) => getComputedStyle(card).backgroundColor)).toBe('rgb(255, 210, 155)');
    await page.screenshot({
      path: `test-results/responsive/${viewport.name}-market.png`,
      fullPage: false,
      animations: 'disabled',
    });
  });
}

test('upgrades occupy slots, cannot be bought twice, and can be replaced', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.turn-announcement')).toHaveText("Player 1's Turn!", { timeout: 4000 });
  await showMarket(page);

  await page.evaluate(async () => { await purchaseShopItem(0); });
  await expect(page.locator('.player-one-upgrade-slots .upgrade-slot').first()).toHaveAttribute('aria-label', 'Market');

  await page.evaluate(() => {
    shopSlots[0].itemKey = 'market';
    shopSlots[0].purchased = false;
    renderShop();
  });
  await expect(page.locator('.shop-card').first()).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('.shop-card').first()).toHaveAttribute('aria-label', 'Market, already owned');

  await page.evaluate(async () => {
    shopSlots[0].itemKey = 'water-upgrade';
    shopSlots[0].purchased = false;
    await purchaseShopItem(0);
    shopSlots[0].itemKey = 'harvest-upgrade';
    shopSlots[0].purchased = false;
    playerCoins[1] = 100;
    renderShop();
    await purchaseShopItem(0);
  });
  await expect(page.locator('.turn-announcement')).toHaveText('Choose an upgrade to replace');
  await expect(page.locator('.player-one-upgrade-slots .is-replacement-option')).toHaveCount(2);
  await page.locator('.player-one-upgrade-slots .upgrade-slot').first().click();
  await expect(page.locator('.player-one-upgrade-slots .upgrade-slot').first()).toHaveAttribute('aria-label', 'Harvest Upgrade');
  expect(await page.evaluate(() => ({ slots: playerUpgradeSlots[1], market: playerUpgrades[1].market }))).toEqual({
    slots: ['harvest-upgrade', 'water-upgrade'],
    market: 0,
  });
});

test('Market pays half the discarded resource value, rounded down', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.turn-announcement')).toHaveText("Player 1's Turn!", { timeout: 4000 });
  await showMarket(page);
  await page.evaluate(async () => {
    await purchaseShopItem(0);
    playerResources[1].Wheat = maxResources(1) + 1;
    await updateResourcePool(1, 'Wheat');
    beginDiscardSelection();
    await discardResource(document.querySelector('.resource-item[data-player="1"][data-crop="Wheat"]'));
  });

  expect(await page.evaluate(() => ({ coins: playerCoins[1], wheat: playerResources[1].Wheat }))).toEqual({
    coins: 65,
    wheat: 5,
  });
});
