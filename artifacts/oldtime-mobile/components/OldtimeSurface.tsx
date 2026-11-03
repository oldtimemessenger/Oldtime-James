// Metro selects OldtimeSurface.native.tsx on iOS/Android. The web fallback
// loads the real website, not an imitation or a second set of account data.
import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function OldtimeSurface({ appUrl }: { appUrl: string }) {
  return (
    <View style={styles.container}>
      <iframe
        title="Oldtime"
        src={appUrl}
        style={{ width: '100%', height: '100%', border: 0 }}
        allow="camera; microphone; geolocation; fullscreen; autoplay; clipboard-write"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });
