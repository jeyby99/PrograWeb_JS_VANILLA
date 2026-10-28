// End-to-end tests for Page 2 (Rick and Morty + jQuery) with Playwright.
//
// Regular tests use MOCKED API responses so they are fast and do not depend on
// the internet. The data below is made up for the tests, not real data.
// The @live test does call the real API (enabled with LIVE=1).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

/* ------------------------------------------------------------------ */
/* Local files so the tests do not depend on the CDNs                */
/* ------------------------------------------------------------------ */
const ROOT = path.resolve(__dirname, '..');
function localAsset(relative, envName) {
  if (process.env[envName]) return process.env[envName];
  const file = path.join(ROOT, 'node_modules', relative);
  return fs.existsSync(file) ? file : null;
}
const JQUERY = localAsset('jquery/dist/jquery.min.js', 'JQUERY_PATH');
const BOOTSTRAP = localAsset('bootstrap/dist/css/bootstrap.min.css', 'BOOTSTRAP_CSS_PATH');

/* ------------------------------------------------------------------ */
/* Mock data with the same shape as the Rick and Morty API            */
/* ------------------------------------------------------------------ */
const API = 'https://rickandmortyapi.com/api';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

const LOCATIONS = {
  1: { id: 1, name: 'Earth (C-137)', type: 'Planet', dimension: 'Dimension C-137' },
  2: { id: 2, name: 'Citadel of Ricks', type: 'Space station', dimension: 'unknown' },
  3: { id: 3, name: 'Abadango', type: 'Cluster', dimension: 'unknown' },
};
const EPISODES = {
  1: { id: 1, name: 'Pilot', episode: 'S01E01', air_date: 'Mock date 1' },
  2: { id: 2, name: 'Lawnmower Dog', episode: 'S01E02', air_date: 'Mock date 2' },
  3: { id: 3, name: 'Anatomy Park', episode: 'S01E03', air_date: 'Mock date 3' },
  4: { id: 4, name: 'M. Night Shaym-Aliens!', episode: 'S01E04', air_date: 'Mock date 4' },
};

function mkChar(id, name, species, status, locId, epId) {
  return {
    id,
    name,
    status,
    species,
    image: `${API}/character/avatar/${id}.jpeg`,
    location: { name: LOCATIONS[locId].name, url: `${API}/location/${locId}` },
    episode: [`${API}/episode/${epId}`, `${API}/episode/${epId + 1 > 4 ? 4 : epId + 1}`],
  };
}

const CHARACTERS = [
  mkChar(1, 'Rick Sanchez', 'Human', 'Alive', 2, 1),
  mkChar(2, 'Evil Rick', 'Human', 'Dead', 2, 2),
  mkChar(3, 'Doofus Rick', 'Human', 'Alive', 3, 3),
  mkChar(4, 'Pickle Rick', 'Humanoid', 'Alive', 1, 4),
  mkChar(5, 'Rick Prime', 'Human', 'Dead', 1, 1),
  mkChar(6, 'Scary Rick', 'Human', 'unknown', 3, 2),
  mkChar(7, 'Tiny Rick', 'Human', 'Alive', 2, 3), // the seventh: must not be shown (max 6)
  mkChar(8, 'Morty Smith', 'Human', 'Alive', 1, 1),
  mkChar(9, 'Evil Morty', 'Human', 'Alive', 2, 3),
  mkChar(10, 'Mr. Meeseeks', 'Humanoid', 'Alive', 3, 4),
];

