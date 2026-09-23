# Horizonte: finanzas personales y libertad financiera

Prototipo académico del Proyecto 3 de Sistema Financiero II, Universidad de Málaga. Profesora Dra. Laura Vanesa Lorente Bayona. Estos datos de contexto proceden del encargo; no se presenta como una aplicación oficial ni como una rúbrica verificada de la asignatura. Los marcadores del encargo no incluyen un documento fuente accesible.

## 1. Entrega y alcance

Web estática funcional en HTML5, Tailwind CSS y JavaScript, con Chart.js. No requiere servidor de aplicación, API, claves, instalación de paquetes ni base de datos externa. Se despliega en GitHub Pages. El estado se conserva en localStorage del navegador. Incluye nueve apartados, ejemplo ficticio, edición y eliminación de registros, exportación JSON, tablas alternativas a gráficos y pruebas del núcleo financiero.

No hay ejecución de inversiones, conexión bancaria, usuarios compartidos, autenticación, sincronización, importación de copias JSON ni almacenamiento cifrado. La exportación es una copia de los datos para consulta o procesamiento externo, no un flujo de restauración incorporado. Las decisiones del laboratorio no son órdenes. Los escenarios son deterministas e ilustrativos, no pronósticos ni probabilidades.

En la pantalla de bienvenida se puede elegir una de 15 monedas habituales. La preferencia se guarda junto al nombre en `horizonte-profile` y se usa solo para formatear importes; los cálculos no cambian de escala ni realizan conversiones entre divisas. Los perfiles anteriores sin moneda conservan EUR por compatibilidad. El botón «Cambiar nombre o moneda» permite volver a editar esta preferencia después de cerrar la introducción sin borrar los datos financieros.

