import type { ComponentType } from 'react'
import type { RouteId } from './navigation'

import Inicio    from '@/screens/Inicio'
import Facturas  from '@/screens/Facturas'
import Usuarios  from '@/screens/Usuarios'
import Informe   from '@/screens/Informe'
import Reservas  from '@/screens/Reservas'
import { Recibos, Clientes, NotasCredito, NotasDebito } from '@/screens/OtherPages'

/**
 * Qué componente renderiza cada destino.
 *
 * Se mantiene aparte de `navigation.ts` a propósito: ese módulo describe el
 * grafo de navegación y no debe arrastrar componentes de React, para poder
 * importarlo desde código no visual (tests, serialización de URLs, el futuro
 * command palette).
 *
 * Nota sobre `src/screens/`
 * -------------------------
 * Este directorio se llamaba `src/pages/`, que en Next.js es un nombre mágico:
 * el Pages Router publicaba cada archivo como una ruta. Eso exponía
 * /Facturas, /Usuarios, /Informe y 8 más como páginas públicas, FUERA del
 * muro de autenticación de `app/page.tsx`. Verificado en producción antes del
 * cambio: https://…/Usuarios respondía 200 y renderizaba la pantalla de
 * administración de usuarios sin sesión.
 *
 * No hubo fuga de datos porque RLS bloquea las consultas sin sesión, pero eran
 * 11 rutas no intencionales y una segunda superficie de ataque. Renombrar el
 * directorio las elimina.
 */
export const SCREENS: Record<RouteId, ComponentType<any>> = {
  inicio:   Inicio,
  facturas: Facturas,
  recibos:  Recibos,
  clientes: Clientes,
  nc:       NotasCredito,
  nd:       NotasDebito,
  reservas: Reservas,
  informe:  Informe,
  usuarios: Usuarios,
}
