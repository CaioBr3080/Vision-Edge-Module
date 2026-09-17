import {VisionFeather, createSightMesh, VERTEX_SHADER, FRAGMENT_SHADER} from "../scripts/vision-feather.js";
import CachedContainer from "/vendor/cached-container.mjs";

const results = [];
function check(name, condition, details = "") {
  results.push({name, passed: Boolean(condition), details});
  if (!condition) throw new Error(`${name}: ${details}`);
}
try {
  const renderer = new PIXI.Renderer({width: 280, height: 240, resolution: 1, backgroundAlpha: 0, antialias: false});
  // Recreate Foundry's MAX_COLOR blend equation for standalone PIXI.
  const gl = renderer.gl;
  const maxMode = renderer.state.blendModes.length;
  renderer.state.blendModes[maxMode] = [gl.ONE, gl.ONE, gl.ONE, gl.ONE, gl.MAX, gl.MAX];
  PIXI.BLEND_MODES.MAX_COLOR = maxMode;
  const program = PIXI.Program.from(VERTEX_SHADER, FRAGMENT_SHADER);
  const circle = (x, y, radius, start = 0, end = 2 * Math.PI) => {
    const points = start !== 0 || end !== 2 * Math.PI ? [x, y] : [];
    for (let i = 0; i <= 256; i++) {
      const angle = start + (end - start) * i / 256;
      points.push(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
    }
    return {points};
  };
  const source = (value, shape = circle(120, 120, 100)) => ({
    x: 120, y: 120, radius: 100, shape, hasActiveLayer: true, isBlinded: false,
    object: {document: {getFlag: () => value}}
  });
  // PIXI extract unpremultiplies RGB, so alpha carries the raw red-mask value
  // for these RGBA test textures (the runtime texture uses RED).
  const pixel = (pixels, x, y) => pixels[(y * 280 + x) * 4 + 3];
  function renderCase(name, sources, show = true) {
    const stage = new PIXI.Container();
    for (const [s, value] of sources) stage.addChild(createSightMesh(s, value, program));
    const texture = PIXI.RenderTexture.create({width: 280, height: 240});
    renderer.render(stage, {renderTexture: texture, clear: true});
    const pixels = renderer.extract.pixels(texture);
    if (show) {
      const card = document.createElement("div");
      card.className = "case";
      const label = document.createElement("p");
      label.textContent = name;
      card.append(label, renderer.extract.canvas(texture));
      document.querySelector("#cases").append(card);
    }
    stage.destroy({children: true});
    texture.destroy(true);
    return pixels;
  }
  const zero = renderCase("0 — native hard range", [[source(0), 0]]);
  const half = renderCase("0.5 — medium fade", [[source(0.5), 0.5]]);
  const full = renderCase("1 — wide fade", [[source(1), 1]]);
  check("zero retains full interior", pixel(zero, 215, 120) === 255);
  check("center unaffected", pixel(half, 120, 120) === 255 && pixel(full, 120, 120) === 255);
  check("medium fade progresses inward to outward", pixel(half, 200, 120) > pixel(half, 210, 120)
    && pixel(half, 210, 120) > pixel(half, 218, 120));
  check("maximum is wider than medium", pixel(full, 185, 120) < pixel(half, 185, 120));
  check("no range expansion", [zero, half, full].every(p => pixel(p, 221, 120) === 0));
  const wall = {points: [30, 60, 155, 60, 155, 180, 30, 180]};
  const blocked = renderCase("Wall — hard cut at x=155", [[source(1, wall), 1]]);
  check("wall interior retains full visibility", pixel(blocked, 153, 120) === 255);
  check("wall occludes immediately", pixel(blocked, 155, 120) === 0 && pixel(blocked, 156, 120) === 0);
  const cone = renderCase("Cone — hard sides, soft range", [[source(1, circle(120, 120, 100, -Math.PI / 4, Math.PI / 4)), 1]]);
  check("cone sides remain hard", pixel(cone, 155, 80) === 0 && pixel(cone, 155, 90) > 0);
  check("cone range fades", pixel(cone, 210, 120) > 0 && pixel(cone, 210, 120) < 100);
  const a = source(0.2);
  const b = source(0.8);
  b.x = 160; b.shape = circle(160, 120, 100);
  const onlyA = renderCase("A", [[a, 0.2]], false);
  const onlyB = renderCase("B", [[b, 0.8]], false);
  const both = renderCase("Two tokens — maximum union", [[a, 0.2], [b, 0.8]]);
  check("overlaps use maximum, not compounded alpha", [180, 200, 215, 240].every(x =>
    Math.abs(pixel(both, x, 120) - Math.max(pixel(onlyA, x, 120), pixel(onlyB, x, 120))) <= 1));

  // Test the secondary texture using the installed Foundry CachedContainer itself.
  globalThis.canvas = {app: {renderer}, performance: {mode: 0}, visibilityOptions: {},
    effects: {visionSources: [source(0.5)]}};
  globalThis.CONST = {CANVAS_PERFORMANCE_MODES: {MED: 1}};
  globalThis.ui = {notifications: {warn: text => {throw new Error(text);}}};
  globalThis.game = {i18n: {localize: key => key}};
  class TestMask extends CachedContainer {static textureConfiguration = {format: PIXI.FORMATS.RED}; autoRender = false; clearColor = [0, 0, 0, 0];}
  const maskPixel = (pixels, x, y) => pixels[(y * 280 + x) * 4];
  const mask = new TestMask();
  const vision = mask.addChild(new PIXI.Container());
  vision.light = vision.addChild(new PIXI.Container());
  vision.sight = vision.addChild(new PIXI.Graphics());
  vision.sight.beginFill(0xff0000).drawPolygon(canvas.effects.visionSources[0].shape.points).endFill();
  vision.darkness = vision.addChild(new PIXI.Graphics());
  canvas.masks = {vision: mask};
  canvas.visibility = {vision};
  const root = new PIXI.Container(); root.addChild(mask);
  const controller = new VisionFeather();
  controller.refresh();
  renderer.render(root);
  let primary = renderer.extract.pixels(mask.renderTexture);
  let visual = renderer.extract.pixels(controller.texture);
  check("secondary path is active", controller.active && !controller.failed);
  check("logical/fog texture remains hard", maskPixel(primary, 210, 120) === 255);
  check("separate visual texture fades", maskPixel(visual, 210, 120) > 0 && maskPixel(visual, 210, 120) < 255);
  const mesh = controller.meshes.values().next().value.mesh;
  const texture = controller.texture;
  controller.refresh();
  check("unchanged sources reuse mesh and texture", controller.meshes.values().next().value.mesh === mesh && controller.texture === texture);
  // Panning must rerender the secondary texture using the same transforms as the primary.
  root.position.set(10, 0); mask.renderDirty = true;
  renderer.render(root);
  visual = renderer.extract.pixels(controller.texture);
  check("panning keeps the feather aligned", maskPixel(visual, 210, 120) > 200 && maskPixel(visual, 220, 120) < 150);
  // Native light must remain available independently of finite darkvision radius.
  vision.light.addChild(new PIXI.Graphics()).beginFill(0xff0000).drawRect(220, 105, 35, 30).endFill();
  vision.darkness.beginFill(0xffffff).drawRect(235, 105, 10, 30).endFill();
  vision.darkness.blendMode = PIXI.BLEND_MODES.ERASE;
  root.position.set(0, 0); mask.renderDirty = true;
  renderer.render(root);
  visual = renderer.extract.pixels(controller.texture);
  check("native light perception preserved", maskPixel(visual, 225, 120) === 255);
  check("native darkness erasure preserved", maskPixel(visual, 240, 120) === 0);
  canvas.effects.visionSources[0].object.document.getFlag = () => 0;
  controller.refresh();
  check("zero releases secondary resources", controller.texture === null && controller.meshes.size === 0 && mask.children.length === 1);

  // Regression: fading lighting shaders alone leaves this reveal mask hard.
  // Reproduce both token Graphics and the cached ambient-light Sprite, under
  // the native LOS stencil, with no finite darkvision source at all.
  vision.light.removeChildren().forEach(child => child.destroy({children: true}));
  vision.sight.clear(); vision.darkness.clear();
  canvas.effects.visionSources = [];
  const lightSource = source(0);
  lightSource.constructor = {sourceType: "light"};
  let lightValue = 1;
  lightSource.object.document.getFlag = (_namespace, flag) => flag === "lightEdgeAttenuation" ? lightValue : 0;
  canvas.effects.lightSources = [lightSource];
  vision.light.global = vision.light.addChild(new PIXI.Graphics());
  vision.light.global.beginFill(0xff0000).drawRect(25, 15, 20, 15).endFill();
  vision.light.sources = vision.light.addChild(new PIXI.Graphics());
  vision.light.sources.beginFill(0xff0000).drawPolygon(lightSource.shape.points).endFill();
  vision.light.preview = vision.light.addChild(new PIXI.Graphics());
  const cachedTexture = PIXI.RenderTexture.create({width: 280, height: 240});
  renderer.render(vision.light.sources, {renderTexture: cachedTexture, clear: true});
  vision.light.cached = vision.light.addChild(new PIXI.Sprite(cachedTexture));
  vision.light.cached.blendMode = PIXI.BLEND_MODES.MAX_COLOR;
  const los = vision.light.addChild(new PIXI.Graphics());
  los.beginFill(0xffffff).drawRect(0, 0, 280, 240).endFill();
  vision.light.mask = los;
  controller.refresh(); renderer.render(root);
  primary = renderer.extract.pixels(mask.renderTexture);
  visual = renderer.extract.pixels(controller.texture);
  check("light flag alone enables reveal attenuation", controller.active && controller.featherLights);
  check("token and cached ambient reveal remains logically hard", maskPixel(primary, 218, 120) === 255);
  check("token and cached ambient reveal fades visually", maskPixel(visual, 218, 120) < 5 && maskPixel(visual, 200, 120) > 0);
  check("light reveal center remains intact", maskPixel(visual, 120, 120) === 255);
  check("native global illumination preserved", maskPixel(visual, 30, 20) === 255);
  check("native point containers restored after visual pass", vision.light.sources.renderable && vision.light.cached.renderable && !controller.light.renderable);
  const lightMesh = controller.lightMeshes.get(lightSource).mesh;
  controller.refresh();
  check("light reveal geometry reused", controller.lightMeshes.get(lightSource).mesh === lightMesh);
  los.clear().beginFill(0xffffff).drawRect(0, 0, 205, 240).endFill(); mask.renderDirty = true;
  renderer.render(root); visual = renderer.extract.pixels(controller.texture);
  check("native light LOS stencil clips the faded reveal", maskPixel(visual, 203, 120) > 0 && maskPixel(visual, 206, 120) === 0);
  const neighbour = source(0); neighbour.constructor = {sourceType: "light"};
  canvas.effects.lightSources.push(neighbour);
  controller.refresh(); renderer.render(root); visual = renderer.extract.pixels(controller.texture);
  check("overlapping unattenuated light retains its own reveal", maskPixel(visual, 203, 120) === 255);
  canvas.effects.lightSources.pop();
  lightValue = 0; controller.refresh();
  check("zero light attenuation releases reveal resources", !controller.active && controller.light === null && controller.lightMeshes.size === 0);
  lightValue = 1; controller.refresh();
  const nativeRender = vision.light.render;
  vision.light.render = () => {throw new Error("simulated render failure");};
  ui.notifications.warn = () => {};
  controller.renderVisualMask(renderer);
  check("render failure restores native containers", vision.light.sources.renderable && vision.light.cached.renderable && !controller.light.renderable && !controller.active);
  vision.light.render = nativeRender;
  controller.release(); cachedTexture.destroy(true);
  mask.destroy({children: true});
  renderer.destroy();
} catch (error) {
  results.push({name: "execution", passed: false, details: error.stack});
}
const summary = {passed: results.every(r => r.passed), tests: results};
document.querySelector("#results").textContent = JSON.stringify(summary, null, 2);
document.title = summary.passed ? "PASS — Vision Edge Attenuation" : "FAIL — Vision Edge Attenuation";
await fetch("/results", {method: "POST", body: JSON.stringify(summary)});
