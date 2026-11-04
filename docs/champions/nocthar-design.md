# Nocthar, the Unburied: diseño del kit

Fecha: 2026-11-04. **Estado:** diseño aprobado, sin implementar. Los números son valores de partida, para ajustar jugando.

## Concepto

Nocthar es un monstruo de ultratumba, medio zombie, que salió de su tumba y se niega a volver. Alto, encorvado y podrido, con brazos larguísimos y manos enormes llenas de tierra, carga en la espalda la lápida rota de su tumba. Con esas manos saca a los muertos del suelo para que peleen con él.

- **Clase:** mago (escala con AP), a distancia. Va por mid o top.
- **Cómo se juega:** junta un ejército chico de criaturas de huesos (los **Hollows**) con la pasiva y las maneja con la E. Con la R las funde en un **coloso**. Mientras el coloso está vivo, su W y su E cambian a habilidades del coloso.
- **Lo que lo distingue:** es el único del juego que maneja un ejército.
- **Originalidad:** a propósito, nada de tumbas que se levantan después ni de "marcar un objetivo para que salten las criaturas". Eso es de un necromante conocido de otro juego. Por lo mismo, el look no lleva pala de sepulturero ni farol verde.

## Reglas generales

- **Tope:** hasta 5 Hollows a la vez.
- **Sin orden:** siguen a Nocthar y atacan lo que Nocthar ataca.
- **Radio máximo:** 900 desde Nocthar. Una criatura que sale de ese radio abandona su orden y vuelve con Nocthar.
- **Si muere Nocthar, se desarma todo:** los Hollows y el coloso.
- **Estructuras:** los Hollows y el coloso le pegan a las torres, así que Nocthar empuja líneas. Las torres y los minions los atacan como a cualquier unidad.

## El kit

Tiene dos modos: **sin coloso** (normal) y **con el coloso vivo** (después de la R).

| | Sin coloso | Con el coloso vivo |
|---|---|---|
| **Pasiva** | Nobody Leaves: levanta Hollows | No levanta Hollows. Las muertes cercanas curan al coloso |
| **Q** | Grasping Hands | Igual |
| **W** | Lament | Bone Volley (le cuesta vida al coloso) |
| **E** | Heed Me: órdenes a los Hollows | Trample (le cuesta vida al coloso) |
| **R** | Colossus of Bones | Volver a apretarla le da órdenes al coloso |

### Pasiva: Nobody Leaves

- **Cuándo se activa:** si la pasiva está lista y muere un enemigo a menos de 550 de Nocthar, sea minion, monstruo o campeón.
- **Qué pasa:** de donde murió sale un Hollow arañando la tierra; tarda 0,75 s en aparecer.
- **Enfriamiento:** baja de 25 s a nivel 1 a 15 s a nivel 18.
- **Si muere un campeón:** sale un **Hollow grande**, con un 50% más de vida y de daño.
- **Con 5 Hollows:** la pasiva no se activa ni entra en enfriamiento.
- **Cuánto duran:** hasta que los matan.
- **Estadísticas de los Hollows:** como punto de partida, las de un minion melee, que crecen con el nivel y el AP de Nocthar.
- **Con el coloso vivo:** no levanta Hollows. Cada enemigo que muere a menos de 550 del coloso lo cura: un 1% de su vida máxima por minion o monstruo, un 25% por campeón.
- **El número clave del balance:** cuánto cura cada minion. Si en línea el coloso se cura más de lo que gasta, queda un coloso eterno.

### Q: Grasping Hands

- **Dónde:** en un círculo de radio 200, en un punto a hasta 800.
- **Cuándo:** las manos salen del suelo 0,5 s después.
- **Daño:** 80/120/160/200/240 (+60% AP) mágico.
- **Efecto:** arrastra a los enemigos unos 75 hacia el centro y los ralentiza un 30% durante 1,5 s.
- **Enfriamiento:** 8 s.
- **Con el coloso vivo:** es igual.
- **Nota:** ya no le da velocidad de ataque a los Hollows. Eso ahora lo hace la W.

