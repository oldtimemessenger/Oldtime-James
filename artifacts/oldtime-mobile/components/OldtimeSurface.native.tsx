import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, BackHandler, Linking, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useColors } from '@/hooks/useColors';
import { navigationAction } from '@/lib/navigation-policy.mjs';

export default function OldtimeSurface({ appUrl }: { appUrl: string }) {
  const colors = useColors();
  const webview = useRef<WebView<{}>>(null);
  const canGoBack = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack.current || error) return false;
      webview.current?.goBack();
      return true;
    });
    return () => sub.remove();
  }, [error]);

  const openExternal = async (url: string) => {
    if (navigationAction(url, appUrl) !== 'external') return;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Link unavailable', 'This link could not be opened on your device.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <WebView<{}>
        ref={webview}
        testID="oldtime-webview"
        source={{ uri: appUrl }}
        style={styles.container}
        originWhitelist={['https://*', 'mailto:*', 'tel:*']}
        onShouldStartLoadWithRequest={request => {
          if (request.isTopFrame === false) return true;
          const action = navigationAction(request.url, appUrl);
          if (action === 'external') void openExternal(request.url);
          return action === 'internal';
        }}
        onOpenWindow={({ nativeEvent }) => {
          if (navigationAction(nativeEvent.targetUrl, appUrl) === 'internal') {
            // Open same-origin links in the existing authenticated WebView.
            const target = JSON.stringify(nativeEvent.targetUrl).replace(/</g, '\\u003c');
            webview.current?.injectJavaScript(`window.location.assign(${target}); true;`);
          } else {
            void openExternal(nativeEvent.targetUrl);
          }
        }}
        onNavigationStateChange={state => { canGoBack.current = state.canGoBack; }}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => { setLoading(false); setError('Check your connection and try again. Your account and posts remain on Oldtime.'); }}
        onHttpError={({ nativeEvent }) => {
          if (nativeEvent.statusCode >= 500 && navigationAction(nativeEvent.url, appUrl) === 'internal') {
            setLoading(false);
            setError('Oldtime is temporarily unavailable. Please try again.');
          }
        }}
        onContentProcessDidTerminate={() => {
          setLoading(false);
          setError('Oldtime needs to reload. Unsent edits may need to be reopened.');
        }}
        onFileDownload={({ nativeEvent }) => {
          if (navigationAction(nativeEvent.downloadUrl, appUrl) === 'blocked') return;
          Alert.alert('Open download', 'Open this download in your browser? You may need to sign in there.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open browser', onPress: () => {
              void Linking.openURL(nativeEvent.downloadUrl).catch(() =>
                Alert.alert('Download unavailable', 'Try downloading this media in your browser.'));
            } },
          ]);
        }}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled={false}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction
        mediaCapturePermissionGrantType="prompt"
        geolocationEnabled
        mixedContentMode="never"
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        javaScriptCanOpenWindowsAutomatically={false}
        allowsBackForwardNavigationGestures
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        webviewDebuggingEnabled={__DEV__}
      />
      {loading && !error && (
        <View pointerEvents="none" style={[styles.loading, { backgroundColor: colors.background }]}>
          <ActivityIndicator accessibilityLabel="Loading Oldtime" color={colors.primary} />
        </View>
      )}
      {error && (
        <View style={[styles.error, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Couldn’t open Oldtime</Text>
          <Text style={[styles.message, { color: colors.mutedForeground }]}>{error}</Text>
          <Pressable
            testID="oldtime-retry"
            accessibilityRole="button"
            onPress={() => { setError(null); setLoading(true); webview.current?.reload(); }}
            style={({ pressed }) => [styles.retry, { backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 }]}
          >
            <Text style={{ color: colors.primaryForeground, fontWeight: '600' }}>Try again</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  error: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
  title: { fontSize: 21, fontWeight: '600', textAlign: 'center' },
  message: { fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 340 },
  retry: { borderRadius: 24, paddingHorizontal: 28, paddingVertical: 14, marginTop: 6 },
});
