'use client'
import { useState } from 'react'
import { db } from '@/lib/supabase'
import { ars, usd, MESES } from '@/lib/utils'
import { Spinner, toast } from '@/components/ui'

export default function Informe(_: any) {
  const [desde,   setDesde]   = useState('2026-01-01')
  const [hasta,   setHasta]   = useState(new Date().toISOString().slice(0,10))
  const [loading, setLoading] = useState(false)

  async function generarPDF() {
    setLoading(true)
    try {
      const all = await db.getDashboardStats()
      const comp: any[] = all.comprobantes || []

      const facts = comp.filter((c: any) => {
        if (!c.tipo?.startsWith('FACT') || c.estado === 'anulada') return false
        if (c.fecha < desde || c.fecha > hasta) return false
        return true
      })

      const ncs = comp.filter((c: any) => {
        if (!c.tipo?.startsWith('NC')) return false
        if (c.fecha < desde || c.fecha > hasta) return false
        return true
      })

      const toARS = (f: any) => f.monto_ars || (f.monto_usd && f.tipo_cambio ? f.monto_usd * f.tipo_cambio : 0)
      const toNeto = (f: any) => f.neto_ars || (f.neto_usd && f.tipo_cambio ? f.neto_usd * f.tipo_cambio : (f.monto_ars ? f.monto_ars / 1.21 : (f.monto_usd && f.tipo_cambio ? (f.monto_usd * f.tipo_cambio) / 1.21 : 0)))

      const totalBrutoARS = facts.reduce((s: number, f: any) => s + toARS(f), 0)
      const totalNetoARS  = facts.reduce((s: number, f: any) => s + toNeto(f), 0)
      const totalIVA      = totalBrutoARS - totalNetoARS
      const totalUSD      = facts.filter((f: any) => f.monto_usd).reduce((s: number, f: any) => s + (f.monto_usd || 0), 0)
      const cobradas      = facts.filter((f: any) => f.estado === 'cobrada').length
      const pendCount     = facts.filter((f: any) => f.estado === 'pendiente').length
      const montoPend     = facts.filter((f: any) => f.estado === 'pendiente').reduce((s: number, f: any) => s + toNeto(f), 0)
      const totalNC       = ncs.reduce((s: number, f: any) => s + (f.monto_ars || 0), 0)
      const netoReal      = totalNetoARS - totalNC
      const pctCobrado    = facts.length ? Math.round((cobradas / facts.length) * 100) : 0

      // By unidad
      const byUnidad: Record<string, number> = {}
      facts.forEach((f: any) => { byUnidad[f.persona] = (byUnidad[f.persona] || 0) + toNeto(f) })
      const unidadEntries = Object.entries(byUnidad).sort((a, b) => b[1] - a[1])

      // By mes
      const byMes: Record<string, number> = {}
      facts.forEach((f: any) => {
        const k = f.fecha?.slice(0, 7)
        if (k) byMes[k] = (byMes[k] || 0) + toNeto(f)
      })
      const mesEntries = Object.entries(byMes).sort()

      // Top clientes
      const byCliente: Record<string, number> = {}
      facts.forEach((f: any) => { byCliente[f.cliente] = (byCliente[f.cliente] || 0) + toNeto(f) })
      const topClientes = Object.entries(byCliente).sort((a, b) => b[1] - a[1]).slice(0, 8)

      // Trend analysis
      const mesMonto = mesEntries.map(([,v]) => v)
      const mesMax = Math.max(...mesMonto, 1)
      const mesProm = mesMonto.length ? mesMonto.reduce((a,b)=>a+b,0)/mesMonto.length : 0
      const ultimoMes = mesMonto[mesMonto.length - 1] || 0
      const tendencia = ultimoMes > mesProm ? 'creciente' : ultimoMes < mesProm * 0.8 ? 'por debajo del promedio' : 'estable'
      const unidadLider = unidadEntries[0]?.[0] || '—'
      const unidadPct = totalNetoARS > 0 ? Math.round((unidadEntries[0]?.[1] || 0) / totalNetoARS * 100) : 0
      const clienteLider = topClientes[0]?.[0] || '—'
      const clientePct = totalNetoARS > 0 ? Math.round((topClientes[0]?.[1] || 0) / totalNetoARS * 100) : 0

      const today = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
      const periodoLabel = `${new Date(desde+'T00:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'})} al ${new Date(hasta+'T00:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'})}`

      const barMaxW = 300

      const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background:#fff; color:#1a1a1a; font-size:11pt; }
  @page { margin: 18mm 20mm; size: A4; }
  
  .cover { background: #111; color:#fff; padding:60px 50px; min-height:240px; position:relative; }
  .cover-logo { font-size:13pt; font-weight:700; color:#C8102E; letter-spacing:1px; margin-bottom:6px; }
  .cover-title { font-size:26pt; font-weight:700; color:#fff; margin-bottom:8px; line-height:1.2; }
  .cover-sub { font-size:12pt; color:#aaa; margin-bottom:20px; }
  .cover-periodo { display:inline-block; background:rgba(200,16,46,0.2); border:1px solid #C8102E; color:#ff8899; padding:6px 16px; border-radius:4px; font-size:10pt; }
  .cover-date { position:absolute; bottom:24px; right:50px; font-size:9pt; color:#666; }
  .cover-line { position:absolute; bottom:0; left:0; right:0; height:3px; background:#C8102E; }

  .section { padding:24px 0 0; page-break-inside:avoid; }
  .section-title { font-size:13pt; font-weight:700; color:#C8102E; border-bottom:2px solid #C8102E; padding-bottom:6px; margin-bottom:16px; }
  
  .kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px; }
  .kpi { border:1px solid #e5e5e5; border-radius:6px; padding:14px; text-align:center; }
  .kpi.accent { border-color:#C8102E; background:#fff8f8; }
  .kpi-label { font-size:8pt; color:#888; text-transform:uppercase; letter-spacing:.5px; margin-bottom:6px; font-weight:600; }
  .kpi-value { font-size:14pt; font-weight:700; color:#1a1a1a; }
  .kpi.accent .kpi-value { color:#C8102E; }
  .kpi-sub { font-size:8pt; color:#aaa; margin-top:4px; }

  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px; }
  .card { border:1px solid #e5e5e5; border-radius:6px; padding:16px; }
  .card-title { font-size:10pt; font-weight:700; color:#333; margin-bottom:12px; border-bottom:1px solid #eee; padding-bottom:6px; }

  .bar-row { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
  .bar-label { font-size:9pt; color:#555; min-width:100px; max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .bar-track { flex:1; background:#f5f5f5; border-radius:2px; height:8px; }
  .bar-fill { height:8px; border-radius:2px; background:#C8102E; }
  .bar-val { font-size:8pt; color:#888; min-width:85px; text-align:right; font-variant-numeric:tabular-nums; }
  .bar-pct { font-size:8pt; color:#C8102E; min-width:30px; text-align:right; font-weight:600; }

  table { width:100%; border-collapse:collapse; font-size:9pt; }
  th { padding:7px 8px; background:#f8f8f8; border-bottom:2px solid #ddd; text-align:left; font-size:8pt; font-weight:700; color:#555; text-transform:uppercase; letter-spacing:.3px; }
  td { padding:6px 8px; border-bottom:1px solid #f0f0f0; color:#333; }
  tr:last-child td { border-bottom:none; }
  .text-right { text-align:right; }
  .text-num { font-variant-numeric:tabular-nums; }
  .text-bold { font-weight:700; }
  .tag { display:inline-block; padding:2px 7px; border-radius:3px; font-size:8pt; font-weight:600; }
  .tag-green { background:#e8fdf0; color:#1a7a3c; }
  .tag-red   { background:#fff0f0; color:#C8102E; }
  .tag-gray  { background:#f5f5f5; color:#666; }

  .analysis { background:#fafafa; border-left:3px solid #C8102E; padding:14px 18px; border-radius:0 6px 6px 0; margin-bottom:20px; }
  .analysis p { font-size:10pt; color:#333; line-height:1.7; margin-bottom:8px; }
  .analysis p:last-child { margin-bottom:0; }
  .analysis strong { color:#C8102E; }

  .total-row { background:#fff8f8; }
  .total-row td { font-weight:700; color:#C8102E; border-top:2px solid #ddd; }

  .footer { margin-top:30px; padding-top:12px; border-top:1px solid #ddd; text-align:center; font-size:8pt; color:#aaa; }
  .page-break { page-break-before:always; }
  
  .metric-highlight { display:inline-flex; align-items:center; gap:6px; background:#fff8f8; border:1px solid #ffcccc; border-radius:4px; padding:4px 10px; font-size:9pt; color:#C8102E; font-weight:600; }
</style>
</head>
<body>

<!-- COVER -->
<div class="cover">
  <div class="cover-logo">TORIBIO P. DE ACHAVAL Y CÍA. S.A.</div>
  <div class="cover-title">Informe de Gestión<br/>Financiera y Facturación</div>
  <div class="cover-sub">Análisis ejecutivo de performance comercial</div>
  <div class="cover-periodo">Período: ${periodoLabel}</div>
  <div class="cover-date">Emitido el ${today}</div>
  <div class="cover-line"></div>
</div>

<!-- RESUMEN EJECUTIVO -->
<div class="section">
  <div class="section-title">1. Resumen Ejecutivo</div>
  <div class="analysis">
    <p>Durante el período comprendido entre ${periodoLabel}, <strong>Toribio P. de Achaval y Cía. S.A.</strong> registró una facturación neta total de <strong>${ars(totalNetoARS)}</strong> en pesos argentinos, con un ingreso bruto de ${ars(totalBrutoARS)} (IVA incluido: ${ars(totalIVA)}). En operaciones denominadas en moneda extranjera, la empresa facturó <strong>${usd(totalUSD)}</strong>.</p>
    <p>De los ${facts.length} comprobantes emitidos, el <strong>${pctCobrado}%</strong> se encuentra en estado cobrado, con ${pendCount} facturas pendientes por un valor neto equivalente a ${ars(montoPend)}. Descontando las notas de crédito emitidas por ${ars(totalNC)}, el <strong>ingreso neto real del período asciende a ${ars(netoReal)}</strong>.</p>
    <p>La tendencia de facturación mensual es <strong>${tendencia}</strong>, con la unidad <strong>${unidadLider}</strong> concentrando el ${unidadPct}% de los ingresos netos. El cliente de mayor peso relativo es <strong>${clienteLider}</strong>, que representa el ${clientePct}% de la facturación neta total del período.</p>
  </div>
</div>

<!-- KPIs -->
<div class="kpi-grid">
  <div class="kpi accent">
    <div class="kpi-label">Facturación Neta ARS</div>
    <div class="kpi-value">${ars(totalNetoARS)}</div>
    <div class="kpi-sub">${facts.length} comprobantes</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Facturación USD</div>
    <div class="kpi-value">${usd(totalUSD)}</div>
    <div class="kpi-sub">${facts.filter((f:any)=>f.monto_usd).length} en dólares</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Tasa de Cobro</div>
    <div class="kpi-value">${pctCobrado}%</div>
    <div class="kpi-sub">${cobradas} cobradas</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Saldo Pendiente</div>
    <div class="kpi-value">${ars(montoPend)}</div>
    <div class="kpi-sub">${pendCount} facturas</div>
  </div>
</div>

<!-- EVOLUCION MENSUAL -->
<div class="section">
  <div class="section-title">2. Evolución Mensual de Facturación Neta (ARS)</div>
  <div class="card" style="margin-bottom:16px;">
    <div class="card-title">Facturación Neta por Mes</div>
    ${mesEntries.map(([mes, v]) => `
      <div class="bar-row">
        <span class="bar-label">${mes}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round((v/mesMax)*barMaxW)}px;max-width:100%"></div></div>
        <span class="bar-val">${ars(v)}</span>
      </div>
    `).join('')}
    <div style="margin-top:10px;font-size:8pt;color:#888;">Promedio mensual: <strong style="color:#C8102E">${ars(mesProm)}</strong></div>
  </div>
  <div class="analysis">
    <p>La evolución mensual revela ${mesEntries.length > 1 ? `una dinámica de ingresos con ${tendencia === 'creciente' ? 'aceleración positiva hacia el cierre del período' : tendencia === 'estable' ? 'comportamiento regular sin volatilidad significativa' : 'desaceleración en los meses más recientes'}` : 'un período de análisis unitario'}. El mes de mayor performance registró ${ars(mesMax)} en facturación neta, representando un ${mesProm > 0 ? Math.round(mesMax/mesProm*100)-100 : 0}% de desvío positivo sobre el promedio del período.</p>
    <p>Desde una perspectiva de gestión financiera, ${pctCobrado >= 80 ? 'la tasa de conversión a cobro es <strong>sólida</strong>, indicando eficiencia en la gestión de cobranzas y baja exposición al riesgo de incobrabilidad' : pctCobrado >= 60 ? 'la tasa de cobro es <strong>aceptable</strong> aunque sugiere oportunidades de mejora en la gestión de cuentas a cobrar' : 'la tasa de cobro presenta <strong>margen de mejora significativo</strong>, recomendándose revisar los procesos de seguimiento de cobranza'}.</p>
  </div>
</div>

<!-- UNIDADES DE NEGOCIO -->
<div class="section page-break">
  <div class="section-title">3. Análisis por Unidad de Negocio</div>
  <div class="two-col">
    <div class="card">
      <div class="card-title">Participación en Facturación Neta</div>
      ${unidadEntries.map(([u, v]) => `
        <div class="bar-row">
          <span class="bar-label">${u}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${totalNetoARS > 0 ? Math.round((v/totalNetoARS)*100) : 0}%"></div></div>
          <span class="bar-pct">${totalNetoARS > 0 ? Math.round((v/totalNetoARS)*100) : 0}%</span>
          <span class="bar-val" style="min-width:80px">${ars(v)}</span>
        </div>
      `).join('')}
    </div>
    <div class="card">
      <div class="card-title">Detalle por Unidad</div>
      <table>
        <thead><tr><th>Unidad</th><th class="text-right">Neto ARS</th><th class="text-right">Part.</th></tr></thead>
        <tbody>
          ${unidadEntries.map(([u,v]) => `
            <tr>
              <td>${u}</td>
              <td class="text-right text-num">${ars(v)}</td>
              <td class="text-right" style="color:#C8102E;font-weight:600">${totalNetoARS > 0 ? Math.round((v/totalNetoARS)*100) : 0}%</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td>TOTAL</td>
            <td class="text-right text-num">${ars(totalNetoARS)}</td>
            <td class="text-right">100%</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <div class="analysis">
    <p>El análisis de concentración por unidad de negocio indica que <strong>${unidadLider}</strong> lidera la generación de ingresos con una participación del <strong>${unidadPct}%</strong> sobre el total neto del período. ${unidadEntries.length > 1 ? `Las restantes ${unidadEntries.length - 1} unidades contribuyen con el ${100 - unidadPct}% complementario, con niveles de diversificación ${unidadEntries.length >= 4 ? 'adecuados que mitigan la dependencia de una sola fuente de ingresos' : 'que sugieren oportunidades de desarrollo en las unidades secundarias'}.` : ''}</p>
    <p>Desde una óptica de risk management, ${unidadPct > 70 ? 'la elevada concentración en una sola unidad incrementa la exposición operativa ante eventuales disrupciones en ese segmento de mercado' : unidadPct > 50 ? 'el nivel de concentración es moderado, siendo recomendable fortalecer las unidades con menor participación relativa' : 'la distribución de ingresos presenta una diversificación saludable entre las distintas unidades operativas'}.</p>
  </div>
</div>

<!-- TOP CLIENTES -->
<div class="section">
  <div class="section-title">4. Concentración por Cliente</div>
  <table style="margin-bottom:16px">
    <thead>
      <tr>
        <th>#</th><th>Cliente</th><th class="text-right">Facturación Neta ARS</th><th class="text-right">Participación</th><th class="text-right">Acumulado</th>
      </tr>
    </thead>
    <tbody>
      ${(() => {
        let acum = 0
        return topClientes.map(([cliente, v], i) => {
          acum += v
          const pct = totalNetoARS > 0 ? Math.round((v/totalNetoARS)*100) : 0
          const acumPct = totalNetoARS > 0 ? Math.round((acum/totalNetoARS)*100) : 0
          return `<tr>
            <td style="color:#aaa;font-size:9pt">${i+1}</td>
            <td style="font-weight:500">${cliente}</td>
            <td class="text-right text-num">${ars(v)}</td>
            <td class="text-right" style="color:#C8102E;font-weight:600">${pct}%</td>
            <td class="text-right" style="color:#888">${acumPct}%</td>
          </tr>`
        }).join('')
      })()}
    </tbody>
  </table>
  <div class="analysis">
    <p>El análisis de concentración de clientes revela que <strong>${clienteLider}</strong> representa el principal generador de ingresos con el <strong>${clientePct}% de la facturación neta</strong>. ${topClientes.length >= 3 ? `Los tres principales clientes concentran el ${totalNetoARS > 0 ? Math.round((topClientes.slice(0,3).reduce((s,[,v])=>s+v,0)/totalNetoARS)*100) : 0}% de los ingresos, lo que constituye un indicador clave para la gestión del riesgo de contrapartes.` : ''}</p>
    <p>Se recomienda monitorear periódicamente el índice de Herfindahl-Hirschman (HHI) como medida de concentración. ${clientePct > 40 ? 'El nivel actual de dependencia de un único cliente es <strong>elevado</strong> y podría representar un riesgo de continuidad en caso de variaciones en ese vínculo comercial. Se sugiere diversificación activa de la cartera.' : clientePct > 25 ? 'El nivel de concentración es <strong>moderado</strong>. La estrategia comercial debería orientarse a reducir la dependencia relativa del cliente principal.' : 'La cartera presenta una <strong>distribución equilibrada</strong>, indicando bajo riesgo de concentración y solidez en la diversificación comercial.'}</p>
  </div>
</div>

<!-- NOTAS DE CREDITO -->
${ncs.length > 0 ? `
<div class="section page-break">
  <div class="section-title">5. Notas de Crédito y Ajustes</div>
  <div class="two-col">
    <div class="kpi" style="border-color:#C8102E;background:#fff8f8">
      <div class="kpi-label">Total Notas de Crédito</div>
      <div class="kpi-value" style="color:#C8102E">-${ars(totalNC)}</div>
      <div class="kpi-sub">${ncs.length} documentos emitidos</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Ingreso Neto Real</div>
      <div class="kpi-value">${ars(netoReal)}</div>
      <div class="kpi-sub">Descontando ajustes</div>
    </div>
  </div>
  <div class="analysis">
    <p>Durante el período se emitieron <strong>${ncs.length} notas de crédito</strong> por un valor total de <strong>${ars(totalNC)}</strong>, representando el ${totalBrutoARS > 0 ? Math.round((totalNC/totalBrutoARS)*100) : 0}% de la facturación bruta. Estas notas impactan directamente en el ingreso neto efectivo, llevando la facturación ajustada a <strong>${ars(netoReal)}</strong>.</p>
    <p>Un nivel de ajustes ${totalBrutoARS > 0 && (totalNC/totalBrutoARS) > 0.1 ? 'superior al 10% sobre la facturación bruta merece análisis específico para identificar causas recurrentes y oportunidades de reducción' : 'inferior al 10% sobre la facturación bruta es <strong>normal y aceptable</strong> en el contexto de la actividad inmobiliaria'}.</p>
  </div>
</div>
` : ''}

<!-- MONEDA EXTRANJERA -->
${totalUSD > 0 ? `
<div class="section">
  <div class="section-title">${ncs.length > 0 ? '6' : '5'}. Operaciones en Moneda Extranjera</div>
  <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
    <div class="kpi accent">
      <div class="kpi-label">Total USD Facturado</div>
      <div class="kpi-value">${usd(totalUSD)}</div>
      <div class="kpi-sub">${facts.filter((f:any)=>f.monto_usd).length} comprobantes</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Participación USD</div>
      <div class="kpi-value">${facts.filter((f:any)=>f.monto_usd).length > 0 ? Math.round(facts.filter((f:any)=>f.monto_usd).length/facts.length*100) : 0}%</div>
      <div class="kpi-sub">del total de comprobantes</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">TC Promedio Aplicado</div>
      <div class="kpi-value">$${(() => { const tcs = facts.filter((f:any)=>f.tipo_cambio).map((f:any)=>f.tipo_cambio); return tcs.length ? Math.round(tcs.reduce((a:number,b:number)=>a+b,0)/tcs.length) : '—'; })()}</div>
      <div class="kpi-sub">tipo de cambio promedio</div>
    </div>
  </div>
  <div class="analysis">
    <p>La exposición en moneda extranjera representa una fuente de ingresos en dólares que actúa como <strong>cobertura natural</strong> ante la volatilidad del peso argentino. El ${facts.filter((f:any)=>f.monto_usd).length > 0 ? Math.round(facts.filter((f:any)=>f.monto_usd).length/facts.length*100) : 0}% de los comprobantes denominados en USD aporta estabilidad al flujo de fondos de la compañía.</p>
  </div>
</div>
` : ''}

<!-- FOOTER -->
<div class="footer">
  <p>Informe generado automáticamente por el Sistema de Facturación — Toribio P. de Achaval y Cía. S.A. | ${today}</p>
  <p style="margin-top:4px">Este documento es confidencial y de uso interno. La información aquí contenida está basada en los registros del sistema al momento de su generación.</p>
</div>

</body>
</html>`

      // Open in new window and trigger print/save as PDF
      const win = window.open('', '_blank')
      if (!win) { toast('Habilitá los popups para descargar el PDF'); return }
      win.document.write(html)
      win.document.close()
      win.onload = () => {
        setTimeout(() => { win.print() }, 500)
      }

      toast('✓ Informe generado — guardalo como PDF desde el diálogo de impresión')
    } catch (e: any) {
      toast('Error al generar el informe: ' + (e.message || ''))
    } finally { setLoading(false) }
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 0' }}>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Generar Informe Financiero</span>
        </div>
        <div style={{ padding: '20px 20px 24px' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
            Generá un informe ejecutivo en PDF con análisis financiero profesional, gráficos de barras, 
            ranking de clientes, evolución mensual y redacción nivel CFO.
          </p>

          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16, padding: 0, marginBottom: 20 }}>
            <div className="form-group">
              <label>Desde</label>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Hasta</label>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
            </div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: 20, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text-primary)' }}>El informe incluye:</strong><br/>
            Resumen ejecutivo con interpretación · KPIs financieros · Evolución mensual de facturación · 
            Análisis por unidad de negocio · Concentración de clientes · Notas de crédito y ajustes · 
            Operaciones en moneda extranjera · Análisis de riesgo y recomendaciones
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={generarPDF}
              disabled={loading}
              style={{ flex: 1, padding: '10px', fontSize: 13 }}
            >
              {loading ? 'Generando…' : '↓ Generar y Descargar PDF'}
            </button>
            <button className="btn" onClick={() => { setDesde('2026-01-01'); setHasta(new Date().toISOString().slice(0,10)) }}>
              Año completo
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 10 }}>
            Al generar, se abrirá el diálogo de impresión del navegador. Seleccioná "Guardar como PDF".
          </p>
        </div>
      </div>
    </div>
  )
}
