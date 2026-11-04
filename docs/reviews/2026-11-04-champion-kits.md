# Revisión de kits: los 17 campeones

Fecha: 2026-11-04. Base: las definiciones en `packages/shared/src/champions/definitions/` (descripciones, escalados y build recomendada de cada uno). Es un análisis de diseño: no se cambió nada.

**Estado:** pendiente. Se decidió agregar más campeones primero y revisar todo junto después (la próxima revisión incluye a los nuevos).

**Cómo leerlo:** primero lo que está roto (escalados que no sirven); después las habilidades repetidas entre campeones; después las que no encajan con su personaje; y al final una lista de propuestas para que elijas.

---

## 1. Escalados muertos (lo más urgente)

Cada clase compra una build (`recommendedBuild`). Si una habilidad escala con algo que esa build no tiene, el escalado no aporta nada en toda la partida.

| Campeón | Habilidad | Escala con | Compra | Resultado |
|---|---|---|---|---|
| **Calamitus** (tanque) | Q, W y R | 40–50% AP | vida y resistencias, **0 AP** | Su daño se queda en el de base toda la partida |
| **Protobot 45** (tanque) | Q, E y R | 50–70% AP | vida y resistencias, **0 AP** | Lo mismo |
| **Urûk** (guerrero AD) | E (escudo y estallido de hielo) | 60% / 50% AP | AD y vida | El escudo y el estallido no crecen |
| **Vile** (asesino AD) | R (aura) | 20% AP | AD y letalidad | El aura de la ulti no crece |

**Ejemplo a seguir:** Gorath, el otro tanque, escala con **vida bonus** (Q 4%, R 6%), que sí compra.

**Propuesta:**
- Calamitus y Protobot: pasarlos a vida bonus, como Gorath.
- E de Urûk: pasarla a AD o a vida bonus.
- Aura de Vile: pasarla a AD.

Es un cambio de números y tests, sin diseño nuevo.

**No es un problema: Zhak'rul.** Es "guerrero" y todo su kit es mágico con AP, pero tiene una build propia de AP y vida, así que sus escalados sirven. Lo único raro es la etiqueta de clase.

---

## 2. Habilidades repetidas entre campeones

### Muy parecidas: casi la misma habilidad en dos campeones

| Mecánica | Quiénes | Qué tan igual |
|---|---|---|
| **"Cada 3er básico pega más"** | Pasiva de Vex (4% de la vida máxima, daño verdadero) · pasiva de Elora (daño físico fijo, al mismo objetivo) | La misma regla; solo cambia el número |
| **"Tu próximo básico en 4 s sale al instante y pega más"** | Q de Elora (veneno y lentitud) · W de Urûk (más alcance y penetración de armadura) | Misma estructura, mismos 4 s, mismo "listo al instante" |
| **Ulti "salto al enemigo elegido"** | R de Kael (salto y aturdimiento) · R de Urûk (salto y ejecución) | Dos guerreros melee con la misma ulti de llegada |
| **Escudo propio simple ("gana un escudo por X s")** | W de Kael · W de Magnus · E de Urûk · E de Calamitus · W de Protobot (más su Q y su E, que también dan escudo) · pasiva de Kael | **Cinco campeones**, de clases distintas. Los de Kael y Magnus son los más genéricos |
| **Invisibilidad en la W de un asesino** | W de Vex (10 s invisible) · W de Vile (2 s invisible e invulnerable, quieto) | La de Vile es más bien un estasis: la invisibilidad sobra |
| **Ulti de velocidad de ataque melee** | R de Vex (velocidad de ataque y enfriamientos) · R de Fenris (velocidad de ataque y robo de vida) | Parecidas en cómo se juegan |
| **Cono melee de daño físico** | Q de Kael · W de Fenris (más lentitud) | Casi iguales; es normal en el género, prioridad baja |
| **Skillshot que marca 4 s** | Q de Vex · Q de Kip | Mismo disparo, pero la marca rinde distinto (la de Kip revela y explota). Aceptable |

### Dentro de un mismo kit

- **Gorath:**
  - Q, E y R son círculos alrededor suyo: tres habilidades con la misma forma, y ninguna para llegar al enemigo (no tiene dash ni nada a distancia).
  - Su W (+30% armadura y resistencia mágica) repite lo que ya da su pasiva (armadura al recibir daño).
- **Magnus:** la E (pantano que ralentiza) y la R (zona que quema y ralentiza) son el mismo círculo en el suelo; la R es la E con daño. El id interno de la R es `magnus_meteor`, así que la idea original era un **meteoro**.
- **Protobot:** tres de sus cuatro habilidades dan escudo (Q, W y E), y la pasiva da resistencias. Todo su kit es defensa propia.
- **Kael:** dos acercamientos (E dash y R salto) más dos escudos (W y pasiva). Es el kit más genérico del juego: espadachín con escudo, cono, carga y salto.

---

## 3. Habilidades que no encajan con su personaje

