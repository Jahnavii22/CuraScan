// app/screens/SettingsBackend.tsx
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "../theme/colors";

export default function SettingsBackend() {
  const [url, setUrl] = useState("");
  useEffect(() => {
    (async () => {
      const v = await AsyncStorage.getItem("CURASCAN_BACKEND");
      if (v) setUrl(v);
    })();
  }, []);

  const save = async () => {
    const cleaned = (url || "").trim().replace(/\/$/, "");
    if (!cleaned) {
      await AsyncStorage.removeItem("CURASCAN_BACKEND");
      Alert.alert("Saved", "Backend URL cleared; app will use fallback.");
      return;
    }
    try {
      await AsyncStorage.setItem("CURASCAN_BACKEND", cleaned);
      Alert.alert("Saved", `Using backend: ${cleaned}`);
    } catch (e) {
      Alert.alert("Error", "Unable to save URL");
    }
  };

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 8 }}>Backend URL</Text>
      <TextInput
        value={url}
        onChangeText={setUrl}
        placeholder="https://xxxxx.ngrok-free.dev or https://api.yourdomain.com"
        placeholderTextColor="#888"
        style={{ backgroundColor: colors.card, padding: 12, borderRadius: 8, color: colors.text }}
        autoCapitalize="none"
      />
      <Pressable onPress={save} style={{ marginTop: 12, backgroundColor: colors.primary, padding: 12, borderRadius: 8 }}>
        <Text style={{ color: "white", fontWeight: "700", textAlign: "center" }}>Save</Text>
      </Pressable>
      <Text style={{ color: colors.textSecondary, marginTop: 12 }}>
        Paste the ngrok or deployed backend URL here so the app can talk to your backend even when you switch Wi-Fi.
      </Text>
    </View>
  );
}