const idOf = (url) => Number(/(\d+)$/.exec(url)[1]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const cards = (page) => page.getByTestId('character-card');
const status = (page) => page.locator('#statusMessage');
const input = (page) => page.locator('#searchInput');

/**
 * Intercepts the CDNs (jQuery, Bootstrap, Tailwind) and the Rick and Morty API.
 * Returns { calls }: list of API requests in the order they arrived.
 * opts: characters, characterDelay(query), characterStatus, abortCharacter, locationStatus, episodeStatus
 */
async function setup(page, opts = {}) {
  if (!JQUERY) throw new Error('No se encontró jQuery. Ejecuta "npm install" en la raíz del proyecto.');

  await page.route('https://code.jquery.com/**', (r) =>
    r.fulfill({ path: JQUERY, contentType: 'application/javascript' })
  );
  await page.route('https://cdn.jsdelivr.net/**', (r) =>
    BOOTSTRAP
      ? r.fulfill({ path: BOOTSTRAP, contentType: 'text/css' })
      : r.fulfill({ status: 200, contentType: 'text/css', body: '' })
  );
  // Tailwind (CDN) only adds utility classes: the base layout is our own CSS.
  await page.route('https://cdn.tailwindcss.com/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
  );

  const calls = [];
  let order = 0;

  await page.route('https://rickandmortyapi.com/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (code, body) =>
      route.fulfill({
        status: code,
        headers: { 'access-control-allow-origin': '*' },
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    try {
      if (url.pathname.startsWith('/api/character/avatar/')) {
        return await route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
      }

      if (url.pathname === '/api/character/' || url.pathname === '/api/character') {
        const query = url.searchParams.get('name');
        calls.push({ kind: 'character', query, url: req.url(), type: req.resourceType(), order: ++order });
        if (opts.characterDelay) await sleep(opts.characterDelay(query));
        if (opts.abortCharacter) return await route.abort('failed');
        if (opts.characterStatus) return await json(opts.characterStatus, { error: 'mock error' });

        const list = opts.characters
          ? opts.characters
          : CHARACTERS.filter((c) => c.name.toLowerCase().includes((query || '').toLowerCase()));
        if (!list.length) return await json(404, { error: 'There is nothing here' });
        return await json(200, { info: { count: list.length, pages: 1, next: null, prev: null }, results: list });
      }

      const m = /^\/api\/(location|episode)\/([\d,]+)$/.exec(url.pathname);
      if (m) {
        const kind = m[1];
        const ids = m[2].split(',').map(Number);
        calls.push({ kind, ids, url: req.url(), type: req.resourceType(), order: ++order });
        if (opts[`${kind}Status`]) return await json(opts[`${kind}Status`], { error: 'mock error' });
        const table = kind === 'location' ? LOCATIONS : EPISODES;
        const found = ids.map((i) => table[i]).filter(Boolean);
        // Same as the real API: one id returns an object; several ids, an array
        return await json(200, ids.length === 1 ? found[0] : found);
      }

      return await json(404, { error: 'Ruta no simulada' });
    } catch {
      /* the page aborted the request (new search): ignore it */
    }
  });

  return { calls };
}

async function openPage(page, opts = {}) {
  const state = await setup(page, opts);
  await page.goto('/pagina2.html');
  return state;
}

const T0 = new Date('2026-01-01T10:00:00');
/** Installs a fake clock (to test the 4 s without waiting) and pauses it once the page has loaded. */
async function installClock(page) {
  await page.clock.install({ time: T0 });
}
async function pauseClock(page) {
  await page.clock.pauseAt(new Date(T0.getTime() + 60_000));
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */
test.describe('Page 2 - Rick and Morty', () => {
  test('on load shows 6 characters with image and description, using jQuery', async ({ page }) => {
    const s = await openPage(page);

    await expect(cards(page)).toHaveCount(6); // even though the API returns 7 for "rick"
    await expect(status(page)).toHaveAttribute('data-state', 'ok');
    expect(await page.evaluate(() => typeof window.jQuery)).toBe('function');

    const first = cards(page).first();
    await expect(first).toContainText('Rick Sanchez');
    await expect(first).toContainText('Human · Alive');
    await expect(first).toContainText('Ubicación: Citadel of Ricks (Space station)');
    await expect(first).toContainText('Primer episodio: S01E01 - Pilot');

    const img = first.locator('img');
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);

    // jQuery.ajax uses XMLHttpRequest (fetch would show up as "fetch")
    expect(s.calls.length).toBeGreaterThan(0);
    expect(s.calls.every((c) => c.type === 'xhr')).toBe(true);
  });

  test('combines and chains 3 endpoints: character -> location + episode', async ({ page }) => {
    const s = await openPage(page, { characterDelay: () => 500 });

    // The second round must NOT start before /character responds
    await page.waitForTimeout(250);
    expect(s.calls.map((c) => c.kind)).toEqual(['character']);

    await expect(cards(page)).toHaveCount(6);
    expect(s.calls.map((c) => c.kind).sort()).toEqual(['character', 'episode', 'location']);
    expect(s.calls[0].kind).toBe('character');

    // The requested ids come from the first endpoint's response
    const shown = CHARACTERS.filter((c) => /rick/i.test(c.name)).slice(0, 6);
    const num = (a, b) => a - b;
    const locIds = [...new Set(shown.map((c) => idOf(c.location.url)))].sort(num);
    const epIds = [...new Set(shown.map((c) => idOf(c.episode[0])))].sort(num);
    expect(s.calls.find((c) => c.kind === 'location').ids.sort(num)).toEqual(locIds);
    expect(s.calls.find((c) => c.kind === 'episode').ids.sort(num)).toEqual(epIds);
  });

  test('debounce: does not search before 4 s and searches at 4 s', async ({ page }) => {
    await installClock(page);
    const s = await openPage(page);
    await expect(cards(page)).toHaveCount(6);
    await pauseClock(page);
    s.calls.length = 0;

    await input(page).fill('morty');
    await expect(status(page)).toHaveAttribute('data-state', 'waiting');
    await expect(status(page)).toContainText('4 s');

    await page.clock.fastForward(3900);
    await page.waitForTimeout(300);
    expect(s.calls).toHaveLength(0); // not yet

    await page.clock.fastForward(200); // crosses the 4000 ms mark
    await page.clock.resume();
    await expect.poll(() => s.calls.filter((c) => c.kind === 'character').length).toBe(1);
    expect(s.calls[0].query).toBe('morty');
    await expect(cards(page).first()).toContainText('Morty Smith');
  });

  test('debounce: typing again restarts the wait and only 1 request is sent', async ({ page }) => {
    await installClock(page);
    const s = await openPage(page);
    await expect(cards(page)).toHaveCount(6);
    await pauseClock(page);
    s.calls.length = 0;

    await input(page).fill('mo');
    await page.clock.fastForward(3000);
    await input(page).fill('morty'); // restarts the 4 s
    await page.clock.fastForward(3000);
    await page.waitForTimeout(300);
    expect(s.calls).toHaveLength(0);

    await page.clock.fastForward(1100);
    await page.clock.resume();
    await expect(cards(page).first()).toContainText('Morty Smith');
    const searches = s.calls.filter((c) => c.kind === 'character');
    expect(searches).toHaveLength(1);
    expect(searches[0].query).toBe('morty');
  });

  test('Enter searches immediately and cancels the 4 s wait', async ({ page }) => {
    await installClock(page);
    const s = await openPage(page);
    await expect(cards(page)).toHaveCount(6);
    await pauseClock(page);
    s.calls.length = 0;

    await input(page).fill('morty');
    await input(page).press('Enter');
    await page.clock.resume();
    await expect(cards(page).first()).toContainText('Morty Smith', { timeout: 2000 });

    await page.clock.fastForward(6000); // would pass the debounce, but it was cancelled
    await page.waitForTimeout(300);
    expect(s.calls.filter((c) => c.kind === 'character')).toHaveLength(1);
  });

  test('the Search button also searches immediately', async ({ page }) => {
    await openPage(page);
    await expect(cards(page)).toHaveCount(6);
    await input(page).fill('Mr. Meeseeks');
    await page.getByRole('button', { name: 'Buscar' }).click();
    await expect(cards(page)).toHaveCount(1, { timeout: 2000 });
    await expect(cards(page).first()).toContainText('Mr. Meeseeks');
  });

  test('clearing the text restores the initial results', async ({ page }) => {
    await openPage(page);
    await input(page).fill('morty');
    await input(page).press('Enter');
    await expect(cards(page).first()).toContainText('Morty Smith');

    await input(page).fill('');
    await expect(cards(page).first()).toContainText('Rick Sanchez');
    await expect(cards(page)).toHaveCount(6);
  });

  /* ------------------------- Request validation ------------------------- */
  const invalidInputs = ['a', '<script>alert(1)</script>', 'x'.repeat(31), "rick'; DROP TABLE--", 'rick/../morty'];
  for (const bad of invalidInputs) {
    test(`validates the input and does NOT send the request: "${bad.slice(0, 22)}"`, async ({ page }) => {
      await installClock(page);
      const s = await openPage(page);
      await expect(cards(page)).toHaveCount(6);
      await pauseClock(page);
      s.calls.length = 0;

      await input(page).fill(bad);
      await expect(status(page)).toHaveAttribute('data-state', 'invalid');
      await expect(input(page)).toHaveClass(/is-invalid/);
      await expect(input(page)).toHaveAttribute('aria-invalid', 'true');

      await page.clock.fastForward(5000); // neither with debounce nor with Enter
      await input(page).press('Enter');
      await page.waitForTimeout(300);
      expect(s.calls).toHaveLength(0);
      await expect(status(page)).toHaveAttribute('data-state', 'invalid');
    });
  }

  test('a valid input is URL-encoded (spaces and dot)', async ({ page }) => {
    const s = await openPage(page);
    await expect(cards(page)).toHaveCount(6);
    s.calls.length = 0;

    await input(page).fill('  Mr.   Meeseeks ');
    await input(page).press('Enter');
    await expect(cards(page)).toHaveCount(1);
    const call = s.calls.find((c) => c.kind === 'character');
    expect(call.query).toBe('Mr. Meeseeks'); // extra spaces trimmed
    expect(call.url).toContain('name=Mr.%20Meeseeks');
    await expect(input(page)).not.toHaveClass(/is-invalid/);
  });

  /* ------------------------ Response validation ------------------------ */
  test('no matches (API 404): message and no location/episode requests', async ({ page }) => {
    const s = await openPage(page);
    await expect(cards(page)).toHaveCount(6);
    s.calls.length = 0;

    await input(page).fill('zzzz');
    await input(page).press('Enter');
    await expect(status(page)).toHaveAttribute('data-state', 'empty');
    await expect(page.getByTestId('empty-state')).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
    expect(s.calls.map((c) => c.kind)).toEqual(['character']);
  });

  test('API error 500: shows an error and the page keeps working', async ({ page }) => {
    await openPage(page, { characterStatus: 500 });
    await expect(status(page)).toHaveAttribute('data-state', 'error');
    await expect(status(page)).toContainText('500');
    await expect(page.getByTestId('empty-state')).toBeVisible();
    await expect(input(page)).toBeEnabled();
  });

  test('offline: shows an error message', async ({ page }) => {
    await openPage(page, { abortCharacter: true });
    await expect(status(page)).toHaveAttribute('data-state', 'error');
    await expect(status(page)).toContainText('Sin conexión');
  });

  test('if /episode fails, characters are still shown with a warning', async ({ page }) => {
    await openPage(page, { episodeStatus: 500 });
    await expect(cards(page)).toHaveCount(6);
    await expect(status(page)).toHaveAttribute('data-state', 'partial');
    await expect(cards(page).first()).toContainText('Ubicación: Citadel of Ricks (Space station)');
    await expect(cards(page).first()).toContainText('Primer episodio: No disponible');
  });

  test('if /location fails, uses the location already on the character', async ({ page }) => {
    await openPage(page, { locationStatus: 500 });
    await expect(cards(page)).toHaveCount(6);
    await expect(status(page)).toHaveAttribute('data-state', 'partial');
    await expect(cards(page).first()).toContainText('Ubicación: Citadel of Ricks');
    await expect(cards(page).first()).not.toContainText('Space station');
    await expect(cards(page).first()).toContainText('Primer episodio: S01E01 - Pilot');
  });

  test('drops the stale response when a newer search was made', async ({ page }) => {
    await openPage(page, { characterDelay: (q) => (q === 'rick' ? 1500 : 0) });
    // the initial search ("rick") takes 1.5 s; start another one before it ends
    await input(page).fill('morty');
    await input(page).press('Enter');
    await expect(cards(page).first()).toContainText('Morty Smith');

    await page.waitForTimeout(2000);
    await expect(cards(page).first()).toContainText('Morty Smith');
    await expect(cards(page).filter({ hasText: 'Rick Sanchez' })).toHaveCount(0);
  });

  test('API data is rendered as text (no HTML is executed)', async ({ page }) => {
    const evil = { ...CHARACTERS[0], name: '<img src=x onerror="window.__xss=1">' };
    await openPage(page, { characters: [evil] });
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first().locator('.name')).toHaveText('<img src=x onerror="window.__xss=1">');
    await expect(cards(page).first().locator('.name img')).toHaveCount(0);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  });

  /* ---------------------------- Responsive ---------------------------- */
  const sizes = [
    { w: 1280, h: 800, cols: 3, name: 'desktop' },
    { w: 820, h: 1000, cols: 2, name: 'tablet' },
    { w: 375, h: 700, cols: 1, name: 'mobile' },
  ];
  for (const { w, h, cols, name } of sizes) {
    test(`responsive ${name} (${w}px): ${cols} column(s) and no horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await openPage(page);
      await expect(cards(page)).toHaveCount(6);

      const info = await page.evaluate(() => ({
        cols: getComputedStyle(document.getElementById('resultadosGrid')).gridTemplateColumns.trim().split(/\s+/).length,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      }));
      expect(info.cols).toBe(cols);
      expect(info.overflow).toBeLessThanOrEqual(0);

      const box = await input(page).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(w);
      for (const card of await cards(page).all()) {
        const b = await card.boundingBox();
        expect(b.x + b.width).toBeLessThanOrEqual(w + 1);
      }
    });
  }
});

/* ------------------------------------------------------------------ */
/* Test against the real API (only with LIVE=1)                      */
/* ------------------------------------------------------------------ */
test('@live real Rick and Morty API with the 3 endpoints', async ({ page }) => {
  test.skip(!process.env.LIVE, 'Set LIVE=1 to test with internet and the real API');

  const apiUrls = [];
  page.on('request', (r) => {
    if (r.url().startsWith('https://rickandmortyapi.com/api/') && r.resourceType() === 'xhr') apiUrls.push(r.url());
  });

  await page.goto('/pagina2.html');
  await expect(cards(page).first()).toBeVisible({ timeout: 20_000 });
  await expect(status(page)).toHaveAttribute('data-state', /ok|partial/);

  const img = cards(page).first().locator('img');
  await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
  await expect(cards(page).first()).toContainText('Ubicación:');
  await expect(cards(page).first()).toContainText('Primer episodio:');

  const kinds = ['/character/', '/location/', '/episode/'];
  for (const k of kinds) expect(apiUrls.some((u) => u.includes(k))).toBe(true);

  await input(page).fill('morty');
  await input(page).press('Enter');
  await expect(cards(page).first()).toContainText(/morty/i, { timeout: 20_000 });
});
