# Clasificación PROA — Canning

## La regla

```
TCN  →  PLAT. CANNING  →  EMPRENDIMIENTOS
```

Canning es una plataforma de **Emprendimientos**. No es Residencial, y no
puede estar en las dos.

Fuente única de verdad: **`src/lib/reservas.ts`**
(`UNIDAD_POR_PREFIJO`, `UNIDADES_EMPRENDIMIENTOS`, `categoriaDe()`).

## Qué estaba mal

Había **cuatro** definiciones de la clasificación y no coincidían entre sí:

| Archivo | Decía | Efecto |
|---|---|---|
| `api/reservas/sync-proa/route.ts` | `TCN → 'PLAT. CANNING'` | correcto |
| `api/reservas/import-excel/route.ts` | `TCN → 'RESIDENCIAL'` | **perdía la plataforma al importar** |
| `screens/Reservas.tsx` | `'PLAT. CANNING'` dentro de `RESIDENCIAL_UNIDADES` | **Canning contado como Residencial** |
| `api/reservas/export-sheets/route.ts` | idem | **el Sheets replicaba el error** |

Consecuencia: la categoría de una reserva dependía de por dónde había entrado
el dato, y Canning nunca aparecía en Emprendimientos.

Las cuatro ahora importan de `lib/reservas.ts`.

## Datos persistidos inconsistentes — NO se modificaron

Medido sobre las 147 reservas de producción:

- `unidad = 'PLAT. CANNING'` → **0 filas**. La unidad correcta nunca llegó a
  escribirse, porque el importador de Excel la aplanaba antes.
- `proa_codigo` que empieza con `TCN` → **4 filas**, todas guardadas con
  `unidad = 'RESIDENCIAL'`:

| id | proa_codigo | direccion | fecha |
|---|---|---|---|
| 2216 | `TCN\|Ruta 16, Lote 121` | Ruta 16, Lote 121 | 2026-08-11 |
| 2228 | `TCN\|VOLARE CANNING, Coronel Vicent` | VOLARE CANNING, Coronel Vicente Dupuy | 2026-08-06 |
| 2271 | `TCN 65443` | Barrio El Molino- Ruta 205 | 2026-05-14 |
| 2283 | `TCN 60967` | Caceres 1800 - HAVITA etapa 2 - Lote: 167 | 2026-02-13 |

**No se tocó ninguna fila.** La corrección es de clasificación derivada, como
corresponde: `categoriaDe()` mira la unidad guardada **y además** el prefijo
del código PROA, así que estas cuatro caen en Emprendimientos sin reescribir
la base.

El código PROA sólo puede **sumar** a Emprendimientos, nunca sacar una reserva
de la categoría que le da su unidad. Es deliberado: corrige el caso conocido
sin reacomodar en silencio filas que hoy están bien.

### Si se quisiera normalizar la base

Queda a criterio de Nico. El `UPDATE` sería:

```sql
update reservas
   set unidad = 'PLAT. CANNING'
 where upper(left(proa_codigo, 3)) = 'TCN'
   and unidad = 'RESIDENCIAL';
-- 4 filas
```

No hace falta para que la app clasifique bien: con la lógica corregida el
resultado es el mismo. Sirve sólo para que el dato crudo coincida con la
lectura.

## Tests

`scripts/test-reservas.ts` fija la regla en las dos direcciones:

- `TCN` → `PLAT. CANNING`
- `PLAT. CANNING` → `EMPRENDIMIENTOS`
- una reserva TCN aparece en Emprendimientos
- una reserva TCN **no** aparece en Residencial, ni siquiera guardada como `RESIDENCIAL`
- los conteos de las tres categorías suman el total y ninguna reserva cae en dos
- todos los prefijos de emprendimientos caen en Emprendimientos
- el código PROA no saca reservas de Comercial
