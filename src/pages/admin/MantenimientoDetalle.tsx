import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getMantenimientoSolicitud, asignarMantenimientoVisita, asignarMantenimientoReparacion } from "../../services/mantenimientoService";
import { getTrabajadores } from "../../services/trabajadoresService";
import { getTrabajos } from "../../services/trabajosService";
import { useAuth } from "../../context/AuthContext";
import { useModal } from "../../context/ModalContext";
import { normalizeRole } from "../../utils/roles";
import HistorialEquipoModal from "../../components/modals/HistorialEquipoModal";
import DetalleReporteModal from "../../components/modals/DetalleReporteModal";

import styles from "./MantenimientoDetalle.module.css";
import { FaArrowLeft, FaTools, FaWrench, FaInfoCircle, FaClipboardCheck } from "react-icons/fa";

const MantenimientoDetalle = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showAlert } = useModal();
    const userRole = normalizeRole(user?.role);
    const isAdmin = userRole === 'admin' || userRole === 'root';

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [tecnicos, setTecnicos] = useState<any[]>([]);

    // History & Report Modal States
    const [historial, setHistorial] = useState<any[]>([]);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedTrabajoId, setSelectedTrabajoId] = useState<number | null>(null);
    const [reporteModalOpen, setReporteModalOpen] = useState(false);

    // Form inputs para asignar técnico
    const [selectedTecnico, setSelectedTecnico] = useState("");
    const [fechaProgramada, setFechaProgramada] = useState("");
    const [horaProgramada, setHoraProgramada] = useState("");

    useEffect(() => {
        const fetchDatos = async () => {
            try {
                if (id) {
                    const sol = await getMantenimientoSolicitud(Number(id));
                    setData(sol);

                    const eq = sol.equipo || sol.levantamiento_equipo;
                    if (eq) {
                        try {
                            const allJobs = await getTrabajos();
                            const eqJobs = allJobs.filter((job: any) => 
                                String(job.levantamiento_equipo_id) === String(eq.id) ||
                                String(job.levantamiento_equipo?.id) === String(eq.id)
                            );
                            setHistorial(eqJobs);
                        } catch (errJobs) {
                            console.error("Error al obtener historial de trabajos:", errJobs);
                        }
                    }
                }
                const trabs = await getTrabajadores();
                // Filtramos aquellos que están activos (siguiendo la estructura del API)
                setTecnicos(trabs.filter((t: any) => t.estado?.toLowerCase() === 'activo' || t.estado === 'Activo'));
            } catch (err) {
                console.error("Error al obtener detalle o técnicos:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchDatos();
    }, [id]);

    const handleAsignarVisita = async () => {
        if (!selectedTecnico || !fechaProgramada || !horaProgramada) {
            showAlert("Error", "Debes seleccionar un técnico, fecha y hora.", "error");
            return;
        }

        try {
            await asignarMantenimientoVisita(String(id), {
                tecnico_id: Number(selectedTecnico),
                fecha_programada: fechaProgramada,
                hora_programada: horaProgramada,
                admin_id: user?.id || 1,
            });

            showAlert("Visita Asignada", "El técnico ha sido notificado para realizar la visita.", "success");
            const sol = await getMantenimientoSolicitud(Number(id));
            setData(sol);
        } catch (err: any) {
            console.error(err);
            showAlert("Error", err.response?.data?.message || "Hubo un problema al asignar la visita", "error");
        }
    };

    const handleAsignarReparacion = async () => {
        if (!selectedTecnico || !fechaProgramada || !horaProgramada) {
            showAlert("Error", "Debes seleccionar un técnico, fecha y hora.", "error");
            return;
        }

        try {
            await asignarMantenimientoReparacion(String(id), {
                tecnico_id: Number(selectedTecnico),
                fecha_programada: fechaProgramada,
                hora_programada: horaProgramada,
                admin_id: user?.id || 1,
            });

            showAlert("Reparación Asignada", "El técnico ha sido notificado para realizar la reparación.", "success");
            const sol = await getMantenimientoSolicitud(Number(id));
            setData(sol);
        } catch (err: any) {
            console.error(err);
            showAlert("Error", err.response?.data?.message || "Hubo un problema al asignar la reparación", "error");
        }
    };

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando información...</div>;
    if (!data) return <div style={{ padding: '40px', textAlign: 'center' }}>No se encontró la solicitud.</div>;

    const equipo = data.equipo || data.levantamiento_equipo;
    const { negocio, cliente } = data;

    const getStatusStyle = (status: string) => {
        switch(status) {
            case 'Pendiente': return styles.statusPendiente;
            case 'Visita Asignada': return styles.statusVisitaAsignada;
            case 'Cotización Pendiente': return styles.statusPendiente;
            case 'Cotización Aceptada': return styles.statusCotizacionAceptada;
            case 'Reparación Asignada': return styles.statusReparacionAsignada;
            case 'Completado': return styles.statusCotizacionAceptada;
            default: return styles.statusPendiente;
        }
    };

    return (
        <div className={styles.pageContainer}>
            <div className={styles.pageBackgroundShape1}></div>
            <div className={styles.pageBackgroundShape2}></div>

            <div className={styles.contentZIndex}>
                {/* Header Section */}
                <div className={`${styles.headerRow} ${styles.animateSlideUp}`}>
                    <button className={styles.backBtn} onClick={() => navigate(-1)}>
                        <FaArrowLeft /> Regresar
                    </button>
                    <div className={styles.titleArea}>
                        <h1 className={styles.pageTitle}>Detalle de Mantenimiento</h1>
                        <span className={`${styles.statusBadge} ${getStatusStyle(data.estado)}`}>
                            {data.estado}
                        </span>
                        {/* Arrival Status Badge */}
                        {(data.visita_trabajo?.hora_llegada || data.reparacion_trabajo?.hora_llegada) && (
                            <span style={{
                                display: 'inline-block',
                                marginLeft: '12px',
                                background: '#ecfdf5',
                                color: '#059669',
                                border: '1px solid #34d399',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '13px',
                                fontWeight: '700'
                            }}>
                                📍 Técnico en sitio (Llegada: {data.reparacion_trabajo?.hora_llegada || data.visita_trabajo?.hora_llegada})
                            </span>
                        )}
                    </div>
                </div>

                <div className={`${styles.bentoContainer} ${styles.animateSlideUp} ${styles.delay1}`}>
                    
                    {/* Left Column (Main Content) */}
                    <div className={styles.colSpan8}>
                        <div className={styles.sectionHeader}>
                            <div className={`${styles.sectionIcon} ${styles.iconBlue}`}><FaInfoCircle /></div>
                            <h2 className={styles.sectionTitle}>Información del Problema</h2>
                        </div>

                        {equipo && (
                            <div className={styles.equipmentDisplay}>
                                {equipo.foto ? (
                                    <img src={equipo.foto} alt={equipo.nombre} className={styles.equipmentImage}/>
                                ) : (
                                    <div className={styles.equipmentImage} style={{background:'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center'}}>
                                        <FaTools size={40} color="#cbd5e1" />
                                    </div>
                                )}
                                <div className={styles.equipmentDetails}>
                                    <h3 className={styles.equipmentName}>{equipo.nombre || "Equipo Sin Nombre"}</h3>
                                    <div style={{ marginTop: '10px' }}>
                                        {equipo.marca && <span className={styles.detailPill}>Marca: {equipo.marca}</span>}
                                        {equipo.modelo && <span className={styles.detailPill}>Mod: {equipo.modelo}</span>}
                                        {equipo.serie && <span className={styles.detailPill}>S/N: {equipo.serie}</span>}
                                    </div>
                                    <div style={{ marginTop: '15px' }}>
                                        <button 
                                            onClick={() => setIsHistoryModalOpen(true)}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                background: 'linear-gradient(135deg, #f26522 0%, #ff8c42 100%)',
                                                color: 'white',
                                                border: 'none',
                                                padding: '8px 16px',
                                                borderRadius: '20px',
                                                fontSize: '12px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                                boxShadow: '0 3px 8px rgba(242, 101, 34, 0.2)',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            📂 Ver Historial de Intervenciones ({historial.length})
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{ marginTop: '15px' }}>
                            <div className={styles.infoLabel} style={{ marginBottom: '10px' }}>Descripción reportada por el cliente</div>
                            <div className={styles.problemBox}>
                                "{data.descripcion_problema}"
                            </div>
                        </div>

                        <div className={styles.infoGrid} style={{ marginTop: '15px' }}>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Negocio / Sucursal</span>
                                <span className={styles.infoValue}>{negocio?.nombre || 'N/A'}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Cliente</span>
                                <span className={styles.infoValue}>{cliente?.name || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Column (Actions based on status) */}
                    <div className={`${styles.rightColumnCard} ${styles.colSpan4} ${styles.animateSlideUp} ${styles.delay2}`}>
                        
                        {data.estado === 'Pendiente' && (
                            isAdmin ? (
                                <>
                                    <div className={styles.sectionHeader}>
                                        <div className={`${styles.sectionIcon} ${styles.iconOrange}`}><FaWrench /></div>
                                        <h2 className={styles.sectionTitle}>Asignar Visita</h2>
                                    </div>
                                    <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '12px', lineHeight: '1.5' }}>
                                        Envía a un técnico para que supervise el equipo y levante una cotización.
                                    </p>
                                    
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>Seleccione al Técnico</label>
                                        <select 
                                            className={styles.formSelect}
                                            value={selectedTecnico} 
                                            onChange={(e) => setSelectedTecnico(e.target.value)}
                                        >
                                            <option value="">-- Seleccionar --</option>
                                            {tecnicos.map(t => (
                                                <option key={t.id} value={t.user_id}>{t.nombre || t.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '20px' }}>
                                        {/* FECHA CON BOTONES */}
                                        <div style={{ flex: '1 1 200px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                <label style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>
                                                    📅 Fecha Estimada
                                                </label>
                                                <div style={{ display: 'flex', gap: '5px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFechaProgramada(new Date().toISOString().split('T')[0])}
                                                        style={{
                                                            fontSize: '11px',
                                                            fontWeight: '600',
                                                            padding: '2px 7px',
                                                            borderRadius: '6px',
                                                            border: '1px solid #cbd5e1',
                                                            background: '#fff',
                                                            color: '#475569',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        Hoy
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const tom = new Date();
                                                            tom.setDate(tom.getDate() + 1);
                                                            setFechaProgramada(tom.toISOString().split('T')[0]);
                                                        }}
                                                        style={{
                                                            fontSize: '11px',
                                                            fontWeight: '600',
                                                            padding: '2px 7px',
                                                            borderRadius: '6px',
                                                            border: '1px solid #cbd5e1',
                                                            background: '#fff',
                                                            color: '#475569',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        Mañana
                                                    </button>
                                                </div>
                                            </div>
                                            <input
                                                type="date"
                                                min={new Date().toISOString().split('T')[0]}
                                                value={fechaProgramada}
                                                onChange={(e) => setFechaProgramada(e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 12px',
                                                    borderRadius: '10px',
                                                    border: '1.5px solid #cbd5e1',
                                                    fontSize: '14px',
                                                    fontWeight: '600',
                                                    color: '#0f172a',
                                                    background: '#fff',
                                                    outline: 'none'
                                                }}
                                            />
                                        </div>

                                        {/* HORA */}
                                        <div style={{ flex: '1 1 200px' }}>
                                            <label style={{ display: 'block', fontWeight: '700', fontSize: '13px', color: '#1e293b', marginBottom: '6px' }}>
                                                🕒 Hora Estimada
                                            </label>
                                            <select
                                                value={horaProgramada}
                                                onChange={(e) => setHoraProgramada(e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 12px',
                                                    borderRadius: '10px',
                                                    border: '1.5px solid #cbd5e1',
                                                    fontSize: '14px',
                                                    fontWeight: '600',
                                                    color: '#0f172a',
                                                    background: '#fff',
                                                    outline: 'none'
                                                }}
                                            >
                                                <option value="">Seleccione hora...</option>
                                                <option value="08:00">08:00 AM</option>
                                                <option value="09:00">09:00 AM</option>
                                                <option value="10:00">10:00 AM</option>
                                                <option value="11:00">11:00 AM</option>
                                                <option value="12:00">12:00 PM</option>
                                                <option value="13:00">01:00 PM</option>
                                                <option value="14:00">02:00 PM</option>
                                                <option value="15:00">03:00 PM</option>
                                                <option value="16:00">04:00 PM</option>
                                                <option value="17:00">05:00 PM</option>
                                                <option value="18:00">06:00 PM</option>
                                            </select>
                                        </div>
                                    </div>
                                    <button className={styles.primaryBtn} onClick={handleAsignarVisita}>
                                        Agendar Visita
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className={styles.sectionHeader}>
                                        <div className={`${styles.sectionIcon} ${styles.iconOrange}`}><FaInfoCircle /></div>
                                        <h2 className={styles.sectionTitle}>Estado de la Solicitud</h2>
                                    </div>
                                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                                        <div style={{ display: 'inline-block', background: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '800', marginBottom: '12px' }}>
                                            🟡 PENDIENTE DE REVISIÓN
                                        </div>
                                        <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.6', margin: 0 }}>
                                            Tu solicitud de mantenimiento fue registrada con éxito. El equipo de administración revisará los detalles y asignará al técnico especialista adecuado para la visita.
                                        </p>
                                    </div>
                                </>
                            )
                        )}

                        {data.estado === 'Cotización Aceptada' && (
                            isAdmin ? (
                                <>
                                    <div className={styles.sectionHeader}>
                                        <div className={`${styles.sectionIcon} ${styles.iconGreen}`}><FaClipboardCheck /></div>
                                        <h2 className={styles.sectionTitle}>Mantenimiento Aprobado</h2>
                                    </div>
                                    <p style={{ fontSize: '14px', color: '#15803d', marginBottom: '12px', lineHeight: '1.5', background:'#dcfce7', padding:'10px 12px', borderRadius:'12px', border:'1px solid #bbf7d0' }}>
                                        El cliente ha pagado/aprobado la cotización. Asigna a un técnico para el Trabajo de Reparación Final.
                                    </p>

                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>Seleccione al Reparador</label>
                                        <select 
                                            className={styles.formSelect}
                                            value={selectedTecnico} 
                                            onChange={(e) => setSelectedTecnico(e.target.value)}
                                        >
                                            <option value="">-- Seleccionar --</option>
                                            {tecnicos.map(t => (
                                                <option key={t.id} value={t.user_id}>{t.nombre || t.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '20px' }}>
                                        {/* FECHA CON BOTONES */}
                                        <div style={{ flex: '1 1 200px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                <label style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>
                                                    📅 Fecha de Reparación
                                                </label>
                                                <div style={{ display: 'flex', gap: '5px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFechaProgramada(new Date().toISOString().split('T')[0])}
                                                        style={{
                                                            fontSize: '11px',
                                                            fontWeight: '600',
                                                            padding: '2px 7px',
                                                            borderRadius: '6px',
                                                            border: '1px solid #cbd5e1',
                                                            background: '#fff',
                                                            color: '#475569',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        Hoy
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const tom = new Date();
                                                            tom.setDate(tom.getDate() + 1);
                                                            setFechaProgramada(tom.toISOString().split('T')[0]);
                                                        }}
                                                        style={{
                                                            fontSize: '11px',
                                                            fontWeight: '600',
                                                            padding: '2px 7px',
                                                            borderRadius: '6px',
                                                            border: '1px solid #cbd5e1',
                                                            background: '#fff',
                                                            color: '#475569',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        Mañana
                                                    </button>
                                                </div>
                                            </div>
                                            <input
                                                type="date"
                                                min={new Date().toISOString().split('T')[0]}
                                                value={fechaProgramada}
                                                onChange={(e) => setFechaProgramada(e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 12px',
                                                    borderRadius: '10px',
                                                    border: '1.5px solid #cbd5e1',
                                                    fontSize: '14px',
                                                    fontWeight: '600',
                                                    color: '#0f172a',
                                                    background: '#fff',
                                                    outline: 'none'
                                                }}
                                            />
                                        </div>

                                        {/* HORA */}
                                        <div style={{ flex: '1 1 200px' }}>
                                            <label style={{ display: 'block', fontWeight: '700', fontSize: '13px', color: '#1e293b', marginBottom: '6px' }}>
                                                🕒 Hora (Aprox)
                                            </label>
                                            <select
                                                value={horaProgramada}
                                                onChange={(e) => setHoraProgramada(e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 12px',
                                                    borderRadius: '10px',
                                                    border: '1.5px solid #cbd5e1',
                                                    fontSize: '14px',
                                                    fontWeight: '600',
                                                    color: '#0f172a',
                                                    background: '#fff',
                                                    outline: 'none'
                                                }}
                                            >
                                                <option value="">Seleccione hora...</option>
                                                <option value="08:00">08:00 AM</option>
                                                <option value="09:00">09:00 AM</option>
                                                <option value="10:00">10:00 AM</option>
                                                <option value="11:00">11:00 AM</option>
                                                <option value="12:00">12:00 PM</option>
                                                <option value="13:00">01:00 PM</option>
                                                <option value="14:00">02:00 PM</option>
                                                <option value="15:00">03:00 PM</option>
                                                <option value="16:00">04:00 PM</option>
                                                <option value="17:00">05:00 PM</option>
                                                <option value="18:00">06:00 PM</option>
                                            </select>
                                        </div>
                                    </div>
                                    <button className={`${styles.primaryBtn} ${styles.successBtn}`} onClick={handleAsignarReparacion}>
                                        Agendar Reparación Final
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className={styles.sectionHeader}>
                                        <div className={`${styles.sectionIcon} ${styles.iconGreen}`}><FaClipboardCheck /></div>
                                        <h2 className={styles.sectionTitle}>Mantenimiento Aprobado</h2>
                                    </div>
                                    <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '16px', border: '1px solid #bbf7d0', marginBottom: '16px' }}>
                                        <p style={{ fontSize: '13px', color: '#15803d', lineHeight: '1.6', margin: 0 }}>
                                            La cotización ha sido aprobada. El equipo administrativo agendará al técnico para la reparación final de tu equipo.
                                        </p>
                                    </div>
                                </>
                            )
                        )}

                        {['Visita Asignada', 'Cotización Pendiente'].includes(data.estado) && (
                            <>
                                <div className={styles.sectionHeader}>
                                    <div className={`${styles.sectionIcon} ${styles.iconPurple}`}><FaWrench /></div>
                                    <h2 className={styles.sectionTitle}>En Progreso</h2>
                                </div>
                                <div style={{ textAlign: 'center', color: '#64748b', padding: '30px 10px' }}>
                                    <div style={{ fontSize:'40px', marginBottom:'15px', opacity:0.5 }}>⏳</div>
                                    El mantenimiento está en progreso. Esperando a que el técnico actualice el diagnóstico o enviando la cotización.
                                </div>
                            </>
                        )}

                        {['Reparación Asignada', 'Completado'].includes(data.estado) && (
                            <>
                                <div className={styles.sectionHeader}>
                                    <div className={`${styles.sectionIcon} ${styles.iconGreen}`}><FaTools /></div>
                                    <h2 className={styles.sectionTitle}>Reparación en Vía</h2>
                                </div>
                                <div style={{ textAlign: 'center', color: '#64748b', padding: '30px 10px' }}>
                                    <div style={{ fontSize:'40px', marginBottom:'15px', opacity:0.5 }}>🔧</div>
                                    El trabajo ya fue agendado al técnico. Puedes revisar el historial o reportes en el detalle del Trabajo correspondiente.
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {equipo && (
                <HistorialEquipoModal 
                    isOpen={isHistoryModalOpen}
                    onClose={() => setIsHistoryModalOpen(false)}
                    equipo={equipo}
                    historial={historial}
                    onViewReport={(trabajoId) => {
                        setSelectedTrabajoId(trabajoId);
                        setReporteModalOpen(true);
                    }}
                />
            )}

            {selectedTrabajoId && (
                <DetalleReporteModal 
                    isOpen={reporteModalOpen}
                    onClose={() => setReporteModalOpen(false)}
                    trabajoId={selectedTrabajoId}
                />
            )}
        </div>
    );
};

export default MantenimientoDetalle;
