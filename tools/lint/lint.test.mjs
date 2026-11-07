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

// ---------------------------------------------------------------- mechanics (tools/lint/mechanics.mjs)
const post = () => cube('post', [-2, 4, -2], [2, 20, 2]);
const bone = (name, origin, els) => ({ name, origin, uuid: `b-${name}`, children: els.map((e) => e.uuid) });
const rotKeys = (bname, frames, interpolation = 'linear', channel = 'rotation') => ({ [`b-${bname}`]: { name: bname, type: 'bone',
  keyframes: frames.map(([time, v]) => ({ channel, time, interpolation, data_points: [{ x: v[0], y: v[1], z: v[2] }] })) } });

test('cantilever: a long thin arm off its support, and a heavy part hung on a corner', () => {
  const thin = cube('arm', [-2, 20, -1], [15, 21, 1]);
  const r = lintModel(model([base(), post(), thin]), rules);
  assert.ok(r.findings.some((f) => f.check === 'cantilever' && f.level === 'error' && f.ratio > 10), JSON.stringify(r.findings));
  const stout = cube('arm', [-2, 20, -2], [8, 24, 2]); // 6 px past the post, 4 px deep: fine
  assert.deepEqual(checks(lintModel(model([base(), post(), stout]), rules)), []);
  const corner = cube('box', [2, 20, 2], [12, 26, 12]); // touches the post at one corner only
  assert.ok(lintModel(model([base(), post(), corner]), rules).findings.some((f) => f.check === 'cantilever' && f.stress > rules.seatStressMax));
  const waived = { lint: { allow: [{ a: 'arm', check: 'cantilever', why: 'a sprung antenna' }] } };
  assert.deepEqual(checks(lintModel(model([base(), post(), thin], { meta: waived }), rules)), []);
});

// two pulleys of radius 4 px on z axles, centres 16 px apart, held by stands behind them
const drive = ({ top = [16, 17], spinB = 360, rB = 4 } = {}) => {
  const pa = cube('pa', [-12, 8, -1], [-4, 16, 1]);
  const pb = cube('pb', [8 - rB, 12 - rB, -1], [8 + rB, 12 + rB, 1]);
  const els = [base(), cube('stand_a', [-9, 4, 1], [-7, 12, 3]), cube('stand_b', [7, 4, 1], [9, 12, 3]), pa, pb,
    cube('run_top', [-8, top[0], -1], [8, top[1], 1]), cube('run_bottom', [-8, 7, -1], [8, 8, 1])];
  const outliner = [els[0].uuid, els[1].uuid, els[2].uuid, bone('pa', [-8, 12, 0], [pa]), bone('pb', [8, 12, 0], [pb]), els[5].uuid, els[6].uuid];
  const animations = [{ name: 'run', length: 2, loop: 'loop', animators: { ...rotKeys('pa', [[0, [0, 0, 0]], [2, [0, 0, 360]]]), ...rotKeys('pb', [[0, [0, 0, 0]], [2, [0, 0, spinB]]]) } }];
  const joints = { pa: { type: 'revolute', axis: 'z' }, pb: { type: 'revolute', axis: 'z' } };
  return model(els, { outliner, animations, meta: { joints, belts: [{ id: 'main', pulleys: ['pa', 'pb'], segments: ['run_top', 'run_bottom'] }] } });
};

test('belts: tangent runs pass; a run off the wheel, a slipping ratio and a poor wrap fail', () => {
  assert.deepEqual(checks(lintModel(drive(), rules)).filter((c) => c === 'belt'), []);
  assert.ok(checks(lintModel(drive({ top: [18, 19] }), rules)).includes('belt'));
  assert.ok(lintModel(drive({ spinB: 180 }), rules).findings.some((f) => f.check === 'belt' && /rim speeds/.test(f.msg)));
  const wrap = model([base()], { meta: { belts: [{ id: 'w', pulleys: [{ part: 'big', r: 11 }, { part: 'small', r: 2 }], segments: [] }] } });
  wrap.elements.push(cube('big', [-14, 4, -1], [2, 20, 1]), cube('small', [8, 10, -1], [12, 14, 1]));
  wrap.outliner = wrap.elements.map((e) => e.uuid);
  assert.ok(lintModel(wrap, rules).findings.some((f) => f.check === 'belt' && /wraps/.test(f.msg) && f.level === 'error'));
});

