import test from "node:test";
import assert from "node:assert/strict";
import {clampAttenuation, getAttenuation, flagChanged, MODULE_ID, FLAG, FLAG_PATH} from "../scripts/common.js";
import {VisionFeather} from "../scripts/vision-feather.js";
import {addEdgeControl} from "../scripts/token-config.js";

test("missing and malformed saved flags are harmless", () => {
  for (const value of [undefined, null, NaN, Infinity, "invalid"]) assert.equal(clampAttenuation(value), 0);
  assert.equal(clampAttenuation(-1), 0);
  assert.equal(clampAttenuation(2), 1);
  assert.equal(clampAttenuation("0.65"), 0.65);
  assert.equal(getAttenuation({getFlag: () => 0.6}), 0.6);
  assert.equal(getAttenuation({flags: {[MODULE_ID]: {[FLAG]: 0.8}}}), 0.8);
});

test("remote updates and deletion syntax request refresh, unrelated flags do not", () => {
  for (const changes of [
    {[FLAG_PATH]: 0.5}, {flags: {[MODULE_ID]: {[FLAG]: 0}}},
    {flags: {[MODULE_ID]: {[`-=${FLAG}`]: null}}},
    {[`flags.${MODULE_ID}.-=${FLAG}`]: null}, {flags: {[`-=${MODULE_ID}`]: null}}
  ]) assert.equal(flagChanged(changes), true);
  assert.equal(flagChanged({sight: {attenuation: 0.5}}), false);
  assert.equal(flagChanged({flags: {[MODULE_ID]: {unrelated: true}}}), false);
});

test("native filter return, arguments and sampler survive normal application and exceptions", () => {
  const originalTexture = {};
  let observed;
  class NativeFilter {
    apply(...args) {
      observed = {texture: this.uniforms.visionTexture, args};
      if (args[0] === "throw") throw new Error("native failure");
      return "native result";
    }
  }
  globalThis.CONFIG = {Canvas: {visibilityFilter: NativeFilter}};
  const controller = new VisionFeather();
  controller.install();
  const filter = new CONFIG.Canvas.visibilityFilter();
  filter.uniforms = {visionTexture: originalTexture};
  assert.equal(filter.apply(1, 2), "native result");
  assert.equal(observed.texture, originalTexture);
  controller.texture = {};
  controller.active = true;
  assert.equal(filter.apply(1, 2, 3, 4), "native result");
  assert.equal(observed.texture, controller.texture);
  assert.deepEqual(observed.args, [1, 2, 3, 4]);
  assert.equal(filter.uniforms.visionTexture, originalTexture);
  assert.throws(() => filter.apply("throw"), /native failure/);
  assert.equal(filter.uniforms.visionTexture, originalTexture);
});

test("zero does not allocate a visual texture", () => {
  globalThis.canvas = {effects: {visionSources: [{hasActiveLayer: true, radius: 100,
    object: {document: {getFlag: () => 0}}}]}};
  const controller = new VisionFeather();
  controller.refresh({});
  assert.equal(controller.active, false);
  assert.equal(controller.texture, null);
});

test("prototype control awaits its token and delegates numeric submission to the native field", async () => {
  let inserted;
  const anchor = {isConnected: true, after: group => {inserted = group;}};
  const root = {querySelector: selector => selector === '[name="sight.attenuation"]'
    ? {disabled: false, closest: () => anchor} : null};
  globalThis.game = {i18n: {localize: key => key}};
  globalThis.foundry = {data: {fields: {NumberField: class {
    constructor(options) {this.options = options;}
    toFormGroup(groupConfig, inputConfig) {return {dataset: {}, groupConfig, inputConfig, options: this.options};}
  }}}};
  await addEdgeControl({id: "prototype", token: Promise.resolve({getFlag: () => 0.6})}, root);
  assert.equal(inserted.inputConfig.name, FLAG_PATH);
  assert.equal(inserted.inputConfig.value, 0.6);
  assert.equal(inserted.inputConfig.type, "range");
  assert.equal(inserted.options.step, 0.05);
  assert.equal(inserted.groupConfig.localize, true);
});
