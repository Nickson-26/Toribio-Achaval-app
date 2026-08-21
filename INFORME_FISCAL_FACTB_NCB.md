# INFORME FISCAL — FACT B y NC B
### Análisis read-only del impacto. Fase 0F.
**Fecha:** 20 de agosto de 2026
**Base analizada:** producción, 263 comprobantes (235 facturas no anuladas)
**Nada fue modificado.** Ni código de cálculo, ni datos.

---

## CONCLUSIÓN EN UNA LÍNEA

**No hay datos históricos mal guardados.** Los dos problemas son de cálculo en
pantalla, no de almacenamiento. Pero el de NC B **sí puede corromper datos
nuevos**, y conviene frenarlo.

| | FACT B | NC B |
|---|---|---|
| **A. Bug de cálculo / reporting** | Sí — subestima $47.690.061 | No aplica |
| **B. Datos históricos mal guardados** | **Ninguno (0 de 48)** | **Ninguno (0 de 1)** |
| **C. Puede corromper datos nuevos** | No | **Sí** |

---

# PARTE 1 — FACT B

## 1.1 Dónde se resta incorrectamente el 21%

**Archivo:** `src/pages/Dashboard.tsx`, función `toNeto`, líneas 50-59.

```js
50  const toNeto = (f: any) => {
51    if (f.monto_usd) {
52      if (!f.tipo_cambio) return 0
53      if (f.neto_usd) return Math.round(f.neto_usd * f.tipo_cambio * 100) / 100
54      return Math.round((f.monto_usd * f.tipo_cambio / 1.21) * 100) / 100   // ← FACT B en USD
55    }
56    if (f.neto_ars) return f.neto_ars
57    if (f.monto_ars) return Math.round((f.monto_ars / 1.21) * 100) / 100     // ← FACT B en ARS
58    return 0
59  }
```

La función **no mira `f.tipo`**. Su lógica es: "si no hay `neto_ars` guardado,
derivalo dividiendo el total por 1,21".

Esa premisa es correcta para Factura A, donde el neto existe y simplemente no
se cargó. **Es falsa para Factura B**, donde el IVA no se discrimina por
definición: el total facturado *es* el neto. Al dividir por 1,21 se le descuenta
un IVA que nunca existió.

Las 48 FACT B de producción tienen `neto_ars = NULL` (verificado: 48 de 48), así
que **todas** caen en la línea 57 o la 54.

**Un segundo defecto agrava el caso USD:** `db.getDashboardStats()`
(`src/lib/supabase.ts:192`) no incluye `neto_usd` en su `SELECT`. Por lo tanto la
rama de la línea 53 nunca se ejecuta en el Dashboard, y toda factura en dólares
—incluidas las 20 FACT B en USD— cae por la línea 54.

**Mismo defecto en el Informe PDF CFO:** `src/pages/Informe.tsx:31` replica la
misma cadena `/1.21`. El informe ejecutivo arrastra la misma subestimación.

## 1.2 ¿Afecta almacenamiento o solo visualización?

**Solo visualización y reporting.** Verificado contra producción:

```
FACT B con neto_ars o iva guardado (no deberían tener): 0
```

Las 48 FACT B tienen `neto_ars = NULL` e `iva = NULL`, que es **exactamente lo
correcto**. El alta de FACT B (`ComprobanteForms.tsx:140-149`) guarda solo
`monto_ars` y fuerza `neto_ars = null` e `iva = null`. Ese comportamiento está
bien.

El error aparece únicamente cuando el Dashboard y el Informe **derivan** el neto
al vuelo.

## 1.3 Cantidad y períodos afectados

| | |
|---|---|
| FACT B totales | **48** |
| Anuladas (excluidas del cálculo) | 12 |
| **Afectadas** | **36** |
| Período | 16/01/2026 – 12/08/2026 |
| De ellas, en USD | 20 |
| Universo de facturas no anuladas | 235 |

Todas caen en el ejercicio 2026.

## 1.4 Valor actual, valor correcto y diferencia

Neto de las FACT B no anuladas:

| Año | Cant. | Neto ACTUAL (con bug) | Neto CORRECTO | Diferencia |
|---|---:|---:|---:|---:|
| 2026 | 36 | $ 227.095.529,81 | $ 274.785.591,08 | **+$ 47.690.061,27** |

Las FACT B están **subestimadas exactamente un 21,00 %** sobre sí mismas —
consistente con dividir por 1,21 lo que no correspondía.

### Efecto sobre los totales que se ven en pantalla

| Métrica del Dashboard | Actual | Correcto | Desvío |
|---|---:|---:|---:|
| Facturado neto | $ 2.139.333.488,84 | $ 2.187.023.550,11 | **−$ 47.690.061,27 (−2,23 %)** |
| IVA estimado | $ 449.260.032,73 | $ 401.569.971,46 | **+$ 47.690.061,27 de IVA inexistente** |

El error es simétrico: lo que falta en el neto aparece inflando el IVA.

### Qué más se distorsiona

Todo lo que se calcula sobre `toNeto()`:

- gráfico de facturación neta mensual y acumulado anual;
- ranking de top clientes y de unidades de negocio (las unidades con más FACT B
  quedan artificialmente abajo);
- `%` de cobrado por monto;
- ticket promedio;
- comparativo interanual;
- reporte de quincenas de Consultoría;
- **Informe PDF CFO** completo.

## 1.5 Fix prospectivo propuesto

Una línea en `Dashboard.tsx` y otra en `Informe.tsx`:

```js
const toNeto = (f) => {
  // Factura B no discrimina IVA: el total facturado ES el neto.
  if (f.tipo === 'FACT B') {
    if (f.monto_usd) return f.tipo_cambio ? round2(f.monto_usd * f.tipo_cambio) : 0
    return f.monto_ars || 0
  }
  ... resto igual
}
```

Complementario, y de bajo riesgo: agregar `neto_usd` al `SELECT` de
`getDashboardStats()` para que la rama de la línea 53 deje de ser código muerto y
las facturas en USD usen su neto real en vez de derivarlo.

**No requiere tocar un solo dato.** Corrige la presentación desde el momento en
que se despliega.

> **Decisión pendiente tuya.** El cambio hace que el "Facturado neto" suba
> $47,7 M (+2,23 %) respecto de lo que se venía viendo. Si esos números ya se
> reportaron a dirección, conviene avisar antes de que el tablero cambie solo.

---

# PARTE 2 — NC B

## 2.1 Dónde se discrimina IVA incorrectamente

**Archivo:** `src/pages/OtherPages.tsx` — esta es la página de Notas de Crédito
que está **viva** en producción.

**Alta** (`NuevoNCModal`, líneas 525-529):

```js
525  useEffect(()=>{
526    const n=parseFloat(neto)
527    if(!isNaN(n)&&n>0){ setIva(String(Math.round(n*0.21*100)/100));
                          setArs(String(Math.round(n*1.21*100)/100)) }
528    else{setIva('');setArs('')}
529  },[neto])
```

**No hay ninguna condición sobre `tipo`.** El selector de la línea 555 ofrece
`NC A`, `NC B` y `NC FACT DE CREDITO`, y el campo "Neto ARS" (línea 565) se
muestra para los tres. Elegir `NC B` y cargar un neto calcula un IVA del 21 % y
un total inflado, que después se **persisten** en la línea 546:

```js
546  ...neto_ars: neto?parseFloat(neto):null, iva: iva?parseFloat(iva):null...
```

**Edición** (`EditarNCModal`, línea 585): mismo patrón, y además **corrompe al
abrir** — el `useEffect` corre en el montaje y pisa `iva` y `monto_ars` con
`neto*0.21` y `neto*1.21` aunque el usuario no toque nada. Abrir y guardar una
NC B existente le inventaría un 21 % de IVA.

### Detalle relevante

Existe un segundo archivo, `src/pages/NotasCredito.tsx` (324 líneas), que **sí
tiene el guard correcto** (`if (tipo === 'NC A')`, línea 172) y trata NC B sin
IVA. **Ese archivo es código muerto**: nadie lo importa. `src/app/page.tsx:13`
importa `NotasCredito` desde `OtherPages`, que es la versión sin guard.

