import { test } from '@playwright/test';

test('character gallery', async ({ page }) => {
  await page.goto('/?gallery');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'screenshots/gallery.png', fullPage: true });
  await page.getByTestId('killer.shuten').screenshot({ path: 'screenshots/char-shuten.png' });
  await page.getByTestId('judge.tenbin').screenshot({ path: 'screenshots/char-tenbin.png' });
});
