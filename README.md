# Project Zomboid Script Support

Language support for Project Zomboid script files (`media/scripts/*.txt`), up to date with **Build 42.21**.

The extension knows the scripts the way the game reads them. Its parser follows the game's own script parser, and its knowledge comes from the 1,004 vanilla scripts and from the properties the game code actually reads. It covers items, craft recipes, entities and components, fluids, energies, fixing, evolved recipes, timed actions, models, sounds, vehicles and templates, xui skins, character traits and professions, ragdolls, physics shapes…

## Features

### Validation

Errors and warnings as you type, each with a **quick fix** when one exists:
- **Missing commas**: the game silently merges the two lines.
- **`//` comments**: the game has no line comments and reads that text as script. The quick fix converts them to `/* */`.
- **Unbalanced braces**, unterminated comments, text outside any block.
- **Unknown properties**, for example `Wieght`, which the game silently ignores. You get a "did you mean `Weight`?" suggestion. Property names are case-insensitive, like in the game.
- **Build 41 leftovers**:
  - `Type = Weapon` is converted to `ItemType = base:weapon`;
  - tags without a namespace (`Hammer`) are converted to `base:hammer`.
- **Invalid values**: booleans, numbers, and values outside the game registries (item types, tags, body locations, display categories, weapon categories, recipe categories and tags).
- **Recipe lines**: resource (`item`, `fluid`, `energy`), amount, `mode:`, and input/output `flags[...]`.
- Unknown block types, unknown components and duplicate properties.

The vanilla scripts produce no diagnostics.

### Completion

- Script blocks at module level, sub-blocks and components.
- Properties of the current block, with the most useful ones first. In an item, the properties typical of its `ItemType` (food, weapon, clothing…) come first.
- Values: registry values (`base:weapon`, `base:hammer`…), booleans, common vanilla values.
- Recipe lines: `item`/`-fluid`/`energy` line templates, item ids in `[...]`, `tags[...]`, `flags[...]`, `mode:`, `mappers[...]`.
- `Module.Item` ids of vanilla and of your workspace.

### Hover and navigation

- Documentation of properties: description, value type, how often vanilla uses them, and their most common values.
- Hovering a reference shows its definition: `Base.Plank`, `timedAction = Making`, `-fluid 1.0 [Water]`, `entityStyle = ES_…`.
- **Go to definition** (F12 / Ctrl+click) across vanilla and your mod.
- **Outline** of the document: modules, objects and sub-blocks.

### Formatting

Re-indents blocks and aligns the `=` of consecutive properties. Only whitespace changes: statements, values and comments are kept as written.

### Highlighting

Block headers, properties, numbers, booleans, `Module.Item` references, namespaced ids (`base:hammer`), recipe line keywords. `//` lines are shown as errors.

## Settings

| Setting | Default | Description |
|---|---|---|
| `pzSyntaxExtension.searchDirectories` | `[]` | Script folders to index (vanilla, other mods). Empty: the game's `media/scripts`, found automatically through Steam, including libraries on other drives. |
| `pzSyntaxExtension.pzFilenames` | `["console.txt"]` | File names (regular expressions allowed) to treat as scripts. |
| `pzSyntaxExtension.diagnostics.unknownProperties` | `warning` | `error`, `warning`, `information` or `off`. |
| `pzSyntaxExtension.diagnostics.unknownValues` | `information` | Values missing from the game registries. Mods can register new ones, hence the low default level. |
| `pzSyntaxExtension.format.alignValues` | `true` | Align `=` when formatting. |

Files under a `media/scripts` folder are recognized automatically, as are `.txt` files starting with `module X`. The **PZ Script: Re-index scripts** command rebuilds the index.

## Updating to a new game version

The knowledge of the game lives in `data/schema.json`. It is generated from an installed game:

```sh
npm run generate-schema                     # finds the game through Steam
npm run generate-schema -- "D:/SteamLibrary/steamapps/common/ProjectZomboid"
```

The generator reads the vanilla scripts and the string constants of the script classes in `projectzomboid.jar`. It reports the block kinds whose properties it cannot fully verify.

## Development

```sh
npm install
npm test                  # unit tests + checks against every vanilla script (when the game is installed)
npm run test:integration  # end-to-end test in a real VS Code
```

Press `F5` in VS Code to run the extension in a development host.

## Contributing

Issues and pull requests are welcome on [GitHub](https://github.com/cyberbobjr/pz-syntax-extension).

## Supporting the Project

If you find this extension helpful, please consider supporting its development. Your donations help me stay motivated and show my wife that all the time spent away from her is worthwhile! 😊

[Support me](https://ko-fi.com/Z8Z8QJV31)

## License

MIT
