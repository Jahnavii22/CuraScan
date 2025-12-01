import { ClerkProvider } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error('Missing Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env');
}

export default function RootLayout() {
  return (
    <ClerkProvider 
      tokenCache={tokenCache}
      publishableKey={CLERK_PUBLISHABLE_KEY}
    >
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Slot />
      </SafeAreaProvider>
    </ClerkProvider>
  );
}
