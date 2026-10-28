// Gear Box System sandbox: the page. Places boxes on the 64 mm grid, finds
// the ports that mesh, turns the drives and moves every part (kin.js), and
// lists what a print would show up (kin.js's analyze(), plus the direction and
// jam checks here). Meshes come from the real .scad files (sim/export.sh).
(function () {
  "use strict";
  const K = window.GBSKin, DATA = window.GBS_DATA, C = DATA.const;
  const MESHES = window.GBS_MESHES || {};
  const D = Math.PI / 180;
  const BOXES = {};
  for (const [n, r] of Object.entries(DATA.boxes)) BOXES[n] = K.prep(r, C);
  const TEST = K.selfTest(BOXES, C);
  const GX = 12, GY = 8;                 // the table, in cells
  const CELL = C.cell;
  const REPO = "../";
  const DOC = {"adder": "adder", "beat": "percussion", "boom": "percussion", "brain": "brain", "branch": "branch", "bus": "bus", "cam": "cam", "cbdrive": "brain", "cbsense": "brain", "click": "push", "clutch": "clutch", "counter": "counter", "crank": "crank", "deck": "deck", "double": "double", "escape": "escape", "face": "face", "flip": "push", "flywheel": "flywheel", "fork": "fork", "geneva": "geneva", "governor": "governor", "half": "half", "hoist": "hoist", "meter": "meter", "motor": "motor", "orrery": "orrery", "pick": "switches", "plot": "plot", "pole2": "longwire", "pole3": "longwire", "push": "push", "quarter": "quarter", "ramp": "clocks", "ratchet": "ratchet", "reverse": "reverse", "riser": "riser", "roll": "percussion", "route": "switches", "shift": "shift", "shuffle": "shuffle", "sketch": "sketch", "spin": "spin", "square": "clocks", "steer": "switches", "store": "store", "swap": "swap", "tally": "tally", "tap": "tap", "tee": "tee", "toll": "toll", "trig": "trig", "trip": "trip", "turn": "turn", "wave": "trig", "wire": "wire", "wire2": "longwire", "wire3": "longwire", "yoke": "yoke"};

  // ---- colors by role (STANDARD.md, "Colors") ---------------------------
  const COL = { shell: 0xEDE3D0, ink: 0x1B1B1B, gear: 0xEDE8DA, drive: 0xD63A2F, in: 0x1F6FD6,
    out: 0xF28C28, show: 0x2FA84F, bought: 0x9AA0A6 };
  const MAT = {};
  for (const [k, c] of Object.entries(COL))
    MAT[k] = new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.62, metalness: 0.0 });
  // see-through walls: a second shell material, swapped in by the Walls button
  MAT.glass = new THREE.MeshStandardMaterial({ color: COL.shell, flatShading: true, roughness: 0.6, transparent: true, opacity: 0.22, depthWrite: false });
  // the family colors (lid, band, lettering) come from lib/gbs.scad as "#rrggbb"
  const matFor = c => MAT[c] || (MAT[c] = new THREE.MeshStandardMaterial({ color: new THREE.Color(c), flatShading: true, roughness: 0.62, metalness: 0.0 }));
  MAT.draftShell = new THREE.MeshStandardMaterial({ color: 0xD9D3C4, flatShading: true, roughness: 0.7, transparent: true, opacity: 0.85 });

  // ---- palette groups: the families (lib/gbs.scad's gbs_families, docs/boxes/COLORS.md) ----
  const GROUPS = [
    ["Drives", ["crank", "motor", "store", "push", "flip", "click"]],
    ["Routing", ["wire", "wire2", "wire3", "pole2", "pole3", "turn", "tap", "branch", "tee", "bus", "riser"]],
    ["Ratios", ["reverse", "double", "half", "quarter", "adder", "shift"]],
    ["Motion shapers", ["geneva", "ratchet", "clutch", "cam", "trip", "escape", "governor", "yoke", "flywheel", "hoist"]],
    ["Switches and clocks", ["route", "pick", "steer", "swap", "square", "ramp"]],
    ["Readouts", ["meter", "counter", "toll", "tally", "face", "trig", "wave", "plot", "sketch", "orrery"]],
    ["Chance", ["spin", "fork", "shuffle"]],
    ["Sound and rhythm", ["beat", "boom", "roll"]],
    ["Side exploration", ["brain", "cbdrive", "cbsense"]],
  ];

  // ---- example layouts (demo/layout.scad, and two more) -----------------------
  const EXAMPLES = {
    demo1: [["crank", 0, 0], ["quarter", 1, 0], ["reverse", 2, 0], ["tap", 0, 1], ["tee", 1, 1], ["counter", 2, 1]],
    demo2: [["crank", 0, 0], ["bus", 0, 1], ["reverse", 1, 1], ["quarter", 1, 2], ["wire", 1, 0], ["turn", 2, 0], ["meter", 2, 1]],
    demo3: [["motor", 0, 0], ["counter", 2, 0], ["wire", 1, 1]],
    mistakes: [["crank", 0, 0], ["reverse", 1, 0], ["ratchet", 2, 0],
      ["tap", 0, 1], ["wire", 1, 1], ["wire", 2, 1], ["wire", 3, 1], ["wire", 4, 1], ["wire", 5, 1], ["wire", 6, 1],
      ["wire", 7, 1], ["wire", 8, 1], ["counter", 9, 1],
      ["crank", 0, 4], ["riser", 1, 3],
      ["crank", 4, 4], ["reverse", 5, 4], ["counter", 6, 4]],
    swap: [["crank", 0, 0], ["square", 1, 0], ["tap", 0, 1], ["steer", 1, 1], ["counter", 2, 1], ["tap", 1, 2], ["counter", 2, 2]],
    spring: [["store", 0, 0], ["reverse", 1, 0], ["meter", 2, 0]],
    shift: [["crank", 0, 0], ["clutch", 1, 0], ["shift", 2, 0], ["meter", 3, 0]],
    swapbox: [["crank", 0, 1], ["swap", 1, 0], ["counter", 2, 1], ["tap", 1, 2], ["counter", 2, 2]],
    tally: [["crank", 0, 0], ["tally", 1, 0]],
    plot: [["crank", 0, 0], ["turn", 1, 0], ["tap", 0, 1], ["plot", 1, 1]],
    // one MOTOR, three PLOTs: a square, a triangle and a sine on one time base
    // (docs/boxes/branch.md)
    // SKETCH (docs/boxes/sketch.md): a clock on paper, and one motor, three
    // SKETCHes (square, triangle, sine), the WIRE pairs as WIRE 2s
    sketch: [["crank", 0, 0], ["tee", 1, 0], ["ramp", 2, 0], ["sketch", 1, 1]],
    sketch3: [["motor", 0, 0], ["wire2", 2, 0], ["tee", 4, 0], ["wire2", 5, 0], ["turn", 7, 0],
      ["tap", 1, 1], ["tee", 2, 1], ["square", 3, 1, { pair: 140, phase: 60 }], ["sketch", 2, 2],
      ["tap", 4, 1], ["tee", 5, 1], ["ramp", 6, 1, { f: 0.5 }], ["sketch", 5, 2],
      ["tap", 7, 1], ["tee", 8, 1], ["ramp", 9, 1, { f: "sine" }], ["sketch", 8, 2]],
    threeplots: [["motor", 0, 0], ["bus", 1, 1], ["turn", 2, 1], ["branch", 1, 3], ["branch", 1, 4], ["square", 2, 3],
      ["branch", 1, 5], ["ramp", 2, 5], ["tap", 1, 6], ["plot", 2, 2], ["plot", 2, 4], ["plot", 2, 6]],
  // ---- kits (docs/boxes/KITS.md) ----
    kit_s1: [["crank", 0, 0], ["counter", 1, 0]],   // First Turns 1: Count your turns
    kit_s2: [["crank", 0, 0], ["double", 1, 0], ["quarter", 2, 0], ["counter", 3, 0]],   // First Turns 2: Faster and slower
    kit_s3: [["crank", 0, 0], ["reverse", 1, 0], ["counter", 2, 0]],   // First Turns 3: Backwards
    kit_s4: [["crank", 0, 0], ["turn", 1, 0], ["tap", 1, 1], ["counter", 2, 1]],   // First Turns 4: Up a row
    kit_s5: [["crank", 0, 0], ["tee", 1, 0], ["reverse", 2, 0], ["quarter", 3, 0], ["turn", 4, 0], ["tap", 0, 1], ["wire", 1, 1], ["double", 2, 1], ["counter", 3, 1]],   // First Turns 5: The whole kit
    kit_c1: [["crank", 0, 0], ["ratchet", 1, 0], ["counter", 2, 0]],   // Tick Tock 1: One way only
    kit_c2: [["crank", 0, 0], ["flywheel", 1, 0], ["counter", 2, 0]],   // Tick Tock 2: Keep it spinning
    kit_c3: [["store", 0, 0], ["governor", 1, 0]],   // Tick Tock 3: Wind it up
    kit_c4: [["store", 0, 0], ["toll", 1, 0], ["escape", 2, 0]],   // Tick Tock 4: A clock
    kit_c5: [["store", 0, 0], ["tee", 1, 0], ["escape", 2, 0], ["face", 1, 1]],   // Tick Tock 5: A clock with a face
    kit_l1: [["crank", 0, 0], ["route", 1, 0], ["counter", 2, 0], ["tap", 1, 1], ["counter", 2, 1]],   // Gear Logic 1: Choose a way
    kit_l2: [["crank", 0, 0], ["quarter", 1, 0], ["turn", 2, 0], ["tap", 0, 1], ["wire", 1, 1], ["pick", 2, 1], ["counter", 3, 1]],   // Gear Logic 2: Choose a source
    kit_l3: [["crank", 0, 0], ["square", 1, 0], ["tap", 0, 1], ["steer", 1, 1], ["counter", 2, 1], ["tap", 1, 2], ["counter", 2, 2]],   // Gear Logic 3: A clock decides
    kit_l4: [["crank", 0, 1], ["swap", 1, 0], ["counter", 2, 1], ["tap", 1, 2], ["counter", 2, 2]],   // Gear Logic 4: Every other turn
    kit_l5: [["crank", 0, 0], ["tee", 1, 0], ["trip", 2, 0], ["tap", 1, 1], ["counter", 2, 1]],   // Gear Logic 5: Remember it happened
    kit_m1: [["crank", 0, 1], ["adder", 1, 1], ["crank", 1, 0], ["counter", 2, 0], ["double", 2, 2], ["counter", 3, 2]],   // Gear Calculator 1: Add two motions
    kit_m2: [["crank", 0, 1], ["reverse", 1, 1], ["adder", 2, 1], ["crank", 2, 0], ["double", 3, 2], ["counter", 4, 2]],   // Gear Calculator 2: Subtract
    kit_m3: [["crank", 0, 0], ["double", 1, 0], ["half", 2, 0], ["counter", 3, 0]],   // Gear Calculator 3: Undo a ratio
    kit_m4: [["crank", 0, 0], ["double", 1, 0], ["tally", 2, 0]],   // Gear Calculator 4: Count big
    kit_x1: [["motor", 0, 0], ["clutch", 2, 0], ["shift", 3, 0], ["counter", 4, 0]],   // Motion and Power 1: Change gear
    kit_x2: [["motor", 0, 0], ["tee", 2, 0], ["geneva", 3, 0], ["tap", 2, 1], ["cam", 3, 1]],   // Motion and Power 2: Steps and lifts
    kit_x3: [["motor", 0, 0], ["yoke", 2, 0]],   // Motion and Power 3: Round to straight
    kit_x4: [["motor", 0, 1], ["plot", 2, 1], ["crank", 2, 0]],   // Motion and Power 4: Draw with your hand
    kit_x5: [["motor", 0, 0], ["clutch", 2, 0], ["hoist", 3, 0]],   // Motion and Power 5: Lift and hold
    kit_p1: [["crank", 0, 0], ["spin", 1, 0], ["counter", 2, 0]],   // Party 1: Spin the wheel
    kit_p2: [["crank", 0, 0], ["fork", 1, 0], ["beat", 2, 0], ["tap", 1, 1], ["boom", 2, 1]],   // Party 2: Let the line decide
    kit_p3: [["crank", 0, 0], ["shuffle", 1, 0]],   // Party 3: Deal a number
    kit_p4: [["crank", 0, 0], ["beat", 1, 0], ["roll", 2, 0]],   // Party 4: A drummer
    kit_p5: [["crank", 0, 0], ["tee", 1, 0], ["beat", 2, 0], ["roll", 3, 0], ["tap", 1, 1], ["boom", 2, 1]],   // Party 5: The band
    clock: [["store", 0, 0], ["toll", 1, 0], ["escape", 2, 0]],
    keys: [["push", 0, 0], ["counter", 1, 0], ["flip", 0, 2], ["meter", 1, 2], ["click", 0, 4], ["counter", 1, 4]],
    chance: [["crank", 0, 0], ["spin", 1, 0], ["fork", 2, 0], ["counter", 3, 0], ["tap", 2, 1], ["counter", 3, 1]],
    face: [["store", 0, 0], ["tee", 1, 0], ["escape", 2, 0], ["face", 1, 1]],
    adder: [["crank", 0, 1], ["adder", 1, 1], ["crank", 1, 0], ["double", 2, 2], ["counter", 3, 2], ["meter", 3, 0], ["quarter", 2, 0]],
  };

  // ---- state ----------------------------------------------------------------
  let items = [];                 // [{uid, name, x, y}]
  let nextUid = 1;
  let A = null;                   // kin.analyze() of the layout
  let dyn = { issues: [] };       // direction checks
  const angle = {};               // drive uid -> angle (crank: K forward; motor: the pinion)
  const mode = {};                // drive uid -> 1 run, 0 hold, -1 reverse
  let dir = 1, playing = false, rpm = 15;
  let selected = null, placing = null, jam = null;
  let zeroSpins = new Map(), spinsNow = new Map(), holdState = {};
  let showLids = false, showNames = true, glass = false, frameDt = 0;

  // ---- three.js -------------------------------------------------------------
  const view = document.getElementById("view");
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  view.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 5, 6000);
  camera.up.set(0, 0, 1);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.12;
  controls.maxPolarAngle = Math.PI * 0.49;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8072, 0.85));
  const sun = new THREE.DirectionalLight(0xffffff, 0.75); sun.position.set(-300, -500, 900); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.25); fill.position.set(600, 400, 300); scene.add(fill);

  function themeBg() {
    const c = getComputedStyle(document.documentElement).getPropertyValue("--canvas").trim() || "#ece6da";
    scene.background = new THREE.Color(c);
  }
  themeBg();
  if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", themeBg);

  // the table and its grid
  const table = new THREE.Mesh(new THREE.PlaneGeometry(GX * CELL, GY * CELL),
    new THREE.MeshStandardMaterial({ color: 0xcfc6b4, roughness: 1 }));
  table.position.set(GX * CELL / 2, GY * CELL / 2, -0.05);
  scene.add(table);
  {
    const pts = [];
    for (let i = 0; i <= GX; i++) pts.push(i * CELL, 0, 0.02, i * CELL, GY * CELL, 0.02);
    for (let j = 0; j <= GY; j++) pts.push(0, j * CELL, 0.02, GX * CELL, j * CELL, 0.02);
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9c927f })));
    // N arrow
    const s = textSprite("N ↑", "#6b6558", 0.16); s.position.set(-20, GY * CELL - 10, 1); scene.add(s);
  }

  // ---- meshes -----------------------------------------------------------------
  const GEO = {};
  function b64(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
  function geom(box, part) {
    const key = box + "/" + part;
    if (key in GEO) return GEO[key];
    const i = MESHES.boxes && MESHES.boxes[box] ? MESHES.boxes[box][part] : undefined;
    const m = i === undefined ? null : MESHES.pool[i];
    let g = null;
    if (m) {
      const q = new Int16Array(b64(m[1])), pos = new Float32Array(q.length);
      for (let i = 0; i < q.length; i++) pos[i] = q[i] / 100;
      const idx = m[0] < 65536 ? new Uint16Array(b64(m[2])) : new Uint32Array(b64(m[2]));
      g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      g.computeBoundingSphere();
    } else g = fallback(box, part);
    return (GEO[key] = g);
  }
  // no meshes.js: plain shapes from the data (a shell and the pitch circles)
  function fallback(box, part) {
    const bx = BOXES[box];
    if (part === "shell") {
      const w = bx.half[0] * 2 - 2.6, h = bx.half[1] * 2 - 2.6;
      const g = new THREE.BoxGeometry(w, h, 2); g.translate(0, 0, 1); return g;
    }
    if (part.startsWith("stack_")) {
      const s = bx.st[part.slice(6)];
      const gs = s.gears.map(gr => {
        const t = typeof gr[1] === "number" ? gr[1] : 20;
        const c = new THREE.CylinderGeometry(t / 2 + 0.6, t / 2 + 0.6, 4, Math.max(12, t), 1);
        c.rotateX(Math.PI / 2); c.translate(0, 0, C.lz[gr[0] - 1] + 2);
        return c;
      });
      return gs.length === 1 ? gs[0] : mergeGeoms(gs);
    }
    return null;
  }
  function mergeGeoms(gs) {
    let n = 0, m = 0;
    for (const g of gs) { const x = g.toNonIndexed(); n += x.attributes.position.count; }
    const pos = new Float32Array(n * 3);
    for (const g of gs) { const x = g.toNonIndexed(); pos.set(x.attributes.position.array, m); m += x.attributes.position.array.length; }
    const out = new THREE.BufferGeometry(); out.setAttribute("position", new THREE.BufferAttribute(pos, 3)); out.computeVertexNormals();
    return out;
  }

  // what a part is: its color, and what moves it
  function partInfo(bx, part) {
    // the family's lid and lettering (a box outside every family keeps a
    // bone lid, black lettering); a part in the lid's own color on the lid
    // prints white (gbs_on_lid: the crank wheel and SPRING's knob on Drives)
    const fam = (C.families || []).find(f => f[3].includes(bx.name));
    const lidCol = fam ? fam[1] : "shell", inkCol = fam ? fam[2] : "ink";
    const onLid = m => fam && COL[m] === parseInt(fam[1].slice(1), 16) ? "gear" : m;
    // a switch's and a clock's own parts (lib/switch.scad, lib/clock.scad)
    if (part.startsWith("sw_")) return {
      sw_arm: { mat: "gear", sw: "arm" }, sw_idler: { mat: "gear", sw: "idler" }, sw_ipin: { mat: "shell", sw: "ipin" },
      sw_sleeve: { mat: "shell" }, sw_knob: { mat: "in", sw: "knob" }, sw_knobink: { mat: "ink", sw: "knob" },
      sw_detent: { mat: "shell" }, sw_latch: { mat: "in" }, sw_dial: { mat: "show", sw: "arm" }, sw_dialink: { mat: "ink", sw: "arm" },
    }[part] || { mat: "gear" };
    // the spring store's (lib/store.scad): the barrel and its spring turn with
    // B, the arbor and its knob with A
    if (part.startsWith("sto_spring_")) return { mat: "gear", turn: "B", stoSpring: +part.slice(11) };
    if (part.startsWith("sto_")) return { sto_barrel: { mat: "gear", turn: "B" }, sto_arbor: { mat: "gear", turn: "A" },
      sto_knob: { mat: onLid("drive"), turn: "A" }, sto_plunger: { mat: onLid("drive"), sto: "plunger" }, sto_pawl: { mat: "shell", sto: "pawl" } }[part] || { mat: "gear" };
    // the shift box's stick (lib/shift.scad) and the swap box's tumbler
    // (lib/swap.scad): turned round O, or A, by update()
    if (part.startsWith("sh_")) return { sh_arm: { mat: "gear", sh: "arm" }, sh_idler: { mat: "gear", sh: "idler" },
      sh_ipin: { mat: "shell", sh: "ipin" }, sh_lever: { mat: "in", sh: "lever" } }[part] || { mat: "gear" };
    if (part.startsWith("sx_")) return { sx_arm: { mat: "gear", sh: "arm" }, sx_idler: { mat: "gear", sh: "idler" },
      sx_ipin: { mat: "shell", sh: "ipin" }, sx_sleeve: { mat: "shell", sh: "sleeve" }, sx_dial: { mat: "show", sh: "dial" },
      sx_dialink: { mat: "ink", sh: "dial" }, sx_cam: { mat: "gear", turn: "Y" }, sx_slider: { mat: "show", sxSlide: true } }[part] || { mat: "gear" };
    if (part === "T_lower" || part === "T_upper") return { mat: "gear", turn: "T" };   // TALLY's middle wheel
    if (part.startsWith("tp_")) return topInfo(bx, part.slice(3));
    // the keys (lib/push.scad): the slider and key slide west as it goes in,
    // the bat turns with K, CLICK's pawl hub P with the pinion
    if (part.startsWith("pu_")) return { pu_slider: { mat: "gear", keySlide: true }, pu_key: { mat: onLid("drive"), keySlide: true },
      pu_bat: { mat: "show", turn: "K" }, pu_stop: { mat: "shell" }, pu_kclick: { mat: "gear", turn: "K" }, pu_p: { mat: "gear", turn: "P" } }[part] || { mat: "gear" };
    // the clock face (lib/face.scad): the center wheel, the minute tube and the
    // hour wheel turn about the dial's center, each hand by its own travel
    if (part.startsWith("fc_")) return { fc_wheel: { mat: "gear", turn: "W" }, fc_minute: { mat: "gear", turn: "M" },
      fc_hour: { mat: "gear", turn: "H" }, fc_hand_s: { mat: "show", turn: "hS" }, fc_hand_h: { mat: "show", turn: "hH" },
      fc_hand_m: { mat: "show", turn: "hM" }, fc_rod: { mat: "bought" } }[part] || { mat: "gear" };
    // the plot box's top (lib/plot.scad): the disc on R, the miter on T; the
    // shafts' parts turn about the shafts, the sprockets and the frame ride
    // north and south with the yoke, the links go round the loop (update())
    if (part.startsWith("pl_")) return { pl_disc: { mat: "gear", turn: "R" }, pl_miter_T: { mat: "gear", turn: "T" },
      pl_miter_shaft: { mat: "gear", pl: "E" }, pl_shaft_E: { mat: "gear", pl: "E" }, pl_shaft_W: { mat: "gear", pl: "W" },
      pl_sprocket_E: { mat: "gear", pl: "E", plRide: true }, pl_sprocket_W: { mat: "gear", pl: "W", plRide: true },
      pl_collars_E: { mat: "shell", pl: "E" }, pl_collars_W: { mat: "shell", pl: "W" },
      pl_frame: { mat: "gear", plRide: true }, pl_link: { mat: "gear", plLink: false }, pl_marker: { mat: "show", plLink: true } }[part] || { mat: "gear" };
    // the escapement's (lib/escape.scad): C, and the anchor and its foliot on A
    if (part.startsWith("esc_balls_")) return { mat: "bought", turn: "A", balls: +part.slice(10) };
    if (part.startsWith("esc_")) return { esc_c: { mat: "gear", turn: "C" }, esc_anchor: { mat: "gear", turn: "A" },
      esc_foliot: { mat: "show", turn: "A" } }[part] || { mat: "gear" };
    if (part.startsWith("clk_plate_")) { const v = part.slice(10); return { mat: "gear", plate: isNaN(+v) ? v : +v }; }
    if (part.startsWith("clk_")) return { clk_c: { mat: "gear", turn: "C" }, clk_cap: { mat: "shell" },
      clk_slider: { mat: "show", clkSlide: true }, clk_finger: { mat: "gear", clkSlide: true } }[part] || { mat: "gear" };
    const u = part.indexOf("_"), head = u < 0 ? part : part.slice(0, u), id = u < 0 ? null : part.slice(u + 1);
    const port = id && bx.ports.find(p => p.id === id);
    switch (head) {
      case "shell": return { mat: bx.kind === "draft" ? "draftShell" : "shell" };
      case "lid": return { mat: lidCol, lid: true };
      case "lidink": return { mat: inkCol, lid: true };
      case "band": return { mat: lidCol, band: true };
      case "keeper": case "spacer": return { mat: "shell" };
      case "sleeve": case "cap": return { mat: "shell", at: id };
      case "stack": return { mat: port ? (port.input ? "in" : "out") : "gear", turn: id };
      case "dial": case "wheel": return { mat: "show", turn: id };
      case "dialink": case "wheelink": return { mat: "ink", turn: id };
      case "crank": return { mat: onLid("drive"), turn: id };
      case "arm": case "cam": case "hub": return { mat: "gear", turn: id };
      case "rotor": return { mat: "show", turn: id };
      case "latch": return { mat: "in", latch: true };
      case "latchspring": return { mat: "bought", latch: true, spring: true };
      case "fly": return { mat: "show", turn: id };
      case "planet": return { mat: "gear", planet: true };
      case "follower": return { mat: "gear", follower: true };
      case "followercap": return { mat: "show", follower: true };
      case "slider": return { mat: "show", slider: true };
      case "bought": return { mat: "bought" };
      case "pad": case "spring": return { mat: "gear" };
      case "knob": return { mat: "drive" };
    }
    return { mat: "gear" };
  }

  // ---- the tops of the boxes that came out of draft (export_data.scad's
  // sim_tops): what each part is and how it moves. turn: with a stack, or a
  // pivot of the top's own (topPivots); tp: placed by topPose()
  const MUS_WHEEL = { beat: "T", boom: "C", roll: "D" };
  function topInfo(bx, n) {
    const b = bx.name, mus = MUS_WHEEL[b];
    if (b === "spin") return { driver: { mat: "gear", turn: "S" }, cap: { mat: "gear", turn: "S" }, pinion: { mat: "gear", turn: "O" },
      spinner: { mat: "show", turn: "spinner" }, spinner_ink: { mat: "ink", turn: "spinner" }, detent: { mat: "shell" } }[n] || { mat: "gear" };
    if (b === "fork") return { carrier: { mat: "gear", turn: "carrier" }, wheel: { mat: "show", turn: "carrier" },
      wheel_ink: { mat: "ink", turn: "carrier" }, planet: { mat: "gear", tp: "fkPlanet", copies: 3 },
      pcap: { mat: "shell", tp: "fkCap", copies: 3 }, detent: { mat: "shell" }, latch: { mat: "in" } }[n] || { mat: "gear" };
    if (b === "trig") return { disc: { mat: "gear", turn: "R1" }, disc_ink: { mat: "ink", turn: "R1" }, arm: { mat: "show", turn: "R2" },
      arm_ink: { mat: "ink", turn: "R2" }, ycos: { mat: "show", tp: "ycos" }, ycos_ink: { mat: "ink", tp: "ycos" },
      ysin: { mat: "show", tp: "ysin" }, ysin_ink: { mat: "ink", tp: "ysin" } }[n] || { mat: "gear" };
    if (b === "wave") return { disc: { mat: "gear", turn: "R" }, pinion: { mat: "gear", turn: "P" }, carriage: { mat: "gear", tp: "carriage" },
      penbar: { mat: "show", tp: "penbar" }, pen: { mat: "show", tp: "pen" } }[n] || { mat: "gear" };
    if (b === "shuffle") {
      if (n.startsWith("follower_")) return { mat: "show", tp: "rise", i: +n.slice(9) - 1 };
      if (n.startsWith("fpulley_")) return { mat: "gear", tp: "rise", i: +n.slice(8) - 1 };
      return { dial: { mat: "show", turn: "dial" }, dial_ink: { mat: "ink", turn: "dial" }, dial_cap: { mat: "shell" } }[n] || { mat: "gear" };
    }
    if (b === "orrery") {
      const k = +n.slice(n.indexOf("_") + 1);
      if (n.startsWith("tube_")) return { mat: "gear", turn: "T" + k };
      if (n.startsWith("arm_")) return { mat: "show", turn: "T" + k };
      if (n.startsWith("planet_")) return { mat: C.tp_orr[1][k - 1][4], turn: "B" + k };
      return n === "sun" ? { mat: "#F2C230" } : { mat: "bought" };
    }
    if (b === "hoist") return { stackA: { mat: "gear", turn: "A" }, winch: { mat: "gear", turn: "D" }, rod: { mat: "bought" },
      caps: { mat: "shell" }, mast: { mat: "shell" }, pulley: { mat: "gear", turn: "PU" }, pcap: { mat: "shell" },
      bucket: { mat: "shell", tp: "hsBucket" } }[n] || { mat: "gear" };
    if (K.BRAIN_DRIVE[b] || b === "cbsense") {
      if (n.startsWith("puck_")) return { mat: "show", turn: n.slice(5) };
      return { mat: n.startsWith("hood_") ? "shell" : "bought" };
    }
    if (b === "sketch") return { knob_X: { mat: onLidSk(bx, "drive"), turn: "PX" }, knob_Y: { mat: onLidSk(bx, "drive"), turn: "PY" },
      carriage: { mat: "gear", tp: "skCarriage" }, penbar: { mat: "show", tp: "skPenbar" }, pen: { mat: "show", tp: "skPen" }, gate: { mat: "shell" } }[n] || { mat: "gear" };
    if (mus) {
      if (n === "wheel") return { mat: "gear", turn: mus };
      const u = n.indexOf("_"), head = u < 0 ? n : n.slice(0, u), k = u < 0 ? "" : n.slice(u);
      if (head === "key" || head === "beater" || head === "ball")
        return { mat: head === "key" ? "gear" : head === "beater" ? "show" : "bought", tp: "keyrot", k };
      return { mat: "shell" };
    }
    return { mat: "gear" };
  }
  // the tops' own pivots: SPIN's spinner, FORK's carrier, SHUFFLE's dial, the
  // orrery's tubes (T) and planets (B, the tube less its rest)
  function topPivots(it) {
    const at = { spin: [["spinner", C.tp_spin && C.tp_spin[0]]], fork: [["carrier", [0, 0]]],
      shuffle: [["dial", C.tp_shuf && C.tp_shuf[2]]],
      orrery: C.tp_orr ? C.tp_orr[1].flatMap((_, i) => [["T" + (i + 1), C.tp_orr[0]], ["B" + (i + 1), C.tp_orr[0]]]) : [],
      // HOIST: the winch and the pulley turn about east-west axles
      hoist: C.tp_hoist ? [["D", C.tp_hoist[0], "x"], ["PU", C.tp_hoist[1], "x"]] : [] }[it.name] || [];
    return at.filter(([, c]) => c);
  }
  // the spins of those pivots
  function topSpins(it, bx, sp) {
    const o = {};
    if (it.name === "shuffle" && C.tp_shuf) o.dial = -30 * shufRises(bx, sp).reduce((a, b) => a + b, 0) / C.tp_shuf[1];
    if (it.name === "hoist" && C.tp_hoist) {
      const h = hsState(sp, zeroSpins.get(it.uid)); o.D = h.D; o.PU = h.pulley;
    }
    if (it.name === "orrery" && C.tp_orr) {
      const c = C.tp_orr[0], s = bx.st.S.pos, a0 = Math.atan2(c[1] - s[1], c[0] - s[0]) / D;
      C.tp_orr[1].forEach(([a, b, , s0], i) => { const t = K.meshSpin(a, sp.S || 0, a0, b); o["T" + (i + 1)] = t; o["B" + (i + 1)] = t - s0; });
    }
    return o;
  }
  // SKETCH's pen (lib/sketch.scad's sk_at): each pinion moves its rack until
  // the rack runs off it, then the pen stays at that end
  function skAt(sp) {
    const [pr, px0, py0, stx, sty] = C.tp_sketch, cl = (v, s) => Math.max(s[0], Math.min(s[1], v));
    return [cl(-pr * ((sp.PX || 0) - px0) * D, stx), cl(-pr * ((sp.PY || 0) - py0) * D, sty)];
  }
  // a part in the lid's own color prints white (as onLid in partInfo)
  function onLidSk(bx, m) {
    const fam = (C.families || []).find(f => f[3].includes(bx.name));
    return fam && COL[m] === parseInt(fam[1].slice(1), 16) ? "gear" : m;
  }
  // HOIST (lib/hoist.scad's hs_spins, hs_lift): the wheel turns 1/20 of A;
  // the string wound on the drum lifts the bucket, from the lid to the pulley;
  // it stands on the lid with the drives at zero (z: the spins then)
  function hsState(sp, z) {
    const [, , k, ph, , rs, rp, top] = C.tp_hoist, D = k * (sp.A || 0) + ph, D0 = k * ((z || {}).A || 0) + ph;
    const lift = Math.min(top, Math.max(0, (D - D0) * Math.PI / 180 * rs));
    return { D, lift, pulley: -lift / rp * 180 / Math.PI };
  }
  // SHUFFLE's three followers: each one's rise over its cam (a heart)
  function shufRises(bx, sp) {
    return bx.bought.filter(f => f[0] === "follower").map(q => {
      const st = bx.st[q[2][0]], rel = Math.atan2(q[1][1] - st.pos[1], q[1][0] - st.pos[0]) / D - (sp[st.id] || 0);
      return followerZ(st.extra || "heart", rel) - C.tp_shuf[0];
    });
  }
  // a sound box's key lift (degrees) at its wheel's spin, from the table
  function musTheta(name, k, spin) {
    const e = ((C.tp_mus || []).find(r => r[0] === name) || [, []])[1].find(r => r[0] === k);
    if (!e) return { th: 0, e: null };
    const t = e[3], n = t.length, u = ((spin % 360) + 360) % 360 * n / 360, i = Math.floor(u), f = u - i;
    return { th: t[i % n] * (1 - f) + t[(i + 1) % n] * f, e };
  }
  function addTop(v, it, m, info) {
    const tp = v.tp = v.tp || [];
    if (info.tp === "keyrot") {
      const e = musTheta(it.name, info.k, 0).e, g = new THREE.Group();
      if (e) { g.position.set(e[1], 0, e[2]); m.position.set(-e[1], 0, -e[2]); }
      g.add(m); v.group.add(g); tp.push({ kind: "keyrot", k: info.k, m: g });
      return;
    }
    v.group.add(m); tp.push({ kind: info.tp, i: info.i, m });
  }
  function topPose(it, bx, v, sp) {
    const ax = it.name === "fork" ? Math.atan2(bx.st.X.pos[1], bx.st.X.pos[0]) / D : 0;
    const rises = it.name === "shuffle" && C.tp_shuf ? shufRises(bx, sp) : null;
    for (const t of v.tp) {
      const m = t.m;
      if (t.kind === "fkPlanet" || t.kind === "fkCap") {
        const R = C.tp_fork[0], a = (sp.carrier || 0) + ax + 120 * t.i;
        m.position.set(R * Math.cos(a * D), R * Math.sin(a * D), 0);
        if (t.kind === "fkPlanet") m.rotation.z = (sp["P" + t.i] || 0) * D;
      } else if (t.kind === "ycos" || t.kind === "ysin") {
        const [c, r, s0] = C.tp_trig, th = ((sp.R1 || 0) - s0) * D;
        if (t.kind === "ycos") m.position.set(c[0] + r * Math.cos(th), c[1], 0); else m.position.set(c[0], c[1] + r * Math.sin(th), 0);
      } else if (t.kind === "carriage" || t.kind === "penbar" || t.kind === "pen") {
        const [r, s0, xs] = C.tp_wave, th = (sp.R || 0) - s0, q = [xs + r * th * D, r * Math.sin(th * D)];
        if (t.kind === "carriage") m.position.x = q[0]; else if (t.kind === "penbar") m.position.y = q[1]; else m.position.set(q[0], q[1], 0);
      } else if (t.kind === "rise") m.position.z = rises ? rises[t.i] : 0;
      else if (t.kind === "skCarriage" || t.kind === "skPenbar" || t.kind === "skPen") {
        const q = skAt(sp);
        if (t.kind === "skCarriage") m.position.x = q[0]; else if (t.kind === "skPenbar") m.position.y = q[1]; else m.position.set(q[0], q[1], 0);
      }
      else if (t.kind === "hsBucket") m.position.z = hsState(sp, zeroSpins.get(it.uid)).lift;
      else if (t.kind === "keyrot") m.rotation.y = -musTheta(it.name, t.k, sp[MUS_WHEEL[it.name]] || 0).th * D;
    }
  }

  function textSprite(text, color, scale) {
    const cv = document.createElement("canvas"), ctx = cv.getContext("2d");
    const f = 64; ctx.font = "600 " + f + "px system-ui, sans-serif";
    const w = Math.ceil(ctx.measureText(text).width) + 28;
    cv.width = w; cv.height = f + 24;
    ctx.font = "600 " + f + "px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,253,248,0.88)";
    roundRect(ctx, 0, 0, w, f + 24, 16); ctx.fill();
    ctx.fillStyle = color; ctx.textBaseline = "middle"; ctx.fillText(text, 14, (f + 24) / 2 + 2);
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sp.scale.set(w * scale, (f + 24) * scale, 1);
    sp.renderOrder = 10;
    return sp;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // ---- one box in the scene -------------------------------------------------
  const VIEWS = new Map();   // uid -> {group, pivots, planets, follower, slider, lids, outline, label, markers}
  const pickables = [];
  function buildBox(it) {
    const bx = BOXES[it.name];
    const group = new THREE.Group();
    const v = { group, pivots: {}, planets: [], follower: [], slider: [], latch: [], lids: [], markers: [], sw: {}, plates: [], clkSlide: [], sto: { springs: [], plunger: [], pawl: [] } };
    for (const s of Object.values(bx.st)) {
      const outer = new THREE.Group();
      outer.position.set(s.pos[0], s.pos[1], s.top === "motor" ? C.bev_za : 0);
      const inner = new THREE.Group();
      if (s.top === "motor") inner.position.z = -C.bev_za;
      outer.add(inner); group.add(outer);
      v.pivots[s.id] = { outer, inner, axis: s.top === "motor" ? "x" : "z" };
    }
    if (it.name === "click") {   // P, on K's axis
      const outer = new THREE.Group(), inner = new THREE.Group();
      outer.add(inner); group.add(outer); v.pivots.P = { outer, inner, axis: "z" };
    }
    if (it.name === "face")   // the wheels and hands that aren't stacks: about the center, the seconds hand about B
      for (const [id, c] of [["W", [0, 0]], ["M", [0, 0]], ["H", [0, 0]], ["hM", [0, 0]], ["hH", [0, 0]], ["hS", bx.st.B.pos]]) {
        const outer = new THREE.Group(), inner = new THREE.Group();
        outer.position.set(c[0], c[1], 0); outer.add(inner); group.add(outer);
        v.pivots[id] = { outer, inner, axis: "z" };
      }
    for (const [id, c, axis] of topPivots(it)) {
      const outer = new THREE.Group(), inner = new THREE.Group();
      outer.position.set(c[0], c[1], c[2] || 0); outer.add(inner); group.add(outer);
      v.pivots[id] = { outer, inner, axis: axis || "z" };
    }
    if (it.name === "store") {   // the arbor: on B's pin, not a stack of the box
      const outer = new THREE.Group(), inner = new THREE.Group();
      outer.position.set(C.sto[0][0], C.sto[0][1], 0); outer.add(inner); group.add(outer);
      v.pivots.A = { outer, inner, axis: "z" };
    }
    for (const part of bx.parts) {
      const g = geom(it.name, part);
      if (!g) continue;
      const info = partInfo(bx, part);
      if (info.planet) {
        for (let k = 0; k < 3; k++) { const m = mesh(g, info.mat, it.uid); group.add(m); v.planets.push(m); }
        continue;
      }
      if (info.plate !== undefined) {
        // a clock's plate pair: the bottom one, and the top one a plate up,
        // turned back by the phase; only the pair that is set shows
        for (let k = 0; k < 2; k++) {
          const m = mesh(g, info.mat, it.uid), hold = new THREE.Group();
          m.position.z = k * C.clk[5]; hold.add(m); v.pivots.C.inner.add(hold);
          v.plates.push({ set: info.plate, k, m, hold });
        }
        continue;
      }
      if (info.plLink !== undefined) {
        // the tread: a link for every place round the loop, the markers half a loop apart
        const P = C.plot, pl = v.pl = v.pl || { links: [] };
        for (let i = 0; i < P[9]; i++) if (P[10].includes(i) === info.plLink) {
          const m = mesh(g, info.mat, it.uid); group.add(m); pl.links.push({ i, m });
        }
        continue;
      }
      if (info.tp) {
        for (let k = 0; k < (info.copies || 1); k++) addTop(v, it, mesh(g, info.mat, it.uid), Object.assign({}, info, info.copies ? { i: k } : {}));
        continue;
      }
      const m = mesh(g, info.mat, it.uid);
      if (info.pl || info.plRide) {
        // about a shaft's axis (along Y, at its x and height), and/or riding north and south
        const P = C.plot, pl = v.pl = v.pl || { links: [] }, k = (info.pl || "") + (info.plRide ? "+" : "");
        if (!pl[k]) {
          const g2 = new THREE.Group(); group.add(g2); pl[k] = { g: g2, turn: !!info.pl, ride: !!info.plRide };
          if (info.pl) g2.position.set(info.pl === "E" ? P[3] : P[2], 0, P[4]);
        }
        const x = info.pl ? (info.pl === "E" ? P[3] : P[2]) : 0, z = info.pl ? P[4] : 0;
        m.position.set(-x, 0, -z); pl[k].g.add(m);
        continue;
      }
      if (info.sw) { (v.sw[info.sw] = v.sw[info.sw] || []).push(m); group.add(m); }
      else if (info.clkSlide) { v.clkSlide.push(m); group.add(m); }
      else if (info.turn && v.pivots[info.turn]) v.pivots[info.turn].inner.add(m);
      else if (info.at && v.pivots[info.at]) v.pivots[info.at].inner.add(m);   // sleeves and caps: at the stack, still
      else group.add(m);
      if (info.lid) { v.lids.push(m); m.visible = showLids; }
      if (part === "shell" || part === "band" || part.startsWith("keeper_")) { v.walls = v.walls || []; v.walls.push(m); m.userData.mat = m.material; if (glass) m.material = MAT.glass; }
      if (info.follower) v.follower.push(m);
      if (info.slider) v.slider.push(m);
      if (info.latch) v.latch.push({ m, spring: !!info.spring });
      if (info.stoSpring !== undefined) { m.visible = false; v.sto.springs[info.stoSpring] = m; }
      if (info.sto) v.sto[info.sto].push(m);
      if (info.sh) {   // about the arm's pivot: SHIFT's O, SWAP's A
        const c = it.name === "swap" ? C.sx[0] : C.sh[0];
        if (!v.sh) { v.sh = { g: new THREE.Group() }; v.sh.g.position.set(c[0], c[1], 0); group.add(v.sh.g); }
        group.remove(m); v.sh.g.add(m); (v.sh[info.sh] = v.sh[info.sh] || []).push(m);
      }
      if (info.sxSlide) (v.sxSlide = v.sxSlide || []).push(m);
      if (info.keySlide) (v.keySlide = v.keySlide || []).push(m);
      if (info.balls) (v.balls = v.balls || []).push({ m, r: info.balls });
    }
    // the outline that marks a selected box (or one with a problem)
    const w = bx.cells[0] * CELL, h = bx.cells[1] * CELL;
    const eg = new THREE.EdgesGeometry(new THREE.BoxGeometry(w - 1, h - 1, 28));
    v.outline = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0x1f6fd6 }));
    v.outline.position.z = 14; v.outline.visible = false; group.add(v.outline);
    // its name, floating
    v.label = textSprite(bx.label + (bx.kind === "draft" ? " · draft" : ""), bx.kind === "draft" ? "#8a6d1f" : "#1b1b1b", 0.13);
    v.label.position.set(0, bx.half[1] - 10, 44); v.label.visible = showNames; group.add(v.label);
    // a cone at every port: green meshed, gray open, amber when the lanes miss
    for (const p of bx.ports) {
      const cg = new THREE.ConeGeometry(2.6, 7, 14);
      // cones point along the flow: east for E/W, north for N/S
      if (p.side === "E" || p.side === "W") cg.rotateZ(-Math.PI / 2);
      const cm = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: 0x9a9384 }));
      const inset = 7;
      const x = p.side === "E" ? bx.half[0] - inset : p.side === "W" ? -bx.half[0] + inset : p.at;
      const y = p.side === "N" ? bx.half[1] - inset : p.side === "S" ? -bx.half[1] + inset : p.at;
      cm.position.set(x, y, C.lid_top + 6);
      cm.userData.port = p.id;
      group.add(cm); v.markers.push(cm);
    }
    const o = K.origin(it, bx, C);
    group.position.set(o[0], o[1], 0);
    scene.add(group);
    VIEWS.set(it.uid, v);
  }
  function mesh(g, mat, uid) {
    const m = new THREE.Mesh(g, mat && mat[0] === "#" ? matFor(mat) : MAT[mat] || MAT.gear);
    m.userData.uid = uid; pickables.push(m);
    return m;
  }
  function dropBox(uid) {
    const v = VIEWS.get(uid); if (!v) return;
    scene.remove(v.group);
    v.group.traverse(o => { const i = pickables.indexOf(o); if (i >= 0) pickables.splice(i, 1); });
    VIEWS.delete(uid);
  }
  function placeView(it) {
    const v = VIEWS.get(it.uid), o = K.origin(it, BOXES[it.name], C);
    v.group.position.set(o[0], o[1], 0);
  }

  // ---- the layout ---------------------------------------------------------------
  function addItem(name, x, y, uid, set) {
    const it = { uid: uid || "b" + (nextUid++), name, x, y, set: Object.assign(K.defaults(name), set || {}) };
    items.push(it);
    if (BOXES[name].drive) { angle[it.uid] = 0; mode[it.uid] = 1; }
    buildBox(it);
    return it;
  }
  function removeItem(uid) {
    items = items.filter(i => i.uid !== uid);
    dropBox(uid); delete angle[uid]; delete mode[uid];
    if (selected === uid) selected = null;
  }
  function clearAll() { for (const it of items.slice()) removeItem(it.uid); jam = null; }
  function load(list) {
    clearAll();
    for (const [n, x, y, set] of list) if (BOXES[n]) addItem(n, x, y, null, set);
    for (const k in angle) angle[k] = 0;
    changed(); fit();
  }
  function fits(name, x, y, ignore) {
    const bx = BOXES[name];
    if (x < 0 || y < 0 || x + bx.cells[0] > GX || y + bx.cells[1] > GY) return false;
    const occ = K.occupied(items.filter(i => i.uid !== ignore), BOXES);
    for (let i = 0; i < bx.cells[0]; i++) for (let j = 0; j < bx.cells[1]; j++) if (occ.has((x + i) + "," + (y + j))) return false;
    return true;
  }

  function changed() {
    A = K.analyze(items, BOXES, C);
    holdState = {};
    zeroSpins = K.evaluate(items, BOXES, A, {}, C);
    dynamicChecks();
    update(true);
    renderIssues();
    renderInspector();
    save();
  }

  // ---- drives ----------------------------------------------------------------
  // degrees of drive angle per second at the set speed: the crank's K turns at
  // rpm; the motor's pinion so that its ports turn about 45 rpm (motor.md)
  const MOTOR_PORT_RPM = 45;
  const motorPerDeg = (() => {
    const m = BOXES.motor; if (!m) return 1;
    const a = K.spins(m, { M: 0 }, C).E, b = K.spins(m, { M: 3600 }, C).E;
    return (b - a) / 3600;      // E degrees per pinion degree (positive: forward)
  })();
  function rate(uid) {
    const it = items.find(i => i.uid === uid);
    if (it.name === "crank" || K.KEY[it.name]) return rpm * 6;   // a key: a press per crank turn's time
    // BRAIN's encoder N20s run its ports at about 24 rpm, DRIVE's at about 37 (brain.md)
    const port = { brain: 24, cbdrive: 37 }[it.name] || MOTOR_PORT_RPM;
    return port * 6 / Math.abs(motorPerDeg) * Math.sign(motorPerDeg || 1);
  }
  // drive angles after T seconds (modes: the drives' own, or all forward)
  function anglesAfter(T, allForward, raw) {
    const out = {};
    for (const u in angle) {
      // (a TICK on the line slows its drives: capF, see computeCap)
      const it = items.find(i => i.uid === u), t = T * (raw ? 1 : (capF[u] || 1));
      // (all forward, for the line ratios: the store at its full-wind speed, steady)
      out[u] = it.name === "store" ? (allForward ? angle[u] + STO_K * 360 * t : stoRun(it, angle[u], t)) :
        angle[u] + rate(u) * t * (allForward ? 1 : mode[u] * dir);
    }
    return out;
  }
  // ---- the escapement: a TICK holds the drives that reach it to its beat ----
  // One cycle (one tooth) per swing of the foliot there and back; the beat is
  // taken as one a second with the balls 18 mm out, slower in proportion
  // further out (the foliot's inertia goes as r squared, its swing time as r).
  // A foliot has no spring, so a harder push would still speed it up a
  // little: here it simply caps the line.
  let capF = {};
  const escBeat = it => 18 / it.set.balls;   // cycles a second
  function computeCap(T) {
    capF = {};
    const esc = items.filter(i => i.name === "escape" && (A.info.get(i.uid) || { drives: new Set() }).drives.size);
    if (!esc.length) return;
    const dt = Math.max(T, 0.02), st = () => ({ hold: JSON.parse(JSON.stringify(holdState)) });
    const s0 = K.evaluate(items, BOXES, A, angle, C, st()), s1 = K.evaluate(items, BOXES, A, anglesAfter(dt, false, true), C, st());
    for (const it of esc) {
      const r = Math.abs(((s1.get(it.uid) || {}).cyc || 0) - ((s0.get(it.uid) || {}).cyc || 0)) / dt, f = r > escBeat(it) ? escBeat(it) / r : 1;
      for (const d of A.info.get(it.uid).drives) capF[d] = Math.min(capF[d] || 1, f);
    }
  }
  // ---- the spring store: it runs on its own, whichever way the others turn ----
  // The barrel runs while the plunger is up, and on to the next notch once it
  // drops. Its speed is in proportion to the wind left (full: E at 30 rpm),
  // with a floor so that it runs right down: a model, not a measurement.
  const STO_K = 0.2, STO_MIN = 6;   // 1/s, and degrees of the barrel a second
  const stoTension = (it, run) => Math.max(0, it.set.wind - run);
  const stoLocked = run => { const u = ((run % 30) + 30) % 30; return u < 1e-6 || u > 30 - 1e-6; };
  const stoUp = (it, run) => !!it.set.up || !stoLocked(run);
  function stoRun(it, run, T) {
    if (T <= 0) return run;
    const t0 = stoTension(it, run), pitch = C.sto[3];
    const stop = it.set.up ? it.set.wind : Math.min(it.set.wind, stoLocked(run) ? run : Math.ceil(run / pitch) * pitch);
    if (stop <= run) return run;
    const tc = STO_MIN / STO_K;
    let s;
    if (t0 > tc) { const t1 = Math.log(t0 / tc) / STO_K; s = T <= t1 ? t0 * (1 - Math.exp(-STO_K * T)) : t0 - tc + STO_MIN * (T - t1); }
    else s = STO_MIN * T;
    return Math.min(run + s, stop);
  }
  // ratchets whose input would turn backwards between two states
  function ratchetJams(before, after) {
    const out = [];
    for (const it of items) {
      if (it.name !== "ratchet") continue;
      const s0 = (before.get(it.uid) || {}).W || 0, s1 = (after.get(it.uid) || {}).W || 0;
      if (s1 - s0 > 1e-6) out.push(it.uid);   // an input turning counter-clockwise runs backwards
    }
    return out;
  }
  // move the drives on by T seconds. A drive that would turn a ratchet
  // backwards is held where it is (the pawl locks its whole line); the
  // others run on.
  function advance(T) {
    computeCap(T);
    const next = anglesAfter(T, false);
    // the switches' held ports, copied: only update() moves them on
    const copy = () => ({ hold: JSON.parse(JSON.stringify(holdState)) });
    const before = K.evaluate(items, BOXES, A, angle, C, copy());
    const jammed = new Set();
    for (let k = 0; k < 8; k++) {
      const after = K.evaluate(items, BOXES, A, next, C, copy());
      const js = ratchetJams(before, after);
      if (!js.length && !after.overrun.length) break;
      for (const r of js) {
        jammed.add(r);
        for (const d of (A.info.get(r) || { drives: [] }).drives) next[d] = angle[d];
      }
      // a STEER's select line run past either rest: the arm is on its stop
      for (const u of after.overrun) {
        jammed.add(u);
        const L = A.inLinks.get(u).find(l => l.inp === "S");
        for (const d of (L && A.info.get(L.from) || { drives: [] }).drives) next[d] = angle[d];
      }
    }
    const was = jam;
    jam = jammed.size ? [...jammed] : null;
    const el = document.getElementById("jam");
    el.style.display = jam ? "block" : "none";
    if (jam) el.textContent = jam.some(u => items.find(i => i.uid === u).name === "steer") ?
      "Jammed: STEER's arm is on its stop, so its select line locks. Drive the select line from a SQUARE or a RAMP." :
      "Jammed: a RATCHET's pawl holds, and its line back to the drive locks.";
    if (String(was) !== String(jam)) { renderIssues(); markOutlines(); }
    const moved = Object.keys(next).some(u => next[u] !== angle[u]);
    const ranDown = items.some(it => it.name === "store" && stoTension(it, angle[it.uid]) > 0 && !stoTension(it, next[it.uid]));
    Object.assign(angle, next);
    if (ranDown) { dynamicChecks(); renderIssues(); if (selected) renderInspector(); }
    if (jam && !moved && playing) { playing = false; syncPlay(); }
    return moved;
  }

  // ---- direction checks: what runs backwards when every drive runs forward ----
  function dynamicChecks() {
    dyn.issues = [];
    for (const it of items) {
      if (it.name === "store") {
        const t = stoTension(it, angle[it.uid] || 0);
        if (!t) dyn.issues.push({ level: "info", uids: [it.uid], text: "SPRING has run down: wind its knob (in its panel) to run it again." });
        else if (!it.set.up) dyn.issues.push({ level: "info", uids: [it.uid], text: "SPRING is wound but its plunger is down: lift it (in its panel) and the spring runs the line." });
      }
      if (it.name === "shift" && it.set.gear === 0)
        dyn.issues.push({ level: "info", uids: [it.uid], text: "SHIFT is in neutral: the idler meshes only O, so O, F and E stand still." });
      if ((it.name === "route" || it.name === "pick") && it.set.sel === 0.5)
        dyn.issues.push({ level: "info", uids: [it.uid], text: BOXES[it.name].label + "'s knob is between its rests: the idler meshes nothing, so nothing turns past it." });
      if (it.name === "steer") {
        const L = A.inLinks.get(it.uid).find(l => l.inp === "S");
        const from = L && items.find(i => i.uid === L.from);
        if (from && from.name !== "square" && from.name !== "ramp")
          dyn.issues.push({ level: "warn", uids: [it.uid, from.uid], text: "STEER's select line comes from " + BOXES[from.name].label +
            ", not a clock: it moves the arm " + C.sw[5].toFixed(1) + " mm from N to E and then the arm is on its stop. A SQUARE or RAMP on S swings it back and forth." });
      }
    }
    const T = 60;
    const s0 = K.evaluate(items, BOXES, A, angle, C), s1 = K.evaluate(items, BOXES, A, anglesAfter(T, true), C);
    dyn.fwd = { s0, s1, T };
    for (const it of items) {
      const bx = BOXES[it.name];
      if (!A.inLinks.get(it.uid).length) continue;
      const inp = A.inLinks.get(it.uid)[0].inp;
      const back = (s1.get(it.uid)[inp] - s0.get(it.uid)[inp]) > 1e-6;
      if (!back) continue;
      if (it.name === "ratchet")
        dyn.issues.push({ level: "error", uids: [it.uid], text: "RATCHET is fed backwards: with the drive forward its input turns the wrong way, so it jams the whole line. Take one reversal out in front of it." });
      if (it.name === "counter")
        dyn.issues.push({ level: "warn", uids: [it.uid], text: "TURNS is fed backwards: it counts down (and from 0.0 it shows 9.9)." });
      if (it.name === "face")
        dyn.issues.push({ level: "error", uids: [it.uid], text: "FACE runs backwards: the hands would turn counterclockwise. FACE wants a forward line: add or remove a REVERSE in front of it." });
      if (it.name === "orrery")
        dyn.issues.push({ level: "error", uids: [it.uid], text: "ORRERY runs backwards: the planets would orbit clockwise. Add or remove a REVERSE in front of it." });
    }
  }

  // ---- sound: BEAT, BOOM and ROLL -----------------------------------------------
  // A key rides its lobe up and drops off the cliff; the drop is the hit. Each
  // key's lift table (tp_mus) gives its cliffs; a hit sounds when the wheel
  // turns forward past one, as loud as the drop. The voices are synthesized
  // (WebAudio): BEAT's tok block, ROLL's drum, block and tine (lib/roll.scad's
  // ro_voices, keys A, B, C), BOOM's big drum.
  const VOICE = { beat: { "": "block" }, boom: { "": "boom" }, roll: { _A: "drum", _B: "block", _C: "tine" } };
  const sound = (() => {
    let on = true, ctx = null, out = null, noise = null, hits = 0;
    const byVoice = {};
    const prev = new Map(), cliffs = {};
    try { on = localStorage.getItem("gbs_sound") !== "off"; } catch (e) { /* no storage */ }
    function start() {
      if (ctx || !on) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor(); comp.connect(ctx.destination);
      out = ctx.createGain(); out.gain.value = 0.6; out.connect(comp);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    // a key's cliffs: [degrees, drop in degrees of key lift]
    function cliffsOf(name, k) {
      const key = name + k;
      if (key in cliffs) return cliffs[key];
      const r = ((C.tp_mus || []).find(q => q[0] === name) || [, []])[1].find(q => q[0] === k), c = [];
      if (r) { const t = r[3], n = t.length; for (let i = 0; i < n; i++) if (t[i] - t[(i + 1) % n] > 1) c.push([(i + 0.5) * 360 / n, t[i]]); }
      return (cliffs[key] = c);
    }
    function env(g, t, peak, decay) {
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    }
    function tone(t, type, f0, f1, sweep, peak, decay) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + sweep);
      env(g, t, peak, decay); o.connect(g); g.connect(out); o.start(t); o.stop(t + decay + 0.05);
    }
    function hiss(t, kind, f, q, peak, decay) {
      const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noise; fl.type = kind; fl.frequency.value = f; fl.Q.value = q;
      env(g, t, peak, decay); s.connect(fl); fl.connect(g); g.connect(out); s.start(t); s.stop(t + decay + 0.05);
    }
    function play(voice, t, v, tune) {
      if (voice === "block") { tone(t, "triangle", 900 * tune, 760 * tune, 0.03, 0.5 * v, 0.09); hiss(t, "bandpass", 2400 * tune, 4, 0.35 * v, 0.03); }
      else if (voice === "tine") { tone(t, "sine", 1320 * tune, 1320 * tune, 0, 0.25 * v, 1.6); tone(t, "sine", 3643 * tune, 3643 * tune, 0, 0.08 * v, 0.35); }
      else if (voice === "drum") { tone(t, "sine", 190 * tune, 85 * tune, 0.12, 0.8 * v, 0.35); hiss(t, "lowpass", 1400, 1, 0.3 * v, 0.07); }
      else if (voice === "boom") { tone(t, "sine", 110, 42, 0.35, 1.0 * v, 0.9); tone(t, "triangle", 70, 38, 0.3, 0.3 * v, 0.5); hiss(t, "lowpass", 500, 1, 0.45 * v, 0.2); }
    }
    // each frame: the wheels that turned forward past a cliff
    function tick(spins, dt) {
      const live = new Set();
      for (const it of items) {
        const w = MUS_WHEEL[it.name]; if (!w) continue;
        const s = (spins.get(it.uid) || {})[w] || 0, key = it.uid;
        live.add(key);
        const p = prev.get(key); prev.set(key, s);
        if (p === undefined || s <= p || s - p > 720) continue;
        // a box of its own pitch, a little apart from the next one like it
        const tune = 1 + 0.04 * ((+String(it.uid).replace(/\D/g, "") || 0) % 5 - 2);
        for (const [k, voice] of Object.entries(VOICE[it.name])) {
          for (const [c, h] of cliffsOf(it.name, k)) {
            const n = Math.floor((s - c) / 360) - Math.floor((p - c) / 360);
            for (let j = 0; j < Math.min(n, 3); j++) {
              hits++; byVoice[voice] = (byVoice[voice] || 0) + 1;
              if (!on || !ctx) continue;
              // when, in this frame: where the cliff fell between the two spins
              const f = (((c - p) % 360) + 360) % 360 / (s - p) + j * 360 / (s - p);
              play(voice, ctx.currentTime + 0.02 + Math.min(1, f) * (dt || 0), Math.min(1, 0.35 + h / 12), tune);
            }
          }
        }
      }
      for (const k of prev.keys()) if (!live.has(k)) prev.delete(k);
    }
    function set(v) {
      on = v; try { localStorage.setItem("gbs_sound", on ? "on" : "off"); } catch (e) { /* no storage */ }
      if (on) { start(); if (ctx && ctx.state === "suspended") ctx.resume(); } else if (ctx) ctx.suspend();
    }
    // browsers start sound only after a click
    window.addEventListener("pointerdown", () => { start(); if (on && ctx && ctx.state === "suspended") ctx.resume(); });
    window.addEventListener("keydown", () => { start(); if (on && ctx && ctx.state === "suspended") ctx.resume(); });
    return { tick, set, on: () => on, hits: () => hits, byVoice: () => Object.assign({}, byVoice), test: (voice) => { start(); if (ctx) play(voice, ctx.currentTime + 0.02, 1, 1); } };
  })();

  // ---- moving every part -------------------------------------------------------
  function update(force) {
    spinsNow = K.evaluate(items, BOXES, A, angle, C, { hold: holdState });
    sound.tick(spinsNow, frameDt);
    for (const it of items) {
      const bx = BOXES[it.name], v = VIEWS.get(it.uid), sp = spinsNow.get(it.uid) || {}, tsp = topSpins(it, bx, sp);
      for (const [id, pv] of Object.entries(v.pivots)) {
        const s = (id in tsp ? tsp[id] : sp[id] || 0) * D;
        if (pv.axis === "x") pv.outer.rotation.set(s, 0, 0); else pv.outer.rotation.set(0, 0, s);
      }
      // planets: three round the carrier, each meshed with the sun
      if (v.planets.length) {
        const cst = Object.values(bx.st).find(s => s.gears.some(g => g[1] === "carrier"));
        const sunSt = Object.values(bx.st).find(s => s !== cst && Math.hypot(s.pos[0] - cst.pos[0], s.pos[1] - cst.pos[1]) < 0.01 && typeof s.gears[0][1] === "number");
        const l = cst.gears.find(g => g[1] === "carrier")[0] - 1;
        const c = sp[cst.id] || 0, s = sp[sunSt.id] || 0, [zs, zp] = C.pl, rp = C.pl[5];
        v.planets.forEach((m, k) => {
          const a = c + 120 * k;
          m.position.set(cst.pos[0] + rp * Math.cos(a * D), cst.pos[1] + rp * Math.sin(a * D), C.lz[l - 1]);
          m.rotation.set(0, 0, K.meshSpin(zs, s, a, zp) * D);
        });
      }
      if (v.follower.length) {
        const q = bx.bought.find(f => f[0] === "follower"), st = bx.st[q[2][0]];
        const rel = Math.atan2(q[1][1] - st.pos[1], q[1][0] - st.pos[0]) / D - (sp[st.id] || 0);
        let z = followerZ(st.extra || "sine", rel);
        if (v.latch.length) z = tripLatch(it, bx, v, st, rel, z);
        v.follower.forEach(m => m.position.z = z - (C.cam_z0 + C.cam_base));
      }
      if (v.sh && sp.arm !== undefined) {
        const a = sp.arm * D, ri = it.name === "swap" ? C.sw[0] : C.sh[1], each = (k, f) => (v.sh[k] || []).forEach(f);
        each("arm", m => m.rotation.z = a); each("dial", m => m.rotation.z = a);
        each("lever", m => m.rotation.z = a + C.sh[5] * D);
        each("idler", m => { m.position.set(ri * Math.cos(a), ri * Math.sin(a), 0); m.rotation.z = sp.idler * D; });
        each("ipin", m => m.position.set(ri * Math.cos(a), ri * Math.sin(a), 0));
        (v.sxSlide || []).forEach(m => m.position.x = sp.slider);
      } else if (sp.arm !== undefined) {
        const a0 = K.swRests(it.name, C)[1];
        (v.sw.arm || []).forEach(m => m.rotation.set(0, 0, sp.arm * D));
        (v.sw.knob || []).forEach(m => m.rotation.set(0, 0, (sp.arm - a0) * D));
        (v.sw.idler || []).forEach(m => { m.position.set(sp.ip[0], sp.ip[1], 0); m.rotation.set(0, 0, sp.idler * D); });
        (v.sw.ipin || []).forEach(m => m.position.set(sp.ip[0], sp.ip[1], 0));
      }
      if (sp.slider !== undefined) {
        v.clkSlide.forEach(m => m.position.x = sp.slider);
        const set = Object.assign(K.defaults(it.name), it.set || {});
        const want = it.name === "ramp" ? set.f : set.pair, phase = it.name === "ramp" ? 0 : set.phase;
        v.plates.forEach(p => { p.m.visible = p.set === want; p.hold.rotation.z = p.k ? -phase * D : 0; });
      }
      if (it.name === "store") stoPose(it, v);
      if (v.pl) plotPose(v, sp);
      if (v.tp) topPose(it, bx, v, sp);
      if (v.keySlide) v.keySlide.forEach(m => m.position.x = -(sp.stroke || 0));
      if (v.balls) v.balls.forEach(b => b.m.visible = b.r === it.set.balls);
      if (v.slider.length) {
        const st = Object.values(bx.st).find(s => s.gears.some(g => g[1] === "crankpin"));
        const x = C.yoke_r * Math.cos((sp[st.id] || 0) * D);
        v.slider.forEach(m => m.position.x = x);
      }
    }
    const el = document.getElementById("angle");
    const cr = items.find(i => i.name === "crank");
    el.textContent = cr ? (angle[cr.uid] / 360).toFixed(2) + " crank turns" : "";
    if (!force && selected) renderLive();
  }
  // the trip flag: the fork springs into the rod's neck when the bump's top
  // passes under the follower (between two frames counts too), and holds the
  // rod up until its tab is pushed back (resetTrip). Drawn armed; latched, the
  // slider runs forward by its travel and the spring stretches after it.
  function tripLatch(it, bx, v, st, rel, z) {
    const [travel, zLatched, x0, x1] = C.trip, tab = C.follower.find(f => f[0] === (st.extra || "trip"))[1];
    if (it.tripPeak === undefined) {   // the middle of the bump's flat top
      const top = Math.max(...tab), at = tab.map((h, i) => [h, 3 * i]).filter(([h]) => h > top - 1e-3).map(([, a]) => a);
      it.tripPeak = at.reduce((x, y) => x + y, 0) / at.length;
    }
    const wrap = a => ((a % 360) + 540) % 360 - 180;
    if (!it.tripped && it.tripRel !== undefined) {
      const d = wrap(rel - it.tripRel), p = wrap(it.tripPeak - it.tripRel);
      if (z >= zLatched - 0.01 || (d > 0 ? p >= 0 && p <= d : p <= 0 && p >= d)) it.tripped = true;
    }
    it.tripRel = rel;
    const s = it.tripped ? -travel : 0, fx = bx.bought.find(f => f[0] === "latch")[1][0], px = fx + x1;
    for (const { m, spring } of v.latch) {
      if (!spring) { m.position.x = s; continue; }
      const k = (x1 - x0 - (it.tripped ? 0 : travel)) / (x1 - x0 - travel);
      m.scale.x = k; m.position.x = px * (1 - k);
    }
    return it.tripped ? Math.max(z, zLatched) : z;
  }
  // the spring store: the spring drawn nearest its wind, the plunger up when
  // lifted or riding the rim between notches, the pawl's arm out on its tooth
  function stoPose(it, v) {
    const [, , lift, , pv, L, tab, step] = C.sto, run = angle[it.uid] || 0;
    const k = Math.max(0, Math.min(v.sto.springs.length - 1, Math.round(stoTension(it, run) / step)));
    v.sto.springs.forEach((m, i) => m.visible = i === k);
    v.sto.plunger.forEach(m => m.position.z = stoUp(it, run) ? lift : 0);
    const p = tab.length - 1, w = ((it.set.wind % (p / 4)) + p / 4) % (p / 4) * 4, i = Math.floor(w), f = w - i;
    const a = -(tab[i] * (1 - f) + tab[Math.min(p, i + 1)] * f) / L;   // the arm turns about its post
    v.sto.pawl.forEach(m => { m.rotation.z = a; m.position.set(pv[0] - (pv[0] * Math.cos(a) - pv[1] * Math.sin(a)), pv[1] - (pv[0] * Math.sin(a) + pv[1] * Math.cos(a)), 0); });
  }
  // the plot box (lib/plot.scad's plot_y(), plot_shaft(), plot_path())
  function plotPose(v, sp) {
    const P = C.plot, q = plotState(sp), x0 = { E: P[3], W: P[2] };
    for (const [k, o] of Object.entries(v.pl)) if (k !== "links") {
      const s = k.replace("+", "");
      o.g.position.set(s ? x0[s] : 0, o.ride ? q.y : 0, s ? P[4] : 0);
      o.g.rotation.set(0, o.turn ? q.sh * D : 0, 0);
    }
    for (const { i, m } of v.pl.links) {
      const a = plotPath(q.s + i * P[8]), c = plotPath(q.s + (i + 1) * P[8]);
      m.position.set(a[0], P[11] + q.y, a[1]);
      m.rotation.set(0, Math.atan2(-(c[1] - a[1]), c[0] - a[0]), 0);
    }
  }
  // [rc, tc, xw, xe, zs, rs, d, len, p, n, mk, yc0, a, r0, t0]
  function plotState(sp) {
    const P = C.plot, theta = (sp.R || 0) - P[13], sh = -((sp.T || 0) - P[14]);
    return { theta, sh, y: P[12] * Math.sin((180 + theta) * D), s: P[5] * sh * D };
  }
  // a point u mm round the pin path (0 = the top run's west end), [x, z]
  function plotPath(u) {
    const P = C.plot, d = P[6], r = P[5], c = Math.PI * r, L = P[7], v = ((u % L) + L) % L;
    if (v < d) return [P[2] + v, P[4] + r];
    if (v < d + c) { const a = (v - d) / r; return [P[3] + r * Math.sin(a), P[4] + r * Math.cos(a)]; }
    if (v < 2 * d + c) return [P[3] - (v - d - c), P[4] - r];
    const a = (v - 2 * d - c) / r; return [P[2] - r * Math.sin(a), P[4] - r * Math.cos(a)];
  }
  function resetTrip(it) { it.tripped = false; it.tripRel = undefined; }
  function followerZ(kind, rel) {
    const tab = (C.follower.find(f => f[0] === kind) || C.follower[0])[1];
    const u = ((rel % 360) + 360) % 360 / 3, i = Math.floor(u), f = u - i;
    return tab[i % tab.length] * (1 - f) + tab[(i + 1) % tab.length] * f;
  }

  // ---- readouts -----------------------------------------------------------------
  function frac(r) {
    if (!isFinite(r)) return "–";
    if (Math.abs(r) < 1e-6) return "×0";
    for (let d = 1; d <= 16; d++) { const n = Math.round(r * d); if (Math.abs(r - n / d) < 1e-3 * Math.max(1, Math.abs(r))) return "×" + (d === 1 ? n : n + "/" + d).toString().replace("-", "−"); }
    return "×" + r.toFixed(3).replace("-", "−");
  }
  // the drive feeding a box, and its output's pitch-line speed (forward, per second)
  function driveLine(uid) {
    const I = A.info.get(uid); if (!I || !I.drives.size) return null;
    const du = [...I.drives][0], dit = items.find(i => i.uid === du), dbx = BOXES[dit.name];
    const pe = dbx.ports.find(p => p.id === "E") || dbx.ports.find(p => !p.input);   // BRAIN's and DRIVE's: E1
    const { s0, s1, T } = dyn.fwd;
    return { uid: du, name: dbx.label, line: (s1.get(du)[pe.id] - s0.get(du)[pe.id]) / T * pe.teeth / 2 };
  }
  function portRows(it) {
    const bx = BOXES[it.name], u = it.uid;
    const dl = driveLine(u);
    const now = spinsNow.get(u) || {}, z = zeroSpins.get(u) || {};
    const avg = stepped(60, 240, true), inst = stepped(0.1, 1, false);
    const rows = [];
    for (const p of bx.ports) {
      const sgn = p.input ? -1 : 1;
      const fwdRate = avg.get(u, p.id) / avg.T;                            // deg/s, every drive forward
      const ratio = dl && dl.line ? sgn * fwdRate * p.teeth / 2 / dl.line : NaN;
      const live = sgn * inst.get(u, p.id) / inst.T * 60 / 360;            // rpm now
      const turns = sgn * ((now[p.id] || 0) - (z[p.id] || 0)) / 360;
      let link = "";
      if (p.input) {
        const L = A.inLinks.get(u).find(l => l.inp === p.id);
        link = L ? "from " + BOXES[items.find(i => i.uid === L.from).name].label + " " + L.out : "<span class=idle>not fed</span>";
      } else {
        const L = A.outs.get(u + ":" + p.id);
        link = L && L.to ? "to " + BOXES[items.find(i => i.uid === L.to).name].label + " " + L.inp :
          L && L.wall ? "<span class=idle>into a wall</span>" : "<span class=idle>open</span>";
      }
      // the lane: the port's place against its own cell's center
      const n = p.side === "E" || p.side === "W" ? bx.cells[1] : bx.cells[0], shift = ((n - 1) / 2 * CELL) % CELL;
      const off = (((p.at + shift) % CELL) + 1.5 * CELL) % CELL - CELL / 2;
      rows.push({ id: p.id, lane: "ABC"[[-16, 0, 16].indexOf(Math.round(off))] || "?", teeth: p.teeth, link,
        ratio: dl ? frac(ratio) : "–", rpm: live, turns });
    }
    return rows;
  }
  // rpm over the next minute at the drives' present settings (a Geneva
  // averages out); signed so that forward is positive
  // how far every stack turns over the next T seconds, in n steps (so a
  // switch's held ports and a Geneva's steps add up as they happen)
  function stepped(T, n, allForward) {
    const st = { hold: JSON.parse(JSON.stringify(holdState)) }, acc = new Map();
    let prev = K.evaluate(items, BOXES, A, angle, C, st);
    for (let i = 1; i <= n; i++) {
      const a1 = anglesAfter(T * i / n, allForward);
      const cur = K.evaluate(items, BOXES, A, a1, C, st);
      for (const [u, sp] of cur) {
        const p = prev.get(u) || {}, m = acc.get(u) || {};
        for (const k in sp) if (typeof sp[k] === "number") m[k] = (m[k] || 0) + sp[k] - (p[k] || 0);
        acc.set(u, m);
      }
      prev = cur;
    }
    return { T, get: (u, id) => (acc.get(u) || {})[id] || 0 };
  }

  // ---- panels --------------------------------------------------------------------
  const $ = id => document.getElementById(id);
  function allIssues() {
    const l = A ? A.issues.concat(dyn.issues) : [];
    if (jam) l.unshift({ level: "error", uids: jam, text: "Jammed: a RATCHET's input was turned backwards, so its drive stopped. Run forward again, or take a reversal out in front of it." });
    return l;
  }
  function renderIssues() {
    const L = allIssues(), rank = { error: 0, warn: 1, info: 2 };
    L.sort((a, b) => rank[a.level] - rank[b.level]);
    const ne = L.filter(i => i.level === "error").length, nw = L.filter(i => i.level === "warn").length;
    $("summary").innerHTML = items.length ? (ne + nw ? `<b style="color:var(--err)">${ne} problem${ne === 1 ? "" : "s"}</b>, <b style="color:var(--warn)">${nw} warning${nw === 1 ? "" : "s"}</b>` :
      `<span style="color:var(--ok)">No problems found.</span>`) + ` · ${A.links.length} mesh${A.links.length === 1 ? "" : "es"} between boxes` : "The grid is empty.";
    const box = $("issues"); box.innerHTML = "";
    for (const is of L) {
      const d = document.createElement("div");
      d.className = "issue " + is.level; d.textContent = is.text;
      d.onclick = () => { select(is.uids[0]); };
      box.appendChild(d);
    }
    const t = document.createElement("div");
    t.className = "issue ok"; t.style.marginTop = "8px";
    t.textContent = TEST.bad.length ? "Kinematics differ from OpenSCAD for: " + TEST.bad.join(", ") + ". Re-run sim/export.sh." :
      `Kinematics match OpenSCAD on all ${TEST.n} simulated boxes.` + (MESHES.pool ? "" : " (No meshes.js: plain shapes.)");
    if (TEST.bad.length) t.className = "issue error";
    box.appendChild(t);
    markOutlines();
    markPorts();
  }
  function markOutlines() {
    const lvl = new Map();
    for (const is of allIssues()) for (const u of is.uids) {
      const cur = lvl.get(u);
      if (is.level === "error" || (is.level === "warn" && cur !== "error")) lvl.set(u, is.level);
    }
    for (const [u, v] of VIEWS) {
      const l = u === selected ? "sel" : lvl.get(u);
      v.outline.visible = !!l && l !== "info";
      v.outline.material.color.set(l === "sel" ? 0x1f6fd6 : l === "error" ? 0xd63a2f : 0xd8941c);
    }
  }
  function markPorts() {
    const fed = new Set(A.links.map(L => L.to + ":" + L.inp)), driving = new Set(A.links.map(L => L.from + ":" + L.out));
    for (const [u, v] of VIEWS) for (const m of v.markers) {
      const k = u + ":" + m.userData.port;
      m.material.color.set(fed.has(k) || driving.has(k) ? 0x2fa84f : 0xa59d8d);
    }
  }
  function select(uid) {
    selected = uid; markOutlines(); renderInspector();
  }
  function renderInspector() {
    const el = $("inspect");
    const it = items.find(i => i.uid === selected);
    if (!it) { el.className = "muted"; el.innerHTML = "Click a box to see its ports, speeds and path cost."; return; }
    el.className = "";
    const bx = BOXES[it.name], I = A.info.get(it.uid) || { drives: new Set() };
    const doc = REPO + (DOC[it.name] || it.name) + ".html";
    let h = `<div class="big">${bx.label}<span class="chip ${bx.kind}">${bx.kind === "draft" ? "draft · not simulated" : "fit-checked"}</span></div>`;
    h += `<div class="muted" style="margin:2px 0 8px">${it.name} at cell (${it.x}, ${it.y}) · ${bx.cells[0]}×${bx.cells[1]} · <a href="${doc}" target="_blank" rel="noopener">design doc</a></div>`;
    h += `<div class="kv">`;
    if (bx.drive) {
      h += `<span>Budget</span><span>${K.BUDGET[it.name]} stages</span>`;
      if (it.name === "store") h += `<span>Knob</span><span><button data-sto="wind" style="padding:2px 8px">Wind ¼ turn</button> <button data-sto="full" style="padding:2px 8px">Wind it right up</button></span>` +
        `<span>Plunger</span><span><button data-sto="up" class="${it.set.up ? "on" : ""}" style="padding:2px 8px">${it.set.up ? "Let go" : "Lift it: run"}</button></span>`;
      else h += `<span>Drive</span><span>` + (K.KEY[it.name] ? [[1, "Keep pressing"], [0, "Hold"]] : [[1, "Run"], [0, "Hold"], [-1, "Reverse"]]).map(([m, t]) =>
        `<button data-mode="${m}" class="${mode[it.uid] === m ? "on" : ""}" style="padding:2px 8px">${t}</button>`).join(" ") + `</span>`;
    } else if (I.drives.size) {
      const names = [...I.drives].map(d => BOXES[items.find(i => i.uid === d).name].label + " (" + items.find(i => i.uid === d).x + ", " + items.find(i => i.uid === d).y + ")");
      h += `<span>Driven by</span><span>${names.join(", ")}</span>`;
      h += `<span>Path cost</span><span style="color:${I.cost > I.budget ? "var(--err)" : "inherit"}">${I.cost} of ${I.budget} stages${it.name === "tap" ? " (a tap starts a new path)" : ""}</span>`;
    } else h += `<span>Driven by</span><span class="idle">nothing: no drive reaches it</span>`;
    h += `<span>Box cost</span><span>${bx.drive ? "–" : costText(it.name) + " stages"}</span>`;
    h += settingsHtml(it);
    h += `</div><div id="live"></div>`;
    el.innerHTML = h;
    el.querySelectorAll("button[data-set]").forEach(b => b.onclick = () => {
      const [k, v] = b.dataset.set.split(":");
      it.set[k] = isNaN(+v) ? v : +v;   // RAMP's sine plate is "sine"
      if (it.name === "square" && it.set.pair === 140 && it.set.phase > 90) it.set.phase = 90;
      dynamicChecks(); update(true); renderIssues(); renderInspector(); save();
    });
    el.querySelectorAll("button[data-sto]").forEach(b => b.onclick = () => {
      const k = b.dataset.sto, run = angle[it.uid] || 0;
      // one turn of wind at most: the band packs onto the arbor at about 1.2
      if (k === "wind") it.set.wind = Math.min(run + 360, it.set.wind + 90);
      if (k === "full") it.set.wind = run + 360;
      if (k === "up") { it.set.up = it.set.up ? 0 : 1; if (it.set.up && !playing && stoTension(it, run) > 0) { playing = true; syncPlay(); } }
      dynamicChecks(); update(true); renderIssues(); renderInspector();
    });
    el.querySelectorAll("button[data-trip]").forEach(b => b.onclick = () => { resetTrip(it); update(true); renderInspector(); });
    el.querySelectorAll("button[data-mode]").forEach(b => b.onclick = () => { mode[it.uid] = +b.dataset.mode; dynamicChecks(); renderIssues(); renderInspector(); });
    renderLive();
  }
  // a box's cost, or each input's ("W 3 · S 5")
  function costText(n) {
    const c = K.COST[n];
    if (n === "branch") return "3 · N +3";   // E starts afresh, as a TAP's does
    return typeof c === "object" ? Object.entries(c).map(([p, x]) => p + " " + x).join(" · ") : c || "?";
  }
  // the knob of a switch, the plates of a clock
  function settingsHtml(it) {
    const b = (k, v, t) => `<button data-set="${k}:${v}" class="${it.set[k] === v ? "on" : ""}" style="padding:2px 8px">${t}</button>`;
    // SPIN and FORK: flick the wheel (a random coast), or set FORK's rest
    if (it.name === "spin") {
      const c = it.set.coast || 0;
      return `<span>Spinner</span><span>${b("coast", c + 60 * (12 + Math.floor(Math.random() * 18)), "Flick it")} ${b("coast", 0, "Back")}</span>`;
    }
    if (it.name === "fork") {
      const r = it.set.roll || 0, odd = ((r % 2) + 2) % 2;
      return `<span>Wheel</span><span>${b("roll", odd ? r + 1 : r, "E")} ${b("roll", odd ? r : r + 1, "N")} ${b("roll", r + 6 + Math.floor(Math.random() * 12), "Flick it")}</span>`;
    }
    if (it.name === "face") {   // push the minute hand on: the collar slips
      const s = it.set.set || 0;
      return `<span>Set time</span><span>${b("set", s + 1, "+1 min")} ${b("set", s + 15, "+15 min")} ${b("set", s + 60, "+1 hour")} ${b("set", 0, "Back")}</span>`;
    }
    if (it.name === "route" || it.name === "pick" || it.name === "steer") {
      const n = it.name === "pick" ? ["W", "S"] : ["E", "N"];
      const fed = it.name === "steer" && A.inLinks.get(it.uid).some(l => l.inp === "S");
      if (fed) return `<span>Select</span><span>set by the line on S (high: E, low: N)</span>`;
      return `<span>${it.name === "steer" ? "Arm" : "Knob"}</span><span>${b("sel", 0, n[0])} ${b("sel", 0.5, "between")} ${b("sel", 1, n[1])}</span>`;
    }
    if (it.name === "square") {
      const [sh, lg] = C.clk_sets, H = it.set.pair, phases = (H === sh[0] ? sh[1] : lg[1]);
      const duty = (it.set.phase + H - C.clk[2] / 2) / 360;
      return `<span>Plates</span><span>${b("pair", sh[0], "short")} ${b("pair", lg[0], "long")}</span>` +
        `<span>Top plate</span><span>${phases.map(p => b("phase", p, p + "°")).join(" ")}</span>` +
        `<span>Duty</span><span>${Math.round(duty * 100)} % high</span>`;
    }
    if (BOXES[it.name].bought.some(f => f[0] === "latch"))
      return `<span>Latch</span><span><button data-trip style="padding:2px 8px">Push the tab: reset the flag</button></span>`;
    if (it.name === "shift")
      return `<span>Stick</span><span>${b("gear", 1, "1st ×½")} ${b("gear", 0, "N")} ${b("gear", 2, "2nd ×1")}</span>` +
        `<span></span><span class="muted">shift with the line stopped: back the CLUTCH off first, as in a car</span>`;
    if (it.name === "escape")
      return `<span>Balls</span><span>${C.esc[4].map(r => b("balls", r, r + " mm")).join(" ")}</span>` +
        `<span>Beat</span><span>${escBeat(it).toFixed(2)} ticks a second at most (${(escBeat(it) * 4).toFixed(1)} rpm of W)</span>`;
    if (it.name === "ramp")
      return `<span>Plates</span><span>${C.clk_sets[2].map(f => b("f", f, f === "sine" ? "sine" : Math.round(f * 100) + " %")).join(" ")}</span>` +
        `<span></span><span class="muted">the rise's share of the cycle: 50 % a triangle, 100 % a sawtooth; the sine plate rises and falls as a cosine</span>`;
    return "";
  }
  let liveT = 0;
  function renderLive() {
    const el = $("live"); if (!el) return;
    const now = performance.now(); if (now - liveT < 150) return; liveT = now;
    const it = items.find(i => i.uid === selected); if (!it) return;
    const bx = BOXES[it.name], sp = spinsNow.get(it.uid) || {}, z = zeroSpins.get(it.uid) || {};
    let h = `<h3>Ports</h3><table><tr><th>Port</th><th>Lane</th><th>T</th><th>Meets</th><th>Line</th><th>rpm</th><th>Turns</th></tr>`;
    for (const r of portRows(it)) {
      const cls = Math.abs(r.rpm) < 1e-6 ? "idle" : r.rpm > 0 ? "fwd" : "rev";
      h += `<tr><td><b>${r.id}</b></td><td>${r.lane}</td><td>${r.teeth}</td><td>${r.link}</td><td>${r.ratio}</td>` +
        `<td class="${cls}">${(r.rpm >= 0 ? "" : "−") + Math.abs(r.rpm).toFixed(1)}</td><td>${r.turns.toFixed(2).replace("-", "−")}</td></tr>`;
    }
    h += `</table><div class="muted" style="font-size:12px;margin-top:4px">Line: pitch-line speed against the drive's output (×1 = the same speed; − = backwards). rpm and turns: + is forward (outputs counter-clockwise, inputs clockwise).</div>`;
    // what shows on the lid
    const show = [];
    const carry = bx.train.find(e => e[2] === "carry");
    if (carry) {   // one digit more than there are carries: TALLY's three, 00.0 to 99.9
      const nd = bx.train.filter(e => e[2] === "carry").length + 1, M = Math.pow(10, nd);
      const tenths = (carry[3] - (sp[carry[1]] || 0)) / 36;
      const v = ((Math.floor(tenths + 1e-6) % M) + M) % M;
      show.push(["Reads", `<span class="big">${String(Math.floor(v / 10)).padStart(nd - 1, "0")}.${v % 10}</span> <span class="muted">turns</span>`]);
    }
    if (sp.out !== undefined) show.push(["Output", `<b>${sp.out ? "N" : "E"}</b> (it flips every turn of the line)`]);
    if (it.name === "store") {
      const run = angle[it.uid] || 0, t = stoTension(it, run);
      show.push(["Wound", `<b>${(t / 360).toFixed(2)}</b> of a turn (${Math.round(t / 15)} of 24 clicks)`]);
      show.push(["Plunger", it.set.up ? "<b>up</b>: the spring runs the line" : stoLocked(run) ? "<b>down</b>, in a notch: the barrel is held" : "<b>down</b>, riding the rim to the next notch"]);
      show.push(["Barrel", `${(run / 360).toFixed(2)} turns run (E ${(run / 360 * 2.5).toFixed(2)})`]);
    }
    if (it.name === "escape") {
      const n = Math.floor(sp.cyc || 0), cap = Math.min(...[...(A.info.get(it.uid) || { drives: new Set() }).drives].map(d => capF[d] || 1), 1);
      show.push(["Ticks", `<b>${n}</b> teeth let through`]);
      show.push(["Foliot", `${(sp.A || 0).toFixed(1)}°, ${cap < 1 ? "<b>holding the line back</b> to its beat" : "keeping up: the line runs slower than its beat"}`]);
    }
    if (K.KEY[it.name]) {
      const full = it.name === "flip" ? C.push[2] : C.push[1];
      show.push(["Key", `<b>${(sp.stroke || 0).toFixed(1)}</b> of ${full.toFixed(1)} mm in`]);
      if (it.name === "click") show.push(["Presses", `<span class="big">${sp.presses || 0}</span> <span class="muted">(each turns the ports once)</span>`]);
      if (it.name === "flip") show.push(["Bat", `${Math.round((sp.stroke || 0) / C.push[2] * 50)}° of 50°`]);
    }
    if (it.name === "spin") show.push(["Shows", `<span class="big">${K.spinResult(sp.spinner || 0)}</span> <span class="muted">at the north arrow</span>`]);
    if (it.name === "fork") show.push(["Routes to", `<b>${sp.route}</b> (the wheel's lock holds it there)`]);
    if (it.name === "face") {
      // degrees clockwise from twelve: seconds, minutes, hours
      const cw = a => ((-a % 360) + 360) % 360, hh = Math.floor(cw(sp.hH || 0) / 30) || 12;
      const mm = Math.floor(cw(sp.hM || 0) / 6), ss = Math.floor(cw(sp.hS || 0) / 6 + 1e-6) % 60;
      show.push(["Reads", `<span class="big">${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}</span>`]);
      show.push(["Beats", `${(-((sp.S || 0) - (z.S || 0)) / 24).toFixed(1)} (one a second with TICK's balls in the middle)`]);
    }
    if (it.name === "hoist" && C.tp_hoist) {
      const h = hsState(sp, z);
      show.push(["Bucket", `<span class="big">${h.lift.toFixed(1)}</span> mm up (${C.tp_hoist[7].toFixed(0)} at most; 2 mm a W turn, and it stays put when you let go)`]);
    }
    if (it.name === "plot") {
      // the spots: [x along the sweep from the west end, y north of the middle]
      const P = C.plot, q = plotState(sp);
      const spots = P[10].map(k => plotPath(q.s + k * P[8] + P[8] / 2)).map(p => [p[0] - P[2], p[1] > P[4] + P[5] - 0.01 ? "on top" : "underneath"]);
      show.push(["Signal", `<b>${(q.y >= 0 ? "+" : "−") + Math.abs(q.y).toFixed(1)}</b> mm (north +, ${P[12]} mm at most)`]);
      show.push(["Spots", spots.map(([x, w], k) => w === "on top" ? `${k ? "2nd" : "1st"} at <b>${x.toFixed(0)}</b> of ${P[6]} mm` : `${k ? "2nd" : "1st"} underneath`).join(", ")]);
    }
    for (const s of Object.values(bx.st)) if ((s.top === "dial" && it.name !== "escape" && it.name !== "plot" && it.name !== "face") || (s.top === "crank" && it.name !== "store")) {
      const turns = ((sp[s.id] || 0) - (z[s.id] || 0)) / 360;
      show.push([(s.top === "crank" ? "Crank" : "Dial") + " " + s.id, `${turns.toFixed(2).replace("-", "−")} turns (${turns >= 0 ? "counter-clockwise" : "clockwise"})`]);
    }
    if (bx.bought.some(f => f[0] === "follower")) {
      const q = bx.bought.find(f => f[0] === "follower"), st = bx.st[q[2][0]];
      const rel = Math.atan2(q[1][1] - st.pos[1], q[1][0] - st.pos[0]) / D - (sp[st.id] || 0);
      let fz = followerZ(st.extra || "sine", rel);
      if (bx.bought.some(f => f[0] === "latch")) {
        if (it.tripped) fz = Math.max(fz, C.trip[1]);
        show.push(["Flag", it.tripped ? "<b>up</b>: the latch holds it (push the tab to reset)" : "<b>down</b>: armed, waiting for the bump"]);
      }
      show.push(["Follower", (fz - followerZ(st.extra || "sine", 0) + 0).toFixed(1) + " mm up"]);
    }
    if (bx.bought.some(f => f[0] === "yoke")) {
      const st = Object.values(bx.st).find(s => s.gears.some(g => g[1] === "crankpin"));
      show.push(["Slider", (C.yoke_r * Math.cos((sp[st.id] || 0) * D)).toFixed(1) + " mm east"]);
    }
    if (sp.gear !== undefined) show.push(["Gear", `<b>${["neutral", "1st", "2nd"][sp.gear]}</b>${sp.gear ? " (E at " + (sp.gear === 1 ? "×½" : "×1") + " of W)" : ": E stands still"}`]);
    if (sp.sel !== undefined) {
      const n = it.name === "pick" ? ["W", "S"] : ["E", "N"];
      const where = sp.sel < 0.01 ? n[0] : sp.sel > 0.99 ? n[1] : "nowhere (the idler is between)";
      show.push([it.name === "pick" ? "Takes" : "Routes to", `<b>${where}</b>`]);
    }
    if (sp.level !== undefined)
      show.push(["Level", `<b>${sp.level > 0.99 ? "high" : sp.level < 0.01 ? "low" : (sp.level > 0.5 ? "high " : "low ") + "→ " + Math.round(sp.level * 100) + " %"}</b> (${(sp.level * C.clk[1]).toFixed(1)} of ${C.clk[1].toFixed(1)} mm on N)`]);
    if (it.name === "geneva") show.push(["Steps", Math.round(-((sp.G || 0) - (z.G || 0)) / 90) + " quarter turns of the wheel"]);
    if (show.length) {
      h += `<h3>On the lid</h3><div class="kv">` + show.map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join("") + `</div>`;
    }
    const I = A.info.get(it.uid);
    if (I && Object.keys(I.depth).length) {
      const ds = Object.values(bx.st).filter(s => (s.top === "dial" || s.top === "wheel") && I.depth[s.id] !== undefined).map(s => s.id + " " + I.depth[s.id]);
      if (ds.length) h += `<div class="muted" style="font-size:12px;margin-top:6px">Meshes from the drive: ${ds.join(", ")} (readings stay within ${K.READ_MESHES}).</div>`;
    }
    el.innerHTML = h;
  }

  // ---- palette -------------------------------------------------------------------
  function renderPalette() {
    const el = $("palette"); el.innerHTML = "";
    const listed = new Set(GROUPS.flatMap(g => g[1])), other = Object.keys(BOXES).filter(n => !listed.has(n));
    for (const [g, names] of other.length ? GROUPS.concat([["Other", other]]) : GROUPS) {
      const ns = names.filter(n => BOXES[n]);
      if (!ns.length) continue;
      const h = document.createElement("h3"); h.textContent = g; el.appendChild(h);
      // the family's lid color, as a chip by its name
      const fam = (C.families || []).find(f => f[3].includes(ns[0]));
      if (fam) { const c = document.createElement("span"); c.style.cssText = `display:inline-block;width:10px;height:10px;border-radius:3px;margin-left:6px;vertical-align:-1px;border:1px solid var(--line);background:${fam[1]}`; h.appendChild(c); }
      const d = document.createElement("div"); d.className = "pal";
      for (const n of ns) {
        const bx = BOXES[n], b = document.createElement("button");
        b.className = bx.kind === "draft" ? "draft" : "";
        b.dataset.name = n;
        b.innerHTML = `<i class="lidpic"></i><span><b>${bx.label}</b><small>${bx.drive ? "budget " + K.BUDGET[n] : bx.kind === "draft" ? "draft" : "cost " + costText(n)}${bx.cells[0] * bx.cells[1] > 1 ? " · " + bx.cells[0] + "×" + bx.cells[1] : ""}</small></span>`;
        b.title = bx.kind === "draft" ? "Draft: drawn, not simulated yet" : "Click, then click the grid";
        b.onclick = () => startPlacing(n);
        d.appendChild(b);
      }
      el.appendChild(d);
    }
    lidPictures();
  }
  // each box's lid from above, its name and flow lines in ink, drawn here from
  // the box's own meshes, a few at a time so the page opens first
  const LIDPIC = {};
  function lidPictures() {
    const todo = [...document.querySelectorAll(".pal button")].filter(b => BOXES[b.dataset.name]);
    let r = null, sc = null, cam = null;
    const step = () => {
      try {
        if (!r) {
          r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
          sc = new THREE.Scene();
          sc.add(new THREE.HemisphereLight(0xffffff, 0x8a8072, 0.9));
          const l = new THREE.DirectionalLight(0xffffff, 0.5); l.position.set(-300, -500, 900); sc.add(l);
          cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1000); cam.position.set(0, 0, 400);
        }
        for (let k = 0; k < 4 && todo.length; k++) {
          const b = todo.shift(), n = b.dataset.name;
          if (!LIDPIC[n]) LIDPIC[n] = lidPicture(n, r, sc, cam);
          const i = b.querySelector(".lidpic");
          i.style.backgroundImage = `url(${LIDPIC[n]})`; i.style.backgroundColor = "transparent";
        }
      } catch (e) { todo.length = 0; }
      if (todo.length) setTimeout(step, 0);
      else if (r) { r.dispose(); r.forceContextLoss(); }
    };
    setTimeout(step, 50);
  }
  function lidPicture(n, r, sc, cam) {
    const bx = BOXES[n], it = { uid: "pic_" + n, name: n, x: 0, y: 0, set: K.defaults(n) };
    buildBox(it);
    const v = VIEWS.get(it.uid), g = v.group;
    scene.remove(g); g.position.set(0, 0, 0);
    v.label.visible = false; v.outline.visible = false; v.markers.forEach(m => m.visible = false); v.lids.forEach(m => m.visible = true);
    (v.walls || []).forEach(m => m.material = m.userData.mat);
    sc.add(g);
    const [hw, hh] = [bx.cells[0] * CELL / 2, bx.cells[1] * CELL / 2], px = 96;
    cam.left = -hw; cam.right = hw; cam.top = hh; cam.bottom = -hh; cam.updateProjectionMatrix();
    r.setPixelRatio(1); r.setSize(bx.cells[0] * px, bx.cells[1] * px, false);
    r.render(sc, cam);
    const url = r.domElement.toDataURL("image/png");
    sc.remove(g); dropBox(it.uid);
    return url;
  }

  // ---- placing and dragging --------------------------------------------------------
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x2fa84f, transparent: true, opacity: 0.28, depthWrite: false });
  let ghost = null;
  function setGhost(name) {
    if (ghost) { scene.remove(ghost); ghost = null; }
    if (!name) return;
    const bx = BOXES[name];
    ghost = new THREE.Mesh(new THREE.BoxGeometry(bx.cells[0] * CELL - 2, bx.cells[1] * CELL - 2, 26), ghostMat);
    ghost.visible = false; scene.add(ghost);
  }
  function startPlacing(n) {
    placing = n; setGhost(n);
    document.querySelectorAll(".pal button").forEach(b => b.classList.toggle("placing", b.dataset.name === n));
    toast("Click the grid to place " + BOXES[n].label + " (Shift keeps placing, Esc stops).");
  }
  function stopPlacing() {
    placing = null; setGhost(null);
    document.querySelectorAll(".pal button").forEach(b => b.classList.remove("placing"));
  }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  function pointer(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }
  function groundAt() { const p = new THREE.Vector3(); return ray.ray.intersectPlane(ground, p) ? p : null; }
  function cellFor(name, p, off) {
    const bx = BOXES[name];
    return [Math.round(p.x / CELL - bx.cells[0] / 2 - (off ? off[0] : 0)), Math.round(p.y / CELL - bx.cells[1] / 2 - (off ? off[1] : 0))];
  }
  let down = null, drag = null;
  const cv = renderer.domElement;
  cv.addEventListener("pointerdown", e => {
    pointer(e);
    down = { x: e.clientX, y: e.clientY };
    if (placing || e.button !== 0) return;
    const hit = ray.intersectObjects(pickables, false)[0];
    if (hit) {
      const uid = hit.object.userData.uid, it = items.find(i => i.uid === uid), p = groundAt();
      select(uid);
      if (p) {
        const bx = BOXES[it.name];
        drag = { uid, x0: it.x, y0: it.y, off: [p.x / CELL - bx.cells[0] / 2 - it.x, p.y / CELL - bx.cells[1] / 2 - it.y], moved: false };
        controls.enabled = false;
        cv.setPointerCapture(e.pointerId);
      }
    }
  }, true);
  cv.addEventListener("pointermove", e => {
    pointer(e);
    if (placing && ghost) {
      const p = groundAt(); if (!p) return;
      const [x, y] = cellFor(placing, p);
      const bx = BOXES[placing];
      ghost.visible = true;
      ghost.position.set((x + bx.cells[0] / 2) * CELL, (y + bx.cells[1] / 2) * CELL, 13);
      ghostMat.color.set(fits(placing, x, y) ? 0x2fa84f : 0xd63a2f);
      ghost.userData.cell = [x, y];
    } else if (drag) {
      const p = groundAt(); if (!p) return;
      const it = items.find(i => i.uid === drag.uid);
      const [x, y] = cellFor(it.name, p, drag.off);
      if (x !== it.x || y !== it.y) {
        drag.moved = true;
        it.x = x; it.y = y; placeView(it);
        VIEWS.get(it.uid).outline.material.color.set(fits(it.name, x, y, it.uid) ? 0x1f6fd6 : 0xd63a2f);
      }
    } else hover();
  });
  cv.addEventListener("pointerup", e => {
    const click = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5;
    if (drag) {
      const it = items.find(i => i.uid === drag.uid);
      if (!fits(it.name, it.x, it.y, it.uid)) { it.x = drag.x0; it.y = drag.y0; placeView(it); if (drag.moved) toast("That spot is taken."); }
      const moved = drag.moved && (it.x !== drag.x0 || it.y !== drag.y0);
      drag = null; controls.enabled = true;
      if (moved) changed(); else markOutlines();
      return;
    }
    if (placing && click && ghost && ghost.userData.cell) {
      const [x, y] = ghost.userData.cell;
      if (fits(placing, x, y)) {
        const it = addItem(placing, x, y);
        selected = it.uid;
        if (!e.shiftKey) stopPlacing();
        changed();
      } else toast("Boxes can't overlap, and they stay on the table.");
      return;
    }
    if (click && !placing) {
      const hit = ray.intersectObjects(pickables, false)[0];
      if (!hit) select(null);
    }
  });
  cv.addEventListener("contextmenu", e => { if (placing) { e.preventDefault(); stopPlacing(); } });
  let hoverUid = null;
  function hover() {
    const hit = ray.intersectObjects(pickables, false)[0];
    const u = hit ? hit.object.userData.uid : null;
    if (u !== hoverUid) { hoverUid = u; cv.style.cursor = u ? "grab" : ""; }
  }
  window.addEventListener("keydown", e => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if (e.key === "Escape") { stopPlacing(); select(null); }
    else if ((e.key === "Delete" || e.key === "Backspace") && selected) { removeItem(selected); changed(); }
    else if (e.key === " ") { e.preventDefault(); togglePlay(); }
    else if (e.key === "r" || e.key === "R") toast("Boxes never turn: the keys only let an output meet an input.");
    else if (selected && e.key.startsWith("Arrow")) {
      e.preventDefault();
      const it = items.find(i => i.uid === selected);
      const dx = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0, dy = e.key === "ArrowDown" ? -1 : e.key === "ArrowUp" ? 1 : 0;
      if (fits(it.name, it.x + dx, it.y + dy, it.uid)) { it.x += dx; it.y += dy; placeView(it); changed(); }
    }
  });

  // ---- toolbar ------------------------------------------------------------------
  function syncPlay() { $("play").textContent = playing ? "⏸ Pause" : "▶ Run"; $("play").classList.toggle("on", playing); }
  function togglePlay() {
    if (!items.some(i => BOXES[i.name].drive)) { toast("Place a CRANK, a MOTOR or a SPRING first: nothing turns without a drive."); return; }
    playing = !playing; syncPlay();
  }
  $("play").onclick = togglePlay;
  $("dir").onclick = () => { dir = -dir; $("dir").textContent = dir > 0 ? "Forward" : "Backward"; $("dir").classList.toggle("on", dir < 0); };
  $("stepF").onclick = () => { const s = dir; dir = 1; advance(0.25 * 60 / rpm); dir = s; update(); };
  $("stepB").onclick = () => { const s = dir; dir = -1; advance(0.25 * 60 / rpm); dir = s; update(); };
  $("zero").onclick = () => {
    for (const it of items) if (it.name === "store") it.set.wind -= angle[it.uid] || 0;   // the wind left stays
    for (const k in angle) angle[k] = 0; items.forEach(resetTrip); jam = null; $("jam").style.display = "none"; dynamicChecks(); update(true); renderIssues(); renderInspector(); };
  $("rpm").oninput = e => { rpm = +e.target.value; $("rpmv").textContent = rpm; dynamicChecks(); };
  $("lids").onclick = () => {
    showLids = !showLids; $("lids").textContent = showLids ? "Lids on" : "Lids off"; $("lids").classList.toggle("on", showLids);
    for (const v of VIEWS.values()) v.lids.forEach(m => m.visible = showLids);
  };
  $("walls").onclick = () => {
    glass = !glass; $("walls").classList.toggle("on", glass);
    for (const v of VIEWS.values()) (v.walls || []).forEach(m => m.material = glass ? MAT.glass : m.userData.mat);
  };
  $("names").onclick = () => {
    showNames = !showNames; $("names").classList.toggle("on", showNames);
    for (const v of VIEWS.values()) v.label.visible = showNames;
  };
  $("example").onchange = e => {
    const v = e.target.value; e.target.value = "";
    if (v === "clear") { clearAll(); changed(); } else if (EXAMPLES[v]) load(EXAMPLES[v]);
  };
  $("share").onclick = () => {
    save();
    let framed = true;
    try { framed = window.top !== window; } catch (e) { /* cross-origin frame */ }
    if (framed) { toast("This layout is saved in this browser. Open sim/index.html locally for a link that holds it."); return; }
    const url = location.href;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(
      () => toast("Link copied: it opens this layout."), () => toast("Copy this page's address: it holds the layout."));
  };
  $("fit").onclick = () => fit();
  const soundBtn = () => { $("sound").textContent = sound.on() ? "🔊 Sound" : "🔇 Muted"; $("sound").classList.toggle("on", sound.on()); };
  $("sound").onclick = () => { sound.set(!sound.on()); soundBtn(); };
  soundBtn();
  let toastT = 0;
  function toast(t) { const el = $("toast"); el.textContent = t; el.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => el.style.opacity = 0, 2600); }

  // ---- saving: the address holds the layout ----------------------------------------
  // name@x,y, and a switch's or a clock's setting after "~"
  const SETKEYS = { shift: ["gear"], square: ["pair", "phase"], ramp: ["f"], route: ["sel"], pick: ["sel"], steer: ["sel"] };
  const enc = () => items.map(i => i.name + "@" + i.x + "," + i.y +
    (SETKEYS[i.name] ? "~" + SETKEYS[i.name].map(k => i.set[k]).join(",") : "")).join(";");
  function save() {
    const h = "#" + enc();
    try { history.replaceState(null, "", h); } catch (e) { /* a sandboxed frame */ }
    try { localStorage.setItem("gbs-sandbox", enc()); } catch (e) { /* no storage */ }
  }
  function dec(s) {
    return s.split(";").filter(Boolean).map(t => {
      const m = t.match(/^([a-z0-9]+)@(-?\d+),(-?\d+)(?:~([\w.,]+))?$/);
      if (!m) return null;
      const set = {};
      if (m[4] && SETKEYS[m[1]]) m[4].split(",").forEach((v, i) => { if (SETKEYS[m[1]][i]) set[SETKEYS[m[1]][i]] = isNaN(+v) ? v : +v; });
      return [m[1], +m[2], +m[3], set];
    }).filter(Boolean);
  }

  // ---- camera ----------------------------------------------------------------------
  function fit() {
    let x0 = 0, y0 = 0, x1 = 3, y1 = 2;
    if (items.length) {
      x0 = Math.min(...items.map(i => i.x)); y0 = Math.min(...items.map(i => i.y));
      x1 = Math.max(...items.map(i => i.x + BOXES[i.name].cells[0])); y1 = Math.max(...items.map(i => i.y + BOXES[i.name].cells[1]));
    }
    const cx = (x0 + x1) / 2 * CELL, cy = (y0 + y1) / 2 * CELL, r = Math.max((x1 - x0) * 0.8, (y1 - y0) * 1.1, 2.2) * CELL;
    controls.target.set(cx, cy, 10);
    const k = Math.max(1, camera.aspect < 1.2 ? 1.6 / camera.aspect : 1);
    camera.position.set(cx + r * 0.28 * k, cy - r * 1.2 * k, r * 1.1 * k + 70);
    controls.update();
  }
  function resize() {
    const w = view.clientWidth, h = view.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);

  // ---- go -----------------------------------------------------------------------------
  renderPalette();
  let start = location.hash.length > 1 ? dec(decodeURIComponent(location.hash.slice(1))) : null;
  if (!start) { try { const s = localStorage.getItem("gbs-sandbox"); if (s) start = dec(s); } catch (e) { /* none */ } }
  resize();
  load(start && start.length ? start : EXAMPLES.demo1);
  let last = performance.now();
  function frame(t) {
    const dt = Math.min(0.1, (t - last) / 1000); last = t;
    frameDt = playing ? dt : 0;
    if (playing && advance(dt)) update();
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.GBS_APP = { sound, items: () => items, load, angle, mode, advance, issues: allIssues, select };
})();