### W: Lament

- **Efecto:** Nocthar suelta un lamento de ultratumba tras un instante (0,25 s). Los enemigos a menos de 350 de Nocthar huyen de miedo durante 1 s.
- **Daño:** 60/90/120/150/180 (+40% AP) mágico.
- **El miedo sale solo de Nocthar, no de los Hollows.**
- **A sus Hollows:** los que estén a menos de 700 de Nocthar ganan un 40/50/60/70/80% de velocidad de ataque durante 2 s.
- **Enfriamiento:** 14/13/12/11/10 s.
- **Usa** el tipo de control `fear`, que ya existe.

### W con el coloso vivo: Bone Volley

- **Efecto:** el coloso se arranca huesos y los tira a un área a distancia, en un círculo de radio 200 a hasta 700 del coloso.
- **Daño:** mágico, con una ralentización del 40% durante 1,5 s.
- **Costo:** el 10% de la vida máxima del coloso. **No se puede usar si el coloso tiene menos vida que eso.**
- **Para qué está:** le da alcance a un bicho que pega cuerpo a cuerpo. Usarla es un riesgo, porque si matan al coloso se pierde el ejército.

### E: Heed Me

Son órdenes a los Hollows, sin enfriamiento ni costo. Se apunta con el modo de lanzamiento de cada jugador: con lanzamiento rápido, apretar E manda a los Hollows directo al cursor; en los otros modos se mantiene E y se clickea.

- **Sobre el suelo:** van a ese punto y pelean con lo que se acerque, como en un ataque en movimiento.
- **Sobre un enemigo:** lo persiguen y le pegan hasta que muera, se esconda o salgan del radio de 900.
- **Sobre Nocthar:** vuelven con Nocthar. Sirve para sacarlos de una pelea perdida.
- **La carga:**
  - La primera orden después del enfriamiento de la carga es una carga: los Hollows corren un 30% más rápido y pegan un 20/25/30/35/40% más durante 3 s.
  - Ese enfriamiento es de 10/9/8/7/6 s.
  - Subir de nivel la E mejora la carga.

### E con el coloso vivo: Trample

- **Efecto:** el coloso carga en línea recta unos 500 hacia un punto.
- **A los enemigos que encuentra en el camino:**
  - quedan atrapados en la carga;
  - caen al final y quedan levantados 0,5 s (`knockup`);
  - reciben daño mágico.
- **Costo:** el 10% de la vida máxima del coloso, con la misma regla que Bone Volley.
- **Para qué está:** meter a un enemigo en tu equipo, sacarlo del suyo o perseguir.

### R: Colossus of Bones

- **Tiempo de lanzamiento:** 1,5 s.
  - Nocthar no se puede mover: hunde las manos en la tierra.
  - Los Hollows corren al punto elegido, a hasta 600, y se hunden en la tierra.
  - Una grieta en el suelo marca dónde va a salir el coloso, así que se puede esquivar.
- **Si la interrumpen:** si la aturden, la silencian o la levantan durante el lanzamiento, se cancela. Los Hollows se quedan y la R vuelve en 10 s.
- **Al salir:** el coloso levanta 1 s a los enemigos que están en un radio de 250 y les hace daño mágico.
- **Tamaño:** su tamaño, su vida y su daño crecen con cada Hollow absorbido (un Hollow grande cuenta doble). Con ninguno sale un coloso chico.
- **Cuánto dura:** hasta que lo matan. No tiene duración.
- **Volver a apretar R:** le da órdenes al coloso, con las mismas reglas que la E (punto, enemigo, Nocthar y radio máximo).
- **Enfriamiento:** 120/100/80 s, que empieza a contar cuando muere el coloso.
- **Cuando muere el coloso:** la pasiva vuelve a levantar Hollows, y la W y la E vuelven a las normales.

## Ingeniería

