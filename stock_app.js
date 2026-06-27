var posMap = {"breaking_out":"刚突破","near_top":"即将突破","confirmed":"突破确认","extended":"突破延伸","other":"其他"};
var posTagClass = {"breaking_out":"tag-breaking","near_top":"tag-near","confirmed":"tag-confirmed","extended":"tag-extended","other":"tag-near"};
var upColor = "#ef5350";
var downColor = "#26a69a";
var chartInstances = [];
var currentFilter = "all";
var currentSearch = "";

function calcEMA(data, span) {
  var alpha = 2 / (span + 1);
  var ema = [data[0]];
  for (var i = 1; i < data.length; i++) {
    ema.push(alpha * data[i] + (1 - alpha) * ema[i-1]);
  }
  return ema;
}

function destroyAllCharts() {
  chartInstances.forEach(function(c) {
    try { c.dispose(); } catch(e) {}
  });
  chartInstances = [];
}

function renderStock(container, idx) {
  var s = stockData[idx];
  var code = s[0], name = s[1], position = s[2], score = s[3];
  var boxUpper = s[4], boxLower = s[5], dates = s[6], klines = s[7];
  var volumes = s[8], var7 = s[9], ma5 = s[10], ma10 = s[11], ma20 = s[12];
  var volColors = klines.map(function(k) { return k[1] >= k[0] ? upColor : downColor; });
  var upperLine = dates.map(function() { return boxUpper; });
  var lowerLine = dates.map(function() { return boxLower; });
  var var7Ema = calcEMA(var7, 5);

  var kChart = echarts.init(container.querySelector(".chart-kline"));
  kChart.setOption({
    animation: false,
    tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
    grid: { left: 50, right: 10, top: 8, bottom: 20 },
    xAxis: { type: "category", data: dates, scale: true, boundaryGap: true, axisLine: {lineStyle:{color:"#ddd"}}, axisLabel: {show:false}, axisTick: {show:false} },
    yAxis: { scale: true, splitLine:{lineStyle:{color:"#f0f0f0"}}, axisLabel:{fontSize:10,color:"#666"} },
    dataZoom: [{ type: "inside", start: 0, end: 100 }],
    series: [
      { type: "candlestick", data: klines, itemStyle: { color: upColor, color0: downColor, borderColor: upColor, borderColor0: downColor } },
      { type: "line", data: ma5, smooth: true, showSymbol: false, lineStyle: { color: "#ff9800", width: 1 } },
      { type: "line", data: ma10, smooth: true, showSymbol: false, lineStyle: { color: "#9c27b0", width: 1 } },
      { type: "line", data: ma20, smooth: true, showSymbol: false, lineStyle: { color: "#2196f3", width: 1 } },
      { type: "line", data: upperLine, showSymbol: false, lineStyle: { color: "#e91e63", width: 1, type: "dashed", opacity: 0.4 } },
      { type: "line", data: lowerLine, showSymbol: false, lineStyle: { color: "#4caf50", width: 1, type: "dashed", opacity: 0.4 } }
    ]
  });

  var vChart = echarts.init(container.querySelector(".chart-vol"));
  vChart.setOption({
    animation: false,
    tooltip: { trigger: "axis", formatter: function(p) { return p[0].axisValue + "<br>vol: " + Math.round(p[0].value/10000) + "w"; } },
    grid: { left: 50, right: 10, top: 4, bottom: 15 },
    xAxis: { type: "category", data: dates, scale: true, boundaryGap: true, axisLine: {lineStyle:{color:"#ddd"}}, axisLabel: {show:false}, axisTick: {show:false} },
    yAxis: { scale: true, axisLabel: {show:false}, axisLine: {show:false}, axisTick: {show:false}, splitLine: {show:false} },
    dataZoom: [{ type: "inside", start: 0, end: 100 }],
    series: [{ type: "bar", data: volumes.map(function(v,i) { return {value: v, itemStyle:{color: volColors[i]}}; }), barWidth: "55%" }]
  });

  var var7Chart = echarts.init(container.querySelector(".chart-var7"));
  var7Chart.setOption({
    animation: false,
    tooltip: { trigger: "axis", formatter: function(p) { var h = p[0].axisValue; p.forEach(function(x) { if(x.seriesName==="VAR7") h += "<br>VAR7: " + x.value; if(x.seriesName==="line") h += "<br>line: " + x.value.toFixed(1); }); return h; } },
    grid: { left: 50, right: 10, top: 8, bottom: 20 },
    xAxis: { type: "category", data: dates, scale: true, boundaryGap: true, axisLine: {lineStyle:{color:"#ccc"}}, axisLabel: {show:true, fontSize:9, color:"#888", rotate:40, interval:5}, axisTick: {show:false} },
    yAxis: { scale: true, max: 100, axisLabel: {fontSize:9, color:"#666", formatter: function(v) { return v.toFixed(0); }}, axisLine: {show:false}, splitLine: {lineStyle: {color:"#f0f0f0"}} },
    dataZoom: [{ type: "inside", start: 0, end: 100 }],
    series: [
      { name: "VAR7", type: "bar", data: var7.map(function(v) { return { value: v, itemStyle: {color: v >= 30 ? "#e91e63" : (v >= 15 ? "#ff9800" : "#26a69a")} }; }), barWidth: "50%" },
      { name: "line", type: "line", data: var7Ema, smooth: true, showSymbol: false, lineStyle: { color: "#4caf50", width: 1.5 }, z: 10 },
      { type: "line", data: dates.map(function() { return 30; }), showSymbol: false, lineStyle: { color: "#e91e63", width: 1, type: "dashed", opacity: 0.4 } }
    ]
  });

  function syncZoom(src, targets) {
    src.on("dataZoom", function() {
      var opt = src.getOption();
      var dz = opt.dataZoom[0];
      targets.forEach(function(t) { t.setOption({ dataZoom: [{ start: dz.start, end: dz.end }] }); });
    });
  }
  syncZoom(kChart, [vChart, var7Chart]);
  syncZoom(vChart, [kChart, var7Chart]);
  syncZoom(var7Chart, [kChart, vChart]);

  chartInstances.push(kChart, vChart, var7Chart);
}

