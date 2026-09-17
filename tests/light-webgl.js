import {LightFeather} from "../scripts/light-feather.js";
import Illumination from "/vendor/shaders/lighting/illumination-lighting.mjs";
import Coloration from "/vendor/shaders/lighting/coloration-lighting.mjs";
import Background from "/vendor/shaders/lighting/background-lighting.mjs";
import {TorchIlluminationShader, TorchColorationShader} from "/vendor/shaders/lighting/effects/torch.mjs";
import {PulseIlluminationShader, PulseColorationShader} from "/vendor/shaders/lighting/effects/pulse.mjs";

const results = [];
function check(name, condition, details = "") {
  results.push({name, passed: Boolean(condition), details});
  if (!condition) throw new Error(`${name}: ${details}`);
}
const clone = value => Array.isArray(value) ? value.map(clone)
  : value?.constructor === Object ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)])) : value;
globalThis.foundry = {utils: {
  deepClone: clone,
  mergeObject: (defaults, overrides) => Object.assign(clone(defaults), overrides),
  logCompatibilityWarning: () => {}
}};
globalThis.game = {i18n: {localize: key => key}};
globalThis.ui = {notifications: {warn: message => {throw new Error(message);}}};
try {
  const renderer = new PIXI.Renderer({width: 280, height: 240, backgroundAlpha: 0, antialias: false, resolution: 1});
  globalThis.canvas = {app: {renderer}, masks: {depth: {mapElevation: () => 0.5}}};
  const gl = renderer.gl;
  const maxMode = renderer.state.blendModes.length;
  renderer.state.blendModes[maxMode] = [gl.ONE, gl.ONE, gl.ONE, gl.ONE, gl.MAX, gl.MAX];
  PIXI.BLEND_MODES.MAX_COLOR = maxMode;
  const emptyDepth = PIXI.Texture.fromBuffer(new Uint8Array([0, 0, 0, 255]), 1, 1);
  const baseMap = PIXI.Texture.fromBuffer(new Uint8Array([128, 128, 128, 255]), 1, 1);
  const classes = [Illumination, Coloration, Background, TorchIlluminationShader,
    TorchColorationShader, PulseIlluminationShader, PulseColorationShader];
  const circle = () => {
    const points = [];
    for (let i = 0; i < 256; i++) {
      const angle = 2 * Math.PI * i / 256;
      points.push(Math.cos(angle), Math.sin(angle));
    }
    return points;
  };
  function makeMesh(shader, points = circle()) {
    const geometry = new PIXI.Geometry()
      .addAttribute("aVertexPosition", new Float32Array(points), 2)
      .addAttribute("aDepthValue", new Float32Array(points.length / 2).fill(1), 1)
      .addIndex(PIXI.utils.earcut(points));
    const mesh = new PIXI.Mesh(geometry, shader);
    mesh.scale.set(100); mesh.position.set(120, 120);
    mesh.shader.batchable = false;
    return mesh;
  }
  function render(mesh, name) {
    const stage = new PIXI.Container(); stage.addChild(mesh);
    const texture = PIXI.RenderTexture.create({width: 280, height: 240});
    renderer.render(stage, {renderTexture: texture, clear: true});
    const pixels = renderer.extract.pixels(texture);
    if (name) {
      const card = document.createElement("div"); card.className = "case";
      const label = document.createElement("p"); label.textContent = name;
      card.append(label, renderer.extract.canvas(texture));
      document.querySelector("#cases").append(card);
    }
    texture.destroy(true); stage.removeChild(mesh); stage.destroy();
    return pixels;
  }
  const at = (pixels, x, y, channel = 0) => pixels[(y * 280 + x) * 4 + channel];
  for (const Type of classes) {
    const shader = Type.create({
      attenuation: 0, ratio: 1, colorBackground: [0.2, 0.2, 0.2], colorBright: [1, 1, 1], colorDim: [1, 1, 1],
      depthTexture: emptyDepth, depthElevation: 0.5, primaryTexture: baseMap,
      darknessLevelTexture: emptyDepth, color: [1, 0.6, 0.1], screenDimensions: [280, 240],
      computeIllumination: false, useSampler: false, colorationAlpha: 1,
      weights: [0, 0, 1, 1]
    });
    const mesh = makeMesh(shader);
    let attenuation = 0;
    const source = {constructor: {sourceType: "light"}, radius: 100,
      object: {document: {getFlag: () => attenuation}}, layers: {test: {shader}}};
    const controller = new LightFeather();
    const native = shader.program;
    const original = render(mesh);
    attenuation = 0.5; controller.updateSource(source);
    const medium = render(mesh, Type === Illumination ? "Light 0.5 — medium edge fade" : null);
    attenuation = 1; controller.updateSource(source);
    const maximum = render(mesh, Type === Illumination ? "Light 1 — wide edge fade" : null);
    const channel = Type === Background ? 3 : 0;
    check(`${Type.name}: center unchanged`, at(original, 120, 120, channel) === at(maximum, 120, 120, channel),
      JSON.stringify({original: at(original, 120, 120, channel), medium: at(medium, 120, 120, channel), maximum: at(maximum, 120, 120, channel),
        edgeOriginal: at(original, 210, 120, channel), edgeMaximum: at(maximum, 210, 120, channel)}));
    check(`${Type.name}: outer contribution attenuated`, at(maximum, 210, 120, channel) < at(original, 210, 120, channel));
    check(`${Type.name}: wider fade at maximum`, at(maximum, 185, 120, channel) < at(medium, 185, 120, channel));
    check(`${Type.name}: hard geometric range preserved`, at(maximum, 221, 120, 3) === 0);
    if (Type === Illumination) {
      check("illumination fades to native background rather than black", at(maximum, 218, 120) >= 50 && at(maximum, 218, 120) <= 60);
      const wallMesh = makeMesh(shader, [-0.9, -0.6, 0.35, -0.6, 0.35, 0.6, -0.9, 0.6]);
      const wall = render(wallMesh, "Light behind wall — rigid occlusion");
      check("wall cutoff remains rigid", at(wall, 153, 120) > 200 && at(wall, 155, 120, 3) === 0);
      wallMesh.destroy();
      const conePoints = [0, 0];
      for (let i = 0; i <= 128; i++) {
        const angle = -Math.PI / 4 + Math.PI / 2 * i / 128;
        conePoints.push(Math.cos(angle), Math.sin(angle));
      }
      const coneMesh = makeMesh(shader, conePoints);
      const cone = render(coneMesh, "Directional light — hard sides, soft range");
      check("directional light sides remain rigid", at(cone, 155, 80, 3) === 0 && at(cone, 155, 90, 3) === 255);
      coneMesh.destroy();
    }
    // The original instance and constructor keep every native animation method/getter.
    shader.uniforms.attenuation = 0.2; shader.uniforms.time = 4.25;
    controller.updateSource(source);
    check(`${Type.name}: native uniforms and shader instance preserved`, shader instanceof Type
      && shader.uniforms.attenuation === 0.2 && shader.uniforms.time === 4.25);
    shader.uniforms.attenuation = 0;
    attenuation = 0; controller.updateSource(source);
    const restored = render(mesh);
    check(`${Type.name}: zero restores byte-identical native rendering`, shader.program === native
      && restored.every((value, index) => value === original[index]));
    check(`${Type.name}: program linked successfully`, gl.getError() === gl.NO_ERROR);
    mesh.destroy(); shader.destroy();
  }
  emptyDepth.destroy(true); baseMap.destroy(true); renderer.destroy();
} catch (error) {
  results.push({name: "execution", passed: false, details: error.stack});
}
const summary = {suite: "light", passed: results.every(r => r.passed), tests: results};
document.querySelector("#results").textContent = JSON.stringify(summary, null, 2);
document.title = summary.passed ? "PASS — Light Edge Attenuation" : "FAIL — Light Edge Attenuation";
await fetch("/results", {method: "POST", body: JSON.stringify(summary)});