Es una trampa: alguien que vaya a "arreglar el IVA de las NC" puede abrir el
archivo equivocado, arreglarlo, y no ver ningún cambio.

## 2.2 ¿Qué capas afecta?

| Capa | ¿Afectada? |
|---|---|
| Creación (formulario) | **Sí** — calcula 21 % para cualquier tipo |
| Almacenamiento | **Sí, potencialmente** — persiste `iva` y `neto_ars` |
| Edición | **Sí, y es peor** — corrompe con solo abrir el modal |
| Reportes | Indirectamente: `Informe.tsx:40` suma NC por `monto_ars`, que vendría inflado |

## 2.3 Cantidad, períodos e impacto agregado

| | |
|---|---|
| NC B en producción | **1** |
| NC FACT DE CREDITO | 0 |
| **Con IVA discriminado (mal)** | **0 de 1** |
| NC A (les corresponde IVA) | 6, las 6 con IVA — correcto |

```
NC B / NC FCE con IVA discriminado (no deberían): 0 de 1
```

**IVA actual: $0. IVA correcto: $0. Impacto agregado: $0.**

La única NC B existente no tiene IVA discriminado. O se cargó por otra vía, o
quien la cargó dejó el campo Neto vacío. El bug está armado pero **todavía no
disparó**.

## 2.4 Fix prospectivo propuesto

Condicionar el cálculo al tipo, igual que ya hace el archivo muerto:

```js
useEffect(()=>{
  if (tipo !== 'NC A') { setIva(''); return }   // NC B y NC FCE no discriminan IVA
  const n = parseFloat(neto)
  ...
}, [neto, tipo])
```

Y en el formulario, para `NC B` / `NC FACT DE CREDITO`, mostrar un único campo
"Total ARS" editable en lugar de Neto + IVA calculados — el mismo criterio que ya
usa el alta de FACT B.

**Prioridad más alta que el de FACT B**, porque este sí escribe en la base.

> ⚠ **Bloqueante independiente:** hoy **no se puede crear ninguna Nota de
> Crédito** en producción. La línea 546 inserta `factura_asociada_id`, columna
> que no existe en la base (`migration_nc_factura.sql` nunca se aplicó).
> Verificado contra producción: devuelve `PGRST204`. La migración de la Fase 0D
> lo corrige. Mientras no se aplique, el bug de NC B no puede materializarse —
> pero tampoco funciona la funcionalidad.

---

# RESUMEN PARA DECIDIR

## A. Bugs de cálculo / UI / reporting

| # | Qué | Dónde | Impacto |
|---|---|---|---|
| A1 | FACT B pierde 21 % al derivar el neto | `Dashboard.tsx:57` y `:54` | −$47.690.061 en el neto, +$47.690.061 en el IVA estimado |
| A2 | Ídem en el Informe PDF CFO | `Informe.tsx:31` | Mismo desvío en el informe ejecutivo |
| A3 | `neto_usd` no se trae del servidor → rama muerta | `supabase.ts:192` | Las facturas USD derivan el neto en vez de usar el real |
| A4 | NC B / NC FCE calculan IVA 21 % | `OtherPages.tsx:527` y `:585` | Aún sin efecto ($0), pero corromperá datos nuevos |

## B. Datos históricos mal almacenados

**Ninguno.**

```
FACT B con neto_ars o iva guardado : 0 de 48
NC B / NC FCE con IVA discriminado : 0 de 1
```

No hay nada que reparar hacia atrás. No hace falta una migración de datos ni
recalcular comprobantes emitidos.

## Recomendación

1. **Aplicar A4 ya** (NC B) — es el único que escribe en la base y hoy no tiene
   costo, porque no hay datos que arrastrar.
2. **Aplicar A1, A2 y A3 juntos**, avisando antes a quien consuma los reportes:
   el "Facturado neto" sube 2,23 %.
3. **Borrar `src/pages/NotasCredito.tsx`** (324 líneas muertas). Mientras exista,
   hay dos implementaciones de NC con reglas fiscales distintas y la correcta es
   la que no corre.
4. **No tocar datos históricos.** No hay ninguno mal.

Ninguno de los cuatro está aplicado. Quedan a la espera de tu aprobación.
