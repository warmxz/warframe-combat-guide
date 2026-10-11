(function () {
  "use strict";

  const data = window.WARFRAME_ORE_DATA;
  if (!data) return;

  const zoneMap = {};
  data.zones.forEach(function (zone) { zoneMap[zone.key] = zone; });

  const state = {
    search: "",
    region: "all",
    type: "all"
  };

  const regionFilters = document.getElementById("oreRegionFilters");
  const typeFilters = document.getElementById("oreTypeFilters");
  const searchInput = document.getElementById("oreSearch");
  const resetButton = document.getElementById("resetOreFilters");
  const list = document.getElementById("oreList");
  const emptyState = document.getElementById("oreEmptyState");
  const count = document.getElementById("oreResultCount");
  const zoneGrid = document.getElementById("oreZoneGrid");
  const videoLinks = document.getElementById("oreVideoLinks");

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function videoUrl(video) {
    return "https://www.bilibili.com/video/" + video.bvid + "/";
  }

  function searchUrl(ore) {
    return "https://search.bilibili.com/video?keyword=" + encodeURIComponent("Warframe " + ore.zh + " " + ore.name + " 矿石 采集");
  }

  function typeLabel(type) {
    if (type === "red") return "红矿";
    if (type === "yellow") return "黄矿";
    if (type === "blue") return "蓝矿 / 宝石";
    return "精炼";
  }

  function videoLabel(video) {
    return escapeHtml(video.title) + " · " + escapeHtml(video.author || "Bilibili") + " · " + escapeHtml(video.date || "");
  }

  function renderZones() {
    if (!zoneGrid) return;
    zoneGrid.innerHTML = data.zones.map(function (zone) {
      const zoneOres = data.ores.filter(function (ore) { return ore.region === zone.key; });
      return '<article class="ore-zone" style="--zone-accent:' + escapeHtml(zone.accent) + '">' +
        '<div class="ore-zone__top">' +
          '<span class="ore-zone__planet">' + escapeHtml(zone.planet) + '</span>' +
          '<span class="ore-zone__count">' + zoneOres.length + '</span>' +
        '</div>' +
        '<h3>' + escapeHtml(zone.name) + '</h3>' +
        '<p>' + escapeHtml(zone.summary) + '</p>' +
        '<div class="ore-zone__vendor">蓝图商人：' + escapeHtml(zone.vendor) + '</div>' +
        '<div class="ore-zone__actions">' +
          '<a class="ore-link ore-link--video" href="' + escapeHtml(videoUrl(zone.video)) + '" target="_blank" rel="noopener noreferrer">区域采集路线 ↗</a>' +
          '<a class="ore-link" href="' + escapeHtml("https://search.bilibili.com/video?keyword=" + encodeURIComponent(zone.name + " 挖矿 攻略")) + '" target="_blank" rel="noopener noreferrer">搜索更多</a>' +
        '</div>' +
      '</article>';
    }).join("");
  }

  function renderVideoStrip() {
    if (!videoLinks) return;
    const videos = [data.overviewVideo, data.beginnerVideo].filter(Boolean);
    videoLinks.innerHTML = videos.map(function (video) {
      return '<a class="ore-link ore-link--video" href="' + escapeHtml(videoUrl(video)) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(video.title) + ' ↗</a>';
    }).join("");
  }

  function matches(ore) {
    if (state.region !== "all" && ore.region !== state.region) return false;
    if (state.type !== "all" && ore.type !== state.type) return false;
    if (state.search) {
      const blob = [ore.zh, ore.name, zoneMap[ore.region].name, zoneMap[ore.region].planet, typeLabel(ore.type), ore.source, ore.tool, ore.refine].join(" ").toLowerCase();
      if (blob.indexOf(state.search.toLowerCase()) === -1) return false;
    }
    return true;
  }

  function renderRow(ore) {
    const zone = zoneMap[ore.region];
    const classes = ["ore-row"];
    if (ore.rare) classes.push("is-rare");
    if (ore.type === "refined") classes.push("is-refined");
    return '<article class="' + classes.join(" ") + '">' +
      '<div class="ore-row__name">' +
        '<h4><span class="ore-name-en">' + escapeHtml(ore.name) + '</span><span class="ore-name-zh">' + escapeHtml(ore.zh) + '</span></h4>' +
        '<div class="ore-row__badges">' +
          '<span class="ore-badge ore-badge--zone">' + escapeHtml(zone.name) + '</span>' +
          '<span class="ore-badge" data-type="' + escapeHtml(ore.type) + '">' + escapeHtml(typeLabel(ore.type)) + '</span>' +
          (ore.rare ? '<span class="ore-badge" data-type="rare">稀有</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="ore-row__data">' +
        '<p><strong>获取</strong>' + escapeHtml(ore.source) + '</p>' +
        '<p><strong>' + (ore.type === "refined" ? "加工" : "工具") + '</strong>' + escapeHtml(ore.tool) + (ore.refine ? ' · ' + escapeHtml(ore.refine) : '') + '</p>' +
      '</div>' +
      '<div class="ore-row__actions">' +
        '<a class="ore-link ore-link--video" href="' + escapeHtml(videoUrl(zone.video)) + '" target="_blank" rel="noopener noreferrer">区域视频 ↗</a>' +
        '<a class="ore-link" href="' + escapeHtml(searchUrl(ore)) + '" target="_blank" rel="noopener noreferrer">搜该矿 ↗</a>' +
      '</div>' +
    '</article>';
  }

  function renderList() {
    if (!list) return;
    const visible = data.ores.filter(matches);
    const html = data.zones.map(function (zone) {
      const rows = visible.filter(function (ore) { return ore.region === zone.key; });
      if (!rows.length) return "";
      return '<section class="ore-group">' +
        '<div class="ore-group__header"><h3>' + escapeHtml(zone.planet + ' · ' + zone.name) + '</h3><span>' + rows.length + ' 种</span></div>' +
        '<div class="ore-group__rows">' + rows.map(renderRow).join("") + '</div>' +
      '</section>';
    }).join("");
    list.innerHTML = html;
    if (emptyState) emptyState.hidden = visible.length !== 0;
    if (count) count.textContent = "显示 " + visible.length + " / " + data.ores.length + " 种矿物";
  }

  function renderFilters() {
    const regions = [{ key: "all", label: "全部区域" }].concat(data.zones.map(function (zone) { return { key: zone.key, label: zone.name }; }));
    const types = [
      { key: "all", label: "全部类型" },
      { key: "red", label: "红矿" },
      { key: "yellow", label: "黄矿" },
      { key: "blue", label: "蓝矿 / 宝石" },
      { key: "refined", label: "精炼" }
    ];

    if (regionFilters) {
      regionFilters.innerHTML = regions.map(function (item) {
        return '<button class="filter-chip' + (state.region === item.key ? " is-active" : "") + '" type="button" data-region="' + escapeHtml(item.key) + '" aria-pressed="' + (state.region === item.key) + '">' + escapeHtml(item.label) + '</button>';
      }).join("");
      regionFilters.querySelectorAll("[data-region]").forEach(function (button) {
        button.addEventListener("click", function () {
          state.region = button.getAttribute("data-region");
          renderFilters();
          renderList();
        });
      });
    }

    if (typeFilters) {
      typeFilters.innerHTML = types.map(function (item) {
        return '<button class="filter-chip' + (state.type === item.key ? " is-active" : "") + '" type="button" data-type="' + escapeHtml(item.key) + '" aria-pressed="' + (state.type === item.key) + '">' + escapeHtml(item.label) + '</button>';
      }).join("");
      typeFilters.querySelectorAll("[data-type]").forEach(function (button) {
        button.addEventListener("click", function () {
          state.type = button.getAttribute("data-type");
          renderFilters();
          renderList();
        });
      });
    }
  }

  function reset() {
    state.search = "";
    state.region = "all";
    state.type = "all";
    if (searchInput) searchInput.value = "";
    renderFilters();
    renderList();
  }

  if (searchInput) {
    searchInput.addEventListener("input", function (event) {
      state.search = event.target.value.trim();
      renderList();
    });
  }

  if (resetButton) resetButton.addEventListener("click", reset);

  const oreCount = document.getElementById("oreCount");
  if (oreCount) oreCount.textContent = String(data.ores.length);

  renderZones();
  renderVideoStrip();
  renderFilters();
  renderList();
})();