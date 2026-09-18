import test from "node:test";
import assert from "node:assert/strict";
import {
  clampAttenuation, getAttenuation, getFogAttenuation, hasAttenuationOverride,
  flagChanged, MODULE_ID, FLAG, FLAG_PATH, LIGHT_FLAG, SETTINGS, overrideFlag
} from "../scripts/common.js";
import {VisionFeather} from "../scripts/vision-feather.js";
import {addEdgeControl} from "../scripts/token-config.js";

function configureSettings(values = {}) {
  globalThis.game = {settings: {get: (_module, key) => values[key]}};
}

function configureFormFields(inserted) {
  class Field {
    constructor(options) { this.options = options; }
    toFormGroup(groupConfig, inputConfig) {
      const input = {
        checked: !!inputConfig.value,
        disabled: !!inputConfig.disabled,
        addEventListener: () => {}
      };
      const group = {
        dataset: {}, groupConfig, inputConfig, options: this.options,
        querySelector: () => input,
        after: next => inserted.push(next)
      };
      return group;
    }
  }
  globalThis.foundry = {data: {fields: {NumberField: Field, BooleanField: Field}}};
}

test("missing and malformed saved flags are harmless", () => {
  configureSettings();
  for (const value of [undefined, null, NaN, Infinity, "invalid"]) assert.equal(clampAttenuation(value), 0);
  assert.equal(clampAttenuation(-1), 0);
  assert.equal(clampAttenuation(2), 1);
  assert.equal(clampAttenuation("0.65"), 0.65);
  assert.equal(getAttenuation({getFlag: () => 0.6}), 0.6);
  assert.equal(getAttenuation({flags: {[MODULE_ID]: {[FLAG]: 0.8}}}), 0.8);
});

test("world defaults apply unless a source has priority", () => {
  configureSettings({[SETTINGS.VISION_DEFAULT]: 0.65, [SETTINGS.LIGHT_DEFAULT]: 0.4,
    [SETTINGS.FOG_ATTENUATION]: 0.35});
  const globalVision = {getFlag: (_module, key) => key === overrideFlag(FLAG) ? false : undefined};
  const legacyCustom = {getFlag: (_module, key) => key === FLAG ? 0.2 : undefined};
  const customLight = {getFlag: (_module, key) => ({[LIGHT_FLAG]: 0.9,
    [overrideFlag(LIGHT_FLAG)]: true})[key]};
  assert.equal(getAttenuation(globalVision), 0.65);
  assert.equal(getAttenuation(legacyCustom), 0.2);
  assert.equal(getAttenuation(customLight, LIGHT_FLAG), 0.9);
  assert.equal(hasAttenuationOverride(globalVision), false);
  assert.equal(getFogAttenuation(), 0.35);
});

test("remote updates and deletion syntax request refresh, unrelated flags do not", () => {
  for (const changes of [
    {[FLAG_PATH]: 0.5}, {flags: {[MODULE_ID]: {[FLAG]: 0}}},
    {flags: {[MODULE_ID]: {[`-=${FLAG}`]: null}}},
    {[`flags.${MODULE_ID}.-=${FLAG}`]: null}, {flags: {[`-=${MODULE_ID}`]: null}},
    {[`flags.${MODULE_ID}.${overrideFlag(FLAG)}`]: true}
  ]) assert.equal(flagChanged(changes), true);
  assert.equal(flagChanged({sight: {attenuation: 0.5}}), false);
  assert.equal(flagChanged({flags: {[MODULE_ID]: {unrelated: true}}}), false);
});

test("native filter return, arguments and samplers survive normal application and exceptions", () => {
  configureSettings();
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

test("Fog blur and temporary measurement only change local visual state", () => {
  configureSettings({[SETTINGS.FOG_ATTENUATION]: 0.5, [SETTINGS.VISION_DEFAULT]: 0.7});
  const requests = [];
  globalThis.canvas = {blur: {enabled: true}, dimensions: {size: 100},
    perception: {update: request => requests.push(request)}};
  const controller = new VisionFeather();
  assert.equal(controller.getFogBlur(), 17.5);
  const source = {object: {document: {id: "token-1", getFlag: () => undefined}}};
  assert.equal(controller.sourceAttenuation(source), 0.7);
  controller.setMeasurement("token-1", true);
  assert.equal(controller.sourceAttenuation(source), 0);
  controller.setMeasurement("token-1", false);
  assert.equal(controller.sourceAttenuation(source), 0.7);
  assert.deepEqual(requests, [{refreshVision: true}, {refreshVision: true}]);
});

test("zero does not allocate a visual texture", () => {
  configureSettings();
  globalThis.canvas = {effects: {visionSources: [{hasActiveLayer: true, radius: 100,
    object: {document: {getFlag: () => 0}}}]}};
  const controller = new VisionFeather();
  controller.refresh({});
  assert.equal(controller.active, false);
  assert.equal(controller.texture, null);
});

test("prototype control stores both attenuation and the priority checkbox", async () => {
  const inserted = [];
  const anchor = {isConnected: true, after: group => inserted.push(group)};
  const root = {querySelector: selector => selector === '[name="sight.attenuation"]'
    ? {disabled: false, closest: () => anchor} : null};
  globalThis.game = {i18n: {localize: key => key}, settings: {get: () => 0}};
  configureFormFields(inserted);
  await addEdgeControl({id: "prototype", token: Promise.resolve({getFlag: () => 0.6})}, root);
  assert.equal(inserted[0].inputConfig.name, FLAG_PATH);
  assert.equal(inserted[0].inputConfig.value, 0.6);
  assert.equal(inserted[0].inputConfig.type, "range");
  assert.equal(inserted[0].options.step, 0.05);
  assert.equal(inserted[0].groupConfig.localize, true);
  assert.equal(inserted[1].inputConfig.name, `flags.${MODULE_ID}.${overrideFlag(FLAG)}`);
  assert.equal(inserted[1].inputConfig.value, true);
});
