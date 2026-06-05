-- Borra las filas de totales que se importaron por error
DELETE FROM reservas
WHERE proa_codigo ILIKE 'Total%'
   OR direccion   ILIKE 'Total%';
