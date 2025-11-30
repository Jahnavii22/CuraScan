//app/components/AuthCard.tsx
import React from 'react';
import { View, Text, StyleSheet, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { colors } from '../theme/colors';

const AuthCard = ({ children }: { children: React.ReactNode }) => {
  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <View style={styles.card}>
        <Image 
          source={require('../../assets/images/CuraScan.png')} 
          style={styles.logo} 
        />
        <Text style={styles.tagline}>Your AI Blood Report Analyzer</Text>
        {children}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 16,
    backgroundColor: colors.card,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    elevation: 8,
  },
  logo: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
    marginBottom: 12,
  },
  tagline: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
});

export default AuthCard;
