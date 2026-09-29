'use strict';

// Builds data/schema.json from a Project Zomboid install:
//   - block structure, property names and typical values from the vanilla scripts (media/scripts)
//   - the property names the game reads or writes, from string literals of the script parser classes and
//     of the builders that generate the vanilla scripts (projectzomboid.jar)
//   - value registries (item tags, body locations, display categories…) from the jar
// Usage: npm run generate-schema -- [<ProjectZomboid folder>] [--version 42.21.0]

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Jar, classStringLiterals } = require('./jar');
const { parseScript, walkBlocks, isValue } = require('../out/parser/scriptParser');
const { schemaKeyOf, isFreeForm, propertyId } = require('../out/schema/schemaKey');
const { findGameFolders } = require('../out/game/gameLocator');

const OUTPUT = path.join(__dirname, '..', 'data', 'schema.json');
const MAX_VALUES = 15;
const MAX_ENUM_DISTINCT = 60;
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

const S = 'zombie/scripting/';
const O = `${S}objects/`;
const C = `${S}entity/components/`;
const B = 'generation/builders/';
const ATTRIBUTE = 'zombie/entity/components/attributes/Attribute';

/** Builder of the vanilla items of each ItemType: its keys are the properties typical of that type. */
const ITEM_BUILDERS = {
  'base:alarmclock': 'AlarmClockItemBuilder',
  'base:alarmclockclothing': 'AlarmClockClothingItemBuilder',
  'base:animal': 'AnimalItemBuilder',
  'base:clothing': 'ClothingItemBuilder',
  'base:container': 'ContainerItemBuilder',
  'base:drainable': 'DrainableItemBuilder',
  'base:food': 'FoodItemBuilder',
  'base:key': 'KeyItemBuilder',
  'base:literature': 'LiteratureItemBuilder',
  'base:map': 'MapItemBuilder',
  'base:moveable': 'MoveableItemBuilder',
  'base:radio': 'RadioItemBuilder',
  'base:weapon': 'WeaponItemBuilder',
  'base:weaponpart': 'WeaponPartItemBuilder',
};

