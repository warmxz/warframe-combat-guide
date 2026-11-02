(function () {
  "use strict";

  const damageMeta = {
    impact: { name: "冲击", en: "Impact", duration: 1, effect: "短暂硬直，打断敌人的当前动作。", color: "#b9c7d2" },
    puncture: { name: "穿刺", en: "Puncture", duration: 6, effect: "削弱目标输出，使其造成的伤害降低。", color: "#f0c779" },
    slash: {
      name: "切割", en: "Slash", duration: 6, ticks: 6, coefficient: 0.35,
      effect: "流血持续伤害，以真实伤害结算并绕过护甲。", color: "#ff7d8f"
    },
    cold: { name: "冰冻", en: "Cold", duration: 6, effect: "降低移动与攻击速度，连续施加可进一步冻结目标。", color: "#81c8ff" },
    heat: {
      name: "火焰", en: "Heat", duration: 6, ticks: 6, coefficient: 0.5,
      effect: "灼烧持续伤害并使目标慌乱；叠加期间可最多削减 50% 护甲。", color: "#ff9a5f"
    },
    electricity: {
      name: "电击", en: "Electricity", duration: 6, ticks: 6, coefficient: 0.5,
      effect: "感电持续伤害，并可向附近目标传导。", color: "#b18aff"
    },
    toxin: {
      name: "毒素", en: "Toxin", duration: 6, ticks: 6, coefficient: 0.5,
      effect: "毒素持续伤害，可直接作用于生命并绕过护盾。", color: "#8ee96a"
    },
    blast: {
      name: "爆炸", en: "Blast", duration: 1.5, ticks: 1, coefficient: 0.3,
      effect: "短暂延迟后爆炸，对周围目标造成范围伤害。", color: "#d6a66b"
    },
    radiation: { name: "辐射", en: "Radiation", duration: 6, effect: "扰乱目标，使敌人短时间攻击友军。", color: "#f5dd77" },
    gas: {
      name: "毒气", en: "Gas", duration: 6, ticks: 6, coefficient: 0.5,
      effect: "生成毒气云，对范围内目标持续造成毒素伤害。", color: "#90d97a"
    },
    magnetic: { name: "磁力", en: "Magnetic", duration: 6, effect: "压制护盾并阻碍护盾恢复，提高对护盾的压力。", color: "#8ea7ff" },
    viral: { name: "病毒", en: "Viral", duration: 6, effect: "叠加后提高目标受到的生命伤害。", color: "#d0a2ff" },
    corrosive: { name: "腐蚀", en: "Corrosive", duration: 8, effect: "按层数削减护甲，最高可削减 80%。", color: "#7ae48f" }
  };

  const controlIds = [
    "statusChance", "statusMultishot", "statusRate", "statusDamageBonus",
    "statusDurationBonus", "statusFactionBonus", "statusFaction", "statusArmor", "statusWindow"
  ];
  const damageIds = Object.keys(damageMeta).map(function (key) { return "damage-" + key; });
  const savedKey = "warmxz-status-calculator-v1";

  const els = {
    summary: document.getElementById("statusSummary"),
    target: document.getElementById("statusTarget"),
    cards: document.getElementById("statusCards"),
    totalDamage: document.getElementById("statusTotalDamage"),
    sample: document.getElementById("statusSample"),
    reset: document.getElementById("statusReset")
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function round(value, digits) {
    const power = Math.pow(10, digits == null ? 1 : digits);
    return Math.round(value * power) / power;
  }

  function fmt(value, digits) {
    return Number.isFinite(value) ? round(value, digits == null ? 1 : digits).toLocaleString("zh-CN") : "—";
  }

  function numberValue(id) {
    const value = Number(document.getElementById(id).value);
    return Number.isFinite(value) ? value : 0;
  }

  function readState() {
    const damage = {};
    Object.keys(damageMeta).forEach(function (key) {
      damage[key] = Math.max(0, numberValue("damage-" + key));
    });
    return {
      statusChance: Math.max(0, numberValue("statusChance")),
      multishot: Math.max(0, numberValue("statusMultishot")),
      rate: Math.max(0, numberValue("statusRate")),
      damageBonus: Math.max(-100, numberValue("statusDamageBonus")),
      durationBonus: Math.max(-100, numberValue("statusDurationBonus")),
      factionBonus: Math.max(-100, numberValue("statusFactionBonus")),
      faction: document.getElementById("statusFaction").value,
      armor: Math.max(0, numberValue("statusArmor")),
      window: clamp(numberValue("statusWindow") || 3, 0.5, 60),
      damage: damage
    };
  }

  function calculate(input) {
    const totalDamage = Object.keys(input.damage).reduce(function (sum, key) {
      return sum + input.damage[key];
    }, 0);
    const durationFactor = Math.max(0, 1 + input.durationBonus / 100);
    const factionMultiplier = Math.max(0, 1 + input.factionBonus / 100);
    const damageFactor = Math.max(0, 1 + input.damageBonus / 100) * factionMultiplier * factionMultiplier;
    const statusPerShot = input.statusChance / 100 * input.multishot;
    const statusPerSecond = statusPerShot * input.rate;
    const weighted = Object.keys(input.damage).filter(function (key) {
      return input.damage[key] > 0;
    }).map(function (key) {
      return { key: key, damage: input.damage[key] };
    });
    let statusDps = 0;

    const entries = weighted.map(function (item) {
      const meta = damageMeta[item.key];
      const share = totalDamage > 0 ? item.damage / totalDamage : 0;
      const procsPerSecond = statusPerSecond * share;
      const duration = meta.duration * durationFactor;
      const ticks = meta.coefficient ? meta.ticks * durationFactor : 0;
      const perTick = meta.coefficient ? totalDamage * meta.coefficient * damageFactor : 0;
      const perProc = perTick * ticks;
      const dotDps = procsPerSecond * perProc;
      statusDps += dotDps;
      return {
        key: item.key,
        name: meta.name,
        en: meta.en,
        effect: meta.effect,
        color: meta.color,
        share: share,
        procsPerSecond: procsPerSecond,
        duration: duration,
        ticks: ticks,
        perTick: perTick,
        perProc: perProc,
        dotDps: dotDps,
        expectedStacks: procsPerSecond * input.window
      };
    }).sort(function (a, b) { return b.share - a.share; });

    const viral = entries.find(function (entry) { return entry.key === "viral"; });
    const corrosive = entries.find(function (entry) { return entry.key === "corrosive"; });
    const heat = entries.find(function (entry) { return entry.key === "heat"; });
    const viralStacks = clamp(viral ? viral.expectedStacks : 0, 0, 10);
    const corrosiveStacks = clamp(corrosive ? corrosive.expectedStacks : 0, 0, 10);
    const viralMultiplier = viralStacks <= 0 ? 1 : viralStacks <= 1 ? 1 + viralStacks : 2 + 0.25 * (viralStacks - 1);
    const corrosiveReduction = Math.min(80, corrosiveStacks * 26);
    const heatReduction = heat && heat.expectedStacks >= 0.5 ? 50 : 0;
    const effectiveArmor = input.armor * (1 - corrosiveReduction / 100) * (1 - heatReduction / 100);

    return {
      totalDamage: totalDamage,
      statusPerShot: statusPerShot,
      statusPerSecond: statusPerSecond,
      statusDps: statusDps,
      viralStacks: viralStacks,
      viralMultiplier: viralMultiplier,
      corrosiveStacks: corrosiveStacks,
      corrosiveReduction: corrosiveReduction,
      effectiveArmor: effectiveArmor,
      factionMultiplier: factionMultiplier,
      damageFactor: damageFactor,
      entries: entries
    };
  }

  function effectValue(entry, result) {
    if (entry.key === "viral") {
      return fmt(result.viralStacks, 1) + " 层 · 生命伤害 ×" + fmt(result.viralMultiplier, 2);
    }
    if (entry.key === "corrosive") {
      return fmt(result.corrosiveStacks, 1) + " 层 · 护甲 -" + fmt(result.corrosiveReduction, 1) + "%";
    }
    if (entry.key === "heat") return "每跳 " + fmt(entry.perTick, 0) + " · 护甲最多 -50%";
    if (entry.key === "puncture") return "目标输出 -40%";
    if (entry.key === "cold") return "移动与攻速 -50%";
    if (entry.key === "impact") return "短暂硬直";
    if (entry.ticks > 0) return "每跳 " + fmt(entry.perTick, 0) + " · " + fmt(entry.ticks, 1) + " 跳";
    return "控制 / 辅助效果";
  }

  function render() {
    const input = readState();
    const result = calculate(input);
    els.totalDamage.textContent = fmt(result.totalDamage, 1);

    els.summary.innerHTML =
      '<div class="status-metric"><span>每发触发</span><strong>' + fmt(result.statusPerShot, 2) + '</strong><small>次 / 发</small></div>' +
      '<div class="status-metric"><span>每秒触发</span><strong>' + fmt(result.statusPerSecond, 2) + '</strong><small>次 / 秒</small></div>' +
      '<div class="status-metric"><span>持续状态 DPS</span><strong>' + fmt(result.statusDps, 0) + '</strong><small>稳态理论值</small></div>' +
      '<div class="status-metric"><span>有效护甲</span><strong>' + fmt(result.effectiveArmor, 0) + '</strong><small>' +
        fmt(input.armor, 0) + ' → 状态削减后</small></div>';

    els.target.innerHTML =
      '<div><span>目标：' + escapeHtml(input.faction) + '</span><span>阵营伤害倍率 ×' +
        fmt(result.factionMultiplier, 2) + '</span></div>' +
      '<div><span>约 ' + fmt(input.window, 1) + ' 秒后：病毒 ' + fmt(result.viralStacks, 1) +
        ' 层（生命伤害 ×' + fmt(result.viralMultiplier, 2) + '）</span>' +
      '<span>腐蚀 ' + fmt(result.corrosiveStacks, 1) + ' 层（护甲 -' +
        fmt(result.corrosiveReduction, 1) + '%）</span></div>';

    if (!result.entries.length) {
      els.cards.innerHTML = '<div class="status-empty"><div><strong>等待输入伤害构成</strong><span>填写至少一种伤害数值后，这里会自动显示异常状态结果。</span></div></div>';
      return;
    }

    els.cards.innerHTML = result.entries.map(function (entry) {
      const dotFacts = entry.dotDps > 0
        ? '<span><em>单次总伤</em><b>' + fmt(entry.perProc, 0) + '</b></span>' +
          '<span><em>状态 DPS</em><b>' + fmt(entry.dotDps, 0) + '</b></span>'
        : '';
      return '<article class="status-card" style="--status-color:' + entry.color + '">' +
        '<div class="status-card__head">' +
          '<div><strong>' + escapeHtml(entry.name) + '</strong><small>' + escapeHtml(entry.en) +
            ' · ' + fmt(entry.share * 100, 1) + '% 触发占比</small></div>' +
          '<b>' + fmt(entry.procsPerSecond, 2) + ' 次/秒</b>' +
        '</div>' +
        '<div class="status-card__bar"><span style="width:' + clamp(entry.share * 100, 0, 100) + '%"></span></div>' +
        '<div class="status-card__facts">' +
          '<span><em>状态数值</em><b>' + escapeHtml(effectValue(entry, result)) + '</b></span>' +
          '<span><em>持续时间</em><b>' + fmt(entry.duration, 1) + 's</b></span>' +
          dotFacts +
        '</div>' +
        '<p>' + escapeHtml(entry.effect) + '</p>' +
      '</article>';
    }).join("");
  }

  function save() {
    const data = {};
    controlIds.concat(damageIds).forEach(function (id) {
      data[id] = document.getElementById(id).value;
    });
    try {
      localStorage.setItem(savedKey, JSON.stringify(data));
    } catch (error) {}
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(savedKey) || "null");
      if (!saved) return;
      controlIds.concat(damageIds).forEach(function (id) {
        if (saved[id] != null && document.getElementById(id)) {
          document.getElementById(id).value = saved[id];
        }
      });
    } catch (error) {}
  }

  function setValues(values) {
    Object.keys(values).forEach(function (id) {
      const element = document.getElementById(id);
      if (element) element.value = values[id];
    });
    render();
    save();
  }

  function loadSample() {
    setValues({
      statusChance: 35,
      statusMultishot: 1.8,
      statusRate: 8,
      statusDamageBonus: 90,
      statusDurationBonus: 50,
      statusFactionBonus: 55,
      statusFaction: "Grineer",
      statusArmor: 500,
      statusWindow: 3,
      "damage-impact": 12,
      "damage-puncture": 20,
      "damage-slash": 48,
      "damage-heat": 40,
      "damage-viral": 120,
      "damage-corrosive": 0,
      "damage-cold": 0,
      "damage-electricity": 0,
      "damage-toxin": 0,
      "damage-blast": 0,
      "damage-radiation": 0,
      "damage-gas": 0,
      "damage-magnetic": 0
    });
  }

  function reset() {
    const values = {
      statusChance: 0,
      statusMultishot: 1,
      statusRate: 1,
      statusDamageBonus: 0,
      statusDurationBonus: 0,
      statusFactionBonus: 0,
      statusFaction: "Grineer",
      statusArmor: 500,
      statusWindow: 3
    };
    damageIds.forEach(function (id) { values[id] = 0; });
    setValues(values);
  }

  document.querySelectorAll("input, select").forEach(function (element) {
    element.addEventListener("input", function () {
      render();
      save();
    });
    element.addEventListener("change", function () {
      render();
      save();
    });
  });

  if (els.sample) els.sample.addEventListener("click", loadSample);
  if (els.reset) els.reset.addEventListener("click", reset);

  load();
  render();
})();
