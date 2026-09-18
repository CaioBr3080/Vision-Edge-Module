export const MODULE_ID = "vision-edge-attenuation";
export const FLAG = "edgeAttenuation";
export const FLAG_PATH = `flags.${MODULE_ID}.${FLAG}`;
export const LIGHT_FLAG = "lightEdgeAttenuation";
export const LIGHT_FLAG_PATH = `flags.${MODULE_ID}.${LIGHT_FLAG}`;
export const DEBUG = false;

export const SETTINGS = Object.freeze({
  VISION_DEFAULT: "visionDefault",
  LIGHT_DEFAULT: "lightDefault",
  FOG_ATTENUATION: "fogAttenuation",
  PLAYER_MEASUREMENT: "enablePlayerMeasurement"
});

const SETTINGS_BY_FLAG = Object.freeze({
  [FLAG]: SETTINGS.VISION_DEFAULT,
  [LIGHT_FLAG]: SETTINGS.LIGHT_DEFAULT
});

export function overrideFlag(flag = FLAG) {
  return `${flag}Override`;
}

export function flagPath(flag = FLAG) {
  return `flags.${MODULE_ID}.${flag}`;
}

export function clampAttenuation(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0;
}

/** Read a flag without treating a missing flag as zero. */
export function getDocumentFlag(document, flag) {
  try {
    const value = document?.getFlag?.(MODULE_ID, flag);
    if (value !== undefined) return value;
  } catch (_error) {
    // Fall through to plain data, which also keeps this helper usable in tests.
  }
  return document?.flags?.[MODULE_ID]?.[flag];
}

export function getRawAttenuation(document, flag = FLAG) {
  return getDocumentFlag(document, flag);
}

/**
 * A saved attenuation predating the priority checkbox is considered a custom
 * value. This preserves existing worlds when upgrading from v0.2.x.
 */
export function hasAttenuationOverride(document, flag = FLAG) {
  const value = getDocumentFlag(document, overrideFlag(flag));
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return getRawAttenuation(document, flag) !== undefined;
}

export function getGlobalAttenuation(flag = FLAG) {
  const setting = SETTINGS_BY_FLAG[flag];
  if (!setting) return 0;
  try {
    return clampAttenuation(game?.settings?.get?.(MODULE_ID, setting));
  } catch (_error) {
    return 0;
  }
}

export function getFogAttenuation() {
  try {
    return clampAttenuation(game?.settings?.get?.(MODULE_ID, SETTINGS.FOG_ATTENUATION));
  } catch (_error) {
    return 0;
  }
}

export function playerMeasurementEnabled() {
  try {
    return game?.settings?.get?.(MODULE_ID, SETTINGS.PLAYER_MEASUREMENT) === true;
  } catch (_error) {
    return false;
  }
}

/** Resolve either a document-specific override or the world default. */
export function getAttenuation(document, flag = FLAG) {
  if (document && hasAttenuationOverride(document, flag)) {
    return clampAttenuation(getRawAttenuation(document, flag));
  }
  return getGlobalAttenuation(flag);
}

export function flagChanged(changes, flag = FLAG) {
  const flags = changes.flags?.[MODULE_ID];
  const override = overrideFlag(flag);
  return [flag, override].some(key => Object.hasOwn(changes, flagPath(key))
    || Object.hasOwn(changes, `flags.${MODULE_ID}.-=${key}`)
    || (flags !== undefined && (flags === null || Object.hasOwn(flags, key)
      || Object.hasOwn(flags, `-=${key}`))))
    || Object.hasOwn(changes.flags ?? {}, `-=${MODULE_ID}`);
}

export function refreshPerception({lighting = true, vision = true} = {}) {
  if (!globalThis.canvas?.ready) return;
  canvas.perception?.update?.({
    ...(lighting ? {refreshLighting: true} : {}),
    ...(vision ? {refreshVision: true} : {})
  });
}

export function debug(...args) {
  if (DEBUG) console.debug("[Vision Edge Attenuation]", ...args);
}
