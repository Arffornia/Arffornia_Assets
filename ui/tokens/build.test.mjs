import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build, contrast, flatten, resolve } from './build.mjs';

test('resolves references through several levels', () => {
  const tokens = resolve(flatten({ a: { $value: '#000000' }, b: { $value: '{a}' }, c: { $value: '{b}' } }));
  assert.equal(tokens.c, '#000000');
});

test('rejects an unknown reference', () => {
  assert.throws(() => resolve(flatten({ a: { $value: '{missing}' } })), /unknown token reference/);
});

test('rejects a reference cycle', () => {
  assert.throws(() => resolve(flatten({ a: { $value: '{b}' }, b: { $value: '{a}' } })), /cycle/);
});

test('computes WCAG contrast', () => {
  assert.equal(contrast('#000000', '#ffffff').toFixed(1), '21.0');
});

test('every declared contrast pair passes in both themes', () => {
  assert.deepEqual(build().failures, []);
});

test('the CSS has a dark default and a light opt-in with the same semantic names', () => {
  const css = build().files['tokens.css'];
  const names = (block) => [...block.matchAll(/--arf-([a-z-]+):/g)].map((m) => m[1]).sort();
  const [dark, light] = css.split('[data-theme="light"]');
  assert.deepEqual(names(light), names(dark.slice(dark.indexOf(':root, [data-theme="dark"]'))));
});

test('Java constants are ARGB with full alpha', () => {
  assert.match(build().files['ArfTokens.java'], /public static final int DARK_ACCENT = 0xFFFF7300;/);
});
