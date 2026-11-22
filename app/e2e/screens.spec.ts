import { expect, test, type Page } from '@playwright/test';

const shot = (page: Page, name: string) => page.screenshot({ path: `screenshots/${name}.png` });

/** Run code against the room the host tab is running (development builds only). */
async function room<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate(`(() => { const s = window.__eyespy.getState(); const room = s.hosting.room; const me = s.snap.playerId; ${fn} })()`) as Promise<T>;
}

async function hostWithBots(page: Page, bots = 4) {
  await page.goto('/');
  await page.getByLabel('Your name').fill('Maya');
  await page.getByRole('button', { name: 'Host game' }).click();
  await expect(page.getByText('Your game')).toBeVisible();
  await page.getByRole('button', { name: /practice bots/ }).click();
  if (bots > 4) await page.getByRole('button', { name: /practice bots/ }).click();
  await expect(page.getByText(`Players ${bots + 1}/20`)).toBeVisible({ timeout: 10_000 });
}

test('home, how to play, settings, join', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Host game' })).toBeVisible();
  await page.waitForTimeout(800);
  await shot(page, '01-home');
  await page.getByLabel('Choose your character').click();
  await page.waitForTimeout(300);
  await shot(page, '02-home-characters');
  await page.getByRole('button', { name: 'How to play' }).click();
  await page.waitForTimeout(400);
  await shot(page, '03-how-to-play');
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(400);
  await shot(page, '04-settings');
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByLabel('Your name').fill('Leo');
  await page.getByRole('button', { name: 'Join game' }).click();
  await page.waitForTimeout(400);
  await shot(page, '05-join');
});

test('a full round against bots', async ({ page }) => {
  await hostWithBots(page, 8);
  await page.waitForTimeout(500);
  await shot(page, '06-host-lobby');
  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(300);
  await shot(page, '07-host-settings');

  await page.getByRole('button', { name: 'Deal the roles' }).click();
  await expect(page.getByText('Hold the card to look')).toBeVisible();
  await page.waitForTimeout(400);
  await shot(page, '08-reveal-back');
  const card = page.getByRole('button', { name: 'Hold to reveal your role' });
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await shot(page, '09-reveal-face');
  await page.mouse.up();
  await page.getByRole('button', { name: "I'm ready" }).click();
  await expect(page.getByText(/alive/)).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(500);
  await shot(page, '10-play-grid');

  // Open the action sheet on the first face.
  await page.getByRole('button', { name: /choose an action/ }).first().click();
  await page.waitForTimeout(500);
  await shot(page, '11-action-sheet');
  await page.getByRole('button', { name: 'Close' }).click();

  const myRole = await room<string>(page, 'return room.state.roles[me].role;');

  // Someone raises an eyebrow at me.
  await room(page, `const other = room.state.players.find(p => p.id !== me && p.alive); room.dispatch(other.id, { type: 'raiseEyebrow', targetId: me });`);
  await page.waitForTimeout(500);
  await shot(page, '12-alert-raise');

  // If I can be winked, show the countdown.
  if (myRole !== 'killer' && myRole !== 'sheriff') {
    await room(page, `const k = Object.keys(room.state.roles).find(id => room.state.roles[id].role === 'killer'); room.dispatch(k, { type: 'wink', targetId: me });`);
    await page.waitForTimeout(1200);
    await shot(page, '13-winked-countdown');
    await page.waitForTimeout(2600);
    await shot(page, '14-death');
    await page.mouse.click(200, 400);
    await page.waitForTimeout(600);
    await shot(page, '15-ghost');
  }

  // The Snitch tip spotlight.
  await room(page, `const sn = Object.keys(room.state.roles).find(id => room.state.roles[id].role === 'snitch' && room.state.players.find(p => p.id === id).alive); if (sn) { const rs = room.state.roles[sn]; const others = room.state.players.filter(p => p.alive && p.id !== sn); for (let i = 0; i < 3; i++) { room.state = { ...room.state, roles: { ...room.state.roles, [sn]: { ...rs, raisesSent: 3 } } }; } room.dispatch(sn, { type: 'useAbility', abilityId: 'tip', targetId: others[0].id }); }`);
  await page.waitForTimeout(900);
  await shot(page, '16-snitch-tip');
  await page.waitForTimeout(5000);

  // An arrest: the Sheriff arrests the right person.
  await room(page, `const ids = Object.keys(room.state.roles); const sh = ids.find(id => room.state.roles[id].role === 'sheriff'); const k = ids.find(id => room.state.roles[id].role === 'killer'); room.state = { ...room.state, shushLockKillsRemaining: 0 }; room.dispatch(sh, { type: 'arrest', targetId: k });`);
  await page.waitForTimeout(1500);
  await shot(page, '17-arrest');
  await page.waitForTimeout(3600);
  await shot(page, '18-verdict');
  await expect(page.getByText(/wins/)).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1500);
  await shot(page, '19-game-over');
  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(300);
  await shot(page, '20-game-over-timeline');
});

test('guest lobby in a second tab', async ({ browser }) => {
  const context = await browser.newContext();
  const host = await context.newPage();
  await hostWithBots(host, 4);
  const guest = await context.newPage();
  await guest.goto('/');
  await guest.getByLabel('Your name').fill('Leo');
  await guest.getByRole('button', { name: 'Join game' }).click();
  await guest.getByRole('button', { name: /'s game/ }).click();
  await expect(guest.getByText('Waiting for the host to start')).toBeVisible({ timeout: 10_000 });
  await guest.waitForTimeout(600);
  await shot(guest, '21-guest-lobby');
  await context.close();
});