// Classes reading (parsers) or writing (builders of the generated vanilla scripts) each block kind.
// A block is "strict" (unknown properties are reported) only when every property used by vanilla
// scripts is found in these classes, which shows the mapping is complete.
const CLASS_MAP = {
  item: [`${O}Item`, ATTRIBUTE, `${B}ItemBuilder`, ...Object.values(ITEM_BUILDERS).map((b) => `${B}${b}`)],
  craftrecipe: [`${C}crafting/CraftRecipe`, `${B}CraftRecipeBuilder`],
  'component:craftrecipe': [`${C}crafting/CraftRecipe`, `${C}crafting/CraftRecipeComponentScript`, `${B}EntityCraftRecipeBuilder`, `${B}CraftRecipeBuilder`],
  'component:craftbench': [`${C}crafting/CraftBenchScript`, `${B}ComponentCraftBenchBuilder`],
  'component:craftlogic': [`${C}crafting/CraftLogicScript`, `${B}ComponentCraftLogicBuilder`],
  'component:dryingcraftlogic': [`${C}crafting/DryingCraftLogicScript`, `${B}ComponentDryingCraftLogicBuilder`],
  'component:dryinglogic': [`${C}crafting/DryingLogicScript`],
  'component:furnacelogic': [`${C}crafting/FurnaceLogicScript`],
  'component:mashinglogic': [`${C}crafting/MashingLogicScript`],
  'component:wallcoveringconfig': [`${C}crafting/WallCoveringConfigScript`, `${B}ComponentWallCoveringConfigBuilder`],
  'component:durability': [`${B}ComponentDurabilityBuilder`, ATTRIBUTE],
  'component:fluidcontainer': [`${C}fluids/FluidContainerScript`, `${B}ComponentFluidContainerBuilder`],
  'component:fluidcontainer/fluids': [`${C}fluids/FluidContainerScript$FluidScript`, `${C}fluids/FluidContainerScript`, `${B}FluidContainerFluidBuilder`],
  'component:spriteconfig': [`${C}spriteconfig/SpriteConfigScript`, `${B}ComponentSpriteConfigBuilder`],
  'component:spriteconfig/face': [`${C}spriteconfig/SpriteConfigScript$FaceScript`, `${C}spriteconfig/SpriteConfigScript`, `${B}SpriteConfigFaceBuilder`],
  'component:spriteconfig/face/layer': [`${C}spriteconfig/SpriteConfigScript$ZLayer`, `${C}spriteconfig/SpriteConfigScript$XRow`, `${C}spriteconfig/SpriteConfigScript`, `${B}SpriteConfigFaceLayerBuilder`],
  'component:spriteoverlayconfig': [`${C}spriteconfig/SpriteOverlayConfigScript`, `${B}ComponentSpriteOverlayConfigBuilder`],
  'component:uiconfig': [`${C}ui/UiConfigScript`, `${B}ComponentUiConfigBuilder`],
  'component:resources': [`${C}resources/ResourcesScript`, `${B}ComponentResourcesBuilder`],
  'component:contextmenuconfig': [`${C}contextmenuconfig/ContextMenuConfigScript`, `${B}ComponentContextMenuConfigBuilder`],
  'component:contextmenuconfig/contextentry': [`${C}contextmenuconfig/ContextMenuConfigScript$EntryScript`, `${C}contextmenuconfig/ContextMenuConfigScript`, `${B}ComponentContextMenuConfigBuilder$ContextEntryBuilder`],
  'component:craftbenchsounds': [`${C}sound/CraftBenchSoundsScript`, `${B}ComponentCraftBenchSoundsBuilder`, `${B}ComponentCraftBenchSoundsBuilder$CraftBenchSound`, 'generation/EntityScriptGenerator'],
  'component:lua': [`${C}lua/LuaComponentScript`],
  'component:parts': [`${C}parts/PartsScript`],
  'component:signals': [`${C}signals/SignalsScript`],
  'component:attributes': [`${C}attributes/AttributesScript`, ATTRIBUTE],
  fluid: [`${O}FluidDefinitionScript`, `${B}FluidBuilder`],
  'fluid/properties': [`${O}FluidDefinitionScript`, `${B}FluidPropertiesBuilder`],
  'fluid/poison': [`${O}FluidDefinitionScript`, `${B}FluidPoisonBuilder`],
  energy: [`${O}EnergyDefinitionScript`, `${B}EnergyBuilder`],
  evolvedrecipe: [`${O}EvolvedRecipe`, `${B}EvolvedrecipeBuilder`],
  fixing: [`${O}Fixing`, `${B}FixingBuilder`],
  timedaction: [`${O}TimedActionScript`, `${B}TimedActionBuilder`],
  sound: [`${O}GameSoundScript`, `${B}SoundBuilder`],
  'sound/clip': [`${O}GameSoundScript`, `${B}SoundClipBuilder`],
  model: [`${O}ModelScript`, `${B}ModelBuilder`],
  'model/attachment': [`${O}ModelAttachment`, `${O}ModelScript`, `${B}ModelAttachmentBuilder`],
  mannequin: [`${O}MannequinScript`, `${B}MannequinBuilder`],
  clock: [`${O}ClockScript`, `${B}ClockBuilder`],
  'clock/hand': [`${O}ClockScript$HandScript`, `${O}ClockScript`, `${B}ClockHandBuilder`],
  ragdoll: [`${O}RagdollScript`],
  physicsshape: [`${O}PhysicsShapeScript`, `${B}PhysicsShapeBuilder`],
  physicshitreaction: [`${O}PhysicsHitReactionScript`, `${B}PhysicsHitReactionBuilder`],
  animationsmesh: [`${O}AnimationsMesh`, `${B}AnimationsMeshBuilder`],
  soundtimeline: [`${O}SoundTimelineScript`, `${B}SoundTimelineBuilder`],
  character_trait_definition: [`${O}CharacterTraitDefinitionScript`, `${B}CharacterTraitDefinitionBuilder`],
  character_profession_definition: [`${O}CharacterProfessionDefinitionScript`, `${B}CharacterProfessionDefinitionBuilder`],
  itemfilter: [`${O}ItemFilterScript`],
  fluidfilter: [`${O}FluidFilterScript`],
  vehicle: [`${O}VehicleScript`, `${B}VehicleBuilder`],
  'vehicle/part': [`${O}VehicleScript$Part`, `${O}VehicleScript`, `${B}VehiclePartBuilder`],
  'vehicle/wheel': [`${O}VehicleScript$Wheel`, `${O}VehicleScript`, `${B}VehicleWheelBuilder`],
  'vehicle/passenger': [`${O}VehicleScript$Passenger`, `${O}VehicleScript`, `${B}VehiclePassengerBuilder`],
  'vehicle/area': [`${O}VehicleScript$Area`, `${O}VehicleScript`, `${B}VehicleAreaBuilder`],
  'vehicle/skin': [`${O}VehicleScript$Skin`, `${O}VehicleScript`, `${B}VehicleSkinBuilder`],
  'vehicle/sound': [`${O}VehicleScript$Sounds`, `${O}VehicleScript`, `${B}VehicleSoundBuilder`],
  'vehicle/physics': [`${O}VehicleScript$PhysicsShape`, `${O}VehicleScript`, `${B}VehiclePhysicsBuilder`],
  'vehicle/lightbar': [`${O}VehicleScript$LightBar`, `${O}VehicleScript`, `${B}VehicleLightbarBuilder`],
  'vehicle/model': [`${O}VehicleScript$Model`, `${O}VehicleScript`, `${B}VehicleModelBuilder`],
  'vehicle/attachment': [`${O}ModelAttachment`, `${O}VehicleScript`, `${B}VehicleModelAttachmentBuilder`],
  'vehicle/crawlthroughwheel': [`${O}VehicleScript`, `${B}VehicleCrawlThroughWheelBuilder`],
  'vehicle/part/lua': [`${O}VehicleScript`, `${O}VehicleScript$Part`, `${B}VehicleLuaBuilder`],
  'vehicle/part/container': [`${O}VehicleScript`, `${O}VehicleScript$Container`, `${B}VehicleContainerBuilder`],
  'vehicle/part/door': [`${O}VehicleScript`, `${O}VehicleScript$Door`, `${B}VehicleTemplateDoorBuilder`],
  'vehicle/part/window': [`${O}VehicleScript`, `${O}VehicleScript$Window`, `${B}VehicleTemplateWindowBuilder`],
  'vehicle/part/anim': [`${O}VehicleScript`, `${O}VehicleScript$Anim`, `${B}VehicleAnimBuilder`],
  'vehicle/part/model': [`${O}VehicleScript`, `${O}VehicleScript$Model`, `${B}VehicleModelBuilder`],
  'vehicle/passenger/position': [`${O}VehicleScript`, `${O}VehicleScript$Position`, `${B}VehiclePositionBuilder`],
  'vehicle/passenger/switchseat': [`${O}VehicleScript`, `${O}VehicleScript$Passenger$SwitchSeat`, `${B}VehicleSwitchSeatBuilder`],
  'vehicle/passenger/anim': [`${O}VehicleScript`, `${O}VehicleScript$Anim`, `${B}VehicleAnimBuilder`],
  vehicleenginerpm: [`${B}VehicleEngineRpmBuilder`],
  'vehicleenginerpm/data': [`${B}RpmDataBuilder`],
  animation: [`${B}AnimationBuilder`],
  'animation/copyframe': [`${B}CopyFrameBuilder`],
  'animation/copyframes': [`${B}CopyFramesBuilder`],
};

