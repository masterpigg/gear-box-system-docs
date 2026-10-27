/* MakerWorld panels. The links live in makerworld.js (window.MAKERWORLD);
   this file only draws them. A slot is <div class="mw-slot" data-makerworld="box:crank,box:wire2">
   or "kit:starter". An empty url shows a "coming soon" placeholder. */
(function () {
  var MW = window.MAKERWORLD || { boxes: {}, kits: {} };
  var css = document.createElement("style");
  css.textContent =
    ".mw-panel{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0 4px;font:600 .85rem/1.3 'JetBrains Mono',ui-monospace,Consolas,monospace}" +
    ".mw-panel .mw-label{opacity:.75;text-transform:uppercase;letter-spacing:.08em;font-size:.72rem}" +
    ".mw-link,.mw-soon{display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:999px;text-decoration:none;white-space:nowrap}" +
    ".mw-link{background:#00AE42;color:#fff}.mw-link:hover{filter:brightness(1.08)}" +
    ".mw-soon{border:1.5px dashed currentColor;opacity:.7}";
  document.head.appendChild(css);

  function entry(ref) {
    var p = ref.split(":"), group = p[0] === "kit" ? MW.kits : MW.boxes;
    return (group && group[p[1]]) || { name: p[1].toUpperCase(), url: "" };
  }
  function chip(e, many) {
    var label = many ? e.name : "Print files on MakerWorld";
    if (e.url) {
      var a = document.createElement("a");
      a.className = "mw-link"; a.href = e.url; a.target = "_blank"; a.rel = "noopener";
      a.textContent = (many ? e.name + " on MakerWorld" : label) + " ↗";
      return a;
    }
    var s = document.createElement("span");
    s.className = "mw-soon"; s.title = "MakerWorld link coming soon";
    s.textContent = (many ? e.name + ": " : "MakerWorld: ") + "coming soon";
    return s;
  }
  var slots = document.querySelectorAll("[data-makerworld]");
  for (var i = 0; i < slots.length; i++) {
    var refs = slots[i].getAttribute("data-makerworld").split(",");
    var box = document.createElement("div");
    box.className = "mw-panel";
    if (refs.length > 1) {
      var l = document.createElement("span");
      l.className = "mw-label"; l.textContent = "Print files";
      box.appendChild(l);
    }
    for (var j = 0; j < refs.length; j++) box.appendChild(chip(entry(refs[j]), refs.length > 1));
    slots[i].appendChild(box);
  }
})();
