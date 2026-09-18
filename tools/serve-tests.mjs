import http from "node:http";
import {readFile, mkdir, writeFile} from "node:fs/promises";
import {resolve, extname, sep} from "node:path";

const root = resolve(".");
const foundryRoot = process.argv[2];
if (!foundryRoot) throw new Error("Pass the local Foundry resources/app directory.");
const vendors = new Map([
  ["/vendor/pixi.js", resolve(foundryRoot, "node_modules/pixi.js/dist/pixi.js")],
  ["/vendor/cached-container.mjs", resolve(foundryRoot, "client/canvas/containers/advanced/cached-container.mjs")]
]);
http.createServer(async (request, response) => {
  try {
    const path = new URL(request.url, "http://127.0.0.1").pathname;
    if (path === "/perception/vision-mode.mjs") {
      // Shader getters need constants only; no game document or VisionMode logic is simulated.
      response.setHeader("Content-Type", "text/javascript");
      response.end("export default {LIGHTING_VISIBILITY: {DISABLED: 0, ENABLED: 1, REQUIRED: 2}};");
      return;
    }
    if (path.startsWith("/vendor/shaders/") || path.startsWith("/vendor/mixins/")) {
      const renderingRoot = resolve(foundryRoot, "client/canvas/rendering");
      const nativeFile = resolve(renderingRoot, path.slice("/vendor/".length));
      if (!nativeFile.startsWith(renderingRoot + sep)) throw new Error("Invalid vendor path");
      response.setHeader("Content-Type", "text/javascript");
      response.end(await readFile(nativeFile));
      return;
    }
    if (request.method === "POST" && path === "/results") {
      let body = "";
      for await (const chunk of request) body += chunk;
      await mkdir("test-results", {recursive: true});
      const results = JSON.parse(body);
      const resultFile = results.suite === "light" ? "light-webgl.json" : "webgl.json";
      await writeFile(`test-results/${resultFile}`, JSON.stringify(results, null, 2));
      console.log(JSON.stringify(results));
      response.end("ok");
      return;
    }
    const file = vendors.get(path) ?? resolve(root, `.${decodeURIComponent(path)}`);
    if (!vendors.has(path) && !file.startsWith(root + sep)) throw new Error("Invalid path");
    const types = {".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json"};
    response.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream");
    response.end(await readFile(file));
  } catch { response.writeHead(404).end("Not found"); }
}).listen(32113, "127.0.0.1", () => console.log("http://127.0.0.1:32113/tests/webgl.html"));
