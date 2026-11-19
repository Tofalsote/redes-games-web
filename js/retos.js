/* Retos del lienzo libre: enunciados de examen que se corrigen solos mirando la red dibujada.
   Cada criterio es { t: texto, ok(net) }. No dependen de los nombres de los equipos: buscan por tipo, IP y conexiones. */
(function (G) {
  'use strict';
  const { IP } = G.NET;
  const { ip2n, inNet, prefixOf } = IP;

  /* ---------- ayudas ---------- */
  const of = (net, kind) => net.order.filter((d) => d.kind === kind);
  const routers = (net) => of(net, 'router');
  const switches = (net) => of(net, 'switch');
  const pcs = (net) => of(net, 'pc');
  const N = (s) => ip2n(s);
  /* todos los cables con el tipo correcto y los dos extremos up/up */
  const allGood = (net) => net.links.length > 0 && net.links.every((l) => l.cable === net.rightCable(net.devs[l.a.d], net.devs[l.b.d], l.a.p) && net.linkState(l) === 'up');
  /* alguna interfaz del equipo tiene esa IP/máscara y está up/up */
  const hasIf = (net, d, ip, mask) => net.l3(d).some((x) => x.ip === N(ip) && (!mask || x.mask === N(mask)) && x.up);
  const anyHas = (net, ip, mask, kind) => net.order.filter((d) => !kind || d.kind === kind).some((d) => hasIf(net, d, ip, mask));
  const pcIn = (net, netAddr, mask) => pcs(net).filter((p) => p.pc.ip != null && inNet(p.pc.ip, N(netAddr), N(mask)) && p.pc.mask === N(mask));
  const ping = (net, a, ip) => !!a && ip != null && net.ping(a, ip).ok;
  const saved = (d) => !!d.startup && JSON.stringify(d.startup) === JSON.stringify(d.cfg);
  const hasModule = (d, m) => !!d.slots && d.slots.includes(m);

  G.RETOS = [
    {
      id: 'oficina',
      title: 'Oficina pequeña',
      level: 'Fácil',
      intro: `<p>Monta la red de una oficina:</p>
        <ul>
          <li>1 router <b>2911</b> con hostname <code>OFICINA</code>, 1 switch <b>2960</b> y 2 PCs.</li>
          <li>Red <code>192.168.10.0/24</code>. El router es la <code>.1</code>; los PCs, la <code>.10</code> y la <code>.11</code>, con puerta de enlace <code>.1</code>.</li>
          <li>Cables correctos y todo en verde. Guarda la configuración del router.</li>
        </ul>`,
      checks: [
        { t: 'Hay 1 router, 1 switch y al menos 2 PCs', ok: (n) => routers(n).length === 1 && switches(n).length === 1 && pcs(n).length >= 2 },
        { t: 'Todos los cables son del tipo correcto y están en verde', ok: (n) => n.links.length >= 3 && allGood(n) },
        { t: 'El router se llama OFICINA', ok: (n) => routers(n).some((r) => r.cfg.hostname === 'OFICINA') },
        { t: 'El router tiene 192.168.10.1/24 en una interfaz encendida', ok: (n) => anyHas(n, '192.168.10.1', '255.255.255.0', 'router') },
        { t: 'Los PCs tienen 192.168.10.10 y .11 con puerta de enlace .1', ok: (n) => ['192.168.10.10', '192.168.10.11'].every((ip) => pcs(n).some((p) => p.pc.ip === N(ip) && p.pc.gw === N('192.168.10.1'))) },
        { t: 'Los PCs llegan al router y entre ellos (ping)', ok: (n) => { const a = pcs(n).find((p) => p.pc.ip === N('192.168.10.10')); return ping(n, a, N('192.168.10.1')) && ping(n, a, N('192.168.10.11')); } },
        { t: 'La configuración del router está guardada', ok: (n) => routers(n).some((r) => saved(r)) },
      ],
    },
    {
      id: 'dhcp',
      title: 'DHCP para todos',
      level: 'Fácil',
      intro: `<p>Que el router reparta las IPs:</p>
        <ul>
          <li>1 router, 1 switch y <b>3 PCs</b>.</li>
          <li>LAN <code>192.168.50.0/24</code>, router <code>.1</code>.</li>
          <li>Pool DHCP en el router para esa red, con puerta de enlace <code>.1</code> y sin repartir de la <code>.1</code> a la <code>.10</code>.</li>
          <li>Los 3 PCs con IP por DHCP y haciéndose ping.</li>
        </ul>`,
      checks: [
        { t: 'Hay al menos 1 router, 1 switch y 3 PCs', ok: (n) => routers(n).length >= 1 && switches(n).length >= 1 && pcs(n).length >= 3 },
        { t: 'Cables correctos y en verde', ok: (n) => allGood(n) },
        { t: 'El router tiene 192.168.50.1/24', ok: (n) => anyHas(n, '192.168.50.1', '255.255.255.0', 'router') },
        { t: 'Excluidas de la .1 a la .10', ok: (n) => routers(n).some((r) => r.cfg.dhcpEx.some(([a, b]) => a <= N('192.168.50.1') && b >= N('192.168.50.10'))) },
        { t: 'Pool con la red 192.168.50.0/24 y default-router .1', ok: (n) => routers(n).some((r) => Object.values(r.cfg.pools).some((p) => p.net === N('192.168.50.0') && p.mask === N('255.255.255.0') && p.router === N('192.168.50.1'))) },
        { t: '3 PCs con IP del DHCP en esa red', ok: (n) => pcs(n).filter((p) => p.pc.dhcp && p.pc.ip != null && inNet(p.pc.ip, N('192.168.50.0'), N('255.255.255.0')) && p.pc.ip > N('192.168.50.10')).length >= 3 },
        { t: 'Un PC llega a otro PC (ping)', ok: (n) => { const l = pcIn(n, '192.168.50.0', '255.255.255.0'); return l.length >= 2 && ping(n, l[0], l[1].pc.ip); } },
      ],
    },
    {
      id: 'sedes',
      title: 'Dos sedes por serie',
      level: 'Media',
      intro: `<p>Une dos sedes con un enlace serie:</p>
        <ul>
          <li>2 routers <b>2911</b> con un módulo <b>HWIC-2T</b>, unidos por cable serie. El DCE lleva <code>clock rate 64000</code>.</li>
          <li>Enlace <code>10.0.0.0/30</code> (.1 y .2).</li>
          <li>Sede A: <code>192.168.1.0/24</code>; sede B: <code>192.168.2.0/24</code>. Cada una con un switch y un PC (router en la <code>.1</code>).</li>
          <li>Enrutamiento estático u OSPF: el PC de la sede A llega al de la B.</li>
        </ul>`,
      checks: [
        { t: 'Hay 2 routers, 2 switches y 2 PCs', ok: (n) => routers(n).length >= 2 && switches(n).length >= 2 && pcs(n).length >= 2 },
        { t: 'Los dos routers tienen un HWIC-2T', ok: (n) => routers(n).filter((r) => hasModule(r, 'HWIC-2T')).length >= 2 },
        { t: 'Hay un enlace serie up/up (con clock rate en el DCE)', ok: (n) => n.links.some((l) => l.cable === 'serial' && n.linkState(l) === 'up') },
        { t: 'El enlace usa 10.0.0.1/30 y 10.0.0.2/30', ok: (n) => anyHas(n, '10.0.0.1', '255.255.255.252', 'router') && anyHas(n, '10.0.0.2', '255.255.255.252', 'router') },
        { t: 'Cada sede tiene su router .1 encendido', ok: (n) => anyHas(n, '192.168.1.1', '255.255.255.0', 'router') && anyHas(n, '192.168.2.1', '255.255.255.0', 'router') },
        { t: 'Un PC en cada sede, con su puerta de enlace', ok: (n) => pcIn(n, '192.168.1.0', '255.255.255.0').some((p) => p.pc.gw === N('192.168.1.1')) && pcIn(n, '192.168.2.0', '255.255.255.0').some((p) => p.pc.gw === N('192.168.2.1')) },
        { t: 'El PC de la sede A llega al de la sede B', ok: (n) => { const a = pcIn(n, '192.168.1.0', '255.255.255.0')[0]; const b = pcIn(n, '192.168.2.0', '255.255.255.0')[0]; return !!b && ping(n, a, b.pc.ip); } },
      ],
    },
    {
      id: 'vlans',
      title: 'VLAN en la oficina',
      level: 'Media',
      intro: `<p>Separa dos departamentos en el mismo switch y únelos con el router:</p>
        <ul>
          <li>1 router, 1 switch y <b>4 PCs</b>.</li>
          <li>VLAN <code>10</code> llamada <code>VENTAS</code> (<code>192.168.10.0/24</code>) y VLAN <code>20</code> llamada <code>RRHH</code> (<code>192.168.20.0/24</code>), 2 PCs en cada una.</li>
          <li>Router-on-a-stick: trunk en el switch y subinterfaces <code>.10</code> y <code>.20</code> en el router (la <code>.1</code> de cada red).</li>
          <li>Un PC de VENTAS llega a uno de RRHH.</li>
        </ul>`,
      checks: [
        { t: 'Hay 1 router, 1 switch y 4 PCs', ok: (n) => routers(n).length >= 1 && switches(n).length >= 1 && pcs(n).length >= 4 },
        { t: 'VLAN 10 VENTAS y VLAN 20 RRHH creadas', ok: (n) => switches(n).some((s) => s.cfg.vlans[10] === 'VENTAS' && s.cfg.vlans[20] === 'RRHH') },
        { t: '2 puertos con PC en cada VLAN', ok: (n) => switches(n).some((s) => [10, 20].every((v) => s.hwPorts().filter((p) => s.cfg.ifs[p].mode === 'access' && s.cfg.ifs[p].vlan === v && net2pc(n, s, p)).length >= 2)) },
        { t: 'El puerto hacia el router es trunk', ok: (n) => switches(n).some((s) => s.hwPorts().some((p) => s.cfg.ifs[p].mode === 'trunk' && net2kind(n, s, p) === 'router' && n.isUp(s, p))) },
        { t: 'Subinterfaces .10 y .20 con dot1Q y su IP .1', ok: (n) => routers(n).some((r) => Object.keys(r.cfg.ifs).some((k) => r.cfg.ifs[k].encap === 10 && r.cfg.ifs[k].ip === N('192.168.10.1')) && Object.keys(r.cfg.ifs).some((k) => r.cfg.ifs[k].encap === 20 && r.cfg.ifs[k].ip === N('192.168.20.1'))) },
        { t: 'Los PCs tienen IP de su VLAN con su puerta de enlace', ok: (n) => pcIn(n, '192.168.10.0', '255.255.255.0').filter((p) => p.pc.gw === N('192.168.10.1')).length >= 2 && pcIn(n, '192.168.20.0', '255.255.255.0').filter((p) => p.pc.gw === N('192.168.20.1')).length >= 2 },
        { t: 'Un PC de VENTAS llega a uno de RRHH', ok: (n) => { const a = pcIn(n, '192.168.10.0', '255.255.255.0')[0]; const b = pcIn(n, '192.168.20.0', '255.255.255.0')[0]; return !!b && ping(n, a, b.pc.ip); } },
      ],
    },
    {
      id: 'seguro',
      title: 'Router blindado',
      level: 'Media',
      intro: `<p>Deja un router listo para administrarlo de forma segura:</p>
        <ul>
          <li>1 router <b>2911</b> (hostname <code>R-SEGURO</code>), 1 switch y 1 PC en <code>192.168.99.0/24</code> (router <code>.1</code>).</li>
          <li><code>enable secret</code>, consola con contraseña y <code>login</code>, <code>service password-encryption</code> y un banner.</li>
          <li>SSH versión 2: dominio, usuario local, claves de 1024 bits y las vty con <code>login local</code> y <code>transport input ssh</code>.</li>
          <li>El PC llega al router. Guarda la configuración.</li>
        </ul>`,
      checks: [
        { t: 'El router se llama R-SEGURO', ok: (n) => routers(n).some((r) => r.cfg.hostname === 'R-SEGURO') },
        { t: 'enable secret, consola con contraseña + login y contraseñas cifradas', ok: (n) => routers(n).some((r) => r.cfg.enableSecret && r.cfg.con.pass && r.cfg.con.login && r.cfg.spe) },
        { t: 'Tiene banner MOTD', ok: (n) => routers(n).some((r) => !!r.cfg.banner) },
        { t: 'Dominio, usuario local y claves RSA de 1024 bits o más', ok: (n) => routers(n).some((r) => r.cfg.domain && Object.keys(r.cfg.users).length && r.cfg.rsa >= 1024) },
        { t: 'SSH versión 2 y vty con login local + transport input ssh', ok: (n) => routers(n).some((r) => r.cfg.sshVer === 2 && r.cfg.vty.local && r.cfg.vty.transport === 'ssh') },
        { t: 'El PC (192.168.99.x) llega al router .1', ok: (n) => { const a = pcIn(n, '192.168.99.0', '255.255.255.0')[0]; return ping(n, a, N('192.168.99.1')); } },
        { t: 'La configuración del router está guardada', ok: (n) => routers(n).some((r) => r.cfg.hostname === 'R-SEGURO' && saved(r)) },
      ],
    },
  ];

  /* qué hay al otro lado de un puerto */
  function net2kind(net, d, p) {
    const l = net.linkAt(d.id, p);
    return l ? net.devs[net.other(l, d.id, p).d].kind : null;
  }
  function net2pc(net, d, p) {
    return net2kind(net, d, p) === 'pc' && net.isUp(d, p);
  }
  void prefixOf;
})(typeof window !== 'undefined' ? window : globalThis);
