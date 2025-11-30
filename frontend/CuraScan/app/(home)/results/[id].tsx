//app/(home)/results/[id].tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Pressable,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, gradientColors } from "../../theme/colors";
import { apiFetch, getReportFileUrl } from "../../utils/api";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Referral = { test?: string; specialist?: string; urgency?: string };
type Report = {
  _id?: string;
  originalName?: string;
  filename?: string;
  processed?: boolean;
  fileType?: string;
  createdAt?: string;
  recommendations?: {
    suggestions?: string[];
    specialist_referrals?: Referral[];
    overall_risk?: string;
  };
  summary?: string;
  mlPredictions?: any[];
};

const RISK_COLORS: Record<string, string> = {
  high: "#C62A2A",
  moderate: "#E59A01",
  low: "#2AA84A",
  unknown: "#3C3C3C",
};

export default function ReportResults() {
  const { id } = useLocalSearchParams() as { id?: string };
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<Report | null>(null);
  const [anomaliesOpen, setAnomaliesOpen] = useState(true);
  const [referralsOpen, setReferralsOpen] = useState(true);

  const loadReport = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/reports/${id}`, { method: "GET" });
      if (!res.ok) {
        Alert.alert("Error", res.body?.msg || "Failed to fetch report");
        setReport(null);
        return;
      }
      setReport(res.body.report ?? res.body);
    } catch (err) {
      console.error("fetch report error", err);
      Alert.alert("Error", "Unable to fetch report");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  if (!id)
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.title}>No report id specified</Text>
      </View>
    );

  if (loading)
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );

  if (!report)
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.title}>Report not found</Text>
      </View>
    );

  const suggestions: string[] = report.recommendations?.suggestions ?? [];
  const referrals: Referral[] = report.recommendations?.specialist_referrals ?? [];
  const risk = (report.recommendations?.overall_risk ?? "unknown") as string;
  const riskLower = String(risk ?? "unknown").toLowerCase();
  const riskColor = RISK_COLORS[riskLower] ?? RISK_COLORS.unknown;

  const openPDF = async () => {
    try {
      const url = getReportFileUrl(id);
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        const r = await fetch(url, { method: "HEAD" });
        if (r.ok) {
          await Linking.openURL(url);
        } else {
          Alert.alert("Cannot open file", "File not reachable from the device.");
        }
      }
    } catch (err) {
      console.error("openFile error", err);
      Alert.alert("Error", "Unable to open file. Check backend URL or network.");
    }
  };

  return (
    <View style={styles.outerContainer}>
      <ScrollView style={[styles.container, { paddingTop: insets.top }]}>
        <LinearGradient colors={gradientColors} style={styles.header}>
          {/* Top row: back button + risk badge */}
          <View style={styles.headerTopRow}>
            <Pressable style={styles.backBtn} onPress={() => router.replace("/")}>
              <Ionicons name="arrow-back" size={20} color="white" />
              <Text style={styles.backText}>Home</Text>
            </Pressable>

            <View style={[styles.riskBadge, { backgroundColor: riskColor }]}>
              <Ionicons
                name={riskLower === "high" ? "alert-circle" : riskLower === "moderate" ? "warning" : "checkmark-circle"}
                size={16}
                color="white"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.riskText}>{String(risk ?? "Unknown").toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>{report.originalName ?? report.filename ?? "Report"}</Text>
          </View>

          <View style={styles.headerRowBottom}>
            <Text style={styles.processedText}>Processed: {report.processed ? "Yes" : "No"}</Text>

            <View style={styles.headerButtons}>
              <Pressable style={styles.headerBtn} onPress={openPDF}>
                <Ionicons name="document-outline" size={18} color="white" />
                <Text style={styles.headerBtnText}>View PDF</Text>
              </Pressable>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          <Pressable style={styles.sectionHeader} onPress={() => setAnomaliesOpen((s) => !s)}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="alert-circle-outline" size={20} color={colors.text} />
              <Text style={styles.sectionTitle}> Flagged anomalies ({suggestions?.length ?? 0})</Text>
            </View>
            <Ionicons name={anomaliesOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.textSecondary} />
          </Pressable>

          {anomaliesOpen && (
            <View style={{ marginBottom: 14 }}>
              {(suggestions ?? []).length === 0 ? (
                <Text style={styles.note}>No flagged anomalies.</Text>
              ) : (
                (suggestions ?? []).map((s: string, idx: number) => (
                  <View key={idx} style={styles.card}>
                    <View style={styles.cardLeft}>
                      <Ionicons name="warning-outline" size={20} color={riskColor} />
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={styles.cardText}>{s}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          <Pressable style={styles.sectionHeader} onPress={() => setReferralsOpen((s) => !s)}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="medkit-outline" size={20} color={colors.text} />
              <Text style={styles.sectionTitle}> Doctor referrals ({referrals?.length ?? 0})</Text>
            </View>
            <Ionicons name={referralsOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.textSecondary} />
          </Pressable>

          {referralsOpen && (
            <View style={{ marginBottom: 120 }}>
              {(referrals ?? []).length === 0 ? (
                <Text style={styles.note}>No doctor referrals.</Text>
              ) : (
                (referrals ?? []).map((r: Referral, idx: number) => (
                  <View key={idx} style={styles.card}>
                    <View style={styles.cardLeft}>
                      <Ionicons name="person-circle-outline" size={20} color={colors.textSecondary} />
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle}>Test: {r.test ?? "—"}</Text>
                      <Text style={styles.cardSub}>Specialist: {r.specialist ?? "General Practitioner"}</Text>
                      <Text
                        style={[
                          styles.cardUrgency,
                          {
                            color:
                              r.urgency === "high"
                                ? RISK_COLORS.high
                                : r.urgency === "moderate"
                                ? RISK_COLORS.moderate
                                : RISK_COLORS.low,
                          },
                        ]}
                      >
                        Urgency: {r.urgency ?? "routine"}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating FAB Home button */}
      <Pressable style={styles.fab} onPress={() => router.replace("/")}>
        <Ionicons name="home-outline" size={20} color="white" />
        <Text style={styles.fabText}>Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: colors.background, position: "relative" },
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    paddingTop: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    backgroundColor: colors.primary,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
  },
  backText: { color: "white", fontWeight: "600", marginLeft: 6 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { color: "white", fontSize: 18, fontWeight: "700", flex: 1, marginRight: 8 },
  headerRowBottom: { marginTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  processedText: { color: "rgba(255,255,255,0.9)", fontSize: 13 },
  headerButtons: { flexDirection: "row", alignItems: "center" },
  headerBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10 },
  headerBtnText: { color: "white", marginLeft: 8, fontWeight: "700", fontSize: 13 },
  riskBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 6, borderRadius: 16 },
  riskText: { color: "white", fontWeight: "700", fontSize: 12 },

  content: { padding: 18 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 16, color: colors.text, fontWeight: "700", marginLeft: 8 },

  note: { color: colors.textSecondary, marginVertical: 8 },

  card: {
    flexDirection: "row",
    backgroundColor: colors.card,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "flex-start",
  },
  cardLeft: { width: 36, alignItems: "center", justifyContent: "center", marginRight: 12 },
  cardBody: { flex: 1 },
  cardTitle: { color: colors.text, fontWeight: "700", marginBottom: 6 },
  cardText: { color: colors.text, lineHeight: 20 },
  cardSub: { color: colors.textSecondary, marginTop: 6 },
  cardUrgency: { marginTop: 6, fontWeight: "700" },

  fab: {
    position: "absolute",
    right: 20,
    bottom: 28,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 30,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  fabText: { color: "white", marginLeft: 8, fontWeight: "700" },

  title: { fontSize: 20, color: colors.text, fontWeight: "700" },
});
