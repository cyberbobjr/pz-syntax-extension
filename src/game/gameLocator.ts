import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// Finds Project Zomboid installs through Steam: the default Steam folders, then every library listed
// in steamapps/libraryfolders.vdf (games are often installed on another drive, e.g. D:\SteamLibrary).

const GAME_FOLDER = path.join("steamapps", "common", "ProjectZomboid");
const MAC_APP_CONTENT = path.join("Project Zomboid.app", "Contents", "Java");

export function defaultSteamRoots(platform: NodeJS.Platform = process.platform, home = os.homedir()): string[] {
  if (platform === "win32") {
    return ["C:\\Program Files (x86)\\Steam", "C:\\Program Files\\Steam"];
  }
  if (platform === "darwin") {
    return [path.join(home, "Library", "Application Support", "Steam")];
  }
  return [path.join(home, ".steam", "steam"), path.join(home, ".local", "share", "Steam")];
}

/** Library paths declared in a libraryfolders.vdf file. */
export function parseLibraryFolders(vdf: string): string[] {
  const paths: string[] = [];
  for (const match of vdf.matchAll(/"path"\s+"((?:[^"\\]|\\.)*)"/g)) {
    paths.push(match[1].replace(/\\\\/g, "\\"));
  }
  return paths;
}

function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function readLibraries(steamRoot: string): string[] {
  try {
    return parseLibraryFolders(fs.readFileSync(path.join(steamRoot, "steamapps", "libraryfolders.vdf"), "utf8"));
  } catch {
    return [];
  }
}

/** Game install folder (the one holding media/ and projectzomboid.jar) inside a Steam library, if present. */
function gameFolderIn(library: string): string | undefined {
  const folder = path.join(library, GAME_FOLDER);
  if (isDirectory(path.join(folder, "media", "scripts"))) return folder;
  const macFolder = path.join(folder, MAC_APP_CONTENT);
  if (isDirectory(path.join(macFolder, "media", "scripts"))) return macFolder;
  return undefined;
}

export function findGameFolders(steamRoots: string[] = defaultSteamRoots()): string[] {
  const libraries = steamRoots.flatMap((root) => [root, ...readLibraries(root)]);
  const seen = new Set<string>();
  const folders: string[] = [];
  for (const library of libraries) {
    const folder = gameFolderIn(library);
    const key = folder && path.resolve(folder).toLowerCase();
    if (folder && key && !seen.has(key)) {
      seen.add(key);
      folders.push(folder);
    }
  }
  return folders;
}

/** media/scripts folders of the installed games. */
export function findVanillaScriptFolders(steamRoots?: string[]): string[] {
  return findGameFolders(steamRoots).map((folder) => path.join(folder, "media", "scripts"));
}
