import React, { useEffect, useState, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import styles from "./Menu.module.css";
// Asegúrate de que la ruta al logo sea correcta
import logo from "../assets/imagenes/logo-agente-business.png";
import { useAuth } from "../context/AuthContext";
import { normalizeRole } from "../utils/roles";
import { 
    HiOutlineUser, HiOutlineBell, HiOutlineBriefcase, 
    HiOutlineUsers, HiOutlineDocumentText, HiOutlineClock,
    HiOutlineCurrencyDollar, HiOutlineWrench, HiOutlineSquares2X2,
    HiCheckBadge, HiOutlineArchiveBox, HiXMark, HiOutlineQuestionMarkCircle
} from "react-icons/hi2";
import { FaWhatsapp, FaEnvelope } from "react-icons/fa";
import { LuHardHat } from "react-icons/lu";
import { 
    getNotificaciones, 
    markNotificacionAsRead, 
    markAllNotificacionesAsRead 
} from "../services/notificacionesService";
import type { Notificacion } from "../services/notificacionesService";
import echo from "../services/echo";


const MenuLayout: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, loading, logout } = useAuth(); // Usamos el contexto
    const [sidebarOptions, setSidebarOptions] = useState<string[]>([]);
    const [activeOption, setActiveOption] = useState("");
    const [notificaciones, setNotificaciones] = useState<any[]>([]);
    const [mostrarNotificaciones, setMostrarNotificaciones] = useState(false);
    const [mostrarPerfil, setMostrarPerfil] = useState(false);
    const notificacionesRef = useRef<HTMLDivElement>(null);
    const perfilRef = useRef<HTMLDivElement>(null);

    // Estado para el carrusel de la tarjeta de contacto
    const [adSlide, setAdSlide] = useState(0);
    const [showSupportModal, setShowSupportModal] = useState(false);
    const [cvUrl, setCvUrl] = useState<string | null>(null);

    // Obtener CV URL del admin autonomo
    useEffect(() => {
        if (!user) return;
        if (normalizeRole(user.role) === 'autonomo') {
            setCvUrl(user.cv_url || null);
        } else if (user.admin_autonomo_id) {
            import("../services/usersService").then(({ getUserById }) => {
                getUserById(user.admin_autonomo_id!).then(adminData => {
                    if (adminData && adminData.cv_url) {
                        setCvUrl(adminData.cv_url);
                    }
                }).catch(e => console.error("Error fetching admin CV", e));
            });
        }
    }, [user]);

    // Efecto para el carrusel
    useEffect(() => {
        const adInterval = setInterval(() => {
            setAdSlide((prev) => (prev + 1) % 3);
        }, 4000);
        return () => clearInterval(adInterval);
    }, []);

    // Cerrar menús al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notificacionesRef.current && !notificacionesRef.current.contains(event.target as Node)) {
                setMostrarNotificaciones(false);
            }
            if (perfilRef.current && !perfilRef.current.contains(event.target as Node)) {
                setMostrarPerfil(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Obtener ruta base según el rol
    const getBaseRoute = () => {
        if (!user) return "/";
        const role = normalizeRole(user.role);
        if (role === 'admin') return "/menu";
        if (role === 'cliente') return "/cliente";
        if (role === 'tecnico-normal') return "/tecnico";
        if (role === 'tecnico-autonomo') return "/tecnico-autonomo";
        if (role === 'gerente-sucursal') return "/gerente-sucursal";
        if (role === 'autonomo' || role === 'administrador-general' || role === 'propietario-autonomo') return "/autonomo";
        return "/";
    };

    // Determinar si mostrar el botón de retroceder
    const shouldShowBackButton = () => {
        const path = location.pathname.toLowerCase().replace(/\/$/, "");
        const role = normalizeRole(user?.role);
        if (role === 'admin') {
            return path !== "/menu" && path !== "/menu/negocios";
        }
        if (role === 'cliente') {
            return path !== "/cliente" && path !== "/cliente/negocios";
        }
        if (role === 'tecnico-normal') {
            return path !== "/tecnico";
        }
        if (role === 'tecnico-autonomo') {
            return path !== "/tecnico-autonomo";
        }
        if (role === 'gerente-sucursal') {
            return path !== "/gerente-sucursal" && path !== "/gerente-sucursal/resumen";
        }
        if (role === 'autonomo' || role === 'propietario-autonomo' || role === 'administrador-general') {
            return path !== "/autonomo" && path !== "/autonomo/dashboard" && path !== "/autonomo/resumen";
        }
        return true;
    };

    // Cargar notificaciones
    const cargarNotificaciones = async () => {
        if (!user?.id) return;
        try {
            const data = await getNotificaciones(user.id);
            setNotificaciones(data);
        } catch (error) {
            console.error("Error cargando notificaciones de la BD:", error);
            // Fallback silencioso
        }
    };

    useEffect(() => {
        cargarNotificaciones();

        // Polling de respaldo cada 30 segundos para garantizar notificaciones en producción
        const interval = setInterval(() => {
            cargarNotificaciones();
        }, 30000);

        if (!user?.id) return () => clearInterval(interval);

        const channel = echo.private(`user.${user.id}`);
        channel.listen('.NotificationSent', (e: { notificacion: any }) => {
            if (e.notificacion) {
                setNotificaciones(prev => [e.notificacion, ...prev]);
            }
        });

        return () => {
            clearInterval(interval);
            channel.stopListening('.NotificationSent');
        };
    }, [user?.id]);

    // Cerrar click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notificacionesRef.current && !notificacionesRef.current.contains(event.target as Node)) {
                setMostrarNotificaciones(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const marcarUnaComoLeida = async (id: number) => {
        try {
            await markNotificacionAsRead(id);
            setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leido: true } : n));
        } catch (error) {
            console.error("Error al marcar como leída:", error);
        }
    };

    const marcarTodasComoLeidas = async () => {
        if (!user?.id) return;
        try {
            await markAllNotificacionesAsRead(user.id);
            setNotificaciones(prev => prev.map(n => ({ ...n, leido: true })));
        } catch (error) {
            console.error("Error al marcar todas como leídas:", error);
        }
    };

    const unreadCount = notificaciones.filter(n => !n.leido).length;

    // Determinar opciones del sidebar basado en el ROL y la RUTA
    useEffect(() => {
        if (!user) return;

        // Lógica base según el ROL
        let baseOptions: string[] = [];

        if (normalizeRole(user.role) === 'admin') {
            baseOptions = ["Negocios", "Dashboard", "Inventario General", "Trabajadores", "Usuarios", "Solicitudes", "Mantenimientos", "Trabajos Realizados"];
        } else if (normalizeRole(user.role) === 'autonomo' || normalizeRole(user.role) === 'propietario-autonomo' || normalizeRole(user.role) === 'administrador-general') {
            baseOptions = ["Mis Sucursales", "Mis Técnicos", "Usuarios", "Solicitudes", "Historial"];
        } else if (normalizeRole(user.role) === 'cliente') {
            baseOptions = ["Mis Negocios", "Cotizaciones", "Historial"];
        } else if (normalizeRole(user.role) === 'tecnico-normal') {
            baseOptions = ["Mis Trabajos", "Nueva Solicitud", "Historial de Trabajo"];
        } else if (normalizeRole(user.role) === 'tecnico-autonomo') {
            baseOptions = ["Mis Trabajos", "Historial de Trabajo"];
        } else if (normalizeRole(user.role) === 'gerente-sucursal') {
            baseOptions = ["Mi Sucursal", "Cotizaciones", "Historial"];
        }

        if (normalizeRole(user.role) === 'admin' && location.pathname.includes("/menu/trabajo/")) {
            setSidebarOptions(["Trabajos", "Cotización", "Historial"]);
            const params = new URLSearchParams(location.search);
            const tab = params.get('tab');
            setActiveOption(tab === 'cotizaciones' ? "Cotización" : (tab === 'historial' ? "Historial" : "Trabajos"));
        } else {
            setSidebarOptions(baseOptions);

            // Lógica para mantener activo el botón correcto
            const path = location.pathname;

            if (path.startsWith("/menu")) {
                if (path === "/menu" || path === "/menu/") setActiveOption("Negocios");
                else if (path.includes("dashboard")) setActiveOption("Dashboard");
                else if (path.includes("inventario-general")) setActiveOption("Inventario General");
                else if (path.includes("trabajador")) setActiveOption("Trabajadores");
                else if (path.includes("usuarios")) setActiveOption("Usuarios");
                else if (path.includes("solicitudes")) setActiveOption("Solicitudes");
                else if (path.includes("mantenimiento")) setActiveOption("Mantenimientos");
                else if (path.includes("trabajos-realizados")) setActiveOption("Trabajos Realizados");
                else setActiveOption("Negocios");
            } else if (path.startsWith("/autonomo")) {
                if (path === "/autonomo" || path === "/autonomo/" || path.includes("dashboard")) setActiveOption("Mi Dashboard");
                else if (path.includes("negocios") || path.includes("perfil-empresa")) setActiveOption("Mis Sucursales");
                else if (path.includes("trabajador") || path.includes("tecnico")) setActiveOption("Mis Técnicos");
                else if (path.includes("usuarios")) setActiveOption("Usuarios");
                else if (path.includes("solicitudes")) setActiveOption("Solicitudes");
                else if (path.includes("historial")) setActiveOption("Historial");
            } else if (path.startsWith("/cliente")) {
                if (path === "/cliente" || path === "/cliente/") setActiveOption("Mis Negocios");
                else if (path.includes("negocios") || path.includes("perfil-empresa")) setActiveOption("Mis Negocios");
                else if (path.includes("cotizaciones")) setActiveOption("Cotizaciones");
                else if (path.includes("historial")) setActiveOption("Historial");
            } else if (path.startsWith("/tecnico-autonomo")) {
                if (path === "/tecnico-autonomo" || path === "/tecnico-autonomo/") setActiveOption("Mis Trabajos");
                else if (path.includes("mi-perfil")) setActiveOption("Mi Perfil");
                else if (path.includes("historial")) setActiveOption("Historial de Trabajo");
            } else if (path.startsWith("/tecnico")) {
                if (path === "/tecnico" || path === "/tecnico/") setActiveOption("Mis Trabajos");
                else if (path.includes("solicitudes")) setActiveOption("Nueva Solicitud");
                else if (path.includes("historial")) setActiveOption("Historial de Trabajo");
            } else if (path.startsWith("/gerente-sucursal")) {
                if (path === "/gerente-sucursal" || path === "/gerente-sucursal/") setActiveOption("Mi Sucursal");
                else if (path.includes("negocios") || path.includes("sucursal")) setActiveOption("Mi Sucursal");
                else if (path.includes("cotizaciones")) setActiveOption("Cotizaciones");
                else if (path.includes("historial")) setActiveOption("Historial");
            }
        }
    }, [location.pathname, user]);

    const handleNavigation = (option: string) => {
        setActiveOption(option);

        // Admin principal
        if (option === "Dashboard") navigate("/menu/dashboard");
        if (option === "Negocios") navigate("/menu/negocios");
        if (option === "Inventario General") navigate("/menu/inventario-general");
        if (option === "Trabajadores") navigate("/menu/trabajadores");
        if (option === "Usuarios") {
            if (normalizeRole(user?.role) === 'autonomo' || normalizeRole(user?.role) === 'propietario-autonomo' || normalizeRole(user?.role) === 'administrador-general') navigate("/autonomo/usuarios");
            else navigate("/menu/usuarios");
        }
        if (option === "Solicitudes") {
            if (normalizeRole(user?.role) === 'autonomo' || normalizeRole(user?.role) === 'propietario-autonomo' || normalizeRole(user?.role) === 'administrador-general') navigate("/autonomo/solicitudes");
            else navigate("/menu/solicitudes");
        }
        if (option === "Solicitudes Proveedores") navigate("/menu/solicitudes-proveedores");
        if (option === "Mantenimientos") navigate("/menu/mantenimiento");
        if (option === "Trabajos Realizados") navigate("/menu/trabajos-realizados");

        // Admin Autónomo
        if (option === "Mis Sucursales") navigate("/autonomo/negocios");
        if (option === "Mis Técnicos") navigate("/autonomo/trabajadores");

        // Cliente y Encargado
        if (option === "Resumen") {
            if (normalizeRole(user?.role) === 'cliente') navigate("/cliente/resumen");
            else if (normalizeRole(user?.role) === 'gerente-sucursal') navigate("/gerente-sucursal/resumen");
        }
        if (option === "Mis Negocios") navigate("/cliente/negocios");
        if (option === "Mi Sucursal") {
            if (normalizeRole(user?.role) === 'gerente-sucursal') navigate("/gerente-sucursal/negocios");
        }

        if (option === "Cotizaciones") {
            if (normalizeRole(user?.role) === 'gerente-sucursal') navigate("/gerente-sucursal/cotizaciones");
            else navigate("/cliente/cotizaciones");
        }

        if (option === "Historial") {
            if (normalizeRole(user?.role) === 'tecnico-normal') navigate("/tecnico/historial");
            else if (user?.role === 'tecnico-autonomo') navigate("/tecnico-autonomo/historial");
            else if (normalizeRole(user?.role) === 'gerente-sucursal') navigate("/gerente-sucursal/historial");
            else if (normalizeRole(user?.role) === 'autonomo' || normalizeRole(user?.role) === 'propietario-autonomo' || normalizeRole(user?.role) === 'administrador-general') navigate("/autonomo/historial");
            else navigate("/cliente/historial");
        }

        if (option === "Mis Trabajos") {
            if (normalizeRole(user?.role) === 'tecnico-autonomo') navigate("/tecnico-autonomo");
            else navigate("/tecnico");
        }
        if (option === "Nueva Solicitud") navigate("/tecnico/solicitudes");
        if (option === "Mi Perfil") navigate("/tecnico-autonomo/mi-perfil");
        if (option === "Historial de Trabajo") {
            if (normalizeRole(user?.role) === 'tecnico-autonomo') navigate("/tecnico-autonomo/historial");
            else navigate("/tecnico/historial");
        }

        // Lógica para Admin dentro de una sucursal
        if (option === "Trabajos" && location.pathname.includes("/menu/trabajo/")) {
            navigate(location.pathname);
        }
        if (option === "Cotización" && location.pathname.includes("/menu/trabajo/")) {
            navigate(location.pathname + "?tab=cotizaciones");
        }
        if (option === "Historial" && location.pathname.includes("/menu/trabajo/")) {
            navigate(location.pathname + "?tab=historial");
        }
    };

    const handleBackClick = () => {
        const params = new URLSearchParams(location.search);
        if (location.pathname.includes("/trabajo/")) {
            if (params.has("tab")) {
                navigate(location.pathname);
            } else {
                if (normalizeRole(user?.role) === 'admin') navigate("/menu/negocios");
                else if (normalizeRole(user?.role) === 'autonomo' || normalizeRole(user?.role) === 'propietario-autonomo' || normalizeRole(user?.role) === 'administrador-general') navigate("/autonomo/negocios");
                else if (normalizeRole(user?.role) === 'cliente') navigate("/cliente/negocios");
                else if (normalizeRole(user?.role) === 'gerente-sucursal') navigate("/gerente-sucursal/negocios");
                else if (normalizeRole(user?.role) === 'tecnico-normal') navigate("/tecnico");
                else if (normalizeRole(user?.role) === 'tecnico-autonomo') navigate("/tecnico-autonomo");
                else navigate(-1);
            }
        } else if (location.pathname.includes("/trabajador/")) {
            if (normalizeRole(user?.role) === 'admin') navigate("/menu/trabajadores");
            else if (normalizeRole(user?.role) === 'autonomo' || normalizeRole(user?.role) === 'propietario-autonomo' || normalizeRole(user?.role) === 'administrador-general') navigate("/autonomo/trabajadores");
            else navigate(-1);
        } else {
            navigate(-1);
        }
    };

    // Helper to detect tecnico-autonomo role
    const isTecnicoAutonomo = normalizeRole(user?.role) === 'tecnico-autonomo';

    const getIconForOption = (option: string) => {
        switch (option) {
            case "Dashboard":
            case "Mi Dashboard":
                return <HiOutlineSquares2X2 size={22} />;
            case "Inventario General":
                return <HiOutlineArchiveBox size={22} />;
            case "Negocios":
            case "Mis Negocios":
            case "Mis Sucursales":
                return <HiOutlineBriefcase size={22} />;
            case "Trabajadores":
            case "Mis Técnicos":
                return <LuHardHat size={22} />;
            case "Usuarios":
                return <HiOutlineUsers size={22} />;
            case "Solicitudes":
            case "Nueva Solicitud":
                return <HiOutlineDocumentText size={22} />;
            case "Trabajos Realizados":
            case "Historial":
            case "Historial de Trabajo":
                return <HiOutlineClock size={22} />;
            case "Cotizaciones":
            case "Cotización":
                return <HiOutlineCurrencyDollar size={22} />;
            case "Trabajos":
            case "Mis Trabajos":
            case "Reportes Mantenimiento":
            case "Mantenimientos":
                return <HiOutlineWrench size={22} />;
            default:
                return <HiOutlineDocumentText size={22} />;
        }
    };



    if (loading) return null;

    return (
        <div className={styles.container}>
            {/* BRILLOS AMBIENTALES DE FONDO (AURORA MESH) */}
            <div className={styles.glowBgContainer}>
                <div className={`${styles.glowBlob} ${styles.glow1}`}></div>
                <div className={`${styles.glowBlob} ${styles.glow2}`}></div>
                <div className={`${styles.glowBlob} ${styles.glow3}`}></div>
            </div>

            {/* SIDEBAR IZQUIERDO */}
            <aside className={styles.sidebar}>
                <div className={styles.logoContainer}>
                    <img 
                        src={logo} 
                        alt="Logo" 
                        className={styles.logo} 
                    />
                </div>

                <nav className={styles.menu}>
                    {activeOption && sidebarOptions.indexOf(activeOption) !== -1 && (
                        <div 
                            className={styles.fluidIndicator} 
                            style={{
                                '--active-index': sidebarOptions.indexOf(activeOption),
                                '--options-count': sidebarOptions.length,
                                transform: `translateY(${sidebarOptions.indexOf(activeOption) * 54}px)`
                            } as React.CSSProperties}
                        />
                    )}
                    {sidebarOptions.map((option) => (
                        <button
                            key={option}
                            className={`${styles.menuItem} ${activeOption === option ? styles.active : ""}`}
                            onClick={() => handleNavigation(option)}
                        >
                            <span className={styles.menuIcon}>{getIconForOption(option)}</span>
                            <span className={styles.menuText}>{option}</span>
                        </button>
                    ))}
                </nav>

                {/* ENLACE PARA ABRIR PUBLICIDAD / CONTACTO (Solo Ecosistema Autónomo) */}
                {(normalizeRole(user?.role) === 'autonomo' || normalizeRole(user?.role) === 'propietario-autonomo' || normalizeRole(user?.role) === 'administrador-general' || normalizeRole(user?.role) === 'gerente-sucursal' || normalizeRole(user?.role) === 'tecnico-normal' || normalizeRole(user?.role) === 'cliente') && (
                    <div className={styles.sidebarSupportWrapper}>
                        <button 
                            className={styles.supportLinkBtn}
                            onClick={() => setShowSupportModal(true)}
                        >
                            ¿Necesitas ayuda? Contáctanos
                        </button>
                    </div>
                )}
            </aside>

            {/* AREA DERECHA */}
            <div className={styles.mainArea}>
                {/* HEADER SUPERIOR - Ocultar en detalle, verif tarea y reporte */}
                {!location.pathname.includes("/trabajo-detalle") && !location.pathname.includes("/verificacion-tarea") && !location.pathname.includes("/reporte-tarea") && (
                    <header className={styles.header}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            {shouldShowBackButton() && (
                                <button 
                                    onClick={handleBackClick} 
                                    style={{ 
                                        background: 'rgba(0,0,0,0.2)', 
                                        border: 'none', 
                                        cursor: 'pointer', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        width: '36px', 
                                        height: '36px', 
                                        borderRadius: '50%', 
                                        transition: 'all 0.2s',
                                        flexShrink: 0,
                                        padding: 0
                                    }}
                                    title="Retroceder"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M15 18l-6-6 6-6" />
                                    </svg>
                                </button>
                            )}
                            <h2 style={{ margin: 0 }}>
                                {activeOption}
                            </h2>
                        </div>

                        <div className={styles.headerActions}>
                            {/* El botón Agregar fue removido a petición del usuario */}
                            <div className={styles.notificationWrapper} ref={notificacionesRef}>
                                <button
                                    className={styles.iconBtn}
                                    onClick={() => {
                                        const next = !mostrarNotificaciones;
                                        setMostrarNotificaciones(next);
                                        if (next) cargarNotificaciones();
                                    }}
                                >
                                    <HiOutlineBell size={24} />
                                    {unreadCount > 0 && <span className={styles.notificationBadge}>{unreadCount}</span>}
                                </button>

                                {mostrarNotificaciones && (
                                    <div className={styles.notificationDropdown}>
                                        <div className={styles.dropdownHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <h4>Notificaciones</h4>
                                            {unreadCount > 0 && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); marcarTodasComoLeidas(); }}
                                                    style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                >
                                                    <HiCheckBadge /> Leer todas
                                                </button>
                                            )}
                                        </div>
                                        <div className={styles.dropdownBody}>
                                            {notificaciones.length > 0 ? (
                                                notificaciones.map((noti: Notificacion) => (
                                                    <div key={noti.id} className={`${styles.notificationItem} ${!noti.leido ? styles.notificationUnread : ''}`} onClick={() => {
                                                        marcarUnaComoLeida(noti.id);
                                                        let targetUrl = noti.enlace || '';
                                                        
                                                        // Fallback: Si no hay enlace directo, buscar el ID del trabajo en el texto (ej. "solicitud #38")
                                                        if (!targetUrl) {
                                                            const text = `${noti.titulo || ''} ${noti.mensaje || ''}`;
                                                            const match = text.match(/#(\d+)/);
                                                            if (match && match[1]) {
                                                                targetUrl = `/menu/trabajo-detalle/${match[1]}?tab=cotizacion`;
                                                            }
                                                        }

                                                        if (targetUrl) {
                                                            const rolePrefix = normalizeRole(user?.role) === 'tecnico-normal' ? '/tecnico/' :
                                                                               normalizeRole(user?.role) === 'tecnico-autonomo' ? '/tecnico-autonomo/' :
                                                                               normalizeRole(user?.role) === 'gerente-sucursal' ? '/gerente-sucursal/' :
                                                                               normalizeRole(user?.role) === 'cliente' ? '/cliente/' :
                                                                               (normalizeRole(user?.role) === 'autonomo' || normalizeRole(user?.role) === 'propietario-autonomo' || normalizeRole(user?.role) === 'administrador-general') ? '/autonomo/' : '/menu/';

                                                            if (targetUrl.startsWith('/menu/')) targetUrl = targetUrl.replace('/menu/', rolePrefix);
                                                            else if (targetUrl.startsWith('/tecnico/')) targetUrl = targetUrl.replace('/tecnico/', rolePrefix);
                                                            else if (targetUrl.startsWith('/tecnico-autonomo/')) targetUrl = targetUrl.replace('/tecnico-autonomo/', rolePrefix);
                                                            else if (targetUrl.startsWith('/gerente-sucursal/')) targetUrl = targetUrl.replace('/gerente-sucursal/', rolePrefix);
                                                            else if (targetUrl.startsWith('/cliente/')) targetUrl = targetUrl.replace('/cliente/', rolePrefix);
                                                            else if (targetUrl.startsWith('/autonomo/')) targetUrl = targetUrl.replace('/autonomo/', rolePrefix);

                                                            navigate(targetUrl);
                                                        }
                                                        setMostrarNotificaciones(false);
                                                    }}>
                                                        <div className={styles.notificationIcon}>
                                                            {(() => {
                                                                const t = (noti.titulo || '').toLowerCase();
                                                                if (t.includes('sos') || t.includes('emergencia')) return '🚨';
                                                                if (t.includes('sucursal') || t.includes('negocio')) return '🏢';
                                                                if (t.includes('visita') && t.includes('finaliz')) return '🔍';
                                                                if (t.includes('finalizado') || t.includes('reporte')) return '✅';
                                                                if (t.includes('cotizaci')) return '📄';
                                                                if (t.includes('trabajo') && t.includes('asign')) return '🛠️';
                                                                if (t.includes('solicitud')) return '📋';
                                                                return '🔔';
                                                            })()}
                                                        </div>
                                                        <div className={styles.notificationContent}>
                                                            <div className={styles.notificationTitle}>{noti.titulo}</div>
                                                            <div className={styles.notificationMessage}>{noti.mensaje}</div>
                                                            <div className={styles.notificationTime}>
                                                                {new Date(noti.created_at).toLocaleDateString()} {new Date(noti.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </div>
                                                        {!noti.leido && <div className={styles.notificationDot}></div>}
                                                    </div>
                                                ))
                                            ) : (<div className={styles.noNotifications}>No hay notificaciones recientes.</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className={styles.perfilWrapper} ref={perfilRef}>
                                <button
                                    className={styles.iconBtn}
                                    onClick={() => setMostrarPerfil(!mostrarPerfil)}
                                >
                                    {user?.avatar ? (
                                        <img src={user.avatar} alt="Perfil" className={styles.topbarAvatar} />
                                    ) : (
                                        <HiOutlineUser size={24} />
                                    )}
                                </button>

                                {mostrarPerfil && (
                                    <div className={styles.perfilDropdown}>
                                        <div className={styles.perfilHeader}>
                                            <p className={styles.userName}>{user?.name}</p>
                                            <p className={styles.userRole}>
                                                {(() => {
                                                    const roleRaw = typeof user?.role === 'object' && user?.role !== null ? (user.role as any).name : user?.role;
                                                    const norm = normalizeRole(roleRaw);
                                                    if (norm === 'admin') return 'Administrador';
                                                    if (norm === 'tecnico-normal') return 'Técnico';
                                                    if (norm === 'tecnico-autonomo') return 'Técnico Autónomo';
                                                    if (norm === 'gerente-sucursal') return 'Encargado de Sucursal';
                                                    if (norm === 'autonomo' || norm === 'propietario-autonomo') return 'Admin Autónomo';
                                                    if (norm === 'administrador-general') return 'Administrador General';
                                                    return 'Cliente';
                                                })()}
                                            </p>
                                        </div>
                                        <div className={styles.dropdownDivider} />
                                        <button 
                                            className={styles.dropdownItem}
                                            onClick={() => {
                                                setMostrarPerfil(false);
                                                if (normalizeRole(user?.role) === 'cliente') navigate("/cliente/mi-perfil");
                                                else if (normalizeRole(user?.role) === 'admin') navigate("/menu/mi-perfil");
                                                else if (normalizeRole(user?.role) === 'tecnico-normal') navigate("/tecnico/mi-perfil");
                                                else if (normalizeRole(user?.role) === 'gerente-sucursal') navigate("/gerente-sucursal/mi-perfil");
                                                else if (normalizeRole(user?.role) === 'autonomo' || normalizeRole(user?.role) === 'propietario-autonomo' || normalizeRole(user?.role) === 'administrador-general') navigate("/autonomo/mi-perfil");
                                                else if (user?.role === 'tecnico-autonomo') navigate("/tecnico-autonomo/mi-perfil");
                                                else navigate("/cliente/mi-perfil");
                                            }}
                                        >
                                            Ver Perfil
                                        </button>
                                        <button 
                                            className={`${styles.dropdownItem} ${styles.logoutItem}`}
                                            onClick={() => {
                                                setMostrarPerfil(false);
                                                logout();
                                                navigate("/inicio-sesion");
                                            }}
                                        >
                                            Cerrar Sesión
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </header>
                )}

                {/* CONTENIDO (Aquí se renderizan las vistas) */}
                <main
                    className={styles.content}
                    style={
                        (location.pathname.includes("/trabajo-detalle") || location.pathname.includes("/verificacion-tarea") || location.pathname.includes("/reporte-tarea"))
                            ? { padding: 0 }
                            : {}
                    }
                >
                    <Outlet />
                </main>
            </div>

            {/* MODAL DE SOPORTE Y CONTACTO */}
            {showSupportModal && (
                <div className={styles.modalOverlay} onClick={() => setShowSupportModal(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ background: '#0d192b', padding: 0, overflow: 'hidden', position: 'relative', width: '90%', maxWidth: '440px' }}>
                        <div className={styles.adCard} style={{ marginTop: 0, marginBottom: 0, border: 'none', boxShadow: 'none', position: 'relative', padding: '24px 20px 20px 20px' }}>
                            <div className={styles.adGlow}></div>
                            
                            {/* BOTÓN CERRAR CON Z-INDEX ALTO Y POSICIONAMIENTO EN ESQUINA CON ICONO SVG INLINE */}
                            <button 
                                onClick={() => setShowSupportModal(false)} 
                                style={{ 
                                    position: 'absolute',
                                    top: 15,
                                    right: 15,
                                    zIndex: 9999,
                                    background: 'rgba(255, 255, 255, 0.15)', 
                                    border: 'none', 
                                    color: '#fff', 
                                    cursor: 'pointer',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backdropFilter: 'blur(4px)',
                                    transition: 'background 0.2s',
                                    padding: 0,
                                    boxSizing: 'border-box',
                                    flexShrink: 0
                                }}
                            >
                                <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, display: 'block', flexShrink: 0 }} stroke="#ffffff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>

                            <div className={styles.adLogoContainer} style={{ marginBottom: 5 }}>
                                <img src={logo} alt="Agente Solutions" className={styles.adLogo} style={{ width: 200, marginBottom: 5, transform: 'scale(1.3)', transformOrigin: 'center' }} />
                            </div>
                            <h4 className={styles.adTitle} style={{ fontSize: 16, marginBottom: 8, marginTop: 10 }}>Soporte y Atención</h4>
                            
                            <div className={styles.adCarousel} style={{ minHeight: 30, marginBottom: 15 }}>
                                {adSlide === 0 && <p className={styles.adSlideText} style={{ fontSize: 13 }}>Resolviendo tus necesidades al instante.</p>}
                                {adSlide === 1 && <p className={styles.adSlideText} style={{ fontSize: 13 }}>Mantenimiento a subestaciones, climas, y más.</p>}
                                {adSlide === 2 && <p className={styles.adSlideText} style={{ fontSize: 13 }}>Garantía de satisfacción en cada trabajo.</p>}
                            </div>

                            <div className={styles.adActions} style={{ gap: 10 }}>
                                <a href="https://wa.me/529992426030" target="_blank" rel="noreferrer" className={`${styles.adBtn} ${styles.btnWhatsapp}`} style={{ padding: '10px', fontSize: 14 }}>
                                    <FaWhatsapp size={18} /> Contactar por WhatsApp
                                </a>
                                <a href="mailto:Ernestososa2022@hotmail.com" className={`${styles.adBtn} ${styles.btnEmail}`} style={{ padding: '10px', fontSize: 14 }}>
                                    <FaEnvelope size={18} /> Enviar Correo Electrónico
                                </a>
                                <a href={cvUrl || "#"} onClick={(e) => !cvUrl && e.preventDefault()} target={cvUrl ? "_blank" : undefined} rel="noreferrer" className={`${styles.adBtn} ${styles.btnCv}`} style={{ padding: '10px', fontSize: 14, opacity: cvUrl ? 1 : 0.5, cursor: cvUrl ? 'pointer' : 'not-allowed' }}>
                                    <HiOutlineDocumentText size={18} /> {cvUrl ? 'Ver Nuestro Currículum' : 'Currículum No Disponible'}
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* BOTÓN FLOTANTE DE SOPORTE (Solo en móviles) */}
            {(normalizeRole(user?.role) === 'autonomo' || normalizeRole(user?.role) === 'propietario-autonomo' || normalizeRole(user?.role) === 'administrador-general' || normalizeRole(user?.role) === 'gerente-sucursal' || normalizeRole(user?.role) === 'tecnico-normal' || normalizeRole(user?.role) === 'cliente') && (
                <button 
                    className={styles.mobileSupportFab}
                    onClick={() => setShowSupportModal(true)}
                    title="Soporte y Ayuda"
                >
                    <HiOutlineQuestionMarkCircle size={28} />
                </button>
            )}
        </div >
    );
};

export default MenuLayout;
