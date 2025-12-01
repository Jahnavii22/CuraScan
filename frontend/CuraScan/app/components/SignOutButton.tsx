
// app/components/SignOutButton.tsx
// A simple, reusable button component that allows users to sign out of the application.
// It uses the useClerk hook to access the signOut function and redirects the user upon completion.

import { useClerk } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { colors } from '../theme/colors';

const SignOutButton = () => {
  const { signOut } = useClerk();
  const router = useRouter();

  const doSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)/sign-in');
    } catch (err) {
      Alert.alert('Error', 'Failed to sign out.');
    }
  };

  return (
    <TouchableOpacity style={styles.button} onPress={doSignOut}>
      <Text style={styles.buttonText}>Sign Out</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SignOutButton;
