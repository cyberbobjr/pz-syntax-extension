# Project Zomboid VSCode Syntax Extension

This VS Code extension provides comprehensive support for Project Zomboid's scripting files, including syntax highlighting, auto-formatting, and diagnostics for items, recipes, and other script blocks.

The supported version of Project Zomboid is b42.

## Features

- Syntax highlighting for Project Zomboid's scripting language:
  - `module` declarations
  - `items` blocks
  - `fixing` blocks
  - `recipe` blocks
  - `craftRecipe` blocks
  - Various item properties and keywords
- Navigation features:
  - Go to item definition with CTRL+click
  - Hover information for items (shows definition when hovering over Base.ITEM)
- Automatic indentation rules
- Block comment support (`/* */`)
- Line comment support (`//`)
- Auto-formatting support:
  - Aligns assignments within blocks
  - Maintains proper indentation levels
- Diagnostics:
  - Identifies unrecognized keywords within blocks
  - Provides warnings for potential issues in the script

## Changelog
- v0.2.7 - Add a new setting 'pzFilenames' which you can specify filename that must be treated like a 'pz-scripting' file, regex allowed
- v0.2.5 - Better file extension support, now .txt files are recognized ad PZ file only if 'module XXXX {' is at beginning of the file
- v0.2.4 - Add missing properties for clothing & cooking & fix hilighting of craftRecipe name
- v0.2.3 - Add missing properties for items, refactor all the code for detecting bloc, add a syntax checker for missing comma
- v0.2.2 - Add missing properties for clothing
- v0.2.1 - Add missing properties for vehicle
- v0.2.0 - Initial release

## GitHub Repository

You can find the source code and contribute to this project on GitHub:
[pz-syntax-extension](https://github.com/cyberbobjr/pz-syntax-extension)

## Configuration
By default the Project Zomboid directory is "C:\Program Files (x86)\Steam\steamapps\common\ProjectZomboid\media\scripts", but you can change this in the settings of the extension.
You can add custom filename if you want they be detected as "pz-scripting" file

## Known issues
Sometime items/craftRecipe files are not detected as pz-scripting, in this case close them all.

## Installation if you want to evolve or fix the extension

1. Clone the repository or download the source code.
2. Open the project in Visual Studio Code.
3. Press `F5` to run the extension in a new Extension Development Host window.

## Usage

- Open a file with the `.txt` extension to activate the syntax highlighting, formatting, and diagnostic features.
- Use the command palette to access any additional commands provided by the extension.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## Supporting the Project

If you find this extension helpful, please consider supporting its development. Your donations help me stay motivated and show my wife that all the time spent away from her is worthwhile! 😊

[Support me](https://ko-fi.com/Z8Z8QJV31)

## Todo
Autofilling tags & flags for items/craftRecipe
Autocompleting properties, Base.itemName and so on
Detection of entities
Improve documentation for properties
Detection of custom module from others mods

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Notes

This is my first extension, please be kind. Special thanks to Copilot for helping me create this extension (and DeepSeek too, a lot).