// Hand-written documentation shown in hovers and completions. Keep entries short and factual:
// the generated schema already shows how vanilla uses each property.

export const BLOCK_DESCRIPTIONS: Record<string, string> = {
  module: "Namespace of the scripts it contains. Objects are referenced as `Module.Name`, e.g. `Base.Hammer`.",
  imports: "Modules whose objects can be referenced without their module prefix.",
  item: "An inventory item. Build 42 sets its kind with `ItemType` (e.g. `base:weapon`) and can attach components.",
  craftRecipe: "A crafting recipe: properties, then `inputs` and `outputs` blocks of recipe lines.",
  entity: "A game entity (workstation, buildable…) made of `component` blocks.",
  component: "An entity component. The name after `component` is its type, e.g. `component FluidContainer`.",
  fixing: "A repair recipe: `Require` lists the items it repairs, `Fixer` the items used to repair.",
  evolvedrecipe: "A recipe where ingredients are added to a base item (soups, salads, sandwiches…).",
  fluid: "A fluid definition: color, categories and properties applied when consumed.",
  energy: "An energy type used by entities (electric, mechanical, thermal, steam…).",
  timedAction: "Animation, sound and props of a timed action, referenced by `timedAction = ...` in recipes.",
  model: "A 3D model: mesh, texture and attachment points.",
  sound: "A sound definition: category, master channel and FMOD clips.",
  vehicle: "A vehicle definition: model, physics, parts, passengers and areas.",
  template: "A reusable vehicle part, merged into vehicles with `template = ...`.",
  xuiSkin: "UI styles of entity windows and widgets.",
  character_trait_definition: "A character trait (Build 42 script definition).",
  character_profession_definition: "A character profession (Build 42 script definition).",
  inputs: "Recipe lines consumed or used by the recipe, one per line: `item 1 [Base.Plank] flags[...]`.",
  outputs: "Recipe lines produced by the recipe, e.g. `item 1 Base.Plank`.",
  itemMapper: "Maps input items to output items: `Output.Item = Input.Item`.",
};

export const PROPERTY_DESCRIPTIONS: Record<string, Record<string, string>> = {
  item: {
    itemtype: "Kind of item (Build 42). Replaces the Build 41 `Type` property. Example: `ItemType = base:food`.",
    displaycategory: "Category used to sort the item in the inventory.",
    displayname: "Name shown in game. Build 42 vanilla items get it from the translation files (`ItemName_Base.X`) instead.",
    weight: "Weight in encumbrance units.",
    icon: "Inventory icon, without the `Item_` prefix: `Icon = Hammer` uses `Item_Hammer.png`.",
    tags: "Item tags used by recipes (`tags[base:hammer]`), separated by `;`. Build 42 tags are namespaced: `base:hammer`.",
    categories: "Weapon categories (skills), separated by `;`, e.g. `base:blunt;base:improvised`.",
    bodylocation: "Body location of a clothing item, e.g. `base:hat`.",
    canbeequipped: "Body location where the item can be equipped.",
    clothingitem: "Clothing XML file (media/clothing/clothingItems) giving the worn model.",
    worldstaticmodel: "Model shown when the item lies on the ground.",
    staticmodel: "Model shown when the item is held.",
    conditionmax: "Maximum condition.",
    conditionlowerchanceonein: "1 in N chance to lose condition on use: higher is more durable.",
    maxdamage: "Maximum damage per hit.",
    mindamage: "Minimum damage per hit.",
    hungerchange: "Hunger change when eaten (negative reduces hunger).",
    thirstchange: "Thirst change when consumed (negative reduces thirst).",
    daysfresh: "Days before the food starts to go stale.",
    daystotallyrotten: "Days before the food is rotten.",
    usedelta: "Fraction of a drainable item used per use.",
    replaceonuse: "Item that replaces this one once used up.",
    researchablerecipes: "Recipes that can be learned by researching this item, separated by `;`.",
    learnedrecipes: "Recipes learned by reading this item, separated by `;`.",
    metalvalue: "Metal value when the item is scrapped.",
  },
  craftrecipe: {
    timedaction: "Timed action (animation, sound, props) played while crafting: name of a `timedAction` script.",
    time: "Crafting duration.",
    category: "Category of the recipe in the crafting menu.",
    tags: "Where and how the recipe can be crafted, separated by `;`, e.g. `AnySurfaceCraft;InHandCraft`.",
    skillrequired: "Required skills, e.g. `Woodwork:2;Maintenance:1`.",
    xpaward: "Experience given, e.g. `Woodwork:10`.",
    needtobelearn: "`true` when the recipe must be learned before being crafted.",
    autolearnall: "Skills that teach the recipe automatically when all are reached, e.g. `Woodwork:3`.",
    autolearnany: "Skills that teach the recipe automatically when any is reached.",
    metarecipe: "Recipe whose knowledge also teaches this one.",
    oncreate: "Lua function called when the recipe is crafted.",
    ontest: "Lua function checking whether an input item is valid.",
    allowbatchcraft: "Allows crafting several times in a row.",
    tooltip: "Translation key of the tooltip.",
    researchskilllevel: "Skill level needed to learn the recipe by research.",
    icon: "Icon of the recipe.",
  },
};

export const RECIPE_FLAG_DESCRIPTIONS: Record<string, string> = {
  prop1: "The item is shown in the primary hand during the action.",
  prop2: "The item is shown in the secondary hand during the action.",
  maydegrade: "The tool may lose condition.",
  maydegradelight: "The tool may lose a little condition.",
  maydegradeverylight: "The tool may lose very little condition.",
  maydegradeheavy: "The tool may lose a lot of condition.",
  isnotdull: "The tool must not be dull.",
  itemcount: "The amount counts items rather than uses.",
  isexclusive: "All items of this line must be of the same type.",
  dontrecordinput: "The item is not recorded as a recipe input.",
  allowdestroyeditem: "Broken items are accepted.",
  inheritcondition: "The output inherits the condition of this input.",
  inheritcolor: "The output inherits the color of this input.",
  isfull: "The container must be full.",
  notfull: "The container must not be full.",
  isempty: "The container must be empty.",
  notempty: "The container must not be empty.",
  dontreplace: "The item is not replaced by its `ReplaceOnUse` item.",
};

export const RECIPE_MODE_DESCRIPTIONS: Record<string, string> = {
  keep: "The item is kept (tool).",
  destroy: "The item is consumed entirely.",
  use: "Uses are consumed from the item.",
  exact: "Fluid: exactly the listed fluid.",
  primary: "Fluid: the listed fluid must be the main one of the mixture.",
  mixture: "Fluid: any mixture containing the listed fluids.",
  anything: "Fluid: any fluid.",
};

export function propertyDescription(key: string, lowerName: string): string | undefined {
  const blockKey = key === "component:craftrecipe" ? "craftrecipe" : key;
  return PROPERTY_DESCRIPTIONS[blockKey]?.[lowerName];
}

export function blockDescription(type: string): string | undefined {
  const entry = Object.entries(BLOCK_DESCRIPTIONS).find(([name]) => name.toLowerCase() === type.toLowerCase());
  return entry?.[1];
}