// Registries that give the valid values of some properties. `list`: several values separated by ";".
// `open`: mods commonly add their own values (they are suggested, never reported).
const VALUE_REGISTRIES = [
  { keys: ['item'], property: 'itemtype', registry: 'ItemType' },
  { keys: ['item'], property: 'displaycategory', registry: 'ItemDisplayCategory', open: true },
  { keys: ['item'], property: 'bodylocation', registry: 'ItemBodyLocation' },
  { keys: ['item'], property: 'canbeequipped', registry: 'ItemBodyLocation' },
  { keys: ['item'], property: 'tags', registry: 'ItemTag', list: true },
  { keys: ['item'], property: 'categories', registry: 'WeaponCategory', list: true },
  { keys: ['item'], property: 'ammotype', registry: 'AmmoType' },
  { keys: ['item'], property: 'fabrictype', registry: 'ItemFabricType' },
  { keys: ['craftrecipe', 'component:craftrecipe'], property: 'category', registry: 'CraftRecipeCategory', open: true },
  { keys: ['craftrecipe', 'component:craftrecipe'], property: 'tags', registry: 'CraftRecipeTag', list: true },
];

// Enums describing craftRecipe lines and components.
const ENUMS = {
  inputFlags: 'zombie/entity/components/crafting/InputFlag',
  outputFlags: 'zombie/entity/components/crafting/OutputFlag',
  components: 'zombie/entity/ComponentType',
};

