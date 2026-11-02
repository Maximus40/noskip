import assert from 'node:assert/strict';

import {
  escapeOverpassRegex,
  FRANCE_BBOX,
  nameQuery,
  nearQuery,
  parseOverpass,
} from './overpass.ts';

Deno.test('nearQuery targets fitness centres around a point', () => {
  const q = nearQuery(50.63, 3.06, 2000);
  assert.match(q, /nwr\["leisure"="fitness_centre"\]\(around:2000,50\.63,3\.06\)/);
  assert.match(q, /out center tags 60;$/);
});

Deno.test('nameQuery uses a case-insensitive regex, near a point or across France', () => {
  assert.match(
    nameQuery('basic fit', { lat: 48.85, lng: 2.35 }),
    /\["name"~"basic fit",i\]\(around:30000,48\.85,2\.35\)/,
  );
  assert.ok(nameQuery('fitness', null).includes(`(${FRANCE_BBOX})`));
});

Deno.test('escapeOverpassRegex neutralises quotes, backslashes and metacharacters', () => {
  assert.equal(escapeOverpassRegex('a"b\\c'), 'abc');
  assert.equal(escapeOverpassRegex('fit.'), 'fit\\\\.');
  assert.equal(escapeOverpassRegex('(x)'), '\\\\(x\\\\)');
});

Deno.test('parseOverpass keeps named gyms with a position and formats the address', () => {
  const gyms = parseOverpass({
    elements: [
      {
        type: 'node',
        id: 1,
        lat: 50.6,
        lon: 3.05,
        tags: {
          name: ' Fitness Park Lille ',
          'addr:housenumber': '12',
          'addr:street': 'Rue Nationale',
          'addr:postcode': '59000',
          'addr:city': 'Lille',
        },
      },
      { type: 'way', id: 2, center: { lat: 50.7, lon: 3.1 }, tags: { name: 'Salle Way' } },
      { type: 'node', id: 3, lat: 50.6, lon: 3.0, tags: {} },
      { type: 'node', id: 4, tags: { name: 'No position' } },
      { type: 'node', id: 1, lat: 50.6, lon: 3.05, tags: { name: 'Duplicate' } },
      { type: 'bogus', id: 5 },
    ],
  });
  assert.deepEqual(gyms, [
    {
      osm_id: 'node/1',
      name: 'Fitness Park Lille',
      lat: 50.6,
      lng: 3.05,
      address: '12 Rue Nationale, 59000 Lille',
    },
    { osm_id: 'way/2', name: 'Salle Way', lat: 50.7, lng: 3.1, address: null },
  ]);
});

Deno.test('parseOverpass tolerates garbage', () => {
  assert.deepEqual(parseOverpass(null), []);
  assert.deepEqual(parseOverpass({ elements: 'nope' }), []);
});
