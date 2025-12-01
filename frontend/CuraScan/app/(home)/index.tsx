// app/(home)/index.tsx
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import { SignedIn, SignedOut, useUser } from "@clerk/clerk-expo";
import { useRouter, Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors, gradientColors } from "../theme/colors";
import UploadSheet from "../components/UploadSheet";
import SignOutButton from "../components/SignOutButton";
import { apiFetch } from "../utils/api";

export default function HomeScreen() {
  const { user } = useUser();
  const router = useRouter();
  const [sheetMode, setSheetMode] = useState<"closed" | "pdf" | "image">("closed");

  useEffect(() => {
    if (user) {
      console.log("User logged in:", user.primaryEmailAddress?.emailAddress);
    }
  }, [user]);

  // Type-safe navigation: use pathname + params object
  const handleDone = async (report: any) => {
    const id = report?._id ?? report?.report?._id ?? report?.id;
    if (id) {
      try {
        // Use object form so TypeScript knows the param structure
        router.push({ pathname: "/results/[id]", params: { id: String(id) } });
      } catch (err) {
        console.error("Navigation error:", err);
        Alert.alert("Navigation failed", "Could not open results screen.");
      }
    } else {
      Alert.alert("Upload complete", "No report ID returned.");
    }
  };

  return (
    <View style={styles.container}>
      <SignedIn>
        <LinearGradient colors={gradientColors} style={styles.header}>
          <Text style={styles.headerTitle}>CuraScan</Text>
          <Ionicons name="notifications-outline" size={24} color="white" />
        </LinearGradient>

        <View style={styles.content}>
          <Text style={styles.welcome}>Welcome {user?.firstName ?? "User"} 👋</Text>
          <Text style={styles.subtitle}>Your AI Blood Report Analyzer</Text>

          <Pressable style={styles.uploadBtn} onPress={() => setSheetMode("pdf")}>
            <Ionicons name="document-text-outline" size={20} color="white" />
            <Text style={styles.uploadText}>Upload PDF Report</Text>
          </Pressable>

          <Pressable style={styles.uploadBtn} onPress={() => setSheetMode("image")}>
            <Ionicons name="image-outline" size={20} color="white" />
            <Text style={styles.uploadText}>Upload Report Image</Text>
          </Pressable>

          <View style={styles.signout}>
            <SignOutButton />
          </View>
        </View>

        <UploadSheet
          mode={sheetMode}
          onClose={() => setSheetMode("closed")}
          onDone={handleDone}
        />
      </SignedIn>

      <SignedOut>
        <View style={styles.center}>
          <Text style={styles.title}>Welcome to CuraScan</Text>
          <View style={styles.linkContainer}>
            <Link href="/(auth)/sign-in" style={styles.link}>Sign In</Link>
            <Link href="/(auth)/sign-up" style={styles.link}>Sign Up</Link>
          </View>
        </View>
      </SignedOut>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    height: 110,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  headerTitle: { color: "white", fontSize: 22, fontWeight: "bold" },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  welcome: { fontSize: 20, color: colors.text, marginBottom: 8 },
  subtitle: { color: colors.textSecondary, marginBottom: 20 },
  uploadBtn: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
    width: "90%",
  },
  uploadText: { color: "white", fontSize: 16, fontWeight: "600", marginLeft: 10 },
  signout: { marginTop: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 24, color: colors.text },
  linkContainer: { flexDirection: "row", marginTop: 20 },
  link: { color: colors.primary, fontSize: 18, marginHorizontal: 10 },
});
