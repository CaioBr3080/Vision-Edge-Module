import {FLAG_PATH, LIGHT_FLAG, LIGHT_FLAG_PATH, getAttenuation} from "./common.js";

/** V13 ApplicationV2 hooks, including the separate PrototypeTokenConfig class. */
export function registerTokenConfig() {
  Hooks.on("renderTokenConfig", addTokenControls);
  Hooks.on("renderPrototypeTokenConfig", addTokenControls);
  Hooks.on("renderAmbientLightConfig", addLightEdgeControl);
}

function addControl(app, element, token, {path, selector, flag, hint, suffix}) {
  const root = element?.querySelector ? element : app.element;
  if (!root || root.querySelector(`[name="${path}"]`)) return;
  const native = root.querySelector(selector);
  const anchor = native?.closest(".form-group");
  if (!anchor?.isConnected) return;
  const field = new foundry.data.fields.NumberField({
    min: 0, max: 1, step: 0.05, initial: 0,
    label: "VEA.EdgeAttenuation", hint
  });
  const group = field.toFormGroup({localize: true}, {
    name: path, value: getAttenuation(token ?? app.document, flag),
    id: `${app.id}-${suffix}`, step: 0.05, type: "range",
    disabled: native.disabled || app.isEditable === false
  });
  group.dataset.visionEdgeAttenuation = "";
  group.title = game.i18n.localize(hint);
  anchor.after(group);
}

const visionControl = {
  path: FLAG_PATH, selector: '[name="sight.attenuation"]',
  hint: "VEA.EdgeAttenuationHint", suffix: "edge-attenuation"
};
const lightControl = {
  path: LIGHT_FLAG_PATH,
  selector: '[name="light.attenuation"], [name="config.attenuation"]',
  flag: LIGHT_FLAG, hint: "VEA.LightEdgeAttenuationHint", suffix: "light-edge-attenuation"
};

async function addTokenControls(app, element) {
  // PrototypeTokenConfig.token is asynchronous in V13. Resolve its preview once.
  const token = await app.token;
  addControl(app, element, token, visionControl);
  addControl(app, element, token, lightControl);
}

export async function addEdgeControl(app, element) {
  addControl(app, element, await app.token, visionControl);
}

export async function addLightEdgeControl(app, element, context) {
  const token = await app.token;
  addControl(app, element, token ?? context?.document ?? app.document, lightControl);
}
