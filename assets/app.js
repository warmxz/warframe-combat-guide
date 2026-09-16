(function () {
  "use strict";

  const data = window.WARFRAME_COMBAT_DATA;
  if (!data) {
    return;
  }

  const state = {
    search: "",
    faction: "All",
    hasRendered: false
  };

  const openCardIds = new Set(["mercury-vor"]);
  const mainBosses = data.bosses || [];
  const specials = data.specials || [];

  const searchInput = document.getElementById("bossSearch");
  const factionFilters = document.getElementById("factionFilters");
  const resetButton = document.getElementById("resetFilters");
  const bossGrid = document.getElementById("bossGrid");
  const specialGrid = document.getElementById("specialGrid");
  const damageGrid = document.getElementById("damageGrid");
  const planetRail = document.getElementById("planetRail");
  const coverageGrid = document.getElementById("coverageGrid");
  const resultCount = document.getElementById("resultCount");
  const emptyState = document.getElementById("emptyState");

  const statBosses = document.getElementById("statBosses");
  const statVideos = document.getElementById("statVideos");

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalize(value) {
    return String(value == null ? "" : value).toLowerCase();
  }

  function includesText(haystack, needle) {
    return normalize(haystack).indexOf(normalize(needle)) !== -1;
  }

  function makeSearchBlob(item) {
    return [
      item.planet,
      item.planetEn,
      item.node,
      item.boss,
      item.bossEn,
      item.faction,
      item.factionLabel,
      item.difficulty,
      item.weakpoint,
      item.elements.join(" "),
      item.reward,
      item.summary,
      item.steps.join(" "),
      item.note
    ].join(" ");
  }

  function getVideoHref(item) {
    if (item.video && item.video.bvid) {
      return "https://www.bilibili.com/video/" + item.video.bvid + "/";
    }
    if (item.video && item.video.search) {
      return item.video.search;
    }
    return "https://search.bilibili.com/video?keyword=" + encodeURIComponent("星际战甲 " + item.boss + " 攻略");
  }

  function getVideoTitle(item) {
    return item.video && item.video.title ? item.video.title : "去 B 站搜索对应攻略";
  }

  function getVideoNote(item) {
    const video = item.video || {};
    const parts = [];
    if (video.author) parts.push(video.author);
    if (video.date) parts.push(video.date);
    if (video.note) parts.push(video.note);
    return parts.join(" · ") || "视频入口";
  }

  function renderDamageGuide() {
    if (!damageGrid) return;
    damageGrid.innerHTML = (data.damageGuide || []).map(function (item) {
      return '<article class="damage-card">' +
        '<span class="damage-card__kicker">' + escapeHtml(item.kicker) + '</span>' +
        '<h3>' + escapeHtml(item.title) + '</h3>' +
        '<p>' + escapeHtml(item.text) + '</p>' +
      '</article>';
    }).join("");
  }

  function renderPlanetRail() {
    if (!planetRail) return;
    const seen = new Set();
    const planets = [];
    mainBosses.forEach(function (item) {
      if (!seen.has(item.planet)) {
        seen.add(item.planet);
        planets.push({ planet: item.planet, planetEn: item.planetEn, id: item.id });
      }
    });

    planetRail.innerHTML = planets.map(function (item) {
      return '<button class="planet-chip" type="button" data-jump="' + escapeHtml(item.id) + '">' +
        '<strong>' + escapeHtml(item.planet) + '</strong>' +
        '<small>' + escapeHtml(item.planetEn) + '</small>' +
      '</button>';
    }).join("");

    planetRail.querySelectorAll("[data-jump]").forEach(function (button) {
      button.addEventListener("click", function () {
        const targetId = button.getAttribute("data-jump");
        let target = document.getElementById("card-" + targetId);
        if (!target) {
          state.search = "";
          state.faction = "All";
          if (searchInput) searchInput.value = "";
          renderFactionFilters();
          renderBosses();
          target = document.getElementById("card-" + targetId);
        }
        if (target) {
          target.open = true;
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    });
  }

  function buildIntelBlock(label, value, wide) {
    return '<div class="intel-block' + (wide ? ' intel-block--wide' : '') + '">' +
      '<span class="intel-block__label">' + escapeHtml(label) + '</span>' +
      '<div class="intel-block__value">' + value + '</div>' +
    '</div>';
  }

  function renderCard(item, index, special) {
    const card = document.createElement("details");
    card.className = "boss-card";
    card.id = "card-" + item.id;
    card.dataset.faction = item.faction;

    const elements = item.elements.map(function (element) {
      return '<span class="element-pill">' + escapeHtml(element) + '</span>';
    }).join("");

    const steps = item.steps.map(function (step) {
      return "<li>" + escapeHtml(step) + "</li>";
    }).join("");

    card.innerHTML =
      '<summary>' +
        '<div>' +
          '<div class="boss-card__planet">' +
            '<span class="planet-label">' + escapeHtml(item.planet) + '</span>' +
            '<span class="node-label">' + escapeHtml(item.node) + '</span>' +
            '<span class="faction-label" data-faction="' + escapeHtml(item.faction) + '">' + escapeHtml(item.factionLabel) + '</span>' +
            '<span class="difficulty-label">' + escapeHtml(item.difficulty) + '</span>' +
          '</div>' +
          '<h3>' + escapeHtml(item.boss) + '<small>' + escapeHtml(item.bossEn || "") + '</small></h3>' +
        '</div>' +
        '<span class="card-toggle" aria-hidden="true">＋</span>' +
      '</summary>' +
      '<div class="boss-card__body">' +
        '<p class="boss-card__summary">' + escapeHtml(item.summary) + '</p>' +
        '<div class="intel-grid">' +
          buildIntelBlock("有效弱点", escapeHtml(item.weakpoint)) +
          buildIntelBlock("弱点元素", '<div class="element-row">' + elements + '</div>') +
          buildIntelBlock("推荐奖励 / 目标掉落", escapeHtml(item.reward), true) +
        '</div>' +
        '<h4 class="steps-title">破译步骤</h4>' +
        '<ol class="tactics-list">' + steps + '</ol>' +
        (item.note ? '<p class="card-note">' + escapeHtml(item.note) + '</p>' : '') +
        '<a class="video-link" href="' + escapeHtml(getVideoHref(item)) + '" target="_blank" rel="noopener noreferrer">' +
          '<span class="video-link__meta">' +
            '<strong>' + escapeHtml(getVideoTitle(item)) + '</strong>' +
            '<span>' + escapeHtml(getVideoNote(item)) + ' · Bilibili</span>' +
          '</span>' +
          '<span class="video-link__action">看实战 ↗</span>' +
        '</a>' +
      '</div>';

    if (openCardIds.has(item.id) || (!state.hasRendered && !special && index === 0)) {
      card.open = true;
    }

    card.addEventListener("toggle", function () {
      if (card.open) {
        openCardIds.add(item.id);
      } else {
        openCardIds.delete(item.id);
      }
    });

    return card;
  }

  function cardMatches(item) {
    if (state.faction !== "All" && item.faction !== state.faction) {
      return false;
    }
    if (state.search && !includesText(makeSearchBlob(item), state.search)) {
      return false;
    }
    return true;
  }

  function renderBosses() {
    if (!bossGrid) return;
    const visible = mainBosses.filter(cardMatches);
    bossGrid.innerHTML = "";
    visible.forEach(function (item, index) {
      bossGrid.appendChild(renderCard(item, index, false));
    });
    if (resultCount) {
      resultCount.textContent = "显示 " + visible.length + " / " + mainBosses.length + " 个固定首领";
    }
    if (emptyState) emptyState.hidden = visible.length !== 0;
    state.hasRendered = true;
  }

  function renderSpecials() {
    if (!specialGrid) return;
    specialGrid.innerHTML = "";
    specials.forEach(function (item, index) {
      specialGrid.appendChild(renderCard(item, index, true));
    });
  }

  function renderFactionFilters() {
    if (!factionFilters) return;
    const filters = [
      { key: "All", label: "全部" },
      { key: "Grineer", label: "Grineer" },
      { key: "Corpus", label: "Corpus" },
      { key: "Infested", label: "Infested" },
      { key: "Sentient", label: "Sentient" }
    ];

    factionFilters.innerHTML = filters.map(function (filter) {
      const active = state.faction === filter.key ? " is-active" : "";
      return '<button class="filter-chip' + active + '" type="button" data-filter="' + escapeHtml(filter.key) + '" aria-pressed="' + (state.faction === filter.key) + '">' + escapeHtml(filter.label) + '</button>';
    }).join("");

    factionFilters.querySelectorAll("[data-filter]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.faction = button.getAttribute("data-filter");
        renderFactionFilters();
        renderBosses();
      });
    });
  }

  function renderCoverage() {
    if (!coverageGrid) return;
    coverageGrid.innerHTML = (data.coverage || []).map(function (item) {
      return '<article class="coverage-item">' +
        '<strong>' + escapeHtml(item.label) + '</strong>' +
        '<span>' + escapeHtml(item.text) + '</span>' +
      '</article>';
    }).join("");
  }

  function updateStats() {
    if (statBosses) statBosses.textContent = String(mainBosses.length);
    if (statVideos) {
      const count = mainBosses.filter(function (item) {
        return item.video && (item.video.bvid || item.video.search);
      }).length + specials.filter(function (item) {
        return item.video && (item.video.bvid || item.video.search);
      }).length;
      statVideos.textContent = String(count);
    }
  }

  function resetFilters() {
    state.search = "";
    state.faction = "All";
    if (searchInput) searchInput.value = "";
    renderFactionFilters();
    renderBosses();
  }

  if (searchInput) {
    searchInput.addEventListener("input", function (event) {
      state.search = event.target.value.trim();
      renderBosses();
    });
  }

  if (resetButton) {
    resetButton.addEventListener("click", resetFilters);
  }

  renderDamageGuide();
  renderPlanetRail();
  renderFactionFilters();
  renderBosses();
  renderSpecials();
  renderCoverage();
  updateStats();
})();