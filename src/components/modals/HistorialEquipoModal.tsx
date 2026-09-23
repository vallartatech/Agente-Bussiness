import React, { useState } from 'react';
import { createPortal } from "react-dom";
import { HiOutlineCalendarDays, HiOutlineWrenchScrewdriver, HiOutlineCheckCircle, HiChevronDown, HiChevronUp, HiOutlineClipboardDocumentList, HiOutlineCube } from "react-icons/hi2";

interface HistorialEquipoModalProps {
    isOpen: boolean;
    onClose: () => void;
    equipo: any;
    historial: any[];
    onViewReport?: (trabajoId: number) => void;
}

const HistorialEquipoModal: React.FC<HistorialEquipoModalProps> = ({ isOpen, onClose, equipo, historial, onViewReport }) => {
    const [expandedIds, setExpandedIds] = useState<number[]>([]);

    React.useEffect(() => {
        if (isOpen && equipo) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen, equipo]);

    if (!isOpen || !equipo) return null;

    const toggleExpand = (index: number) => {
        setExpandedIds(prev =>
            prev.includes(index) ? prev.filter(id => id !== index) : [...prev, index]
        );
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
                                <p style={{ margin: 0, fontWeight: '700', color: '#0f172a', fontSize: '14px' }}>{equipo.serie}</p>
                            </div>
                            <div style={{ background: '#f8fafc', padding: '10px 15px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>FABRICACIÓN / USO</span>
                                <p style={{ margin: 0, fontWeight: '700', color: '#0f172a', fontSize: '14px' }}>
                                    {equipo.anioFabricacion} <span style={{ color: '#cbd5e1' }}>/</span> {equipo.anioUso}
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

                                // Extraer reportes en tiempo real del JSON anidado por si el mapping superior falló
                                let rawReports = [...(req.reportes || [])];
                                [req.visita_trabajo, req.reparacion_trabajo].forEach(t => {
                                    if (t?.reporte?.solucion) {
                                        try {
                                            const p = typeof t.reporte.solucion === 'string' ? JSON.parse(t.reporte.solucion) : t.reporte.solucion;
                                            if (p.descripcion || p.reporteTienda || p.hallazgo) {
                                                rawReports.push({
                                                    id: t.id,
                                                    problema_cliente: p.reporteTienda || p.hallazgo || '—',
                                                    trabajo_realizado: p.descripcion || '—',
                                                    materiales: p.materiales || '',
                                                    refacciones: Array.isArray(p.refaccionesList)
                                                        ? p.refaccionesList.map((r: any) => `${r.cantidad}x ${r.pieza}`).join(' · ')
                                                        : ''
                                                });
                                            }
                                        } catch (e) { }
                                    }
                                });

                                // Si el item es un trabajo con reporte propio
                                if (req.reporte?.solucion || req.solucion) {
                                    try {
                                        const rawSol = req.reporte?.solucion || req.solucion;
                                        const p = typeof rawSol === 'string' ? JSON.parse(rawSol) : rawSol;
                                        if (p.descripcion || p.reporteTienda || p.hallazgo) {
                                            rawReports.push({
                                                id: req.id || req.original_id,
                                                problema_cliente: p.reporteTienda || p.hallazgo || req.descripcion || '—',
                                                trabajo_realizado: p.descripcion || req.descripcion || '—',
                                                materiales: p.materiales || '',
                                                refacciones: Array.isArray(p.refaccionesList)
                                                    ? p.refaccionesList.map((r: any) => `${r.cantidad}x ${r.pieza}`).join(' · ')
                                                    : ''
                                            });
                                        }
                                    } catch (e) { }
                                }

                                const seenReports = new Set();
                                const finalReports = rawReports.filter(r => {
                                    const key = `${r.problema_cliente}-${r.trabajo_realizado}-${r.materiales}`;
                                    if (seenReports.has(key)) return false;
                                    seenReports.add(key);
                                    return true;
                                });

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
                                            displayDate = isNaN(d.getTime()) ? String(itemDate) : d.toLocaleDateString('es-MX');
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
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '20px',
                                            background: '#ffffff',
                                            position: 'relative',
                                            overflow: 'hidden',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            boxShadow: isExpanded ? '0 10px 25px -5px rgba(15, 23, 42, 0.05)' : 'none'
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
                                                        <div style={{ textAlign: 'center', padding: '15px', background: '#f8fafc', borderRadius: '12px' }}>
                                                            <span style={{ color: '#64748b', fontSize: '13px' }}>Aún no hay reportes técnicos finalizados para esta intervención.</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                                {(req.visitas && req.visitas.length > 0) && (
                                                                    <div style={{ marginBottom: finalReports.length > 0 ? '15px' : '0' }}>
                                                                        <p style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', marginBottom: '8px', letterSpacing: '0.5px' }}>INTERVENCIONES TÉCNICAS:</p>
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                            {req.visitas.map((v: any, i: number) => (
                                                                                <div key={i} style={{ fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'flex-start', gap: '8px', background: '#f8fafc', padding: '10px', borderRadius: '10px' }}>
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
                                                                        <p style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', marginBottom: '8px', letterSpacing: '0.5px' }}>REPORTE TÉCNICO FORMAL:</p>
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                            {finalReports.map((rep: any, i: number) => (
                                                                                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                                    <div 
                                                                                        onClick={(e) => {
                                                                                            e.preventDefault();
                                                                                            e.stopPropagation();
                                                                                            const targetId = rep.id 
                                                                                                || req.reparacion_trabajo?.id 
                                                                                                || req.reparacion_trabajo_id 
                                                                                                || req.visita_trabajo?.id 
                                                                                                || req.visita_trabajo_id 
                                                                                                || req.actualTrabajoId 
                                                                                                || req.original_id
                                                                                                || (req.isJob ? req.id : null);
                                                                                            if (targetId) {
                                                                                                onViewReport?.(Number(String(targetId).replace('m-', '').replace('gen-', '')));
                                                                                            }
                                                                                        }}
                                                                                        style={{ fontSize: '13px', color: '#475569', cursor: 'pointer', transition: 'all 0.2s', position: 'relative', display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '5px' }}
                                                                                    >
                                                                                        <p style={{ margin: '0', display: 'flex', gap: '8px' }}>
                                                                                            <strong style={{ color: '#475569', minWidth: '130px', flexShrink: 0 }}>Problema reportado:</strong>
                                                                                            <span style={{ color: '#334155' }}>{rep.problema_cliente}</span>
                                                                                        </p>
                                                                                        <p style={{ margin: '0', display: 'flex', gap: '8px' }}>
                                                                                            <strong style={{ color: '#475569', minWidth: '130px', flexShrink: 0 }}>Trabajo realizado:</strong>
                                                                                            <span style={{ color: '#334155' }}>{rep.trabajo_realizado}</span>
                                                                                        </p>
                                                                                        {rep.refacciones && (
                                                                                            <p style={{ margin: '0', display: 'flex', gap: '8px' }}>
                                                                                                <strong style={{ color: '#475569', minWidth: '130px', flexShrink: 0 }}>Piezas utilizadas:</strong>
                                                                                                <span style={{ color: '#334155' }}>{rep.refacciones}</span>
                                                                                            </p>
                                                                                        )}
                                                                                    </div>
                                                                                    {rep.materiales && (
                                                                                        <div style={{ fontSize: '13px', padding: '12px 15px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #cbd5e1', display: 'flex', gap: '8px' }}>
                                                                                            <strong style={{ color: '#475569', minWidth: '130px', flexShrink: 0 }}>Materiales usados:</strong>
                                                                                            <span style={{ color: '#334155' }}>{rep.materiales}</span>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>

                                                                        {/* BOTÓN PARA ABRIR EL MODAL DE DETALLES */}
                                                                        {onViewReport && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.preventDefault();
                                                                                    e.stopPropagation();
                                                                                    const rawTargetId = (finalReports.length > 0 && finalReports[finalReports.length - 1]?.id)
                                                                                        || req.reparacion_trabajo?.id
                                                                                        || req.reparacion_trabajo_id
                                                                                        || req.visita_trabajo?.id
                                                                                        || req.visita_trabajo_id
                                                                                        || req.actualTrabajoId
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
                                                                                    fontWeight: '800',
                                                                                    fontSize: '13px',
                                                                                    cursor: 'pointer',
                                                                                    display: 'flex',
                                                                                    alignItems: 'center',
                                                                                    justifyContent: 'center',
                                                                                    gap: '8px',
                                                                                    boxShadow: '0 4px 12px rgba(254, 191, 1, 0.2)',
                                                                                    transition: 'all 0.2s ease'
                                                                                }}
                                                                                onMouseEnter={(e) => {
                                                                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                                                                    e.currentTarget.style.boxShadow = '0 6px 14px rgba(254, 191, 1, 0.3)';
                                                                                }}
                                                                                onMouseLeave={(e) => {
                                                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(254, 191, 1, 0.2)';
                                                                                }}
                                                                            >
                                                                                <HiOutlineClipboardDocumentList size={18} />
                                                                                Ver Reporte Detallado y PDF
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                        </>
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
