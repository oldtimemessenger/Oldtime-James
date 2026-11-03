import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('browser preview fills its viewport without native safe-area padding', () => {
  const screen = readFileSync(new URL('../app/index.tsx', import.meta.url), 'utf8');
  assert.match(screen, /edges=\{Platform\.OS === 'web' \? \[\] : \['top', 'bottom'\]\}/);
  assert.doesNotMatch(screen, /webInsets|paddingTop:\s*67|paddingBottom:\s*34/);
  const surface = readFileSync(new URL('../components/OldtimeSurface.tsx', import.meta.url), 'utf8');
  assert.match(surface, /width: '100%', height: '100%', border: 0/);
});
