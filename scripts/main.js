import {MODULE_ID, LIGHT_FLAG, flagChanged} from "./common.js";
import {registerSettings} from "./settings.js";
import {registerTokenConfig} from "./token-config.js";
import {VisionFeather} from "./vision-feather.js";
import {LightFeather} from "./light-feather.js";

const feather = new VisionFeather();
const lightFeather = new LightFeather();

Hooks.once("init", () => {
  registerSettings();
  registerTokenConfig();
  if (![13, 14].includes(game.release.generation)) {
    console.warn(`[${MODULE_ID}] Supported: Foundry VTT 13-14. Visual rendering is disabled on other generations.`);
    return;
  }
  feather.install();
  lightFeather.install();
  Hooks.on("visibilityRefresh", visibility => feather.refresh(visibility));
  Hooks.on("canvasReady", () => feather.refresh());
  Hooks.on("canvasTearDown", () => feather.release());
  Hooks.on("updateToken", (document, changes) => {
    if (!canvas.ready || document.parent?.id !== canvas.scene?.id) return;
    // Flag changes alone do not trigger the core Token sight render flags.
    // This also runs for remote updates on every player's client.
    const refresh = {};
    if (flagChanged(changes)) refresh.refreshVision = true;
    if (flagChanged(changes, LIGHT_FLAG)) {
      refresh.refreshLighting = true;
      refresh.refreshVision = true;
    }
    if (Object.keys(refresh).length) canvas.perception.update(refresh);
  });
  Hooks.on("updateAmbientLight", (document, changes) => {
    if (!canvas.ready || document.parent?.id !== canvas.scene?.id || !flagChanged(changes, LIGHT_FLAG)) return;
    canvas.perception.update({refreshLighting: true, refreshVision: true});
  });
});
