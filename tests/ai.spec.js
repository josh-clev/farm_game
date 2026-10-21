const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

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

for (const viewport of [
  { name: 'iphone', width: 390, height: 844 },
  { name: 'ipad', width: 820, height: 1180 },
]) {
  test(`${viewport.name} training controls are accessible in the game UI`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    const trainAi = page.getByRole('button', { name: 'Train AI' });
    await expect(trainAi).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Import AI training' })).toBeInViewport();
    await page.screenshot({ path: `test-results/responsive/${viewport.name}-training-menu.png` });
    await trainAi.click();
    await expect(page.locator('.export-ai-game-button')).toBeInViewport();
    await page.screenshot({ path: `test-results/responsive/${viewport.name}-training-game.png` });
  });
}

test('training keeps human and AI outcomes separate after 20 total turns', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Train AI' }).click();
  await page.evaluate(() => {
    FarmAi.record([FarmAi.itemKey({ tool: 'future-tool' })]);
    currentPlayer = 2;
    FarmAi.record(['water']);
    for (let turn = 0; turn < 19; turn += 1) FarmAi.finishTurn();
  });
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('farm-game-ai-training-v2') || 'null'));
  expect(before).toBeNull();
  await page.evaluate(() => {
    playerCoins[1] += 40;
    playerCoins[2] -= 10;
    FarmAi.finishTurn();
  });
  const model = await page.evaluate(() => JSON.parse(localStorage.getItem('farm-game-ai-training-v2')));
  expect(model.horizon).toBe(20);
  const source = Object.values(model.sources)[0];
  expect(source.human.actions['shop:tool:future-tool']).toEqual({ count: 1, sum: 40 });
  expect(source.ai.actions.water).toEqual({ count: 1, sum: -10 });
  const [inGameDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.export-ai-game-button').click(),
  ]);
  expect(inGameDownload.suggestedFilename()).toBe('ai-model.js');
  await page.reload();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export AI training' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('ai-model.js');
  expect(readFileSync(await download.path(), 'utf8')).toContain('shop:tool:future-tool');
});

test('training can start directly from the index file', async ({ page }) => {
  await page.goto(pathToFileURL(resolve(__dirname, '../index.html')).href);
  await page.getByRole('button', { name: 'Train AI' }).click();
  expect(await page.evaluate(() => FarmAi.training)).toBe(true);
  await expect(page.locator('.export-ai-game-button')).toBeVisible();
  const persisted = await page.evaluate(() => {
    FarmAi.record(['water']);
    for (let turn = 0; turn < 20; turn += 1) FarmAi.finishTurn();
    try { return Boolean(localStorage.getItem('farm-game-ai-training-v2')); } catch (_) { return false; }
  });
  expect(persisted).toBe(true);
});

test('multiple exports merge and later snapshots do not double count', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const stats = (count, sum, action) => ({
    total: { count, sum },
    actions: count ? { [action]: { count, sum } } : {},
  });
  const exportFile = (name, sourceId, human, ai) => ({
    name,
    mimeType: 'text/javascript',
    buffer: Buffer.from(`window.FarmAiModel = ${JSON.stringify({
      version: 2, horizon: 20, sources: { [sourceId]: { human, ai } },
    })};`),
  });
  const first = exportFile('first.js', 'source-a', stats(1, 20, 'water'), stats(0, 0));
  const second = exportFile('second.js', 'source-b', stats(0, 0), stats(1, 30, 'harvest'));
  await page.locator('.import-ai-input').setInputFiles([first, second, first]);
  await expect(page.locator('.training-status')).toContainText('Merged 2 training files');
  await expect(page.getByRole('button', { name: 'Export AI training' })).toBeInViewport();
  await page.screenshot({ path: 'test-results/responsive/iphone-training-merged-menu.png' });
  const later = exportFile('later.js', 'source-a', stats(2, 45, 'water'), stats(0, 0));
  await page.locator('.import-ai-input').setInputFiles([later, second]);
  await expect(page.locator('.training-status')).toContainText('Merged 1 training file');
  const model = await page.evaluate(() => JSON.parse(localStorage.getItem('farm-game-ai-training-v2')));
  expect(Object.keys(model.sources)).toHaveLength(2);
  expect(model.sources['source-a'].human.total).toEqual({ count: 2, sum: 45 });
  expect(model.sources['source-b'].ai.total).toEqual({ count: 1, sum: 30 });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export AI training' }).click(),
  ]);
  const exported = readFileSync(await download.path(), 'utf8');
  expect(exported).toContain('source-a');
  expect(exported).toContain('source-b');
});

test('older human training exports can be imported', async ({ page }) => {
  await page.goto('/');
  const legacy = {
    version: 1,
    horizon: 20,
    total: { count: 2, sum: 18 },
    actions: { water: { count: 2, sum: 18 } },
  };
  const file = {
    name: 'old-ai-model.js',
    mimeType: 'text/javascript',
    buffer: Buffer.from(`window.FarmAiModel = ${JSON.stringify(legacy)};`),
  };
  await page.locator('.import-ai-input').setInputFiles([file, file]);
  await expect(page.locator('.training-status')).toContainText('Merged 1 training file');
  const model = await page.evaluate(() => JSON.parse(localStorage.getItem('farm-game-ai-training-v2')));
  const source = Object.values(model.sources)[0];
  expect(source.human.actions.water).toEqual({ count: 2, sum: 18 });
  expect(source.ai.total.count).toBe(0);
  await page.reload();
  await page.getByRole('button', { name: 'Play against AI' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate(() => FarmAi.exportModel()),
  ]);
  expect(readFileSync(await download.path(), 'utf8')).toContain('legacy-');
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

test('AI farm actions contribute to its own training results', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Train AI' }).click();
  const result = await page.evaluate(async () => {
    const target = [...grid.querySelectorAll('.plot[data-crop]')]
      .find((plot) => getPlotOwner(plot) === null);
    grid.querySelectorAll('.plot[data-crop]').forEach((plot) => {
      plot.dataset.water = plot === target ? '0' : plot.dataset.waterNeeded;
      plot.dataset.turnWatered = '0';
    });
    currentPlayer = 2;
    FarmAi.syncLock();
    turnActions = { water: 1, cut: 0 };
    shopSlots.forEach((slot) => { slot.purchased = true; });
    applyWeatherEvent = async () => {};
    await FarmAi.playTurn();
    playerCoins[2] += 7;
    for (let turn = 0; turn < 19; turn += 1) FarmAi.finishTurn();
    const model = JSON.parse(localStorage.getItem('farm-game-ai-training-v2'));
    return Object.values(model.sources)[0];
  });
  expect(result.ai.actions.water).toEqual({ count: 1, sum: 7 });
  expect(result.human.total.count).toBe(0);
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
