# Changelog

## 0.3.0 — Build 42.21

Rewrite of the extension on top of a parser that follows the game's own script parser, and of a schema generated from Build 42.21.

The extension moves to the `cyberbobjr-pz-modding` publisher as **Project Zomboid Script Support (Build 42)**. Versions up to 0.2.9 were published as `cyberbobjr.pz-syntax-extension`: uninstall that one, as both would handle the same files.

- **All script blocks** are supported: entities and their components, fluids, energies, timed actions, models, sounds, vehicles and templates, xui skins, character traits and professions, ragdolls, physics shapes… The previous version only knew `item`, `craftRecipe` and `fixing`.
- **Validation against the game**:
  - unknown properties with "did you mean" suggestions;
  - Build 41 `Type` converted to `ItemType = base:x`;
  - values checked against the game registries (tags, item types, body locations, categories);
  - recipe lines (`mode:`, `flags[...]`);
  - duplicate properties and unknown components;
  - missing commas before a block.
- **`//` comments are reported as errors**: the game has no line comments and reads them as script. The editor now inserts `/* */`. Nested `/* /* */ */` comments are supported like in the game.
- Vehicle parts: a bare `install { }` / `uninstall { }` block is ignored by the game; a quick fix turns it into `table install { }`.
- Numbers follow Java's syntax (`0.25f`), and values from other mods' namespaces (`mymod:thing`) are accepted. Mods may add their own recipe and display categories, so those are never reported.
- **Quick fixes** for typos, missing commas, `//` comments, `Type`, and tags without a namespace.
- **Completion**:
  - properties of every block, ordered by the item's `ItemType`;
  - registry values;
  - recipe line templates, flags, modes and tags;
  - ids of vanilla and workspace objects.
- **Hover** documentation with vanilla usage and common values; definition previews.
- **Go to definition** for items, fluids, timed actions, entity styles, models, sounds and recipes.
- **Outline** (document symbols).
- **Formatter** rewritten for every block: it only changes whitespace and is checked against every vanilla script.
- **Game folder found through Steam**, including libraries on other drives. `searchDirectories` now defaults to automatic.
- Files under `media/scripts` are recognized automatically.
- Unit tests (including checks against all 1,004 vanilla scripts) and an end-to-end test in VS Code.

## 0.2.9

- Add new properties for item

## 0.2.8

- Fix bug when formatting fixing script

## 0.2.7

- Add a new setting 'pzFilenames' which you can specify filename that must be treated like a 'pz-scripting' file, regex allowed

## 0.2.5

- Better file extension support, now .txt files are recognized as PZ file only if 'module XXXX {' is at beginning of the file

## 0.2.4

- Add missing properties for clothing & cooking & fix highlighting of craftRecipe name

## 0.2.3

- Add missing properties for items, refactor all the code for detecting blocks, add a syntax checker for missing comma

## 0.2.2

- Add missing properties for clothing

## 0.2.1

- Add missing properties for vehicle

## 0.2.0

- Initial release
