// theme/colors.ts
export const colors = {
  primary: '#6A5ACD',
  secondary: '#00CED1',
  accent: '#4682B4',
  background: '#121212',
  card: '#1E1E1E',
  text: '#FFFFFF',
  textSecondary: '#A9A9A9',
  input: '#2C2C2C',
  border: '#3C3C3C',
  error: '#FF6B6B',
  gradientStart: '#5F4B8B',
  gradientMiddle: '#7B68EE',
  gradientEnd: '#00BFFF',
};

// readonly tuple expected by expo-linear-gradient usage
export const gradientColors: readonly [string, string, string] = [
  colors.gradientStart,
  colors.gradientMiddle,
  colors.gradientEnd,
];

// Default export to silence "missing default export" warnings in some bundlers/routes
export default colors;
