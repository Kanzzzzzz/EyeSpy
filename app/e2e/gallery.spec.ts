import { test } from '@playwright/test';

test('character gallery', async ({ page }) => {
  await page.goto('/?gallery');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'screenshots/gallery.png', fullPage: true });
});
