import os

target_file = r'c:\Users\jdzul\OneDrive\Documents\Agente_Business_Front\Agente-Bussiness\src\pages\DetalleTrabajo\DetalleTrabajoUnificado.tsx'

with open(target_file, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update the Memos section around line 1950-2266
memo_start_token = "// Recopilación unificada y categorizada de todas las fotos de reporte / levantamiento del técnico"
memo_alt_start = "const allTechReportPhotos = useMemo(() => {"
memo_end_token = "}, [trabajo, maintenanceEquipmentList, subTareas]);"

new_memos = '''    // Helper para normalizar categoría con icono
    const getCategoryBadgeInfo = (catName?: string) => {
        if (!catName || typeof catName !== 'string') return { label: '🔧 Servicio General', raw: 'Servicio' };
        const cl = catName.trim().toLowerCase();
        if (cl === 'mantenimiento' || cl.includes('manten')) return { label: '🛠️ Mantenimiento', raw: 'Mantenimiento' };
        if (cl === 'plomeria' || cl === 'plomería' || cl.includes('plomer') || cl.includes('fuga') || cl.includes('tuber')) return { label: '🚰 Plomería', raw: 'Plomería' };
        if (cl === 'electricidad' || cl.includes('electr') || cl.includes('corto') || cl.includes('cable')) return { label: '⚡ Electricidad', raw: 'Electricidad' };
        if (cl === 'instalacion' || cl === 'instalación' || cl.includes('instal')) return { label: '🏗️ Instalación', raw: 'Instalación' };
        if (cl === 'albañileria' || cl === 'albañilería' || cl === 'albanileria' || cl.includes('obra') || cl.includes('pared')) return { label: '🧱 Albañilería / Obra Civil', raw: 'Albañilería' };
        if (cl === 'carpinteria' || cl === 'carpintería' || cl.includes('carpint')) return { label: '🪵 Carpintería', raw: 'Carpintería' };
        if (cl === 'pintura' || cl.includes('pint')) return { label: '🎨 Pintura', raw: 'Pintura' };
        if (cl.includes('aire') || cl.includes('clima') || cl.includes('refrig')) return { label: '❄️ Climas / Refrigeración', raw: 'Climas' };
        return { label: `🔧 ${catName.trim()}`, raw: catName.trim() };
    };

    // Estructura Unificada de Puntos de Servicio Categorizados por el Técnico
    const categorizedServicePoints = useMemo(() => {
        const pointsList: {
            puntoIndex: number;
            categoria: string;
            rawCategory: string;
            titulo: string;
            descripcion: string;
            manoObra: number;
            materiales: { material: string; piezas: string; precio: string }[];
            foto?: string;
            equip?: { nombre: string; marca: string; modelo: string; area?: string };
            total: number;
        }[] = [];

        const techTask = subTareas.find(t => t.esCotizacion || t.quoteData || t.serviceData);
        const qData = techTask?.quoteData;
        const sData = techTask?.serviceData;
        const photosArr: string[] = Array.isArray(techTask?.photos) ? techTask.photos : (techTask?.foto ? [techTask.foto] : []);

        const actualRep = reporteFinal || (() => {
            const fallbackRaw = localStorage.getItem(`report_data_${trabajo?.id}`);
            const tempRaw = localStorage.getItem(`report_data_temporal_${trabajo?.id}`);
            try {
                return fallbackRaw ? JSON.parse(fallbackRaw) : (tempRaw ? JSON.parse(tempRaw) : null);
            } catch (e) {
                return null;
            }
        })();

        // 1. Intentar desde sData.items
        if (sData?.items && Array.isArray(sData.items) && sData.items.length > 0) {
            sData.items.forEach((it: any, idx: number) => {
                const pIdx = idx + 1;
                const catInfo = getCategoryBadgeInfo(it.customTipo || it.tipo || it.tipoActividad);
                const qItem = qData?.itemsQuote?.find((qi: any) => qi.puntoIndex === pIdx) || qData?.itemsQuote?.[idx];
                
                const cManoObra = (it.quoteConceptos || qItem?.conceptos || []).reduce((sum: number, c: any) => sum + ((Number(c.cantidad) || 1) * (parseFloat(c.precio) || 0)), 0);
                const mats = (it.quoteMateriales || qItem?.materiales || []).map((m: any) => ({
                    material: m.nombre || m.material || '',
                    piezas: String(m.cantidad || m.piezas || '1'),
                    precio: String(m.precio || '0')
                }));
                const matsTotal = mats.reduce((sum: number, m: any) => sum + ((parseFloat(m.precio) || 0) * (parseFloat(m.piezas) || 1)), 0);

                const itemPhoto = it.foto || photosArr[idx] || actualRep?.taskItems?.[idx]?.foto || taskItems?.[idx]?.foto;

                const isMaint = catInfo.raw.toLowerCase().includes('manten');
                const equip = isMaint ? {
                    nombre: (it.marca || it.modelo) ? `${it.marca || ''} ${it.modelo || ''}`.trim() : (maintenanceEquipmentList?.[0]?.nombre || 'Equipo'),
                    marca: it.marca || maintenanceEquipmentList?.[0]?.marca || '',
                    modelo: it.modelo || maintenanceEquipmentList?.[0]?.modelo || '',
                    area: maintenanceEquipmentList?.[0]?.area || ''
                } : undefined;

                pointsList.push({
                    puntoIndex: pIdx,
                    categoria: catInfo.label,
                    rawCategory: catInfo.raw,
                    titulo: it.descripcion || `Punto ${pIdx}`,
                    descripcion: it.descripcion || '',
                    manoObra: cManoObra,
                    materiales: mats,
                    foto: itemPhoto,
                    equip: equip,
                    total: cManoObra + matsTotal
                });
            });
        } else if (qData?.itemsQuote && Array.isArray(qData.itemsQuote) && qData.itemsQuote.length > 0) {
            qData.itemsQuote.forEach((qItem: any, idx: number) => {
                const pIdx = qItem.puntoIndex || (idx + 1);
                const catInfo = getCategoryBadgeInfo(qItem.tipo || qItem.tipoActividad);
                const cManoObra = (qItem.conceptos || []).reduce((sum: number, c: any) => sum + ((Number(c.cantidad) || 1) * (parseFloat(c.precio) || 0)), 0);
                const mats = (qItem.materiales || []).map((m: any) => ({
                    material: m.nombre || m.material || '',
                    piezas: String(m.cantidad || m.piezas || '1'),
                    precio: String(m.precio || '0')
                }));
                const matsTotal = mats.reduce((sum: number, m: any) => sum + ((parseFloat(m.precio) || 0) * (parseFloat(m.piezas) || 1)), 0);
                const itemPhoto = photosArr[idx] || actualRep?.taskItems?.[idx]?.foto || taskItems?.[idx]?.foto;

                const isMaint = catInfo.raw.toLowerCase().includes('manten');
                const equip = isMaint ? {
                    nombre: (qItem.marca || qItem.modelo) ? `${qItem.marca || ''} ${qItem.modelo || ''}`.trim() : (maintenanceEquipmentList?.[0]?.nombre || 'Equipo'),
                    marca: qItem.marca || maintenanceEquipmentList?.[0]?.marca || '',
                    modelo: qItem.modelo || maintenanceEquipmentList?.[0]?.modelo || '',
                    area: maintenanceEquipmentList?.[0]?.area || ''
                } : undefined;

                pointsList.push({
                    puntoIndex: pIdx,
                    categoria: catInfo.label,
                    rawCategory: catInfo.raw,
                    titulo: qItem.descripcion || `Punto ${pIdx}`,
                    descripcion: qItem.descripcion || '',
                    manoObra: cManoObra,
                    materiales: mats,
                    foto: itemPhoto,
                    equip: equip,
                    total: cManoObra + matsTotal
                });
            });
        } else if (actualRep?.taskItems && Array.isArray(actualRep.taskItems) && actualRep.taskItems.length > 0) {
            actualRep.taskItems.forEach((tIt: any, idx: number) => {
                const pIdx = idx + 1;
                const catInfo = getCategoryBadgeInfo(tIt.customTipoActividad || tIt.tipoActividad);
                const itemPhoto = tIt.foto || photosArr[idx];
                const isMaint = catInfo.raw.toLowerCase().includes('manten');
                const equip = isMaint ? {
                    nombre: (tIt.marca || tIt.modelo) ? `${tIt.marca || ''} ${tIt.modelo || ''}`.trim() : (maintenanceEquipmentList?.[0]?.nombre || 'Equipo'),
                    marca: tIt.marca || maintenanceEquipmentList?.[0]?.marca || '',
                    modelo: tIt.modelo || maintenanceEquipmentList?.[0]?.modelo || '',
                    area: maintenanceEquipmentList?.[0]?.area || ''
                } : undefined;

                pointsList.push({
                    puntoIndex: pIdx,
                    categoria: catInfo.label,
                    rawCategory: catInfo.raw,
                    titulo: tIt.descripcion || `Punto ${pIdx}`,
                    descripcion: tIt.descripcion || '',
                    manoObra: 0,
                    materiales: [],
                    foto: itemPhoto,
                    equip: equip,
                    total: 0
                });
            });
        } else {
            // Parsear por bloques de texto tipo "1. [Mantenimiento] qwertyuio\\n\\n2. [Electricidad] cables feos\\n\\n3. [Plomeria] tubso raros"
            const descText = techTask?.cleanDescripcion || techTask?.descripcion || trabajo?.descripcion || '';
            const descBlocks = descText.split('\\n\\n').map((s: string) => s.trim()).filter(Boolean);
            
            if (descBlocks.length > 0 && descBlocks.some((b: string) => b.includes('[') && b.includes(']'))) {
                descBlocks.forEach((block: string, idx: number) => {
                    const pIdx = idx + 1;
                    const match = block.match(/^(?:\\d+\\.\\s*)?\\[(.*?)\\]\\s*(.*)/);
                    const catRaw = match ? match[1] : 'Servicio';
                    const titleRaw = match ? match[2].trim() : block;
                    const catInfo = getCategoryBadgeInfo(catRaw);
                    const itemPhoto = photosArr[idx] || (idx === 0 && trabajo?.foto_url ? trabajo.foto_url : undefined);

                    const isMaint = catInfo.raw.toLowerCase().includes('manten');
                    const equip = isMaint ? {
                        nombre: maintenanceEquipmentList?.[0]?.nombre || 'Equipo',
                        marca: maintenanceEquipmentList?.[0]?.marca || '',
                        modelo: maintenanceEquipmentList?.[0]?.modelo || '',
                        area: maintenanceEquipmentList?.[0]?.area || ''
                    } : undefined;

                    pointsList.push({
                        puntoIndex: pIdx,
                        categoria: catInfo.label,
                        rawCategory: catInfo.raw,
                        titulo: titleRaw || `Punto ${pIdx}`,
                        descripcion: titleRaw || block,
                        manoObra: idx === 0 && techTask?.cotizacionMonto ? Number(String(techTask.cotizacionMonto).replace(/[^0-9.]/g, '')) || 0 : 0,
                        materiales: [],
                        foto: itemPhoto,
                        equip: equip,
                        total: idx === 0 && techTask?.cotizacionMonto ? Number(String(techTask.cotizacionMonto).replace(/[^0-9.]/g, '')) || 0 : 0
                    });
                });
            } else if (subTareas.length > 0) {
                subTareas.forEach((st: any, idx: number) => {
                    const pIdx = idx + 1;
                    const catInfo = getCategoryBadgeInfo(st.titulo || st.tipoActividad);
                    const itemPhoto = st.foto || (st.photos && st.photos[0]);
                    const isMaint = catInfo.raw.toLowerCase().includes('manten');
                    const equip = isMaint ? {
                        nombre: maintenanceEquipmentList?.[0]?.nombre || 'Equipo',
                        marca: maintenanceEquipmentList?.[0]?.marca || '',
                        modelo: maintenanceEquipmentList?.[0]?.modelo || '',
                        area: maintenanceEquipmentList?.[0]?.area || ''
                    } : undefined;

                    pointsList.push({
                        puntoIndex: pIdx,
                        categoria: catInfo.label,
                        rawCategory: catInfo.raw,
                        titulo: st.cleanDescripcion || st.descripcion || st.titulo || `Punto ${pIdx}`,
                        descripcion: st.cleanDescripcion || st.descripcion || '',
                        manoObra: Number(String(st.cotizacionMonto || '0').replace(/[^0-9.]/g, '')) || 0,
                        materiales: [],
                        foto: itemPhoto,
                        equip: equip,
                        total: Number(String(st.cotizacionMonto || '0').replace(/[^0-9.]/g, '')) || 0
                    });
                });
            }
        }

        return pointsList;
    }, [subTareas, reporteFinal, taskItems, trabajo, maintenanceEquipmentList]);

    // Categorías únicas registradas por el técnico en todos sus puntos
    const registeredTechCategories = useMemo(() => {
        if (categorizedServicePoints.length > 0) {
            const uniqueCats = Array.from(new Set(categorizedServicePoints.map(p => p.categoria)));
            if (uniqueCats.length > 0) return uniqueCats;
        }
        if (trabajo?.titulo) {
            const cat = getCategoryBadgeInfo(trabajo.titulo);
            return [cat.label];
        }
        return ['🛠️ Mantenimiento'];
    }, [categorizedServicePoints, trabajo]);

    // Recopilación unificada de todas las fotos de reporte / levantamiento del técnico rotuladas por Punto y Categoría
    const allTechReportPhotos = useMemo(() => {
        const photos: { url: string; label: string; category?: string; puntoIndex?: number }[] = [];
        const seen = new Set<string>();

        const addPhoto = (url: string | undefined | null, label: string, category = 'General', puntoIndex?: number) => {
            if (!url || typeof url !== 'string' || !url.trim() || url === '—' || url === 'null' || url === 'undefined') return;
            if (!seen.has(url)) {
                seen.add(url);
                photos.push({ url, label, category, puntoIndex });
            }
        };

        // 1. Fotos vinculadas a cada punto categorizado del técnico
        categorizedServicePoints.forEach(pt => {
            if (pt.foto) {
                addPhoto(pt.foto, `Punto ${pt.puntoIndex}: [${pt.rawCategory}] ${pt.titulo}`, pt.categoria, pt.puntoIndex);
            }
        });

        // 2. Si quedan fotos en subTareas.photos que no se mapearon directamente
        subTareas.forEach((st: any) => {
            if (Array.isArray(st.photos)) {
                st.photos.forEach((p: string, pIdx: number) => {
                    const pt = categorizedServicePoints[pIdx];
                    if (pt) {
                        addPhoto(p, `Punto ${pt.puntoIndex}: [${pt.rawCategory}] ${pt.titulo}`, pt.categoria, pt.puntoIndex);
                    } else {
                        addPhoto(p, `Foto ${pIdx + 1} de Levantamiento`, 'Evidencia');
                    }
                });
            }
        });

        // 3. Fotos de Antes / Durante / Después del Reporte Final
        const actualRep = reporteFinal || (() => {
            const fallbackRaw = localStorage.getItem(`report_data_${trabajo?.id}`);
            const tempRaw = localStorage.getItem(`report_data_temporal_${trabajo?.id}`);
            try { return fallbackRaw ? JSON.parse(fallbackRaw) : (tempRaw ? JSON.parse(tempRaw) : null); } catch (e) { return null; }
        })();

        if (actualRep) {
            if (actualRep.imagenes?.antes) addPhoto(actualRep.imagenes.antes, 'Antes del Servicio', 'Evidencia General');
            if (actualRep.imagenes?.durante) addPhoto(actualRep.imagenes.durante, 'Durante el Servicio', 'Evidencia General');
            if (actualRep.imagenes?.despues) addPhoto(actualRep.imagenes.despues, 'Después del Servicio', 'Evidencia General');
            if (Array.isArray(actualRep.imagenesObservacion)) {
                actualRep.imagenesObservacion.forEach((img: string, idx: number) => addPhoto(img, `Observación ${idx + 1}`, 'Observaciones'));
            } else if (actualRep.imagenObservacion) {
                addPhoto(actualRep.imagenObservacion, 'Observación', 'Observaciones');
            }
        }

        if (reporteFinal) {
            if (reporteFinal.imagenes?.antes) addPhoto(reporteFinal.imagenes.antes, 'Antes', 'Evidencia General');
            if (reporteFinal.imagenes?.durante) addPhoto(reporteFinal.imagenes.durante, 'Durante', 'Evidencia General');
            if (reporteFinal.imagenes?.despues) addPhoto(reporteFinal.imagenes.despues, 'Después', 'Evidencia General');
            if (Array.isArray(reporteFinal.imagenesObservacion)) {
                reporteFinal.imagenesObservacion.forEach((img: string, idx: number) => addPhoto(img, `Observación ${idx + 1}`, 'Observaciones'));
            }
        }

        // 4. Foto de la Solicitud Inicial
        if (trabajo?.foto_url) {
            addPhoto(trabajo.foto_url, 'Foto de Solicitud Inicial', 'Solicitud');
        }

        return photos;
    }, [categorizedServicePoints, subTareas, reporteFinal, trabajo]);

    // Resumen de Contexto del Servicio & Equipo / Especialidad
    const serviceContextInfo = useMemo(() => {
        if (!trabajo) return null;

        const rawTitle = trabajo.titulo || '';
        const rawDesc = (trabajo as any).descripcion_problema || trabajo.descripcion || '';
        
        const isMaintenance = Boolean(
            registeredTechCategories.some(c => c.includes('Mantenimiento')) ||
            rawTitle.toLowerCase().includes('mantenimiento') ||
            trabajo.tipo === 'Visita' ||
            (maintenanceEquipmentList && maintenanceEquipmentList.length > 0) ||
            (trabajo as any).levantamiento_equipo ||
            (trabajo as any).levantamientoEquipo ||
            subTareas.some(t => t.serviceData?.marca || t.titulo?.toLowerCase().includes('mantenimiento'))
        );

        const equip = (maintenanceEquipmentList && maintenanceEquipmentList.length > 0 ? maintenanceEquipmentList[0] : null) || 
            ((trabajo as any).levantamiento_equipo ? {
                nombre: (trabajo as any).levantamiento_equipo.nombre || (trabajo as any).levantamiento_equipo.name || 'Equipo',
                marca: (trabajo as any).levantamiento_equipo.marca || '',
                modelo: (trabajo as any).levantamiento_equipo.modelo || '',
                area: (trabajo as any).levantamiento_equipo.area || ''
            } : null) ||
            (subTareas.find(t => t.serviceData?.marca) ? {
                nombre: subTareas.find(t => t.serviceData?.marca)?.titulo || 'Equipo',
                marca: subTareas.find(t => t.serviceData?.marca)?.serviceData?.marca || '',
                modelo: subTareas.find(t => t.serviceData?.marca)?.serviceData?.modelo || '',
                area: ''
            } : null);

        let cleanProb = rawDesc.replace(/\\[Grupo:[^\\]]+\\]/g, '').replace(/\\|\\|\\|[^|]+\\|\\|\\|/g, '').trim();

        return {
            sucursal: (trabajo as any).negocio?.nombre || trabajo.sucursal || trabajo.ubicacion || 'Sucursal',
            tecnico: trabajo.tecnico || subTareas[0]?.tecnicoNombre || 'Técnico Asignado',
            titulo: rawTitle,
            isMaintenance,
            equip,
            problema: cleanProb || rawTitle
        };
    }, [trabajo, maintenanceEquipmentList, subTareas, registeredTechCategories]);'''

# Locate and replace the block
start_idx = code.find(memo_start_token)
if start_idx == -1:
    start_idx = code.find(memo_alt_start)

end_idx = code.find(memo_end_token, start_idx) + len(memo_end_token)

if start_idx != -1 and end_idx != -1:
    code = code[:start_idx] + new_memos + code[end_idx:]
    print("Updated Memos block successfully.")
else:
    print("Could not find exact memo boundaries:", start_idx, end_idx)

# 2. Update the Proposal Context Card to render categorized points
proposal_card_start = "{/* TARJETA DE CONTEXTO DEL SERVICIO & EQUIPO / PROBLEMA */}"
proposal_card_end = "{/* FOTOS DEL REPORTE TOMADAS POR EL TÉCNICO */}"

new_proposal_context = '''{/* TARJETA DE CONTEXTO DEL SERVICIO & EQUIPO / PROBLEMA */}
                                                            {serviceContextInfo && (
                                                                <div style={{
                                                                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                                                                    border: '2px solid #cbd5e1',
                                                                    borderRadius: '18px',
                                                                    padding: '18px 20px',
                                                                    marginBottom: '20px',
                                                                    display: 'flex',
                                                                    flexDirection: 'column',
                                                                    gap: '14px',
                                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                                                                }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                                                        <div>
                                                                            <span style={{ fontSize: '10.5px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '4px' }}>
                                                                                CATEGORÍAS REGISTRADAS POR EL TÉCNICO:
                                                                            </span>
                                                                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                                                {registeredTechCategories.map((cat, cIdx) => (
                                                                                    <span key={cIdx} style={{
                                                                                        background: '#eff6ff',
                                                                                        color: '#1d4ed8',
                                                                                        border: '1.5px solid #93c5fd',
                                                                                        padding: '4px 12px',
                                                                                        borderRadius: '20px',
                                                                                        fontSize: '13.5px',
                                                                                        fontWeight: '900',
                                                                                        display: 'inline-flex',
                                                                                        alignItems: 'center',
                                                                                        gap: '4px',
                                                                                        boxShadow: '0 2px 6px rgba(37, 99, 235, 0.1)'
                                                                                    }}>
                                                                                        {cat}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                                            <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '11px', fontWeight: '800', padding: '3px 10px', borderRadius: '20px', border: '1px solid #fde68a' }}>
                                                                                🏢 {serviceContextInfo.sucursal}
                                                                            </span>
                                                                            <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: '750', padding: '3px 10px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                                                                                👷 Técnico: {serviceContextInfo.tecnico}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    {/* DESGLOSE CATEGORIZADO DE PUNTOS DE SERVICIO */}
                                                                    {categorizedServicePoints.length > 0 && (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                                            {categorizedServicePoints.map((pt, ptIdx) => (
                                                                                <div key={ptIdx} style={{
                                                                                    background: '#ffffff',
                                                                                    border: pt.categoria.includes('Mantenimiento') ? '1.5px solid #bfdbfe' : (pt.categoria.includes('Plomería') ? '1.5px solid #fed7aa' : '1.5px solid #cbd5e1'),
                                                                                    borderRadius: '14px',
                                                                                    padding: '12px 14px',
                                                                                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                                                                                }}>
                                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                            <span style={{ fontSize: '11px', fontWeight: '900', color: '#475569', background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>
                                                                                                PUNTO #{pt.puntoIndex}
                                                                                            </span>
                                                                                            <span style={{
                                                                                                fontSize: '12px',
                                                                                                fontWeight: '850',
                                                                                                color: pt.categoria.includes('Mantenimiento') ? '#1d4ed8' : (pt.categoria.includes('Plomería') ? '#c2410c' : '#4338ca'),
                                                                                                background: pt.categoria.includes('Mantenimiento') ? '#eff6ff' : (pt.categoria.includes('Plomería') ? '#fff7ed' : '#eef2ff'),
                                                                                                border: '1px solid currentColor',
                                                                                                padding: '2px 10px',
                                                                                                borderRadius: '12px'
                                                                                            }}>
                                                                                                {pt.categoria}
                                                                                            </span>
                                                                                        </div>
                                                                                        {pt.manoObra > 0 && (
                                                                                            <span style={{ fontSize: '12px', fontWeight: '900', color: '#16a34a', background: '#f0fdf4', padding: '2px 8px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                                                                                                Sugerencia Técnico: ${pt.manoObra.toLocaleString('es-MX')}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>

                                                                                    <p style={{ margin: '0 0 6px 0', fontSize: '13.5px', fontWeight: '800', color: '#0f172a' }}>
                                                                                        {pt.titulo}
                                                                                    </p>

                                                                                    {/* Datos del equipo si es Mantenimiento */}
                                                                                    {pt.categoria.includes('Mantenimiento') && pt.equip && (
                                                                                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '6px', fontSize: '11.5px', marginTop: '6px' }}>
                                                                                            <div><span style={{ color: '#64748b', fontSize: '10px', fontWeight: '800', display: 'block' }}>EQUIPO:</span> <strong style={{ color: '#0f172a' }}>{pt.equip.nombre}</strong></div>
                                                                                            {pt.equip.marca && <div><span style={{ color: '#64748b', fontSize: '10px', fontWeight: '800', display: 'block' }}>MARCA:</span> <strong style={{ color: '#0f172a' }}>{pt.equip.marca}</strong></div>}
                                                                                            {pt.equip.modelo && <div><span style={{ color: '#64748b', fontSize: '10px', fontWeight: '800', display: 'block' }}>MODELO:</span> <strong style={{ color: '#0f172a' }}>{pt.equip.modelo}</strong></div>}
                                                                                            {pt.equip.area && <div><span style={{ color: '#64748b', fontSize: '10px', fontWeight: '800', display: 'block' }}>ÁREA:</span> <strong style={{ color: '#0f172a' }}>{pt.equip.area}</strong></div>}
                                                                                        </div>
                                                                                    )}

                                                                                    {/* Foto del punto */}
                                                                                    {pt.foto && (
                                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                                                                                            <div
                                                                                                onClick={() => setSelectedZoomImage(pt.foto!)}
                                                                                                style={{ width: '44px', height: '44px', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', border: '1.5px solid #cbd5e1', flexShrink: 0 }}
                                                                                            >
                                                                                                <img src={pt.foto} alt={`Foto Punto ${pt.puntoIndex}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                                            </div>
                                                                                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>
                                                                                                📷 Evidencia de {pt.categoria} ({pt.titulo})
                                                                                            </span>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}'''

# Replace in Proposal section
p_start = code.find(proposal_card_start)
p_end = code.find(proposal_card_end, p_start)
if p_start != -1 and p_end != -1:
    code = code[:p_start] + new_proposal_context + "\n\n                                                                    " + code[p_end:]
    print("Updated Proposal Context Card successfully.")

# 3. Update the Drawer Context Card around line 9180
drawer_context_start = "{/* Card 1.5: Contexto del Servicio & Equipo / Especialidad */}"
drawer_photos_start = "{/* Card 2: Evidencia Fotográfica del Técnico */}"

new_drawer_context = '''{/* Card 1.5: Contexto del Servicio & Equipo / Especialidad */}
                                                     <div style={{ background: '#fff', borderRadius: '20px', padding: '18px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1.5px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
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
                                                             <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '11px', fontWeight: '800', padding: '3px 10px', borderRadius: '20px', border: '1px solid #fde68a' }}>
                                                                 🏢 {serviceContextInfo?.sucursal || 'Sucursal'}
                                                             </span>
                                                         </div>

                                                         {/* LISTA DE PUNTOS CATEGORIZADOS EN EL DRAWER */}
                                                         {categorizedServicePoints.length > 0 ? (
                                                             <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                                 {categorizedServicePoints.map((pt, ptIdx) => (
                                                                     <div key={ptIdx} style={{
                                                                         background: '#f8fafc',
                                                                         border: pt.categoria.includes('Mantenimiento') ? '1.5px solid #bfdbfe' : (pt.categoria.includes('Plomería') ? '1.5px solid #fed7aa' : '1.5px solid #cbd5e1'),
                                                                         borderRadius: '12px',
                                                                         padding: '10px 12px'
                                                                     }}>
                                                                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                                                                             <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                 <span style={{ fontSize: '10.5px', fontWeight: '900', color: '#475569', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>
                                                                                     PUNTO #{pt.puntoIndex}
                                                                                 </span>
                                                                                 <span style={{
                                                                                     fontSize: '11.5px',
                                                                                     fontWeight: '850',
                                                                                     color: pt.categoria.includes('Mantenimiento') ? '#1d4ed8' : (pt.categoria.includes('Plomería') ? '#c2410c' : '#4338ca'),
                                                                                     background: '#ffffff',
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
                                                                             <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '4px', fontSize: '11px', marginTop: '4px' }}>
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

d_start = code.find(drawer_context_start)
d_end = code.find(drawer_photos_start, d_start)
if d_start != -1 and d_end != -1:
    code = code[:d_start] + new_drawer_context + "\n\n                                                     " + code[d_end:]
    print("Updated Drawer Context Card successfully.")

with open(target_file, 'w', encoding='utf-8') as f:
    f.write(code)

print("All categorized sections updated successfully!")
