-- Borra TODOS los datos de reservas, la tabla queda vacia.
-- La estructura (columnas, indices) se mantiene para poder re-importar.

TRUNCATE TABLE reservas RESTART IDENTITY;
