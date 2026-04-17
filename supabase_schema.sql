-- ============================================================
-- TORIBIO ACHAVAL — Schema + Datos iniciales
-- Ejecutar en Supabase → SQL Editor → New query → Run
-- ============================================================

-- Tabla principal de comprobantes
CREATE TABLE IF NOT EXISTS comprobantes (
  id           TEXT PRIMARY KEY,
  tipo         TEXT NOT NULL,
  numero       INTEGER,
  fecha        DATE NOT NULL,
  cliente      TEXT NOT NULL,
  persona      TEXT NOT NULL DEFAULT '',
  concepto     TEXT,
  monto_ars    NUMERIC(18,2),
  monto_usd    NUMERIC(14,4),
  tipo_cambio  NUMERIC(10,2),
  neto_ars     NUMERIC(18,2),
  neto_usd     NUMERIC(14,4),
  iva          NUMERIC(18,2),
  arba_ars     NUMERIC(18,2),
  arba_usd     NUMERIC(14,4),
  estado       TEXT NOT NULL DEFAULT 'pendiente'
               CHECK (estado IN ('pendiente','cobrada','anulada','emitida')),
  recibo_id    INTEGER,
  fecha_cobro  DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de recibos
CREATE TABLE IF NOT EXISTS recibos (
  id          INTEGER PRIMARY KEY,
  fecha       DATE NOT NULL,
  cliente     TEXT NOT NULL,
  nro_fact    TEXT,
  persona     TEXT NOT NULL DEFAULT '',
  monto_ars   NUMERIC(18,2),
  monto_usd   NUMERIC(14,4),
  forma_pago  TEXT,
  retencion   NUMERIC(18,2),
  nro_echeq   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_comp_fecha    ON comprobantes(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_comp_cliente  ON comprobantes(cliente);
CREATE INDEX IF NOT EXISTS idx_comp_persona  ON comprobantes(persona);
CREATE INDEX IF NOT EXISTS idx_comp_estado   ON comprobantes(estado);
CREATE INDEX IF NOT EXISTS idx_comp_tipo     ON comprobantes(tipo);
CREATE INDEX IF NOT EXISTS idx_recibos_fecha ON recibos(fecha DESC);

-- ============================================================
-- DATOS INICIALES — Facturas A
-- ============================================================
INSERT INTO comprobantes (id,tipo,numero,fecha,cliente,persona,concepto,monto_ars,monto_usd,tipo_cambio,neto_ars,iva,estado,recibo_id,fecha_cobro) VALUES
('FC-A-4056','FACT A',4056,'2026-01-05','INC S.A.','CONSULTORIA','Servicios inmobiliarios vinculados con la tasación de los inmuebles situados sobre la Av. Córdoba 3721 y Gallo 931 CABA',955900,NULL,NULL,790000,165900,'cobrada',19132,'2026-02-24'),
('FC-A-4057','FACT A',4057,'2026-01-06','REAL VIDEO SA','TORIBIO ACHAVAL','Asesoramiento realizado durante el tercer trimestre de 2025 sobre el fideicomiso Bariloche',115776254,NULL,NULL,95682855,20093399,'cobrada',19095,'2026-01-07'),
('FC-A-4058','FACT A',4058,'2026-01-07','GRASSI SA','COMERCIAL','Servicios inmobiliarios vinculados con la renovación de alquiler sito en Reconquista 522, Piso 2, CABA',735438,NULL,NULL,607800,127638,'cobrada',19100,'2026-01-13'),
('FC-A-4059','FACT A',4059,'2026-01-09','MICRO OMNIBUS NORTE S.A.','COMERCIAL','Servicios inmobiliarios vinculados con la locación de un inmueble sito en Colectora Oeste km 42 - Escobar',12603360,NULL,NULL,10416000,2187360,'cobrada',19098,'2026-01-12'),
('FC-A-4060','FACT A',4060,'2026-01-12','HITSS ARGENTINA S.A.','COMERCIAL','Servicios inmobiliarios vinculados con la locación sito en Paseo Colón 505, piso 2, CABA',12980880,NULL,NULL,10728000,2252880,'cobrada',19105,'2026-01-20'),
('FC-A-4061','FACT A',4061,'2026-01-13','PAPASITOS SA','COMERCIAL','Asesoramiento inmobiliario',NULL,30250,1490,25000,5250,'cobrada',19106,'2026-01-20'),
('FC-A-4062','FACT A',4062,'2026-01-14','TRANSGESTIONA SA','COMERCIAL','Servicios inmobiliarios vinculados a la locación de un inmueble sito en Paraguay 1462, piso 8. CABA',5479848,NULL,NULL,4528800,951048,'pendiente',NULL,NULL),
('FC-A-4063','FACT A',4063,'2026-01-14','V. OBLIGADO 4482 SRL','EMPRENDIMIENTOS','Asesoramiento inmobiliario',2040423,NULL,NULL,1686300,354123,'cobrada',19102,'2026-01-16'),
('FC-A-4064','FACT A',4064,'2026-01-14','ANULADO','',NULL,NULL,NULL,NULL,NULL,NULL,'anulada',NULL,NULL),
('FC-A-4065','FACT A',4065,'2026-01-16','MAGNASCO BROKERS SRL','TORIBIO ACHAVAL','Servicios vinculados con la derivación de contactos comerciales y promoción de negocios',13734008,NULL,NULL,11350420,2383588,'cobrada',19103,'2026-01-19'),
('FC-A-4066','FACT A',4066,'2026-01-16','ANULADO','',NULL,NULL,NULL,NULL,NULL,NULL,'anulada',NULL,NULL),
('FC-A-4067','FACT A',4067,'2026-01-16','ANULADO','',NULL,NULL,NULL,NULL,NULL,NULL,'anulada',NULL,NULL),
('FC-A-4068','FACT A',4068,'2026-01-19','SADELSA SA','COMERCIAL','Asesoramiento inmobiliario',10105254.5,NULL,NULL,8351450,1753804.5,'cobrada',19126,'2026-02-20'),
('FC-A-4069','FACT A',4069,'2026-01-21','E.A. BALBI E HIJOS SA','COMERCIAL','Asesoramiento inmobiliario',20232410,NULL,NULL,16721000,3511410,'cobrada',19117,'2026-01-28'),
('FC-A-4070','FACT A',4070,'2026-01-21','MSMTECH SRL','COMERCIAL','Asesoramiento inmobiliario',36418338,NULL,NULL,30097800,6320538,'cobrada',19110,'2026-01-22'),
('FC-A-4071','FACT A',4071,'2026-01-22','ALLARIA RESIDENCIAL','CONSULTORIA','Servicios inmobiliarios vinculados con la tasación de un inmueble en CABA',786500,NULL,NULL,650000,136500,'cobrada',19115,'2026-01-28'),
('FC-A-4072','FACT A',4072,'2026-01-23','CENCOSUD SA','CONSULTORIA','Servicios inmobiliarios vinculados con la tasación de un inmueble en la ciudad de Godoy Cruz',1754500,NULL,NULL,1450000,304500,'cobrada',19136,'2026-03-02'),
('FC-A-4073','FACT A',4073,'2026-01-26','ARRIETA FIOTTO SA','TORIBIO ACHAVAL','Asesoramiento inmobiliario. Estudio de mercado polo petroquímico Bahía Blanca',4840000,NULL,NULL,4000000,840000,'cobrada',19114,'2026-01-26'),
('FC-A-4074','FACT A',4074,'2026-01-05','INC S.A.','CONSULTORIA','Servicios inmobiliarios vinculados con la retasación de un inmueble sobre la calle Charcas 4367 PB, CABA',477950,NULL,NULL,395000,82950,'cobrada',19144,'2026-03-16'),
('FC-A-4075','FACT A',4075,'2026-01-28','FIDEICOMISO LAS HERAS 2191','TORIBIO ACHAVAL','Servicios inmobiliarios vinculados con la venta de un departamento sito en Av. Las Heras 2191 8C',NULL,2081.2,1470,NULL,361.2,'pendiente',NULL,NULL),
('FC-A-4076','FACT A',4076,'2026-02-03','TECBUS SA','COMERCIAL','Servicios inmobiliarios vinculados con la locación de un inmueble',19847676,NULL,NULL,16403040,3444636,'cobrada',19120,'2026-02-06'),
('FC-A-4077','FACT A',4077,'2026-02-04','MOLINOS RIO DE LA PLATA','COMERCIAL','Asesoramiento inmobiliario',43200000,NULL,NULL,35700000,7500000,'cobrada',19122,'2026-02-10'),
('FC-A-4078','FACT A',4078,'2026-02-11','INVERSORA DEL NORTE SA','COMERCIAL','Servicios inmobiliarios vinculados con la locación de un inmueble',18847676,NULL,NULL,15990500,2857176,'cobrada',19123,'2026-02-14'),
('FC-A-4079','FACT A',4079,'2026-02-14','SAMSUNG ELECTRONICS ARGENTINA','CONSULTORIA','Servicios inmobiliarios vinculados con la tasación de un inmueble',5677600,NULL,NULL,4693900,983700,'cobrada',19111,'2026-01-23'),
('FC-A-4080','FACT A',4080,'2026-02-19','SUTERH','CONSULTORIA','Servicios inmobiliarios vinculados con la tasación de un inmueble en la ciudad de La Falda',3509000,NULL,NULL,2900000,609000,'pendiente',NULL,NULL),
('FC-A-4081','FACT A',4081,'2026-02-26','LA EXTREMA SRL','TORIBIO ACHAVAL','Honorarios cuota fija mensual',6180000,NULL,NULL,5107438,1072562,'cobrada',19128,'2026-02-27'),
('FC-A-4082','FACT A',4082,'2026-03-02','AIGRE SA','CONSULTORIA','Asesoramiento inmobiliario',606480,NULL,NULL,501223,105257,'cobrada',19135,'2026-03-02'),
('FC-A-4083','FACT A',4083,'2026-03-10','CENCOSUD SA','CONSULTORIA','Servicios inmobiliarios vinculados con la tasación de inmuebles',1885600,NULL,NULL,1558347,327253,'cobrada',19141,'2026-03-12'),
('FC-A-4084','FACT A',4084,'2026-03-14','REAL VIDEO SA','TORIBIO ACHAVAL','Asesoramiento sobre el fideicomiso Bariloche - 4to trimestre 2025',92491218,NULL,NULL,76439851,16051367,'cobrada',19143,'2026-03-16'),
('FC-A-4085','FACT A',4085,'2026-03-20','INC S.A.','CONSULTORIA','Servicios inmobiliarios tasación',544500,NULL,NULL,450000,94500,'cobrada',19148,'2026-03-24'),
('FC-A-4086','FACT A',4086,'2026-04-08','MSM TECH SRL','COMERCIAL','Asesoramiento inmobiliario renovación contrato',10150000,NULL,NULL,8388430,1761570,'cobrada',19158,'2026-04-09')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DATOS INICIALES — Facturas B
-- ============================================================
INSERT INTO comprobantes (id,tipo,numero,fecha,cliente,persona,concepto,monto_ars,monto_usd,tipo_cambio,estado,recibo_id,fecha_cobro) VALUES
('FC-B-4062','FACT B',4062,'2026-01-16','RUSCONI MARIA CECILIA','PLAT. BELGRANO','Servicios inmobiliarios vinculados a la compra de un inmueble sito en Matienzo 1724 3B, CABA',NULL,3200,1455,'pendiente',NULL,NULL),
('FC-B-4066','FACT B',4066,'2026-01-23','VIANO CARLOMAGNO MARIA','CONSULTORIA','Servicios inmobiliarios vinculados con la tasación de un inmueble en CABA',1185800,NULL,NULL,'cobrada',19112,'2026-01-23'),
('FC-B-4067','FACT B',4067,'2026-02-09','SUTERH','CONSULTORIA','Servicios inmobiliarios vinculados con la tasación de un inmueble en CABA',1185800,NULL,NULL,'cobrada',19155,'2026-04-30'),
('FC-B-4068','FACT B',4068,'2026-02-11','SUTERH','CONSULTORIA','Servicios inmobiliarios vinculados con la tasación de un edificio en la Ciudad de Buenos Aires',1996500,NULL,NULL,'cobrada',19160,'2026-04-15'),
('FC-B-4069','FACT B',4069,'2026-02-18','SUTERH','CONSULTORIA','Servicios inmobiliarios vinculados con la tasación de un inmueble en la ciudad de La Falda',3509000,NULL,NULL,'pendiente',NULL,NULL),
('FC-B-4070','FACT B',4070,'2026-02-26','EMBAJADA DE GRECIA','CONSULTORIA','Servicios inmobiliarios vinculados con la tasación de un inmueble en la ciudad de Buenos Aires',2964500,NULL,NULL,'cobrada',19134,'2026-02-26'),
('FC-B-4071','FACT B',4071,'2026-03-25','CORONEL SUPERI SA','PLAT. PALERMO','Asesoramiento inmobiliario',NULL,30492,1400,'cobrada',19153,'2026-03-30'),
('FC-B-4072','FACT B',4072,'2026-04-06','TRIPALDI DIEGO JAVIER','PLAT. PALERMO','Asesoramiento inmobiliario',NULL,1815,1415,'cobrada',19157,'2026-04-07'),
('FC-B-4073','FACT B',4073,'2026-04-14','ACARA','CONSULTORIA','Servicios inmobiliarios vinculados con la tasación de inmueble en CABA',423500,NULL,NULL,'pendiente',NULL,NULL),
('FC-B-4074','FACT B',4074,'2026-04-16','DAMIÁN ATTADÍA','CONSULTORIA','Servicios inmobiliarios vinculados con la tasación de dos inmuebles en la ciudad de Buenos Aires',1331000,NULL,NULL,'cobrada',19161,'2026-04-16')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DATOS INICIALES — Facturas de Crédito
-- ============================================================
INSERT INTO comprobantes (id,tipo,numero,fecha,cliente,persona,concepto,monto_ars,neto_ars,iva,estado,recibo_id,fecha_cobro) VALUES
('FC-FC-144','FACT DE CREDITO',144,'2026-01-09','COVELIA S.A.','COMERCIAL','Servicios inmobiliarios vinculados con la locación de un inmueble sito en Colectora Oeste km 42 - Escobar',22686048,18748800,3937248,'cobrada',19130,'2026-02-24'),
('FC-FC-147','FACT DE CREDITO',147,'2026-03-10','METROGAS SA','COMERCIAL','Asesoramiento inmobiliario',88935000,73500000,15435000,'cobrada',19140,'2026-03-11')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DATOS INICIALES — Factura E
-- ============================================================
INSERT INTO comprobantes (id,tipo,numero,fecha,cliente,persona,concepto,monto_usd,tipo_cambio,neto_usd,iva,estado,recibo_id,fecha_cobro) VALUES
('FC-E-5','FACT E',5,'2026-01-14','MARISMA SA','TORIBIO ACHAVAL','Contraprestación según Art. 5 del contrato de Licencia de Marca celebrado el 5/12/2022. Período 7/2025 a 11/2025',19968.77,1451,19968.77,0,'cobrada',19101,'2026-01-14')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DATOS INICIALES — Notas de Crédito
-- ============================================================
INSERT INTO comprobantes (id,tipo,numero,fecha,cliente,persona,concepto,monto_ars,monto_usd,neto_ars,iva,estado) VALUES
('NC-A-423','NC A',423,'2026-01-16','RUSCONI MARIA CECILIA','PLAT. BELGRANO','Servicios inmobiliarios vinculados a la compra de un inmueble sito en Matienzo 1724 3B',NULL,3872,3200,672,'emitida'),
('NC-A-425','NC A',425,'2026-01-22','SADELSA SA','COMERCIAL','Nota de crédito - Factura A 4068',10104250,NULL,8351450,1753804,'emitida'),
('NC-A-426','NC A',426,'2026-02-11','SUTERH','CONSULTORIA','Nota de crédito - Factura B 4068',1996500,NULL,1650000,346500,'emitida'),
('NC-A-427','NC A',427,'2026-02-13','TECBUS SA','COMERCIAL','NC FACT 4090',16504646,NULL,13640204,2864442,'emitida'),
('NC-A-428','NC A',428,'2026-02-13','INVERSORA DEL NORTE SA','COMERCIAL','NC FACT 4091',15587413,NULL,12882160,2705253,'emitida'),
('NC-B-411','NC B',411,'2026-01-16','RUSCONI MARIA CECILIA','PLAT. BELGRANO','Nota de crédito FC B 4062',3872,NULL,NULL,NULL,'emitida')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DATOS INICIALES — Recibos
-- ============================================================
INSERT INTO recibos (id,fecha,cliente,nro_fact,persona,monto_ars,monto_usd,forma_pago) VALUES
(19095,'2026-01-07','REAL VIDEO SA','4057','TORIBIO ACHAVAL',115776254,NULL,'transferencia'),
(19096,'2026-01-07','AIGRE SA','4055','CONSULTORIA',544500,NULL,'transferencia'),
(19097,'2026-01-12','LA EXTREMA SRL','3971','TORIBIO ACHAVAL',5910743,NULL,'transferencia'),
(19098,'2026-01-12','MICRO OMNIBUS NORTE S.A.','4059','COMERCIAL',12603360,NULL,'transferencia'),
(19099,'2026-01-13','INC SA','4017','CONSULTORIA',544500,NULL,'transferencia'),
(19100,'2026-01-13','GRASSI SA','4058','COMERCIAL',735438,NULL,'transferencia'),
(19101,'2026-01-14','MARISMA SA','FC-E-5','TORIBIO ACHAVAL',NULL,19968.77,'transferencia'),
(19102,'2026-01-16','V. OBLIGADO 4482 SRL','4063','EMPRENDIMIENTOS',2040423,NULL,'transferencia'),
(19103,'2026-01-19','MAGNASCO BROKERS SRL','4065','TORIBIO ACHAVAL',13734008,NULL,'transferencia'),
(19104,'2026-01-20','LABORATORIO ALEF MEDICAL ARGENTINA SA','4049','CONSULTORIA',399300,NULL,'transferencia'),
(19105,'2026-01-20','HITSS ARGENTINA SA','4060','COMERCIAL',12980880,NULL,'transferencia'),
(19106,'2026-01-20','PAPASITOS SA','4061','COMERCIAL',45328843,NULL,'transferencia'),
(19107,'2026-01-21','MARISMA SA','FC-E-5','TORIBIO ACHAVAL',NULL,19968.77,'transferencia'),
(19108,'2026-01-21','LA EXTREMA SRL','3971','TORIBIO ACHAVAL',6030000,NULL,'transferencia'),
(19110,'2026-01-22','MSM TECH SRL','4070','COMERCIAL',36418228,NULL,'transferencia'),
(19111,'2026-01-23','SAMSUNG ELECTRONICS ARGENTINA','4079','CONSULTORIA',4685120,NULL,'transferencia'),
(19112,'2026-01-23','VIANO CARLOMAGNO MARIA','FC-B-4066','CONSULTORIA',1185800,NULL,'transferencia'),
(19113,'2026-01-23','CENCOSUD SA','4033','CONSULTORIA',907500,NULL,'transferencia'),
(19114,'2026-01-26','ARRIETA FIOTTO SA','4073','TORIBIO ACHAVAL',4840000,NULL,'transferencia'),
(19115,'2026-01-28','ALLARIA RESIDENCIAL','4071','CONSULTORIA',786500,NULL,'transferencia'),
(19117,'2026-01-28','E.A. BALBI E HIJOS SA','4069','COMERCIAL',20232410,NULL,'transferencia'),
(19120,'2026-02-06','TECBUS SA','4076','COMERCIAL',19847676,NULL,'transferencia'),
(19122,'2026-02-10','MOLINOS RIO DE LA PLATA','4077','COMERCIAL',43200000,NULL,'transferencia'),
(19123,'2026-02-14','INVERSORA DEL NORTE SA','4078','COMERCIAL',18847676,NULL,'transferencia'),
(19126,'2026-02-20','SADELSA SA','4068','COMERCIAL',10105254,NULL,'transferencia'),
(19128,'2026-02-27','LA EXTREMA SRL','4081','TORIBIO ACHAVAL',6180000,NULL,'transferencia'),
(19130,'2026-02-24','COVELIA S.A.','FC-FC-144','COMERCIAL',22686048,NULL,'transferencia'),
(19134,'2026-02-26','EMBAJADA DE GRECIA','FC-B-4070','CONSULTORIA',2964500,NULL,'transferencia'),
(19135,'2026-03-02','AIGRE SA','4082','CONSULTORIA',606480,NULL,'transferencia'),
(19136,'2026-03-02','CENCOSUD SA','4072','CONSULTORIA',1754500,NULL,'transferencia'),
(19140,'2026-03-11','METROGAS SA','FC-FC-147','COMERCIAL',88935000,NULL,'transferencia'),
(19141,'2026-03-12','CENCOSUD SA','4083','CONSULTORIA',1885600,NULL,'transferencia'),
(19143,'2026-03-16','REAL VIDEO SA','4084','TORIBIO ACHAVAL',92491218,NULL,'transferencia'),
(19144,'2026-03-16','INC S.A.','4074','CONSULTORIA',477950,NULL,'transferencia'),
(19148,'2026-03-24','INC S.A.','4085','CONSULTORIA',544500,NULL,'transferencia'),
(19153,'2026-03-30','CORONEL SUPERI SA','FC-B-4071','PLAT. PALERMO',42688800,NULL,'transferencia'),
(19155,'2026-04-30','SUTERH','FC-B-4067','CONSULTORIA',1185800,NULL,'transferencia'),
(19157,'2026-04-07','TRIPALDI DIEGO JAVIER','FC-B-4072','PLAT. PALERMO',2567325,NULL,'transferencia'),
(19158,'2026-04-09','MSM TECH SRL','4086','COMERCIAL',10150000,NULL,'transferencia'),
(19160,'2026-04-15','SUTERH','FC-B-4068','CONSULTORIA',1996500,NULL,'transferencia'),
(19161,'2026-04-16','DAMIÁN ATTADÍA','FC-B-4074','CONSULTORIA',1331000,NULL,'transferencia')
ON CONFLICT (id) DO NOTHING;