La documentación de GitHub confirma que Pages publica archivos estáticos HTML, CSS y JavaScript. [GitHub Docs](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

## 2. Archivos

| Archivo | Responsabilidad |
|---|---|
| index.html | Pantallas, formularios accesibles y contenedores de gráficos |
| styles.css | Estilos propios, responsive y presentación básica sin Tailwind |
| finance.js | Funciones puras de cálculo y puntuación conductual |
| app.js | Estado, validaciones de formularios, persistencia, eventos y gráficos |
| tests.js | Suite de 46 pruebas financieras reproducibles |
| tests.html / tests-browser.js | Ejecución de la suite en navegador |
| verification.json | Resultados de pruebas ejecutadas y ejemplos calculados |
| README.md | Arquitectura, fórmulas, despliegue y guion de exposición |
| .nojekyll | Publicación directa de archivos estáticos |

Las dependencias de navegador se fijan a versiones concretas: Tailwind browser 4.1.12 y Chart.js 4.4.8. Los scripts se descargan desde jsDelivr. Los datos financieros no se envían explícitamente a un servidor por el código de la aplicación; los proveedores CDN reciben solicitudes de recursos y los scripts de terceros se ejecutan en la página.

**Límite de prototipo:** Tailwind Play CDN está pensado para desarrollo, no producción. Antes de un uso real, compilar las clases a un CSS estático, alojar las dependencias localmente, revisar seguridad y aplicar una política CSP adecuada. El CSS propio conserva una presentación básica si Tailwind no carga. Si Chart.js no carga, los datos siguen en tablas y tarjetas. [Tailwind CSS](https://tailwindcss.com/docs/installation/play-cdn)

## 3. Arquitectura de datos

Arquitectura lógica: presentación HTML -> controlador app.js -> dominio finance.js -> estado JSON/localStorage. Chart.js recibe series calculadas por el dominio; nunca inventa valores. El gráfico se destruye y reconstruye al recalcular y se redimensiona al navegar.

El prototipo es monousuario y guarda una sola raíz JSON bajo `horizonte-v1`. No implementa un sistema relacional ni un libro contable de partida doble. Las siguientes entidades describen su esquema real y se pueden convertir en tablas en una ampliación.

| Entidad lógica / almacenamiento | Campos principales | Reglas y significado |
|---|---|---|
| Estado | version, accounts, transactions, fire, compound, answers, reviewStarted, lastDecision | Versión interna 2; raíz monousuario conservada bajo `horizonte-v1` |
| Cuenta o saldo / accounts[] | id, name, kind, balance, asOf | UUID, nombre, tipo práctico, saldo >= 0, fecha de valoración |
| Movimiento / transactions[] | id, date, kind, name, category, amount | Importe positivo; ingreso, gasto o transferencia |
| Configuración FIRE / fire | age, retirementAge, initial, contribution, spending, withdrawal, inflation, cautious, base, optimistic | Edad entera, gasto y retirada > 0; tasas en porcentaje en la interfaz |
| Configuración compuesto / compound | initial, contribution, years, nominal, inflation, purchase | Capital y aportación >= 0; plazo entero 1-80 |
| Pregunta / QUESTIONS | group, text, reverse | Nueve definiciones inmutables en finance.js; índice como referencia local |
| Respuesta / answers[] | Nueve enteros 1-5 | Último test completo; índice corresponde a QUESTIONS |
| Reglas conductuales | Umbrales 35 y 65, 48 horas, 10% | Constantes didácticas en el código; no calibradas psicométricamente |
| Revisión / reviewStarted | Fecha-hora numérica | Inicio del periodo de reflexión; independiente de una orden real |
| Última comprobación / lastDecision | at, portfolio, position, counter, risk, concentration, blocked | Se conserva solo la última, no un historial auditable |

### Semántica contable y límites

- **Saldos y movimientos son independientes.** Registrar un gasto no altera automáticamente un saldo. La fecha de valoración pertenece al saldo; el filtro mensual solo modifica los flujos. No hay historial de balances.
- **Tipos patrimoniales prácticos.** `liquid` aproxima un activo corriente líquido y sirve para medir liquidez; `investment` separa el capital invertido que puede vincularse a FIRE; `other` agrupa bienes como vivienda o vehículo; `liability` representa una deuda pendiente. No sustituyen la separación contable entre corriente y no corriente ni registran vencimientos.
- **Deudas se introducen positivas.** El núcleo resta los pasivos al calcular patrimonio, evitando una doble inversión del signo. Una vivienda se registra como otro activo y la hipoteca pendiente como pasivo separado.
- **Criterio de caja.** Los gastos incluyen pagos efectivos, incluso la cuota completa de un préstamo si se registra. No se descompone amortización e interés; no es una cuenta de resultados por devengo. Se debe actualizar la deuda pendiente manualmente.
- **Transferencias internas excluidas.** Mover dinero a una cuenta o inversión propia no es gasto ni ingreso. El ahorro es capacidad previa a su distribución entre cuentas o inversiones.
- **Capital FIRE no es patrimonio neto.** El botón de vinculación toma únicamente los activos de inversión, no vivienda ni liquidez. El usuario ajusta el capital realmente disponible y contempla sus deudas y obligaciones en el gasto objetivo.
- **Valores introducidos en euros.** No se convierten divisas. Los resultados se calculan sin redondeos intermedios y se muestran con dos decimales. No se utiliza el prototipo como motor de liquidación monetaria.
- **Fechas locales.** Las fechas de movimientos usan YYYY-MM-DD sin conversión UTC; el periodo mensual es YYYY-MM. La espera conductual usa tiempo transcurrido desde una marca temporal.

## 4. Fórmulas y supuestos

### 4.1 Balance y caja

$$
PN = A - P
$$

$$
D = \frac{P}{A},\qquad S_m = I_m-G_m,\qquad T_m = \frac{S_m}{I_m}
$$

A = activos totales; P = pasivos pendientes; I y G = ingresos y gastos del mes; S = capacidad de ahorro. D es ratio de pasivos sobre activos, no servicio de deuda sobre ingresos. Puede superar el 100%. Sin activos, D es no definido; sin ingresos, T es no definida. No se sustituyen estos resultados por cero. El ahorro negativo se mantiene visible.

### 4.2 Capital FIRE

$$
K^* = \frac{12G}{w}
$$

G es gasto mensual objetivo en euros actuales y w la tasa de retirada inicial decimal. Para 1.500 EUR/mes y 4%, el capital objetivo es 450.000 EUR. La tasa de retirada es independiente de la rentabilidad del mercado.

La regla del 4% es una referencia histórica: un retiro inicial del 4% del capital y posteriores importes ajustados a la inflación. No significa retirar siempre el 4% del saldo de cada año. El estudio histórico original analizó carteras estadounidenses y una longevidad mínima de 30 años; no garantiza resultados en otro mercado, fiscalidad ni horizonte FIRE prolongado. [Bengen](https://www.financialplanningassociation.org/sites/default/files/2020-05/7%20Determining%20Withdrawal%20Rates%20Using%20Historical%20Data.pdf)

### 4.3 Tasas reales y mensuales

$$
r_{real}=\frac{1+r_{nom}}{1+\pi}-1
$$

$$
i_m=(1+r_{real})^{1/12}-1
$$

No se utiliza simplemente rentabilidad menos inflación ni rentabilidad anual dividida entre doce. Las tasas anuales son efectivas, netas de costes recurrentes asumidos por el usuario y antes de impuestos. Un 5% nominal con inflación del 2% equivale aproximadamente a 2,9412% real.

### 4.4 Acumulación y edad FIRE

$$
K_{m+1}=K_m(1+i_m)+C
$$

$$
m^*=\min\{m\geq 0:K_m\geq K^*\},\qquad edad_{FIRE}=edad_0+\frac{m^*}{12}
$$

FIRE trabaja enteramente en euros de hoy, con aportación real C constante al final del mes. Para sostenerla, su importe nominal debe crecer con inflación. El algoritmo busca el primer cruce mes a mes hasta 960 meses. Si el objetivo ya está cubierto, devuelve cero meses; si no se alcanza, devuelve null, mostrado como no alcanzado en 80 años. No utiliza logaritmos con dominio inválido para casos imposibles.

Los tres escenarios solo cambian rentabilidad nominal; la inflación es común y editable, por lo que se puede repetir el análisis con otros supuestos inflacionarios. Son sensibilidades deterministas, no intervalos de confianza. La edad de jubilación de referencia compara el capital acumulado con el objetivo. No se calcula pensión pública ni edad legal. La proyección continúa aportando después del primer cruce para comparación; no simula retiros.

### 4.5 Interés compuesto

En este módulo C es una aportación mensual nominal constante, a diferencia de FIRE. Sea n el número de meses e i la tasa mensual efectiva nominal:

$$
VF=K_0(1+i)^n+C\frac{(1+i)^n-1}{i}
$$

Si i es cero, se usa explícitamente:

$$
VF=K_0+nC
$$

$$
Aportado=K_0+nC,\qquad Rendimiento=VF-Aportado
$$

$$
VF_{real}=\frac{VF_{nominal}}{(1+\pi)^N}
$$

N es el plazo en años. Los rendimientos pueden ser negativos. No se compara aportado nominal con capital real para calcular el rendimiento nominal. El gráfico usa dos líneas, aportado y acumulado, y las tablas muestran la diferencia y el total real. Se evitan gráficos apilados que podrían ocultar pérdidas.

### 4.6 Coste de oportunidad

$$
VF_X=X(1+r_{nom})^N,\qquad Ganancia\ no\ obtenida=VF_X-X
$$

$$
VF_{X,real}=\frac{VF_X}{(1+\pi)^N}
$$

La interfaz distingue capital futuro no acumulado, ganancia no obtenida y valor en euros actuales. La compra es un escenario independiente, sin aportaciones, que no se añade a la cartera del otro simulador. No se mide el bienestar del consumo, depreciación ni valor residual. Rentabilidad negativa puede producir una ganancia no obtenida negativa: invertir no es necesariamente mejor.

## 5. Economía conductual y reglas automáticas

Nueve escenarios cotidianos, tres por sesgo. La tercera escena de cada grupo está invertida para reducir respuestas mecánicas, sin que eso valide el instrumento. Se responde por frecuencia de conducta (1 = nunca, 5 = casi siempre), no por acuerdo con una afirmación. Para un ítem invertido, la puntuación corregida es 6 menos respuesta. Para cada grupo:

$$
S_b=25\left(\frac{\sum_{j=1}^{3}x'_j}{3}-1\right)
$$

| Puntuación | Señal | Interpretación didáctica |
|---|---|---|
| Menos de 35 | Baja | Poca identificación con estas afirmaciones; no ausencia demostrada de sesgo |
| De 35 a menos de 65 | Moderada | Introducir revisión deliberada |
| Desde 65 | Alta | Activar fricciones adicionales |

No se crea un perfil único de riesgo ni se recomienda un producto. Se presentan tres dimensiones independientes y recomendaciones concretas. La neutralidad en todas las preguntas produce 50/100, no cero.

El laboratorio actúa sobre la **comprobación del plan**, no sobre operaciones reales:

- Aversión a la pérdida alta: no completa la comprobación hasta pasar 48 horas desde el inicio de revisión. La app no decide por sí sola si vender o mantener.
- Confirmación moderada o alta: requiere un argumento contrario de al menos 40 caracteres y una condición de invalidación. La longitud solo comprueba presencia; la calidad exige evaluación humana.
- Exceso de confianza alto: la posición declarada tras la decisión debe ser como máximo el 10% del patrimonio invertido total declarado tras la decisión. Este límite es un ejercicio, no una regla universal de inversión.
- Para cualquier perfil: se declara haber documentado riesgo de pérdida. El total debe ser positivo y la posición no puede superarlo.
- Si cambia el test, se desactiva su evaluación hasta reenviarlo. Si cambia el plan, se invalida la última comprobación. El reloj se consulta al comprobar, no mediante vigilancia en segundo plano.

Una espera local se puede eludir manipulando el reloj o localStorage y no se vincula a una orden concreta. No es un control antifraude ni de cumplimiento normativo. La última comprobación se exporta, pero el formulario no se restaura automáticamente desde ella al recargar.

## 6. Diseño UX/UI

La aplicación usa una cabecera de marca académica, una barra de datos locales y nueve pestañas numeradas. FIRE y jubilación se presentan dentro de una misma sección con dos alternativas explícitas: cartera sin pensión y cartera complementada con pensión. WikiEconomy centraliza las definiciones de los términos usados, sin sustituir las ayudas breves de cada formulario. La navegación no abandona la página ni borra el estado. En escritorio, formularios de balance y movimientos se muestran en dos columnas; en móvil se apilan. Se usa fondo claro, tarjetas blancas, teal para acción principal y azul/ámbar para escenarios.

| Pantalla | Jerarquía | Acción central |
|---|---|---|
| Mi balance | Periodo -> 8 tarjetas -> saldos/movimientos -> gráfico | Registrar o editar y comprobar capacidad de ahorro |
| FIRE y jubilación | FIRE: supuestos -> objetivo -> escenarios; jubilación: pensión -> capital necesario -> desacumulación | Comparar independencia financiera con una jubilación que incorpora ingresos y gastos |
| El valor del tiempo | Parámetros -> aportado/rendimientos -> oportunidad -> series | Comparar importes nominales y poder adquisitivo |
| Mis decisiones | Aviso -> test -> tres señales -> laboratorio | Convertir autorreflexión en fricciones concretas |

Flujo recomendado: cargar ejemplo o introducir saldos -> registrar movimientos -> traer inversión y flujo a FIRE -> revisar si el mes es representativo -> recalcular -> explorar coste de oportunidad -> completar test -> comprobar una decisión ficticia.

Accesibilidad: etiquetas visibles, controles HTML nativos, foco visible, enlace para saltar al contenido, mensajes con aria-live, navegación etiquetada, textos además de colores, tablas alternativas para los gráficos. El estado vacío invita a añadir datos o cargar el ejemplo. Los errores conservan el formulario. Al editar supuestos, un aviso aclara que los resultados visibles pertenecen al último cálculo hasta pulsar el botón.

## 7. Puesta en marcha y GitHub Pages

### Apertura local

1. Descomprimir el ZIP conservando todos los archivos juntos.
2. Abrir index.html en un navegador moderno con conexión a Internet para los recursos CDN. No necesita proceso de compilación.
3. Si el navegador restringe localStorage en archivos locales, usar la versión HTTPS de GitHub Pages. El guardado depende del origen: archivo local y sitio publicado no comparten datos.
4. Abrir tests.html para ejecutar las pruebas sin herramientas adicionales. Como alternativa, en un entorno con Node instalado: `node tests.js`.

### Despliegue

1. Crear un repositorio para la práctica en GitHub. No subir exportaciones con datos personales.
2. Subir los archivos del ZIP directamente a la raíz del repositorio, no la carpeta contenedora ni el propio ZIP. index.html debe quedar en la raíz. Incluir .nojekyll.
3. En Settings -> Pages -> Build and deployment elegir Deploy from a branch.
4. Seleccionar la rama main y la carpeta /(root), y guardar.
5. Cuando GitHub muestre la dirección publicada, abrirla y comprobar index.html y tests.html. No se proporciona una URL ficticia ni se ha publicado por el usuario.
6. Revisar a 360 px y en escritorio, comprobar los nueve apartados y el guardado tras recargar.

GitHub permite publicar desde una rama y su carpeta raíz o /docs. [GitHub Docs](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

Chart.js documenta la carga por CDN y la creación de gráficos a partir de un canvas y datos JavaScript. [Chart.js](https://www.chartjs.org/docs/latest/getting-started/)

### Seguridad y evolución

No se debe usar como banca online ni almacenar credenciales o identificadores sensibles. localStorage no está cifrado y el código cargado en el origen puede acceder a él. Se escapan textos introducidos por el usuario al construir tablas HTML y se valida la carga del estado. Si los datos locales no se pueden leer, no se sobrescriben automáticamente. Borrar datos solicita confirmación; no elimina copias descargadas.

Para evolucionar a un producto real: evaluación de privacidad y protección de datos, autenticación, autorización por fila, base de datos con migraciones, importación segura, copias restaurables, historial de saldos y decisiones, cifrado apropiado, dependencias autoalojadas, pruebas de extremo a extremo, tratamiento fiscal y un motor separado de desacumulación con riesgo de secuencia. No se afirma cumplimiento normativo por incorporar estas funciones.

## 8. Verificación y límites de pruebas

Se ejecutaron **46 pruebas del núcleo y módulos ampliados**, todas correctas. verification.json contiene los resultados. Se comprueban Fisher exacto, tasas cero y negativas, equivalencia mensual/anual, primer cruce FIRE, objetivo ya alcanzado, objetivo no alcanzado, retirada cero rechazada, fechas de jubilación incoherentes, independencia de coste de oportunidad, exclusión de transferencias, filtros mensuales, ratios indefinidos, puntuaciones invertidas, presupuestos, jubilación con pensión y conversión nominal-real, préstamo francés y TAE finita, ratios bancarios y scoring explicable.

Además de la suite de dominio, se hizo una comprobación funcional en navegador: navegación por los nueve apartados, envío de los formularios de cálculo, juego de decisiones, persistencia tras recargar y ausencia de `NaN`/`Infinity`. Esta comprobación no certifica todos los navegadores ni sustituye pruebas de extremo a extremo.

### Checklist manual antes de clase

1. Cargar ejemplo y comprobar 135.000 EUR de activos, 20.000 EUR de pasivos, 115.000 EUR netos y ratio 14,81%.
2. Comprobar ingresos 2.500 EUR, gastos 1.500 EUR y ahorro 1.000 EUR; la transferencia de 500 EUR no altera esos valores.
3. Añadir, editar y eliminar un saldo y un movimiento. Recargar y verificar persistencia. Filtrar otro mes: saldos iguales, flujos distintos.
4. Mantener los supuestos FIRE de inicio: 30 años, 30.000 EUR iniciales, 500 EUR/mes reales, gasto 1.500 EUR, retirada 4%, inflación 2%, rentabilidades 3/5/7%. Verificar los resultados de la tabla de demostración.
5. Pulsar Traer inversión y flujo: la aportación pasa a 1.000 EUR, pero los resultados no cambian hasta recalcular. No confundir este caso con la referencia de 500 EUR.
6. Probar cero retorno, rentabilidad negativa y cero aportación. No debe aparecer NaN ni infinito en casos admitidos. Un gasto FIRE de cero debe rechazarse.
7. En compuesto, 10.000 EUR iniciales, 200 EUR/mes, 5%, 2% inflación, 20 años: contrastar los totales de demostración.
8. Para perfil alto en todos los sesgos, contestar 5,5,1 en cada grupo. Comprobar puntuación 100, bloqueo por espera, argumento corto y concentración superior al 10%. Para una comprobación sin fricciones específicas, usar 1,1,5 en cada grupo y marcar la revisión de riesgos.
9. Exportar JSON y comprobar su contenido. Borrar los datos del navegador al terminar la demostración en un equipo compartido.
10. Navegar con teclado, móvil y zoom; comprobar las tablas alternativas si los gráficos no cargan. Abrir tests.html y comprobar las 46 pruebas.

## 9. Guion para exponer en clase

Duración orientativa: 7 minutos.

| Tiempo | Demostración | Mensaje financiero |
|---|---|---|
| 0:00-0:45 | Presentar el problema y abrir ejemplo | Un saldo bancario no describe por sí solo salud financiera |
| 0:45-2:00 | Balance, deuda y flujo mensual | Separación entre stock patrimonial y flujo; transferir no es gastar |
| 2:00-3:30 | FIRE con parámetros iniciales, antes de vincular el flujo | Retirada no es rentabilidad; Fisher exacto; escenarios sin garantías |
| 3:30-4:30 | Simulador compuesto y compra de 1.000 EUR | Aportaciones frente a rendimientos; euros nominales frente a reales |
| 4:30-6:15 | Test y laboratorio con perfil alto | El diferenciador transforma sesgos en pausas y comprobaciones |
| 6:15-7:00 | Pruebas, privacidad y límites | Un prototipo riguroso muestra también lo que no sabe |

### Cifras de contraste calculadas

FIRE: capital 30.000 EUR, ahorro real 500 EUR/mes, gasto 1.500 EUR/mes, retirada 4%, inflación 2%, edad 30. Objetivo: 450.000 EUR.

| Escenario nominal | Primer cruce | Edad estimada |
|---|---|---|
| Adverso: 3% | 51 años y 6 meses | 81 años y 6 meses |
| Central: 5% | 35 años y 3 meses | 65 años y 3 meses |
| Favorable: 7% | 27 años y 5 meses | 57 años y 5 meses |

Compuesto: 10.000 EUR iniciales + 200 EUR/mes nominales, 20 años, rentabilidad 5%, inflación 2%.

| Magnitud | Resultado |
|---|---|
| Capital inicial y aportaciones | 58.000,00 EUR |
| Rendimientos nominales | 49.693,87 EUR |
| Capital final nominal | 107.693,87 EUR |
| Capital final en euros actuales | 72.474,89 EUR |
| Valor futuro nominal de 1.000 EUR | 2.653,30 EUR |
| Ganancia nominal no obtenida por consumir esos 1.000 EUR | 1.653,30 EUR |
| Valor futuro de la compra en euros actuales | 1.785,59 EUR |

Cierre sugerido: "Horizonte no intenta adivinar el mercado. Ordena la situación de partida, hace explícitos los supuestos y añade disciplina antes de decidir. El valor del modelo está tanto en sus cálculos como en explicar sus límites."

## 10. Módulos financieros ampliados

La versión 2 conserva la clave `horizonte-v1` para no perder instalaciones existentes y migra raíces con `version: 1` al nuevo esquema (añade `budgets`, `retirement`, `loan`, `bank` y `credit`). No se introducen dependencias de compilación ni servidor.

* **Presupuesto mensual:** `Fin.monthlyBudgets({month, budgets, transactions})` agrupa gastos de caja por categoría, incluye categorías no presupuestadas y devuelve plan, real, desviación, saldo restante, ahorro y tasa de ahorro. `categoryBudgets` es un alias.
* **FIRE y jubilación:** FIRE calcula el objetivo sin pensión; `Fin.retirementProjection` calcula acumulación en euros reales, pensión, gasto, capital requerido (`(gasto-pensión)*12/tasa`) y tres desacumulaciones educativas. El botón «Copiar supuestos FIRE» permite comparar ambas alternativas. No modela impuestos, prestaciones legales, longevidad ni riesgo de secuencia.
* **Préstamo:** `Fin.loanAmortization` usa amortización francesa, separa principal/interés/comisión en cada cuota y estima la TAE mediante los flujos mensuales. Las comisiones opcionales son `upfrontFee`, `monthlyFee` y `otherFees`.
* **Banco:** `Fin.bankRatios` devuelve CET1, Tier 1, Tier 2, capital total, apalancamiento (`Tier 1 / activos totales`), depósitos/activos, LCR y NSFR. Los umbrales se pueden proporcionar en `thresholds`; las alertas son pedagógicas y no una evaluación supervisora.
* **Crédito empresarial:** `Fin.businessCreditScore` expone DSCR, márgenes, deuda/ingresos, liquidez, trayectoria, historial y sector mediante componentes ponderados con razones legibles. La banda mostrada no es un rating regulatorio ni una decisión automática y requiere revisión humana.

Todos los cálculos del dominio validan números finitos, rangos, denominadores y textos antes de operar. Las nuevas pantallas son accesibles, muestran tablas además de cualquier gráfico y guardan solo los supuestos introducidos en localStorage sin cifrar. Ejecuta `node tests.js` (o `tests.html`) para validar los módulos base y ampliados.