test('gears: centre distance must equal the sum of pitch radii', () => {
  const g = (dx) => model([base(), cube('g1', [-8, 4, -1], [0, 12, 1]), cube('g2', [dx, 4, -1], [dx + 8, 12, 1])], { meta: { gears: [{ a: 'g1', b: 'g2' }] } });
  assert.ok(!checks(lintModel(g(0), rules)).includes('belt'));
  assert.ok(checks(lintModel(g(3), rules)).includes('belt'));
});

test('gears: meshing gears must share a tooth pitch', () => {
  const g = (tb) => model([base(), cube('g1', [-8, 4, -1], [0, 12, 1]), cube('g2', [0, 4, -1], [8, 12, 1])], { meta: { gears: [{ a: 'g1', b: 'g2', ta: 12, tb }] } });
  assert.ok(!checks(lintModel(g(12), rules)).includes('belt'));
  assert.ok(checks(lintModel(g(8), rules)).includes('belt'));
});

test('drivetrain: a turning part must be driven from a source, at the declared ratio', () => {
  const shaft = cube('shaft', [-8, 6, -1], [8, 8, 1]);
  const spinKeys = (turns) => rotKeys('shaft', [[0, [0, 0, 0]], [0.25, [turns * 90, 0, 0]], [0.5, [turns * 180, 0, 0]], [0.75, [turns * 270, 0, 0]], [1, [turns * 360, 0, 0]]], 'linear');
  const mk = (meta) => model([base(), post(), shaft], { outliner: [base().uuid, post().uuid, bone('shaft', [0, 7, 0], [shaft])],
    meta: { joints: { shaft: { type: 'revolute', axis: 'x' } }, ...meta }, animations: [{ name: 'working', length: 1, loop: 'loop', animators: spinKeys(1) }] });
  assert.ok(checks(lintModel(mk({ ports: [{ id: 'p', kind: 'rotation', face: 'west', cell: [0, 0], bone: 'shaft' }] }), rules)).every((c) => c !== 'drivetrain'));
  assert.ok(checks(lintModel(mk({ sources: [{ bone: 'other', why: 'a motor elsewhere' }] }), rules)).includes('drivetrain'));
});

test('kinematics: a respawning work piece may teleport only while hidden', () => {
  const piece = cube('piece', [-2, 4, -2], [2, 6, 2]);
  const mk = (hiddenScale) => model([base(), piece], { outliner: [base().uuid, bone('piece', [0, 4, 0], [piece])],
    meta: { joints: { piece: { type: 'free', why: 'work piece', respawn: true } } },
    animations: [{ name: 'working', length: 1, loop: 'loop', animators: { 'b-piece': { name: 'piece', type: 'bone', keyframes: [
      { channel: 'position', time: 0, data_points: [{ x: 0, y: 0, z: 0 }], interpolation: 'linear' },
      { channel: 'position', time: 0.5, data_points: [{ x: 10, y: 0, z: 0 }], interpolation: 'linear' },
      { channel: 'position', time: 0.51, data_points: [{ x: 0, y: 0, z: 0 }], interpolation: 'linear' },
      { channel: 'position', time: 1, data_points: [{ x: 0, y: 0, z: 0 }], interpolation: 'linear' },
      { channel: 'scale', time: 0, data_points: [{ x: 1, y: 1, z: 1 }], interpolation: 'linear' },
      { channel: 'scale', time: 0.45, data_points: [{ x: 1, y: 1, z: 1 }], interpolation: 'linear' },
      { channel: 'scale', time: 0.49, data_points: [{ x: hiddenScale, y: hiddenScale, z: hiddenScale }], interpolation: 'linear' },
      { channel: 'scale', time: 0.52, data_points: [{ x: hiddenScale, y: hiddenScale, z: hiddenScale }], interpolation: 'linear' },
      { channel: 'scale', time: 0.6, data_points: [{ x: 1, y: 1, z: 1 }], interpolation: 'linear' },
      { channel: 'scale', time: 1, data_points: [{ x: 1, y: 1, z: 1 }], interpolation: 'linear' },
    ] } } }] });
  const kinErrors = (m) => lintModel(m, rules).findings.filter((f) => f.level === 'error' && f.check === 'kinematics' && /jumps|respawns/.test(f.msg));
  assert.equal(kinErrors(mk(0.01)).length, 0);
  assert.ok(kinErrors(mk(1)).length > 0);
});