**Lo que ya existe:**
- **Tiempo de lanzamiento e interrupción para la R:** `castTime` y `ChannelBehavior` en `packages/shared/src/types/abilities.ts`.
- **Los controles:** `fear`, `knockup`, `knockback` y `slow` (`packages/shared/src/types/effects.ts`).
- **Volver a lanzar una habilidad:** el `RecastBehavior`.
- **Apuntar en cada modo de lanzamiento:** el CastController, ver `docs/architecture/controls.md`.
- **Solo como tipo:** `TransformBehavior.abilityReplacements` (`abilities.ts`) dice qué habilidad reemplaza a cuál en otra forma, pero ningún campeón lo usa ni lo implementa el servidor. Es la base natural para cambiar la W y la E mientras el coloso está vivo.

**Lo que es nuevo:**
- **Unidades invocadas, la parte más grande:**
  - en el servidor, una entidad con dueño;
  - su IA: seguir a Nocthar, atacar su objetivo, cumplir órdenes, el radio máximo y desarmarse cuando muere Nocthar;
  - su tipo en los snapshots;
  - en el cliente, cómo se dibujan y su barra de vida.
  - Hay que pensarlas como un sistema que puedan usar otros campeones: documentarlas en un doc nuevo, `docs/architecture/summons.md`, y sumarlo a la tabla de `CLAUDE.md`.
- **Cambio de habilidades mientras el coloso está vivo:**
  - en el servidor, a qué habilidad va la W o la E;
  - en el HUD, los íconos, las descripciones y los enfriamientos de la otra versión.
- **Habilidades que le cuestan vida al coloso:** no se pueden usar si no le alcanza la vida.
- **El HUD:** un contador de Hollows en el ícono de la pasiva.
- **Los bots de práctica:** que sepan jugar a Nocthar, al menos mandando a los Hollows a su objetivo.
- **Arte (PixelLab):**
  - sprites de Nocthar, del Hollow, del Hollow grande y del coloso (que crece);
  - 7 íconos: pasiva, Q, W, W del coloso, E, E del coloso y R.
- **VFX y sonidos (ElevenLabs).**
- **Docs a actualizar:** `champions.md`, `abilities.md`, `effects-and-buffs.md` y el doc nuevo de invocaciones.

## Tests: casos borde

Escribir los tests primero, verlos fallar y después hacerlos pasar. Casos para cubrir:

- **La pasiva:**
  - con 5 Hollows, no se activa ni entra en enfriamiento;
  - un campeón saca un Hollow grande;
  - un enemigo que muere fuera del radio no saca nada;
  - con el coloso vivo, no levanta Hollows y cura al coloso.
- **Las órdenes de la E:**
  - a un punto;
  - a un enemigo que muere;
  - a un enemigo que se esconde en un arbusto o la niebla;
  - a un enemigo que se aleja más allá del radio;
  - de vuelta a Nocthar;
  - sin Hollows, no pasa nada.
- **La carga de la E:** se aplica una vez por enfriamiento, no en cada orden.
- **La W:**
  - el miedo es solo alrededor de Nocthar;
  - la velocidad de ataque es solo para los Hollows dentro de 700.
- **La R:**
  - con 0, 1 y 5 Hollows, y con Hollows grandes;
  - si la interrumpen, los Hollows se quedan y el enfriamiento es corto;
  - si muere Nocthar durante el lanzamiento.
- **El coloso:**
  - la W y la E cambian mientras vive y vuelven cuando muere;
  - el costo de vida y que no se puedan usar si no le alcanza la vida;
  - el enfriamiento de la R empieza cuando muere;
  - las órdenes al volver a apretar R.
- **La muerte de Nocthar:** se desarma todo, Hollows y coloso.

## Por decidir

- **Al volver a la base:** ¿los Hollows se desarman o la siguen caminando? Lo más simple es que se desarmen al completar el regreso.
- **Visión:** ¿los Hollows dan visión, como los minions?
- **Las torres:** ¿atacan primero a los Hollows, como a los minions, o al coloso?
