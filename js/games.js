/* Zona de juego: retos del contrarreloj y banderas escondidas de cada nivel.
   Reto: { goal, sol, dev (equipo), at (modo de partida), prep (órdenes previas), ok(c) }.
   Bandera: { id, name, clue, hint }. El valor FLAG{...} lo pone app.js (distinto en cada navegador). */
(function (G) {
  'use strict';
  const { S, conf, pc } = G.SCENES;
  const { ip2n } = G.NET.IP;
  const H = () => G.LESSON_HELP;
  const ch = (goal, sol, ok, o) => Object.assign({ goal, sol, ok, dev: 'R1', at: 'priv' }, o || {});
  const cf = (c, id) => c.net.devs[id].cfg;
  const IFc = (c, id, n) => c.net.devs[id].cfg.ifs[n];
  const G0 = 'GigabitEthernet0/0';
  const S0 = 'Serial0/0/0';

  /* ---------- nivel 1 ---------- */
  const A1 = [
    ch('Pasa al modo privilegiado.', 'enable', (c) => H().mode(c, 'priv'), { at: 'user' }),
    ch('Entra en configuración global.', 'configure terminal', (c) => H().mode(c, 'config')),
    ch('Cambia el nombre del router a <b>CORE</b>.', 'hostname CORE', (c) => cf(c, 'R1').hostname === 'CORE', { at: 'config' }),
    ch('Estás en una interfaz. Vuelve al modo # de un solo salto.', 'end', (c) => H().mode(c, 'priv'), { at: 'if:g0/0' }),
    ch('Contraseña cifrada <b>class</b> para el modo privilegiado.', 'enable secret class', (c) => cf(c, 'R1').enableSecret === 'class', { at: 'config' }),
    ch('Que una orden mal escrita no se ponga a buscar en el DNS.', 'no ip domain-lookup', (c) => cf(c, 'R1').lookup === false, { at: 'config' }),
    ch('Enciende esta interfaz.', 'no shutdown', (c) => !IFc(c, 'R1', G0).shut, { at: 'if:g0/0' }),
    ch('Dale a esta interfaz la IP <b>10.1.1.1/24</b>.', 'ip address 10.1.1.1 255.255.255.0', (c) => H().ipIs(c, 'R1', G0, '10.1.1.1', '255.255.255.0'), { at: 'if:g0/0' }),
    ch('Guarda la configuración en la NVRAM.', 'write', (c) => !!c.net.devs.R1.startup),
    ch('Mira el resumen de IPs y estado de las interfaces.', 'show ip interface brief', (c) => H().ran(c, /^show ip interface brief/)),
    ch('Cifra todas las contraseñas de la configuración.', 'service password-encryption', (c) => cf(c, 'R1').spe, { at: 'config' }),
    ch('Entra en la línea de consola.', 'line console 0', (c) => H().mode(c, 'line') && c.ses.ctx.line === 'con', { at: 'config' }),
    ch('Sin salir de configuración, mira el resumen de interfaces.', 'do show ip interface brief', (c) => H().ran(c, /^do /) && /Interface\s+IP-Address/.test(c.r.out), { at: 'config' }),
    ch('Estás en la consola: que pida contraseña al entrar (la contraseña ya está puesta).', 'login', (c) => cf(c, 'R1').con.login, { at: 'line:con', prep: 'line console 0\npassword cisco' }),
    ch('Mira la configuración guardada (la de arranque).', 'show startup-config', (c) => H().ran(c, /^show startup-config/)),
    ch('Mensaje de bienvenida: <b>#Prohibido el paso#</b>.', 'banner motd #Prohibido el paso#', (c) => /Prohibido/.test(cf(c, 'R1').banner || ''), { at: 'config' }),
    ch('En el switch: entra en su interfaz de gestión.', 'interface vlan 1', (c) => H().mode(c, 'if') && c.ses.ctx.ifs[0] === 'Vlan1', { dev: 'S1', at: 'config' }),
    ch('En el switch: puerta de enlace <b>192.168.1.1</b>.', 'ip default-gateway 192.168.1.1', (c) => cf(c, 'S1').dgw === ip2n('192.168.1.1'), { dev: 'S1', at: 'config' }),
    ch('En PC1: IP <b>192.168.1.20/24</b>, puerta de enlace .1', 'ipconfig 192.168.1.20 255.255.255.0 192.168.1.1', (c) => H().pcIp(c, 'PC1', '192.168.1.20', '192.168.1.1'), { dev: 'PC1' }),
    ch('Comprueba si llegas al router <b>192.168.1.1</b>.', 'ping 192.168.1.1', (c) => H().pingOk(c, 'R1') || H().pingOk(c, 'PC1') || H().pingOk(c, 'S1'), { dev: 'PC1', pcs: true }),
  ];

  /* ---------- nivel 2 ---------- */
  const A2 = [
    ch('Ruta a la red <b>192.168.2.0/24</b> por <b>10.0.0.2</b>.', 'ip route 192.168.2.0 255.255.255.0 10.0.0.2', (c) => cf(c, 'R1').routes.some((r) => r.net === ip2n('192.168.2.0') && r.mask === ip2n('255.255.255.0') && r.nh === ip2n('10.0.0.2')), { at: 'config' }),
    ch('Ruta por defecto por <b>10.0.0.2</b>.', 'ip route 0.0.0.0 0.0.0.0 10.0.0.2', (c) => cf(c, 'R1').routes.some((r) => r.net === 0 && r.mask === 0 && r.nh === ip2n('10.0.0.2')), { at: 'config' }),
    ch('Estás en el serie DCE: ponle el reloj a <b>64000</b>.', 'clock rate 64000', (c) => IFc(c, 'R1', S0).clock === 64000, { at: 'if:s0/0/0' }),
    ch('IP <b>10.0.0.1</b> con máscara de un /30 en esta interfaz.', 'ip address 10.0.0.1 255.255.255.252', (c) => H().ipIs(c, 'R1', S0, '10.0.0.1', '255.255.255.252'), { at: 'if:s0/0/0' }),
    ch('Mira la tabla de rutas.', 'show ip route', (c) => H().ran(c, /^show ip route/)),
    ch('¿Este serie es DCE o DTE? Pregúntaselo al router.', 'show controllers s0/0/0', (c) => /DCE|DTE/.test(c.r.out)),
    ch('Que el DHCP no reparta de la <b>.1</b> a la <b>.10</b> de 192.168.1.0.', 'ip dhcp excluded-address 192.168.1.1 192.168.1.10', (c) => cf(c, 'R1').dhcpEx.some(([a, b]) => a === ip2n('192.168.1.1') && b === ip2n('192.168.1.10')), { at: 'config' }),
    ch('Crea el pool DHCP <b>OFICINA</b>.', 'ip dhcp pool OFICINA', (c) => H().mode(c, 'dhcp') && !!cf(c, 'R1').pools.OFICINA, { at: 'config' }),
    ch('Estás en un pool: que reparta la red <b>192.168.1.0/24</b>.', 'network 192.168.1.0 255.255.255.0', (c) => Object.values(cf(c, 'R1').pools).some((p) => p.net === ip2n('192.168.1.0')), { at: 'dhcp:LAN' }),
    ch('Estás en un pool: puerta de enlace <b>192.168.1.1</b> para los clientes.', 'default-router 192.168.1.1', (c) => Object.values(cf(c, 'R1').pools).some((p) => p.router === ip2n('192.168.1.1')), { at: 'dhcp:LAN' }),
    ch('En PC1: pide IP por DHCP.', 'ipconfig /renew', (c) => !!c.r.dhcp, { dev: 'PC1', dhcp: true }),
    ch('Mira las IPs que ha repartido el DHCP.', 'show ip dhcp binding', (c) => H().ran(c, /^show ip dhcp binding/)),
    ch('En PC1: mira el camino hasta <b>192.168.2.10</b>.', 'tracert 192.168.2.10', (c) => /Tracing route/.test(c.r.out), { dev: 'PC1' }),
    ch('Enciende la segunda interfaz Gigabit.', 'no shutdown', (c) => !IFc(c, 'R1', 'GigabitEthernet0/1').shut, { at: 'if:g0/1' }),
    ch('Quita la ruta estática a 192.168.2.0 que hay puesta.', 'no ip route 192.168.2.0 255.255.255.0 10.0.0.2', (c) => !c.net.devs.R1.cfg.routes.length, { at: 'config', prep: 'ip route 192.168.2.0 255.255.255.0 10.0.0.2' }),
    ch('Mira qué equipos Cisco tiene enchufados el router.', 'show cdp neighbors', (c) => H().ran(c, /^show cdp neighbors/)),
  ];

  /* ---------- nivel 3 ---------- */
  const A3 = [
    ch('En el switch: crea la <b>VLAN 30</b>.', 'vlan 30', (c) => !!cf(c, 'S1').vlans[30], { dev: 'S1', at: 'config' }),
    ch('Estás en una VLAN: llámala <b>VENTAS</b>.', 'name VENTAS', (c) => Object.values(cf(c, 'S1').vlans).includes('VENTAS'), { dev: 'S1', at: 'vlan:30' }),
    ch('Este puerto es para un PC de la <b>VLAN 10</b>.', 'switchport access vlan 10', (c) => IFc(c, 'S1', 'FastEthernet0/5').vlan === 10, { dev: 'S1', at: 'if:fa0/5' }),
    ch('Este puerto va a otro switch: que lleve todas las VLAN.', 'switchport mode trunk', (c) => IFc(c, 'S1', 'GigabitEthernet0/2').mode === 'trunk', { dev: 'S1', at: 'if:g0/2' }),
    ch('Coge de golpe los puertos <b>fa0/1</b> a <b>fa0/12</b>.', 'interface range fa0/1 - 12', (c) => H().mode(c, 'range') && c.ses.ctx.ifs.length === 12, { dev: 'S1', at: 'config' }),
    ch('Mira las VLAN del switch y sus puertos.', 'show vlan brief', (c) => H().ran(c, /^show vlan/), { dev: 'S1' }),
    ch('Estás en una subinterfaz: que atienda la <b>VLAN 10</b>.', 'encapsulation dot1Q 10', (c) => Object.values(cf(c, 'R1').ifs).some((f) => f.encap === 10), { at: 'if:g0/0.10' }),
    ch('Dominio <b>aula.local</b> (lo pide SSH).', 'ip domain-name aula.local', (c) => cf(c, 'R1').domain === 'aula.local', { at: 'config' }),
    ch('Usuario <b>admin</b> con contraseña cifrada <b>cisco</b>.', 'username admin secret cisco', (c) => !!cf(c, 'R1').users.admin, { at: 'config' }),
    ch('Estás en las vty: que solo se entre por SSH.', 'transport input ssh', (c) => cf(c, 'R1').vty.transport === 'ssh', { at: 'line:vty' }),
    ch('Estás en las vty: que pidan usuario local.', 'login local', (c) => cf(c, 'R1').vty.local, { at: 'line:vty' }),
    ch('Versión 2 de SSH (las claves ya están).', 'ip ssh version 2', (c) => cf(c, 'R1').sshVer === 2, { at: 'config', prep: 'ip domain-name aula.local\ncrypto key generate rsa general-keys modulus 1024' }),
    ch('Activa OSPF con el proceso <b>1</b>.', 'router ospf 1', (c) => !!cf(c, 'R1').ospf, { at: 'config' }),
    ch('Estás en OSPF: mete la red <b>192.168.1.0/24</b> en el área 0.', 'network 192.168.1.0 0.0.0.255 area 0', (c) => cf(c, 'R1').ospf.nets.some((n) => n.addr === ip2n('192.168.1.0') && n.wild === ip2n('0.0.0.255')), { at: 'ospf' }),
    ch('Estás en OSPF: mete el enlace <b>10.0.0.0/30</b>.', 'network 10.0.0.0 0.0.0.3 area 0', (c) => cf(c, 'R1').ospf.nets.some((n) => n.addr === ip2n('10.0.0.0') && n.wild === ip2n('0.0.0.3')), { at: 'ospf' }),
    ch('Estás en OSPF: no mandes mensajes hacia la LAN (g0/0).', 'passive-interface g0/0', (c) => cf(c, 'R1').ospf.passive.includes(G0), { at: 'ospf' }),
    ch('Estás en la interfaz LAN: reenvía el DHCP a <b>10.0.0.2</b>.', 'ip helper-address 10.0.0.2', (c) => IFc(c, 'R1', G0).helpers.includes(ip2n('10.0.0.2')), { at: 'if:g0/0' }),
    ch('Estás en un puerto de PC: que pase a verde al instante.', 'spanning-tree portfast', (c) => IFc(c, 'S1', 'FastEthernet0/1').portfast, { dev: 'S1', at: 'if:fa0/1' }),
  ];

  /* modo de partida para cada reto */
  function place(ses, at) {
    const [m, arg] = at.split(':');
    if (ses.kind !== 'ios') return;
    ses.mode = 'priv';
    if (m === 'user' || m === 'priv') return (ses.mode = m);
    ses.run('configure terminal');
    if (m === 'if') ses.run('interface ' + arg);
    if (m === 'line') ses.run(arg === 'con' ? 'line console 0' : 'line vty 0 4');
    if (m === 'dhcp') ses.run('ip dhcp pool ' + arg);
    if (m === 'vlan') ses.run('vlan ' + arg);
    if (m === 'ospf') ses.run('router ospf 1');
  }

  /* escenario del contrarreloj */
  function arcScene(level) {
    if (level === 1) return S.lan();
    if (level === 2) return S.wan({ lans: true });
    return S.vlan({ vlans: true });
  }

  /* ---------- banderas ---------- */
  const F1 = [
    { id: 'b1', name: 'Bienvenida', clue: 'R1 enseña un mensaje a quien se conecta… pero tú ya estabas dentro cuando lo pusieron.', hint: 'En R1: sal de la sesión con exit y pulsa Enter.' },
    { id: 'b2', name: 'La pegatina', clue: 'Un puerto del switch tiene una nota pegada. Hay 26 puertos: no los mires uno a uno.', hint: 'En S1: show running-config | include FLAG' },
    { id: 'b3', name: 'La caja fuerte', clue: 'R1 guarda un secreto en su configuración, pero pide contraseña para el modo #. Alguien la apuntó en una VLAN del switch.', hint: 'En S1: show vlan brief. Luego en R1: enable y show running-config | include FLAG' },
    { id: 'b4', name: 'Regalo del DHCP', clue: 'El router reparte algo más que IPs a los PCs.', hint: 'En PC1: ipconfig /renew y después ipconfig /all' },
  ];
  const F2 = [
    { id: 'c1', name: 'Puerta trasera', clue: 'R2 tiene un mensaje para quien entre por Telnet. La contraseña de sus vty está en la descripción de un puerto de R1.', hint: 'En R1: show interfaces s0/0/0 (o show run | include description). Luego telnet 10.0.0.2' },
    { id: 'c2', name: 'Lo de siempre', clue: 'Ya dentro de R2, su modo # usa la contraseña de enable de toda la vida en clase.', hint: 'En la sesión Telnet a R2: enable (class) y show running-config | include FLAG' },
    { id: 'c3', name: 'Al otro lado', clue: 'El switch S2 tiene un mensaje de bienvenida, pero desde la red de R1 no se llega a él. Arregla la ruta que falta.', hint: 'En R1: ip route 192.168.2.0 255.255.255.0 10.0.0.2. Luego telnet 192.168.2.2' },
    { id: 'c4', name: 'El dominio', clue: 'R2 reparte IPs a la LAN de R2 con un dominio curioso.', hint: 'En PC2: ipconfig /renew y luego ipconfig /all' },
  ];
  const F3 = [
    { id: 'd1', name: 'VLAN secreta', clue: 'Hay una VLAN con un nombre que no es de ningún departamento.', hint: 'En S1: show vlan brief' },
    { id: 'd2', name: 'Solo SSH', clue: 'R1 solo deja entrar por SSH. El usuario y la contraseña están en la descripción del troncal de S1.', hint: 'En S1: show interfaces trunk / show run | include description. Luego en PC1: ssh -l jefa 192.168.10.1' },
    { id: 'd3', name: 'Más allá', clue: 'Detrás de R2 hay un switch (192.168.50.2) con un banner. R1 no lo conoce: a su OSPF le falta una red.', hint: 'En R1: router ospf 1 → network 10.0.0.0 0.0.0.3 area 0. Luego telnet 192.168.50.2 desde R1' },
    { id: 'd4', name: 'Relevo', clue: 'PC3 (VLAN 20) debería recibir IP y un dominio del DHCP de R2, pero a su subinterfaz le falta algo.', hint: 'En R1: interface g0/0.20 → ip helper-address 10.0.0.2. En PC3: ipconfig /renew y ipconfig /all' },
  ];

  /* Las banderas se colocan cuando app.js ya sabe sus valores: flag(id) → 'FLAG{...}' */
  function ctfScene(level, flag) {
    if (level === 1) {
      const net = S.lan();
      conf(net, 'R1', `hostname R1\nno ip domain-lookup\nenable secret Tigre7\nip domain-name ${flag('b3')}\ninterface g0/0\nip address 192.168.1.1 255.255.255.0\nno shutdown\nexit\nip dhcp excluded-address 192.168.1.1 192.168.1.10\nip dhcp pool AULA\nnetwork 192.168.1.0 255.255.255.0\ndefault-router 192.168.1.1\ndomain-name ${flag('b4')}\nexit\nbanner motd #${flag('b1')}#`);
      conf(net, 'S1', `hostname S1\nno ip domain-lookup\nvlan 99\nname clave-R1-Tigre7\nexit\ninterface fa0/17\ndescription ${flag('b2')}`);
      net.devs.PC1.pc.dhcp = true;
      return { net, start: 'S1' };
    }
    if (level === 2) {
      const net = S.wan({ lans: true, serial: true, pcs: false });
      pc(net, 'PC1', '192.168.1.10/24', '192.168.1.1');
      conf(net, 'R1', 'enable secret class\ninterface s0/0/0\ndescription R2 vty: Puma3');
      conf(net, 'R2', `enable secret class\nip route 192.168.1.0 255.255.255.0 10.0.0.1\nusername ${flag('c2')} secret x\nline vty 0 4\npassword Puma3\nlogin\nexit\nbanner motd #${flag('c1')}#\nip dhcp excluded-address 192.168.2.1 192.168.2.10\nip dhcp pool LAN2\nnetwork 192.168.2.0 255.255.255.0\ndefault-router 192.168.2.1\ndomain-name ${flag('c4')}`);
      conf(net, 'S2', `interface vlan 1\nip address 192.168.2.2 255.255.255.0\nno shutdown\nexit\nip default-gateway 192.168.2.1\nline vty 0 15\nno login\nexit\nbanner motd #${flag('c3')}#`);
      net.devs.PC2.pc.dhcp = true;
      return { net, start: 'R1' };
    }
    const net = S.vlan({ vlans: true });
    net.add('R2', '2911', 560, 45);
    net.add('S2', '2960', 560, 150);
    for (const r of ['R1', 'R2']) {
      net.devs[r].slots[0] = 'HWIC-2T';
      net.reboot(net.devs[r]);
    }
    net.devs.PC4.x = 470;
    net.devs.PC3.x = 360;
    net.devs.PC2.x = 220;
    net.devs.PC1.x = 80;
    net.link('R1', 'GigabitEthernet0/0', 'S1', 'GigabitEthernet0/1');
    net.link('R1', S0, 'R2', S0, 'serial', 'R1');
    net.link('R2', 'GigabitEthernet0/0', 'S2', 'GigabitEthernet0/1');
    conf(net, 'S1', `hostname S1\nvlan 66\nname ${flag('d1')}\nexit\ninterface g0/1\nswitchport mode trunk\ndescription R1 ssh jefa/Lince26`);
    conf(net, 'R1', `hostname R1\nno ip domain-lookup\nenable secret class\nip domain-name empresa.local\nusername jefa secret Lince26\ncrypto key generate rsa general-keys modulus 1024\nip ssh version 2\nline vty 0 4\nlogin local\ntransport input ssh\nexit\nbanner motd #${flag('d2')}#\ninterface g0/0\nno shutdown\ninterface g0/0.10\nencapsulation dot1Q 10\nip address 192.168.10.1 255.255.255.0\ninterface g0/0.20\nencapsulation dot1Q 20\nip address 192.168.20.1 255.255.255.0\ninterface s0/0/0\nip address 10.0.0.1 255.255.255.252\nclock rate 64000\nno shutdown\nexit\nrouter ospf 1\nnetwork 192.168.10.0 0.0.0.255 area 0\nnetwork 192.168.20.0 0.0.0.255 area 0`);
    conf(net, 'R2', `hostname R2\nno ip domain-lookup\ninterface s0/0/0\nip address 10.0.0.2 255.255.255.252\nno shutdown\ninterface g0/0\nip address 192.168.50.1 255.255.255.0\nno shutdown\nexit\nrouter ospf 1\nnetwork 10.0.0.0 0.0.0.3 area 0\nnetwork 192.168.50.0 0.0.0.255 area 0\nexit\nip dhcp pool VLAN20\nnetwork 192.168.20.0 255.255.255.0\ndefault-router 192.168.20.1\ndomain-name ${flag('d4')}`);
    conf(net, 'S2', `hostname S2\ninterface vlan 1\nip address 192.168.50.2 255.255.255.0\nno shutdown\nexit\nip default-gateway 192.168.50.1\nline vty 0 15\nno login\nexit\nbanner motd #${flag('d3')}#`);
    net.devs.PC3.pc = { ip: null, mask: null, gw: null, dns: null, dhcp: true, domain: null };
    return { net, start: 'PC1' };
  }

  G.GAMES = {
    sets: {
      1: { challenges: A1, flags: F1, maxLines: 25 },
      2: { challenges: A2, flags: F2, maxLines: 25 },
      3: { challenges: A3, flags: F3, maxLines: 25 },
    },
    place,
    arcScene,
    ctfScene,
  };
})(typeof window !== 'undefined' ? window : globalThis);
