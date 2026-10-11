(function () {
  "use strict";
  const data = window.WARFRAME_FISH_DATA;
  if (!data) return;

  const zoneMap = {};
  data.zones.forEach(function (zone) { zoneMap[zone.key] = zone; });

  const state = { search: "", region: "all", rarity: "all" };
  const regionFilters = document.getElementById("fishRegionFilters");
  const rarityFilters = document.getElementById("fishRarityFilters");
  const searchInput = document.getElementById("fishSearch");
  const resetButton = document.getElementById("resetFishFilters");
  const list = document.getElementById("fishList");
  const emptyState = document.getElementById("fishEmptyState");
  const count = document.getElementById("fishResultCount");
  const zoneGrid = document.getElementById("fishZoneGrid");
  const videoLinks = document.getElementById("fishVideoLinks");

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function videoUrl(video) { return "https://www.bilibili.com/video/" + video.bvid + "/"; }
  function fishSearchUrl(fish) {
    return "https://search.bilibili.com/video?keyword=" + encodeURIComponent("Warframe " + fish.name + " " + fish.zh + " 捕鱼");
  }

  function rarityLabel(r) {
    if (r === "legendary") return "传说";
    if (r === "rare") return "稀有";
    if (r === "uncommon") return "少见";
    return "常见";
  }

  function renderZones() {
    if (!zoneGrid) return;
    zoneGrid.innerHTML = data.zones.map(function (zone) {
      const zoneFish = data.fish.filter(function (fish) { return fish.region === zone.key; });
      return '<article class="ore-zone" style="--zone-accent:' + escapeHtml(zone.accent) + '">' +
        '<div class="ore-zone__top">' +
          '<span class="ore-zone__planet">' + escapeHtml(zone.planet) + '</span>' +
          '<span class="ore-zone__count">' + zoneFish.length + '</span>' +
        '</div>' +
        '<h3>' + escapeHtml(zone.name) + '</h3>' +
        '<p>' + escapeHtml(zone.summary) + '</p>' +
        '<div class="ore-zone__vendor">鱼饵：' + escapeHtml(zone.vendor) + '</div>' +
        '<div class="ore-zone__actions">' +
          '<a class="ore-link ore-link--video" href="' + escapeHtml(videoUrl(zone.video)) + '" target="_blank" rel="noopener noreferrer">区域捕鱼视频 ↗</a>' +
          '<a class="ore-link" href="' + escapeHtml("https://search.bilibili.com/video?keyword=" + encodeURIComponent(zone.name + " 捕鱼 攻略")) + '" target="_blank" rel="noopener noreferrer">搜索更多</a>' +
        '</div>' +
      '</article>';
    }).join("");
  }

  function renderVideoStrip() {
    if (!videoLinks) return;
    const videos = [data.overviewVideo, data.baitVideo].filter(Boolean);
    videoLinks.innerHTML = videos.map(function (video) {
      return '<a class="ore-link ore-link--video" href="' + escapeHtml(videoUrl(video)) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(video.title) + ' ↗</a>';
    }).join("");
  }

  function matches(fish) {
    if (state.region !== "all" && fish.region !== state.region) return false;
    if (state.rarity !== "all" && fish.rarity !== state.rarity) return false;
    if (state.search) {
      const zone = zoneMap[fish.region];
      const blob = [fish.name, fish.zh, zone.name, zone.planet, rarityLabel(fish.rarity), fish.time, fish.habitat, zone.bait, fish.desc].join(" ").toLowerCase();
      if (blob.indexOf(state.search.toLowerCase()) === -1) return false;
    }
    return true;
  }

  function renderRow(fish) {
    const zone = zoneMap[fish.region];
    const classes = ["ore-row", "fish-row"];
    if (fish.rarity === "rare" || fish.rarity === "legendary") classes.push("is-rare");
    const bait = fish.rarity === "rare" || fish.rarity === "legendary"
      ? zone.bait + " 稀有鱼建议先用对应专用鱼饵。"
      : zone.bait;
    return '<article class="' + classes.join(" ") + '">' +
      '<div class="ore-row__name">' +
        '<h4><span class="ore-name-en">' + escapeHtml(fish.name) + '</span><span class="ore-name-zh">' + escapeHtml(fish.zh) + '</span></h4>' +
        '<div class="ore-row__badges">' +
          '<span class="ore-badge ore-badge--zone">' + escapeHtml(zone.name) + '</span>' +
          '<span class="ore-badge" data-type="' + escapeHtml(fish.rarity) + '">' + escapeHtml(rarityLabel(fish.rarity)) + '</span>' +
          '<span class="ore-badge fish-badge-time">' + escapeHtml(fish.time) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="ore-row__data">' +
        '<p><strong>获取条件</strong>' + escapeHtml(fish.time + ' · ' + fish.habitat) + '</p>' +
        '<p><strong>鱼饵</strong>' + escapeHtml(bait) + '</p>' +
      '</div>' +
      '<div class="ore-row__actions">' +
        '<a class="ore-link ore-link--video" href="' + escapeHtml(videoUrl(zone.video)) + '" target="_blank" rel="noopener noreferrer">区域视频 ↗</a>' +
        '<a class="ore-link" href="' + escapeHtml(fishSearchUrl(fish)) + '" target="_blank" rel="noopener noreferrer">搜该鱼 ↗</a>' +
      '</div>' +
    '</article>';
  }

  function renderList() {
    if (!list) return;
    const visible = data.fish.filter(matches);
    const html = data.zones.map(function (zone) {
      const rows = visible.filter(function (fish) { return fish.region === zone.key; });
      if (!rows.length) return "";
      return '<section class="ore-group">' +
        '<div class="ore-group__header"><h3>' + escapeHtml(zone.planet + ' · ' + zone.name) + '</h3><span>' + rows.length + ' 种</span></div>' +
        '<div class="ore-group__rows">' + rows.map(renderRow).join("") + '</div>' +
      '</section>';
    }).join("");
    list.innerHTML = html;
    if (emptyState) emptyState.hidden = visible.length !== 0;
    if (count) count.textContent = "显示 " + visible.length + " / " + data.fish.length + " 种鱼类";
  }

  function renderFilters() {
    const regions = [{ key: "all", label: "全部区域" }].concat(data.zones.map(function (zone) { return { key: zone.key, label: zone.name }; }));
    const rarities = [
      { key: "all", label: "全部稀有度" },
      { key: "common", label: "常见" },
      { key: "uncommon", label: "少见" },
      { key: "rare", label: "稀有" },
      { key: "legendary", label: "传说" }
    ];
    if (regionFilters) {
      regionFilters.innerHTML = regions.map(function (item) {
        return '<button class="filter-chip' + (state.region === item.key ? " is-active" : "") + '" type="button" data-region="' + escapeHtml(item.key) + '">' + escapeHtml(item.label) + '</button>';
      }).join("");
      regionFilters.querySelectorAll("[data-region]").forEach(function (button) {
        button.addEventListener("click", function () { state.region = button.getAttribute("data-region"); renderFilters(); renderList(); });
      });
    }
    if (rarityFilters) {
      rarityFilters.innerHTML = rarities.map(function (item) {
        return '<button class="filter-chip' + (state.rarity === item.key ? " is-active" : "") + '" type="button" data-rarity="' + escapeHtml(item.key) + '">' + escapeHtml(item.label) + '</button>';
      }).join("");
      rarityFilters.querySelectorAll("[data-rarity]").forEach(function (button) {
        button.addEventListener("click", function () { state.rarity = button.getAttribute("data-rarity"); renderFilters(); renderList(); });
      });
    }
  }

  function reset() {
    state.search = "";
    state.region = "all";
    state.rarity = "all";
    if (searchInput) searchInput.value = "";
    renderFilters();
    renderList();
  }

  if (searchInput) searchInput.addEventListener("input", function (e) { state.search = e.target.value.trim(); renderList(); });
  if (resetButton) resetButton.addEventListener("click", reset);

  const fishCount = document.getElementById("fishCount");
  if (fishCount) fishCount.textContent = String(data.fish.length);

  renderZones();
  renderVideoStrip();
  renderFilters();
  renderList();
})();