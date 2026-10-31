// node --test tools/lint/   (each check catches its defect and passes a clean model)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { lintModel } from './checks.mjs';

const rules = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'rules.json'), 'utf8'));
let uid = 0;
// cube with every face mapped at 32 px/block on a 512x512 texture (2 texels per Blockbench px)
const cube = (name, from, to, extra = {}) => {
  const s = to.map((v, i) => v - from[i]);
  const f = (w, h) => ({ uv: [0, 0, w * 2, h * 2], texture: 0 });
  return { name, from, to, origin: extra.origin || [0, 0, 0], uuid: `u${++uid}`, type: 'cube',
    faces: { north: f(s[0], s[1]), south: f(s[0], s[1]), east: f(s[2], s[1]), west: f(s[2], s[1]), up: f(s[0], s[2]), down: f(s[0], s[2]) }, ...extra };
};
const model = (elements, { outliner, animations, meta = {} } = {}) => ({
  name: 't', resolution: { width: 512, height: 512 }, textures: [{ width: 512, height: 512, uv_width: 512, uv_height: 512 }],
  elements, outliner: outliner || elements.map((e) => e.uuid), animations: animations || [],
  arffornia: { title: 't', footprint: [2, 2], height: 2, status: 'wip', ports: [], kind: 'scenery', ...meta },
});
const checks = (r, level = 'error') => r.findings.filter((f) => f.level === level).map((f) => f.check);
const base = () => cube('base', [-16, 0, -16], [16, 4, 16]);

test('a clean model passes', () => {
  const r = lintModel(model([base(), cube('tower', [-6, 4, -6], [6, 24, 6])]), rules);
  assert.deepEqual(checks(r), []); assert.equal(r.pass, true);
});

test('interpenetration is an error, a 1 px seat is not, a compound is not', () => {
  assert.ok(checks(lintModel(model([base(), cube('pipe', [-2, 1, -20 + 4], [2, 5, 10])]), rules)).includes('overlap'));
  assert.deepEqual(checks(lintModel(model([base(), cube('cap', [-4, 3, -4], [4, 8, 4])]), rules)), []);
  const oct = [cube('tank#1', [-6, 4, -6], [6, 20, 6]), cube('tank#2', [-6, 4, -6], [6, 20, 6], { origin: [0, 4, 0], rotation: [0, 45, 0] })];
  oct[1].faces.up.texture = null; oct[1].faces.down.texture = null; // hide the twin caps: no z-fight
  assert.deepEqual(checks(lintModel(model([base(), ...oct]), rules)), []);
});

test('a waiver needs a reason and must match', () => {
  const els = [base(), cube('axle', [-1, 2, -15], [1, 6, 15])];
  assert.deepEqual(checks(lintModel(model(els, { meta: { lint: { allow: [{ a: 'axle', b: 'base', why: 'runs in a bearing' }] } } }), rules)), []);
  assert.ok(checks(lintModel(model(els, { meta: { lint: { allow: [{ a: 'axle', b: 'base' }] } } }), rules)).includes('meta'));
});

test('floating parts and tipping', () => {
  assert.ok(checks(lintModel(model([base(), cube('lamp', [-2, 10, -2], [2, 12, 2])]), rules)).includes('floating'));
  const leaning = [cube('foot', [-16, 0, -16], [-12, 2, -12]), cube('arm', [-16, 2, -16], [16, 4, 16])];
  assert.ok(checks(lintModel(model(leaning), rules)).includes('stability'));
});

test('parts outside the block grid', () => {
  assert.ok(checks(lintModel(model([cube('base', [-17, 0, -16], [16, 4, 16])]), rules)).includes('footprint'));
  assert.ok(checks(lintModel(model([base(), cube('mast', [-1, 4, -1], [1, 40, 1])]), rules)).includes('footprint'));
});

test('an animation that drives a part through another is caught, with its time', () => {
  const wall = cube('wall', [-16, 4, 4], [16, 20, 6]);
  const ram = cube('ram', [-2, 8, -8], [2, 12, 2]);
  const bone = { name: 'ram', origin: [0, 0, 0], uuid: 'b1', children: [ram.uuid] };
  const anim = { name: 'push', length: 1, loop: 'loop', animators: { b1: { name: 'ram', type: 'bone', keyframes: [
    { channel: 'position', time: 0, interpolation: 'linear', data_points: [{ x: 0, y: 0, z: 0 }] },
    { channel: 'position', time: 0.5, interpolation: 'linear', data_points: [{ x: 0, y: 0, z: 6 }] },
    { channel: 'position', time: 1, interpolation: 'linear', data_points: [{ x: 0, y: 0, z: 0 }] }] } } };
  // ram rests on the base at y 4..? no: it floats at 8..12, so give it a guide rail
  const rail = cube('rail', [-2, 4, -8], [2, 8, 2]);
  const r = lintModel(model([base(), wall, rail, ram], { outliner: [base().uuid, wall.uuid, rail.uuid, bone], animations: [anim] }), rules);
  const hit = r.findings.find((f) => f.check === 'sweep' && f.parts.includes('wall'));
  assert.ok(hit, JSON.stringify(r.findings)); assert.ok(hit.t > 0.1 && hit.t < 0.9);
});

test('ports must sit on the boundary, centred on a block cell', () => {
  const meta = { kind: 'machine', ports: [{ id: 'in', kind: 'item', face: 'south', cell: [0, 0] }] };
  const good = cube('port_in', [-12, 4, 14], [-4, 12, 16]);
  assert.deepEqual(checks(lintModel(model([base(), good], { meta }), rules)), []);
  const off = cube('port_in', [-10, 4, 14], [-2, 12, 16]);
  assert.ok(checks(lintModel(model([base(), off], { meta }), rules)).includes('ports'));
  assert.ok(checks(lintModel(model([base()], { meta }), rules)).includes('ports'));
});

test('texel density off 32 px/block is an error', () => {
  const c = cube('stretched', [-6, 4, -6], [6, 24, 6]); c.faces.north.uv = [0, 0, 6, 40];
  assert.ok(checks(lintModel(model([base(), c]), rules)).includes('texel'));
});

test('coplanar drawn faces of two parts z-fight', () => {
  const a = cube('panel_a', [-8, 4, -8], [0, 12, 8]), b = cube('panel_b', [-4, 4, -8], [4, 12, 8]);
  const r = lintModel(model([base(), a, b]), rules);
  assert.ok(checks(r).includes('zfight'));
});

test('budget: too many triangles for the footprint', () => {
  const many = Array.from({ length: 300 }, (_, i) => cube(`bolt${i}`, [-16 + (i % 30), 4, -16 + Math.floor(i / 30) * 3], [-15.5 + (i % 30), 5, -15 + Math.floor(i / 30) * 3]));
  assert.ok(checks(lintModel(model([base(), ...many]), rules)).includes('budget'));
});
