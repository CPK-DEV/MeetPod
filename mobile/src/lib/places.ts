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

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const DETAILS_URL = 'https://places.googleapis.com/v1/places';

export interface LocationBias {
  lat: number;
  lng: number;
  radiusMeters?: number;
}

export async function autocomplete(
  input: string,
  sessionToken: string,
  language = 'ko',
  bias?: LocationBias | null,
): Promise<PlaceSuggestion[]> {
  if (!input.trim()) return [];
  const body: any = { input, languageCode: language, regionCode: 'KR', sessionToken };
  if (bias) {
    body.locationBias = {
      circle: {
        center: { latitude: bias.lat, longitude: bias.lng },
        radius: bias.radiusMeters ?? 50000,  // 50km 기본
      },
    };
  }
  try {
    const { data } = await axios.post(
      AUTOCOMPLETE_URL,
      body,
      { headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY } },
    );
    const suggestions = data.suggestions ?? [];
    console.log('[places] count=', suggestions.length);
    return suggestions
      .filter((s: any) => s.placePrediction)
      .map((s: any) => ({
        place_id: s.placePrediction.placeId,
        description: s.placePrediction.text?.text ?? '',
      }));
  } catch (e: any) {
    console.log('[places] error=', e.message, e.response?.data);
    return [];
  }
}

export async function placeDetails(place_id: string, sessionToken: string, language = 'ko'): Promise<PlaceDetail> {
  const { data } = await axios.get(`${DETAILS_URL}/${place_id}`, {
    params: { languageCode: language, sessionToken },
    headers: {
      'X-Goog-Api-Key': KEY,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,location',
    },
  });
  return {
    google_id: data.id,
    name: data.displayName?.text ?? '',
    address: data.formattedAddress ?? '',
    lat: data.location?.latitude,
    lng: data.location?.longitude,
  };
}
