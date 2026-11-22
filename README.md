# Documentación detallada de la calculadora (`main.ts`)

Guía para entender qué hace cada parte del código, con ejemplos completos que siguen el estado paso a paso.

## Índice

1. [Visión general](#1-visión-general)
2. [Estado de la calculadora](#2-estado-de-la-calculadora)
3. [Type guards](#3-type-guards)
4. [Elementos del DOM](#4-elementos-del-dom)
5. [Logo Arch](#5-logo-arch)
6. [formatearNumero](#6-formatearnumero)
7. [actualizarPantalla](#7-actualizarpantalla)
8. [borrarTodo](#8-borrartodo)
9. [mostrarError](#9-mostrarerror)
10. [calcular](#10-calcular)
11. [introducirDigito](#11-introducirdigito)
12. [introducirDecimal](#12-introducirdecimal)
13. [seleccionarOperador](#13-seleccionaroperador)
14. [resolverOperacion](#14-resolveroperacion)
15. [gestionarAccion](#15-gestionaraccion)
16. [El listener del teclado](#16-el-listener-del-teclado)
17. [Trazas completas](#17-trazas-completas)
18. [Detalles a tener en cuenta](#18-detalles-a-tener-en-cuenta)

---

## 1. Visión general

Cada botón del HTML indica qué es mediante atributos `data-*`:

```html
<button data-accion="digito" data-valor="5">5</button>
<button data-accion="operador" data-valor="+">+</button>
<button data-accion="igual">=</button>
<button data-accion="borrar-todo">AC</button>
```

El recorrido de una pulsación es siempre el mismo:

```
clic en un botón
   │
   ▼
listener en #teclado           (sección 16: un único listener para todos los botones)
   │  closest('button[data-accion]')  → encuentra el botón
   │  dataset.accion / dataset.valor  → lee los atributos
   │  esAccionCalculadora(...)        → valida la acción
   ▼
gestionarAccion(accion, valor)  (sección 15: un switch)
   │
   ▼
función concreta               (introducirDigito, seleccionarOperador, resolverOperacion...)
   │  modifica las variables de estado
   ▼
actualizarPantalla()           (copia valorPantalla al <p id="pantalla">)
```

La idea clave: **el estado vive en variables de JavaScript**, y la pantalla es solo un reflejo de `valorPantalla`. Nada se lee de la pantalla para calcular.

---

## 2. Estado de la calculadora

```ts
let valorPantalla = '0'
let primerOperando: number | null = null
let operadorPendiente: OperadorBinario | null = null
let esperandoOperando = false
let hayError = false
```

| Variable | Tipo | Significado | Valor inicial |
|---|---|---|---|
| `valorPantalla` | `string` | Lo que se muestra. Es texto porque mientras se escribe puede ser `"3."`, que todavía no es un número válido. | `'0'` |
| `primerOperando` | `number \| null` | Primer número de la operación, ya convertido a número. `null` = no hay ninguno. | `null` |
| `operadorPendiente` | `OperadorBinario \| null` | Operación elegida que espera el segundo número. `null` = ninguna. | `null` |
| `esperandoOperando` | `boolean` | `true` = lo siguiente que se escriba empieza un número nuevo. | `false` |
| `hayError` | `boolean` | `true` = la pantalla muestra `"Error"`. | `false` |

### Cuándo vale cada cosa en `esperandoOperando`

| Situación | `esperandoOperando` |
|---|---|
| Recién abierta la calculadora | `false` |
| Después de escribir `9` | `false` |
| Después de pulsar `9 +` (falta el segundo número) | `true` |
| Después de `9 + 9` | `false` |
| Después de `9 + 9 =` (resultado en pantalla) | `true` |
| Después de un error | `true` |

Con `true`, el siguiente dígito **reemplaza** lo que hay en pantalla en lugar de concatenarse. Por eso, tras un resultado, escribir un número empieza una cuenta nueva.

---

## 3. Type guards

Los atributos `data-accion` y `data-valor` llegan del HTML como `string | undefined`. TypeScript no sabe si ese texto es una acción válida. Un *type guard* es una función que devuelve `boolean` pero que además le dice a TypeScript **qué tipo tiene el valor si devuelve `true`**.

```ts
const esOperadorBinario = (valor: string | undefined): valor is OperadorBinario =>
    valor === '+' || valor === '−' || valor === '×' || valor === '÷'
```

La parte `valor is OperadorBinario` es lo que hace la magia. Después de un `if (esOperadorBinario(valor))`, dentro del `if` TypeScript trata `valor` como `OperadorBinario` y no como `string`.

### Ejemplo completo

```ts
function ejemplo(valor: string | undefined) {
    seleccionarOperador(valor)           // ❌ Error de TypeScript: string | undefined no es OperadorBinario

    if (esOperadorBinario(valor)) {
        seleccionarOperador(valor)       // ✅ Aquí valor ya es OperadorBinario
    }
}
```

| Llamada | Resultado |
|---|---|
| `esOperadorBinario('+')` | `true` |
| `esOperadorBinario('÷')` | `true` |
| `esOperadorBinario('/')` | `false` (el operador de la calculadora es `÷`, no `/`) |
| `esOperadorBinario('-')` | `false` (el menos del código es `−`, un carácter distinto) |
| `esOperadorBinario(undefined)` | `false` |

> Fíjate en que `'−'` (signo menos tipográfico) y `'-'` (guion) son caracteres diferentes. El `data-valor` del HTML tiene que usar exactamente `−`.

`esAccionCalculadora` funciona igual, pero con las diez acciones posibles:

| Llamada | Resultado |
|---|---|
| `esAccionCalculadora('digito')` | `true` |
| `esAccionCalculadora('igual')` | `true` |
| `esAccionCalculadora('otra-cosa')` | `false` |
| `esAccionCalculadora(undefined)` | `false` (botón sin `data-accion`) |

**Ventaja:** si algún día escribes mal un `data-accion` en el HTML, la pulsación simplemente se ignora en lugar de romper la aplicación.

---

## 4. Elementos del DOM

```ts
const pantalla = document.querySelector<HTMLParagraphElement>('#pantalla')
```

- `document.querySelector('#pantalla')` busca el elemento con `id="pantalla"`.
- `<HTMLParagraphElement>` le dice a TypeScript qué tipo de elemento es (un `<p>`), para que conozca sus propiedades (`textContent`, etc.).
- El resultado es el elemento **o `null`** si no existe.

| Constante | Elemento | Para qué se usa |
|---|---|---|
| `pantalla` | `<p id="pantalla">` | Número grande |
| `expresion` | `<p id="expresion">` | Línea pequeña, por ejemplo `"3 + 4 ="` |
| `teclasAvanzadas` | `<div id="teclasAvanzadas">` | Teclas del modo ampliado |
| `botonExpandir` | `<button id="botonExpandir">` | Botón ↑ / ↓ |
| `calculadora` | `<section id="calculadora">` | Contenedor general |
| `botonLogoArch` | `<button id="botonLogoArch">` | Botón que envuelve el logo |
| `logoArch` | `<img id="logoArch">` | Imagen del logo |
| `teclado` | `<div id="teclado">` | Contenedor de todos los botones |

### La comprobación de `null`

```ts
if (!pantalla || !expresion || ... ) {
    throw new Error('No se pudo inicializar la calculadora.')
}
```

Hace dos cosas:

1. **Falla pronto y con un mensaje claro** si falta algún elemento en el HTML (por ejemplo, un `id` mal escrito). Sin esto, el fallo aparecería más tarde, al pulsar un botón, con un error confuso como `Cannot read properties of null`.
2. **Elimina el `null` del tipo.** Después del `if`, TypeScript sabe que todas esas constantes son elementos reales. Como son `const` (no se pueden reasignar), este conocimiento se mantiene incluso dentro de las funciones de más abajo. Por eso `actualizarPantalla` puede escribir `pantalla.textContent = ...` sin volver a comprobar nada.

---

## 5. Logo Arch

```ts
let logoArchRojo = true

botonLogoArch.addEventListener('click', () => {
    logoArchRojo = !logoArchRojo
    logoArch.src = logoArchRojo ? '...FA5252...' : '...40C057...'
})
```

Es solo decoración: no toca el estado de la calculadora.

| Pulsación | `logoArchRojo` antes | `logoArchRojo` después | Imagen |
|---|---|---|---|
| 1.ª | `true` | `false` | Verde (`40C057`) |
| 2.ª | `false` | `true` | Roja (`FA5252`) |
| 3.ª | `true` | `false` | Verde |

`!logoArchRojo` invierte el booleano. El operador ternario `condición ? a : b` elige una URL u otra, que se asigna a `logoArch.src` y hace que el navegador cambie la imagen.

---

## 6. `formatearNumero`

```ts
const formatearNumero = (valor: number): string => {
    if (!Number.isFinite(valor)) {
        throw new Error('El resultado no es un número finito.')
    }
    const valorRedondeado = Number(valor.toPrecision(12))
    return String(Object.is(valorRedondeado, -0) ? 0 : valorRedondeado)
}
```

**Para qué sirve:** convierte un número en el texto que se mostrará, evitando resultados feos.

### Paso a paso

1. **`Number.isFinite(valor)`**: es `false` para `Infinity`, `-Infinity` y `NaN`. En ese caso lanza un error, que capturará quien llamó a la función.
2. **`valor.toPrecision(12)`**: redondea a 12 cifras significativas y devuelve **texto**.
3. **`Number(...)`**: vuelve a convertir ese texto a número, lo que elimina ceros sobrantes.
4. **`String(...)`**: lo convierte a texto final. Antes, `Object.is(x, -0)` detecta el cero negativo para mostrarlo como `0`.

### Ejemplos completos

**Problema típico de JavaScript con decimales:**

```ts
0.1 + 0.2                               // 0.30000000000000004  (feo)
(0.1 + 0.2).toPrecision(12)             // "0.300000000000"
Number("0.300000000000")                // 0.3
formatearNumero(0.1 + 0.2)              // "0.3"  ✅
```

| Entrada | `toPrecision(12)` | Salida de `formatearNumero` |
|---|---|---|
| `0.1 + 0.2` | `"0.300000000000"` | `"0.3"` |
| `1 / 3` | `"0.333333333333"` | `"0.333333333333"` |
| `19` | `"19.0000000000"` | `"19"` |
| `Math.PI` | `"3.14159265359"` | `"3.14159265359"` |
| `Math.E` | `"2.71828182846"` | `"2.71828182846"` |
| `1e21` | `"1.00000000000e+21"` | `"1e+21"` |
| `Infinity` | (no llega) | lanza `Error` |
| `NaN` | (no llega) | lanza `Error` |

> **Nota sobre números enormes:** si el resultado es muy grande (por ejemplo `9999999999999999 × 9999999999999999`), el texto resultante usa notación científica (`"1e+32"`). Es el comportamiento normal de `String()` en JavaScript.

> **Nota sobre `-0`:** en JavaScript `0 * -5` da `-0`. En la práctica `toPrecision` ya descarta el signo del cero, así que la comprobación `Object.is(..., -0)` es una protección extra que no hace daño.

---

## 7. `actualizarPantalla`

```ts
const actualizarPantalla = (): void => {
    pantalla.textContent = valorPantalla
}
```

Copia el texto de `valorPantalla` al `<p id="pantalla">`. Es la única función que escribe en la pantalla grande (salvo `mostrarError`, que también usa la línea de la expresión).

**Por qué existe una función para algo tan corto:** si mañana quieres cambiar cómo se muestra el valor (por ejemplo, poner separadores de miles), solo cambias este sitio.

| `valorPantalla` | Lo que se ve |
|---|---|
| `"125"` | 125 |
| `"3."` | 3. |
| `"Error"` | Error |

---

## 8. `borrarTodo`

```ts
const borrarTodo = (): void => {
    valorPantalla = '0'
    primerOperando = null
    operadorPendiente = null
    esperandoOperando = false
    hayError = false
    expresion.textContent = ''
    actualizarPantalla()
}
```

Es el botón **AC**. Devuelve **todo** a su estado inicial.

### Por qué no basta con poner la pantalla a 0

Imagina que solo hicieras `valorPantalla = '0'`:

```
Pulsas:  8  +   AC   5   =
```

Sin reiniciar `operadorPendiente`, el `+` seguiría guardado y `5 =` calcularía `8 + 5`. Con `borrarTodo` se limpia el operador, así que `=` no hace nada.

### Estado antes y después

| Variable | Antes (tras `8 +`) | Después de AC |
|---|---|---|
| `valorPantalla` | `"8"` | `"0"` |
| `primerOperando` | `8` | `null` |
| `operadorPendiente` | `"+"` | `null` |
| `esperandoOperando` | `true` | `false` |
| `hayError` | `false` | `false` |
| `expresion` | `"8 +"` | `""` |

---

## 9. `mostrarError`

```ts
const mostrarError = (mensaje: string): void => {
    valorPantalla = 'Error'
    expresion.textContent = mensaje
    primerOperando = null
    operadorPendiente = null
    esperandoOperando = true
    hayError = true
    actualizarPantalla()
}
```

Se llama cuando algo falla (hoy, la división entre cero).

- Muestra `"Error"` en grande y el motivo en la línea pequeña.
- **Descarta la operación** (`primerOperando` y `operadorPendiente` a `null`) para no reutilizar datos de una cuenta fallida.
- `hayError = true` activa el modo "error": el siguiente dígito o decimal empieza una cuenta nueva, y los operadores y `=` se ignoran.

### Ejemplo completo: `8 ÷ 0 =` y después `5`

| Pulsación | `valorPantalla` | `expresion` | `hayError` |
|---|---|---|---|
| `8` | `"8"` | | `false` |
| `÷` | `"8"` | `"8 ÷"` | `false` |
| `0` | `"0"` | `"8 ÷"` | `false` |
| `=` | `"Error"` | `"No se puede dividir entre cero."` | `true` |
| `+` | `"Error"` (se ignora) | igual | `true` |
| `5` | `"5"` | igual | `false` |

---

## 10. `calcular`

```ts
const calcular = (izquierdo: number, derecho: number, operador: OperadorBinario): number => {
    switch (operador) {
        case '+': return izquierdo + derecho
        case '−': return izquierdo - derecho
        case '×': return izquierdo * derecho
        case '÷':
            if (derecho === 0) {
                throw new Error('No se puede dividir entre cero.')
            }
            return izquierdo / derecho
    }
}
```

Función **pura**: no toca el estado ni la pantalla, solo recibe datos y devuelve un resultado. Eso la hace fácil de probar.

La división entre cero se comprueba **antes** de dividir. Sin esa comprobación, `8 / 0` daría `Infinity` en JavaScript y llegaría a `formatearNumero`, que lanzaría un error menos claro.

| Llamada | Resultado |
|---|---|
| `calcular(8, 2, '+')` | `10` |
| `calcular(8, 2, '−')` | `6` |
| `calcular(8, 2, '×')` | `16` |
| `calcular(8, 2, '÷')` | `4` |
| `calcular(8, 0, '÷')` | lanza `Error('No se puede dividir entre cero.')` |
| `calcular(0, 5, '÷')` | `0` |

> No hace falta un `default` en el `switch`: como `OperadorBinario` solo admite esos cuatro valores, TypeScript sabe que todos los casos están cubiertos.

---

## 11. `introducirDigito`

```ts
const introducirDigito = (digito: string): void => {
    if (hayError || esperandoOperando) {
        valorPantalla = digito
        esperandoOperando = false
        hayError = false
    } else if (valorPantalla.replace('-', '').replace('.', '').length < 16) {
        valorPantalla = valorPantalla === '0' ? digito : valorPantalla + digito
    }
    actualizarPantalla()
}
```

### Los dos caminos

**Camino 1: `hayError || esperandoOperando`** → empieza un número nuevo. El dígito **reemplaza** lo que hay y se desactivan las dos banderas.

**Camino 2: seguimos escribiendo** → se concatena, pero solo si hay menos de 16 cifras.

- `valorPantalla.replace('-', '')` quita el signo menos.
- `.replace('.', '')` quita el punto decimal.
- `.length < 16` cuenta solo las cifras reales.
- `valorPantalla === '0' ? digito : valorPantalla + digito`: si la pantalla es `"0"`, el dígito lo sustituye (así no queda `"07"`); si no, se concatena.

### Ejemplos completos

| Estado previo | Llamada | Resultado | Motivo |
|---|---|---|---|
| `valorPantalla = "0"` | `introducirDigito('7')` | `"7"` | Sustituye el 0 inicial |
| `valorPantalla = "12"` | `introducirDigito('7')` | `"127"` | Se concatena |
| `valorPantalla = "0"` | `introducirDigito('0')` | `"0"` | Sigue siendo 0 (sin `"00"`) |
| `valorPantalla = "0."` | `introducirDigito('5')` | `"0.5"` | Como no es `"0"` exactamente, concatena |
| `valorPantalla = "-5"` | `introducirDigito('3')` | `"-53"` | El signo se conserva |
| `valorPantalla = "1234567890123456"` (16 cifras) | `introducirDigito('7')` | `"1234567890123456"` | Límite alcanzado, se ignora |
| `valorPantalla = "-1.5"` (2 cifras) | `introducirDigito('3')` | `"-1.53"` | `-` y `.` no cuentan para el límite |
| `esperandoOperando = true`, pantalla `"8"` | `introducirDigito('5')` | `"5"` | Número nuevo tras un operador |
| `hayError = true` | `introducirDigito('2')` | `"2"` | Sale del error |

---

## 12. `introducirDecimal`

```ts
const introducirDecimal = (): void => {
    if (hayError || esperandoOperando) {
        valorPantalla = '0.'
        esperandoOperando = false
        hayError = false
    } else if (!valorPantalla.includes('.')) {
        valorPantalla += '.'
    }
    actualizarPantalla()
}
```

Se llama al pulsar el botón `.`.

- Si se empieza un número nuevo, escribe `"0."` (así `.5` se interpreta como `0.5`).
- Si no, añade el punto **solo si todavía no hay uno** (`includes('.')`).

| Estado previo | Resultado | Motivo |
|---|---|---|
| `"5"` | `"5."` | Se añade el punto |
| `"5."` | `"5."` | Ya tenía punto, no se añade otro |
| `"3.14"` | `"3.14"` | Ya tenía punto |
| `"0"` | `"0."` | Se añade el punto al cero |
| Tras `8 +` (`esperandoOperando = true`) | `"0."` | Número nuevo que empieza por decimal |
| Tras un error | `"0."` | Se sale del error |

### Ejemplo completo: `0.5 + 1.25 =`

| Pulsación | `valorPantalla` |
|---|---|
| `.` | `"0."` |
| `5` | `"0.5"` |
| `+` | `"0.5"` (guardado como `primerOperando = 0.5`) |
| `1` | `"1"` |
| `.` | `"1."` |
| `2` | `"1.2"` |
| `5` | `"1.25"` |
| `=` | `"1.75"` |

---

## 13. `seleccionarOperador`

Es la función más importante y más delicada. Hace posible **encadenar operaciones**.

```ts
const seleccionarOperador = (operador: OperadorBinario): void => {
    if (hayError) return

    const valorActual = Number(valorPantalla)

    if (operadorPendiente && primerOperando !== null && !esperandoOperando) {
        try {
            primerOperando = calcular(primerOperando, valorActual, operadorPendiente)
            valorPantalla = formatearNumero(primerOperando)
        } catch (error) {
            mostrarError(error instanceof Error ? error.message : 'No se pudo realizar la operación.')
            return
        }
    } else if (primerOperando === null) {
        primerOperando = valorActual
    }

    operadorPendiente = operador
    esperandoOperando = true
    expresion.textContent = `${formatearNumero(primerOperando)} ${operador}`
    actualizarPantalla()
}
```

### Los tres casos

La condición principal exige las tres cosas a la vez:

| Condición | Significa |
|---|---|
| `operadorPendiente` | Hay un operador guardado (`+`, `−`, `×`, `÷`) |
| `primerOperando !== null` | Hay un primer número (el `0` también cuenta, por eso se compara con `null` y no se usa un simple `if (primerOperando)`) |
| `!esperandoOperando` | Ya se escribió el segundo número |

**Caso A: operación completa** → se calcula primero y el resultado pasa a ser el nuevo `primerOperando`.

**Caso B: no hay primer operando** (`else if`) → el número en pantalla pasa a ser el primero.

**Caso C: ninguno de los dos** (se pulsó un operador dos veces seguidas) → no entra en ningún bloque; solo se sustituye el operador.

Después, en todos los casos: se guarda el nuevo operador, `esperandoOperando = true` y se actualiza la línea de la expresión.

### Ejemplo completo del caso B: `12 +`

Estado inicial: pantalla `"12"`, `primerOperando = null`, `operadorPendiente = null`.

1. `valorActual = 12`
2. Condición A: `operadorPendiente` es `null` → falsa.
3. Condición B: `primerOperando === null` → verdadera → `primerOperando = 12`.
4. `operadorPendiente = '+'`, `esperandoOperando = true`.
5. `expresion = "12 +"`.

### Ejemplo completo del caso A (encadenado): `2 + 3 +`

Estado antes de la segunda pulsación de `+`: pantalla `"3"`, `primerOperando = 2`, `operadorPendiente = '+'`, `esperandoOperando = false`.

1. `valorActual = 3`
2. Condición A: las tres cosas se cumplen → verdadera.
3. `primerOperando = calcular(2, 3, '+') = 5`.
4. `valorPantalla = "5"`.
5. `operadorPendiente = '+'`, `esperandoOperando = true`.
6. `expresion = "5 +"`.

La pantalla pasa a mostrar `5` en cuanto pulsas el segundo `+`, como en una calculadora real.

### Ejemplo completo del caso C (cambio de operador): `8 + ×`

Estado antes de pulsar `×`: `primerOperando = 8`, `operadorPendiente = '+'`, `esperandoOperando = true`.

1. Condición A: `!esperandoOperando` es `false` → falsa.
2. Condición B: `primerOperando === null`: es `8` → falsa.
3. Se salta todo el `if/else if`.
4. `operadorPendiente = '×'`, `expresion = "8 ×"`.

El `+` se ha sustituido por `×` sin calcular nada.

### Ejemplo con error: `8 ÷ 0 +`

Antes del segundo operador: pantalla `"0"`, `primerOperando = 8`, `operadorPendiente = '÷'`, `esperandoOperando = false`.

1. Condición A verdadera → `calcular(8, 0, '÷')` lanza un error.
2. El `catch` llama a `mostrarError('No se puede dividir entre cero.')` y sale con `return`.
3. Pantalla: `"Error"`.

### Cuando hay error

Si `hayError` es `true`, la función sale en la primera línea: los operadores no hacen nada hasta que se escriba un dígito o decimal.

---

## 14. `resolverOperacion`

```ts
const resolverOperacion = (): void => {
    if (operadorPendiente === null || primerOperando === null || esperandoOperando) return

    const izquierdo = primerOperando
    const derecho = Number(valorPantalla)
    const operador = operadorPendiente

    try {
        valorPantalla = formatearNumero(calcular(izquierdo, derecho, operador))
        expresion.textContent = `${formatearNumero(izquierdo)} ${operador} ${formatearNumero(derecho)} =`
        primerOperando = null
        operadorPendiente = null
        esperandoOperando = true
        hayError = false
        actualizarPantalla()
    } catch (error) {
        mostrarError(error instanceof Error ? error.message : 'No se pudo realizar la operación.')
    }
}
```

Es el botón **=**.

### La comprobación inicial

Sale sin hacer nada si falta cualquiera de estas tres cosas: operador, primer número o segundo número.

| Situación | ¿Calcula? |
|---|---|
| Pantalla `"5"`, sin operador | No (`operadorPendiente === null`) |
| Tras `8 +` (falta el segundo número) | No (`esperandoOperando` es `true`) |
| Tras `8 + 2` | Sí |
| Justo después de otro `=` | No (la operación ya se limpió) |

### Por qué se copian los valores a constantes

`izquierdo`, `derecho` y `operador` guardan los datos **antes** de que se modifique el estado. Así, aunque más abajo se pongan `primerOperando` y `operadorPendiente` a `null`, la línea de la expresión puede seguir usando los valores originales.

### Ejemplo completo: `3 + 4 =`

Antes de pulsar `=`: pantalla `"4"`, `primerOperando = 3`, `operadorPendiente = '+'`, `esperandoOperando = false`.

| Paso | Qué ocurre |
|---|---|
| 1 | La comprobación inicial no hace `return` |
| 2 | `izquierdo = 3`, `derecho = 4`, `operador = '+'` |
| 3 | `calcular(3, 4, '+')` → `7` → `formatearNumero(7)` → `"7"` |
| 4 | `valorPantalla = "7"` |
| 5 | `expresion = "3 + 4 ="` |
| 6 | `primerOperando = null`, `operadorPendiente = null` |
| 7 | `esperandoOperando = true` |

Resultado: la pantalla muestra `7` y la línea pequeña `3 + 4 =`. Si ahora escribes `5`, como `esperandoOperando` es `true`, empieza una cuenta nueva con `5`.

### Y si ahora pulsas un operador sobre el resultado

Tras `3 + 4 =`, si pulsas `×`: `operadorPendiente` es `null`, así que pasa por el caso B de `seleccionarOperador`: `primerOperando = 7`. Puedes seguir calculando con el resultado: `7 × 2 =` da `14`.

---

## 15. `gestionarAccion`

Es el **handler principal**: recibe qué botón se pulsó y llama a la función adecuada.

```ts
const gestionarAccion = (accion: AccionCalculadora, valor?: string): void => {
    switch (accion) { ... }
}
```

El parámetro `valor` es opcional porque no todas las acciones lo necesitan (`igual` no, `digito` sí).

### Tabla de acciones

| `data-accion` | Botón | `data-valor` | Qué hace |
|---|---|---|---|
| `borrar-todo` | AC | no | Llama a `borrarTodo()` |
| `borrar-entrada` | CE | no | Borra solo el número que se escribe |
| `retroceso` | ⌫ | no | Quita el último carácter |
| `signo` | ± | no | Cambia el signo |
| `alternar` | ↑ / ↓ | no | Expande o contrae la calculadora |
| `operador` | + − × ÷ | `+`, `−`, `×`, `÷` | Llama a `seleccionarOperador` |
| `digito` | 0-9 | `0`...`9` | Llama a `introducirDigito` |
| `decimal` | . | no | Llama a `introducirDecimal()` |
| `igual` | = | no | Llama a `resolverOperacion()` |
| `constante` | π, e | `pi` o `e` | Pone la constante en pantalla |

### `borrar-entrada` (CE)

```ts
valorPantalla = '0'
esperandoOperando = false
hayError = false
actualizarPantalla()
```

Borra **solo el número actual**, conservando la operación pendiente.

Ejemplo: `8 + 5` y pulsas CE → pantalla `"0"`, pero `primerOperando = 8` y `operadorPendiente = '+'` siguen guardados. Escribes `3` y `=` → resultado `11`.

### `retroceso` (⌫)

```ts
if (!esperandoOperando && !hayError) {
    valorPantalla = valorPantalla.length > 1 ? valorPantalla.slice(0, -1) : '0'
    if (valorPantalla === '-') valorPantalla = '0'
    actualizarPantalla()
}
```

`slice(0, -1)` devuelve el texto sin el último carácter.

| `valorPantalla` antes | Después | Motivo |
|---|---|---|
| `"127"` | `"12"` | Quita el 7 |
| `"5"` | `"0"` | Un solo carácter: vuelve a 0 |
| `"-5"` | `"0"` | `"-5"` pasa a `"-"` y se corrige a `"0"` |
| `"3.14"` | `"3.1"` | Quita el 4 |
| `"3."` | `"3"` | Quita el punto |
| Resultado tras `=` | sin cambios | `esperandoOperando` es `true` |
| `"Error"` | sin cambios | `hayError` es `true` |

No actúa sobre un resultado ya calculado: así evita "romper" un resultado que no escribió el usuario.

### `signo` (±)

```ts
if (!hayError && Number(valorPantalla) !== 0) {
    valorPantalla = valorPantalla.startsWith('-')
        ? valorPantalla.slice(1)
        : `-${valorPantalla}`
    actualizarPantalla()
}
```

| `valorPantalla` antes | Después |
|---|---|
| `"5"` | `"-5"` |
| `"-5"` | `"5"` |
| `"3.14"` | `"-3.14"` |
| `"0"` | `"0"` (el cero no tiene signo, se ignora) |
| `"0."` | `"0."` (`Number("0.")` es `0`, se ignora) |
| `"Error"` | sin cambios |

### `alternar` (↑ / ↓)

```ts
case 'alternar': {
    const estaAmpliada = botonExpandir.getAttribute('aria-expanded') === 'true'
    teclasAvanzadas.classList.toggle('is-visible', !estaAmpliada)
    calculadora.classList.toggle('calculadora--ampliada', !estaAmpliada)
    botonExpandir.setAttribute('aria-expanded', String(!estaAmpliada))
    botonExpandir.setAttribute('aria-label', estaAmpliada ? 'Mostrar calculadora ampliada' : 'Ocultar calculadora ampliada')
    botonExpandir.textContent = estaAmpliada ? '↑' : '↓'
    break
}
```

Las llaves `{ }` del `case` crean un ámbito propio para poder declarar la constante `estaAmpliada`.

- El estado "ampliada o no" se lee del atributo `aria-expanded` del botón (no hay una variable aparte).
- `classList.toggle('clase', true)` **añade** la clase; `toggle('clase', false)` la **quita**.
- Se actualizan también los atributos de accesibilidad (`aria-expanded`, `aria-label`) para lectores de pantalla.

| | Antes de pulsar | Después de pulsar |
|---|---|---|
| `aria-expanded` | `"false"` | `"true"` |
| `teclasAvanzadas` | sin `is-visible` | con `is-visible` |
| `calculadora` | sin `calculadora--ampliada` | con `calculadora--ampliada` |
| `aria-label` | `Mostrar calculadora ampliada` | `Ocultar calculadora ampliada` |
| Texto del botón | `↑` | `↓` |

Pulsar de nuevo hace lo contrario.

### `operador`

```ts
if (esOperadorBinario(valor)) seleccionarOperador(valor)
```

Valida el `data-valor` antes de usarlo (sección 3). Si el HTML tuviera `data-valor="/"`, la pulsación se ignoraría.

### `digito`

```ts
if (valor && /^\d$/.test(valor)) introducirDigito(valor)
```

- `valor &&` descarta `undefined` y texto vacío.
- La expresión regular `/^\d$/` exige **exactamente un dígito**: `^` inicio, `\d` un dígito, `$` final.

| `valor` | ¿Pasa? |
|---|---|
| `"5"` | Sí |
| `"12"` | No (son dos caracteres) |
| `"a"` | No |
| `""` | No |
| `undefined` | No |

### `constante` (π y e)

```ts
if (valor === 'pi' || valor === 'e') {
    valorPantalla = formatearNumero(valor === 'pi' ? Math.PI : Math.E)
    esperandoOperando = false
    hayError = false
    actualizarPantalla()
}
```

Pone la constante en pantalla **como si el usuario la hubiera escrito**: por eso `esperandoOperando = false`.

| Botón | `valor` | Pantalla |
|---|---|---|
| π | `"pi"` | `"3.14159265359"` |
| e | `"e"` | `"2.71828182846"` |

Ejemplo completo: `2 × π =`

| Pulsación | `valorPantalla` | `expresion` |
|---|---|---|
| `2` | `"2"` | |
| `×` | `"2"` | `"2 ×"` |
| `π` | `"3.14159265359"` | `"2 ×"` |
| `=` | `"6.28318530718"` | `"2 × 3.14159265359 ="` |

> El cálculo usa el valor ya redondeado a 12 cifras que se ve en pantalla, no el `Math.PI` completo.

---

## 16. El listener del teclado

```ts
teclado.addEventListener('click', (evento: MouseEvent) => {
    const objetivo = evento.target
    if (!(objetivo instanceof Element)) return

    const boton = objetivo.closest<HTMLButtonElement>('button[data-accion]')
    if (!boton) return

    const accion = boton.dataset.accion
    if (esAccionCalculadora(accion)) gestionarAccion(accion, boton.dataset.valor)
})
```

### Delegación de eventos

En lugar de poner un listener a cada uno de los botones, hay **uno solo en el contenedor**. Los clics "burbujean" hacia arriba, así que el contenedor se entera de cualquier clic en sus hijos. Ventajas:

- Menos código.
- Los botones del modo ampliado (o los que se añadan en el futuro) funcionan sin conectar nada.

### Línea a línea

| Línea | Qué hace |
|---|---|
| `evento.target` | El elemento exacto donde se hizo clic (puede ser el botón o algo dentro de él) |
| `instanceof Element` | Comprueba que es un elemento HTML (y le da el tipo correcto a TypeScript) |
| `closest('button[data-accion]')` | Sube desde el elemento hasta encontrar un `<button>` con atributo `data-accion`; devuelve `null` si no hay |
| `boton.dataset.accion` | Lee `data-accion` (JavaScript pasa `data-accion` a `dataset.accion`) |
| `esAccionCalculadora(accion)` | Valida el texto (type guard) |
| `boton.dataset.valor` | Lee `data-valor` (puede ser `undefined`) |

### Por qué `closest`

Si el botón tuviera algo dentro:

```html
<button data-accion="digito" data-valor="5"><span>5</span></button>
```

y el usuario hace clic justo sobre el `<span>`, `evento.target` sería el `<span>`, que no tiene `data-accion`. `closest` sube hasta el `<button>` y lo encuentra igualmente.

### Ejemplo completo de principio a fin

El usuario pulsa la tecla **7** estando `valorPantalla = "12"`:

1. El clic burbujea hasta `#teclado` y se dispara el listener.
2. `objetivo` es el `<button>`; `closest` lo devuelve.
3. `accion = "digito"`; `esAccionCalculadora("digito")` es `true`.
4. Se llama a `gestionarAccion("digito", "7")`.
5. En el `switch`, `valor` es `"7"` y cumple `/^\d$/` → `introducirDigito("7")`.
6. `esperandoOperando` y `hayError` son `false` y hay menos de 16 cifras → `valorPantalla = "127"`.
7. `actualizarPantalla()` muestra `127`.

---

## 17. Trazas completas

Cada fila muestra el estado **después** de cada pulsación.

### Traza 1: `12 + 7 =`

| Pulsación | `valorPantalla` | `primerOperando` | `operadorPendiente` | `esperandoOperando` | `expresion` |
|---|---|---|---|---|---|
| (inicio) | `"0"` | `null` | `null` | `false` | `""` |
| `1` | `"1"` | `null` | `null` | `false` | `""` |
| `2` | `"12"` | `null` | `null` | `false` | `""` |
| `+` | `"12"` | `12` | `"+"` | `true` | `"12 +"` |
| `7` | `"7"` | `12` | `"+"` | `false` | `"12 +"` |
| `=` | `"19"` | `null` | `null` | `true` | `"12 + 7 ="` |

### Traza 2: operaciones encadenadas `2 + 3 × 4 =`

Esta calculadora evalúa **de izquierda a derecha**, sin prioridad de operadores.

| Pulsación | `valorPantalla` | `primerOperando` | `operadorPendiente` | `esperandoOperando` | `expresion` |
|---|---|---|---|---|---|
| `2` | `"2"` | `null` | `null` | `false` | `""` |
| `+` | `"2"` | `2` | `"+"` | `true` | `"2 +"` |
| `3` | `"3"` | `2` | `"+"` | `false` | `"2 +"` |
| `×` | `"5"` | `5` | `"×"` | `true` | `"5 ×"` |
| `4` | `"4"` | `5` | `"×"` | `false` | `"5 ×"` |
| `=` | `"20"` | `null` | `null` | `true` | `"5 × 4 ="` |

Resultado `20` (no `14`, que sería con prioridad de la multiplicación).

### Traza 3: decimales y problema típico de JavaScript, `0.1 + 0.2 =`

| Pulsación | `valorPantalla` | Comentario |
|---|---|---|
| `.` | `"0."` | |
| `1` | `"0.1"` | |
| `+` | `"0.1"` | `primerOperando = 0.1` |
| `.` | `"0."` | Entrada nueva con `0.` |
| `2` | `"0.2"` | |
| `=` | `"0.3"` | `0.1 + 0.2 = 0.30000000000000004`, y `formatearNumero` lo deja en `"0.3"` |

### Traza 4: error y recuperación, `5 ÷ 0 = 9`

| Pulsación | `valorPantalla` | `hayError` | `expresion` |
|---|---|---|---|
| `5` | `"5"` | `false` | `""` |
| `÷` | `"5"` | `false` | `"5 ÷"` |
| `0` | `"0"` | `false` | `"5 ÷"` |
| `=` | `"Error"` | `true` | `"No se puede dividir entre cero."` |
| `9` | `"9"` | `false` | `"No se puede dividir entre cero."` |

El mensaje de la línea pequeña permanece hasta la siguiente operación o AC.

### Traza 5: usar el resultado para seguir, `3 + 4 = × 2 =`

| Pulsación | `valorPantalla` | `primerOperando` | `operadorPendiente` | `expresion` |
|---|---|---|---|---|
| `3 + 4 =` | `"7"` | `null` | `null` | `"3 + 4 ="` |
| `×` | `"7"` | `7` | `"×"` | `"7 ×"` |
| `2` | `"2"` | `7` | `"×"` | `"7 ×"` |
| `=` | `"14"` | `null` | `null` | `"7 × 2 ="` |

---

## 18. Detalles a tener en cuenta

Observaciones sobre el comportamiento actual, por si quieres afinarlo más adelante:

1. **CE justo después de un operador.** Con `8 +` en pantalla (`esperandoOperando = true`), pulsar CE pone `valorPantalla = "0"` y `esperandoOperando = false`. Si ahora pulsas `=`, calcula `8 + 0`. Es coherente (el segundo operando es 0), pero puede sorprender.
2. **± tras un operador o un resultado.** `signo` cambia el texto de la pantalla, pero no toca `esperandoOperando`. Con `8 +` y luego ±, la pantalla muestra `-8` y el siguiente dígito la reemplaza. Tras un resultado (por ejemplo `19`), ± muestra `-19` y, si pulsas un operador, se usa `-19` como primer operando.
3. **Sin prioridad de operadores.** Se evalúa de izquierda a derecha (traza 2), como las calculadoras básicas.
4. **Límite de 16 cifras.** Solo afecta a lo que se *escribe*; un resultado puede ser más largo o usar notación científica (sección 6).
5. **El estado "ampliada" vive en el HTML** (`aria-expanded`), no en una variable. Funciona bien, solo hay que recordarlo si cambias el HTML.