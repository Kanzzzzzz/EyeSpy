import { expect, test } from '@playwright/test';

test('play again returns everyone to the lobby', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.getByLabel('Your name').fill('Maya');
  await page.getByRole('button', { name: 'Host', exact: true }).click();
  await page.getByRole('button', { name: /practice bots/ }).click();
  await expect(page.getByText('Players 5/20')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Deal the roles' }).click();
  await page.evaluate(`(() => { const s = window.__eyespy.getState(); const room = s.hosting.room; for (const p of room.state.players) room.dispatch(p.id, { type: 'ready' }); })()`);
  await expect(page.getByText(/alive/)).toBeVisible({ timeout: 10_000 });
  // End the round: the Sheriff arrests the Killer.
  await page.evaluate(`(() => { const room = window.__eyespy.getState().hosting.room; const r = room.state.roles; const id = (x) => Object.keys(r).find((k) => r[k].role === x); room.dispatch(id('sheriff'), { type: 'look', targetId: id('killer') }); room.dispatch(id('sheriff'), { type: 'arrest', targetId: id('killer') }); })()`);
  await expect(page.getByRole('button', { name: 'Play again' })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Play again' }).click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'screenshots/after-play-again.png' });
  console.log('ERRORS:', JSON.stringify(errors));
  await expect(page.getByText('Your game')).toBeVisible({ timeout: 5000 });
});