test('kinematics: limits, rigid motion, hinge pivot, loop seam, scale, deploy', () => {
  const lid = cube('lid', [-6, 20, -6], [6, 22, 6]);
  const mk = (frames, joint, { origin = [0, 20, -6], loop = 'once', name = 'open', channel = 'rotation', length = 1 } = {}) => model([base(), post(), lid], {
    outliner: [base().uuid, post().uuid, bone('lid', origin, [lid])], meta: joint ? { joints: { lid: joint } } : {},
    animations: [{ name, length, loop, animators: rotKeys('lid', frames, 'linear', channel) }] });
  // post and base get fresh uuids from base()/post(): rebuild the outliner from the model's own elements
  const fix = (m) => { m.outliner[0] = m.elements[0].uuid; m.outliner[1] = m.elements[1].uuid; return m; };
  const hinge = { type: 'revolute', axis: 'x', min: 0, max: 45 };
  const kin = (m) => lintModel(fix(m), rules).findings.filter((f) => f.check === 'kinematics');
  assert.deepEqual(kin(mk([[0, [0, 0, 0]], [1, [30, 0, 0]]], hinge, { origin: [0, 20, -2] })).filter((f) => f.level === 'error'), []);
  assert.ok(kin(mk([[0, [0, 0, 0]], [1, [60, 0, 0]]], hinge, { origin: [0, 20, -2] })).some((f) => /above its limit/.test(f.msg)));
  assert.ok(kin(mk([[0, [0, 0, 0]], [1, [0, 30, 0]]], hinge, { origin: [0, 20, -2] })).some((f) => /off its x axis/.test(f.msg)));
  assert.ok(kin(mk([[0, [0, 0, 0]], [1, [30, 0, 0]]], hinge, { origin: [0, 40, -2] })).some((f) => /thin air/.test(f.msg)));
  assert.ok(kin(mk([[0, [0, 0, 0]], [1, [30, 0, 0]]], null, { origin: [0, 20, -2] })).some((f) => f.level === 'warn'));
  assert.ok(kin(mk([[0, [0, 0, 0]], [1, [30, 0, 0]]], { type: 'revolute', axis: 'x' }, { origin: [0, 20, -2], loop: 'loop' })).some((f) => /does not close/.test(f.msg)));
  assert.ok(kin(mk([[0, [1, 1, 1]], [1, [0.5, 0.5, 0.5]]], null, { channel: 'scale' })).some((f) => /scales by/.test(f.msg)));
  assert.ok(!kin(mk([[0, [1, 1, 1]], [1, [0.5, 0.5, 0.5]]], { type: 'free', why: 'a glow pulse' }, { channel: 'scale' })).some((f) => f.level === 'error'));
  assert.ok(kin(mk([[0, [45, 0, 0]], [1, [20, 0, 0]]], hinge, { origin: [0, 20, -2], name: 'deploy' })).some((f) => /bind pose/.test(f.msg)));
  assert.ok(kin(mk([[0, [0, 0, 0]], [0.5, [0, 0, 0]], [0.5001, [0, 0, 40]]], null, { channel: 'position' })).some((f) => /jumps/.test(f.msg)));
});

test('deploy: a multiblock machine from tier 2 needs packaged and deploy (P6)', () => {
  const lid = cube('lid', [-6, 4, -6], [6, 6, 6]);
  const anim = (name) => ({ name, length: 1, loop: 'once', animators: {} });
  const m = (meta, names = []) => lintModel(model([base(), lid], { meta: { kind: 'machine', ...meta }, animations: names.map(anim) }), rules)
    .findings.filter((f) => f.check === 'deploy');
  assert.equal(m({ tier: 2 }).filter((f) => f.level === 'error').length, 2);
  assert.deepEqual(m({ tier: 2 }, ['model.packaged', 'model.deploy']), []);
  assert.deepEqual(m({ tier: 1 }), []);
  assert.deepEqual(m({ tier: 5, footprint: [1, 1] }), []);
  assert.ok(m({}).some((f) => f.level === 'warn' && /tier is not set/.test(f.msg)));
  assert.deepEqual(m({ tier: 4, kind: 'scenery' }), []);
});
