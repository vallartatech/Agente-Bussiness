import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlinePencil, HiOutlineTrash, HiOutlineChevronRight } from 'react-icons/hi2';
import { isCardSeen, markCardAsSeen } from '../../../utils/seenCards';
import { isAutonomoAdmin } from '../../../utils/roles';
import type { Trabajo } from '../../../types/trabajo.types';

interface JobCardProps {
    trabajo: Trabajo;
    index: number;
    user: any;
    activeSlide: number;
    onSlideChange: (trabajoId: string, newSlide: number) => void;
    onZoomImage: (url: string) => void;
    onEdit: (e: React.MouseEvent, job: Trabajo) => void;
    onDelete: (e: React.MouseEvent, job: Trabajo) => void;
    onAceptarCotizacion: (jobId: number) => void;
    onRechazarCotizacion: (jobId: number) => void;
    parseFotoUrls: (url: any) => string[];
    styles: Record<string, string>;
}

// ─── Helpers de estado/color ────────────────────────────────────────────────

const getBarClass = (job: Trabajo, userRole: string, styles: Record<string, string>): string => {
    const status = (job.estado || '').toLowerCase();
    if (status === 'cancelado') return styles.red;
    if (status === 'finalizado') return styles.green;
    if (status === 'rechazado por técnico' || status === 'rechazado por tecnico') return styles.red;
    if (job.tipo === 'SOS') return styles.red;
    if (status.includes('recotiz')) return styles.orange;
    if (status.includes('cotizaci')) {
        if (status.includes('aceptada') || status.includes('aprobada')) return styles.green;
        if (status.includes('rechazada')) return styles.red;
        if (status.includes('enviada')) return styles.blue;
        return styles.orange;
    }
    if (status === 'en espera') {
        const hasTech = job.tecnico && job.tecnico !== 'Sin asignar' && job.tecnico !== 'Sin Asignar';
        return hasTech ? styles.orange : styles.yellow;
    }
    if (status === 'en proceso') return styles.blue;
    if (status === 'solicitud' || status === 'pendiente' || status === 'asignado') {
        const hasTech = job.tecnico && job.tecnico !== 'Sin asignar' && job.tecnico !== 'Sin Asignar';
        return hasTech ? styles.orange : styles.yellow;
    }
    if (status === 'visita asignada' || status === 'reparación asignada' || status === 'reparacion asignada') return styles.orange;
    if (status === 'diagnosticado') return styles.blue;
    if (job.tecnico && job.tecnico !== 'Sin asignar' && job.tecnico !== 'Sin Asignar') {
        return userRole === 'tecnico' ? styles.orange : styles.blue;
    }
    return styles.yellow;
};

const getStatusText = (job: Trabajo, userRole: string): string => {
    const status = (job.estado || '').toLowerCase();
    if (status === 'cancelado') return 'SOLICITUD CANCELADA';
    if (status === 'finalizado') return 'Finalizado';
    if (status === 'rechazado por técnico' || status === 'rechazado por tecnico')
        return userRole === 'tecnico' ? 'RECHAZASTE ESTA ASIGNACIÓN' : 'RECHAZADO POR TÉCNICO';
    if (job.tipo === 'SOS') return '¡ALERTA SOS!';
    if (status.includes('recotiz'))
        return (userRole === 'tecnico' || userRole === 'tecnico-normal' || userRole === 'tecnico-autonomo' || userRole === 'autonomo')
            ? 'RECOTIZACIÓN ASIGNADA'
            : 'RECOTIZACIÓN SOLICITADA';
    if (status.includes('cotizaci')) {
        if (status.includes('aceptada') || status.includes('aprobada')) return 'COTIZACIÓN ACEPTADA';
        if (status.includes('rechazada')) return 'COTIZACIÓN RECHAZADA';
        if (status.includes('enviada')) return 'COTIZACIÓN ENVIADA';
        return 'PROCESO DE COTIZACIÓN';
    }
    if (status === 'en espera') {
        const hasTech = job.tecnico && job.tecnico !== 'Sin asignar' && job.tecnico !== 'Sin Asignar';
        return hasTech ? 'TÉCNICO EN CAMINO' : 'EN ESPERA DE ASIGNACIÓN';
    }
    if (status === 'en proceso') return 'TÉCNICO ACEPTADO';
    if (status === 'visita asignada') return 'VISITA TÉCNICA ASIGNADA';
    if (status === 'diagnosticado') return 'EN PROCESO DE DIAGNÓSTICO';
    if (status === 'reparación asignada' || status === 'reparacion asignada') return 'REPARACIÓN FINAL ASIGNADA';
    if (status === 'solicitud' || status === 'pendiente' || status === 'asignado') {
        const hasTech = job.tecnico && job.tecnico !== 'Sin asignar' && job.tecnico !== 'Sin Asignar';
        return hasTech ? 'SOLICITUD POR ACEPTAR' : 'SOLICITUD';
    }
    if (job.tecnico && job.tecnico !== 'Sin asignar' && job.tecnico !== 'Sin Asignar') {
        return userRole === 'tecnico'
            ? (job.tipo === 'Visita' ? 'ASIGNACIÓN DE VISITA' : 'SE TE ASIGNÓ ESTE TRABAJO 🛠️')
            : 'TÉCNICO ASIGNADO';
    }
    return job.estado || 'Pendiente';
};

