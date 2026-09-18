import {LIGHT_FLAG, getAttenuation, debug} from "./common.js";

const UNIFORM = "veaLightEdgeAttenuation";
// Program.vertexSrc/fragmentSrc already include PIXI's generated name. A new
// Program adds its own name, so remove the old define to avoid GLSL redefinition.
const withoutShaderName = source => source.replace(/^\s*#define\s+SHADER_NAME[^\r\n]*(?:\r?\n|$)/gm, "");

function setProgram(shader, program) {
  if (shader.program === program) return;
  const renderer = globalThis.canvas?.app?.renderer;
  // PIXI may still hold this instance as its bound shader from the last frame.
  // Reset that binding before switching programs, so projection updates cannot
  // synchronize against a program which has not been linked yet.
  if (renderer?.shader?.shader === shader) {
    renderer.batch.flush();
    renderer.shader.reset();
  }
  shader.program = program;
}

/**
 * Add radial attenuation immediately before the native output consumes `depth`.
 * In illumination this fades toward computedBackgroundColor, not toward black;
 * in coloration/background it reduces only that light's contribution.
 */
export function patchLightFragment(fragment) {
  // Preserve source offsets while ignoring commented GLSL examples.
  const code = fragment.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
    comment => comment.replace(/[^\n]/g, " "));
  const mains = [...code.matchAll(/\bvoid\s+main\s*\(\s*(?:void\s*)?\)/g)];
  const outputs = [...code.matchAll(/\bgl_FragColor\s*=\s*([^;]+);/g)];
  if (mains.length !== 1 || outputs.length !== 1
    || !/\bvarying\s+(?:(?:highp|mediump|lowp)\s+)?vec2\s+vUvs\s*;/.test(code)
    || !/\bfloat\s+depth\s*=/.test(code) || !/\bdepth\b/.test(outputs[0][1])
    || outputs[0].index <= mains[0].index || code.includes(UNIFORM)) return null;
  const main = mains[0].index;
  const output = outputs[0].index;
  return fragment.slice(0, main) + `uniform float ${UNIFORM};\n`
    + fragment.slice(main, output) + `
      if (${UNIFORM} > 0.0) {
        float veaRangeDistance = distance(vUvs, vec2(0.5)) * 2.0;
        depth *= 1.0 - smoothstep(1.0 - 0.5 * ${UNIFORM}, 1.0, veaRangeDistance);
      }
      ` + fragment.slice(output);
}

/** Uses existing hooks and shader instances; no core method/prototype replacement. */
export class LightFeather {
  constructor() {
    this.shaders = new WeakMap();
    this.programs = new WeakMap();
    this.warned = false;
  }

  install() {
    Hooks.on("initializePointLightSourceShaders", source => this.updateSource(source));
    Hooks.on("lightingRefresh", effects => this.refresh(effects));
    Hooks.on("canvasReady", () => this.refresh());
  }

  restore(shader) {
    const entry = this.shaders.get(shader);
    if (!entry) return;
    if (shader.program === entry.program) setProgram(shader, entry.original);
    delete shader.uniforms[UNIFORM];
  }

  warn(source, reason) {
    debug("Unsupported light shader", source.sourceId, reason);
    if (this.warned) return;
    this.warned = true;
    console.warn("[Vision Edge Attenuation] Light edge attenuation disabled for an incompatible source:", source.sourceId, reason);
    ui.notifications.warn(game.i18n.localize("VEA.LightUnsupported"));
  }

  updateSource(source) {
    if (source.constructor.sourceType !== "light") return;
    const shaders = Object.values(source.layers ?? {}).map(layer => layer.shader).filter(Boolean);
    const attenuation = getAttenuation(source.object?.document, LIGHT_FLAG);
    if (!attenuation || source.data?.negative || source.radius <= 0) {
      for (const shader of shaders) this.restore(shader);
      return;
    }
    const pending = [];
    try {
      for (const shader of shaders) {
        let entry = this.shaders.get(shader);
        // Respect another module replacing a shader program after initialization.
        if (entry && shader.program !== entry.original && shader.program !== entry.program) entry = null;
        if (!entry) {
          const original = shader.program;
          let program = this.programs.get(original);
          if (!program) {
            const fragment = patchLightFragment(original.fragmentSrc);
            if (!fragment) throw new Error(`Unsupported adaptive output in ${shader.constructor.name}`);
            program = PIXI.Program.from(withoutShaderName(original.vertexSrc), withoutShaderName(fragment));
            this.programs.set(original, program);
          }
          entry = {original, program};
          this.shaders.set(shader, entry);
        }
        pending.push({shader, entry});
      }
      // Apply all layers together, only after every layer passes compatibility checks.
      for (const {shader, entry} of pending) {
        shader.uniforms[UNIFORM] = attenuation;
        setProgram(shader, entry.program);
      }
      debug("Light source updated", source.sourceId, "Edge attenuation:", attenuation);
    } catch (error) {
      for (const shader of shaders) this.restore(shader);
      this.warn(source, error);
    }
  }

  refresh(effects = canvas.effects) {
    for (const source of effects?.lightSources ?? []) this.updateSource(source);
  }
}
