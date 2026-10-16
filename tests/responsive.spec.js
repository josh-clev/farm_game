const { test, expect } = require('@playwright/test');

const viewports = [
  { name: 'iphone-390x844', width: 390, height: 844 },
  { name: 'ipad-820x1180', width: 820, height: 1180 },
  { name: 'iphone-small-375x667', width: 375, height: 667 },
  { name: 'iphone-large-430x932', width: 430, height: 932 },
  { name: 'ipad-744x1133', width: 744, height: 1133 },
  { name: 'ipad-large-1024x1366', width: 1024, height: 1366 },
  { name: 'iphone-landscape-844x390', width: 844, height: 390 },
  { name: 'ipad-landscape-1180x820', width: 1180, height: 820 },
];

for (const viewport of viewports) {
  test(`${viewport.name} fills the screen and keeps game controls visible`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');

    const menu = page.getByRole('region', { name: 'Main menu' });
    const play = page.getByRole('button', { name: 'Play', exact: true });
    await expect(menu).toBeVisible();
    await expect(play).toBeVisible();
    await expect(play).toBeInViewport();
    await play.click();

    const game = page.getByRole('main', { name: 'Farm game' });
    await expect(game).toBeVisible();
    await page.screenshot({
      path: `test-results/responsive/${viewport.name}.png`,
      fullPage: false,
      animations: 'disabled',
    });

    for (const selector of ['.shop-board', '.farm-grid', '.order-board', '.player-one-dock']) {
      const element = page.locator(selector);
      await expect(element).toBeVisible();
      await expect(element).toBeInViewport();
    }

    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
    expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.height);

  });
}
