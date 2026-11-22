import './style.css'
import {type OperadorBinario, type AccionCalculadora} from './types';


/**
 * Comprueba si un texto es uno de los cuatro operadores que entiende la calculadora.
 *
 * @param valor Texto leído del HTML (puede ser undefined si el atributo no existe).
 * @returns true si es '+', '−', '×' o '÷'. Además, TypeScript lo trata como OperadorBinario.
 *
 * Ejemplo: esOperadorBinario('÷') -> true; esOperadorBinario('AC') -> false.
 */
const esOperadorBinario = (valor: string | undefined): valor is OperadorBinario =>
    valor === '+' || valor === '−' || valor === '×' || valor === '÷'

/**
 * Comprueba si el texto de data-accion corresponde a una acción implementada.
 * Tras esta comprobación, TypeScript permite usar el valor en el switch de
 * gestionarAccion sin conversiones forzadas.
 *
 * @param valor Texto leído de data-accion (puede ser undefined).
 * @returns true si es una de las acciones de AccionCalculadora.
 *
 * Ejemplo: esAccionCalculadora('digito') -> true; esAccionCalculadora('otra-cosa') -> false.
 */
const esAccionCalculadora = (valor: string | undefined): valor is AccionCalculadora =>
    valor === 'borrar-todo' ||
    valor === 'borrar-entrada' ||
    valor === 'retroceso' ||
    valor === 'signo' ||
    valor === 'alternar' ||
    valor === 'operador' ||
    valor === 'digito' ||
    valor === 'decimal' ||
    valor === 'igual' ||
    valor === 'constante'

// Guardamos los elementos del HTML una sola vez: todas las funciones los reutilizan para
// actualizar la pantalla, gestionar los botones y expandir o contraer la calculadora.
const pantalla = document.querySelector<HTMLParagraphElement>('#pantalla')          // número grande
const expresion = document.querySelector<HTMLParagraphElement>('#expresion')        // operación pequeña ("3 + 4 =")
const teclasAvanzadas = document.querySelector<HTMLDivElement>('#teclasAvanzadas')  // teclas del modo ampliado
const botonExpandir = document.querySelector<HTMLButtonElement>('#botonExpandir')   // botón ↑ / ↓
const calculadora = document.querySelector<HTMLElement>('#calculadora')             // contenedor general
const botonLogoArch = document.querySelector<HTMLButtonElement>('#botonLogoArch')   // botón que envuelve el logo
const logoArch = document.querySelector<HTMLImageElement>('#logoArch')              // imagen del logo
const teclado = document.querySelector<HTMLDivElement>('#teclado')                  // contenedor de todos los botones

// Si falta alguno de los elementos que necesita la aplicación, es mejor avisar al desarrollador
// aquí que dejar que el error aparezca más tarde al pulsar un botón.
if (
    !pantalla ||
    !expresion ||
    !teclasAvanzadas ||
    !botonExpandir ||
    !calculadora ||
    !botonLogoArch ||
    !logoArch ||
    !teclado
) {
    throw new Error('No se pudo inicializar la calculadora.')
}

// Este valor recuerda el color actual del icono para alternarlo en cada pulsación.
let logoArchRojo = true

// El mismo botón alterna las dos imágenes del logo; no afecta a las operaciones ni a la pantalla.
// Ejemplo: primera pulsación -> verde; segunda pulsación -> rojo.
botonLogoArch.addEventListener('click', () => {
    logoArchRojo = !logoArchRojo
    logoArch.src = logoArchRojo
        ? 'https://img.icons8.com/material-two-tone/48/FA5252/arch-linux.png'
        : 'https://img.icons8.com/material-two-tone/48/40C057/arch-linux.png'
})

// valorPantalla es texto porque puede contener un punto decimal mientras se escribe, por ejemplo
// "3.". Los operandos se guardan como números cuando ya hay que calcularlos. null indica que aún
// no hay un primer número ni una operación pendiente. Las dos banderas describen el siguiente paso.
let valorPantalla = '0'
let primerOperando: number | null = null
let operadorPendiente: OperadorBinario | null = null
let esperandoOperando = false
let hayError = false

/**
 * Convierte un número a texto listo para mostrar, evitando resultados engañosos.
 * - toPrecision(12) elimina artefactos de la aritmética decimal de JavaScript
 *   (0.1 + 0.2 daría 0.30000000000000004).
 * - Number(...) quita ceros sobrantes ("0.300000000000" -> 0.3).
 * - Object.is(x, -0) detecta el cero negativo y lo muestra como 0.
 *
 * @param valor Número a formatear.
 * @returns Texto del número.
 * @throws Error si el valor es Infinity o NaN.
 *
 * Ejemplo: formatearNumero(0.1 + 0.2) devuelve "0.3".
 */
