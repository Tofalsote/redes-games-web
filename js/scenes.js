/* Escenarios: qué equipos hay, dónde se dibujan, cómo van cableados y qué traen ya configurado.
   Las configuraciones previas se aplican escribiendo órdenes de IOS de verdad en una consola invisible. */
(function (G) {
  'use strict';
  const { Network, IP } = G.NET;
  const { IosSession } = G.IOS;
  const { ip2n } = IP;

  /* escribe órdenes en un equipo como si estuvieras en su consola (modo #) */
  function conf(net, id, text) {
    const s = new IosSession(net, net.devs[id]);
    s.mode = 'priv';
    s.run('configure terminal');
    for (const raw of text.split('\n')) {
      const l = raw.trim();
      if (!l) continue;
      const r = s.run(l);
      if (r.err && typeof console !== 'undefined') console.warn('[escena] ' + id + ': ' + l + ' → ' + r.err);
    }
    s.mode = 'priv';
    s.pending = null;
    net.touch();
  }
  function pc(net, id, cidr, gw) {
    const [ip, p] = cidr.split('/');
    Object.assign(net.devs[id].pc, { ip: ip2n(ip), mask: IP.pmask(+p), gw: gw ? ip2n(gw) : null, dhcp: false });
    net.touch();
  }
  function save(net, id) {
    const d = net.devs[id];
    d.startup = JSON.parse(JSON.stringify(d.cfg));
  }
  const G0 = 'GigabitEthernet0/0';
  const G1 = 'GigabitEthernet0/1';
  const S0 = 'Serial0/0/0';
  const F = (n) => 'FastEthernet0/' + n;
  const NIC = 'FastEthernet0';

  /* ---------- piezas de escenario ---------- */
  const S = {};

  /* R1 — S1 — PC1, PC2 */
  S.lan = (o) => {
    o = o || {};
    const net = new Network();
    net.add('R1', '2911', 320, 60);
    net.add('S1', '2960', 320, 170);
    net.add('PC1', 'PC', 220, 270);
    net.add('PC2', 'PC', 420, 270);
    net.link('R1', G0, 'S1', G1);
    net.link('S1', F(1), 'PC1', NIC);
    net.link('S1', F(2), 'PC2', NIC);
    if (o.r1) conf(net, 'R1', 'hostname R1\nno ip domain-lookup\ninterface g0/0\nip address 192.168.1.1 255.255.255.0\nno shutdown');
    if (o.s1) conf(net, 'S1', 'hostname S1\nno ip domain-lookup\ninterface vlan 1\nip address 192.168.1.2 255.255.255.0\nno shutdown\nexit\nip default-gateway 192.168.1.1');
    if (o.pcs) {
      pc(net, 'PC1', '192.168.1.10/24', '192.168.1.1');
      pc(net, 'PC2', '192.168.1.11/24', '192.168.1.1');
    }
    return net;
  };

  /* un router con dos LAN: R1 G0/0 → S1 → PC1   y   R1 G0/1 → S2 → PC2 */
  S.dos = () => {
    const net = new Network();
    net.add('R1', '2911', 320, 50);
    net.add('S1', '2960', 170, 160);
    net.add('S2', '2960', 470, 160);
    net.add('PC1', 'PC', 170, 270);
    net.add('PC2', 'PC', 470, 270);
    net.link('R1', G0, 'S1', G1);
    net.link('R1', G1, 'S2', G1);
    net.link('S1', F(1), 'PC1', NIC);
    net.link('S2', F(1), 'PC2', NIC);
    conf(net, 'R1', 'hostname R1\nno ip domain-lookup');
    conf(net, 'S1', 'hostname S1');
    conf(net, 'S2', 'hostname S2');
    return net;
  };

  /* dos routers por serie, cada uno con su LAN */
  S.wan = (o) => {
    o = o || {};
    const net = new Network();
    net.add('R1', '2911', 170, 60);
    net.add('R2', '2911', 470, 60);
    net.add('S1', '2960', 170, 165);
    net.add('S2', '2960', 470, 165);
    net.add('PC1', 'PC', 170, 270);
    net.add('PC2', 'PC', 470, 270);
    for (const r of ['R1', 'R2']) net.devs[r].slots[0] = 'HWIC-2T';
    for (const r of ['R1', 'R2']) net.reboot(net.devs[r]);
    if (!o.nocable) net.link('R1', S0, 'R2', S0, 'serial', 'R1');
    net.link('R1', G0, 'S1', G1);
    net.link('R2', G0, 'S2', G1);
    net.link('S1', F(1), 'PC1', NIC);
    net.link('S2', F(1), 'PC2', NIC);
    conf(net, 'R1', 'hostname R1\nno ip domain-lookup' + (o.lans ? '\ninterface g0/0\nip address 192.168.1.1 255.255.255.0\nno shutdown' : ''));
    conf(net, 'R2', 'hostname R2\nno ip domain-lookup' + (o.lans ? '\ninterface g0/0\nip address 192.168.2.1 255.255.255.0\nno shutdown' : ''));
    if (o.serial) {
      conf(net, 'R1', 'interface s0/0/0\nip address 10.0.0.1 255.255.255.252\nclock rate 64000\nno shutdown');
      conf(net, 'R2', 'interface s0/0/0\nip address 10.0.0.2 255.255.255.252\nno shutdown');
    }
    conf(net, 'S1', 'hostname S1');
    conf(net, 'S2', 'hostname S2');
    if (o.pcs) {
      pc(net, 'PC1', '192.168.1.10/24', '192.168.1.1');
      pc(net, 'PC2', '192.168.2.10/24', '192.168.2.1');
    }
    if (o.routes) {
      conf(net, 'R1', 'ip route 192.168.2.0 255.255.255.0 10.0.0.2');
      conf(net, 'R2', 'ip route 192.168.1.0 255.255.255.0 10.0.0.1');
    }
    return net;
  };

  /* estrella: R1 en el centro, R2 y R3 de punta, cada uno con un PC */
  S.estrella = () => {
    const net = new Network();
    net.add('R1', '2911', 320, 60);
    net.add('R2', '2911', 140, 170);
    net.add('R3', '2911', 500, 170);
    net.add('PC1', 'PC', 320, 275);
    net.add('PC2', 'PC', 140, 275);
    net.add('PC3', 'PC', 500, 275);
    net.add('S1', '2960', 320, 170);
    for (const r of ['R1', 'R2', 'R3']) {
      net.devs[r].slots[0] = 'HWIC-2T';
      net.reboot(net.devs[r]);
    }
    net.link('R1', S0, 'R2', S0, 'serial', 'R1');
    net.link('R1', 'Serial0/0/1', 'R3', S0, 'serial', 'R1');
    net.link('R1', G0, 'S1', G1);
    net.link('S1', F(1), 'PC1', NIC);
    net.link('R2', G0, 'PC2', NIC, 'cross');
    net.link('R3', G0, 'PC3', NIC, 'cross');
    conf(net, 'R1', 'hostname R1\nno ip domain-lookup\ninterface g0/0\nip address 192.168.1.1 255.255.255.0\nno shutdown\ninterface s0/0/0\nip address 10.0.12.1 255.255.255.252\nclock rate 64000\nno shutdown\ninterface s0/0/1\nip address 10.0.13.1 255.255.255.252\nclock rate 64000\nno shutdown\nexit\nip route 192.168.2.0 255.255.255.0 10.0.12.2\nip route 192.168.3.0 255.255.255.0 10.0.13.2');
    conf(net, 'R2', 'hostname R2\nno ip domain-lookup\ninterface g0/0\nip address 192.168.2.1 255.255.255.0\nno shutdown\ninterface s0/0/0\nip address 10.0.12.2 255.255.255.252\nno shutdown');
    conf(net, 'R3', 'hostname R3\nno ip domain-lookup\ninterface g0/0\nip address 192.168.3.1 255.255.255.0\nno shutdown\ninterface s0/0/0\nip address 10.0.13.2 255.255.255.252\nno shutdown');
    conf(net, 'S1', 'hostname S1');
    pc(net, 'PC1', '192.168.1.10/24', '192.168.1.1');
    pc(net, 'PC2', '192.168.2.10/24', '192.168.2.1');
    pc(net, 'PC3', '192.168.3.10/24', '192.168.3.1');
    return net;
  };

  /* un switch con cuatro PCs (para VLAN) y un router arriba */
  S.vlan = (o) => {
    o = o || {};
    const net = new Network();
    net.add('R1', '2911', 320, 45);
    net.add('S1', '2960', 320, 150);
    net.add('PC1', 'PC', 110, 270);
    net.add('PC2', 'PC', 250, 270);
    net.add('PC3', 'PC', 390, 270);
    net.add('PC4', 'PC', 530, 270);
    net.link('R1', G0, 'S1', G1);
    for (let i = 1; i <= 4; i++) net.link('S1', F(i), 'PC' + i, NIC);
    conf(net, 'R1', 'hostname R1\nno ip domain-lookup');
    conf(net, 'S1', 'hostname S1\nno ip domain-lookup');
    pc(net, 'PC1', '192.168.10.10/24', '192.168.10.1');
    pc(net, 'PC2', '192.168.10.11/24', '192.168.10.1');
    pc(net, 'PC3', '192.168.20.10/24', '192.168.20.1');
    pc(net, 'PC4', '192.168.20.11/24', '192.168.20.1');
    if (o.vlans) conf(net, 'S1', 'vlan 10\nname ALUMNOS\nvlan 20\nname PROFES\nexit\ninterface range fa0/1 - 2\nswitchport mode access\nswitchport access vlan 10\nexit\ninterface range fa0/3 - 4\nswitchport mode access\nswitchport access vlan 20');
    return net;
  };

  /* para cablear: equipos sin cables y los cables que faltan */
  S.cables = () => {
    const net = new Network();
    net.add('R1', '2911', 180, 55);
    net.add('R2', '2911', 470, 55);
    net.add('S1', '2960', 180, 165);
    net.add('S2', '2960', 360, 165);
    net.add('PC1', 'PC', 90, 270);
    net.add('PC2', 'PC', 360, 270);
    net.add('PC3', 'PC', 560, 165);
    for (const r of ['R1', 'R2']) {
      net.devs[r].slots[0] = 'HWIC-2T';
      net.reboot(net.devs[r]);
    }
    net.pending = [
      { a: 'PC1', pa: NIC, b: 'S1', pb: F(1), want: 'straight' },
      { a: 'S1', pa: G1, b: 'R1', pb: G0, want: 'straight' },
      { a: 'S1', pa: 'GigabitEthernet0/2', b: 'S2', pb: G1, want: 'cross' },
      { a: 'S2', pa: F(1), b: 'PC2', pb: NIC, want: 'straight' },
      { a: 'R1', pa: S0, b: 'R2', pb: S0, want: 'serial' },
      { a: 'R2', pa: G0, b: 'PC3', pb: NIC, want: 'cross' },
    ];
    return net;
  };

  /* R1 sin módulo serie para la misión de hardware */
  S.modulo = () => {
    const net = new Network();
    net.add('R1', '2911', 200, 120);
    net.add('R2', '2911', 460, 120);
    net.devs.R2.slots[0] = 'HWIC-2T';
    net.reboot(net.devs.R2);
    conf(net, 'R1', 'hostname R1\nno ip domain-lookup');
    save(net, 'R1');
    conf(net, 'R2', 'hostname R2\nno ip domain-lookup');
    save(net, 'R2');
    net.pending = [{ a: 'R1', pa: S0, b: 'R2', pb: S0, want: 'serial' }];
    return net;
  };

  /* simulacro de examen: todo de fábrica */
  S.examen = () => {
    const net = S.wan({});
    for (const id of ['R1', 'R2', 'S1', 'S2']) {
      const d = net.devs[id];
      d.cfg = G.NET.factory(d);
      d.startup = null;
    }
    net.touch();
    return net;
  };

  /* laboratorio libre */
  S.libre = () => {
    const net = new Network();
    net.add('R1', '2911', 170, 50);
    net.add('R2', '2911', 470, 50);
    net.add('S1', '2960', 170, 160);
    net.add('S2', '2960', 470, 160);
    net.add('PC1', 'PC', 100, 270);
    net.add('PC2', 'PC', 240, 270);
    net.add('PC3', 'PC', 400, 270);
    net.add('PC4', 'PC', 540, 270);
    for (const r of ['R1', 'R2']) {
      net.devs[r].slots[0] = 'HWIC-2T';
      net.reboot(net.devs[r]);
    }
    net.link('R1', S0, 'R2', S0, 'serial', 'R1');
    net.link('R1', G0, 'S1', G1);
    net.link('R2', G0, 'S2', G1);
    net.link('S1', F(1), 'PC1', NIC);
    net.link('S1', F(2), 'PC2', NIC);
    net.link('S2', F(1), 'PC3', NIC);
    net.link('S2', F(2), 'PC4', NIC);
    return net;
  };

  G.SCENES = { S, conf, pc, save };
})(typeof window !== 'undefined' ? window : globalThis);