function listScripts(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listScripts(full));
    else if (entry.name.toLowerCase().endsWith('.txt')) files.push(full);
  }
  return files.sort();
}

function bump(map, key, by = 1) {
  map.set(key, (map.get(key) || 0) + by);
}

function mostFrequent(map) {
  return [...map.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function sortedEntries(map, limit = Infinity) {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, limit);
}

function collectVanilla(scriptsDir) {
  const blocks = new Map();
  const topLevel = new Map();
  const files = listScripts(scriptsDir);
  const entry = (key) => {
    if (!blocks.has(key)) {
      blocks.set(key, { types: new Map(), count: 0, children: new Map(), properties: new Map(), statements: new Map() });
    }
    return blocks.get(key);
  };
  for (const file of files) {
    const result = parseScript(fs.readFileSync(file, 'utf8'));
    const errors = result.issues.filter((i) => i.severity === 'error');
    if (errors.length) throw new Error(`Vanilla script does not parse cleanly: ${file}: ${errors[0].message}`);
    for (const block of walkBlocks(result.root)) {
      const key = schemaKeyOf(block);
      if (!key) continue;
      const data = entry(key);
      data.count++;
      bump(data.types, block.type);
      if (!block.parent || !schemaKeyOf(block.parent)) bump(topLevel, block.type);
      const parentKey = block.parent ? schemaKeyOf(block.parent) : '';
      if (parentKey) bump(entry(parentKey).children, block.type === 'component' ? `component ${block.name}` : block.type);
      const seenInBlock = new Set();
      for (const child of block.children) {
        if (!isValue(child)) continue;
        if (child.key === undefined) {
          bump(data.statements, child.text.split(/\s+/)[0]);
          continue;
        }
        const lower = propertyId(child.key);
        if (!data.properties.has(lower)) data.properties.set(lower, { names: new Map(), count: 0, values: new Map(), repeatable: false });
        const prop = data.properties.get(lower);
        prop.count++;
        if (seenInBlock.has(lower)) prop.repeatable = true;
        seenInBlock.add(lower);
        bump(prop.names, child.key);
        bump(prop.values, child.value);
      }
    }
  }
  return { blocks, topLevel, fileCount: files.length };
}

function literals(jar, className) {
  const entry = `${className}.class`;
  if (!jar.has(entry)) throw new Error(`Class ${entry} not found in the jar: update the class map`);
  return classStringLiterals(jar.read(entry));
}

function jarIdentifiers(jar, classes) {
  const found = new Map();
  for (const cls of classes) {
    for (const literal of literals(jar, cls)) {
      if (IDENTIFIER.test(literal) && !found.has(literal.toLowerCase())) found.set(literal.toLowerCase(), literal);
    }
  }
  return found;
}

/** Enum / registry ids: PascalCase names, without UPPER_SNAKE constant duplicates and translation prefixes. */
function enumValues(jar, className) {
  const values = literals(jar, className).filter((s) => IDENTIFIER.test(s) && !/^[A-Z0-9_]+$/.test(s) && !s.endsWith('_') && s !== 'base');
  return [...new Set(values)];
}

const NOT_KEYS = new Set(['none', 'null', 'true', 'false', 'unknown', 'obsolete', 'component', 'fluid', 'default', 'item_']);

/** Filters string literals of the jar classes that are default values, test hooks or messages rather than keys. */
function isPlausibleKey(name, vanillaValues) {
  const lower = name.toLowerCase();
  if (NOT_KEYS.has(lower) || vanillaValues.has(lower)) return false;
  if (/^Test[A-Z0-9]/.test(name) || /^IGUI_/.test(name) || name.endsWith('_')) return false;
  return true;
}

function classifyValues(values) {
  const keys = [...values.keys()].filter((v) => v !== '');
  if (keys.length && keys.every((v) => /^(true|false)$/i.test(v))) return 'boolean';
  if (keys.length && keys.every((v) => /^-?\d+(\.\d+)?$/.test(v))) return 'number';
  return keys.length <= MAX_ENUM_DISTINCT ? 'enum' : 'string';
}

/**
 * Valid values of a registry-backed property: registry ids formatted like vanilla writes them
 * (`base:lowercase` or PascalCase), plus every value vanilla uses (registries are not always complete).
 */
function registrySuggestions(ids, vanillaValues) {
  const tokens = [...vanillaValues.keys()].flatMap((v) => v.split(';')).map((t) => t.trim()).filter(Boolean);
  const namespaced = tokens.filter((t) => t.includes(':')).length > tokens.length / 2;
  const values = new Map(ids.map((id) => (namespaced ? `base:${id.toLowerCase()}` : id)).map((v) => [v.toLowerCase(), v]));
  for (const token of tokens) if (!values.has(token.toLowerCase())) values.set(token.toLowerCase(), token);
  return [...values.values()].sort((a, b) => a.localeCompare(b));
}

function buildBlocks(jar, vanilla, report) {
  const blocks = {};
  for (const [key, data] of [...vanilla.blocks.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const jarKeys = CLASS_MAP[key] ? jarIdentifiers(jar, CLASS_MAP[key]) : null;
    const missing = jarKeys ? [...data.properties.keys()].filter((p) => !jarKeys.has(p)) : [];
    if (missing.length) report.push(`${key}: not strict, vanilla keys not found in its classes: ${missing.join(', ')}`);
    const strict = Boolean(jarKeys) && missing.length === 0 && !isFreeForm(key);

    const properties = {};
    for (const [lower, prop] of sortedEntries(data.properties)) {
      const kind = classifyValues(prop.values);
      properties[lower] = {
        name: mostFrequent(prop.names),
        count: prop.count,
        kind,
        distinct: prop.values.size,
        // Enumerations keep every value so they can be suggested; other kinds keep examples.
        values: sortedEntries(prop.values, kind === 'enum' ? MAX_ENUM_DISTINCT : MAX_VALUES),
        ...(prop.repeatable ? { repeatable: true } : {}),
      };
    }
    // Keys the game knows that no vanilla script uses: accepted, suggested after the vanilla ones.
    const vanillaValues = new Set([...data.properties.values()].flatMap((p) => [...p.values.keys()]).flatMap((v) => v.toLowerCase().split(/[;:\s]+/)));
    const extraKeys = strict
      ? [...jarKeys.entries()].filter(([lower, name]) => !properties[lower] && isPlausibleKey(name, vanillaValues)).map(([, name]) => name).sort()
      : [];

    blocks[key] = {
      type: mostFrequent(data.types),
      count: data.count,
      strict,
      children: Object.fromEntries(sortedEntries(data.children)),
      statements: Object.fromEntries(sortedEntries(data.statements, 40)),
      properties,
      extraKeys,
      // Every identifier of the classes: accepted by validation, never suggested.
      acceptedKeys: strict ? [...jarKeys.keys()].sort() : [],
    };
  }
  return blocks;
}

function addRegistries(jar, blocks, vanilla, report) {
  for (const reg of VALUE_REGISTRIES) {
    const ids = enumValues(jar, `${O}${reg.registry}`);
    for (const key of reg.keys) {
      const prop = blocks[key] && blocks[key].properties[reg.property];
      if (!prop) {
        report.push(`registry ${reg.registry}: ${key}.${reg.property} not used by vanilla, skipped`);
        continue;
      }
      prop.registry = reg.registry;
      prop.list = Boolean(reg.list);
      if (reg.open) prop.open = true;
      prop.suggestions = registrySuggestions(ids, vanilla.blocks.get(key).properties.get(reg.property).values);
    }
  }
}

/** For each ItemType, the item properties its builder writes (used to rank completions). */
function itemTypeProperties(jar, itemBlock) {
  const result = {};
  for (const [itemType, builder] of Object.entries(ITEM_BUILDERS)) {
    const ids = jarIdentifiers(jar, [`${B}${builder}`]);
    result[itemType] = [...ids.keys()].filter((lower) => itemBlock.properties[lower]).sort();
  }
  return result;
}

function detectGameVersion() {
  const flag = process.argv.indexOf('--version');
  if (flag !== -1 && process.argv[flag + 1]) return process.argv[flag + 1];
  try {
    const log = fs.readFileSync(path.join(os.homedir(), 'Zomboid', 'console.txt'), 'utf8');
    // "version=42.21.0 4a0e9546ec demo=false" (other "version=" lines are Java's)
    const match = /\bversion=(\d+\.\d+(?:\.\d+)?) [0-9a-f]+ demo=/.exec(log);
    if (match) return match[1];
  } catch {
    // no log: the version stays unknown
  }
  return 'unknown';
}

function buildSchema(gameFolder) {
  const jar = new Jar(path.join(gameFolder, 'projectzomboid.jar'));
  const vanilla = collectVanilla(path.join(gameFolder, 'media', 'scripts'));
  const report = [];

  const scriptTypes = literals(jar, `${S}ScriptType`).filter((s) => /^[a-z][A-Za-z]*$/.test(s));
  const topLevel = new Map(scriptTypes.map((t) => [t.toLowerCase(), t]));
  for (const [type] of vanilla.topLevel) topLevel.set(type.toLowerCase(), type);
  topLevel.delete('module');

  const blocks = buildBlocks(jar, vanilla, report);
  addRegistries(jar, blocks, vanilla, report);

  return {
    schema: {
      gameVersion: detectGameVersion(),
      generatedFrom: `${vanilla.fileCount} vanilla scripts + projectzomboid.jar`,
      topLevel: [...topLevel.values()].sort((a, b) => a.localeCompare(b)),
      components: enumValues(jar, ENUMS.components),
      recipeLines: { inputFlags: enumValues(jar, ENUMS.inputFlags), outputFlags: enumValues(jar, ENUMS.outputFlags) },
      itemTypeProperties: itemTypeProperties(jar, blocks.item),
      blocks,
    },
    report,
  };
}

function main() {
  const folderArg = process.argv.slice(2).find((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--version');
  const gameFolder = folderArg || findGameFolders()[0];
  if (!gameFolder) throw new Error('Project Zomboid not found: pass its install folder as argument');
  const { schema, report } = buildSchema(gameFolder);
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(schema)}\n`);
  const strict = Object.values(schema.blocks).filter((b) => b.strict).length;
  console.log(`Game ${schema.gameVersion}: ${Object.keys(schema.blocks).length} block kinds (${strict} strict), ${schema.topLevel.length} top-level types`);
  console.log(`Wrote ${path.relative(process.cwd(), OUTPUT)} (${Math.round(fs.statSync(OUTPUT).size / 1024)} KB)`);
  for (const line of report) console.log(`  ${line}`);
}

main();