const formatearNumero = (valor: number): string => {
    // Infinity y NaN no se pueden mostrar: lanzamos error para que lo capture quien llamó.
    if (!Number.isFinite(valor)) {
        throw new Error('El resultado no es un número finito.')
    }

    // Redondea a 12 cifras significativas y vuelve a convertir a número.
    const valorRedondeado = Number(valor.toPrecision(12))
    // Normaliza -0 a 0 y lo convierte a texto.
    return String(Object.is(valorRedondeado, -0) ? 0 : valorRedondeado)
}

/**
 * Copia el valor guardado (valorPantalla) al elemento visible de la pantalla.
 * Tenerlo en un solo sitio evita que cada botón tenga que conocer el HTML.
 *
 * Ejemplo: si valorPantalla es "125", la pantalla muestra "125".
 */
const actualizarPantalla = (): void => {
    pantalla.textContent = valorPantalla
}

/**
 * Restablece lo que se ve y todo el estado interno (botón AC).
 * No basta con limpiar el texto: si quedara un operador guardado, se usaría
 * por error al pulsar el siguiente número.
 *
 * Ejemplo: tras "8 +" y pulsar AC, la pantalla vuelve a 0 y no queda suma pendiente.
 */
const borrarTodo = (): void => {
    valorPantalla = '0'
    primerOperando = null
    operadorPendiente = null
    esperandoOperando = false
    hayError = false
    expresion.textContent = ''
    actualizarPantalla()
}

/**
 * Muestra un error y descarta la operación que lo provocó.
 * Se limpian operandos y operador para no reutilizar datos de una cuenta fallida.
 * Con hayError = true, el siguiente dígito empieza una cuenta nueva.
 *
 * @param mensaje Explicación del error, que se muestra en la línea de la expresión.
 *
 * Ejemplo: una división entre cero muestra "Error" y "No se puede dividir entre cero.".
 */
const mostrarError = (mensaje: string): void => {
    valorPantalla = 'Error'
    expresion.textContent = mensaje
    primerOperando = null
    operadorPendiente = null
    esperandoOperando = true
    hayError = true
    actualizarPantalla()
}

/**
 * Realiza una de las cuatro operaciones básicas.
 * La división entre cero se comprueba antes de dividir, para mostrar un mensaje útil
 * en lugar de que Infinity o NaN lleguen a la pantalla.
 *
 * @param izquierdo Primer número de la operación.
 * @param derecho Segundo número de la operación.
 * @param operador Operación a realizar.
 * @returns El resultado numérico.
 * @throws Error si se intenta dividir entre cero.
 *
 * Ejemplo: calcular(8, 2, '÷') devuelve 4.
 */
const calcular = (izquierdo: number, derecho: number, operador: OperadorBinario): number => {
    switch (operador) {
        case '+':
            return izquierdo + derecho
        case '−':
            return izquierdo - derecho
        case '×':
            return izquierdo * derecho
        case '÷':
            // Comprobamos antes de dividir para poder dar un error claro.
            if (derecho === 0) {
                throw new Error('No se puede dividir entre cero.')
            }
            return izquierdo / derecho
    }
}

/**
 * Añade un dígito al número que se está escribiendo.
 *
 * Hay dos casos:
 * 1) Se está esperando un operando nuevo (acabamos de pulsar un operador o "=")
 *    o hay un error: el dígito reemplaza lo que hay en pantalla y empieza un número nuevo.
 * 2) Se continúa escribiendo: el dígito se concatena, con un límite de 16 cifras
 *    (sin contar '-' ni '.') para que no desborde el visor. Si la pantalla muestra "0",
 *    el dígito lo sustituye (así no queda "07").
 *
 * @param digito Un único carácter '0'..'9'.
 *
 * Ejemplo: con "12" en pantalla, introducirDigito('7') deja "127".
 * Ejemplo: con "0" en pantalla, introducirDigito('7') deja "7".
 */
const introducirDigito = (digito: string): void => {
    if (hayError || esperandoOperando) {
        // Caso 1: empezamos un número nuevo.
        valorPantalla = digito
        esperandoOperando = false
        hayError = false
    } else if (valorPantalla.replace('-', '').replace('.', '').length < 16) {
        // Caso 2: contamos solo las cifras (quitando '-' y '.') y, si caben, añadimos el dígito.
        valorPantalla = valorPantalla === '0' ? digito : valorPantalla + digito
    }
    actualizarPantalla()
}

/**
 * Añade el separador decimal, una sola vez por número.
 * Si se empieza una entrada nueva, antepone el cero para que ".5" se interprete como "0.5".
 * Se llama cuando el usuario pulsa el botón "." de la calculadora.
 *
 * Ejemplo: con "5" en pantalla, introducirDecimal() deja "5.".
 * Ejemplo: justo después de un operador, introducirDecimal() deja "0.".
 */
