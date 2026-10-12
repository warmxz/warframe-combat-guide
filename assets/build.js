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
    modCount: document.getElementById("simModCount")
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
      else if ((m = s.match(/([+-]?\d+(?:\.\d+)?)% (Heat|Cold|Electricity|Toxin|Blast|Radiation|Gas|Magnetic|Viral|Corrosive|Impact|Puncture|Slash)/i))) {
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
    const labels = effectLabels();
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
    return (1 - rem) * Math.pow(multiplier, tier) + rem * Math.pow(multiplier, tier + 1);
  }

  function computeWeaponStats(item, eff) {
    const damage = Object.assign({}, item.damage || {});
    const baseTotal = item.totalDamage || 0;
    const damageMult = 1 + (eff.damage || 0) / 100;
    Object.keys(damage).forEach(function (key) { damage[key] = (damage[key] || 0) * damageMult; });
    const elementKeys = ["heat", "cold", "electricity", "toxin", "blast", "radiation", "gas", "magnetic", "viral", "corrosive", "impact", "puncture", "slash"];
    elementKeys.forEach(function (key) {
      if (eff[key]) damage[key] = (damage[key] || 0) + baseTotal * damageMult * eff[key] / 100;
    });
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
      const final = computeWeaponStats(state.item, eff);
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
      localStorage.setItem("warmxz-build-sim", JSON.stringify({ category: state.category, itemId: state.itemId, slots: state.slots, slotPolarities: state.slotPolarities, potato: state.potato, combo: state.combo }));
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
      return true;
    } catch (e) { return false; }
  }

  if (els.itemSearch) els.itemSearch.addEventListener("input", function (e) { state.itemSearch = e.target.value; renderItemList(); });
  if (els.modSearch) els.modSearch.addEventListener("input", function (e) { state.modSearch = e.target.value; renderModList(); });
  if (els.potato) els.potato.addEventListener("click", function () { state.potato = !state.potato; renderAllBuild(); save(); });
  if (els.sample) els.sample.addEventListener("click", sampleBuild);
  if (els.clear) els.clear.addEventListener("click", clearBuild);

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