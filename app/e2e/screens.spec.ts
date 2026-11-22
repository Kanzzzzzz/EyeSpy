import { expect, test, type Page } from '@playwright/test';

const shot = (page: Page, name: string) => page.screenshot({ path: `screenshots/${name}.png` });

/** Run code against the room the host tab is running (development builds only). */
async function room<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate(
    `(() => { const s = window.__eyespy.getState(); const room = s.hosting.room; const me = s.snap.playerId; const roles = room.state.roles; const idOf = (r) => Object.keys(roles).find((id) => roles[id].role === r && room.state.players.find((p) => p.id === id).alive); ${fn} })()`,
  ) as Promise<T>;
}

async function hostWithBots(page: Page, clicks = 1) {
  await page.goto('/');
  await page.getByLabel('Your name').fill('Maya');
  await page.getByRole('button', { name: 'Host', exact: true }).click();
  await expect(page.getByText('Your game')).toBeVisible();
  for (let i = 0; i < clicks; i++) await page.getByRole('button', { name: /practice bots/ }).click();
  await expect(page.getByText(`Players ${clicks * 4 + 1}/20`)).toBeVisible({ timeout: 10_000 });
}

test('home, how to play, settings, join', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Host', exact: true })).toBeVisible();
  await page.waitForTimeout(900);
  await shot(page, '01-home');
  await page.getByLabel('Choose your character').click();
  await page.waitForTimeout(400);
  await shot(page, '02-home-characters');
  await page.getByRole('button', { name: 'How to play' }).click();
  await page.waitForTimeout(500);
  await shot(page, '03-how-to-play');
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(500);
  await shot(page, '04-settings');
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByLabel('Your name').fill('Leo');
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await page.waitForTimeout(500);
  await shot(page, '05-join');
});