const introducirDecimal = (): void => {
    if (hayError || esperandoOperando) {
        // Entrada nueva: empezamos con "0.".
        valorPantalla = '0.'
        esperandoOperando = false
        hayError = false
    } else if (!valorPantalla.includes('.')) {
        // Solo añadimos el punto si todavía no lo tiene.
        valorPantalla += '.'
    }
    actualizarPantalla()
}

/**
 * Guarda el operador pulsado y deja la calculadora esperando el segundo número.
 *
 * Tres situaciones posibles:
 * - Ya había una operación pendiente y se escribió el segundo número: se calcula primero,
 *   así "2 + 3 +" muestra 5 y queda lista para seguir sumando (operaciones encadenadas).
 * - Todavía no había primer operando: se guarda el número actual como primero.
 * - Se pulsa otro operador sin escribir el segundo número: simplemente se sustituye el anterior.
 *
 * @param operador Operador pulsado.
 *
 * Ejemplo: con "2" en pantalla, seleccionarOperador('+') guarda 2 y espera el siguiente valor.
 */
const seleccionarOperador = (operador: OperadorBinario): void => {
    // Con "Error" en pantalla no se puede operar: salimos sin hacer nada.
    if (hayError) return

    // Convertimos el texto de la pantalla a número para poder calcular con él.
    const valorActual = Number(valorPantalla)

    // ¿Hay una operación completa lista para calcular? Se necesita:
    //  - operadorPendiente: un operador guardado (+, −, ×, ÷),
    //  - primerOperando: un primer número (distinto de null; 0 también es válido),
    //  - !esperandoOperando: que ya se haya escrito el segundo número.
    //    Ejemplo: esperandoOperando = true  -> "9 +"   (falta el segundo número)
    //             esperandoOperando = false -> "9 + 9" (ya está completo)
    if (operadorPendiente && primerOperando !== null && !esperandoOperando) {
        try {
            // Calculamos con el primer operando, el valor actual y el operador guardado.
            // Ejemplo: 9 + 9 -> primerOperando pasa a valer 18.
            primerOperando = calcular(primerOperando, valorActual, operadorPendiente)
            // Mostramos el resultado ya formateado.
            valorPantalla = formatearNumero(primerOperando)
        } catch (error) {
            // Si algo falla (p. ej. dividir entre cero), mostramos el error y salimos.
            mostrarError(error instanceof Error ? error.message : 'No se pudo realizar la operación.')
            return
        }
    } else if (primerOperando === null) {
        // Sin primer operando no hay nada que calcular: el número en pantalla pasa a ser el primero.
        primerOperando = valorActual
    }

    // El nuevo operador queda pendiente y esperamos el siguiente número.
    operadorPendiente = operador
    esperandoOperando = true
    // Línea pequeña de arriba: primer operando formateado + operador. Ejemplo: "18 +".
    expresion.textContent = `${formatearNumero(primerOperando)} ${operador}`
    actualizarPantalla()
}

/**
 * Resuelve la cuenta al pulsar "=".
 * Si falta el operador, el primer número o el segundo número, no hace nada.
 * Tras calcular, se borra la operación pendiente pero el resultado queda visible,
 * y esperandoOperando = true hace que el siguiente dígito inicie una cuenta nueva.
 *
 * Ejemplo: tras 3, + y 4, muestra 7 y la expresión "3 + 4 =".
 */
const resolverOperacion = (): void => {
    // Sin operación completa no hay nada que resolver.
    if (operadorPendiente === null || primerOperando === null || esperandoOperando) return

    // Copiamos los datos a constantes locales antes de modificar el estado.
    const izquierdo = primerOperando
    const derecho = Number(valorPantalla)
    const operador = operadorPendiente

    try {
        // Calculamos y mostramos el resultado.
        valorPantalla = formatearNumero(calcular(izquierdo, derecho, operador))
        // Línea pequeña con la cuenta completa. Ejemplo: "3 + 4 =".
        expresion.textContent = `${formatearNumero(izquierdo)} ${operador} ${formatearNumero(derecho)} =`
        // Cuenta terminada: limpiamos la operación pero dejamos el resultado visible.
        primerOperando = null
        operadorPendiente = null
        esperandoOperando = true
        hayError = false
        actualizarPantalla()
    } catch (error) {
        mostrarError(error instanceof Error ? error.message : 'No se pudo realizar la operación.')
    }
}

/**
 * Handler principal de la aplicación: recibe la acción de un botón y llama a la
 * función que corresponde. Así el HTML solo tiene que indicar, con data-accion,
 * qué representa cada tecla. Cada caso actualiza el estado y luego la pantalla.
 * Los casos "operador", "digito" y "constante" validan su valor antes de usarlo,
 * porque viene del HTML (data-valor) y no hay garantía de que sea correcto.
 *
 * @param accion Acción del botón (ya validada con esAccionCalculadora).
 * @param valor Dato extra opcional (el dígito, el operador o la constante).
 *
 * Ejemplo: gestionarAccion('digito', '7') introduce un 7; gestionarAccion('igual') resuelve la cuenta.
 */