const getAccentForStatus = (estado: string) => {
    const s = (estado || '').toLowerCase();
    if (s.includes('recotiz'))
        return { grad: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', shadow: 'rgba(245,158,11,0.35)', dot: '🔁' };
    if (['solicitud', 'pendiente'].includes(s))
        return { grad: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', shadow: 'rgba(245,158,11,0.35)', dot: '🟡' };
    if (['cotización enviada', 'cotizacion enviada', 'cotización aceptada', 'cotizacion aceptada'].includes(s))
        return { grad: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', shadow: 'rgba(59,130,246,0.35)', dot: '🔵' };
    if (['aceptada', 'asignado', 'en espera'].includes(s))
        return { grad: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', shadow: 'rgba(249,115,22,0.35)', dot: '🟠' };
    if (s === 'en proceso')
        return { grad: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', shadow: 'rgba(16,185,129,0.35)', dot: '🟢' };
    if (['finalizado', 'completado'].includes(s))
        return { grad: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', shadow: 'rgba(139,92,246,0.35)', dot: '🟣' };
    return { grad: 'linear-gradient(135deg, #64748b 0%, #475569 100%)', shadow: 'rgba(100,116,139,0.35)', dot: '⚪' };
};

// ─── Componente principal ────────────────────────────────────────────────────

const JobCard: React.FC<JobCardProps> = ({
    trabajo,
    index,
    user,
    activeSlide,
    onSlideChange,
    onZoomImage,
    onEdit,
    onDelete,
    onAceptarCotizacion,
    onRechazarCotizacion,
    parseFotoUrls,
    styles,
}) => {
    const navigate = useNavigate();
    const userRole = user?.role || 'user';

    const seenAccent = getAccentForStatus(trabajo.estado);
    const barClass = getBarClass(trabajo, userRole, styles);
    const statusText = getStatusText(trabajo, userRole);

    const items = (trabajo as any).jobsInGroup || [trabajo];
    const currentItem = items[activeSlide] || items[0] || trabajo;
    const currentPhotos = parseFotoUrls(currentItem.foto_url);

    const getBasePath = (): string => {
        if (userRole === 'tecnico') return '/tecnico';
        if (userRole === 'cliente') return '/cliente';
        if (isAutonomoAdmin(user?.role)) return '/autonomo';
        if (userRole === 'encargado' || userRole === 'gerente-sucursal') return '/gerente-sucursal';
        return '/menu';
    };

    const handleCardClick = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        markCardAsSeen(userRole, trabajo.id, trabajo.estado);
        const basePath = getBasePath();
        if ((trabajo as any).isMantenimiento) {
            navigate(`${basePath}/mantenimiento-detalle/${(trabajo as any).original_id}`);
        } else {
            navigate(`${basePath}/trabajo-detalle/${currentItem.id}`);
        }
    };

    // Badge de prioridad
    const renderPriorityBadge = (extraClass?: string) => {
        let text = (trabajo as any).prioridad || 'Media';
        let badgeClass = styles.badgeMedia;
        if (trabajo.estado === 'Finalizado') { text = 'Finalizado'; badgeClass = styles.badgeFinalizado; }
        else if (trabajo.estado === 'En Proceso') { text = 'En proceso'; badgeClass = styles.badgeEnProceso; }
        else if ((trabajo as any).prioridad === 'Alta' || trabajo.tipo === 'SOS' || trabajo.isEmergency) { text = 'Alta'; badgeClass = styles.badgeAlta; }
        else if ((trabajo as any).prioridad === 'Baja') { text = 'Baja'; badgeClass = styles.badgeBaja; }
        return (
            <span className={`${styles.statusPriorityBadge} ${badgeClass} ${extraClass || ''}`}>{text}</span>
        );
    };

    return (
        <div
            className={`${styles.jobCard} ${barClass}`}
            onClick={handleCardClick}
        >
            {/* Barra de estado */}
            <div className={`${styles.statusBar} ${barClass}`}>{statusText}</div>

            {/* Badge "DIAGNÓSTICO LISTO" */}
            {!!trabajo.visitado && (trabajo.estado === 'Solicitud' || trabajo.estado === 'En Espera') && (
                <div style={{
                    position: 'absolute', right: '-10px', top: '10px', background: '#00a699', color: 'white',
                    padding: '6px 16px', borderRadius: '12px', fontSize: '11px', fontWeight: '900',
                    textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(0, 166, 153, 0.4)', zIndex: 20, letterSpacing: '0.5px'
                }}>
                    DIAGNÓSTICO LISTO
                </div>
            )}

            {trabajo.visitado && trabajo.estado === 'Solicitud' && (
                <div className={styles.diagnosisBanner}>
                    <div className={styles.diagnosisIconWrapper}>🛡️</div>
                    <div className={styles.diagnosisTextGroup}>
                        <p className={styles.diagnosisTitle}>AVISO DE DIAGNÓSTICO</p>
                        <p className={styles.diagnosisText}>Diagnóstico listo para ser revisado.</p>
                    </div>
                </div>
            )}

            {/* Cuerpo de la tarjeta */}
            <div className={styles.cardBodyWrapper}>

                {/* Fotos / Placeholder a la izquierda */}
                <div className={styles.verticalCarousel} onClick={e => e.stopPropagation()}>
                    {currentPhotos.length > 0 ? (
                        currentPhotos.map((photoUrl, pIdx) => (
                            <img
                                key={`${currentItem.id}-photo-${pIdx}`}
                                src={photoUrl}
                                alt={`Evidencia ${pIdx + 1} de ${currentPhotos.length}`}
                                className={styles.carouselImg}
                                onClick={() => onZoomImage(photoUrl)}
                                title={`Ver foto ${pIdx + 1}`}
                            />
                        ))
                    ) : (
                        <div className={styles.placeholderImg}>
                            📷
                        </div>
                    )}
                </div>

                {/* Contenido principal */}
                <div className={styles.cardContent}>
                    <div className={styles.cardLeftDetails}>

                        {/* Fechas y badges de encabezado */}
                        <div className={styles.headerRow}>
                            <div className={styles.dateGroup}>
                                {!isCardSeen(userRole, trabajo.id, trabajo.estado) && (
                                    <span className={styles.newBadgeMini} style={{ background: seenAccent.grad, boxShadow: `0 2px 8px ${seenAccent.shadow}` }}>
                                        {seenAccent.dot} NUEVO
                                    </span>
                                )}
                                {items.length > 1 && (
                                    <span className={styles.loteBadge}>
                                        📦 Solicitud en Lote ({items.length} servicios)
                                    </span>
                                )}
                                {(trabajo.fechaAsignada || trabajo.fecha) && (
                                    <span className={styles.strikingDate}>
                                        📅 Cita solicitada: {trabajo.fechaAsignada || trabajo.fecha}
                                    </span>
                                )}
                                {(trabajo as any).hora_llegada && (
                                    <span className={styles.technicianArrivalTag}>
                                        📍 Técnico en sitio ({(trabajo as any).hora_llegada})
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Info */}
                        <div className={styles.cardInfo}>
                            <h3 className={styles.jobTitle}>
                                {currentItem.titulo.split(' - ')[0]}
                            </h3>

                            <div className={styles.descriptionBox}>
                                {(() => {
                                    const rawDesc = currentItem.descripcion?.replace(/\[Grupo:\s*REQ-\d+\]\s*\n?/, '') || '';
                                    const eqMatch = rawDesc.match(/\[Equipo:\s*([^\]]+)\]/i);
                                    const eqText = eqMatch ? eqMatch[1] : null;
                                    const cleanDesc = rawDesc.replace(/\[Equipo:\s*[^\]]+\]\s*\n?/i, '').trim();

                                    return (
                                        <>
                                            {eqText && (
                                                <div className={styles.equipmentInlineTag}>
                                                    ⚙️ <strong>Equipo:</strong> {eqText}
                                                </div>
                                            )}
                                            <p>
                                                {cleanDesc || 'Servicio solicitado sin descripción adicional.'}
                                            </p>
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Cotización */}
                            {((['Cotización Enviada', 'Cotización Aceptada', 'Cotización Rechazada', 'Recotización Solicitada', 'Cotización'].includes(trabajo.estado) || trabajo.estado.toLowerCase().includes('cotizaci') || trabajo.estado.toLowerCase().includes('recotiz')) && trabajo.cotizacion) && (
                                <div className={styles.cotizacionPreviewBox} onClick={e => e.stopPropagation()}>
                                    <p className={styles.cotizacionPreviewText}>
                                        {userRole === 'admin' ? '💰 Cotización Enviada' : '💰 Cotización del Trabajo'}: ${trabajo.cotizacion.costo}
                                    </p>
                                    {userRole === 'cliente' && trabajo.estado === 'Cotización Enviada' && (
                                        <div style={{ display: 'flex', gap: '5px', marginTop: '6px' }}>
                                            <button onClick={() => onAceptarCotizacion(trabajo.id)} style={{ flex: 1, padding: '5px', background: '#22c55e', color: 'white', borderRadius: '5px', border: 'none', fontSize: '12px', cursor: 'pointer' }}>Aceptar</button>
                                            <button onClick={() => onRechazarCotizacion(trabajo.id)} style={{ flex: 1, padding: '5px', background: '#ef4444', color: 'white', borderRadius: '5px', border: 'none', fontSize: '12px', cursor: 'pointer' }}>Rechazar</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer: técnico y acciones */}
                        <div className={styles.footerRow}>
                            <div className={styles.technicianInfo}>
                                {trabajo.tecnico !== 'Sin asignar' ? `👤 ${trabajo.tecnico}` : `🏢 ${trabajo.ubicacion}`}
                            </div>

                            <div className={styles.actionsCard}>
                                {/* Botón cotizar (solo admin, visitado y sin cotización) */}
                                {trabajo.visitado && !trabajo.cotizacion && userRole === 'admin' && trabajo.estado === 'Solicitud' && (
                                    <button
                                        className={styles.btnCotizar}
                                        onClick={e => { e.stopPropagation(); navigate(`/menu/admin-reporte/${trabajo.id}`); }}
                                    >
                                        💰 Cotizar
                                    </button>
                                )}

                                {/* Badge tipo de trabajo */}
                                {trabajo.tipo && (
                                    <span className={styles.jobTypeBadge}>
                                        {trabajo.estado === 'Finalizado' && trabajo.tipo === 'SOS' ? 'Finalizado' : trabajo.tipo}
                                    </span>
                                )}

                                {/* Badge prioridad (solo móvil) */}
                                {renderPriorityBadge(styles.mobileOnlyStatusBadge)}

                                {/* Editar (cliente) */}
                                {userRole === 'cliente' && trabajo.estado !== 'Finalizado' && trabajo.estado !== 'Completado' && (
                                    <button
                                        className={styles.editBtnSmall}
                                        onClick={e => { e.stopPropagation(); onEdit(e, trabajo); }}
                                        title="Editar"
                                    >
                                        <HiOutlinePencil size={15} />
                                    </button>
                                )}

                                {/* Eliminar (admin) */}
                                {userRole === 'admin' && (
                                    <div className={styles.actionBtns} onClick={e => e.stopPropagation()}>
                                        <button className={styles.trashBtn} onClick={e => onDelete(e, trabajo)} title="Eliminar"><HiOutlineTrash size={15} /></button>
                                    </div>
                                )}

                                {/* Eliminar (cliente) */}
                                {userRole === 'cliente' && trabajo.estado !== 'Finalizado' && trabajo.estado !== 'Completado' && (
                                    <button className={styles.trashBtn} onClick={e => onDelete(e, trabajo)} title="Eliminar"><HiOutlineTrash size={15} /></button>
                                )}

                                {/* Carousel multi-servicio */}
                                {items.length > 1 && (
                                    <div className={styles.multiServicePager} onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => onSlideChange(String(trabajo.id), Math.max(0, activeSlide - 1))}
                                            disabled={activeSlide === 0}
                                            className={`${styles.pagerBtn} ${activeSlide === 0 ? styles.pagerBtnDisabled : ''}`}
                                        >▲</button>
                                        <span className={styles.pagerText}>{activeSlide + 1}/{items.length}</span>
                                        <button
                                            onClick={() => onSlideChange(String(trabajo.id), Math.min(items.length - 1, activeSlide + 1))}
                                            disabled={activeSlide === items.length - 1}
                                            className={`${styles.pagerBtn} ${activeSlide === items.length - 1 ? styles.pagerBtnDisabled : ''}`}
                                        >▼</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Badge prioridad (desktop) */}
                    <div className={styles.cardRightStatus}>
                        {renderPriorityBadge()}
                        <HiOutlineChevronRight className={styles.cardChevron} size={20} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JobCard;
