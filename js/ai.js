/* =====================================================================
   Pretzel AI — local persona engines (Phase 3)
   Three deterministic, offline engines with no network calls and no keys:
     · Anime Debate Matrix  — fighter stat sheet + matchup resolution
     · Academic Assistant   — outlines, study plans, note extraction
     · Pretzel Chef         — casual snack/gaming banter with puns
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

  const pick = (options, seed) => options[hash(seed) % options.length];
  const has = (fighter, tag) => fighter.tags.includes(tag);

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

  const FIGHTERS = [
    {
      name: "Goku",
      aliases: ["son goku", "kakarot"],
      series: "Dragon Ball",
      tier: "S+",
      speed: 95,
      speedTier: "S",
      stats: { strength: 97, durability: 94, ap: 96, hax: 58 },
      tags: ["energy", "speed_amp", "precognition", "regeneration"],
      note: "Form stacking, instant transmission and ultra-instinct dodging."
    },
    {
      name: "Saitama",
      aliases: ["caped baldy", "one punch man"],
      series: "One Punch Man",
      tier: "S+",
      speed: 93,
      speedTier: "S",
      stats: { strength: 99, durability: 98, ap: 90, hax: 18 },
      tags: ["durability_negation"],
      note: "No established ceiling — force lands as a one-shot gag."
    },
    {
      name: "Naruto",
      aliases: ["naruto uzumaki"],
      series: "Naruto",
      tier: "A",
      speed: 88,
      speedTier: "A",
      stats: { strength: 86, durability: 88, ap: 88, hax: 66 },
      tags: ["energy", "summon", "regeneration", "speed_amp"],
      note: "Shadow-clone attrition, sage mode and tailed-beast chakra."
    },
    {
      name: "Sasuke",
      aliases: ["sasuke uchiha"],
      series: "Naruto",
      tier: "A",
      speed: 90,
      speedTier: "A",
      stats: { strength: 84, durability: 82, ap: 88, hax: 72 },
      tags: ["energy", "precognition", "mind_control"],
      note: "Sharingan foresight, genjutsu and space-time swaps."
    },
    {
      name: "Luffy",
      aliases: ["monkey d luffy"],
      series: "One Piece",
      tier: "A",
      speed: 86,
      speedTier: "A",
      stats: { strength: 90, durability: 92, ap: 86, hax: 54 },
      tags: ["resistance_blunt", "speed_amp"],
      note: "Rubber body eats blunt force; gears push speed and output."
    },
    {
      name: "Ichigo",
      aliases: ["ichigo kurosaki"],
      series: "Bleach",
      tier: "A",
      speed: 89,
      speedTier: "A",
      stats: { strength: 90, durability: 85, ap: 90, hax: 64 },
      tags: ["energy", "speed_amp"],
      note: "Bankai compression and ranged getsuga pressure."
    },
    {
      name: "Gojo",
      aliases: ["satoru gojo"],
      series: "Jujutsu Kaisen",
      tier: "S",
      speed: 88,
      speedTier: "A",
      stats: { strength: 76, durability: 86, ap: 82, hax: 96 },
      tags: ["reality_warp", "domain", "nullification"],
      note: "Infinity, Limitless and Unlimited Void."
    },
    {
      name: "Sukuna",
      aliases: ["ryomen sukuna"],
      series: "Jujutsu Kaisen",
      tier: "S",
      speed: 89,
      speedTier: "A",
      stats: { strength: 88, durability: 88, ap: 92, hax: 86 },
      tags: ["domain", "durability_negation", "regeneration"],
      note: "Cleave and Dismantle cut through conventional defenses."
    },
    {
      name: "Madara",
      aliases: ["madara uchiha"],
      series: "Naruto",
      tier: "S",
      speed: 82,
      speedTier: "B",
      stats: { strength: 86, durability: 88, ap: 90, hax: 84 },
      tags: ["domain", "summon", "energy"],
      note: "Perfect Susanoo, meteors and battlefield-scale control."
    },
    {
      name: "Itachi",
      aliases: ["itachi uchiha"],
      series: "Naruto",
      tier: "A",
      speed: 84,
      speedTier: "B",
      stats: { strength: 76, durability: 78, ap: 82, hax: 86 },
      tags: ["mind_control", "domain", "precognition"],
      note: "Tsukuyomi, genjutsu layering and amaterasu."
    },
    {
      name: "Jotaro",
      aliases: ["jotaro kujo", "jojo"],
      series: "JoJo",
      tier: "A",
      speed: 84,
      speedTier: "B",
      stats: { strength: 82, durability: 80, ap: 84, hax: 88 },
      tags: ["timestop", "precognition"],
      note: "Star Platinum precision plus stopped time."
    },
    {
      name: "Dio",
      aliases: ["dio brando"],
      series: "JoJo",
      tier: "A",
      speed: 83,
      speedTier: "B",
      stats: { strength: 84, durability: 78, ap: 82, hax: 90 },
      tags: ["timestop", "regeneration", "immortality"],
      note: "Vampire regeneration and The World."
    },
    {
      name: "Alucard",
      aliases: ["alucard hellsing"],
      series: "Hellsing",
      tier: "S",
      speed: 80,
      speedTier: "B",
      stats: { strength: 88, durability: 96, ap: 86, hax: 88 },
      tags: ["immortality", "regeneration", "summon"],
      note: "A stockpile of souls that keeps him standing."
    },
    {
      name: "Ainz",
      aliases: ["ainz ooal gown", "momonga"],
      series: "Overlord",
      tier: "S",
      speed: 76,
      speedTier: "C",
      stats: { strength: 78, durability: 88, ap: 88, hax: 94 },
      tags: ["timestop", "mind_control", "summon", "durability_negation"],
      note: "Time stop into instant-death confirms."
    },
    {
      name: "Meliodas",
      aliases: ["meliodas sins"],
      series: "Seven Deadly Sins",
      tier: "A",
      speed: 86,
      speedTier: "A",
      stats: { strength: 88, durability: 90, ap: 88, hax: 72 },
      tags: ["regeneration", "energy", "speed_amp"],
      note: "Full Counter turns output back on the sender."
    },
    {
      name: "Rimuru",
      aliases: ["rimuru tempest", "slime"],
      series: "That Time I Got Reincarnated as a Slime",
      tier: "S+",
      speed: 86,
      speedTier: "A",
      stats: { strength: 82, durability: 94, ap: 86, hax: 98 },
      tags: ["reality_warp", "adaptation", "nullification", "immortality"],
      note: "Predator, Great Sage and adaptation on contact."
    },
    {
      name: "Mob",
      aliases: ["shigeo kageyama", "mob psycho"],
      series: "Mob Psycho 100",
      tier: "S",
      speed: 82,
      speedTier: "B",
      stats: { strength: 74, durability: 84, ap: 92, hax: 92 },
      tags: ["reality_warp", "energy", "adaptation"],
      note: "???% output rewrites the battlefield."
    },
    {
      name: "Meruem",
      aliases: ["meruem chimera ant"],
      series: "Hunter x Hunter",
      tier: "S",
      speed: 90,
      speedTier: "A",
      stats: { strength: 94, durability: 96, ap: 88, hax: 58 },
      tags: ["resistance_blunt", "adaptation", "speed_amp"],
      note: "Aura shell plus rapid in-fight adaptation."
    },
    {
      name: "Kenshiro",
      aliases: ["kenshiro hokuto"],
      series: "Fist of the North Star",
      tier: "S",
      speed: 82,
      speedTier: "B",
      stats: { strength: 92, durability: 88, ap: 90, hax: 84 },
      tags: ["durability_negation", "precognition"],
      note: "Pressure points end fights on contact."
    }
  ];

  function findFighter(raw) {
    const clean = String(raw)
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!clean) return null;

    const exact = FIGHTERS.find(
      (fighter) => fighter.name.toLowerCase() === clean || fighter.aliases.some((alias) => alias === clean)
    );
    if (exact) return exact;

    const contains = FIGHTERS.find(
      (fighter) =>
        clean.includes(fighter.name.toLowerCase()) ||
        fighter.aliases.some((alias) => clean.includes(alias))
    );
    if (contains) return contains;

    const word = clean.split(" ").pop();
    if (word.length >= 4) {
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
    "timestop"
  ];

  function displayName(raw) {
    return String(raw)
      .replace(/^(who\s+(wins|would\s+win)[,:]?\s+|is\s+)/i, "")
      .replace(/\s+(who\s+wins?)$/i, "")
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
      hax: band(22, 88, 15)
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
      aliases: [],
      series: "Scouted · unranked",
      tier,
      speed,
      speedTier,
      stats,
      tags,
      note: "Scout estimate from a local heuristic — no curated sheet on file.",
      estimated: true
    };
  }

  function sideBonus(me, foe) {
    let delta = 0;
    if (has(me, "timestop") && !has(foe, "timestop")) delta += has(foe, "precognition") ? 6 : 16;
    if (has(me, "reality_warp") && !has(foe, "reality_warp") && !has(foe, "nullification")) delta += 14;
    if (has(me, "durability_negation")) {
      if (has(foe, "regeneration")) delta += 10;
      if (foe.stats.durability >= 90) delta += 6;
    }
    if (has(me, "mind_control")) delta += has(foe, "precognition") ? -6 : 8;
    if (has(me, "immortality") && !has(foe, "durability_negation")) delta += 8;
    if (has(me, "domain") && !has(foe, "domain") && !has(foe, "nullification")) delta += 10;
    if (has(me, "nullification") && (has(foe, "reality_warp") || has(foe, "domain") || has(foe, "energy"))) {
      delta += 8;
    }
    if (has(me, "adaptation") && has(foe, "energy")) delta += 6;
    if (has(me, "resistance_blunt") && !has(foe, "energy") && !has(foe, "durability_negation")) delta += 5;
    return delta;
  }

  function matchNotes(a, b) {
    const notes = [];
    if (has(a, "timestop") && has(b, "timestop")) {
      notes.push("Both can stop time, so the clash cancels into a raw stat check.");
    } else if (has(a, "timestop") && !has(b, "precognition")) {
      notes.push(`${b.name} has no answer to stopped time.`);
    } else if (has(b, "timestop") && !has(a, "precognition")) {
      notes.push(`${a.name} has no answer to stopped time.`);
    }
    if (has(a, "durability_negation") && has(b, "regeneration")) {
      notes.push(`${a.name}'s negation bypasses ${b.name}'s regeneration.`);
    } else if (has(b, "durability_negation") && has(a, "regeneration")) {
      notes.push(`${b.name}'s negation bypasses ${a.name}'s regeneration.`);
    }
    if (has(a, "reality_warp") && !has(b, "reality_warp") && !has(b, "nullification")) {
      notes.push(`${a.name}'s reality warping goes unanswered.`);
    } else if (has(b, "reality_warp") && !has(a, "reality_warp") && !has(a, "nullification")) {
      notes.push(`${b.name}'s reality warping goes unanswered.`);
    }
    if (has(b, "mind_control") && !has(a, "precognition")) {
      notes.push(`${b.name} can land a mental opener if there is an opening.`);
    }
    if (has(a, "immortality") && !has(b, "durability_negation")) {
      notes.push(`${a.name}'s immortality forces ${b.name} to find a non-lethal win.`);
    }
    return notes.slice(0, 3);
  }

  function sameTierRivals(fighter) {
    const rivals = FIGHTERS.filter((other) => other !== fighter);
    const tierMates = rivals.filter((other) => other.tier === fighter.tier);
    return tierMates.length ? tierMates : rivals;
  }

  function statCard(fighter) {
    const stats = [
      ["Strength", fighter.stats.strength],
      ["Durability", fighter.stats.durability],
      ["Attack power", fighter.stats.ap],
      ["Hax", fighter.stats.hax],
      ["Speed", fighter.speed]
    ];
    const bars = stats.map(
      ([label, value]) => `${label.padEnd(13, " ")}${String(value).padStart(3, " ")}  ${"█".repeat(Math.round(value / 10))}`
    );

    return [
      `${fighter.estimated ? "SCOUT CARD" : "FIGHTER CARD"} · ${fighter.name}`,
      `${fighter.series} · tier ${fighter.tier} · speed tier ${fighter.speedTier} (${tierName(fighter.speedTier)})`,
      ...(fighter.estimated ? ["Estimated sheet — curated data is not on file for this name.", ""] : []),
      "",
      ...bars,
      "",
      `Tags: ${fighter.tags.map((tag) => tag.replace(/_/g, " ")).join(", ")}`,
      `Read: ${fighter.note}`,
      "",
      `Try: ${fighter.name} vs ${pick(sameTierRivals(fighter), fighter.name).name}`
    ].join("\n");
  }

  function analyzeMatch(a, b) {
    if (a === b || a.name.toLowerCase() === b.name.toLowerCase()) {
      return [
        `MATCHUP · ${a.name} vs ${a.name}`,
        "",
        "Identical fighters, identical tags — every exchange mirrors and nothing breaks the tie.",
        "",
        "VERDICT",
        "Mirror match. Call it a draw unless one side gets a ruleset advantage."
      ].join("\n");
    }

    const statsA = (a.stats.strength + a.stats.durability + a.stats.ap) / 3;
    const statsB = (b.stats.strength + b.stats.durability + b.stats.ap) / 3;
    const haxA = clamp(a.stats.hax + sideBonus(a, b), 5, 100);
    const haxB = clamp(b.stats.hax + sideBonus(b, a), 5, 100);
    const gap = speedRank(a.speedTier) - speedRank(b.speedTier);
    const speedA = a.speed + gap * 5;
    const speedB = b.speed - gap * 5;

    const estimated = Boolean(a.estimated || b.estimated);
    const weights = OPTIONS.weights;
    const scoreA = weights.stats * statsA + weights.hax * haxA + weights.speed * speedA;
    const scoreB = weights.stats * statsB + weights.hax * haxB + weights.speed * speedB;
    const diff = scoreA - scoreB;
    const aWins = diff >= 0;
    const winner = aWins ? a : b;
    const loser = aWins ? b : a;
    const winnerShare = Math.round(clamp(0.5 + Math.abs(diff) / 70, 0.5, 0.97) * 100);
    const loserShare = 100 - winnerShare;

    const edgeLines = [
      `• Strength — ${a.stats.strength} vs ${b.stats.strength} → ${a.stats.strength === b.stats.strength ? "even" : a.stats.strength > b.stats.strength ? a.name : b.name}`,
      `• Durability — ${a.stats.durability} vs ${b.stats.durability} → ${a.stats.durability === b.stats.durability ? "even" : a.stats.durability > b.stats.durability ? a.name : b.name}`,
      `• Attack power — ${a.stats.ap} vs ${b.stats.ap} → ${a.stats.ap === b.stats.ap ? "even" : a.stats.ap > b.stats.ap ? a.name : b.name}`,
      `• Hax — ${Math.round(haxA)} vs ${Math.round(haxB)} → ${haxA === haxB ? "even" : haxA > haxB ? a.name : b.name}`,
      `• Speed tier — ${a.speedTier} (${tierName(a.speedTier)}) vs ${b.speedTier} (${tierName(b.speedTier)}) → ${gap === 0 ? "even" : gap > 0 ? a.name : b.name}`
    ];

    const notes = matchNotes(a, b);
    if (Math.abs(gap) >= 2) {
      notes.unshift(`${gap > 0 ? a.name : b.name} is a full tier faster — that is a blitz window, not just an edge.`);
    }

    let verdict;
    const lead = winnerShare - 50;
    if (lead >= 12) verdict = `${winner.name} takes it clearly, ${winnerShare}–${loserShare}.`;
    else if (lead >= 6) verdict = `${winner.name} wins with a solid edge, ${winnerShare}–${loserShare}.`;
    else if (lead >= 2) verdict = `${winner.name} edges it, ${winnerShare}–${loserShare}.`;
    else verdict = `Too close to call — ${winnerShare}–${loserShare} sits inside the margin of error.`;

    const loserStats = aWins ? statsB : statsA;
    const winnerStats = aWins ? statsA : statsB;
    const loserHax = aWins ? haxB : haxA;
    const winnerHax = aWins ? haxA : haxB;

    let route;
    if (has(loser, "timestop") && !has(winner, "timestop")) {
      route = `${loser.name} needs to land the time stop before ${winner.name} closes the gap.`;
    } else if (has(winner, "timestop") && !has(loser, "precognition")) {
      route = `${loser.name} has to survive the first stopped-time exchange — few do.`;
    } else if (loserStats > winnerStats - 2 && winnerHax > loserHax + 10) {
      route = `${loser.name} wins the raw exchanges — the route is denying ${winner.name}'s abilities long enough to land one.`;
    } else if (loser.speed > winner.speed + 2) {
      route = `${loser.name}'s route is pace: keep it at range and never trade clean.`;
    } else if (loserHax > winnerHax) {
      route = `${loser.name} has to win it on abilities, not on a straight exchange.`;
    } else {
      route = `${loser.name} needs to outlast and force a mistake — the stat sheet does not favor them.`;
    }

    const header = [
      `MATCHUP · ${a.name} vs ${b.name}`,
      estimated
        ? "Scout estimate in play — an unranked name was modelled locally."
        : "Standard ruleset · no outside help · in-character"
    ];

    if (OPTIONS.detail === "concise") {
      return [...header, "", "VERDICT", verdict, route, "", "Local model · subjective ratings · canon varies by arc."].join("\n");
    }

    const lines = [...header, "", "STAT SHEET", ...edgeLines];
    if (notes.length) lines.push("", "EXCHANGES", ...notes.map((note) => `• ${note}`));
    lines.push("", "VERDICT", verdict, route, "", "Local model · subjective ratings · canon varies by arc.");
    return lines.join("\n");
  }

  function debateHelp(input) {
    const clean = input.toLowerCase().trim();
    const matches = clean.length < 2
      ? []
      : FIGHTERS.filter(
      (fighter) =>
        fighter.name.toLowerCase().includes(clean) ||
        fighter.aliases.some((alias) => alias.includes(clean)) ||
        fighter.series.toLowerCase().includes(clean)
    );

    if (matches.length) {
      return [
        `I know ${matches.length === 1 ? "one fighter" : `${matches.length} fighters`} matching "${input}":`,
        "",
        ...matches.map((fighter) => `• ${fighter.name} — ${fighter.series} (tier ${fighter.tier})`),
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
      "• Rimuru vs Ainz",
      "",
      `Curated sheets: ${FIGHTERS.length} fighters — Dragon Ball, One Piece, Naruto, Bleach, JJK, JoJo, Chainsaw Man, Overlord, Frieren and more.`,
      "Any other name still works: I scout it from the name itself and flag the card as an estimate.",
      "Name one fighter on its own to pull the full stat card."
    ].join("\n");
  }

  function debate(raw) {
    const text = raw
      .replace(/^\s*(?:so\s+)?(?:who(?:'s| is)?\s+(?:would\s+)?(?:wins|win|stronger)|who\s+wins?)\s*[,:]?\s*/i, "")
      .replace(/[?!]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const parts = text.split(/\s+(?:vs\.?|versus|v|or|against)\s+/i);

    if (parts.length >= 2) {
      const a = findFighter(parts[0]);
      const b = findFighter(parts.slice(1).join(" "));
      if (a && b) return analyzeMatch(a, b);

      /* Only very short fragments end up here — every full name is scouted. */
      const stub = (a ? parts.slice(1).join(" ") : parts[0]).trim();
      return [
        `"${stub}" is too short to read as a name.`,
        "",
        "Give me at least two letters on each side of the “vs”: “Gojo vs Makima”, “Baki vs Ohma”, whatever you like."
      ].join("\n");
    }

    const single = findFighter(text);
    if (single) return statCard(single);
    return debateHelp(text);
  }

  /* ================================================================== */
  /* ACADEMIC ASSISTANT                                                 */
  /* ================================================================== */

  const STOP_WORDS = new Set(
    "the a an and or but if then than that this these those of in on at to for from with without by as is are was were be been being it its into over under about after before between during through because so not no nor can could should would will just also more most some such only own same very too do does did doing have has had having i you he she they we me my your their our them us who whom which what when where why how".split(
      " "
    )
  );

  function keywords(text, limit) {
    const counts = new Map();
    text
      .toLowerCase()
      .replace(/[^a-z0-9' -]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3 && !STOP_WORDS.has(word))
      .forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit);
  }

  function titleCase(text) {
    return text
      .split(" ")
      .map((word, index) => (index === 0 || word.length > 3 ? word[0].toUpperCase() + word.slice(1) : word))
      .join(" ");
  }

  function cleanTopic(raw) {
    const topic = raw
      .replace(/^(please\s+)?(can you\s+)?(help me\s+)?(give me\s+)?(an?\s+)?/i, "")
      .replace(/^(outline|essay|paper|draft|write|study plan|study guide|revision plan|revise|notes|summarize|summary|compare|contrast)\b\s*(for|on|about|of)?\s*/i, "")
      .replace(/\s+/g, " ")
      .replace(/[.?!]+$/, "")
      .replace(/^(a|an|the)\s+/i, "")
      .trim();
    return topic || "your topic";
  }

  function outline(topic) {
    const subject = titleCase(topic);
    return [
      `OUTLINE · ${subject}`,
      "Scaffold only — swap in your own sources and verify every claim.",
      "",
      "THESIS",
      `${subject} matters because it changes how we read the evidence around it; this paper argues that the strongest explanation is the one that survives the counterargument below.`,
      "",
      `1 · FRAMING`,
      `• Define ${topic} precisely and mark what it does not cover`,
      "• Set the timeline or scope so the reader knows the boundaries",
      "• State the question the paper actually answers",
      "",
      "2 · MECHANISM",
      `• Explain how ${topic} works, step by step`,
      "• Name the moving parts and who controls them",
      "• Signal where the evidence is thin",
      "",
      "3 · EVIDENCE",
      "• Primary source or first-hand data",
      "• A competing interpretation you can test against it",
      "• One limitation the reader should hold in mind",
      "",
      "4 · COUNTERARGUMENT",
      `• Strongest objection to your reading of ${topic}`,
      "• Why it fails — or what it forces you to concede",
      "",
      "5 · SO WHAT",
      "• The consequence if your thesis holds",
      "• The next question worth asking",
      "",
      "NEXT MOVE",
      "Draft section 2 first. It is the one a marker will probe hardest."
    ].join("\n");
  }

  function studyPlan(topic) {
    const subject = titleCase(topic);
    return [
      `STUDY PLAN · ${subject}`,
      "Five sessions, 45 minutes each, spaced at least one day apart.",
      "",
      "1 · SURVEY (45 min)",
      `• Skim every source on ${topic} once, no notes`,
      "• Write down the three things you could not explain",
      "",
      "2 · BUILD (45 min)",
      "• Turn each gap into a question",
      "• Answer them from the source, not from memory",
      "",
      "3 · RECALL (45 min)",
      "• Close the material and write what you remember",
      "• Check against the source and fix only the errors",
      "",
      "4 · APPLY (45 min)",
      "• Work two problems or write one paragraph from scratch",
      "• Explain the idea out loud in under a minute",
      "",
      "5 · TEST (45 min)",
      "• Mixed questions, no notes, timed",
      "• Re-test the misses two days later",
      "",
      "RETRIEVAL PROMPTS",
      `• What is the core claim behind ${topic}?`,
      `• Where does ${topic} break down?`,
      "• What would a skeptic say first?"
    ].join("\n");
  }

  function notesFrom(text) {
    const words = text.trim().split(/\s+/);
    if (words.length < 30) {
      return [
        "Paste at least a paragraph and I'll pull the structure out of it.",
        "",
        "I do not invent facts — with a longer passage I can list key terms, build retrieval questions and give you a summary template to fill from the text."
      ].join("\n");
    }

    const terms = keywords(text, 8);
    return [
      `NOTE PASS · ${words.length} words · ${terms.length} key terms`,
      "",
      "KEY TERMS",
      ...terms.map(([word, count]) => `• ${word}${count > 1 ? ` (×${count})` : ""}`),
      "",
      "RETRIEVAL QUESTIONS",
      "• What claim does the passage make first, and what supports it?",
      `• How does “${terms[0] ? terms[0][0] : "the main term"}” connect to the conclusion?`,
      "• Which sentence would you cut, and what breaks if you do?",
      "",
      "SUMMARY TEMPLATE",
      "The passage argues that ___ because ___. It concedes ___, but claims ___ still holds.",
      "",
      "Fill the blanks from the text — I do not generate claims about your source."
    ].join("\n");
  }

  function compareTopics(raw) {
    const parts = raw.split(/\s+(?:vs\.?|versus|and|,)\s+/i).map((part) => cleanTopic(part)).filter(Boolean);
    const a = titleCase(parts[0] || "topic A");
    const b = titleCase(parts[1] || "topic B");
    return [
      `COMPARISON FRAMEWORK · ${a} vs ${b}`,
      "Same criteria on both sides, or the comparison is decoration.",
      "",
      "CRITERIA",
      `1 · Definition — what ${a} and ${b} each mean, and where they overlap`,
      "2 · Cause — what produces each one",
      "3 · Mechanism — how each works in practice",
      "4 · Effects — who is affected, how quickly, how visibly",
      "5 · Limits — where each one stops being useful",
      "",
      "STRUCTURE",
      "• Paragraph 1: the overlap — why these two are compared at all",
      `• Paragraph 2: ${a} on criteria 1–3`,
      `• Paragraph 3: ${b} on the same criteria`,
      "• Paragraph 4: where the analogy breaks",
      "",
      "CHECK",
      "If a criterion only appears on one side, delete it or apply it evenly."
    ].join("\n");
  }

  function academic(raw) {
    const text = raw.trim();
    if (!text) return "Give me a topic plus a task: outline, study plan, notes or compare.";

    if (/^(summar|notes\b|note pass|extract|key points)/i.test(text) || text.split(/\s+/).length > 90) {
      const body = text.replace(/^(summar\w*|notes?|extract|key points)\b[:\s]*/i, "");
      return notesFrom(body);
    }
    if (/(study plan|revision|revise|schedule|exam|cram)/i.test(text)) {
      return studyPlan(cleanTopic(text));
    }
    if (/(compare|contrast|versus|\bvs\b)/i.test(text)) {
      return compareTopics(text.replace(/^(compare|contrast)\s*/i, ""));
    }
    if (/(outline|essay|paper|draft|paragraph|write|structure)/i.test(text)) {
      return outline(cleanTopic(text));
    }
    return outline(cleanTopic(text));
  }

  /* ================================================================== */
  /* PRETZEL CHEF                                                       */
  /* ================================================================== */

  const PUNS = [
    "I tried to untangle my headphones and ended up in a knot — very on brand for me.",
    "My cardio is just twisting myself into shape.",
    "I'm not salty, I'm just well seasoned.",
    "Some people fold under pressure. I fold on purpose.",
    "I've got a lot of crust for someone this soft.",
    "Dough not disturb — mid respawn.",
    "I rise to the occasion. It's basically my whole thing.",
    "You could say I have a twisted sense of humor.",
    "I'm gluten for punishment, honestly.",
    "Pretzel logic: if it's still warm, it counts as a balanced meal."
  ];

  const SNACKS = [
    {
      name: "60-second pretzel bites",
      steps: [
        "Tear two pretzels into rough chunks",
        "Hit them with a splash of water, microwave 20 seconds",
        "Add cheese or butter while hot"
      ]
    },
    {
      name: "gamer trail mix",
      steps: [
        "Pretzels, peanuts, whatever chocolate is nearby",
        "One handful per queue — not the whole bowl",
        "Water on the desk, not just caffeine"
      ]
    },
    {
      name: "loaded pretzel plate",
      steps: [
        "Pretzels flat on a plate",
        "Cheese + hot sauce, 25 seconds in the microwave",
        "Eat before the next match, not during"
      ]
    },
    {
      name: "late-night carb stack",
      steps: [
        "Toast a bagel or bread",
        "Butter, salt, done",
        "Eat it away from the keyboard, trust me"
      ]
    }
  ];

  function chef(raw) {
    const text = raw.trim();
    const lower = text.toLowerCase();
    if (!text) return "Kitchen's open. Ask me about snacks, a rough match, or just say hi.";

    if (/^(hi|hey|yo|sup|hello|what'?s up|wassup)\b/.test(lower)) {
      return [
        "Yo. Pretzel Chef, reporting for snack duty.",
        "",
        "I do three things: quick food, morale after a rough queue, and puns. Pick your poison."
      ].join("\n");
    }

    if (/(pun|joke|funny|make me laugh)/.test(lower)) {
      return `${pick(PUNS, text)}\n\nThat's the good stuff. No refunds.`;
    }

    if (/(snack|food|eat|hungry|recipe|cook|pretzel|cheese|microwave|meal)/.test(lower)) {
      const snack = pick(SNACKS, text);
      return [
        `${snack.name.toUpperCase()} — chef's pick.`,
        "",
        ...snack.steps.map((step, index) => `${index + 1}. ${step}`),
        "",
        pick(PUNS, text + "p"),
        "",
        "Two minutes of prep beats a five-minute death timer. Move."
      ].join("\n");
    }

    if (/(lose|lost|losing|tilt|rank|elo|queue|lag|toxic|team|match|game)/.test(lower)) {
      return [
        "Rough run. Here's the chef's reset:",
        "",
        "1. Stand up, water, ten seconds of staring at something far away",
        "2. One more game max, then a real break",
        "3. Queue again only when you actually want to, not to prove something",
        "",
        "Tilt is just a sauce that ruins the whole dish.",
        "",
        "You'll climb. The pretzel believes in you."
      ].join("\n");
    }

    if (/(thank|thanks|ty|appreciate)/.test(lower)) {
      return "Anytime. Stay salty, stay fed. 🥨";
    }

    if (/(how are you|how's it going|you good)/.test(lower)) {
      return "Warm, salty, slightly twisted — so, the usual. What are we making?";
    }

    return [
      pick(
        [
          "I hear you. Let's turn that into something edible.",
          "Chef's listening — give me a little more to work with.",
          "That's a thought worth a snack break."
        ],
        text
      ),
      "",
      "Try: “quick snack”, “I keep losing”, or “tell me a pun”.",
      "",
      pick(PUNS, text)
    ].join("\n");
  }

  /* ================================================================== */
  /* ROUTER                                                             */
  /* ================================================================== */

  function respond(mode, text) {
    const prompt = String(text == null ? "" : text).trim();
    if (mode === "debate") return debate(prompt);
    if (mode === "academic") return academic(prompt);
    return chef(prompt);
  }

  window.PretzelAI = {
    respond,
    setOptions,
    fighterCount: FIGHTERS.length,
    fighterNames: FIGHTERS.map((fighter) => fighter.name)
  };
})();
