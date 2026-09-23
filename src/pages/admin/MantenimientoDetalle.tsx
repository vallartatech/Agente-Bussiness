import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
    getMantenimientoSolicitud, 
    getMantenimientoSolicitudes,
    asignarMantenimientoVisita, 
    asignarMantenimientoReparacion,
    actualizarMantenimientoAsignacion,
    cancelarMantenimientoAsignacion
} from "../../services/mantenimientoService";
import { getTrabajadores } from "../../services/trabajadoresService";
import { getTrabajos } from "../../services/trabajosService";
import { getNegocio } from "../../services/negociosService";
import { useAuth } from "../../context/AuthContext";
import { useModal } from "../../context/ModalContext";
import { normalizeRole } from "../../utils/roles";
import HistorialEquipoModal from "../../components/modals/HistorialEquipoModal";
import DetalleReporteModal from "../../components/modals/DetalleReporteModal";
import { getMergedIntervenciones } from "./EquiposNegocio";

import styles from "./MantenimientoDetalle.module.css";
import { 
    FaArrowLeft, 
    FaTools, 
    FaWrench, 
    FaInfoCircle, 
    FaClipboardCheck, 
    FaMapMarkerAlt, 
    FaBuilding, 
    FaUser, 
    FaPhoneAlt, 
    FaEnvelope, 
    FaExternalLinkAlt,
    FaEdit,
    FaTrash,
    FaUserTie,
    FaCalendarAlt,
    FaClock
} from "react-icons/fa";

