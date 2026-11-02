import assert from 'node:assert/strict';

import { HttpError } from '../_shared/http.ts';
import { cacheKey, createHandler, type GymRow, type GymStore } from './handler.ts';
import type { OsmGym } from './overpass.ts';

function memoryStore() {
  const gyms = new Map<string, GymRow>();
  const cache = new Map<string, { ids: string[]; at: number }>();
  let n = 0;
  const store: GymStore = {
    getCached(key, maxAge) {
      const hit = cache.get(key);
      if (!hit || Date.now() - hit.at > maxAge) return Promise.resolve(null);
      return Promise.resolve([...gyms.values()].filter((g) => hit.ids.includes(g.id)));
    },
    upsertGyms(found: OsmGym[]) {
      return Promise.resolve(
        found.map((g) => {
          const existing = [...gyms.values()].find((x) => x.osm_id === g.osm_id);
          const row = { ...g, id: existing?.id ?? `gym-${++n}` };
          gyms.set(row.id, row);
          return row;
        }),
      );
    },
    putCache(key, ids) {
      cache.set(key, { ids, at: Date.now() });
      return Promise.resolve();
    },
  };
  return { store, cache };
}

const overpassPayload = {
  elements: [
    { type: 'node', id: 10, lat: 50.64, lon: 3.07, tags: { name: 'Loin' } },
    { type: 'node', id: 11, lat: 50.631, lon: 3.061, tags: { name: 'Proche' } },
  ],
};

function setup(opts: { authed?: boolean; overpassStatus?: number } = {}) {
  const { store, cache } = memoryStore();
  const bodies: string[] = [];
  const handler = createHandler({
    authenticate: (req) =>
      opts.authed === false || !req.headers.get('Authorization')
        ? Promise.reject(new HttpError(401, 'not_authenticated'))
        : Promise.resolve({ id: 'user-1' }),
    store,
    overpassUrl: 'https://overpass.test/api/interpreter',
    fetcher: (_url, init) => {
      bodies.push(String(init?.body ?? ''));
      return Promise.resolve(
        new Response(JSON.stringify(overpassPayload), { status: opts.overpassStatus ?? 200 }),
      );
    },
  });
  return { handler, bodies, cache };
}

function post(body: unknown, auth = true) {
  return new Request('http://localhost/search-gyms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: 'Bearer jwt' } : {}),
    },
    body: JSON.stringify(body),
  });
}

Deno.test('rejects unauthenticated calls', async () => {
  const { handler } = setup();
  const res = await handler(post({ mode: 'near', lat: 50.63, lng: 3.06 }, false));
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { error: 'not_authenticated' });
});

Deno.test('validates input with zod', async () => {
  const { handler } = setup();
  for (const bad of [
    { mode: 'near', lat: 200, lng: 0 },
    { mode: 'name', query: 'a' },
    { mode: 'x' },
    'nope',
  ]) {
    const res = await handler(post(bad));
    assert.equal(res.status, 400, JSON.stringify(bad));
  }
});

Deno.test('near search rounds the position to ~1 km before calling Overpass', async () => {
  const { handler, bodies } = setup();
  const res = await handler(post({ mode: 'near', lat: 50.631234, lng: 3.061987, radius_m: 1500 }));
  assert.equal(res.status, 200);
  const decoded = decodeURIComponent(bodies[0]);
  assert.ok(decoded.includes('around:1500,50.63,3.06'), decoded);
  assert.ok(!decoded.includes('50.6312'), 'precise latitude must never leave the function');
  const body = await res.json();
  assert.equal(body.cached, false);
  assert.deepEqual(
    body.gyms.map((g: GymRow) => g.name),
    ['Proche', 'Loin'],
  );
});

Deno.test('second identical search is served from the cache', async () => {
  const { handler, bodies } = setup();
  await handler(post({ mode: 'near', lat: 50.63, lng: 3.06 }));
  const res = await handler(post({ mode: 'near', lat: 50.6301, lng: 3.0601 }));
  const body = await res.json();
  assert.equal(body.cached, true);
  assert.equal(bodies.length, 1);
  assert.equal(body.gyms.length, 2);
});

Deno.test('name search without position is sorted alphabetically', async () => {
  const { handler, bodies } = setup();
  const res = await handler(post({ mode: 'name', query: '  Fit  ' }));
  const body = await res.json();
  assert.deepEqual(
    body.gyms.map((g: GymRow) => g.name),
    ['Loin', 'Proche'],
  );
  assert.ok(decodeURIComponent(bodies[0]).includes('"name"~"Fit",i'));
});

Deno.test('Overpass failure maps to a 503 the app can explain', async () => {
  const { handler } = setup({ overpassStatus: 429 });
  const res = await handler(post({ mode: 'near', lat: 50.63, lng: 3.06 }));
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: 'gym_search_unavailable' });
});

Deno.test('cache keys are coarse and normalised', () => {
  assert.equal(
    cacheKey({ mode: 'near', lat: 50.6312, lng: 3.0619, radius_m: 2000 }),
    'near:50.63,3.06:2000',
  );
  assert.equal(cacheKey({ mode: 'name', query: 'Basic   Fit' }), 'name:basic fit:fr');
});

Deno.test('CORS preflight and wrong method', async () => {
  const { handler } = setup();
  assert.equal((await handler(new Request('http://localhost', { method: 'OPTIONS' }))).status, 200);
  assert.equal(
    (
      await handler(
        new Request('http://localhost', { method: 'GET', headers: { Authorization: 'Bearer x' } }),
      )
    ).status,
    405,
  );
});
