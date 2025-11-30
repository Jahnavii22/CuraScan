// app/(auth)/sign-up.tsx
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSignUp } from "@clerk/clerk-expo";
import { useRouter, Link } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import AuthCard from "../components/AuthCard";
import { colors, gradientColors } from "../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

const complexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

const SignUpSchema = z
  .object({
    firstName: z.string().min(1, "First name required"),
    lastName: z.string().min(1, "Last name required"),
    username: z.string().min(3, "Username must be at least 3 characters").max(30, "Username too long"),
    emailAddress: z.string().email("Invalid email").refine((s) => /@gmail\.com$/i.test(s), { message: "Email must be a @gmail.com address" }),
    password: z.string().min(8, "Password must be at least 8 characters").regex(complexityRegex, "Must include uppercase, lowercase, number and special character"),
  })
  .superRefine((vals, ctx) => {
    if (vals.username && vals.password && vals.username === vals.password) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Username and password must not be the same", path: ["password"] });
    }
  });

type SignUpData = z.infer<typeof SignUpSchema>;

const BACKEND_BASE = "http://localhost:5000"; // << change to your IP when using phone: http://192.168.29.243:5000

export default function SignUpScreen() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState<string>("");
  const [createdSignUp, setCreatedSignUp] = useState<any>(null);

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<SignUpData>({
    resolver: zodResolver(SignUpSchema),
    defaultValues: { firstName: "", lastName: "", username: "", emailAddress: "", password: "" },
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

  const onSubmit = async (values: SignUpData) => {
    console.log("onSubmit called", values);
    if (!isLoaded) {
      Alert.alert("Please wait", "Auth system is still loading. Try again in a moment.");
      return;
    }
    try {
      const created = await signUp.create({
        firstName: values.firstName,
        lastName: values.lastName,
        username: values.username,
        emailAddress: values.emailAddress,
        password: values.password,
      });
      console.log("signUp.create ->", created);
      setCreatedSignUp(created);

      // send verification code to the email
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setSubmittedEmail(values.emailAddress);
      setPendingVerification(true);
      Alert.alert("Verification", "Verification code sent to your email. Please check and enter it.");
    } catch (err: any) {
      console.error("Sign up error:", err);
      const message = err?.errors?.[0]?.message ?? err?.message ?? "Sign up failed";
      Alert.alert("Sign up error", message);
    }
  };

  const onVerifyPress = async () => {
    if (!isLoaded) return;
    try {
      const complete = await signUp.attemptEmailAddressVerification({ code: verificationCode });
      console.log("attemptEmailAddressVerification ->", complete);

      if (complete.status === "complete") {
        await setActive({ session: complete.createdSessionId });

        const clerkUserId = complete?.createdUserId ?? null;
        const name = undefined;

        await callBackendSync(clerkUserId, submittedEmail || null, name);

        router.replace("/");
      } else {
        Alert.alert("Verification incomplete", "Please try again or resend the code.");
      }
    } catch (err: any) {
      console.error("verification error", err);
      const message = err?.errors?.[0]?.message ?? err?.message ?? "Verification failed";
      Alert.alert("Verification error", message);
    }
  };

  return (
    <AuthCard>
      {!pendingVerification ? (
        <>
          <Controller control={control} name="firstName" render={({ field: { value, onChange } }) => (
            <>
              <TextInput style={styles.input} placeholder="First Name" placeholderTextColor={colors.textSecondary} value={value} onChangeText={onChange} />
              {errors.firstName && <Text style={styles.err}>{errors.firstName.message}</Text>}
            </>
          )} />

          <Controller control={control} name="lastName" render={({ field: { value, onChange } }) => (
            <>
              <TextInput style={styles.input} placeholder="Last Name" placeholderTextColor={colors.textSecondary} value={value} onChangeText={onChange} />
              {errors.lastName && <Text style={styles.err}>{errors.lastName.message}</Text>}
            </>
          )} />

          <Controller control={control} name="username" render={({ field: { value, onChange } }) => (
            <>
              <TextInput style={styles.input} placeholder="Username" placeholderTextColor={colors.textSecondary} autoCapitalize="none" value={value} onChangeText={onChange} />
              {errors.username && <Text style={styles.err}>{errors.username.message}</Text>}
            </>
          )} />

          <Controller control={control} name="emailAddress" render={({ field: { value, onChange } }) => (
            <>
              <TextInput style={styles.input} placeholder="Email (@gmail.com only)" placeholderTextColor={colors.textSecondary} autoCapitalize="none" keyboardType="email-address" value={value} onChangeText={onChange} />
              {errors.emailAddress && <Text style={styles.err}>{errors.emailAddress.message}</Text>}
            </>
          )} />

          <Controller control={control} name="password" render={({ field: { value, onChange } }) => (
            <>
              <View style={styles.passwordWrap}>
                <TextInput style={[styles.input, { paddingRight: 44 }]} placeholder="Password (min 8 chars)" placeholderTextColor={colors.textSecondary} secureTextEntry={!showPassword} value={value} onChangeText={onChange} autoCapitalize="none" />
                <TouchableOpacity onPress={() => setShowPassword(s => !s)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? "eye" : "eye-off"} size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={styles.err}>{errors.password.message}</Text>}
            </>
          )} />

          <TouchableOpacity onPress={handleSubmit(onSubmit)} style={styles.button} disabled={isSubmitting}>
            <LinearGradient colors={gradientColors as any} style={styles.gradient}>
              <Text style={styles.buttonText}>{isSubmitting ? "Creating..." : "Create Account"}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/sign-in" asChild>
              <TouchableOpacity>
                <Text style={styles.link}>Sign In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.verifyNote}>Enter the verification code sent to your email</Text>

          <TextInput style={styles.input} placeholder="Verification code" placeholderTextColor={colors.textSecondary} value={verificationCode} onChangeText={setVerificationCode} keyboardType="numeric" />

          <TouchableOpacity onPress={onVerifyPress} style={styles.button}>
            <LinearGradient colors={gradientColors as any} style={styles.gradient}>
              <Text style={styles.buttonText}>Verify</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ marginTop: 12 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Didn't receive a code? Use Clerk Dashboard or resend flow (if implemented).</Text>
          </View>
        </>
      )}
    </AuthCard>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: "bold", color: colors.text, marginBottom: 10, textAlign: "center" },
  verifyNote: { color: colors.textSecondary, marginBottom: 12, textAlign: "center" },
  input: {
    width: "100%", height: 50, backgroundColor: colors.input, borderRadius: 10, paddingHorizontal: 15, color: colors.text, marginBottom: 8, borderWidth: 1, borderColor: colors.border,
  },
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
