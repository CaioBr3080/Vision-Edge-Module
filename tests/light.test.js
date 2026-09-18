import test from "node:test";
import assert from "node:assert/strict";
import {LightFeather, patchLightFragment} from "../scripts/light-feather.js";
import {LIGHT_FLAG, LIGHT_FLAG_PATH, FLAG, getAttenuation, flagChanged} from "../scripts/common.js";
import {addLightEdgeControl} from "../scripts/token-config.js";

const fragment = `precision mediump float;
varying vec2 vUvs;
void main() {
  float depth = 1.0;
  vec3 computedBackgroundColor = vec3(0.2);
  vec3 finalColor = vec3(1.0);
  gl_FragColor = vec4(mix(computedBackgroundColor, finalColor, depth), 1.0);
}`;

test("light flags remain independent of the token's vision attenuation", () => {
  const document = {getFlag: (_module, flag) => flag === FLAG ? 0.2 : 0.8};
  assert.equal(getAttenuation(document), 0.2);
  assert.equal(getAttenuation(document, LIGHT_FLAG), 0.8);
  assert.equal(flagChanged({[LIGHT_FLAG_PATH]: 0.8}), false);
  assert.equal(flagChanged({[LIGHT_FLAG_PATH]: 0.8}, LIGHT_FLAG), true);
  assert.equal(flagChanged({flags: {"vision-edge-attenuation": {[`-=${LIGHT_FLAG}`]: null}}}, LIGHT_FLAG), true);
});

test("incompatible and already patched shader outputs are rejected", () => {
  assert.equal(patchLightFragment("void main() { gl_FragColor = vec4(1.0); }"), null);
  const patched = patchLightFragment(fragment);
  assert.ok(patched);
  assert.equal(patchLightFragment(patched), null);
  assert.equal(patchLightFragment(fragment.replace("depth), 1.0)", "1.0), 1.0)")), null);
  assert.ok(patchLightFragment("// gl_FragColor = vec4(1.0);\n" + fragment));
});

test("light layers reuse their shader/uniforms and cached programs, zero restores native output", () => {
  let allocations = 0;
  globalThis.PIXI = {Program: {from: (vertexSrc, fragmentSrc) => {
    allocations++; return {vertexSrc, fragmentSrc};
  }}};
  const native = {vertexSrc: "#define SHADER_NAME old_vertex\nvertex",
    fragmentSrc: "#define SHADER_NAME old_fragment\n" + fragment};
  const first = {program: native, uniforms: {attenuation: 0.2, time: 11}};
  const second = {program: native, uniforms: {attenuation: 0.4}};
  let value = 0;
  const source = {constructor: {sourceType: "light"}, radius: 100,
    object: {document: {getFlag: () => value}}, layers: {
      illumination: {shader: first}, coloration: {shader: second}
    }};
  const controller = new LightFeather();
  let resets = 0;
  let flushes = 0;
  const shaderSystem = {shader: first, reset: () => {resets++; shaderSystem.shader = null;}};
  globalThis.canvas = {app: {renderer: {shader: shaderSystem, batch: {flush: () => {flushes++;}}}}};
  controller.updateSource(source);
  assert.equal(allocations, 0);
  value = 0.7;
  controller.updateSource(source);
  assert.equal(allocations, 1);
  const patched = first.program;
  assert.equal(resets, 1);
  assert.equal(flushes, 1);
  assert.ok(!patched.vertexSrc.includes("SHADER_NAME"));
  assert.ok(!patched.fragmentSrc.includes("SHADER_NAME"));
  assert.equal(first.program, second.program);
  assert.equal(source.layers.illumination.shader, first);
  assert.equal(first.uniforms.attenuation, 0.2);
  assert.equal(first.uniforms.time, 11);
  assert.equal(first.uniforms.veaLightEdgeAttenuation, 0.7);
  value = 0.4;
  controller.updateSource(source);
  assert.equal(allocations, 1);
  assert.equal(first.program, patched);
  assert.equal(first.uniforms.veaLightEdgeAttenuation, 0.4);
  const neighbor = {program: native, uniforms: {}};
  controller.updateSource({...source, object: {document: {getFlag: () => 0.9}}, layers: {illumination: {shader: neighbor}}});
  assert.equal(allocations, 1);
  assert.equal(neighbor.program, patched);
  assert.equal(neighbor.uniforms.veaLightEdgeAttenuation, 0.9);
  assert.equal(first.uniforms.veaLightEdgeAttenuation, 0.4);
  value = 0;
  controller.updateSource(source);
  assert.equal(first.program, native);
  assert.equal(second.program, native);
  assert.equal(Object.hasOwn(first.uniforms, "veaLightEdgeAttenuation"), false);
  assert.equal(neighbor.program, patched);
});

test("one incompatible layer restores the whole source and issues one warning", () => {
  globalThis.PIXI = {Program: {from: (vertexSrc, fragmentSrc) => ({vertexSrc, fragmentSrc})}};
  const native = {vertexSrc: "vertex", fragmentSrc: fragment};
  const shader = {program: native, uniforms: {}};
  const source = {constructor: {sourceType: "light"}, radius: 100,
    object: {document: {getFlag: () => 0.7}}, layers: {illumination: {shader}}};
  const controller = new LightFeather();
  controller.updateSource(source);
  assert.notEqual(shader.program, native);
  source.layers.custom = {shader: {program: {vertexSrc: "vertex", fragmentSrc: "void main(){}"}, uniforms: {}}};
  const notifications = [];
  globalThis.ui = {notifications: {warn: message => notifications.push(message)}};
  globalThis.game = {i18n: {localize: key => key}};
  const consoleWarn = console.warn;
  try {
    console.warn = () => {};
    controller.updateSource(source);
    controller.updateSource(source);
  } finally {console.warn = consoleWarn;}
  assert.equal(shader.program, native);
  assert.equal(notifications.length, 1);
});

test("native light forms use the same flag for ambient and prototype token lights", async () => {
  const inserted = [];
  const anchor = {isConnected: true, after: group => inserted.push(group)};
  const selector = '[name="light.attenuation"], [name="config.attenuation"]';
  const root = {querySelector: query => query === selector
    ? {disabled: false, closest: () => anchor} : null};
  globalThis.game = {i18n: {localize: key => key}};
  globalThis.foundry = {data: {fields: {NumberField: class {
    toFormGroup(groupConfig, inputConfig) {return {dataset: {}, groupConfig, inputConfig, after: next => inserted.push(next)};}
  }, BooleanField: class {
    toFormGroup(groupConfig, inputConfig) {return {dataset: {}, groupConfig, inputConfig, querySelector: () => ({checked: !!inputConfig.value, addEventListener: () => {}})};}
  }}}};
  await addLightEdgeControl({id: "ambient", document: {getFlag: () => 0.5}}, root);
  await addLightEdgeControl({id: "prototype", token: Promise.resolve({getFlag: () => 0.8})}, root);
  const ranges = inserted.filter(group => group.inputConfig.type === "range");
  const overrides = inserted.filter(group => group.inputConfig.type !== "range");
  assert.deepEqual(ranges.map(group => group.inputConfig.value), [0.5, 0.8]);
  assert.ok(ranges.every(group => group.inputConfig.name === LIGHT_FLAG_PATH));
  assert.ok(overrides.every(group => group.inputConfig.name.endsWith("lightEdgeAttenuationOverride")));
});
