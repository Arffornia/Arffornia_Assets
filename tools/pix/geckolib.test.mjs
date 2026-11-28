// node --test tools/pix/geckolib.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { toGeckoLib } from './geckolib.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const face = (u0, v0, u1, v1) => ({ uv: [u0, v0, u1, v1], texture: 0 });
const el = (name, from, to, extra = {}) => ({
  name, from, to, origin: [0, 0, 0], uuid: name, type: 'cube',
  faces: { north: face(0, 0, 3, 4), south: face(4, 0, 7, 4), east: face(8, 0, 14, 4), west: face(15, 0, 21, 4), up: face(22, 0, 25, 6), down: face(26, 0, 29, 6) },
  ...extra,
});
const bbmodel = ({ elements, outliner, animations = [] }) => ({ resolution: { width: 64, height: 32 }, elements, outliner, animations });
const bonesOf = (geo) => Object.fromEntries(geo['minecraft:geometry'][0].bones.map((b) => [b.name, b]));

test('a cube is mirrored on x into Bedrock space', () => {
  const { geo } = toGeckoLib(bbmodel({ elements: [el('a', [1, 2, 3], [4, 6, 9])], outliner: ['a'] }), 't');

  const c = bonesOf(geo).body.cubes[0];

  assert.deepEqual([c.origin, c.size], [[-4, 2, 3], [3, 4, 6]]);
});

test('up and down UVs start at their far corner with a negative size, side faces do not', () => {
  const { geo } = toGeckoLib(bbmodel({ elements: [el('a', [0, 0, 0], [3, 4, 6])], outliner: ['a'] }), 't');

  const { uv } = bonesOf(geo).body.cubes[0];

  assert.deepEqual([uv.north, uv.up, uv.down], [{ uv: [0, 0], uv_size: [3, 4] }, { uv: [25, 6], uv_size: [-3, -6] }, { uv: [29, 6], uv_size: [-3, -6] }]);
});

test('a hidden face is left out', () => {
  const hidden = el('a', [0, 0, 0], [3, 4, 6]); hidden.faces.east = { uv: [0, 0, 0, 0], texture: null };
  const { geo } = toGeckoLib(bbmodel({ elements: [hidden], outliner: ['a'] }), 't');

  assert.equal('east' in bonesOf(geo).body.cubes[0].uv, false);
});

test('a rotated cube keeps its pivot and turns the other way on x and y', () => {
  const rotated = el('a', [0, 0, 0], [2, 2, 2], { origin: [1, 1, 1], rotation: [10, 20, 30] });
  const { geo } = toGeckoLib(bbmodel({ elements: [rotated], outliner: ['a'] }), 't');

  const c = bonesOf(geo).body.cubes[0];

  assert.deepEqual([c.pivot, c.rotation], [[-1, 1, 1], [-10, -20, 30]]);
});

test('groups become bones with their parent, pivot and rest rotation', () => {
  const outliner = [{ name: 'drum', origin: [5, 8, 0], rotation: [0, 0, -3], uuid: 'g1', children: ['a', { name: 'hatch', origin: [6, 9, 1], uuid: 'g2', children: ['b'] }] }];
  const { geo } = toGeckoLib(bbmodel({ elements: [el('a', [0, 0, 0], [1, 1, 1]), el('b', [0, 0, 0], [1, 1, 1])], outliner }), 't');

  const bones = bonesOf(geo);

  assert.deepEqual([bones.drum.pivot, bones.drum.rotation, bones.hatch.parent, bones.hatch.pivot], [[-5, 8, 0], [0, 0, -3], 'drum', [-6, 9, 1]]);
});

test('two bones with the same name are refused', () => {
  const outliner = [{ name: 'x', origin: [0, 0, 0], children: ['a'] }, { name: 'x', origin: [0, 0, 0], children: ['b'] }];

  assert.throws(() => toGeckoLib(bbmodel({ elements: [el('a', [0, 0, 0], [1, 1, 1]), el('b', [0, 0, 0], [1, 1, 1])], outliner }), 't'), /duplicate bone/);
});

test('animations keep their keyframe values, sorted by time, with the GeckoLib loop modes', () => {
  const kf = (channel, time, [x, y, z]) => ({ channel, time, interpolation: 'linear', data_points: [{ x, y, z }] });
  const animations = [
    { name: 'working', loop: 'loop', length: 4, animators: { u: { name: 'lid', type: 'bone', keyframes: [kf('rotation', 2, [-90, 0, 0]), kf('rotation', 0, [0, 0, 0])] } } },
    { name: 'deploy', loop: 'hold', length: 3, animators: {} },
  ];
  const outliner = [{ name: 'lid', origin: [0, 0, 0], children: ['a'] }];
  const { animation } = toGeckoLib(bbmodel({ elements: [el('a', [0, 0, 0], [1, 1, 1])], outliner, animations }), 'kiln');

  const working = animation.animations['animation.kiln.working'];

  assert.deepEqual([working.loop, Object.entries(working.bones.lid.rotation), animation.animations['animation.kiln.deploy'].loop],
    [true, [['0', [0, 0, 0]], ['2', [-90, 0, 0]]], 'hold_on_last_frame']);
});

test('a step keyframe is refused instead of exported wrong', () => {
  const animations = [{ name: 'w', loop: 'loop', length: 1, animators: { u: { name: 'lid', keyframes: [{ channel: 'position', time: 0, interpolation: 'step', data_points: [{ x: 0, y: 0, z: 0 }] }] } } }];
  const outliner = [{ name: 'lid', origin: [0, 0, 0], children: ['a'] }];

  assert.throws(() => toGeckoLib(bbmodel({ elements: [el('a', [0, 0, 0], [1, 1, 1])], outliner, animations }), 't'), /step/);
});

test('geo2bb reads the export back to the same cubes and UVs', () => {
  const rotated = el('b', [2, 0, -3], [5, 2, 1], { origin: [3, 1, 0], rotation: [0, 45, 0] });
  const outliner = [{ name: 'part', origin: [0, 0, 0], children: ['a', 'b'] }];
  const { geo } = toGeckoLib(bbmodel({ elements: [el('a', [-8, 0, -8], [8, 4, 8]), rotated], outliner }), 't');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'geckolib-'));
  fs.writeFileSync(path.join(dir, 'm.geo.json'), JSON.stringify(geo)); fs.writeFileSync(path.join(dir, 'm.png'), '');

  execFileSync('node', [path.join(HERE, 'geo2bb.mjs'), path.join(dir, 'm.geo.json'), path.join(dir, 'm.png'), path.join(dir, 'm.bbmodel')]);
  const back = JSON.parse(fs.readFileSync(path.join(dir, 'm.bbmodel'), 'utf8')).elements;

  const shape = (e) => ({ from: e.from, to: e.to, faces: Object.fromEntries(Object.entries(e.faces).map(([k, f]) => [k, f.uv])) });
  assert.deepEqual([...back.map(shape), back[1].origin, back[1].rotation],
    [shape(el('a', [-8, 0, -8], [8, 4, 8])), shape(rotated), [3, 1, 0], [0, 45, 0]]);
});
