import {MODULE_ID, SETTINGS, clampAttenuation, refreshPerception} from "./common.js";

const localize = key => game.i18n.localize(key);
const setting = key => game.settings.get(MODULE_ID, key);

function range(name, value, label, hint) {
  const shown = clampAttenuation(value).toFixed(2);
  return `<div class="form-group">
    <label for="vea-${name}">${localize(label)}</label>
    <div class="form-fields">
      <input id="vea-${name}" name="${name}" type="range" min="0" max="1" step="0.05" value="${shown}">
      <output for="vea-${name}">${shown}</output>
    </div>
    <p class="hint">${localize(hint)}</p>
  </div>`;
}

/** World-scoped module settings, intentionally kept together in one dialog. */
export class VisionEdgeSettings extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "vision-edge-settings",
    classes: ["vision-edge-settings"],
    tag: "form",
    window: {
      title: "VEA.Settings.MenuName",
      icon: "fa-solid fa-circle-half-stroke",
      resizable: false
    },
    position: {width: 520},
    form: {closeOnSubmit: true}
  };

  async _renderHTML(_context, _options) {
    return `<div class="standard-form">
      <p class="hint">${localize("VEA.Settings.Intro")}</p>
      <fieldset>
        <legend>${localize("VEA.Settings.DefaultsLegend")}</legend>
        ${range(SETTINGS.VISION_DEFAULT, setting(SETTINGS.VISION_DEFAULT), "VEA.Settings.VisionDefault", "VEA.Settings.VisionDefaultHint")}
        ${range(SETTINGS.LIGHT_DEFAULT, setting(SETTINGS.LIGHT_DEFAULT), "VEA.Settings.LightDefault", "VEA.Settings.LightDefaultHint")}
      </fieldset>
      <fieldset>
        <legend>${localize("VEA.Settings.FogLegend")}</legend>
        ${range(SETTINGS.FOG_ATTENUATION, setting(SETTINGS.FOG_ATTENUATION), "VEA.Settings.FogAttenuation", "VEA.Settings.FogAttenuationHint")}
      </fieldset>
      <fieldset>
        <legend>${localize("VEA.Settings.MeasurementLegend")}</legend>
        <div class="form-group">
          <label for="vea-${SETTINGS.PLAYER_MEASUREMENT}">${localize("VEA.Settings.PlayerMeasurement")}</label>
          <input id="vea-${SETTINGS.PLAYER_MEASUREMENT}" name="${SETTINGS.PLAYER_MEASUREMENT}" type="checkbox" ${setting(SETTINGS.PLAYER_MEASUREMENT) ? "checked" : ""}>
          <p class="hint">${localize("VEA.Settings.PlayerMeasurementHint")}</p>
        </div>
      </fieldset>
      <footer class="form-footer">
        <button type="submit"><i class="fa-solid fa-floppy-disk"></i> ${localize("SETTINGS.Save")}</button>
      </footer>
    </div>`;
  }

  _replaceHTML(result, content, _options) {
    content.innerHTML = result;
  }

  async _onRender(_context, _options) {
    const form = this.element;
    for (const input of form.querySelectorAll('input[type="range"]')) {
      input.addEventListener("input", () => {
        const output = input.parentElement?.querySelector("output");
        if (output) output.value = Number(input.value).toFixed(2);
      });
    }
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const data = new FormData(form);
      await Promise.all([
        game.settings.set(MODULE_ID, SETTINGS.VISION_DEFAULT, clampAttenuation(data.get(SETTINGS.VISION_DEFAULT))),
        game.settings.set(MODULE_ID, SETTINGS.LIGHT_DEFAULT, clampAttenuation(data.get(SETTINGS.LIGHT_DEFAULT))),
        game.settings.set(MODULE_ID, SETTINGS.FOG_ATTENUATION, clampAttenuation(data.get(SETTINGS.FOG_ATTENUATION))),
        game.settings.set(MODULE_ID, SETTINGS.PLAYER_MEASUREMENT, data.has(SETTINGS.PLAYER_MEASUREMENT))
      ]);
      refreshPerception();
      ui.notifications.info(localize("VEA.Settings.Saved"));
      await this.close({submitted: true});
    }, {once: true});
  }
}

export function registerSettings() {
  const numericSettings = [
    [SETTINGS.VISION_DEFAULT, "VEA.Settings.VisionDefault", "VEA.Settings.VisionDefaultHint"],
    [SETTINGS.LIGHT_DEFAULT, "VEA.Settings.LightDefault", "VEA.Settings.LightDefaultHint"],
    [SETTINGS.FOG_ATTENUATION, "VEA.Settings.FogAttenuation", "VEA.Settings.FogAttenuationHint"]
  ];
  for (const [key, name, hint] of numericSettings) {
    game.settings.register(MODULE_ID, key, {
      name, hint, scope: "world", config: false, restricted: true, type: Number, default: 0,
      onChange: () => refreshPerception()
    });
  }
  game.settings.register(MODULE_ID, SETTINGS.PLAYER_MEASUREMENT, {
    name: "VEA.Settings.PlayerMeasurement", hint: "VEA.Settings.PlayerMeasurementHint",
    scope: "world", config: false, restricted: true, type: Boolean, default: false
  });
  game.settings.registerMenu(MODULE_ID, "configuration", {
    name: "VEA.Settings.MenuName", label: "VEA.Settings.MenuLabel", hint: "VEA.Settings.MenuHint",
    icon: "fa-solid fa-circle-half-stroke", type: VisionEdgeSettings, restricted: true
  });
}
