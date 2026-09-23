import os

target_file = r'c:\Users\jdzul\OneDrive\Documents\Agente_Business_Front\Agente-Bussiness\src\pages\DetalleTrabajo\DetalleTrabajoUnificado.tsx'

with open(target_file, 'r', encoding='utf-8') as f:
    code = f.read()

drawer_start = "{/* Card 1: Categoría Registrada por el Técnico */}"
drawer_end = "{/* Card 2: Evidencia Fotográfica del Técnico */}"

new_drawer_block = '''{/* Card 1: Categoría Registrada por el Técnico & Puntos Categorizados */}
                                                     <div style={{
                                                         background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                                         border: '2px solid #cbd5e1',
                                                         borderRadius: '20px',
                                                         padding: '18px 20px',
                                                         boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
                                                         display: 'flex',
                                                         flexDirection: 'column',
                                                         gap: '12px'
                                                     }}>
                                                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                                             <div>
                                                                 <span style={{ fontSize: '10px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '4px' }}>
                                                                     CATEGORÍAS REGISTRADAS POR EL TÉCNICO:
                                                                 </span>
                                                                 <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                                     {registeredTechCategories.map((cat, cIdx) => (
                                                                         <span key={cIdx} style={{
                                                                             background: '#eff6ff',
                                                                             color: '#1d4ed8',
                                                                             border: '1.5px solid #93c5fd',
                                                                             padding: '3px 10px',
                                                                             borderRadius: '16px',
                                                                             fontSize: '12.5px',
                                                                             fontWeight: '900',
                                                                             display: 'inline-flex',
                                                                             alignItems: 'center',
                                                                             gap: '4px'
                                                                         }}>
                                                                             {cat}
                                                                         </span>
                                                                     ))}
                                                                 </div>
                                                             </div>
                                                             <span style={{ fontSize: '11px', color: '#92400e', fontWeight: '800', background: '#fef3c7', padding: '3px 10px', borderRadius: '12px', border: '1px solid #fde68a' }}>
                                                                 🏢 {serviceContextInfo?.sucursal || 'Sucursal'}
                                                             </span>
                                                         </div>

                                                         {/* LISTA DE PUNTOS CATEGORIZADOS EN EL DRAWER */}
                                                         {categorizedServicePoints.length > 0 ? (
                                                             <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                                 {categorizedServicePoints.map((pt, ptIdx) => (
                                                                     <div key={ptIdx} style={{
                                                                         background: '#ffffff',
                                                                         border: pt.categoria.includes('Mantenimiento') ? '1.5px solid #bfdbfe' : (pt.categoria.includes('Plomería') ? '1.5px solid #fed7aa' : '1.5px solid #cbd5e1'),
                                                                         borderRadius: '12px',
                                                                         padding: '10px 12px',
                                                                         boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
                                                                     }}>
                                                                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                                                                             <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                 <span style={{ fontSize: '10.5px', fontWeight: '900', color: '#475569', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                                                                                     PUNTO #{pt.puntoIndex}
                                                                                 </span>
                                                                                 <span style={{
                                                                                     fontSize: '11.5px',
                                                                                     fontWeight: '850',
                                                                                     color: pt.categoria.includes('Mantenimiento') ? '#1d4ed8' : (pt.categoria.includes('Plomería') ? '#c2410c' : '#4338ca'),
                                                                                     background: pt.categoria.includes('Mantenimiento') ? '#eff6ff' : (pt.categoria.includes('Plomería') ? '#fff7ed' : '#eef2ff'),
                                                                                     border: '1px solid currentColor',
                                                                                     padding: '1px 8px',
                                                                                     borderRadius: '10px'
                                                                                 }}>
                                                                                     {pt.categoria}
                                                                                 </span>
                                                                             </div>
                                                                             {pt.manoObra > 0 && (
                                                                                 <span style={{ fontSize: '11.5px', fontWeight: '900', color: '#16a34a', background: '#f0fdf4', padding: '2px 6px', borderRadius: '6px' }}>
                                                                                     ${pt.manoObra.toLocaleString('es-MX')}
                                                                                 </span>
                                                                             )}
                                                                         </div>

                                                                         <p style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                                                                             {pt.titulo}
                                                                         </p>

                                                                         {/* Equipo si es Mantenimiento */}
                                                                         {pt.categoria.includes('Mantenimiento') && pt.equip && (
                                                                             <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '4px', fontSize: '11px', marginTop: '4px' }}>
                                                                                 <div><span style={{ color: '#64748b', fontSize: '9.5px', fontWeight: '800', display: 'block' }}>EQUIPO:</span> <strong style={{ color: '#0f172a' }}>{pt.equip.nombre}</strong></div>
                                                                                 {pt.equip.marca && <div><span style={{ color: '#64748b', fontSize: '9.5px', fontWeight: '800', display: 'block' }}>MARCA:</span> <strong style={{ color: '#0f172a' }}>{pt.equip.marca}</strong></div>}
                                                                                 {pt.equip.modelo && <div><span style={{ color: '#64748b', fontSize: '9.5px', fontWeight: '800', display: 'block' }}>MODELO:</span> <strong style={{ color: '#0f172a' }}>{pt.equip.modelo}</strong></div>}
                                                                                 {pt.equip.area && <div><span style={{ color: '#64748b', fontSize: '9.5px', fontWeight: '800', display: 'block' }}>ÁREA:</span> <strong style={{ color: '#0f172a' }}>{pt.equip.area}</strong></div>}
                                                                             </div>
                                                                         )}

                                                                         {/* Foto del punto */}
                                                                         {pt.foto && (
                                                                             <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                                                                                 <div
                                                                                     onClick={() => setSelectedZoomImage(pt.foto!)}
                                                                                     style={{ width: '38px', height: '38px', borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', border: '1px solid #cbd5e1', flexShrink: 0 }}
                                                                                 >
                                                                                     <img src={pt.foto} alt={`Foto Punto ${pt.puntoIndex}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                                 </div>
                                                                                 <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700' }}>
                                                                                     📷 Evidencia de {pt.categoria} ({pt.titulo})
                                                                                 </span>
                                                                             </div>
                                                                         )}
                                                                     </div>
                                                                 ))}
                                                             </div>
                                                         ) : (
                                                             serviceContextInfo?.problema && (
                                                                 <div style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: '12px', padding: '10px 12px' }}>
                                                                     <span style={{ fontSize: '10.5px', fontWeight: '850', color: '#c2410c', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                                                                         📝 Detalle del Trabajo / Problema:
                                                                     </span>
                                                                     <p style={{ margin: 0, fontSize: '12.5px', color: '#475569', fontWeight: '600' }}>
                                                                         {serviceContextInfo.problema}
                                                                     </p>
                                                                 </div>
                                                             )
                                                         )}
                                                     </div>'''

start = code.find(drawer_start)
end = code.find(drawer_end, start)
if start != -1 and end != -1:
    code = code[:start] + new_drawer_block + "\n\n                                                     " + code[end:]
    print("Drawer replaced successfully.")

with open(target_file, 'w', encoding='utf-8') as f:
    f.write(code)