| Campeón | Qué no cierra |
|---|---|
| **Magnus, "The Battlemage"** | Un "battlemage" pelea de cerca, pero su kit es de artillería a distancia (bola de fuego, pantano, zona) con un escudo. El que juega como battlemage es **Oitboil**: chispas alrededor, cohete hacia adelante, lanzallamas en cono y 690 de vida |
| **Urûk, "The Silver Dragonborn"** | No tiene nada de dragón, salvo el hielo de la E. La lanza está bien (Q y W); la parte "dragón" no aparece |
| **Vile, "The Soul Herder"** | El kit está sobrecargado y le falta una identidad clara: flecha que se carga más dash al reactivarla, invulnerabilidad, trampas con munición, y una ulti que lo vuelve **melee** con aura mágica. Es asesino pero ataca a distancia (180), y la mitad del kit es de tirador. El de las almas es lo único que lo une |
| **Gorath, "The Stone Guardian"** | Un guardián de piedra sin forma de llegar al enemigo. Para un tanque, que tiene que iniciar, no tener nada para acercarse es un hueco grande |
| **Protobot 45** | La pasiva de aprender es muy buena, pero los escudos en la Q (gancho) y en la E (puño cohete) parecen agregados para que aguante; no tienen que ver con la máquina |
| **W de Oitboil (Blue Fire)** | Descargar calor es lo que lo define y está perfecto; que además **cure** a un piromante es raro. Pega más algo como reducir el daño mientras se enfría |
| **W de Zhak'rul (Toxic Cloud)** | Un escorpión que "exhala" una nube venenosa. Es menor, pero un escorpión pica, no echa aliento. Con renombrarla a algo como "charco de veneno" o "arena tóxica" alcanza |
| **Elara** | Todo su kit es para aliados: no tiene ni daño ni control sobre enemigos. Puede ser a propósito (curadora pura), pero en línea no puede hacer nada contra el rival |

### Los que están bien

Tienen identidad clara y kits que se sostienen solos:
- **Lume:** el orbe es único.
- **Hop-To-Eat:** el salto en cada básico y la patada están muy bien.
- **Calamitus:** las lavas, salvo los escalados.
- **Zhak'rul:** las dosis de veneno.
- **Fenris:** el modo feral.
- **Oitboil:** el calor.
- **Kip:** las marcas.

---

## 4. El plantel por clase

| Clase | Campeones |
|---|---|
| Guerrero (melee) | Kael, Urûk, Fenris, Zhak'rul |
| Mago | Magnus, Lume, Oitboil |
| Asesino | Vex, Vile (a distancia), Hop |
| Tanque | Gorath, Calamitus, Protobot |
| Soporte | Elara, Caelum |
| Tirador | Elora, Kip |

**Lo que se nota:**
- **Pocos tiradores para la línea de abajo:** dos. Vile ya juega medio como tirador (flecha, trampas, ataque a distancia); pasarlo a tirador resolvería su identidad y la falta de tiradores a la vez.
- **Los cuatro guerreros comparten el molde** de acercarse, ralentizar y aguantar. Los que más se pisan son Kael y Urûk (salto de ulti, cono o línea, escudo).
- **Mucha velocidad de movimiento:** la dan Elara E, Caelum W, Lume (pasiva y E), Protobot W, Vex W, Vile W, Kip W y Urûk (pasiva).

---

## 5. Propuestas para decidir

Ordenadas por impacto. Cada una es una sola decisión.

**Fácil (números):**
1. Pasar los escalados muertos a lo que cada campeón compra: Calamitus y Protobot a vida bonus, la E de Urûk a AD o vida, el aura de Vile a AD.

**Media (cambiar una habilidad):**

2. **Pasiva de Elora:** que deje de ser "cada 3er básico" (eso queda para Vex). Como su pasiva ya dice que su arco llega más lejos que ninguno, que pegue más **cuanto más lejos esté el objetivo**.
3. **W de Urûk:** que deje de ser "próximo básico potenciado" (eso queda para la Q de Elora). Puede ser algo de dragón, que hoy le falta: un rugido o aliento helado en cono que ralentiza.
4. **R de Magnus:** volver al **meteoro** que dice su id: aviso, impacto grande en un área y suelo ardiendo un rato. Así deja de ser la E con daño.
5. **W de Magnus:** cambiar el escudo por algo de mago que se defiende de cerca, como una onda que empuja a los que tiene encima. Además pasa a pegarle el título de "Battlemage", o se lo cambiamos a algo como "The Archmage".
6. **W de Gorath:** que pase a ser su forma de llegar, por ejemplo **rodar como roca** hacia un punto, y que la armadura quede solo en la pasiva.
7. **Protobot:** sacar el escudo de la Q y de la E; el escudo queda en la W.

**Grande (identidad):**

8. **Vile como tirador:**
   - Sacarle la invisibilidad a la W: queda como estasis.
   - Que la R potencie sus flechas y trampas en vez de volverlo melee.
9. **Kael más "vanguardia":** que su W o su R cuiden al equipo, por ejemplo un escudo para los aliados cercanos o una carga que lleve a los aliados detrás. Así deja de ser un luchador genérico con escudo propio y se distingue de Urûk.
10. **Elara con algo de juego contra el enemigo** (opcional): por ejemplo, que su E también ralentice a los enemigos que cruza.

**Menor (nombres):**

11. Renombrar la W de Zhak'rul.
12. Revisar si Zhak'rul debería figurar como "luchador mágico" en vez de "guerrero".
