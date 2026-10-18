const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');

for (const viewport of [
  { name: 'iphone', width: 390, height: 844 },
  { name: 'ipad', width: 820, height: 1180 },
]) {
  test(`${viewport.name} AI mode locks input and returns the turn`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    const playAi = page.getByRole('button', { name: 'Play against AI' });
    await expect(playAi).toBeInViewport();
    await page.screenshot({ path: `test-results/responsive/${viewport.name}-ai-menu.png` });
    await playAi.click();

    // Remove optional actions so this checks the turn handoff without waiting for animations.
    await page.evaluate(() => {
      turnActions.water = 0;
      shopSlots.forEach((slot) => { slot.purchased = true; });
      renderTools();
    });
    await page.screenshot({ path: `test-results/responsive/${viewport.name}-ai-game.png` });
    await expect(page.locator('.next-turn')).toBeInViewport();
    await page.locator('.next-turn').click();
    await expect(page.locator('.game')).toHaveJSProperty('inert', true);
    await expect(page.locator('.next-turn')).toBeDisabled();
    await page.screenshot({ path: `test-results/responsive/${viewport.name}-ai-turn.png` });
    await expect(page.locator('.game')).toHaveJSProperty('inert', false, { timeout: 15000 });
    await expect.poll(() => page.evaluate(() => currentPlayer)).toBe(1);
  });
}

test('training credits actions after 20 total turns and exports a model', async ({ page }) => {
  await page.goto('/?train-ai');
  await page.getByRole('button', { name: 'Play against AI' }).click();
  await page.evaluate(() => {
    FarmAi.record([FarmAi.itemKey({ tool: 'future-tool' })]);
    for (let turn = 0; turn < 19; turn += 1) FarmAi.finishTurn();
  });
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('farm-game-ai-training-v1') || 'null'));
  expect(before).toBeNull();
  await page.evaluate(() => {
    playerCoins[1] += 40;
    FarmAi.finishTurn();
  });
  const model = await page.evaluate(() => JSON.parse(localStorage.getItem('farm-game-ai-training-v1')));
  expect(model.horizon).toBe(20);
  expect(model.actions['shop:tool:future-tool']).toEqual({ count: 1, sum: 40 });
  await page.reload();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export AI training' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('ai-model.js');
  expect(readFileSync(await download.path(), 'utf8')).toContain('shop:tool:future-tool');
});

test('AI waters a crop using the shared farm rules', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play against AI' }).click();
  const result = await page.evaluate(async () => {
    const plot = [...grid.querySelectorAll('.plot[data-crop]')]
      .find((candidate) => getPlotOwner(candidate) !== 1);
    grid.querySelectorAll('.plot[data-crop]').forEach((candidate) => {
      candidate.dataset.water = candidate === plot ? '0' : candidate.dataset.waterNeeded;
      candidate.dataset.turnWatered = '0';
    });
    const before = Number(plot.dataset.water);
    currentPlayer = 2;
    FarmAi.syncLock();
    turnActions = { water: 1, cut: 0 };
    shopSlots.forEach((slot) => { slot.purchased = true; });
    applyWeatherEvent = async () => {};
    await FarmAi.playTurn();
    return { before, after: Number(plot.dataset.water), player: currentPlayer, inert: gameScene.inert };
  });
  expect(result.after).toBe(result.before + 1);
  expect(result.player).toBe(1);
  expect(result.inert).toBe(false);
});

test('AI leaves a neutral crop more than two water away when it can', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play against AI' }).click();
  const result = await page.evaluate(async () => {
    const [risky, safe] = [...grid.querySelectorAll('.plot[data-crop]')]
      .filter((plot) => getPlotOwner(plot) === null).slice(0, 2);
    grid.querySelectorAll('.plot[data-crop]').forEach((plot) => {
      plot.dataset.water = plot.dataset.waterNeeded;
      plot.dataset.turnWatered = '0';
    });
    risky.dataset.waterNeeded = '4';
    risky.dataset.water = '1'; // One water would leave two, with no action to finish it.
    safe.dataset.waterNeeded = '4';
    safe.dataset.water = '0'; // One water leaves three.
    currentPlayer = 2;
    FarmAi.syncLock();
    turnActions = { water: 1, cut: 0 };
    shopSlots.forEach((slot) => { slot.purchased = true; });
    applyWeatherEvent = async () => {};
    await FarmAi.playTurn();
    return { riskyWater: Number(risky.dataset.water), safeWater: Number(safe.dataset.water) };
  });
  expect(result).toEqual({ riskyWater: 1, safeWater: 1 });
});

test('AI finishes a neutral crop when this turn has enough water', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play against AI' }).click();
  const result = await page.evaluate(async () => {
    const target = [...grid.querySelectorAll('.plot[data-crop]')]
      .find((plot) => getPlotOwner(plot) === null);
    grid.querySelectorAll('.plot[data-crop]').forEach((plot) => {
      plot.dataset.water = plot.dataset.waterNeeded;
      plot.dataset.turnWatered = '0';
    });
    target.dataset.waterNeeded = '4';
    target.dataset.water = '2';
    currentPlayer = 2;
    FarmAi.syncLock();
    turnActions = { water: 2, cut: 0 };
    shopSlots.forEach((slot) => { slot.purchased = true; });
    applyWeatherEvent = async () => {};
    await FarmAi.playTurn();
    return Number(target.dataset.water);
  });
  expect(result).toBe(4);
});

test('AI avoids exposing a neutral crop with fertiliser', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play against AI' }).click();
  const result = await page.evaluate(async () => {
    const [risky, safe] = [...grid.querySelectorAll('.plot[data-crop]')]
      .filter((plot) => getPlotOwner(plot) === null).slice(0, 2);
    grid.querySelectorAll('.plot[data-crop]').forEach((plot) => {
      plot.dataset.water = plot.dataset.waterNeeded;
      plot.dataset.turnWatered = '0';
    });
    risky.dataset.waterNeeded = '4';
    risky.dataset.water = '0'; // Fertiliser would leave one water remaining.
    safe.dataset.waterNeeded = '3';
    safe.dataset.water = '0'; // Fertiliser finishes it.
    currentPlayer = 2;
    FarmAi.syncLock();
    turnActions = { water: 0, cut: 0 };
    shopSlots.forEach((slot) => { slot.purchased = true; });
    shopSlots[0].itemKey = 'fertiliser';
    shopSlots[0].purchased = false;
    renderShop();
    applyWeatherEvent = async () => {};
    await FarmAi.playTurn();
    return { riskyWater: Number(risky.dataset.water), safeWater: Number(safe.dataset.water) };
  });
  expect(result).toEqual({ riskyWater: 0, safeWater: 3 });
});
