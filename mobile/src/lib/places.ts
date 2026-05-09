import axios from 'axios';

const KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export interface PlaceSuggestion {
  place_id: string;
  description: string;
}
export interface PlaceDetail {
  google_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export async function autocomplete(input: string, sessionToken: string, language = 'ko'): Promise<PlaceSuggestion[]> {
  if (!input.trim()) return [];
  const { data } = await axios.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
    params: { input, key: KEY, sessiontoken: sessionToken, language },
  });
  return (data.predictions ?? []).map((p: any) => ({ place_id: p.place_id, description: p.description }));
}

export async function placeDetails(place_id: string, sessionToken: string, language = 'ko'): Promise<PlaceDetail> {
  const { data } = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
    params: {
      place_id, key: KEY, sessiontoken: sessionToken, language,
      fields: 'place_id,name,formatted_address,geometry/location',
    },
  });
  const r = data.result;
  return {
    google_id: r.place_id,
    name: r.name,
    address: r.formatted_address,
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
  };
}
