import { expect, test } from '@playwright/test';

test('admin test tools: practice game, play as any role, stage moments', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.getByLabel('Your name').fill('Maya');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('switch', { name: 'Admin test tools' }).click();
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: /Practice/ }).click();
  await expect(page.getByText('Players 8/20')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Deal the roles' }).click();
  await page.getByRole('button', { name: 'Hold to reveal your role' }).waitFor();
  // Everyone readies (bots do it themselves).
  const card = (await page.getByRole('button', { name: 'Hold to reveal your role' }).boundingBox())!;
  await page.mouse.move(card.x + 50, card.y + 50);
  await page.mouse.down();
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.getByRole('button', { name: "I'm ready" }).click();
  await expect(page.getByText(/alive/)).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Admin test tools' }).click();
  await page.getByRole('switch', { name: 'Pause bots' }).click();
  await page.getByRole('button', { name: 'Play as Sheriff' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'screenshots/admin-panel.png' });
  await page.getByRole('switch', { name: "Show everyone's role" }).click();
  await page.getByRole('button', { name: 'Play as Judge' }).click();
  await page.getByRole('button', { name: 'Unlock abilities + reset cooldowns' }).click();
  await page.mouse.click(200, 40); // tap above the sheet to close it
  await page.waitForTimeout(500);
  await expect(page.getByRole('button', { name: 'Call a hearing', exact: true }).first()).toBeEnabled();
  await page.screenshot({ path: 'screenshots/admin-as-judge.png' });

  // A bot winks you on demand (you're not immune as the Judge).
  await page.getByRole('button', { name: 'Admin test tools' }).click();
  await page.getByRole('button', { name: 'Wink me' }).first().click();
  await expect(page.getByText('Winked!')).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: 'screenshots/admin-wink-me.png' });
});
