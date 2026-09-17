import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import type { LocalFile } from "@/services/surveys";

const IMAGE_SUFFIXES = /\.(jpe?g|tiff?)$/i;

/** Lets the farmer pick drone JPG/TIFF frames from the phone's library. */
export async function pickDroneImages(): Promise<LocalFile[] | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    quality: 1,
    exif: false,
    orderedSelection: true,
  });
  if (result.canceled) return [];
  return result.assets.map((a, i) => ({
    uri: a.uri,
    name: a.fileName ?? `image_${i + 1}.jpg`,
    type: a.mimeType ?? "image/jpeg",
  }));
}

/** Picks JPG/TIFF files with the system file picker (works for files copied from the drone's card). */
export async function pickImageFiles(): Promise<LocalFile[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["image/jpeg", "image/tiff", "image/*"],
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];
  return result.assets
    .filter((a) => IMAGE_SUFFIXES.test(a.name))
    .map((a) => ({ uri: a.uri, name: a.name, type: a.mimeType ?? "image/jpeg" }));
}

/** Picks one processed file for manual import (GeoTIFF, GeoJSON, 3D Tiles zip, LAS/LAZ). */
export async function pickAssetFile(): Promise<LocalFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["image/tiff", "application/zip", "application/geo+json", "application/json", "application/octet-stream", "*/*"],
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets[0]) return null;
  const a = result.assets[0];
  return { uri: a.uri, name: a.name, type: a.mimeType ?? "application/octet-stream" };
}
