import { nominatimUrl, parseNominatim, viewbox } from './osmSearch';

describe('nominatimUrl', () => {
  it('searches fitness centres in a box around a position rounded to ~1 km', () => {
    const url = new URL(nominatimUrl({ mode: 'near', lat: 50.631234, lng: 3.061987 }));
    expect(url.origin + url.pathname).toBe('https://nominatim.openstreetmap.org/search');
    expect(url.searchParams.get('q')).toBe('[leisure=fitness_centre]');
    expect(url.searchParams.get('bounded')).toBe('1');
    expect(url.searchParams.get('viewbox')).toBe(viewbox(50.63, 3.06, 3000));
    expect(url.toString()).not.toContain('50.6312');
  });

  it('searches by name around the player, or in France without a position', () => {
    const near = new URL(
      nominatimUrl({ mode: 'name', query: ' Basic-Fit ', lat: 50.63, lng: 3.06 }),
    );
    expect(near.searchParams.get('q')).toBe('Basic-Fit');
    expect(near.searchParams.get('viewbox')).toBe(viewbox(50.63, 3.06, 30000));
    const anywhere = new URL(nominatimUrl({ mode: 'name', query: 'On Air' }));
    expect(anywhere.searchParams.get('countrycodes')).toBe('fr');
    expect(anywhere.searchParams.get('viewbox')).toBeNull();
  });

  it('builds a left,top,right,bottom box', () => {
    const [left, top, right, bottom] = viewbox(50, 3, 1000).split(',').map(Number);
    expect(left).toBeLessThan(3);
    expect(right).toBeGreaterThan(3);
    expect(top).toBeGreaterThan(50);
    expect(bottom).toBeLessThan(50);
  });
});

describe('parseNominatim', () => {
  const gym = {
    osm_type: 'node',
    osm_id: 42,
    lat: '50.62',
    lon: '3.07',
    category: 'leisure',
    type: 'fitness_centre',
    name: ' Basic-Fit ',
    address: { house_number: '4', road: 'Rue Fourier', postcode: '59000', town: 'Lille' },
  };

  it('keeps named fitness centres and formats the address', () => {
    expect(parseNominatim([gym])).toEqual([
      {
        osm_id: 'node/42',
        name: 'Basic-Fit',
        lat: 50.62,
        lng: 3.07,
        address: '4 Rue Fourier, 59000 Lille',
      },
    ]);
  });

  it('drops other places, unnamed or malformed entries and duplicates', () => {
    expect(
      parseNominatim([
        gym,
        gym,
        { ...gym, category: 'shop', type: 'sports' },
        { ...gym, osm_id: 43, name: '' },
        { ...gym, osm_id: 44, lat: 'x' },
        { ...gym, osm_type: 'relation', osm_id: 45 },
        { ...gym, osm_id: -1 },
        null,
        { ...gym, osm_id: 46, address: undefined },
      ]).map((g) => [g.osm_id, g.address]),
    ).toEqual([
      ['node/42', '4 Rue Fourier, 59000 Lille'],
      ['node/46', null],
    ]);
    expect(parseNominatim({ error: 'busy' })).toEqual([]);
  });
});
