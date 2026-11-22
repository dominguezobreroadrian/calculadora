# Cómo pensar la calculadora antes de programarla: las 4 preguntas

Un problema grande ("hacer una calculadora") abruma si se mira entero. La técnica es **dividirlo en problemas pequeños** respondiendo cuatro preguntas antes de escribir código:

| # | Pregunta | Para qué sirve |
|---|---|---|
| 1 | ¿Qué entra y qué sale? | Definir los límites del problema |
| 2 | ¿Qué entidades hay? | Saber qué variables, tipos y funciones necesito |
| 3 | ¿Qué eventos o acciones ocurren, y en qué orden? | Entender el flujo y cuándo cambia el estado |
| 4 | ¿Qué puede fallar y qué casos borde hay? | Anticipar los errores antes de que aparezcan |

Este documento responde a las cuatro con el código de tu calculadora (`main.ts`).

## Índice

1. [¿Qué entra y qué sale?](#1-qué-entra-y-qué-sale)
2. [¿Qué entidades hay?](#2-qué-entidades-hay)
3. [¿Qué eventos o acciones ocurren, y en qué orden?](#3-qué-eventos-o-acciones-ocurren-y-en-qué-orden)
4. [¿Qué puede fallar y qué casos borde hay?](#4-qué-puede-fallar-y-qué-casos-borde-hay)
5. [De las 4 preguntas a una lista de problemas pequeños](#5-de-las-4-preguntas-a-una-lista-de-problemas-pequeños)

---

## 1. ¿Qué entra y qué sale?

Esta pregunta marca la frontera del problema: qué recibe el programa del exterior y qué devuelve.

### Lo que entra

**Clics en botones.** Cada botón del HTML aporta dos datos mediante atributos `data-*`:

| Atributo | Qué indica | Ejemplo |
|---|---|---|
| `data-accion` | Qué tipo de botón es | `"digito"`, `"operador"`, `"igual"` |
| `data-valor` | Cuál en concreto (si hace falta) | `"5"`, `"+"`, `"pi"` |

```html
<button data-accion="digito" data-valor="5">5</button>
<button data-accion="operador" data-valor="+">+</button>
<button data-accion="igual">=</button>
```

Los botones disponibles se agrupan así:

| Grupo | Botones |
|---|---|
| Números | `0` a `9` y el punto decimal `.` |
| Operaciones | `+`, `−`, `×`, `÷` y `=` |
| Borrado | AC (todo), CE (la entrada actual), ⌫ (último carácter) |
| Otros | ± (cambiar signo), π y e (constantes) |
| Interfaz | Botón de expandir (↑ / ↓) y botón del logo |

### Lo que sale

| Salida | Dónde se ve | Ejemplo |
|---|---|---|
| El número principal | `<p id="pantalla">` | `19` |
| La expresión o el mensaje de error | `<p id="expresion">` | `12 + 7 =` o `No se puede dividir entre cero.` |
| Cambios visuales de la interfaz | Clases CSS y atributos | Modo ampliado, color del logo |

### Ejemplo de entrada y salida

```
Entrada (clics):  1   2   +   7   =
Salida:           pantalla "19"   ·   expresión "12 + 7 ="
```

**Por qué importa esta pregunta:** te dice que el problema es, en esencia, "transformar una secuencia de clics en texto en pantalla". Todo lo demás es el cómo.

---

## 2. ¿Qué entidades hay?

Las entidades son las "piezas" del problema. Un truco útil: los **sustantivos** suelen convertirse en variables o tipos, y los **verbos** en funciones.

### 2.1 Elementos del HTML (lo que se ve y se pulsa)

| Constante en el código | Elemento | Papel |
|---|---|---|
| `pantalla` | `<p id="pantalla">` | Muestra el número grande |
| `expresion` | `<p id="expresion">` | Muestra la operación o el error |
| `teclado` | `<div id="teclado">` | Contiene todos los botones |
| `teclasAvanzadas` | `<div id="teclasAvanzadas">` | Teclas del modo ampliado |
| `calculadora` | `<section id="calculadora">` | Contenedor general |
| `botonExpandir` | `<button id="botonExpandir">` | Alterna el modo ampliado |
| `botonLogoArch` / `logoArch` | botón e imagen | Logo que cambia de color |

### 2.2 Estado (lo que la calculadora "recuerda")

Es el corazón del problema. Entre una pulsación y la siguiente, la calculadora solo conoce estas cinco variables:

| Variable | Tipo | Qué guarda |
|---|---|---|
| `valorPantalla` | `string` | El texto que se muestra (texto, porque puede ser `"3."`) |
| `primerOperando` | `number \| null` | El primer número de la cuenta |
| `operadorPendiente` | `OperadorBinario \| null` | La operación esperando el segundo número |
| `esperandoOperando` | `boolean` | Si lo siguiente que se escriba debe empezar un número nuevo |
| `hayError` | `boolean` | Si la pantalla está mostrando un error |

### 2.3 Tipos (lo que está permitido)

| Tipo | Valores posibles |
|---|---|
| `OperadorBinario` | `'+'`, `'−'`, `'×'`, `'÷'` |
| `AccionCalculadora` | `'borrar-todo'`, `'borrar-entrada'`, `'retroceso'`, `'signo'`, `'alternar'`, `'operador'`, `'digito'`, `'decimal'`, `'igual'`, `'constante'` |

Sirven para que TypeScript impida usar un operador o una acción que no existe.

### 2.4 Acciones (los verbos, convertidos en funciones)

| Verbo del problema | Función | Qué hace |
|---|---|---|
| Mostrar | `actualizarPantalla` | Copia el estado a la pantalla |
| Formatear | `formatearNumero` | Convierte un número a texto limpio |
| Calcular | `calcular` | Aplica una de las 4 operaciones |
| Escribir un dígito | `introducirDigito` | Añade o reemplaza un dígito |
| Escribir un decimal | `introducirDecimal` | Añade el punto una sola vez |
| Elegir operación | `seleccionarOperador` | Guarda el operador y encadena cálculos |
| Resolver | `resolverOperacion` | Hace lo que corresponde al pulsar `=` |
| Borrar | `borrarTodo` | Reinicia todo |
| Avisar de un fallo | `mostrarError` | Muestra el error y descarta la cuenta |
| Decidir qué hacer | `gestionarAccion` | Reparte cada botón a su función |
| Comprobar valores | `esAccionCalculadora`, `esOperadorBinario` | Validan el texto que viene del HTML |

---

## 3. ¿Qué eventos o acciones ocurren, y en qué orden?

### 3.1 El recorrido técnico (igual en cualquier pulsación)

```
clic en un botón
   │
   ▼
listener en #teclado
   │  closest('button[data-accion]')   → localiza el botón
   │  dataset.accion / dataset.valor   → lee los atributos
   │  esAccionCalculadora(...)         → valida la acción
   ▼
gestionarAccion(accion, valor)         → un switch que elige qué hacer
   ▼
función concreta                        → introducirDigito, seleccionarOperador...
   │  modifica el estado
   ▼
actualizarPantalla()                    → muestra el resultado
```

Hay **un solo listener** en el contenedor `#teclado` para todos los botones. Los clics "burbujean" hacia arriba, así que el contenedor se entera de todos.

### 3.2 El recorrido del usuario en una cuenta normal

| Paso | Qué hace el usuario | Qué debe ocurrir |
|---|---|---|
| 1 | Escribe el primer número | Los dígitos se concatenan en `valorPantalla` |
| 2 | Pulsa un operador | Se guarda el primer número y el operador; se queda esperando el segundo |
| 3 | Escribe el segundo número | El primer dígito **reemplaza** la pantalla; los siguientes se concatenan |
| 4a | Pulsa `=` | Se calcula, se muestra el resultado y la cuenta queda cerrada |
| 4b | Pulsa otro operador | Se calcula lo anterior y se encadena (`2 + 3 +` muestra `5`) |
| 5 | Escribe un dígito tras un resultado | Empieza una cuenta nueva |
| 5 | Pulsa un operador tras un resultado | Se sigue operando con el resultado |

### 3.3 Por qué el orden es lo más importante

El **mismo botón** hace cosas distintas según lo que se pulsó antes. Por ejemplo, el dígito `5`:

| Situación previa | Pantalla antes | Al pulsar `5` | Motivo |
|---|---|---|---|
| Escribiendo el primer número | `"12"` | `"125"` | Se concatena |
| Justo después de un operador | `"12"` (con `12 +`) | `"5"` | Número nuevo |
| Justo después de `=` | `"19"` | `"5"` | Cuenta nueva |
| Después de un error | `"Error"` | `"5"` | Se sale del error |

Esa diferencia de comportamiento la controla la variable **`esperandoOperando`**. Es la razón de que exista.

### 3.4 Ejemplo completo: `12 + 7 =`

| Pulsación | `valorPantalla` | `primerOperando` | `operadorPendiente` | `esperandoOperando` | Línea de expresión |
|---|---|---|---|---|---|
| (inicio) | `"0"` | `null` | `null` | `false` | |
| `1` | `"1"` | `null` | `null` | `false` | |
| `2` | `"12"` | `null` | `null` | `false` | |
| `+` | `"12"` | `12` | `"+"` | `true` | `12 +` |
| `7` | `"7"` | `12` | `"+"` | `false` | `12 +` |
| `=` | `"19"` | `null` | `null` | `true` | `12 + 7 =` |

### 3.5 Ejemplo con encadenado: `2 + 3 × 4 =`

La calculadora evalúa de izquierda a derecha, sin prioridad de operadores.

| Pulsación | `valorPantalla` | `primerOperando` | `operadorPendiente` | Línea de expresión |
|---|---|---|---|---|
| `2` | `"2"` | `null` | `null` | |
| `+` | `"2"` | `2` | `"+"` | `2 +` |
| `3` | `"3"` | `2` | `"+"` | `2 +` |
| `×` | `"5"` | `5` | `"×"` | `5 ×` |
| `4` | `"4"` | `5` | `"×"` | `5 ×` |
| `=` | `"20"` | `null` | `null` | `5 × 4 =` |

Al pulsar `×` se calcula `2 + 3 = 5` y se guarda como nuevo primer operando. El resultado final es `20`, no `14`.

---

## 4. ¿Qué puede fallar y qué casos borde hay?

Un caso borde es una situación poco habitual pero posible, en la que el programa podría comportarse mal. Esta es la lista completa de los que cubre tu código.

### 4.1 Errores de cálculo

| Caso | Qué pasaría sin protección | Cómo lo resuelve el código |
|---|---|---|
| División entre cero (`8 ÷ 0`) | JavaScript daría `Infinity` | `calcular` lanza un error y `mostrarError` lo muestra |
| Resultado infinito o `NaN` | Aparecería `Infinity` o `NaN` en pantalla | `formatearNumero` lanza un error |
| `0.1 + 0.2` | Se vería `0.30000000000000004` | `toPrecision(12)` lo deja en `0.3` |
| `-0` | Podría mostrarse un cero negativo | Se normaliza a `0` |

### 4.2 Errores al escribir números

| Caso | Qué pasaría sin protección | Cómo lo resuelve el código |
|---|---|---|
| Dos puntos decimales | `"3.1.4"` | `includes('.')` impide el segundo punto |
| Ceros a la izquierda | `"007"` | Si la pantalla es `"0"`, el dígito la sustituye |
| `.5` sin cero delante | Texto ambiguo | Se convierte en `"0."` antes de añadir el 5 |
| Números larguísimos | Se desborda el visor | Límite de 16 cifras (sin contar `-` ni `.`) |
| Retroceso sobre `"-5"` | Quedaría `"-"` | Se corrige a `"0"` |
| Cambiar el signo a 0 | `"-0"` | Se ignora |

### 4.3 Errores de secuencia (el usuario pulsa en un orden raro)

| Caso | Cómo lo resuelve el código |
|---|---|
| `=` sin operación completa | `resolverOperacion` sale sin hacer nada |
| `=` justo después de otro `=` | Ignorado: la operación ya se limpió |
| Dos operadores seguidos (`8 + ×`) | El segundo sustituye al primero, sin calcular |
| Operador o `=` estando en error | Ignorado hasta que se escriba un dígito o decimal |
| Retroceso sobre un resultado | Ignorado (`esperandoOperando` es `true`) |

### 4.4 Errores de programación y del HTML

| Caso | Cómo lo resuelve el código |
|---|---|
| Un `data-accion` mal escrito | `esAccionCalculadora` devuelve `false` y el clic se ignora |
| Un `data-valor` inválido (por ejemplo `"/"`) | `esOperadorBinario` lo rechaza y no hace nada |
| Un dígito que no es un dígito | La regex `/^\d$/` lo rechaza |
| Falta un elemento en el HTML (un `id` mal escrito) | El `throw` inicial avisa al arrancar, con un mensaje claro |
| Clic sobre un elemento dentro de un botón | `closest` sube hasta el botón |

### 4.5 Cómo encontrar casos borde por tu cuenta

Para cada función, pregúntate:

1. ¿Qué pasa si el valor está **vacío** o es `0`?
2. ¿Qué pasa si **se repite** (dos puntos, dos operadores, dos igual)?
3. ¿Qué pasa si se pulsa **fuera de orden**?
4. ¿Qué pasa si el valor es **demasiado grande o inválido**?
5. ¿Qué pasa si **falta** algo que debería existir?

---

## 5. De las 4 preguntas a una lista de problemas pequeños

Con las respuestas anteriores, el problema grande se reparte en piezas que se pueden programar y probar una a una:

| Orden | Problema pequeño | Piezas que intervienen | Se puede probar sin HTML |
|---|---|---|---|
| 1 | Mostrar algo en pantalla | `pantalla`, `valorPantalla`, `actualizarPantalla` | No |
| 2 | Calcular dos números | `calcular`, `formatearNumero` | **Sí** |
| 3 | Escribir un número | `introducirDigito`, `introducirDecimal` | Casi |
| 4 | Recordar una operación pendiente | `primerOperando`, `operadorPendiente`, `seleccionarOperador` | Casi |
| 5 | Resolver con `=` | `resolverOperacion` | Casi |
| 6 | Manejar errores | `mostrarError`, `hayError` | Casi |
| 7 | Conectar los botones | listener, `gestionarAccion`, type guards | No |
| 8 | Extras | ±, ⌫, CE, constantes, modo ampliado, logo | No |

### Por qué este orden

- **Empezar por `calcular`** (paso 2) es lo más fácil: es una función pura, sin HTML ni estado. Puedes comprobarla con `calcular(8, 2, '÷')` y ver que da `4`.
- **Dejar la conexión de botones para casi el final** (paso 7): solo une piezas que ya funcionan, así que si algo falla sabes que el fallo está en la conexión y no en la lógica.
- **Los extras al final**: no afectan al núcleo y se pueden añadir sin riesgo.

### Resumen en una frase por pregunta

1. **Entra y sale:** clics con `data-accion`/`data-valor` → texto en pantalla y en la línea de expresión.
2. **Entidades:** 5 variables de estado, los elementos del HTML, 2 tipos y una función por cada verbo.
3. **Orden:** el significado de una pulsación depende de la anterior, y `esperandoOperando` lo controla.
4. **Fallos:** división entre cero, decimales, secuencias raras y valores inválidos del HTML.