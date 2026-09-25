import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./ListaNegocios.module.css";
import menuStyles from "../../components/Menu.module.css";
import { useAuth } from "../../context/AuthContext";
import { normalizeRole, isAutonomoAdmin } from "../../utils/roles";
import { useModal } from "../../context/ModalContext";
import { getNegocios } from "../../services/negociosService";
import { getTrabajos } from "../../services/trabajosService";
import BusinessPostIts from "../../components/BusinessPostIts";


interface Negocio {
    id: number;
    nombre: string;
    ubicacion: string;
    dueno: string;
    fecha: string;
    estado: string; 
    status: string; // Internal approval status
    estado_geografico: string; // City or State for display
    imagenPerfil?: string;
    imagen_portada?: string;
    user_id?: number;
}

const ListaNegocios: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { } = useModal();
    const [negocios, setNegocios] = useState<Negocio[]>([]);
    const [globalJobs, setGlobalJobs] = useState<any[]>([]);
    const [searchText, setSearchText] = useState("");
    const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});
    const [coverImageErrors, setCoverImageErrors] = useState<Record<number, boolean>>({});

    useEffect(() => {
        const fetchData = async () => {
            // 1. Cargar negocios de forma independiente
            try {
                const data = await getNegocios();
                const localData = JSON.parse(localStorage.getItem('local_negocios_info') || '{}');
                const mapped = data.map((n: any) => {
                    const localInfo = localData[n.id] || {};
                    const buildUbicacion = () => {
                        if (n.tipo === 'W/M') {
                            return [n.calleAv, n.manzana ? `Mza ${n.manzana}` : '', n.lote ? `Lote ${n.lote}` : ''].filter(Boolean).join(', ');
                        } else {
                            return [n.tipo !== 'FS' && n.nombrePlaza ? `${n.nombrePlaza}` : '', n.calle, n.numero ? `#${n.numero}` : '', n.colonia].filter(Boolean).join(', ');
                        }
                    };
                    const buildEstadoGeografico = () => {
                        const ciudad = localInfo.ciudad || n.ciudad;
                        const estado = localInfo.estado || n.estado;
                        const cp = localInfo.cp || n.cp;
                        const geoParts = [ciudad, estado].filter(Boolean).join(', ');
                        return cp ? `${geoParts} · CP ${cp}` : geoParts;
                    };
                    return {
                        ...n,
                        id: n.id,
                        nombre: n.nombre,
                        ubicacion: buildUbicacion() || "Mérida",
                        dueno: n.encargado || "Cliente",
                        fecha: new Date(n.created_at).toLocaleDateString('es-MX'),
                        status: n.estado_aprobacion || "En Espera", // Mantenemos el estatus interno
                        estado_geografico: buildEstadoGeografico() || "Mérida", // Prioridad a lo local
                        user_id: n.user_id,
                        imagenPerfil: n.imagenPerfil,
                        imagen_portada: n.imagen_portada
                    };
                });
                setNegocios(mapped);
                localStorage.setItem('negocios_list', JSON.stringify(mapped));
            } catch (error) {
                console.error("Error al cargar negocios:", error);
                const stored = localStorage.getItem('negocios_list');
                if (stored) setNegocios(JSON.parse(stored));
            }

            // 2. Cargar trabajos para calcular los post-its de estado de cada negocio
            if (user) {
                try {
                    const jobsApi = await getTrabajos();
                    setGlobalJobs(jobsApi);
                } catch (error) {
                    console.error("Error al cargar trabajos:", error);
                }
            }
        };
        fetchData();
    }, [user]);

    const filteredNegocios = negocios.filter((negocio) => {
        const matchesSearch = negocio.nombre.toLowerCase().includes(searchText.toLowerCase());

        // FILTRO POR ROL: El cliente solo ve lo suyo, el admin ve todo
        if (normalizeRole(user?.role) === 'cliente') {
            return matchesSearch && (
                Number(negocio.user_id) === Number(user?.id) ||
                negocio.dueno?.toLowerCase().replace(/\s+/g, ' ').trim() === user?.name?.toLowerCase().replace(/\s+/g, ' ').trim()
            );
        }

        // FILTRO POR ROL: El encargado solo ve su sucursal asignada
        if (normalizeRole(user?.role) === 'gerente-sucursal') {
            return matchesSearch && (negocio.id === user.negocio_id);
        }

        // FILTRO POR ROL: El técnico solo ve los negocios donde tiene trabajos asignados
        if (normalizeRole(user?.role) === 'tecnico-normal') {
            const hasAssignedJobs = globalJobs.some((j: any) => {
                if (j.negocio_id !== negocio.id) return false;
                
                const isMine = j.trabajador_id === user.id || j.trabajador?.user_id === user.id;
                if (!isMine) return false;

                const status = (j.estado || "").toLowerCase();
                // Ocultar solo si ya finalizó (ahora sí vemos "en espera" para negociar chat)
                const isProcessedVisita = j.tipo === "Visita" && j.visitado && !status.includes('cotizaci') && status !== 'en espera';
                const isFinalizado = status === 'finalizado';

                return !isProcessedVisita && !isFinalizado;
            });
            return matchesSearch && hasAssignedJobs;
        }

        return matchesSearch;
    });

    const handleCardClick = (id: number) => {
        const r = normalizeRole(user?.role);
        const basePath = r === 'cliente' ? '/cliente' : (r === 'tecnico-normal' ? '/tecnico' : (r === 'gerente-sucursal' ? '/gerente-sucursal' : (isAutonomoAdmin(user?.role) ? '/autonomo' : '/menu')));
        navigate(`${basePath}/trabajo/${id}`);
    };

    const handleEditClick = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (normalizeRole(user?.role) === 'tecnico-normal') return; // El técnico no debe poder editar ni navegar aquí
        
        if (normalizeRole(user?.role) === 'gerente-sucursal') {
            navigate(`/encargado/sucursal?id=${id}`);
        } else if (normalizeRole(user?.role) === 'cliente') {
            navigate(`/cliente/perfil-empresa?id=${id}`);
        } else if (isAutonomoAdmin(user?.role)) {
            navigate(`/autonomo/perfil-empresa?id=${id}`);
        } else {
            navigate(`/menu/perfil-empresa?id=${id}`);
        }
    };

    return (
        <div className={styles.dashboardLayout}>
            <div className={styles.leftColumn}>
                <div className={styles.searchSection}>
                    <div className={menuStyles.searchCard}>
                        <input
                            type="text"
                            placeholder="Buscar..."
                            className={menuStyles.searchInput}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                        />
                    </div>
                    <div className={styles.actionButtons}>
                        {normalizeRole(user?.role) === 'cliente' && (
                            <button
                                className={styles.registrarBtn}
                                onClick={() => navigate("/cliente/perfil-empresa")}
                            >
                                Registrar
                            </button>
                        )}
                        {isAutonomoAdmin(user?.role) && (
                            <button
                                className={styles.registrarBtn}
                                onClick={() => navigate("/autonomo/perfil-empresa")}
                            >
                                Registrar Sucursal
                            </button>
                        )}
                    </div>
                </div>

                <div className={styles.jobsSection}>
                    {filteredNegocios.map((negocio, index) => {
                        let hasSOS = false;
                        let hasDiagnosis = false;
                        if (normalizeRole(user?.role) === 'admin') {
                            hasSOS = globalJobs.some((j: any) => j.negocio_id === negocio.id && j.tipo === 'SOS' && j.estado === 'Solicitud');
                            hasDiagnosis = globalJobs.some((j: any) => j.negocio_id === negocio.id && (j.visitado === 1 || j.visitado === true) && (j.estado === 'Solicitud' || j.estado === 'En Espera'));
                        }

                        const hasValidCover = !!(negocio.imagen_portada && !coverImageErrors[negocio.id]);
                        const cardBg = hasSOS ? '#fffafa' : (hasDiagnosis ? '#f0fdfc' : '#ffffff');

                        const coverUrl = negocio.imagen_portada || '';
                        const matchPos = coverUrl.match(/[?&]posy=(\d+)/);
                        const posY = matchPos ? `${matchPos[1]}%` : 'center';

                        const negocioJobs = globalJobs.filter((j: any) => Number(j.negocio_id) === Number(negocio.id));

                        return (
                            <div key={negocio.id}>
                                <div
                                    className={styles.jobCard}
                                    onClick={() => handleCardClick(negocio.id)}
                                    style={{
                                        border: hasSOS ? '2px solid #f44336' : (hasDiagnosis ? '2px solid #00a699' : undefined),
                                        backgroundColor: cardBg,
                                        ['--card-bg' as any]: cardBg
                                    }}
                                >
                                    {/* Post-it Notes interactivos con código de color en la esquina superior derecha */}
                                    <BusinessPostIts 
                                        jobs={negocioJobs} 
                                        negocioId={negocio.id} 
                                        negocioNombre={negocio.nombre} 
                                    />

                                    {hasValidCover && (
                                        <div className={styles.cardRightImageWrapper}>
                                            <img
                                                src={negocio.imagen_portada}
                                                alt={negocio.nombre}
                                                className={styles.cardRightImage}
                                                style={{ objectPosition: `center ${posY}` }}
                                                onError={() => setCoverImageErrors(prev => ({...prev, [negocio.id]: true}))}
                                            />
                                            <div className={styles.cardRightImageOverlay} />
                                        </div>
                                    )}
                                    <div className={styles.cardContent}>
                                        <div 
                                            className={styles.cardIcon} 
                                            onClick={(e) => handleEditClick(e, negocio.id)}
                                            style={{ cursor: (normalizeRole(user?.role) === 'cliente' || normalizeRole(user?.role) === 'admin' || normalizeRole(user?.role) === 'gerente-sucursal' || isAutonomoAdmin(user?.role)) ? 'pointer' : 'default' }}
                                            title={(normalizeRole(user?.role) === 'cliente' || normalizeRole(user?.role) === 'admin' || normalizeRole(user?.role) === 'gerente-sucursal' || isAutonomoAdmin(user?.role)) ? "Editar Perfil" : ""}
                                        >
                                            {negocio.imagenPerfil && !imageErrors[negocio.id] ? (
                                                <img
                                                    src={negocio.imagenPerfil}
                                                    alt={negocio.nombre}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    onError={() => setImageErrors(prev => ({...prev, [negocio.id]: true}))}
                                                />
                                            ) : (
                                                <div style={{
                                                    width: '100%', 
                                                    height: '100%', 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center',
                                                    backgroundColor: '#e2e8f0',
                                                    color: '#475569',
                                                    fontWeight: 'bold',
                                                    fontSize: '20px'
                                                }}>
                                                    {negocio.nombre.substring(0, 2).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className={styles.cardInfo}>
                                            <h3>{negocio.nombre}</h3>
                                            <p>Dueño: {negocio.dueno}</p>
                                            <p>Ubicación: {negocio.ubicacion}</p>
                                            <p className={negocio.status === 'Finalizado' ? styles.estadoFinalizado : styles.estadoPendiente}>
                                                Estado: {negocio.estado_geografico}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ListaNegocios;

