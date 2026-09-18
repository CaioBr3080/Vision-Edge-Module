import {MODULE_ID, playerMeasurementEnabled} from "./common.js";

function canUseMeasurement(token) {
  if (!token?.document) return false;
  if (!game.user?.isGM && !playerMeasurementEnabled()) return false;
  return game.user?.isGM || token.document.canUserModify?.(game.user, "update") === true;
}

function addMeasurementButton(app, element, feather) {
  const root = element?.querySelector ? element : app.element;
  if (!root || root.querySelector(".vea-measurement-button")) return;
  const token = app.object;
  if (!canUseMeasurement(token)) return;
  const column = root.querySelector(".col.left, .col.right");
  if (!column) return;

  const title = game.i18n.localize("VEA.Measurement.ButtonHint");
  const button = document.createElement("div");
  button.className = "control-icon vea-measurement-button";
  button.tabIndex = 0;
  button.setAttribute("role", "button");
  button.setAttribute("aria-label", title);
  button.title = title;
  button.innerHTML = '<i class="fa-solid fa-ruler-combined"></i>';
  column.append(button);

  let active = false;
  const stop = () => {
    if (!active) return;
    active = false;
    button.classList.remove("active");
    feather.setMeasurement(token.document.id, false);
    window.removeEventListener("pointerup", stop, true);
    window.removeEventListener("blur", stop, true);
  };
  const start = event => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    if (active) return;
    active = true;
    button.classList.add("active");
    feather.setMeasurement(token.document.id, true);
    button.setPointerCapture?.(event.pointerId);
    window.addEventListener("pointerup", stop, true);
    window.addEventListener("blur", stop, true);
  };
  button.addEventListener("pointerdown", start);
  button.addEventListener("pointerup", stop);
  button.addEventListener("pointercancel", stop);
  button.addEventListener("pointerleave", stop);
  button.addEventListener("keydown", event => {
    if (event.key === " " || event.key === "Enter") start(event);
  });
  button.addEventListener("keyup", stop);
}

export function registerTokenHud(feather) {
  Hooks.on("renderTokenHUD", (app, element) => addMeasurementButton(app, element, feather));
}
