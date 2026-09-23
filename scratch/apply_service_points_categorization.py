import os
import re

target_file = r'c:\Users\jdzul\OneDrive\Documents\Agente_Business_Front\Agente-Bussiness\src\pages\DetalleTrabajo\DetalleTrabajoUnificado.tsx'

with open(target_file, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Helper function and memo definitions for categorized points, categories, photos, and context
helper_and_memos = '''    // Helper para normalizar categoría con icono
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
            // Parsear por bloques de texto tipo "1. [Mantenimiento] qwertyuio\n\n2. [Electricidad] cables feos\n\n3. [Plomeria] tubso raros"
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
                nombre: `${subTareas.find(t => t.serviceData?.marca)?.serviceData?.marca || ''} ${subTareas.find(t => t.serviceData?.marca)?.serviceData?.modelo || ''}`.trim() || 'Equipo',
                marca: subTareas.find(t => t.serviceData?.marca)?.serviceData?.marca || '',
                modelo: subTareas.find(t => t.serviceData?.marca)?.serviceData?.modelo || '',
                area: ''
            } : null);

        let cleanProb = rawDesc.replace(/\\[Grupo:[^\\]]+\\]/g, '').replace(/\\|\\|\\|[^|]+\\|\\|\\|/g, '').trim();

        return {
            sucursal: trabajo.sucursal || 'Sucursal',
            tecnico: trabajo.tecnico || 'Técnico Asignado',
            titulo: rawTitle,
            isMaintenance,
            equip,
            problema: cleanProb || rawTitle
        };
    }, [trabajo, maintenanceEquipmentList, subTareas, registeredTechCategories]);'''

# Replace from line 1950 to 2250 (the old memo definitions)
# Find the start of allTechReportPhotos / categorizedServicePoints
pattern_memos = re.compile(r'(\s*// Recopilación unificada y categorizada de todas las fotos[\s\S]*?return \{\s*sucursal: trabajo\.sucursal[\s\S]*?\};\s*\}, \[trabajo, maintenanceEquipmentList, subTareas, registeredTechCategories\]\);)', re.MULTILINE)

if pattern_memos.search(content):
    content = pattern_memos.sub(helper_and_memos, content, count=1)
    print("Replaced memo section successfully.")
else:
    # Alternative match
    alt_pattern = re.compile(r'(\s*const allTechReportPhotos = useMemo\([\s\S]*?return \{\s*sucursal: trabajo\.sucursal[\s\S]*?\};\s*\}, \[trabajo, maintenanceEquipmentList, subTareas, registeredTechCategories\]\);)', re.MULTILINE)
    if alt_pattern.search(content):
        content = alt_pattern.sub(helper_and_memos, content, count=1)
        print("Replaced memo section via alt_pattern.")
    else:
        print("Warning: Could not match memo section directly.")

with open(target_file, 'w', encoding='utf-8') as f:
    f.write(content)

print("Finished writing memo updates.")
