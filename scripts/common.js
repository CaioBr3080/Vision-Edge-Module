export const MODULE_ID = "vision-edge-attenuation";
export const FLAG = "edgeAttenuation";
export const FLAG_PATH = `flags.${MODULE_ID}.${FLAG}`;
export const LIGHT_FLAG = "lightEdgeAttenuation";
export const LIGHT_FLAG_PATH = `flags.${MODULE_ID}.${LIGHT_FLAG}`;
export const DEBUG = false;

export function clampAttenuation(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0;
}

export function getAttenuation(document, flag = FLAG) {
  return clampAttenuation(document?.getFlag?.(MODULE_ID, flag)
    ?? document?.flags?.[MODULE_ID]?.[flag]);
}

export function flagChanged(changes, flag = FLAG) {
  const flags = changes.flags?.[MODULE_ID];
  return Object.hasOwn(changes, `flags.${MODULE_ID}.${flag}`)
    || Object.hasOwn(changes, `flags.${MODULE_ID}.-=${flag}`)
    || Object.hasOwn(changes.flags ?? {}, `-=${MODULE_ID}`)
    || (flags !== undefined && (flags === null || Object.hasOwn(flags, flag)
      || Object.hasOwn(flags, `-=${flag}`)));
}

export function debug(...args) {
  if (DEBUG) console.debug("[Vision Edge Attenuation]", ...args);
}
