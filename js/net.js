/* Motor de red simulado: equipos, cables, estado de los puertos, VLAN, enrutamiento, ping y DHCP.
   No toca la red de verdad: todo vive en memoria. */
(function (G) {
  'use strict';

  /* ================= direcciones IPv4 ================= */
  const ip2n = (s) => {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(s || '').trim());
    if (!m) return null;
    const a = [+m[1], +m[2], +m[3], +m[4]];
    if (a.some((x) => x > 255)) return null;
    return ((a[0] << 24) >>> 0) + (a[1] << 16) + (a[2] << 8) + a[3];
  };
  const n2ip = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  const pmask = (p) => (p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0);
  const prefixOf = (m) => {
    m = m >>> 0;
    let p = 0;
    while (p < 32 && m & (0x80000000 >>> p)) p++;
    return pmask(p) === m ? p : -1;
  };
  const netOf = (ip, mask) => (ip & mask) >>> 0;
  const inNet = (ip, net, mask) => ((ip & mask) >>> 0) === ((net & mask) >>> 0);
  const classful = (n) => {
    const a = n >>> 24;
    return a < 128 ? pmask(8) : a < 192 ? pmask(16) : pmask(24);
  };
  const IP = { ip2n, n2ip, pmask, prefixOf, netOf, inNet, classful };

  /* ================= contraseñas como las enseña IOS ================= */
  const XL = 'dsfd;kfoA,.iyewrkldJKDHSUBsgvca69834ncxv9873254k;fg87';
  function type7(pw) {
    let seed = 0;
    for (const ch of pw) seed = (seed * 31 + ch.charCodeAt(0)) % 16;
    let out = String(seed).padStart(2, '0');
    for (let i = 0; i < pw.length; i++) out += (pw.charCodeAt(i) ^ XL.charCodeAt((seed + i) % XL.length)).toString(16).toUpperCase().padStart(2, '0');
    return out;
  }
  function md5ish(pw) {
    const abc = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let h = 2166136261;
    let out = '';
    for (let k = 0; k < 22; k++) {
      for (const ch of pw + k) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
      out += abc[h % 64];
    }
    return '$1$mERr$' + out;
  }

  /* ================= equipos ================= */
  const clone = (o) => JSON.parse(JSON.stringify(o));
  let macSeq = 0x10;
  const mkMac = () => {
    const n = macSeq++;
    const h = (x) => x.toString(16).padStart(4, '0').toUpperCase();
    return `00${(0x0a + (n % 200)).toString(16).toUpperCase()}.${h((n * 7919) & 0xffff)}.${h((n * 104729) & 0xffff)}`;
  };

  const MODELS = {
    2911: { label: 'Cisco 2911', kind: 'router', eth: ['GigabitEthernet0/0', 'GigabitEthernet0/1', 'GigabitEthernet0/2'], slots: 4 },
    1941: { label: 'Cisco 1941', kind: 'router', eth: ['GigabitEthernet0/0', 'GigabitEthernet0/1'], slots: 2 },
    2960: { label: 'Cisco 2960', kind: 'switch', eth: [...Array.from({ length: 24 }, (_, i) => 'FastEthernet0/' + (i + 1)), 'GigabitEthernet0/1', 'GigabitEthernet0/2'] },
    PC: { label: 'PC', kind: 'pc', eth: ['FastEthernet0'] },
    SRV: { label: 'Servidor', kind: 'pc', eth: ['FastEthernet0'] },
  };
  const MODULES = {
    'HWIC-2T': { ports: 2, desc: '2 puertos serie (Serial)' },
    'HWIC-4ESW': { ports: 0, desc: '4 puertos de switch Ethernet' },
    'HWIC-1GE-SFP': { ports: 0, desc: '1 puerto Gigabit de fibra (SFP)' },
  };

  function mkIf(name, kind) {
    const sw = kind === 'switch';
    return { ip: null, mask: null, shut: !sw || /^Vlan/.test(name), desc: '', clock: null, mode: 'access', vlan: 1, native: 1, allowed: null, portfast: false, encap: null, helpers: [], duplex: null, speed: null };
  }

  function factory(dev) {
    const kind = dev.kind;
    const c = {
      hostname: kind === 'router' ? 'Router' : 'Switch',
      enableSecret: null,
      enablePass: null,
      spe: false,
      banner: null,
      lookup: true,
      domain: null,
      users: {},
      rsa: 0,
      sshVer: null,
      con: { pass: null, login: false, local: false, sync: false, timeout: null },
      vty: { pass: null, login: true, local: false, sync: false, timeout: null, transport: null, last: kind === 'switch' ? 15 : 4 },
      ifs: {},
      routes: [],
      dhcpEx: [],
      pools: {},
      ospf: null,
      rip: null,
      vlans: kind === 'switch' ? { 1: 'default' } : {},
      dgw: null,
      minLen: null,
    };
    for (const p of dev.hwPorts()) c.ifs[p] = mkIf(p, kind);
    if (kind === 'switch') c.ifs.Vlan1 = mkIf('Vlan1', kind);
    return c;
  }

  class Device {
    constructor(id, model, x, y) {
      const M = MODELS[model];
      this.id = id;
      this.model = model;
      this.kind = M.kind;
      this.x = x || 0;
      this.y = y || 0;
      this.power = true;
      this.mac = mkMac();
      this.slots = M.slots ? Array(M.slots).fill(null) : null;
      if (this.kind === 'pc') this.pc = { ip: null, mask: null, gw: null, dns: null, dhcp: false, domain: null };
      else {
        this.cfg = factory(this);
        this.startup = null;
      }
    }
    get label() {
      return MODELS[this.model].label;
    }
    get name() {
      return this.cfg ? this.cfg.hostname : this.id;
    }
    hwPorts() {
      const M = MODELS[this.model];
      const out = M.eth.slice();
      if (this.slots)
        this.slots.forEach((m, s) => {
          if (m === 'HWIC-2T') out.push(`Serial0/${s}/0`, `Serial0/${s}/1`);
        });
      return out;
    }
    macOf(ifn) {
      let h = 0;
      for (const ch of ifn) h = (h * 33 + ch.charCodeAt(0)) & 0xff;
      return this.mac.slice(0, -2) + h.toString(16).toUpperCase().padStart(2, '0');
    }
  }

  /* ================= nombres de interfaz ================= */
  const TYPES = [
    ['gigabitethernet', 'GigabitEthernet', 'Gig', 'G'],
    ['fastethernet', 'FastEthernet', 'Fa', 'Fa'],
    ['serial', 'Serial', 'Se', 'S'],
    ['vlan', 'Vlan', 'Vlan', 'Vlan'],
  ];
  /* "g0/0", "gig 0/0", "fa0/1", "s0/0/0", "vlan 10", "g0/0.10" → nombre completo o null */
  function canonIf(s) {
    const m = /^\s*([a-z-]+)\s*(\d+(?:\/\d+){0,2})(?:\.(\d+))?\s*$/i.exec(s || '');
    if (!m) return null;
    const t = m[1].toLowerCase();
    const found = TYPES.filter((x) => x[0].startsWith(t));
    if (found.length !== 1) return null;
    return found[0][1] + m[2] + (m[3] !== undefined ? '.' + m[3] : '');
  }
  const shortIf = (n) => {
    for (const t of TYPES) if (n.startsWith(t[1])) return t[3] + n.slice(t[1].length);
    return n;
  };
  const midIf = (n) => {
    for (const t of TYPES) if (n.startsWith(t[1])) return t[2] + ' ' + n.slice(t[1].length);
    return n;
  };

  /* ================= la red ================= */
  const CABLES = {
    straight: 'Cobre directo',
    cross: 'Cobre cruzado',
    serial: 'Serial DCE',
    console: 'Consola',
  };

  class Network {
    constructor() {
      this.devs = {};
      this.order = [];
      this.links = [];
      this.pending = [];
      this.arp = new Set();
      this.cache = null;
    }
    add(id, model, x, y) {
      const d = new Device(id, model, x, y);
      this.devs[id] = d;
      this.order.push(d);
      return d;
    }
    dev(id) {
      return this.devs[id] || this.order.find((d) => d.name === id) || null;
    }
    link(a, pa, b, pb, cable, dceSide) {
      const A = this.devs[a];
      const B = this.devs[b];
      const k = { a: { d: a, p: pa }, b: { d: b, p: pb }, cable: cable || this.rightCable(A, B, pa), dce: dceSide || a };
      this.links = this.links.filter((l) => !this.sameEnd(l.a, k.a) && !this.sameEnd(l.b, k.a) && !this.sameEnd(l.a, k.b) && !this.sameEnd(l.b, k.b));
      this.links.push(k);
      this.touch();
      return k;
    }
    unlink(k) {
      this.links = this.links.filter((l) => l !== k);
      this.touch();
    }
    sameEnd(x, y) {
      return x.d === y.d && x.p === y.p;
    }
    rightCable(A, B, pa) {
      if (/^Serial/.test(pa)) return 'serial';
      const sw = (d) => d.kind === 'switch';
      return sw(A) !== sw(B) ? 'straight' : 'cross';
    }
    /* ¿están unidos a y b con ese tipo de cable? */
    cabled(a, b, cable) {
      return this.links.some((l) => ((l.a.d === a && l.b.d === b) || (l.a.d === b && l.b.d === a)) && (!cable || l.cable === cable));
    }
    linkAt(id, p) {
      return this.links.find((l) => (l.a.d === id && l.a.p === p) || (l.b.d === id && l.b.p === p)) || null;
    }
    other(l, id, p) {
      return l.a.d === id && l.a.p === p ? l.b : l.a;
    }
    touch() {
      this.cache = null;
    }

    /* ---------- estado de los puertos ---------- */
    ifc(d, n) {
      if (d.kind === 'pc') return null;
      return d.cfg.ifs[n] || null;
    }
    parentOf(n) {
      return n.includes('.') ? n.split('.')[0] : null;
    }
    /* estado físico: 'up' | 'down' | 'admin' */
    phys(d, n) {
      if (!d.power) return 'down';
      if (d.kind !== 'pc') {
        const f = d.cfg.ifs[n];
        if (!f) return 'down';
        if (f.shut) return 'admin';
      }
      const l = this.linkAt(d.id, n);
      if (!l) return 'down';
      const o = this.other(l, d.id, n);
      const od = this.devs[o.d];
      if (!od || !od.power) return 'down';
      if (od.kind !== 'pc') {
        const of = od.cfg.ifs[o.p];
        if (!of || of.shut) return 'down';
      }
      if (l.cable === 'console') return 'down';
      if (l.cable !== this.rightCable(d, od, n)) return 'down';
      return 'up';
    }
    /* devuelve [estado, protocolo] como en show ip interface brief */
    status(d, n) {
      if (d.kind === 'pc') {
        const s = this.phys(d, n);
        return [s, s];
      }
      const f = d.cfg.ifs[n];
      if (!f) return ['down', 'down'];
      if (/^Vlan/.test(n)) {
        if (f.shut) return ['admin', 'down'];
        const v = +n.slice(4);
        if (!d.cfg.vlans[v]) return ['down', 'down'];
        const any = d.hwPorts().some((p) => {
          const pf = d.cfg.ifs[p];
          return this.phys(d, p) === 'up' && (pf.mode === 'trunk' || pf.vlan === v);
        });
        return any ? ['up', 'up'] : ['down', 'down'];
      }
      const par = this.parentOf(n);
      if (par) {
        if (f.shut) return ['admin', 'down'];
        const s = this.status(d, par);
        return [s[0] === 'admin' ? 'down' : s[0], s[1]];
      }
      const s = this.phys(d, n);
      if (s !== 'up') return [s, 'down'];
      if (/^Serial/.test(n)) {
        const l = this.linkAt(d.id, n);
        const dceDev = this.devs[l.dce];
        const dceEnd = l.a.d === l.dce ? l.a : l.b;
        const clk = dceDev.cfg.ifs[dceEnd.p].clock;
        if (!clk) return ['up', 'down'];
      }
      return ['up', 'up'];
    }
    isUp(d, n) {
      const s = this.status(d, n);
      return s[0] === 'up' && s[1] === 'up';
    }
    linkState(l) {
      const A = this.devs[l.a.d];
      const B = this.devs[l.b.d];
      const sa = this.status(A, l.a.p);
      const sb = this.status(B, l.b.p);
      if (sa[1] === 'up' && sb[1] === 'up') return 'up';
      if (sa[0] === 'up' && sb[0] === 'up') return 'half';
      return 'down';
    }
    isDce(d, n) {
      const l = this.linkAt(d.id, n);
      return !!l && l.cable === 'serial' && l.dce === d.id;
    }

    /* ---------- interfaces con IP ---------- */
    l3(d) {
      if (d.kind === 'pc') {
        const p = d.pc;
        return p.ip ? [{ n: 'FastEthernet0', ip: p.ip, mask: p.mask, up: this.isUp(d, 'FastEthernet0') }] : [];
      }
      const out = [];
      for (const n of Object.keys(d.cfg.ifs)) {
        const f = d.cfg.ifs[n];
        if (f.ip == null) continue;
        if (d.kind === 'switch' && !/^Vlan/.test(n)) continue;
        out.push({ n, ip: f.ip, mask: f.mask, up: this.isUp(d, n) });
      }
      return out;
    }
    owns(d, ip) {
      return this.l3(d).some((x) => x.up && x.ip === ip);
    }
    ownerOf(ip) {
      for (const d of this.order) if (this.owns(d, ip)) return d;
      return null;
    }
    anyOwner(ip) {
      for (const d of this.order) if (this.l3(d).some((x) => x.ip === ip)) return d;
      return null;
    }

    /* ---------- dominio de difusión (capa 2) ----------
       Desde una interfaz con IP, ¿qué otras interfaces con IP oyen sus tramas? Sigue cables, VLAN y trunks. */
    l2(d, n) {
      const res = [];
      const seen = new Set();
      const self = d.id + '|' + n;
      const push = (dev, ifn, trail) => {
        if (dev.id + '|' + ifn !== self && !res.some((r) => r.d === dev && r.n === ifn)) res.push({ d: dev, n: ifn, trail });
      };
      const egress = (dev, p, tag, trail) => {
        if (this.phys(dev, p) !== 'up') return;
        const l = this.linkAt(dev.id, p);
        if (/^Serial/.test(p)) {
          if (!this.isUp(dev, p)) return;
        }
        const o = this.other(l, dev.id, p);
        ingress(this.devs[o.d], o.p, tag, trail.concat(o.d));
      };
      const ingress = (dev, p, tag, trail) => {
        const key = dev.id + '|' + p + '|' + tag;
        if (seen.has(key)) return;
        seen.add(key);
        if (dev.kind === 'switch') {
          const f = dev.cfg.ifs[p];
          let v;
          if (f.mode === 'trunk') v = tag == null ? f.native : tag;
          else {
            if (tag != null) return;
            v = f.vlan;
          }
          inSwitch(dev, v, p, trail);
        } else if (dev.kind === 'router') {
          if (tag == null) {
            const f = dev.cfg.ifs[p];
            if (f && f.ip != null && this.isUp(dev, p)) push(dev, p, trail);
          } else {
            for (const sn of Object.keys(dev.cfg.ifs)) {
              const sf = dev.cfg.ifs[sn];
              if (sn.startsWith(p + '.') && sf.encap === tag && sf.ip != null && this.isUp(dev, sn)) push(dev, sn, trail);
            }
          }
        } else if (tag == null && dev.pc.ip != null) push(dev, 'FastEthernet0', trail);
      };
      const inSwitch = (dev, v, from, trail) => {
        const key = dev.id + '#' + v;
        if (seen.has(key)) return;
        seen.add(key);
        if (!dev.cfg.vlans[v]) return;
        const svi = dev.cfg.ifs['Vlan' + v];
        if (svi && svi.ip != null && !svi.shut) push(dev, 'Vlan' + v, trail);
        for (const p of dev.hwPorts()) {
          if (p === from) continue;
          const f = dev.cfg.ifs[p];
          if (f.mode === 'trunk') egress(dev, p, v === f.native ? null : v, trail);
          else if (f.vlan === v) egress(dev, p, null, trail);
        }
      };
      if (d.kind === 'switch' && /^Vlan/.test(n)) inSwitch(d, +n.slice(4), null, [d.id]);
      else if (d.kind === 'router' && n.includes('.')) {
        const f = d.cfg.ifs[n];
        if (this.isUp(d, n)) egress(d, this.parentOf(n), f.encap, [d.id]);
      } else egress(d, n, null, [d.id]);
      return res;
    }

    /* ---------- enrutamiento dinámico ---------- */
    ifCost(d, n) {
      const base = n.split('.')[0];
      if (/^Serial/.test(base)) return 64;
      return 1;
    }
    ospfIfs(d) {
      const o = d.cfg && d.cfg.ospf;
      if (!o || !d.power) return [];
      const out = [];
      for (const x of this.l3(d)) {
        if (!x.up) continue;
        const st = o.nets.find((s) => ((x.ip & ~s.wild) >>> 0) === ((s.addr & ~s.wild) >>> 0));
        if (st) out.push({ n: x.n, ip: x.ip, mask: x.mask, area: st.area, passive: o.passive.includes(x.n) });
      }
      return out;
    }
    ripIfs(d) {
      const r = d.cfg && d.cfg.rip;
      if (!r || !d.power) return [];
      const out = [];
      for (const x of this.l3(d)) {
        if (!x.up) continue;
        const cm = classful(x.ip);
        if (r.nets.some((a) => ((a & cm) >>> 0) === ((x.ip & cm) >>> 0))) out.push({ n: x.n, ip: x.ip, mask: x.mask, passive: r.passive.includes(x.n) });
      }
      return out;
    }
    routerId(d) {
      const o = d.cfg.ospf;
      if (o && o.rid != null) return o.rid;
      const ips = this.l3(d).filter((x) => x.up).map((x) => x.ip);
      return ips.length ? Math.max(...ips) >>> 0 : 0;
    }
    /* vecinos de un protocolo: [{d, n (mía), peer, pn (suya), ip (suya)}] */
    neighbors(d, proto) {
      const get = proto === 'ospf' ? (x) => this.ospfIfs(x) : (x) => this.ripIfs(x);
      const mine = get(d);
      const out = [];
      for (const m of mine) {
        if (m.passive) continue;
        for (const p of this.l2(d, m.n)) {
          if (p.d.kind !== 'router') continue;
          const theirs = get(p.d).find((t) => t.n === p.n);
          if (!theirs || theirs.passive) continue;
          if (proto === 'ospf' && (theirs.area !== m.area || theirs.mask !== m.mask)) continue;
          if (!inNet(theirs.ip, m.ip, m.mask)) continue;
          out.push({ d: p.d, n: m.n, pn: p.n, ip: theirs.ip });
        }
      }
      return out;
    }
    dynRoutes(proto) {
      const routers = this.order.filter((d) => d.kind === 'router' && d.power && d.cfg[proto]);
      const all = {};
      const get = proto === 'ospf' ? (x) => this.ospfIfs(x) : (x) => this.ripIfs(x);
      for (const src of routers) {
        const dist = new Map([[src.id, 0]]);
        const first = new Map();
        const todo = [src];
        while (todo.length) {
          todo.sort((a, b) => dist.get(a.id) - dist.get(b.id));
          const u = todo.shift();
          for (const nb of this.neighbors(u, proto)) {
            const w = proto === 'ospf' ? (u.cfg.ifs[nb.n].cost || this.ifCost(u, nb.n)) : 1;
            const nd = dist.get(u.id) + w;
            if (!dist.has(nb.d.id) || nd < dist.get(nb.d.id)) {
              dist.set(nb.d.id, nd);
              first.set(nb.d.id, u === src ? nb : first.get(u.id));
              todo.push(nb.d);
            }
          }
        }
        const conn = this.l3(src).filter((x) => x.up).map((x) => netOf(x.ip, x.mask) + '/' + x.mask);
        const best = {};
        for (const [id, dd] of dist) {
          if (id === src.id) continue;
          const r = this.devs[id];
          const hop = first.get(id);
          for (const x of get(r)) {
            const key = netOf(x.ip, x.mask) + '/' + x.mask;
            if (conn.includes(key)) continue;
            const metric = proto === 'ospf' ? dd + this.ifCost(r, x.n) : dd;
            if (proto === 'rip' && metric > 15) continue;
            if (!best[key] || metric < best[key].metric)
              best[key] = { code: proto === 'ospf' ? 'O' : 'R', net: netOf(x.ip, x.mask), mask: x.mask, ad: proto === 'ospf' ? 110 : 120, metric, nh: hop.ip, n: hop.n };
          }
        }
        all[src.id] = Object.values(best);
      }
      return all;
    }

    /* ---------- tabla de rutas ---------- */
    routes(d) {
      if (!this.cache) this.cache = { rt: {} };
      if (this.cache.rt[d.id]) return this.cache.rt[d.id];
      const rt = [];
      if (d.kind !== 'router' || !d.power) return (this.cache.rt[d.id] = rt);
      for (const x of this.l3(d)) {
        if (!x.up) continue;
        rt.push({ code: 'C', net: netOf(x.ip, x.mask), mask: x.mask, ad: 0, metric: 0, n: x.n });
        rt.push({ code: 'L', net: x.ip, mask: 0xffffffff, ad: 0, metric: 0, n: x.n });
      }
      const conn = rt.slice();
      for (const s of d.cfg.routes) {
        let n = null;
        let nh = null;
        if (s.ifn) {
          if (this.isUp(d, s.ifn)) n = s.ifn;
        } else {
          const c = conn.find((r) => r.code === 'C' && inNet(s.nh, r.net, r.mask));
          if (c) {
            n = c.n;
            nh = s.nh;
          }
        }
        if (n) rt.push({ code: s.net === 0 && s.mask === 0 ? 'S*' : 'S', net: s.net, mask: s.mask, ad: s.ad || 1, metric: 0, nh, n });
      }
      if (!this.cache.dyn) this.cache.dyn = { ospf: this.dynRoutes('ospf'), rip: this.dynRoutes('rip') };
      for (const proto of ['ospf', 'rip'])
        for (const r of this.cache.dyn[proto][d.id] || []) {
          const clash = rt.find((x) => x.net === r.net && x.mask === r.mask);
          if (clash && clash.ad <= r.ad) continue;
          if (clash) rt.splice(rt.indexOf(clash), 1);
          rt.push(r);
        }
      return (this.cache.rt[d.id] = rt);
    }
    lookup(d, ip) {
      let best = null;
      for (const r of this.routes(d)) {
        if (!inNet(ip, r.net, r.mask)) continue;
        if (!best || r.mask > best.mask || (r.mask === best.mask && r.ad < best.ad)) best = r;
      }
      return best;
    }

    /* ---------- ¿por dónde sale un paquete? ---------- */
    nextHop(d, dst) {
      if (d.kind === 'pc') {
        const p = d.pc;
        if (!p.ip || !this.isUp(d, 'FastEthernet0')) return null;
        if (inNet(dst, p.ip, p.mask)) return { n: 'FastEthernet0', nh: dst };
        if (p.gw != null && inNet(p.gw, p.ip, p.mask)) return { n: 'FastEthernet0', nh: p.gw };
        return null;
      }
      if (d.kind === 'switch') {
        const svis = this.l3(d).filter((x) => x.up);
        for (const x of svis) if (inNet(dst, x.ip, x.mask)) return { n: x.n, nh: dst };
        const g = d.cfg.dgw;
        if (g != null) for (const x of svis) if (inNet(g, x.ip, x.mask)) return { n: x.n, nh: g };
        return null;
      }
      const r = this.lookup(d, dst);
      if (!r) return null;
      if (r.code === 'C' || r.code === 'L') return { n: r.n, nh: dst };
      if (r.nh == null) return { n: r.n, nh: dst };
      /* siguiente salto que a su vez hay que resolver */
      const r2 = this.lookup(d, r.nh);
      if (r2 && (r2.code === 'C' || r2.code === 'L')) return { n: r2.n, nh: r.nh };
      return { n: r.n, nh: r.nh };
    }
    srcIp(d, n) {
      if (d.kind === 'pc') return d.pc.ip;
      const f = d.cfg.ifs[n];
      return f ? f.ip : null;
    }
    /* Lleva un paquete de d hacia dst. Devuelve { ok, hops:[ids], ips:[ip de entrada en cada router], fail, at } */
    forward(d, dst) {
      const hops = [d.id];
      const ips = [];
      let cur = d;
      for (let ttl = 0; ttl < 30; ttl++) {
        if (this.owns(cur, dst)) return { ok: true, hops, ips, owner: cur };
        if (cur !== d && cur.kind !== 'router') return { ok: false, hops, ips, fail: 'drop', at: cur };
        const eg = this.nextHop(cur, dst);
        if (!eg) return { ok: false, hops, ips, fail: cur === d ? 'noroute' : 'unreach', at: cur };
        const peers = this.l2(cur, eg.n);
        const t = peers.find((p) => this.srcIp(p.d, p.n) === eg.nh);
        if (!t) return { ok: false, hops, ips, fail: 'timeout', at: cur };
        for (const id of t.trail.slice(1)) hops.push(id);
        ips.push(eg.nh);
        if (eg.nh === dst) return { ok: true, hops, ips, owner: t.d, inIf: t.n };
        cur = t.d;
      }
      return { ok: false, hops, ips, fail: 'ttl', at: cur };
    }
    /* ping completo: ida y vuelta */
    ping(d, dst) {
      if (d.kind !== 'pc' && this.owns(d, dst)) return { ok: true, hops: [d.id], back: true, self: true };
      const go = this.forward(d, dst);
      if (!go.ok) return Object.assign(go, { back: false });
      const eg = this.nextHop(d, dst);
      const src = d.kind === 'pc' ? d.pc.ip : eg ? this.srcIp(d, eg.n) : null;
      const owner = go.owner || this.ownerOf(dst);
      const back = src != null && owner ? this.forward(owner, src) : { ok: false };
      return Object.assign(go, { back: back.ok, ok: back.ok, backHops: back.hops, fail: back.ok ? null : 'timeout', at: back.at, src });
    }

    /* ---------- DHCP ---------- */
    poolFor(server, ip) {
      for (const name of Object.keys(server.cfg.pools)) {
        const p = server.cfg.pools[name];
        if (p.net != null && inNet(ip, p.net, p.mask)) return [name, p];
      }
      return null;
    }
    dhcp(pc) {
      const peers = this.l2Raw(pc);
      for (const g of peers) {
        if (g.d.kind !== 'router') continue;
        const f = g.d.cfg.ifs[g.n];
        let server = null;
        let found = this.poolFor(g.d, f.ip);
        if (found) server = g.d;
        else
          for (const h of f.helpers) {
            const s = this.ownerOf(h);
            if (!s || s.kind !== 'router') continue;
            const a = this.forward(g.d, h);
            const b = a.ok ? this.forward(s, f.ip) : { ok: false };
            if (!a.ok || !b.ok) continue;
            found = this.poolFor(s, f.ip);
            if (found) {
              server = s;
              break;
            }
          }
        if (!server || !found) continue;
        const [name, pool] = found;
        const lease = this.lease(server, name, pool, pc);
        if (lease == null) continue;
        return { ip: lease, mask: pool.mask, gw: pool.router, dns: pool.dns, domain: pool.domain, server, pool: name };
      }
      return null;
    }
    /* el PC todavía no tiene IP: sus tramas de difusión salen igual */
    l2Raw(pc) {
      const keep = pc.pc.ip;
      pc.pc.ip = keep == null ? 1 : keep;
      const r = this.l2(pc, 'FastEthernet0');
      pc.pc.ip = keep;
      return r;
    }
    lease(server, name, pool, pc) {
      server.binds = server.binds || {};
      const mine = Object.keys(server.binds).find((ip) => server.binds[ip].pc === pc.id);
      if (mine != null) return +mine;
      const used = new Set();
      for (const d of this.order) for (const x of this.l3(d)) used.add(x.ip);
      const size = 2 ** (32 - prefixOf(pool.mask));
      for (let ip = pool.net + 1; ip < pool.net + size - 1; ip++) {
        if (server.cfg.dhcpEx.some(([a, b]) => ip >= a && ip <= b)) continue;
        if (used.has(ip) || server.binds[ip]) continue;
        server.binds[ip] = { pc: pc.id, mac: pc.mac, pool: name };
        return ip;
      }
      return null;
    }
    release(pc) {
      for (const d of this.order)
        if (d.binds)
          for (const ip of Object.keys(d.binds)) if (d.binds[ip].pc === pc.id) delete d.binds[ip];
    }

    /* ---------- foto del estado para avisar de cambios ---------- */
    snapshot() {
      const s = {};
      for (const d of this.order) {
        if (d.kind === 'pc') continue;
        for (const n of Object.keys(d.cfg.ifs)) s[d.id + '|' + n] = this.status(d, n);
        if (d.cfg.ospf) for (const nb of this.neighbors(d, 'ospf')) s[d.id + '|ospf|' + nb.d.id + '|' + nb.n] = nb;
      }
      return s;
    }
  }

  G.NET = { Network, Device, MODELS, MODULES, CABLES, IP, canonIf, shortIf, midIf, type7, md5ish, clone, factory, mkIf };
})(typeof window !== 'undefined' ? window : globalThis);
