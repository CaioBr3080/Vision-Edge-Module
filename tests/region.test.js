import test from "node:test";
import assert from "node:assert/strict";
import {MODULE_ID} from "../scripts/common.js";
import {
  ADJUST_DARKNESS_TYPE, REGION_FLAG, REGION_FLAG_PATH, RegionEdgeAttenuation,
  addRegionEdgeControl, getRegionAttenuation, getRegionBlurStrength, isAdjustDarknessBehavior
} from "../scripts/region-edge.js";

function configureFields(inserted) {
  class Field {
    constructor(options) { this.options = options; }
    toFormGroup(groupConfig, inputConfig) {
      return {
        dataset: {}, groupConfig, inputConfig, options: this.options,
        querySelector: () => null
      };
    }
  }
  globalThis.foundry = {data: {fields: {NumberField: Field}}};
  globalThis.game = {i18n: {localize: key => key}};
}

test("only Adjust Darkness Level behaviors are eligible", () => {
  assert.equal(isAdjustDarknessBehavior({type: ADJUST_DARKNESS_TYPE}), true);
  assert.equal(isAdjustDarknessBehavior({type: "teleportToken"}), false);
  assert.equal(isAdjustDarknessBehavior(null), false);
  assert.equal(getRegionAttenuation({getFlag: (_module, key) => key === REGION_FLAG ? 0.7 : undefined}), 0.7);
  assert.equal(getRegionBlurStrength(0, 100), 8);
  assert.equal(getRegionBlurStrength(1, 100), 43);
  assert.equal(getRegionBlurStrength(2, 400), 72);
});

test("the region sheet stores an edge attenuation flag after the native modifier", () => {
  const inserted = [];
  configureFields(inserted);
  const anchor = {isConnected: true, after: group => inserted.push(group)};
  const root = {querySelector: selector => selector === '[name="system.modifier"]'
    ? {disabled: false, closest: () => anchor} : null};
  const behavior = {type: ADJUST_DARKNESS_TYPE, getFlag: () => 0.45};
  addRegionEdgeControl({id: "region", document: behavior}, root);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].inputConfig.name, REGION_FLAG_PATH);
  assert.equal(inserted[0].inputConfig.value, 0.45);
  assert.equal(inserted[0].inputConfig.type, "range");
  assert.equal(inserted[0].options.label, "VEA.RegionEdgeAttenuation");
  assert.equal(inserted[0].groupConfig.localize, true);
  assert.equal(REGION_FLAG_PATH, `flags.${MODULE_ID}.${REGION_FLAG}`);
});

test("the native region filter grows with attenuation and restores at zero", () => {
  let invalidated = 0;
  const refreshes = [];
  const behavior = {
    type: ADJUST_DARKNESS_TYPE, uuid: "Scene.a.Region.b.RegionBehavior.c",
    getFlag: () => behavior.attenuation
  };
  behavior.attenuation = 0.6;
  const filter = {_configuredStrength: 8, blur: 8};
  const mesh = {name: behavior.uuid, _blurFilter: filter};
  globalThis.canvas = {
    dimensions: {size: 100}, stage: {scale: {x: 1}}, ready: true,
    scene: {regions: [{behaviors: [behavior]}]},
    effects: {illumination: {darknessLevelMeshes: {children: [mesh]}, invalidateDarknessLevelContainer: () => invalidated++}},
    perception: {update: request => refreshes.push(request)}
  };
  const controller = new RegionEdgeAttenuation();
  controller.refresh();
  assert.equal(filter._configuredStrength, 29);
  assert.equal(filter.blur, 29);
  assert.equal(invalidated, 1);
  assert.deepEqual(refreshes, [{refreshLighting: true, refreshVision: true}]);
  behavior.attenuation = 0;
  controller.refresh();
  assert.equal(filter._configuredStrength, 8);
  assert.equal(filter.blur, 8);
  assert.equal(invalidated, 2);
});