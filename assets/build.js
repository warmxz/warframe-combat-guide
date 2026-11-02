(function () {
  "use strict";

  const data = window.WARFRAME_BUILD_DATA;
  if (!data) return;

  const catLabels = { warframe: "战甲", primary: "主武器", secondary: "副武器", melee: "近战" };
  const polarityMeta = {};
  data.polarities.forEach(function (p) { polarityMeta[p.key] = p; });
  const polarityOrder = ["none"].concat(data.polarities.map(function (p) { return p.key; }));

  const state = {
    category: "warframe",
    itemId: null,
    item: null,
    slots: [],
    slotPolarities: [],
    activeSlot: 0,
    potato: true,
    combo: 3,
    enemyArmor: 500,
    enemyFaction: "grineer",
    statusWindow: 3,
    itemSearch: "",
    modSearch: ""
  };

  const els = {
    categories: document.getElementById("simCategories"),
    itemSearch: document.getElementById("simItemSearch"),
    itemList: document.getElementById("simItemList"),
    itemName: document.getElementById("simItemName"),
    itemMeta: document.getElementById("simItemMeta"),
    potato: document.getElementById("simPotato"),
    sample: document.getElementById("simSample"),
    clear: document.getElementById("simClear"),
    capacityText: document.getElementById("simCapacityText"),
    capacityBar: document.getElementById("simCapacityBar"),
    capacityNote: document.getElementById("simCapacityNote"),
    slots: document.getElementById("simSlots"),
    stats: document.getElementById("simStats"),
    modTitle: document.getElementById("simModTitle"),
    modHint: document.getElementById("simModHint"),
    modSearch: document.getElementById("simModSearch"),
    modList: document.getElementById("simModList"),
    itemCount: document.getElementById("simItemCount"),
    modCount: document.getElementById("simModCount"),
    statusPanel: document.getElementById("simStatusPanel"),
    statusFaction: document.getElementById("simStatusFaction"),
    statusArmor: document.getElementById("simStatusArmor"),
    statusWindow: document.getElementById("simStatusWindow"),
    statusSummary: document.getElementById("simStatusSummary"),
    statusList: document.getElementById("simStatusList")
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function round(n, digits) { const p = Math.pow(10, digits == null ? 1 : digits); return Math.round(n * p) / p; }
  function fmt(n, digits) { return Number.isFinite(n) ? round(n, digits == null ? 1 : digits).toLocaleString("zh-CN") : "—"; }

  function itemsByCategory() { return data.items.filter(function (it) { return it.category === state.category; }); }
  function findItem(id) { return data.items.find(function (it) { return it.id === id; }) || null; }
  function findModById(id) { return data.mods.find(function (m) { return m.id === id; }) || null; }

  function slotCount() {
    if (state.category === "warframe" || state.category === "melee") return 9;
    return 8;
  }

  function isSpecialSlot(index) {
    return index === 8 && (state.category === "warframe" || state.category === "melee");
  }

  function slotLabel(index) {
    if (isSpecialSlot(index)) return state.category === "melee" ? "姿态" : "光环";
    return "槽位 " + (index + 1);
  }

  function initialPolarities(item) {
    const arr = [];
    const count = slotCount();
    for (let i = 0; i < count; i++) arr.push("none");
    (item.polarities || []).slice(0, 8).forEach(function (p, i) { arr[i] = p; });
    if (state.category === "melee" && item.stancePolarity) arr[8] = item.stancePolarity;
    return arr;
  }

  function resetBuild(item) {
    state.item = item;
    state.itemId = item.id;
    state.slots = [];
    for (let i = 0; i < slotCount(); i++) state.slots.push({ modId: null, rank: 0 });
    state.slotPolarities = initialPolarities(item);
    state.activeSlot = 0;
  }

  function polarityLabel(key) {
    if (!key || key === "none") return "无";
    const meta = polarityMeta[key];
    return meta ? meta.label + " " + meta.symbol : key;
  }

  function polaritySymbol(key) {
    if (!key || key === "none") return "—";
    const meta = polarityMeta[key];
    return meta ? meta.symbol : "?";
  }

  function augmentMatch(itemName, compatName) {
    if (!compatName) return false;
    return itemName === compatName || itemName.indexOf(compatName) === 0 || compatName.indexOf(itemName) === 0;
  }

  function primaryCompat(item) {
    if (item.type === "Shotgun") return ["Shotgun", "PRIMARY"];
    if (item.type === "Bow") return ["Bow", "PRIMARY"];
    if (item.type === "Sniper") return ["Sniper", "Rifle", "PRIMARY"];
    return ["Rifle", "Assault Rifle", "Sniper", "PRIMARY"];
  }

  function secondaryCompat(item) {
    if (item.type === "Throwing") return ["Pistol", "Thrown", "SECONDARY"];
    return ["Pistol", "SECONDARY"];
  }

  function modsForSlot(index) {
    if (!state.item) return [];
    if (isSpecialSlot(index)) {
      const cls = state.category === "melee" ? "stance" : "aura";
      return data.mods.filter(function (m) { return m.modClass === cls; });
    }
    if (state.category === "warframe") {
      return data.mods.filter(function (m) {
        if (m.modClass === "warframe") return true;
        if (m.modClass === "augment") return augmentMatch(state.item.name, m.compatName);
        return false;
      });
    }
    if (state.category === "primary") {
      const compat = primaryCompat(state.item);
      return data.mods.filter(function (m) { return m.modClass === "primary" && compat.indexOf(m.compatName) !== -1; });
    }
    if (state.category === "secondary") {
      const compat = secondaryCompat(state.item);
      return data.mods.filter(function (m) { return m.modClass === "secondary" && compat.indexOf(m.compatName) !== -1; });
    }
    return data.mods.filter(function (m) { return m.modClass === "melee"; });
  }

  function modRankData(mod, rank) {
    const levels = mod.levels || [];
    if (!levels.length) return [];
    return levels[clamp(rank, 0, levels.length - 1)] || [];
  }

  function parseModStats(mod, rank) {
    const out = {};
    function add(key, value) { out[key] = (out[key] || 0) + value; }
    modRankData(mod, rank).forEach(function (line) {
      const s = String(line);
      if (/Enemies lose|Squad receives|Status Effects from abilities|applied twice|Health Orb/i.test(s)) return;
      let m;
      if ((m = s.match(/([+-]?\d+(?:\.\d+)?)% Critical Chance stacks with Combo Multiplier/i))) add("critChanceCombo", Number(m[1]));
      else if ((m = s.match(/([+-]?\d+(?:\.\d+)?)% Critical Chance/i))) add("critChance", Number(m[1]));
      else if ((m = s.match(/([+-]?\d+(?:\.\d+)?)% Critical Damage/i))) add("critDamage", Number(m[1]));
      else if ((m = s.match(/([+-]?\d+(?:\.\d+)?)% Status Damage/i))) add("statusDamage", Number(m[1]));
      else if ((m = s.match(/([+-]?\d+(?:\.\d+)?)% Status Duration/i))) add("statusDuration", Number(m[1]));
      else if ((m = s.match(/([+-]?\d+(?:\.\d+)?)% Status Chance|([+-]?\d+(?:\.\d+)?)% Status/i))) add("statusChance", Number(m[1] || m[2]));
      else if ((m = s.match(/([+-]?\d+(?:\.\d+)?)% Multishot/i))) add("multishot", Number(m[1]));
      else if ((m = s.match(/([+-]?\d+(?:\.\d+)?)% (?:Fire Rate|Attack Speed)/i))) add("fireRate", Number(m[1]));
      else if ((m = s.match(/([+-]?\d+(?:\.\d+)?)% Reload Speed/i))) add("reloadSpeed", Number(m[1]));
      else if ((m = s.match(/([+-]?\d+(?:\.\d+)?)% Magazine Capacity/i))) add("magazine", Number(m[1]));
      else if ((m = s.match(/([+-]?\d+(?:\.\d+)?)% (?:Melee )?Damage/i)) && !/Heavy Attack|Damage to /i.test(s)) add("damage", Number(m[1]));
      else if ((m = s.match(/([+-]?\d+(?:\.\d+)?)% Health/i))) add("health", Number(m[1]));
      else if ((m = s.match(/([+-]?\d+(?:\.\d+)?)% Shield Capacity/i))) add("shield", Number(m[1]));
      else if ((m = s.match(/([+-]?\d+(?:\.\d+)?)% Armor/i))) add("armor", Number(m[1]));
      else if ((m = s.match(/([+-]?\d+(?:\.\d+)?)% Energy Max/i))) add("energy", Number(m[1]));
      else if ((m = s.match(/([+-]?\d+(?:\.\d+)?)% Sprint Speed/i))) add("sprint", Number(m[1]));
      else if ((m = s.match(/([+-]?\d+(?:\.\d+)?)% Ability Strength/i))) add("abilityStrength", Number(m[1]));
      else if ((m = s.match(/([+-]?\d+(?:\.\d+)?)% Ability Duration/i))) add("abilityDuration", Number(m[1]));
      else if ((m = s.match(/([+-]?\d+(?:\.\d+)?)% Ability Efficiency/i))) add("abilityEfficiency", Number(m[1]));
      else if ((m = s.match(/([+-]?\d+(?:\.\d+)?)% Ability Range/i))) add("abilityRange", Number(m[1]));
      else if ((m = s.match(/([+-]?\d+(?:\.\d+)?)% Range/i))) add("range", Number(m[1]));
      else if ((m = s.match(/([+-]?\d+(?:\.\d+)?)% Combo Duration/i))) add("comboDuration", Number(m[1]));
      else if ((m = s.match(/x(\d+(?:\.\d+)?)\s+Damage to (Grineer|Corpus|Infested|Orokin)/i))) {
        add("faction" + m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase(), (Number(m[1]) - 1) * 100);
      }
      else if ((m = s.match(/([+-]?\d+(?:\.\d+)?)% (?:<[^>]+>)?(Heat|Cold|Electricity|Toxin|Blast|Radiation|Gas|Magnetic|Viral|Corrosive|Impact|Puncture|Slash)/i))) {
        const key = m[2].toLowerCase();
        add(key, Number(m[1]));
      }
    });
    return out;
  }

  function effectLabels() {
    return {
      damage: "伤害", multishot: "多重射击", critChance: "暴击几率", critChanceCombo: "连击暴击", critDamage: "暴击伤害",
      statusChance: "触发几率", fireRate: "射速/攻速", reloadSpeed: "装填速度", magazine: "弹匣容量",
      health: "生命", shield: "护盾", armor: "护甲", energy: "能量上限", sprint: "冲刺速度",
      abilityStrength: "技能强度", abilityDuration: "技能持续时间", abilityEfficiency: "技能效率", abilityRange: "技能范围",
      range: "近战范围", comboDuration: "连击持续时间", heat: "热", cold: "冰", electricity: "电", toxin: "毒",
      blast: "爆炸", radiation: "辐射", gas: "毒气", magnetic: "磁力", viral: "病毒", corrosive: "腐蚀", impact: "冲击", puncture: "穿刺", slash: "切割"
    };
  }

  function effectSummary(mod, rank, limit) {
    const parsed = parseModStats(mod, rank);
    const labels = Object.assign(effectLabels(), {
      statusDamage: "状态伤害",
      statusDuration: "状态持续时间",
      factionGrineer: "对 Grineer 伤害",
      factionCorpus: "对 Corpus 伤害",
      factionInfested: "对 Infested 伤害",
      factionOrokin: "对 Orokin 伤害"
    });
    const out = Object.keys(parsed).map(function (key) {
      const val = parsed[key];
      if (!val) return "";
      return (val > 0 ? "+" : "") + fmt(val, 1) + "% " + (labels[key] || key);
    }).filter(Boolean);
    if (out.length) return out.slice(0, limit || 3);
    return modRankData(mod, rank).slice(0, limit || 2);
  }

  function slotDrain(index, slot) {
    const mod = slot && slot.modId ? findModById(slot.modId) : null;
    if (!mod) return 0;
    const rank = clamp(slot.rank || 0, 0, mod.maxRank);
    if (mod.modClass === "aura" || mod.modClass === "stance") return (Math.abs(mod.baseDrain) + rank);
    const cost = Math.max(0, mod.baseDrain + rank);
    return state.slotPolarities[index] === mod.polarity ? Math.max(1, Math.ceil(cost / 2)) : cost;
  }

  function capacityData() {
    let used = 0;
    let bonus = 0;
    state.slots.forEach(function (slot, index) {
      const drain = slotDrain(index, slot);
      if (isSpecialSlot(index) && slot.modId) bonus += drain;
      else used += drain;
    });
    const base = state.potato ? 60 : 30;
    const max = base + bonus;
    return { used: used, bonus: bonus, max: max, left: max - used, over: used > max };
  }

  function aggregateEffects() {
    const total = {};
    state.slots.forEach(function (slot, index) {
      if (!slot.modId) return;
      const mod = findModById(slot.modId);
      if (!mod) return;
      const parsed = parseModStats(mod, slot.rank || 0);
      Object.keys(parsed).forEach(function (key) { total[key] = (total[key] || 0) + parsed[key]; });
    });
    return total;
  }

  function critMultiplierAt(chancePercent, multiplier) {
    const cc = chancePercent / 100;
    const tier = Math.floor(cc);
    const rem = cc - tier;
    function tierMultiplier(level) { return 1 + (multiplier - 1) * level; }
    return (1 - rem) * tierMultiplier(tier) + rem * tierMultiplier(tier + 1);
  }

  function orderedDamageComposition(item, eff) {
    const damage = Object.assign({}, item.damage || {});
    const baseTotal = item.totalDamage || 0;
    const damageMult = 1 + (eff.damage || 0) / 100;
    Object.keys(damage).forEach(function (key) { damage[key] = (damage[key] || 0) * damageMult; });

    const basicKeys = ["heat", "cold", "electricity", "toxin"];
    const complexKeys = ["blast", "radiation", "gas", "magnetic", "viral", "corrosive"];
    const pairs = {
      "heat|cold": "blast", "cold|heat": "blast",
      "electricity|toxin": "corrosive", "toxin|electricity": "corrosive",
      "heat|toxin": "gas", "toxin|heat": "gas",
      "cold|electricity": "magnetic", "electricity|cold": "magnetic",
      "heat|electricity": "radiation", "electricity|heat": "radiation",
      "cold|toxin": "viral", "toxin|cold": "viral"
    };
    const pending = [];
    basicKeys.forEach(function (key) {
      if (damage[key] > 0) {
        pending.push({ key: key, damage: damage[key] });
        damage[key] = 0;
      }
    });

    function addPending(key, amount) {
      if (amount <= 0) return;
      const existing = pending.find(function (entry) { return entry.key === key; });
      if (existing) {
        existing.damage += amount;
        return;
      }
      pending.push({ key: key, damage: amount });
      while (pending.length >= 2) {
        const first = pending.shift();
        const second = pending.shift();
        const combined = pairs[first.key + "|" + second.key];
        damage[combined] = (damage[combined] || 0) + first.damage + second.damage;
      }
    }

    state.slots.forEach(function (slot) {
      if (!slot.modId) return;
      const mod = findModById(slot.modId);
      if (!mod) return;
      modRankData(mod, slot.rank || 0).forEach(function (line) {
        const text = String(line);
        const elementPattern = /([+-]?\d+(?:\.\d+)?)%\s+(?:<[^>]+>)?(Heat|Cold|Electricity|Toxin)/gi;
        let match;
        while ((match = elementPattern.exec(text))) {
          const key = match[2].toLowerCase();
          addPending(key, baseTotal * damageMult * Number(match[1]) / 100);
        }
      });
    });

    pending.forEach(function (entry) {
      damage[entry.key] = (damage[entry.key] || 0) + entry.damage;
    });
    complexKeys.forEach(function (key) {
      if (eff[key]) damage[key] = (damage[key] || 0) + baseTotal * damageMult * eff[key] / 100;
    });
    return damage;
  }

  function computeWeaponStats(item, eff, mergeElements) {
    const damage = mergeElements
      ? orderedDamageComposition(item, eff)
      : (function () {
          const separate = Object.assign({}, item.damage || {});
          const baseTotal = item.totalDamage || 0;
          const damageMult = 1 + (eff.damage || 0) / 100;
          Object.keys(separate).forEach(function (key) { separate[key] = (separate[key] || 0) * damageMult; });
          const elementKeys = ["heat", "cold", "electricity", "toxin", "blast", "radiation", "gas", "magnetic", "viral", "corrosive", "impact", "puncture", "slash"];
          elementKeys.forEach(function (key) {
            if (eff[key]) separate[key] = (separate[key] || 0) + baseTotal * damageMult * eff[key] / 100;
          });
          return separate;
        })();
    const totalDamage = Object.keys(damage).reduce(function (sum, key) { return sum + (damage[key] || 0); }, 0);
    const critChance = (item.criticalChance || 0) + (eff.critChance || 0) + (eff.critChanceCombo || 0) * (state.combo || 1);
    const critMult = (item.criticalMultiplier || 1) * (1 + (eff.critDamage || 0) / 100);
    const statusChance = (item.procChance || 0) * (1 + (eff.statusChance || 0) / 100);
    const multishot = (item.multishot || 1) * (1 + (eff.multishot || 0) / 100);
    const fireRate = (item.fireRate || 1) * (1 + (eff.fireRate || 0) / 100);
    const magazine = (item.magazineSize || 0) * (1 + (eff.magazine || 0) / 100);
    const reload = item.reloadTime > 0 ? item.reloadTime / (1 + (eff.reloadSpeed || 0) / 100) : 0;
    const expectedCrit = critMultiplierAt(critChance, critMult);
    const dps = totalDamage * multishot * fireRate * expectedCrit;
    return { damage: damage, totalDamage: totalDamage, critChance: critChance, critMult: critMult, statusChance: statusChance, multishot: multishot, fireRate: fireRate, magazine: magazine, reload: reload, expectedCrit: expectedCrit, dps: dps };
  }

  function computeWarframeStats(item, eff) {
    return {
      health: (item.health || 0) * (1 + (eff.health || 0) / 100),
      shield: (item.shield || 0) * (1 + (eff.shield || 0) / 100),
      armor: (item.armor || 0) * (1 + (eff.armor || 0) / 100),
      energy: (item.power || 0) * (1 + (eff.energy || 0) / 100),
      sprint: (item.sprintSpeed || 1) * (1 + (eff.sprint || 0) / 100),
      strength: 100 + (eff.abilityStrength || 0),
      duration: 100 + (eff.abilityDuration || 0),
      efficiency: 100 + (eff.abilityEfficiency || 0),
      range: 100 + (eff.abilityRange || 0)
    };
  }

  function statusEffectMeta() {
    return {
      impact: { name: "冲击", en: "Impact", duration: 1, effect: "短暂硬直，打断敌人的当前动作。" },
      puncture: { name: "穿刺", en: "Puncture", duration: 6, effect: "削弱目标输出，使其造成的伤害降低。" },
      slash: {
        name: "切割", en: "Slash", duration: 6, ticks: 6, coefficient: 0.35,
        effect: "流血持续伤害，以真实伤害结算并绕过护甲。"
      },
      cold: { name: "冰冻", en: "Cold", duration: 6, effect: "降低移动与攻击速度，连续施加可进一步冻结目标。" },
      heat: {
        name: "火焰", en: "Heat", duration: 6, ticks: 6, coefficient: 0.5,
        effect: "灼烧持续伤害并使目标慌乱；叠加期间可最多削减 50% 护甲。"
      },
      electricity: {
        name: "电击", en: "Electricity", duration: 6, ticks: 6, coefficient: 0.5,
        effect: "感电持续伤害，并可向附近目标传导。"
      },
      toxin: {
        name: "毒素", en: "Toxin", duration: 6, ticks: 6, coefficient: 0.5,
        effect: "毒素持续伤害，可直接作用于生命并绕过护盾。"
      },
      blast: {
        name: "爆炸", en: "Blast", duration: 1.5, ticks: 1, coefficient: 0.3,
        effect: "短暂延迟后爆炸，对周围目标造成范围伤害。"
      },
      radiation: { name: "辐射", en: "Radiation", duration: 6, effect: "扰乱目标，使敌人短时间攻击友军。" },
      gas: {
        name: "毒气", en: "Gas", duration: 6, ticks: 6, coefficient: 0.5,
        effect: "生成毒气云，对范围内目标持续造成毒素伤害。"
      },
      magnetic: { name: "磁力", en: "Magnetic", duration: 6, effect: "压制护盾并阻碍护盾恢复，提高对护盾的压力。" },
      viral: { name: "病毒", en: "Viral", duration: 6, effect: "叠加后提高目标受到的生命伤害。" },
      corrosive: { name: "腐蚀", en: "Corrosive", duration: 8, effect: "按层数削减护甲，最高可削减 80%。" }
    };
  }

  function factionBonus(eff) {
    const key = state.enemyFaction.charAt(0).toUpperCase() + state.enemyFaction.slice(1);
    return eff["faction" + key] || 0;
  }

  function calculateStatusEffects(final, eff) {
    const meta = statusEffectMeta();
    const durationFactor = Math.max(0, 1 + (eff.statusDuration || 0) / 100);
    const factionMult = 1 + factionBonus(eff) / 100;
    const damageFactor = (1 + (eff.statusDamage || 0) / 100) * factionMult * factionMult;
    const statusPerShot = final.statusChance / 100 * final.multishot;
    const statusPerSecond = statusPerShot * final.fireRate;
    const weighted = Object.keys(final.damage).filter(function (key) {
      return meta[key] && final.damage[key] > 0.0001;
    }).map(function (key) {
      return { key: key, damage: final.damage[key] };
    });
    const totalWeight = weighted.reduce(function (sum, item) { return sum + item.damage; }, 0);
    let statusDps = 0;
    const entries = weighted.map(function (item) {
      const effect = meta[item.key];
      const share = totalWeight > 0 ? item.damage / totalWeight : 0;
      const procsPerSecond = statusPerSecond * share;
      const duration = (effect.duration || 0) * durationFactor;
      const ticks = effect.coefficient ? effect.ticks * durationFactor : 0;
      const perTick = effect.coefficient ? final.totalDamage * effect.coefficient * damageFactor : 0;
      const perProc = perTick * ticks;
      const dotDps = procsPerSecond * perProc;
      statusDps += dotDps;
      return {
        key: item.key,
        name: effect.name,
        en: effect.en,
        effect: effect.effect,
        share: share,
        procsPerSecond: procsPerSecond,
        duration: duration,
        ticks: ticks,
        perTick: perTick,
        perProc: perProc,
        dotDps: dotDps,
        expectedStacks: procsPerSecond * state.statusWindow
      };
    }).sort(function (a, b) { return b.share - a.share; });

    const viral = entries.find(function (entry) { return entry.key === "viral"; });
    const corrosive = entries.find(function (entry) { return entry.key === "corrosive"; });
    const heat = entries.find(function (entry) { return entry.key === "heat"; });
    const viralStacks = clamp(viral ? viral.expectedStacks : 0, 0, 10);
    const corrosiveStacks = clamp(corrosive ? corrosive.expectedStacks : 0, 0, 10);
    const viralMult = viralStacks <= 0 ? 1 : viralStacks <= 1 ? 1 + viralStacks : 2 + 0.25 * (viralStacks - 1);
    const corrosiveReduction = Math.min(80, corrosiveStacks * 26);
    const heatReduction = heat && heat.expectedStacks >= 0.5 ? 50 : 0;
    const remainingArmorFactor = (1 - corrosiveReduction / 100) * (1 - heatReduction / 100);
    const effectiveArmor = Math.max(0, state.enemyArmor) * remainingArmorFactor;
    const directDps = final.dps * factionMult;

    return {
      entries: entries,
      statusPerShot: statusPerShot,
      statusPerSecond: statusPerSecond,
      statusDps: statusDps,
      totalDps: directDps + statusDps,
      viralStacks: viralStacks,
      viralMult: viralMult,
      corrosiveStacks: corrosiveStacks,
      corrosiveReduction: corrosiveReduction,
      heatReduction: heatReduction,
      effectiveArmor: effectiveArmor,
      factionMult: factionMult,
      durationFactor: durationFactor,
      damageFactor: damageFactor
    };
  }

  function effectValue(entry, status) {
    if (entry.ticks > 0) return "每跳 " + fmt(entry.perTick, 0) + " · " + fmt(entry.ticks, 1) + " 跳";
    if (entry.key === "viral") {
      return fmt(status.viralStacks, 1) + " 层 · 生命伤害 ×" + fmt(status.viralMult, 2);
    }
    if (entry.key === "corrosive") {
      return fmt(status.corrosiveStacks, 1) + " 层 · 护甲 -" + fmt(status.corrosiveReduction, 1) + "%";
    }
    if (entry.key === "heat") return "护甲削减上限 50%";
    if (entry.key === "puncture") return "目标输出 -40%";
    if (entry.key === "cold") return "移动与攻速 -50%";
    if (entry.key === "impact") return "短暂硬直";
    return "控制 / 辅助效果";
  }

  function renderStatus() {
    if (!els.statusPanel) return;
    if (!state.item || state.category === "warframe") {
      els.statusPanel.hidden = true;
      return;
    }

    els.statusPanel.hidden = false;
    if (els.statusFaction && document.activeElement !== els.statusFaction) els.statusFaction.value = state.enemyFaction;
    if (els.statusArmor && document.activeElement !== els.statusArmor) els.statusArmor.value = state.enemyArmor;
    if (els.statusWindow && document.activeElement !== els.statusWindow) els.statusWindow.value = state.statusWindow;

    const eff = aggregateEffects();
    const final = computeWeaponStats(state.item, eff, true);
    const status = calculateStatusEffects(final, eff);
    const factionName = { grineer: "Grineer", corpus: "Corpus", infested: "Infested", orokin: "Orokin" }[state.enemyFaction] || state.enemyFaction;
    const factionText = factionBonus(eff) ? "阵营 Mod ×" + fmt(status.factionMult, 2) : "无阵营 Mod";
    const armorDelta = Math.max(0, state.enemyArmor) - status.effectiveArmor;

    els.statusSummary.innerHTML =
      '<div class="sim-status-metric"><span>每发触发</span><strong>' + fmt(status.statusPerShot, 2) + '</strong><small>次 / 发</small></div>' +
      '<div class="sim-status-metric"><span>每秒触发</span><strong>' + fmt(status.statusPerSecond, 2) + '</strong><small>次 / 秒</small></div>' +
      '<div class="sim-status-metric"><span>持续状态 DPS</span><strong>' + fmt(status.statusDps, 0) + '</strong><small>稳态理论值</small></div>' +
      '<div class="sim-status-metric"><span>综合 DPS</span><strong>' + fmt(status.totalDps, 0) + '</strong><small>直伤 + 状态</small></div>' +
      '<div class="sim-status-target">' +
        '<span>目标：' + escapeHtml(factionName) + ' · ' + escapeHtml(factionText) + '</span>' +
        '<span>当前护甲 ' + fmt(state.enemyArmor, 0) + ' → 预计 ' + fmt(status.effectiveArmor, 0) +
          (armorDelta > 0.01 ? '（-' + fmt(armorDelta, 0) + '）' : '') + '</span>' +
      '</div>' +
      '<div class="sim-status-target">' +
        '<span>约 ' + fmt(state.statusWindow, 1) + ' 秒后：病毒 ' + fmt(status.viralStacks, 1) +
          ' 层（生命伤害 ×' + fmt(status.viralMult, 2) + '）</span>' +
        '<span>腐蚀 ' + fmt(status.corrosiveStacks, 1) + ' 层（护甲 -' + fmt(status.corrosiveReduction, 1) + '%）</span>' +
      '</div>';

    els.statusList.innerHTML = status.entries.map(function (entry) {
      return '<article class="sim-status-card" data-status="' + escapeHtml(entry.key) + '">' +
        '<div class="sim-status-card__head">' +
          '<div><strong>' + escapeHtml(entry.name) + '</strong><small>' + escapeHtml(entry.en) + ' · ' + fmt(entry.share * 100, 1) + '% 触发占比</small></div>' +
          '<b>' + fmt(entry.procsPerSecond, 2) + ' 次/秒</b>' +
        '</div>' +
        '<div class="sim-status-card__bar"><span style="width:' + clamp(entry.share * 100, 0, 100) + '%"></span></div>' +
        '<div class="sim-status-card__facts">' +
          '<span><em>状态数值</em><b>' + escapeHtml(effectValue(entry, status)) + '</b></span>' +
          '<span><em>持续时间</em><b>' + fmt(entry.duration, 1) + 's</b></span>' +
          (entry.dotDps > 0 ? '<span><em>单次总伤</em><b>' + fmt(entry.perProc, 0) + '</b></span>' : '') +
        '</div>' +
        '<p>' + escapeHtml(entry.effect) + '</p>' +
      '</article>';
    }).join("") || '<div class="empty-state"><strong>没有可触发的异常状态</strong><span>当前武器没有有效伤害构成或触发几率。</span></div>';
  }

  function statRow(label, base, final, unit, digits) {
    const delta = final - base;
    const deltaText = Math.abs(delta) < 0.0001 ? "" : (delta > 0 ? "+" : "") + fmt(delta, digits == null ? 1 : digits) + (unit || "");
    return '<div class="sim-stat-row"><span>' + escapeHtml(label) + '</span><div><strong>' + fmt(final, digits == null ? 1 : digits) + escapeHtml(unit || "") + '</strong>' + (deltaText ? '<em>' + escapeHtml(deltaText) + '</em>' : '') + '</div></div>';
  }

  function renderStats() {
    if (!els.stats || !state.item) return;
    const eff = aggregateEffects();
    const cap = capacityData();
    if (state.category === "warframe") {
      const base = state.item;
      const final = computeWarframeStats(base, eff);
      els.stats.innerHTML =
        statRow("生命", base.health || 0, final.health, "", 0) +
        statRow("护盾", base.shield || 0, final.shield, "", 0) +
        statRow("护甲", base.armor || 0, final.armor, "", 0) +
        statRow("能量上限", base.power || 0, final.energy, "", 0) +
        statRow("冲刺速度", base.sprintSpeed || 1, final.sprint, "x", 2) +
        statRow("技能强度", 100, final.strength, "%", 1) +
        statRow("技能持续时间", 100, final.duration, "%", 1) +
        statRow("技能效率", 100, final.efficiency, "%", 1) +
        statRow("技能范围", 100, final.range, "%", 1);
    } else {
      const baseStats = computeWeaponStats(state.item, {});
      const final = computeWeaponStats(state.item, eff, true);
      els.stats.innerHTML =
        statRow("总伤害", baseStats.totalDamage, final.totalDamage, "", 0) +
        statRow("暴击几率", state.item.criticalChance || 0, final.critChance, "%", 1) +
        statRow("暴击倍率", state.item.criticalMultiplier || 1, final.critMult, "x", 2) +
        statRow("触发几率", state.item.procChance || 0, final.statusChance, "%", 1) +
        statRow("多重射击", state.item.multishot || 1, final.multishot, "x", 2) +
        statRow(state.category === "melee" ? "攻击速度" : "射速", state.item.fireRate || 1, final.fireRate, "/s", 2) +
        statRow("弹匣容量", state.item.magazineSize || 0, final.magazine, "", 0) +
        statRow("装填时间", state.item.reloadTime || 0, final.reload, "s", 2) +
        statRow("估算 DPS", baseStats.dps, final.dps, "", 0) +
        (state.category === "melee" ? '<div class="sim-stat-row"><span>连击倍率</span><div><input id="simCombo" type="number" min="1" max="12" step="1" value="' + state.combo + '" style="width:72px;background:#08111c;color:#e8f2fa;border:1px solid rgba(139,183,214,.25);border-radius:6px;padding:4px 6px"></div></div>' : '');
      const parts = Object.keys(final.damage).filter(function (k) { return final.damage[k] > 0.01; }).map(function (k) { return '<span>' + escapeHtml(k) + ' ' + fmt(final.damage[k], 1) + '</span>'; }).join("");
      if (parts) els.stats.insertAdjacentHTML("beforeend", '<div class="sim-stat-row"><span>伤害构成</span><div style="display:flex;flex-wrap:wrap;gap:4px;max-width:190px;justify-content:flex-end">' + parts + '</div></div>');
      const combo = document.getElementById("simCombo");
      if (combo) combo.addEventListener("change", function (e) { state.combo = clamp(Number(e.target.value) || 1, 1, 12); renderStats(); save(); });
    }
    if (cap.over) els.stats.insertAdjacentHTML("afterbegin", '<div class="sim-stat-row"><span>容量状态</span><div><strong style="color:#ff667d">超载 ' + Math.abs(cap.left) + '</strong></div></div>');
  }

  function renderSlots() {
    if (!els.slots || !state.item) return;
    const cap = capacityData();
    els.slots.innerHTML = "";
    state.slots.forEach(function (slot, index) {
      const special = isSpecialSlot(index);
      const mod = slot.modId ? findModById(slot.modId) : null;
      const div = document.createElement("article");
      div.className = "sim-slot" + (special ? " is-special" : "") + (state.activeSlot === index ? " is-active" : "");
      div.dataset.slot = String(index);
      if (mod) {
        const drain = slotDrain(index, slot);
        div.innerHTML =
          '<div class="sim-slot__top"><span class="sim-slot__label">' + escapeHtml(slotLabel(index)) + '</span><button class="sim-slot__remove" type="button" aria-label="移除 Mod">×</button></div>' +
          '<strong class="sim-slot__name">' + escapeHtml(mod.name) + ' ' + escapeHtml(mod.zh) + '</strong>' +
          '<div class="sim-slot__meta"><button class="sim-polarity" type="button" data-polarity="' + escapeHtml(state.slotPolarities[index]) + '" title="点击切换极性">' + escapeHtml(polaritySymbol(state.slotPolarities[index])) + '</button><span>' + (special ? "+" + drain : drain) + ' 容量</span><span>R' + slot.rank + '/' + mod.maxRank + '</span></div>' +
          '<input class="sim-slot__rank" type="range" min="0" max="' + mod.maxRank + '" value="' + slot.rank + '" aria-label="Mod 等级">';
      } else {
        div.innerHTML =
          '<div class="sim-slot__top"><span class="sim-slot__label">' + escapeHtml(slotLabel(index)) + '</span></div>' +
          '<div class="sim-slot__empty">点击选择 Mod</div>' +
          '<div class="sim-slot__meta"><button class="sim-polarity" type="button" data-polarity="' + escapeHtml(state.slotPolarities[index]) + '" title="点击切换极性">' + escapeHtml(polaritySymbol(state.slotPolarities[index])) + '</button><span>' + escapeHtml(polarityLabel(state.slotPolarities[index])) + '</span></div>';
      }
      div.addEventListener("click", function (e) {
        if (e.target.closest("button") || e.target.closest("input")) return;
        state.activeSlot = index;
        renderSlots();
        renderModList();
      });
      const remove = div.querySelector(".sim-slot__remove");
      if (remove) remove.addEventListener("click", function (e) {
        e.stopPropagation();
        state.slots[index] = { modId: null, rank: 0 };
        state.activeSlot = index;
        renderAllBuild();
        save();
      });
      const pol = div.querySelector(".sim-polarity");
      if (pol) pol.addEventListener("click", function (e) {
        e.stopPropagation();
        const current = state.slotPolarities[index] || "none";
        const next = polarityOrder[(polarityOrder.indexOf(current) + 1) % polarityOrder.length];
        state.slotPolarities[index] = next;
        renderAllBuild();
        save();
      });
      const range = div.querySelector(".sim-slot__rank");
      if (range) range.addEventListener("input", function (e) {
        state.slots[index].rank = Number(e.target.value);
        renderAllBuild();
        save();
      });
      els.slots.appendChild(div);
    });

    const base = state.potato ? 60 : 30;
    const max = cap.max;
    const pct = max > 0 ? Math.min(100, Math.round(cap.used / max * 100)) : 0;
    if (els.capacityText) els.capacityText.textContent = cap.used + " / " + max + (cap.over ? "（超载）" : "");
    if (els.capacityBar) els.capacityBar.style.width = pct + "%";
    if (els.capacityBar && els.capacityBar.parentElement) els.capacityBar.parentElement.classList.toggle("is-over", cap.over);
    if (els.capacityNote) els.capacityNote.textContent = "基础容量 " + base + (cap.bonus ? " + 光环/姿态 +" + cap.bonus : "") + "；极性匹配时消耗减半。";
  }

  function renderModList() {
    if (!els.modList || !state.item) return;
    const slotIndex = state.activeSlot == null ? 0 : state.activeSlot;
    const special = isSpecialSlot(slotIndex);
    const mods = modsForSlot(slotIndex);
    const used = new Set(state.slots.map(function (s) { return s.modId; }).filter(Boolean));
    const q = state.modSearch.trim().toLowerCase();
    const filtered = mods.filter(function (m) {
      if (!q) return true;
      return (m.name + " " + m.zh + " " + m.type + " " + m.compatName).toLowerCase().indexOf(q) !== -1;
    }).slice(0, 140);
    if (els.modTitle) els.modTitle.textContent = slotLabel(slotIndex) + " 可用 Mod";
    if (els.modHint) els.modHint.textContent = "点击“装备”把 Mod 放入当前槽位。" + (special ? " 光环/姿态会额外提供容量。" : "");
    els.modList.innerHTML = filtered.map(function (m) {
      const preview = effectSummary(m, m.maxRank, 3).slice(0, 3).map(function (x) { return '<span>' + escapeHtml(x) + '</span>'; }).join("");
      const isUsed = used.has(m.id);
      return '<article class="sim-mod">' +
        '<div class="sim-mod__top"><div class="sim-mod__name"><strong>' + escapeHtml(m.name) + '</strong><span>' + escapeHtml(m.zh) + ' · ' + escapeHtml(polarityLabel(m.polarity)) + '</span></div>' +
        '<button class="sim-mod__add" type="button" data-mod="' + escapeHtml(m.id) + '"' + (isUsed ? ' disabled style="opacity:.35;cursor:default"' : '') + '>' + (isUsed ? '已装' : '装备') + '</button></div>' +
        '<div class="sim-mod__stats">' + preview + '</div>' +
        '<div class="sim-mod__foot">' + escapeHtml(m.type) + ' · 基础消耗 ' + m.baseDrain + ' · 最高 R' + m.maxRank + '</div>' +
      '</article>';
    }).join("") || '<div class="empty-state"><strong>没有匹配的 Mod</strong><span>换个关键词或先切换槽位。</span></div>';
    els.modList.querySelectorAll("[data-mod]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const modId = btn.getAttribute("data-mod");
        const mod = findModById(modId);
        if (!mod) return;
        if (used.has(mod.id)) return;
        let target = state.activeSlot;
        if (target == null || state.slots[target].modId || !modsForSlot(target).some(function (m) { return m.id === mod.id; })) {
          target = state.slots.findIndex(function (slot, i) { return !slot.modId && modsForSlot(i).some(function (m) { return m.id === mod.id; }); });
        }
        if (target < 0) return;
        state.activeSlot = target;
        state.slots[target] = { modId: mod.id, rank: mod.maxRank };
        renderAllBuild();
        save();
      });
    });
  }

  function renderBuildHeader() {
    if (!state.item) return;
    if (els.itemName) els.itemName.textContent = state.item.name + (state.item.zh && state.item.zh !== state.item.name ? " " + state.item.zh : "");
    if (els.itemMeta) els.itemMeta.textContent = catLabels[state.category] + " · " + (state.item.type || "") + " · 精通 " + (state.item.masteryReq || 0);
    if (els.potato) els.potato.textContent = "土豆：" + (state.potato ? "开" : "关");
  }

  function renderAllBuild() {
    renderBuildHeader();
    renderSlots();
    renderStats();
    renderModList();
    renderStatus();
  }

  function renderItemList() {
    if (!els.itemList) return;
    const q = state.itemSearch.trim().toLowerCase();
    const list = itemsByCategory().filter(function (it) {
      if (!q) return true;
      return (it.name + " " + it.zh).toLowerCase().indexOf(q) !== -1;
    }).slice(0, 80);
    els.itemList.innerHTML = list.map(function (it) {
      return '<button class="sim-item' + (state.itemId === it.id ? " is-active" : "") + '" type="button" data-item="' + escapeHtml(it.id) + '"><strong>' + escapeHtml(it.name) + '</strong><small>' + escapeHtml(it.zh) + '</small></button>';
    }).join("");
    els.itemList.querySelectorAll("[data-item]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const item = findItem(btn.getAttribute("data-item"));
        if (!item) return;
        resetBuild(item);
        renderItemList();
        renderAllBuild();
        save();
      });
    });
  }

  function renderCategories() {
    if (!els.categories) return;
    els.categories.innerHTML = Object.keys(catLabels).map(function (key) {
      return '<button class="filter-chip' + (state.category === key ? " is-active" : "") + '" type="button" data-cat="' + key + '">' + catLabels[key] + '</button>';
    }).join("");
    els.categories.querySelectorAll("[data-cat]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.category = btn.getAttribute("data-cat");
        const item = data.items.find(function (it) { return it.category === state.category; });
        if (item) resetBuild(item);
        renderCategories();
        renderItemList();
        renderAllBuild();
        save();
      });
    });
  }

  function sampleBuild() {
    if (!state.item) return;
    const samples = {
      warframe: { normal: ["Vitality", "Redirection", "Primed Continuity", "Intensify", "Streamline", "Flow", "Stretch", "Augur Reach"], special: "Corrosive Projection" },
      primary: { normal: ["Serration", "Split Chamber", "Vital Sense", "Point Strike", "Hellfire", "Cryo Rounds", "Stormbringer", "Infected Clip"], special: "" },
      secondary: { normal: ["Hornet Strike", "Barrel Diffusion", "Lethal Torrent", "Primed Pistol Gambit", "Primed Target Cracker", "Convulsion", "Pathogen Rounds", "Deep Freeze"], special: "" },
      melee: { normal: ["Pressure Point", "Blood Rush", "Organ Shatter", "True Steel", "Fever Strike", "Molten Impact", "North Wind", "Shocking Touch"], special: "Blind Justice" }
    };
    const chosen = samples[state.category];
    if (!chosen) return;
    state.slots = state.slots.map(function () { return { modId: null, rank: 0 }; });
    function equipByName(name, slotIndex) {
      const mod = data.mods.find(function (m) { return m.name === name && modsForSlot(slotIndex).some(function (x) { return x.id === m.id; }); }) || data.mods.find(function (m) { return m.name === name; });
      if (!mod) return;
      state.slots[slotIndex] = { modId: mod.id, rank: mod.maxRank };
    }
    chosen.normal.forEach(function (name, i) { if (i < 8) equipByName(name, i); });
    if (chosen.special && slotCount() > 8) equipByName(chosen.special, 8);
    state.activeSlot = 0;
    renderAllBuild();
    save();
  }

  function clearBuild() {
    state.slots = state.slots.map(function () { return { modId: null, rank: 0 }; });
    state.activeSlot = 0;
    renderAllBuild();
    save();
  }

  function save() {
    try {
      localStorage.setItem("warmxz-build-sim", JSON.stringify({
        category: state.category,
        itemId: state.itemId,
        slots: state.slots,
        slotPolarities: state.slotPolarities,
        potato: state.potato,
        combo: state.combo,
        enemyArmor: state.enemyArmor,
        enemyFaction: state.enemyFaction,
        statusWindow: state.statusWindow
      }));
    } catch (e) {}
  }

  function loadSaved() {
    try {
      const saved = JSON.parse(localStorage.getItem("warmxz-build-sim") || "null");
      if (!saved) return false;
      const item = findItem(saved.itemId);
      if (!item || item.category !== saved.category) return false;
      state.category = saved.category;
      resetBuild(item);
      const savedSlots = Array.isArray(saved.slots) ? saved.slots : [];
      state.slots = state.slots.map(function (empty, i) { return savedSlots[i] && savedSlots[i].modId ? savedSlots[i] : empty; });
      const savedPol = Array.isArray(saved.slotPolarities) ? saved.slotPolarities : [];
      state.slotPolarities = state.slotPolarities.map(function (fallback, i) { return savedPol[i] || fallback; });
      state.potato = saved.potato !== false;
      state.combo = saved.combo || 3;
      const savedArmor = Number(saved.enemyArmor);
      state.enemyArmor = Number.isFinite(savedArmor) ? clamp(savedArmor, 0, 100000) : 500;
      state.enemyFaction = ["grineer", "corpus", "infested", "orokin"].indexOf(saved.enemyFaction) !== -1 ? saved.enemyFaction : "grineer";
      state.statusWindow = clamp(Number(saved.statusWindow) || 3, 0.5, 20);
      return true;
    } catch (e) { return false; }
  }

  if (els.itemSearch) els.itemSearch.addEventListener("input", function (e) { state.itemSearch = e.target.value; renderItemList(); });
  if (els.modSearch) els.modSearch.addEventListener("input", function (e) { state.modSearch = e.target.value; renderModList(); });
  if (els.potato) els.potato.addEventListener("click", function () { state.potato = !state.potato; renderAllBuild(); save(); });
  if (els.sample) els.sample.addEventListener("click", sampleBuild);
  if (els.clear) els.clear.addEventListener("click", clearBuild);
  if (els.statusFaction) els.statusFaction.addEventListener("change", function (e) {
    state.enemyFaction = e.target.value;
    renderStatus();
    save();
  });
  if (els.statusArmor) els.statusArmor.addEventListener("input", function (e) {
    state.enemyArmor = clamp(Number(e.target.value) || 0, 0, 100000);
    renderStatus();
  });
  if (els.statusArmor) els.statusArmor.addEventListener("change", function (e) {
    state.enemyArmor = clamp(Number(e.target.value) || 0, 0, 100000);
    e.target.value = state.enemyArmor;
    renderStatus();
    save();
  });
  if (els.statusWindow) els.statusWindow.addEventListener("input", function (e) {
    state.statusWindow = clamp(Number(e.target.value) || 0.5, 0.5, 20);
    renderStatus();
  });
  if (els.statusWindow) els.statusWindow.addEventListener("change", function (e) {
    state.statusWindow = clamp(Number(e.target.value) || 0.5, 0.5, 20);
    e.target.value = state.statusWindow;
    renderStatus();
    save();
  });

  if (els.itemCount) els.itemCount.textContent = String(data.items.length);
  if (els.modCount) els.modCount.textContent = String(data.mods.length);

  if (!loadSaved()) {
    const first = data.items.find(function (it) { return it.category === "warframe"; });
    resetBuild(first || data.items[0]);
  }
  renderCategories();
  renderItemList();
  renderAllBuild();
})();
