//app/(auth)/_layout.tsx
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo'; // <-- fixed: removed leading space

export default function AuthLayout() {
  const { isSignedIn } = useAuth();

  if (isSignedIn) {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
