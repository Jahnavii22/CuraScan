// app/(home)/upload-image.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors, gradientColors } from "../theme/colors";
import { uploadImageFile, apiFetch } from "../utils/api";
import { useRouter } from "expo-router";
import { useUser } from "@clerk/clerk-expo";

export default function UploadImageScreen() {
  const router = useRouter();
  const { user } = useUser();

  const [localUri, setLocalUri] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [mime, setMime] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingText, setUploadingText] = useState<string>("");

  useEffect(() => {
    (async () => {
      if (Platform.OS !== "web") {
        try {
          await ImagePicker.requestCameraPermissionsAsync();
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        } catch (e) {
          console.warn("Permission request failed", e);
        }
      }
    })();
  }, []);

  const guessNameAndMime = (uri: string) => {
    const last = uri.split("/").pop() ?? `photo-${Date.now()}.jpg`;
    const ext = last.includes(".") ? last.split(".").pop()!.toLowerCase() : "jpg";
    let m = "image/jpeg";
    if (/(png)/i.test(ext)) m = "image/png";
    return { name: last, mime: m };
  };

  const pickFromGallery = async () => {
    try {
      // cast to any to avoid SDK type mismatch
      const res = await (ImagePicker as any).launchImageLibraryAsync({
        mediaTypes: (ImagePicker as any).MediaTypeOptions?.Images ?? "Images",
        quality: 0.8,
      });

      const cancelled = (res as any).canceled ?? (res as any).cancelled ?? false;
      if (cancelled) return;
      const asset = (res as any).assets?.[0] ?? res;
      const uri = asset?.uri;
      if (!uri) {
        Alert.alert("Error", "Could not get image URI.");
        return;
      }
      const { name, mime } = guessNameAndMime(uri);
      setLocalUri(uri);
      setFilename(name);
      setMime(mime);
    } catch (err) {
      console.error("pickFromGallery error", err);
      Alert.alert("Error", "Unable to pick image.");
    }
  };

  const takePhoto = async () => {
    try {
      const res = await (ImagePicker as any).launchCameraAsync({ quality: 0.85 });
      const cancelled = (res as any).canceled ?? (res as any).cancelled ?? false;
      if (cancelled) return;
      const asset = (res as any).assets?.[0] ?? res;
      const uri = asset?.uri;
      if (!uri) {
        Alert.alert("Error", "Could not capture image.");
        return;
      }
      const { name, mime } = guessNameAndMime(uri);
      setLocalUri(uri);
      setFilename(name);
      setMime(mime);
    } catch (err) {
      console.error("takePhoto error", err);
      Alert.alert("Error", "Unable to take photo.");
    }
  };

  const doUpload = async () => {
    if (!localUri || !filename || !mime) {
      Alert.alert("No image", "Please select or take a photo first.");
      return;
    }
    setLoading(true);
    setUploadingText("Uploading image...");
    try {
      const clerkUserId = user?.id ?? "";
      const resp = await uploadImageFile(localUri, filename, mime, { clerkUserId });

      if (!resp.ok) {
        console.error("Upload failed:", resp);
        Alert.alert("Upload failed", resp.body?.msg || JSON.stringify(resp.body) || "Unknown error");
        setLoading(false);
        return;
      }

      // Case A: server saved report and returned an ID
      const reportId =
        resp.body?.reportId ?? resp.body?.report?._id ?? resp.body?.id ?? null;

      if (reportId) {
        setUploadingText("Triggering processing...");
        const proc = await apiFetch(`/api/process/${reportId}`, { method: "POST" });
        if (!proc.ok) {
          Alert.alert("Processing failed", proc.body?.msg || JSON.stringify(proc.body) || "Server error");
          setLoading(false);
          return;
        }
        const report = proc.body?.report ?? proc.body;
        const resultId = report?._id ?? report?.id ?? reportId;
        // navigate to results by id (your existing results screen)
        router.replace({ pathname: "/results/[id]", params: { id: String(resultId) } });
        return;
      }

      // Case B: backend returned pipeline/recommendations inline
      if (resp.body?.pipeline || resp.body?.recommendations) {
        const inlinePayload = resp.body;
        await AsyncStorage.setItem("CURASCAN_INLINE_REPORT", JSON.stringify(inlinePayload));
        // make sure route file exists at app/(home)/results-inline.tsx
        router.push("/results-inline");
        return;
      }

      // fallback
      Alert.alert("Upload complete", "Image uploaded but backend returned no usable payload.");
    } catch (err) {
      console.error("doUpload error:", err);
      Alert.alert("Error", "Upload/processing failed. See console for details.");
    } finally {
      setLoading(false);
      setUploadingText("");
    }
  };

  const clear = () => {
    setLocalUri(null);
    setFilename(null);
    setMime(null);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradientColors} style={styles.header}>
        <Text style={styles.headerTitle}>Upload Image</Text>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.previewArea}>
          {localUri ? <Image source={{ uri: localUri }} style={styles.preview} /> : (
            <View style={styles.placeholder}>
              <Ionicons name="images-outline" size={48} color={colors.textSecondary} />
              <Text style={styles.placeholderText}>No image selected</Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.actionBtn} onPress={pickFromGallery}>
            <Ionicons name="image-outline" size={18} color="white" />
            <Text style={styles.actionText}>Choose from Gallery</Text>
          </Pressable>

          <Pressable style={[styles.actionBtn, { marginTop: 12 }]} onPress={takePhoto}>
            <Ionicons name="camera-outline" size={18} color="white" />
            <Text style={styles.actionText}>Take Photo</Text>
          </Pressable>

          {localUri && (
            <>
              <Pressable style={[styles.uploadBtn, { marginTop: 18 }]} onPress={doUpload} disabled={loading}>
                {loading ? <ActivityIndicator color="white" /> : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={18} color="white" />
                    <Text style={styles.uploadText}>Upload & Analyze</Text>
                  </>
                )}
              </Pressable>

              <Pressable style={styles.clearBtn} onPress={clear} disabled={loading}>
                <Text style={styles.clearText}>Choose a different image</Text>
              </Pressable>
            </>
          )}

          {uploadingText ? <Text style={styles.uploadingNote}>{uploadingText}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    height: 110,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 36,
    paddingBottom: 14,
    justifyContent: "center",
  },
  headerTitle: { color: "white", fontSize: 20, fontWeight: "700" },

  body: { padding: 18, flex: 1, alignItems: "center" },

  previewArea: {
    width: "96%",
    height: 260,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  preview: { width: "100%", height: "100%", resizeMode: "cover" },
  placeholder: { alignItems: "center" },
  placeholderText: { color: colors.textSecondary, marginTop: 8 },

  actions: { width: "100%", marginTop: 18, alignItems: "center" },
  actionBtn: {
    width: "96%",
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  actionText: { color: "white", marginLeft: 10, fontWeight: "700" },

  uploadBtn: {
    width: "96%",
    backgroundColor: "#2E7D32",
    paddingVertical: 14,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  uploadText: { color: "white", marginLeft: 10, fontWeight: "700" },

  clearBtn: { marginTop: 12 },
  clearText: { color: colors.textSecondary },

  uploadingNote: { color: colors.textSecondary, marginTop: 12 },
});
