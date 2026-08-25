import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

// High-performance Base64 to ArrayBuffer decoder for React Native & Web
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const lookup = new Uint8Array(256);
for (let i = 0; i < chars.length; i++) {
  lookup[chars.charCodeAt(i)] = i;
}

export function decodeBase64ToArrayBuffer(base64: string): ArrayBuffer {
  let clean = base64.replace(/[\n\r\s]/g, '');
  if (clean.includes(',')) {
    clean = clean.split(',')[1];
  }

  let bufferLength = clean.length * 0.75;
  if (clean[clean.length - 1] === '=') {
    bufferLength--;
    if (clean[clean.length - 2] === '=') {
      bufferLength--;
    }
  }

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const bytes = new Uint8Array(arrayBuffer);

  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const encoded1 = lookup[clean.charCodeAt(i)];
    const encoded2 = lookup[clean.charCodeAt(i + 1)];
    const encoded3 = lookup[clean.charCodeAt(i + 2)];
    const encoded4 = lookup[clean.charCodeAt(i + 3)];

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (clean[i + 2] !== '=') {
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (clean[i + 3] !== '=') {
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }
  }

  return arrayBuffer;
}

/**
 * Upload an image URI or Base64 to Supabase Storage
 */
export async function uploadImageToSupabase(
  uriOrBase64: string,
  bucket: 'trip_photos' | 'expense_receipts' = 'trip_photos',
  customFileName?: string,
  rawBase64?: string
): Promise<string> {
  try {
    if (!uriOrBase64 && !rawBase64) return '';

    // If it is already a remote public HTTP/HTTPS URL, return directly
    if (uriOrBase64.startsWith('http://') || uriOrBase64.startsWith('https://')) {
      return uriOrBase64;
    }

    const ext = 'jpg';
    const fileName = customFileName || `${bucket}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;
    const filePath = `uploads/${fileName}`;

    let bodyData: any = null;

    // 1. Prefer raw base64 if provided
    if (rawBase64) {
      bodyData = decodeBase64ToArrayBuffer(rawBase64);
    } else if (uriOrBase64.startsWith('data:image')) {
      bodyData = decodeBase64ToArrayBuffer(uriOrBase64);
    } else {
      // Fetch blob as secondary fallback
      try {
        const res = await fetch(uriOrBase64);
        bodyData = await res.blob();
      } catch (fetchErr) {
        console.warn('Blob fetch failed, cannot upload local file path directly:', fetchErr);
      }
    }

    if (bodyData) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, bodyData, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) {
        console.warn(`Supabase Storage upload warning (${bucket}):`, error.message);
      } else {
        const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filePath);
        if (publicData?.publicUrl) {
          return publicData.publicUrl;
        }
      }
    }

    // Fallback: If upload failed or was offline, return Data URI instead of unreachable local file path
    if (rawBase64) {
      return `data:image/jpeg;base64,${rawBase64}`;
    }
    if (uriOrBase64.startsWith('data:image')) {
      return uriOrBase64;
    }

    return uriOrBase64;
  } catch (err) {
    console.warn('Error in uploadImageToSupabase:', err);
    if (rawBase64) {
      return `data:image/jpeg;base64,${rawBase64}`;
    }
    return uriOrBase64;
  }
}

/**
 * Pick image from Camera with Base64 support & explicit permission checks
 */
export async function pickImageFromCamera(): Promise<{ uri: string; name?: string; base64?: string } | null> {
  try {
    if (Platform.OS === 'web') {
      return pickImageFromLibrary();
    }

    const { status: existingStatus, granted: existingGranted } = await ImagePicker.getCameraPermissionsAsync();
    let isGranted = existingGranted || existingStatus === 'granted';

    if (!isGranted) {
      const { status: newStatus, granted: newGranted } = await ImagePicker.requestCameraPermissionsAsync();
      isGranted = newGranted || newStatus === 'granted';
    }

    if (!isGranted) {
      Alert.alert(
        'ขอสิทธิ์การใช้งานกล้อง',
        'กรุณาอนุญาตให้แอปพลิเคชันเข้าถึงกล้องถ่ายรูปในการตั้งค่าเพื่อถ่ายภาพหน้างานจริงหรือสลิปค่าใช้จ่าย',
        [{ text: 'ตกลง' }]
      );
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.6,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      return {
        uri: asset.uri,
        base64: asset.base64 || undefined,
        name: asset.fileName || `Photo-${Date.now().toString().slice(-4)}.jpg`,
      };
    }
    return null;
  } catch (e: any) {
    console.warn('Camera launch failed, falling back to library:', e);
    return pickImageFromLibrary();
  }
}

/**
 * Pick image from Photo Library / Gallery with Base64 support & explicit permission checks
 */
export async function pickImageFromLibrary(): Promise<{ uri: string; name?: string; base64?: string } | null> {
  try {
    const checkPerm = await ImagePicker.getMediaLibraryPermissionsAsync();
    let isGranted = checkPerm.granted || checkPerm.status === 'granted';

    if (!isGranted) {
      const requestPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      isGranted = requestPerm.granted || requestPerm.status === 'granted';
    }

    if (!isGranted) {
      Alert.alert(
        'ขอสิทธิ์เข้าถึงรูปภาพ',
        'กรุณาอนุญาตให้แอปพลิเคชันเข้าถึงรูปภาพเพื่อเลือกรูปภาพจากคลัง',
        [{ text: 'ตกลง' }]
      );
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.6,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      return {
        uri: asset.uri,
        base64: asset.base64 || undefined,
        name: asset.fileName || `Image-${Date.now().toString().slice(-4)}.jpg`,
      };
    }
    return null;
  } catch (e: any) {
    console.warn('Photo library error:', e);
    Alert.alert('เกิดข้อผิดพลาดในการเลือกรูปภาพ', e?.message || 'ไม่สามารถเข้าถึงคลังรูปภาพได้');
    return null;
  }
}
