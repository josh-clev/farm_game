const { test, expect } = require('@playwright/test');

async function startWithHarvester(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.turn-announcement')).toHaveText("Player 1's Turn!", { timeout: 4000 });
  await page.evaluate(async () => {
    shopSlots[0].itemKey = 'auto-harvester';
    shopSlots[0].purchased = false;
    playerCoins[1] = 100;
    updateCoinDisplay(1);
    renderShop();
    await purchaseShopItem(0);
  });
}

test('auto-harvester uses the triangle placeholder until its image asset exists', async ({ page }) => {
  await startWithHarvester(page);
  const shopCard = page.locator('.shop-card').first();
  await expect(shopCard).toHaveClass(/is-selected-item/);
  await expect(shopCard.locator('.shop-icon')).toHaveClass(/is-missing-auto-harvester/);
});

test('charged auto-harvester harvests an adjacent newly full crop for its owner and can be recharged', async ({ page }) => {
  await startWithHarvester(page);
  await page.evaluate(() => {
    const harvesterPlot = document.querySelector('.plot.player-one-plot');
    useTool(harvesterPlot);
  });
  await expect(page.locator('.auto-harvester')).toHaveCount(1);

  await page.evaluate(async () => {
    const harvester = document.querySelector('.auto-harvester');
    const harvesterPlot = harvester.closest('.plot');
    const target = [...document.querySelectorAll('.plot')].find((plot) => areAdjacentPlots(harvesterPlot, plot));
    if (target.dataset.crop) await removeCrop(target);
    const crop = crops[0];
    plantCrop(target, crop);
    target.dataset.water = String(crop.waterNeeded);
    target.dataset.turnWatered = '0';
    await triggerAutoHarvesters([target]);
  });
  await expect(page.locator('.auto-harvester')).toHaveAttribute('data-charged', 'false');
  expect(await page.evaluate(() => playerResources[1].Wheat)).toBe(1);

  await page.evaluate(async () => {
    const harvester = document.querySelector('.auto-harvester');
    await rechargeAutoHarvester(harvester);
  });
  await expect(page.locator('.auto-harvester')).toHaveAttribute('data-charged', 'true');
  expect(await page.evaluate(() => playerCoins[1])).toBe(60);
});

test('auto-harvester recharge confirmation confirms and cancels', async ({ page }) => {
  await startWithHarvester(page);
  await page.evaluate(() => {
    const harvesterPlot = document.querySelector('.plot.player-one-plot');
    useTool(harvesterPlot);
    setHarvesterCharge(document.querySelector('.auto-harvester'), false);
  });

  const harvester = page.locator('.auto-harvester');
  await harvester.click();
  await expect(page.locator('.confirmation-box')).toBeVisible();
  await page.locator('.confirmation-choice.cancel').click();
  await expect(page.locator('.confirmation-box')).toHaveCount(0);
  await expect(harvester).toHaveAttribute('data-charged', 'false');

  await harvester.click();
  await page.locator('.confirmation-choice.confirm').click();
  await expect(page.locator('.confirmation-box')).toHaveCount(0);
  await expect(harvester).toHaveAttribute('data-charged', 'true');
  expect(await page.evaluate(() => playerCoins[1])).toBe(55);
});
