import {
  FLAG, FLAG_PATH, LIGHT_FLAG, LIGHT_FLAG_PATH, flagPath, getAttenuation,
  hasAttenuationOverride, overrideFlag
} from "./common.js";

/** V13 ApplicationV2 hooks, including the separate PrototypeTokenConfig class. */
export function registerTokenConfig() {
  Hooks.on("renderTokenConfig", addTokenControls);
  Hooks.on("renderPrototypeTokenConfig", addTokenControls);
  Hooks.on("renderAmbientLightConfig", addLightEdgeControl);
}

function addOverrideControl(app, anchor, control, document, disabled) {
  const path = flagPath(overrideFlag(control.flag));
  if (anchor.parentElement?.querySelector?.(`[name="${path}"]`)) return;
  const override = hasAttenuationOverride(document, control.flag);
  const field = new foundry.data.fields.BooleanField({
    initial: false, label: control.overrideLabel, hint: control.overrideHint
  });
  const group = field.toFormGroup({localize: true}, {
    name: path, value: override, id: `${app.id}-${control.suffix}-override`, disabled
  });
  group.dataset.visionEdgeAttenuationOverride = "";
  anchor.after(group);
  return group;
}

function addControl(app, element, document, control) {
  const root = element?.querySelector ? element : app.element;
  if (!root || root.querySelector(`[name="${control.path}"]`)) return;
  const native = root.querySelector(control.selector);
  const anchor = native?.closest(".form-group");
  if (!anchor?.isConnected) return;
  const disabled = native.disabled || app.isEditable === false;
  const field = new foundry.data.fields.NumberField({
    min: 0, max: 1, step: 0.05, initial: 0,
    label: "VEA.EdgeAttenuation", hint: control.hint
  });
  const group = field.toFormGroup({localize: true}, {
    name: control.path, value: getAttenuation(document, control.flag),
    id: `${app.id}-${control.suffix}`, step: 0.05, type: "range", disabled
  });
  group.dataset.visionEdgeAttenuation = "";
  group.title = game.i18n.localize(control.hint);
  anchor.after(group);
  const overrideGroup = addOverrideControl(app, group, control, document, disabled);
  const input = group.querySelector?.('input[type="range"], input');
  const checkbox = overrideGroup?.querySelector?.('input[type="checkbox"], input');
  if (!input || !checkbox) return;
  const updateDisabledState = () => { input.disabled = disabled || !checkbox.checked; };
  updateDisabledState();
  checkbox.addEventListener("change", updateDisabledState);
}

const visionControl = {
  path: FLAG_PATH, flag: FLAG, selector: '[name="sight.attenuation"]',
  hint: "VEA.EdgeAttenuationHint", suffix: "edge-attenuation",
  overrideLabel: "VEA.VisionOverride", overrideHint: "VEA.VisionOverrideHint"
};
const lightControl = {
  path: LIGHT_FLAG_PATH, flag: LIGHT_FLAG,
  selector: '[name="light.attenuation"], [name="config.attenuation"]',
  hint: "VEA.LightEdgeAttenuationHint", suffix: "light-edge-attenuation",
  overrideLabel: "VEA.LightOverride", overrideHint: "VEA.LightOverrideHint"
};

async function addTokenControls(app, element) {
  // PrototypeTokenConfig.token is asynchronous in V13. Resolve its preview once.
  const token = await app.token;
  const document = token ?? app.document;
  addControl(app, element, document, visionControl);
  addControl(app, element, document, lightControl);
}

export async function addEdgeControl(app, element) {
  addControl(app, element, await app.token, visionControl);
}

export async function addLightEdgeControl(app, element, context) {
  const token = await app.token;
  addControl(app, element, token ?? context?.document ?? app.document, lightControl);
}
