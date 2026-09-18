import {LIGHT_FLAG, getAttenuation, getFogAttenuation, debug} from "./common.js";

export const VERTEX_SHADER = `
precision highp float;
attribute vec2 aVertexPosition;
uniform mat3 translationMatrix;
uniform mat3 projectionMatrix;
varying vec2 vCanvasPosition;
void main() {
  vCanvasPosition = aVertexPosition;
  gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
}`;

export const FRAGMENT_SHADER = `
precision highp float;
varying vec2 vCanvasPosition;
uniform vec2 origin;
uniform float radius;
uniform float edgeAttenuation;
void main() {
  float alpha = 1.0;
  if (edgeAttenuation > 0.0 && radius > 0.0) {
    float distanceToOrigin = distance(vCanvasPosition, origin) / radius;
    // Only the last 5-50% of the finite range fades; the center stays unchanged.
    float width = 0.5 * edgeAttenuation;
    alpha = 1.0 - smoothstep(1.0 - width, 1.0, distanceToOrigin);
  }
  gl_FragColor = vec4(alpha, 0.0, 0.0, alpha);
}`;

/** Triangulate the existing wall-clipped polygon, never an unconstrained circle. */
export function createSightMesh(source, attenuation, program) {
  const points = source.shape?.points;
  if (!points || points.length < 6) return null;
  const geometry = new PIXI.Geometry()
    .addAttribute("aVertexPosition", new Float32Array(points), 2)
    .addIndex(PIXI.utils.earcut(Array.from(points)));
  const shader = new PIXI.Shader(program, {
    origin: new Float32Array([source.x, source.y]),
    radius: source.radius,
    edgeAttenuation: source.isBlinded ? 0 : attenuation
  });
  const mesh = new PIXI.Mesh(geometry, shader);
  mesh.blendMode = PIXI.BLEND_MODES.MAX_COLOR;
  // Mesh batching would replace this shader with PIXI's texture batch shader.
  mesh.shader.batchable = false;
  return mesh;
}

export class VisionFeather {
  constructor() {
    this.mask = null;
    this.texture = null;
    this.sight = null;
    this.light = null;
    this.lightMeshes = new Map();
    this.featherLights = false;
    this.program = null;
    this.meshes = new Map();
    this.active = false;
    this.failed = false;
    this.warnings = new Set();
  }

  warn(key, detail) {
    if (this.warnings.has(key)) return;
    this.warnings.add(key);
    console.warn("[Vision Edge Attenuation]", detail);
    ui.notifications.warn(game.i18n.localize(key));
  }

  install() {
    const Base = CONFIG.Canvas.visibilityFilter;
    if (typeof Base?.prototype?.apply !== "function") {
      this.failed = true;
      this.warn("VEA.Unsupported", "CONFIG.Canvas.visibilityFilter.apply is unavailable.");
      return;
    }
    const controller = this;
    // Preserve the full native shader, fog colors, overlay and Vision Mode handling.
    // Only this filter's sampler is swapped; fog commits and all logical masks remain native.
    CONFIG.Canvas.visibilityFilter = class EdgeVisibilityFilter extends Base {
      apply(...args) {
        const originalTexture = this.uniforms.visionTexture;
        const originalBlur = this.blur;
        if (controller.active && controller.texture) this.uniforms.visionTexture = controller.texture;
        // The native VisibilityFilter blurs its input before it composites
        // current sight with exploration. Extending only that visual blur softens
        // the newly explored Fog edge without changing fog data or visibility tests.
        const fogBlur = controller.getFogBlur();
        if (fogBlur > 0 && Number.isFinite(originalBlur)) this.blur = originalBlur + fogBlur;
        try { return super.apply(...args); }
        finally {
          this.uniforms.visionTexture = originalTexture;
          if (Number.isFinite(originalBlur)) this.blur = originalBlur;
        }
      }
    };
  }

  getFogBlur() {
    const attenuation = getFogAttenuation();
    if (!attenuation || !canvas?.blur?.enabled) return 0;
    const gridSize = Number(canvas.dimensions?.size) || 100;
    return Math.min(64, Math.max(2, gridSize * 0.35)) * attenuation;
  }