const gestionarAccion = (accion: AccionCalculadora, valor?: string): void => {
    switch (accion) {
        // AC: borra pantalla, operandos y operador.
        case 'borrar-todo':
            borrarTodo()
            break

        // CE: borra solo el número que se está escribiendo; la operación pendiente se mantiene.
        case 'borrar-entrada':
            valorPantalla = '0'
            esperandoOperando = false
            hayError = false
            actualizarPantalla()
            break

        // ⌫: quita el último carácter. No actúa sobre un resultado ya calculado ni sobre un error.
        case 'retroceso':
            if (!esperandoOperando && !hayError) {
                // Si queda más de un carácter se corta el último; si no, vuelve a "0".
                valorPantalla = valorPantalla.length > 1 ? valorPantalla.slice(0, -1) : '0'
                // Si solo quedó el signo "-", lo consideramos vacío.
                if (valorPantalla === '-') valorPantalla = '0'
                actualizarPantalla()
            }
            break

        // ±: cambia el signo del número en pantalla. El 0 no tiene signo, así que se ignora.
        case 'signo':
            if (!hayError && Number(valorPantalla) !== 0) {
                valorPantalla = valorPantalla.startsWith('-')
                    ? valorPantalla.slice(1)   // si ya es negativo, quitamos el "-"
                    : `-${valorPantalla}`      // si es positivo, lo añadimos
                actualizarPantalla()
            }
            break

        // ↑ / ↓: expande o contrae la calculadora (teclas avanzadas).
        case 'alternar': {
            // Leemos el estado actual desde el atributo aria-expanded del botón.
            const estaAmpliada = botonExpandir.getAttribute('aria-expanded') === 'true'
            // Mostramos u ocultamos las teclas avanzadas (la clase 'is-visible' la define el CSS).
            teclasAvanzadas.classList.toggle('is-visible', !estaAmpliada)
            // Cambiamos el tamaño de la calculadora con su clase modificadora.
            calculadora.classList.toggle('calculadora--ampliada', !estaAmpliada)
            // Actualizamos los atributos de accesibilidad y el texto del botón.
            botonExpandir.setAttribute('aria-expanded', String(!estaAmpliada))
            botonExpandir.setAttribute(
                'aria-label',
                estaAmpliada ? 'Mostrar calculadora ampliada' : 'Ocultar calculadora ampliada',
            )
            botonExpandir.textContent = estaAmpliada ? '↑' : '↓'
            break
        }

        // + − × ÷: solo se acepta si el valor es un operador válido.
        case 'operador':
            if (esOperadorBinario(valor)) seleccionarOperador(valor)
            break

        // 0-9: solo se acepta si el valor es exactamente un dígito (regex ^\d$).
        case 'digito':
            if (valor && /^\d$/.test(valor)) introducirDigito(valor)
            break

        // ".": añade el separador decimal.
        case 'decimal':
            introducirDecimal()
            break

        // "=": resuelve la operación pendiente.
        case 'igual':
            resolverOperacion()
            break

        // π y e: ponen la constante en pantalla, como si fuera un número escrito.
        case 'constante':
            if (valor === 'pi' || valor === 'e') {
                valorPantalla = formatearNumero(valor === 'pi' ? Math.PI : Math.E)
                esperandoOperando = false
                hayError = false
                actualizarPantalla()
            }
            break
    }
}

/**
 * Escucha los clics en todo el contenedor del teclado en vez de añadir un listener a
 * cada botón (delegación de eventos). Así los botones del modo ampliado también
 * quedan conectados automáticamente. closest() hace que funcione aunque el clic
 * ocurra sobre un elemento hijo dentro del botón.
 *
 * Ejemplo: al pulsar la tecla 5, lee data-accion="digito" y data-valor="5" y llama
 * a gestionarAccion('digito', '5'), que a su vez llama a introducirDigito('5').
 */
teclado.addEventListener('click', (evento: MouseEvent) => {
    // Elemento exacto donde se hizo clic; si no es un Element, no nos interesa.
    const objetivo = evento.target
    if (!(objetivo instanceof Element)) return

    // Busca el botón con data-accion más cercano (el propio elemento o un ancestro).
    const boton = objetivo.closest<HTMLButtonElement>('button[data-accion]')
    if (!boton) return

    // Lee la acción, la valida y, si es correcta, la gestiona junto a su data-valor.
    const accion = boton.dataset.accion
    if (esAccionCalculadora(accion)) gestionarAccion(accion, boton.dataset.valor)
})
