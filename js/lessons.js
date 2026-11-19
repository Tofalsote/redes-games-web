/* Misiones. Cada una tiene un escenario (scene), el equipo en el que empiezas (start) y sus pasos.
   Cada paso: t (qué hacer), y una pista: hint (orden), go (equipo al que ir) o tip (texto). ok(c) comprueba.
   c = { line, r, net, ses, at, tab }: lo escrito, el resultado, la red, la sesión activa y en qué equipo estás. */
(function (G) {
  'use strict';
  const { S, conf, pc, save } = G.SCENES;
  const IP = G.NET.IP;
  const { ip2n } = IP;

  const D = (c, id) => c.net.devs[id];
  const cf = (c, id) => D(c, id).cfg;
  const IF = (c, id, n) => cf(c, id).ifs[n];
  const ipIs = (c, id, n, ip, m) => {
    const f = IF(c, id, n);
    return !!f && f.ip === ip2n(ip) && (!m || f.mask === ip2n(m));
  };
  const up = (c, id, n) => c.net.isUp(D(c, id), n);
  const on = (c, id) => c.at === id;
  const mode = (c, m) => c.ses.kind === 'ios' && c.ses.mode === m;
  const ran = (c, re) => !!c.r.cmd && re.test(c.r.cmd);
  const pingOk = (c, from, to) => !!c.r.ping && c.r.ping.ok && !c.r.ping.trace && !c.r.ping.quiet && c.r.ping.from === from && (to == null || c.r.ping.to === ip2n(to)) && (c.r.ping.got == null || c.r.ping.got > 0);
  const pingBad = (c, from, to) => !!c.r.ping && !c.r.ping.ok && c.r.ping.from === from && (to == null || c.r.ping.to === ip2n(to));
  const pcIp = (c, id, ip, gw) => {
    const p = D(c, id).pc;
    return p.ip === ip2n(ip) && (!gw || p.gw === ip2n(gw));
  };
  const hasRoute = (c, id, net) => c.net.routes(D(c, id)).some((r) => r.net === ip2n(net) && r.code !== 'L');
  const GO = (id, t) => ({ t: t || `Abre la consola de <b>${id}</b>: pulsa su nombre encima de la terminal o en el dibujo.`, go: id, ok: (c) => c.tab === id });
  const G0 = 'GigabitEthernet0/0';
  const G1 = 'GigabitEthernet0/1';
  const S0 = 'Serial0/0/0';

  G.LESSONS = [
    /* ================= NIVEL 1 · PRIMEROS PASOS ================= */
    {
      id: 'modos',
      title: 'Hola, router',
      tag: 'Modos de IOS',
      say: 'Soy Pix. Esto es la consola de un router Cisco de verdad (bueno, casi). Empecemos por lo básico: los modos.',
      scene: () => S.lan(),
      start: 'R1',
      body: `
        <p>Los routers y switches Cisco funcionan con un sistema llamado <b>IOS</b>. No tiene ventanas: se maneja
        escribiendo órdenes en la <b>consola</b>, igual que en Packet Tracer cuando abres la pestaña <b>CLI</b>.</p>
        <p>IOS tiene <b>modos</b>, como las plantas de un edificio. En cada planta puedes hacer cosas distintas, y el final del
        texto que hay antes del cursor (el <b>prompt</b>) te dice en cuál estás:</p>
        <div class="anatomy">
          <span class="part a"><code>Router&gt;</code><small>usuario: solo mirar</small></span>
          <span class="sep">enable →</span>
          <span class="part b"><code>Router#</code><small>privilegiado: mirar todo</small></span>
          <span class="sep">conf t →</span>
          <span class="part c"><code>Router(config)#</code><small>configurar</small></span>
        </div>
        <p>Para bajar de planta: <code>exit</code> sube un nivel, <code>end</code> te lleva directo al <code>#</code> y
        <code>disable</code> vuelve de <code>#</code> a <code>&gt;</code>.</p>
        <p>En el dibujo, encima de R1 pone <code>hostname Router</code>: es el nombre de fábrica. R1 es solo la etiqueta del dibujo (como en Packet Tracer). Vamos a ponerle nombre de verdad.</p>`,
      steps: [
        { t: 'Pasa al modo privilegiado con <code>enable</code>. Fíjate en cómo el <code>&gt;</code> se convierte en <code>#</code>.', hint: 'enable', ok: (c) => mode(c, 'priv') },
        { t: 'Vuelve al modo usuario con <code>disable</code>.', hint: 'disable', ok: (c) => mode(c, 'user') },
        { t: 'Otra vez al modo privilegiado.', hint: 'enable', ok: (c) => mode(c, 'priv') },
        { t: 'Entra en el modo de configuración global: <code>configure terminal</code>.', hint: 'configure terminal', ok: (c) => mode(c, 'config') },
        { t: 'Cambia el nombre del router a <b>R1</b> con <code>hostname R1</code>. Mira el prompt… y el dibujo.', hint: 'hostname R1', ok: (c) => cf(c, 'R1').hostname === 'R1' },
        { t: 'Sal de la configuración con <code>exit</code>.', hint: 'exit', ok: (c) => mode(c, 'priv') && cf(c, 'R1').hostname === 'R1' },
        { t: 'Mira toda la configuración del router: <code>show running-config</code>. Busca la línea del hostname.', hint: 'show running-config', ok: (c) => ran(c, /^show running-config/) },
      ],
    },
    {
      id: 'atajos',
      title: 'Atajos y ayuda',
      tag: '? · abreviar · Tab',
      say: 'Nadie escribe "configure terminal" entero. Te enseño los trucos que usa todo el mundo.',
      scene: () => S.lan(),
      start: 'R1',
      setup(net) {
        conf(net, 'R1', 'hostname R1');
      },
      body: `
        <p>IOS tiene tres ayudas que te van a salvar en el examen:</p>
        <div class="cards">
          <div><code>?</code><small>qué puedes escribir ahora</small></div>
          <div><code>show ?</code><small>qué puede ir detrás de una palabra</small></div>
          <div><code>Tab</code><small>completa la palabra que estás escribiendo</small></div>
          <div><code>↑</code><small>recupera órdenes anteriores</small></div>
        </div>
        <p>Además, IOS entiende las palabras <b>abreviadas</b> mientras no haya duda: <code>conf t</code> es
        <code>configure terminal</code>, <code>sh ip int br</code> es <code>show ip interface brief</code>.</p>
        <p>Y un clásico: si escribes mal una orden en modo <code>&gt;</code> o <code>#</code>, IOS cree que es el nombre de
        un equipo y lo busca en un servidor DNS que no existe. En un router de verdad se queda <b>casi un minuto</b> colgado.
        Por eso lo primero que se configura siempre es <code>no ip domain-lookup</code>.</p>`,
      steps: [
        { t: 'Entra en modo privilegiado.', hint: 'enable', ok: (c) => mode(c, 'priv') },
        { t: 'Escribe solo <code>?</code> y pulsa Enter: verás todas las órdenes de este modo.', hint: '?', ok: (c) => c.r.help && c.line.trim() === '?' },
        { t: 'Ahora pregunta qué puede ir detrás de show: <code>show ?</code>', hint: 'show ?', ok: (c) => c.r.help && /^sh\w*\s+\?$/i.test(c.line.trim()) },
        { t: 'Usa la versión corta para ver la configuración: <code>sh run</code>', hint: 'sh run', ok: (c) => ran(c, /^show running-config/) && !/running-config/i.test(c.line) },
        { t: 'Escribe mal a propósito, por ejemplo <code>hola</code>, y mira lo que pasa.', hint: 'hola', ok: (c) => !!c.r.lookup },
        { t: 'Arréglalo: entra en configuración con la forma corta <code>conf t</code>.', hint: 'conf t', ok: (c) => mode(c, 'config') },
        { t: 'Desactiva la búsqueda de nombres: <code>no ip domain-lookup</code>', hint: 'no ip domain-lookup', ok: (c) => cf(c, 'R1').lookup === false },
        { t: 'Sin salir de configuración, mira el resumen de interfaces anteponiendo <code>do</code>: <code>do sh ip int br</code>', hint: 'do sh ip int br', ok: (c) => ran(c, /^do /) && /Interface\s+IP-Address/.test(c.r.out) },
        { t: 'Vuelve al modo # de un salto: <code>end</code>', hint: 'end', ok: (c) => mode(c, 'priv') },
        { t: 'Prueba ahora a escribir mal otra vez (<code>hola</code>): ya no busca en el DNS.', hint: 'hola', ok: (c) => !!c.r.lookup && !/domain server/.test(c.r.out) },
      ],
    },
    {
      id: 'claves',
      title: 'Ponle candado',
      tag: 'Contraseñas',
      say: 'Un router sin contraseñas es una puerta abierta. Vamos a cerrar las tres entradas.',
      scene: () => S.lan(),
      start: 'R1',
      setup(net) {
        conf(net, 'R1', 'hostname R1\nno ip domain-lookup');
      },
      body: `
        <p>A un router se puede entrar por tres sitios, y cada uno lleva su contraseña:</p>
        <div class="cards">
          <div><code>enable secret</code><small>para pasar de &gt; a #</small></div>
          <div><code>line console 0</code><small>el cable de consola (lo que usas ahora)</small></div>
          <div><code>line vty 0 4</code><small>las entradas remotas: Telnet y SSH</small></div>
        </div>
        <p>En las líneas, <code>password</code> pone la contraseña y <code>login</code> obliga a pedirla. Sin
        <code>login</code> la contraseña no sirve de nada.</p>
        <p>Las contraseñas de las líneas se ven tal cual en <code>show running-config</code>. Con
        <code>service password-encryption</code> se guardan cifradas (tipo 7, un cifrado flojo pero que evita miradas).
        <code>enable secret</code> ya va cifrado siempre (tipo 5).</p>
        <p class="note">En clase y en Packet Tracer las de toda la vida son <code>cisco</code> para las líneas y <code>class</code> para enable.</p>`,
      steps: [
        { t: 'Entra en configuración global.', hint: 'enable', ok: (c) => mode(c, 'priv') },
        { t: '…', hint: 'conf t', ok: (c) => mode(c, 'config') },
        { t: 'Contraseña para el modo privilegiado: <code>enable secret class</code>', hint: 'enable secret class', ok: (c) => cf(c, 'R1').enableSecret === 'class' },
        { t: 'Entra en la línea de consola: <code>line console 0</code>', hint: 'line console 0', ok: (c) => mode(c, 'line') && c.ses.ctx.line === 'con' },
        { t: 'Ponle la contraseña <code>cisco</code>.', hint: 'password cisco', ok: (c) => cf(c, 'R1').con.pass === 'cisco' },
        { t: 'Y obliga a pedirla con <code>login</code>.', hint: 'login', ok: (c) => cf(c, 'R1').con.login },
        { t: 'Ahora las líneas remotas: <code>line vty 0 4</code>', hint: 'line vty 0 4', ok: (c) => mode(c, 'line') && c.ses.ctx.line === 'vty' },
        { t: 'Contraseña <code>cisco</code> para ellas también.', hint: 'password cisco', ok: (c) => cf(c, 'R1').vty.pass === 'cisco' },
        { t: '…y <code>login</code>.', hint: 'login', ok: (c) => cf(c, 'R1').vty.login && mode(c, 'line') },
        { t: 'Sal de la línea y cifra las contraseñas: primero <code>exit</code>…', hint: 'exit', ok: (c) => mode(c, 'config') },
        { t: '…y después <code>service password-encryption</code>.', hint: 'service password-encryption', ok: (c) => cf(c, 'R1').spe },
        { t: 'Un aviso para intrusos: <code>banner motd #Solo personal autorizado#</code> (empieza y acaba con el mismo carácter).', hint: 'banner motd #Solo personal autorizado#', ok: (c) => !!cf(c, 'R1').banner },
        { t: 'Comprueba las contraseñas filtrando la configuración: <code>do show run | include password</code>. Salen cifradas.', hint: 'do show run | include password', ok: (c) => c.r.piped && /password 7 /.test(c.r.out) },
        { t: 'Pruébalo: cierra la sesión. Ve al modo # (<code>end</code>) y escribe <code>exit</code>.', hint: 'exit', ok: (c) => !!c.ses.pending && c.ses.pending.prompt === '' && cf(c, 'R1').con.login },
        { t: 'Pulsa <b>Enter</b> como pide el router. Saldrá el banner y te pedirá la contraseña.', tip: 'Deja la línea vacía y pulsa Enter.', ok: (c) => !!c.ses.pending && /Password/.test(c.ses.pending.prompt) },
        { t: 'Escribe <code>cisco</code> (no se ve mientras escribes, como en un router de verdad).', hint: 'cisco', ok: (c) => mode(c, 'user') && !c.ses.pending },
        { t: 'Ahora <code>enable</code>: también te pedirá contraseña.', hint: 'enable', ok: (c) => mode(c, 'priv') || (!!c.ses.pending && /Password/.test(c.ses.pending.prompt)) },
        { t: 'Escribe <code>class</code>.', hint: 'class', ok: (c) => mode(c, 'priv') },
      ],
    },
    {
      id: 'interfaces',
      title: 'Enciende el router',
      tag: 'Interfaces',
      say: 'Los puertos de un router vienen apagados de fábrica. Si no los enciendes, el cable se queda en rojo.',
      scene: () => S.lan(),
      start: 'R1',
      setup(net) {
        conf(net, 'R1', 'hostname R1\nno ip domain-lookup');
        conf(net, 'S1', 'hostname S1');
      },
      body: `
        <p>Cada puerto es una <b>interfaz</b> con su nombre. El 2911 de Packet Tracer tiene tres:</p>
        <div class="cards">
          <div><code>GigabitEthernet0/0</code><small>se abrevia g0/0</small></div>
          <div><code>GigabitEthernet0/1</code><small>g0/1</small></div>
          <div><code>GigabitEthernet0/2</code><small>g0/2</small></div>
        </div>
        <p>Para que un puerto de router funcione necesita dos cosas: una <b>dirección IP con su máscara</b> y estar
        <b>encendido</b> con <code>no shutdown</code>. Los routers traen todos sus puertos apagados
        (<i>administratively down</i>); los switches, en cambio, los traen encendidos.</p>
        <div class="flow pipe">
          <span class="box">interface g0/0</span><span class="arrow">→</span>
          <span class="box">ip address</span><span class="arrow">→</span>
          <span class="box">no shutdown</span>
        </div>
        <p>Mira el cable entre R1 y el switch en el dibujo: ahora está rojo. Fíjate en él al encender el puerto.</p>`,
      steps: [
        { t: 'Entra en modo privilegiado y mira el resumen de interfaces: <code>show ip interface brief</code>.', hint: 'enable', ok: (c) => mode(c, 'priv') },
        { t: '…', hint: 'show ip interface brief', ok: (c) => ran(c, /^show ip interface brief/) },
        { t: 'Todas pone <i>administratively down</i>. Entra en configuración.', hint: 'conf t', ok: (c) => mode(c, 'config') },
        { t: 'Entra en la interfaz que va al switch: <code>interface g0/0</code>', hint: 'interface g0/0', ok: (c) => mode(c, 'if') && c.ses.ctx.ifs[0] === G0 },
        { t: 'Dale la IP <code>192.168.1.1</code> con máscara <code>255.255.255.0</code>.', hint: 'ip address 192.168.1.1 255.255.255.0', ok: (c) => ipIs(c, 'R1', G0, '192.168.1.1', '255.255.255.0') },
        { t: 'Apúntate para qué es: <code>description LAN de clase</code>', hint: 'description LAN de clase', ok: (c) => !!IF(c, 'R1', G0).desc },
        { t: 'Enciéndela: <code>no shutdown</code>. Mira los mensajes y el cable.', hint: 'no shutdown', ok: (c) => up(c, 'R1', G0) },
        { t: 'Vuelve al modo # y comprueba que pone <b>up up</b>.', hint: 'end', ok: (c) => mode(c, 'priv') },
        { t: '…', hint: 'show ip interface brief', ok: (c) => ran(c, /^show ip interface brief/) && up(c, 'R1', G0) },
      ],
    },
    {
      id: 'switch',
      title: 'El switch también tiene IP',
      tag: 'Switch 2960',
      say: 'El switch no necesita IP para funcionar, pero sin ella no puedes administrarlo a distancia.',
      scene: () => S.lan({ r1: true }),
      start: 'S1',
      body: `
        <p>Un switch 2960 tiene 24 puertos <code>FastEthernet0/1</code>…<code>0/24</code> y dos
        <code>GigabitEthernet0/1</code> y <code>0/2</code>. A sus puertos <b>no se les pone IP</b>: el switch solo pasa
        tramas de un lado a otro.</p>
        <p>Para poder entrar en él por Telnet o SSH se le da una IP de gestión en una interfaz virtual, la
        <code>interface vlan 1</code>, y una <b>puerta de enlace</b> para que pueda contestar a otras redes.</p>
        <div class="anatomy">
          <span class="part a"><code>interface vlan 1</code><small>interfaz de gestión</small></span>
          <span class="part b"><code>ip address</code><small>IP del switch</small></span>
          <span class="part c"><code>ip default-gateway</code><small>el router (en config global)</small></span>
        </div>
        <p class="note">La <code>vlan 1</code> también viene apagada: acuérdate del <code>no shutdown</code>.</p>`,
      steps: [
        { t: 'Estás en la consola del switch. Entra en configuración.', hint: 'enable', ok: (c) => mode(c, 'priv') && on(c, 'S1') },
        { t: '…', hint: 'conf t', ok: (c) => mode(c, 'config') && on(c, 'S1') },
        { t: 'Ponle de nombre <b>S1</b>.', hint: 'hostname S1', ok: (c) => cf(c, 'S1').hostname === 'S1' },
        { t: 'Entra en la interfaz de gestión: <code>interface vlan 1</code>', hint: 'interface vlan 1', ok: (c) => mode(c, 'if') && c.ses.ctx.ifs[0] === 'Vlan1' },
        { t: 'IP <code>192.168.1.2</code>, máscara <code>255.255.255.0</code>.', hint: 'ip address 192.168.1.2 255.255.255.0', ok: (c) => ipIs(c, 'S1', 'Vlan1', '192.168.1.2', '255.255.255.0') },
        { t: 'Enciéndela.', hint: 'no shutdown', ok: (c) => up(c, 'S1', 'Vlan1') },
        { t: 'Sal a la configuración global.', hint: 'exit', ok: (c) => mode(c, 'config') },
        { t: 'La puerta de enlace es el router: <code>ip default-gateway 192.168.1.1</code>', hint: 'ip default-gateway 192.168.1.1', ok: (c) => cf(c, 'S1').dgw === ip2n('192.168.1.1') },
        { t: 'Vuelve al # y haz <code>ping 192.168.1.1</code>. Cada <code>!</code> es una respuesta.', hint: 'end', ok: (c) => mode(c, 'priv') },
        { t: '…', hint: 'ping 192.168.1.1', ok: (c) => pingOk(c, 'S1', '192.168.1.1') },
      ],
    },
    {
      id: 'pcs',
      title: 'PCs y el primer ping',
      tag: 'IP de los PCs · guardar',
      say: 'Hora de dar IP a los PCs y comprobar que todo se ve. Y al final, ¡a guardar!',
      scene: () => S.lan({ r1: true, s1: true }),
      start: 'PC1',
      body: `
        <p>En Packet Tracer la IP de un PC se pone en <b>Desktop → IP Configuration</b>. Aquí lo haremos desde su
        <b>Command Prompt</b>, que también lo admite:</p>
        <div class="anatomy">
          <span class="part a"><code>ipconfig</code></span>
          <span class="part b"><code>192.168.1.10</code><small>IP</small></span>
          <span class="part c"><code>255.255.255.0</code><small>máscara</small></span>
          <span class="part a"><code>192.168.1.1</code><small>puerta de enlace</small></span>
        </div>
        <p>La <b>puerta de enlace</b> es la IP del router en esa red: a ella le manda el PC todo lo que no es de su red.</p>
        <p>Y lo más importante del examen: lo que configuras vive en la <b>RAM</b> (<code>running-config</code>).
        Si el router se reinicia, se pierde. Para guardarlo en la <b>NVRAM</b> (<code>startup-config</code>):</p>
        <div class="cards"><div><code>copy running-config startup-config</code><small>la forma larga</small></div><div><code>write</code><small>la corta</small></div></div>`,
      steps: [
        { t: 'En PC1, pon la IP <code>192.168.1.10/24</code> con puerta de enlace <code>192.168.1.1</code>.', hint: 'ipconfig 192.168.1.10 255.255.255.0 192.168.1.1', ok: (c) => pcIp(c, 'PC1', '192.168.1.10', '192.168.1.1') },
        { t: 'Compruébalo con <code>ipconfig</code>.', hint: 'ipconfig', ok: (c) => /IPv4 Address.*192\.168\.1\.10/.test(c.r.out) },
        { t: 'Haz ping al router. Verás el paquete viajar por el dibujo.', hint: 'ping 192.168.1.1', ok: (c) => pingOk(c, 'PC1', '192.168.1.1') },
        GO('PC2'),
        { t: 'Dale a PC2 la IP <code>192.168.1.11</code>, misma máscara y misma puerta de enlace.', hint: 'ipconfig 192.168.1.11 255.255.255.0 192.168.1.1', ok: (c) => pcIp(c, 'PC2', '192.168.1.11', '192.168.1.1') },
        { t: 'Haz ping de PC2 a PC1.', hint: 'ping 192.168.1.10', ok: (c) => pingOk(c, 'PC2', '192.168.1.10') },
        GO('R1', 'Ve a la consola de <b>R1</b> para guardar su configuración.'),
        { t: 'Entra en modo #.', hint: 'enable', ok: (c) => mode(c, 'priv') && on(c, 'R1') },
        { t: 'Guarda: <code>copy running-config startup-config</code>. Pregunta el nombre del archivo: pulsa Enter.', hint: 'copy running-config startup-config', ok: (c) => !!D(c, 'R1').startup },
        { t: 'Comprueba que está guardada: <code>show startup-config</code>', hint: 'show startup-config', ok: (c) => ran(c, /^show startup-config/) && /hostname R1/.test(c.r.out) },
      ],
    },

    /* ================= NIVEL 2 · CONECTAR REDES ================= */
    {
      id: 'cables',
      level: 2,
      title: 'Cada cable en su sitio',
      tag: 'Cableado',
      say: 'En Packet Tracer, el rayo de "conexión automática" es trampa. En el examen se elige el cable bueno.',
      scene: () => S.cables(),
      start: 'R1',
      body: `
        <p>Packet Tracer tiene varios cables y en el examen cuenta elegir el correcto:</p>
        <div class="cards">
          <div><code>Cobre directo</code><small>equipos <b>distintos</b>: PC–switch, router–switch</small></div>
          <div><code>Cobre cruzado</code><small>equipos <b>parecidos</b>: switch–switch, router–router, PC–router, PC–PC</small></div>
          <div><code>Serial DCE</code><small>router–router por puertos serie. Donde haces clic primero queda el DCE (el del reloj)</small></div>
          <div><code>Consola</code><small>PC (RS 232) → puerto Console del router. Solo para configurar</small></div>
        </div>
        <p>El truco: el PC y el router "hablan" igual, y el switch "escucha" al revés. Si los dos extremos son del mismo
        tipo (PC/router con PC/router, o switch con switch), cable <b>cruzado</b>.</p>
        <p><b>Pulsa en cada línea discontinua</b> del dibujo y elige su cable. Si te equivocas, el enlace se queda en rojo:
        púlsalo otra vez para cambiarlo.</p>`,
      steps: [
        { t: 'Conecta <b>PC1</b> con <b>S1</b>.', tip: 'PC y switch son distintos: cobre directo.', ok: (c) => c.net.cabled('PC1', 'S1', 'straight') },
        { t: 'Conecta <b>S1</b> con <b>R1</b>.', tip: 'Switch y router: cobre directo.', ok: (c) => c.net.cabled('S1', 'R1', 'straight') },
        { t: 'Conecta <b>S1</b> con <b>S2</b>.', tip: 'Dos switches: cobre cruzado.', ok: (c) => c.net.cabled('S1', 'S2', 'cross') },
        { t: 'Conecta <b>S2</b> con <b>PC2</b>.', tip: 'Cobre directo.', ok: (c) => c.net.cabled('S2', 'PC2', 'straight') },
        { t: 'Conecta <b>R1</b> con <b>R2</b> por sus puertos serie.', tip: 'Serial DCE. R1 queda como DCE.', ok: (c) => c.net.cabled('R1', 'R2', 'serial') },
        { t: 'Conecta <b>PC3</b> directamente a <b>R2</b>, sin switch.', tip: 'PC y router "hablan" igual: cobre cruzado.', ok: (c) => c.net.cabled('R2', 'PC3', 'cross') },
      ],
    },
    {
      id: 'modulo',
      level: 2,
      title: 'Puertos serie de quita y pon',
      tag: 'Módulo HWIC-2T',
      say: 'El 2911 no trae puertos serie. Hay que ponérselos, y con el router apagado.',
      scene: () => S.modulo(),
      start: 'R1',
      body: `
        <p>Para unir routers con cable serie hacen falta puertos <b>Serial</b>, y el 2911 no los trae de fábrica.
        Se añaden con un módulo <b>HWIC-2T</b> (2 puertos serie) en uno de sus huecos:</p>
        <div class="flow pipe">
          <span class="box">Physical</span><span class="arrow">→</span>
          <span class="box">apagar (frontal)</span><span class="arrow">→</span>
          <span class="box">arrastrar HWIC-2T</span><span class="arrow">→</span>
          <span class="box">encender</span>
        </div>
        <p>El nombre del puerto dice dónde está: <code>Serial0/<b>0</b>/1</code> es el puerto 1 del módulo del hueco 0. En el 2911 los huecos EHWIC se numeran de <b>derecha a izquierda</b>: el 0 es el de la derecha.</p>
        <p class="note">Ojo: apagar el router borra lo que no hayas guardado. Por eso se ponen los módulos <b>antes</b> de configurar.</p>
        <p>Abre la pestaña <b>Físico</b> de abajo para ver la parte de atrás de R1.</p>`,
      steps: [
        { t: 'Mira las interfaces de R1: no hay ninguna Serial.', hint: 'show ip interface brief', ok: (c) => ran(c, /^show ip interface brief/) && on(c, 'R1') },
        { t: 'En la pestaña <b>Físico</b>, <b>apaga</b> R1 con su interruptor. En el 2911 está en el <b>frontal</b>, junto a la toma de corriente.', tip: 'Pestaña Físico → vista Frontal → pulsa el interruptor I/O.', ok: (c) => !D(c, 'R1').power },
        { t: 'Arrastra un <b>HWIC-2T</b> de la lista al hueco <b>EHWIC 0</b> de la trasera (es el de más a la derecha).', tip: 'Lista Módulos → HWIC-2T → pulsa el hueco EHWIC 0 (el de la derecha).', ok: (c) => D(c, 'R1').slots[0] === 'HWIC-2T' },
        { t: '<b>Enciende</b> R1 otra vez con el interruptor.', tip: 'Interruptor POWER.', ok: (c) => D(c, 'R1').power && D(c, 'R1').slots[0] === 'HWIC-2T' },
        { t: 'Pulsa Enter en la consola para empezar y entra en modo #.', hint: 'enable', ok: (c) => mode(c, 'priv') && on(c, 'R1') },
        { t: 'Busca los puertos nuevos.', hint: 'show ip interface brief', ok: (c) => ran(c, /^show ip interface brief/) && /Serial0\/0\/0/.test(c.r.out) },
        { t: 'Cablea R1 con R2 (línea discontinua del dibujo) con el cable serie.', tip: 'Serial DCE, empezando por R1.', ok: (c) => c.net.cabled('R1', 'R2', 'serial') },
        { t: '¿Qué extremo es el DCE? <code>show controllers s0/0/0</code>', hint: 'show controllers s0/0/0', ok: (c) => /DCE/.test(c.r.out) },
      ],
    },
    {
      id: 'dosredes',
      level: 2,
      title: 'Un router, dos redes',
      tag: 'Enrutar',
      say: 'Un switch une equipos de la misma red. Para unir redes distintas hace falta un router.',
      scene: () => S.dos(),
      start: 'R1',
      body: `
        <p>Cada LAN es una <b>red distinta</b> con su propio rango de IPs. El router tiene una pata en cada una,
        y en cada pata una IP de esa red: esa IP es la <b>puerta de enlace</b> de los PCs de ese lado.</p>
        <div class="anatomy">
          <span class="part a"><code>192.168.1.0/24</code><small>red de PC1 · R1 G0/0 = .1</small></span>
          <span class="sep">R1</span>
          <span class="part b"><code>192.168.2.0/24</code><small>red de PC2 · R1 G0/1 = .1</small></span>
        </div>
        <p>El router conoce solo las redes en las que tiene una pata (<b>directamente conectadas</b>, letra
        <code>C</code> en <code>show ip route</code>) y pasa paquetes de una a otra.</p>`,
      steps: [
        { t: 'En R1, configura G0/0: <code>192.168.1.1/24</code> y enciéndela.', hint: 'enable', ok: (c) => mode(c, 'priv') },
        { t: '…', hint: 'conf t', ok: (c) => mode(c, 'config') },
        { t: '…', hint: 'interface g0/0', ok: (c) => mode(c, 'if') && c.ses.ctx.ifs[0] === G0 },
        { t: '…', hint: 'ip address 192.168.1.1 255.255.255.0', ok: (c) => ipIs(c, 'R1', G0, '192.168.1.1', '255.255.255.0') },
        { t: '…', hint: 'no shutdown', ok: (c) => up(c, 'R1', G0) },
        { t: 'Ahora G0/1 con <code>192.168.2.1/24</code>. Puedes saltar de interfaz sin salir: <code>interface g0/1</code>.', hint: 'interface g0/1', ok: (c) => mode(c, 'if') && c.ses.ctx.ifs[0] === G1 },
        { t: '…', hint: 'ip address 192.168.2.1 255.255.255.0', ok: (c) => ipIs(c, 'R1', G1, '192.168.2.1', '255.255.255.0') },
        { t: '…', hint: 'no shutdown', ok: (c) => up(c, 'R1', G1) },
        { t: 'Mira la tabla de rutas desde aquí: <code>do show ip route</code>. Busca las dos <code>C</code>.', hint: 'do show ip route', ok: (c) => ran(c, /^do /) && /C\s+192\.168\.2\.0/.test(c.r.out) },
        GO('PC1'),
        { t: 'PC1: <code>192.168.1.10/24</code>, puerta de enlace <code>192.168.1.1</code>.', hint: 'ipconfig 192.168.1.10 255.255.255.0 192.168.1.1', ok: (c) => pcIp(c, 'PC1', '192.168.1.10', '192.168.1.1') },
        GO('PC2'),
        { t: 'PC2: <code>192.168.2.10/24</code>, puerta de enlace <code>192.168.2.1</code>.', hint: 'ipconfig 192.168.2.10 255.255.255.0 192.168.2.1', ok: (c) => pcIp(c, 'PC2', '192.168.2.10', '192.168.2.1') },
        { t: 'Ping de PC2 a PC1, de una red a otra. El primer paquete se pierde (el router está preguntando quién es quién).', hint: 'ping 192.168.1.10', ok: (c) => pingOk(c, 'PC2', '192.168.1.10') },
      ],
    },
    {
      id: 'serie',
      level: 2,
      title: 'Enlace serie entre routers',
      tag: 'Serial · clock rate',
      say: 'Dos routers unidos por serie forman su propia red mini, de solo dos IPs.',
      scene: () => S.wan({ lans: true }),
      start: 'R1',
      body: `
        <p>El enlace entre dos routers es una red más. Como solo hay dos equipos, se usa una red <b>/30</b>
        (máscara <code>255.255.255.252</code>): 4 direcciones, de las que sirven 2.</p>
        <div class="anatomy">
          <span class="part a"><code>10.0.0.0</code><small>red</small></span>
          <span class="part b"><code>10.0.0.1</code><small>R1</small></span>
          <span class="part c"><code>10.0.0.2</code><small>R2</small></span>
          <span class="part a"><code>10.0.0.3</code><small>broadcast</small></span>
        </div>
        <p>En un cable serie uno de los extremos es el <b>DCE</b> y marca el ritmo: lleva <code>clock rate 64000</code>.
        El otro es el <b>DTE</b> y no lleva reloj. Sin reloj, el enlace queda en <i>up / down</i>.</p>
        <p class="note">Algunas versiones de Packet Tracer ya traen un reloj en el DCE, pero en el examen y en un router real lo pones tú.</p>`,
      steps: [
        { t: 'En R1 entra en la interfaz <code>s0/0/0</code>.', hint: 'enable', ok: (c) => mode(c, 'priv') },
        { t: '…', hint: 'conf t', ok: (c) => mode(c, 'config') },
        { t: '…', hint: 'interface s0/0/0', ok: (c) => mode(c, 'if') && c.ses.ctx.ifs[0] === S0 },
        { t: 'IP <code>10.0.0.1</code> con máscara <code>/30</code>.', hint: 'ip address 10.0.0.1 255.255.255.252', ok: (c) => ipIs(c, 'R1', S0, '10.0.0.1', '255.255.255.252') },
        { t: 'R1 es el DCE: ponle el reloj.', hint: 'clock rate 64000', ok: (c) => IF(c, 'R1', S0).clock === 64000 },
        { t: 'Enciéndela. Hasta que R2 no encienda la suya seguirá en rojo.', hint: 'no shutdown', ok: (c) => !IF(c, 'R1', S0).shut },
        GO('R2'),
        { t: 'En R2, interfaz <code>s0/0/0</code>…', hint: 'enable', ok: (c) => mode(c, 'priv') && on(c, 'R2') },
        { t: '…', hint: 'conf t', ok: (c) => mode(c, 'config') },
        { t: '…', hint: 'interface s0/0/0', ok: (c) => mode(c, 'if') && on(c, 'R2') },
        { t: '…con <code>10.0.0.2/30</code>.', hint: 'ip address 10.0.0.2 255.255.255.252', ok: (c) => ipIs(c, 'R2', S0, '10.0.0.2', '255.255.255.252') },
        { t: 'Enciéndela y mira el enlace en el dibujo.', hint: 'no shutdown', ok: (c) => up(c, 'R2', S0) },
        { t: 'Ping a R1 por el enlace serie.', hint: 'do ping 10.0.0.1', ok: (c) => pingOk(c, 'R2', '10.0.0.1') },
      ],
    },
    {
      id: 'estaticas',
      level: 2,
      title: 'Rutas estáticas',
      tag: 'ip route',
      say: 'Un router solo conoce sus redes. Para llegar más allá, alguien le tiene que contar el camino.',
      scene: () => S.wan({ lans: true, serial: true, pcs: true }),
      start: 'PC1',
      body: `
        <p>R1 conoce <code>192.168.1.0</code> y <code>10.0.0.0</code> porque tiene patas en ellas. Pero
        <code>192.168.2.0</code> está detrás de R2, y R1 no sabe que existe. Hay que decírselo con una
        <b>ruta estática</b>:</p>
        <div class="anatomy">
          <span class="part a"><code>ip route 192.168.2.0 255.255.255.0</code><small>para ir a esta red…</small></span>
          <span class="part b"><code>10.0.0.2</code><small>…dáselo a este vecino (siguiente salto)</small></span>
        </div>
        <p>Y la trampa de siempre: el ping es de <b>ida y vuelta</b>. Si R1 sabe ir pero R2 no sabe volver, el ping falla
        igual. Hacen falta rutas en los <b>dos</b> sentidos.</p>`,
      steps: [
        { t: 'Desde PC1, haz ping a PC2 (<code>192.168.2.10</code>). Fallará.', hint: 'ping 192.168.2.10', ok: (c) => pingBad(c, 'PC1', '192.168.2.10') },
        GO('R1'),
        { t: 'Mira la tabla de rutas de R1: falta la 192.168.2.0.', hint: 'enable', ok: (c) => mode(c, 'priv') && on(c, 'R1') },
        { t: '…', hint: 'show ip route', ok: (c) => ran(c, /^show ip route/) },
        { t: 'Añade la ruta: para ir a <code>192.168.2.0/24</code>, por <code>10.0.0.2</code>.', hint: 'conf t', ok: (c) => mode(c, 'config') },
        { t: '…', hint: 'ip route 192.168.2.0 255.255.255.0 10.0.0.2', ok: (c) => hasRoute(c, 'R1', '192.168.2.0') },
        GO('PC1', 'Vuelve a <b>PC1</b> y prueba otra vez el ping. ¿Funciona?'),
        { t: 'Ping a PC2. Sigue fallando: el paquete llega, pero R2 no sabe volver.', hint: 'ping 192.168.2.10', ok: (c) => pingBad(c, 'PC1', '192.168.2.10') },
        GO('R2'),
        { t: 'Ruta de vuelta en R2: para ir a <code>192.168.1.0/24</code>, por <code>10.0.0.1</code>.', hint: 'enable', ok: (c) => mode(c, 'priv') && on(c, 'R2') },
        { t: '…', hint: 'conf t', ok: (c) => mode(c, 'config') && on(c, 'R2') },
        { t: '…', hint: 'ip route 192.168.1.0 255.255.255.0 10.0.0.1', ok: (c) => hasRoute(c, 'R2', '192.168.1.0') },
        { t: 'Mírala en la tabla: sale con una <code>S</code>.', hint: 'do show ip route', ok: (c) => /S\s+192\.168\.1\.0/.test(c.r.out) },
        GO('PC1'),
        { t: 'Ahora sí: ping a PC2.', hint: 'ping 192.168.2.10', ok: (c) => pingOk(c, 'PC1', '192.168.2.10') },
        { t: 'Mira el camino que sigue: <code>tracert 192.168.2.10</code>', hint: 'tracert 192.168.2.10', ok: (c) => /Trace complete/.test(c.r.out) && c.r.ping && c.r.ping.ok },
      ],
    },
    {
      id: 'defecto',
      level: 2,
      title: 'Ruta por defecto',
      tag: '0.0.0.0',
      say: 'Si un router solo tiene una salida, no hace falta contarle cada red: "todo lo que no conozcas, por ahí".',
      scene: () => S.estrella(),
      start: 'R2',
      body: `
        <p>R2 y R3 son routers <b>de punta</b>: solo tienen un vecino, R1. Para ellos, cualquier red que no sea la suya
        está "por R1". En vez de una ruta por red se pone una <b>ruta por defecto</b>:</p>
        <div class="anatomy">
          <span class="part a"><code>ip route 0.0.0.0 0.0.0.0</code><small>cualquier destino</small></span>
          <span class="part b"><code>10.0.12.1</code><small>por R1</small></span>
        </div>
        <p>En <code>show ip route</code> sale como <code>S*</code> y como <i>Gateway of last resort</i>.
        R1, en el centro, ya tiene sus rutas a las tres LAN.</p>`,
      steps: [
        { t: 'Entra en configuración en R2.', hint: 'enable', ok: (c) => mode(c, 'priv') && on(c, 'R2') },
        { t: '…', hint: 'conf t', ok: (c) => mode(c, 'config') && on(c, 'R2') },
        { t: 'Ruta por defecto hacia R1 (<code>10.0.12.1</code>).', hint: 'ip route 0.0.0.0 0.0.0.0 10.0.12.1', ok: (c) => hasRoute(c, 'R2', '0.0.0.0') },
        { t: 'Compruébalo: <code>do show ip route</code>. Busca <i>Gateway of last resort</i>.', hint: 'do show ip route', ok: (c) => /Gateway of last resort is 10\.0\.12\.1/.test(c.r.out) },
        GO('R3'),
        { t: 'Lo mismo en R3, hacia <code>10.0.13.1</code>.', hint: 'enable', ok: (c) => mode(c, 'priv') && on(c, 'R3') },
        { t: '…', hint: 'conf t', ok: (c) => mode(c, 'config') && on(c, 'R3') },
        { t: '…', hint: 'ip route 0.0.0.0 0.0.0.0 10.0.13.1', ok: (c) => hasRoute(c, 'R3', '0.0.0.0') },
        GO('PC2'),
        { t: 'Ping de PC2 a PC3 (<code>192.168.3.10</code>): cruza los tres routers.', hint: 'ping 192.168.3.10', ok: (c) => pingOk(c, 'PC2', '192.168.3.10') },
      ],
    },
    {
      id: 'dhcp',
      level: 2,
      title: 'DHCP: IPs automáticas',
      tag: 'Servidor DHCP',
      say: 'Poner IPs a mano en 30 PCs es un rollo. Que lo haga el router.',
      scene: () => S.lan({ r1: true }),
      start: 'R1',
      body: `
        <p>Un servidor <b>DHCP</b> reparte IP, máscara, puerta de enlace y DNS a los equipos que lo piden. Un router
        Cisco puede serlo. Se configura en tres pasos:</p>
        <div class="flow pipe">
          <span class="box">excluded-address</span><span class="arrow">→</span>
          <span class="box">ip dhcp pool</span><span class="arrow">→</span>
          <span class="box">network · default-router · dns-server</span>
        </div>
        <p>Primero se <b>excluyen</b> las IPs que no se deben repartir (la del router, servidores, impresoras…). Luego se
        crea el <b>pool</b> con la red que reparte y la puerta de enlace que dará.</p>
        <p class="note">Ojo: <code>default-router</code> no es "el router por defecto" del DHCP: es la puerta de enlace que se da a los PCs.</p>`,
      steps: [
        { t: 'En R1, entra en configuración.', hint: 'enable', ok: (c) => mode(c, 'priv') },
        { t: '…', hint: 'conf t', ok: (c) => mode(c, 'config') },
        { t: 'Reserva de la .1 a la .10: <code>ip dhcp excluded-address 192.168.1.1 192.168.1.10</code>', hint: 'ip dhcp excluded-address 192.168.1.1 192.168.1.10', ok: (c) => cf(c, 'R1').dhcpEx.length > 0 },
        { t: 'Crea el pool <b>LAN</b>.', hint: 'ip dhcp pool LAN', ok: (c) => mode(c, 'dhcp') },
        { t: 'Red que reparte: <code>network 192.168.1.0 255.255.255.0</code>', hint: 'network 192.168.1.0 255.255.255.0', ok: (c) => Object.values(cf(c, 'R1').pools).some((p) => p.net === ip2n('192.168.1.0')) },
        { t: 'Puerta de enlace para los PCs.', hint: 'default-router 192.168.1.1', ok: (c) => Object.values(cf(c, 'R1').pools).some((p) => p.router === ip2n('192.168.1.1')) },
        { t: 'Y un DNS: <code>dns-server 8.8.8.8</code>', hint: 'dns-server 8.8.8.8', ok: (c) => Object.values(cf(c, 'R1').pools).some((p) => p.dns === ip2n('8.8.8.8')) },
        GO('PC1'),
        { t: 'Pide IP por DHCP: <code>ipconfig /renew</code> (en Packet Tracer: marcar <b>DHCP</b> en IP Configuration).', hint: 'ipconfig /renew', ok: (c) => c.r.dhcp && c.r.dhcp.ok && on(c, 'PC1') },
        GO('PC2'),
        { t: 'Lo mismo en PC2. ¿Qué IP le toca?', hint: 'ipconfig /renew', ok: (c) => c.r.dhcp && c.r.dhcp.ok && on(c, 'PC2') },
        { t: 'Ping de PC2 a PC1 (mira la IP de PC1 en el dibujo).', tip: 'ping a la IP que recibió PC1 (192.168.1.11).', ok: (c) => !!c.r.ping && c.r.ping.ok && c.r.ping.from === 'PC2' && c.r.ping.to === D(c, 'PC1').pc.ip },
        GO('R1'),
        { t: 'En R1, mira a quién ha dado IP: <code>show ip dhcp binding</code>', hint: 'do show ip dhcp binding', ok: (c) => /192\.168\.1\.1[12]/.test(c.r.out) && /Automatic/.test(c.r.out) },
      ],
    },

    /* ================= NIVEL 3 · EXAMEN ================= */
    {
      id: 'vlans',
      level: 3,
      title: 'VLAN: un switch, varias redes',
      tag: 'VLAN',
      say: 'Con VLAN, un solo switch se parte en varios switches de mentira que no se ven entre sí.',
      scene: () => S.vlan(),
      start: 'S1',
      body: `
        <p>Una <b>VLAN</b> separa los puertos de un switch en grupos. Los equipos de una VLAN no ven a los de otra,
        aunque estén en el mismo switch: es como tener dos switches. Cada VLAN es su propia red.</p>
        <div class="flow pipe">
          <span class="box">vlan 10 · name</span><span class="arrow">→</span>
          <span class="box">interface range</span><span class="arrow">→</span>
          <span class="box">switchport mode access</span><span class="arrow">→</span>
          <span class="box">switchport access vlan 10</span>
        </div>
        <p>Aquí PC1 y PC2 son de ALUMNOS (VLAN 10, <code>192.168.10.0</code>) y PC3 y PC4 de PROFES
        (VLAN 20, <code>192.168.20.0</code>). Sus IPs ya están puestas. Por defecto todo está en la VLAN 1.</p>`,
      steps: [
        { t: 'En S1, entra en configuración.', hint: 'enable', ok: (c) => mode(c, 'priv') },
        { t: '…', hint: 'conf t', ok: (c) => mode(c, 'config') },
        { t: 'Crea la VLAN 10…', hint: 'vlan 10', ok: (c) => mode(c, 'vlan') && !!cf(c, 'S1').vlans[10] },
        { t: '…y llámala ALUMNOS.', hint: 'name ALUMNOS', ok: (c) => cf(c, 'S1').vlans[10] === 'ALUMNOS' },
        { t: 'Ahora la VLAN 20, PROFES.', hint: 'vlan 20', ok: (c) => !!cf(c, 'S1').vlans[20] },
        { t: '…', hint: 'name PROFES', ok: (c) => cf(c, 'S1').vlans[20] === 'PROFES' },
        { t: 'Coge los puertos de PC1 y PC2 a la vez: <code>interface range fa0/1 - 2</code>', hint: 'interface range fa0/1 - 2', ok: (c) => mode(c, 'range') && c.ses.ctx.ifs.length === 2 },
        { t: 'Son puertos de PC: modo acceso.', hint: 'switchport mode access', ok: (c) => IF(c, 'S1', 'FastEthernet0/1').mode === 'access' && mode(c, 'range') },
        { t: 'Mételos en la VLAN 10.', hint: 'switchport access vlan 10', ok: (c) => IF(c, 'S1', 'FastEthernet0/2').vlan === 10 },
        { t: 'Ahora fa0/3 y fa0/4 a la VLAN 20.', hint: 'interface range fa0/3 - 4', ok: (c) => mode(c, 'range') && c.ses.ctx.ifs[0] === 'FastEthernet0/3' },
        { t: '…', hint: 'switchport mode access', ok: (c) => mode(c, 'range') && IF(c, 'S1', 'FastEthernet0/3').mode === 'access' },
        { t: '…', hint: 'switchport access vlan 20', ok: (c) => IF(c, 'S1', 'FastEthernet0/4').vlan === 20 && IF(c, 'S1', 'FastEthernet0/3').vlan === 20 },
        { t: 'Comprueba el reparto: <code>do show vlan brief</code>', hint: 'do show vlan brief', ok: (c) => /ALUMNOS\s+active\s+Fa0\/1, Fa0\/2/.test(c.r.out) },
        GO('PC1'),
        { t: 'PC1 llega a PC2 (misma VLAN)…', hint: 'ping 192.168.10.11', ok: (c) => pingOk(c, 'PC1', '192.168.10.11') },
        { t: '…pero no a PC3, que está en otra. Para eso hará falta un router (siguiente misión).', hint: 'ping 192.168.20.10', ok: (c) => pingBad(c, 'PC1', '192.168.20.10') },
      ],
    },
    {
      id: 'trunk',
      level: 3,
      title: 'Router-on-a-stick',
      tag: 'Trunk · subinterfaces',
      say: 'Un solo cable entre switch y router puede llevar todas las VLAN. Se llama trunk.',
      scene: () => S.vlan({ vlans: true }),
      start: 'S1',
      body: `
        <p>Para que las VLAN se hablen hace falta un router. En vez de un cable por VLAN, se usa <b>uno solo</b> en modo
        <b>trunk</b>: cada trama viaja con una etiqueta (802.1Q) que dice de qué VLAN es.</p>
        <p>En el router, ese puerto se parte en <b>subinterfaces</b>, una por VLAN. Cada una lleva la etiqueta que atiende
        y la IP que será la puerta de enlace de su VLAN:</p>
        <div class="anatomy">
          <span class="part a"><code>interface g0/0.10</code><small>subinterfaz</small></span>
          <span class="part b"><code>encapsulation dot1Q 10</code><small>atiende la VLAN 10</small></span>
          <span class="part c"><code>ip address 192.168.10.1 …</code><small>puerta de enlace de la VLAN 10</small></span>
        </div>
        <p class="note">El puerto físico <code>g0/0</code> no lleva IP, pero tiene que estar encendido.</p>`,
      steps: [
        { t: 'En S1, el puerto que va al router (<code>g0/1</code>) tiene que ser troncal.', hint: 'enable', ok: (c) => mode(c, 'priv') },
        { t: '…', hint: 'conf t', ok: (c) => mode(c, 'config') },
        { t: '…', hint: 'interface g0/1', ok: (c) => mode(c, 'if') && c.ses.ctx.ifs[0] === G1 },
        { t: '…', hint: 'switchport mode trunk', ok: (c) => IF(c, 'S1', G1).mode === 'trunk' },
        GO('R1'),
        { t: 'En R1, enciende el puerto físico <code>g0/0</code> (sin IP).', hint: 'enable', ok: (c) => mode(c, 'priv') && on(c, 'R1') },
        { t: '…', hint: 'conf t', ok: (c) => mode(c, 'config') && on(c, 'R1') },
        { t: '…', hint: 'interface g0/0', ok: (c) => mode(c, 'if') && on(c, 'R1') },
        { t: '…', hint: 'no shutdown', ok: (c) => !IF(c, 'R1', G0).shut },
        { t: 'Crea la subinterfaz de la VLAN 10: <code>interface g0/0.10</code>', hint: 'interface g0/0.10', ok: (c) => mode(c, 'subif') },
        { t: 'Que atienda la VLAN 10.', hint: 'encapsulation dot1Q 10', ok: (c) => !!IF(c, 'R1', 'GigabitEthernet0/0.10') && IF(c, 'R1', 'GigabitEthernet0/0.10').encap === 10 },
        { t: 'Y su IP, que es la puerta de enlace de ALUMNOS.', hint: 'ip address 192.168.10.1 255.255.255.0', ok: (c) => ipIs(c, 'R1', 'GigabitEthernet0/0.10', '192.168.10.1') },
        { t: 'Lo mismo para la VLAN 20.', hint: 'interface g0/0.20', ok: (c) => mode(c, 'subif') && c.ses.ctx.ifs[0] === 'GigabitEthernet0/0.20' },
        { t: '…', hint: 'encapsulation dot1Q 20', ok: (c) => IF(c, 'R1', 'GigabitEthernet0/0.20').encap === 20 },
        { t: '…', hint: 'ip address 192.168.20.1 255.255.255.0', ok: (c) => ipIs(c, 'R1', 'GigabitEthernet0/0.20', '192.168.20.1') },
        GO('PC1'),
        { t: 'Ahora sí: ping de PC1 (VLAN 10) a PC3 (VLAN 20).', hint: 'ping 192.168.20.10', ok: (c) => pingOk(c, 'PC1', '192.168.20.10') },
      ],
    },
    {
      id: 'ssh',
      level: 3,
      title: 'SSH: entrar seguro',
      tag: 'SSH',
      say: 'Telnet manda las contraseñas tal cual por el cable. SSH las cifra. En el examen siempre piden SSH.',
      scene: () => S.lan({ r1: true, s1: true, pcs: true }),
      start: 'R1',
      setup(net) {
        conf(net, 'R1', 'enable secret class');
      },
      body: `
        <p>Para administrar un router a distancia de forma segura se usa <b>SSH</b>. Necesita cinco cosas, y si falta una
        no funciona:</p>
        <div class="cards">
          <div><code>hostname</code><small>distinto de Router</small></div>
          <div><code>ip domain-name</code><small>un dominio</small></div>
          <div><code>crypto key generate rsa</code><small>claves de 1024 bits</small></div>
          <div><code>username … secret …</code><small>un usuario local</small></div>
          <div><code>line vty 0 4</code><small>login local + transport input ssh</small></div>
        </div>
        <p>Con el nombre y el dominio el router hace el nombre de sus claves (<code>R1.aula.local</code>). Por eso, sin
        ellos, no deja generarlas.</p>`,
      steps: [
        { t: 'En R1, entra en modo #. Ya tiene <code>enable secret</code>: la contraseña es <code>class</code>.', hint: 'enable', ok: (c) => mode(c, 'priv') || (!!c.ses.pending && /Password/.test(c.ses.pending.prompt)) },
        { t: '…', hint: 'class', ok: (c) => mode(c, 'priv') },
        { t: 'Entra en configuración.', hint: 'conf t', ok: (c) => mode(c, 'config') },
        { t: 'Intenta generar las claves ya. ¿Qué falta?', hint: 'crypto key generate rsa', ok: (c) => /domain-name/.test(c.r.err) },
        { t: 'Pon el dominio <code>aula.local</code>.', hint: 'ip domain-name aula.local', ok: (c) => cf(c, 'R1').domain === 'aula.local' },
        { t: 'Ahora sí, las claves. Cuando pregunte los bits, escribe <code>1024</code>.', hint: 'crypto key generate rsa', ok: (c) => !!c.ses.pending || cf(c, 'R1').rsa >= 768 },
        { t: '…', hint: '1024', ok: (c) => cf(c, 'R1').rsa >= 768 },
        { t: 'Usa la versión 2 de SSH.', hint: 'ip ssh version 2', ok: (c) => cf(c, 'R1').sshVer === 2 },
        { t: 'Crea el usuario <b>admin</b> con contraseña <b>cisco</b>.', hint: 'username admin secret cisco', ok: (c) => !!cf(c, 'R1').users.admin },
        { t: 'Entra en las líneas remotas.', hint: 'line vty 0 4', ok: (c) => mode(c, 'line') && c.ses.ctx.line === 'vty' },
        { t: 'Que pidan usuario y contraseña locales.', hint: 'login local', ok: (c) => cf(c, 'R1').vty.local },
        { t: 'Y que solo dejen entrar por SSH.', hint: 'transport input ssh', ok: (c) => cf(c, 'R1').vty.transport === 'ssh' },
        GO('PC1'),
        { t: 'Desde PC1 conéctate: <code>ssh -l admin 192.168.1.1</code>', hint: 'ssh -l admin 192.168.1.1', ok: (c) => c.ses.kind === 'ios' || (!!c.ses.pending && on(c, 'R1')) },
        { t: 'Contraseña: <code>cisco</code>. Fíjate en el prompt: estás dentro de R1 desde PC1.', hint: 'cisco', ok: (c) => c.ses.kind === 'ios' && on(c, 'R1') && c.tab === 'PC1' && mode(c, 'user') },
        { t: 'Pasa a modo # con <code>enable</code>…', hint: 'enable', ok: (c) => c.tab === 'PC1' && (mode(c, 'priv') || (!!c.ses.pending && /Password/.test(c.ses.pending.prompt))) },
        { t: '…su contraseña es <code>class</code>.', hint: 'class', ok: (c) => c.tab === 'PC1' && mode(c, 'priv') },
        { t: 'Sal de la sesión remota con <code>exit</code>.', hint: 'exit', ok: (c) => c.tab === 'PC1' && c.ses.kind === 'pc' },
        { t: 'Prueba Telnet: <code>telnet 192.168.1.1</code>. Lo rechazará: solo vale SSH.', hint: 'telnet 192.168.1.1', ok: (c) => /refused/.test(c.r.err) },
      ],
    },
    {
      id: 'ospf',
      level: 3,
      title: 'OSPF: que se apañen solos',
      tag: 'Enrutamiento dinámico',
      say: 'Con rutas estáticas, cada red nueva es trabajo en todos los routers. Con OSPF se lo cuentan entre ellos.',
      scene: () => S.wan({ lans: true, serial: true, pcs: true }),
      start: 'R1',
      body: `
        <p>Con un protocolo de <b>enrutamiento dinámico</b> los routers se cuentan qué redes conocen. OSPF es el más usado.
        En cada router se dice qué redes "entran" en OSPF, con una <b>wildcard</b> (la máscara al revés):</p>
        <div class="anatomy">
          <span class="part a"><code>router ospf 1</code><small>proceso 1</small></span>
          <span class="part b"><code>network 192.168.1.0 0.0.0.255</code><small>red + wildcard</small></span>
          <span class="part c"><code>area 0</code><small>área principal</small></span>
        </div>
        <div class="cards">
          <div><code>255.255.255.0</code><small>→ 0.0.0.255</small></div>
          <div><code>255.255.255.252</code><small>→ 0.0.0.3</small></div>
          <div><code>255.255.255.192</code><small>→ 0.0.0.63</small></div>
        </div>
        <p><code>passive-interface</code> evita mandar mensajes de OSPF hacia la LAN, donde no hay routers.</p>`,
      steps: [
        { t: 'En R1: <code>router ospf 1</code>', hint: 'enable', ok: (c) => mode(c, 'priv') },
        { t: '…', hint: 'conf t', ok: (c) => mode(c, 'config') },
        { t: '…', hint: 'router ospf 1', ok: (c) => mode(c, 'ospf') },
        { t: 'Mete la LAN de R1.', hint: 'network 192.168.1.0 0.0.0.255 area 0', ok: (c) => cf(c, 'R1').ospf.nets.some((n) => n.addr === ip2n('192.168.1.0')) },
        { t: 'Y el enlace serie (/30).', hint: 'network 10.0.0.0 0.0.0.3 area 0', ok: (c) => cf(c, 'R1').ospf.nets.some((n) => n.addr === ip2n('10.0.0.0')) },
        { t: 'Silencio hacia la LAN.', hint: 'passive-interface g0/0', ok: (c) => cf(c, 'R1').ospf.passive.includes(G0) },
        GO('R2'),
        { t: 'Lo mismo en R2.', hint: 'enable', ok: (c) => mode(c, 'priv') && on(c, 'R2') },
        { t: '…', hint: 'conf t', ok: (c) => mode(c, 'config') && on(c, 'R2') },
        { t: '…', hint: 'router ospf 1', ok: (c) => mode(c, 'ospf') && on(c, 'R2') },
        { t: '…', hint: 'network 192.168.2.0 0.0.0.255 area 0', ok: (c) => cf(c, 'R2').ospf.nets.some((n) => n.addr === ip2n('192.168.2.0')) },
        { t: 'Al meter el enlace serie, mira el mensaje: se hacen vecinos.', hint: 'network 10.0.0.0 0.0.0.3 area 0', ok: (c) => c.net.neighbors(D(c, 'R2'), 'ospf').length > 0 },
        { t: '…', hint: 'passive-interface g0/0', ok: (c) => cf(c, 'R2').ospf.passive.includes(G0) },
        { t: 'Mira los vecinos: <code>do show ip ospf neighbor</code>', hint: 'do show ip ospf neighbor', ok: (c) => /FULL/.test(c.r.out) },
        { t: 'Y la ruta aprendida, con una <code>O</code>.', hint: 'do show ip route', ok: (c) => /O\s+192\.168\.1\.0/.test(c.r.out) },
        GO('PC2'),
        { t: 'Ping de PC2 a PC1.', hint: 'ping 192.168.1.10', ok: (c) => pingOk(c, 'PC2', '192.168.1.10') },
      ],
    },
    {
      id: 'relay',
      level: 3,
      title: 'DHCP centralizado',
      tag: 'ip helper-address',
      say: 'Las peticiones DHCP son "a gritos" (difusión) y los routers no dejan pasar gritos. Salvo que se lo pidas.',
      scene: () => S.wan({ lans: true, serial: true, routes: true }),
      start: 'R2',
      setup(net) {
        net.devs.PC1.pc.dhcp = true;
      },
      body: `
        <p>Un PC sin IP pide una por <b>difusión</b>: grita a toda su red. Los routers no reenvían difusiones, así que si
        el servidor DHCP está en otra red, el grito no le llega.</p>
        <p>La solución es <code>ip helper-address</code> en la interfaz del router que da a esos PCs: recoge el grito
        y se lo manda al servidor como un paquete normal. A esto se le llama <b>DHCP relay</b>.</p>
        <div class="flow pipe">
          <span class="box">PC1 grita</span><span class="arrow">→</span>
          <span class="box">R1 G0/0 (helper)</span><span class="arrow">→</span>
          <span class="box">R2, servidor DHCP</span>
        </div>
        <p>Aquí R2 será el servidor de la LAN de R1. Las rutas ya están puestas.</p>`,
      steps: [
        { t: 'En R2 crea el pool para la LAN de R1. Primero las exclusiones.', hint: 'enable', ok: (c) => mode(c, 'priv') && on(c, 'R2') },
        { t: '…', hint: 'conf t', ok: (c) => mode(c, 'config') },
        { t: '…', hint: 'ip dhcp excluded-address 192.168.1.1 192.168.1.10', ok: (c) => cf(c, 'R2').dhcpEx.length > 0 },
        { t: 'El pool <b>LAN1</b>…', hint: 'ip dhcp pool LAN1', ok: (c) => mode(c, 'dhcp') },
        { t: '…con la red de R1…', hint: 'network 192.168.1.0 255.255.255.0', ok: (c) => Object.values(cf(c, 'R2').pools).some((p) => p.net === ip2n('192.168.1.0')) },
        { t: '…y la puerta de enlace de esa red (R1).', hint: 'default-router 192.168.1.1', ok: (c) => Object.values(cf(c, 'R2').pools).some((p) => p.router === ip2n('192.168.1.1')) },
        GO('PC1'),
        { t: 'Pide IP. No llegará: falla y se pone una 169.254.x.x (APIPA).', hint: 'ipconfig /renew', ok: (c) => c.r.dhcp && !c.r.dhcp.ok },
        GO('R1'),
        { t: 'En R1, en la interfaz de la LAN…', hint: 'enable', ok: (c) => mode(c, 'priv') && on(c, 'R1') },
        { t: '…', hint: 'conf t', ok: (c) => mode(c, 'config') && on(c, 'R1') },
        { t: '…', hint: 'interface g0/0', ok: (c) => mode(c, 'if') && on(c, 'R1') },
        { t: '…reenvía el DHCP a R2.', hint: 'ip helper-address 10.0.0.2', ok: (c) => IF(c, 'R1', G0).helpers.includes(ip2n('10.0.0.2')) },
        GO('PC1'),
        { t: 'Otra vez: <code>ipconfig /renew</code>.', hint: 'ipconfig /renew', ok: (c) => c.r.dhcp && c.r.dhcp.ok },
        { t: 'Ping a PC2 (192.168.2.x está detrás de R2).', tip: 'Antes dale IP a PC2 o haz ping a R2: ping 192.168.2.1', ok: (c) => !!c.r.ping && c.r.ping.ok && c.r.ping.from === 'PC1' },
      ],
    },
    {
      id: 'examen',
      level: 3,
      title: 'Simulacro de examen',
      tag: 'Todo junto',
      exam: true,
      say: 'Sin pistas paso a paso: te doy el enunciado y lo montas tú. Los pasos se marcan solos cuando están bien.',
      scene: () => S.examen(),
      start: 'R1',
      body: `
        <p><b>Enunciado.</b> Configura la red del dibujo, todo de fábrica:</p>
        <div class="exam-table">
          <table><thead><tr><th>Equipo</th><th>Interfaz</th><th>IP</th><th>Máscara</th></tr></thead><tbody>
            <tr><td>R1</td><td>G0/0</td><td>192.168.10.1</td><td>255.255.255.0</td></tr>
            <tr><td>R1</td><td>S0/0/0 (DCE)</td><td>10.0.0.1</td><td>255.255.255.252</td></tr>
            <tr><td>R2</td><td>G0/0</td><td>192.168.20.1</td><td>255.255.255.0</td></tr>
            <tr><td>R2</td><td>S0/0/0</td><td>10.0.0.2</td><td>255.255.255.252</td></tr>
            <tr><td>S1</td><td>VLAN 1</td><td>192.168.10.2</td><td>255.255.255.0</td></tr>
            <tr><td>PC1</td><td>Fa0</td><td>192.168.10.10</td><td>gw .1</td></tr>
            <tr><td>PC2</td><td>Fa0</td><td colspan="2">por DHCP desde R2 (excluye de la .1 a la .10)</td></tr>
          </tbody></table>
        </div>
        <ul>
          <li>Nombres: R1, R2, S1 y S2. En los routers: <code>enable secret class</code> y consola con <code>cisco</code> + <code>login</code>.</li>
          <li>Enrutamiento: estático u OSPF, el que prefieras.</li>
          <li>Al terminar, guarda la configuración de los dos routers.</li>
        </ul>
        <p class="note">Los pasos se tachan solos en cualquier orden. Si te atascas, cada uno tiene su pista.</p>`,
      steps: [
        { t: 'Nombres R1, R2, S1 y S2.', tip: 'hostname en cada equipo (conf t → hostname R1…).', ok: (c) => ['R1', 'R2', 'S1', 'S2'].every((id) => cf(c, id).hostname === id) },
        { t: 'Seguridad en R1 y R2: enable secret <b>class</b>, consola con <b>cisco</b> y login.', tip: 'enable secret class · line console 0 · password cisco · login', ok: (c) => ['R1', 'R2'].every((id) => cf(c, id).enableSecret === 'class' && cf(c, id).con.pass === 'cisco' && cf(c, id).con.login) },
        { t: 'LAN de R1 encendida: G0/0 192.168.10.1/24.', tip: 'interface g0/0 · ip address 192.168.10.1 255.255.255.0 · no shutdown', ok: (c) => ipIs(c, 'R1', G0, '192.168.10.1', '255.255.255.0') && up(c, 'R1', G0) },
        { t: 'LAN de R2 encendida: G0/0 192.168.20.1/24.', tip: 'Lo mismo en R2 con 192.168.20.1.', ok: (c) => ipIs(c, 'R2', G0, '192.168.20.1', '255.255.255.0') && up(c, 'R2', G0) },
        { t: 'Enlace serie up/up (10.0.0.1 y 10.0.0.2 /30, reloj en R1).', tip: 'interface s0/0/0 · ip address · clock rate 64000 (solo R1) · no shutdown', ok: (c) => ipIs(c, 'R1', S0, '10.0.0.1', '255.255.255.252') && ipIs(c, 'R2', S0, '10.0.0.2', '255.255.255.252') && up(c, 'R1', S0) },
        { t: 'S1 con IP de gestión 192.168.10.2 y puerta de enlace.', tip: 'interface vlan 1 · ip address · no shutdown · exit · ip default-gateway 192.168.10.1', ok: (c) => ipIs(c, 'S1', 'Vlan1', '192.168.10.2') && up(c, 'S1', 'Vlan1') && cf(c, 'S1').dgw === ip2n('192.168.10.1') },
        { t: 'Cada router conoce la LAN del otro.', tip: 'R1: ip route 192.168.20.0 255.255.255.0 10.0.0.2 · R2: ip route 192.168.10.0 255.255.255.0 10.0.0.1 (o OSPF).', ok: (c) => hasRoute(c, 'R1', '192.168.20.0') && hasRoute(c, 'R2', '192.168.10.0') },
        { t: 'PC1 con IP fija.', tip: 'En PC1: ipconfig 192.168.10.10 255.255.255.0 192.168.10.1', ok: (c) => pcIp(c, 'PC1', '192.168.10.10', '192.168.10.1') },
        { t: 'PC2 con IP del DHCP de R2.', tip: 'R2: ip dhcp excluded-address 192.168.20.1 192.168.20.10 · ip dhcp pool LAN2 · network 192.168.20.0 255.255.255.0 · default-router 192.168.20.1. Luego en PC2: ipconfig /renew', ok: (c) => D(c, 'PC2').pc.dhcp && D(c, 'PC2').pc.ip != null && IP.inNet(D(c, 'PC2').pc.ip, ip2n('192.168.20.0'), ip2n('255.255.255.0')) },
        { t: 'Ping de PC1 a PC2.', tip: 'En PC1: ping a la IP de PC2 (mírala en el dibujo).', ok: (c) => !!c.r.ping && c.r.ping.ok && c.r.ping.from === 'PC1' && c.r.ping.to === D(c, 'PC2').pc.ip },
        { t: 'Configuración guardada en R1 y R2.', tip: 'copy running-config startup-config en los dos (o write).', ok: (c) => ['R1', 'R2'].every((id) => D(c, id).startup && JSON.stringify(D(c, id).startup) === JSON.stringify(cf(c, id))) },
      ],
    },

    /* ================= ZONA DE JUEGO Y PRÁCTICA LIBRE ================= */
    { id: 'arcade1', mode: 'arcade', glevel: 1, icon: '⚡', title: 'Contrarreloj', tag: 'Modos, claves e interfaces', steps: [] },
    { id: 'ctf1', mode: 'ctf', glevel: 1, icon: '🚩', title: 'Caza de banderas', tag: 'El rack misterioso', steps: [], outro: 'Sabes moverte por un router y un switch ajenos. Eso es medio examen.' },
    { id: 'arcade2', mode: 'arcade', glevel: 2, icon: '⚡', title: 'Contrarreloj', tag: 'Rutas, serie y DHCP', steps: [] },
    { id: 'ctf2', mode: 'ctf', glevel: 2, icon: '🚩', title: 'Caza de banderas', tag: 'La red rota', steps: [], outro: 'Has arreglado rutas y te has colado por Telnet. Ya piensas como un administrador de red.' },
    { id: 'arcade3', mode: 'arcade', glevel: 3, icon: '⚡', title: 'Contrarreloj', tag: 'VLAN, SSH y OSPF', steps: [] },
    { id: 'ctf3', mode: 'ctf', glevel: 3, icon: '🚩', title: 'Caza de banderas', tag: 'La empresa', steps: [], outro: 'VLAN, SSH, OSPF y relay: el examen ya no te puede sorprender.' },
    {
      id: 'dibuja',
      mode: 'free',
      sandbox: true,
      icon: '✏️',
      title: 'Dibuja tu red',
      tag: 'Lienzo libre, como Packet Tracer',
      say: 'Aquí mandas tú: coloca equipos, tira cables y configúralo todo. Se guarda solo en este navegador.',
      scene: () => new G.NET.Network(),
      start: null,
      body: `<p>Un lienzo en blanco, como el espacio de trabajo de <b>Packet Tracer</b>. Usa la barra que hay encima del dibujo:</p>
        <div class="cards">
          <div><code>Equipos</code><small>elige router, switch, PC o servidor y pulsa en el lienzo para colocarlo</small></div>
          <div><code>Conexiones</code><small>elige el cable, pulsa un equipo, elige su puerto y luego el otro extremo</small></div>
          <div><code>Mover</code><small>arrastra los equipos; si solo los pulsas, se abre su consola</small></div>
          <div><code>Goma</code><small>pulsa un equipo o un cable para quitarlo</small></div>
        </div>
        <p>Para cables <b>serie</b> el router necesita un <b>HWIC-2T</b>: ábrelo en la pestaña <b>Físico</b>, apágalo, pon el módulo y enciéndelo.
        El primer equipo que pulses con el cable serie será el <b>DCE</b>.</p>
        <p class="note">Tu red se guarda sola en este navegador. Con <b>Guardar</b> la descargas como archivo para llevártela, y con <b>Abrir</b> la recuperas.</p>`,
      steps: [],
    },
    {
      id: 'libre',
      mode: 'free',
      icon: '🧪',
      title: 'Laboratorio libre',
      tag: '2 routers, 2 switches, 4 PCs',
      say: 'Todo de fábrica y bien cableado. Monta lo que quieras: aquí no hay nota.',
      scene: () => S.libre(),
      start: 'R1',
      body: `<p>Dos routers 2911 unidos por serie (R1 es el DCE), dos switches 2960 y cuatro PCs. Nada configurado.
        Practica el enunciado de tu examen, o inventa uno. Si lo rompes todo, <b>Reiniciar</b> lo deja como nuevo.</p>`,
      steps: [],
    },
  ];
  G.LESSON_HELP = { D, cf, IF, ipIs, up, on, mode, ran, pingOk, pingBad, pcIp, hasRoute };
})(typeof window !== 'undefined' ? window : globalThis);
