import * as Location from 'expo-location';
import { supabase } from './supabase';
import { reverseGeocodeGoogle, DEFAULT_BANGKOK_LOCATION } from './mapServices';

let presenceInterval: any = null;

export async function sendLocationPing(isOnline: boolean = true) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (!isOnline) {
      await (supabase.rpc as any)('update_specialist_presence', {
        p_is_online: false,
      });
      return;
    }

    let lat = DEFAULT_BANGKOK_LOCATION.latitude;
    let lng = DEFAULT_BANGKOK_LOCATION.longitude;
    let speed = 0;
    let address = DEFAULT_BANGKOK_LOCATION.address;

    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const currentLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (currentLoc && currentLoc.coords) {
          lat = currentLoc.coords.latitude;
          lng = currentLoc.coords.longitude;
          speed = currentLoc.coords.speed ? Math.max(0, currentLoc.coords.speed * 3.6) : 0;
          const geocoded = await reverseGeocodeGoogle(lat, lng);
          address = geocoded.address;
        }
      }
    } catch (locErr) {
      console.warn('GPS location ping fallback:', locErr);
    }

    await (supabase.rpc as any)('update_specialist_presence', {
      p_is_online: true,
      p_lat: lat,
      p_lng: lng,
      p_address: address,
      p_speed: speed,
      p_battery: 95,
    });
  } catch (err) {
    console.error('Error sending presence ping:', err);
  }
}

export function startLivePresenceTracking() {
  // Send immediate ping upon login / app foreground
  sendLocationPing(true);

  if (presenceInterval) {
    clearInterval(presenceInterval);
  }

  // Periodic heartbeat ping every 25 seconds
  presenceInterval = setInterval(() => {
    sendLocationPing(true);
  }, 25000);
}

export function stopLivePresenceTracking() {
  if (presenceInterval) {
    clearInterval(presenceInterval);
    presenceInterval = null;
  }
  sendLocationPing(false);
}