const MantenimientoDetalle = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showAlert, showConfirm } = useModal();
    const userRole = normalizeRole(user?.role);
    const isAdmin = userRole === 'admin' || userRole === 'root';

    const [data, setData] = useState<any>(null);
    const [negocioInfo, setNegocioInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [tecnicos, setTecnicos] = useState<any[]>([]);
    const [equipoImgError, setEquipoImgError] = useState(false);
    const [businessImgError, setBusinessImgError] = useState(false);

    // Edit and Cancel Assignment States
    const [isEditingAssignment, setIsEditingAssignment] = useState(false);
    const [submittingAction, setSubmittingAction] = useState(false);

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

                    const negId = sol.negocio_id || sol.negocio?.id;
                    if (negId) {
                        try {
                            const fullNeg = await getNegocio(Number(negId));
                            setNegocioInfo(fullNeg);
                        } catch (errNeg) {
                            console.error("Error al obtener detalle del negocio:", errNeg);
                            setNegocioInfo(sol.negocio);
                        }
                    } else if (sol.negocio) {
                        setNegocioInfo(sol.negocio);
                    }

                    const eq = sol.equipo || sol.levantamiento_equipo;
                    if (eq) {
                        try {
                            const [allJobs, allMantenimientos] = await Promise.all([
                                getTrabajos(),
                                getMantenimientoSolicitudes(negId ? Number(negId) : undefined)
                            ]);
                            const intervenciones = getMergedIntervenciones(eq, allMantenimientos, allJobs);
                            setHistorial(intervenciones);
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

    const handleStartEdit = () => {
        const activeTrab = data?.visita_trabajo || data?.visitaTrabajo || data?.reparacion_trabajo || data?.reparacionTrabajo;
        if (activeTrab) {
            const rawFecha = activeTrab.fecha_programada || activeTrab.fechaAsignada || "";
            const rawHora = activeTrab.hora_programada || activeTrab.horaAsignada || "";
            const rawTecnico = activeTrab.trabajador?.user_id || activeTrab.user_id || activeTrab.trabajador_id || "";
            setSelectedTecnico(String(rawTecnico));
            setFechaProgramada(rawFecha ? String(rawFecha).split('T')[0] : "");
            setHoraProgramada(rawHora ? String(rawHora).substring(0, 5) : "");
        }
        setIsEditingAssignment(true);
    };

    const handleGuardarEdicion = async () => {
        if (!selectedTecnico || !fechaProgramada || !horaProgramada) {
            showAlert("Campos requeridos", "Debes seleccionar un técnico, fecha y hora.", "error");
            return;
        }
        setSubmittingAction(true);
        try {
            await actualizarMantenimientoAsignacion(String(id), {
                tecnico_id: Number(selectedTecnico),
                fecha_programada: fechaProgramada,
                hora_programada: horaProgramada,
                admin_id: user?.id || 1,
            });
            showAlert("Asignación Actualizada", "Los datos del técnico y horario se actualizaron correctamente en la base de datos.", "success");
            setIsEditingAssignment(false);
            const sol = await getMantenimientoSolicitud(Number(id));
            setData(sol);
        } catch (err: any) {
            console.error(err);
            showAlert("Error", err.response?.data?.message || "No se pudo actualizar la asignación", "error");
        } finally {
            setSubmittingAction(false);
        }
    };

    const handleCancelarAsignacion = () => {
        const isVisita = data?.estado === 'Visita Asignada';
        const targetState = isVisita ? 'Pendiente' : 'Cotización Aceptada';
        
        showConfirm(
            "¿Cancelar asignación de técnico?",
            `Esta acción desasignará al técnico, eliminará el trabajo programado y devolverá la solicitud al estado "${targetState}". ¿Deseas continuar?`,
            async () => {
                setSubmittingAction(true);
                try {
                    await cancelarMantenimientoAsignacion(String(id));
                    showAlert("Asignación Cancelada", `La asignación ha sido cancelada y la solicitud volvió al estado "${targetState}".`, "success");
                    setIsEditingAssignment(false);
                    const sol = await getMantenimientoSolicitud(Number(id));
                    setData(sol);
                } catch (err: any) {
                    console.error(err);
                    showAlert("Error", err.response?.data?.message || "No se pudo cancelar la asignación", "error");
                } finally {
                    setSubmittingAction(false);
                }
            },
            undefined,
            "Sí, Cancelar Asignación",
            "No, Mantener"
        );
    };

    const getFormattedAddress = (neg: any) => {
        if (!neg) return 'Sin dirección registrada';
        const parts: string[] = [];

        if (neg.tipo === 'W/M') {
            const line1 = [neg.calleAv, neg.manzana ? `Mza. ${neg.manzana}` : '', neg.lote ? `Lote ${neg.lote}` : ''].filter(Boolean).join(', ');
            if (line1) parts.push(line1);
        } else {
            const plaza = neg.nombrePlaza || neg.nombre_plaza;
            if (plaza && neg.tipo !== 'FS') parts.push(`Plaza ${plaza}`);
            const street = [neg.calle, neg.numero ? `#${neg.numero}` : ''].filter(Boolean).join(' ');
            if (street) parts.push(street);
            if (neg.colonia) parts.push(`Col. ${neg.colonia}`);
        }

        const geo = [neg.ciudad, neg.estado].filter(Boolean).join(', ');
        if (geo) parts.push(geo);
        if (neg.cp) parts.push(`CP ${neg.cp}`);

        if (parts.length === 0) {
            return neg.direccion || neg.ubicacion || 'Sin dirección registrada';
        }
        return parts.join(' · ');
    };

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando información...</div>;
    if (!data) return <div style={{ padding: '40px', textAlign: 'center' }}>No se encontró la solicitud.</div>;

    const equipo = data.equipo || data.levantamiento_equipo;
    const { cliente } = data;
    const activeNegocio = negocioInfo || data.negocio;
    const activeTrabajo = data.visita_trabajo || data.visitaTrabajo || data.reparacion_trabajo || data.reparacionTrabajo;

    const getTecnicoName = (trab: any) => {
        if (!trab) return 'Técnico asignado';
        if (trab.trabajador?.nombre) return trab.trabajador.nombre;
        if (trab.trabajador?.name) return trab.trabajador.name;
        if (trab.user?.name) return trab.user.name;
        const match = tecnicos.find(t => 
            String(t.user_id) === String(trab.user_id) || 
            String(t.id) === String(trab.trabajador_id)
        );
        if (match) return match.nombre || match.name;
        return 'Técnico asignado';
    };

    const businessImageSrc = activeNegocio?.imagen_portada || activeNegocio?.imagenPerfil || activeNegocio?.foto;
    const businessName = activeNegocio?.nombre || 'Negocio Sin Nombre';
    const businessPlaza = activeNegocio?.nombrePlaza || activeNegocio?.nombre_plaza;
    const clientName = cliente?.name || activeNegocio?.encargado || activeNegocio?.dueno || 'Sin cliente especificado';
    const clientPhone = cliente?.telefono || activeNegocio?.telefono;
    const clientEmail = cliente?.email || activeNegocio?.correo;
    const addressText = getFormattedAddress(activeNegocio);
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        [businessName, addressText].filter(Boolean).join(', ')
    )}`;

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
                                {equipo.foto && !equipoImgError ? (
                                    <img 
                                        src={equipo.foto} 
                                        alt={equipo.nombre} 
                                        className={styles.equipmentImage}
                                        onError={() => setEquipoImgError(true)}
                                    />
                                ) : (
                                    <div className={styles.equipmentImage} style={{background:'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center'}}>
                                        <FaTools size={36} color="#94a3b8" />
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

                        {/* Negocio, Cliente y Dirección */}
                        <div style={{ marginTop: '15px' }}>
                            <div className={styles.infoLabel} style={{ marginBottom: '10px' }}>Negocio y Ubicación del Servicio</div>
                            <div className={styles.businessCard}>
                                <div className={styles.businessHeader}>
                                    {businessImageSrc && !businessImgError ? (
                                        <img 
                                            src={businessImageSrc} 
                                            alt={businessName} 
                                            className={styles.businessLogo} 
                                            onError={() => setBusinessImgError(true)}
                                        />
                                    ) : (
                                        <div className={styles.businessLogoPlaceholder}>
                                            <FaBuilding />
                                        </div>
                                    )}
                                    <div className={styles.businessInfo}>
                                        <h3 className={styles.businessName}>
                                            {businessName}
                                            {businessPlaza && (
                                                <span className={styles.detailPill}>
                                                    🏛️ {businessPlaza}
                                                </span>
                                            )}
                                        </h3>
                                        <div className={styles.businessSub}>
                                            <FaUser style={{ color: '#64748b', fontSize: '12px' }} />
                                            <span><strong>Cliente / Contacto:</strong> {clientName}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Address Block */}
                                <div className={styles.addressBox}>
                                    <div className={styles.addressLeft}>
                                        <FaMapMarkerAlt className={styles.addressIcon} />
                                        <div className={styles.addressText}>
                                            {addressText}
                                        </div>
                                    </div>
                                    {addressText && addressText !== 'Sin dirección registrada' && (
                                        <a 
                                            href={googleMapsUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className={styles.mapLink}
                                            title="Ver en Google Maps"
                                        >
                                            <FaExternalLinkAlt size={10} /> Ver Mapa
                                        </a>
                                    )}
                                </div>

                                {/* Contact details row if available */}
                                {(clientPhone || clientEmail) && (
                                    <div className={styles.clientDetailsRow}>
                                        {clientPhone && (
                                            <div className={styles.clientDetailItem}>
                                                <FaPhoneAlt className={styles.clientDetailIcon} />
                                                <span>{clientPhone}</span>
                                            </div>
                                        )}
                                        {clientEmail && (
                                            <div className={styles.clientDetailItem}>
                                                <FaEnvelope className={styles.clientDetailIcon} />
                                                <span>{clientEmail}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
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

                        {data.estado === 'Visita Asignada' && (
                            isAdmin ? (
                                isEditingAssignment ? (
                                    <>
                                        <div className={styles.sectionHeader}>
                                            <div className={`${styles.sectionIcon} ${styles.iconBlue}`}><FaEdit /></div>
                                            <h2 className={styles.sectionTitle}>Editar Asignación</h2>
                                        </div>
                                        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px', lineHeight: '1.4' }}>
                                            Modifica el técnico asignado, la fecha o la hora de la visita programada.
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
                                            <div style={{ flex: '1 1 200px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                    <label style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>
                                                        📅 Fecha Programada
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

                                        <div className={styles.actionButtonGroup}>
                                            <button 
                                                className={styles.primaryBtn} 
                                                onClick={handleGuardarEdicion}
                                                disabled={submittingAction}
                                            >
                                                {submittingAction ? "Guardando..." : "Guardar Cambios"}
                                            </button>
                                            <button 
                                                className={styles.secondaryBtn} 
                                                onClick={() => setIsEditingAssignment(false)}
                                                disabled={submittingAction}
                                            >
                                                Descartar
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className={styles.sectionHeader}>
                                            <div className={`${styles.sectionIcon} ${styles.iconPurple}`}><FaWrench /></div>
                                            <h2 className={styles.sectionTitle}>Visita Asignada</h2>
                                        </div>

                                        <div className={styles.assignedBox}>
                                            <div className={styles.assignedItem}>
                                                <div className={styles.assignedIcon}><FaUserTie /></div>
                                                <div className={styles.assignedDetails}>
                                                    <span className={styles.assignedLabel}>Técnico Especialista</span>
                                                    <span className={styles.assignedVal}>
                                                        {getTecnicoName(activeTrabajo)}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className={styles.assignedItem}>
                                                <div className={styles.assignedIcon}><FaCalendarAlt /></div>
                                                <div className={styles.assignedDetails}>
                                                    <span className={styles.assignedLabel}>Fecha de Visita</span>
                                                    <span className={styles.assignedVal}>{activeTrabajo?.fecha_programada || activeTrabajo?.fechaAsignada || 'Fecha pendiente'}</span>
                                                </div>
                                            </div>

                                            <div className={styles.assignedItem}>
                                                <div className={styles.assignedIcon}><FaClock /></div>
                                                <div className={styles.assignedDetails}>
                                                    <span className={styles.assignedLabel}>Hora Estimada</span>
                                                    <span className={styles.assignedVal}>{activeTrabajo?.hora_programada || activeTrabajo?.horaAsignada || 'Sin hora fijada'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className={styles.actionButtonGroup}>
                                            <button 
                                                className={styles.editBtn} 
                                                onClick={handleStartEdit}
                                                disabled={submittingAction}
                                            >
                                                <FaEdit /> Editar Técnico / Horario
                                            </button>
                                            <button 
                                                className={styles.dangerBtn} 
                                                onClick={handleCancelarAsignacion}
                                                disabled={submittingAction}
                                            >
                                                <FaTrash /> Cancelar Asignación de Técnico
                                            </button>
                                        </div>
                                    </>
                                )
                            ) : (
                                <>
                                    <div className={styles.sectionHeader}>
                                        <div className={`${styles.sectionIcon} ${styles.iconPurple}`}><FaWrench /></div>
                                        <h2 className={styles.sectionTitle}>Visita en Progreso</h2>
                                    </div>
                                    <div className={styles.assignedBox}>
                                        <div className={styles.assignedItem}>
                                            <div className={styles.assignedIcon}><FaUserTie /></div>
                                            <div className={styles.assignedDetails}>
                                                <span className={styles.assignedLabel}>Técnico Asignado</span>
                                                <span className={styles.assignedVal}>
                                                    {getTecnicoName(activeTrabajo)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className={styles.assignedItem}>
                                            <div className={styles.assignedIcon}><FaCalendarAlt /></div>
                                            <div className={styles.assignedDetails}>
                                                <span className={styles.assignedLabel}>Fecha Programada</span>
                                                <span className={styles.assignedVal}>{activeTrabajo?.fecha_programada || activeTrabajo?.fechaAsignada || 'Fecha pendiente'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5', margin: 0, textAlign: 'center' }}>
                                        El técnico acudirá a revisar el equipo para levantar el diagnóstico y la cotización.
                                    </p>
                                </>
                            )
                        )}

                        {data.estado === 'Cotización Pendiente' && (
                            <>
                                <div className={styles.sectionHeader}>
                                    <div className={`${styles.sectionIcon} ${styles.iconPurple}`}><FaWrench /></div>
                                    <h2 className={styles.sectionTitle}>Cotización Pendiente</h2>
                                </div>
                                <div style={{ textAlign: 'center', color: '#64748b', padding: '30px 10px' }}>
                                    <div style={{ fontSize:'40px', marginBottom:'15px', opacity:0.5 }}>⏳</div>
                                    El técnico ha completado la visita de diagnóstico y está redactando o enviando la cotización.
                                </div>
                            </>
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

                        {['Reparación Asignada', 'Trabajo Asignado'].includes(data.estado) && (
                            isAdmin ? (
                                isEditingAssignment ? (
                                    <>
                                        <div className={styles.sectionHeader}>
                                            <div className={`${styles.sectionIcon} ${styles.iconBlue}`}><FaEdit /></div>
                                            <h2 className={styles.sectionTitle}>Editar Reparación</h2>
                                        </div>
                                        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px', lineHeight: '1.4' }}>
                                            Modifica el reparador asignado, la fecha o la hora del trabajo.
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

                                        <div className={styles.actionButtonGroup}>
                                            <button 
                                                className={styles.primaryBtn} 
                                                onClick={handleGuardarEdicion}
                                                disabled={submittingAction}
                                            >
                                                {submittingAction ? "Guardando..." : "Guardar Cambios"}
                                            </button>
                                            <button 
                                                className={styles.secondaryBtn} 
                                                onClick={() => setIsEditingAssignment(false)}
                                                disabled={submittingAction}
                                            >
                                                Descartar
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className={styles.sectionHeader}>
                                            <div className={`${styles.sectionIcon} ${styles.iconGreen}`}><FaTools /></div>
                                            <h2 className={styles.sectionTitle}>Reparación Asignada</h2>
                                        </div>

                                        <div className={styles.assignedBox}>
                                            <div className={styles.assignedItem}>
                                                <div className={styles.assignedIcon}><FaUserTie /></div>
                                                <div className={styles.assignedDetails}>
                                                    <span className={styles.assignedLabel}>Técnico Reparador</span>
                                                    <span className={styles.assignedVal}>
                                                        {getTecnicoName(activeTrabajo)}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className={styles.assignedItem}>
                                                <div className={styles.assignedIcon}><FaCalendarAlt /></div>
                                                <div className={styles.assignedDetails}>
                                                    <span className={styles.assignedLabel}>Fecha de Reparación</span>
                                                    <span className={styles.assignedVal}>{activeTrabajo?.fecha_programada || activeTrabajo?.fechaAsignada || 'Fecha pendiente'}</span>
                                                </div>
                                            </div>

                                            <div className={styles.assignedItem}>
                                                <div className={styles.assignedIcon}><FaClock /></div>
                                                <div className={styles.assignedDetails}>
                                                    <span className={styles.assignedLabel}>Hora Estimada</span>
                                                    <span className={styles.assignedVal}>{activeTrabajo?.hora_programada || activeTrabajo?.horaAsignada || 'Sin hora fijada'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className={styles.actionButtonGroup}>
                                            <button 
                                                className={styles.editBtn} 
                                                onClick={handleStartEdit}
                                                disabled={submittingAction}
                                            >
                                                <FaEdit /> Editar Técnico / Horario
                                            </button>
                                            <button 
                                                className={styles.dangerBtn} 
                                                onClick={handleCancelarAsignacion}
                                                disabled={submittingAction}
                                            >
                                                <FaTrash /> Cancelar Asignación de Reparación
                                            </button>
                                        </div>
                                    </>
                                )
                            ) : (
                                <>
                                    <div className={styles.sectionHeader}>
                                        <div className={`${styles.sectionIcon} ${styles.iconGreen}`}><FaTools /></div>
                                        <h2 className={styles.sectionTitle}>Reparación en Vía</h2>
                                    </div>
                                    <div style={{ textAlign: 'center', color: '#64748b', padding: '30px 10px' }}>
                                        <div style={{ fontSize:'40px', marginBottom:'15px', opacity:0.5 }}>🔧</div>
                                        El trabajo de reparación ya fue agendado al técnico.
                                    </div>
                                </>
                            )
                        )}

                        {data.estado === 'Completado' && (
                            <>
                                <div className={styles.sectionHeader}>
                                    <div className={`${styles.sectionIcon} ${styles.iconGreen}`}><FaTools /></div>
                                    <h2 className={styles.sectionTitle}>Mantenimiento Completado</h2>
                                </div>
                                <div style={{ textAlign: 'center', color: '#64748b', padding: '30px 10px' }}>
                                    <div style={{ fontSize:'40px', marginBottom:'15px', color: '#10b981' }}>✅</div>
                                    El servicio ha sido completado satisfactoriamente.
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
