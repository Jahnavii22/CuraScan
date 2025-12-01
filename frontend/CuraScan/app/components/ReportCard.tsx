// app/components/ReportCard.tsx
import React from "react";
import { View, Text, StyleSheet, Pressable, Image } from "react-native";
import { colors } from "../theme/colors";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  report: any;
  onPress?: () => void;
};

export default function ReportCard({ report, onPress }: Props) {
  const flags = (report?.recommendations?.suggestions?.length ?? 0) || (report?.mlPredictions?.filter((p:any)=>p.prediction!=="normal")?.length ?? 0);
  const summary = report?.recommendations?.overall_risk ?? (flags ? (flags > 1 ? "moderate" : "low") : "low");

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.left}>
        <Image
          source={require("../../assets/images/CuraScan.png")}
          style={styles.thumb}
        />
      </View>

      <View style={styles.middle}>
        <Text style={styles.title}>{report?.originalName ?? report?.filename ?? "Report"}</Text>
        <Text numberOfLines={2} style={styles.subtitle}>
          {report?.createdAt ? new Date(report.createdAt).toLocaleString() : ""}
          {" • "}
          {report?.fileType?.toUpperCase?.() ?? "PDF"}
        </Text>
        <Text style={styles.small}>{report?.summary ?? report?.recommendations?.overall_risk ? `Risk: ${String(summary).toUpperCase()}` : ""}</Text>
      </View>

      <View style={styles.right}>
        <View style={[styles.badge, summary === "high" ? styles.badgeHigh : summary === "moderate" ? styles.badgeModerate : styles.badgeLow]}>
          <Text style={styles.badgeText}>{String(summary).toUpperCase()}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: 12,
    marginVertical: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  left: { marginRight: 12 },
  thumb: { width: 48, height: 48, borderRadius: 8 },
  middle: { flex: 1 },
  title: { color: colors.text, fontSize: 16, fontWeight: "700" },
  subtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  small: { color: colors.textSecondary, fontSize: 12, marginTop: 6 },
  right: { alignItems: "flex-end", marginLeft: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginBottom: 6 },
  badgeText: { color: "white", fontSize: 11, fontWeight: "700" },
  badgeHigh: { backgroundColor: "#C62A2A" },
  badgeModerate: { backgroundColor: "#E59A01" },
  badgeLow: { backgroundColor: "#2AA84A" },
});