test('a full round against bots', async ({ page }) => {
  test.setTimeout(180_000);
  await hostWithBots(page, 2); // 9 players: the Judge is dealt
  await page.waitForTimeout(600);
  await shot(page, '06-host-lobby');
  await page.mouse.wheel(0, 2400);
  await page.waitForTimeout(400);
  await shot(page, '07-host-settings');

  // Staged moments switch gaze instantly, so turn the gaze lock off for this run.
  await room(page, `room.dispatch(me, { type: 'configure', settings: { lookLockMs: 0 } });`);
  await page.getByRole('button', { name: 'Deal the roles' }).click();
  await expect(page.getByText('Hold to look')).toBeVisible();
  // Make this phone a Citizen so every moment (including being winked) can be shown.
  await room(page, `const c = Object.keys(roles).find((id) => roles[id].role === 'citizen' && id !== me); if (roles[me].role !== 'citizen' && c) { room.state = { ...room.state, roles: { ...roles, [me]: roles[c], [c]: roles[me] } }; } room.dispatch(me, { type: 'pickCharacter', characterId: room.state.roles[me].character });`);
  // Freeze the bots so each moment can be staged.
  await page.evaluate(`window.__eyespy.getState().bots.forEach((b) => b.pause())`);
  await page.waitForTimeout(500);
  await shot(page, '08-reveal-back');
  const card = page.getByRole('button', { name: 'Hold to reveal your role' });
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await shot(page, '09-reveal-face');
  await page.mouse.up();
  await page.getByRole('button', { name: "I'm ready" }).click();
  await room(page, `for (const p of room.state.players) if (p.id !== me) room.dispatch(p.id, { type: 'ready' });`);
  await expect(page.getByText(/alive/)).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(600);
  await shot(page, '11-play-panels');

  const myRole = await room<string>(page, 'return roles[me].role;');
  const meId = await room<string>(page, 'return me;');
  const killer = await room<string>(page, `return idOf('killer');`);
  const killerName = await room<string>(page, `return room.state.players.find((p) => p.id === idOf('killer')).name;`);
  const others = await room<string[]>(page, `return room.state.players.filter((p) => p.id !== me && p.id !== idOf('killer') && roles[p.id].role === 'citizen').map((p) => p.id);`);

  // Open the Killer's panel: looking away first...
  if (myRole !== 'killer') {
    await page.getByRole('button', { name: `${killerName}: look at them` }).click();
    await page.waitForTimeout(700);
    await shot(page, '12-panel-looking-away');
    // ...then they look back: eye contact.
    await room(page, `room.dispatch(idOf('killer'), { type: 'look', targetId: me });`);
    await page.waitForTimeout(900);
    await shot(page, '13-panel-eye-contact');
    // The Killer winks at someone else while you watch: you're a witness.
    const victim = others[0]!;
    await room(page, `room.dispatch('${victim}', { type: 'look', targetId: idOf('killer') }); room.dispatch(idOf('killer'), { type: 'look', targetId: '${victim}' }); room.dispatch(idOf('killer'), { type: 'wink', targetId: '${victim}' });`);
    await page.waitForTimeout(450);
    await shot(page, '14-witness');
    await page.waitForTimeout(3500);
  }

  // A raise from the Snitch, with eye contact.
  await room(page, `const sn = idOf('snitch'); if (sn && sn !== me) { room.dispatch(sn, { type: 'look', targetId: me }); }`);

  // The Judge calls a hearing.
  const judge = await room<string | undefined>(page, `return idOf('judge');`);
  if (judge && judge !== meId && myRole !== 'judge') {
    await room(page, `const j = idOf('judge'); room.state = { ...room.state, roles: { ...roles, [j]: { ...roles[j], raisesSent: 3 } } }; room.dispatch(j, { type: 'useAbility', abilityId: 'hearing' });`);
    await page.waitForTimeout(600);
    await shot(page, '15a-court-eye');
    await page.waitForTimeout(800);
    await shot(page, '15b-court-title');
    await page.waitForTimeout(500);
    await shot(page, '15c-court-gavel');
    await page.waitForTimeout(1600);
    await shot(page, '15-hearing');
    const target = await room<string>(page, `return idOf('shush') ?? idOf('snitch');`);
    const targetName = await room<string>(page, `return room.state.players.find((p) => p.id === '${target}').name;`);
    await page.getByRole('button', { name: new RegExp(`^Vote out ${targetName}`) }).click();
    await page.waitForTimeout(400);
    await shot(page, '16-hearing-voted');
    await room(page, `for (const p of room.state.players) if (p.alive && p.id !== me && p.id !== '${target}') room.dispatch(p.id, { type: 'vote', targetId: '${target}' }); room.dispatch('${target}', { type: 'vote', targetId: me === '${target}' ? idOf('killer') : me });`);
    await page.waitForTimeout(900);
    await shot(page, '17-hearing-verdict');
    await page.waitForTimeout(4200);
  }

  // Being winked: the countdown, then the Killer's finisher.
  if (myRole !== 'killer' && myRole !== 'sheriff') {
    await room(page, `room.dispatch(idOf('killer'), { type: 'look', targetId: me }); room.dispatch(me, { type: 'look', targetId: idOf('killer') }); room.state = { ...room.state, roles: { ...roles, [idOf('killer')]: { ...roles[idOf('killer')], lastWinkAt: null, character: 'killer.shuten' } } }; room.dispatch(idOf('killer'), { type: 'wink', targetId: me });`);
    await page.waitForTimeout(1300);
    await shot(page, '18-winked-countdown');
    await page.waitForTimeout(2300);
    await shot(page, '19-finisher-realm-1');
    await page.waitForTimeout(700);
    await shot(page, '20-finisher-realm-2');
    await page.waitForTimeout(700);
    await shot(page, '21-finisher-realm-3');
    await page.waitForTimeout(3000);
    await shot(page, '22-death-card');
    await page.mouse.click(200, 400);
    await page.waitForTimeout(800);
    await shot(page, '23-ghost');
  }

  // The Sheriff arrests the Killer.
  await room(page, `const sh = idOf('sheriff'); room.state = { ...room.state, shushLockKillsRemaining: 0 }; room.dispatch(sh, { type: 'look', targetId: idOf('killer') }); room.dispatch(sh, { type: 'arrest', targetId: idOf('killer') });`);
  await page.waitForTimeout(1600);
  await shot(page, '24-arrest');
  await page.waitForTimeout(3700);
  await shot(page, '25-verdict');
  await expect(page.getByText(/wins/i)).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1600);
  await shot(page, '26-game-over');
  await page.mouse.wheel(0, 2400);
  await page.waitForTimeout(400);
  await shot(page, '27-game-over-timeline');
  void killer;
});

test('guest lobby in a second tab', async ({ browser }) => {
  const context = await browser.newContext();
  const host = await context.newPage();
  await hostWithBots(host, 1);
  const guest = await context.newPage();
  await guest.goto('/');
  await guest.getByLabel('Your name').fill('Leo');
  await guest.getByRole('button', { name: 'Join', exact: true }).click();
  await guest.getByRole('button', { name: /'s game/ }).click();
  await expect(guest.getByText('Waiting for the host to start')).toBeVisible({ timeout: 10_000 });
  await guest.waitForTimeout(700);
  await shot(guest, '28-guest-lobby');
  await context.close();
});
