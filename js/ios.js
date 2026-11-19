/* Consola de Cisco IOS simulada (routers 2911/1941 y switch 2960) y símbolo del sistema de los PCs.
   Entiende abreviaturas (conf t, sh ip int br), ? para ayuda, Tab para completar y | include. */
(function (G) {
  'use strict';
  const { IP, canonIf, shortIf, midIf, type7, md5ish, clone, factory, mkIf, MODELS } = G.NET;
  const { ip2n, n2ip, prefixOf, netOf, inNet, classful } = IP;

  /* ================= resultado de una orden ================= */
  function Res() {
    const r = { parts: [], out: '', err: '' };
    r.o = (t) => {
      if (t == null) return r;
      t = String(t);
      r.parts.push(['out', t]);
      r.out += t + '\n';
      return r;
    };
    r.e = (t) => {
      r.parts.push(['err', t]);
      r.err += t + '\n';
      r.out += t + '\n';
      return r;
    };
    return r;
  }

  /* ================= ayuda de las palabras clave ================= */
  const HELP = {
    enable: 'Entrar en modo privilegiado (#)',
    disable: 'Volver al modo usuario (>)',
    exit: 'Salir del modo actual',
    logout: 'Cerrar la sesión',
    end: 'Volver directamente al modo privilegiado',
    configure: 'Entrar en modo configuración',
    terminal: 'Configurar desde esta terminal',
    show: 'Mostrar información del equipo',
    ping: 'Enviar paquetes de eco (ICMP)',
    traceroute: 'Ver por qué routers pasa un paquete',
    telnet: 'Conectarse a otro equipo por Telnet',
    ssh: 'Conectarse a otro equipo por SSH (cifrado)',
    copy: 'Copiar configuraciones',
    write: 'Guardar la configuración (= copy run start)',
    erase: 'Borrar la configuración guardada',
    reload: 'Reiniciar el equipo',
    hostname: 'Cambiar el nombre del equipo',
    interface: 'Configurar una interfaz',
    line: 'Configurar una línea (consola o remota)',
    router: 'Activar un protocolo de enrutamiento',
    ip: 'Opciones de IP',
    no: 'Deshacer una orden',
    do: 'Ejecutar una orden del modo # desde configuración',
    service: 'Servicios del sistema',
    banner: 'Mensaje que sale al conectarse',
    username: 'Crear un usuario local',
    crypto: 'Claves de cifrado (para SSH)',
    vlan: 'Crear o editar una VLAN',
    'running-config': 'Configuración actual (en memoria RAM)',
    'startup-config': 'Configuración guardada (en NVRAM)',
    version: 'Modelo y versión del sistema',
    history: 'Últimas órdenes escritas',
    route: 'Tabla de rutas / ruta estática',
    brief: 'Resumen en una línea por interfaz',
    interfaces: 'Estado de las interfaces',
    address: 'Dirección IP',
    shutdown: 'Apagar la interfaz',
    description: 'Texto que describe la interfaz',
    clock: 'Velocidad de reloj (extremo DCE del cable serie)',
    switchport: 'Opciones de puerto de switch',
    encapsulation: 'Etiquetado de VLAN en una subinterfaz',
    'helper-address': 'Reenviar el DHCP a otro router (relay)',
    password: 'Contraseña de la línea',
    login: 'Pedir contraseña al entrar',
    'logging': 'Mensajes del sistema',
    transport: 'Protocolos permitidos para conectarse',
    'exec-timeout': 'Cerrar la sesión tras un tiempo sin uso',
    network: 'Red que participa / red del pool',
    'default-router': 'Puerta de enlace que se reparte',
    'dns-server': 'Servidor DNS que se reparte',
    'domain-name': 'Nombre de dominio',
    secret: 'Contraseña cifrada (MD5)',
    'password-encryption': 'Cifrar las contraseñas visibles',
    'domain-lookup': 'Traducir nombres a IP (por DNS)',
    dhcp: 'Servidor DHCP',
    pool: 'Conjunto de direcciones a repartir',
    'excluded-address': 'Direcciones que el DHCP no reparte',
    'default-gateway': 'Puerta de enlace del switch',
    name: 'Nombre de la VLAN',
    mode: 'Modo del puerto',
    access: 'Puerto de acceso (una VLAN)',
    trunk: 'Puerto troncal (lleva varias VLAN)',
    ospf: 'Protocolo OSPF',
    rip: 'Protocolo RIP',
    area: 'Área OSPF',
    'router-id': 'Identificador del router',
    'passive-interface': 'No enviar actualizaciones por esa interfaz',
    'mac-address-table': 'Tabla de direcciones MAC',
    controllers: 'Detalles del hardware (DCE/DTE)',
    protocols: 'Protocolos de enrutamiento activos',
    neighbor: 'Vecinos',
    binding: 'Direcciones repartidas',
    cdp: 'Equipos Cisco conectados',
    neighbors: 'Vecinos directamente conectados',
    'spanning-tree': 'Opciones de STP',
    portfast: 'El puerto pasa a reenviar al instante (solo PCs)',
  };

  /* ================= gramática ================= */
  function compile(s) {
    return s.split(' ').map((w) => {
      const opt = w.endsWith('?');
      if (opt) w = w.slice(0, -1);
      if (/^[A-Z]/.test(w)) {
        const [kind, range] = w.split(':');
        const t = { kind, opt };
        if (range) [t.min, t.max] = range.split('-').map(Number);
        return t;
      }
      return { kind: 'kw', words: w.toLowerCase().split('|'), opt };
    });
  }
  const PH = {
    WORD: 'WORD',
    LINE: 'LINE',
    IP: 'A.B.C.D',
    MASK: 'A.B.C.D (máscara)',
    WILD: 'A.B.C.D (wildcard)',
    NUM: '<número>',
    IF: 'interfaz (g0/0, fa0/1, s0/0/0…)',
    HOP: 'A.B.C.D (siguiente salto) o interfaz',
  };

  function tokenize(line) {
    const out = [];
    const re = /\S+/g;
    let m;
    while ((m = re.exec(line))) out.push({ t: m[0], lc: m[0].toLowerCase(), pos: m.index });
    return out;
  }

  /* intenta casar un marcador con el token k (una interfaz puede ocupar dos: "gig 0/0") */
  function consume(st, toks, k, ses) {
    const t = toks[k].t;
    switch (st.kind) {
      case 'WORD':
        return { val: t, n: 1 };
      case 'IP':
      case 'MASK':
      case 'WILD': {
        const v = ip2n(t);
        return v == null ? null : { val: v, n: 1 };
      }
      case 'NUM': {
        if (!/^\d+$/.test(t)) return null;
        const v = +t;
        if (st.min != null && (v < st.min || v > st.max)) return null;
        return { val: v, n: 1 };
      }
      case 'IF':
      case 'HOP': {
        if (st.kind === 'HOP') {
          const v = ip2n(t);
          if (v != null) return { val: v, n: 1 };
        }
        let s = t;
        let n = 1;
        if (/^[a-z-]+$/i.test(t) && toks[k + 1] && /^\d/.test(toks[k + 1].t)) {
          s = t + toks[k + 1].t;
          n = 2;
        }
        const c = canonIf(s);
        if (!c || !ses.ifOk(c)) return null;
        return { val: c, n };
      }
    }
    return null;
  }

  function matchOne(spec, toks, line, ses) {
    let ti = 0;
    let k = 0;
    const args = [];
    const exp = [];
    while (k < toks.length) {
      const st = spec.toks[ti];
      if (!st) return { fail: k };
      if (st.kind === 'kw') {
        const lc = toks[k].lc;
        let w = st.words.find((x) => x === lc);
        if (!w) {
          const c = st.words.filter((x) => x.startsWith(lc));
          if (c.length > 1) return { fail: k, amb: c };
          w = c[0];
        }
        if (!w) return { fail: k };
        if (st.words.length > 1 || st.opt) args.push(w);
        exp.push(w);
        k++;
        ti++;
      } else if (st.kind === 'LINE') {
        args.push(line.slice(toks[k].pos).replace(/\s+$/, ''));
        exp.push('$');
        k = toks.length;
        ti++;
      } else {
        const r = consume(st, toks, k, ses);
        if (!r) return { fail: k };
        args.push(r.val);
        exp.push('$');
        k += r.n;
        ti++;
      }
    }
    const complete = spec.toks.slice(ti).every((t) => t.opt);
    return { complete, args, exp, ti };
  }

  /* devuelve { spec, args } o { err: 'invalid'|'incomplete'|'ambiguous', at } */
  function parse(specs, line, ses) {
    const toks = tokenize(line);
    if (!toks.length) return { empty: true };
    const ok = [];
    let far = -1;
    let amb = null;
    for (const s of specs) {
      const m = matchOne(s, toks, line, ses);
      if (m.fail != null) {
        if (m.amb && m.fail >= far) amb = { at: m.fail, toks };
        far = Math.max(far, m.fail);
        continue;
      }
      ok.push({ s, m });
    }
    if (!ok.length) {
      if (amb && amb.at === far) return { err: 'ambiguous', at: far, toks };
      return { err: 'invalid', at: Math.max(0, far), toks };
    }
    /* dos órdenes distintas que encajan con lo escrito = abreviatura ambigua */
    for (let i = 0; i < toks.length; i++) {
      const words = new Set(ok.map((x) => x.m.exp[i]).filter((w) => w && w !== '$'));
      if (words.size > 1) {
        const prefix = ok.filter((x) => x.m.exp[i] === toks[i].lc);
        if (prefix.length) {
          ok.splice(0, ok.length, ...prefix);
          continue;
        }
        return { err: 'ambiguous', at: i, toks };
      }
    }
    const done = ok.filter((x) => x.m.complete);
    if (!done.length) return { err: 'incomplete', toks };
    return { spec: done[0].s, args: done[0].m.args, toks };
  }

  /* lista de lo que puede ir a continuación (para ? y Tab) */
  function nextOptions(specs, line, ses) {
    const toks = tokenize(line);
    const partial = !/\s$/.test(line) && toks.length ? toks.pop() : null;
    const opts = new Map();
    let cr = false;
    for (const s of specs) {
      const m = matchOne(s, toks, line, ses);
      if (m.fail != null) continue;
      if (!partial && m.complete) cr = true;
      const st = s.toks[m.ti];
      if (!st) continue;
      if (st.kind === 'kw') {
        for (const w of st.words) if (!partial || w.startsWith(partial.lc)) opts.set(w, HELP[w] || (m.ti === 0 ? s.d : '') || '');
      } else if (!partial) opts.set(PH[st.kind] || st.kind, st.min != null ? `<${st.min}-${st.max}>` : s.d || '');
    }
    return { opts, cr, partial };
  }

  /* ================= órdenes por modo ================= */
  const C = [];
  function cmd(modes, s, d, f, extra) {
    for (const spec of [].concat(s)) C.push(Object.assign({ modes: modes.split(' '), s: spec, toks: compile(spec), d, f }, extra || {}));
  }
  const isR = (ses) => ses.dev.kind === 'router';
  const isS = (ses) => ses.dev.kind === 'switch';
  const EXEC = 'user priv';
  const CFG = 'config if subif range line ospf rip dhcp vlan';

  /* ---------- modo usuario y privilegiado ---------- */
  cmd(EXEC, 'enable', 'Entrar en modo privilegiado', (s, a, r) => s.doEnable(r));
  cmd('priv', 'disable', 'Volver al modo usuario', (s) => (s.mode = 'user'));
  cmd(EXEC, ['exit', 'logout', 'quit'], 'Cerrar la sesión', (s, a, r) => s.logout(r));
  cmd('priv', 'configure terminal', 'Entrar en modo configuración', (s, a, r) => {
    r.o('Enter configuration commands, one per line.  End with CNTL/Z.');
    s.mode = 'config';
  });
  cmd(EXEC, 'ping IP', 'Comprobar si llega a otra IP', (s, a, r) => s.ping(a[0], r));
  cmd(EXEC, 'traceroute IP', 'Ver el camino hasta otra IP', (s, a, r) => s.trace(a[0], r));
  cmd(EXEC, 'telnet IP', 'Conectarse por Telnet', (s, a, r) => s.remote('telnet', a[0], null, r));
  cmd(EXEC, 'ssh -l WORD IP', 'Conectarse por SSH', (s, a, r) => s.remote('ssh', a[1], a[0], r));
  cmd('priv', ['copy running-config startup-config'], 'Guardar la configuración', (s, a, r) => {
    s.ask('Destination filename [startup-config]? ', false, (x, r2) => s.save(r2));
  });
  cmd('priv', 'copy startup-config running-config', 'Cargar la configuración guardada', (s, a, r) => {
    if (!s.dev.startup) return r.e('%Error opening nvram:/startup-config (No such file or directory)');
    s.dev.cfg = clone(s.dev.startup);
    s.net.touch();
    r.o('Destination filename [running-config]? ').o('[OK]');
  });
  cmd('priv', 'write memory?', 'Guardar la configuración', (s, a, r) => s.save(r));
  cmd('priv', 'erase startup-config', 'Borrar la configuración guardada', (s, a, r) => {
    s.ask('Erasing the nvram filesystem will remove all configuration files! Continue? [confirm]', false, (x, r2) => {
      if (/^n/i.test(x.trim())) return;
      s.dev.startup = null;
      r2.o('[OK]').o('Erase of nvram: complete').o('%SYS-7-NV_BLOCK_INIT: Initialized the geometry of nvram');
    });
  });
  cmd('priv', 'reload', 'Reiniciar el equipo', (s, a, r) => s.reload(r));

  /* show */
  /* casi todos los show valen en modo usuario (>); la configuración solo en # */
  const SHOW = (s, spec, d, f) => cmd(/^(running|startup)-config/.test(spec) ? 'priv' : EXEC, 'show ' + spec, d, f, { show: true });
  SHOW(0, 'running-config', 'Configuración actual', (s, a, r) => r.o(runText(s.dev, s.dev.cfg, s.net)));
  SHOW(0, 'startup-config', 'Configuración guardada', (s, a, r) => (s.dev.startup ? r.o(runText(s.dev, s.dev.startup, s.net, true)) : r.o('startup-config is not present')));
  SHOW(0, 'ip interface brief', 'Resumen de interfaces', (s, a, r) => r.o(ipIntBrief(s)), false);
  SHOW(0, 'interfaces IF?', 'Estado de una interfaz', (s, a, r) => r.o(showInterfaces(s, a[0])));
  SHOW(0, 'ip route', 'Tabla de rutas', (s, a, r) => r.o(showRoute(s)));
  SHOW(0, 'version', 'Modelo y versión', (s, a, r) => r.o(showVersion(s)), false);
  SHOW(0, 'history', 'Últimas órdenes', (s, a, r) => r.o(s.history.slice(-10).map((x) => '  ' + x).join('\n')), false);
  SHOW(0, 'controllers IF', 'Detalles del cable serie', (s, a, r) => r.o(showControllers(s, a[0])), true);
  SHOW(0, 'ip protocols', 'Protocolos de enrutamiento', (s, a, r) => r.o(showProtocols(s)));
  SHOW(0, 'ip ospf neighbor', 'Vecinos OSPF', (s, a, r) => r.o(showOspfNb(s)));
  SHOW(0, 'ip dhcp binding', 'Direcciones repartidas por DHCP', (s, a, r) => r.o(showBinding(s)));
  SHOW(0, 'ip dhcp pool', 'Pools DHCP', (s, a, r) => r.o(showPool(s)));
  SHOW(0, 'ip ssh', 'Estado de SSH', (s, a, r) => r.o(showSsh(s)));
  SHOW(0, 'cdp neighbors', 'Equipos Cisco vecinos', (s, a, r) => r.o(showCdp(s)));
  SHOW(0, 'vlan brief?', 'VLAN y sus puertos', (s, a, r) => r.o(showVlan(s)), true);
  SHOW(0, 'interfaces trunk', 'Puertos troncales', (s, a, r) => r.o(showTrunk(s)));
  SHOW(0, 'interfaces status', 'Estado de los puertos del switch', (s, a, r) => r.o(showStatus(s)));
  SHOW(0, 'mac-address-table', 'Tabla de direcciones MAC', (s, a, r) => r.o(showMac(s)));
  SHOW(0, 'mac address-table', 'Tabla de direcciones MAC', (s, a, r) => r.o(showMac(s)));
  for (const c of C) {
    if (/^show (vlan|interfaces trunk|interfaces status|mac)/.test(c.s)) c.when = isS;
    if (/^show (ip route|ip protocols|ip ospf|ip dhcp|controllers)/.test(c.s)) c.when = isR;
  }

  /* ---------- configuración global ---------- */
  cmd('config', 'hostname WORD', 'Nombre del equipo', (s, a, r, no) => {
    if (no) return (s.cfg.hostname = s.dev.kind === 'router' ? 'Router' : 'Switch');
    if (!/^[a-z]/i.test(a[0])) return r.e('% Hostname contains one or more illegal characters.');
    if (!/^[a-z0-9-]+$/i.test(a[0])) return r.e('% Hostname contains one or more illegal characters.');
    s.cfg.hostname = a[0];
  });
  cmd('config', 'enable secret WORD', 'Contraseña de enable (cifrada)', (s, a, r, no) => {
    if (no) return (s.cfg.enableSecret = null);
    if (s.cfg.minLen && a[0].length < s.cfg.minLen) return r.e(`% Password too short - must be at least ${s.cfg.minLen} characters. Password configuration failed`);
    s.cfg.enableSecret = a[0];
  });
  cmd('config', 'no enable secret', '', (s) => (s.cfg.enableSecret = null), { raw: true });
  cmd('config', 'no hostname', '', (s) => (s.cfg.hostname = s.dev.kind === 'router' ? 'Router' : 'Switch'), { raw: true });
  cmd('config', 'enable password WORD', 'Contraseña de enable (sin cifrar)', (s, a, r, no) => {
    if (no) return (s.cfg.enablePass = null);
    s.cfg.enablePass = a[0];
  });
  cmd('config', 'no enable password', '', (s) => (s.cfg.enablePass = null), { raw: true });
  cmd('config', 'service password-encryption', 'Cifrar las contraseñas', (s, a, r, no) => (s.cfg.spe = !no));
  cmd('config', 'security passwords min-length NUM:0-16', 'Longitud mínima de las contraseñas', (s, a, r, no) => (s.cfg.minLen = no ? null : a[0]));
  cmd('config', 'banner motd LINE', 'Mensaje del día', (s, a, r, no) => s.banner(a[0], r, no));
  cmd('config', 'no banner motd', '', (s) => (s.cfg.banner = null), { raw: true });
  cmd('config', 'ip domain-lookup', 'Buscar nombres por DNS', (s, a, r, no) => (s.cfg.lookup = !no));
  cmd('config', 'ip domain-name WORD', 'Nombre de dominio', (s, a, r, no) => (s.cfg.domain = no ? null : a[0]));
  cmd('config', 'no ip domain-name', '', (s) => (s.cfg.domain = null), { raw: true });
  cmd('config', ['username WORD secret WORD', 'username WORD privilege NUM:0-15 secret WORD'], 'Usuario local', (s, a, r, no) => {
    if (no) return delete s.cfg.users[a[0]];
    s.cfg.users[a[0]] = { secret: a[a.length - 1], priv: a.length === 3 ? a[1] : null };
  });
  cmd('config', 'username WORD password WORD', 'Usuario local', (s, a, r, no) => {
    if (no) return delete s.cfg.users[a[0]];
    s.cfg.users[a[0]] = { pass: a[1] };
  });
  cmd('config', 'no username WORD', '', (s, a) => delete s.cfg.users[a[0]], { raw: true });
  cmd('config', ['crypto key generate rsa', 'crypto key generate rsa general-keys modulus NUM:360-4096', 'crypto key generate rsa modulus NUM:360-4096'], 'Crear las claves para SSH', (s, a, r) => s.genKeys(a[0], r));
  cmd('config', 'crypto key zeroize rsa', 'Borrar las claves RSA', (s, a, r) => {
    s.cfg.rsa = 0;
    r.o('% All keys will be removed.').o('%SSH-5-DISABLED: SSH 1.99 has been disabled');
  });
  cmd('config', 'ip ssh version NUM:1-2', 'Versión de SSH', (s, a, r, no) => {
    if (no) return (s.cfg.sshVer = null);
    if (a[0] === 2 && s.cfg.rsa && s.cfg.rsa < 768) return r.e('Please create RSA keys (of atleast 768 bits size) to enable SSH v2.');
    s.cfg.sshVer = a[0];
  });
  cmd('config', ['ip ssh time-out NUM:1-120', 'ip ssh authentication-retries NUM:0-5'], 'Opciones de SSH', () => {});
  cmd('config', 'interface IF', 'Configurar una interfaz', (s, a, r, no) => s.enterIf(a[0], r, no));
  cmd('config', 'interface range LINE', 'Configurar varias interfaces a la vez', (s, a, r) => s.enterRange(a[0], r), { when: isS });
  cmd('config', 'line console NUM:0-0', 'Línea de consola', (s) => {
    s.mode = 'line';
    s.ctx = { line: 'con' };
  });
  cmd('config', 'line vty NUM:0-15 NUM:0-15?', 'Líneas remotas (Telnet/SSH)', (s, a) => {
    s.mode = 'line';
    s.ctx = { line: 'vty' };
  });
  cmd('config', 'router ospf NUM:1-65535', 'Activar OSPF', (s, a, r, no) => {
    if (no) return (s.cfg.ospf = null);
    if (!s.cfg.ospf || s.cfg.ospf.pid !== a[0]) s.cfg.ospf = { pid: a[0], rid: null, nets: [], passive: [] };
    s.mode = 'ospf';
  }, { when: isR });
  cmd('config', 'router rip', 'Activar RIP', (s, a, r, no) => {
    if (no) return (s.cfg.rip = null);
    if (!s.cfg.rip) s.cfg.rip = { version: null, nets: [], passive: [], auto: true };
    s.mode = 'rip';
  }, { when: isR });
  cmd('config', 'ip route IP MASK HOP', 'Ruta estática', (s, a, r, no) => s.route(a, r, no), { when: isR });
  cmd('config', 'ip dhcp excluded-address IP IP?', 'Direcciones que el DHCP no reparte', (s, a, r, no) => {
    const lo = a[0];
    const hi = a[1] != null ? a[1] : a[0];
    const ex = s.cfg.dhcpEx;
    const i = ex.findIndex(([x, y]) => x === lo && y === hi);
    if (no) return i >= 0 && ex.splice(i, 1);
    if (hi < lo) return r.e('% Invalid address range');
    if (i < 0) ex.push([lo, hi]);
  }, { when: isR });
  cmd('config', 'ip dhcp pool WORD', 'Crear un pool DHCP', (s, a, r, no) => {
    if (no) return delete s.cfg.pools[a[0]];
    if (!s.cfg.pools[a[0]]) s.cfg.pools[a[0]] = { net: null, mask: null, router: null, dns: null, domain: null };
    s.mode = 'dhcp';
    s.ctx = { pool: a[0] };
  }, { when: isR });
  cmd('config', 'vlan NUM:1-4094', 'Crear una VLAN', (s, a, r, no) => {
    const v = a[0];
    if (no) {
      if (v === 1) return r.e('Default VLAN 1 may not be deleted.');
      delete s.cfg.vlans[v];
      return;
    }
    if (v >= 1002 && v <= 1005) return r.e('Default VLAN ' + v + ' may not be modified.');
    if (!s.cfg.vlans[v]) s.cfg.vlans[v] = 'VLAN' + String(v).padStart(4, '0');
    s.mode = 'vlan';
    s.ctx = { vlan: v };
  }, { when: isS });
  cmd('config', 'ip default-gateway IP', 'Puerta de enlace del switch', (s, a, r, no) => (s.cfg.dgw = no ? null : a[0]), { when: isS });
  cmd('config', 'no ip default-gateway', '', (s) => (s.cfg.dgw = null), { raw: true, when: isS });
  cmd('config', 'ip routing', 'Activar el enrutamiento', () => {}, { when: isR });
  cmd('config', 'spanning-tree mode pvst|rapid-pvst', 'Modo de STP', () => {}, { when: isS });
  cmd(CFG, 'do LINE', 'Ejecutar una orden de modo #', (s, a, r) => s.doExec(a[0], r));
  cmd(CFG, 'end', 'Volver al modo privilegiado', (s, a, r) => {
    s.mode = 'priv';
    s.ctx = {};
    r.o('%SYS-5-CONFIG_I: Configured from console by console');
  });
  cmd(CFG, 'exit', 'Salir al modo anterior', (s) => {
    if (s.mode === 'config') s.mode = 'priv';
    else s.mode = 'config';
    s.ctx = {};
  });

  /* ---------- interfaz ---------- */
  const IFM = 'if subif range';
  const physSw = (s) => isS(s) && s.ctx.ifs && s.ctx.ifs.every((n) => !/^Vlan/.test(n));
  const hasIp = (s) => s.ctx.ifs && (isR(s) || s.ctx.ifs.every((n) => /^Vlan/.test(n)));
  const serialIf = (s) => isR(s) && s.ctx.ifs && s.ctx.ifs.every((n) => /^Serial/.test(n));
  cmd(IFM, 'ip address IP MASK', 'Dirección IP de la interfaz', (s, a, r, no) => s.ipAddr(a, r, no), { when: hasIp });
  cmd(IFM, 'no ip address', '', (s) => s.eachIf((f) => ((f.ip = null), (f.mask = null))), { raw: true, when: hasIp });
  cmd(IFM, 'shutdown', 'Apagar la interfaz', (s, a, r, no) => s.eachIf((f) => (f.shut = !no)));
  cmd(IFM, 'description LINE', 'Descripción', (s, a, r, no) => s.eachIf((f) => (f.desc = no ? '' : a[0])));
  cmd(IFM, 'no description', '', (s) => s.eachIf((f) => (f.desc = '')), { raw: true });
  const RATES = [1200, 2400, 4800, 9600, 19200, 38400, 56000, 64000, 72000, 125000, 128000, 148000, 250000, 500000, 800000, 1000000, 1300000, 2000000, 4000000];
  cmd(IFM, 'clock rate NUM', 'Velocidad del reloj (DCE)', (s, a, r, no) => {
    if (!no && !RATES.includes(a[0])) return r.e('Unknown clock rate');
    s.eachIf((f, n) => {
      f.clock = no ? null : a[0];
      if (!no && !s.net.isDce(s.dev, n) && s.net.linkAt(s.dev.id, n)) r.o('This command applies only to DCE interfaces');
    });
  }, { when: serialIf });
  cmd(IFM, 'no clock rate', '', (s) => s.eachIf((f) => (f.clock = null)), { raw: true, when: serialIf });
  cmd(IFM, 'bandwidth NUM:1-10000000', 'Ancho de banda (informativo)', () => {});
  cmd(IFM, 'duplex auto|full|half', 'Dúplex', (s, a) => s.eachIf((f) => (f.duplex = a[0] === 'auto' ? null : a[0])));
  cmd(IFM, 'speed 10|100|1000|auto', 'Velocidad', (s, a) => s.eachIf((f) => (f.speed = a[0] === 'auto' ? null : a[0])));
  cmd(IFM, 'switchport mode access|trunk', 'Modo del puerto', (s, a, r, no) => s.eachIf((f) => (f.mode = no ? 'access' : a[0])), { when: physSw });
  cmd(IFM, 'switchport access vlan NUM:1-4094', 'VLAN del puerto', (s, a, r, no) => {
    const v = no ? 1 : a[0];
    if (!s.cfg.vlans[v]) {
      r.o(`% Access VLAN does not exist. Creating vlan ${v}`);
      s.cfg.vlans[v] = 'VLAN' + String(v).padStart(4, '0');
    }
    s.eachIf((f) => (f.vlan = v));
  }, { when: physSw });
  cmd(IFM, 'no switchport access vlan', '', (s) => s.eachIf((f) => (f.vlan = 1)), { raw: true, when: physSw });
  cmd(IFM, 'switchport trunk native vlan NUM:1-4094', 'VLAN nativa del troncal', (s, a, r, no) => s.eachIf((f) => (f.native = no ? 1 : a[0])), { when: physSw });
  cmd(IFM, 'switchport trunk allowed vlan LINE', 'VLAN permitidas en el troncal', (s, a, r, no) => s.eachIf((f) => (f.allowed = no ? null : a[0])), { when: physSw });
  cmd(IFM, 'spanning-tree portfast', 'PortFast (solo puertos de PC)', (s, a, r, no) => {
    s.eachIf((f) => (f.portfast = !no));
    if (!no)
      r.o(
        '%Warning: portfast should only be enabled on ports connected to a single\n host. Connecting hubs, concentrators, switches, bridges, etc... to this\n interface  when portfast is enabled, can cause temporary bridging loops.\n Use with CAUTION'
      );
  }, { when: physSw });
  cmd(IFM, 'encapsulation dot1q NUM:1-4094', 'VLAN de la subinterfaz', (s, a, r, no) => s.eachIf((f) => (f.encap = no ? null : a[0])), { when: (s) => isR(s) && s.mode === 'subif' });
  cmd(IFM, 'ip helper-address IP', 'Reenviar DHCP a otro router', (s, a, r, no) =>
    s.eachIf((f) => {
      f.helpers = f.helpers.filter((h) => h !== a[0]);
      if (!no) f.helpers.push(a[0]);
    }), { when: (s) => isR(s) });
  cmd(IFM, 'ip ospf cost NUM:1-65535', 'Coste OSPF de la interfaz', (s, a, r, no) => s.eachIf((f) => (f.cost = no ? null : a[0])), { when: isR });

  /* ---------- línea ---------- */
  const L = (s) => s.cfg[s.ctx.line];
  cmd('line', 'password WORD', 'Contraseña de la línea', (s, a, r, no) => {
    if (no) return (L(s).pass = null);
    if (s.cfg.minLen && a[0].length < s.cfg.minLen) return r.e(`% Password too short - must be at least ${s.cfg.minLen} characters. Password configuration failed`);
    L(s).pass = a[0];
  });
  cmd('line', 'no password', '', (s) => (L(s).pass = null), { raw: true });
  cmd('line', 'no exec-timeout', '', (s) => (L(s).timeout = null), { raw: true });
  cmd('line', 'login local?', 'Pedir contraseña al entrar', (s, a, r, no) => {
    const l = L(s);
    if (no) {
      l.login = false;
      l.local = false;
      return;
    }
    l.local = a[0] === 'local';
    l.login = !l.local;
    if (l.login && !l.pass && s.ctx.line === 'con') r.o('% Login disabled on line 0, until \'password\' is set');
  });
  cmd('line', 'logging synchronous', 'No cortar lo que escribes con mensajes', (s, a, r, no) => (L(s).sync = !no));
  cmd('line', 'exec-timeout NUM:0-35791 NUM:0-2147483?', 'Tiempo sin uso antes de cerrar', (s, a, r, no) => (L(s).timeout = no ? null : [a[0], a[1] || 0]));
  cmd('line', 'transport input ssh|telnet|all|none', 'Cómo se puede entrar', (s, a) => (L(s).transport = a[0]), { when: (s) => s.ctx.line === 'vty' });
  cmd('line', 'transport input telnet ssh', 'Cómo se puede entrar', (s) => (L(s).transport = 'all'), { when: (s) => s.ctx.line === 'vty' });
  cmd('line', 'transport input ssh telnet', 'Cómo se puede entrar', (s) => (L(s).transport = 'all'), { when: (s) => s.ctx.line === 'vty' });

  /* ---------- OSPF y RIP ---------- */
  cmd('ospf', 'network IP WILD area NUM:0-4294967295', 'Red que entra en OSPF', (s, a, r, no) => {
    const o = s.cfg.ospf;
    const i = o.nets.findIndex((x) => x.addr === a[0] && x.wild === a[1]);
    if (no) return i >= 0 && o.nets.splice(i, 1);
    if (i < 0) o.nets.push({ addr: a[0], wild: a[1], area: a[2] });
  });
  cmd('ospf', 'router-id IP', 'Identificador del router', (s, a, r, no) => {
    s.cfg.ospf.rid = no ? null : a[0];
    if (!no) r.o('Reload or use "clear ip ospf process" command, for this to take effect');
  });
  cmd('ospf rip', 'passive-interface IF', 'No hablar el protocolo por esa interfaz', (s, a, r, no) => {
    const p = s.mode === 'ospf' ? s.cfg.ospf : s.cfg.rip;
    p.passive = p.passive.filter((x) => x !== a[0]);
    if (!no) p.passive.push(a[0]);
  });
  cmd('ospf rip', 'default-information originate', 'Anunciar la ruta por defecto', () => {});
  cmd('rip', 'version NUM:1-2', 'Versión de RIP', (s, a, r, no) => (s.cfg.rip.version = no ? null : a[0]));
  cmd('rip', 'network IP', 'Red que entra en RIP', (s, a, r, no) => {
    const n = (a[0] & classful(a[0])) >>> 0;
    const nets = s.cfg.rip.nets;
    const i = nets.indexOf(n);
    if (no) return i >= 0 && nets.splice(i, 1);
    if (i < 0) nets.push(n);
  });
  cmd('rip', 'auto-summary', 'Resumir por clases', (s, a, r, no) => (s.cfg.rip.auto = !no));
  cmd(EXEC.split(' ')[1], 'clear ip ospf process', 'Reiniciar OSPF', (s, a, r) => {
    s.ask('Reset ALL OSPF processes? [no]: ', false, () => {});
  });

  /* ---------- DHCP ---------- */
  const P = (s) => s.cfg.pools[s.ctx.pool];
  cmd('dhcp', 'network IP MASK', 'Red que reparte el pool', (s, a, r, no) => {
    if (no) return ((P(s).net = null), (P(s).mask = null));
    if (prefixOf(a[1]) < 0) return r.e('% Invalid network mask');
    P(s).net = netOf(a[0], a[1]);
    P(s).mask = a[1];
  });
  cmd('dhcp', 'default-router IP', 'Puerta de enlace para los clientes', (s, a, r, no) => (P(s).router = no ? null : a[0]));
  cmd('dhcp', 'dns-server IP', 'DNS para los clientes', (s, a, r, no) => (P(s).dns = no ? null : a[0]));
  cmd('dhcp', 'domain-name WORD', 'Dominio para los clientes', (s, a, r, no) => (P(s).domain = no ? null : a[0]));

  /* ---------- VLAN ---------- */
  cmd('vlan', 'name WORD', 'Nombre de la VLAN', (s, a, r, no) => {
    if (a[0] && a[0].length > 32) return r.e('% Invalid input: name too long');
    s.cfg.vlans[s.ctx.vlan] = no ? 'VLAN' + String(s.ctx.vlan).padStart(4, '0') : a[0];
  });

  /* ================= sesión de IOS ================= */
  class IosSession {
    constructor(net, dev, opts) {
      opts = opts || {};
      this.net = net;
      this.dev = dev;
      this.via = opts.via || 'console';
      this.peerIp = opts.peerIp || null;
      this.mode = 'user';
      this.ctx = {};
      this.history = [];
      this.pending = null;
      this.closed = false;
      this.kind = 'ios';
    }
    get cfg() {
      return this.dev.cfg;
    }
    prompt() {
      if (this.pending) return this.pending.prompt;
      const h = this.cfg.hostname;
      const sub = { config: 'config', if: 'config-if', subif: 'config-subif', range: 'config-if-range', line: 'config-line', ospf: 'config-router', rip: 'config-router', dhcp: 'dhcp-config', vlan: 'config-vlan' }[this.mode];
      return h + (this.mode === 'user' ? '>' : this.mode === 'priv' ? '#' : `(${sub})#`);
    }
    title() {
      return this.cfg.hostname + (this.via === 'console' ? ' · consola' : ' · ' + this.via + ' desde ' + (this.from || '')) + ' · ' + this.dev.label;
    }
    unsaved() {
      return JSON.stringify(this.cfg) !== JSON.stringify(this.dev.startup || factory(this.dev));
    }
    ask(prompt, pw, fn) {
      this.pending = { prompt, pw, fn };
    }
    /* banner + login al empezar (consola tras Enter o conexión remota) */
    begin(r) {
      if (this.cfg.banner) r.o('').o(this.cfg.banner);
      const line = this.via === 'console' ? this.cfg.con : this.cfg.vty;
      if (this.via !== 'console' && line.login && !line.local && !line.pass) {
        r.o('').e('Password required, but none set');
        this.closed = true;
        return r;
      }
      const tries = { n: 0 };
      const fail = (r2) => {
        if (++tries.n >= 3) {
          r2.e('% Bad passwords');
          if (this.via === 'console') this.idle(r2);
          else this.closed = true;
          return;
        }
        askUser();
      };
      const askPass = (user) =>
        this.ask('Password: ', true, (pw, r2) => {
          const u = user != null ? this.cfg.users[user] : null;
          const good = user != null ? u && (u.secret === pw || u.pass === pw) : pw === line.pass;
          if (!good) {
            if (user != null) r2.e('% Login invalid');
            return fail(r2);
          }
          this.mode = 'user';
          r2.o('');
        });
      const askUser = () => {
        if (line.local) {
          if (this.sshUser != null) return askPass(this.sshUser);
          this.ask('Username: ', false, (u, r2) => askPass(u.trim()));
        } else askPass(null);
      };
      if ((line.login && line.pass) || line.local) {
        r.o('').o('User Access Verification').o('');
        if (line.local && !Object.keys(this.cfg.users).length) {
          r.e('% Login disabled: no local users');
          if (this.via !== 'console') this.closed = true;
          return r;
        }
        askUser();
      } else this.mode = 'user';
      return r;
    }
    idle(r) {
      this.mode = 'user';
      this.ctx = {};
      r.o('').o(`${this.cfg.hostname} con0 is now available`).o('').o('').o('Press RETURN to get started.');
      this.ask('', false, (x, r2) => this.begin(r2));
    }
    logout(r) {
      if (this.via === 'console') return this.idle(r);
      this.closed = true;
    }
    doEnable(r) {
      const sec = this.cfg.enableSecret || this.cfg.enablePass;
      if (!sec) {
        if (this.via !== 'console') return r.e('% No password set');
        this.mode = 'priv';
        return;
      }
      let n = 0;
      const ask = () =>
        this.ask('Password: ', true, (pw, r2) => {
          if (pw === sec) return (this.mode = 'priv');
          if (++n >= 3) return r2.e('% Bad secrets');
          ask();
        });
      ask();
    }
    save(r) {
      this.dev.startup = clone(this.cfg);
      r.o('Building configuration...').o('[OK]');
    }
    reload(r) {
      const go = (r2) =>
        this.ask('Proceed with reload? [confirm]', false, (x, r3) => {
          if (/^n/i.test(x.trim())) return;
          this.net.reboot(this.dev);
          r3.o('').o('System Bootstrap, Version 15.1(4)M4, RELEASE SOFTWARE (fc1)').o('Initializing memory...').o('Self decompressing the image : ########################## [OK]').o('');
          if (!this.dev.startup) r3.o('--- System Configuration Dialog ---').o('Would you like to enter the initial configuration dialog? [yes/no]: no');
          this.idle(r3);
        });
      if (this.unsaved())
        this.ask('System configuration has been modified. Save? [yes/no]: ', false, (x, r2) => {
          if (/^y/i.test(x.trim())) this.save(r2);
          go(r2);
        });
      else go(r);
    }
    banner(text, r, no) {
      if (no) return (this.cfg.banner = null);
      const d = text[0];
      const rest = text.slice(1);
      const end = rest.indexOf(d);
      if (end >= 0) {
        this.cfg.banner = rest.slice(0, end);
        return;
      }
      const lines = [rest];
      r.o(`Enter TEXT message.  End with the character '${d}'.`);
      const more = () =>
        this.ask('', false, (x) => {
          const k = x.indexOf(d);
          if (k >= 0) {
            lines.push(x.slice(0, k));
            this.cfg.banner = lines.join('\n').replace(/^\n+|\n+$/g, '');
          } else {
            lines.push(x);
            more();
          }
        });
      more();
    }
    genKeys(bits, r) {
      if (/^(Router|Switch)$/.test(this.cfg.hostname)) return r.e(`% Please define a hostname other than ${this.cfg.hostname}.`);
      if (!this.cfg.domain) return r.e('% Please define a domain-name first.');
      const done = (b, r2) => {
        if (!(b >= 360 && b <= 4096)) return r2.e('% Key modulus size must be between 360 and 4096');
        this.cfg.rsa = b;
        r2.o(`% Generating ${b} bit RSA keys, keys will be non-exportable...[OK]`).o('').o(`%SSH-5-ENABLED: SSH 1.99 has been enabled`);
      };
      r.o(`The name for the keys will be: ${this.cfg.hostname}.${this.cfg.domain}`);
      if (bits) return done(bits, r);
      r.o('Choose the size of the key modulus in the range of 360 to 4096 for your').o('  General Purpose Keys. Choosing a key modulus greater than 512 may take').o('  a few minutes.').o('');
      this.ask('How many bits in the modulus [512]: ', false, (x, r2) => done(x.trim() ? +x.trim() : 512, r2));
    }
    ifOk(n) {
      const ifs = this.cfg.ifs;
      if (ifs[n]) return true;
      if (this.dev.kind === 'router' && n.includes('.')) return !!ifs[n.split('.')[0]] && !/^Vlan/.test(n);
      if (this.dev.kind === 'switch' && /^Vlan\d+$/.test(n)) return +n.slice(4) >= 1 && +n.slice(4) <= 4094;
      return false;
    }
    enterIf(n, r, no) {
      if (no) {
        if (n.includes('.') || (/^Vlan/.test(n) && n !== 'Vlan1')) delete this.cfg.ifs[n];
        return;
      }
      if (!this.cfg.ifs[n]) {
        this.cfg.ifs[n] = mkIf(n, this.dev.kind);
        if (n.includes('.')) this.cfg.ifs[n].shut = false;
      }
      this.mode = n.includes('.') ? 'subif' : 'if';
      this.ctx = { ifs: [n] };
    }
    enterRange(text, r) {
      const out = [];
      for (const piece of text.split(',')) {
        const m = /^\s*([a-z]+)\s*(\d+\/)(\d+)\s*(?:-\s*(\d+))?\s*$/i.exec(piece);
        if (!m) return r.e('% Invalid input detected at \'^\' marker.');
        const a = +m[3];
        const b = m[4] ? +m[4] : a;
        for (let i = a; i <= b; i++) {
          const n = canonIf(m[1] + m[2] + i);
          if (!n || !this.cfg.ifs[n]) return r.e('% Invalid input detected at \'^\' marker.');
          out.push(n);
        }
      }
      this.mode = 'range';
      this.ctx = { ifs: out };
    }
    eachIf(fn) {
      for (const n of this.ctx.ifs) fn(this.cfg.ifs[n], n);
    }
    ipAddr(a, r, no) {
      if (no) return this.eachIf((f) => ((f.ip = null), (f.mask = null)));
      const [ip, mask] = a;
      const p = prefixOf(mask);
      if (p < 0 || p === 0) return r.e('% Inconsistent address and mask');
      const net = netOf(ip, mask);
      const bc = (net + 2 ** (32 - p) - 1) >>> 0;
      if (p < 31 && (ip === net || ip === bc)) return r.e(`Bad mask /${p} for address ${n2ip(ip)}`);
      const me = this.ctx.ifs[0];
      for (const n of Object.keys(this.cfg.ifs)) {
        const f = this.cfg.ifs[n];
        if (n === me || f.ip == null) continue;
        if (this.dev.kind === 'switch' && !/^Vlan/.test(n)) continue;
        if (inNet(ip, f.ip, f.mask) || inNet(f.ip, ip, mask)) return r.e(`% ${n2ip(netOf(ip, mask))} overlaps with ${n}`);
      }
      this.eachIf((f) => {
        f.ip = ip;
        f.mask = mask;
      });
    }
    route(a, r, no) {
      const [net, mask, hop] = a;
      if (prefixOf(mask) < 0) return r.e('%Inconsistent address and mask');
      if (((net & mask) >>> 0) !== net) return r.e('%Inconsistent address and mask');
      const via = typeof hop === 'number' ? { nh: hop } : { ifn: hop };
      const list = this.cfg.routes;
      const same = (x) => x.net === net && x.mask === mask && x.nh === via.nh && x.ifn === via.ifn;
      if (no) return (this.cfg.routes = list.filter((x) => !same(x)));
      if (!list.some(same)) list.push(Object.assign({ net, mask }, via));
    }
    doExec(line, r) {
      const keep = this.mode;
      const ctx = this.ctx;
      this.mode = 'priv';
      const r2 = this.exec(line, true);
      if (this.mode === 'priv') {
        this.mode = keep;
        this.ctx = ctx;
      }
      for (const [k, t] of r2.parts) {
        if (k === 'caret') r.parts.push(['caret', '   ' + t]);
        else (k === 'err' ? r.e : r.o)(t);
      }
      Object.assign(r, { ping: r2.ping, connect: r2.connect });
    }

    /* ---------- ping, traceroute y conexiones ---------- */
    ping(ip, r) {
      const p = this.net.ping(this.dev, ip);
      const first = !p.self && p.ok && this.net.firstTime(this.dev, ip, p);
      const marks = p.ok ? (first ? '.!!!!' : '!!!!!') : p.fail === 'unreach' ? 'U.U.U' : '.....';
      const ok = (marks.match(/!/g) || []).length;
      r.o('Type escape sequence to abort.').o(`Sending 5, 100-byte ICMP Echos to ${n2ip(ip)}, timeout is 2 seconds:`).o(marks);
      r.o(`Success rate is ${ok * 20} percent (${ok}/5)` + (ok ? ', round-trip min/avg/max = 0/0/1 ms' : ''));
      r.ping = { from: this.dev.id, to: ip, ok: p.ok, hops: p.hops, fail: p.fail, at: p.at && p.at.id };
    }
    trace(ip, r) {
      const p = this.net.forward(this.dev, ip);
      r.o('Type escape sequence to abort.').o(`Tracing the route to ${n2ip(ip)}`).o('');
      const list = traceHops(this.net, this.dev, ip, p);
      list.forEach((h, i) => r.o(`  ${i + 1}   ${h ? h + '   0 msec   0 msec   0 msec' : '*    *    *'}`));
      r.ping = { from: this.dev.id, to: ip, ok: p.ok, hops: p.hops, trace: true };
    }
    remote(kind, ip, user, r) {
      openRemote(this, kind, ip, user, r);
    }

    /* ---------- ejecutar una línea ---------- */
    run(line) {
      const r = Res();
      if (this.pending) {
        const p = this.pending;
        this.pending = null;
        p.fn(line, r);
        return this.finish(r, line, true);
      }
      if (line.trim()) this.history.push(line.trim());
      if (/\?$/.test(line)) return this.help(line.slice(0, -1), r);
      return this.finish(this.exec(line), line);
    }
    finish(r, line, wasPending) {
      r.pw = !!(this.pending && this.pending.pw);
      if (this.closed) {
        r.close = true;
        r.o(`[Connection to ${this.peerIp != null ? n2ip(this.peerIp) : this.cfg.hostname} closed by foreign host]`);
      }
      return r;
    }
    specs(mode) {
      return C.filter((c) => c.modes.includes(mode) && (!c.when || c.when(this)));
    }
    exec(line, fromDo) {
      const r = Res();
      let pipe = null;
      const pm = /^(.*?)\s\|\s*(include|exclude|begin|section|i|in|inc|e|ex|exc|b|be|beg|s|se|sec)\s+(.*)$/i.exec(line);
      if (pm) {
        line = pm[1];
        pipe = { k: pm[2].toLowerCase()[0], re: pm[3].trim() };
      }
      const mode = this.mode;
      let neg = false;
      let body = line;
      const toks = tokenize(line);
      if (!toks.length) return r;
      let specs = this.specs(mode);
      const isCfg = !/^(user|priv)$/.test(mode);
      if (isCfg && toks[0].lc === 'no' && toks.length > 1) {
        const raw = parse(specs.filter((c) => c.raw), line, this);
        if (raw.spec) return this.call(raw, r, false, pipe);
        neg = true;
        body = line.slice(toks[1].pos);
        specs = specs.filter((c) => !c.raw);
      }
      let res = parse(specs, body, this);
      /* desde un submodo se pueden escribir órdenes globales: IOS sube solo a (config) */
      if (res.err && isCfg && mode !== 'config') {
        const g = parse(this.specs('config').filter((c) => !c.modes.includes(mode) && (neg ? !c.raw : true)), body, this);
        if (g.spec) {
          this.mode = 'config';
          this.ctx = {};
          res = g;
        }
      }
      if (res.err) {
        const off = neg ? toks[1].pos : 0;
        if (res.err === 'incomplete') return r.e('% Incomplete command.');
        if (res.err === 'ambiguous') return r.e(`% Ambiguous command:  "${line.trim()}"`);
        /* una palabra suelta en modo usuario o # se toma como nombre de equipo al que conectarse */
        if (!isCfg && res.at === 0 && toks.length === 1 && /^[a-z0-9_.-]+$/i.test(toks[0].t)) {
          r.lookup = true;
          if (this.cfg.lookup) r.o(`Translating "${toks[0].t}"...domain server (255.255.255.255)`);
          else r.o(`Translating "${toks[0].t}"`);
          r.o('').e('% Unknown command or computer name, or unable to find computer address');
          return r;
        }
        const at = res.toks[res.at] ? res.toks[res.at].pos + off : line.length;
        r.caret = at;
        r.parts.push(['caret', ' '.repeat(at) + '^']);
        return r.e("% Invalid input detected at '^' marker.");
      }
      return this.call(res, r, neg, pipe);
    }
    call(res, r, neg, pipe) {
      res.spec.f(this, res.args, r, neg);
      r.cmd = res.spec.s;
      if (pipe && r.out) {
        let re;
        try {
          re = new RegExp(pipe.re, 'i');
        } catch (e) {
          re = { test: (x) => x.toLowerCase().includes(pipe.re.toLowerCase()) };
        }
        let lines = r.out.replace(/\n$/, '').split('\n');
        if (pipe.k === 'i') lines = lines.filter((x) => re.test(x));
        else if (pipe.k === 'e') lines = lines.filter((x) => !re.test(x));
        else if (pipe.k === 'b') {
          const i = lines.findIndex((x) => re.test(x));
          lines = i < 0 ? [] : lines.slice(i);
        } else {
          const outl = [];
          for (let i = 0; i < lines.length; i++)
            if (/^\S/.test(lines[i]) && re.test(lines[i])) {
              outl.push(lines[i]);
              while (lines[i + 1] && /^\s/.test(lines[i + 1])) outl.push(lines[++i]);
            }
          lines = outl;
        }
        const errs = r.parts.filter((p) => p[0] === 'err');
        r.parts = lines.length ? [['out', lines.join('\n')]] : [];
        for (const p of errs) r.parts.push(p);
        r.out = lines.join('\n') + (lines.length ? '\n' : '');
        r.piped = true;
      }
      return r;
    }
    help(line, r) {
      r.keep = line;
      const { opts, cr, partial } = nextOptions(this.specs(this.mode), line, this);
      if (!opts.size && !cr) {
        if (partial) return r.e('% Unrecognized command');
        return r.e('% Unrecognized command');
      }
      if (partial) r.o([...opts.keys()].join('  '));
      else {
        const w = Math.max(...[...opts.keys()].map((k) => k.length), 4) + 2;
        for (const [k, d] of opts) r.o('  ' + k.padEnd(w) + d);
        if (cr) r.o('  <cr>');
      }
      r.help = true;
      return r;
    }
    complete(line) {
      const { opts, partial } = nextOptions(this.specs(this.mode), line, this);
      if (!partial) return { line, options: [] };
      const words = [...opts.keys()].filter((k) => !/[ <]/.test(k) && k === k.toLowerCase());
      if (words.length === 1) return { line: line.slice(0, line.length - partial.t.length) + words[0] + ' ', options: [] };
      return { line, options: words };
    }
  }

  /* ================= conexiones remotas ================= */
  function traceHops(net, dev, ip, p) {
    const out = p.ips.slice();
    if (!p.ok) out.push(null, null, null);
    return out.map((x) => (x == null ? null : n2ip(x)));
  }
  function openRemote(ses, kind, ip, user, r) {
    const net = ses.net;
    const label = n2ip(ip);
    r.o(`Trying ${label} ...` + (kind === 'telnet' ? '' : ''));
    const p = net.ping(ses.dev, ip);
    if (!p.ok) return r.e('% Connection timed out; remote host not responding');
    const t = net.ownerOf(ip);
    if (!t || t.kind === 'pc') return r.e('% Connection refused by remote host');
    const vty = t.cfg.vty;
    const tr = vty.transport;
    const allowed = tr == null || tr === 'all' || tr === kind;
    if (!allowed) return r.e('% Connection refused by remote host');
    if (kind === 'ssh' && !(t.cfg.rsa && t.cfg.domain)) return r.e('% Connection refused by remote host');
    if (kind === 'ssh' && !vty.local) return r.e('% Connection refused by remote host');
    if (kind === 'telnet') r.o('Open');
    const s2 = new IosSession(net, t, { via: kind });
    s2.from = ses.dev.kind === 'pc' ? ses.dev.id : ses.cfg.hostname;
    s2.peerIp = ip;
    if (kind === 'ssh') s2.sshUser = user;
    s2.begin(r);
    if (s2.closed) return r.o(`[Connection to ${label} closed by foreign host]`);
    r.connect = s2;
    r.ping = { from: ses.dev.id, to: ip, ok: true, hops: p.hops, quiet: true };
  }

  /* ================= PC: símbolo del sistema ================= */
  class PcSession {
    constructor(net, dev) {
      this.net = net;
      this.dev = dev;
      this.history = [];
      this.pending = null;
      this.kind = 'pc';
      this.mode = 'pc';
    }
    prompt() {
      return this.pending ? this.pending.prompt : 'C:\\>';
    }
    title() {
      return this.dev.id + ' · Símbolo del sistema';
    }
    run(line) {
      const r = Res();
      if (this.pending) {
        const p = this.pending;
        this.pending = null;
        p.fn(line, r);
        r.pw = !!(this.pending && this.pending.pw);
        return r;
      }
      const t = line.trim();
      if (t) this.history.push(t);
      if (!t) return r;
      const a = t.split(/\s+/);
      const c = a[0].toLowerCase();
      const pc = this.dev.pc;
      if (c === 'ipconfig') {
        const sub = (a[1] || '').toLowerCase();
        if (!a[1] || sub === '/all') return this.show(r, sub === '/all');
        if (sub === '/renew') return this.renew(r);
        if (sub === '/release') {
          this.net.release(this.dev);
          pc.ip = pc.mask = pc.gw = pc.dns = null;
          pc.dhcp = true;
          this.net.touch();
          r.o('').o('   IP Address......................: 0.0.0.0').o('   Subnet Mask.....................: 0.0.0.0').o('   Default Gateway.................: 0.0.0.0').o('   DNS Server......................: 0.0.0.0');
          return r;
        }
        const ip = ip2n(a[1]);
        const mask = ip2n(a[2] || '');
        const gw = a[3] ? ip2n(a[3]) : null;
        if (ip == null) return r.e('Invalid IP address.');
        if (mask == null || prefixOf(mask) <= 0) return r.e('Invalid subnet mask.');
        if (a[3] && gw == null) return r.e('Invalid gateway address.');
        const net = netOf(ip, mask);
        const bc = (net + 2 ** (32 - prefixOf(mask)) - 1) >>> 0;
        if (ip === net || ip === bc) return r.e('Invalid IP address: it is the network or broadcast address.');
        if (gw != null && !inNet(gw, ip, mask)) return r.e('Invalid gateway address: it must be in the same network as the IP address.');
        this.net.release(this.dev);
        Object.assign(pc, { ip, mask, gw, dhcp: false });
        this.net.touch();
        return r;
      }
      if (c === 'ping') {
        const ip = ip2n(a[a.length - 1]);
        if (ip == null || a.length < 2) return r.e('Ping request could not find host ' + (a[1] || '') + '. Please check the name and try again.');
        return this.ping(ip, r);
      }
      if (c === 'tracert') {
        const ip = ip2n(a[1] || '');
        if (ip == null) return r.e('Unable to resolve target system name ' + (a[1] || '') + '.');
        const p = this.net.forward(this.dev, ip);
        r.o('').o(`Tracing route to ${n2ip(ip)} over a maximum of 30 hops: `).o('');
        const hops = traceHops(this.net, this.dev, ip, p);
        hops.forEach((h, i) => r.o(`  ${String(i + 1).padStart(2)}   ${h ? '0 ms      0 ms      0 ms      ' + h : '*         *         *         Request timed out.'}`));
        r.o('').o('Trace complete.');
        r.ping = { from: this.dev.id, to: ip, ok: p.ok, hops: p.hops, trace: true };
        return r;
      }
      if (c === 'telnet') {
        const ip = ip2n(a[1] || '');
        if (ip == null) return r.e('Invalid Command.');
        openRemote(this, 'telnet', ip, null, r);
        return r;
      }
      if (c === 'ssh') {
        const m = /^ssh\s+-l\s+(\S+)\s+(\S+)$/i.exec(t);
        if (!m) return r.o('').o('Packet Tracer PC SSH').o('').o('Usage: SSH -l username target');
        const ip = ip2n(m[2]);
        if (ip == null) return r.e('Invalid Command.');
        openRemote(this, 'ssh', ip, m[1], r);
        return r;
      }
      if (c === 'cls') {
        r.clear = true;
        return r;
      }
      if (c === 'help' || c === '?') {
        r.o('Available Commands:');
        for (const [k, d] of [
          ['?', 'Display the list of available commands'],
          ['cls', 'Clear screen'],
          ['ipconfig', 'Display or set IP configuration (ipconfig IP MASK GATEWAY)'],
          ['ipconfig /renew', 'Ask for an IP address by DHCP'],
          ['ping', 'Send echo messages'],
          ['ssh', 'Ssh client (ssh -l user IP)'],
          ['telnet', 'Telnet client'],
          ['tracert', 'Trace route to destination'],
        ])
          r.o(k.padEnd(18) + d);
        return r;
      }
      return r.e('Invalid Command.');
    }
    show(r, all) {
      const pc = this.dev.pc;
      const z = (v) => (v == null ? '0.0.0.0' : n2ip(v));
      r.o('').o('FastEthernet0 Connection:(default port)').o('');
      if (all) r.o('   Physical Address................: ' + this.dev.mac).o('   DHCP Enabled....................: ' + (pc.dhcp ? 'Yes' : 'No'));
      r.o('   Connection-specific DNS Suffix..: ' + (pc.domain || ''));
      r.o('   IPv4 Address....................: ' + z(pc.ip)).o('   Subnet Mask.....................: ' + z(pc.mask)).o('   Default Gateway.................: ' + z(pc.gw));
      if (all) r.o('   DNS Servers.....................: ' + z(pc.dns));
      return r;
    }
    renew(r) {
      const pc = this.dev.pc;
      pc.dhcp = true;
      const got = this.net.dhcp(this.dev);
      if (!got) {
        pc.ip = (ip2n('169.254.0.0') + 1 + (parseInt(this.dev.mac.slice(-4), 16) % 65000)) >>> 0;
        pc.mask = ip2n('255.255.0.0');
        pc.gw = null;
        pc.dns = null;
        this.net.touch();
        r.e('DHCP request failed. APIPA is being used.');
        r.dhcp = { ok: false };
        return this.show(r);
      }
      Object.assign(pc, { ip: got.ip, mask: got.mask, gw: got.gw, dns: got.dns, domain: got.domain });
      this.net.touch();
      r.dhcp = { ok: true, server: got.server.id };
      r.o('').o('   IP Address......................: ' + n2ip(got.ip)).o('   Subnet Mask.....................: ' + n2ip(got.mask)).o('   Default Gateway.................: ' + (got.gw != null ? n2ip(got.gw) : '0.0.0.0')).o('   DNS Server......................: ' + (got.dns != null ? n2ip(got.dns) : '0.0.0.0'));
      return r;
    }
    ping(ip, r) {
      const p = this.net.ping(this.dev, ip);
      const owner = this.net.ownerOf(ip);
      const routers = p.hops ? p.hops.filter((id, i) => i > 0 && i < p.hops.length - 1 && this.net.devs[id].kind === 'router').length : 0;
      const ttl = (owner && owner.kind === 'pc' ? 128 : 255) - routers;
      const first = p.ok && this.net.firstTime(this.dev, ip, p) && routers > 0;
      r.o('').o(`Pinging ${n2ip(ip)} with 32 bytes of data:`).o('');
      let got = 0;
      for (let i = 0; i < 4; i++) {
        if (p.ok && !(first && i === 0)) {
          got++;
          r.o(`Reply from ${n2ip(ip)}: bytes=32 time<1ms TTL=${ttl}`);
        } else if (p.fail === 'unreach' && p.at && p.at.kind === 'router') {
          const via = p.ips.length ? p.ips[p.ips.length - 1] : null;
          r.o(`Reply from ${via != null ? n2ip(via) : n2ip(ip)}: Destination host unreachable.`);
        } else r.o('Request timed out.');
      }
      r.o('').o(`Ping statistics for ${n2ip(ip)}:`).o(`    Packets: Sent = 4, Received = ${got}, Lost = ${4 - got} (${(4 - got) * 25}% loss),`);
      if (got) r.o('Approximate round trip times in milli-seconds:').o('    Minimum = 0ms, Maximum = 0ms, Average = 0ms');
      r.ping = { from: this.dev.id, to: ip, ok: p.ok, got, hops: p.hops, fail: p.fail, at: p.at && p.at.id };
      return r;
    }
    complete(line) {
      const words = ['ipconfig', 'ping', 'tracert', 'telnet', 'ssh', 'help', 'cls'];
      const c = words.filter((w) => w.startsWith(line.trim().toLowerCase()));
      if (c.length === 1 && !/\s/.test(line.trim())) return { line: c[0] + ' ', options: [] };
      return { line, options: line.trim() && !/\s/.test(line.trim()) ? c : [] };
    }
  }

  /* ================= textos de los show ================= */
  const pad = (s, n) => String(s).padEnd(n);
  const tight = (n) => midIf(n).replace(' ', '');
  const ipm = (ip, m) => n2ip(ip) + '/' + prefixOf(m);
  const ST = { up: 'up', down: 'down', admin: 'administratively down' };
  function ifOrder(names) {
    const key = (n) => n.replace(/\d+/g, (d) => d.padStart(4, '0'));
    const rank = (n) => (/^Fast/.test(n) ? 0 : /^Gig/.test(n) ? 1 : /^Serial/.test(n) ? 2 : 3);
    return names.slice().sort((a, b) => rank(a) - rank(b) || key(a).localeCompare(key(b)));
  }
  function ipIntBrief(s) {
    const d = s.dev;
    const net = s.net;
    let o = 'Interface              IP-Address      OK? Method Status                Protocol\n';
    for (const n of ifOrder(Object.keys(d.cfg.ifs))) {
      const f = d.cfg.ifs[n];
      const [st, pr] = net.status(d, n);
      o += pad(n, 23) + pad(f.ip != null ? n2ip(f.ip) : 'unassigned', 16) + 'YES ' + pad(f.ip != null ? 'manual' : 'unset', 7) + pad(ST[st], 22) + pr + '\n';
    }
    return o.replace(/\n$/, '');
  }
  function showInterfaces(s, only) {
    const d = s.dev;
    const names = only ? [only] : ifOrder(Object.keys(d.cfg.ifs));
    const out = [];
    for (const n of names) {
      const f = d.cfg.ifs[n];
      if (!f) continue;
      const [st, pr] = s.net.status(d, n);
      const hw = /^Serial/.test(n) ? 'HD64570' : /^Vlan/.test(n) ? 'CPU Interface' : /^Gig/.test(n) ? 'CN Gigabit Ethernet' : 'Lance';
      out.push(`${n} is ${ST[st]}, line protocol is ${pr}${d.kind === 'switch' && !/^Vlan/.test(n) ? (pr === 'up' ? ' (connected)' : ' (disabled)') : ''}`);
      out.push(`  Hardware is ${hw}, address is ${d.macOf(n)} (bia ${d.macOf(n)})`);
      if (f.desc) out.push('  Description: ' + f.desc);
      if (f.ip != null) out.push('  Internet address is ' + ipm(f.ip, f.mask));
      out.push(`  MTU 1500 bytes, BW ${/^Serial/.test(n) ? 1544 : /^Gig/.test(n) ? 1000000 : 100000} Kbit, DLY ${/^Serial/.test(n) ? 20000 : 100} usec,`);
      if (f.encap) out.push(`  Encapsulation 802.1Q Virtual LAN, Vlan ID ${f.encap}`);
      else out.push(`  Encapsulation ${/^Serial/.test(n) ? 'HDLC' : 'ARPA'}, loopback not set`);
    }
    return out.join('\n');
  }
  function showRoute(s) {
    const rt = s.net.routes(s.dev);
    const def = rt.find((x) => x.net === 0 && x.mask === 0);
    const o = [
      'Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP',
      '       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area',
      '       N1 - OSPF NSSA external type 1, N2 - OSPF NSSA external type 2',
      '       E1 - OSPF external type 1, E2 - OSPF external type 2, E - EGP',
      '       i - IS-IS, L1 - IS-IS level-1, L2 - IS-IS level-2, ia - IS-IS inter area',
      '       * - candidate default, U - per-user static route, o - ODR',
      '       P - periodic downloaded static route',
      '',
      def ? `Gateway of last resort is ${def.nh != null ? n2ip(def.nh) : '0.0.0.0'} to network 0.0.0.0` : 'Gateway of last resort is not set',
      '',
    ];
    const sorted = rt.slice().sort((a, b) => (a.net !== b.net ? (a.net >>> 0) - (b.net >>> 0) : a.mask - b.mask));
    for (const x of sorted) {
      const via = x.nh != null ? `via ${n2ip(x.nh)}` : `is directly connected`;
      const tail = x.code === 'C' || x.code === 'L' ? `is directly connected, ${x.n}` : x.code[0] === 'S' ? (x.nh != null ? `[${x.ad}/0] via ${n2ip(x.nh)}` : `is directly connected, ${x.n}`) : `[${x.ad}/${x.metric}] via ${n2ip(x.nh)}, 00:00:12, ${x.n}`;
      o.push(pad(x.code, 9) + ipm(x.net, x.mask) + ' ' + tail);
    }
    return o.join('\n');
  }
  function showVersion(s) {
    const d = s.dev;
    const sw = d.kind === 'switch';
    return [
      `Cisco IOS Software, ${sw ? 'C2960 Software (C2960-LANBASEK9-M), Version 15.0(2)SE4' : 'C2900 Software (C2900-UNIVERSALK9-M), Version 15.1(4)M4'}, RELEASE SOFTWARE (fc1)`,
      'Technical Support: http://www.cisco.com/techsupport',
      'Copyright (c) 1986-2013 by Cisco Systems, Inc.',
      '',
      `${d.cfg.hostname} uptime is 12 minutes`,
      `System image file is "flash:${sw ? 'c2960-lanbasek9-mz.150-2.SE4.bin' : 'c2900-universalk9-mz.SPA.151-4.M4.bin'}"`,
      '',
      `cisco ${sw ? 'WS-C2960-24TT-L' : MODELS[d.model].label.replace('Cisco ', 'CISCO')} (${sw ? 'PowerPC405' : 'revision 1.0'}) processor with ${sw ? '65536K' : '491520K/32768K'} bytes of memory.`,
      `${Object.keys(d.cfg.ifs).filter((n) => /^Gig/.test(n)).length} Gigabit Ethernet interfaces`,
      sw ? '24 FastEthernet interfaces' : `${Object.keys(d.cfg.ifs).filter((n) => /^Serial/.test(n)).length} Low-speed serial(sync/async) network interface(s)`,
      '',
      'Configuration register is 0x2102',
    ].join('\n');
  }
  function showControllers(s, n) {
    const d = s.dev;
    if (!/^Serial/.test(n)) return `Interface ${n}\nHardware is ${/^Gig/.test(n) ? 'CN Gigabit Ethernet' : 'Lance'}`;
    const l = s.net.linkAt(d.id, n);
    const f = d.cfg.ifs[n];
    let line;
    if (!l) line = 'No serial cable attached';
    else if (s.net.isDce(d, n)) line = 'DCE V.35, ' + (f.clock ? 'clock rate ' + f.clock : 'clock rate not set');
    else line = 'DTE V.35 TX and RX clocks detected';
    return `Interface ${n}\nHardware is PowerQUICC MPC860\n${line}`;
  }
  function showProtocols(s) {
    const c = s.dev.cfg;
    const o = [];
    if (c.ospf) {
      o.push(`Routing Protocol is "ospf ${c.ospf.pid}"`, '  Outgoing update filter list for all interfaces is not set', `  Router ID ${n2ip(s.net.routerId(s.dev))}`, '  Number of areas in this router is 1. 1 normal 0 stub 0 nssa', '  Routing for Networks:');
      for (const x of c.ospf.nets) o.push(`    ${n2ip(x.addr)} ${n2ip(x.wild)} area ${x.area}`);
      if (c.ospf.passive.length) o.push('  Passive Interface(s):', ...c.ospf.passive.map((p) => '    ' + p));
      o.push('  Distance: (default is 110)', '');
    }
    if (c.rip) {
      o.push('Routing Protocol is "rip"', '  Sending updates every 30 seconds', `  Default version control: send version ${c.rip.version || 1}, receive ${c.rip.version === 2 ? '2' : 'any version'}`, `  Automatic network summarization is ${c.rip.auto ? 'in effect' : 'not in effect'}`, '  Routing for Networks:');
      for (const n of c.rip.nets) o.push('\t' + n2ip(n));
      if (c.rip.passive.length) o.push('  Passive Interface(s):', ...c.rip.passive.map((p) => '    ' + p));
      o.push('  Distance: (default is 120)');
    }
    return o.join('\n');
  }
  function showOspfNb(s) {
    if (!s.dev.cfg.ospf) return '';
    const o = ['', 'Neighbor ID     Pri   State           Dead Time   Address         Interface'];
    for (const nb of s.net.neighbors(s.dev, 'ospf')) {
      const ser = /^Serial/.test(nb.n);
      o.push(pad(n2ip(s.net.routerId(nb.d)), 16) + pad('1', 6) + pad(ser ? 'FULL/  -' : 'FULL/DR', 16) + pad('00:00:33', 12) + pad(n2ip(nb.ip), 16) + nb.n);
    }
    return o.join('\n');
  }
  function showBinding(s) {
    const b = s.dev.binds || {};
    const o = ['IP address       Client-ID/              Lease expiration        Type', '                 Hardware address'];
    for (const ip of Object.keys(b).sort((x, y) => x - y)) o.push(pad(n2ip(+ip), 17) + pad(b[ip].mac, 24) + pad('--', 24) + 'Automatic');
    return o.join('\n');
  }
  function showPool(s) {
    const o = [];
    const b = s.dev.binds || {};
    for (const name of Object.keys(s.dev.cfg.pools)) {
      const p = s.dev.cfg.pools[name];
      const total = p.net != null ? 2 ** (32 - prefixOf(p.mask)) - 2 : 0;
      const leased = Object.values(b).filter((x) => x.pool === name).length;
      o.push(`Pool ${name} :`, ' Utilization mark (high/low)    : 100 / 0', ` Total addresses                : ${total}`, ` Leased addresses               : ${leased}`, ' Pending event                  : none');
      if (p.net != null) o.push(` Network                        : ${ipm(p.net, p.mask)}`);
      o.push(` Default router                 : ${p.router != null ? n2ip(p.router) : '(none)'}`, '');
    }
    return o.join('\n');
  }
  function showSsh(s) {
    const c = s.dev.cfg;
    if (!c.rsa) return 'SSH Disabled - version 1.99\n%Please create RSA keys to enable SSH (and of atleast 768 bits for SSH v2).';
    return `SSH Enabled - version ${c.sshVer === 2 ? '2.0' : '1.99'}\nAuthentication timeout: 120 secs; Authentication retries: 3`;
  }
  function showCdp(s) {
    const d = s.dev;
    const o = ['Capability Codes: R - Router, T - Trans Bridge, B - Source Route Bridge', '                  S - Switch, H - Host, I - IGMP, r - Repeater, P - Phone', 'Device ID    Local Intrfce   Holdtme    Capability   Platform    Port ID'];
    for (const n of ifOrder(d.hwPorts())) {
      if (s.net.phys(d, n) !== 'up') continue;
      const l = s.net.linkAt(d.id, n);
      const o2 = s.net.other(l, d.id, n);
      const od = s.net.devs[o2.d];
      if (od.kind === 'pc') continue;
      o.push(pad(od.cfg.hostname, 13) + pad(midIf(n), 16) + pad('  155', 11) + pad(od.kind === 'router' ? '    R' : '    S', 13) + pad(od.model === '2960' ? 'C2960' : 'C' + od.model, 12) + midIf(o2.p));
    }
    return o.join('\n');
  }
  function vlanPorts(s, v) {
    const d = s.dev;
    return ifOrder(d.hwPorts()).filter((n) => d.cfg.ifs[n].mode !== 'trunk' && d.cfg.ifs[n].vlan === v).map(tight);
  }
  function showVlan(s) {
    const c = s.dev.cfg;
    const o = ['', 'VLAN Name                             Status    Ports', '---- -------------------------------- --------- -------------------------------'];
    const ids = Object.keys(c.vlans).map(Number).sort((a, b) => a - b);
    for (const v of ids) {
      const ports = vlanPorts(s, v);
      const lines = [];
      for (let i = 0; i < ports.length; i += 4) lines.push(ports.slice(i, i + 4).join(', '));
      o.push(pad(v, 5) + pad(c.vlans[v], 33) + pad('active', 10) + (lines[0] || ''));
      for (const l of lines.slice(1)) o.push(' '.repeat(48) + l);
    }
    for (const [v, n] of [[1002, 'fddi-default'], [1003, 'token-ring-default'], [1004, 'fddinet-default'], [1005, 'trnet-default']]) o.push(pad(v, 5) + pad(n, 33) + 'active    ');
    return o.join('\n');
  }
  function showTrunk(s) {
    const d = s.dev;
    const tr = ifOrder(d.hwPorts()).filter((n) => d.cfg.ifs[n].mode === 'trunk' && s.net.phys(d, n) === 'up');
    if (!tr.length) return '';
    const vl = Object.keys(d.cfg.vlans).map(Number).sort((a, b) => a - b).join(',');
    const o = ['Port        Mode         Encapsulation  Status        Native vlan'];
    for (const n of tr) o.push(pad(tight(n), 12) + pad('on', 13) + pad('802.1q', 15) + pad('trunking', 14) + d.cfg.ifs[n].native);
    o.push('', 'Port        Vlans allowed on trunk');
    for (const n of tr) o.push(pad(tight(n), 12) + (d.cfg.ifs[n].allowed || '1-1005'));
    o.push('', 'Port        Vlans allowed and active in management domain');
    for (const n of tr) o.push(pad(tight(n), 12) + vl);
    return o.join('\n');
  }
  function showStatus(s) {
    const d = s.dev;
    const o = ['Port      Name               Status       Vlan       Duplex  Speed Type'];
    for (const n of ifOrder(d.hwPorts())) {
      const f = d.cfg.ifs[n];
      const st = s.net.phys(d, n);
      o.push(pad(tight(n), 10) + pad(f.desc.slice(0, 18), 19) + pad(st === 'up' ? 'connected' : st === 'admin' ? 'disabled' : 'notconnect', 13) + pad(f.mode === 'trunk' ? 'trunk' : f.vlan, 11) + pad('auto', 8) + pad('auto', 6) + (/^Gig/.test(n) ? '10/100/1000BaseTX' : '10/100BaseTX'));
    }
    return o.join('\n');
  }
  function showMac(s) {
    const d = s.dev;
    const o = ['          Mac Address Table', '-------------------------------------------', '', 'Vlan    Mac Address       Type        Ports', '----    -----------       --------    -----'];
    for (const n of ifOrder(d.hwPorts())) {
      if (s.net.phys(d, n) !== 'up') continue;
      const f = d.cfg.ifs[n];
      const l = s.net.linkAt(d.id, n);
      const e = s.net.other(l, d.id, n);
      const od = s.net.devs[e.d];
      if (od.kind === 'switch') continue;
      const mac = od.kind === 'pc' ? od.mac : od.macOf(e.p);
      o.push(pad('   ' + (f.mode === 'trunk' ? f.native : f.vlan), 8) + pad(mac.toLowerCase(), 18) + pad('DYNAMIC', 12) + tight(n));
    }
    return o.join('\n');
  }

  /* ================= show running-config ================= */
  function runText(d, c, net, startup) {
    const o = [];
    const pw = (p) => (c.spe ? '7 ' + type7(p) : p);
    o.push('Building configuration...', '', 'Current configuration : 1024 bytes', '!', `version ${d.kind === 'switch' ? '15.0' : '15.1'}`, 'no service timestamps log datetime msec', 'no service timestamps debug datetime msec');
    o.push(c.spe ? 'service password-encryption' : 'no service password-encryption', '!', `hostname ${c.hostname}`, '!');
    if (c.enableSecret) o.push(`enable secret 5 ${md5ish(c.enableSecret)}`);
    if (c.enablePass) o.push(`enable password ${pw(c.enablePass)}`);
    if (c.enableSecret || c.enablePass) o.push('!');
    if (c.minLen) o.push(`security passwords min-length ${c.minLen}`, '!');
    for (const [a, b] of c.dhcpEx) o.push(`ip dhcp excluded-address ${n2ip(a)}` + (b !== a ? ' ' + n2ip(b) : ''));
    if (c.dhcpEx.length) o.push('!');
    for (const name of Object.keys(c.pools)) {
      const p = c.pools[name];
      o.push(`ip dhcp pool ${name}`);
      if (p.net != null) o.push(` network ${n2ip(p.net)} ${n2ip(p.mask)}`);
      if (p.router != null) o.push(` default-router ${n2ip(p.router)}`);
      if (p.dns != null) o.push(` dns-server ${n2ip(p.dns)}`);
      if (p.domain) o.push(` domain-name ${p.domain}`);
      o.push('!');
    }
    if (!c.lookup) o.push('no ip domain-lookup');
    if (c.domain) o.push(`ip domain-name ${c.domain}`);
    o.push('!');
    for (const u of Object.keys(c.users)) {
      const x = c.users[u];
      o.push(`username ${u}` + (x.priv != null ? ` privilege ${x.priv}` : '') + (x.secret != null ? ` secret 5 ${md5ish(x.secret)}` : ` password ${pw(x.pass)}`));
    }
    if (Object.keys(c.users).length) o.push('!');
    if (c.sshVer) o.push(`ip ssh version ${c.sshVer}`, '!');
    if (d.kind === 'switch') o.push('spanning-tree mode pvst', '!');
    for (const n of ifOrder(Object.keys(c.ifs))) {
      const f = c.ifs[n];
      o.push(`interface ${n}`);
      if (f.desc) o.push(` description ${f.desc}`);
      if (d.kind === 'switch' && !/^Vlan/.test(n)) {
        if (f.vlan !== 1 && f.mode !== 'trunk') o.push(` switchport access vlan ${f.vlan}`);
        if (f.native !== 1) o.push(` switchport trunk native vlan ${f.native}`);
        if (f.allowed) o.push(` switchport trunk allowed vlan ${f.allowed}`);
        o.push(f.mode === 'trunk' ? ' switchport mode trunk' : f.vlan !== 1 || f.portfast ? ' switchport mode access' : '');
        if (f.portfast) o.push(' spanning-tree portfast');
      }
      if (f.encap) o.push(` encapsulation dot1Q ${f.encap}`);
      if (f.ip != null) o.push(` ip address ${n2ip(f.ip)} ${n2ip(f.mask)}`);
      else if (d.kind === 'router' || /^Vlan/.test(n)) o.push(' no ip address');
      for (const h of f.helpers) o.push(` ip helper-address ${n2ip(h)}`);
      if (f.cost) o.push(` ip ospf cost ${f.cost}`);
      if (d.kind === 'router' && !n.includes('.') && !/^Serial/.test(n)) o.push(` duplex ${f.duplex || 'auto'}`, ` speed ${f.speed || 'auto'}`);
      if (/^Serial/.test(n) && f.clock) o.push(` clock rate ${f.clock}`);
      if (f.shut) o.push(' shutdown');
      o.push('!');
    }
    if (c.ospf) {
      o.push(`router ospf ${c.ospf.pid}`);
      if (c.ospf.rid != null) o.push(` router-id ${n2ip(c.ospf.rid)}`);
      o.push(' log-adjacency-changes');
      for (const p of c.ospf.passive) o.push(` passive-interface ${p}`);
      for (const x of c.ospf.nets) o.push(` network ${n2ip(x.addr)} ${n2ip(x.wild)} area ${x.area}`);
      o.push('!');
    }
    if (c.rip) {
      o.push('router rip');
      if (c.rip.version) o.push(` version ${c.rip.version}`);
      for (const p of c.rip.passive) o.push(` passive-interface ${p}`);
      for (const n of c.rip.nets) o.push(` network ${n2ip(n)}`);
      if (!c.rip.auto) o.push(' no auto-summary');
      o.push('!');
    }
    if (d.kind === 'router') o.push('ip classless');
    for (const r of c.routes) o.push(`ip route ${n2ip(r.net)} ${n2ip(r.mask)} ${r.nh != null ? n2ip(r.nh) : r.ifn}`);
    if (d.kind === 'switch' && c.dgw != null) o.push(`ip default-gateway ${n2ip(c.dgw)}`);
    o.push('!');
    if (c.banner) o.push(`banner motd ^C${c.banner}^C`, '!');
    o.push('!', 'line con 0');
    const ln = (l) => {
      if (l.timeout) o.push(` exec-timeout ${l.timeout[0]} ${l.timeout[1]}`);
      if (l.pass) o.push(` password ${pw(l.pass)}`);
      if (l.sync) o.push(' logging synchronous');
      if (l.local) o.push(' login local');
      else if (l.login) o.push(' login');
      if (l.transport) o.push(` transport input ${l.transport}`);
    };
    ln(c.con);
    o.push('!');
    if (d.kind === 'switch') {
      o.push('line vty 0 4');
      ln(c.vty);
      o.push('line vty 5 15');
      ln(c.vty);
    } else {
      o.push('line aux 0', '!', 'line vty 0 4');
      ln(c.vty);
    }
    o.push('!', '!', '!', 'end');
    return o.filter((x, i, a) => x !== '' || i < 3).join('\n');
  }

  /* ================= avisos del sistema cuando algo cambia ================= */
  function logs(net, before, after) {
    const out = {};
    const add = (id, t) => (out[id] = out[id] || []).push(t);
    for (const k of Object.keys(after)) {
      const [id, n, kind] = k.split('|');
      if (kind) continue;
      const a = after[k];
      const b = before[k] || ['down', 'down'];
      if (a[0] !== b[0]) {
        if (n.includes('.') || /^Vlan/.test(n)) {
          if (a[0] !== b[0] && /^Vlan/.test(n)) add(id, `%LINK-5-CHANGED: Interface ${n}, changed state to ${a[0] === 'admin' ? 'administratively down' : a[0]}`);
        } else add(id, `%LINK-5-CHANGED: Interface ${n}, changed state to ${a[0] === 'admin' ? 'administratively down' : a[0]}`);
      }
      if (a[1] !== b[1]) add(id, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${n}, changed state to ${a[1]}`);
    }
    for (const k of Object.keys(after)) {
      if (!k.includes('|ospf|') || before[k]) continue;
      const nb = after[k];
      const id = k.split('|')[0];
      add(id, `%OSPF-5-ADJCHG: Process ${net.devs[id].cfg.ospf.pid}, Nbr ${n2ip(net.routerId(nb.d))} on ${nb.n} from LOADING to FULL, Loading Done`);
    }
    for (const k of Object.keys(before)) {
      if (!k.includes('|ospf|') || after[k]) continue;
      const nb = before[k];
      const id = k.split('|')[0];
      if (net.devs[id].cfg.ospf) add(id, `%OSPF-5-ADJCHG: Process ${net.devs[id].cfg.ospf.pid}, Nbr ${n2ip(net.routerId(nb.d))} on ${nb.n} from FULL to DOWN, Neighbor Down: Interface down or detached`);
    }
    return out;
  }

  /* ================= la red sabe reiniciar un equipo y recordar ARP ================= */
  const NP = G.NET.Network.prototype;
  NP.reboot = function (d) {
    d.cfg = d.startup ? clone(d.startup) : factory(d);
    for (const p of d.hwPorts()) if (!d.cfg.ifs[p]) d.cfg.ifs[p] = mkIf(p, d.kind);
    d.binds = {};
    this.touch();
  };
  NP.firstTime = function (d, ip, p) {
    const k = d.id + '>' + ip;
    if (this.arp.has(k)) return false;
    this.arp.add(k);
    return (p.hops || []).length > 2;
  };

  /* ================= chuleta ================= */
  const DOCS = [
    ['Modos', 'enable', 'Del modo usuario (>) al privilegiado (#).', 'enable'],
    ['Modos', 'configure terminal', 'Entrar en configuración global. Abreviado: conf t.', 'conf t'],
    ['Modos', 'exit', 'Subir un nivel. Desde > cierra la sesión.', 'exit'],
    ['Modos', 'end', 'Volver directamente al modo # desde cualquier submodo.', 'end'],
    ['Modos', 'do', 'Lanzar una orden de modo # sin salir de configuración.', 'do show ip interface brief'],
    ['Modos', '?', 'Ayuda: qué puedes escribir ahora. También después de una palabra.', 'show ?'],
    ['Básico', 'hostname', 'Nombre del equipo (cambia el prompt).', 'hostname R1'],
    ['Básico', 'no ip domain-lookup', 'Que una palabra mal escrita no se quede buscando un DNS.', 'no ip domain-lookup'],
    ['Básico', 'banner motd', 'Mensaje que sale al conectarse. Empieza y acaba con el mismo carácter.', 'banner motd #Solo personal autorizado#'],
    ['Básico', 'copy running-config startup-config', 'Guardar lo configurado. Si no, se pierde al reiniciar.', 'copy running-config startup-config'],
    ['Básico', 'write', 'Lo mismo que copy run start, más corto.', 'write'],
    ['Seguridad', 'enable secret', 'Contraseña para pasar a # (cifrada).', 'enable secret class'],
    ['Seguridad', 'line console 0', 'La línea del cable de consola.', 'line console 0'],
    ['Seguridad', 'password + login', 'Contraseña de una línea y obligación de pedirla.', 'password cisco'],
    ['Seguridad', 'line vty 0 4', 'Las líneas remotas (Telnet/SSH). En el 2960: 0 15.', 'line vty 0 4'],
    ['Seguridad', 'service password-encryption', 'Cifra las contraseñas que se ven en show run.', 'service password-encryption'],
    ['Seguridad', 'ip domain-name', 'Dominio (hace falta para SSH).', 'ip domain-name aula.local'],
    ['Seguridad', 'username … secret …', 'Usuario local (para login local y SSH).', 'username admin secret cisco'],
    ['Seguridad', 'crypto key generate rsa', 'Claves para SSH. Pide el tamaño: 1024.', 'crypto key generate rsa general-keys modulus 1024'],
    ['Seguridad', 'ip ssh version 2', 'Usar la versión segura de SSH.', 'ip ssh version 2'],
    ['Seguridad', 'transport input ssh', 'En las vty: entrar solo por SSH.', 'transport input ssh'],
    ['Seguridad', 'login local', 'En una línea: pedir usuario y contraseña locales.', 'login local'],
    ['Interfaces', 'interface', 'Entrar a configurar un puerto. g0/0, fa0/1, s0/0/0…', 'interface g0/0'],
    ['Interfaces', 'ip address', 'IP y máscara de la interfaz.', 'ip address 192.168.1.1 255.255.255.0'],
    ['Interfaces', 'no shutdown', 'Encender el puerto. En los routers vienen apagados.', 'no shutdown'],
    ['Interfaces', 'description', 'Apuntar para qué es el puerto.', 'description Hacia la LAN'],
    ['Interfaces', 'clock rate', 'Reloj del cable serie, solo en el extremo DCE.', 'clock rate 64000'],
    ['Interfaces', 'interface range', 'Varios puertos de switch a la vez.', 'interface range fa0/1 - 10'],
    ['Switch y VLAN', 'interface vlan 1', 'Interfaz para dar IP de gestión al switch.', 'interface vlan 1'],
    ['Switch y VLAN', 'ip default-gateway', 'Puerta de enlace del switch.', 'ip default-gateway 192.168.1.1'],
    ['Switch y VLAN', 'vlan + name', 'Crear una VLAN y ponerle nombre.', 'vlan 10'],
    ['Switch y VLAN', 'switchport mode access', 'Puerto para un PC.', 'switchport mode access'],
    ['Switch y VLAN', 'switchport access vlan', 'Meter el puerto en una VLAN.', 'switchport access vlan 10'],
    ['Switch y VLAN', 'switchport mode trunk', 'Puerto que lleva todas las VLAN (hacia otro switch o router).', 'switchport mode trunk'],
    ['Switch y VLAN', 'encapsulation dot1Q', 'En una subinterfaz del router: a qué VLAN atiende.', 'encapsulation dot1Q 10'],
    ['Switch y VLAN', 'spanning-tree portfast', 'Puerto de PC: pasa a verde al instante.', 'spanning-tree portfast'],
    ['Enrutamiento', 'ip route', 'Ruta estática: red, máscara y siguiente salto.', 'ip route 192.168.2.0 255.255.255.0 10.0.0.2'],
    ['Enrutamiento', 'ip route 0.0.0.0 0.0.0.0', 'Ruta por defecto: todo lo que no conozcas, por aquí.', 'ip route 0.0.0.0 0.0.0.0 10.0.0.1'],
    ['Enrutamiento', 'router ospf', 'Activar OSPF.', 'router ospf 1'],
    ['Enrutamiento', 'network … area 0', 'Redes que entran en OSPF (con wildcard).', 'network 192.168.1.0 0.0.0.255 area 0'],
    ['Enrutamiento', 'router rip / version 2', 'Activar RIP versión 2.', 'router rip'],
    ['Enrutamiento', 'passive-interface', 'No enviar el protocolo hacia una LAN.', 'passive-interface g0/0'],
    ['DHCP', 'ip dhcp excluded-address', 'Direcciones que no se reparten (router, servidores…).', 'ip dhcp excluded-address 192.168.1.1 192.168.1.10'],
    ['DHCP', 'ip dhcp pool', 'Crear el pool.', 'ip dhcp pool LAN1'],
    ['DHCP', 'network / default-router / dns-server', 'Dentro del pool: red, puerta de enlace y DNS.', 'network 192.168.1.0 255.255.255.0'],
    ['DHCP', 'ip helper-address', 'En la interfaz LAN: reenviar el DHCP a otro router.', 'ip helper-address 10.0.0.1'],
    ['Comprobar', 'show running-config', 'Toda la configuración actual. Añade | include texto para filtrar.', 'show running-config'],
    ['Comprobar', 'show ip interface brief', 'IP y estado de cada interfaz (¿up/up?).', 'show ip interface brief'],
    ['Comprobar', 'show ip route', 'Tabla de rutas.', 'show ip route'],
    ['Comprobar', 'show vlan brief', 'VLAN y sus puertos.', 'show vlan brief'],
    ['Comprobar', 'show interfaces trunk', 'Qué puertos son troncales.', 'show interfaces trunk'],
    ['Comprobar', 'show controllers', 'En un serie: ¿soy DCE o DTE?', 'show controllers s0/0/0'],
    ['Comprobar', 'show cdp neighbors', 'Qué equipos Cisco tengo enchufados.', 'show cdp neighbors'],
    ['Comprobar', 'show ip dhcp binding', 'IPs que ha repartido el DHCP.', 'show ip dhcp binding'],
    ['Comprobar', 'show ip ospf neighbor', 'Vecinos OSPF.', 'show ip ospf neighbor'],
    ['Comprobar', 'ping', 'Probar si llega a una IP.', 'ping 192.168.1.1'],
    ['PC', 'ipconfig', 'Ver la IP del PC.', 'ipconfig'],
    ['PC', 'ipconfig IP MÁSCARA PUERTA', 'Poner IP fija al PC.', 'ipconfig 192.168.1.10 255.255.255.0 192.168.1.1'],
    ['PC', 'ipconfig /renew', 'Pedir IP por DHCP.', 'ipconfig /renew'],
    ['PC', 'ping', 'Probar conexión.', 'ping 192.168.1.1'],
    ['PC', 'tracert', 'Ver por qué routers pasa.', 'tracert 192.168.2.10'],
    ['PC', 'ssh -l', 'Conectarse a un router por SSH.', 'ssh -l admin 192.168.1.1'],
    ['PC', 'telnet', 'Conectarse por Telnet.', 'telnet 192.168.1.1'],
  ].map(([cat, cmd, desc, ex]) => ({ cat, cmd, desc, ex }));

  G.IOS = { IosSession, PcSession, runText, logs, DOCS, HELP, parse, C };
})(typeof window !== 'undefined' ? window : globalThis);