  refresh(visibility = canvas.visibility) {
    if (this.failed) return;
    const sources = Array.from(canvas.effects?.visionSources ?? [])
      .filter(source => source.hasActiveLayer);
    // Global illumination has no point-source radius or editable light flag.
    const lights = Array.from(canvas.effects?.lightSources ?? [])
      .filter(source => source.hasActiveLayer && source.constructor.sourceType === "light"
        && !source.data?.negative && source.radius > 0);
    const featherLights = lights.some(source => getAttenuation(source.object?.document, LIGHT_FLAG) > 0);
    const enabled = sources.some(source => !source.isBlinded && source.radius > 0
      && getAttenuation(source.object?.document) > 0) || featherLights;
    if (!enabled) { this.release(); return; }
    if (canvas.visibilityOptions?.persistentVision) {
      this.release();
      this.warn("VEA.PersistentVision", "VisibilityFilter persistentVision uses exploration only, without the current-vision sampler.");
      return;
    }
    const mask = canvas.masks?.vision;
    const vision = visibility?.vision;
    if (!mask?.createRenderTexture || !mask?.removeRenderTexture || !vision?.light || !vision?.darkness
      || !PIXI.utils?.earcut || sources.some(source => !source.shape?.points)) {
      this.release();
      this.warn("VEA.Unsupported", "Expected V13 CanvasVisionMask secondary render path or PointVisionSource polygon is unavailable.");
      return;
    }
    if (featherLights && (!vision.light.sources || !vision.light.preview || !vision.light.cached
      || lights.some(source => !source.shape?.points))) {
      this.release();
      this.warn("VEA.Unsupported", "Expected native point-light visibility containers are unavailable.");
      return;
    }
    try {
      if (this.mask !== mask) this.release();
      if (!this.texture) {
        this.mask = mask;
        this.program ??= PIXI.Program.from(VERTEX_SHADER, FRAGMENT_SHADER);
        this.sight = mask.addChild(new PIXI.Container());
        // Update transforms with the mask, but do not draw into the logical primary texture.
        this.sight.renderable = false;
        this.texture = mask.createRenderTexture({
          clearColor: [0, 0, 0, 0],
          renderFunction: renderer => this.renderVisualMask(renderer)
        });
      }
      // Keep this under the native light container: its LOS stencil and global
      // illumination remain native. It is hidden during logical/fog rendering.
      if (featherLights && this.light?.parent !== vision.light) {
        this.light?.destroy({children: true});
        this.lightMeshes.clear();
        this.light = vision.light.addChild(new PIXI.Container());
        this.light.renderable = false;
      }
      this.featherLights = featherLights;
      if (featherLights) this.updateLightMeshes(lights);
      else {
        this.light?.destroy({children: true});
        this.light = null;
        this.lightMeshes.clear();
      }
      const keep = new Set();
      for (const source of sources) {
        keep.add(source);
        let entry = this.meshes.get(source);
        if (entry?.shape !== source.shape) {
          entry?.mesh.destroy();
          const mesh = createSightMesh(source, getAttenuation(source.object?.document), this.program);
          if (!mesh) { this.meshes.delete(source); continue; }
          this.sight.addChild(mesh);
          entry = {shape: source.shape, mesh};
          this.meshes.set(source, entry);
        }
        const uniforms = entry.mesh.shader.uniforms;
        uniforms.origin[0] = source.x;
        uniforms.origin[1] = source.y;
        uniforms.radius = source.radius;
        uniforms.edgeAttenuation = source.isBlinded ? 0 : getAttenuation(source.object?.document);
        debug("Vision source updated", source.sourceId, "Edge attenuation:", uniforms.edgeAttenuation);
      }
      for (const [source, entry] of this.meshes) {
        if (!keep.has(source)) { entry.mesh.destroy(); this.meshes.delete(source); }
      }
      this.active = true;
      mask.renderDirty = true;
    } catch (error) {
      this.release();
      this.failed = true;
      this.warn("VEA.Unsupported", error);
    }
  }

  updateLightMeshes(sources) {
    const keep = new Set(sources);
    for (const source of sources) {
      let entry = this.lightMeshes.get(source);
      const attenuation = getAttenuation(source.object?.document, LIGHT_FLAG);
      if (entry?.shape !== source.shape) {
        entry?.mesh.destroy();
        const mesh = createSightMesh(source, attenuation, this.program);
        if (!mesh) { this.lightMeshes.delete(source); continue; }
        this.light.addChild(mesh);
        entry = {shape: source.shape, mesh};
        this.lightMeshes.set(source, entry);
      }
      const uniforms = entry.mesh.shader.uniforms;
      uniforms.origin[0] = source.x;
      uniforms.origin[1] = source.y;
      uniforms.radius = source.radius;
      uniforms.edgeAttenuation = attenuation;
    }
    for (const [source, entry] of this.lightMeshes) {
      if (!keep.has(source)) { entry.mesh.destroy(); this.lightMeshes.delete(source); }
    }
  }

  renderVisualMask(renderer) {
    if (!this.active || !this.sight) return;
    const vision = canvas.visibility.vision;
    const hidden = [];
    try {
      if (this.featherLights) {
        // Replace ALL point-light contributions in this visual pass, including
        // the static ambient-light cache. Keeping any would fill the fade to 1.
        for (const object of [vision.light.sources, vision.light.preview, vision.light.cached]) {
          hidden.push([object, object.renderable]);
          object.renderable = false;
        }
        this.light.renderable = true;
      }
      vision.light.render(renderer);
      this.sight.renderable = true;
      this.sight.render(renderer);
      vision.darkness.render(renderer);
    } catch (error) {
      this.active = false;
      this.failed = true;
      this.warn("VEA.Unsupported", error);
    } finally {
      for (const [object, renderable] of hidden) object.renderable = renderable;
      if (this.light) this.light.renderable = false;
      if (this.sight) this.sight.renderable = false;
    }
  }

  release() {
    this.active = false;
    if (this.texture && this.mask && !this.mask.destroyed) this.mask.removeRenderTexture(this.texture);
    this.sight?.destroy({children: true});
    this.light?.destroy({children: true});
    this.lightMeshes.clear();
    this.light = null;
    this.featherLights = false;
    this.meshes.clear();
    this.texture = this.sight = this.mask = null;
  }
}
