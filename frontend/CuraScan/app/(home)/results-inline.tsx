// app/(home)/results-inline.tsx
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { colors, gradientColors } from "../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

export default function ResultsInline() {
  const router = useRouter();
  const [payload, setPayload] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("CURASCAN_INLINE_REPORT");
        if (!raw) {
          Alert.alert("No data", "No inline report found.");
          router.replace("/");
          return;
        }
        setPayload(JSON.parse(raw));
      } catch (e) {
        console.error("results-inline load error", e);
        Alert.alert("Error", "Unable to load inline report.");
        router.replace("/");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  if (!payload) return null;

  const pipeline = payload.pipeline ?? payload;
  const recs = payload.recommendations ?? payload;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient colors={gradientColors} style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={() => router.replace("/")} style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="arrow-back" size={20} color="white" />
            <Text style={{ color: "white", marginLeft: 8, fontWeight: "700" }}>Home</Text>
          </Pressable>
          <Text style={{ color: "white", fontWeight: "700" }}>Inline Results</Text>
        </View>
      </LinearGradient>

      <ScrollView style={{ padding: 16 }}>
        <Text style={styles.sectionTitle}>Pipeline Summary</Text>
        <View style={styles.card}>
          <Text style={styles.cardText}>{pipeline.summary ?? "No summary"}</Text>
        </View>

        <Text style={styles.sectionTitle}>Flagged tests / extracted values</Text>
        {(pipeline.tests ?? []).map((t: any, idx: number) => (
          <View key={idx} style={styles.smallCard}>
            <Text style={styles.cardTitle}>{t.name}</Text>
            <Text style={styles.cardSub}>Value: {t.value} {t.unit ?? ""}</Text>
            <Text style={styles.cardSub}>Status: {t.status ?? "-"}</Text>
            {t.advice?.map((a: string, i: number) => <Text key={i} style={styles.cardSub}>• {a}</Text>)}
          </View>
        ))}

        <Text style={styles.sectionTitle}>Recommendations</Text>
        {(recs.suggestions ?? []).map((s: string, i: number) => (
          <View key={i} style={styles.smallCard}>
            <Text style={styles.cardText}>• {s}</Text>
          </View>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Specialist referrals</Text>
        {(recs.specialist_referrals ?? []).map((r: any, i: number) => (
          <View key={i} style={styles.smallCard}>
            <Text style={styles.cardTitle}>{r.test ?? r.name ?? "Test"}</Text>
            <Text style={styles.cardSub}>Specialist: {r.specialist}</Text>
            <Text style={styles.cardSub}>Urgency: {r.urgency}</Text>
          </View>
        ))}

        <Pressable style={styles.doneBtn} onPress={() => { AsyncStorage.removeItem("CURASCAN_INLINE_REPORT"); router.replace("/"); }}>
          <Text style={{ color: "white", fontWeight: "700" }}>Done</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 8 },

  card: { padding: 14, backgroundColor: colors.card, borderRadius: 10, marginBottom: 12 },
  smallCard: { padding: 12, backgroundColor: colors.card, borderRadius: 8, marginBottom: 8 },

  cardText: { color: colors.text },
  cardTitle: { color: colors.text, fontWeight: "700" },
  cardSub: { color: colors.textSecondary, marginTop: 4 },

  doneBtn: {
    marginTop: 18,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
});
