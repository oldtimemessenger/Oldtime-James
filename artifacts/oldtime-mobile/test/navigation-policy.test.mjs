import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateAppUrl, navigationAction } from '../lib/navigation-policy.mjs';

const appUrl = 'https://oldtime.test/';

test('only the configured secure origin stays inside the account WebView', () => {
  assert.equal(navigationAction('https://oldtime.test/profile?a=1', appUrl), 'internal');
  for (const url of ['https://oldtime.test.attacker.test/', 'https://other.test/', 'mailto:help@oldtime.test', 'tel:+1234']) {
    assert.equal(navigationAction(url, appUrl), 'external');
  }
  for (const url of ['javascript:alert(1)', 'file:///private/key', 'intent://host/', 'data:text/html,test', 'http://oldtime.test/', 'invalid']) {
    assert.equal(navigationAction(url, appUrl), 'blocked');
  }
});

test('configuration rejects insecure origins and embedded credentials', () => {
  assert.equal(validateAppUrl(appUrl), appUrl);
  for (const url of ['http://oldtime.test', 'https://user:pass@oldtime.test', 'https://oldtime.test/?token=abc', 'https://oldtime.test/#token', undefined]) {
    assert.throws(() => validateAppUrl(url));
  }
});

test('wrapper keeps native navigation, media permissions and account storage', () => {
  const source = readFileSync(new URL('../components/OldtimeSurface.native.tsx', import.meta.url), 'utf8');
  assert.match(source, /hardwareBackPress/);
  assert.match(source, /domStorageEnabled/);
  assert.match(source, /mediaCapturePermissionGrantType="prompt"/);
  assert.match(source, /mixedContentMode="never"/);
  assert.match(source, /onContentProcessDidTerminate/);
  assert.doesNotMatch(source, /injectedJavaScriptBeforeContentLoaded|postMessage|clearCache|clearHistory/);
});
