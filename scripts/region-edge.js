import {MODULE_ID, clampAttenuation, flagChanged, getDocumentFlag, refreshPerception} from "./common.js";

export const REGION_FLAG = "regionEdgeAttenuation";
export const REGION_FLAG_PATH = `flags.${MODULE_ID}.${REGION_FLAG}`;
export const ADJUST_DARKNESS_TYPE = "adjustDarknessLevel";
const NATIVE_BLUR_STRENGTH = 8;

export function isAdjustDarknessBehavior(behavior) {
  return behavior?.type === ADJUST_DARKNESS_TYPE;
}

export function getRegionAttenuation(behavior) {
  return clampAttenuation(getDocumentFlag(behavior, REGION_FLAG));
}

/** Match the Fog scale while retaining Foundry's built-in eight-pixel softening. */
export function getRegionBlurStrength(attenuation, gridSize = globalThis.canvas?.dimensions?.size) {
  const edgeBlur = Math.min(64, Math.max(2, Number(gridSize) || 100) * 0.35)
    * clampAttenuation(attenuation);
  return NATIVE_BLUR_STRENGTH + edgeBlur;
}

function setBlurStrength(filter, strength) {
  if (!filter || !Number.isFinite(strength)) return false;
  const prior = filter._configuredStrength;
  filter._configuredStrength = strength;
  const scale = Number(canvas?.stage?.scale?.x) || 1;
  filter.blur = strength * scale;
  return prior !== strength;
}

function findAdjustDarknessBehaviors() {
  const behaviors = new Map();
  for (const region of canvas?.scene?.regions ?? []) {
    for (const behavior of region.behaviors ?? []) {
      if (isAdjustDarknessBehavior(behavior)) behaviors.set(behavior.uuid, behavior);
    }
  }
  return behaviors;
}

/**
 * Increase Foundry's native darkness-region blur. The core mesh already owns
 * the correct polygon and elevation mask, so this follows irregular boundaries
 * and holes without changing the configured darkness value.
 */
export class RegionEdgeAttenuation {
  install() {
    Hooks.on("renderRegionBehaviorConfig", (app, element) => addRegionEdgeControl(app, element));
    Hooks.on("canvasReady", () => this.refresh());
    Hooks.on("updateRegionBehavior", (behavior, changes) => {
      if (isAdjustDarknessBehavior(behavior) && flagChanged(changes, REGION_FLAG)) this.refresh();
    });
    Hooks.on("createRegionBehavior", behavior => {
      if (isAdjustDarknessBehavior(behavior)) setTimeout(() => this.refresh(), 0);
    });
  }

  refresh() {
    const container = canvas?.effects?.illumination?.darknessLevelMeshes;
    if (!container?.children) return;
    const behaviors = findAdjustDarknessBehaviors();
    let changed = false;
    for (const mesh of container.children) {
      const behavior = behaviors.get(mesh.name);
      if (!behavior) continue;
      const filter = mesh._blurFilter;
      // Foundry intentionally omits this filter on its low-performance mode.
      // Respect that choice instead of adding GPU work on those clients.
      if (!filter) continue;
      const nativeStrength = mesh._veaNativeBlurStrength ??= filter._configuredStrength ?? NATIVE_BLUR_STRENGTH;
      const desired = nativeStrength + (getRegionBlurStrength(getRegionAttenuation(behavior)) - NATIVE_BLUR_STRENGTH);
      changed = setBlurStrength(filter, desired) || changed;
    }
    if (changed) {
      canvas.effects.illumination.invalidateDarknessLevelContainer(true);
      refreshPerception();
    }
  }
}

/** Add the control only to the native Adjust Darkness Level behavior sheet. */
export function addRegionEdgeControl(app, element) {
  const behavior = app?.document;
  if (!isAdjustDarknessBehavior(behavior)) return;
  const root = element?.querySelector ? element : app.element;
  if (!root || root.querySelector(`[name="${REGION_FLAG_PATH}"]`)) return;
  const native = root.querySelector('[name="system.modifier"]');
  const anchor = native?.closest(".form-group");
  if (!anchor?.isConnected) return;
  const disabled = native.disabled || app.isEditable === false;
  const field = new foundry.data.fields.NumberField({
    min: 0, max: 1, step: 0.05, initial: 0,
    label: "VEA.RegionEdgeAttenuation", hint: "VEA.RegionEdgeAttenuationHint"
  });
  const group = field.toFormGroup({localize: true}, {
    name: REGION_FLAG_PATH, value: getRegionAttenuation(behavior), type: "range", step: 0.05,
    id: `${app.id}-region-edge-attenuation`, disabled
  });
  group.dataset.visionEdgeRegionAttenuation = "";
  group.title = game.i18n.localize("VEA.RegionEdgeAttenuationHint");
  anchor.after(group);
}