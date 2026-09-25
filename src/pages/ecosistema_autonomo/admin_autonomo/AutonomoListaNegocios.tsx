import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./AutonomoListaNegocios.module.css";
import menuStyles from "../../../components/Menu.module.css";
import { useAuth } from "../../../context/AuthContext";
import { normalizeRole, isAutonomoAdmin } from "../../../utils/roles";
import { getNegocios } from "../../../services/autonomo/negociosService";
import { getTrabajos } from "../../../services/autonomo/trabajosService";
import BusinessPostIts from "../../../components/BusinessPostIts";


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
    user_id?: number;
}

const AutonomoListaNegocios: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [negocios, setNegocios] = useState<Negocio[]>([]);
    const [globalJobs, setGlobalJobs] = useState<any[]>([]);
    const [searchText, setSearchText] = useState("");
    const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});
    const [coverImageErrors, setCoverImageErrors] = useState<Record<number, boolean>>({});

    useEffect(() => {
        const fetchData = async () => {
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
                        imagenPerfil: n.imagenPerfil
                    };
                });
                setNegocios(mapped);
                
                if (user) {
                    try {
                        const jobsApi = await getTrabajos();
                        setGlobalJobs(jobsApi);
                    } catch (ign) {}
                }
            } catch (error) {
                console.error("Error al cargar negocios o trabajos:", error);
                const stored = localStorage.getItem('negocios_list');
                if (stored) setNegocios(JSON.parse(stored));
            }
        };
        fetchData();
    }, [user]);

    const filteredNegocios = negocios.filter((negocio) => {
        const matchesSearch = negocio.nombre.toLowerCase().includes(searchText.toLowerCase());

        // FILTRO POR ROL: El cliente solo ve lo suyo, el admin ve todo
        if (user?.role === 'cliente') {
            return matchesSearch && (negocio.dueno === user.name || negocio.user_id === user.id);
        }

        // FILTRO POR ROL: El encargado (legacy) o gerente-sucursal solo ven su sucursal asignada
        if (user?.role === 'encargado' || normalizeRole(user?.role) === 'gerente-sucursal') {
            return matchesSearch && (negocio.id === user.negocio_id);
        }

        // FILTRO POR ROL: El técnico solo ve los negocios donde tiene trabajos asignados
        if (user?.role === 'tecnico') {
            const hasAssignedJobs = globalJobs.some((j: any) => {
                if (j.negocio_id !== negocio.id) return false;
                
                const isMine = j.trabajador_id === user.id || j.trabajador?.user_id === user.id;
                if (!isMine) return false;

                const status = (j.estado || "").toLowerCase();
                // Ocultar si ya fue visitado (En Espera) o si ya finalizó
                const isProcessedVisita = j.tipo === "Visita" && (j.visitado || status === 'en espera');
                const isFinalizado = status === 'finalizado';

                return !isProcessedVisita && !isFinalizado;
            });
            return matchesSearch && hasAssignedJobs;
        }

        return matchesSearch;
    });

    const handleCardClick = (id: number) => {
        const role = normalizeRole(user?.role);
        const basePath = role === 'cliente' ? '/cliente'
            : role === 'tecnico-normal' ? '/tecnico'
            : role === 'gerente-sucursal' ? '/gerente-sucursal'
            : isAutonomoAdmin(user?.role) ? '/autonomo'
            : '/menu';
        navigate(`${basePath}/trabajo/${id}`);
    };

    const handleEditClick = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        const role = normalizeRole(user?.role);
        if (role === 'tecnico-normal') return; // El técnico no puede editar

        if (role === 'gerente-sucursal') {
            navigate(`/gerente-sucursal/sucursal?id=${id}`);
        } else if (user?.role === 'encargado') {
            navigate(`/encargado/sucursal?id=${id}`);
        } else if (user?.role === 'cliente') {
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
                        const hasValidCover = !!(negocio.imagen_portada && !coverImageErrors[negocio.id]);
                        const cardBg = '#ffffff';

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
                                            style={{ cursor: 'pointer' }}
                                            title="Editar Perfil"
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
                                            <span className={styles.cardDate}>{negocio.fecha}</span>
                                            <h3>{negocio.nombre}</h3>
                                            <p>Dueño: {negocio.dueno}</p>
                                            <p>Ubicación: {negocio.ubicacion}</p>
                                            <p className={negocio.status === 'Finalizado' ? styles.estadoFinalizado : styles.estadoPendiente}>
                                                Estado: {negocio.estado_geografico}
                                            </p>
                                        </div>

                                        <div className={`${styles.cardIndicator} ${negocio.status === 'Finalizado' ? styles.blue : ''}`}></div>
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

export default AutonomoListaNegocios;