function buildCards() {
  destroyAllCharts();
  var container = document.getElementById("stockContainer");
  container.innerHTML = "";
  var visibleCount = 0;

  stockData.forEach(function(s, idx) {
    var code = s[0], name = s[1], position = s[2], score = s[3];
    var boxUpper = s[4], boxLower = s[5];
    var klines = s[7], var7 = s[9];

    if (currentFilter !== "all" && position !== currentFilter) return;
    if (currentSearch) {
      var q = currentSearch.toLowerCase();
      if (code.toLowerCase().indexOf(q) < 0 && name.toLowerCase().indexOf(q) < 0) return;
    }
    visibleCount++;

    var posStr = posMap[position] || position;
    var tagClass = posTagClass[position] || "tag-near";
    var maxVar7 = Math.max.apply(null, var7).toFixed(1);
    var latestClose = klines[klines.length-1][1].toFixed(2);

    var card = document.createElement("div");
    card.className = "stock-card";
    card.innerHTML = '<div class="stock-header"><div class="stock-title"><span class="stock-name">' + name + '</span><span class="stock-code">' + code + '</span></div><div class="stock-tags"><span class="tag ' + tagClass + '">' + posStr + '</span><span class="tag tag-score">' + score + '</span></div></div><div class="chart-section"><div class="section-label">K线+MA</div><div class="chart-kline"></div><div class="section-label">成交量</div><div class="chart-vol"></div><div class="section-label">VAR7吸筹</div><div class="chart-var7"></div></div><div class="stats-bar"><span>上沿 <strong>' + boxUpper.toFixed(2) + '</strong></span><span>下沿 <strong>' + boxLower.toFixed(2) + '</strong></span><span>最新 <strong>' + latestClose + '</strong></span><span>VAR7峰 <strong>' + maxVar7 + '</strong></span></div>';
    container.appendChild(card);
    renderStock(card, idx);
  });

  document.getElementById("resultCount").textContent = "显示 " + visibleCount + " 只";
  if (visibleCount === 0) {
    container.innerHTML = '<div class="no-result">没有匹配的股票</div>';
  }
}

function onFilterChange() {
  var activeBtn = document.querySelector(".filter-btn.active");
  currentFilter = activeBtn ? activeBtn.getAttribute("data-filter") : "all";
  currentSearch = document.getElementById("searchInput").value.trim();
  buildCards();
}

document.getElementById("filterBar").addEventListener("click", function(e) {
  if (e.target.classList.contains("filter-btn")) {
    document.querySelectorAll(".filter-btn").forEach(function(b) { b.classList.remove("active"); });
    e.target.classList.add("active");
    onFilterChange();
  }
});

buildCards();

var resizeTimer;
window.addEventListener("resize", function() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function() {
    chartInstances.forEach(function(c) { try { c.resize(); } catch(e) {} });
  }, 200);
});
