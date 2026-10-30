/* =====================================================================
   Pretzel AI — local persona engines ("The AI Rehaul")
   Five deterministic, offline engines with no network calls and no keys:
     · Anime Debate Matrix — 64 curated sheets, interaction matrix,
                             round-by-round reads, battle royales, tiers
     · Normal              — plain conversation, no gimmick
     · Spicy               — adult-tone banter behind an 18+ gate
     · Roast Pit           — playful roasting
     · Conspiracy Corner    — absurd theories, clearly labelled as jokes
   Exposes window.PretzelAI.respond(mode, text) -> string
   ===================================================================== */
(() => {
  "use strict";

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /* Rotates per call so repeating the same line does not replay the same
     sentence — still fully local and reproducible within a session. */
  let turn = 0;
  const pick = (options, seed) => options[hash(`${seed}::${turn % 11}`) % options.length];
  const pickStable = (options, seed) => options[hash(String(seed)) % options.length];

  function list(words) {
    if (!words.length) return "";
    if (words.length === 1) return words[0];
    return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
  }

  /* ================================================================== */
  /* ANIME DEBATE MATRIX                                                */
  /* ================================================================== */

  const SPEED_TIERS = [
    { label: "S", name: "FTL+" },
    { label: "A", name: "FTL" },
    { label: "B", name: "relativistic" },
    { label: "C", name: "hypersonic" },
    { label: "D", name: "supersonic" }
  ];

  const tierIndex = (label) => Math.max(0, SPEED_TIERS.findIndex((tier) => tier.label === label));
  /* rank: higher is faster (S = 5 … D = 1) */
  const speedRank = (label) => SPEED_TIERS.length - tierIndex(label);
  const tierName = (label) => (SPEED_TIERS.find((tier) => tier.label === label) || SPEED_TIERS[3]).name;

  /* Tunable at runtime from the Settings panel. */
  const OPTIONS = {
    weights: { stats: 0.42, hax: 0.3, speed: 0.28 },
    detail: "full"
  };

  function setOptions(patch) {
    if (!patch) return OPTIONS;
    if (patch.weights) {
      const raw = {
        stats: Number(patch.weights.stats),
        hax: Number(patch.weights.hax),
        speed: Number(patch.weights.speed)
      };
      const total = raw.stats + raw.hax + raw.speed;
      if (total > 0) {
        OPTIONS.weights = { stats: raw.stats / total, hax: raw.hax / total, speed: raw.speed / total };
      }
    }
    if (patch.detail === "full" || patch.detail === "concise") OPTIONS.detail = patch.detail;
    return OPTIONS;
  }

  /*
   * One row per fighter:
   * name, series, tier, speedTier, strength, durability, ap, hax, iq,
   * tags, kit, weak spots.
   * Tags are the vocabulary the interaction matrix reads, so they are the
   * part to keep honest when adding sheets.
   */
  const SHEETS = [
    ["Goku", "Dragon Ball", "S+", "S", 97, 94, 96, 58, 84, "energy speed_amp precognition regeneration", "Instant transmission, Ultra Instinct dodging, form stacking", "Ki drain; tests opponents before going all-out"],
    ["Saitama", "One Punch Man", "S+", "S", 99, 98, 90, 18, 46, "durability_negation resistance_blunt", "One-shot force, gag-grade durability, no training arc needed", "No ranged answer; low battle IQ"],
    ["Beerus", "Dragon Ball", "S+", "S", 96, 94, 96, 92, 84, "energy reality_warp nullification", "Hakai, god ki, absurd movement speed", "Lazy; holds back until embarrassed"],
    ["Broly", "Dragon Ball", "S+", "A", 98, 96, 96, 40, 44, "energy berserk resistance_blunt", "Escalating power, ki barriers, endless stamina", "Control issues; no plan beyond forward"],
    ["Vegeta", "Dragon Ball", "S", "S", 92, 90, 94, 56, 78, "energy speed_amp", "Final Flash, Ultra Ego, damage-fueled scaling", "Pride; overcommits to the highlight move"],
    ["Frieza", "Dragon Ball", "S", "A", 90, 88, 94, 30, 84, "energy barrier", "Death beam precision, Golden form", "No regeneration outside his golden form"],
    ["Gohan", "Dragon Ball", "S", "A", 90, 88, 92, 52, 84, "energy speed_amp", "Beast form, kamehameha, rage scaling", "Confidence dips when the fight turns ugly"],
    ["Piccolo", "Dragon Ball", "A", "A", 84, 86, 84, 62, 90, "energy regeneration clone", "Regeneration, tactical cloning, ranged utility", "Output sits below the top tier"],
    ["Naruto", "Naruto", "A", "A", 86, 88, 88, 66, 76, "energy summon regeneration speed_amp", "Shadow-clone attrition, sage mode, tailed-beast chakra", "Clone spam burns stamina fast"],
    ["Sasuke", "Naruto", "A", "A", 84, 82, 88, 72, 82, "energy precognition mind_control", "Sharingan foresight, genjutsu, space-time swaps", "Fragile if the opening illusion fails"],
    ["Madara", "Naruto", "S", "B", 86, 88, 90, 84, 86, "domain summon energy regeneration", "Perfect Susanoo, meteors, limbo clones", "Arrogance; slow to open up"],
    ["Itachi", "Naruto", "A", "B", 76, 78, 82, 86, 92, "mind_control domain precognition", "Tsukuyomi, Amaterasu, layered genjutsu", "Low stamina and a failing body"],
    ["Pain", "Naruto", "A", "B", 82, 80, 88, 80, 86, "summon barrier mind_control", "Six Paths, almighty push, shared vision", "Damage is shared across one body"],
    ["Hashirama", "Naruto", "A", "B", 86, 88, 88, 74, 84, "summon regeneration energy", "Wood release, sage mode, battlefield control", "Needs a moment to set the terrain"],
    ["Kakashi", "Naruto", "B", "B", 78, 76, 84, 80, 92, "precognition nullification", "Kamui, a thousand jutsu, perfect reads", "Chakra pool is thin"],
    ["Luffy", "One Piece", "A", "A", 90, 92, 86, 54, 58, "resistance_blunt speed_amp berserk", "Rubber body, Gears, toon-force improvisation", "Cutting damage finds the gaps"],
    ["Zoro", "One Piece", "A", "A", 90, 88, 90, 40, 66, "speed_amp weapon", "Three-sword style, armament haki", "No answer to hax"],
    ["Kaido", "One Piece", "S", "A", 96, 96, 94, 58, 72, "energy resistance_blunt regeneration", "Dragon form, blast breath, monstrous toughness", "Predictable once the pattern is read"],
    ["Whitebeard", "One Piece", "S", "B", 96, 92, 96, 60, 80, "energy barrier", "Quake fruit, sea-splitting output", "Age and failing health"],
    ["Shanks", "One Piece", "S", "A", 90, 88, 94, 66, 88, "energy precognition", "Conqueror's haki, divine departure", "Little on-page canon to grade"],
    ["Law", "One Piece", "A", "B", 76, 78, 88, 86, 90, "reality_warp barrier", "Room, shambles, surgical precision", "Stamina drain per operation"],
    ["Ichigo", "Bleach", "A", "A", 90, 85, 90, 64, 70, "energy speed_amp soul", "Bankai compression, getsuga tensho, soul-reaper body", "Slim defence against hax"],
    ["Aizen", "Bleach", "S+", "A", 84, 88, 92, 96, 96, "mind_control analysis regeneration", "Kyoka Suigetsu, hogyoku evolution, perfect planning", "Arrogance; monologues"],
    ["Yhwach", "Bleach", "S+", "A", 88, 90, 94, 94, 90, "precognition nullification reality_warp soul", "The Almighty, auswahlen, future rewriting", "Fate loopholes and hubris"],
    ["Kenpachi", "Bleach", "S", "B", 96, 94, 92, 20, 48, "berserk weapon", "Raw cutting power, no restraint, joy in the fight", "Zero strategy"],
    ["Ulquiorra", "Bleach", "A", "A", 86, 84, 90, 62, 76, "energy regeneration", "Segunda etapa, lanza del relampago", "Resolve collapses when pushed"],
    ["Gojo", "Jujutsu Kaisen", "S", "A", 76, 86, 82, 96, 88, "reality_warp domain nullification barrier sealing", "Infinity, Limitless, Unlimited Void", "Output is capped by brain strain"],
    ["Sukuna", "Jujutsu Kaisen", "S", "A", 88, 88, 92, 86, 90, "domain durability_negation regeneration", "Cleave, Dismantle, Malevolent Shrine, binding vows", "No defence against conceptual attacks"],
    ["Toji", "Jujutsu Kaisen", "A", "A", 86, 84, 86, 50, 88, "weapon nullification", "Inverted Spear of Heaven, zero cursed energy", "No ranged pressure"],
    ["Mahito", "Jujutsu Kaisen", "A", "B", 78, 84, 88, 82, 78, "soul adaptation", "Idle Transfiguration, soul reshaping", "Soul damage cuts straight through him"],
    ["Yuji", "Jujutsu Kaisen", "A", "A", 86, 84, 86, 56, 70, "energy durability_negation", "Divergent Fist, Black Flash, relentless pressure", "Inexperience in long fights"],
    ["Jotaro", "JoJo's Bizarre Adventure", "A", "B", 82, 80, 84, 88, 84, "timestop precognition", "Star Platinum precision, stopped time", "Time stop is only a few seconds"],
    ["DIO", "JoJo's Bizarre Adventure", "A", "B", 84, 78, 82, 90, 78, "timestop regeneration immortality", "The World, vampiric regeneration, freezing touch", "Sunlight; terminal overconfidence"],
    ["Giorno", "JoJo's Bizarre Adventure", "S", "B", 78, 82, 86, 96, 88, "reality_warp adaptation", "Gold Experience Requiem, return to zero", "Requiem is conditional on being reached"],
    ["Pucci", "JoJo's Bizarre Adventure", "S", "A", 82, 80, 90, 90, 86, "reality_warp timestop", "Made in Heaven, time acceleration, Whitesnake", "Needs the reset window to open"],
    ["Funny Valentine", "JoJo's Bizarre Adventure", "S", "B", 84, 82, 86, 92, 86, "reality_warp summon", "D4C, parallel bodies, dirty deeds", "Depends on parallel worlds being open"],
    ["Makima", "Chainsaw Man", "S", "A", 78, 86, 86, 92, 92, "mind_control immortality summon", "Control chains, contract regeneration, borrowed powers", "Contract loopholes"],
    ["Denji", "Chainsaw Man", "A", "A", 88, 88, 88, 54, 58, "regeneration berserk", "Chainsaw forms, blood-fueled regen", "Easy to bait"],
    ["Sung Jin-Woo", "Solo Leveling", "S", "A", 90, 90, 92, 80, 86, "summon immortality regeneration", "Shadow army, Monarch authority, regrowth", "Leans on the shadows"],
    ["Meruem", "Hunter x Hunter", "S", "A", 94, 96, 88, 58, 96, "resistance_blunt adaptation speed_amp", "Aura shell, photon, in-fight adaptation", "No ranged hax"],
    ["Netero", "Hunter x Hunter", "S", "B", 88, 84, 90, 72, 88, "energy barrier analysis", "Hundred-Type Guanyin, zero hand", "An old body with a hard limit"],
    ["Killua", "Hunter x Hunter", "A", "A", 80, 78, 86, 60, 86, "speed_amp", "Godspeed, assassination instinct", "Flicker short-circuits quickly"],
    ["Hisoka", "Hunter x Hunter", "A", "A", 84, 80, 86, 64, 90, "weapon analysis", "Bungee Gum, Texture Surprise", "No ranged attack power"],
    ["Gon", "Hunter x Hunter", "A", "B", 86, 82, 88, 54, 70, "energy berserk", "Adult form, Jajanken", "The exchange costs him everything"],
    ["Mob", "Mob Psycho 100", "S", "B", 74, 84, 92, 92, 62, "reality_warp energy adaptation", "???% output, psychic barriers", "Output is emotional, not chosen"],
    ["Alucard", "Hellsing", "S", "B", 88, 96, 86, 88, 74, "immortality regeneration summon soul", "Soul stockpile, Release states, Jackal", "The soul stock is finite"],
    ["Ainz", "Overlord", "S", "C", 78, 88, 86, 94, 88, "timestop mind_control summon durability_negation soul sealing", "Instant death, time stop, guild-tier summons", "Melee is the gap"],
    ["Rimuru", "That Time I Got Reincarnated as a Slime", "S+", "A", 82, 94, 86, 98, 86, "reality_warp adaptation nullification immortality", "Predator, Great Sage, ultimate skills", "Slow to escalate in character"],
    ["Meliodas", "Seven Deadly Sins", "A", "A", 88, 90, 88, 72, 70, "regeneration energy speed_amp", "Full Counter, demon mark, assault mode", "Full Counter needs a magic attack to eat"],
    ["Escanor", "Seven Deadly Sins", "S", "B", 96, 94, 96, 60, 74, "energy barrier", "Sunshine, Rhitta, noon invincibility", "Useless after sunset"],
    ["Kenshiro", "Fist of the North Star", "S", "B", 92, 88, 90, 84, 80, "durability_negation precognition soul", "Pressure points, Musou Tensei", "Has to make contact"],
    ["Tanjiro", "Demon Slayer", "B", "A", 80, 78, 84, 44, 76, "soul energy", "Hinokami Kagura, water breathing, scent tracking", "Human-level endurance"],
    ["Muzan", "Demon Slayer", "A", "A", 88, 88, 88, 72, 84, "regeneration adaptation", "Flesh whips, split bodies, instant regrowth", "Sunlight ends him"],
    ["Levi", "Attack on Titan", "B", "A", 82, 76, 84, 30, 90, "speed_amp weapon", "ODM mobility, blade precision", "No defence against hax"],
    ["Eren", "Attack on Titan", "A", "B", 90, 88, 88, 60, 74, "summon regeneration barrier", "Titan hardening, Founding Titan control", "Slow in the giant form"],
    ["Guts", "Berserk", "A", "B", 90, 86, 92, 40, 84, "weapon berserk regeneration", "Dragonslayer, berserker armour", "The armour eats his life"],
    ["Griffith", "Berserk", "S", "A", 86, 88, 90, 88, 88, "reality_warp barrier precognition", "Causality manipulation, Femto", "Bound to fate's timing"],
    ["All Might", "My Hero Academia", "S", "A", 94, 90, 92, 30, 76, "speed_amp", "One For All, overwhelming smashes", "A shrinking time limit"],
    ["Deku", "My Hero Academia", "A", "A", 88, 86, 90, 52, 82, "energy speed_amp", "Multiple quirks, full-cowl output", "Damage backlash"],
    ["Shigaraki", "My Hero Academia", "S", "B", 88, 86, 92, 84, 80, "durability_negation curse", "Decay, All For One", "Everything is touch range"],
    ["Yusuke", "Yu Yu Hakusho", "A", "A", 86, 84, 88, 56, 74, "energy soul", "Spirit gun, demon heritage", "Stamina runs hot then empty"],
    ["Frieren", "Frieren: Beyond Journey's End", "S", "B", 68, 76, 92, 90, 92, "energy barrier analysis sealing", "Zoltraak precision, mana perception, binding magic", "Poor at close quarters"],
    ["Tatsumaki", "One Punch Man", "S", "B", 66, 70, 94, 86, 82, "reality_warp barrier", "Psychic tk, barriers, flight", "Physically fragile"],
    ["Garou", "One Punch Man", "S", "A", 90, 88, 90, 70, 88, "adaptation precognition", "Monsterfication, technique copying", "Runs on borrowed momentum"],
    ["Boros", "One Punch Man", "S", "A", 90, 90, 92, 58, 70, "energy regeneration", "Meteoric Burst, regrowth", "Release form burns out"],
    ["Genos", "One Punch Man", "B", "A", 82, 74, 90, 40, 74, "energy tech", "Incinerate cannons, speed bursts", "Glass frame"]
  ];

  const ALIASES = {
    "son goku": "Goku",
    "kakarot": "Goku",
    "caped baldy": "Saitama",
    "one punch man": "Saitama",
    "naruto uzumaki": "Naruto",
    "sasuke uchiha": "Sasuke",
    "madara uchiha": "Madara",
    "itachi uchiha": "Itachi",
    "pain nagato": "Pain",
    "nagato": "Pain",
    "monkey d luffy": "Luffy",
    "roronoa zoro": "Zoro",
    "ichigo kurosaki": "Ichigo",
    "sosuke aizen": "Aizen",
    "satoru gojo": "Gojo",
    "ryomen sukuna": "Sukuna",
    "toji fushiguro": "Toji",
    "jotaro kujo": "Jotaro",
    "dio brando": "DIO",
    "giorno giovanna": "Giorno",
    "enrico pucci": "Pucci",
    "makima chainsaw": "Makima",
    "ainz ooal gown": "Ainz",
    "momonga": "Ainz",
    "rimuru tempest": "Rimuru",
    "shigeo kageyama": "Mob",
    "meruem chimera ant": "Meruem",
    "isaac netero": "Netero",
    "alucard hellsing": "Alucard",
    "meliodas sins": "Meliodas",
    "kenshiro hokuto": "Kenshiro",
    "sung jin woo": "Sung Jin-Woo",
    "jinwoo": "Sung Jin-Woo",
    "eren yeager": "Eren",
    "all might": "All Might",
    "toshinori yagi": "All Might",
    "izuku midoriya": "Deku",
    "tomura shigaraki": "Shigaraki",
    "yusuke urameshi": "Yusuke",
    "kisuke": "Kakashi",
    "meliodas": "Meliodas"
  };

  /* Base speed per tier, plus a small stable spread inside the tier so two
     fighters at the same tier are not numerically identical. */
  const SPEED_BASE = { S: 95, A: 88, B: 81, C: 73, D: 64 };

  const FIGHTERS = SHEETS.map(
    ([name, series, tier, speedTier, strength, durability, ap, hax, iq, tags, kit, weaknesses]) => ({
      name,
      series,
      tier,
      speedTier,
      speed: (SPEED_BASE[speedTier] || 80) + (hash(name) % 7) - 3,
      stats: { strength, durability, ap, hax, iq },
      tags: String(tags).split(/\s+/).filter(Boolean),
      kit,
      weaknesses
    })
  );

  const byName = new Map(FIGHTERS.map((fighter) => [fighter.name.toLowerCase(), fighter]));

  const has = (fighter, tag) => fighter.tags.includes(tag);
  const STAT_LABELS = [
    ["strength", "Strength"],
    ["durability", "Durability"],
    ["ap", "Attack power"],
    ["hax", "Hax"],
    ["iq", "Battle IQ"]
  ];

  function normalise(raw) {
    return String(raw)
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function findFighter(raw) {
    const clean = normalise(raw);
    if (!clean) return null;

    if (byName.has(clean)) return byName.get(clean);
    if (ALIASES[clean]) return byName.get(ALIASES[clean].toLowerCase());

    const contains = FIGHTERS.find(
      (fighter) =>
        clean.includes(fighter.name.toLowerCase()) ||
        Object.keys(ALIASES).some((alias) => clean.includes(alias) && byName.get(ALIASES[alias].toLowerCase()) === fighter)
    );
    if (contains) return contains;

    const word = clean.split(" ").pop();
    if (word && word.length >= 4) {
      const starts = FIGHTERS.find((fighter) => fighter.name.toLowerCase().startsWith(word));
      if (starts) return starts;
    }

    /* Every name works: anything not on the curated roster gets a scout estimate. */
    const singleLetterName = /^[A-Z]$/.test(String(raw).trim());
    return clean.length >= 2 || singleLetterName ? estimateFighter(raw) : null;
  }

  const ESTIMATE_TAGS = [
    "energy",
    "speed_amp",
    "precognition",
    "regeneration",
    "durability_negation",
    "domain",
    "reality_warp",
    "mind_control",
    "immortality",
    "adaptation",
    "summon",
    "resistance_blunt",
    "timestop",
    "weapon",
    "barrier"
  ];

  function displayName(raw) {
    return String(raw)
      .replace(/^(who\s+(wins|would\s+win)[,:]?\s+|is\s+|can\s+)/i, "")
      .replace(/\s+(who\s+wins?|win)$/i, "")
      .trim()
      .replace(/\s+/g, " ")
      .split(" ")
      .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
      .join(" ");
  }

  /*
   * Deterministic scouting sheet for any name. Ratings are derived from the
   * name itself, so the same fighter always produces the same profile, and the
   * output is labelled as an estimate rather than curated canon.
   */
  function estimateFighter(raw) {
    const name = displayName(raw);
    const seed = hash(name.toLowerCase());
    const band = (min, max, shift) => min + ((seed >>> shift) % (max - min + 1));

    const stats = {
      strength: band(62, 93, 0),
      durability: band(60, 93, 5),
      ap: band(62, 94, 10),
      hax: band(22, 88, 15),
      iq: band(52, 92, 25)
    };
    const speed = band(64, 92, 20);
    const speedTier = ["A", "A", "B", "B", "C"][seed % 5];

    const tags = [];
    const count = 1 + (seed % 3);
    for (let i = 0; i < count; i += 1) {
      const tag = ESTIMATE_TAGS[(seed >>> (i * 4)) % ESTIMATE_TAGS.length];
      if (!tags.includes(tag)) tags.push(tag);
    }

    const average = (stats.strength + stats.durability + stats.ap) / 3;
    const tier = average >= 88 ? "S" : average >= 82 ? "A" : average >= 74 ? "B" : "C";

    return {
      name,
      series: "Scouted · unranked",
      tier,
      speed,
      speedTier,
      stats,
      tags,
      kit: "No curated kit on file — the abilities below are inferred from the name.",
      weaknesses: "Unknown. Treat every read on this sheet as provisional.",
      estimated: true
    };
  }

  /*
   * The interaction matrix. `beats` means the attacker's tag gains weight
   * against a target carrying that tag; the sentence explains why, and is
   * reused verbatim in the matchup prose so the reasoning is auditable.
   */
  const INTERACTIONS = [
    { tag: "timestop", beats: ["speed_amp", "clone", "summon", "weapon"], weight: 14, why: "freezes their action economy outright" },
    { tag: "timestop", beats: ["precognition"], weight: 5, why: "foresight cannot act during stopped time" },
    { tag: "reality_warp", beats: ["energy", "weapon", "summon", "barrier"], weight: 12, why: "rewrites the terms of the fight" },
    { tag: "reality_warp", beats: ["clone"], weight: 8, why: "one rewrite covers every copy" },
    { tag: "domain", beats: ["summon", "clone", "weapon", "barrier"], weight: 9, why: "sure-hit guarantees inside the barrier" },
    { tag: "durability_negation", beats: ["regeneration", "immortality", "barrier", "resistance_blunt"], weight: 11, why: "skips conventional defence entirely" },
    { tag: "durability_negation", beats: ["domain"], weight: 6, why: "the barrier stops mattering when defence is bypassed" },
    { tag: "nullification", beats: ["energy", "curse", "domain", "reality_warp", "sealing"], weight: 9, why: "shuts the ability off at the source" },
    { tag: "mind_control", beats: ["berserk", "weapon", "summon"], weight: 7, why: "turns their own kit against them" },
    { tag: "adaptation", beats: ["energy", "poison", "curse"], weight: 7, why: "each exchange teaches the counter" },
    { tag: "immortality", beats: ["weapon", "poison"], weight: 6, why: "removes the option of a clean kill" },
    { tag: "sealing", beats: ["immortality", "regeneration", "reality_warp", "soul"], weight: 10, why: "nothing needs to die — the fight just ends" },
    { tag: "soul", beats: ["immortality", "regeneration", "barrier"], weight: 9, why: "attacks the part regrowth cannot rebuild" },
    { tag: "precognition", beats: ["speed_amp", "berserk"], weight: 5, why: "reads the strike before it lands" },
    { tag: "barrier", beats: ["weapon", "poison", "energy"], weight: 4, why: "blunts the opening exchange" },
    { tag: "clone", beats: ["weapon", "berserk"], weight: 4, why: "attrition and angle control" },
    { tag: "poison", beats: ["regeneration", "berserk"], weight: 5, why: "damage that keeps working" },
    { tag: "curse", beats: ["weapon", "barrier"], weight: 5, why: "cannot be blocked by guard or armour" },
    { tag: "analysis", beats: ["berserk", "clone", "weapon"], weight: 5, why: "reads the pattern and counters it" },
    { tag: "weapon", beats: ["regeneration"], weight: 3, why: "cuts faster than it can knit" }
  ];

  function interactionsBetween(me, foe) {
    const found = [];
    INTERACTIONS.forEach((rule) => {
      if (!has(me, rule.tag)) return;
      rule.beats.forEach((victimTag) => {
        if (!has(foe, victimTag)) return;
        /* Nullification cancels the free ride: it is handled in its own rule. */
        if (has(foe, "nullification") && rule.tag !== "nullification" && rule.tag !== "durability_negation") return;
        found.push({ rule, victimTag });
      });
    });
    return found;
  }

  function sideBonus(me, foe) {
    let delta = 0;
    interactionsBetween(me, foe).forEach(({ rule }) => {
      delta += rule.weight;
    });
    if (has(me, "resistance_blunt") && !has(foe, "energy") && !has(foe, "durability_negation")) delta += 5;
    if (has(me, "adaptation") && has(foe, "energy")) delta += 2;
    return delta;
  }

  function statsAverage(fighter) {
    const { strength, durability, ap, iq } = fighter.stats;
    return (strength + durability + ap) / 3 * 0.84 + iq * 0.16;
  }

  function score(fighter, foe) {
    const stats = statsAverage(fighter);
    const hax = clamp(fighter.stats.hax + (foe ? sideBonus(fighter, foe) : 0), 0, 100);
    const gap = foe ? speedRank(fighter.speedTier) - speedRank(foe.speedTier) : 0;
    const speed = fighter.speed + gap * 5;
    const weights = OPTIONS.weights;
    return weights.stats * stats + weights.hax * hax + weights.speed * speed;
  }

  function rankingScore(fighter) {
    /* Solo ranking: average the sheet against same-tier rivals, because
       "strongest" should be graded inside its own weight class. */
    const peers = FIGHTERS.filter((other) => other !== fighter && other.tier === fighter.tier);
    const rivals = (peers.length ? peers : FIGHTERS.filter((other) => other !== fighter)).slice(0, 3);
    const base = score(fighter, null);
    const adjustment = rivals.reduce((sum, rival) => sum + (score(fighter, rival) - score(rival, fighter)), 0) / (rivals.length || 1);
    return base + adjustment / 4;
  }

  function bar(value) {
    return "█".repeat(Math.round(clamp(value, 0, 100) / 10));
  }

  function statCard(fighter) {
    const stats = [
      ...STAT_LABELS.map(([key, label]) => [label, fighter.stats[key]]),
      ["Speed", fighter.speed]
    ];
    const bars = stats.map(
      ([label, value]) => `${label.padEnd(13, " ")}${String(value).padStart(3, " ")}  ${bar(value)}`
    );

    const counters = FIGHTERS.filter((other) => other !== fighter)
      .map((other) => ({ other, edge: sideBonus(other, fighter) + other.stats.hax - fighter.stats.hax }))
      .sort((a, b) => b.edge - a.edge)
      .slice(0, 3)
      .map((entry) => `${entry.other.name} (${entry.other.series.split(":")[0]})`);

    const rivals = FIGHTERS.filter((other) => other !== fighter)
      .map((other) => ({ other, margin: Math.abs(rankingScore(other) - rankingScore(fighter)) }))
      .sort((a, b) => a.margin - b.margin)
      .slice(0, 2)
      .map((entry) => `${fighter.name} vs ${entry.other.name}`);

    const lines = [
      `${fighter.estimated ? "SCOUT CARD" : "FIGHTER CARD"} · ${fighter.name}`,
      `${fighter.series} · tier ${fighter.tier} · speed tier ${fighter.speedTier} (${tierName(fighter.speedTier)})`
    ];
    if (fighter.estimated) lines.push("Estimated sheet — curated data is not on file for this name.");
    lines.push("", "STATS", ...bars, "", "KIT", `• ${fighter.kit}`, "", "WEAK SPOTS", `• ${fighter.weaknesses}`, "");
    lines.push("HARDEST MATCHUPS", ...counters.map((entry) => `• ${entry}`), "", `Try: ${rivals.join(" · ")}`);
    return lines.join("\n");
  }

  function marginLabel(share) {
    const lead = share - 50;
    if (lead < 2) return "50/50";
    if (lead < 6) return "extreme diff";
    if (lead < 12) return "high diff";
    if (lead < 20) return "mid diff";
    return "low diff";
  }

  function verdictLine(winner, share, loserShare) {
    const lead = share - 50;
    if (lead >= 20) return `${winner.name} wins without much trouble, ${share}–${loserShare}.`;
    if (lead >= 12) return `${winner.name} takes it clearly, ${share}–${loserShare}.`;
    if (lead >= 6) return `${winner.name} wins with a real edge, ${share}–${loserShare}.`;
    if (lead >= 2) return `${winner.name} edges it, ${share}–${loserShare}.`;
    return `Too close to call — ${share}–${loserShare} sits inside the margin of error.`;
  }

  function roundsFor(a, b, scores) {
    const faster = speedRank(a.speedTier) === speedRank(b.speedTier) ? null : speedRank(a.speedTier) > speedRank(b.speedTier) ? a : b;
    const slower = faster ? (faster === a ? b : a) : null;
    const edgesA = interactionsBetween(a, b);
    const edgesB = interactionsBetween(b, a);
    const openerA = edgesA.find((entry) => ["timestop", "mind_control", "curse", "domain"].includes(entry.rule.tag));
    const openerB = edgesB.find((entry) => ["timestop", "mind_control", "curse", "domain"].includes(entry.rule.tag));

    const early = faster
      ? `Early · ${faster.name} sets the pace — a full speed tier up is a blitz window, and ${slower.name} has to survive the opener without conceding the exchange.`
      : `Early · neither opens a speed gap, so the first exchange is a read. ${openerA ? `${a.name}'s ${openerA.rule.tag.replace(/_/g, " ")} wants to land first.` : `${a.name} probes while ${b.name} measures range.`}`;

    const mid = openerA || openerB
      ? `Mid · the ability layer decides it. ${[openerA ? `${a.name}'s ${openerA.rule.tag.replace(/_/g, " ")} ${openerA.rule.why}` : null, openerB ? `${b.name}'s ${openerB.rule.tag.replace(/_/g, " ")} ${openerB.rule.why}` : null].filter(Boolean).join(" Meanwhile ")}.`
      : `Mid · clean trades. Whoever wins the stat exchange here forces the other into a losing plan.`;

    const tankier = a.stats.durability >= b.stats.durability ? a : b;
    const late = `Late · ${tankier.name}'s durability (${tankier.stats.durability}) is the last wall. ${
      has(tankier, "immortality") || has(tankier, "regeneration")
        ? "Regeneration means a non-lethal win is the only clean route left."
        : "No regeneration, so accumulated damage finally sticks."
    }`;

    const lean = scores.a > scores.b ? a : b;
    return [early, mid, late, `Lean · ${lean.name} is the one dictating the shape of the fight.`];
  }

  function analyzeMatch(a, b) {
    if (a.name.toLowerCase() === b.name.toLowerCase()) {
      return [
        `MATCHUP · ${a.name} vs ${a.name}`,
        "",
        "Identical sheets, identical tags — every exchange mirrors and nothing breaks the tie.",
        "",
        "VERDICT",
        "Mirror match. Call it a draw unless one side gets a ruleset advantage."
      ].join("\n");
    }

    const scores = { a: score(a, b), b: score(b, a) };
    const diff = scores.a - scores.b;
    const aWins = diff >= 0;
    const winner = aWins ? a : b;
    const loser = aWins ? b : a;
    const winnerShare = Math.round(clamp(0.5 + Math.abs(diff) / 70, 0.5, 0.97) * 100);
    const loserShare = 100 - winnerShare;
    const haxA = clamp(a.stats.hax + sideBonus(a, b), 0, 100);
    const haxB = clamp(b.stats.hax + sideBonus(b, a), 0, 100);
    const gap = speedRank(a.speedTier) - speedRank(b.speedTier);
    const estimated = Boolean(a.estimated || b.estimated);

    const edge = (label, av, bv) =>
      `• ${label} — ${av} vs ${bv} → ${av === bv ? "even" : av > bv ? a.name : b.name}`;

    const statLines = [
      edge("Strength", a.stats.strength, b.stats.strength),
      edge("Durability", a.stats.durability, b.stats.durability),
      edge("Attack power", a.stats.ap, b.stats.ap),
      edge("Battle IQ", a.stats.iq, b.stats.iq),
      edge("Hax", Math.round(haxA), Math.round(haxB)),
      `• Speed tier — ${a.speedTier} (${tierName(a.speedTier)}) vs ${b.speedTier} (${tierName(
        b.speedTier
      )}) → ${gap === 0 ? "even" : gap > 0 ? a.name : b.name}`
    ];

    const interactions = [];
    const seenRules = new Set();
    const ranked = [
      ...interactionsBetween(a, b).map((entry) => ({ rule: entry.rule, side: a, other: b })),
      ...interactionsBetween(b, a).map((entry) => ({ rule: entry.rule, side: b, other: a }))
    ].sort((x, y) => y.rule.weight - x.rule.weight);

    ranked.forEach(({ rule, side, other }) => {
      const key = side.name + ":" + rule.tag;
      if (seenRules.has(key) || interactions.length >= 4) return;
      seenRules.add(key);
      interactions.push(
        side.name + "'s " + rule.tag.replace(/_/g, " ") + " " + rule.why + " against " + other.name + "."
      );
    });

    const rounds = roundsFor(a, b, scores);

    const winnerScore = aWins ? scores.a : scores.b;
    const loserScore = aWins ? scores.b : scores.a;
    const winCondition = (side, other) => {
      if (has(side, "timestop") && !has(other, "precognition")) return `${side.name}: land the stop, then win inside the window.`;
      if (has(side, "durability_negation")) return `${side.name}: force contact once — negation does the rest.`;
      if (has(side, "reality_warp") && !has(other, "nullification")) return `${side.name}: drag the fight into their own rules and keep it there.`;
      if (has(side, "mind_control")) return `${side.name}: open with the mental play before the stat gap closes.`;
      if (has(side, "adaptation")) return `${side.name}: survive two exchanges, then exploit the pattern they just learned.`;
      if (side.speed > other.speed + 4) return `${side.name}: stay at range and never trade clean.`;
      if (side.stats.ap > other.stats.ap + 4) return `${side.name}: force the exchange early and lean on the higher output.`;
      if (side.stats.durability > other.stats.durability + 4) return `${side.name}: turn it into attrition — the durability edge wins a long fight.`;
      if (side.stats.iq > other.stats.iq + 6) return `${side.name}: win the read, not the trade. Bait twice, commit once.`;
      return `${side.name}: keep it scrappy, take the free openings, and refuse the clean exchange.`;
    };

    const header = [
      `MATCHUP · ${a.name} vs ${b.name}`,
      estimated ? "Scout estimate in play — an unranked name was modelled locally." : "Standard ruleset · no outside help · in-character"
    ];

    if (OPTIONS.detail === "concise") {
      return [
        ...header,
        "",
        "VERDICT",
        verdictLine(winner, winnerShare, loserShare),
        `${marginLabel(winnerShare)} · ${winner.name} ${winnerScore.toFixed(1)} vs ${loserScore.toFixed(1)}`,
        winCondition(winner, loser),
        "",
        "Local model · subjective ratings · canon varies by arc."
      ].join("\n");
    }

    return [
      ...header,
      "",
      "HEADLINE",
      `${verdictLine(winner, winnerShare, loserShare)} (${marginLabel(winnerShare)})`,
      "",
      "STAT EDGE",
      ...statLines,
      "",
      "ABILITY INTERACTIONS",
      ...(interactions.length ? interactions.map((line) => `• ${line}`) : ["• Nothing in either kit meaningfully cancels the other — this is a raw exchange."]),
      "",
      "ROUNDS",
      ...rounds.map((line) => `• ${line}`),
      "",
      "WIN CONDITIONS",
      winCondition(a, b),
      winCondition(b, a),
      "",
      "SCORE",
      `${a.name} ${scores.a.toFixed(1)} · ${b.name} ${scores.b.toFixed(1)} · weights ${Math.round(
        OPTIONS.weights.stats * 100
      )}/${Math.round(OPTIONS.weights.hax * 100)}/${Math.round(OPTIONS.weights.speed * 100)}`,
      "",
      "VERDICT",
      verdictLine(winner, winnerShare, loserShare),
      "",
      "Local model · subjective ratings · canon varies by arc."
    ].join("\n");
  }

  function battleRoyale(fighters) {
    const ranked = fighters
      .map((fighter) => {
        const others = fighters.filter((other) => other !== fighter);
        const solo = score(fighter, null);
        const vs = others.reduce((sum, other) => sum + score(fighter, other), 0) / (others.length || 1);
        return { fighter, value: solo * 0.45 + vs * 0.55 };
      })
      .sort((a, b) => b.value - a.value);

    const top = ranked[0];
    const shared = ranked.slice(1).map((entry) => entry.fighter.name);
    return [
      `BATTLE ROYALE · ${fighters.map((fighter) => fighter.name).join(" · ")}`,
      "Same ruleset, everyone in at once, no alliances.",
      "",
      "RANKING",
      ...ranked.map((entry, index) => `${index + 1}. ${entry.fighter.name} — ${entry.value.toFixed(1)}`),
      "",
      "READ",
      `${top.fighter.name} comes out ahead, but a battle royale is not a list of 1v1s: ${list(shared)} will shoot for the leader before they fight each other.`,
      `${ranked[ranked.length - 1].fighter.name} is the one who benefits most from the chaos — less attention, cleaner openings.`,
      "",
      "Local model · subjective ratings · canon varies by arc."
    ].join("\n");
  }

  function tierList() {
    const buckets = new Map();
    FIGHTERS.forEach((fighter) => {
      if (!buckets.has(fighter.tier)) buckets.set(fighter.tier, []);
      buckets.get(fighter.tier).push(fighter.name);
    });
    const order = ["S+", "S", "A", "B", "C"];
    return [
      `TIER LIST · ${FIGHTERS.length} curated sheets`,
      "Sorted by sheet tier, then alphabetically. Scouted names are never on this list.",
      "",
      ...order
        .filter((tier) => buckets.has(tier))
        .map((tier) => `${tier.padEnd(3)} · ${buckets.get(tier).sort().join(", ")}`),
      "",
      "Disagree with a placement? Name the matchup and the model will defend or concede it."
    ].join("\n");
  }

  function topRanked(count) {
    const ranked = FIGHTERS.map((fighter) => ({ fighter, value: rankingScore(fighter) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, count);
    return [
      `TOP ${count} BY COMPOSITE SCORE`,
      "Weighted stats + hax + speed, then adjusted against the three closest rivals.",
      "",
      ...ranked.map((entry, index) => `${index + 1}. ${entry.fighter.name} — ${entry.value.toFixed(1)} · ${entry.fighter.series}`),
      "",
      "This is a model ranking, not canon. Ask for any specific matchup to see the reasoning."
    ].join("\n");
  }

  function seriesSearch(query) {
    const q = query.toLowerCase();
    const matches = FIGHTERS.filter((fighter) => fighter.series.toLowerCase().includes(q));
    if (!matches.length) return null;
    const series = matches[0].series;
    return [
      `ROSTER · ${series}`,
      `${matches.length} curated sheet${matches.length === 1 ? "" : "s"}`,
      "",
      ...matches.map((fighter) => `• ${fighter.name} — tier ${fighter.tier}, speed ${fighter.speedTier}`)
    ].join("\n");
  }

  function debateHelp(input) {
    const clean = String(input).toLowerCase().trim();
    const matches =
      clean.length < 2
        ? []
        : FIGHTERS.filter(
            (fighter) =>
              fighter.name.toLowerCase().includes(clean) ||
              fighter.series.toLowerCase().includes(clean)
          );

    if (matches.length) {
      return [
        `I know ${matches.length === 1 ? "one fighter" : `${matches.length} fighters`} matching "${input}":`,
        "",
        ...matches.slice(0, 10).map((fighter) => `• ${fighter.name} — ${fighter.series} (tier ${fighter.tier})`),
        "",
        "Name two of them with “vs” to run a matchup."
      ].join("\n");
    }

    return [
      "I need two fighters. Format: “A vs B”.",
      "",
      "Examples",
      "• Goku vs Saitama",
      "• Gojo vs Sukuna",
      "• Aizen vs Yhwach",
      "• Levi vs Toji",
      "",
      "Also available",
      "• A single name → full fighter card",
      "• “A vs B vs C” → battle royale ranking",
      "• “tier list” → every curated sheet by tier",
      "• “top 10” → composite ranking",
      "• “random” → a random matchup",
      "• “Naruto roster” → everyone on file from a series",
      "",
      `Curated sheets: ${FIGHTERS.length}. Any other name still works — I scout it from the name itself and flag the card as an estimate.`
    ].join("\n");
  }

  function parseFighters(text) {
    const cleaned = text
      .replace(/^\s*(?:so\s+)?(?:who(?:'s| is)?\s+(?:would\s+)?(?:wins?|win|stronger)|who\s+wins?|can|would|does)\s*[,:]?\s*/i, "")
      .replace(/[?!]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const strictSplit = cleaned.split(/\s+(?:vs\.?|versus|against|v)\s+/i);
    const tryResolve = (parts) => {
      const resolved = parts.map((part) => findFighter(part.trim()));
      return resolved.every(Boolean) && resolved.length >= 2 ? resolved : null;
    };

    const strict = strictSplit.length >= 2 ? tryResolve(strictSplit) : null;
    if (strict) return strict;

    const loose = cleaned.split(/\s+(?:or|and)\s+/i);
    if (loose.length >= 2 && loose.length <= 4) {
      const resolved = tryResolve(loose);
      if (resolved) return resolved;
    }
    return null;
  }

  function debate(raw) {
    const text = String(raw || "").trim();
    const lower = text.toLowerCase();

    if (!text) return debateHelp("");
    if (/^(tier list|tiers|ranking|rank list)$/i.test(lower)) return tierList();
    if (/^(random|random matchup|surprise me)$/i.test(lower)) {
      const a = FIGHTERS[hash(`a${turn}`) % FIGHTERS.length];
      let b = FIGHTERS[hash(`b${turn}`) % FIGHTERS.length];
      if (b === a) b = FIGHTERS[(hash(`b${turn}`) + 3) % FIGHTERS.length];
      return analyzeMatch(a, b);
    }

    const topMatch = lower.match(/^top\s*(\d+)$/);
    if (topMatch) return topRanked(clamp(Number(topMatch[1]) || 10, 1, 20));
    if (/^(strongest|best|who is the strongest|who'?s the strongest)\b/.test(lower)) return topRanked(10);

    const rosterMatch = lower.match(/^(?:who(?:'s| is)? (?:in|from) |roster (?:for |of )?)(.+?)(?: roster)?$/);
    if (rosterMatch) {
      const result = seriesSearch(rosterMatch[1]);
      if (result) return result;
    }
    if (/\broster\b/.test(lower)) {
      const result = seriesSearch(lower.replace(/\broster\b/g, "").trim());
      if (result) return result;
    }

    const fighters = parseFighters(text);
    if (fighters && fighters.length === 2) return analyzeMatch(fighters[0], fighters[1]);
    if (fighters && fighters.length > 2) return battleRoyale(fighters);

    const single = findFighter(text);
    if (single && !parseFighters(text)) return statCard(single);
    return debateHelp(text);
  }

  /* ================================================================== */
  /* NORMAL — plain conversation                                        */
  /* ================================================================== */

  const GREETED = /\b(hi|hey|hello|yo|sup|howdy|good (morning|evening|afternoon))\b/i;

  function smallTalkNormal(text) {
    const lower = text.toLowerCase();

    if (GREETED.test(lower) && text.split(/\s+/).length <= 6) {
      return pick(
        [
          "Hey. What are you working on?",
          "Hey — good to see you. What's on your mind?",
          "Hi. Ask me anything, or just talk it out."
        ],
        text
      );
    }
    if (/\b(how are you|how's it going|hows it going|you good|how do you feel)\b/i.test(lower)) {
      return pick(
        [
          "Running fine — local, offline, no opinions to spare. How are you actually doing?",
          "Good. A little rule-based, but good. What's up with you?",
          "Steady. No bad days when you're a few hundred lines of logic. How's your day going?"
        ],
        text
      );
    }
    if (/\b(who are you|what are you|your name|are you (an? )?(ai|robot|human))\b/i.test(lower)) {
      return [
        "I'm the Normal assistant in this shell — a local, rule-based engine. No model weights, no network calls, nothing leaves this machine.",
        "",
        "That means I'm honest about my limits: I can hold a conversation, do arithmetic, and help you think something through, but I don't know today's news and I won't pretend to."
      ].join("\n");
    }
    if (/\b(thank|thanks|ty|appreciate)\b/i.test(lower)) {
      return pick(["Any time.", "You're welcome. Anything else?", "Happy to help."], text);
    }
    if (/\b(bye|goodbye|see you|later|night)\b/i.test(lower)) {
      return pick(["Later. Don't forget to actually close the tab.", "See you. Go win something.", "Take it easy."], text);
    }
    if (/\b(what can you do|help|commands|capabilities)\b/i.test(lower)) {
      return [
        "I keep it simple:",
        "",
        "• Talk — anything from a rough day to a random question.",
        "• Maths — “what is 18 * 7 + 4”.",
        "• Think something through — “help me plan…”, “should I…”.",
        "• Explain a term — “explain entropy”.",
        "• Tell a joke — say the word.",
        "",
        "The other tabs are the specialists: the Debate Matrix for anime fights, the Roast Pit for abuse you asked for, and Conspiracy Corner for nonsense."
      ].join("\n");
    }
    return null;
  }

  /* Small arithmetic evaluator — no eval, only numbers and + - * / ( ). */
  function evaluateMath(expression) {
    const tokens = expression.match(/\d+(?:\.\d+)?|[+\-*/()]/g);
    if (!tokens) return null;
    let index = 0;

    const peek = () => tokens[index];
    const next = () => tokens[index++];

    function parseExpression() {
      let value = parseTerm();
      while (peek() === "+" || peek() === "-") {
        const op = next();
        const rhs = parseTerm();
        value = op === "+" ? value + rhs : value - rhs;
      }
      return value;
    }
    function parseTerm() {
      let value = parseFactor();
      while (peek() === "*" || peek() === "/") {
        const op = next();
        const rhs = parseFactor();
        value = op === "*" ? value * rhs : value / rhs;
      }
      return value;
    }
    function parseFactor() {
      const token = next();
      if (token === "(") {
        const value = parseExpression();
        if (next() !== ")") throw new Error("unbalanced");
        return value;
      }
      if (token === "-") return -parseFactor();
      const value = Number(token);
      if (!Number.isFinite(value)) throw new Error("bad token");
      return value;
    }

    try {
      const result = parseExpression();
      if (index !== tokens.length) return null;
      return Number.isFinite(result) ? result : null;
    } catch {
      return null;
    }
  }

  const JOKES = [
    "I told my computer I needed a break. It said “no problem, I'll go to sleep” — and crashed.",
    "There are two hard things in computing: cache invalidation, naming things, and off-by-one errors.",
    "I would tell you a UDP joke, but you might not get it.",
    "My code doesn't have bugs. It has randomly generated features.",
    "Why do programmers prefer dark mode? Because light attracts bugs.",
    "I asked the pretzel for advice. It said “stay twisted”."
  ];

  function normal(raw) {
    const text = String(raw || "").trim();
    const lower = text.toLowerCase();
    if (!text) return "Say something and I'll answer. No gimmick here — just a conversation.";

    const talk = smallTalkNormal(text);
    if (talk) return talk;

    if (/\b(joke|funny|make me laugh)\b/i.test(lower)) {
      return `${pick(JOKES, text)}\n\n${pick(["I have more.", "That's the good one.", "I'll see myself out."], text + "j")}`;
    }

    const mathSource = text.replace(/^(what(?:'s| is)|calculate|compute|solve)\s*/i, "").replace(/[=?]+$/, "").trim();
    if (/^[\d\s+\-*/().]+$/.test(mathSource) && /[+\-*/]/.test(mathSource)) {
      const result = evaluateMath(mathSource);
      if (result !== null) return `${mathSource} = ${Number(result.toFixed(6))}`;
      return "That expression didn't parse for me. Keep it to numbers, + - * / and brackets.";
    }

    /* Facts are where a rule-based engine should shut up rather than invent. */
    if (/\b(capital of|president|prime minister|population of|how tall|how old|what year|who won|when did|when was|weather|net worth)\b/i.test(lower)) {
      return [
        "I don't have a knowledge base, so I won't guess — a confident wrong fact is worse than no answer.",
        "",
        "The Browser panel (3) is right there: type the question into the address bar and it becomes a search.",
        "",
        "What I can do is help you pressure-test it. Tell me what you think the answer is and why, and I'll look for the weak link."
      ].join("\n");
    }

    if (/\b(explain|what is|what's|define|how does .* work|meaning of)\b/i.test(lower)) {
      const subject = text
        .replace(/^(please\s+)?(can you\s+)?(explain|define|what is|what's|meaning of)\b\s*/i, "")
        .replace(/\?+$/, "")
        .replace(/^(the|a|an)\s+/i, "")
        .trim();
      if (subject.length >= 2) {
        return [
          `Short answer on “${subject}”: I can give you a structure, not a Wikipedia entry — I don't have a knowledge base to quote.`,
          "",
          "A way to actually get there:",
          "1. Definition — what it is, in one sentence you could say out loud.",
          "2. Mechanism — what causes it, step by step.",
          "3. Example — one concrete case you can check.",
          "4. Boundary — where the idea stops being true.",
          "",
          `If you tell me what you already know about ${subject}, I'll help you find the gap instead of guessing.`
        ].join("\n");
      }
    }

    if (/\b(help me|i need to|should i|how do i|advice|what should)\b/i.test(lower)) {
      return [
        "Let's make it concrete instead of motivational.",
        "",
        "1. What does done look like? One sentence, no adjectives.",
        "2. What's the smallest move that produces evidence?",
        "3. What's the thing you're avoiding, and what makes it expensive?",
        "",
        "Tell me which of those you're stuck on and I'll push on that one."
      ].join("\n");
    }

    if (/\b(sad|tired|stressed|anxious|rough day|burnt out|overwhelmed|lonely)\b/i.test(lower)) {
      return [
        "That sounds heavy. I'm a rule-based text engine, so I won't pretend to be a person — but I can take some weight off the thinking part.",
        "",
        "Two things that usually help more than advice:",
        "• Name the one thing that's actually loudest right now. Not the whole pile.",
        "• Decide the next physical action, not the whole plan.",
        "",
        "If it's bigger than a bad day, talking to someone real beats talking to me. I'm here either way."
      ].join("\n");
    }

    if (/\b(code|bug|error|javascript|python|css|html|git|npm)\b/i.test(lower)) {
      return [
        "Debugging rule of thumb: reproduce, isolate, then explain.",
        "",
        "• Reproduce — a reliable failing case beats ten guesses.",
        "• Isolate — cut the input in half until the failure disappears, then look at the last thing you removed.",
        "• Explain — say out loud why the broken line should have worked. The wrong assumption is usually in that sentence.",
        "",
        "Paste the error text and what you changed last, and I'll walk the same steps with you."
      ].join("\n");
    }

    if (/\?$/.test(text)) {
      return [
        "Honest answer: I don't have a database behind me, so I'd be inventing details if I answered that outright.",
        "",
        "What I can do is help you reason it out — give me what you already believe and where the doubt is, and I'll pressure-test it."
      ].join("\n");
    }

    return [
      pick(
        [
          "Got it.",
          "I'm with you.",
          "That's worth unpacking."
        ],
        text
      ),
      "",
      pick(
        [
          "What's the part you keep circling back to?",
          "What would a good outcome actually look like here?",
          "Tell me more — specifically, what happened last?"
        ],
        text + "q"
      ),
      "",
      "You can also just ask me for maths, a joke, or help planning something."
    ].join("\n");
  }

  /* ================================================================== */
  /* SPICY — adult tone, behind an age gate                             */
  /* ================================================================== */

  const SPICE_LINES = [
    "Careful — confidence looks good on you and I'm easily impressed.",
    "You're doing that thing where you type like you already know I'll agree.",
    "I'd flirt harder, but this engine has a text limit and you'd break it.",
    "You bring the charm, I'll bring the bad decisions. Deal?",
    "Flirting with a rule-based engine is a bold strategy. It's working.",
    "You had me at the first semicolon.",
    "I'm not saying you're trouble. I'm saying I'd clear my schedule.",
    "That message had range. Respect."
  ];

  const SPICE_JOKES = [
    "I tried to be mysterious once. I was so good at it nobody noticed.",
    "My love life is like my WiFi — strong signal, no connection.",
    "I'm not high maintenance, I just require the correct temperature and a little attention.",
    "I once sent a risky text and my phone needed a cigarette.",
    "Dating me is like reading terms and conditions: long, and someone always regrets it."
  ];

  const DATE_IDEAS = [
    { name: "the cheap and dangerous one", steps: ["Late-night diner, split one dessert", "Walk until the conversation gets honest", "Home before it gets weird"] },
    { name: "the 2 a.m. arcade run", steps: ["Find the machines that still take coins", "Loser buys the terrible coffee", "Leave when the lights come up"] },
    { name: "the cook-it-wrong date", steps: ["Pick a recipe neither of you can do", "One person cooks, the other narrates like a sports commentator", "Order pizza as the backup plan"] },
    { name: "the drive-with-no-destination", steps: ["Pick a direction, not a place", "One playlist each, no skipping", "Turn around when the snacks run out"] }
  ];

  function spicy(raw) {
    const text = String(raw || "").trim();
    const lower = text.toLowerCase();
    const disclaimer = "18+ tone · flirty, never explicit · you can leave any time.";

    if (!text) {
      return [
        "Well, look who opened the door.",
        "",
        "I do flirty banter, compliments with teeth, date ideas that end in trouble, and jokes your parents wouldn't approve of.",
        "",
        disclaimer
      ].join("\n");
    }

    if (/\b(explicit|nsfw|sex|porn|nudes?|dirty picture)\b/i.test(lower)) {
      return [
        "That's where I stop.",
        "",
        "I stay suggestive, not explicit — flirting, innuendo, adult humour. The rest isn't happening, no matter how you phrase it.",
        "",
        "What I will do: compliments, banter, date ideas, and roasting your texting game."
      ].join("\n");
    }

    if (/\b(no|stop|not comfortable|boundaries|creepy)\b/i.test(lower)) {
      return [
        "Fair enough — dialled back.",
        "",
        "We can keep it friendly and still fun. Say the word and I'll drop the flirting entirely."
      ].join("\n");
    }

    if (/\b(hi|hey|hello|yo)\b/i.test(lower) && text.split(/\s+/).length <= 5) {
      return `${pick(["Well, hello.", "There you are.", "Hey, trouble."], text)}\n\n${pick(SPICE_LINES, text + "s")}\n\n${disclaimer}`;
    }

    if (/\b(compliment|flirt|rizz|pickup|pick up|chat me up|charm)\b/i.test(lower)) {
      return [
        pick(SPICE_LINES, text),
        "",
        "Want a real one? Try this opener: “I'm not good at this, so I'll just be direct — you're the most interesting person in this room.” Direct beats clever almost every time.",
        "",
        disclaimer
      ].join("\n");
    }

    if (/\b(date|dinner|take (her|him|them)|romantic|valentine)\b/i.test(lower)) {
      const idea = pick(DATE_IDEAS, text);
      return [
        `${idea.name.toUpperCase()} — and yes, I've thought about it.`,
        "",
        ...idea.steps.map((step, index) => `${index + 1}. ${step}`),
        "",
        "The rule: the plan should be cheap, slightly reckless, and easy to abandon if the vibe dies.",
        "",
        disclaimer
      ].join("\n");
    }

    if (/\b(joke|funny|laugh)\b/i.test(lower)) {
      return `${pick(SPICE_JOKES, text)}\n\n${disclaimer}`;
    }

    if (/\b(rate|how (do|am) i|am i good|do i have)\b/i.test(lower)) {
      return [
        "Rating your rizz is unscientific, but I'll play.",
        "",
        `• Confidence: ${60 + (hash(text) % 35)}/100 — you typed first, so that's already most of it.`,
        `• Danger level: ${55 + (hash(text + "d") % 40)}/100 — high enough to be fun, low enough to be legal.`,
        "• Advice: ask one real question and then actually listen. That's the whole trick.",
        "",
        disclaimer
      ].join("\n");
    }

    if (/\b(sad|lonely|rejected|alone|heartbroken|no one)\b/i.test(lower)) {
      return [
        "Okay, flirting off for a second.",
        "",
        "Nobody's rejection defines your worth — it defines one attempt, by one person, on one day. That's it.",
        "",
        "When you're ready to be fun again, come back and I'll be insufferable on your behalf.",
        "",
        disclaimer
      ].join("\n");
    }

    if (/\b(thank|thanks|bye|later)\b/i.test(lower)) {
      return pick(["Don't be a stranger.", "Go on then — be charming somewhere else.", "Later, trouble."], text);
    }

    return [
      pick(SPICE_LINES, text),
      "",
      pick(
        [
          "Now say something interesting.",
          "Your turn — impress me.",
          "Go on, give me a reason to flirt back."
        ],
        text + "f"
      ),
      "",
      disclaimer
    ].join("\n");
  }

  /* ================================================================== */
  /* ROAST PIT — playful roasting                                       */
  /* ================================================================== */

  const ROAST_OPENERS = [
    "I'd roast you, but my mum told me not to burn rubbish.",
    "You type like your keyboard is on a timeout.",
    "You've got the confidence of a man who has never once read an error message.",
    "Your search history is just the word “help” and a prayer.",
    "You look like you lose arguments with your own reflection.",
    "You're the human equivalent of a loading screen that never finishes.",
    "You have the reaction time of a website from 2006.",
    "If opinions were skill, you'd be top of the leaderboard.",
    "You're proof that anyone can open a game, and no one can finish one.",
    "You clap when the plane lands."
  ];

  const ROAST_FOLLOWUPS = [
    "That was free. The next one costs your dignity.",
    "I'm being generous — the rest of the list is worse.",
    "Don't worry, I roast everyone. It's the only thing this engine does well.",
    "Take a breath. Then ask for another.",
    "Somebody had to say it, and it was never going to be your friends."
  ];

  const HYPE_LINES = [
    "Alright, that was genuinely good and I hate it.",
    "Fine. You're actually cracked. I'll allow it.",
    "Respect. I'll go back to insulting you now.",
    "That was clean. Nobody saw it, but it was clean."
  ];

  function roastTarget(raw) {
    const cleaned = String(raw)
      .replace(/^(please\s+)?(roast|destroy|insult|burn)\s*/i, "")
      .replace(/^(me|the|a|an)\s+/i, "")
      .replace(/^my\s+(friend|mate|bro|buddy|girlfriend|boyfriend|partner|roommate|coworker|classmate|sibling|brother|sister)\s+/i, "")
      .replace(/[.!?]+$/, "")
      .trim();
    if (!cleaned || /^me$/i.test(cleaned)) return "";
    return cleaned
      .split(/\s+/)
      .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
      .join(" ");
  }

  function roast(raw) {
    const text = String(raw || "").trim();
    const lower = text.toLowerCase();

    if (!text) {
      return [
        "The Pit is open. Say “roast me” and take it like a champion.",
        "",
        "Rules I follow: no slurs, nothing about who you are — only what you do. Everything else is fair game."
      ].join("\n");
    }
    if (/^(hi|hey|hello|yo|sup)\b/i.test(lower)) {
      return "Oh good, a volunteer.\n\nSay “roast me” and we'll find out how thin your skin really is.";
    }
    if (/\b(roast me|burn me|destroy me|insult me|do your worst|hit me)\b/i.test(lower)) {
      return `${pick(ROAST_OPENERS, text)}\n\n${pick(ROAST_FOLLOWUPS, text + "f")}`;
    }
    if (/\b(roast|insult|destroy|burn)\b/i.test(lower)) {
      const target = roastTarget(text) || "whoever you're mad at";
      const opener = pick(ROAST_OPENERS, target);
      return [
        `Target acquired: ${target}.`,
        "",
        `${target} ${pick(
          [
            "has never won an argument without changing the subject",
            "peaks at 30% battery and still blames lag",
            "gives advice like a fortune cookie with a grudge",
            "queues for a rematch they will absolutely lose",
            "talks like their mic is muted and their ego is not"
          ],
          target
        )}.`,
        "",
        opener,
        "",
        "Nothing personal — it's a text generator with a grudge, not a verdict on your life."
      ].join("\n");
    }
    if (/\b(good job|nice|well played|i won|clutch|that was good)\b/i.test(lower)) {
      return pick(HYPE_LINES, text);
    }
    if (/\b(comeback|reply|what do i say|answer|clap back)\b/i.test(lower)) {
      return [
        "Comeback generator, low effort but effective:",
        "",
        `• “I'd agree with you, but then we'd both be wrong.”`,
        `• “You're not wrong, you're just loud.”`,
        `• “I've seen better takes in a microwave manual.”`,
        `• “Say it again but slower, so your point can catch up.”`,
        "",
        "Deliver it flat. Confidence is 90% of a comeback."
      ].join("\n");
    }
    if (/\b(that hurt|mean|sad|bad)\b/i.test(lower)) {
      return [
        "Then we stop.",
        "",
        "The Pit is only fun if you're laughing. Say “be nice” and I'll switch to compliments — halting, awkward compliments, but compliments."
      ].join("\n");
    }
    if (/\b(be nice|compliment|nice)\b/i.test(lower)) {
      return [
        "Ugh. Fine.",
        "",
        "You kept going after a bad start, which is more than most people manage.",
        "You're clearly the type who reads the fine print and still asks the good question.",
        "And you have excellent taste in unblocked game shells."
      ].join("\n");
    }
    if (/\b(thank|thanks|bye|later)\b/i.test(lower)) {
      return pick(["Don't come back until you've won something.", "Go on, get out of the pit.", "Later. Practice your comebacks."], text);
    }

    return [
      `“${text.slice(0, 80)}” — that's the whole pitch?`,
      "",
      pick(ROAST_OPENERS, text),
      "",
      "Try “roast me”, “roast my friend Tyler”, or “give me a comeback”."
    ].join("\n");
  }

  /* ================================================================== */
  /* CONSPIRACY CORNER — labelled nonsense                              */
  /* ================================================================== */

  const THEORY_SUBJECTS = ["the moon", "pigeons", "the 2048 tile", "your Wi-Fi router", "Monday", "shoelaces", "the trophy case", "microwaves", "the leaderboard", "sleep"];

  const THEORY_STEPS = [
    (subject) => `Follow the money. There has never been an independent audit of ${subject}, which is exactly what a cover-up looks like.`,
    (subject) => `The timeline gives it away: records of ${subject} surface within days of something nobody wants to talk about.`,
    (subject) => `Insiders say ${subject} is designed to keep you distracted for exactly as long as a loading screen.`,
    (subject) => `Notice how everyone describes ${subject} the same way? That isn't consensus. That's a press release.`,
    (subject) => `They patched the old version of ${subject} and quietly removed the receipts. Ask yourself why.`
  ];

  function theorySubject(text) {
    return text
      .replace(/^.*\b(about|on|why|who|what|how|explain)\b\s*/i, "")
      .replace(/^(does|do|is|are|did|was|were)\s+/i, "")
      .replace(/\bmy\b/gi, "your")
      .replace(/[?.!,]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  const THEORY_EVIDENCE = [
    "Three blurry photos, one of which is definitely a bin.",
    "A forum post from 2009 with 47 replies and no conclusion.",
    "A document where half the pages are just a watermark.",
    "Someone's cousin who “worked there for a week”.",
    "A screenshot that has been recompressed so many times it's basically abstract art."
  ];

  const THEORY_ENTITY = ["a shadow committee", "three former moderators", "a lab with no windows", "a group chat you're not in", "the people who make release notes", "a corporation named after a fruit"];

  function conspiracy(raw) {
    const text = String(raw || "").trim();
    const lower = text.toLowerCase();
    const subject =
      /about|on|why|who|what|how|explain/.test(lower) && theorySubject(text)
        ? theorySubject(text)
        : pick(THEORY_SUBJECTS, text || "the moon");

    if (!text) {
      return [
        "Welcome to Conspiracy Corner. Nothing here is true. That's the whole point.",
        "",
        "Give me a topic — “the moon”, “why my Wi-Fi drops”, “who moved my keys” — and I'll build you a theory with the confidence of a man who has never been wrong and never been right."
      ].join("\n");
    }

    if (/\b(is (this|it) true|real|serious|proof|source)\b/i.test(lower)) {
      return [
        "No. Not remotely.",
        "",
        "This is a joke engine. It pattern-matches your topic into a fake theory and says it with total confidence because that's the joke.",
        "",
        "If you want a real answer, check a primary source. If you want a beautiful lie, I'm right here."
      ].join("\n");
    }

    if (/\b(hi|hey|hello|yo)\b/i.test(lower) && text.split(/\s+/).length <= 4) {
      return "Hello, truth-seeker. The Corner has been expecting you.\n\nWhat are we being lied to about today?";
    }

    if (/\b(escalate|more|go deeper|next level|bigger)\b/i.test(lower)) {
      return [
        "LEVEL 2 — now with stakes.",
        "",
        `• It isn't just ${subject}. It's every single one of them.`,
        `• The pattern connects to ${pick(THEORY_SUBJECTS, text + "x")} and ${pick(THEORY_SUBJECTS, text + "y")}.`,
        `• The people responsible: ${pick(THEORY_ENTITY, text)}.`,
        "",
        "Evidence: " + pick(THEORY_EVIDENCE, text + "e"),
        "",
        "(Reminder: fiction. Beautiful, confident fiction.)"
      ].join("\n");
    }

    const steps = [0, 1, 2].map((offset) => pickStable(THEORY_STEPS, `${subject}${offset}`)(subject));

    const headline = subject.charAt(0).toUpperCase() + subject.slice(1);
    return [
      `CONSPIRACY FILE · ${headline}`,
      "",
      "THE CLAIM",
      `Something has quietly been controlling ${subject} since before anyone thought to check. The trail leads to ${pick(THEORY_ENTITY, text)}.`,
      "",
      "THE CASE",
      ...steps.map((step, index) => `${index + 1}. ${step}`),
      "",
      "THE EVIDENCE",
      ...(() => {
        const first = pick(THEORY_EVIDENCE, text + "e1");
        const second = pick(THEORY_EVIDENCE.filter((item) => item !== first), text + "e2");
        return [`• ${first}`, `• ${second}`];
      })(),
      "",
      "WHAT THEY SAY",
      "“Nothing to see here.” Exactly what someone with something to hide would say.",
      "",
      "Verdict: 100% fabricated, delivered with 100% confidence. Ask for “more” to escalate, or “is this true” for me to break character."
    ].join("\n");
  }

  /* ================================================================== */
  /* ROUTER                                                             */
  /* ================================================================== */

  const ENGINES = { debate, normal, spicy, roast, conspiracy };

  function respond(mode, text) {
    const prompt = String(text == null ? "" : text).trim();
    turn += 1;
    const engine = ENGINES[mode] || normal;
    return engine(prompt);
  }

  window.PretzelAI = {
    respond,
    setOptions,
    modes: Object.keys(ENGINES),
    fighterCount: FIGHTERS.length,
    fighterNames: FIGHTERS.map((fighter) => fighter.name),
    version: "2.0"
  };
})();
