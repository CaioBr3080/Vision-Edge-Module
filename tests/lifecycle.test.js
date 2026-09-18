import test from "node:test";
import assert from "node:assert/strict";
import {FLAG_PATH, LIGHT_FLAG_PATH} from "../scripts/common.js";

test("V14 initializes rendering and remote flag updates refresh current-scene vision", async () => {
  const callbacks = new Map();
  globalThis.Hooks = {
    once: (name, callback) => callbacks.set(name, [callback]),
    on: (name, callback) => callbacks.set(name, [...(callbacks.get(name) ?? []), callback])
  };
  globalThis.game = {release: {generation: 14}};
  class NativeFilter {apply() {}}
  globalThis.CONFIG = {Canvas: {visibilityFilter: NativeFilter}};
  await import("../scripts/main.js");
  callbacks.get("init")[0]();
  assert.ok(callbacks.has("renderTokenConfig"));
  assert.ok(callbacks.has("renderPrototypeTokenConfig"));
  assert.ok(callbacks.has("renderAmbientLightConfig"));
  assert.ok(callbacks.has("lightingRefresh"));
  assert.equal(callbacks.get("canvasReady").length, 2);
  assert.ok(callbacks.has("visibilityRefresh"));
  assert.notEqual(CONFIG.Canvas.visibilityFilter, NativeFilter);
  const requests = [];
  globalThis.canvas = {ready: true, scene: {id: "current"},
    perception: {update: request => requests.push(request)}};
  const update = callbacks.get("updateToken")[0];
  update({parent: {id: "other"}}, {[FLAG_PATH]: 0.5});
  update({parent: {id: "current"}}, {flags: {unrelated: {value: 1}}});
  assert.equal(requests.length, 0);
  update({parent: {id: "current"}}, {[FLAG_PATH]: 0.5});
  assert.deepEqual(requests, [{refreshVision: true}]);
  update({parent: {id: "current"}}, {[LIGHT_FLAG_PATH]: 0.8});
  assert.deepEqual(requests[1], {refreshLighting: true, refreshVision: true});
  update({parent: {id: "current"}}, {[LIGHT_FLAG_PATH]: 0.8, [FLAG_PATH]: 0.4});
  assert.deepEqual(requests[2], {refreshVision: true, refreshLighting: true});
  const updateAmbient = callbacks.get("updateAmbientLight")[0];
  updateAmbient({parent: {id: "other"}}, {[LIGHT_FLAG_PATH]: 0.6});
  assert.equal(requests.length, 3);
  updateAmbient({parent: {id: "current"}}, {[LIGHT_FLAG_PATH]: 0.6});
  assert.deepEqual(requests[3], {refreshLighting: true, refreshVision: true});
});
