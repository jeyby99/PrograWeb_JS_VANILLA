// Pruebas end-to-end de la Página 2 (Rick and Morty + jQuery) con Playwright.
//
// Las pruebas normales usan RESPUESTAS SIMULADAS (mock) de la API para que sean rápidas y
// no dependan de internet. Los datos de abajo son inventados para la prueba, no datos reales.
// La prueba marcada @live sí llama a la API real (se activa con LIVE=1).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

/* ------------------------------------------------------------------ */
/* Archivos locales para no depender de los CDN en las pruebas         */
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
/* Datos simulados con la misma forma que la API de Rick and Morty     */
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
  mkChar(7, 'Tiny Rick', 'Human', 'Alive', 2, 3), // el séptimo: no debe mostrarse (máximo 6)
  mkChar(8, 'Morty Smith', 'Human', 'Alive', 1, 1),
  mkChar(9, 'Evil Morty', 'Human', 'Alive', 2, 3),
  mkChar(10, 'Mr. Meeseeks', 'Humanoid', 'Alive', 3, 4),
];

const idOf = (url) => Number(/(\d+)$/.exec(url)[1]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* Ayudantes                                                           */
/* ------------------------------------------------------------------ */
const cards = (page) => page.getByTestId('character-card');
const status = (page) => page.locator('#statusMessage');
const input = (page) => page.locator('#searchInput');

/**
 * Intercepta los CDN (jQuery, Bootstrap, Tailwind) y la API de Rick and Morty.
 * Devuelve { calls }: lista de peticiones a la API en el orden en que llegaron.
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
  // Tailwind (CDN) solo aporta clases utilitarias: la maquetación base es CSS propio.
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
        // Igual que la API real: un solo id devuelve un objeto; varios ids, un arreglo
        return await json(200, ids.length === 1 ? found[0] : found);
      }

      return await json(404, { error: 'Ruta no simulada' });
    } catch {
      /* la página canceló la petición (búsqueda nueva): se ignora */
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
/** Instala un reloj falso (para probar los 4 s sin esperar) y lo pausa cuando la página ya cargó. */
async function installClock(page) {
  await page.clock.install({ time: T0 });
}
async function pauseClock(page) {
  await page.clock.pauseAt(new Date(T0.getTime() + 60_000));
}

/* ------------------------------------------------------------------ */
/* Pruebas                                                             */
/* ------------------------------------------------------------------ */
test.describe('Página 2 - Rick and Morty', () => {
  test('al abrir muestra 6 personajes con imagen y descripción, usando jQuery', async ({ page }) => {
    const s = await openPage(page);

    await expect(cards(page)).toHaveCount(6); // aunque la API devuelve 7 con "rick"
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

    // jQuery.ajax usa XMLHttpRequest (fetch aparecería como "fetch")
    expect(s.calls.length).toBeGreaterThan(0);
    expect(s.calls.every((c) => c.type === 'xhr')).toBe(true);
  });

  test('combina 3 endpoints y los encadena: character -> location + episode', async ({ page }) => {
    const s = await openPage(page, { characterDelay: () => 500 });

    // La segunda ronda NO puede salir antes de que responda /character
    await page.waitForTimeout(250);
    expect(s.calls.map((c) => c.kind)).toEqual(['character']);

    await expect(cards(page)).toHaveCount(6);
    expect(s.calls.map((c) => c.kind).sort()).toEqual(['character', 'episode', 'location']);
    expect(s.calls[0].kind).toBe('character');

    // Los ids pedidos salen de la respuesta del primer endpoint
    const shown = CHARACTERS.filter((c) => /rick/i.test(c.name)).slice(0, 6);
    const num = (a, b) => a - b;
    const locIds = [...new Set(shown.map((c) => idOf(c.location.url)))].sort(num);
    const epIds = [...new Set(shown.map((c) => idOf(c.episode[0])))].sort(num);
    expect(s.calls.find((c) => c.kind === 'location').ids.sort(num)).toEqual(locIds);
    expect(s.calls.find((c) => c.kind === 'episode').ids.sort(num)).toEqual(epIds);
  });

  test('debounce: no busca antes de 4 s y busca a los 4 s', async ({ page }) => {
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
    expect(s.calls).toHaveLength(0); // todavía no

    await page.clock.fastForward(200); // cruza los 4000 ms
    await page.clock.resume();
    await expect.poll(() => s.calls.filter((c) => c.kind === 'character').length).toBe(1);
    expect(s.calls[0].query).toBe('morty');
    await expect(cards(page).first()).toContainText('Morty Smith');
  });

  test('debounce: seguir escribiendo reinicia la espera y solo se hace 1 petición', async ({ page }) => {
    await installClock(page);
    const s = await openPage(page);
    await expect(cards(page)).toHaveCount(6);
    await pauseClock(page);
    s.calls.length = 0;

    await input(page).fill('mo');
    await page.clock.fastForward(3000);
    await input(page).fill('morty'); // reinicia los 4 s
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

  test('Enter busca de inmediato y cancela la espera de 4 s', async ({ page }) => {
    await installClock(page);
    const s = await openPage(page);
    await expect(cards(page)).toHaveCount(6);
    await pauseClock(page);
    s.calls.length = 0;

    await input(page).fill('morty');
    await input(page).press('Enter');
    await page.clock.resume();
    await expect(cards(page).first()).toContainText('Morty Smith', { timeout: 2000 });

    await page.clock.fastForward(6000); // pasaría el debounce, pero fue cancelado
    await page.waitForTimeout(300);
    expect(s.calls.filter((c) => c.kind === 'character')).toHaveLength(1);
  });

  test('el botón Buscar también busca de inmediato', async ({ page }) => {
    await openPage(page);
    await expect(cards(page)).toHaveCount(6);
    await input(page).fill('Mr. Meeseeks');
    await page.getByRole('button', { name: 'Buscar' }).click();
    await expect(cards(page)).toHaveCount(1, { timeout: 2000 });
    await expect(cards(page).first()).toContainText('Mr. Meeseeks');
  });

  test('al borrar el texto vuelven los resultados iniciales', async ({ page }) => {
    await openPage(page);
    await input(page).fill('morty');
    await input(page).press('Enter');
    await expect(cards(page).first()).toContainText('Morty Smith');

    await input(page).fill('');
    await expect(cards(page).first()).toContainText('Rick Sanchez');
    await expect(cards(page)).toHaveCount(6);
  });

  /* ----------------------- Validación del request ----------------------- */
  const invalidInputs = ['a', '<script>alert(1)</script>', 'x'.repeat(31), "rick'; DROP TABLE--", 'rick/../morty'];
  for (const bad of invalidInputs) {
    test(`valida la entrada y NO envía la petición: "${bad.slice(0, 22)}"`, async ({ page }) => {
      await installClock(page);
      const s = await openPage(page);
      await expect(cards(page)).toHaveCount(6);
      await pauseClock(page);
      s.calls.length = 0;

      await input(page).fill(bad);
      await expect(status(page)).toHaveAttribute('data-state', 'invalid');
      await expect(input(page)).toHaveClass(/is-invalid/);
      await expect(input(page)).toHaveAttribute('aria-invalid', 'true');

      await page.clock.fastForward(5000); // ni con debounce ni con Enter
      await input(page).press('Enter');
      await page.waitForTimeout(300);
      expect(s.calls).toHaveLength(0);
      await expect(status(page)).toHaveAttribute('data-state', 'invalid');
    });
  }

  test('una entrada válida se codifica en la URL (espacios y punto)', async ({ page }) => {
    const s = await openPage(page);
    await expect(cards(page)).toHaveCount(6);
    s.calls.length = 0;

    await input(page).fill('  Mr.   Meeseeks ');
    await input(page).press('Enter');
    await expect(cards(page)).toHaveCount(1);
    const call = s.calls.find((c) => c.kind === 'character');
    expect(call.query).toBe('Mr. Meeseeks'); // espacios sobrantes limpiados
    expect(call.url).toContain('name=Mr.%20Meeseeks');
    await expect(input(page)).not.toHaveClass(/is-invalid/);
  });

  /* --------------------- Validación de la respuesta --------------------- */
  test('sin coincidencias (404 de la API): mensaje y no se piden location/episode', async ({ page }) => {
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

  test('error 500 de la API: muestra error y la página sigue funcionando', async ({ page }) => {
    await openPage(page, { characterStatus: 500 });
    await expect(status(page)).toHaveAttribute('data-state', 'error');
    await expect(status(page)).toContainText('500');
    await expect(page.getByTestId('empty-state')).toBeVisible();
    await expect(input(page)).toBeEnabled();
  });

  test('sin conexión: muestra mensaje de error', async ({ page }) => {
    await openPage(page, { abortCharacter: true });
    await expect(status(page)).toHaveAttribute('data-state', 'error');
    await expect(status(page)).toContainText('Sin conexión');
  });

  test('si falla /episode, igual se muestran los personajes con aviso', async ({ page }) => {
    await openPage(page, { episodeStatus: 500 });
    await expect(cards(page)).toHaveCount(6);
    await expect(status(page)).toHaveAttribute('data-state', 'partial');
    await expect(cards(page).first()).toContainText('Ubicación: Citadel of Ricks (Space station)');
    await expect(cards(page).first()).toContainText('Primer episodio: No disponible');
  });

  test('si falla /location, usa la ubicación que ya trae el personaje', async ({ page }) => {
    await openPage(page, { locationStatus: 500 });
    await expect(cards(page)).toHaveCount(6);
    await expect(status(page)).toHaveAttribute('data-state', 'partial');
    await expect(cards(page).first()).toContainText('Ubicación: Citadel of Ricks');
    await expect(cards(page).first()).not.toContainText('Space station');
    await expect(cards(page).first()).toContainText('Primer episodio: S01E01 - Pilot');
  });

  test('descarta la respuesta vieja si ya hiciste una búsqueda nueva', async ({ page }) => {
    await openPage(page, { characterDelay: (q) => (q === 'rick' ? 1500 : 0) });
    // la búsqueda inicial ("rick") tarda 1.5 s; hacemos otra antes de que termine
    await input(page).fill('morty');
    await input(page).press('Enter');
    await expect(cards(page).first()).toContainText('Morty Smith');

    await page.waitForTimeout(2000);
    await expect(cards(page).first()).toContainText('Morty Smith');
    await expect(cards(page).filter({ hasText: 'Rick Sanchez' })).toHaveCount(0);
  });

  test('los datos de la API se muestran como texto (no se ejecuta HTML)', async ({ page }) => {
    const evil = { ...CHARACTERS[0], name: '<img src=x onerror="window.__xss=1">' };
    await openPage(page, { characters: [evil] });
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first().locator('.name')).toHaveText('<img src=x onerror="window.__xss=1">');
    await expect(cards(page).first().locator('.name img')).toHaveCount(0);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  });

  /* ---------------------------- Responsivo ---------------------------- */
  const sizes = [
    { w: 1280, h: 800, cols: 3, name: 'escritorio' },
    { w: 820, h: 1000, cols: 2, name: 'tablet' },
    { w: 375, h: 700, cols: 1, name: 'celular' },
  ];
  for (const { w, h, cols, name } of sizes) {
    test(`responsivo ${name} (${w}px): ${cols} columna(s) y sin scroll horizontal`, async ({ page }) => {
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
/* Prueba contra la API real (solo con LIVE=1)                         */
/* ------------------------------------------------------------------ */
test('@live API real de Rick and Morty con los 3 endpoints', async ({ page }) => {
  test.skip(!process.env.LIVE, 'Define LIVE=1 para probar con internet y la API real');

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
