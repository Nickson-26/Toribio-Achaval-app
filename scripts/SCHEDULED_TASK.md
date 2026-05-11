# Scheduled task — Import automático de reservas

Este archivo es el **prompt** que debe ejecutar la scheduled task de Cowork
cada N horas para procesar mails nuevos de "Nueva Reserva".

## Setup en Cowork

1. Cowork → Scheduled Tasks → Create
2. **Frequency**: cada 1 hora (o el intervalo que prefieras)
3. **Prompt**: copiar el bloque de abajo

## Prompt

```
Procesá los mails nuevos de "Nueva Reserva" del último día y cargalos a la
tabla reservas en Supabase. Pasos:

1. Buscá en Gmail con esta query:
   subject:"Nueva Reserva" newer_than:2d -label:procesado-reservas
   (page_size=50)

2. Para cada thread, armá un objeto:
   { "messageId": <thread.id>,
     "subject":   <message.subject>,
     "snippet":   <message.snippet>,
     "dateIso":   <message.date> }

3. Si no hay mails nuevos, terminá con "Sin reservas nuevas para procesar."

4. Si hay mails, escribí el array completo a /tmp/reservas-batch.json y
   ejecutá:
       cd /sessions/<session>/mnt/ta-app && \
       IMPORT_SECRET=<el-secret-configurado> \
       IMPORT_URL=https://ta-app-toribio-achaval.vercel.app/api/reservas/import \
       node scripts/import-reservas.mjs < /tmp/reservas-batch.json

5. Después de procesar:
   - Para cada thread procesado con éxito (status=inserted o status=skipped),
     aplicar el label "procesado-reservas" en Gmail (crear el label si no
     existe).
   - Para los que dieron parser_skipped (ej. "indirecta_sin_mapping_..."),
     aplicar el label "reservas-revisar".

6. Reportar al final:
   - Total procesados
   - Insertados / Duplicados / Errores / Para revisar
   - Lista de los "para revisar" con motivo
```

## Notas

- El endpoint es **idempotente**: si el job se corre dos veces sobre el
  mismo mail, la segunda inserción devuelve `status=skipped`. El label
  `procesado-reservas` es solo una optimización para no re-procesar.
- El parser **skipea** los mails "Indirecta" cuyo broker no esté en
  `INDIRECTA_BROKER_TO_UNIDAD`. Hay que revisarlos a mano hasta que se
  complete el mapeo en `scripts/parse-reserva-email.mjs`.
- Las reservas insertadas entran con `firmo='PENDIENTE'`. Cuando se firme,
  se marca a mano desde la UI.
