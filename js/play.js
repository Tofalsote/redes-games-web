/* Juegos propios de Redes Games (sustituyen al contrarreloj y a la caza de banderas heredados de Linux Games). */
(function (G) {
  'use strict';
  const PLAY = (G.PLAY = G.PLAY || {});
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = (a) => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const ip2n = (s) => s.split('.').reduce((a, x) => a * 256 + +x, 0);
  const n2ip = (n) => [24, 16, 8, 0].map((k) => Math.floor(n / 2 ** k) % 256).join('.');
  const maskOf = (p) => n2ip(p === 0 ? 0 : (2 ** 32 - 2 ** (32 - p)));
  const normIp = (s) => s.trim().replace(/\s+/g, '');

  /* =====================================================================
     NIVEL 1 · SUBNETTING EXPRÉS: rondas generadas y corregidas por código
     ===================================================================== */
  function genSubnet(k) {
    /* dificultad creciente: /24 al principio, luego /25-/30 y /16-/23 */
    const p = k < 2 ? 24 : k < 5 ? rnd(25, 30) : rnd(17, 23);
    let ip;
    let net;
    let bc;
    const size = 2 ** (32 - p);
    do {
      ip = p >= 24 ? ip2n(`192.168.${rnd(0, 254)}.${rnd(1, 254)}`) : ip2n(`172.${rnd(16, 31)}.${rnd(0, 255)}.${rnd(1, 254)}`);
      net = Math.floor(ip / size) * size;
      bc = net + size - 1;
    } while (ip === net || ip === bc); /* que sea una IP de host válida */
    return { ip: n2ip(ip), p, mask: maskOf(p), net: n2ip(net), bc: n2ip(bc), first: n2ip(net + 1), last: n2ip(bc - 1), hosts: size - 2 };
  }
  PLAY.subnet = {
    mount(root, api) {
      const N = 8;
      let k;
      let pts;
      let cur;
      let res;
      function start() {
        k = 0;
        pts = 0;
        cur = genSubnet(0);
        res = null;
        draw();
      }
      const fields = [
        ['mask', 'Máscara'],
        ['net', 'Dirección de red'],
        ['bc', 'Broadcast'],
        ['first', 'Primer host'],
        ['last', 'Último host'],
        ['hosts', 'Hosts útiles'],
      ];
      function draw() {
        if (k >= N) {
          const sc = Math.round((pts / (N * fields.length)) * 100);
          api.done(sc, sc === 100 ? '¡Subnetting perfecto! El examen ya no te asusta.' : `${pts} de ${N * fields.length} casillas.`);
          if (sc === 100) api.award('subnet');
          root.innerHTML = `<div class="pl-finish"><div class="big">${sc}%</div><div><b>${sc >= 60 ? 'Calculas como un router.' : 'Repasa máscaras y bloques.'}</b><p>${pts} de ${N * fields.length} casillas bien.</p><button type="button" class="btn primary" data-new>Otra ronda</button></div></div>`;
          return;
        }
        root.innerHTML =
          `<div class="pl-hud"><span>Ejercicio ${k + 1} de ${N}</span><span>Casillas bien: <b>${pts}</b></span></div>` +
          `<p class="pl-q">Un PC tiene la IP <code class="pl-big">${cur.ip}/${cur.p}</code>. Completa:</p>` +
          `<div class="pl-grid">${fields
            .map(([f, n]) => {
              const okv = String(cur[f]);
              const st = res ? (res[f] ? ' ok' : ' bad') : '';
              return `<label class="pl-f${st}"><span>${n}</span><input type="text" data-f="${f}" autocomplete="off" spellcheck="false" inputmode="decimal"${res ? ' disabled' : ''} value="${res ? esc(res['v_' + f]) : ''}">${res && !res[f] ? `<small>✓ ${esc(okv)}</small>` : ''}</label>`;
            })
            .join('')}</div>` +
          (res
            ? `<p class="fb ${res.n === fields.length ? 'ok' : ''}">Bloque de ${cur.hosts + 2} direcciones: la red es el múltiplo de ${cur.hosts + 2} que contiene a la IP, y el broadcast la última del bloque.</p><div class="row-btns"><button type="button" class="btn primary" data-next>${k + 1 < N ? 'Siguiente →' : 'Ver resultado →'}</button></div>`
            : '<div class="row-btns"><button type="button" class="btn primary" data-check>Comprobar</button><span class="pl-dim">Tabla rápida: /25 → 128 · /26 → 64 · /27 → 32 · /28 → 16 · /29 → 8 · /30 → 4</span></div>');
        const f = root.querySelector('[data-f]:not([disabled])');
        if (f && !window.matchMedia('(max-width: 900px)').matches) f.focus();
      }
      function check() {
        res = { n: 0 };
        root.querySelectorAll('[data-f]').forEach((inp) => {
          const f = inp.dataset.f;
          const v = normIp(inp.value);
          const ok = f === 'hosts' ? +v === cur.hosts : v === String(cur[f]) || (f === 'mask' && v.replace(/^\//, '') === String(cur.p));
          res[f] = ok;
          res['v_' + f] = inp.value;
          if (ok) {
            res.n++;
            pts++;
          }
        });
        api.say(res.n === fields.length ? '¡Todo bien!' : `${res.n} de ${fields.length}. Mira las correcciones.`, res.n === fields.length ? 'happy' : 'oops');
        draw();
      }
      root.addEventListener('click', (e) => {
        if (e.target.closest('[data-new]')) return start();
        if (e.target.closest('[data-check]')) return check();
        if (e.target.closest('[data-next]')) {
          k++;
          cur = genSubnet(k);
          res = null;
          draw();
        }
      });
      root.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || !e.target.dataset.f) return;
        const all = [...root.querySelectorAll('[data-f]')];
        const i = all.indexOf(e.target);
        if (i < all.length - 1) all[i + 1].focus();
        else check();
      });
      start();
      api.say('Ocho IP: saca su máscara, red, broadcast y rango. Enter pasa a la siguiente casilla.', '');
    },
  };

  /* =====================================================================
     NIVEL 2 · SIGUE AL PAQUETE: un ping de PC1 a PC2 a través de dos routers
     ===================================================================== */
  function topoSvg(t, hl) {
    const node = (x, label, sub, id) => `<g class="pk-n${hl === id ? ' on' : ''}"><rect x="${x - 62}" y="52" width="124" height="50" rx="8"/><text x="${x}" y="74">${label}</text><text x="${x}" y="91" class="s">${sub}</text></g>`;
    const X = { pc1: 70, sw1: 255, r1: 450, r2: 645, pc2: 830 };
    return (
      '<svg class="pk-topo" viewBox="0 0 900 175" role="img" aria-label="PC1, SW1, R1, R2, SW2 y PC2 en línea">' +
      `<path d="M132 77H193M317 77H388M512 77H583M707 77H768" class="pk-l"/><path d="M512 77H583" class="pk-l serial"/>` +
      node(X.pc1, 'PC1', t.pc1, 'pc1') + node(X.sw1, 'SW1', 'switch', 'sw1') + node(X.r1, 'R1', 'router', 'r1') + node(X.r2, 'R2', 'router', 'r2') + node(X.pc2, 'PC2', t.pc2, 'pc2') +
      `<text x="200" y="30" class="pk-a b">LAN 1 · ${t.lan1}</text><text x="547" y="30" class="pk-a b">serie · ${t.wan}</text><text x="790" y="30" class="pk-a b">LAN 2 · ${t.lan2}</text>` +
      `<text x="${X.r1}" y="122" class="pk-a">G0/0 ${t.r1lan}</text><text x="${X.r1}" y="138" class="pk-a">S0/0/0 ${t.r1wan}</text>` +
      `<text x="${X.r2}" y="122" class="pk-a">S0/0/0 ${t.r2wan}</text><text x="${X.r2}" y="138" class="pk-a">G0/0 ${t.r2lan}</text>` +
      `<text x="${X.pc1}" y="122" class="pk-a">GW ${t.r1lan}</text><text x="${X.pc2}" y="122" class="pk-a">GW ${t.r2lan}</text>` +
      '</svg>'
    );
  }
  function genTopo() {
    const a = rnd(1, 99);
    const b = rnd(100, 199);
    const w = rnd(0, 62) * 4;
    return {
      lan1: `192.168.${a}.0/24`,
      lan2: `192.168.${b}.0/24`,
      wan: `10.0.0.${w}/30`,
      pc1: `192.168.${a}.${rnd(10, 50)}`,
      pc2: `192.168.${b}.${rnd(10, 50)}`,
      r1lan: `192.168.${a}.1`,
      r2lan: `192.168.${b}.1`,
      r1wan: `10.0.0.${w + 1}`,
      r2wan: `10.0.0.${w + 2}`,
    };
  }
  function pkQuestions(t) {
    return [
      { hl: 'pc1', q: `PC1 (${t.pc1}) va a hacer ping a ${t.pc2}. Compara con su máscara: ¿está en su misma red?`, o: ['No: el paquete irá a su puerta de enlace', 'Sí: lo envía directamente a PC2', 'Depende del switch'], a: 0, why: `${t.pc2} no está en ${t.lan1}: todo lo que sale de la red se entrega a la puerta de enlace (${t.r1lan}).` },
      { hl: 'pc1', q: 'Para mandar la trama a R1, PC1 necesita una dirección MAC. ¿La de quién?', o: [`La de la G0/0 de R1 (${t.r1lan})`, 'La de PC2', 'La de SW1'], a: 0, why: 'La MAC de destino es la del siguiente salto. PC1 la averigua con ARP preguntando por la IP de su puerta de enlace.' },
      { hl: 'sw1', q: 'SW1 recibe la trama. ¿En qué se fija para reenviarla?', o: ['En la MAC de destino y su tabla de direcciones MAC', 'En la IP de destino y su tabla de rutas', 'La reenvía siempre por todos los puertos'], a: 0, why: 'Un switch de capa 2 trabaja con MAC: busca la MAC de destino en su tabla CAM (si no la conoce, inunda).' },
      { hl: 'r1', q: `R1 recibe el paquete. ¿Qué IP de destino lleva ahora?`, o: [t.pc2, t.r1lan, t.r2wan], a: 0, why: 'Las IP de origen y destino no cambian en todo el camino (sin NAT). Lo que cambia en cada salto es la trama de capa 2.' },
      { hl: 'r1', q: `¿Qué consulta R1 para saber por dónde enviarlo hacia ${t.lan2}?`, o: ['Su tabla de rutas', 'Su tabla ARP', 'La tabla MAC del switch'], a: 0, why: `Necesita una ruta a ${t.lan2} (estática, RIP, OSPF…) cuyo siguiente salto sea ${t.r2wan}. Sin ruta, descarta el paquete.` },
      { hl: 'r1', q: 'R1 lo reenvía por el enlace serie. ¿Qué pasa con el TTL?', o: ['R1 le resta 1', 'Se queda igual', 'Se pone a 0'], a: 0, why: 'Cada router que reenvía un paquete resta 1 al TTL. Si llegara a 0, lo descartaría (así no hay bucles infinitos).' },
      { hl: 'r2', q: `Si PC1 envió el ping con TTL 128, ¿con qué TTL llega a PC2?`, o: ['126', '128', '127'], a: 0, why: 'Ha pasado por dos routers (R1 y R2): 128 − 2 = 126. En la respuesta de ping lo verías como TTL=126.' },
      { hl: 'r2', q: 'En el enlace serie no hay Ethernet. ¿Qué lleva la trama en lugar de MAC?', o: ['El encapsulado del enlace serie (HDLC o PPP), sin MAC', 'La MAC de PC2', 'La MAC de R1'], a: 0, why: 'Cisco usa HDLC por defecto en serie (o PPP): son enlaces punto a punto y no necesitan direcciones MAC.' },
      { hl: 'pc2', q: 'El eco llega a PC2. Para que el ping funcione, ¿qué más hace falta?', o: [`Que R2 y R1 tengan ruta de vuelta hacia ${t.lan1}`, 'Nada más', 'Que PC2 tenga la MAC de PC1'], a: 0, why: 'El ping necesita ida y vuelta: sin ruta de vuelta verías «Request timed out» aunque la ida funcione.' },
    ];
  }
  PLAY.paquete = {
    mount(root, api) {
      let t;
      let qs;
      let i;
      let pts;
      let pick;
      let order;
      function start() {
        t = genTopo();
        qs = pkQuestions(t);
        i = 0;
        pts = 0;
        prep();
      }
      function prep() {
        pick = null;
        if (i < qs.length) order = shuffle(qs[i].o.map((x, k) => k));
        draw();
      }
      function draw() {
        if (i >= qs.length) {
          const sc = Math.round((pts / qs.length) * 100);
          api.done(sc, sc === 100 ? '¡Has seguido el paquete sin perderlo!' : `${pts} de ${qs.length}.`);
          if (sc === 100) api.award('paquete');
          root.innerHTML = `<div class="pl-finish"><div class="big">${sc}%</div><div><b>${sc >= 60 ? 'Entiendes lo que pasa por dentro.' : 'Repasa ARP, rutas y TTL.'}</b><p>${pts} de ${qs.length}. Cada partida usa direcciones nuevas.</p><button type="button" class="btn primary" data-new>Otra red</button></div></div>`;
          return;
        }
        const q = qs[i];
        root.innerHTML =
          `<div class="pl-hud"><span>Paso ${i + 1} de ${qs.length}</span><span>Aciertos: <b>${pts}</b></span></div>` +
          topoSvg(t, q.hl) +
          `<p class="pl-q">${esc(q.q)}</p><div class="pl-opts one">${order.map((k) => `<button type="button" class="pl-opt${pick != null ? (k === q.a ? ' ok' : k === pick ? ' bad' : '') : ''}" data-o="${k}"${pick != null ? ' disabled' : ''}>${esc(q.o[k])}</button>`).join('')}</div>` +
          (pick != null ? `<p class="fb ${pick === q.a ? 'ok' : 'bad'}">${pick === q.a ? '✓' : '✗'} ${esc(q.why)}</p><div class="row-btns"><button type="button" class="btn primary" data-next>${i + 1 < qs.length ? 'Siguiente salto →' : 'Ver resultado →'}</button></div>` : '');
      }
      root.addEventListener('click', (e) => {
        if (e.target.closest('[data-new]')) return start();
        if (e.target.closest('[data-next]')) {
          i++;
          return prep();
        }
        const o = e.target.closest('[data-o]');
        if (o && pick == null) {
          pick = +o.dataset.o;
          if (pick === qs[i].a) pts++;
          api.say(pick === qs[i].a ? 'Correcto.' : 'Ojo: lee la explicación.', pick === qs[i].a ? 'happy' : 'oops');
          draw();
        }
      });
      start();
      api.say('Un ping de PC1 a PC2. Acompáñalo salto a salto.', '');
    },
  };

  /* =====================================================================
     NIVEL 3 · DETECTIVE DE AVERÍAS: salidas de show y un fallo que encontrar
     ===================================================================== */
  const AVERIAS = [
    { s: 'PC1 no hace ping a nada, ni siquiera a su puerta de enlace 192.168.10.1.', out: 'R1# show ip interface brief\nInterface              IP-Address      OK? Method Status                Protocol\nGigabitEthernet0/0     192.168.10.1    YES manual administratively down down\nSerial0/0/0            10.0.0.1        YES manual up                    up', o: ['La G0/0 de R1 está apagada: falta no shutdown', 'Falta una ruta estática en R1', 'El cable serie está mal'], a: 0, why: '«administratively down» = la interfaz tiene shutdown. Se arregla con interface g0/0 → no shutdown.' },
    { s: 'PC3 (VLAN 20, puerto Fa0/5 de SW1) no llega a los demás PC de la VLAN 20.', out: 'SW1# show vlan brief\nVLAN Name        Status    Ports\n1    default     active    Fa0/1, Fa0/5, Fa0/6\n10   VENTAS      active    Fa0/2, Fa0/3\n20   ADMIN       active    Fa0/4', o: ['Fa0/5 está en la VLAN 1: falta switchport access vlan 20', 'La VLAN 20 no existe', 'Hay que poner Fa0/5 en modo trunk'], a: 0, why: 'El puerto sigue en la VLAN por defecto. interface fa0/5 → switchport mode access → switchport access vlan 20.' },
    { s: 'Los PC de la VLAN 20 de SW2 no llegan al router, pero los de la VLAN 10 sí.', out: 'SW2# show interfaces trunk\nPort    Mode  Encapsulation  Status    Native vlan\nGi0/1   on    802.1q         trunking  1\n\nPort    Vlans allowed on trunk\nGi0/1   10', o: ['El trunk solo permite la VLAN 10: falta añadir la 20', 'Falta crear una ruta por defecto en SW2', 'La encapsulación debería ser ISL'], a: 0, why: 'switchport trunk allowed vlan add 20 (o quitar la restricción). Una VLAN que no pasa por el trunk queda aislada.' },
    { s: 'Los PC de la LAN 192.168.20.0/24 no reciben IP; el servidor DHCP está en otra red (192.168.99.10).', out: 'R1# show running-config interface g0/1\ninterface GigabitEthernet0/1\n ip address 192.168.20.1 255.255.255.0\n duplex auto\n speed auto', o: ['Falta ip helper-address 192.168.99.10 en la G0/1', 'Falta un pool DHCP en el switch', 'La máscara está mal'], a: 0, why: 'Las peticiones DHCP son broadcast y el router no las reenvía… salvo que configures ip helper-address en la interfaz de esa LAN.' },
    { s: 'PC1 llega a todos los equipos de su red, pero no a ninguna otra.', out: 'C:\\> ipconfig\nIPv4 Address. . . . . . . . : 192.168.10.25\nSubnet Mask . . . . . . . . : 255.255.255.0\nDefault Gateway . . . . . . : 192.168.1.1', o: ['La puerta de enlace del PC es incorrecta (debería ser 192.168.10.1)', 'La máscara del PC es incorrecta', 'R1 tiene la interfaz apagada'], a: 0, why: 'La puerta de enlace tiene que estar en la misma red que el PC. Con 192.168.1.1 el PC no puede salir de su LAN.' },
    { s: 'Desde PC1 (LAN de R1) el ping a PC2 (LAN de R2) da «Request timed out». R1 sí tiene ruta a la LAN de R2.', out: 'R2# show ip route\nGateway of last resort is not set\n\n     10.0.0.0/30 is subnetted, 1 subnets\nC       10.0.0.0 is directly connected, Serial0/0/0\nC    192.168.20.0/24 is directly connected, GigabitEthernet0/0', o: ['R2 no tiene ruta de vuelta a la LAN de R1', 'R1 tiene mal la ruta', 'PC2 está apagado'], a: 0, why: 'La ida llega, pero R2 no sabe volver a 192.168.10.0/24. Falta en R2: ip route 192.168.10.0 255.255.255.0 10.0.0.1 (o un protocolo de enrutamiento).' },
    { s: 'R1 y R2 no forman vecindad OSPF por el enlace serie 10.0.0.0/30.', out: 'R1# show running-config | section ospf\nrouter ospf 1\n network 192.168.10.0 0.0.0.255 area 0\n network 10.0.0.0 0.0.0.3 area 0\n\nR2# show running-config | section ospf\nrouter ospf 1\n network 192.168.20.0 0.0.0.255 area 0\n network 10.0.0.0 0.0.0.3 area 1', o: ['El enlace está en áreas distintas (0 en R1, 1 en R2)', 'El process-id debe ser distinto', 'La wildcard 0.0.0.3 está mal'], a: 0, why: 'Para ser vecinos, las dos interfaces del enlace tienen que estar en la misma área. El process-id es local y puede ser distinto.' },
    { s: 'Intentas entrar por SSH a R1 y lo rechaza; por Telnet tampoco entra.', out: 'R1# show running-config | section line vty\nline vty 0 4\n password cisco\n login\n transport input ssh\n\nR1# show ip ssh\nSSH Disabled - version 1.99\n%Please create RSA keys to enable SSH', o: ['Faltan las claves RSA (ip domain-name + crypto key generate rsa) y login local con usuario', 'Hay que poner transport input telnet', 'Las líneas vty deberían ser 0 15'], a: 0, why: 'SSH necesita hostname, ip domain-name, claves RSA y un usuario local (login local). Telnet no entra porque transport input solo permite ssh.' },
    { s: 'El PC de la VLAN 10 recibe IP por DHCP pero de la red equivocada (192.168.20.x).', out: 'R1# show running-config | section dhcp\nip dhcp pool VLAN10\n network 192.168.20.0 255.255.255.0\n default-router 192.168.20.1\nip dhcp pool VLAN20\n network 192.168.20.0 255.255.255.0\n default-router 192.168.20.1', o: ['El pool VLAN10 tiene la red y la puerta de enlace de la VLAN 20', 'Falta ip helper-address', 'El PC tiene IP estática'], a: 0, why: 'Copiar y pegar un pool sin cambiarlo es un clásico. El pool de la VLAN 10 debe usar 192.168.10.0/24 y su default-router.' },
    { s: 'Hay luz en el enlace R1–R2 pero el protocolo está caído.', out: 'R1# show interfaces serial0/0/0\nSerial0/0/0 is up, line protocol is down\n  Encapsulation PPP\n\nR2# show interfaces serial0/0/0\nSerial0/0/0 is up, line protocol is down\n  Encapsulation HDLC', o: ['Encapsulado distinto en cada extremo (PPP frente a HDLC)', 'Falta clock rate en los dos', 'Las IP están en redes distintas'], a: 0, why: 'up/down con encapsulados distintos: los dos extremos tienen que hablar el mismo protocolo de capa 2 (los dos HDLC o los dos PPP).' },
  ];
  PLAY.averias = {
    _cases: AVERIAS,
    mount(root, api) {
      let deck;
      let i;
      let pts;
      let pick;
      let order;
      function start() {
        deck = shuffle(AVERIAS).slice(0, 8);
        i = 0;
        pts = 0;
        prep();
      }
      function prep() {
        pick = null;
        if (i < deck.length) order = shuffle([0, 1, 2]);
        draw();
      }
      function draw() {
        if (i >= deck.length) {
          const sc = Math.round((pts / deck.length) * 100);
          api.done(sc, sc === 100 ? '¡Ocho averías resueltas! Listo para el examen.' : `${pts} de ${deck.length}.`);
          if (sc === 100) api.award('averias');
          root.innerHTML = `<div class="pl-finish"><div class="big">${sc}%</div><div><b>${sc >= 60 ? 'Buen ojo para los show.' : 'Repasa las salidas de show.'}</b><p>${pts} de ${deck.length} averías encontradas.</p><button type="button" class="btn primary" data-new>Otras averías</button></div></div>`;
          return;
        }
        const c = deck[i];
        root.innerHTML =
          `<div class="pl-hud"><span>Avería ${i + 1} de ${deck.length}</span><span>Resueltas: <b>${pts}</b></span></div>` +
          `<p class="pl-q">🔧 ${esc(c.s)}</p><pre class="pl-code">${esc(c.out)}</pre><p class="pl-q sm">¿Cuál es el fallo?</p>` +
          `<div class="pl-opts one">${order.map((k) => `<button type="button" class="pl-opt${pick != null ? (k === c.a ? ' ok' : k === pick ? ' bad' : '') : ''}" data-o="${k}"${pick != null ? ' disabled' : ''}>${esc(c.o[k])}</button>`).join('')}</div>` +
          (pick != null ? `<p class="fb ${pick === c.a ? 'ok' : 'bad'}">${pick === c.a ? '✓' : '✗'} ${esc(c.why)}</p><div class="row-btns"><button type="button" class="btn primary" data-next>${i + 1 < deck.length ? 'Siguiente avería →' : 'Ver resultado →'}</button></div>` : '');
      }
      root.addEventListener('click', (e) => {
        if (e.target.closest('[data-new]')) return start();
        if (e.target.closest('[data-next]')) {
          i++;
          return prep();
        }
        const o = e.target.closest('[data-o]');
        if (o && pick == null) {
          pick = +o.dataset.o;
          if (pick === deck[i].a) pts++;
          api.say(pick === deck[i].a ? '¡Avería encontrada!' : 'Lee la salida con calma.', pick === deck[i].a ? 'happy' : 'oops');
          draw();
        }
      });
      start();
      api.say('Te llaman porque algo no funciona. Lee las salidas de show y encuentra el fallo.', '');
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
