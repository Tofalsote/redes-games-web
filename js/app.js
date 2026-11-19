/* Interfaz: misiones, juegos, consolas de cada equipo, topología en vivo, cableado, módulos, puntos y logros. */
(function () {
  'use strict';

  const { IosSession, PcSession, logs, DOCS } = window.IOS;
  const { CABLES, MODULES, IP, shortIf, midIf } = window.NET;
  const { n2ip, prefixOf } = IP;
  const SETS = window.GAMES.sets;
  const setOf = (l) => SETS[l.glevel || 1] || SETS[1];
  const ALL_FLAGS = Object.keys(SETS).reduce((a, k) => a.concat(SETS[k].flags), []);
  const bestKey = (l) => 'rg.best' + (l.glevel || 1);
  const LESSONS = window.LESSONS;
  const MISSIONS = LESSONS.filter((l) => !l.mode);
  const LEVELS = [
    { n: 1, name: 'Nivel 1 · Primeros pasos', list: MISSIONS.filter((l) => !l.level) },
    { n: 2, name: 'Nivel 2 · Conectar redes', list: MISSIONS.filter((l) => l.level === 2) },
    { n: 3, name: 'Nivel 3 · Examen', list: MISSIONS.filter((l) => l.level === 3) },
  ].filter((lv) => lv.list.length);
  const levelOf = (l) => LEVELS.find((lv) => lv.list.includes(l)) || LEVELS[0];
  for (const lv of LEVELS) lv.games = LESSONS.filter((l) => (l.mode === 'arcade' || l.mode === 'ctf') && (l.glevel || 1) === lv.n);
  const gotFlags = (l) => setOf(l).flags.filter((f) => flags.has(f.id)).length;

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v === null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (e) {}
    },
  };

  /* banderas únicas por navegador */
  function randomDigits(n) {
    let out = '';
    try {
      const a = new Uint32Array(n);
      crypto.getRandomValues(a);
      for (const v of a) out += v % 10;
    } catch (e) {
      for (let i = 0; i < n; i++) out += Math.floor(Math.random() * 10);
    }
    return out;
  }
  function assignFlags(renew) {
    const saved = store.get('rg.flagvals', {});
    const vals = saved && typeof saved === 'object' ? saved : {};
    for (const f of ALL_FLAGS) {
      if (!/^\d{12}$/.test(vals[f.id] || '') || (renew && renew.includes(f))) vals[f.id] = randomDigits(12);
      f.flag = 'FLAG{' + vals[f.id] + '}';
    }
    store.set('rg.flagvals', vals);
  }

  const el = {
    sidebar: $('#sidebar'),
    lesson: $('#lesson'),
    panel: $('#panel'),
    buddy: $('#buddy'),
    say: $('#say'),
    out: $('#termOut'),
    body: $('#termBody'),
    input: $('#termIn'),
    prompt: $('#prompt'),
    title: $('#termTitle'),
    tabs: $('#devTabs'),
    topo: $('#topo'),
    phys: $('#phys'),
    info: $('#topoInfo'),
    pick: $('#cablePick'),
    toasts: $('#toasts'),
  };

  const RANKS = [
    [0, 'Novato'],
    [100, 'Becario'],
    [250, 'Técnico'],
    [450, 'Cablista'],
    [700, 'Administrador'],
    [1000, 'CCNA en prácticas'],
    [1400, 'Ingeniero de red'],
    [1900, 'Arquitecto'],
    [2500, 'Leyenda del rack'],
  ];
  const BADGES = [
    { id: 'first', icon: '👋', name: 'Hola, router', how: 'Escribe tu primera orden.' },
    { id: 'priv', icon: '🔓', name: 'Modo dios', how: 'Entra en el modo privilegiado (#).' },
    { id: 'up', icon: '🟢', name: 'Luz verde', how: 'Enciende una interfaz y que quede up/up.' },
    { id: 'ping', icon: '🏓', name: 'Ping-pong', how: 'Haz un ping que llegue entre dos redes distintas.' },
    { id: 'help', icon: '❓', name: 'Preguntón', how: 'Usa la ayuda ? de IOS.' },
    { id: 'lookup', icon: '🐌', name: 'Traduciendo…', how: 'Escribe mal una orden y descubre por qué se pone no ip domain-lookup.' },
    { id: 'save', icon: '💾', name: 'Precavido', how: 'Guarda la configuración en la NVRAM.' },
    { id: 'nohint', icon: '🧠', name: 'De memoria', how: 'Completa una misión sin pedir pistas.' },
    { id: 'cable', icon: '🔌', name: 'Manitas', how: 'Pon el cable correcto a la primera.' },
    { id: 'remote', icon: '🛰️', name: 'A distancia', how: 'Entra en un equipo por Telnet o SSH.' },
    { id: 'speed', icon: '🚀', name: 'Dedos rápidos', how: 'Acierta 8 retos en un contrarreloj.' },
    { id: 'ctf', icon: '🚩', name: 'Cazabanderas', how: 'Captura las banderas de un nivel.' },
    { id: 'reto', icon: '📝', name: 'Matrícula', how: 'Saca un 10 en un reto del lienzo libre.' },
    { id: 'ctfall', icon: '🏴‍☠️', name: 'Cazador total', how: 'Captura las banderas de todos los niveles.' },
    { id: 'all', icon: '👑', name: 'Nivel 1 superado', how: 'Completa todas las misiones del nivel 1.' },
    { id: 'all2', icon: '🎓', name: 'Nivel 2 superado', how: 'Completa todas las misiones del nivel 2.' },
    { id: 'all3', icon: '💎', name: 'Listo para el examen', how: 'Completa todas las misiones del nivel 3.' },
  ];
  const CHEERS = ['¡Eso es!', 'Perfecto.', 'Vas como un tiro.', '¡Bien visto!', 'Clavado.', 'Así se hace.', 'Ni el profe lo haría mejor.'];

  let net, terms, tab, lesson, stepIdx, hintShown, usedHint;
  let done = new Set(store.get('rg.done', []));
  let badges = new Set(store.get('rg.badges', []));
  let flags = new Set(store.get('rg.flags', []));
  let xp = store.get('rg.xp', 0);
  let histPos = 0;
  let draft = '';
  let arc = null;
  let view = 'topo';
  const ctfHints = new Set();
  const closed = new Set(store.get('rg.closed', []));
  const foldOf = (l) => (l.mode === 'free' ? 'g' : l.mode ? String(l.glevel || 1) : String(levelOf(l).n));
  const foldHead = (key, name, count) =>
    `<h2><button type="button" class="fold" data-fold="${key}" aria-expanded="${!closed.has(key)}"><i aria-hidden="true">▾</i>${name}` +
    `${count ? ` <span>${count}</span>` : ''}</button></h2><ol class="${closed.has(key) ? 'closed' : ''}">`;

  /* ---------- puntos, rangos y logros ---------- */
  function rankOf(v) {
    let i = 0;
    while (i + 1 < RANKS.length && v >= RANKS[i + 1][0]) i++;
    return i;
  }
  function renderHud() {
    const i = rankOf(xp);
    const next = RANKS[i + 1];
    $('#hudLevel').textContent = i + 1;
    $('#hudRank').textContent = RANKS[i][1];
    $('#hudXp').textContent = next ? `${xp} / ${next[0]} XP` : `${xp} XP`;
    $('#hudFill').style.width = (next ? ((xp - RANKS[i][0]) / (next[0] - RANKS[i][0])) * 100 : 100) + '%';
    $('#badgeCount').textContent = `${badges.size}/${BADGES.length}`;
  }
  function addXp(n) {
    if (!n) return;
    const before = rankOf(xp);
    xp += n;
    store.set('rg.xp', xp);
    renderHud();
    const hud = $('#hud');
    hud.classList.remove('bump');
    void hud.offsetWidth;
    hud.classList.add('bump');
    if (rankOf(xp) > before) {
      toast('⬆️', 'Subes de rango', `Ahora eres ${RANKS[rankOf(xp)][1]}`);
      confetti(70);
    }
  }
  function award(id) {
    if (badges.has(id)) return;
    const b = BADGES.find((x) => x.id === id);
    if (!b) return;
    badges.add(id);
    store.set('rg.badges', [...badges]);
    toast(b.icon, 'Logro desbloqueado', b.name);
    addXp(20);
  }
  function toast(icon, title, text) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span>${icon}</span><div><b>${esc(title)}</b><small>${esc(text)}</small></div>`;
    el.toasts.appendChild(t);
    setTimeout(() => t.classList.add('out'), 3600);
    setTimeout(() => t.remove(), 4100);
  }
  function confetti(n) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#ff7a45', '#ffd166', '#4fd08a', '#74b8f7', '#e879f9'];
    const box = document.createElement('div');
    box.className = 'confetti';
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.style.cssText =
        `left:${Math.random() * 100}%;background:${colors[i % colors.length]};` +
        `animation-delay:${Math.random() * 0.35}s;animation-duration:${1.5 + Math.random()}s;` +
        `--r:${Math.random() * 720 - 360}deg;--x:${Math.random() * 240 - 120}px`;
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 3400);
  }
  function say(text, mood) {
    el.say.textContent = text;
    el.buddy.className = 'buddy';
    void el.buddy.offsetWidth;
    if (mood) el.buddy.classList.add(mood);
  }

  function errorTip(r, ses) {
    const err = r.err;
    if (/Invalid input/.test(err)) {
      if (ses.kind === 'ios' && ses.mode === 'user') return 'Esa orden no existe en el modo usuario (>). Muchas necesitan enable primero.';
      if (ses.kind === 'ios' && ses.mode === 'priv') return 'En modo # no se configura: entra antes con conf t. El ^ marca dónde está el fallo.';
      return 'El ^ marca dónde IOS deja de entenderte. Prueba ? para ver qué puede ir ahí.';
    }
    if (/Incomplete command/.test(err)) return 'Falta algo al final. Escribe lo mismo seguido de ? para ver qué.';
    if (/Ambiguous/.test(err)) return 'Abreviatura ambigua: hay varias órdenes que empiezan así. Escribe una letra más.';
    if (/Unknown command or computer name/.test(err)) return 'IOS ha creído que era el nombre de un equipo. Por eso se pone no ip domain-lookup.';
    if (/overlaps/.test(err)) return 'Esa red ya la tiene otra interfaz del mismo router. Cada interfaz va en una red distinta.';
    if (/Bad mask/.test(err)) return 'Esa IP es la dirección de red o de broadcast: no se puede usar en un equipo.';
    if (/Inconsistent address and mask/.test(err)) return 'La máscara no es válida, o la red no cuadra con la máscara.';
    if (/domain-name/.test(err)) return 'Para generar claves RSA hace falta un dominio: ip domain-name.';
    if (/hostname other than/.test(err)) return 'Primero cámbiale el nombre al equipo con hostname.';
    if (/No password set/.test(err)) return 'Por Telnet/SSH no se puede pasar a # si el equipo no tiene enable secret.';
    if (/Bad secrets|Bad passwords|Login invalid/.test(err)) return 'Contraseña incorrecta.';
    if (/refused/.test(err)) return 'El equipo no acepta esa forma de entrar (mira transport input, las claves o login local).';
    if (/timed out/.test(err)) return 'No hay camino hasta ese equipo. Revisa IPs, rutas y que los cables estén en verde.';
    if (/APIPA|DHCP request failed/.test(err)) return 'Nadie ha contestado al DHCP. ¿Hay pool para esa red? ¿Hace falta ip helper-address?';
    if (/Invalid Command/.test(err)) return 'Estás en un PC: aquí van ipconfig, ping, tracert, ssh… (escribe help).';
    if (/Invalid (IP|gateway|subnet)/.test(err)) return 'Revisa la IP, la máscara y la puerta de enlace (tiene que estar en la misma red).';
    if (/Unknown clock rate/.test(err)) return 'Ese valor de reloj no existe. El de siempre: 64000.';
    if (/Access VLAN does not exist/.test(err)) return 'Ojo: esa VLAN no existía y el switch la ha creado sola.';
    return 'Lee el mensaje con calma: IOS casi siempre dice lo que falla.';
  }

  /* ---------- consolas ---------- */
  function term(id) {
    return terms[id];
  }
  function ses() {
    const t = tab && terms[tab];
    return t ? t.stack[t.stack.length - 1] : null;
  }
  function mkTerm(id) {
    const d = net.devs[id];
    const box = document.createElement('div');
    box.className = 'tbuf';
    box.dataset.dev = id;
    el.out.appendChild(box);
    const s = d.kind === 'pc' ? new PcSession(net, d) : new IosSession(net, d);
    terms[id] = { stack: [s], box };
    if (d.kind === 'pc') printTo(id, 'Packet Tracer PC Command Line 1.0', 'dim');
    else if (!d.power) printTo(id, '(equipo apagado)', 'dim');
  }
  function printTo(id, text, cls) {
    if (text == null) return;
    const t = terms[id];
    if (!t) return;
    const d = document.createElement('div');
    d.className = 'ln' + (cls ? ' ' + cls : '');
    d.textContent = String(text).replace(/\n$/, '') || ' ';
    t.box.appendChild(d);
    while (t.box.childNodes.length > 600) t.box.removeChild(t.box.firstChild);
  }
  const print = (text, cls) => printTo(tab, text, cls);
  function promptText() {
    const s = ses();
    return s ? s.prompt() : '';
  }
  function echoLine(text, pw) {
    const d = document.createElement('div');
    d.className = 'ln';
    d.innerHTML = `<span class="pr">${esc(promptText())}</span>${esc(pw ? '' : text)}`;
    if (terms[tab]) terms[tab].box.appendChild(d);
  }
  function refreshPrompt() {
    const s = ses();
    if (!s) {
      el.prompt.innerHTML = '';
      el.input.placeholder = 'Añade un equipo al lienzo para abrir su consola';
      el.title.textContent = 'Sin equipos';
      return;
    }
    el.input.placeholder = '';
    el.prompt.innerHTML = `<span class="pr">${esc(s.prompt())}</span>`;
    el.input.type = s.pending && s.pending.pw ? 'password' : 'text';
    el.title.textContent = terms[tab].stack.length > 1 ? `${tab} → ${s.title()}` : s.title();
  }
  function scrollTerm() {
    el.body.scrollTop = el.body.scrollHeight;
  }
  function showTab(id) {
    tab = id || null;
    for (const b of el.out.children) b.hidden = b.dataset.dev !== id;
    histPos = ses() ? ses().history.length : 0;
    draft = '';
    renderTabs();
    refreshPrompt();
    renderTopo();
    renderPhys();
    scrollTerm();
  }
  function renderTabs() {
    el.tabs.innerHTML = net.order
      .map((d) => {
        const ic = d.kind === 'router' ? '◉' : d.kind === 'switch' ? '▦' : '▭';
        const name = d.id;
        return `<button type="button" role="tab" class="dt ${d.kind}${d.id === tab ? ' on' : ''}${d.power ? '' : ' off'}" data-dev="${d.id}" aria-selected="${d.id === tab}"><i>${ic}</i>${esc(name)}</button>`;
      })
      .join('');
  }
  el.tabs.addEventListener('click', (e) => {
    const b = e.target.closest('[data-dev]');
    if (b) goDevice(b.dataset.dev);
  });
  function goDevice(id) {
    if (!net.devs[id] || id === tab) return;
    showTab(id);
    if (!lesson.mode) checkStep('', { out: '', err: '', parts: [] });
    el.input.focus();
  }

  function submit(line) {
    const s0 = ses();
    if (!s0) return;
    if (!s0.dev.power) {
      echoLine(line);
      print(s0.kind === 'pc' ? '(PC apagado: enciéndelo con su botón en la pestaña Físico)' : '(equipo apagado: enciéndelo en la pestaña Físico)', 'dim');
      scrollTerm();
      return;
    }
    const pw = !!(s0.pending && s0.pending.pw);
    echoLine(line, pw);
    const before = net.snapshot();
    const r = s0.run(line);
    net.touch();
    const promptLen = promptTextLenBefore;
    for (const [kind, text] of r.parts) {
      if (kind === 'caret') printTo(tab, ' '.repeat(promptLen) + text, 'err');
      else printTo(tab, text, kind === 'err' ? 'err' : '');
    }
    if (r.clear) terms[tab].box.innerHTML = '';
    /* conexiones remotas */
    if (r.connect) {
      terms[tab].stack.push(r.connect);
      award('remote');
    }
    if (r.close && terms[tab].stack.length > 1) terms[tab].stack.pop();
    /* avisos del sistema (cables que se encienden o apagan, OSPF) en la consola de cada equipo */
    const after = net.snapshot();
    const msgs = logs(net, before, after);
    for (const id of Object.keys(msgs)) if (terms[id]) for (const m of msgs[id]) printTo(id, m, 'log');
    histPos = ses().history.length;
    draft = '';
    refreshPrompt();
    renderTabs();
    renderTopo();
    renderPhys();
    if (r.ping && !r.ping.quiet) animatePing(r.ping);
    let passed = false;
    if (lesson.mode === 'arcade') passed = arcCheck(line, r);
    else if (lesson.mode === 'ctf') passed = ctfCheck(r);
    else if (lesson.mode !== 'free') passed = checkStep(line, r);
    if (!passed && r.err) say(errorTip(r, s0), 'oops');
    else if (!passed && r.lookup && /domain server/.test(r.out)) say('IOS cree que es el nombre de un equipo y lo busca en un DNS. En un router real se queda así casi un minuto. Solución: no ip domain-lookup.', 'oops');
    globalBadges(line, r, s0);
    scrollTerm();
  }
  let promptTextLenBefore = 0;

  function globalBadges(line, r, s0) {
    if (line.trim()) award('first');
    const s = ses();
    if (s.kind === 'ios' && s.mode === 'priv') award('priv');
    if (r.help) award('help');
    if (r.lookup && /domain server/.test(r.out)) award('lookup');
    if (/Building configuration/.test(r.out)) award('save');
    if (r.ping && r.ping.ok && !r.ping.quiet && !r.ping.trace && (r.ping.hops || []).some((id) => net.devs[id].kind === 'router' && id !== r.ping.from && net.ownerOf(r.ping.to) !== net.devs[id])) award('ping');
  }
  let lastLogs = null;

  function setInput(v) {
    el.input.value = v;
    el.input.setSelectionRange(v.length, v.length);
  }
  function useCommand(cmd) {
    setInput(cmd);
    el.input.focus();
  }
  el.input.addEventListener('keydown', (e) => {
    const s = ses();
    if (!s) {
      if (e.key === 'Enter' || e.key === 'Tab') e.preventDefault();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = el.input.value;
      el.input.value = '';
      promptTextLenBefore = promptText().length;
      submit(v);
    } else if (e.key === '?' && s.kind === 'ios' && !s.pending) {
      /* como en IOS: la ayuda sale al pulsar ?, sin Enter */
      e.preventDefault();
      const v = el.input.value + '?';
      el.input.value = '';
      promptTextLenBefore = promptText().length;
      submit(v);
      setInput(v.slice(0, -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (s.pending) return;
      if (histPos === s.history.length) draft = el.input.value;
      if (histPos > 0) setInput(s.history[--histPos]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (s.pending) return;
      if (histPos < s.history.length) {
        histPos++;
        setInput(histPos === s.history.length ? draft : s.history[histPos]);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (s.pending) return;
      const c = s.complete(el.input.value);
      if (c.options.length) {
        echoLine(el.input.value);
        print(c.options.join('  '), 'dim');
        scrollTerm();
      }
      setInput(c.line);
    } else if (e.ctrlKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      terms[tab].box.innerHTML = '';
    } else if ((e.ctrlKey && e.key.toLowerCase() === 'z') || (e.ctrlKey && e.key.toLowerCase() === 'c' && el.input.selectionStart === el.input.selectionEnd)) {
      /* Ctrl+Z en IOS = end; Ctrl+C cancela la línea */
      e.preventDefault();
      if (e.key.toLowerCase() === 'z' && s.kind === 'ios' && !/^(user|priv)$/.test(s.mode)) {
        el.input.value = '';
        promptTextLenBefore = promptText().length;
        submit('end');
        return;
      }
      echoLine(el.input.value + '^C');
      el.input.value = '';
      scrollTerm();
    }
  });
  el.body.addEventListener('mouseup', () => {
    if (!String(window.getSelection())) el.input.focus();
  });
  $('#btnReset').addEventListener('click', () => startLesson(lesson.id));

  /* ---------- topología (al estilo de Packet Tracer) ---------- */
  const W = 640;
  const HGT = 330;
  const MODEL_TXT = { 2911: '2911', 1941: '1941', 2960: '2960-24TT', PC: 'PC-PT', SRV: 'Server-PT' };
  const tight = (n) => midIf(n).replace(' ', '');
  /* iconos dibujados a mano imitando los de Cisco: router = cilindro con flechas, switch = caja con flechas */
  function iconSvg(kind) {
    if (kind === 'router')
      return (
        '<path class="r-side" d="M-27 -5v11a27 9.5 0 0 0 54 0v-11"/>' +
        '<ellipse class="r-top" cx="0" cy="-5" rx="27" ry="9.5"/>' +
        '<path class="arw" d="M-22 -5h10m-3.5 -3 3.5 3 -3.5 3M22 -5h-10m3.5 -3 -3.5 3 3.5 3M0 -7v-5.5m-2.6 2.6 2.6 -2.6 2.6 2.6M0 -3v5.5m-2.6 -2.6 2.6 2.6 2.6 -2.6"/>'
      );
    if (kind === 'switch')
      return (
        '<path class="s-top" d="M-30 -5 -19 -14H31L20 -5Z"/>' +
        '<path class="s-side" d="M20 -5 31 -14V4L20 13Z"/>' +
        '<rect class="s-front" x="-30" y="-5" width="50" height="18"/>' +
        '<path class="arw" d="M-17 -11.2h26m-3 -2 3 2 -3 2M17 -7.8h-26m3 -2 -3 2 3 2"/>' +
        '<path class="s-ports" d="M-25 3h4M-18 3h4M-11 3h4M-4 3h4M3 3h4M10 3h4"/>'
      );
    return (
      '<rect class="pc-case" x="-17" y="-21" width="34" height="24" rx="2"/>' +
      '<rect class="pc-screen" x="-13.5" y="-17.5" width="27" height="17"/>' +
      '<path class="pc-case" d="M-5 3h10l3 5h-16Z"/>' +
      '<path class="pc-kb" d="M-17 11h34l-3 5h-28Z"/>'
    );
  }
  function devIcon(d) {
    const x = d.x;
    const y = d.y;
    const sel = d.id === tab;
    const host = d.kind === 'pc' || d.cfg.hostname === d.id ? '' : d.cfg.hostname;
    const tip = [`${d.id} — ${d.label} (${MODEL_TXT[d.model]})`];
    if (host) tip.push(`hostname: ${host}`);
    if (!d.power) tip.push('APAGADO');
    if (d.kind === 'pc') {
      const p = d.pc;
      tip.push(p.ip != null ? `IP ${n2ip(p.ip)}/${prefixOf(p.mask)} · puerta de enlace ${p.gw != null ? n2ip(p.gw) : 'sin poner'}${p.dhcp ? ' · DHCP' : ''}` : p.dhcp ? 'IP: esperando DHCP' : 'Sin IP');
    } else
      for (const x3 of net.l3(d)) tip.push(`${x3.n}: ${n2ip(x3.ip)}/${prefixOf(x3.mask)} (${x3.up ? 'up' : 'down'})`);
    tip.push('Pulsa para abrir su consola');
    let lab = '';
    if (d.kind === 'pc') {
      const p = d.pc;
      lab += `<text x="${x}" y="${y + 29}" class="dn">${esc(d.id)}<tspan class="dm" dx="5">${MODEL_TXT[d.model]}</tspan></text>`;
      if (p.ip != null) lab += `<text x="${x}" y="${y + 41}" class="dip">${n2ip(p.ip)}/${prefixOf(p.mask)}</text>`;
      else lab += `<text x="${x}" y="${y + 41}" class="dno">${p.dhcp ? 'esperando DHCP' : 'sin IP'}</text>`;
      if (p.ip != null && p.gw != null) lab += `<text x="${x}" y="${y + 52}" class="dgw">gw ${n2ip(p.gw)}</text>`;
    } else {
      /* como en Packet Tracer: modelo arriba y nombre debajo, en el lado del icono que no tenga cables */
      const lines = [['dm', MODEL_TXT[d.model]], ['dn', d.id]];
      if (host) lines.push(['dhost', 'hostname ' + host]);
      if (d.kind === 'switch') {
        const f = d.cfg.ifs.Vlan1;
        if (f && f.ip != null) lines.push(['dip', `Vlan1 ${n2ip(f.ip)}/${prefixOf(f.mask)}`]);
      }
      if (!d.power) lines.push(['doff', 'APAGADO']);
      const side = freeSide(d);
      const lh = 13;
      let lx = x;
      let ly = y - 8;
      let anchor = 'middle';
      if (side === 'l') (lx = x - 42), (anchor = 'end');
      else if (side === 'r') (lx = x + 42), (anchor = 'start');
      else if (side === 'u') ly = y - 26 - (lines.length - 1) * lh;
      else ly = y + 34;
      lines.forEach(([c, t], i) => (lab += `<text x="${lx}" y="${ly + i * lh}" class="${c}" text-anchor="${anchor}">${esc(t)}</text>`));
    }
    const box = d.kind === 'router' ? [-33, -20, 66, 40] : d.kind === 'switch' ? [-35, -19, 71, 37] : [-22, -25, 44, 45];
    return (
      `<g class="dev ${d.kind}${sel ? ' sel' : ''}${d.power ? '' : ' off'}" data-dev="${d.id}" tabindex="0" role="button" aria-label="${esc(tip.join('. '))}">` +
      `<title>${esc(tip.join('\n'))}</title>` +
      (sel ? `<rect class="selbox" x="${x + box[0]}" y="${y + box[1]}" width="${box[2]}" height="${box[3]}"/>` : '') +
      `<g class="ico" transform="translate(${x} ${y})">${iconSvg(d.kind)}</g>` +
      lab +
      '</g>'
    );
  }
  /* lado del icono sin cables: l (izquierda), r, u (arriba) o d (abajo) */
  function freeSide(d) {
    const occ = { l: 0, r: 0, u: 0, d: 0 };
    const others = [];
    for (const l of net.links) if (l.a.d === d.id || l.b.d === d.id) others.push(net.devs[l.a.d === d.id ? l.b.d : l.a.d]);
    for (const p of net.pending || []) if (p.a === d.id || p.b === d.id) others.push(net.devs[p.a === d.id ? p.b : p.a]);
    for (const o of others) {
      const a = (Math.atan2(o.y - d.y, o.x - d.x) * 180) / Math.PI;
      if (Math.abs(a) >= 115) occ.l++;
      if (Math.abs(a) <= 65) occ.r++;
      if (a < -25 && a > -155) occ.u++;
      if (a > 25 && a < 155) occ.d++;
    }
    return ['l', 'r', 'u', 'd'].find((k) => !occ[k]) || 'l';
  }
  /* punto a "dist" píxeles del equipo A en dirección a B, desplazado "side" en perpendicular */
  function along(A, B, dist, side) {
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    return [A.x + ux * dist - uy * (side || 0), A.y + uy * dist + ux * (side || 0), len];
  }
  function stateOf(d, n) {
    const s = net.status(d, n);
    return s[1] === 'up' ? 'up' : s[0] === 'up' ? 'half' : 'down';
  }
  const ST_TXT = { up: 'encendido y con protocolo (verde)', half: 'conectado pero sin protocolo (naranja)', down: 'apagado o sin conexión (rojo)' };
  function linkEnd(A, B, port, l) {
    const st = stateOf(A, port);
    const [lx, ly, len] = along(A, B, 31);
    const [tx, ty] = along(A, B, Math.max(38, Math.min(len * 0.32, 82)), 12);
    let txt = `<text x="${tx.toFixed(1)}" y="${(ty + 3).toFixed(1)}" class="pl">${esc(tight(port))}</text>`;
    const f = A.kind === 'router' ? A.cfg.ifs[port] : null;
    if (f && f.ip != null) txt += `<text x="${tx.toFixed(1)}" y="${(ty + 14).toFixed(1)}" class="pip">${n2ip(f.ip)}/${prefixOf(f.mask)}</text>`;
    else if (A.kind === 'router' && Object.keys(A.cfg.ifs).some((n) => n.startsWith(port + '.'))) txt += `<text x="${tx.toFixed(1)}" y="${(ty + 14).toFixed(1)}" class="pip">subinterfaces</text>`;
    else if (A.kind === 'switch' && A.cfg.ifs[port] && A.cfg.ifs[port].mode === 'trunk') txt += `<text x="${tx.toFixed(1)}" y="${(ty + 14).toFixed(1)}" class="pip">trunk</text>`;
    else if (A.kind === 'switch' && A.cfg.ifs[port] && A.cfg.ifs[port].vlan !== 1) txt += `<text x="${tx.toFixed(1)}" y="${(ty + 14).toFixed(1)}" class="pip">vlan ${A.cfg.ifs[port].vlan}</text>`;
    let dce = '';
    if (l.cable === 'serial' && l.dce === A.id) {
      const [cx, cy] = along(A, B, 70, -10);
      dce = `<g class="clock" transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)})"><title>Extremo DCE: aquí va el clock rate</title><circle r="6"/><path d="M0 -3.5V0l2.5 1.8"/><text y="-9" class="dcet">DCE</text></g>`;
    }
    return `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="4.6" class="ld ${st}"><title>${esc(A.id + ' ' + port + ': ' + ST_TXT[st])}</title></circle>` + txt + dce;
  }
  function renderTopo() {
    if (!net) return;
    const parts = [];
    for (const l of net.links) {
      const A = net.devs[l.a.d];
      const B = net.devs[l.b.d];
      const st = net.linkState(l);
      const sa = net.status(A, l.a.p);
      const sb = net.status(B, l.b.p);
      const tip = `${A.id} ${l.a.p}  ↔  ${B.id} ${l.b.p}\nCable: ${CABLES[l.cable]}${l.cable === 'serial' ? ' (DCE en ' + l.dce + ')' : ''}${l.cable !== net.rightCable(A, B, l.a.p) ? '  ✗ no es el cable correcto' : ''}\n${A.id}: ${sa[0]}/${sa[1]} · ${B.id}: ${sb[0]}/${sb[1]}`;
      let mid = '';
      if (l.cable === 'serial') {
        const [mx, my] = along(A, B, Math.hypot(B.x - A.x, B.y - A.y) / 2);
        const ang = (Math.atan2(B.y - A.y, B.x - A.x) * 180) / Math.PI;
        mid = `<path class="zz" transform="translate(${mx.toFixed(1)} ${my.toFixed(1)}) rotate(${ang.toFixed(1)})" d="M-12 0h5l3 -7 4 14 3 -7h9"/>`;
      }
      parts.push(
        `<g class="lk ${st} ${l.cable}" data-link="${net.links.indexOf(l)}"><title>${esc(tip)}</title>` +
          `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" class="hit"/><line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" class="wire"/>${mid}` +
          linkEnd(A, B, l.a.p, l) +
          linkEnd(B, A, l.b.p, l) +
          '</g>'
      );
    }
    for (const p of net.pending || []) {
      if (net.cabled(p.a, p.b)) continue;
      const A = net.devs[p.a];
      const B = net.devs[p.b];
      const [ax, ay] = along(A, B, 46, 11);
      const [bx, by] = along(B, A, 46, 11);
      parts.push(
        `<g class="lk pend" data-pend="${net.pending.indexOf(p)}" tabindex="0" role="button" aria-label="Cablear ${p.a} ${p.pa} con ${p.b} ${p.pb}"><title>Sin cable: pulsa para conectar ${p.a} ${p.pa} con ${p.b} ${p.pb}</title>` +
          `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" class="hit"/><line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" class="wire"/>` +
          `<text x="${ax.toFixed(1)}" y="${(ay + 3).toFixed(1)}" class="pl">${esc(tight(p.pa))}</text><text x="${bx.toFixed(1)}" y="${(by + 3).toFixed(1)}" class="pl">${esc(tight(p.pb))}</text>` +
          `<g class="plusg" transform="translate(${(A.x + B.x) / 2} ${(A.y + B.y) / 2})"><rect x="-9" y="-9" width="18" height="18"/><path d="M-4.5 0h9M0 -4.5v9"/></g></g>`
      );
    }
    for (const d of net.order) parts.push(devIcon(d));
    if (!el.topo.querySelector('.topo-main')) el.topo.innerHTML = `<svg class="topo-main" viewBox="0 0 ${W} ${HGT}" role="img" aria-label="Topología de la red"></svg><svg class="topo-pkts" viewBox="0 0 ${W} ${HGT}" aria-hidden="true"><g id="pkts"></g></svg>`;
    /* encuadre: el dibujo se ajusta a los equipos para verse lo más grande posible */
    const xs = net.order.map((d) => d.x);
    const ys = net.order.map((d) => d.y);
    let x0 = Math.min(...xs) - 125;
    let x1 = Math.max(...xs) + 70;
    let y0 = Math.min(...ys) - 58;
    let y1 = Math.max(...ys) + 62;
    const minW = 420;
    if (x1 - x0 < minW) {
      const c = (x0 + x1) / 2;
      x0 = c - minW / 2;
      x1 = c + minW / 2;
    }
    if (y1 - y0 < 220) {
      const c = (y0 + y1) / 2;
      y0 = c - 110;
      y1 = c + 110;
    }
    const vb = lesson && lesson.sandbox ? sbViewBox() : net.order.length ? `${x0.toFixed(0)} ${y0.toFixed(0)} ${(x1 - x0).toFixed(0)} ${(y1 - y0).toFixed(0)}` : `0 0 ${W} ${HGT}`;
    for (const sv of el.topo.querySelectorAll('svg')) sv.setAttribute('viewBox', vb);
    el.topo.querySelector('.topo-main').innerHTML = lesson && lesson.sandbox ? sbUnder() + parts.join('') + sbOver() : parts.join('');
    if (lesson && lesson.sandbox) sbSaveSoon();
    const up = net.links.filter((l) => net.linkState(l) === 'up').length;
    const pend = (net.pending || []).filter((p) => !net.cabled(p.a, p.b)).length;
    el.info.textContent = `${net.order.length} equipos · ${net.links.length} cables · ${up} up/up` + (pend ? ` · ${pend} sin cablear` : '');
  }
  el.topo.addEventListener('click', (e) => {
    if (lesson && lesson.sandbox) return;
    const d = e.target.closest('[data-dev]');
    if (d) return goDevice(d.dataset.dev);
    const p = e.target.closest('[data-pend]');
    if (p) return openPick(net.pending[+p.dataset.pend], e);
    const k = e.target.closest('[data-link]');
    if (k && (net.pending || []).length) {
      const l = net.links[+k.dataset.link];
      const pend = net.pending.find((x) => (x.a === l.a.d && x.b === l.b.d) || (x.a === l.b.d && x.b === l.a.d));
      if (pend) openPick(pend, e);
    }
  });
  el.topo.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const d = e.target.closest('[data-dev]');
    if (d) {
      e.preventDefault();
      goDevice(d.dataset.dev);
    }
    const p = e.target.closest('[data-pend]');
    if (p) {
      e.preventDefault();
      openPick(net.pending[+p.dataset.pend], e);
    }
  });

  /* ---------- elegir cable ---------- */
  let picking = null;
  function openPick(p, e) {
    picking = p;
    const opts = ['straight', 'cross', 'serial', 'console'];
    el.pick.innerHTML =
      `<b>${esc(p.a)} ${esc(shortIf(p.pa))} ↔ ${esc(p.b)} ${esc(shortIf(p.pb))}</b><small>¿Qué cable usas?</small>` +
      opts.map((c) => `<button type="button" class="cbtn ${c}" data-cable="${c}"><i></i>${CABLES[c]}</button>`).join('') +
      '<button type="button" class="link" data-cable="">Cancelar</button>';
    el.pick.hidden = false;
    const r = el.topo.getBoundingClientRect();
    const x = Math.min(window.innerWidth - 240, Math.max(8, (e.clientX || r.left + r.width / 2) - 110));
    const y = Math.min(window.innerHeight - 260, Math.max(8, (e.clientY || r.top + r.height / 2) - 40));
    el.pick.style.left = x + 'px';
    el.pick.style.top = y + 'px';
    const first = el.pick.querySelector('button');
    if (first) first.focus();
  }
  el.pick.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cable]');
    if (!b) return;
    el.pick.hidden = true;
    const c = b.dataset.cable;
    const p = picking;
    picking = null;
    if (!c || !p) return;
    if (c === 'serial' && !/^Serial/.test(p.pa)) {
      say('Ese cable no encaja en esos puertos: el cable serie va a puertos Serial. Elige otro.', 'oops');
      return;
    }
    if (c !== 'serial' && /^Serial/.test(p.pa)) {
      say('Los puertos serie solo admiten cable serie (DCE o DTE).', 'oops');
      return;
    }
    const before = net.snapshot();
    if (/^Serial/.test(p.pa) && (!net.devs[p.a].hwPorts().includes(p.pa) || !net.devs[p.b].hwPorts().includes(p.pb))) {
      say('Uno de los routers no tiene puertos serie. Ponle antes un módulo HWIC-2T (pestaña Físico).', 'oops');
      return;
    }
    net.link(p.a, p.pa, p.b, p.pb, c, p.a);
    const msgs = logs(net, before, net.snapshot());
    for (const id of Object.keys(msgs)) if (terms[id]) for (const m of msgs[id]) printTo(id, m, 'log');
    if (c === p.want) {
      if (!p.tried) award('cable');
      say(c === 'console' ? '…' : pick(['¡Cable correcto!', 'Eso es: ' + CABLES[c].toLowerCase() + '.', 'Bien elegido.']), 'happy');
    } else {
      p.tried = true;
      say(c === 'console' ? 'El cable de consola solo sirve para configurar desde un PC, no para pasar datos. Pulsa el enlace y cámbialo.' : `Con ${CABLES[c].toLowerCase()} ese enlace no funciona (fíjate: en rojo). Pulsa el enlace y prueba otro.`, 'oops');
    }
    renderTopo();
    if (!lesson.mode) checkStep('', { out: '', err: '', parts: [] });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.pick.hidden) el.pick.hidden = true;
  });
  document.addEventListener('mousedown', (e) => {
    if (!el.pick.hidden && !el.pick.contains(e.target) && !e.target.closest('[data-pend],[data-link]')) el.pick.hidden = true;
  });

  /* ---------- vista física (como la pestaña Physical de Packet Tracer) ---------- */
  let modSel = null;
  /* ===== piezas de hardware dibujadas a partir de las guías de Cisco =====
     2911: frontal con interruptor, toma AC y LED; trasera con SM, fuente, 4 EHWIC (0 a la derecha), CF 0/1,
     consola USB mini-B y RJ-45 con LED EN, AUX, GE0/0-0/2 con LED S y L, USB 0/1 y toma de tierra.
     1941: trasera con 2 EHWIC, interruptor y toma de corriente atrás. 2960-24TT: consola detrás. */
  const BOOT = { straight: '#2f6fd6', cross: '#f2b233', console: '#5fc3f0', serial: '#d93a24' };
  const svgT = (x, y, t, cls, anchor) => `<text x="${x}" y="${y}" class="${cls || 'silk'}" style="text-anchor:${anchor || 'middle'}">${esc(t)}</text>`;
  const screw = (cx, cy, r) => `<g class="screw"><circle cx="${cx}" cy="${cy}" r="${r || 3.6}"/><path d="M${cx - (r || 3.6) * 0.6} ${cy}h${(r || 3.6) * 1.2}M${cx} ${cy - (r || 3.6) * 0.6}v${(r || 3.6) * 1.2}"/></g>`;
  const ledR = (x, y, st, w, h) => `<rect x="${x}" y="${y}" width="${w || 6}" height="${h || 3.4}" rx="0.8" class="led ${st}"/>`;
  const ledC = (cx, cy, st, r) => `<circle cx="${cx}" cy="${cy}" r="${r || 2.6}" class="led ${st}"/>`;
  const vents = (x, y, w, h, n) => {
    let s = '';
    for (let i = 0; i < n; i++) s += `<rect x="${x + (i * w) / n + 1}" y="${y}" width="${w / n - 3}" height="${h}" rx="1.5" class="vent"/>`;
    return s;
  };
  function fan(cx, cy, r) {
    let s = `<g class="fan-g"><circle cx="${cx}" cy="${cy}" r="${r}" class="fan"/>`;
    for (let k = 1; k <= 3; k++) s += `<circle cx="${cx}" cy="${cy}" r="${(r * k) / 3.4}" class="grill-c"/>`;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      s += `<path d="M${cx} ${cy}L${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}" class="grill"/>`;
    }
    return s + `<circle cx="${cx}" cy="${cy}" r="${r * 0.18}" class="hub"/></g>`;
  }
  /* toma de corriente IEC C14 */
  const iec = (x, y) => `<g><title>Toma de corriente (AC 100-240 V)</title><path d="M${x} ${y + 5}l5 -5h16l5 5v15h-26Z" class="iec"/><path d="M${x + 7} ${y + 8}v7M${x + 13} ${y + 8}v7M${x + 19} ${y + 8}v7" class="iec-pin"/></g>`;
  function rocker(x, y, on, act, label) {
    return (
      `<g class="rocker${on ? ' on' : ''}"${act ? ` data-act="power" tabindex="0" role="button" aria-label="Interruptor: ${on ? 'encendido, pulsa para apagar' : 'apagado, pulsa para encender'}"` : ''}>` +
      `<title>Interruptor de encendido (${on ? 'I = encendido' : 'O = apagado'})${act ? '. Pulsa para cambiarlo.' : ''}</title>` +
      `<rect x="${x}" y="${y}" width="22" height="34" rx="2" class="rk-base"/>` +
      `<path d="M${x + 3} ${y + 3}h16v${on ? 12 : 16}l-16 ${on ? 4 : -4}Z" class="rk-key"/><path d="M${x + 3} ${y + 31}h16v${on ? -12 : -16}l-16 ${on ? 4 : -4}Z" class="rk-key2"/>` +
      svgT(x + 11, y + 13, 'I', 'rk-t') + svgT(x + 11, y + 29, 'O', 'rk-t') +
      (label ? svgT(x + 11, y + 46, label) : '') +
      '</g>'
    );
  }
  /* conector RJ45 de frente: carcasa metálica, hueco con ranura y 8 contactos dorados */
  function jack(x, y, o) {
    const w = o.w || 26;
    const h = o.h || 22;
    const fl = !!o.flip;
    const tf = `translate(${x} ${y})` + (fl ? ` translate(0 ${h}) scale(1 -1)` : '');
    let g = `<g class="jack${o.con ? ' con' : ''}"><title>${esc(o.title || '')}</title>`;
    g += `<rect x="${x - 2.5}" y="${y - 2.5}" width="${w + 5}" height="${h + 5}" rx="1.5" class="j-shield"/>`;
    g += `<g transform="${tf}">`;
    g += `<rect x="1" y="-1.6" width="4" height="2.2" class="j-tab"/><rect x="${w - 5}" y="-1.6" width="4" height="2.2" class="j-tab"/>`;
    const sl = w * 0.31;
    const sr = w * 0.69;
    g += `<path d="M2 2H${w - 2}V${h - 7}H${sr}V${h - 1.5}H${sl}V${h - 7}H2Z" class="j-cav"/>`;
    g += `<rect x="3" y="3" width="${w - 6}" height="2.4" class="j-shade"/>`;
    for (let k = 0; k < 8; k++) g += `<path d="M${(5.2 + (k * (w - 10.4)) / 7).toFixed(2)} 3.2v5.2" class="j-pin"/>`;
    if (o.plug) {
      g += `<path d="M3 1.2H${w - 3}V${h - 7.5}H3Z" class="j-plug"/><path d="M${sl + 1} ${h - 7.6}H${sr - 1}V${h - 2}H${sl + 1}Z" class="j-latch"/>`;
      for (let k = 0; k < 8; k++) g += `<path d="M${(5.2 + (k * (w - 10.4)) / 7).toFixed(2)} 2v3" class="j-gold"/>`;
      g += `<circle cx="${w / 2}" cy="${h / 2 - 2}" r="${Math.min(w, h) * 0.26}" class="j-boot" style="fill:${BOOT[o.plug] || '#666'}"/><circle cx="${w / 2}" cy="${h / 2 - 2}" r="${Math.min(w, h) * 0.12}" class="j-core"/>`;
    }
    g += '</g>';
    const below = o.ledBelow != null ? o.ledBelow : fl;
    const ly = below ? y + h + 5 : y - 8;
    if (o.leds === 2) g += ledR(x + 1, ly, o.st, 7) + ledR(x + w - 8, ly, o.st === 'up' ? 'act' : 'off', 7);
    else if (o.leds !== 0) g += ledR(o.ledX != null ? x + o.ledX : x + w / 2 - 4, ly, o.st, 8);
    /* puerto ocupado: cable saliendo con su color y una etiqueta con el equipo del otro lado */
    if (o.plug && o.peer) {
      const col = BOOT[o.plug] || '#666';
      const len = o.len || 16;
      const txt = o.tag || o.peer;
      const tw = txt.length * 5.6 + 10;
      let path;
      let tx;
      let ty;
      if (o.dir === 'right') {
        const y0 = y + h / 2 - 2;
        path = `M${x + w + 2.5} ${y0}H${x + w + 2.5 + len}`;
        tx = x + w + 2.5 + len;
        ty = y0 - 6;
      } else {
        const up = o.dir === 'up';
        const y1 = up ? y - 2.5 : y + h + 2.5;
        const y2 = up ? y1 - len : y1 + len;
        path = `M${x + w / 2} ${y1}V${y2}`;
        tx = x + w / 2 - tw / 2;
        ty = up ? y2 - 11 : y2;
      }
      g += `<path d="${path}" class="cable" style="stroke:${col}"/><path d="${path}" class="cable-hl"/>`;
      const tc = o.plug === 'cross' ? '#17141f' : '#fff';
      if (o.vtag && o.dir !== 'right') {
        /* etiqueta en vertical, siguiendo el cable (para puertos muy juntos) */
        const up = o.dir === 'up';
        const vh = txt.length * 5 + 8;
        const cx = x + w / 2;
        const yEnd = up ? y - 2.5 - len : y + h + 2.5 + len;
        const ry = up ? yEnd - vh : yEnd;
        g += `<g class="ctag"><rect x="${cx - 5.5}" y="${ry}" width="11" height="${vh}" rx="2" style="fill:${col}"/><text transform="translate(${cx + 2.6} ${ry + vh / 2}) rotate(-90)" class="ctag-t" style="fill:${tc}">${esc(txt)}</text></g>`;
      } else g += `<g class="ctag"><rect x="${tx}" y="${ty}" width="${tw}" height="11" rx="2" style="fill:${col}"/><text x="${tx + tw / 2}" y="${ty + 8.2}" class="ctag-t" style="fill:${tc}">${esc(txt)}</text></g>`;
    } else if (o.label) g += `<text x="${x + w / 2}" y="${o.labelY != null ? o.labelY : fl ? y + h + 19 : y - 12}" class="plab">${esc(o.label)}</text>`;
    return g + '</g>';
  }
  const plugOf = (d, n) => {
    const l = net.linkAt(d.id, n);
    return l ? l.cable : null;
  };
  const peerOf = (d, n) => {
    const l = net.linkAt(d.id, n);
    return l ? net.other(l, d.id, n).d : null;
  };
  function portTitle(d, n) {
    const s = net.status(d, n);
    const l = net.linkAt(d.id, n);
    let t = `${n}: ${s[0] === 'admin' ? 'administratively down' : s[0]} / ${s[1]}`;
    if (l) {
      const o = net.other(l, d.id, n);
      t += `\nConectado a ${o.d} ${o.p} (${CABLES[l.cable]}${l.cable === 'serial' ? ', ' + (l.dce === d.id ? 'este extremo es DCE' : 'este extremo es DTE') : ''})`;
    } else t += '\nSin cable';
    return t;
  }
  /* puerto GE de router: RJ45 con LED S (velocidad) y L (enlace) debajo */
  function gePort(x, y, d, n, label) {
    const st = d.power ? stateOf(d, n) : 'off';
    return (
      jack(x, y, { st, plug: plugOf(d, n), peer: peerOf(d, n), dir: 'up', len: 14, tag: label.replace(' ', '') + ' · ' + peerOf(d, n), title: portTitle(d, n), leds: 0 }) +
      ledR(x + 1, y + 27, d.power && st === 'up' ? 'act' : 'off', 7) +
      ledR(x + 18, y + 27, st === 'up' ? 'up' : 'off', 7) +
      svgT(x + 4.5, y + 38, 'S', 'silk-s') +
      svgT(x + 21.5, y + 38, 'L', 'silk-s') +
      (peerOf(d, n) ? '' : svgT(x + 13, y - 6, label))
    );
  }
  const usbA = (x, y, title) => `<g><title>${esc(title || 'USB tipo A')}</title><rect x="${x}" y="${y}" width="18" height="8" rx="1" class="usb"/><rect x="${x + 3}" y="${y + 2}" width="12" height="3" class="usb-in"/></g>`;
  const miniB = (x, y) => `<g><title>Consola USB (mini-B, 5 pines)</title><path d="M${x} ${y}h14v5l-2 3h-10l-2 -3Z" class="usb"/><rect x="${x + 3}" y="${y + 2}" width="8" height="3" class="usb-in"/></g>`;
  /* conector Smart Serial de 26 pines (el del HWIC-2T), con cable serie si está enchufado */
  function smartSerial(x, y, d, n, k) {
    k = k || 0.8;
    const l = d ? net.linkAt(d.id, n) : null;
    let g = `<g class="ssp">${d ? `<title>${esc(portTitle(d, n))}</title>` : ''}<g transform="translate(${x} ${y}) scale(${k})">`;
    g += '<rect x="0" y="0" width="42" height="22" rx="2" class="ss-frame"/>' + screw(5, 11, 2.4) + screw(37, 11, 2.4);
    g += '<path d="M9 4h24l-2.5 14h-19Z" class="ss-d"/>';
    for (let r = 0; r < 2; r++) for (let q = 0; q < 13; q++) g += `<circle cx="${(12 + q * 1.55 + r * 0.8).toFixed(2)}" cy="${8.5 + r * 5}" r="0.55" class="ss-pin"/>`;
    if (l) {
      g += '<rect x="3" y="-3" width="36" height="28" rx="3" class="ss-plug"/><rect x="14" y="25" width="14" height="8" class="ss-cable"/>' + screw(7, 11, 2.4) + screw(35, 11, 2.4);
      g += svgT(21, 15, l.dce === d.id ? 'DCE' : 'DTE', 'ss-lab');
    }
    return g + '</g></g>';
  }
  function sfpCage(x, y) {
    let g = `<g><title>Jaula SFP (para un transceptor de fibra o cobre)</title><rect x="${x}" y="${y}" width="34" height="14" rx="1" class="sfp"/><rect x="${x + 3}" y="${y + 3}" width="28" height="8" class="sfp-in"/>`;
    for (let k = 0; k < 6; k++) g += `<path d="M${x + 4 + k * 5} ${y - 2}v3" class="sfp-spring"/>`;
    return g + '</g>';
  }
  /* placa del módulo (para el hueco y para la lista). w×h = tamaño del hueco */
  function modFace(m, w, h, d, slot) {
    let s = `<rect x="0" y="0" width="${w}" height="${h}" rx="1.5" class="m-plate"/><rect x="0" y="0" width="${w}" height="3" class="m-lip"/>`;
    s += screw(7, h / 2, 3.2) + screw(w - 7, h / 2, 3.2);
    const on = d && d.power;
    if (m === 'HWIC-2T') {
      s += svgT(w / 2, 10, 'HWIC-2T', 'm-name');
      const k = Math.min(0.85, (w - 30) / 2 / 46);
      for (let p = 0; p < 2; p++) {
        const x = 15 + p * ((w - 30) / 2);
        const n = `Serial0/${slot}/${p}`;
        s += smartSerial(x, 15, d, n, k);
        s += svgT(x + 21 * k, h - 3, String(p), 'silk-xs');
        s += ledC(x + 42 * k - 1, 12, d && d.power && stateOf(d, n) === 'up' ? 'up' : 'off', 1.8);
      }
    } else if (m === 'HWIC-4ESW') {
      s += svgT(w / 2, 10, 'HWIC-4ESW', 'm-name');
      for (let p = 0; p < 4; p++) s += jack(16 + p * ((w - 42) / 3.6), 18, { w: 20, h: 17, st: 'off', leds: 1, ledBelow: true, title: `Puerto ${p} del switch del módulo` }) + svgT(26 + p * ((w - 42) / 3.6), 14, String(p), 'silk-xs');
    } else if (m === 'HWIC-1GE-SFP') {
      s += svgT(w / 2, 10, 'HWIC-1GE-SFP', 'm-name') + sfpCage(w / 2 - 17, 19) + ledC(w / 2 + 26, 22, 'off', 2.2) + svgT(w / 2 + 26, 33, 'LINK', 'silk-xs') + svgT(w / 2 - 22, 30, 'GE 0', 'silk-xs', 'end');
    }
    return s;
  }
  function modSvg(m) {
    return `<svg viewBox="-2 -2 124 54" aria-hidden="true">${modFace(m, 120, 50, null, 0)}</svg>`;
  }
  function slotSvg(d, i, x, y, w, h) {
    const m = d.slots[i];
    const title = m ? `EHWIC ${i}: ${m} (${MODULES[m].desc}).${d.power ? ' Apaga el router para quitarlo.' : ' Pulsa para quitarlo.'}` : `EHWIC ${i} vacío (tapa ciega).${d.power ? ' Apaga el router para meter un módulo.' : modSel ? ' Pulsa para meter el ' + modSel + '.' : ' Elige un módulo de la lista y pulsa aquí.'}`;
    let s = `<g class="slot${m ? ' full' : ''}${!m && modSel && !d.power ? ' ready' : ''}" data-slot="${i}" tabindex="0" role="button" aria-label="${esc(title)}"><title>${esc(title)}</title>`;
    s += svgT(x + w / 2, y - 4, `EHWIC ${i}`) + `<rect x="${x - 2}" y="${y - 1}" width="${w + 4}" height="${h + 2}" class="bay"/>`;
    if (m) s += `<g transform="translate(${x} ${y})">${modFace(m, w, h, d, i)}</g>`;
    else s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" class="blank"/>` + screw(x + 7, y + h / 2, 3.2) + screw(x + w - 7, y + h / 2, 3.2) + vents(x + 20, y + h / 2 - 3, w - 40, 6, 6) + svgT(x + w / 2, y + h - 7, 'vacío', 'empty-t');
    return s + '</g>';
  }
  function cf(x, y, label, on) {
    return `<g><title>Ranura CompactFlash ${label.slice(-1)} (${label === 'CF 0' ? 'con la tarjeta de 256 MB donde va el IOS' : 'vacía'})</title><rect x="${x}" y="${y}" width="56" height="9" rx="1" class="cf"/><rect x="${x + 2}" y="${y + 2}" width="${label === 'CF 0' ? 40 : 52}" height="5" class="${label === 'CF 0' ? 'cf-card' : 'cf-in'}"/>${label === 'CF 0' ? `<rect x="${x + 42}" y="${y + 2.5}" width="8" height="4" class="cf-btn"/>` : ''}${ledR(x + 60, y + 3, on ? 'up' : 'off', 6, 3)}${svgT(x + 28, y + 19, label, 'silk-s')}</g>`;
  }
  /* ---- Cisco 2911: frontal ---- */
  function r2911Front(d) {
    const on = d.power;
    let s = `<svg class="hw" viewBox="0 0 760 96" role="img" aria-label="Frontal del ${esc(d.label)}">`;
    s += '<rect x="2" y="2" width="756" height="92" rx="6" class="bezel"/><rect x="10" y="10" width="740" height="76" rx="4" class="bezel-in"/>';
    s += vents(220, 22, 300, 52, 22);
    s += `<g><title>Zona de la fuente de alimentación: LED AC OK, interruptor y toma de corriente</title><rect x="22" y="16" width="170" height="64" rx="3" class="psu-front"/></g>`;
    s += ledC(42, 30, on ? 'up' : 'up', 3) + svgT(42, 46, 'AC OK', 'silk-s');
    s += rocker(70, 26, on, true, '');
    s += iec(130, 34) + svgT(143, 72, '100-240V~', 'silk-xs');
    s += svgT(560, 50, 'cisco', 'logo-w', 'start') + svgT(560, 66, 'Cisco 2900 Series', 'silk-w', 'start');
    const leds = [['SYS', on ? 'up' : 'off'], ['ACT', on ? 'act' : 'off'], ['POE', 'off'], ['RPS', 'off'], ['PS', on ? 'up' : 'off']];
    leds.forEach(([t, st], i) => (s += `<g><title>LED ${t}</title>${ledC(670 + (i % 3) * 26, 34 + Math.floor(i / 3) * 24, st, 3)}${svgT(670 + (i % 3) * 26, 46 + Math.floor(i / 3) * 24, t, 'silk-w')}</g>`));
    return s + '</svg>';
  }
  /* ---- Cisco 2911 y 1941: trasera ---- */
  function rRear(d) {
    const on = d.power;
    const is1941 = d.model === '1941';
    let s = `<svg class="hw" viewBox="0 0 760 252" role="img" aria-label="Trasera del ${esc(d.label)}">`;
    s += '<rect x="2" y="2" width="756" height="248" rx="4" class="chas"/><rect x="10" y="10" width="740" height="232" rx="2" class="chas-in"/>';
    if (!is1941) {
      /* hueco de módulo de servicio con tapa ciega */
      s += `<g><title>Hueco de módulo de servicio SM 1 (tapa ciega). Packet Tracer no lo usa en estas prácticas.</title><rect x="20" y="22" width="250" height="96" class="bay"/><rect x="24" y="26" width="242" height="88" rx="2" class="blank"/>${screw(34, 70, 4)}${screw(256, 70, 4)}${vents(56, 46, 178, 44, 12)}${svgT(145, 108, 'SM 1', 'silk')}</g>`;
      /* fuente de alimentación desmontable */
      s += `<g><title>Fuente de alimentación AC (módulo trasero)</title><rect x="20" y="130" width="196" height="104" class="bay"/><rect x="24" y="134" width="188" height="96" rx="3" class="psu"/>${fan(84, 182, 38)}<path d="M144 150h48a6 6 0 0 1 6 6v52a6 6 0 0 1 -6 6h-48" class="handle"/>${screw(196, 142, 3)}${svgT(170, 228, 'AC PWR', 'silk-s')}</g>`;
      s += `<g><title>Toma de tierra</title><rect x="226" y="196" width="40" height="22" rx="2" class="gnd"/>${screw(236, 207, 3.2)}${screw(256, 207, 3.2)}${svgT(246, 230, '⏚', 'silk')}</g>`;
    } else {
      s += rocker(24, 172, on, true, 'POWER') + iec(58, 178) + svgT(71, 214, '100-240V~', 'silk-xs');
      s += `<g><title>Ranura de seguridad Kensington</title><rect x="104" y="186" width="10" height="6" rx="2" class="usb-in"/></g>`;
    }
    /* EHWIC: el 0 a la derecha */
    const n = d.slots.length;
    const w = is1941 ? 200 : 108;
    const x0 = is1941 ? 330 : 286;
    for (let k = 0; k < n; k++) {
      const i = n - 1 - k;
      s += slotSvg(d, i, x0 + k * (w + 8), 34, w, 54);
    }
    /* CompactFlash, ISM y PVDM */
    s += cf(is1941 ? 140 : 300, 104, 'CF 1', false) + cf(is1941 ? 226 : 390, 104, 'CF 0', on);
    if (!is1941) {
      s += `<g><title>LED del módulo interno ISM (no instalado)</title>${ledC(500, 108, 'off')}${svgT(500, 124, 'ISM', 'silk-s')}</g>`;
      s += `<g><title>LED de los PVDM 1 y 0 (DSP de voz, no instalados)</title>${ledC(536, 108, 'off')}${ledC(552, 108, 'off')}${svgT(544, 124, 'PVDM 1 0', 'silk-s')}</g>`;
    }
    /* puertos integrados */
    const py = 168;
    let x = is1941 ? 140 : 290;
    const conOn = on ? 'up' : 'off';
    s += miniB(x, py + 6) + ledC(x + 7, py - 6, 'off', 2.2) + svgT(x + 7, py - 12, 'EN', 'silk-xs') + svgT(x + 7, py + 30, 'USB CON', 'silk-xs');
    x += 32;
    s += jack(x, py, { con: true, leds: 0, title: 'Consola RJ-45 (cable azul de consola). Es la que usas en la CLI.' }) + ledC(x + 13, py - 8, conOn, 2.2) + svgT(x + 20, py - 6, 'EN', 'silk-xs', 'start') + svgT(x + 13, py + 34, 'CON', 'silk-s');
    x += 40;
    s += jack(x, py, { leds: 0, title: 'Puerto auxiliar (módem)' }) + svgT(x + 13, py + 34, 'AUX', 'silk-s');
    x += 46;
    for (const p of d.hwPorts().filter((q) => /^Gig/.test(q))) {
      s += gePort(x, py, d, p, tight(p).replace('Gig', 'GE '));
      x += 44;
    }
    x += 4;
    s += usbA(x, py + 2, 'USB 1') + usbA(x, py + 14, 'USB 0') + svgT(x + 9, py + 34, 'USB 0/1', 'silk-xs');
    s += svgT(is1941 ? 700 : 660, 228, 'cisco', 'logo', 'middle') + svgT(is1941 ? 700 : 660, 242, d.label.replace('Cisco ', 'CISCO'), 'silk-s');
    return s + '</svg>';
  }
  /* ---- Catalyst 2960-24TT-L ---- */
  function switchPanel(d) {
    const st = (n) => (d.power ? stateOf(d, n) : 'off');
    let s = `<svg class="hw" viewBox="0 0 760 168" role="img" aria-label="Frontal del ${esc(d.label)}">`;
    s += '<rect x="4" y="4" width="752" height="160" rx="3" class="sw-chas"/><rect x="12" y="12" width="736" height="144" rx="2" class="sw-face"/>';
    s += svgT(26, 38, 'cisco', 'logo', 'start') + svgT(26, 52, 'Catalyst 2960 Series', 'silk-s', 'start');
    ['SYST', 'RPS', 'STAT', 'DUPLX', 'SPEED'].forEach((t, i) => {
      const yy = 72 + i * 14;
      const c = !d.power ? 'off' : t === 'SYST' ? 'up' : t === 'STAT' ? 'act' : 'off';
      s += `<g><title>LED ${t}${t === 'STAT' ? ' (modo seleccionado: estado de los puertos)' : ''}</title>${ledR(26, yy - 4, c, 9, 4)}${svgT(40, yy, t, 'silk-s', 'start')}</g>`;
    });
    s += `<g><title>Botón MODE: cambia lo que muestran los LED de los puertos (STAT, DUPLX, SPEED)</title><circle cx="108" cy="132" r="7" class="mode-btn"/>${svgT(108, 150, 'MODE', 'silk-s')}</g>`;
    const bx = [170, 380];
    for (const b0 of bx) s += `<rect x="${b0 - 9}" y="40" width="${6 * 31 + 12}" height="92" rx="2" class="blk"/>`;
    for (let i = 1; i <= 24; i++) {
      const col = Math.floor((i - 1) / 2);
      const top = i % 2 === 1;
      const x = bx[col < 6 ? 0 : 1] + (col % 6) * 31;
      const yy = top ? 58 : 95;
      const p = 'FastEthernet0/' + i;
      const peer = peerOf(d, p);
      s += jack(x, yy, { flip: top, ledBelow: top, ledX: top ? 3 : 15, st: st(p), plug: plugOf(d, p), peer, dir: top ? 'up' : 'down', len: 3, vtag: true, tag: `${i}·${peer}`, title: portTitle(d, p), label: String(i), labelY: top ? 34 : 152 });
    }
    s += svgT(26, 62, '10/100 FE · 1x–24x', 'silk-xs', 'start');
    s += `<rect x="608" y="56" width="92" height="56" rx="2" class="blk"/>` + svgT(654, 48, '10/100/1000', 'silk-s');
    ['GigabitEthernet0/1', 'GigabitEthernet0/2'].forEach((p, i) => (s += jack(620 + i * 40, 76, { st: st(p), plug: plugOf(d, p), peer: peerOf(d, p), dir: 'down', len: 10 + i * 16, tag: `G${i + 1} · ${peerOf(d, p)}`, title: portTitle(d, p), label: String(i + 1), labelY: 104, leds: 1 })));
    s += svgT(730, 150, 'WS-C2960-24TT-L', 'silk-xs', 'end');
    return s + '</svg>';
  }
  function switchRear(d) {
    let s = `<svg class="hw" viewBox="0 0 760 96" role="img" aria-label="Trasera del ${esc(d.label)}">`;
    s += '<rect x="4" y="4" width="752" height="88" rx="3" class="sw-chas"/><rect x="12" y="12" width="736" height="72" rx="2" class="chas-in"/>';
    s += vents(30, 24, 300, 48, 24);
    s += `<g><title>Conector de fuente redundante (RPS) con su tapa</title><rect x="400" y="28" width="96" height="36" rx="3" class="rps"/>${screw(410, 46, 3)}${screw(486, 46, 3)}${svgT(448, 78, 'RPS', 'silk-s')}</g>`;
    s += iec(530, 34) + svgT(543, 78, 'AC 100-240V', 'silk-xs');
    s += jack(620, 34, { con: true, leds: 0, title: 'Puerto de consola del 2960 (está detrás). Cable azul de consola.' }) + svgT(633, 78, 'CONSOLE', 'silk-s');
    return s + '</svg>';
  }
  /* ---- PC: trasera de una torre ---- */
  /* ---- PC: frontal (monitor, torre, teclado) y trasera de una torre ATX ---- */
  const hexDefs = (id) =>
    `<defs><pattern id="${id}" width="8" height="13.856" patternUnits="userSpaceOnUse"><path d="M4 0l4 2.31v4.62L4 9.24 0 6.93V2.31Z M0 9.24 4 11.55v4.62" class="hexp"/></pattern></defs>`;
  function pcFan(cx, cy, r, pid) {
    return `<g class="pcfan"><circle cx="${cx}" cy="${cy}" r="${r + 5}" class="fan-ring"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${pid})" class="fan-hex"/>${screw(cx - r - 1, cy - r - 1, 2.6)}${screw(cx + r + 1, cy - r - 1, 2.6)}${screw(cx - r - 1, cy + r + 1, 2.6)}${screw(cx + r + 1, cy + r + 1, 2.6)}</g>`;
  }
  function pcFront(d) {
    const on = d.power;
    const p = d.pc;
    let s = '<svg class="hw" viewBox="0 0 760 300" role="img" aria-label="Frontal del PC: monitor, torre y teclado">';
    /* monitor */
    s += '<g><title>Monitor</title><rect x="150" y="16" width="360" height="222" rx="8" class="mon"/><rect x="164" y="28" width="332" height="190" class="mon-scr' + (on ? '' : ' off') + '"/>';
    if (on) {
      s += '<rect x="164" y="28" width="332" height="16" class="desk-bar"/>' + svgT(172, 40, `${d.id} · Desktop`, 'desk-t', 'start');
      const apps = [['🖧', 'IP Configuration'], ['⌨', 'Command Prompt'], ['🌐', 'Web Browser'], ['✉', 'Email']];
      apps.forEach(([ic, t], i) => {
        const x = 186 + (i % 4) * 78;
        s += `<rect x="${x}" y="56" width="56" height="46" rx="4" class="desk-ic"/>` + svgT(x + 28, 86, ic, 'desk-ico') + svgT(x + 28, 116, t, 'desk-lab');
      });
      s += svgT(330, 160, p.ip != null ? `IPv4 ${n2ip(p.ip)} / ${prefixOf(p.mask)}` : p.dhcp ? 'Esperando IP por DHCP…' : 'Sin IP configurada', 'desk-info');
      s += svgT(330, 178, p.gw != null ? `Puerta de enlace ${n2ip(p.gw)}` : 'Sin puerta de enlace', 'desk-info2');
    } else s += svgT(330, 128, 'sin señal', 'desk-off');
    s += svgT(330, 232, 'PT', 'mon-logo') + ledC(486, 230, on ? 'up' : 'off', 2.2) + '<path d="M300 238h60l12 34h-84Z" class="mon-stand"/><rect x="250" y="270" width="160" height="10" rx="3" class="mon-stand"/></g>';
    /* torre */
    s += '<g><title>Torre del PC</title><rect x="560" y="22" width="120" height="262" rx="6" class="tower"/><rect x="568" y="30" width="104" height="246" rx="3" class="tower-front"/>';
    s += '<rect x="576" y="44" width="88" height="20" rx="2" class="odd"/><rect x="584" y="52" width="72" height="3" class="odd-slot"/><circle cx="652" cy="58" r="2" class="odd-btn"/>';
    s += vents(578, 160, 84, 70, 9);
    s += '<rect x="586" y="246" width="12" height="6" rx="1" class="usb"/><rect x="602" y="246" width="12" height="6" rx="1" class="usb"/><circle cx="626" cy="249" r="3.4" class="au2"/><circle cx="638" cy="249" r="3.4" class="au3"/>';
    s += `<g class="pc-pwr${on ? ' on' : ''}" data-act="power" tabindex="0" role="button" aria-label="Botón de encendido del PC: ${on ? 'encendido, pulsa para apagar' : 'apagado, pulsa para encender'}"><title>Botón de encendido (${on ? 'encendido' : 'apagado'})</title><circle cx="620" cy="100" r="15" class="pwr-btn"/><path d="M620 91v8M613.5 95a9 9 0 1 0 13 0" class="pwr-ico"/></g>`;
    s += ledC(604, 130, on ? 'up' : 'off', 2.4) + svgT(604, 140, 'PWR', 'silk-w') + ledC(636, 130, on ? 'act' : 'off', 2.4) + svgT(636, 140, 'HDD', 'silk-w');
    s += '<rect x="566" y="282" width="24" height="6" rx="2" class="foot"/><rect x="650" y="282" width="24" height="6" rx="2" class="foot"/></g>';
    /* teclado y ratón */
    s += '<g><title>Teclado y ratón</title><path d="M40 252h90l6 34H34Z" class="kb"/>';
    for (let r = 0; r < 4; r++) for (let k = 0; k < 10; k++) s += `<rect x="${42 + k * 8.6 + r * 1.2}" y="${256 + r * 7.6}" width="7" height="6" rx="1" class="key"/>`;
    s += '<ellipse cx="80" cy="200" rx="12" ry="17" class="mouse"/><path d="M80 184v10" class="mouse-l"/></g>';
    return s + '</svg>';
  }
  function pcPanel(d) {
    const st = d.power ? stateOf(d, 'FastEthernet0') : 'off';
    const pid = 'hex' + d.id;
    let s = `<svg class="hw" viewBox="0 0 760 430" role="img" aria-label="Trasera de la torre del PC">${hexDefs(pid)}`;
    s += '<rect x="226" y="6" width="308" height="418" rx="7" class="tower"/><rect x="236" y="14" width="288" height="398" rx="3" class="pc-rear"/>';
    s += screw(244, 24, 3) + screw(516, 24, 3) + screw(244, 400, 3) + screw(516, 400, 3);
    /* fuente de alimentación */
    s += `<g><title>Fuente de alimentación ATX (500 W)</title><rect x="250" y="26" width="260" height="96" rx="2" class="psu-atx"/>${screw(258, 34, 2.6)}${screw(502, 34, 2.6)}${screw(258, 114, 2.6)}${screw(502, 114, 2.6)}`;
    s += `<rect x="270" y="38" width="120" height="72" rx="2" fill="url(#${pid})" class="psu-grill"/>`;
    s += `<g><title>Cable de corriente enchufado</title>${iec(408, 52)}<path d="M421 76v30" class="pwr-cord"/><rect x="411" y="50" width="20" height="16" rx="2" class="iec-plug"/></g>`;
    s += rocker(450, 46, d.power, false, '') + `<rect x="482" y="54" width="18" height="12" rx="1" class="v-sel"/>${svgT(491, 63, '230', 'silk-xs')}`;
    s += `<rect x="398" y="96" width="104" height="18" rx="1" class="sticker"/>${svgT(450, 104, 'ATX 500W', 'silk-xs')}${svgT(450, 111, 'AC 100-240V~ 50/60Hz', 'silk-xs')}</g>`;
    /* placa de E/S */
    s += '<g><title>Panel de E/S de la placa base</title><rect x="250" y="134" width="74" height="196" rx="2" class="io-shield"/>';
    s += '<g><title>PS/2 (teclado y ratón)</title><circle cx="287" cy="150" r="7" class="ps2c"/><path d="M280 150a7 7 0 0 1 14 0Z" class="ps2m"/><circle cx="287" cy="150" r="2.4" class="usb-in"/></g>';
    s += usbA(260, 166, 'USB 2.0') + usbA(296, 166, 'USB 2.0');
    s += `<g><title>USB 3.0</title><rect x="260" y="180" width="18" height="8" rx="1" class="usb3"/><rect x="263" y="182" width="12" height="3" class="usb3-in"/><rect x="296" y="180" width="18" height="8" rx="1" class="usb3"/><rect x="299" y="182" width="12" height="3" class="usb3-in"/></g>`;
    s += '<g><title>HDMI</title><path d="M260 198h22v6l-3 3h-16l-3-3Z" class="hdmi"/></g><g><title>DisplayPort</title><path d="M292 198h22v9h-19l-3-3Z" class="hdmi"/></g>';
    s += '<g><title>VGA (DE-15)</title><path d="M262 216h50l-5 16h-40Z" class="vga"/>';
    for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++) s += `<circle cx="${270 + k * 8 + r * 1.5}" cy="${220 + r * 4.4}" r="1" class="vga-pin"/>`;
    s += '</g><g><title>Audio: entrada de línea (azul), altavoces (verde) y micrófono (rosa)</title>';
    [['au1', 'IN'], ['au2', 'OUT'], ['au3', 'MIC']].forEach(([c, t], i) => (s += `<circle cx="287" cy="${250 + i * 24}" r="7" class="au-ring"/><circle cx="287" cy="${250 + i * 24}" r="5" class="${c}"/><circle cx="287" cy="${250 + i * 24}" r="1.8" class="usb-in"/>${svgT(308, 253 + i * 24, t, 'silk-xs')}`));
    s += '</g></g>';
    /* ventilador trasero */
    s += pcFan(420, 196, 54, pid) + svgT(420, 262, '120 mm', 'silk-xs');
    /* ranuras de expansión (horizontales, bajo la placa de E/S) */
    s += svgT(250, 344, 'Ranuras de expansión', 'silk-xs', 'start');
    for (let k = 0; k < 3; k++) {
      const y = 348 + k * 20;
      if (k === 1) {
        s += `<g><title>Tarjeta de red PT-HOST-NM-1CFE (FastEthernet0)</title><rect x="250" y="${y}" width="262" height="18" rx="1" class="nic-br"/>${screw(258, y + 9, 2.8)}`;
        s += `<rect x="268" y="${y + 2}" width="150" height="14" class="nic-pcb"/>${svgT(274, y + 12, 'PT-HOST-NM-1CFE · 10/100', 'silk-xs', 'start')}`;
        s += jack(430, y + 1, { w: 20, h: 16, st, plug: plugOf(d, 'FastEthernet0'), peer: peerOf(d, 'FastEthernet0'), dir: 'right', len: 96, tag: 'Fa0 · ' + peerOf(d, 'FastEthernet0'), title: portTitle(d, 'FastEthernet0'), leds: 0 });
        s += ledR(421, y + 3, st, 5, 3) + ledR(421, y + 11, st === 'up' ? 'act' : 'off', 5, 3) + '</g>';
      } else s += `<g><title>Ranura de expansión vacía (tapa)</title><rect x="250" y="${y}" width="262" height="18" rx="1" class="slot-cover"/>${screw(258, y + 9, 2.8)}${vents(276, y + 5, 220, 8, 12)}</g>`;
    }
    s += '<g><title>Anilla para candado</title><rect x="490" y="134" width="16" height="10" rx="5" class="lock-loop"/></g>';
    return s + '</svg>';
  }
  function portTable(d) {
    const rows = [];
    const ports = d.kind === 'pc' ? ['FastEthernet0'] : Object.keys(d.cfg.ifs);
    const order = (n) => (/^Fast/.test(n) ? 0 : /^Gig/.test(n) ? 1 : /^Serial/.test(n) ? 2 : 3) + n.replace(/\d+/g, (x) => x.padStart(3, '0'));
    for (const n of ports.sort((a, b) => order(a).localeCompare(order(b)))) {
      const s = net.status(d, n);
      const l = net.linkAt(d.id, n.split('.')[0]);
      const o = l && !n.includes('.') && !/^Vlan/.test(n) ? net.other(l, d.id, n) : null;
      const f = d.kind === 'pc' ? null : d.cfg.ifs[n];
      const ip = d.kind === 'pc' ? (d.pc.ip != null ? `${n2ip(d.pc.ip)}/${prefixOf(d.pc.mask)}` : '—') : f.ip != null ? `${n2ip(f.ip)}/${prefixOf(f.mask)}` : '—';
      const extra = d.kind === 'switch' && !/^Vlan/.test(n) ? (f.mode === 'trunk' ? 'trunk' : 'vlan ' + f.vlan) : f && f.encap ? 'dot1Q ' + f.encap : f && f.clock ? 'clock ' + f.clock : f && net.isDce(d, n) ? 'DCE sin reloj' : '';
      if (d.kind === 'switch' && !o && !/^Vlan/.test(n) && f.vlan === 1 && f.mode !== 'trunk' && !f.desc) continue;
      const cls = s[1] === 'up' ? 'up' : s[0] === 'up' ? 'half' : 'down';
      rows.push(
        `<tr><td class="mono">${esc(tight(n))}</td><td><i class="led-dot ${cls}"></i>${s[0] === 'admin' ? 'admin down' : s[0]} / ${s[1]}</td><td class="mono">${ip}</td><td class="mono">${esc(extra)}</td>` +
          `<td>${o ? esc(o.d + ' ' + tight(o.p)) + ` <small>${esc(CABLES[l.cable])}</small>` : '<small>—</small>'}</td><td class="mono small">${d.kind === 'pc' ? d.mac : d.macOf(n)}</td></tr>`
      );
    }
    const hidden = d.kind === 'switch' ? ' <small>(los puertos de switch sin cable y sin configurar no se listan)</small>' : '';
    return `<h4 class="pt-h">Estado de los puertos${hidden}</h4><div class="pt-wrap"><table class="pt-table"><thead><tr><th>Puerto</th><th>Estado / protocolo</th><th>IP</th><th>Modo</th><th>Conectado a</th><th>MAC</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  }
  function physHtml(d) {
    let html = `<div class="ph-head"><b>${esc(d.id)}</b><span>${esc(d.label)} · ${MODEL_TXT[d.model]}</span>`;
    if (d.kind === 'router') html += `<span class="pw ${d.power ? 'on' : ''}">${d.power ? '● Encendido' : '○ Apagado'}</span>`;
    html += '</div>';
    const view2 = (t, svg) => `<div class="ph-view"><span class="ph-lab">${t}</span><div class="ph-dev">${svg}</div></div>`;
    if (d.kind === 'router') {
      if (d.model !== '1941') html += view2('Frontal · el interruptor está aquí', r2911Front(d));
      html += `<div class="ph-grid">${view2('Trasera · puertos y huecos EHWIC' + (d.model === '1941' ? ' · interruptor' : ''), rRear(d))}<div class="mods"><h4>Módulos</h4><p>${d.power ? '<b>Apaga</b> el router con el interruptor para poder meter o quitar módulos.' : 'Arrastra un módulo a un hueco EHWIC vacío (o elígelo y pulsa el hueco). Pulsa un módulo puesto para quitarlo.'}</p>` +
        Object.keys(MODULES)
          .map((k) => `<button type="button" class="mod${modSel === k ? ' on' : ''}" data-mod="${k}" draggable="true" aria-pressed="${modSel === k}">${modSvg(k)}<span><b>${k}</b><small>${esc(MODULES[k].desc)}</small></span></button>`)
          .join('') +
        '</div></div>';
      html += `<p class="ch-note">${d.power ? 'Encendido. En la trasera, cada GE tiene dos LED: S (velocidad) y L (enlace, verde = cable con señal). Los huecos EHWIC se numeran de derecha (0) a izquierda (3). Al apagar se pierde lo que no esté guardado.' : 'Apagado. Mete los módulos y vuelve a encenderlo: arrancará con la startup-config.'}</p>`;
    } else if (d.kind === 'switch') {
      html += view2('Frontal', switchPanel(d)) + view2('Trasera · consola y alimentación', switchRear(d));
      html += '<p class="ch-note">El 2960-24TT-L no lleva módulos: 24 puertos 10/100 (arriba los impares, abajo los pares), 2 puertos 10/100/1000 y la consola detrás. Los LED de los puertos indican el estado (modo STAT).</p>';
    } else html += view2('Frontal · monitor y torre (el botón de encendido funciona)', pcFront(d)) + view2('Trasera de la torre ATX', pcPanel(d)) + '<p class="ch-note">En Packet Tracer el PC trae la tarjeta PT-HOST-NM-1CFE en una ranura de expansión: un puerto FastEthernet0 (10/100). La placa tiene sus propios USB, vídeo y audio, pero la red va por esa tarjeta. Su IP se pone en Desktop → IP Configuration.</p>';
    html += portTable(d);
    return html;
  }
  function renderPhys() {
    if (!net) return;
    if (view === 'phys') {
      const d = net.devs[tab];
      el.phys.innerHTML = d ? physHtml(d) : '<p class="tb-empty">No hay ningún equipo. Añade uno en la pestaña Topología.</p>';
    }
    if (dw && dw.tab === 'phys' && devwin.open) renderDevWin();
  }
  const renderPhysPane = () => renderPhys();
  function togglePower() {
    const d = net.devs[tab];
    if (!d || d.kind === 'switch') return;
    if (d.kind === 'pc') {
      if (lesson.sandbox) sbCommit();
      const before = net.snapshot();
      d.power = !d.power;
      net.touch();
      printTo(d.id, d.power ? 'Packet Tracer PC Command Line 1.0' : '(PC apagado)', 'dim');
      say(d.power ? `${d.id} encendido. Conserva su configuración IP.` : `${d.id} apagado: su tarjeta de red deja de dar señal (luces rojas en el switch).`, d.power ? 'happy' : '');
      const msgs = logs(net, before, net.snapshot());
      for (const id of Object.keys(msgs)) if (terms[id]) for (const m of msgs[id]) printTo(id, m, 'log');
      renderPhys();
      renderTopo();
      renderTabs();
      return;
    }
    const before = net.snapshot();
    d.power = !d.power;
    if (d.power) {
      net.reboot(d);
      const t = terms[d.id];
      t.stack = [t.stack[0]];
      const s = t.stack[0];
      s.mode = 'user';
      s.pending = null;
      printTo(d.id, 'System Bootstrap, Version 15.1(4)M4, RELEASE SOFTWARE (fc1)', 'dim');
      printTo(d.id, 'Self decompressing the image : ########################## [OK]', 'dim');
      for (const p of d.hwPorts()) if (/^Serial/.test(p)) printTo(d.id, `%LINK-5-CHANGED: Interface ${p}, changed state to down`, 'log');
      printTo(d.id, '');
      printTo(d.id, 'Press RETURN to get started!');
      s.ask('', false, (x, r2) => s.begin(r2));
      say(d.startup ? 'Encendido. Ha cargado la configuración guardada (startup-config).' : 'Encendido. Como no había nada guardado, arranca de fábrica.', 'happy');
    } else {
      printTo(d.id, '(equipo apagado)', 'dim');
      say('Apagado. Ahora puedes meter y quitar módulos.', '');
    }
    net.touch();
    const msgs = logs(net, before, net.snapshot());
    for (const id of Object.keys(msgs)) if (id !== d.id && terms[id]) for (const m of msgs[id]) printTo(id, m, 'log');
    renderPhys();
    renderTopo();
    renderTabs();
    refreshPrompt();
    if (!lesson.mode) checkStep('', { out: '', err: '', parts: [] });
  }
  function slotAction(i, m) {
    const d = net.devs[tab];
    if (!d || d.kind !== 'router') return;
    if (m) modSel = m;
    if (d.power) {
      say('¡Quieto! Con el router encendido no se pueden cambiar módulos. Apágalo primero con el interruptor.', 'oops');
      return;
    }
    if (d.slots[i] && !m) {
      say(`Has quitado el ${d.slots[i]} del hueco ${i}.`, '');
      d.slots[i] = null;
    } else if (d.slots[i]) {
      say('Ese hueco ya está ocupado. Pulsa el módulo para quitarlo primero.', 'oops');
      return;
    } else if (!modSel) {
      say('Primero elige un módulo de la lista (o arrástralo al hueco).', 'oops');
      return;
    } else {
      d.slots[i] = modSel;
      if (modSel === 'HWIC-2T') say(`HWIC-2T en el hueco ${i}: al encender tendrás Serial0/${i}/0 y Serial0/${i}/1.`, 'happy');
      else say(`Un ${modSel} no da puertos serie. Para enlaces serie hace falta el HWIC-2T.`, 'oops');
    }
    net.links = net.links.filter((l) => [l.a, l.b].every((end) => end.d !== d.id || d.hwPorts().includes(end.p)));
    net.touch();
    renderPhys();
    renderTopo();
    if (!lesson.mode) checkStep('', { out: '', err: '', parts: [] });
  }
  for (const node of [el.phys, $('#dwBody')]) node.addEventListener('click', (e) => {
    if (e.target.closest('[data-act="power"]')) return togglePower();
    const sl = e.target.closest('[data-slot]');
    if (sl) return slotAction(+sl.dataset.slot);
    const md = e.target.closest('[data-mod]');
    if (md) {
      modSel = modSel === md.dataset.mod ? null : md.dataset.mod;
      renderPhys();
    }
  });
  for (const node of [el.phys, $('#dwBody')]) node.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.target.closest('[data-act="power"]')) {
      e.preventDefault();
      togglePower();
    } else if (e.target.closest('[data-slot]')) {
      e.preventDefault();
      slotAction(+e.target.closest('[data-slot]').dataset.slot);
    }
  });
  for (const node of [el.phys, $('#dwBody')]) node.addEventListener('dragstart', (e) => {
    const md = e.target.closest('[data-mod]');
    if (!md) return;
    modSel = md.dataset.mod;
    try {
      e.dataTransfer.setData('text/plain', modSel);
      e.dataTransfer.effectAllowed = 'copy';
    } catch (err) {}
  });
  for (const node of [el.phys, $('#dwBody')]) node.addEventListener('dragover', (e) => {
    if (e.target.closest('[data-slot]')) e.preventDefault();
  });
  for (const node of [el.phys, $('#dwBody')]) node.addEventListener('drop', (e) => {
    const sl = e.target.closest('[data-slot]');
    if (!sl) return;
    e.preventDefault();
    const d = net.devs[tab];
    if (d.slots[+sl.dataset.slot]) return say('Ese hueco ya está ocupado.', 'oops');
    slotAction(+sl.dataset.slot, modSel);
  });
  for (const b of document.querySelectorAll('.tab[data-tab]'))
    b.addEventListener('click', () => {
      view = b.dataset.tab;
      for (const x of document.querySelectorAll('.tab[data-tab]')) x.classList.toggle('on', x === b);
      el.topo.hidden = view !== 'topo';
      el.phys.hidden = view !== 'phys';
      $('#legend').hidden = view !== 'topo';
      renderSbar();
      renderPhys();
    });

  /* ---------- el paquete viajando ---------- */
  function animatePing(p) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const hops = (p.hops || []).filter((id, i, a) => i === 0 || id !== a[i - 1]).map((id) => net.devs[id]).filter(Boolean);
    if (hops.length < 2) return;
    const g = el.topo.querySelector('#pkts');
    if (!g) return;
    const pts = hops.map((d) => [d.x, d.y]);
    const back = p.ok ? pts.slice().reverse() : null;
    const env = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    env.setAttribute('class', 'pkt' + (p.ok ? '' : ' bad'));
    env.innerHTML = '<rect x="-9" y="-6" width="18" height="12" rx="2"/><path d="M-9 -6l9 7 9-7"/>';
    g.appendChild(env);
    const seg = 380;
    const path = back ? pts.concat(back.slice(1)) : pts;
    const total = (path.length - 1) * seg;
    const t0 = performance.now();
    function frame(now) {
      if (!env.isConnected) return;
      const t = Math.min(total, now - t0);
      const i = Math.min(path.length - 2, Math.floor(t / seg));
      const f = (t - i * seg) / seg;
      const x = path[i][0] + (path[i + 1][0] - path[i][0]) * f;
      const y = path[i][1] + (path[i + 1][1] - path[i][1]) * f;
      env.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      if (back && i >= pts.length - 1) env.classList.add('back');
      if (t < total) requestAnimationFrame(frame);
      else {
        if (!p.ok) env.classList.add('lost');
        setTimeout(() => env.remove(), p.ok ? 150 : 900);
      }
    }
    requestAnimationFrame(frame);
  }

  /* ---------- menú lateral ---------- */
  function renderSidebar() {
    const item = (l, num, sub) => {
      const cls = [l.id === lesson.id ? 'active' : '', done.has(l.id) ? 'done' : '', l.mode ? 'game' : ''].join(' ');
      return `<li><button type="button" class="${cls}" data-id="${l.id}"><span class="num">${num}</span><span class="tx"><b>${esc(l.title)}</b><small>${esc(sub)}</small></span></button></li>`;
    };
    const gameSub = (l) => {
      const best = store.get(bestKey(l), 0);
      return l.mode === 'arcade' ? (best ? `Récord: ${best}` : l.tag) : `${gotFlags(l)}/${setOf(l).flags.length} banderas`;
    };
    el.sidebar.innerHTML =
      LEVELS.map(
        (lv) =>
          foldHead(String(lv.n), lv.name, `${lv.list.filter((l) => done.has(l.id)).length}/${lv.list.length}`) +
          lv.list.map((l, i) => item(l, done.has(l.id) ? '✓' : i + 1, l.tag)).join('') +
          (lv.games.length ? '<li class="zone">Zona de juego</li>' + lv.games.map((l) => item(l, l.icon, gameSub(l))).join('') : '') +
          '</ol>'
      ).join('') +
      foldHead('g', 'Práctica libre', '') +
      LESSONS.filter((l) => l.mode === 'free')
        .map((l) => item(l, l.icon, l.tag))
        .join('') +
      '</ol><button type="button" class="link" id="btnWipe">Empezar de cero</button>';
  }
  el.sidebar.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (b) return startLesson(b.dataset.id);
    const f = e.target.closest('[data-fold]');
    if (f) {
      if (closed.has(f.dataset.fold)) closed.delete(f.dataset.fold);
      else closed.add(f.dataset.fold);
      store.set('rg.closed', [...closed]);
      return renderSidebar();
    }
    if (e.target.id === 'btnWipe' && confirm('¿Borrar tus puntos, logros y misiones completadas?')) {
      done = new Set();
      badges = new Set();
      flags = new Set();
      xp = 0;
      for (const k of ['done', 'badges', 'flags', 'flagvals', 'xp', 'best1', 'best2', 'best3', 'current', 'closed']) {
        try {
          localStorage.removeItem('rg.' + k);
        } catch (err) {}
      }
      assignFlags();
      renderHud();
      startLesson(LESSONS[0].id);
    }
  });

  /* ---------- misiones ---------- */
  function hintButton(cmd) {
    return `<button type="button" class="hint-cmd" data-cmd="${esc(cmd)}" title="Pulsa para llevarla a la terminal"><code>${esc(cmd)}</code><span>usar</span></button>`;
  }
  function hintFor(s) {
    if (s.go) return `<button type="button" class="hint-cmd" data-go="${esc(s.go)}"><code>Consola de ${esc(s.go)}</code><span>ir</span></button>`;
    if (s.tip) return `<p class="flag-hint">💡 ${esc(s.tip)}</p>`;
    return hintButton(s.hint);
  }
  function renderPanel() {
    if (lesson.mode === 'arcade') return renderArcade();
    if (lesson.mode === 'ctf') return renderCtf();
    renderLesson();
  }
  function renderLesson() {
    if (lesson.sandbox) {
      el.panel.innerHTML = `<div class="kicker">Práctica libre · ${esc(lesson.tag)}</div><h1>${esc(lesson.title)}</h1>` + sandboxPanelHtml();
      return;
    }
    const i = MISSIONS.indexOf(lesson);
    const finished = !lesson.mode && stepIdx >= lesson.steps.length;
    let html =
      `<div class="kicker">${lesson.mode ? 'Práctica libre' : 'Nivel ' + levelOf(lesson).n + ' · Misión ' + (levelOf(lesson).list.indexOf(lesson) + 1)} · ${esc(lesson.tag)}</div>` +
      `<h1>${esc(lesson.title)}</h1><div class="prose">${lesson.body || ''}</div>`;
    if (lesson.steps.length) {
      const pct = (Math.min(stepIdx, lesson.steps.length) / lesson.steps.length) * 100;
      html += `<h2 class="steps-title">Tu turno <span>${Math.min(stepIdx, lesson.steps.length)} / ${lesson.steps.length}</span><i class="mini-bar"><i style="width:${pct}%"></i></i></h2><ol class="steps">`;
      lesson.steps.forEach((s, k) => {
        const st = k < stepIdx ? 'done' : k === stepIdx ? 'current' : 'todo';
        const text = s.t === '…' ? (s.hint ? `<code>${esc(s.hint)}</code>` : '…') : s.t;
        if (st === 'todo' && s.t === '…') html += `<li class="todo"><span class="mk">${k + 1}</span><div><p>…</p></div></li>`;
        else {
          html += `<li class="${st}"><span class="mk">${k < stepIdx ? '✓' : k + 1}</span><div><p>${st === 'current' && s.t === '…' ? 'Sigue: ¿qué toca ahora?' : st === 'done' && s.t === '…' ? text : s.t}</p>`;
          if (st === 'current') html += hintShown || s.go ? hintFor(s) : '<button type="button" class="link" id="btnHint">Necesito una pista</button>';
          html += '</div></li>';
        }
      });
      html += '</ol>';
    }
    if (finished) {
      const next = MISSIONS[i + 1];
      const lvDone = !next || levelOf(next) !== levelOf(lesson);
      const arcade = levelOf(lesson).games.find((g) => g.mode === 'arcade');
      html +=
        '<div class="finish"><div class="big">✓</div><div><b>¡Misión superada!</b>' +
        `<p>${!next ? 'Has completado todas las misiones. Ya puedes con el examen.' : lvDone ? '¡Nivel completado! Ahora viene lo serio.' : 'Una menos. La siguiente te espera.'}</p>` +
        (next ? `<button type="button" class="btn primary" data-next="${next.id}">${lvDone ? 'Empezar el nivel ' + levelOf(next).n : 'Siguiente'}: ${esc(next.title)} →</button>` : '') +
        (lvDone && arcade ? ` <button type="button" class="btn${next ? '' : ' primary'}" data-next="${arcade.id}">Zona de juego del nivel ${levelOf(lesson).n}</button>` : '') +
        '</div></div>';
    }
    el.panel.innerHTML = html;
    const cur = el.panel.querySelector('.steps .current, .finish');
    if (cur && stepIdx > 0) cur.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  el.panel.addEventListener('click', (e) => {
    if (e.target.id === 'btnHint') {
      hintShown = true;
      usedHint = true;
      renderLesson();
      return;
    }
    const g = e.target.closest('[data-go]');
    if (g) return goDevice(g.dataset.go);
    const h = e.target.closest('.hint-cmd');
    if (h) return useCommand(h.dataset.cmd);
    const n = e.target.closest('[data-next]');
    if (n) return startLesson(n.dataset.next);
    const code = e.target.closest('.cards code');
    if (code) return useCommand(code.textContent);
    if (e.target.closest('#arcStart')) return arcStart();
    if (e.target.closest('#arcSkip')) return arcSkip();
    if (e.target.closest('#ctfReset')) {
      for (const f of setOf(lesson).flags) flags.delete(f.id);
      assignFlags(setOf(lesson).flags);
      store.set('rg.flags', [...flags]);
      return startLesson(lesson.id);
    }
    const fh = e.target.closest('[data-flaghint]');
    if (fh) {
      ctfHints.add(fh.dataset.flaghint);
      renderCtf();
    }
  });
  function ctx(line, r) {
    const s = ses();
    return { line, r, net, ses: s, at: s.dev.id, tab };
  }
  function checkStep(line, r) {
    let step = lesson.steps[stepIdx];
    if (!step) return false;
    let n = 0;
    while (step) {
      let pass = false;
      try {
        pass = step.ok(ctx(line, r));
      } catch (e) {
        pass = false;
      }
      if (!pass) break;
      n++;
      advance();
      step = lesson.steps[stepIdx];
      /* en el examen (y en los pasos de "ir a la consola") se marcan solos los que ya estén hechos */
      if (!lesson.exam && !(step && step.go && tab === step.go)) break;
      r = { out: '', err: '', parts: [] };
      line = '';
    }
    if (!n) return false;
    renderLesson();
    return true;
  }
  function advance() {
    const fresh = !done.has(lesson.id);
    const gain = fresh ? (hintShown ? 5 : 10) : 0;
    stepIdx++;
    hintShown = false;
    if (stepIdx >= lesson.steps.length) {
      done.add(lesson.id);
      store.set('rg.done', [...done]);
      print('✓ ¡Misión superada!' + (fresh ? `  +${gain + 50} XP` : ''), 'ok');
      say('¡Misión superada! Eres una máquina.', 'happy');
      confetti(90);
      if (fresh) addXp(gain + 50);
      if (!usedHint) award('nohint');
      for (const lv of LEVELS) if (lv.list.every((l) => done.has(l.id))) award(lv.n === 1 ? 'all' : 'all' + lv.n);
      renderSidebar();
    } else {
      print('✓ Paso ' + stepIdx + (gain ? `  +${gain} XP` : ''), 'ok');
      say(pick(CHEERS), 'happy');
      addXp(gain);
    }
  }

  /* ---------- contrarreloj ---------- */
  const ARC_TIME = 90;
  function renderArcade() {
    const best = store.get(bestKey(lesson), 0);
    let html = `<div class="kicker">Nivel ${lesson.glevel || 1} · Zona de juego · ${ARC_TIME} segundos</div><h1>Contrarreloj</h1>`;
    if (!arc) {
      html +=
        '<div class="prose"><p>Pix te pide algo y tú escribes la orden. Cada reto empieza en el modo y el equipo que hace falta (mira el prompt). Cada acierto suma, y si encadenas varios, el <b>combo</b> multiplica. Las abreviaturas valen.</p></div>' +
        `<div class="arc-idle"><div class="arc-best"><small>Tu récord</small><b>${best}</b></div><button type="button" class="btn primary big" id="arcStart">▶ Empezar</button></div>` +
        '<p class="note">¿Te atascas? Pulsa «Saltar»: pierdes el combo, pero ves cómo se hacía.</p>';
    } else if (!arc.over) {
      html +=
        '<div class="arc-hud">' +
        `<div><small>Puntos</small><b>${arc.score}</b></div>` +
        `<div class="${arc.combo > 1 ? 'hot' : ''}"><small>Combo</small><b>x${Math.max(arc.combo, 1)}</b></div>` +
        `<div><small>Tiempo</small><b id="arcSecs">${ARC_TIME}</b></div></div>` +
        '<div class="arc-time"><i id="arcBar"></i></div>' +
        `<div class="arc-card"><small>Reto ${arc.hits + arc.skips + 1} · en ${esc(arc.cur.dev)}</small><p>${arc.cur.goal}</p></div>` +
        '<button type="button" class="btn" id="arcSkip">Saltar →</button>';
    } else {
      html +=
        `<div class="arc-result"><div class="arc-best"><small>${arc.record ? '¡Nuevo récord!' : 'Puntuación'}</small><b>${arc.score}</b></div>` +
        `<p>${arc.hits} ${arc.hits === 1 ? 'acierto' : 'aciertos'} · mejor combo x${Math.max(arc.maxCombo, 1)} · +${arc.hits * 5} XP</p>` +
        `<p class="note">Tu récord: ${Math.max(best, arc.score)}</p><button type="button" class="btn primary big" id="arcStart">↻ Otra vez</button></div>`;
    }
    el.panel.innerHTML = html;
    if (arc && !arc.over) arcTick();
  }
  function arcStart() {
    arcStop();
    arc = { end: Date.now() + ARC_TIME * 1000, score: 0, combo: 0, maxCombo: 0, hits: 0, skips: 0, cur: null, over: false };
    arcNext();
    arc.timer = setInterval(arcTick, 100);
    say('¡Vamos! Lee el reto, mira el prompt y escribe.', 'happy');
    renderArcade();
    el.input.focus();
  }
  function arcStop() {
    if (arc && arc.timer) clearInterval(arc.timer);
  }
  function arcNext() {
    let c;
    do c = pick(setOf(lesson).challenges);
    while (c === arc.cur && setOf(lesson).challenges.length > 1);
    arc.cur = c;
    const level = lesson.glevel || 1;
    buildWorld(window.GAMES.arcScene(level), c.dev);
    if (c.prep) window.SCENES.conf(net, c.dev === 'PC1' ? 'R1' : c.dev, c.prep);
    if (c.pcs || level >= 2) window.SCENES.pc(net, 'PC1', level === 3 ? '192.168.10.10/24' : '192.168.1.10/24', level === 3 ? '192.168.10.1' : '192.168.1.1');
    if (c.dhcp) window.SCENES.conf(net, 'R1', 'ip dhcp pool LAN\nnetwork 192.168.1.0 255.255.255.0\ndefault-router 192.168.1.1');
    if (level === 1 && c.dev === 'PC1') window.SCENES.conf(net, 'R1', 'interface g0/0\nip address 192.168.1.1 255.255.255.0\nno shutdown');
    window.GAMES.place(ses(), c.at);
    for (const id of Object.keys(terms)) terms[id].box.innerHTML = '';
    showTab(c.dev);
  }
  function arcTick() {
    if (!arc || arc.over) return;
    const left = Math.max(0, arc.end - Date.now());
    const bar = $('#arcBar');
    if (bar) {
      bar.style.width = (left / (ARC_TIME * 1000)) * 100 + '%';
      bar.classList.toggle('low', left < 15000);
      $('#arcSecs').textContent = Math.ceil(left / 1000);
    }
    if (left <= 0) arcEnd();
  }
  function arcCheck(line, r) {
    if (!arc || arc.over) return false;
    let pass = false;
    try {
      pass = arc.cur.ok(ctx(line, r));
    } catch (e) {
      pass = false;
    }
    if (pass) {
      arc.combo++;
      arc.maxCombo = Math.max(arc.maxCombo, arc.combo);
      const pts = 100 + (arc.combo - 1) * 25;
      arc.score += pts;
      arc.hits++;
      say(arc.combo > 2 ? `¡Combo x${arc.combo}!` : pick(CHEERS), 'happy');
      setTimeout(() => {
        if (!arc || arc.over) return;
        arcNext();
        printTo(tab, `✓ +${pts}` + (arc.combo > 1 ? `   combo x${arc.combo}` : ''), 'ok');
        renderArcade();
      }, 350);
    } else if (line.trim() && !(ses().pending)) arc.combo = 0;
    renderArcade();
    return pass;
  }
  function arcSkip() {
    if (!arc || arc.over) return;
    const sol = arc.cur.sol;
    arc.combo = 0;
    arc.skips++;
    arcNext();
    print('Se podía hacer con:  ' + sol, 'dim');
    renderArcade();
    scrollTerm();
    el.input.focus();
  }
  function arcEnd() {
    arcStop();
    arc.over = true;
    const best = store.get(bestKey(lesson), 0);
    arc.record = arc.score > best && arc.score > 0;
    if (arc.record) store.set(bestKey(lesson), arc.score);
    print(`⏱ ¡Tiempo! ${arc.score} puntos.`, 'ok');
    say(arc.record ? '¡Nuevo récord! Enséñaselo a alguien.' : arc.hits ? 'Nada mal. ¿Otra para superarte?' : 'El primero siempre cuesta. Repasa una misión y vuelve.', arc.hits ? 'happy' : '');
    if (arc.record) confetti(90);
    addXp(arc.hits * 5);
    if (arc.hits >= 8) award('speed');
    renderArcade();
    renderSidebar();
    scrollTerm();
  }

  /* ---------- caza de banderas ---------- */
  function renderCtf() {
    const FLAGS = setOf(lesson).flags;
    const got = gotFlags(lesson);
    let html =
      `<div class="kicker">Nivel ${lesson.glevel || 1} · Zona de juego · ${FLAGS.length} secretos · ${esc(lesson.tag)}</div><h1>Caza de banderas</h1>` +
      '<div class="prose"><p>Alguien ha escondido banderas con la forma <code>FLAG{...}</code> en los equipos de esta red. Para capturar una, haz que aparezca en tu consola <b>en una salida corta</b>: soltar un <code>show running-config</code> entero no vale. Usa <code>| include</code>, los <code>show</code> justos, Telnet, SSH… como un administrador de verdad.</p>' +
      '<p class="note">Tus banderas son únicas: los números de dentro son distintos en cada ordenador.</p></div>' +
      `<div class="flag-count">${FLAGS.map((f) => `<i class="${flags.has(f.id) ? 'on' : ''}">🚩</i>`).join('')}<span>${got} de ${FLAGS.length}</span></div><ol class="flags">`;
    FLAGS.forEach((f, i) => {
      const g = flags.has(f.id);
      html += `<li class="${g ? 'got' : ''}"><span class="mk">${g ? '✓' : i + 1}</span><div><b>${esc(f.name)}</b><p>${esc(f.clue)}</p>`;
      if (g) html += `<code class="flag">${esc(f.flag)}</code>`;
      else if (ctfHints.has(f.id)) html += `<p class="flag-hint">💡 ${esc(f.hint)}</p>`;
      else html += `<button type="button" class="link" data-flaghint="${f.id}">Necesito una pista</button>`;
      html += '</div></li>';
    });
    html += '</ol>';
    if (got === FLAGS.length) html += '<div class="finish"><div class="big">🚩</div><div><b>¡Las tienes todas!</b><p>' + esc(lesson.outro || '') + '</p><button type="button" class="btn" id="ctfReset">Volver a esconderlas</button></div></div>';
    el.panel.innerHTML = html;
  }
  function ctfCheck(r) {
    let hit = false;
    const FLAGS = setOf(lesson).flags;
    const max = setOf(lesson).maxLines;
    const long = max && r.out.split('\n').filter((l) => l.trim()).length > max;
    if (long && FLAGS.some((f) => !flags.has(f.id) && r.out.includes(f.flag))) {
      say('Ahí dentro hay una bandera, pero entre tanto texto no cuenta. Afina: | include, o un show más concreto.', 'oops');
      return true;
    }
    for (const f of FLAGS) {
      if (flags.has(f.id) || !r.out.includes(f.flag)) continue;
      hit = true;
      flags.add(f.id);
      store.set('rg.flags', [...flags]);
      print(`🚩 Bandera capturada: ${f.name}   +40 XP`, 'ok');
      say(`¡Bandera! Llevas ${gotFlags(lesson)} de ${FLAGS.length}.`, 'happy');
      confetti(50);
      addXp(40);
    }
    if (hit) {
      if (gotFlags(lesson) === FLAGS.length) award('ctf');
      if (ALL_FLAGS.every((f) => flags.has(f.id))) award('ctfall');
      renderCtf();
      renderSidebar();
    }
    return hit;
  }

  /* ---------- lienzo libre: dibuja tu red como en Packet Tracer ---------- */
  const SB_W = 760;
  const SB_H = 400;
  const SB_WORLD = [1600, 900];
  const SB_KEY = 'rg.sandbox';
  const SB_DEVS = [
    { model: '2911', kind: 'router', name: 'Router 2911', short: '2911', pre: 'R' },
    { model: '1941', kind: 'router', name: 'Router 1941', short: '1941', pre: 'R' },
    { model: '2960', kind: 'switch', name: 'Switch 2960', short: '2960', pre: 'S' },
    { model: 'PC', kind: 'pc', name: 'PC', short: 'PC', pre: 'PC' },
    { model: 'SRV', kind: 'pc', name: 'Servidor', short: 'Server', pre: 'SRV' },
  ];
  const SB_CABLES = ['auto', 'straight', 'cross', 'serial', 'console'];
  const SB_CAB_TXT = { auto: 'Auto', straight: 'Directo', cross: 'Cruzado', serial: 'Serie', console: 'Consola' };
  const AREA_COLORS = ['#2d5be3', '#12804e', '#d93a24', '#c98a00', '#8b5cf6'];
  const sb = { tool: 'select', model: null, cable: null, first: null, drag: null, mouse: null, pan: null, draft: null, view: { x: 0, y: 0, w: SB_W, h: SB_H }, snap: store.get('rg.sbsnap', false), undo: [], redo: [], pdus: [], reto: store.get('rg.sbreto', null) };
  const clampW = (x, y) => [Math.round(Math.max(40, Math.min(SB_WORLD[0] - 40, x))), Math.round(Math.max(40, Math.min(SB_WORLD[1] - 50, y)))];
  const snapP = (p) => (sb.snap ? [Math.round(p[0] / 20) * 20, Math.round(p[1] / 20) * 20] : p);
  function sbViewBox() {
    const v = sb.view;
    return `${v.x.toFixed(1)} ${v.y.toFixed(1)} ${v.w.toFixed(1)} ${v.h.toFixed(1)}`;
  }
  function sbHint() {
    if (sb.tool === 'place') return `Pulsa en el lienzo (o arrastra el botón) para colocar un ${SB_DEVS.find((x) => x.model === sb.model).name}. Esc para terminar.`;
    if (sb.tool === 'cable') {
      if (sb.cable === 'auto') return sb.first ? `Cable automático desde ${sb.first.dev}: pulsa el otro equipo.` : 'Cable automático (el rayo de PT): pulsa un equipo y luego otro; elige solo puertos y tipo de cable.';
      return sb.first ? `${CABLES[sb.cable]} desde ${sb.first.dev} ${tight(sb.first.port)}: ahora pulsa el otro equipo. Esc para cancelar.` : `${CABLES[sb.cable]}: pulsa el primer equipo y elige su puerto${sb.cable === 'serial' ? ' (ese extremo será el DCE)' : ''}.`;
    }
    if (sb.tool === 'pdu') return sb.first ? `PDU simple desde ${sb.first.dev}: pulsa el equipo de destino.` : 'PDU simple (el sobre de PT): pulsa el equipo de origen y luego el de destino.';
    if (sb.tool === 'note') return 'Nota: pulsa en el lienzo donde quieras escribirla. Doble clic en una nota para editarla.';
    if (sb.tool === 'area') return 'Zona: arrastra en el lienzo para dibujar un recuadro de color (sede, planta…). Doble clic para ponerle nombre.';
    if (sb.tool === 'delete') return 'Goma: pulsa un equipo, un cable, una nota o una zona para quitarlo. Esc para terminar.';
    return net && net.order.length ? 'Arrastra para mover · clic = consola · doble clic = ventana del equipo · arrastra el fondo para desplazarte · rueda = zoom · Supr borra · Ctrl+Z deshace.' : 'Arrastra un equipo de la barra al lienzo (o elígelo y pulsa en el lienzo).';
  }
  function miniIcon(kind) {
    return `<svg viewBox="-34 -26 68 46" aria-hidden="true"><g class="dev ${kind}">${iconSvg(kind)}</g></svg>`;
  }
  const tbtn = (attr, on, icon, txt, title, extra) => `<button type="button" class="sb-btn${on ? ' on' : ''}${extra || ''}" ${attr} title="${esc(title)}" aria-label="${esc(title)}"${on != null ? ` aria-pressed="${!!on}"` : ''}>${icon}<span>${txt}</span></button>`;
  function renderSbar() {
    const bar = $('#sbar');
    const on = !!(lesson && lesson.sandbox) && view === 'topo';
    bar.hidden = !on;
    if (!on) return;
    const T = sb.tool;
    bar.innerHTML =
      '<div class="sb-group">' + SB_DEVS.map((x) => tbtn(`data-sbdev="${x.model}" draggable="true"`, T === 'place' && sb.model === x.model, miniIcon(x.kind), x.short, `Añadir ${x.name} (arrástralo al lienzo)`)).join('') + '</div>' +
      '<div class="sb-group">' + SB_CABLES.map((c) => tbtn(`data-sbcable="${c}"`, T === 'cable' && sb.cable === c, c === 'auto' ? '<b class="bolt">⚡</b>' : '<i></i>', SB_CAB_TXT[c], c === 'auto' ? 'Cable automático: elige solo puertos y tipo' : 'Cable: ' + CABLES[c], ' cab ' + c)).join('') + '</div>' +
      '<div class="sb-group">' +
      tbtn('data-sbtool="select"', T === 'select', '↖', 'Mover', 'Seleccionar y mover') +
      tbtn('data-sbtool="pdu"', T === 'pdu', '✉', 'PDU', 'PDU simple: ping de un equipo a otro') +
      tbtn('data-sbtool="note"', T === 'note', '🗒', 'Nota', 'Añadir una nota de texto') +
      tbtn('data-sbtool="area"', T === 'area', '▭', 'Zona', 'Dibujar una zona de color') +
      tbtn('data-sbtool="delete"', T === 'delete', '⌫', 'Goma', 'Borrar') +
      '</div><div class="sb-group ico">' +
      tbtn('data-sbed="undo"', null, '↶', 'Deshacer', `Deshacer (Ctrl+Z)${sb.undo.length ? '' : ': nada que deshacer'}`, sb.undo.length ? '' : ' dim') +
      tbtn('data-sbed="redo"', null, '↷', 'Rehacer', 'Rehacer (Ctrl+Y)', sb.redo.length ? '' : ' dim') +
      tbtn('data-sbed="dup"', null, '⧉', 'Duplicar', 'Duplicar el equipo seleccionado (Ctrl+D)') +
      tbtn('data-sbed="rename"', null, '✎', 'Nombre', 'Cambiar el nombre del equipo seleccionado') +
      tbtn('data-sbed="snap"', sb.snap, '⌗', 'Imán', 'Ajustar a la rejilla') +
      '</div><div class="sb-group ico">' +
      tbtn('data-sbzoom="in"', null, '＋', 'Zoom', 'Acercar') +
      tbtn('data-sbzoom="out"', null, '－', 'Zoom', 'Alejar') +
      tbtn('data-sbzoom="fit"', null, '⤢', 'Ajustar', 'Ver toda la red') +
      '</div><div class="sb-group ico">' +
      tbtn('data-sbfile="save"', null, '⭳', 'Guardar', 'Descargar la red como archivo .json') +
      tbtn('data-sbfile="open"', null, '⭱', 'Abrir', 'Abrir una red guardada') +
      tbtn('data-sbfile="clear"', null, '✕', 'Vaciar', 'Empezar con el lienzo vacío') +
      `</div><p class="sb-hint">${esc(sbHint())}</p>`;
  }
  /* fondo, zonas y goma elástica (debajo de los cables y equipos) */
  function sbUnder() {
    let s = `<rect x="-2000" y="-2000" width="${SB_WORLD[0] + 4000}" height="${SB_WORLD[1] + 4000}" class="sb-bg" data-sbbg="1"/><rect x="0" y="0" width="${SB_WORLD[0]}" height="${SB_WORLD[1]}" class="sb-world" data-sbbg="1"/>`;
    for (const a of net.areas || [])
      s += `<g class="sb-area" data-area="${a.id}"><title>${esc(a.label || 'Zona')} (doble clic para cambiar el nombre)</title><rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" rx="6" style="fill:${a.color};stroke:${a.color}"/>${a.label ? `<text x="${a.x + 10}" y="${a.y + 18}" style="fill:${a.color}">${esc(a.label)}</text>` : ''}</g>`;
    if (sb.draft) {
      const d = sb.draft;
      s += `<rect x="${Math.min(d.x0, d.x1)}" y="${Math.min(d.y0, d.y1)}" width="${Math.abs(d.x1 - d.x0)}" height="${Math.abs(d.y1 - d.y0)}" class="sb-draft"/>`;
    }
    if (!net.order.length && !(net.notes || []).length) s += `<text x="${SB_W / 2}" y="${SB_H / 2}" class="sb-empty">Lienzo vacío: arrastra aquí un equipo de la barra</text>`;
    if ((sb.tool === 'cable' || sb.tool === 'pdu') && sb.first && sb.mouse) {
      const A = net.devs[sb.first.dev];
      if (A) s += `<line x1="${A.x}" y1="${A.y}" x2="${sb.mouse[0]}" y2="${sb.mouse[1]}" class="sb-rubber ${sb.tool === 'pdu' ? 'pdu' : sb.cable}"/>`;
    }
    return s;
  }
  /* notas (encima de todo) */
  function sbOver() {
    let s = '';
    for (const n of net.notes || []) {
      const w = Math.max(60, Math.min(320, n.text.length * 6.9 + 18));
      s += `<g class="sb-note" data-note="${n.id}"><title>Nota (doble clic para editar)</title><rect x="${n.x}" y="${n.y}" width="${w}" height="24" rx="2"/><text x="${n.x + 9}" y="${n.y + 16}">${esc(n.text)}</text></g>`;
    }
    return s;
  }
  function svgPoint(e) {
    const svg = el.topo.querySelector('.topo-main');
    if (!svg || !svg.getScreenCTM()) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [p.x, p.y];
  }
  function sbNextId(pre) {
    let n = 1;
    while (net.devs[pre + n]) n++;
    return pre + n;
  }
  /* ---- deshacer / rehacer ---- */
  function sbCommit() {
    sb.undo.push(JSON.stringify(sbSerialize()));
    if (sb.undo.length > 60) sb.undo.shift();
    sb.redo = [];
  }
  function sbRestore(json, keepTab) {
    const n = sbBuild(JSON.parse(json));
    buildWorld(n, keepTab && n.devs[keepTab] ? keepTab : n.order[0] ? n.order[0].id : null);
  }
  function sbUndo(redo) {
    const from = redo ? sb.redo : sb.undo;
    const to = redo ? sb.undo : sb.redo;
    if (!from.length) return say(redo ? 'No hay nada que rehacer.' : 'No hay nada que deshacer.', '');
    to.push(JSON.stringify(sbSerialize()));
    sbRestore(from.pop(), tab);
    say(redo ? 'Rehecho.' : 'Deshecho. (Las consolas se reinician, pero la configuración sigue.)', '');
  }
  /* ---- equipos ---- */
  function sbAdd(model, x, y) {
    const spec = SB_DEVS.find((q) => q.model === model);
    if (!spec) return;
    sbCommit();
    const id = sbNextId(spec.pre);
    const [px, py] = clampW(...snapP([x, y]));
    net.add(id, model, px, py);
    mkTerm(id);
    for (const b of el.out.children) b.hidden = b.dataset.dev !== tab;
    if (!tab) showTab(id);
    say(`${id} añadido (${spec.name}). ${spec.kind === 'router' ? 'Para cables serie le hace falta un HWIC-2T (doble clic → Physical).' : spec.kind === 'pc' ? 'Doble clic → Desktop → IP Configuration para darle IP.' : 'Los puertos del switch ya vienen encendidos.'}`, 'happy');
    renderTabs();
    renderTopo();
  }
  function sbRemove(id) {
    sbCommit();
    const before = net.snapshot();
    net.links = net.links.filter((l) => l.a.d !== id && l.b.d !== id);
    delete net.devs[id];
    net.order = net.order.filter((d) => d.id !== id);
    net.touch();
    if (terms[id]) terms[id].box.remove();
    delete terms[id];
    printLogs(before);
    closeDevWin(id);
    if (tab === id) showTab(net.order[0] ? net.order[0].id : null);
    else {
      renderTabs();
      renderTopo();
    }
    say(`${id} eliminado, con sus cables.`, '');
  }
  function sbDuplicate() {
    const d = net.devs[tab];
    if (!d) return say('Primero selecciona un equipo (púlsalo).', 'oops');
    sbCommit();
    const spec = SB_DEVS.find((q) => q.model === d.model);
    const id = sbNextId(spec.pre);
    const [x, y] = clampW(d.x + 50, d.y + 40);
    const c = net.add(id, d.model, x, y);
    if (d.slots) c.slots = d.slots.slice();
    if (d.kind === 'pc') Object.assign(c.pc, { gw: d.pc.gw, dns: d.pc.dns, dhcp: d.pc.dhcp, mask: d.pc.dhcp ? null : d.pc.mask });
    else {
      c.cfg = window.NET.clone(d.cfg);
      for (const p of c.hwPorts()) if (!c.cfg.ifs[p]) c.cfg.ifs[p] = window.NET.mkIf(p, c.kind);
    }
    c.power = d.power;
    net.touch();
    mkTerm(id);
    for (const b of el.out.children) b.hidden = b.dataset.dev !== tab;
    say(`${id} es una copia de ${d.id}${d.kind === 'pc' ? ' (sin IP, para que no choque)' : ' con su misma configuración'}.`, 'happy');
    renderTabs();
    renderTopo();
  }
  function sbRename(old, nu) {
    const d = net.devs[old];
    if (!d) return say('Primero selecciona un equipo (púlsalo).', 'oops');
    if (nu == null) nu = prompt(`Nuevo nombre para ${old} (el que se ve en el dibujo):`, old);
    if (nu == null) return;
    nu = nu.trim();
    if (nu === old) return;
    if (!/^[A-Za-z][\w-]{0,11}$/.test(nu)) return say('Nombre no válido: empieza por letra, sin espacios, hasta 12 caracteres.', 'oops');
    if (net.devs[nu]) return say(`Ya hay un equipo llamado ${nu}.`, 'oops');
    sbCommit();
    const data = sbSerialize();
    for (const x of data.devs) {
      if (x.id === old) x.id = nu;
      if (x.binds) for (const k of Object.keys(x.binds)) if (x.binds[k].pc === old) x.binds[k].pc = nu;
    }
    for (const l of data.links) {
      if (l.a.d === old) l.a.d = nu;
      if (l.b.d === old) l.b.d = nu;
      if (l.dce === old) l.dce = nu;
    }
    const n = sbBuild(data);
    buildWorld(n, nu);
    say(`${old} ahora se llama ${nu} en el dibujo. Ojo: el hostname (el del prompt) se cambia aparte, con hostname.`, 'happy');
    if (dw) openDevWin(nu, dw.tab);
  }
  function printLogs(before) {
    const msgs = logs(net, before, net.snapshot());
    for (const id of Object.keys(msgs)) if (terms[id]) for (const m of msgs[id]) printTo(id, m, 'log');
  }
  /* ---- cables ---- */
  function sbPortPick(d, e, cb) {
    const serialCable = sb.cable === 'serial';
    const ports = d.hwPorts().filter((p) => (serialCable ? /^Serial/.test(p) : !/^Serial/.test(p)));
    let html = `<b>${esc(d.id)} · ${esc(d.label)}</b><small>${sb.first ? 'Puerto del segundo extremo' : 'Puerto del primer extremo'}</small>`;
    if (!ports.length) html += `<p class="sb-none">${serialCable ? 'No tiene puertos serie. Doble clic en el router → Physical: apágalo y ponle un HWIC-2T.' : 'No tiene puertos para este cable.'}</p>`;
    else {
      html += '<div class="sb-ports">';
      for (const p of ports) {
        const l = net.linkAt(d.id, p);
        const busy = l ? net.other(l, d.id, p).d : null;
        html += `<button type="button" class="sb-port" data-sbport="${esc(p)}"${busy ? ' disabled' : ''} title="${esc(p)}${busy ? ' (ocupado por ' + busy + ')' : ''}">${esc(tight(p))}${busy ? `<small>→ ${esc(busy)}</small>` : ''}</button>`;
      }
      html += '</div>';
    }
    if (sb.cable === 'console') html += '<p class="sb-none">Ojo: el cable de consola solo sirve para configurar; no pasa datos.</p>';
    html += '<button type="button" class="link" data-sbport="">Cancelar</button>';
    el.pick.innerHTML = html;
    el.pick.hidden = false;
    el.pick.classList.add('wide');
    el.pick.style.left = Math.min(window.innerWidth - 300, Math.max(8, (e.clientX || 300) - 120)) + 'px';
    el.pick.style.top = Math.min(window.innerHeight - 320, Math.max(8, (e.clientY || 300) - 40)) + 'px';
    sbPick = cb;
    const first = el.pick.querySelector('[data-sbport]:not([disabled])');
    if (first) first.focus();
  }
  let sbPick = null;
  el.pick.addEventListener(
    'click',
    (e) => {
      const b = e.target.closest('[data-sbport]');
      if (!b || !sbPick) return;
      e.stopPropagation();
      el.pick.hidden = true;
      el.pick.classList.remove('wide');
      const cb = sbPick;
      sbPick = null;
      cb(b.dataset.sbport || null);
    },
    true
  );
  /* puerto libre que elegiría el cable automático de Packet Tracer */
  function autoPort(d, other) {
    const free = d.hwPorts().filter((p) => !net.linkAt(d.id, p));
    const fa = free.filter((p) => /^Fast/.test(p));
    const gi = free.filter((p) => /^Gig/.test(p));
    if (d.kind === 'switch') return (other.kind === 'pc' ? fa.concat(gi) : gi.concat(fa))[0] || null;
    return gi.concat(fa)[0] || null;
  }
  function sbMakeLink(a, pa, b, pb, cable) {
    sbCommit();
    const before = net.snapshot();
    net.link(a, pa, b, pb, cable, a);
    printLogs(before);
    const A = net.devs[a];
    const B = net.devs[b];
    const right = net.rightCable(A, B, pa);
    const nm = (d) => (d.kind === 'pc' ? 'un PC' : d.kind === 'router' ? 'un router' : 'un switch');
    if (cable === 'console') say('Cable de consola puesto, pero no lleva datos: el enlace queda en rojo. Para pasar tráfico usa cobre o serie.', 'oops');
    else if (right !== cable) say(`Conectado, pero entre ${nm(A)} y ${nm(B)} va ${CABLES[right].toLowerCase()}: este enlace no funcionará (luces rojas).`, 'oops');
    else say(`${a} ${tight(pa)} ↔ ${b} ${tight(pb)} con ${CABLES[cable].toLowerCase()}.${cable === 'serial' ? ' ' + a + ' es el DCE: ahí va el clock rate.' : ''}`, 'happy');
  }
  function sbCableClick(d, e) {
    if (sb.cable === 'auto') {
      if (!sb.first) {
        sb.first = { dev: d.id };
        renderSbar();
        return;
      }
      if (sb.first.dev === d.id) return say('Pulsa otro equipo distinto.', 'oops');
      const A = net.devs[sb.first.dev];
      let pa = autoPort(A, d);
      let pb = autoPort(d, A);
      let cable = pa && pb ? net.rightCable(A, d, pa) : null;
      if ((!pa || !pb) && A.kind === 'router' && d.kind === 'router') {
        pa = A.hwPorts().find((p) => /^Serial/.test(p) && !net.linkAt(A.id, p));
        pb = d.hwPorts().find((p) => /^Serial/.test(p) && !net.linkAt(d.id, p));
        cable = 'serial';
      }
      if (!pa || !pb) {
        say(`No quedan puertos libres compatibles en ${!pa ? A.id : d.id}.`, 'oops');
      } else sbMakeLink(A.id, pa, d.id, pb, cable);
      sb.first = null;
      sb.mouse = null;
      renderSbar();
      renderTopo();
      return;
    }
    sbPortPick(d, e, (port) => {
      if (!port) return;
      if (!sb.first) {
        sb.first = { dev: d.id, port };
        renderSbar();
        return;
      }
      if (sb.first.dev === d.id) return say('Un cable une dos equipos distintos. Pulsa el otro extremo.', 'oops');
      sbMakeLink(sb.first.dev, sb.first.port, d.id, port, sb.cable);
      sb.first = null;
      sb.mouse = null;
      renderSbar();
      renderTopo();
    });
  }
  /* ---- PDU simple ---- */
  function dstIpOf(d) {
    if (d.kind === 'pc') return d.pc.ip;
    const l3 = net.l3(d);
    const up = l3.find((x) => x.up);
    return (up || l3[0] || {}).ip != null ? (up || l3[0]).ip : null;
  }
  function sbPdu(d) {
    if (!sb.first) {
      if (dstIpOf(d) == null) return say(`${d.id} no tiene IP: no puede enviar un PDU.`, 'oops');
      sb.first = { dev: d.id };
      renderSbar();
      return;
    }
    const src = net.devs[sb.first.dev];
    sb.first = null;
    sb.mouse = null;
    if (src === d) return say('Origen y destino son el mismo equipo.', 'oops');
    const ip = dstIpOf(d);
    if (ip == null) return say(`${d.id} no tiene IP: no se le puede enviar nada.`, 'oops');
    const r = net.ping(src, ip);
    animatePing({ from: src.id, to: ip, ok: r.ok, hops: r.hops });
    sb.pdus.unshift({ n: sb.pdus.length + 1, src: src.id, dst: d.id, ip, ok: r.ok });
    sb.pdus = sb.pdus.slice(0, 8);
    say(r.ok ? `PDU de ${src.id} a ${d.id} (${n2ip(ip)}): Successful.` : `PDU de ${src.id} a ${d.id} (${n2ip(ip)}): Failed. Revisa IPs, puertas de enlace, rutas y cables.`, r.ok ? 'happy' : 'oops');
    renderSbar();
    renderTopo();
    renderPdus();
  }
  function renderPdus() {
    let box = el.topo.querySelector('.pdus');
    const show = lesson && lesson.sandbox && sb.pdus.length;
    if (!show) {
      if (box) box.remove();
      return;
    }
    if (!box) {
      box = document.createElement('div');
      box.className = 'pdus';
      el.topo.appendChild(box);
    }
    box.innerHTML =
      '<div class="pdus-h"><b>PDU simples</b><button type="button" class="link" data-pduclear>borrar</button></div><table><thead><tr><th>Estado</th><th>Origen</th><th>Destino</th></tr></thead><tbody>' +
      sb.pdus.map((p) => `<tr class="${p.ok ? 'ok' : 'bad'}"><td>${p.ok ? '● Successful' : '● Failed'}</td><td>${esc(p.src)}</td><td>${esc(p.dst)} <small>${n2ip(p.ip)}</small></td></tr>`).join('') +
      '</tbody></table>';
  }
  el.topo.addEventListener('click', (e) => {
    if (e.target.closest('[data-pduclear]')) {
      sb.pdus = [];
      renderPdus();
    }
  });
  /* ---- zoom y desplazamiento ---- */
  function sbZoom(f, cx, cy) {
    const v = sb.view;
    const nw = Math.max(300, Math.min(SB_WORLD[0] + 400, v.w * f));
    const k = nw / v.w;
    if (cx == null) {
      cx = v.x + v.w / 2;
      cy = v.y + v.h / 2;
    }
    v.x = cx - (cx - v.x) * k;
    v.y = cy - (cy - v.y) * k;
    v.w = nw;
    v.h = v.h * k;
    renderTopo();
  }
  function sbFit() {
    const pts = net.order.map((d) => [d.x, d.y]).concat((net.notes || []).map((n) => [n.x + 60, n.y + 12])).concat((net.areas || []).flatMap((a) => [[a.x, a.y], [a.x + a.w, a.y + a.h]]));
    if (!pts.length) sb.view = { x: 0, y: 0, w: SB_W, h: SB_H };
    else {
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      let x0 = Math.min(...xs) - 140;
      let y0 = Math.min(...ys) - 70;
      let w = Math.max(...xs) + 90 - x0;
      let h = Math.max(...ys) + 80 - y0;
      const ar = SB_W / SB_H;
      if (w / h < ar) {
        const nw = h * ar;
        x0 -= (nw - w) / 2;
        w = nw;
      } else {
        const nh = w / ar;
        y0 -= (nh - h) / 2;
        h = nh;
      }
      if (w < 420) {
        x0 -= (420 - w) / 2;
        y0 -= (420 / ar - h) / 2;
        w = 420;
        h = 420 / ar;
      }
      sb.view = { x: x0, y: y0, w, h };
    }
    renderTopo();
  }
  el.topo.addEventListener(
    'wheel',
    (e) => {
      if (!lesson || !lesson.sandbox) return;
      e.preventDefault();
      const p = svgPoint(e);
      sbZoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, p && p[0], p && p[1]);
    },
    { passive: false }
  );
  /* ---- barra ---- */
  $('#sbar').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const reset = { first: null, mouse: null };
    if (b.dataset.sbdev) {
      const same = sb.tool === 'place' && sb.model === b.dataset.sbdev;
      Object.assign(sb, reset, { tool: same ? 'select' : 'place', model: same ? null : b.dataset.sbdev });
    } else if (b.dataset.sbcable) {
      const same = sb.tool === 'cable' && sb.cable === b.dataset.sbcable;
      Object.assign(sb, reset, { tool: same ? 'select' : 'cable', cable: same ? null : b.dataset.sbcable });
    } else if (b.dataset.sbtool) Object.assign(sb, reset, { tool: sb.tool === b.dataset.sbtool && b.dataset.sbtool !== 'select' ? 'select' : b.dataset.sbtool });
    else if (b.dataset.sbed === 'undo') return sbUndo(false);
    else if (b.dataset.sbed === 'redo') return sbUndo(true);
    else if (b.dataset.sbed === 'dup') return sbDuplicate();
    else if (b.dataset.sbed === 'rename') return sbRename(tab);
    else if (b.dataset.sbed === 'snap') {
      sb.snap = !sb.snap;
      store.set('rg.sbsnap', sb.snap);
      say(sb.snap ? 'Imán activado: los equipos se colocan en la rejilla.' : 'Imán desactivado.', '');
    } else if (b.dataset.sbzoom === 'in') return sbZoom(1 / 1.25);
    else if (b.dataset.sbzoom === 'out') return sbZoom(1.25);
    else if (b.dataset.sbzoom === 'fit') return sbFit();
    else if (b.dataset.sbfile === 'save') return sbExport();
    else if (b.dataset.sbfile === 'open') return $('#sbFile').click();
    else if (b.dataset.sbfile === 'clear') {
      if (net.order.length && !confirm('¿Vaciar el lienzo? Se borra la red dibujada (puedes deshacerlo con Ctrl+Z).')) return;
      sbCommit();
      const keep = sb.undo;
      buildWorld(new window.NET.Network(), null);
      sb.undo = keep;
      sb.pdus = [];
      sb.view = { x: 0, y: 0, w: SB_W, h: SB_H };
      renderPdus();
      renderTopo();
    }
    sbCursor();
    renderSbar();
    renderTopo();
  });
  function sbCursor() {
    el.topo.classList.toggle('placing', sb.tool === 'place' || sb.tool === 'note');
    el.topo.classList.toggle('erasing', sb.tool === 'delete');
    el.topo.classList.toggle('wiring', sb.tool === 'cable' || sb.tool === 'pdu' || sb.tool === 'area');
  }
  /* arrastrar equipos desde la barra */
  $('#sbar').addEventListener('dragstart', (e) => {
    const b = e.target.closest('[data-sbdev]');
    if (!b) return;
    try {
      e.dataTransfer.setData('text/plain', 'sbdev:' + b.dataset.sbdev);
      e.dataTransfer.effectAllowed = 'copy';
    } catch (err) {}
  });
  el.topo.addEventListener('dragover', (e) => {
    if (lesson && lesson.sandbox) e.preventDefault();
  });
  el.topo.addEventListener('drop', (e) => {
    if (!lesson || !lesson.sandbox) return;
    e.preventDefault();
    let t = '';
    try {
      t = e.dataTransfer.getData('text/plain');
    } catch (err) {}
    const m = /^sbdev:(.+)$/.exec(t);
    const p = svgPoint(e);
    if (m && p) sbAdd(m[1], p[0], p[1]);
  });
  /* teclado: Esc, Supr, Ctrl+Z/Y/D (fuera de la consola) */
  document.addEventListener('keydown', (e) => {
    if (!lesson || !lesson.sandbox) return;
    if (e.target.closest && e.target.closest('input, textarea, select, dialog[open]')) return;
    if (document.querySelector('dialog[open]')) return;
    const k = e.key.toLowerCase();
    if (e.key === 'Escape' && sb.tool !== 'select') {
      Object.assign(sb, { tool: 'select', model: null, cable: null, first: null, mouse: null, draft: null });
      sbCursor();
      renderSbar();
      renderTopo();
    } else if ((e.key === 'Delete' || e.key === 'Supr') && tab) {
      e.preventDefault();
      sbRemove(tab);
    } else if ((e.ctrlKey || e.metaKey) && k === 'z') {
      e.preventDefault();
      sbUndo(e.shiftKey);
    } else if ((e.ctrlKey || e.metaKey) && k === 'y') {
      e.preventDefault();
      sbUndo(true);
    } else if ((e.ctrlKey || e.metaKey) && k === 'd') {
      e.preventDefault();
      sbDuplicate();
    }
  });
  /* ---- ratón sobre el lienzo ---- */
  el.topo.addEventListener('pointerdown', (e) => {
    if (!lesson || !lesson.sandbox || e.button !== 0) return;
    if (e.target.closest('.pdus')) return;
    const devEl = e.target.closest('[data-dev]');
    const linkEl = e.target.closest('[data-link]');
    const noteEl = e.target.closest('[data-note]');
    const areaEl = e.target.closest('[data-area]');
    const p = svgPoint(e);
    if (!p) return;
    const capture = () => {
      try {
        el.topo.setPointerCapture(e.pointerId);
      } catch (err) {}
      e.preventDefault();
    };
    if (sb.tool === 'place') {
      if (!devEl) sbAdd(sb.model, p[0], p[1]);
      return;
    }
    if (sb.tool === 'note') {
      const text = prompt('Texto de la nota:');
      if (text && text.trim()) {
        sbCommit();
        net.notes = net.notes || [];
        const [x, y] = clampW(...snapP(p));
        net.notes.push({ id: 'n' + Date.now().toString(36), x, y, text: text.trim().slice(0, 60) });
        renderTopo();
      }
      return;
    }
    if (sb.tool === 'area') {
      sb.draft = { x0: p[0], y0: p[1], x1: p[0], y1: p[1] };
      capture();
      return;
    }
    if (sb.tool === 'delete') {
      if (devEl) return sbRemove(devEl.dataset.dev);
      sbCommit();
      if (linkEl) {
        const before = net.snapshot();
        const l = net.links[+linkEl.dataset.link];
        net.unlink(l);
        printLogs(before);
        say(`Cable ${l.a.d}–${l.b.d} quitado.`, '');
      } else if (noteEl) net.notes = net.notes.filter((n) => n.id !== noteEl.dataset.note);
      else if (areaEl) net.areas = net.areas.filter((a) => a.id !== areaEl.dataset.area);
      else sb.undo.pop();
      renderTopo();
      return;
    }
    if (sb.tool === 'cable') {
      if (devEl) sbCableClick(net.devs[devEl.dataset.dev], e);
      return;
    }
    if (sb.tool === 'pdu') {
      if (devEl) sbPdu(net.devs[devEl.dataset.dev]);
      return;
    }
    /* mover */
    if (devEl || noteEl || areaEl) {
      const obj = devEl ? net.devs[devEl.dataset.dev] : noteEl ? net.notes.find((n) => n.id === noteEl.dataset.note) : net.areas.find((a) => a.id === areaEl.dataset.area);
      sb.drag = { obj, dev: devEl ? obj.id : null, dx: p[0] - obj.x, dy: p[1] - obj.y, x0: e.clientX, y0: e.clientY, moved: false };
    } else sb.pan = { x0: e.clientX, y0: e.clientY, vx: sb.view.x, vy: sb.view.y, k: sb.view.w / Math.max(1, el.topo.querySelector('.topo-main').getBoundingClientRect().width) };
    capture();
  });
  el.topo.addEventListener('pointermove', (e) => {
    if (!lesson || !lesson.sandbox) return;
    if ((sb.tool === 'cable' || sb.tool === 'pdu') && sb.first) {
      sb.mouse = svgPoint(e);
      renderTopo();
      return;
    }
    if (sb.draft) {
      const p = svgPoint(e);
      if (p) [sb.draft.x1, sb.draft.y1] = p;
      renderTopo();
      return;
    }
    if (sb.pan) {
      const svg = el.topo.querySelector('.topo-main');
      const ctm = svg && svg.getScreenCTM();
      const k = ctm ? 1 / ctm.a : sb.pan.k;
      sb.view.x = sb.pan.vx - (e.clientX - sb.pan.x0) * k;
      sb.view.y = sb.pan.vy - (e.clientY - sb.pan.y0) * k;
      if (Math.abs(e.clientX - sb.pan.x0) + Math.abs(e.clientY - sb.pan.y0) > 3) sb.pan.moved = true;
      renderTopo();
      return;
    }
    if (!sb.drag) return;
    if (!sb.drag.moved && Math.abs(e.clientX - sb.drag.x0) + Math.abs(e.clientY - sb.drag.y0) > 4) {
      sb.drag.moved = true;
      sbCommit();
    }
    if (!sb.drag.moved) return;
    const p = svgPoint(e);
    if (!p) return;
    const [x, y] = clampW(...snapP([p[0] - sb.drag.dx, p[1] - sb.drag.dy]));
    sb.drag.obj.x = x;
    sb.drag.obj.y = y;
    renderTopo();
  });
  el.topo.addEventListener('pointerup', () => {
    if (sb.draft) {
      const d = sb.draft;
      sb.draft = null;
      const w = Math.abs(d.x1 - d.x0);
      const h = Math.abs(d.y1 - d.y0);
      if (w > 30 && h > 30) {
        sbCommit();
        net.areas = net.areas || [];
        net.areas.push({ id: 'a' + Date.now().toString(36), x: Math.round(Math.min(d.x0, d.x1)), y: Math.round(Math.min(d.y0, d.y1)), w: Math.round(w), h: Math.round(h), color: AREA_COLORS[net.areas.length % AREA_COLORS.length], label: '' });
        say('Zona creada. Doble clic en ella para ponerle nombre (por ejemplo, «Sede A»).', 'happy');
      }
      renderTopo();
      return;
    }
    if (sb.pan) {
      sb.pan = null;
      return;
    }
    if (!sb.drag) return;
    const g = sb.drag;
    sb.drag = null;
    if (!g.moved && g.dev) goDevice(g.dev);
    else renderTopo();
  });
  /* doble clic: ventana del equipo, editar nota o nombrar zona */
  el.topo.addEventListener('dblclick', (e) => {
    const d = e.target.closest('[data-dev]');
    if (d) return openDevWin(d.dataset.dev);
    if (!lesson || !lesson.sandbox) return;
    const n = e.target.closest('[data-note]');
    if (n) {
      const note = net.notes.find((x) => x.id === n.dataset.note);
      const t = prompt('Texto de la nota:', note.text);
      if (t != null) {
        sbCommit();
        if (t.trim()) note.text = t.trim().slice(0, 60);
        else net.notes = net.notes.filter((x) => x !== note);
        renderTopo();
      }
      return;
    }
    const a = e.target.closest('[data-area]');
    if (a) {
      const area = net.areas.find((x) => x.id === a.dataset.area);
      const t = prompt('Nombre de la zona:', area.label || '');
      if (t != null) {
        sbCommit();
        area.label = t.trim().slice(0, 30);
        renderTopo();
      }
    }
  });
  /* ---- guardar y abrir ---- */
  function sbSerialize() {
    return {
      v: 2,
      devs: net.order.map((d) => ({ id: d.id, model: d.model, x: d.x, y: d.y, power: d.power, slots: d.slots, cfg: d.cfg || null, startup: d.startup || null, pc: d.pc || null, binds: d.binds || null })),
      links: net.links.map((l) => ({ a: l.a, b: l.b, cable: l.cable, dce: l.dce })),
      notes: net.notes || [],
      areas: net.areas || [],
    };
  }
  function sbBuild(data) {
    const n = new window.NET.Network();
    for (const x of data.devs || []) {
      if (!window.NET.MODELS[x.model] || typeof x.id !== 'string' || !/^[\w-]{1,12}$/.test(x.id)) continue;
      const d = n.add(x.id, x.model, +x.x || 100, +x.y || 100);
      if (Array.isArray(x.slots) && d.slots) d.slots = d.slots.map((m, i) => (window.NET.MODULES[x.slots[i]] ? x.slots[i] : null));
      if (d.kind === 'pc') {
        if (x.pc) Object.assign(d.pc, x.pc);
      } else {
        d.cfg = x.cfg || window.NET.factory(d);
        d.startup = x.startup || null;
        for (const p of d.hwPorts()) if (!d.cfg.ifs[p]) d.cfg.ifs[p] = window.NET.mkIf(p, d.kind);
      }
      d.power = x.power !== false;
      if (x.binds) d.binds = x.binds;
    }
    for (const l of data.links || []) if (n.devs[l.a.d] && n.devs[l.b.d] && n.devs[l.a.d].hwPorts().includes(l.a.p) && n.devs[l.b.d].hwPorts().includes(l.b.p)) n.link(l.a.d, l.a.p, l.b.d, l.b.p, l.cable, l.dce);
    n.notes = (data.notes || []).filter((x) => x && typeof x.text === 'string').map((x) => ({ id: String(x.id), x: +x.x || 0, y: +x.y || 0, text: x.text.slice(0, 60) }));
    n.areas = (data.areas || []).filter((x) => x && +x.w > 0).map((x) => ({ id: String(x.id), x: +x.x || 0, y: +x.y || 0, w: +x.w, h: +x.h, color: /^#[0-9a-f]{6}$/i.test(x.color) ? x.color : AREA_COLORS[0], label: String(x.label || '').slice(0, 30) }));
    return n;
  }
  function sbLoad() {
    try {
      const t = localStorage.getItem(SB_KEY);
      return t ? sbBuild(JSON.parse(t)) : null;
    } catch (e) {
      return null;
    }
  }
  let sbTimer = null;
  function sbSaveSoon() {
    clearTimeout(sbTimer);
    sbTimer = setTimeout(() => {
      if (!lesson || !lesson.sandbox) return;
      try {
        localStorage.setItem(SB_KEY, JSON.stringify(sbSerialize()));
      } catch (e) {}
      retoRefresh();
    }, 300);
  }
  function sbExport() {
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(sbSerialize(), null, 1)], { type: 'application/json' }));
      a.download = 'mi-red.redes.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      say('Red descargada como mi-red.redes.json. Ábrela otro día con «Abrir».', 'happy');
    } catch (e) {
      say('No se ha podido descargar el archivo en este navegador.', 'oops');
    }
  }
  $('#sbFile').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const n = sbBuild(JSON.parse(rd.result));
        sbCommit();
        buildWorld(n, n.order[0] ? n.order[0].id : null);
        sbFit();
        say(`Red abierta: ${n.order.length} equipos y ${n.links.length} cables.`, 'happy');
      } catch (err) {
        say('Ese archivo no es una red de Redes Games.', 'oops');
      }
    };
    rd.readAsText(f);
  });

  /* ---------- retos del lienzo ---------- */
  const RETOS = window.RETOS || [];
  const retoBest = () => store.get('rg.retos', {});
  function retoResults() {
    const r = RETOS.find((x) => x.id === sb.reto);
    if (!r) return null;
    net.touch();
    return r.checks.map((c) => {
      try {
        return !!c.ok(net);
      } catch (e) {
        return false;
      }
    });
  }
  function sandboxPanelHtml() {
    const r = RETOS.find((x) => x.id === sb.reto);
    if (!r) {
      const best = retoBest();
      return (
        `<div class="prose">${lesson.body}</div><h2 class="steps-title">Retos de examen</h2><p class="prose">Elige un enunciado y móntalo en el lienzo. Se corrige solo mientras trabajas; al final, <b>Corregir</b> te da la nota.</p><div class="retos">` +
        RETOS.map((x) => `<button type="button" class="reto" data-reto="${x.id}"><b>${esc(x.title)}</b><small>${esc(x.level)} · ${x.checks.length} criterios</small>${best[x.id] != null ? `<i>Mejor nota: ${best[x.id]}</i>` : ''}</button>`).join('') +
        '</div>'
      );
    }
    const res = retoResults();
    const okN = res.filter(Boolean).length;
    return (
      `<div class="reto-head"><span class="kicker">Reto · ${esc(r.level)}</span><button type="button" class="link" data-retoquit>Salir del reto</button></div><h2 class="reto-t">${esc(r.title)}</h2><div class="prose">${r.intro}</div>` +
      `<h2 class="steps-title">Criterios <span id="retoCount">${okN} / ${res.length}</span><i class="mini-bar"><i id="retoBar" style="width:${(okN / res.length) * 100}%"></i></i></h2><ol class="steps reto-list">` +
      r.checks.map((c, i) => `<li class="${res[i] ? 'done' : 'todo'}" data-ri="${i}"><span class="mk">${res[i] ? '✓' : i + 1}</span><div><p>${esc(c.t)}</p></div></li>`).join('') +
      '</ol><div class="reto-actions"><button type="button" class="btn primary" data-retograde>Corregir y poner nota</button></div><div id="retoGrade"></div>'
    );
  }
  let retoTimer = null;
  function retoRefresh() {
    if (!lesson || !lesson.sandbox || !sb.reto) return;
    clearTimeout(retoTimer);
    retoTimer = setTimeout(() => {
      const res = retoResults();
      if (!res) return;
      res.forEach((ok, i) => {
        const li = el.panel.querySelector(`[data-ri="${i}"]`);
        if (!li) return;
        li.className = ok ? 'done' : 'todo';
        li.querySelector('.mk').textContent = ok ? '✓' : i + 1;
      });
      const okN = res.filter(Boolean).length;
      const c = $('#retoCount');
      if (c) c.textContent = `${okN} / ${res.length}`;
      const b = $('#retoBar');
      if (b) b.style.width = (okN / res.length) * 100 + '%';
    }, 200);
  }
  function retoGrade() {
    const r = RETOS.find((x) => x.id === sb.reto);
    const res = retoResults();
    const nota = Math.round((res.filter(Boolean).length / res.length) * 100) / 10;
    const best = retoBest();
    const first = best[r.id] == null || nota > best[r.id];
    if (first) {
      best[r.id] = nota;
      store.set('rg.retos', best);
    }
    const fails = r.checks.filter((c, i) => !res[i]);
    $('#retoGrade').innerHTML =
      `<div class="finish${nota >= 5 ? '' : ' fail'}"><div class="big">${nota.toString().replace('.', ',')}</div><div><b>${nota === 10 ? '¡Matrícula! Todo perfecto.' : nota >= 5 ? 'Aprobado.' : 'Todavía no.'}</b>` +
      (fails.length ? `<p>Te falta:</p><ul>${fails.map((c) => `<li>${esc(c.t)}</li>`).join('')}</ul>` : '<p>Has cumplido todos los criterios del enunciado.</p>') +
      '</div></div>';
    if (nota === 10) {
      confetti(110);
      award('reto');
      if (first) addXp(60);
    } else if (nota >= 5 && first) addXp(20);
    say(nota === 10 ? '¡Un 10! Así se monta una red en el examen.' : nota >= 5 ? `Un ${nota}. Mira lo que falta y súbelo.` : 'Revisa los criterios en rojo: cada uno es un punto del examen.', nota >= 5 ? 'happy' : 'oops');
    renderSidebar();
  }
  el.panel.addEventListener('click', (e) => {
    const s = e.target.closest('[data-reto]');
    if (s) {
      if (net.order.length && confirm('¿Empezar el reto con el lienzo vacío?\n\nAceptar: vacía el lienzo (puedes deshacer con Ctrl+Z).\nCancelar: sigue con lo que tienes dibujado.')) {
        sbCommit();
        const keep = sb.undo;
        buildWorld(new window.NET.Network(), null);
        sb.undo = keep;
        sb.view = { x: 0, y: 0, w: SB_W, h: SB_H };
        renderTopo();
      }
      sb.reto = s.dataset.reto;
      store.set('rg.sbreto', sb.reto);
      renderLesson();
      say('Lee el enunciado y móntalo. Los criterios se marcan solos.', 'happy');
      return;
    }
    if (e.target.closest('[data-retoquit]')) {
      sb.reto = null;
      store.set('rg.sbreto', null);
      renderLesson();
      return;
    }
    if (e.target.closest('[data-retograde]')) retoGrade();
  });

  /* ---------- ventana del equipo (doble clic), como la de Packet Tracer ---------- */
  const devwin = $('#devwin');
  let dw = null;
  function openDevWin(id, t) {
    const d = net.devs[id];
    if (!d) return;
    if (tab !== id) goDevice(id);
    dw = { id, tab: t || (d.kind === 'pc' ? 'desktop' : 'phys'), iface: null, log: [] };
    renderDevWin();
    if (!devwin.open) devwin.showModal();
  }
  function closeDevWin(id) {
    if (!id || (dw && dw.id === id)) {
      dw = null;
      if (devwin.open) devwin.close();
    }
  }
  devwin.addEventListener('submit', (e) => e.preventDefault());
  devwin.addEventListener('close', () => {
    dw = null;
  });
  function renderDevWin() {
    if (!dw || !net.devs[dw.id]) return;
    const d = net.devs[dw.id];
    const tabs = d.kind === 'pc' ? [['phys', 'Physical'], ['config', 'Config'], ['desktop', 'Desktop']] : [['phys', 'Physical'], ['config', 'Config'], ['cli', 'CLI']];
    $('#dwTitle').textContent = d.id;
    $('#dwSub').textContent = `${d.label} · ${MODEL_TXT[d.model]}${d.kind !== 'pc' && d.cfg.hostname !== d.id ? ' · hostname ' + d.cfg.hostname : ''}`;
    $('#dwTabs').innerHTML = tabs.map(([k, t]) => `<button type="button" role="tab" class="tab${dw.tab === k ? ' on' : ''}" data-dwtab="${k}" aria-selected="${dw.tab === k}">${t}</button>`).join('');
    const body = $('#dwBody');
    if (dw.tab === 'phys') body.innerHTML = physHtml(d);
    else if (dw.tab === 'cli') body.innerHTML = cliPane(d);
    else if (dw.tab === 'desktop') body.innerHTML = desktopPane(d);
    else body.innerHTML = d.kind === 'pc' ? pcConfigPane(d) : configPane(d);
  }
  $('#dwTabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-dwtab]');
    if (!b || !dw) return;
    dw.tab = b.dataset.dwtab;
    renderDevWin();
  });
  devwin.addEventListener('click', (e) => {
    if (e.target === devwin || e.target.closest('.dlg-close')) closeDevWin();
  });
  const fld = (label, name, val, extra) => `<label class="dw-f"><span>${label}</span><input name="${name}" value="${esc(val == null ? '' : val)}" spellcheck="false" autocomplete="off"${extra || ''}></label>`;
  /* ---- CLI ---- */
  function cliPane(d) {
    const t = terms[d.id];
    const last = t ? [...t.box.childNodes].slice(-14).map((n) => n.textContent).join('\n') : '';
    return `<p class="dw-note">La CLI de ${esc(d.id)} es la consola grande de la derecha (pestaña <b>${esc(d.id)}</b>). Últimas líneas:</p><pre class="dw-cli">${esc(last || '(vacía)')}</pre><button type="button" class="btn primary" data-dwgo>Escribir en la consola de ${esc(d.id)} →</button>`;
  }
  /* ---- Config de router y switch: formularios que lanzan órdenes IOS ---- */
  function ifList(d) {
    const all = Object.keys(d.cfg.ifs);
    const ord = (n) => (/^Fast/.test(n) ? 0 : /^Gig/.test(n) ? 1 : /^Serial/.test(n) ? 2 : 3) + n.replace(/\d+/g, (x) => x.padStart(3, '0'));
    return all.sort((a, b) => ord(a).localeCompare(ord(b)));
  }
  function configPane(d) {
    const list = ifList(d);
    if (!dw.iface || !d.cfg.ifs[dw.iface]) dw.iface = 'GLOBAL';
    let side = `<button type="button" class="dw-if${dw.iface === 'GLOBAL' ? ' on' : ''}" data-dwif="GLOBAL"><b>GLOBAL</b><small>Settings</small></button><p class="dw-sec">INTERFACE</p>`;
    for (const n of list) {
      const st = stateOf(d, n);
      side += `<button type="button" class="dw-if${dw.iface === n ? ' on' : ''}" data-dwif="${esc(n)}"><i class="led-dot ${st}"></i>${esc(n)}</button>`;
    }
    let main = '';
    if (dw.iface === 'GLOBAL') {
      main =
        '<h4>Global Settings</h4>' +
        fld('Display Name', 'dname', d.id, lesson.sandbox ? '' : ' disabled') +
        (lesson.sandbox ? '' : '<p class="dw-note">El nombre del dibujo solo se cambia en el lienzo libre.</p>') +
        fld('Hostname', 'hostname', d.cfg.hostname) +
        '<div class="dw-row"><button type="button" class="btn" data-dwapply="global">Aplicar</button></div>' +
        '<h4>NVRAM</h4><div class="dw-row"><button type="button" class="btn" data-dwcmd="write">Save (copy run start)</button><button type="button" class="btn" data-dwcmd="erase">Erase (borrar startup)</button></div>' +
        `<p class="dw-note">${d.startup ? (JSON.stringify(d.startup) === JSON.stringify(d.cfg) ? 'La configuración está guardada.' : 'Hay cambios sin guardar.') : 'No hay nada guardado en la NVRAM.'}</p>`;
    } else {
      const n = dw.iface;
      const f = d.cfg.ifs[n];
      const s = net.status(d, n);
      const isSw = d.kind === 'switch' && !/^Vlan/.test(n);
      main = `<h4>${esc(n)}</h4><label class="dw-chk"><input type="checkbox" name="on"${f.shut ? '' : ' checked'}> Port Status: <b>On</b> <small>(${s[0] === 'admin' ? 'administratively down' : s[0]} / ${s[1]})</small></label>`;
      main += fld('Description', 'desc', f.desc);
      if (!isSw) main += '<p class="dw-sec">IP Configuration</p>' + fld('IPv4 Address', 'ip', f.ip != null ? n2ip(f.ip) : '') + fld('Subnet Mask', 'mask', f.mask != null ? n2ip(f.mask) : '');
      if (/^Serial/.test(n)) {
        const dce = net.isDce(d, n);
        main += `<label class="dw-f"><span>Clock Rate${dce ? ' (DCE)' : ''}</span><select name="clock"${dce ? '' : ' disabled'}>${['', 2000000, 1000000, 128000, 64000, 56000, 9600].map((r) => `<option value="${r}"${(f.clock || '') == r ? ' selected' : ''}>${r === '' ? 'Not Set' : r}</option>`).join('')}</select></label>`;
        if (!dce) main += `<p class="dw-note">${net.linkAt(d.id, n) ? 'Este extremo es DTE: el reloj lo pone el otro router.' : 'Sin cable serie conectado.'}</p>`;
      }
      if (isSw) {
        main += `<p class="dw-sec">Switchport</p><label class="dw-f"><span>Mode</span><select name="mode"><option value="access"${f.mode === 'access' ? ' selected' : ''}>Access</option><option value="trunk"${f.mode === 'trunk' ? ' selected' : ''}>Trunk</option></select></label>`;
        main += fld('VLAN', 'vlan', f.vlan, ' inputmode="numeric"');
      }
      main += '<div class="dw-row"><button type="button" class="btn primary" data-dwapply="if">Aplicar</button></div>';
    }
    return (
      `<div class="dw-cfg"><nav class="dw-side">${side}</nav><form class="dw-main" data-dwform>${main}</form></div>` +
      `<p class="dw-sec">Equivalent IOS Commands</p><pre class="dw-ios">${esc(dw.log.join('\n') || 'Aquí verás las órdenes de IOS que equivalen a lo que cambies en estos formularios.')}</pre>`
    );
  }
  /* lanza órdenes en una consola invisible del equipo y apunta lo que pasa */
  function runIos(d, lines) {
    if (!d.power) {
      say('El equipo está apagado. Enciéndelo primero (Physical).', 'oops');
      return false;
    }
    if (lesson.sandbox) sbCommit();
    const before = net.snapshot();
    const s = new IosSession(net, d);
    s.mode = 'priv';
    let ok = true;
    const all = ['configure terminal'].concat(lines, ['end']);
    for (const l of all) {
      dw.log.push(s.prompt() + l);
      const r = s.run(l);
      for (const [k, t] of r.parts) if (k !== 'caret' && t && !/^Enter configuration/.test(t) && !/^%SYS-5/.test(t)) dw.log.push(t);
      if (r.err) ok = false;
    }
    dw.log = dw.log.slice(-40);
    net.touch();
    printLogs(before);
    renderTopo();
    renderTabs();
    refreshPrompt();
    if (view === 'phys') renderPhysPane();
    if (!lesson.mode) checkStep('', { out: '', err: '', parts: [] });
    return ok;
  }
  devwin.addEventListener('click', (e) => {
    if (!dw) return;
    const d = net.devs[dw.id];
    const ifb = e.target.closest('[data-dwif]');
    if (ifb) {
      dw.iface = ifb.dataset.dwif;
      return renderDevWin();
    }
    if (e.target.closest('[data-dwgo]')) {
      closeDevWin();
      goDevice(d.id);
      el.input.focus();
      return;
    }
    if (e.target.closest('[data-dwprompt]')) {
      closeDevWin();
      goDevice(d.id);
      el.input.focus();
      return;
    }
    const cmd = e.target.closest('[data-dwcmd]');
    if (cmd) {
      if (!d.power) return say('El equipo está apagado.', 'oops');
      if (lesson.sandbox) sbCommit();
      if (cmd.dataset.dwcmd === 'write') {
        d.startup = window.NET.clone(d.cfg);
        dw.log.push(d.cfg.hostname + '#copy running-config startup-config', 'Building configuration...', '[OK]');
        award('save');
      } else {
        d.startup = null;
        dw.log.push(d.cfg.hostname + '#erase startup-config', '[OK]', 'Erase of nvram: complete');
      }
      renderTopo();
      if (!lesson.mode) checkStep('', { out: '', err: '', parts: [] });
      return renderDevWin();
    }
    const ap = e.target.closest('[data-dwapply]');
    if (!ap) return;
    const form = devwin.querySelector('[data-dwform]');
    const v = (n) => (form.elements[n] ? String(form.elements[n].value).trim() : '');
    if (ap.dataset.dwapply === 'global') {
      const dn = v('dname');
      const hn = v('hostname');
      if (hn && hn !== d.cfg.hostname) runIos(d, ['hostname ' + hn]);
      if (lesson.sandbox && dn && dn !== d.id) return sbRename(d.id, dn);
      return renderDevWin();
    }
    const n = dw.iface;
    const f = d.cfg.ifs[n];
    const lines = ['interface ' + n];
    const on = form.elements.on.checked;
    const desc = v('desc');
    if (desc !== f.desc) lines.push(desc ? 'description ' + desc : 'no description');
    if (form.elements.ip) {
      const ip = v('ip');
      const mask = v('mask');
      if (ip && mask) {
        if (window.NET.IP.ip2n(ip) !== f.ip || window.NET.IP.ip2n(mask) !== f.mask) lines.push(`ip address ${ip} ${mask}`);
      } else if (!ip && f.ip != null) lines.push('no ip address');
      else if (ip && !mask) return say('Falta la máscara de subred.', 'oops');
    }
    if (form.elements.clock && !form.elements.clock.disabled) {
      const c = v('clock');
      if (c && +c !== f.clock) lines.push('clock rate ' + c);
      else if (!c && f.clock) lines.push('no clock rate');
    }
    if (form.elements.mode) {
      if (v('mode') !== f.mode) lines.push('switchport mode ' + v('mode'));
      const vl = +v('vlan') || 1;
      if (v('mode') === 'access' && vl !== f.vlan) lines.push('switchport access vlan ' + vl);
    }
    if (on === f.shut) lines.push(on ? 'no shutdown' : 'shutdown');
    if (lines.length === 1) return say('No has cambiado nada.', '');
    runIos(d, lines);
    renderDevWin();
  });
  /* ---- PC: Config y Desktop → IP Configuration ---- */
  function pcConfigPane(d) {
    const p = d.pc;
    return (
      '<div class="dw-main"><h4>Global Settings</h4>' +
      fld('Display Name', 'dname', d.id, lesson.sandbox ? '' : ' disabled') +
      `<p class="dw-note">Gateway y DNS: ${p.gw != null ? n2ip(p.gw) : 'sin poner'} · ${p.dns != null ? n2ip(p.dns) : 'sin poner'}. Se cambian en Desktop → IP Configuration.</p>` +
      (lesson.sandbox ? '<div class="dw-row"><button type="button" class="btn" data-dwpcname>Aplicar</button></div>' : '') +
      `<h4>FastEthernet0</h4><p class="dw-note">MAC ${d.mac} · ${stateOf(d, 'FastEthernet0') === 'up' ? 'conectado' : 'sin conexión'}</p></div>`
    );
  }
  function desktopPane(d) {
    const p = d.pc;
    const v = (x) => (x != null ? n2ip(x) : '');
    return (
      '<div class="dw-desk"><div class="dw-apps"><button type="button" class="dw-app on">🖧<span>IP Configuration</span></button><button type="button" class="dw-app" data-dwprompt>⌨<span>Command Prompt</span></button></div>' +
      `<form class="dw-ipc" data-dwipc><h4>IP Configuration <small>FastEthernet0</small></h4>` +
      `<div class="dw-radio"><label><input type="radio" name="mode" value="dhcp"${p.dhcp ? ' checked' : ''}> DHCP</label><label><input type="radio" name="mode" value="static"${p.dhcp ? '' : ' checked'}> Static</label><span class="dw-msg" id="dwMsg">${esc(dw.msg || '')}</span></div>` +
      fld('IPv4 Address', 'ip', v(p.ip), p.dhcp ? ' readonly' : '') +
      fld('Subnet Mask', 'mask', v(p.mask), p.dhcp ? ' readonly' : '') +
      fld('Default Gateway', 'gw', v(p.gw), p.dhcp ? ' readonly' : '') +
      fld('DNS Server', 'dns', v(p.dns), p.dhcp ? ' readonly' : '') +
      (p.dhcp ? '' : '<div class="dw-row"><button type="button" class="btn primary" data-dwipcapply>Aplicar</button><small>(en Packet Tracer se aplica al salir de cada casilla)</small></div>') +
      `<p class="dw-sec">Equivalente en Command Prompt</p><pre class="dw-ios">${esc(dw.log.join('\n') || (p.dhcp ? 'ipconfig /renew' : p.ip != null ? `ipconfig ${v(p.ip)} ${v(p.mask)}${p.gw != null ? ' ' + v(p.gw) : ''}` : 'ipconfig'))}</pre></form></div>`
    );
  }
  function pcRun(d, line) {
    const t = terms[d.id];
    const s = t.stack[0];
    const r = s.run(line);
    printTo(d.id, 'C:\\>' + line);
    for (const [k, x] of r.parts) printTo(d.id, x, k === 'err' ? 'err' : '');
    dw.log.push('C:\\>' + line);
    dw.log = dw.log.slice(-12);
    net.touch();
    return r;
  }
  devwin.addEventListener('change', (e) => {
    if (!dw) return;
    const d = net.devs[dw.id];
    if (e.target.name === 'mode' && e.target.closest('[data-dwipc]')) {
      if (lesson.sandbox) sbCommit();
      if (e.target.value === 'dhcp') {
        dw.msg = 'Requesting IP Address…';
        const r = pcRun(d, 'ipconfig /renew');
        dw.msg = r.dhcp && r.dhcp.ok ? 'DHCP request successful.' : 'DHCP failed. APIPA is being used.';
        say(r.dhcp && r.dhcp.ok ? `${d.id} ha recibido ${n2ip(d.pc.ip)} por DHCP.` : 'Nadie ha contestado al DHCP: ¿hay un pool para esta red (o un ip helper-address)?', r.dhcp && r.dhcp.ok ? 'happy' : 'oops');
        award('first');
      } else {
        d.pc.dhcp = false;
        dw.msg = '';
      }
      renderTopo();
      if (!lesson.mode) checkStep('', { out: '', err: '', parts: [] });
      renderDevWin();
    }
  });
  devwin.addEventListener('click', (e) => {
    if (!dw) return;
    const d = net.devs[dw.id];
    if (e.target.closest('[data-dwpcname]')) {
      const nu = devwin.querySelector('[name="dname"]').value.trim();
      if (nu && nu !== d.id) sbRename(d.id, nu);
      return;
    }
    if (!e.target.closest('[data-dwipcapply]')) return;
    const f = devwin.querySelector('[data-dwipc]');
    const v = (n) => f.elements[n].value.trim();
    if (!v('ip') || !v('mask')) return say('Pon la IP y la máscara (la puerta de enlace es opcional, pero sin ella no sales de tu red).', 'oops');
    if (lesson.sandbox) sbCommit();
    const r = pcRun(d, `ipconfig ${v('ip')} ${v('mask')}${v('gw') ? ' ' + v('gw') : ''}`);
    if (r.err) {
      dw.msg = r.err.trim();
      say(r.err.trim(), 'oops');
    } else {
      const dns = window.NET.IP.ip2n(v('dns'));
      d.pc.dns = v('dns') ? dns : null;
      dw.msg = 'Configuración aplicada.';
      say(`${d.id}: ${v('ip')} / ${v('mask')}${v('gw') ? ', puerta de enlace ' + v('gw') : ''}.`, 'happy');
    }
    renderTopo();
    if (!lesson.mode) checkStep('', { out: '', err: '', parts: [] });
    renderDevWin();
  });

  /* ---------- montar la red de una misión o juego ---------- */
  function buildWorld(n, start) {
    net = n;
    el.topo.innerHTML = '';
    terms = {};
    el.out.innerHTML = '';
    for (const d of net.order) mkTerm(d.id);
    showTab(start && net.devs[start] ? start : net.order[0] ? net.order[0].id : null);
    renderSbar();
  }
  function resetWorld() {
    if (!lesson.sandbox) document.body.classList.remove('sandbox');
    if (lesson.mode === 'arcade') {
      buildWorld(window.GAMES.arcScene(lesson.glevel || 1), 'R1');
      return;
    }
    if (lesson.mode === 'ctf') {
      const got = window.GAMES.ctfScene(lesson.glevel || 1, (id) => ALL_FLAGS.find((f) => f.id === id).flag);
      buildWorld(got.net, got.start);
      return;
    }
    document.body.classList.toggle('sandbox', !!lesson.sandbox);
    if (lesson.sandbox) {
      const n = sbLoad() || new window.NET.Network();
      buildWorld(n, null);
      return;
    }
    const n = lesson.scene();
    if (lesson.setup) lesson.setup(n);
    buildWorld(n, lesson.start);
  }
  function startLesson(id) {
    arcStop();
    arc = null;
    el.pick.hidden = true;
    lesson = LESSONS.find((l) => l.id === id) || LESSONS[0];
    if (closed.delete(foldOf(lesson))) store.set('rg.closed', [...closed]);
    stepIdx = 0;
    hintShown = false;
    usedHint = false;
    store.set('rg.current', lesson.id);
    resetWorld();
    print(
      lesson.mode === 'ctf'
        ? 'Red ajena. Empieza mirando: show ip interface brief, show cdp neighbors, show vlan brief…'
        : lesson.mode === 'arcade'
          ? 'Pulsa «Empezar» cuando quieras.'
          : lesson.mode === 'free'
            ? 'Laboratorio libre. Pulsa en cualquier equipo para abrir su consola.'
            : 'Consola de prácticas. Es un simulador: rompe lo que quieras.',
      'dim'
    );
    el.input.value = '';
    say(lesson.say || (lesson.mode === 'ctf' ? 'Esta red es de otra persona. Busca, filtra y cuélate. Con permiso, claro: es un simulador.' : lesson.mode === 'arcade' ? '¿Cuántas órdenes eres capaz de clavar en 90 segundos?' : ''), '');
    renderSidebar();
    renderPanel();
    el.lesson.scrollTop = 0;
  }

  /* ---------- chuleta y logros ---------- */
  const cheat = $('#cheat');
  const trophy = $('#trophy');
  function renderCheat(q) {
    q = (q || '').toLowerCase();
    const cats = {};
    for (const d of DOCS) {
      if (q && !(d.cmd + ' ' + d.desc + ' ' + d.cat + ' ' + d.ex).toLowerCase().includes(q)) continue;
      (cats[d.cat] = cats[d.cat] || []).push(d);
    }
    const keys = Object.keys(cats);
    $('#cheatBody').innerHTML = keys.length
      ? keys.map((k) => `<section><h3>${esc(k)}</h3><div class="cheat-grid">` + cats[k].map((d) => `<article><code class="cmd">${esc(d.cmd)}</code><p>${esc(d.desc)}</p>${hintButton(d.ex)}</article>`).join('') + '</div></section>').join('')
      : '<p class="empty">Ninguna orden coincide con esa búsqueda.</p>';
  }
  $('#btnCheat').addEventListener('click', () => {
    $('#cheatSearch').value = '';
    renderCheat('');
    cheat.showModal();
  });
  $('#cheatSearch').addEventListener('input', (e) => renderCheat(e.target.value));
  cheat.addEventListener('click', (e) => {
    if (e.target === cheat || e.target.closest('.dlg-close')) return cheat.close();
    const h = e.target.closest('.hint-cmd');
    if (h) {
      cheat.close();
      useCommand(h.dataset.cmd);
    }
  });
  function openTrophies() {
    const i = rankOf(xp);
    $('#trophyBody').innerHTML =
      '<div class="ranks">' +
      RANKS.map(([min, name], k) => `<div class="${k < i ? 'past' : k === i ? 'now' : ''}"><b>${k + 1}</b><span>${name}</span><small>${min} XP</small></div>`).join('') +
      '</div><div class="badge-grid">' +
      BADGES.map((b) => `<article class="${badges.has(b.id) ? 'on' : ''}"><span>${badges.has(b.id) ? b.icon : '🔒'}</span><b>${esc(b.name)}</b><small>${esc(b.how)}</small></article>`).join('') +
      '</div>';
    trophy.showModal();
  }
  $('#hud').addEventListener('click', openTrophies);
  $('#btnTrophy').addEventListener('click', openTrophies);
  trophy.addEventListener('click', (e) => {
    if (e.target === trophy || e.target.closest('.dlg-close')) trophy.close();
  });

  /* ---------- tema ---------- */
  const theme = store.get('rg.theme', null);
  if (theme) document.documentElement.dataset.theme = theme;
  $('#btnTheme').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    store.set('rg.theme', next);
  });

  /* «luz verde»: se mira tras cada orden si alguna interfaz ha subido */
  const _submit = submit;
  submit = function (line) {
    const before = net.snapshot();
    _submit(line);
    lastLogs = logs(net, before, net.snapshot());
    if (/changed state to up/.test(Object.values(lastLogs).map((a) => a.join('\n')).join('\n'))) award('up');
  };

  assignFlags();
  renderHud();
  const pending = MISSIONS.find((l) => !done.has(l.id));
  startLesson(store.get('rg.current', null) || (pending || LESSONS[0]).id);
  if (window.matchMedia('(min-width: 900px)').matches) el.input.focus();
  window.__rg = { get net() { return net; }, get tab() { return tab; }, ses, submit: (l) => { promptTextLenBefore = promptText().length; submit(l); }, startLesson, goDevice, get stepIdx() { return stepIdx; }, get lesson() { return lesson; }, checkStep, pickCable: (i, c) => { openPick(net.pending[i], {}); el.pick.querySelector(`[data-cable="${c}"]`).click(); }, power: () => togglePower(), setView: (v) => document.querySelector(`.tab[data-tab="${v}"]`).click(), slot: (i, m) => slotAction(i, m) };
})();
