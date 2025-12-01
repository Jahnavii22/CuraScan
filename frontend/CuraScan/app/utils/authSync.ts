// app/utils/authSync.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BACKEND_BASE } from "./api";

export async function syncClerkUserToBackend(clerkUser: { id: string; email?: string; fullName?: string }) {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/users/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clerkUserId: clerkUser.id,
        email: clerkUser.email,
        name: clerkUser.fullName,
      }),
    });
    const body = await res.json();
    if (body?.token) {
      await AsyncStorage.setItem("CURASCAN_JWT", body.token);
    }
    return body;
  } catch (err) {
    console.error("syncClerkUserToBackend error:", err);
    throw err;
  }
}

/* Default export to silence Expo Router route warnings if this file lives under app/ */
import React from "react";
export default function _NotARoute(): React.ReactElement | null {
  return null;
}
