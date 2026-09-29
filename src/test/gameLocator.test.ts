import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { defaultSteamRoots, findGameFolders, findVanillaScriptFolders, parseLibraryFolders } from "../game/gameLocator";

const VDF = `"libraryfolders"
{
\t"0"
\t{
\t\t"path"\t\t"C:\\\\Program Files (x86)\\\\Steam"
\t}
\t"1"
\t{
\t\t"path"\t\t"D:\\\\SteamLibrary"
\t\t"apps" { "108600" "123" }
\t}
}`;

test("reads library paths from libraryfolders.vdf", () => {
  assert.deepEqual(parseLibraryFolders(VDF), ["C:\\Program Files (x86)\\Steam", "D:\\SteamLibrary"]);
});

test("finds the game in a secondary Steam library, once", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pz-steam-"));
  const steam = path.join(root, "Steam");
  const library = path.join(root, "Library2");
  fs.mkdirSync(path.join(steam, "steamapps"), { recursive: true });
  fs.mkdirSync(path.join(library, "steamapps", "common", "ProjectZomboid", "media", "scripts"), { recursive: true });
  const escaped = (p: string): string => p.replace(/\\/g, "\\\\");
  fs.writeFileSync(path.join(steam, "steamapps", "libraryfolders.vdf"), `"libraryfolders" { "0" { "path" "${escaped(steam)}" } "1" { "path" "${escaped(library)}" } "2" { "path" "${escaped(library)}" } }`);

  const game = path.join(library, "steamapps", "common", "ProjectZomboid");
  assert.deepEqual(findGameFolders([steam]), [game]);
  assert.deepEqual(findVanillaScriptFolders([steam]), [path.join(game, "media", "scripts")]);
  assert.deepEqual(findGameFolders([path.join(root, "missing")]), []);
});

test("default Steam roots per platform", () => {
  assert.ok(defaultSteamRoots("win32")[0].includes("Steam"));
  assert.equal(defaultSteamRoots("darwin", "/Users/me")[0], path.join("/Users/me", "Library", "Application Support", "Steam"));
  assert.equal(defaultSteamRoots("linux", "/home/me")[0], path.join("/home/me", ".steam", "steam"));
});
