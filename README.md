# Redes Games

Web para aprender a configurar routers y switches Cisco como en **Packet Tracer**, jugando.
Pensada para el módulo de Planificación y Administración de Redes (ASIR) y para preparar el examen práctico.
Todo ocurre en el navegador: la consola de IOS, los PCs y la red son un simulador.

## Abrirla

1. Descomprime el zip entero (no abras `index.html` desde dentro del zip).
2. Haz doble clic en `index.html`.

Funciona en Windows, macOS y Linux con un navegador actual. No necesita instalación, servidor ni Internet.

## Qué tiene

- **Nivel 1 · Primeros pasos** (6 misiones): modos de IOS, atajos y `?`, contraseñas, interfaces, IP de gestión del switch, IP de los PCs y guardar la configuración.
- **Nivel 2 · Conectar redes** (7 misiones): qué cable va en cada sitio, módulo HWIC-2T, un router con dos redes, enlace serie y `clock rate`, rutas estáticas, ruta por defecto y DHCP.
- **Nivel 3 · Examen** (6 misiones): VLAN, router-on-a-stick, SSH, OSPF, DHCP relay (`ip helper-address`) y un simulacro de examen.
- Cada nivel tiene su **zona de juego**: un contrarreloj y una caza de banderas. Las banderas son números aleatorios distintos en cada navegador.
- **Laboratorio libre** con 2 routers, 2 switches y 4 PCs sin configurar.
- **Dibuja tu red**: lienzo libre como el de Packet Tracer. Arrastras equipos (2911, 1941, 2960, PC, servidor), tiras cables eligiendo puerto o con el cable automático, envías PDU simples, pones notas y zonas, deshaces y rehaces, haces zoom, y guardas o abres la red como archivo `.json`.
- **Retos con nota** sobre el lienzo: 5 enunciados de examen que se corrigen solos (nota sobre 10).
- **Ventana de cada equipo** (doble clic): Physical, Config con formularios que muestran las órdenes IOS equivalentes, CLI y, en los PC, Desktop → IP Configuration.
- **Vista física detallada**: frontal y trasera del 2911 y del 1941 con sus huecos EHWIC, módulos HWIC-2T, HWIC-4ESW y HWIC-1GE-SFP, el 2960-24TT y la torre del PC, con cables enchufados y LED que siguen el estado real.
- **Topología en vivo**: los cables se ponen verdes cuando el enlace está up/up, y el ping se ve viajar por la red.
- Pestaña **Físico** para apagar el router y meter módulos, y elección de cable al cablear.
- Consola por equipo, chuleta de órdenes, puntos, rangos y logros.

## La consola

Imita la de IOS 15 en un 2911 y un 2960: modos (`>`, `#`, `(config)#`…), abreviaturas (`conf t`, `sh ip int br`),
`?` para ayuda, Tab para completar, `do`, `| include`, mensajes `%LINK-5-CHANGED`, `% Invalid input detected at '^' marker`,
`Translating "..."...domain server` y demás. Los PCs tienen `ipconfig`, `ping`, `tracert`, `telnet` y `ssh`.

No es un IOS completo: cubre lo que se pide en ASIR.

## Dónde tocar

| Archivo | Contenido |
| --- | --- |
| `js/lessons.js` | Misiones: texto, pasos, pista y comprobación de cada paso |
| `js/games.js` | Retos del contrarreloj y banderas de cada nivel |
| `js/scenes.js` | Escenarios: equipos, posiciones en el dibujo, cables y configuración previa |
| `js/retos.js` | Retos del lienzo libre y sus criterios de corrección |
| `js/ios.js` | Consola de IOS y de los PCs: órdenes, `show`, mensajes y chuleta |
| `js/net.js` | Motor de red: puertos, VLAN, enrutamiento, ping y DHCP |
| `js/app.js` | Interfaz: consolas, topología, cableado, vista física, puntos y logros |
| `css/style.css` | Diseño y colores (variables al principio y al final del archivo) |

El progreso se guarda en el navegador de cada persona (`localStorage`, claves `rg.*`).
