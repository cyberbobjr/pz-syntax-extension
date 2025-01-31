export const VALID_KEYWORDS = {
  craftRecipe: [
    "timedAction",
    "Time",
    "category",
    "Tags",
    "inputs",
    "outputs",
    "itemMapper",
    "SkillRequired",
    "NeedToBeLearn",
    "needTobeLearn",
    "AutoLearnAny",
    "xpAward",
    "OnCreate",
    "OnTest",
    "ToolTip",
    "Tooltip",
    "MetaRecipe",
    "time",
    "tags",
    "needTobeLearn",
    "needToBeLearn",
    "AllowBatchCraft",
    "-fluid",
  ],
  item: [
    // Core
    "DisplayName",
    "DisplayCategory",
    "Type",
    "Weight",
    "Icon",
    "WorldStaticModel",
    "StaticModel",
    "Tags",
    "AcceptItemFunction",

    // Autre (à classer)
    "MetalValue",
    "ConditionMax",
    "ConditionLowerChanceOneIn",
    "UseWhileEquipped",
    "UseDelta",
    "ReplaceOnUse",
    "ReplaceOnDeplete",
    "CustomContextMenu",
    "Count",
    "RequiresEquippedBothHands",
    "ConditionLowerStandard",
    "DisappearOnUse",
    "SoundRadius",
    "SoundVolume",
    "AlwaysWelcomeGift",
    "SurvivalGear",
    "FillFromDispenserSound",
    "FillFromLakeSound",
    "FillFromTapSound",
    "FillFromToiletSound",
    "ToolTip",
    "AttachmentType",
    "BaseSpeed",
    "BreakSound",
    "Categories",
    "CritDmgMultiplier",
    "DoorDamage",
    "EnduranceMod",
    "HitSound",
    "IdleAnim",
    "KnockBackOnNoDeath",
    "MaxDamage",
    "MinDamage",
    "PushBackMod",
    "RunAnim",
    "SubCategory",
    "SwingAnim",
    "SwingSound",
    "TreeDamage",
    "WeaponLength",
    "WeaponSprite",
    "TwoHandWeapon",
    "AcceptMediaType",
    "BaseVolumeRange",
    "DisappearOnUse",
    "IsHighTier",
    "IsPortable",
    "IsTelevision",
    "MaxChannel",
    "MinChannel",
    "TransmitRange",
    "TwoWay",
    "UsesBattery",
    "IconColorMask",
    "IconFluidMask",
    "RainFactor",
    "FillFromDispenserSound",
    "CustomEatSound",
    "PourType",
    "CanBeEquipped",
    "BloodLocation",
    "ReplaceInPrimaryHand",
    "ReplaceInSecondHand",
    "RunSpeedModifier",
    "AmmoType",
    "CanStack",
    "GunType",
    "MaxAmmo",
    "TeachedRecipes",
    "PlaceMultipleSound",
    "PlaceOneSound",
    "OnBreak",
    "MetaRecipe",
    "MechanicsItem",
    "ColorBlue",
    "ColorGreen",
    "ColorRed",
    "Tooltip",
    "StaticModel",
    "WorldStaticModelsByIndex",
    "IconsForTexture",
    "ShoutType",
    "ShoutMultiplier",
    // Newly added keywords
    "MechanicsItem",
    "Tooltip",
    "StaticModelsByIndex",
    "WorldStaticModelsByIndex",
    "IconsForTexture",
    "AttachmentReplacement",
    "primaryAnimMask",
    "secondaryAnimMask",
    "ScaleWorldIcon",
    "UseWorldItem",
    "KeepOnDeplete",
    "WeightEmpty",
    "CantBeConsolided",
    "CustomContextMenu",
    "OnEat",
    "OnCreate",
    "ActivatedItem",
    "LightDistance",
    "LightStrength",
    "ticksPerEquipUse",
    "TorchCone",
    "SurvivalGear",
    "MetalValue",
    "ImpactSound",
    "HitAngleMod",
    "MaxHitCount",
    "MaxRange",
    "MinimumSwingTime",
    "SplatBloodOnNoDeath",
    "SplatNumber",
    "SplatSize",
    "SwingAmountBeforeImpact",
    "SwingTime",
    "WeaponSpritesByIndex",
    "HeadCondition",
    "HeadConditionLowerChanceMultiplier",
    "Sharpness",
    "AttachmentType",
    "BaseSpeed",
    "BreakSound",
    "Categories",
    "CritDmgMultiplier",
    "DoorDamage",
    "EnduranceMod",
    "HitSound",
    "IdleAnim",
    "KnockBackOnNoDeath",
    "MaxDamage",
    "MinDamage",
    "PushBackMod",
    "RunAnim",
    "SubCategory",
    "SwingAnim",
    "SwingSound",
    "TreeDamage",
    "WeaponLength",
    "WeaponSprite",
    "TwoHandWeapon",
    "AcceptMediaType",
    "BaseVolumeRange",
    "DisappearOnUse",
    "IsHighTier",
    "IsPortable",
    "IsTelevision",
    "MaxChannel",
    "MinChannel",
    "TransmitRange",
    "TwoWay",
    "UsesBattery",
    "IconColorMask",
    "IconFluidMask",
    "RainFactor",
    "FillFromDispenserSound",
    "CustomEatSound",
    "PourType",
    "CanBeEquipped",
    "BloodLocation",
    "ReplaceInPrimaryHand",
    "ReplaceInSecondHand",
    "RunSpeedModifier",
    "AmmoType",
    "CanStack",
    "GunType",
    "MaxAmmo",
    "TeachedRecipes",
    "PlaceMultipleSound",
    "PlaceOneSound",
    "OnBreak",
    "MetaRecipe",
    "MechanicsItem",
    "ColorBlue",
    "ColorGreen",
    "ColorRed",
    "Tooltip",
    "StaticModel",
    "WorldStaticModelsByIndex",
    "IconsForTexture",
    "ShoutType",
    "ShoutMultiplier",
    "AlwaysKnockdown",
    "AttachmentType",
    "BreakSound",
    "CantAttackWithLowestEndurance",
    "CriticalChance",
    "DamageCategory",
    "DamageMakeHole",
    "DropSound",
    "HitAngleMod",
    "ImpactSound",
    "MaxHitCount",
    "MaxRange",
    "MetalValue",
    "MinimumSwingTime",
    "SplatBloodOnNoDeath",
    "SplatNumber",
    "SplatSize",
    "SwingAmountBeforeImpact",
    "SwingTime",
    "WeaponSpritesByIndex",
    "HeadCondition",
    "HeadConditionLowerChanceMultiplier",
    "Sharpness",
    "DoorHitSound",
    "HitFloorSound",
    "HitWallSound",
    "HitWindowSound",
    "HasMetal",
    "HasToolHead",
    "KnockdownMod",
    "MinAngle",
    "MinRange",
    "NoMaintenanceXp",
    "SoundRadius",
    "SoundVolume",
    "ReloadTimeModifier",
    "DangerousUncooked",
    "IsDung",
    "ConsolidateOption",
    "FireFuelRatio",
    "MediaCategory",
    "FishingLure",
    "Packaged",
    "DangerousUncooked",
    "BoredomChange",
    "EatTime",
    "HerbalistType",
    "Alcoholic",
    "BandagePower",
    "CanBandage",
    "Medical",
    "ItemAfterCleaning",
    "ReduceInfectionPower",
    "FatigueChange",
    "StressChange",
    "AlarmSound",
    "UnequipSound",
    "ProtectFromRainWhenEquipped",
    "EquippedNoSprint",
    "MicRange",
    "NoTransmit",
    "ReadType",
    "ReloadTimeModifier",
    // Newly added keywords
    "WeightModifier",
    "AimingTimeModifier",
    "MaxSightRange",
    "MinSightRange",
    "MountOn",
    "PartType",
    "RecoilDelayModifier",
    "HitChanceModifier",
    "ProjectileSpreadModifier",
    "MaxRangeModifier",
    "LowLightBonus",
    "TorchDot",
    "StaticModel",
    "cantBeConsolided",
    "RemoteController",
    "RemoteRange",
    "UseWhileEquipped",
    "WorldObjectSprite",
    "ConditionLowerStandard",
    "AnimalFeedType",
    "EvolvedRecipe",
    "Spice",
    "ReplaceOnRotten",
    "ReplaceOnCooked",
    "UseWorldItem",
    "AimingPerkCritModifier",
    "AimingPerkHitChanceModifier",
    "AimingPerkMinAngleModifier",
    "AimingPerkRangeModifier",
    "AimingTime",
    "AmmoBox",
    "BringToBearSound",
    "ClipSize",
    "EjectAmmoSound",
    "EjectAmmoStartSound",
    "EjectAmmoStopSound",
    "EquipSound",
    "FireMode",
    "FireModePossibilities",
    "HitChance",
    "InsertAmmoSound",
    "InsertAmmoStartSound",
    "InsertAmmoStopSound",
    "IsAimedFirearm",
    "IsAimedHandWeapon",
    "JamGunChance",
    "MagazineType",
    "ManuallyRemoveSpentRounds",
    "ModelWeaponPart",
    "NPCSoundBoost",
    "PiercingBullets",
    "ProjectileCount",
    "ProjectileSpread",
    "ProjectileWeightCenter",
    "RackAfterShoot",
    "RackSound",
    "Ranged",
    "RecoilDelay",
    "ReloadTime",
    "ShareDamage",
    "ShellFallSound",
    "SoundGain",
    "StopPower",
    "ToHitModifier",
    "WeaponReloadType",
    "HaveChamber",
    "AngleFalloff",
    "InsertAllBulletsReload",
    "RangeFalloff",
    "ClipSize",
    "MultipleHitConditionAffected",
    "AimingMod",
    "ClickSound",
    "UseEndurance",
    // Audio et effets
    "ShoutType",
    "ShoutMultiplier",
    "CookingSound",
    "AlarmSound",
    "CustomDrinkSound",
    "FillFromDispenserSound",
    "FillFromLakeSound",
    "FillFromTapSound",
    "FillFromToiletSound",
    "DamagedSound",
    // Propriétés des conteneurs
    "ContainerName",
    "capacity",
    "PickRandomFluid",
    "EatType",
    "PourType",

    // Propriétés des armes
    "TwoHandWeapon",
    "RequiresEquippedBothHands",
    "MetalValue",
    "ConditionLowerChanceOneIn",
    "critDmgMultiplier",
    // Tags et catégories
    "IsFireFuel",
    "IsFireTinder",
    "FireFuelRatio",
    "HasMetal",
    "Tags",
    "FitsWallet",
    "FitsKeyRing",
    "SmeltableIronSmall",
    "SmeltableIronMedium",
    "CrudeTongs",
    "BreakOnSmithing",
    "DontInheritCondition",
    "isSeed",
    "IsMemento",
    "CoffeeMaker",
    "Cookable",
    "CookableMicrowave",
    "CleanStains",

    // Autres propriétés
    "WorldObjectSprite",
    "StaticModel",
    "Tooltip",
    "MechanicsItem",
    "OnBreak",
    "ReplaceInPrimaryHand",
    "ReplaceInSecondHand",
    "ReplaceOnDeplete",
    "cantBeConsolided",
    "ScaleWorldIcon",
    "primaryAnimMask",
    "secondaryAnimMask",
    "AlcoholPower",
    "-fluid",
    // Véhicule
    "VehicleType",
    "ChanceToSpawnDamaged",
    "MaxCapacity",
    "EngineLoudness",
    "ConditionLowerOffroad",
    // Vêtements
    "Capacity",
    "CloseSound",
    "OpenSound",
    "WeightReduction",
    "SoundParameter",
    "AttachmentsProvided",
    "CanHaveHoles",
    "FabricType",
    "ItemWhenDry",
    "Wet",
    "WetCooldown",
    "BodyLocation",
    "ClothingItem",
    "ClothingItemExtra",
    "ClothingItemExtraOption",
    "ClothingExtraSubmenu",
    "CombatSpeedModifier",
    "Insulation",
    "WindResistance",
    "ScratchDefense",
    "BiteDefense",
    "DiscomfortModifier",
    "ChanceToFall",
    "WaterResistance",
    "VisionModifier",
    "HearingModifier",
    // Construction
    "DigType",
    // Conteneurs
    "MaxItemSize",
    // Son
    "PutInSound",
    // Litterature
    "CanBeWrite",
    "PageToWrite",
    // Nourriture
    "CustomDrinkSound",
    "GoodHot",
    "MinutesToCook",
    "MinutesToBurn",
    "EvolvedRecipe",
    "EvolvedRecipeName",
    "SoundMap",
    "BadCold",
    "CookingSound",
    "RemoveUnhappinessWhenCooked",
    "ReduceFoodSickness",
    "ReplaceOnCooked",
    "RemoveNegativeEffectOnCooked",
    "ThirstChange",
    "EatType",
    "PourType",
    "IsCookable",
    "CantBeConsolided",
    "BadInMicrowave",
    "DaysFresh",
    "DaysTotallyRotten",
    "HungerChange",
    "UnhappyChange",
    "Calories",
    "Carbohydrates",
    "Lipids",
    "Proteins",
    "CantEat",
    "FoodType",
    "ReplaceOnRotten",
    "CantBeFrozen",
  ],
  component: [
    "ContainerName",
    "RainFactor",
    "capacity",
    "fluid",
    "-fluid",
    "CustomDrinkSound",
    "PickRandomFluid"
  ],
  itemMapper: ["default"],
  inputs: ["item", "mode:", "flags[", "mappers[", "fluid", "-fluid"],
  flags: [
    "AllowFavorite",
    "InheritFavorite",
    "InheritFoodAge",
    "IsNotDull",
    "MayDegradeLight",
    "Prop1",
    "Prop2",
    "ItemCount",
    "IsFull",
    "NotFull",
    "NotEmpty",
    "AllowDestroyedItem",
  ],
  Fluids : [
    "fluid",
  ]
};

