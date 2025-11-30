// app/components/UploadSheet.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import Modal from "react-native-modal";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";
import colors from "../theme/colors";
import { uploadImageFile, uploadFile, apiFetch } from "../utils/api";
import { useUser } from "@clerk/clerk-expo";

type Props = {
  mode: "closed" | "pdf" | "image";
  onClose: () => void;
  onDone?: (report: any) => void;
};

export default function UploadSheet({ mode, onClose, onDone }: Props) {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode !== "closed" && Platform.OS !== "web") {
      (async () => {
        try {
          await ImagePicker.requestCameraPermissionsAsync();
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        } catch (e) {
          console.warn("Permission request failed", e);
        }
      })();
    }
  }, [mode]);

  const guessNameAndMime = (uri: string, defaultName: string) => {
    try {
      const last = uri.split("/").pop() || defaultName;
      const ext = last.includes(".") ? last.split(".").pop()!.toLowerCase() : "";
      let mime = "application/octet-stream";
      if (/pdf/i.test(ext)) mime = "application/pdf";
      else if (/jpe?g|jpg/i.test(ext)) mime = "image/jpeg";
      else if (/png/i.test(ext)) mime = "image/png";
      return { name: last, mime };
    } catch {
      return { name: defaultName, mime: "application/octet-stream" };
    }
  };

  const uploadAndProcess = async (
    localUri: string,
    filename: string,
    mimeType: string,
    fileType: "pdf" | "image"
  ) => {
    try {
      setLoading(true);
      if (!localUri) {
        Alert.alert("Error", "Invalid file URI.");
        return;
      }
      const clerkUserId = user?.id ?? "";

      if (fileType === "image") {
        const resp = await uploadImageFile(localUri, filename, mimeType, { clerkUserId });
        if (!resp.ok) {
          Alert.alert("Upload failed", resp.body?.msg || JSON.stringify(resp.body));
          return;
        }
        Alert.alert("Success", "Image uploaded and processed.");
        onDone?.(resp.body);
      } else {
        const resp = await uploadFile(localUri, filename, mimeType, { clerkUserId });
        if (!resp.ok) {
          Alert.alert("Upload failed", resp.body?.msg || JSON.stringify(resp.body));
          return;
        }
        const reportId =
          resp.body?.reportId ?? resp.body?.report?._id ?? resp.body?.id ?? null;
        if (!reportId) {
          Alert.alert("Upload complete", "No report ID returned.");
          return;
        }
        const proc = await apiFetch(`/api/process/${reportId}`, { method: "POST" });
        if (!proc.ok) {
          Alert.alert("Processing failed", proc.body?.msg || JSON.stringify(proc.body));
          onDone?.(resp.body?.report ?? { id: reportId });
          return;
        }
        Alert.alert("Success", "File uploaded and processed.");
        onDone?.(proc.body?.report ?? proc.body);
      }
    } catch (err) {
      console.error("uploadAndProcess error:", err);
      Alert.alert("Error", "Upload or processing failed.\nCheck console & backend connection.");
    } finally {
      setLoading(false);
      onClose();
    }
  };

  const onPickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: false });
      const asAny = res as any;
      if (!res || asAny.type === "cancel" || asAny.canceled === true) return;
      const asset = asAny.assets?.[0] ?? res;
      const uri = asset?.uri ?? asAny.uri ?? asAny.file ?? asAny.fileUri ?? null;
      if (!uri) { Alert.alert("Error", "Unable to read selected file."); return; }
      const fallbackName = asset?.name ?? `report-${Date.now()}.pdf`;
      const fallbackMime = asset?.mimeType ?? "application/pdf";
      let uploadUri = uri;
      const fsAny = FileSystem as any;
      const baseDir = fsAny.documentDirectory ?? fsAny.cacheDirectory ?? null;
      if (baseDir) {
        const safeName = fallbackName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const localPath = `${baseDir}${safeName}`;
        try {
          const stat = await FileSystem.getInfoAsync(localPath);
          if (stat.exists) await FileSystem.deleteAsync(localPath, { idempotent: true });
          await FileSystem.copyAsync({ from: uri, to: localPath });
          uploadUri = localPath;
        } catch (copyErr) {
          console.warn("copyAsync failed — using original uri:", copyErr);
          uploadUri = uri;
        }
      }
      const { name, mime } = guessNameAndMime(uploadUri, fallbackName);
      await uploadAndProcess(uploadUri, name, fallbackMime || mime, "pdf");
    } catch (err) {
      console.error("pickDocument error:", err);
      Alert.alert("Error", "Unable to pick document.");
    }
  };

  const onPickImageLibrary = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        // use the stable API that exists in your installed expo-image-picker
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      const asAny = res as any;
      const canceled = asAny.canceled ?? false;
      if (canceled) return;
      const asset = asAny.assets?.[0] ?? res;
      const uri = asset?.uri;
      if (!uri) { Alert.alert("Error", "Unable to read selected image."); return; }
      const { name, mime } = guessNameAndMime(uri, `image-${Date.now()}.jpg`);
      await uploadAndProcess(uri, name, mime, "image");
    } catch (err) {
      console.error("pickImageLibrary error:", err);
      Alert.alert("Error", "Unable to pick image.");
    }
  };

  const onTakePhoto = async () => {
    try {
      const res = await ImagePicker.launchCameraAsync({ quality: 0.85 });
      const asAny = res as any;
      const canceled = asAny.canceled ?? false;
      if (canceled) return;
      const asset = asAny.assets?.[0] ?? res;
      const uri = asset?.uri;
      if (!uri) { Alert.alert("Error", "Unable to capture photo."); return; }
      const { name, mime } = guessNameAndMime(uri, `photo-${Date.now()}.jpg`);
      await uploadAndProcess(uri, name, mime, "image");
    } catch (err) {
      console.error("takePhoto error:", err);
      Alert.alert("Error", "Unable to take photo.");
    }
  };

  return (
    <Modal
      isVisible={mode !== "closed"}
      onBackdropPress={() => !loading && onClose()}
      onSwipeComplete={() => !loading && onClose()}
      swipeDirection={["down"]}
      avoidKeyboard
      style={styles.modal}
    >
      <View style={styles.sheet}>
        <View style={styles.drag} />
        <Text style={styles.title}>{mode === "pdf" ? "Upload PDF" : "Upload Image"}</Text>

        {loading ? (
          <View style={{ alignItems: "center", marginTop: 30 }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Uploading & Processing...</Text>
          </View>
        ) : mode === "pdf" ? (
          <>
            <Pressable style={styles.option} onPress={onPickDocument}>
              <Ionicons name="document-text-outline" size={20} color={colors.primary} />
              <Text style={styles.optionText}>Choose File</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable style={styles.option} onPress={onTakePhoto}>
              <Ionicons name="camera-outline" size={20} color={colors.primary} />
              <Text style={styles.optionText}>Take Photo</Text>
            </Pressable>

            <Pressable style={styles.option} onPress={onPickImageLibrary}>
              <Ionicons name="images-outline" size={20} color={colors.secondary} />
              <Text style={styles.optionText}>Choose from Gallery</Text>
            </Pressable>
          </>
        )}

        <Pressable style={styles.cancel} onPress={() => !loading && onClose()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { justifyContent: "flex-end", margin: 0 },
  sheet: {
    height: "45%",
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  drag: { width: 48, height: 5, backgroundColor: "#444", borderRadius: 5, alignSelf: "center", marginBottom: 14 },
  title: { color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: 20 },
  option: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  optionText: { color: colors.text, fontSize: 16, marginLeft: 12 },
  cancel: { marginTop: 25, alignItems: "center" },
  cancelText: { color: colors.textSecondary, fontSize: 15 },
});
