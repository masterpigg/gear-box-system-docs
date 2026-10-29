// Gear Box System sandbox: kinematics. Pure functions, no drawing.
//
// A box's stacks turn as lib/gbs.scad says they do: this file is a line-for-
// line port of gbs_mesh_spin(), _gbs_spins() and gbs_link_spin(), so the
// sandbox and the fit checks agree on every angle. selfTest() checks that
// against the reference spins sim/export.sh writes from OpenSCAD.
//
// Spins are degrees, counter-clockwise from above. Forward: an output port
// (E, N) turns counter-clockwise, an input port (W, S) clockwise.
(function (root) {
  "use strict";
  const D = Math.PI / 180;
  const atan2d = (y, x) => Math.atan2(y, x) / D;

  // ---- box description access (gbs.scad's layout) -------------------------
  // rec: one entry of GBS_DATA.boxes: {name, kind, box, stacks, parts, ref}
  //   box    = [name, label, cells, ports, stacks, train, label_at, marks?, bought?]
  //   stacks = gbs_stacks(b): the port stacks first, all in place
  function prep(rec, C) {
    const b = rec.box;
    const st = {};
    for (const s of rec.stacks) st[s[0]] = { id: s[0], pos: s[1], gears: s[2], top: s[3], flip: s[4], extra: s[5] };
    const ports = b[3].map(p => ({ id: p[0], side: p[1], at: p[2], teeth: p[3],
      layer: (p[1] === "E" || p[1] === "W") ? 1 : 2, pos: st[p[0]].pos,
      input: p[1] === "W" || p[1] === "S" }));
    return {
      name: rec.name, kind: rec.kind, label: b[1], cells: b[2], ports, st,
      train: b[5], bought: b.length > 8 ? b[8] : [], ref: rec.ref, parts: rec.parts,
      half: [b[2][0] * C.cell / 2, b[2][1] * C.cell / 2],
      drive: rec.name === "crank" || rec.name === "motor" || rec.name === "store" || KEY[rec.name] || BRAIN_DRIVE[rec.name],
    };
  }

  // the pressed keys (lib/push.scad): PUSH and FLIP spring back, CLICK counts
  const KEY = { push: 1, flip: 1, click: 1 };
  // the brain boxes with motors (lib/brain.scad): drives, both motors run together
  const BRAIN_DRIVE = { brain: 1, cbdrive: 1 };
  // ---- gears (gbs.scad, "motion") -----------------------------------------
  const special = g => typeof g[1] === "string";
  function gteeth(g, C) {
    if (!special(g)) return g[1];
    const k = g[1];
    return k === "lock" ? 20 : k === "bev15" ? 15 : k === "ring" ? C.pl[3] : k === "carrier" ? C.pl[4] : 10;
  }
  const goff = g => special(g) && g[1] === "p10" ? g[2] + 90 : 0;
  const gat = (s, l) => s.gears.find(g => g[0] === l);
  // gbs_mesh_spin: gear 2 (t2 teeth) at angle th from gear 1 (t1, spun phi1)
  const meshSpin = (t1, phi1, th, t2) => th + 180 - (t1 / t2) * (phi1 + 90 - th) - 90 - 180 / t2;
  // OpenSCAD's lookup(): linear, clamped at the ends
  function lookup(x, tab) {
    if (x <= tab[0][0]) return tab[0][1];
    for (let i = 1; i < tab.length; i++)
      if (x <= tab[i][0]) {
        const [x0, y0] = tab[i - 1], [x1, y1] = tab[i];
        return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
      }
    return tab[tab.length - 1][1];
  }
  function carryQ(n, C) {
    const d = Math.floor(n / 10), x = n - 10 * d;
    return C.odo_rest + 72 * d + lookup(x, C.odo_trace);
  }
  const bevSpin = (pin, C) => -(pin - C.bev_p0) * C.bev_teeth[1] / C.bev_teeth[0];
  // the other way (DYNAMO: the stack turns the motor's pinion), gbs_bev_pin
  const bevPin = (st, C) => C.bev_p0 - st * C.bev_teeth[0] / C.bev_teeth[1];
  function genevaSpin(u, C) {
    const n = Math.floor((u + 180) / 360), r = u - 360 * n;
    const psi = Math.abs(r) <= 45 ? atan2d(C.gen_a * Math.sin(r * D), C.gen_c - C.gen_a * Math.cos(r * D)) : Math.sign(r) * 45;
    return -(90 * n + psi);
  }
  const plCarrier = (sun, ring, s0, r0, C) => (C.pl[0] * (sun - s0) + C.pl[2] * (ring - r0)) / (C.pl[0] + C.pl[2]);

  // _gbs_spins: every stack's spin from the roots' ({id: spin})
  function spins(bx, roots, C) {
    const acc = Object.assign({}, roots);
    for (const e of bx.train) {
      const c = bx.st[e[0]], p = bx.st[e[1]], l = e[2];
      const sp = acc[p.id] || 0;
      const th = atan2d(c.pos[1] - p.pos[1], c.pos[0] - p.pos[0]);
      let s;
      if (l === "carry") s = carryQ((e[3] - sp) / 36, C);
      else if (l === "bevel") s = c.top === "motor" ? bevPin(sp, C) : bevSpin(sp, C);
      else if (l === "clutch") s = sp;     // the upper stack turns with the lower (it slips only under load)
      else if (l === "geneva") s = genevaSpin(sp - th, C);
      else if (l === "planetary") s = plCarrier(sp, acc[e[3]] || 0, e[4], e[5], C);
      else {
        const gp = gat(p, l), gc = gat(c, l);
        s = meshSpin(gteeth(gp, C), sp + goff(gp), th, gteeth(gc, C)) - goff(gc);
      }
      acc[c.id] = s;
    }
    return acc;
  }
  // DYNAMO: fed at W, the train runs from W (J turns the S gear); fed at S
  // only, W turns with it, backward through J (the train is linear in W)
  function dynSpins(bx, roots, C) {
    if (roots.W !== undefined || roots.S === undefined) return spins(bx, { W: roots.W || 0 }, C);
    const s0 = spins(bx, { W: 0 }, C).S, s1 = spins(bx, { W: 1 }, C).S;
    return spins(bx, { W: (roots.S - s0) / (s1 - s0) }, C);
  }
  // gbs_link_spin: the input port's spin, from the output port it meshes with
  function linkSpin(pout, oOut, sOut, pin, oIn) {
    const c1 = [oOut[0] + pout.pos[0], oOut[1] + pout.pos[1]], c2 = [oIn[0] + pin.pos[0], oIn[1] + pin.pos[1]];
    return meshSpin(pout.teeth, sOut, atan2d(c2[1] - c1[1], c2[0] - c1[0]), pin.teeth);
  }

  // ---- the switches (lib/switch.scad sw_spins) and the clocks (clk_spins) ---------
  // These move by their own code in OpenSCAD, so they have their own here.
  const SWITCH = { route: 1, pick: 1, steer: 1 }, CLOCK = { square: 1, ramp: 1 };
  const angTo = (f, t) => atan2d(t[1] - f[1], t[0] - f[0]);
  const ENGAGE = 0.01;          // the idler meshes within 1 % of a rest
  function swRests(kind, C) { return C.sw_rests.find(r => r[0] === kind)[1]; }
  function swArm(kind, sel, C) { const r = swRests(kind, C); return r[0] + (r[2] - r[0]) * sel; }
  // the pure motion: a port the idler doesn't mesh stands at 0. hold(id, spin,
  // meshed, teeth) lets the sandbox keep it where it stopped instead.
  const pureHold = (id, s, on) => on ? s : 0;
  function swSpins(bx, roots, sel, C, hold) {
    hold = hold || pureHold;
    const [ri, ti, tc, tg, tt] = C.sw, kind = bx.name;
    const a = swArm(kind, sel, C), ip = [ri * Math.cos(a * D), ri * Math.sin(a * D)];
    const on0 = Math.abs(sel) < ENGAGE, on1 = Math.abs(sel - 1) < ENGAGE;
    const P = id => bx.st[id].pos, teeth = id => bx.ports.find(p => p.id === id).teeth;
    if (kind === "pick") {
      const src = on1 ? "S" : "W", live = on0 || on1;
      const si = live ? meshSpin(teeth(src), roots[src] || 0, angTo(P(src), ip), ti) : 0;
      const so = hold("O", live ? meshSpin(ti, si, angTo(ip, [0, 0]), tc) : 0, live, tc);
      return Object.assign(spins(bx, { W: roots.W || 0, S: roots.S || 0, O: so }, C), { arm: a, idler: si, ip });
    }
    const sA = spins(bx, { W: roots.W || 0 }, C).A;
    const si = meshSpin(tc, sA, a, ti);
    const sE = hold("E", on0 ? meshSpin(ti, si, angTo(ip, P("E")), teeth("E")) : 0, on0, teeth("E"));
    const sN = hold("N", on1 ? meshSpin(ti, si, angTo(ip, P("N")), teeth("N")) : 0, on1, teeth("N"));
    const out = Object.assign(spins(bx, { W: roots.W || 0, E: sE, N: sN }, C), { arm: a, idler: si, ip });
    if (kind === "steer") {
      const Tp = P("T"), sT = meshSpin(tg, a, angTo([0, 0], Tp), tt);
      out.T = sT;
      out.S = roots.S !== undefined ? roots.S : meshSpin(tt, sT, angTo(Tp, P("S")), teeth("S"));
    }
    return out;
  }
  // the shift box (lib/shift.scad's sh_spins): gear 1, 0 (neutral) or 2. W
  // always turns P1 and P2; the idler on the arm meshes O, and P1 (1st) or
  // P2 (2nd). In neutral O stands still (hold: where it stopped).
  function shSpins(bx, roots, gear, C, hold) {
    hold = hold || pureHold;
    const [o, ri, ti, to, rests, , p1, p2] = C.sh;
    const a = gear === 1 ? rests[0] : gear === 2 ? rests[2] : rests[1];
    const ip = [o[0] + ri * Math.cos(a * D), o[1] + ri * Math.sin(a * D)];
    const s0 = spins(bx, { W: roots.W || 0 }, C), on = gear === 1 || gear === 2;
    const sOm = on ? meshSpin(ti, gear === 1 ? meshSpin(12, s0.P1, angTo(p1, ip), ti) : meshSpin(16, s0.P2, angTo(p2, ip), ti), angTo(ip, o), to) : 0;
    const sO = hold("O", sOm, on, to);
    const si = gear === 1 ? meshSpin(12, s0.P1, angTo(p1, ip), ti) : gear === 2 ? meshSpin(16, s0.P2, angTo(p2, ip), ti) :
      meshSpin(to, sO, angTo(o, ip), ti);
    return Object.assign(spins(bx, { W: roots.W || 0, O: sO }, C), { arm: a, idler: si, ip, gear });
  }
  // the swap box (lib/swap.scad's swap_spins), from its table: one row a
  // degree of the line over two flips (720), each stack moving on by the
  // same amount every 720. turn: the line forward (W has 24 teeth: 2/3 of it)
  // The table's E and N jump whole teeth where the idler picks them up again
  // (the model puts them back in mesh: the same look, a tooth on); a line
  // downstream would count those, so they come out here, and E and N turn
  // only while the idler drives them.
  let sxTab = null;
  function sxTable(C) {
    if (sxTab && sxTab.src === C.sx[1]) return sxTab.rows;
    const [, tab, keys] = C.sx, rows = tab.map(r => r.slice()), p = 360 / 16;
    for (const id of ["E", "N"]) {
      const j = keys.indexOf(id);
      let off = 0;
      for (let i = 1; i < rows.length; i++) {
        const d = tab[i][j] - tab[i - 1][j];
        if (Math.abs(d) > 8) off -= p * Math.round(d / p);
        rows[i][j] = tab[i][j] + off;
      }
    }
    sxTab = { src: C.sx[1], rows };
    return rows;
  }
  function swapSpins(bx, turn, C) {
    const keys = C.sx[2], tab = sxTable(C), k = Math.floor(turn / 720), u = turn - 720 * k, i = Math.min(719, Math.floor(u)), f = u - i;
    const out = {};
    keys.forEach((id, j) => out[id] = tab[i][j] + (tab[i + 1][j] - tab[i][j]) * f + k * (tab[720][j] - tab[0][j]));
    out.out = (((Math.floor((turn + 180) / 360)) % 2) + 2) % 2;   // the live output: 0 E, 1 N (sx_state)
    return out;
  }
  // the clock's cam plates: radius against time (t in cycles)
  function clkR(kind, set, phase, t, C) {
    const [rl, rise, ramp] = C.clk;
    const sm = x => x * x * (3 - 2 * x);
    const sq = (t, H) => { const u = 360 * (t - Math.floor(t)); return u < ramp ? rl + rise * sm(u / ramp) : u < H ? rl + rise : rl; };
    const rp = (t, f) => { const u = t - Math.floor(t); return f === "sine" ? rl + rise * (1 - Math.cos(2 * Math.PI * u)) / 2 : u < f ? rl + rise * u / f : rl + rise * (1 - u) / (1 - f); };
    const plate = k => kind === "ramp" ? rp(t, set) : sq(t - (k === 1 ? phase / 360 : 0), set);
    return Math.max(plate(0), plate(1));
  }
  // the finger center's distance from the axis (clk_finger)
  function clkFinger(kind, set, phase, t, C) {
    const f = C.clk[3];
    let best = -Infinity;
    for (let d = -40; d <= 40; d += 2) {
      const r = clkR(kind, set, phase, t + d / 360, C), sn = r * Math.sin(d * D);
      if (Math.abs(sn) < f) best = Math.max(best, r * Math.cos(d * D) + Math.sqrt(f * f - sn * sn));
    }
    return best;
  }
  function clkSpins(bx, roots, set, phase, C) {
    const sC = spins(bx, { W: roots.W || 0 }, C).C, t = sC / 360;
    const fx = clkFinger(bx.name, set, phase, t, C), flo = C.clk[4];
    const sP = -(fx - flo) / 6 * 180 / Math.PI;                    // P has 12 teeth: radius 6
    const sN = meshSpin(12, sP, angTo(bx.st.P.pos, bx.st.N.pos), 16);
    return Object.assign(spins(bx, { W: roots.W || 0, P: sP, N: sN }, C), { slider: -fx, t, level: (fx - flo) / C.clk[1] });
  }
  // the spring store (lib/store.scad's sto_spins): the barrel B runs clockwise
  // `run` degrees, the arbor A is wound clockwise `wind`
  function stoSpins(bx, wind, run, C) {
    return Object.assign(spins(bx, { B: -run }, C), { A: -wind });
  }
  // the escapement (lib/escape.scad's esc_spins): state k of esc_states (a
  // fraction runs between two) after n whole cycles; C is the root, W
  // follows it back through the mesh
  function escSpins(bx, k, n, C) {
    const S = C.esc[3], i = Math.min(S.length - 2, Math.floor(k)), f = k - i, a = S[i], b = S[i + 1];
    const sC = C.esc[1] + a[1] + (b[1] - a[1]) * f + 360 / C.esc[2] * n;
    return Object.assign(spins(bx, { C: sC }, C), { A: a[0] + (b[0] - a[0]) * f });
  }
  // driven from W: a cycle (one tooth, 24 degrees of W forward) runs
  // through the states in order; `cyc` counts the cycles
  function escFromW(bx, w, C) {
    const w0 = spins(bx, { C: 0 }, C).W;               // W where C is at 0
    const u = ((w0 - w) / 2 - C.esc[1]) * C.esc[2] / 360, n = Math.floor(u);
    return Object.assign(escSpins(bx, (u - n) * (C.esc[3].length - 1), n, C), { cyc: u });
  }
  // the clock face (lib/face.scad's fc_spins): the train, then the center
  // wheel W off E, the minute tube M (W less what was pushed round: `set`
  // minutes), the minute wheel N and the hour wheel H; hS, hM, hH: how far
  // each hand has turned from its rest (counter-clockwise +, as a spin)
  function faceSpins(bx, roots, set, C) {
    const sp = spins(bx, roots.S === undefined ? { S: 0 } : roots, C), e = bx.st.E.pos, n = bx.st.N.pos;
    const W = meshSpin(12, sp.E, atan2d(-e[1], -e[0]), 48), M = W - 6 * set;
    const N = meshSpin(15, M, atan2d(n[1], n[0]), 45), H = meshSpin(12, N, atan2d(-n[1], -n[0]), 48);
    Object.assign(sp, { W, M, N, H });
    if (!bx.fcRest) { bx.fcRest = {}; const r = faceSpins(bx, { S: 0 }, 0, C); bx.fcRest = { B: r.B, M: r.M, H: r.H }; }
    return Object.assign(sp, { hS: sp.B - bx.fcRest.B, hM: M - bx.fcRest.M, hH: H - bx.fcRest.H });
  }
  // SPIN (lib/spin.scad's spin_spins, rest = true): the spinner runs `coast`
  // degrees past S and the detent parks it on the nearest of six sectors; its
  // rim (36) turns O's pinion (12), and O drives E
  function spinSpins(bx, roots, coast, C) {
    const W = roots.W === undefined ? 0 : roots.W, o = bx.st.O.pos;
    const sp = 60 * Math.round((spins(bx, { W }, C).S + coast) / 60);
    const O = meshSpin(36, sp, atan2d(o[1], o[0]), 12);
    return Object.assign(spins(bx, { W, O }, C), { spinner: sp });
  }
  // the number at the north arrow (spin_result)
  const spinResult = sp => { const k = Math.round(-sp / 60); return ((k % 6) + 6) % 6 + 1; };
  // FORK (lib/fork.scad's fork_spins): the carrier rolled `roll` rests of 60
  // degrees; even rolls put a planet on X (to E), odd ones on Y (to N); the
  // other output stands still
  function forkSpins(bx, roots, roll, C) {
    const W = roots.W === undefined ? 0 : roots.W, X = bx.st.X.pos, Y = bx.st.Y.pos;
    const ax = atan2d(X[1], X[0]), ay = atan2d(Y[1], Y[0]), R = 12.5;
    const sZ = spins(bx, { W }, C).Z, at = p => 60 * roll + ax + 120 * p;
    const ps = [0, 1, 2].map(p => meshSpin(12, sZ, at(p), 13));
    const e = ((roll % 2) + 2) % 2 === 0, a = e ? ax : ay, Q = e ? X : Y;
    const pk = [0, 1, 2].find(p => Math.abs((((at(p) - a) % 360) + 540) % 360 - 180) < 1);
    const P = [R * Math.cos(a * D), R * Math.sin(a * D)];
    const so = meshSpin(13, ps[pk], atan2d(Q[1] - P[1], Q[0] - P[0]), 14);
    return Object.assign(spins(bx, { W, [e ? "X" : "Y"]: so, [e ? "Y" : "X"]: 0 }, C),
      { carrier: 60 * roll, P0: ps[0], P1: ps[1], P2: ps[2], route: e ? "E" : "N" });
  }
  // a key pressed s mm after n whole presses (push_spins, right hand): K turns
  // clockwise as the key goes in, P with the pinion; CLICK's K keeps its presses
  function pushSpins(bx, s, n, C) {
    const rp = C.push[0], kp = -(s / rp) / D;
    const K = bx.name === "click" ? -(n * 180) + kp : kp;
    return Object.assign(spins(bx, { K }, C), { P: kp, stroke: s, presses: n });
  }
  // a key's drive angle: 360 degrees a press, in for the first half and out
  // for the second (whichever way it is run: a key only goes in)
  function keyStroke(name, angle, C) {
    const a = Math.abs(angle), n = Math.floor(a / 360), ph = a - 360 * n;
    const f = ph < 180 ? ph / 180 : (360 - ph) / 180;
    return { s: f * (name === "flip" ? C.push[2] : C.push[1]), n };
  }
  // a special box's default settings (the store starts wound a full turn,
  // its plunger down; the escapement's balls in the middle pockets)
  function defaults(name) {
    return name === "square" ? { pair: 140, phase: 60 } : name === "ramp" ? { f: 0.5 } : SWITCH[name] ? { sel: 0 } :
      name === "store" ? { wind: 360, up: 0 } : name === "escape" ? { balls: 18 } : name === "shift" ? { gear: 1 } : name === "face" ? { set: 0 } : name === "spin" ? { coast: 0 } : name === "fork" ? { roll: 0 } : {};
  }

  // the roots a box file turns (export_data.scad's sim_roots)
  function refRoots(bx, turn) {
    if (bx.name === "crank") return { K: -turn };
    if (bx.name === "motor") return { M: turn };
    if (bx.name === "dynamo") return { W: -turn };   // S and the motor are driven
    const r = {};
    for (const p of bx.ports) if (p.input) r[p.id] = -turn;
    for (const s of Object.values(bx.st)) if (s.top === "motor") r[s.id] = turn;
    return r;
  }
  // every catalog box against OpenSCAD's own spins: [ok, total, worst message]
  function selfTest(boxes, C) {
    let ok = 0, n = 0, bad = [];
    for (const bx of Object.values(boxes)) {
      if (!bx.ref || !bx.ref.length) continue;
      n++;
      let worst = 0, at = "";
      for (const r of bx.ref) {
        const turn = r[0], want = r[r.length - 1];
        let got;
        if (SWITCH[bx.name]) {
          const sel = r[1][0];
          const roots = bx.name === "pick" ? { W: sel < ENGAGE ? -turn : 0, S: Math.abs(sel - 1) < ENGAGE ? -turn : 0 } : { W: -turn };
          got = swSpins(bx, roots, sel, C);
        } else if (CLOCK[bx.name]) got = clkSpins(bx, { W: -turn }, r[1][0], r[1][1], C);
        else if (bx.name === "store") got = stoSpins(bx, r[1][0], turn, C);
        else if (bx.name === "escape") got = escSpins(bx, r[1][0], turn, C);
        else if (bx.name === "shift") got = shSpins(bx, { W: -turn }, r[1][0], C);
        else if (bx.name === "swap") got = swapSpins(bx, turn, C);
        else if (bx.name === "face") got = faceSpins(bx, { S: -turn }, r[1][0], C);
        else if (bx.name === "spin") got = spinSpins(bx, { W: -turn }, r[1][0], C);
        else if (KEY[bx.name]) got = pushSpins(bx, turn, r[1][0], C);
        else if (bx.name === "fork") got = forkSpins(bx, { W: -turn }, r[1][0], C);
        else got = spins(bx, refRoots(bx, turn), C);
        for (const k in want) {
          let d = Math.abs((got[k] || 0) - want[k]);
          // SWAP's ports: the same to a whole tooth (see sxTable)
          if (bx.name === "swap" && (k === "E" || k === "N")) d = Math.abs(d - 22.5 * Math.round(d / 22.5));
          if (d > worst) { worst = d; at = k + " at " + turn; }
        }
      }
      // OpenSCAD echoes six significant digits
      if (worst < 0.05) ok++; else bad.push(bx.name + " (" + at + ": " + worst.toFixed(3) + "°)");
    }
    return { ok, n, bad };
  }

  // ---- a layout -------------------------------------------------------------
  // items: [{uid, name, x, y}] with x, y the box's south-west cell.
  // Returns the links, the issues and an evaluator for the drive angles.
  const COST = { // STANDARD.md "Torque budget" and docs/boxes/INDEX.md
    wire: 2, wire2: 4, wire3: 6, pole2: 4, pole3: 6, branch: { E: 3, N: 3 }, tee: 3, turn: 3, tap: 3, reverse: 3, quarter: 3, riser: 4,
    counter: 4, toll: 4, tally: 8, swap: 8, geneva: 3, ratchet: 3, adder: 5, escape: 2, shift: 5, double: 3, half: 3, cam: 2, yoke: 2, flywheel: 3, clutch: 3, trip: 2, governor: 3,
    route: 3, pick: 3, steer: 3, square: 4, ramp: 4,
    // a box whose inputs cost differently: a cost per port
    plot: { W: 7, S: 3 }, sketch: { SX: 5, SY: 5 }, meter: { W1: 2, W2: 2, S: 5 },
    // FACE: 8 meshes by count, but it loads the line like a 3 (docs/boxes/face.md,
    // "Torque cost"); Paul's call, 2026-10-27, until a print says otherwise
    face: 3,
    // or a cost per output
    bus: { E1: 3, E2: 5, N: 5 },
    // HOIST: a spur stage and the worm (docs/boxes/hoist.md); a sensed input: its two stages (brain.md)
    hoist: 9, cbsense: 2,
    // DYNAMO: the generator's drag, a first guess (docs/boxes/dynamo.md, "Torque");
    // W reaches the S gear through an idler, two meshes more
    dynamo: { W: 14, S: 12 },
    spin: 5, fork: 5, trig: 6, wave: 4, shuffle: 4, orrery: 4, beat: 3, boom: 2, roll: 2,
  };
  // is a box's cost given per input port (or per output)?
  const perIn = bx => typeof COST[bx.name] === "object" && bx.ports.some(p => p.input && COST[bx.name][p.id] !== undefined);
  // a key's press budget (docs/boxes/push.md); the band pulls back only 4
  const BUDGET = { crank: 20, motor: 15, store: 6, push: 12, flip: 12, click: 12, brain: 10, cbdrive: 12 }, KEY_RETURN = 4;
  const SPECIAL_EDGES = {
    route: [["E", "W", 3], ["N", "W", 3]], steer: [["E", "W", 3], ["N", "W", 3]],
    pick: [["E", "W", 3], ["E", "S", 3]], square: [["N", "W", 3]], ramp: [["N", "W", 3]], escape: [["C", "W", 1]],
    swap: [["A", "W", 1], ["I", "A", 1], ["E", "I", 1], ["N", "I", 1]],
    // SPIN: through S to the spinner, its rim to O; FORK: W to the sun Z, a planet to X or Y
    spin: [["A", "W", 1], ["B", "A", 1], ["S", "B", 1], ["O", "S", 1], ["E", "O", 1]],
    fork: [["I", "W", 1], ["Z", "I", 1], ["X", "Z", 2], ["Y", "Z", 2], ["E", "X", 1], ["N", "Y", 1]],
    shift: [["P1", "W", 1], ["P2", "W", 1], ["I", "P1", 1], ["I", "P2", 1], ["O", "I", 1], ["F", "O", 1], ["E", "F", 1]] };
  const READ_MESHES = 8;   // STANDARD.md: a dial or counter within 8 meshes of its drive

  function origin(it, bx, C) {
    return [(it.x + bx.cells[0] / 2) * C.cell, (it.y + bx.cells[1] / 2) * C.cell];
  }
  function occupied(items, boxes) {
    const m = new Map();
    for (const it of items) {
      const bx = boxes[it.name];
      for (let i = 0; i < bx.cells[0]; i++) for (let j = 0; j < bx.cells[1]; j++) {
        const k = (it.x + i) + "," + (it.y + j);
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(it.uid);
      }
    }
    return m;
  }

  function analyze(items, boxes, C) {
    const issues = [], blank = [];
    const by = new Map(items.map(it => [it.uid, it]));
    const O = new Map(items.map(it => [it.uid, origin(it, boxes[it.name], C)]));
    const near = (a, b) => Math.abs(a - b) < 0.01;
    // overlaps
    for (const [k, us] of occupied(items, boxes)) if (us.length > 1)
      issues.push({ level: "error", uids: us, text: "Two boxes on one cell (" + k + ")." });
    // links: an output port meets an input port at the same place on a shared edge
    const links = [], feeds = new Map();   // feeds: "uid:port" -> [link]
    const outs = new Map();                // "uid:port" -> link | {wall} | null
    for (const a of items) {
      const A = boxes[a.name], oa = O.get(a.uid);
      for (const p of A.ports) {
        if (p.input) continue;
        const east = p.side === "E";
        const edge = east ? oa[0] + A.half[0] : oa[1] + A.half[1];
        const along = (east ? oa[1] : oa[0]) + p.at;
        let found = null, facing = null;
        for (const b of items) {
          if (b.uid === a.uid) continue;
          const B = boxes[b.name], ob = O.get(b.uid);
          const bedge = east ? ob[0] - B.half[0] : ob[1] - B.half[1];
          const lo = (east ? ob[1] - B.half[1] : ob[0] - B.half[0]), hi = lo + 2 * (east ? B.half[1] : B.half[0]);
          if (!near(edge, bedge) || along <= lo || along >= hi) continue;
          facing = b;
          for (const q of B.ports) {
            if (q.side !== (east ? "W" : "S")) continue;
            if (near((east ? ob[1] : ob[0]) + q.at, along)) found = { b, q };
          }
        }
        if (found) {
          const L = { from: a.uid, out: p.id, to: found.b.uid, inp: found.q.id };
          links.push(L);
          const k = found.b.uid + ":" + found.q.id;
          if (!feeds.has(k)) feeds.set(k, []);
          feeds.get(k).push(L);
          outs.set(a.uid + ":" + p.id, L);
        } else if (facing) {
          const B = boxes[facing.name];
          const other = B.ports.filter(q => q.side === (east ? "W" : "S"));
          outs.set(a.uid + ":" + p.id, { wall: facing.uid });
          if (other.length) {
            const lane = x => "ABC"[[-16, 0, 16].indexOf((((x - C.cell / 2) % C.cell) + 1.5 * C.cell) % C.cell - C.cell / 2)] || "?";
            issues.push({ level: "warn", uids: [a.uid, facing.uid],
              text: A.label + " " + p.id + " (lane " + lane(along) + ") meets " + B.label + "'s " +
                (east ? "W" : "S") + " side where it has no port: " + B.label + "'s " + other.map(q => q.id).join(", ") +
                (other.length > 1 ? " are" : " is") + " elsewhere on that side, so nothing meshes." });
          } else   // a side with no ports: a warning once we know the output is driven (below)
            blank.push({ u: a.uid, port: p.id, uids: [a.uid, facing.uid],
              text: A.label + " " + p.id + " meets " + B.label + "'s " + (east ? "W" : "S") + " side, which has no ports: " +
                B.label + " isn't driven from there." });
        }
      }
    }
    for (const [k, ls] of feeds) if (ls.length > 1)
      issues.push({ level: "error", uids: ls.map(l => l.from).concat([ls[0].to]),
        text: "One input fed from two outputs (" + k.split(":")[1] + "): they fight, and the line locks." });

    // order: the links only run east and north, so this is a DAG on a grid;
    // anything left over is a loop
    const indeg = new Map(items.map(it => [it.uid, 0])), nexts = new Map(items.map(it => [it.uid, []]));
    for (const L of links) { indeg.set(L.to, indeg.get(L.to) + 1); nexts.get(L.from).push(L.to); }
    const order = [], q = items.filter(it => indeg.get(it.uid) === 0).map(it => it.uid);
    while (q.length) { const u = q.shift(); order.push(u); for (const v of nexts.get(u)) { indeg.set(v, indeg.get(v) - 1); if (!indeg.get(v)) q.push(v); } }
    if (order.length < items.length)
      issues.push({ level: "error", uids: items.filter(it => !order.includes(it.uid)).map(it => it.uid),
        text: "A loop: the line feeds itself. It locks unless the ratio round the loop is exactly x1." });

    const inLinks = new Map(items.map(it => [it.uid, links.filter(L => L.to === it.uid)]));

    // drives that reach each box, torque path cost, meshes from the drive
    const info = new Map();
    for (const u of order) {
      const it = by.get(u), bx = boxes[it.name];
      const I = { drives: new Set(), cost: 0, budget: Infinity, depth: {} };
      if (bx.drive) { I.drives.add(u); I.budget = BUDGET[bx.name]; for (const k of { crank: ["K"], motor: ["M"], store: ["B"], brain: ["M1", "M2"], cbdrive: ["M1", "M2"] }[it.name] || ["K"]) I.depth[k] = 0; }
      let up = 0;
      for (const L of inLinks.get(u)) {
        const J = info.get(L.from);
        // a port is driven when a drive reaches it: its depth is known
        if (J.depth[L.out] === undefined) {
          if (J.drives.size) {
            const F = boxes[by.get(L.from).name];
            issues.push({ level: "warn", uids: [L.from, u], text: F.label + " " + L.out + " meshes with " + bx.label + " " + L.inp +
              ", but nothing drives that port: " + F.label + " is turned on another channel, so " + bx.label + " stands still." +
              (F.name === "wire" ? " WIRE carries W→E and S→N separately; a TAP (S→E) or a TURN (W→N) crosses between them." : "") });
          }
          continue;
        }
        for (const d of J.drives) I.drives.add(d);
        up = Math.max(up, (J.costOut ? J.costOut[L.out] : J.cost) + (perIn(bx) ? COST[it.name][L.inp] || 3 : 0));
        I.budget = Math.min(I.budget, J.budget);
        I.depth[L.inp] = J.depth[L.out] + 1;
      }
      I.cost = bx.drive ? 0 : it.name === "tap" ? COST.tap : perIn(bx) ? up : typeof COST[it.name] === "object" ? up + Math.max(...Object.values(COST[it.name])) : up + (COST[it.name] || 3);
      if (!bx.drive && typeof COST[it.name] === "object" && !perIn(bx)) {
        I.costOut = {};
        for (const k in COST[it.name]) I.costOut[k] = up + COST[it.name][k];
      }
      // BRANCH: E starts a new path, as a TAP's does; N carries the line on
      if (it.name === "branch") { I.cost = up + COST.branch.N; I.costOut = { E: COST.branch.E, N: up + COST.branch.N }; }
      // meshes from the drive, through the box's train (a switch or a clock:
      // input to output, three meshes; the moving idler isn't in the train)
      const edges = SPECIAL_EDGES[it.name] || bx.train;
      for (const e of edges) {
        const pd = I.depth[e[1]];
        if (pd === undefined) continue;
        I.depth[e[0]] = Math.max(I.depth[e[0]] || 0, pd + 1);
      }
      info.set(u, I);
    }
    for (const u of order) {
      const it = by.get(u), bx = boxes[it.name], I = info.get(u);
      if (!I.drives.size) continue;
      if (I.cost > I.budget)
        issues.push({ level: "error", uids: [u], text: bx.label + ": path cost " + I.cost + " is over the drive's budget of " +
          I.budget + " stages. Put a TAP on the N/S power line before it, or add a drive." });
      // PUSH and FLIP: the band pulls the line back, and it is weak
      const back = [...I.drives].map(d => by.get(d)).filter(d => d.name === "push" || d.name === "flip");
      if (!bx.drive && back.length && I.cost > KEY_RETURN && I.cost <= I.budget)
        issues.push({ level: "warn", uids: [u, back[0].uid], text: bx.label + ": path cost " + I.cost + " from " + boxes[back[0].name].label +
          ". The key presses up to " + BUDGET[back[0].name] + ", but its band only pulls " + KEY_RETURN + " back: past that, the key stays in when you let go. CLICK doesn't pull back at all, so it has the press budget only." });
      // (the sound boxes' "dials" carry their rhythm wheels: nothing to read)
      const reads = ["beat", "boom", "roll", "dynamo"].includes(it.name) ? [] : Object.values(bx.st).filter(s => s.top === "dial" || s.top === "wheel");
      // dials: the farthest. Digit wheels: the lowest digit (the carry locks
      // the higher ones, so they don't add backlash of their own)
      const ds = reads.map(s => I.depth[s.id]).filter(d => d !== undefined);
      const far = !ds.length ? -1 : reads.some(s => s.top === "wheel") ? Math.min(...ds) : Math.max(...ds);
      if (far > READ_MESHES)
        issues.push({ level: "warn", uids: [u], text: it.name === "plot" ?
          bx.label + ": its trace is " + far + " meshes from the drive (over " + READ_MESHES + "): backlash shows as a wobble in the trace, and the spot lags when the crank turns back." :
          bx.label + ": its " + (reads.some(s => s.top === "wheel") ? "digit wheels are" : "dial is") + " " + far +
          " meshes from the drive (over " + READ_MESHES + "): backlash shows, so the lid wants a ± mark." });
      if (bx.kind === "draft")
        issues.push({ level: "info", uids: [u], text: bx.label + " is a draft: drawn, not simulated yet. Boxes after it stand still." });
    }
    for (const w of blank) if ((info.get(w.u) || { depth: {} }).depth[w.port] !== undefined)
      issues.push({ level: "warn", uids: w.uids, text: w.text });
    return { links, issues, order, info, inLinks, outs, O };
  }

  // spins of every box for the drives' angles: {uid: {stack: spin}}
  // drives: {uid: angle} (crank: K's turn forward; motor: the pinion's spin;
  // store: how far the barrel has run)
  // opt.hold: {uid: {port: {on, last, off}}}, kept between frames, so a port
  // a switch lets go of stays where it stopped and is picked up again (to the
  // nearest tooth) when the idler comes back. Without it a free port reads 0.
  function evaluate(items, boxes, A, drives, C, opt) {
    opt = opt || {};
    const by = new Map(items.map(it => [it.uid, it]));
    const out = new Map();
    out.overrun = [];
    // a pass with every drive at zero sets STEER's select reference and the
    // counters' starting tooth (A.selRef, A.cntOff)
    if (!opt.zero && !A.zeroed) {
      A.zeroed = true; A.selRef = new Map(); A.cntOff = new Map();
      evaluate(items, boxes, A, {}, C, { zero: true });
    }
    for (const u of A.order) {
      const it = by.get(u), bx = boxes[it.name];
      const roots = {};
      if (it.name === "crank") roots.K = -(drives[u] || 0);
      else if (it.name === "motor") roots.M = drives[u] || 0;
      else if (BRAIN_DRIVE[it.name]) roots.M1 = roots.M2 = drives[u] || 0;
      else if (it.name === "store") roots.B = -(drives[u] || 0);
      for (const L of A.inLinks.get(u)) {
        const fb = boxes[by.get(L.from).name];
        const sOut = (out.get(L.from) || {})[L.out] || 0;
        const pout = fb.ports.find(p => p.id === L.out), pin = bx.ports.find(p => p.id === L.inp);
        roots[L.inp] = linkSpin(pout, A.O.get(L.from), sOut, pin, A.O.get(u));
      }
      // a counter (COUNTER, TOLL, TALLY) reads 0.0 with the drives at zero:
      // its input gear is put in by the whole tooth that sets its wheels so,
      // as it would be assembled. (The carries' wheels follow the lowest.)
      const carry = bx.kind !== "draft" && bx.train.find(e => e[2] === "carry");
      if (carry) {
        if (opt.zero) {
          const offs = {};
          for (const p of bx.ports) if (p.input && roots[p.id] !== undefined) {
            const pitch = 360 / p.teeth;
            // the tooth that brings the tenths' 0 nearest its window, just past it
            let best = 0, rb = Infinity;
            for (let k = -p.teeth; k <= p.teeth; k++) {
              const r = (carry[3] - spins(bx, Object.assign({}, roots, { [p.id]: roots[p.id] + k * pitch }), C)[carry[1]]) / 36;
              if (r >= 0 && r < rb) { best = k * pitch; rb = r; }
            }
            offs[p.id] = best;
          }
          A.cntOff.set(u, offs);
        }
        const offs = A.cntOff.get(u) || {};
        for (const id in offs) if (roots[id] !== undefined) roots[id] += offs[id];
      }
      // FACE, likewise: S goes in at the tooth that puts the hands on 12:00:00, just past it
      if (it.name === "face" && roots.S !== undefined) {
        if (opt.zero) {
          let best = 0, rb = Infinity;
          for (let k = -16; k <= 16; k++) {
            const r = -faceSpins(bx, { S: roots.S + k * 22.5 }, 0, C).hS / 6;
            if (r >= -1e-6 && r < rb) { best = k * 22.5; rb = r; }
          }
          A.cntOff.set(u, { S: best });
        }
        roots.S += (A.cntOff.get(u) || { S: 0 }).S;
      }
      const set = Object.assign(defaults(it.name), it.set || {});
      let hold = null;
      if (opt.hold && (SWITCH[it.name] || it.name === "shift")) {
        const st = opt.hold[u] = opt.hold[u] || {};
        hold = (id, m, on, teeth) => {
          const h = st[id] = st[id] || {}, pitch = 360 / teeth;
          if (on && !h.on && h.last !== undefined) h.off = Math.round((h.last - m) / pitch) * pitch;
          const v = on ? m + (h.off || 0) : h.last !== undefined ? h.last : 0;
          h.on = on; h.last = v;
          return v;
        };
      }
      let sp;
      if (it.name === "steer") {
        let sel = set.sel;
        const L = A.inLinks.get(u).find(l => l.inp === "S");
        if (L && roots.S !== undefined) {
          const from = by.get(L.from);
          if (CLOCK[from.name]) sel = 1 - out.get(L.from).level;      // a clock's level: high is E
          else if (opt.zero) { A.selRef.set(u, roots.S); sel = 1; }
          else {
            // anything else: the select line's travel since the start (it starts at N)
            const travel = -(roots.S - (A.selRef.get(u) || 0)) * D * 8;
            sel = 1 - travel / C.sw[5];
          }
          if (sel < -0.03 || sel > 1.03) out.overrun.push(u);
          sel = Math.min(1, Math.max(0, sel));
        }
        sp = swSpins(bx, roots, sel, C, hold);
        sp.sel = sel;
      } else if (SWITCH[it.name]) { sp = swSpins(bx, roots, set.sel, C, hold); sp.sel = set.sel; }
      else if (it.name === "store") sp = stoSpins(bx, set.wind, drives[u] || 0, C);
      else if (it.name === "shift") sp = shSpins(bx, roots, set.gear, C, hold);
      else if (it.name === "face") sp = faceSpins(bx, roots, set.set || 0, C);
      else if (it.name === "spin") sp = spinSpins(bx, roots, set.coast || 0, C);
      else if (KEY[it.name]) { const k = keyStroke(it.name, drives[u] || 0, C); sp = pushSpins(bx, k.s, k.n, C); }
      else if (it.name === "fork") sp = forkSpins(bx, roots, set.roll || 0, C);
      else if (it.name === "dynamo") sp = dynSpins(bx, roots, C);
      else if (it.name === "swap") sp = swapSpins(bx, roots.W === undefined ? 0 : -roots.W * 24 / 16, C);
      else if (it.name === "escape") sp = roots.W === undefined ? escSpins(bx, 0, 0, C) : escFromW(bx, roots.W, C);
      else if (CLOCK[it.name]) sp = clkSpins(bx, roots, it.name === "ramp" ? set.f : set.pair, it.name === "ramp" ? 0 : set.phase, C);
      // a draft: its input gears turn, nothing behind them does yet
      else sp = bx.kind === "draft" ? roots : spins(bx, roots, C);
      out.set(u, sp);
    }
    return out;
  }

  const api = { KEY, BRAIN_DRIVE, keyStroke, spinResult, prep, spins, swRests, defaults, SWITCH, CLOCK, linkSpin, meshSpin, selfTest, analyze, evaluate, origin, occupied, refRoots, COST, BUDGET, READ_MESHES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.GBSKin = api;
})(typeof window !== "undefined" ? window : this);
