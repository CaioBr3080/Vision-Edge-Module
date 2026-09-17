import {mkdir, readFile, readdir, writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {spawnSync} from "node:child_process";

// Use built-in Windows zip support, with portable '/' entry names; never distribute Foundry assets.
if (process.platform !== "win32") throw new Error("Use zip -r on module.json scripts lang README.md docs on this platform.");
const manifest = JSON.parse(await readFile("module.json", "utf8"));
await mkdir("dist", {recursive: true});
const staging = resolve("dist", manifest.id);
await mkdir(staging, {recursive: true});
async function copyFile(path) {
  await writeFile(resolve(staging, path), await readFile(path));
}
for (const path of ["module.json", "README.md"]) await copyFile(path);
for (const directory of ["scripts", "lang", "docs"]) {
  await mkdir(resolve(staging, directory), {recursive: true});
  for (const name of await readdir(directory)) await copyFile(`${directory}/${name}`);
}
const destination = resolve("dist", `${manifest.id}-${manifest.version}.zip`);
const quote = value => `'${value.replaceAll("'", "''")}'`;
const archiveScript = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$moduleStream = [System.IO.File]::Open(${quote(destination)}, [System.IO.FileMode]::Create)
$moduleZip = [System.IO.Compression.ZipArchive]::new($moduleStream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($moduleFile in Get-ChildItem -LiteralPath ${quote(staging)} -File -Recurse) {
    $moduleRelative = $moduleFile.FullName.Substring(${staging.length + 1}).Replace('\\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($moduleZip, $moduleFile.FullName,
      ${quote(`${manifest.id}/`)} + $moduleRelative, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally {
  $moduleZip.Dispose()
  $moduleStream.Dispose()
}`;
const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", archiveScript], {encoding: "utf8"});
if (result.status !== 0) throw new Error(result.stderr);
console.log(destination);
