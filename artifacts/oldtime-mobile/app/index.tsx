import React from 'react';
import Constants from 'expo-constants';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import OldtimeSurface from '@/components/OldtimeSurface';
import { useColors } from '@/hooks/useColors';
import { validateAppUrl } from '@/lib/navigation-policy.mjs';

export default function OldtimeScreen() {
  const colors = useColors();
  const appUrl = validateAppUrl(Constants.expoConfig?.extra?.oldtimeUrl);
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="dark" />
      <SafeAreaView edges={Platform.OS === 'web' ? [] : ['top', 'bottom']} style={styles.container}>
        <OldtimeSurface appUrl={appUrl} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
