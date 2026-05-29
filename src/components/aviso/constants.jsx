export const BROKERS = [
  'Martin Garcia','Sofia Lopez','Ignacio Fernandez','Valentina Ruiz',
  'Tomas Martinez','Lucia Herrera','Federico Diaz','Camila Peralta',
  'Nicolas Romero','Agustina Castro','Matias Morales','Julieta Sanchez',
  'Rodrigo Vega','Florencia Acosta','Santiago Beltran','Emilia Torres',
  'Leandro Rios','Mariana Suarez','German Ibanez','Paula Dominguez'
];
export const PLATAFORMAS = {
  residencial: ['Palermo','Caballito','Belgrano','Recoleta','Pilar','Dpto. de Busqueda'],
  comercial: ['Consultoria','Locales y Terrenos','Oficinas y Edificios','Industria'],
  emprendimientos: ['Emprendimientos','Plataforma Canning']
};
export const TIPOS_OP = {
  residencial: ['Venta','Alquiler'],
  comercial: ['Venta','Alquiler','Consultoria / Tasacion'],
  emprendimientos: ['Venta','Alquiler']
};
export const TIPOS_INMUEBLE = {
  residencial: ['Departamento','PH','Casa'],
  comercial: ['Edificio en block','Local','Terreno','Oficina','Deposito'],
  emprendimientos: ['Lote','Departamento']
};
export const PROA_DB = {
  'PROA-001': { dir: 'Av. Santa Fe 2500, Palermo, CABA', m2: 85, reserva: 50000 },
  'PROA-002': { dir: 'Av. Cordoba 1200, Belgrano, CABA', m2: 65, reserva: 30000 },
  'PROA-003': { dir: 'Av. Rivadavia 5000, Caballito, CABA', m2: 72, reserva: 25000 },
  'PROA-004': { dir: 'Libertador 4500, Recoleta, CABA', m2: 120, reserva: 80000 },
  'PROA-005': { dir: 'Panamericana km 45, Pilar, GBA', m2: 200, reserva: 0 }
};
export const NON_PAID = ['referido','proactividad','cliente','firma','colega_ext'];
export const CANAL_LABELS = {
  zonaprop: 'Zonaprop', web: 'Web Toribio Achaval', mercadolibre: 'Mercado Libre',
  argenprop: 'ArgenProp', google_ads: 'Google Ads', cartel: 'Cartel',
  email_mkt: 'Email Marketing', visita: 'Visita Sucursal',
  referido: 'Referido', proactividad: 'Proactividad', cliente: 'Cliente',
  firma: 'Firma', colega_ext: 'Colega'
};
export function slug(s) {
  return s.toLowerCase().replace(/\s+\/\s+/g,'_').replace(/\s+/g,'_');
}
export function fmtUSD(n) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
