// app/(home)/edit-profile.tsx
import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUser } from '@clerk/clerk-expo';
import colors from '../theme/colors';

const profileSchema = z.object({
  fullName: z.string().min(2, 'Enter a valid name'),
  phone: z.string().min(10, 'Enter valid phone'),
});

type ProfileData = z.infer<typeof profileSchema>;

export default function EditProfile() {
  const { user } = useUser();

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName || '',
      phone: user?.phoneNumbers?.[0]?.phoneNumber || '',
    },
  });

  const onSubmit = (data: ProfileData) => {
    // TODO: persist via Clerk server API or client SDK
    // For now show a confirmation and log
    console.log('Profile update (local):', data);
    Alert.alert('Saved', 'Profile updated locally. Integrate Clerk API to persist.');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={styles.title}>Edit Profile</Text>

      <TextInput
        style={styles.input}
        placeholder="Full Name"
        placeholderTextColor={colors.textSecondary}
        defaultValue={user?.fullName || ''}
        onChangeText={(text) => setValue('fullName', text)}
      />
      {errors.fullName && <Text style={styles.error}>{errors.fullName.message}</Text>}

      <TextInput
        style={styles.input}
        placeholder="Phone Number"
        placeholderTextColor={colors.textSecondary}
        keyboardType="phone-pad"
        defaultValue={user?.phoneNumbers?.[0]?.phoneNumber || ''}
        onChangeText={(text) => setValue('phone', text)}
      />
      {errors.phone && <Text style={styles.error}>{errors.phone.message}</Text>}

      <Pressable style={styles.saveBtn} onPress={handleSubmit(onSubmit)}>
        <Text style={styles.saveText}>Save</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 20 },
  input: {
    backgroundColor: colors.input,
    color: colors.text,
    borderRadius: 10,
    padding: 14,
    marginVertical: 8,
    borderColor: colors.border,
    borderWidth: 1,
  },
  error: { color: colors.error, marginLeft: 6, fontSize: 12 },
  saveBtn: { marginTop: 24, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  saveText: { color: 'white', fontWeight: '700' },
});
