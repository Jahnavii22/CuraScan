// app/(auth)/sign-in.tsx
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSignIn } from "@clerk/clerk-expo";
import { useRouter, Link } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import AuthCard from "../components/AuthCard";
import { colors, gradientColors } from "../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SignInSchema = z.object({
  emailAddress: z.string().email("Invalid email").refine((s) => /@gmail\.com$/i.test(s), { message: "Email must be a @gmail.com address" }),
  password: z.string().min(1, "Password required"),
});
type SignInData = z.infer<typeof SignInSchema>;

const BACKEND_BASE = "http://localhost:5000"; // change to your IP when testing on phone

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<SignInData>({
    resolver: zodResolver(SignInSchema),
    defaultValues: { emailAddress: "", password: "" },
  });

  const callBackendSync = async (clerkUserId: string | null, email: string | null, name?: string) => {
    try {
      const resp = await fetch(`${BACKEND_BASE}/api/users/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerkUserId, email, name }),
      });
      const data = await resp.json();
      if (data?.ok && data?.token) {
        await AsyncStorage.setItem("CURASCAN_JWT", data.token);
        console.log("Stored JWT from backend");
      } else {
        console.warn("Sync response not OK", data);
      }
      return data;
    } catch (e) {
      console.warn("Backend sync error", e);
      return null;
    }
  };

  const onSubmit = async (values: SignInData) => {
    console.log("onSubmit sign-in", values);
    if (!isLoaded) {
      Alert.alert("Please wait", "Auth system is still loading. Try again in a moment.");
      return;
    }
    try {
      const attempt = await signIn.create({ identifier: values.emailAddress, password: values.password });
      console.log("signIn.create response", attempt);

      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        try { await callBackendSync(null, values.emailAddress, undefined); } catch (e) { console.warn("Sign in backend sync error", e); }
        router.replace("/");
      } else {
        Alert.alert("Sign in failed", "Please check credentials or verify your email.");
      }
    } catch (err: any) {
      console.error("Sign-in error:", err);
      const message = err?.errors?.[0]?.message ?? err?.message ?? "Sign in failed";
      Alert.alert("Error", message);
    }
  };

  return (
    <AuthCard>
      <Controller control={control} name="emailAddress" render={({ field: { value, onChange } }) => (
        <>
          <TextInput style={styles.input} placeholder="Email (@gmail.com)" placeholderTextColor={colors.textSecondary} keyboardType="email-address" autoCapitalize="none" value={value} onChangeText={onChange} />
          {errors.emailAddress && <Text style={styles.err}>{errors.emailAddress.message}</Text>}
        </>
      )} />

      <Controller control={control} name="password" render={({ field: { value, onChange } }) => (
        <>
          <View style={styles.passwordWrap}>
            <TextInput style={[styles.input, { paddingRight: 44 }]} placeholder="Password" placeholderTextColor={colors.textSecondary} secureTextEntry={!showPassword} value={value} onChangeText={onChange} autoCapitalize="none" />
            <TouchableOpacity onPress={() => setShowPassword(s => !s)} style={styles.eyeBtn} accessibilityLabel={showPassword ? "Hide password" : "Show password"}>
              <Ionicons name={showPassword ? "eye" : "eye-off"} size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {errors.password && <Text style={styles.err}>{errors.password.message}</Text>}
        </>
      )} />

      <TouchableOpacity onPress={handleSubmit(onSubmit)} style={styles.button} disabled={isSubmitting}>
        <LinearGradient colors={gradientColors as any} style={styles.gradient}>
          <Text style={styles.buttonText}>{isSubmitting ? "Signing in..." : "Sign In"}</Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Don't have an account? </Text>
        <Link href="/(auth)/sign-up" asChild>
          <TouchableOpacity>
            <Text style={styles.link}>Sign Up</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </AuthCard>
  );
}

const styles = StyleSheet.create({
  input: { width: "100%", height: 50, backgroundColor: colors.input, borderRadius: 10, paddingHorizontal: 15, color: colors.text, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  passwordWrap: { width: "100%", position: "relative" },
  eyeBtn: { position: "absolute", right: 12, top: 12, height: 26, width: 26, alignItems: "center", justifyContent: "center" },
  err: { alignSelf: "flex-start", color: colors.error, marginBottom: 6, fontSize: 12 },
  button: { width: "100%", height: 50, borderRadius: 10, overflow: "hidden", marginTop: 12 },
  gradient: { flex: 1, alignItems: "center", justifyContent: "center" },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: "bold" },
  footer: { flexDirection: "row", marginTop: 16 },
  footerText: { color: colors.textSecondary },
  link: { color: colors.primary, fontWeight: "bold" },
});
