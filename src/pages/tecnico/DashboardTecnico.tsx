import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './DashboardTecnico.module.css';
import { getTrabajos } from '../../services/trabajosService';
import { getUsers } from '../../services/usersService';
import { getTrabajadores } from '../../services/trabajadoresService';
import { isAutonomoAdmin } from '../../utils/roles';
import { HiOutlineUser, HiOutlineClock, HiArrowPath, HiOutlineBuildingOffice } from 'react-icons/hi2';
import { useAuth } from '../../context/AuthContext';
import { isCardSeen, markCardAsSeen } from '../../utils/seenCards';

interface Trabajo {
    id: number;
    titulo: string;
    descripcion: string;
    estado: string;
    prioridad: string;
    tipo: string;
    created_at: string;
    fecha_programada?: string;
    admin_autonomo_id?: number;
    trabajador_id?: number;
    negocio?: {
        nombre: string;
    };
    trabajador?: {
        user_id: number;
        nombre: string;
    };
    // Extra fields fetched
    subgerenteName?: string;
    horaLlegada?: string;
    hora_llegada?: string;
}

const DashboardTecnico: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [activeColIndex, setActiveColIndex] = useState(0);
    const boardRef = useRef<HTMLDivElement>(null);

    const scrollToColumn = (index: number) => {
        setActiveColIndex(index);
        if (boardRef.current) {
            const columns = boardRef.current.querySelectorAll(`.${styles.column}`);
            if (columns[index]) {
                columns[index].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    };

    const handleBoardScroll = () => {
        if (!boardRef.current) return;
        const scrollLeft = boardRef.current.scrollLeft;
        const width = boardRef.current.clientWidth;
        const index = Math.round(scrollLeft / (width * 0.85));
        if (index >= 0 && index <= 3 && index !== activeColIndex) {
            setActiveColIndex(index);
        }
    };

    const fetchData = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);

        try {
            // 1. Fetch trabajos, users and trabajadores
            const [trabajosData, usersData, trabajadoresData] = await Promise.all([
                getTrabajos().catch(() => []),
                getUsers().catch(() => []),
                getTrabajadores().catch(() => [])
            ]);

            // Identificar el ID del trabajador para el usuario autenticado
            const currentTrabajador = (Array.isArray(trabajadoresData) ? trabajadoresData : []).find((w: any) => 
                (user?.id && (w.user_id === user.id || w.userId === user.id)) || 
                (user?.email && w.correo && w.correo.toLowerCase() === user.email.toLowerCase()) ||
                (user?.name && w.nombre && w.nombre.toLowerCase().trim() === user.name.toLowerCase().trim())
            );
            const currentTechId = currentTrabajador?.id || (user as any)?.trabajador?.id || null;

            // 2. Map subgerentes / encargados
            const subgerentesMap = new Map<number, string>();
            (Array.isArray(usersData) ? usersData : []).forEach((u: any) => {
                if (isAutonomoAdmin(u.role?.name) || u.role?.name === 'encargado' || u.role?.name === 'subgerente') {
                    subgerentesMap.set(u.id, u.name);
                }
            });

            // 3. Process and filter jobs for this technician
            const rawJobs = Array.isArray(trabajosData) ? trabajosData : [];
            let processedJobs: Trabajo[] = rawJobs
                .filter((t: any) => {
                    const isUserMatch = 
                        (currentTechId && (t.trabajador_id === currentTechId || t.trabajador?.id === currentTechId)) ||
                        (user?.id && (t.trabajador?.user_id === user.id || t.trabajador_id === user.id)) ||
                        (user?.name && t.tecnico && t.tecnico.toLowerCase().trim().includes(user.name.toLowerCase().trim())) ||
                        (user?.name && t.trabajador?.nombre && t.trabajador.nombre.toLowerCase().trim().includes(user.name.toLowerCase().trim()));
                    return isUserMatch;
                })
                .map((t: any) => {
                    const encName = t.encargado || t.negocio?.encargado || (t.admin_autonomo_id ? subgerentesMap.get(t.admin_autonomo_id) : null);
                    return {
                        ...t,
                        subgerenteName: (encName && encName !== 'Asignado') ? encName : (t.encargado || t.negocio?.encargado || '')
                    };
                });

            // 4. Group multi-service requests [Grupo: REQ-xxxx] into single unified cards
            const getGroupId = (descripcion?: string) => {
                if (!descripcion) return null;
                const match = descripcion.match(/\[Grupo:\s*(REQ-\d+)\]/);
                return match ? match[1] : null;
            };

            const groupedByReq: { [key: string]: Trabajo[] } = {};
            const singleJobsList: Trabajo[] = [];

            processedJobs.forEach(job => {
                const grpId = getGroupId(job.descripcion);
                if (grpId) {
                    if (!groupedByReq[grpId]) groupedByReq[grpId] = [];
                    groupedByReq[grpId].push(job);
                } else {
                    singleJobsList.push(job);
                }
            });

            Object.entries(groupedByReq).forEach(([grpId, jobsInGroup]) => {
                jobsInGroup.sort((a, b) => Number(a.id) - Number(b.id));
                const baseJob = { ...jobsInGroup[0] } as any;
                baseJob.isGroupHeader = true;
                baseJob.groupId = grpId;
                baseJob.jobsInGroup = jobsInGroup;

                const serviceTypes = jobsInGroup.map(j => (j.titulo || '').split(" - ")[0]);
                const uniqueTypes = Array.from(new Set(serviceTypes));
                const suffix = baseJob.titulo && baseJob.titulo.includes(" - ") ? " - " + baseJob.titulo.split(" - ").slice(1).join(" - ") : "";
                baseJob.titulo = `${uniqueTypes.join(", ")}${suffix}`;

                baseJob.descripcion = `[Grupo: ${grpId}]\n` + jobsInGroup.map((j, idx) => {
                    const cleanDesc = j.descripcion?.replace(/\[Grupo:\s*REQ-\d+\]\s*\n?/, "") || "";
                    const svcName = (j.titulo || '').split(" - ")[0];
                    return `${idx + 1}. ${svcName}: ${cleanDesc}`;
                }).join("\n");

                singleJobsList.push(baseJob);
            });

            setTrabajos(singleJobsList);
            setLastUpdated(new Date());
        } catch (error) {
            console.error("Error fetching tablero data", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Polling every 15 seconds
        const interval = setInterval(() => {
            fetchData(true);
        }, 15000);
        return () => clearInterval(interval);
    }, [user]);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '380px' }}>
                <h3 style={{ color: '#64748b' }}>Cargando Tablero...</h3>
            </div>
        );
    }

    // Filter columns as per request:
    // 1. Solicitudes pendientes
    const colSolicitudes = trabajos.filter(t => ['Solicitud', 'Pendiente'].includes(t.estado));
    
    const isSOSJob = (t: any) => t.tipo === 'SOS' || t.prioridad === 'Emergencia' || (t.titulo || '').includes('SOS') || t.isEmergency;

    // 2. Asignaciones de visitas (Visitas pendientes de evaluación del técnico en campo, antes de enviar al admin, o recotizaciones solicitadas)
    const colVisita = trabajos.filter(t => 
        (
            ['En Proceso', 'Asignado', 'Aceptada', 'En Espera'].includes(t.estado) && 
            (t.tipo === 'Visita' || isSOSJob(t)) && 
            !t.visitado &&
            !['Cotización Aceptada', 'Cotización Aprobada', 'En Ejecución', 'Cotización Enviada', 'Cotización Rechazada'].includes(t.estado)
        ) ||
        t.estado === 'Recotización Solicitada' ||
        (typeof t.estado === 'string' && t.estado.toLowerCase().includes('recotiz'))
    );
    
    // 3. Asignaciones de trabajo (Cotización Aceptada por cliente, En Ejecución, Trabajos directos asignados)
    const colProceso = trabajos.filter(t => 
        (
            ['Cotización Aceptada', 'Cotización Aprobada', 'En Ejecución'].includes(t.estado) ||
            (t.tipo !== 'Visita' && !isSOSJob(t) && ['En Proceso', 'Asignado', 'Aceptada', 'En Espera', 'Cotización Enviada', 'Cotización Rechazada'].includes(t.estado))
        ) &&
        t.estado !== 'Recotización Solicitada' &&
        !(typeof t.estado === 'string' && t.estado.toLowerCase().includes('recotiz'))
    );
    
    // 4. Trabajos finalizados
    const colFinalizadas = trabajos.filter(t => ['Finalizado', 'Completado'].includes(t.estado));

    // Column accent colors
    const COL_COLORS = {
        yellow:  { grad: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', shadow: 'rgba(245,158,11,0.35)', dot: '🟡' },
        orange:  { grad: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', shadow: 'rgba(249,115,22,0.35)', dot: '🟠' },
        green:   { grad: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', shadow: 'rgba(16,185,129,0.35)', dot: '🟢' },
        purple:  { grad: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', shadow: 'rgba(139,92,246,0.35)', dot: '🟣' },
    };

    const renderCard = (t: Trabajo, colKey: keyof typeof COL_COLORS = 'yellow') => {
        const rawDesc = t.descripcion_problema || (t as any).descripcion || (t as any).problema || (t as any).detalles || (t as any).observaciones || (t as any).reporteTienda || '';
        let problemaReportado = rawDesc;
        problemaReportado = problemaReportado.replace(/\[Grupo:\s*REQ-\d+\]\s*\n?/gi, '').trim();
        const match = problemaReportado.match(/^\[Técnico sugerido:\s*([^\]]+)\]\s*/i);
        if (match) {
            problemaReportado = problemaReportado.substring(match[0].length).trim();
        }

        const userRole = user?.role || 'tecnico';
        const isSeen = isCardSeen(userRole, t.id, t.estado);
        const accent = COL_COLORS[colKey];
        const isGroup = !!(t as any).isGroupHeader && (t as any).jobsInGroup?.length > 1;
        const isRecotiz = t.estado === 'Recotización Solicitada' || (typeof t.estado === 'string' && t.estado.toLowerCase().includes('recotiz'));

        const handleCardClick = () => {
            markCardAsSeen(userRole, t.id, t.estado);
            const basePath = user?.role === 'tecnico-autonomo' ? '/tecnico-autonomo' : '/tecnico';
            navigate(`${basePath}/trabajo-detalle/${t.id}`);
        };

        return (
            <div key={t.id} className={styles.card} onClick={handleCardClick}>
                <div className={styles.cardHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className={styles.jobId}>#{t.id}</span>
                        {isGroup && (
                            <span style={{
                                background: '#fef3c7',
                                color: '#b45309',
                                border: '1px solid #fde68a',
                                fontSize: '10px',
                                fontWeight: '800',
                                padding: '2px 6px',
                                borderRadius: '6px'
                            }}>
                                📦 {(t as any).jobsInGroup.length} Servicios
                            </span>
                        )}
                        {!isSeen && (
                            <span style={{
                                background: accent.grad,
                                color: '#ffffff',
                                fontSize: '10px',
                                fontWeight: '900',
                                padding: '3px 8px',
                                borderRadius: '20px',
                                boxShadow: `0 2px 8px ${accent.shadow}`,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                {accent.dot} NUEVO
                            </span>
                        )}
                    </div>
                    <span className={`${styles.priorityBadge} ${t.prioridad === 'Alta' ? styles.priorityAlta : (t.prioridad === 'Media' ? styles.priorityMedia : styles.priorityBaja)}`}>
                        {t.prioridad}
                    </span>
                </div>

                {isRecotiz && (
                    <div style={{
                        background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
                        border: '1.5px solid #fdba74',
                        borderRadius: '8px',
                        padding: '6px 10px',
                        marginTop: '8px',
                        marginBottom: '4px',
                        fontSize: '11px',
                        fontWeight: '800',
                        color: '#c2410c',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 1px 3px rgba(234, 88, 12, 0.1)'
                    }}>
                        <span style={{ fontSize: '13px' }}>🔁</span>
                        <span>RECOTIZACIÓN ASIGNADA</span>
                    </div>
                )}
                
                <h4 className={styles.cardTitle}>{t.titulo}</h4>
                
                <div className={styles.infoRow}>
                    <HiOutlineBuildingOffice size={16} />
                    <span className={styles.strongText}>{t.negocio?.nombre || 'Sin sucursal'}</span>
                </div>

                {/* PROBLEMA REPORTADO DESTACADO */}
                {problemaReportado && problemaReportado !== '—' && (
                    <div style={{
                        background: '#fefce8',
                        border: '1.5px solid #fef08a',
                        borderRadius: '10px',
                        padding: '10px 12px',
                        marginTop: '8px',
                        marginBottom: '8px',
                        fontSize: '12px',
                        color: '#713f12',
                        boxShadow: '0 2px 5px rgba(234, 179, 8, 0.15)',
                        maxWidth: '100%',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                        wordBreak: 'break-all',
                        overflowWrap: 'anywhere'
                    }}>
                        <span style={{ fontWeight: '900', color: '#d97706', display: 'block', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                            {isGroup ? '📝 Problemas en esta Solicitud:' : '📝 Problema Especificado por Encargado:'}
                        </span>
                        <span style={{ 
                            fontWeight: '600', 
                            color: '#1e293b', 
                            fontSize: '13px', 
                            lineHeight: '1.4', 
                            display: 'block', 
                            whiteSpace: isGroup ? 'pre-line' : 'normal',
                            wordBreak: 'break-all',
                            overflowWrap: 'anywhere',
                            maxWidth: '100%'
                        }}>
                            {isGroup ? problemaReportado : `"${problemaReportado}"`}
                        </span>
                    </div>
                )}
                
                {t.subgerenteName && t.subgerenteName !== 'Sin Asignar' && t.subgerenteName !== 'Asignado' && (
                    <div className={styles.infoRow}>
                        <HiOutlineUser size={16} />
                        <span>Encargado: <span className={styles.strongText}>{t.subgerenteName}</span></span>
                    </div>
                )}

                {t.hora_llegada && (
                    <div style={{ background: '#ecfdf5', color: '#059669', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', marginBottom: '8px', display: 'inline-block' }}>
                        ⏰ Llegada confirmada: {t.hora_llegada}
                    </div>
                )}

                <div className={styles.cardFooter}>
                    <div className={styles.dateText}>
                        <HiOutlineClock size={14} />
                        {new Date(t.created_at).toLocaleDateString()}
                    </div>
                    <span style={{ fontWeight: '600', color: '#0ea5e9' }}>
                        {t.tipo === 'Visita' ? 'Visita' : 'Trabajo'}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className={styles.tableroContainer}>
            <div className={styles.header}>
                <div>
                    <h1>Mi Tablero de Trabajos</h1>
                    <p>Monitoreo de mis solicitudes y tareas asignadas</p>
                </div>
                {refreshing && (
                    <div className={styles.refreshBadge}>
                        <HiArrowPath className={styles.spinIcon} /> Actualizando...
                    </div>
                )}
            </div>

            {/* TABS DE COLUMNA PARA MÓVIL */}
            <div className={styles.mobileColumnTabs}>
                <button
                    className={`${styles.tabBtn} ${styles.tabYellow} ${activeColIndex === 0 ? styles.tabActive : ''}`}
                    onClick={() => scrollToColumn(0)}
                >
                    🟡 Solicitudes ({colSolicitudes.length})
                </button>
                <button
                    className={`${styles.tabBtn} ${styles.tabOrange} ${activeColIndex === 1 ? styles.tabActive : ''}`}
                    onClick={() => scrollToColumn(1)}
                >
                    🟣 Visitas ({colVisita.length})
                </button>
                <button
                    className={`${styles.tabBtn} ${styles.tabGreen} ${activeColIndex === 2 ? styles.tabActive : ''}`}
                    onClick={() => scrollToColumn(2)}
                >
                    🟠 Trabajos ({colProceso.length})
                </button>
                <button
                    className={`${styles.tabBtn} ${styles.tabPurple} ${activeColIndex === 3 ? styles.tabActive : ''}`}
                    onClick={() => scrollToColumn(3)}
                >
                    🟢 Finalizados ({colFinalizadas.length})
                </button>
            </div>

            <div className={styles.board} ref={boardRef} onScroll={handleBoardScroll}>
                {/* SOLICITUDES PENDIENTES */}
                <div className={styles.column}>
                    <div className={`${styles.columnHeader} ${styles.colSolicitudes}`}>
                        <div className={styles.columnTitle}>Solicitudes Pendientes</div>
                        <span className={styles.columnBadge}>{colSolicitudes.length}</span>
                    </div>
                    <div className={styles.cardList}>
                        {colSolicitudes.map(t => renderCard(t, 'yellow'))}
                    </div>
                </div>

                {/* ASIGNACIONES DE VISITAS */}
                <div className={styles.column}>
                    <div className={`${styles.columnHeader} ${styles.colVisita}`}>
                        <div className={styles.columnTitle}>Asignaciones de Visitas</div>
                        <span className={styles.columnBadge}>{colVisita.length}</span>
                    </div>
                    <div className={styles.cardList}>
                        {colVisita.map(t => renderCard(t, 'orange'))}
                    </div>
                </div>

                {/* ASIGNACIONES DE TRABAJO */}
                <div className={styles.column}>
                    <div className={`${styles.columnHeader} ${styles.colProceso}`}>
                        <div className={styles.columnTitle}>Asignaciones de Trabajo</div>
                        <span className={styles.columnBadge}>{colProceso.length}</span>
                    </div>
                    <div className={styles.cardList}>
                        {colProceso.map(t => renderCard(t, 'green'))}
                    </div>
                </div>

                {/* FINALIZADAS */}
                <div className={styles.column}>
                    <div className={`${styles.columnHeader} ${styles.colFinalizadas}`}>
                        <div className={styles.columnTitle}>Trabajos Finalizados</div>
                        <span className={styles.columnBadge}>{colFinalizadas.length}</span>
                    </div>
                    <div className={styles.cardList}>
                        {colFinalizadas.map(t => renderCard(t, 'purple'))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardTecnico;

