export const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyDYNtBMG47WiMxmfcMpJ-8nk6wZCPTwOmY';

export const GOOGLE_MAPS_TILE_URL =
  'https://mt1.google.com/vt/lyrs=m&hl=th&x={x}&y={y}&z={z}';

export const BANGKOK_COORDINATES = {
  latitude: 13.7563,
  longitude: 100.5018,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export const DEFAULT_WAYPOINTS = [
  {
    id: 'origin-hq',
    title: 'Bangkok Central Depot (Start HQ)',
    latitude: 13.7563,
    longitude: 100.5018,
    isOrigin: true,
  },
  {
    id: 'drop-1',
    title: 'TechCorp HQ (Sathorn)',
    latitude: 13.7225,
    longitude: 100.5283,
  },
  {
    id: 'drop-2',
    title: 'Siam Retail Flagship (Pathum Wan)',
    latitude: 13.7469,
    longitude: 100.5349,
  },
  {
    id: 'drop-3',
    title: 'Mega Bangna Logistics Hub',
    latitude: 13.6472,
    longitude: 100.6811,
  },
];

// Helper to query Google Geocoding API
export async function searchAddressGeocode(address: string) {
  try {
    if (GOOGLE_MAPS_API_KEY) {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        address
      )}&key=${GOOGLE_MAPS_API_KEY}&language=th`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.status === 'OK' && json.results && json.results.length > 0) {
        const loc = json.results[0].geometry.location;
        return {
          latitude: loc.lat,
          longitude: loc.lng,
          formattedAddress: json.results[0].formatted_address,
        };
      }
    }
  } catch (_) {
    // Fallback to OpenStreetMap
  }

  try {
    const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      address
    )}&format=json&countrycodes=th&limit=1&addressdetails=1&accept-language=th`;
    const res = await fetch(osmUrl, {
      headers: { 'User-Agent': 'FastFleetMobileApp/1.0' },
    });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        formattedAddress: data[0].display_name,
      };
    }
  } catch (_) {}

  return null;
}