export const PROPERTY_DESCRIPTIONS: { [key: string]: string } = {
  // General Properties
  DisplayName:
    'Display name in the game interface\n\n*Type*: `string`\n*Example*: `DisplayName = "Hammer",`',
  DisplayCategory:
    "Category for inventory sorting\n\n*Common values*: `Weapon, Food, Clothing, Tool`",
  Type: "Main functional type\n\n*Values*: `Normal, Weapon, Food, Clothing, Literature`",
  Weight: "Weight in kilograms\n\n*Example*: `Weight = 0.5,`",
  Icon: 'Inventory icon path\n\n*Format*: Relative image path\n*Example*: `Icon = "Item_Hammer",`',

  // Condition Properties
  ConditionMax:
    "Maximum durability (1-100)\n\n*Example*: `ConditionMax = 100,`",
  ConditionLowerChanceOneIn:
    "1-in-X chance of condition loss per use (lower = more fragile)\n*Example*: `ConditionLowerChanceOneIn = 50,`",

  // Weapon Properties
  MaxDamage: "Maximum damage value\n*Example*: `MaxDamage = 1.5,`",
  MinDamage: "Minimum damage value",
  CriticalChance:
    "Critical hit chance percentage\n*Example*: `CriticalChance = 30,`",
  WeaponLength: "Melee range in tiles",
  SwingTime: "Attack wind-up time in seconds",
  AimingTime: "Time needed to aim firearms",
  RecoilDelay: "Firearm recoil recovery time",

  // Food Properties
  HungerChange: "Hunger reduction (negative values reduce hunger)",
  ThirstChange: "Thirst reduction",
  Calories: "Energy value in kilocalories",
  DaysFresh: "Days until spoilage begins",
  DaysTotallyRotten: "Days until complete rot",
  FoodType: "Type of food\n*Values*: `Vegetable, Meat, Fish, Fruit`",

  // Clothing Properties
  BiteDefense: "Bite protection (0-100)",
  ScratchDefense: "Scratch protection (0-100)",
  Insulation: "Thermal insulation value",
  WindResistance: "Wind chill protection",
  WaterResistance: "Rain protection effectiveness",

  // Container Properties
  Capacity: "Storage capacity in units",
  WeightReduction:
    "Contains weight reduction percentage\n*Example*: `WeightReduction = 50,`",
  CanBeEquipped: "Equip slots\n*Values*: `Primary, Secondary, Both`",

  // Sound Properties
  SwingSound: "Sound played during use",
  ImpactSound: "Sound played on hit",
  EquipSound: "Sound played when equipping",
  UnequipSound: "Sound played when unequipping",

  // Visual Properties
  WorldStaticModel: "3D world model path",
  ClothingItem: "Clothing slot\n*Values*: `Hat, Shirt, Pants, Shoes`",
  BloodLocation: "Bleeding effect location",

  // Special Properties
  IsWeapon: "Mark as weapon\n*Values*: `true/false`",
  IsCookable: "Can be cooked\n*Example*: `IsCookable = true,`",
  LightStrength: "Light source intensity",
  LightDistance: "Light range in tiles",
  ActivatedItem: "Item requires activation",

  // Crafting Properties
  UseDelta: "Usage percentage per action\n*Example*: `UseDelta = 0.2,`",
  ReplaceOnUse:
    'Replacement item after use\n*Example*: `ReplaceOnUse = "Base.HammerDamaged",`',
  RequiresEquippedBothHands: "Needs both hands to use\n*Values*: `true/false`",
};

export const CRAFT_RECIPE_DESCRIPTIONS: { [key: string]: string } = {
  Time: "Crafting time in seconds\n*Example*: `Time = 120.0,`",
  Result: 'Output item\n*Example*: `Result = "Base.WoodenPlank",`',
  ResultCount: "Number of items produced\n*Example*: `ResultCount = 4,`",
  SkillRequired:
    'Required skill level\n*Example*: `SkillRequired = "Woodwork:2",`',
  KeepOnUse: "Tool is not consumed\n*Values*: `true/false`",
  NeedToBeLearned:
    "Requires recipe knowledge\n*Example*: `NeedToBeLearned = true,`",
  Category: "Crafting category\n*Values*: `Cooking, Carpentry, Electrical`",
  Animations: "Animation ID for crafting action",
};


export const FLAG_DESCRIPTIONS : { [key: string]: string } = {
  MayDegradeLight : "There's a small chance of damaging the item used",
  Prop1: "Will be in the primary hand",
  Prop2: "Will be in the secondary hand",
}