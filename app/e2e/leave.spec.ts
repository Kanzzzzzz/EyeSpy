import { expect, test } from '@playwright/test';

test('a dead address never strands you on "Connecting"', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Your name').fill('Leo');
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await page.getByLabel('Host address').fill('127.0.0.1:9');
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(page.getByText('Connecting…')).toBeVisible();
  await page.getByRole('button', { name: 'Back to start' }).click();
  await expect(page.getByRole('button', { name: 'Host', exact: true })).toBeVisible();
});

test('when the host vanishes mid-round, the guest can leave', async ({ browser }) => {
  test.setTimeout(90_000);
  const context = await browser.newContext();
  const host = await context.newPage();
  await host.goto('/');
  await host.getByLabel('Your name').fill('Maya');
  await host.getByRole('button', { name: 'Host', exact: true }).click();
  await host.getByRole('button', { name: /practice bots/ }).click();

  const guest = await context.newPage();
  await guest.goto('/');
  await guest.getByLabel('Your name').fill('Leo');
  await guest.getByRole('button', { name: 'Join', exact: true }).click();
  await guest.getByRole('button', { name: /'s game/ }).click();
  await expect(guest.getByText('Waiting for the host to start')).toBeVisible({ timeout: 10_000 });

  await host.getByRole('button', { name: 'Deal the roles' }).click();
  await expect(guest.getByText('Hold to look')).toBeVisible({ timeout: 10_000 });
  await host.close(); // the host's app is gone

  await expect(guest.getByText('Reconnecting…')).toBeVisible({ timeout: 15_000 });
  await expect(guest.getByText('Lost the host')).toBeVisible({ timeout: 20_000 });
  await guest.screenshot({ path: 'screenshots/lost-host.png' });
  await guest.getByRole('alertdialog', { name: 'Lost the host' }).getByRole('button', { name: 'Leave' }).click();
  await expect(guest.getByRole('button', { name: 'Host', exact: true })).toBeVisible();
  await context.close();
});
