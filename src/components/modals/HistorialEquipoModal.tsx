import React, { useState, useEffect } from 'react';
import { createPortal } from "react-dom";
import { 
    HiOutlineCalendarDays, 
    HiOutlineWrenchScrewdriver, 
    HiOutlineCheckCircle, 
    HiChevronDown, 
    HiChevronUp, 
    HiOutlineClipboardDocumentList, 
    HiOutlineCube,
    HiOutlinePhoto,
    HiOutlineUser
} from "react-icons/hi2";
import { getReporteByTrabajoId } from '../../services/reportesService';

interface HistorialEquipoModalProps {
    isOpen: boolean;
    onClose: () => void;
    equipo: any;
    historial: any[];
    onViewReport?: (trabajoId: number) => void;
}

const HistorialEquipoModal: React.FC<HistorialEquipoModalProps> = ({ isOpen, onClose, equipo, historial, onViewReport }) => {
    const [expandedIds, setExpandedIds] = useState<number[]>([]);
    const [loadedReports, setLoadedReports] = useState<Record<number, any>>({});
    const [selectedZoomPhoto, setSelectedZoomPhoto] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && equipo) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen, equipo]);

    // Fetch / recuperar reportes de DB y localStorage para todos los trabajos en el historial
    useEffect(() => {
        if (!isOpen || !historial || historial.length === 0) return;

        const idsToFetch = new Set<number>();
        historial.forEach(req => {
            const possibleIds = [
                req.actualTrabajoId,
                req.reparacion_trabajo_id,
                req.visita_trabajo_id,
                req.reparacion_trabajo?.id,
                req.visita_trabajo?.id,
                req.original_id,
                req.id
            ];
            possibleIds.forEach(idVal => {
                if (idVal) {
                    const cleanNum = Number(String(idVal).replace('m-', '').replace('gen-', ''));
                    if (!isNaN(cleanNum) && cleanNum > 0) {
                        idsToFetch.add(cleanNum);
                    }
                }
            });
        });

        // 1. Carga inmediata desde LocalStorage
        const localInitial: Record<number, any> = {};
        idsToFetch.forEach(jobId => {
            const localRaw = localStorage.getItem(`report_data_${jobId}`);
            if (localRaw) {
                try {
                    localInitial[jobId] = JSON.parse(localRaw);
                } catch (_) {}
            }
        });
        if (Object.keys(localInitial).length > 0) {
            setLoadedReports(prev => ({ ...prev, ...localInitial }));
        }

        // 2. Carga asíncrona desde Backend
        const fetchBackendReports = async () => {
            const results: Record<number, any> = {};
            for (const jobId of Array.from(idsToFetch)) {
                try {
                    const dbRep = await getReporteByTrabajoId(jobId);
                    if (dbRep && dbRep.solucion) {
                        const parsed = typeof dbRep.solucion === 'string' ? JSON.parse(dbRep.solucion) : dbRep.solucion;
                        results[jobId] = { ...parsed, dbId: dbRep.id, dbDescripcion: dbRep.descripcion };
                    }
                } catch (_) {}
            }
            if (Object.keys(results).length > 0) {
                setLoadedReports(prev => ({ ...prev, ...results }));
            }
        };

        fetchBackendReports();
    }, [isOpen, historial]);

    if (!isOpen || !equipo) return null;

    const toggleExpand = (index: number) => {
        setExpandedIds(prev =>
            prev.includes(index) ? prev.filter(id => id !== index) : [...prev, index]
        );
    };

    const matchesTargetEquipo = (itemOrReport: any, eq: any): boolean => {
        if (!itemOrReport || !eq) return false;

        // 1. Coincidencia directa de ID numérico o string
        const targetEqId = String(eq.id || eq.levantamiento_equipo_id || '');
        const repEqId = String(
            itemOrReport.levantamiento_equipo_id || 
            itemOrReport.equipo_id || 
            itemOrReport.equipo?.id || 
            itemOrReport.equipoInfo?.id || 
            itemOrReport.equipoInfo?.levantamiento_equipo_id || 
            ''
        );
        if (targetEqId && repEqId && targetEqId === repEqId) return true;

        // 2. Coincidencia por Número de Serie
        const targetSerie = String(eq.serie || eq.numero_serie || '').trim().toLowerCase();
        const repSerie = String(
            itemOrReport.serie || 
            itemOrReport.numero_serie || 
            itemOrReport.equipoInfo?.serie || 
            itemOrReport.equipoInfo?.numero_serie || 
            itemOrReport.equipo?.serie || 
            ''
        ).trim().toLowerCase();
        if (targetSerie && targetSerie.length > 2 && targetSerie !== 'n/a' && targetSerie !== 's/n' && targetSerie !== 'sin serie' && targetSerie !== 'undefined') {
            if (repSerie && repSerie === targetSerie) return true;
        }

        // 3. Coincidencia por objeto estructurado equipoInfo
        const eqInfo = itemOrReport.equipoInfo || itemOrReport.equipo;
        if (eqInfo) {
            const mMarca = eqInfo.marca && eq.marca && String(eqInfo.marca).trim().toLowerCase() === String(eq.marca).trim().toLowerCase();
            const mModelo = eqInfo.modelo && eq.modelo && String(eqInfo.modelo).trim().toLowerCase() === String(eq.modelo).trim().toLowerCase();
            const mNombre = eqInfo.nombre && eq.nombre && String(eqInfo.nombre).trim().toLowerCase() === String(eq.nombre).trim().toLowerCase();
            if (mMarca && (mModelo || mNombre)) return true;
            if (mNombre && mModelo) return true;
        }

        // 4. Coincidencia semántica en textos del subreporte / reporte de tienda
        const repText = `${itemOrReport.reporteTienda || ''} ${itemOrReport.titulo || ''} ${itemOrReport.hallazgo || ''} ${itemOrReport.descripcion_problema || ''} ${itemOrReport.problema_cliente || ''} ${itemOrReport.concepto_cotizacion || ''}`.toLowerCase();
        const marca = String(eq.marca || '').trim().toLowerCase();
        const modelo = String(eq.modelo || '').trim().toLowerCase();
        const nombre = String(eq.nombre || '').trim().toLowerCase();

        const hasMarca = marca.length > 1 && repText.includes(marca);
        const hasModelo = modelo.length > 0 && repText.includes(modelo);
        const hasNombre = nombre.length > 1 && repText.includes(nombre);

        if ((hasMarca && hasModelo) || (hasMarca && hasNombre) || (hasNombre && hasModelo)) {
            return true;
        }

        return false;
    };

    const extractReportsForItem = (req: any) => {
        const rawList: any[] = [];

        if (Array.isArray(req.reportes)) {
            req.reportes.forEach((rep: any) => {
                if (matchesTargetEquipo(rep, equipo)) {
                    rawList.push(rep);
                }
            });
        }

        const jobIds = [
            req.actualTrabajoId,
            req.reparacion_trabajo_id,
            req.visita_trabajo_id,
            req.reparacion_trabajo?.id,
            req.visita_trabajo?.id,
            req.original_id,
            req.id
        ].map(idVal => idVal ? Number(String(idVal).replace('m-', '').replace('gen-', '')) : null)
        .filter((id): id is number => id !== null && !isNaN(id) && id > 0);

        const candidateReports: any[] = [];

        // 1. Desde loadedReports (DB / localStorage)
        jobIds.forEach(jId => {
            if (loadedReports[jId]) {
                candidateReports.push({ sourceJobId: jId, data: loadedReports[jId] });
            }
        });

        // 2. Desde campos anidados en req
        [req.visita_trabajo, req.reparacion_trabajo, req].forEach(t => {
            if (t?.reporte?.solucion || t?.solucion) {
                const rawSol = t.reporte?.solucion || t.solucion;
                try {
                    const parsed = typeof rawSol === 'string' ? JSON.parse(rawSol) : rawSol;
                    candidateReports.push({ sourceJobId: t.id || req.actualTrabajoId || req.id, data: parsed });
                } catch (_) {}
            }
        });

        candidateReports.forEach(({ sourceJobId, data: p }) => {
            if (!p) return;

            let hasMatchedSubReports = false;

            // Si contiene subReports estructurados (multi-punto / tareas divididas)
            if (p.subReports && typeof p.subReports === 'object') {
                Object.entries(p.subReports).forEach(([subKey, subData]: [string, any]) => {
                    if (subData && (subData.descripcion || subData.reporteTienda || subData.imagenes || subData.materiales)) {
                        // FILTRADO ESTRICTO: Solo incluir el subreporte si pertenece a ESTE equipo
                        if (matchesTargetEquipo(subData, equipo)) {
                            hasMatchedSubReports = true;
                            const piezas = Array.isArray(subData.refaccionesList)
                                ? subData.refaccionesList.map((r: any) => `${r.cantidad || 1}x ${r.pieza || r.nombre || r.material}`).join(' · ')
                                : '';
                            
                            rawList.push({
                                id: sourceJobId,
                                subId: subKey,
                                titulo: subData.equipoInfo?.tipo || subData.tipoServicio || (subData.reporteTienda ? subData.reporteTienda.split('(')[0].trim() : '') || 'Mantenimiento de Equipo',
                                problema_cliente: subData.reporteTienda || subData.hallazgo || req.descripcion_problema || req.descripcion || '—',
                                trabajo_realizado: subData.descripcion || '—',
                                materiales: subData.materiales || '',
                                refacciones: piezas,
                                imagenes: subData.imagenes || null,
                                observacionesList: subData.observacionesList || [],
                                tecnico: subData.tecnicoNombre || p.tecnicoNombre || req.tecnico?.name || 'Técnico asignado',
                                fecha: subData.fecha || p.fecha || null
                            });
                        }
                    }
                });
            }

            // Reporte único raíz (SOLO si NO tiene subReports o ninguno coincidió como subreporte)
            if (!hasMatchedSubReports && (p.descripcion || p.reporteTienda || p.hallazgo || p.imagenes)) {
                // Verificar si este reporte raíz pertenece al equipo o a la solicitud del equipo
                const isMatchingRoot = matchesTargetEquipo(p, equipo) || matchesTargetEquipo(req, equipo);
                if (isMatchingRoot) {
                    const piezas = Array.isArray(p.refaccionesList)
                        ? p.refaccionesList.map((r: any) => `${r.cantidad || 1}x ${r.pieza || r.nombre || r.material}`).join(' · ')
                        : '';

                    rawList.push({
                        id: sourceJobId,
                        titulo: p.equipoInfo?.tipo || p.tipoServicio || 'Informe Técnico',
                        problema_cliente: p.reporteTienda || p.hallazgo || req.descripcion_problema || req.descripcion || '—',
                        trabajo_realizado: p.descripcion || p.reporteTienda || req.descripcion || '—',
                        materiales: p.materiales || '',
                        refacciones: piezas,
                        imagenes: p.imagenes || null,
                        observacionesList: p.observacionesList || [],
                        tecnico: p.tecnicoNombre || req.tecnico?.name || 'Técnico asignado',
                        fecha: p.fecha || null
                    });
                }
            }
        });

        // Deduplicación
        const seen = new Set<string>();
        return rawList.filter(r => {
            const key = `${r.problema_cliente}-${r.trabajo_realizado}-${r.materiales}-${r.refacciones}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    };

    return createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10000, padding: '20px'
        }} onClick={onClose}>
            <div className="modal-card-no-scrollbar" style={{
                background: '#fff', borderRadius: '32px', maxWidth: '700px', width: '100%',
                maxHeight: '85vh', overflowY: 'auto', position: 'relative',
                boxShadow: '0 30px 60px -15px rgba(15, 23, 42, 0.25)', border: '1px solid #cbd5e1', padding: '35px'
            }} onClick={e => e.stopPropagation()}>

                <button onClick={onClose} className="modal-close-btn">
                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'inherit', display: 'block', lineHeight: 1 }}>✕</span>
                </button>

                <div style={{ display: 'flex', gap: '25px', flexWrap: 'wrap', marginBottom: '30px' }}>
                    {equipo.foto ? (
                        <img
                             src={equipo.foto}
                             alt={equipo.nombre}
                             onError={(e) => {
                                 e.currentTarget.style.display = 'none';
                                 const sibling = e.currentTarget.nextSibling as HTMLElement;
                                 if (sibling) sibling.style.display = 'flex';
                             }}
                             style={{ width: '130px', height: '130px', objectFit: 'cover', borderRadius: '20px', border: '2px solid #cbd5e1' }}
                        />
                    ) : null}
                    <div className="img-placeholder" style={{ 
                        display: equipo.foto ? 'none' : 'flex',
                        width: '130px', 
                        height: '130px', 
                        borderRadius: '20px', 
                        background: '#f1f5f9', 
                        border: '2px solid #cbd5e1',
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        color: '#0f172a' 
                    }}>
                        <HiOutlineCube size={48} />
                    </div>
                    <div style={{ flex: 1, minWidth: '250px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: '#d14d13', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>
                            {equipo.nombre}
                        </span>
                        <h3 style={{ margin: '0 0 15px', fontSize: '26px', color: '#0f172a', fontWeight: '900', lineHeight: '1.2' }}>
                            {equipo.marca} {equipo.modelo}
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', width: '100%' }}>
                            <div style={{ background: '#f8fafc', padding: '10px 15px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>NÚM. DE SERIE</span>
                                <p style={{ margin: 0, fontWeight: '700', color: '#0f172a', fontSize: '14px' }}>{equipo.serie || 'S/N'}</p>
                            </div>
                            <div style={{ background: '#f8fafc', padding: '10px 15px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>FABRICACIÓN / USO</span>
                                <p style={{ margin: 0, fontWeight: '700', color: '#0f172a', fontSize: '14px' }}>
                                    {equipo.anioFabricacion || 'N/A'} <span style={{ color: '#cbd5e1' }}>/</span> {equipo.anioUso || 'N/A'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '30px' }}>
                    <h4 style={{ fontSize: '18px', color: '#0f172a', fontWeight: '800', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        Bitácora de Mantenimiento
                        <span style={{ background: '#0f172a', color: '#ffffff', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '800' }}>
                            {historial.length}
                        </span>
                    </h4>

                    {historial.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '20px', border: '1px dashed #cbd5e1' }}>
                            <div style={{ fontSize: '40px', marginBottom: '10px' }}>📄</div>
                            <h4 style={{ margin: '0 0 5px', color: '#334155', fontSize: '16px' }}>Sin reportes registrados</h4>
                            <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>Este equipo no cuenta con historial técnico ni reparaciones previas registradas.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {historial.map((req, idx) => {
                                const isExpanded = expandedIds.includes(idx);
                                const finalReports = extractReportsForItem(req);

                                let displayEstado = req.estado;
                                if (req.reparacion_trabajo && ['Finalizado', 'Completado'].includes(req.reparacion_trabajo.estado)) {
                                    displayEstado = 'Finalizado';
                                } else if (req.visita_trabajo && ['Finalizado', 'Completado'].includes(req.visita_trabajo.estado) && (req.estado === 'Visita Asignada' || req.estado === 'Pendiente')) {
                                    displayEstado = 'Finalizado';
                                }

                                const itemDate = req.created_at || req.fechaSolicitud || req.fecha;
                                let displayDate = 'Fecha no disponible';
                                if (itemDate) {
                                    if (typeof itemDate === 'string' && (itemDate.includes('/') || itemDate.includes('-')) && !itemDate.includes('T')) {
                                        displayDate = itemDate;
                                    } else {
                                        try {
                                            const d = new Date(itemDate);
                                            displayDate = isNaN(d.getTime()) ? String(itemDate) : d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                        } catch (_) {
                                            displayDate = String(itemDate);
                                        }
                                    }
                                }

                                return (
                                    <div key={idx}
                                        onClick={() => toggleExpand(idx)}
                                        style={{
                                            padding: '24px',
                                            border: isExpanded ? '1.5px solid #f26522' : '1px solid #cbd5e1',
                                            borderRadius: '20px',
                                            background: '#ffffff',
                                            position: 'relative',
                                            overflow: 'hidden',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            boxShadow: isExpanded ? '0 10px 25px -5px rgba(15, 23, 42, 0.08)' : '0 2px 8px rgba(0,0,0,0.02)'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = '#f26522';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = isExpanded ? '#f26522' : '#cbd5e1';
                                        }}
                                    >
                                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: displayEstado === 'Finalizado' || displayEstado?.includes('Aceptada') ? '#10b981' : '#f26522' }}></div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                            <span style={{ fontSize: '14px', fontWeight: '700', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <HiOutlineCalendarDays style={{ color: '#94a3b8' }} /> {displayDate}
                                            </span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span style={{
                                                    padding: '6px 14px', borderRadius: '30px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase',
                                                    background: displayEstado === 'Finalizado' || displayEstado?.includes('Aceptada') ? '#ecfdf5' : '#fff8e1',
                                                    color: displayEstado === 'Finalizado' || displayEstado?.includes('Aceptada') ? '#059669' : '#b7791f',
                                                    border: `1px solid ${displayEstado === 'Finalizado' || displayEstado?.includes('Aceptada') ? '#a7f3d0' : '#fde68a'}`
                                                }}>
                                                    {displayEstado}
                                                </span>
                                                {isExpanded ? <HiChevronUp size={20} color="#94a3b8" /> : <HiChevronDown size={20} color="#94a3b8" />}
                                            </div>
                                        </div>

                                        <div style={{ fontSize: '15px', color: '#1e293b', margin: '0', display: 'flex', alignItems: 'flex-start', gap: '10px', lineHeight: '1.5' }}>
                                            <HiOutlineWrenchScrewdriver style={{ marginTop: '3px', flexShrink: 0, color: '#f26522', fontSize: '18px' }} />
                                            <div>
                                                <span style={{ fontWeight: '800', color: '#64748b', fontSize: '11px', display: 'block', marginBottom: '2px' }}>REPORTE DEL CLIENTE / TRABAJO</span>
                                                <span style={{ fontWeight: '500' }}>"{req.descripcion_problema || req.descripcion || req.titulo || 'Mantenimiento registrado'}"</span>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px dashed #cbd5e1' }}>

                                                {/* Detalle Técnico */}
                                                {!finalReports.length && (!req.visitas || req.visitas.length === 0) ? (
                                                    <div style={{ textAlign: 'center', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                                        <span style={{ color: '#64748b', fontSize: '13px', fontWeight: '600' }}>
                                                            {displayEstado === 'Finalizado' ? 'Cargando información técnica de la bitácora...' : 'Aún no hay reportes técnicos finalizados para esta intervención.'}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                        {(req.visitas && req.visitas.length > 0) && (
                                                            <div>
                                                                <p style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', marginBottom: '8px', letterSpacing: '0.5px' }}>INTERVENCIONES TÉCNICAS:</p>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                    {req.visitas.map((v: any, i: number) => (
                                                                        <div key={i} style={{ fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'flex-start', gap: '8px', background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                                                                            <HiOutlineCheckCircle style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                                                                            <div>
                                                                                <strong style={{ color: '#1e293b' }}>{v.tecnico?.name || 'Técnico'}</strong>
                                                                                <p style={{ margin: '4px 0 0', lineHeight: '1.4' }}>{v.reporte_solucion || 'Revisión técnica en proceso.'}</p>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {(finalReports.length > 0) && (
                                                            <div>
                                                                <p style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', marginBottom: '10px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                                                    📋 Bitácora e Informe Técnico:
                                                                </p>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                                                    {finalReports.map((rep: any, i: number) => {
                                                                        const photoList: { label: string; url: string }[] = [];
                                                                        if (rep.imagenes?.antes) photoList.push({ label: 'Antes', url: rep.imagenes.antes });
                                                                        if (rep.imagenes?.durante) photoList.push({ label: 'Durante', url: rep.imagenes.durante });
                                                                        if (rep.imagenes?.despues) photoList.push({ label: 'Después', url: rep.imagenes.despues });
                                                                        if (Array.isArray(rep.observacionesList)) {
                                                                            rep.observacionesList.forEach((obs: any, oIdx: number) => {
                                                                                if (obs && Array.isArray(obs.imagenes)) {
                                                                                    obs.imagenes.forEach((img: string, imgIdx: number) => {
                                                                                        if (img) photoList.push({ label: `Obs ${oIdx + 1}.${imgIdx + 1}`, url: img });
                                                                                    });
                                                                                }
                                                                            });
                                                                        }

                                                                        return (
                                                                            <div key={i} style={{
                                                                                background: '#f8fafc',
                                                                                borderRadius: '14px',
                                                                                border: '1px solid #e2e8f0',
                                                                                padding: '16px',
                                                                                display: 'flex',
                                                                                flexDirection: 'column',
                                                                                gap: '10px'
                                                                            }}>
                                                                                {/* Encabezado del reporte / título */}
                                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                                                                    <span style={{ fontSize: '12px', fontWeight: '850', color: '#0f172a', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '3px 10px', borderRadius: '12px' }}>
                                                                                        🛠️ {rep.titulo || 'Mantenimiento Ejecutado'}
                                                                                    </span>
                                                                                    {rep.tecnico && (
                                                                                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '750', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                            <HiOutlineUser size={13} /> {rep.tecnico}
                                                                                        </span>
                                                                                    )}
                                                                                </div>

                                                                                {/* Problema diagnosticado */}
                                                                                <div style={{ fontSize: '13px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                                    <strong style={{ color: '#0f172a', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Diagnóstico / Problema:</strong>
                                                                                    <span style={{ color: '#334155', background: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                                                                                        {rep.problema_cliente}
                                                                                    </span>
                                                                                </div>

                                                                                {/* Trabajo técnico realizado */}
                                                                                <div style={{ fontSize: '13px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                                    <strong style={{ color: '#0f172a', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Trabajo Realizado:</strong>
                                                                                    <span style={{ color: '#0f172a', fontWeight: '600', background: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #f1f5f9', whiteSpace: 'pre-line' }}>
                                                                                        {rep.trabajo_realizado}
                                                                                    </span>
                                                                                </div>

                                                                                {/* Piezas y Refacciones */}
                                                                                {rep.refacciones && (
                                                                                    <div style={{ fontSize: '13px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                                        <strong style={{ color: '#15803d', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Piezas y Refacciones Utilizadas:</strong>
                                                                                        <span style={{ color: '#166534', fontWeight: '700', background: '#f0fdf4', padding: '6px 12px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                                                                                            {rep.refacciones}
                                                                                        </span>
                                                                                    </div>
                                                                                )}

                                                                                {/* Materiales */}
                                                                                {rep.materiales && (
                                                                                    <div style={{ fontSize: '13px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                                        <strong style={{ color: '#0369a1', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Materiales Empleados:</strong>
                                                                                        <span style={{ color: '#0c4a6e', fontWeight: '600', background: '#f0f9ff', padding: '6px 12px', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                                                                                            {rep.materiales}
                                                                                        </span>
                                                                                    </div>
                                                                                )}

                                                                                {/* Galería de fotos */}
                                                                                {photoList.length > 0 && (
                                                                                    <div style={{ marginTop: '4px' }}>
                                                                                        <strong style={{ display: 'block', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', marginBottom: '6px' }}>
                                                                                            📷 Evidencia Fotográfica ({photoList.length}):
                                                                                        </strong>
                                                                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                                                            {photoList.map((p, pIdx) => (
                                                                                                <div
                                                                                                    key={pIdx}
                                                                                                    onClick={(e) => { e.stopPropagation(); setSelectedZoomPhoto(p.url); }}
                                                                                                    style={{
                                                                                                        position: 'relative',
                                                                                                        width: '58px',
                                                                                                        height: '58px',
                                                                                                        borderRadius: '8px',
                                                                                                        overflow: 'hidden',
                                                                                                        border: '1.5px solid #cbd5e1',
                                                                                                        cursor: 'pointer',
                                                                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
                                                                                                    }}
                                                                                                >
                                                                                                    <img src={p.url} alt={p.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                                                    <div style={{
                                                                                                        position: 'absolute',
                                                                                                        bottom: 0,
                                                                                                        left: 0,
                                                                                                        right: 0,
                                                                                                        background: 'rgba(15, 23, 42, 0.75)',
                                                                                                        color: '#ffffff',
                                                                                                        fontSize: '8px',
                                                                                                        fontWeight: '800',
                                                                                                        textAlign: 'center',
                                                                                                        padding: '1px 0'
                                                                                                    }}>
                                                                                                        {p.label}
                                                                                                    </div>
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>

                                                                {/* BOTÓN PARA ABRIR EL MODAL DE DETALLES Y PDF */}
                                                                {onViewReport && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            const rawTargetId = (finalReports.length > 0 && finalReports[0]?.id)
                                                                                || req.actualTrabajoId
                                                                                || req.reparacion_trabajo?.id
                                                                                || req.reparacion_trabajo_id
                                                                                || req.visita_trabajo?.id
                                                                                || req.visita_trabajo_id
                                                                                || req.original_id
                                                                                || (req.isJob || (!req.levantamiento_equipo_id && !req.reparacion_trabajo_id && !req.visita_trabajo_id) ? req.id : null);
                                                                            if (rawTargetId) {
                                                                                const targetId = Number(String(rawTargetId).replace('m-', '').replace('gen-', ''));
                                                                                onViewReport(targetId);
                                                                            }
                                                                        }}
                                                                        style={{
                                                                            width: '100%',
                                                                            marginTop: '15px',
                                                                            padding: '12px',
                                                                            background: 'linear-gradient(135deg, #f26522, #d14d13)',
                                                                            color: '#ffffff',
                                                                            border: 'none',
                                                                            borderRadius: '12px',
                                                                            fontWeight: '850',
                                                                            fontSize: '13px',
                                                                            cursor: 'pointer',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            gap: '8px',
                                                                            boxShadow: '0 4px 12px rgba(242, 101, 34, 0.25)',
                                                                            transition: 'all 0.2s ease'
                                                                        }}
                                                                        onMouseEnter={(e) => {
                                                                            e.currentTarget.style.transform = 'translateY(-1px)';
                                                                            e.currentTarget.style.boxShadow = '0 6px 14px rgba(242, 101, 34, 0.35)';
                                                                        }}
                                                                        onMouseLeave={(e) => {
                                                                            e.currentTarget.style.transform = 'translateY(0)';
                                                                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(242, 101, 34, 0.25)';
                                                                        }}
                                                                    >
                                                                        <HiOutlineClipboardDocumentList size={18} />
                                                                        Ver Reporte Detallado y PDF de Bitácora
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Zoom de Foto */}
            {selectedZoomPhoto && (
                <div 
                    onClick={() => setSelectedZoomPhoto(null)}
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.85)', zIndex: 20000,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '20px', cursor: 'zoom-out'
                    }}
                >
                    <img 
                        src={selectedZoomPhoto} 
                        alt="Evidencia Zoom" 
                        style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }} 
                    />
                </div>
            )}

            <style>{`
                .modal-card-no-scrollbar {
                    scrollbar-width: none; /* Firefox */
                    -ms-overflow-style: none; /* IE/Edge */
                }
                .modal-card-no-scrollbar::-webkit-scrollbar {
                    display: none; /* Chrome, Safari, Opera */
                }
                .modal-close-btn {
                    position: absolute;
                    top: 25px;
                    right: 25px;
                    background: #f1f5f9;
                    border: 1px solid #cbd5e1;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: #475569;
                    transition: all 0.2s ease;
                    padding: 0;
                    box-sizing: border-box;
                    z-index: 100;
                }
                .modal-close-btn:hover {
                    background: #fee2e2 !important;
                    color: #ef4444 !important;
                    border-color: #fca5a5 !important;
                }
                @media (max-width: 600px) {
                    .modal-card-no-scrollbar {
                        padding: 20px !important;
                        border-radius: 24px !important;
                    }
                    .modal-close-btn {
                        top: 15px !important;
                        right: 15px !important;
                    }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>,
        document.body
    );
};

export default HistorialEquipoModal;

