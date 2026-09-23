import React, { useState, useEffect } from "react";
import { createTrabajo, getTrabajos, updateEstadoTrabajo, assignTrabajador, updateTrabajo, deleteTrabajo, getTrabajo } from "../../services/trabajosService";
import { createMantenimientoSolicitud } from "../../services/mantenimientoService";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import menuStyles from "../../components/Menu.module.css";
import styles from "./Trabajodetalles.module.css";
import { useAuth } from "../../context/AuthContext";
import { isAutonomoAdmin } from "../../utils/roles";
import { useModal } from "../../context/ModalContext";
import Historial from "../cliente/Historial";
import Cotizaciones from "../cliente/Cotizaciones";
import { getTrabajadores } from "../../services/trabajadoresService";
import { createNotificacion, createNotificacionByRole } from "../../services/notificacionesService";
import { getReporteByTrabajoId } from "../../services/reportesService";
import ReporteDetailModal from "../../components/modals/ReporteDetailModal";
import NuevoServicioModal from "../../components/modals/NuevoServicioModal";
import type { ServiceForm } from "../../components/modals/NuevoServicioModal";
import { compressImage } from "../../utils/imageCompression";
import { HiOutlineClock, HiOutlineListBullet, HiOutlineArrowPath, HiOutlineCheckCircle, HiOutlineClipboardDocument, HiOutlineChevronRight, HiOutlineArchiveBox } from "react-icons/hi2";
import { HiOutlineBolt, HiOutlinePaperAirplane } from "react-icons/hi2";

// ── Hooks propios ─────────────────────────────────────────────────────────────
import { useNegocioData } from "./hooks/useNegocioData";
import { useTrabajosData } from "./hooks/useTrabajosData";
import { useLevantamiento } from "./hooks/useLevantamiento";
import { useRolePermissions } from "./hooks/useRolePermissions";

// ── Subcomponentes ────────────────────────────────────────────────────────────
import BusinessBanner from "./components/BusinessBanner";
import JobCard from "./components/JobCard";
import SummaryGrid from "./components/SummaryGrid";
import EquiposTab from "./components/EquiposTab";
import AssignTechnicianModal from "./components/AssignTechnicianModal";
import TechRequestModal from "./components/TechRequestModal";
import RejectionModal from "./components/RejectionModal";

// ── Tipos ─────────────────────────────────────────────────────────────────────
import type { Trabajo, AsignacionTecnico, Tecnico } from "../../types/trabajo.types";

// ─────────────────────────────────────────────────────────────────────────────

const TrabajoDetalle: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showAlert, showConfirm } = useModal();
    const [searchParams, setSearchParams] = useSearchParams();

    const isCotizacionesTab = searchParams.get("tab") === "cotizaciones";
    const isHistorialTab    = searchParams.get("tab") === "historial";
    const isEquiposTab      = searchParams.get("tab") === "equipos";

    // ── Permisos ──────────────────────────────────────────────────────────────
    const {
        canEdit, canSeeActions, canSeeSOS, canSeeSolicitud, canSeeEquipos,
        isTecnico, isAdmin, isCliente, isEncargado, isAutonomo, getBasePath
    } = useRolePermissions(user);

    const canEditBanner = isCliente || isEncargado || isAutonomo;

    // ── Datos de negocio ──────────────────────────────────────────────────────
    const {
        businessName, setBusinessName,
        businessImage, setBusinessImage,
        businessDetails,
        businessAreas, setBusinessAreas,
        bannerY, setBannerY,
        isAdjustingPosition, setIsAdjustingPosition,
        fileInputRef,
        handleBannerChange,
        saveBannerPosition,
        getBusinessAddress,
    } = useNegocioData(id, (name) => {
        setNewRequestData(prev => ({ ...prev, cliente: name }));
    });

    // ── Datos de trabajos ─────────────────────────────────────────────────────
    const {
        trabajosData, setTrabajosData,
        saveJobs, reloadTrabajosList,
        allSolicitudes,
    } = useTrabajosData(id, businessName);

    // ── Levantamiento ─────────────────────────────────────────────────────────
    const {
        persistLevantamiento,
        handleAddArea,
        handleAddSubArea,
        handleDeleteArea,
        editAreaName,
    } = useLevantamiento(id, businessAreas, setBusinessAreas);

    // ── Técnicos ──────────────────────────────────────────────────────────────
    const [tecnicosData, setTecnicosData] = useState<Tecnico[]>([]);

    useEffect(() => {
        const cached = localStorage.getItem('trabajadores_list');
        if (cached) {
            try {
                const list = JSON.parse(cached);
                const techList = list.filter((t: any) => t.estado?.toLowerCase() === "activo" || t.estado === "Activo");
                setTecnicosData(techList.map((t: any) => ({
                    id: t.id,
                    userId: t.user_id || null,
                    nombre: t.nombre
                })));
            } catch (_) {}
        }

        const fetchTecnicos = async () => {
            try {
                const data = await getTrabajadores();
                const techList = data.filter((t: any) => t.estado?.toLowerCase() === "activo" || t.estado === "Activo");
                setTecnicosData(techList.map((t: any) => ({
                    id: t.id,
                    userId: t.user_id || null,
                    nombre: t.nombre
                })));
            } catch (error) {
                console.error("Error al obtener técnicos:", error);
            }
        };
        fetchTecnicos();
    }, []);

    // ── Estado modal solicitar técnico ────────────────────────────────────────
    const [isTechRequestModalOpen, setIsTechRequestModalOpen] = useState(false);
    const [requestRole, setRequestRole] = useState("");

    const handleRequestTechnician = async () => {
        if (!requestRole) {
            showAlert("Atención", "Por favor selecciona el tipo de técnico que necesitas.", "warning");
            return;
        }
        try {
            const isEncargado = user?.role === 'gerente-sucursal' || user?.role === 'encargado';
            await createNotificacionByRole({
                role: "admin",
                titulo: "Solicitud de Técnico",
                mensaje: `El usuario ${user?.name || "encargado"} solicita un técnico con especialidad: ${requestRole}.`,
                enlace: isAutonomoAdmin(user?.role) || isEncargado ? "/autonomo/trabajadores" : "/menu/trabajadores",
                negocio_id: Number(id)
            });
            showAlert("Éxito", "Solicitud enviada al administrador principal.", "success");
            setIsTechRequestModalOpen(false);
            setRequestRole("");
        } catch (error) {
            console.error(error);
            showAlert("Error", "No se pudo enviar la solicitud.", "error");
        }
    };

    // ── Estado búsqueda y filtros ─────────────────────────────────────────────
    const [searchText, setSearchText] = useState("");
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>("Todos");
    const [activeSummaryTab, setActiveSummaryTab] = useState<string | null>(null);
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // ── Estado modal asignación técnico ───────────────────────────────────────
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedJobId] = useState<number | null>(null);
    const [selectedAssignments, setSelectedAssignments] = useState<AsignacionTecnico[]>([]);
    const [technicianSearch, setTechnicianSearch] = useState("");
    const [selectedType, setSelectedType] = useState<"Visita" | "Trabajo">("Visita");

    const handleTechToggle = (tech: Tecnico) => {
        const isSelected = selectedAssignments.some(a => a.tecnicoId === tech.id);
        if (isSelected) {
            setSelectedAssignments(selectedAssignments.filter(a => a.tecnicoId !== tech.id));
        } else {
            setSelectedAssignments([...selectedAssignments, {
                tecnicoId: tech.id,
                userId: tech.userId ?? undefined,
                tecnicoNombre: tech.nombre,
                fechaAsignada: "",
                horaAsignada: ""
            }]);
        }
    };

    const handleUpdateAssignmentDate = (tecnicoId: number, field: "fechaAsignada" | "horaAsignada", value: string) => {
        setSelectedAssignments(prev => prev.map(a => a.tecnicoId === tecnicoId ? { ...a, [field]: value } : a));
    };

    // ── Estado modal nueva solicitud ──────────────────────────────────────────
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [isEditingRequest, setIsEditingRequest] = useState(false);
    const [isSOSRequest, setIsSOSRequest] = useState(false);
    const [fotosSOS, setFotosSOS] = useState<File[]>([]);
    const [fotosPreviewUrls, setFotosPreviewUrls] = useState<string[]>([]);
    const [editingRequestId, setEditingRequestId] = useState<number | null>(null);
    const [selectedZoomImage, setSelectedZoomImage] = useState<string | null>(null);
    const [activeSlides, setActiveSlides] = useState<{ [jobId: string]: number }>({});
    const [formServices, setFormServices] = useState<ServiceForm[]>([]);
    const [deletedDbIds, setDeletedDbIds] = useState<number[]>([]);
    const [newRequestData, setNewRequestData] = useState({
        categoria: "Electricidad",
        cliente: "",
        fecha: new Date().toISOString().split("T")[0],
        descripcion: "",
        equipoSeleccionado: "",
        trabajador_id: ""
    });
    const [customCategoria, setCustomCategoria] = useState("");

    // ── Estado modal reporte detallado ────────────────────────────────────────
    const [reporteModalOpen, setReporteModalOpen] = useState(false);
    const [reporteData, setReporteData] = useState<any>(null);
    const [reporteTrabajo, setReporteTrabajo] = useState<any>(null);
    const [reporteTaskInfo, setReporteTaskInfo] = useState<any>(null);

    // ── Estado modal rechazo cotización ──────────────────────────────────────
    const [showRejectionModal, setShowRejectionModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");
    const [quoteToReject, setQuoteToReject] = useState<number | null>(null);

    // ─────────────────────────────────────────────────────────────────────────
    // Utilidades
    // ─────────────────────────────────────────────────────────────────────────

    const parseFotoUrls = (fotoUrl: any): string[] => {
        if (!fotoUrl) return [];
        let urls: string[] = [];
        if (typeof fotoUrl === "string") {
            if (fotoUrl.trim().startsWith("[")) {
                try {
                    const parsed = JSON.parse(fotoUrl);
                    if (Array.isArray(parsed)) urls = parsed;
                } catch (e) { console.error("Error parsing foto_url JSON:", e); }
            } else {
                urls = [fotoUrl];
            }
        } else if (Array.isArray(fotoUrl)) {
            urls = fotoUrl;
        }
        const baseUrl = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8085/api").replace(/\/api\/?$/, "");
        return urls.map(url => {
            if (typeof url === "string") {
                if (url.includes("127.0.0.1") || url.includes("localhost")) {
                    const parts = url.split("/storage/");
                    if (parts.length === 2) return `${baseUrl}/storage/${parts[1]}`;
                } else if (url.startsWith("/storage/")) {
                    return `${baseUrl}${url}`;
                } else if (url.startsWith("storage/")) {
                    return `${baseUrl}/${url}`;
                }
            }
            return url;
        });
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Filtrado y agrupación de trabajos
    // ─────────────────────────────────────────────────────────────────────────

    const getGroupedJobs = () => {
        const groups: { [key: string]: Trabajo[] } = {};

        let filteredJobs = trabajosData.filter(job => {
            if (job.estado === "Eliminado") return false;

            const matchesSearch =
                (job.titulo || "").toLowerCase().includes(searchText.toLowerCase()) ||
                (job.tecnico || "").toLowerCase().includes(searchText.toLowerCase());

            let matchesStatus = true;
            if (filterStatus !== "Todos") {
                if (isCotizacionesTab) {
                    if (filterStatus === "Pagados" && !["Cotización Aceptada", "Asignado", "En Proceso", "Finalizado"].includes(job.estado)) matchesStatus = false;
                    if (filterStatus === "En espera" && job.estado !== "Cotización Enviada") matchesStatus = false;
                    if (filterStatus === "Rechazado" && job.estado !== "Cotización Rechazada") matchesStatus = false;
                } else {
                    if (filterStatus === "Completadas" && job.estado !== "Finalizado") matchesStatus = false;
                    if (filterStatus === "En espera" && job.estado !== "En Espera") matchesStatus = false;
                    if (filterStatus === "Asignados" && job.estado !== "Asignado") matchesStatus = false;
                    if (filterStatus === "Sin asignar" && job.tecnico !== "Sin asignar") matchesStatus = false;
                    if (filterStatus === "En proceso" && !["En Proceso", "Asignado", "En Espera", "Cotización Aceptada", "Cotización Aprobada"].includes(job.estado)) matchesStatus = false;
                    if (filterStatus === "Finalizadas" && job.estado !== "Finalizado") matchesStatus = false;
                    if (filterStatus === "Solicitud" && job.estado !== "Solicitud") matchesStatus = false;
                }
            }

            let matchesCotizacion = true;
            if (isCotizacionesTab) matchesCotizacion = !!job.cotizacion;

            return matchesSearch && matchesStatus && matchesCotizacion;
        });

        if (user?.role === "tecnico") {
            filteredJobs = filteredJobs.filter(job => job.tecnicoUserId === user.id && job.estado !== "Finalizado");
        }

        const getGroupId = (descripcion?: string) => {
            if (!descripcion) return null;
            const match = descripcion.match(/\[Grupo:\s*(REQ-\d+)\]/);
            return match ? match[1] : null;
        };

        const groupedByReq: { [key: string]: Trabajo[] } = {};
        const singleJobsList: Trabajo[] = [];

        filteredJobs.forEach(job => {
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

            const serviceTypes = jobsInGroup.map(j => j.titulo.split(" - ")[0]);
            const uniqueTypes = Array.from(new Set(serviceTypes));
            const suffix = baseJob.titulo.includes(" - ") ? " - " + baseJob.titulo.split(" - ").slice(1).join(" - ") : "";
            baseJob.titulo = `${uniqueTypes.join(", ")}${suffix}`;

            baseJob.descripcion = `[Grupo: ${grpId}]\n` + jobsInGroup.map((j, idx) => {
                const cleanDesc = j.descripcion?.replace(/\[Grupo:\s*REQ-\d+\]\s*\n?/, "") || "";
                const svcName = j.titulo.split(" - ")[0];
                return `${idx + 1}. ${svcName}: ${cleanDesc}`;
            }).join("\n");

            const allPhotos: string[] = [];
            jobsInGroup.forEach(j => {
                if (j.foto_url) {
                    const urls = (j.foto_url as string).split(",").map(u => u.trim()).filter(Boolean);
                    allPhotos.push(...urls);
                }
            });
            baseJob.foto_url = allPhotos.join(",");

            singleJobsList.push(baseJob);
        });

        const parseDateForSort = (dateStr: string) => {
            const parts = dateStr.includes("/") ? dateStr.split("/") : dateStr.split("-");
            if (parts.length === 3) {
                const [d, m, y] = parts.map(Number);
                return new Date(y, m - 1, d).getTime();
            }
            return new Date(dateStr).getTime();
        };

        const sortedFilteredJobs = [...singleJobsList].sort((a, b) => {
            if (a.tipo === "SOS" && b.tipo !== "SOS") return -1;
            if (a.tipo !== "SOS" && b.tipo === "SOS") return 1;
            return parseDateForSort(b.fecha) - parseDateForSort(a.fecha);
        });

        sortedFilteredJobs.forEach(job => {
            const dateKey = job.fecha;
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(job);
        });
        return groups;
    };

    const groupedJobs = getGroupedJobs();
    const sortedDates = Object.keys(groupedJobs).sort((a, b) => {
        const parseDate = (dateStr: string) => {
            const parts = dateStr.includes("/") ? dateStr.split("/") : dateStr.split("-");
            if (parts.length === 3) {
                const [d, m, y] = parts.map(Number);
                return new Date(y, m - 1, d).getTime();
            }
            return new Date(dateStr).getTime();
        };
        return parseDate(b) - parseDate(a);
    });

    const flatJobs = sortedDates.flatMap(date => groupedJobs[date]);

    // ─────────────────────────────────────────────────────────────────────────
    // Handlers
    // ─────────────────────────────────────────────────────────────────────────

    const handleConfirmAssignment = async () => {
        if (selectedJobId) {
            const trabajo = trabajosData.find(j => j.id === selectedJobId);
            const selectedTechnicians = selectedAssignments.map(a => a.tecnicoId);
            const assignedNames = selectedAssignments.length > 0
                ? selectedAssignments.map(a => a.tecnicoNombre).join(", ")
                : "Sin asignar";
            const newEstado = (selectedAssignments.length > 0 ? "Asignado" : "Solicitud") as any;

            const getGroupId = (desc?: string) => {
                if (!desc) return null;
                const match = desc.match(/\[Grupo:\s*(REQ-\d+)\]/);
                return match ? match[1] : null;
            };

            const grpId = getGroupId(trabajo?.descripcion);
            const jobsToUpdate = grpId
                ? trabajosData.filter(t => getGroupId(t.descripcion) === grpId)
                : (trabajo ? [trabajo] : []);

            if (selectedJobId && selectedTechnicians.length > 0) {
                try {
                    for (const tJob of jobsToUpdate) {
                        await assignTrabajador(tJob.id, selectedTechnicians[0]);

                        const needsStateUpdate = tJob?.estado === "Solicitud" || tJob?.estado === "Cotización Aceptada" || tJob?.estado === "Cotización Aprobada";
                        const nuevoEstado = (needsStateUpdate ? "Asignado" : tJob?.estado || "Asignado") as any;

                        let nuevoTitulo = tJob?.titulo || "";
                        if (selectedType === "Trabajo" && nuevoTitulo.includes("(Visita)")) {
                            nuevoTitulo = nuevoTitulo.replace("(Visita)", "(Reparación)");
                        } else if (selectedType === "Visita" && nuevoTitulo.includes("(Reparación)")) {
                            nuevoTitulo = nuevoTitulo.replace("(Reparación)", "(Visita)");
                        }

                        await updateEstadoTrabajo(tJob.id, { estado: nuevoEstado, visitado: selectedType === "Trabajo" });
                        await updateTrabajo(tJob.id, { tipo: selectedType, titulo: nuevoTitulo });
                    }

                    showAlert("Asignación Exitosa", "Cambio guardado en el servidor.", "success");
                } catch (error: any) {
                    console.error("Error al asignar:", error);
                    if (error.response?.status === 422) {
                        showAlert("Restricción del Sistema", "El servidor no permite dejar el trabajo sin un técnico asignado.", "warning");
                    } else {
                        showAlert("Error de Sincronización", "Hubo un error sincronizando el trabajador con la base de datos.", "error");
                    }
                    return;
                }
            } else {
                for (const tJob of jobsToUpdate) {
                    try {
                        await assignTrabajador(tJob.id, null as any);
                    } catch (assignError: any) {
                        if (assignError.response && (assignError.response.status === 422 || assignError.response.status === 405)) {
                            try {
                                await updateTrabajo(tJob.id, { trabajador_id: null });
                            } catch (e) {
                                console.error("Error al desasignar", tJob.id, e);
                            }
                        }
                    }
                }
                showAlert("Desasignación Exitosa", "Se retiró el técnico.", "success");
            }

            const targetIds = new Set(jobsToUpdate.map(j => j.id));
            const updated = trabajosData.map(job => {
                if (targetIds.has(job.id)) {
                    let nuevoTitulo = job.titulo || "";
                    if (selectedType === "Trabajo" && nuevoTitulo.includes("(Visita)")) {
                        nuevoTitulo = nuevoTitulo.replace("(Visita)", "(Reparación)");
                    } else if (selectedType === "Visita" && nuevoTitulo.includes("(Reparación)")) {
                        nuevoTitulo = nuevoTitulo.replace("(Reparación)", "(Visita)");
                    }
                    const needsStateUpdate = job?.estado === "Solicitud" || job?.estado === "Cotización Aceptada" || job?.estado === "Cotización Aprobada";
                    const nuevoEstado = (needsStateUpdate ? "Asignado" : job?.estado || "Asignado") as any;

                    return {
                        ...job,
                        tecnico: assignedNames,
                        titulo: nuevoTitulo,
                        estado: (job.estado === "Solicitud" || job.estado === "Asignado") ? (selectedAssignments.length > 0 ? nuevoEstado : "Solicitud") : job.estado,
                        tipo: selectedType,
                        visitado: selectedType === "Trabajo",
                        asignaciones: selectedAssignments.length > 0 ? selectedAssignments : [],
                        fechaAsignada: selectedAssignments.length > 0 ? selectedAssignments[0].fechaAsignada : "",
                        horaAsignada: selectedAssignments.length > 0 ? selectedAssignments[0].horaAsignada : ""
                    };
                }
                return job;
            });
            saveJobs(updated);

            if (selectedJobId && selectedAssignments.length > 0) {
                try {
                    for (const asig of selectedAssignments) {
                        const notifUserId = asig.userId || asig.tecnicoId;
                        const isVisita = selectedType === "Visita";
                        await createNotificacion({
                            user_id: notifUserId,
                            titulo: isVisita ? "📋 Nueva Visita Asignada" : "🛠️ Nuevo Trabajo Asignado",
                            mensaje: isVisita
                                ? `Se te ha asignado una nueva visita de evaluación para: ${assignedNames} en la sucursal ${businessName}.`
                                : `Te han asignado un nuevo trabajo: ${assignedNames} en la sucursal ${businessName}.`,
                            enlace: `/tecnico/trabajo-detalle/${selectedJobId}`
                        });
                    }
                } catch (notiErr) {
                    console.error("Error enviando notificaciones a técnicos:", notiErr);
                }
            }
        }
        setIsModalOpen(false);
    };

    const handleOpenReportDetail = async (trabajoId: number) => {
        try {
            setReporteModalOpen(true);
            setReporteData(null);
            setReporteTrabajo(null);
            setReporteTaskInfo(null);

            const cleanId = String(trabajoId).startsWith("gen-")
                ? Number(String(trabajoId).replace("gen-", ""))
                : trabajoId;

            let reporte = null;
            let jobDetails = null;

            try {
                reporte = await getReporteByTrabajoId(cleanId);
            } catch (err: any) {
                console.warn("No formal report found in DB, using fallback if available.");
            }

            if (reporte) {
                let parsedSolucion = reporte.solucion;
                if (typeof reporte.solucion === "string") {
                    try { parsedSolucion = JSON.parse(reporte.solucion); } catch (e) { console.error("Error al parsear reporte:", e); }
                }
                setReporteData(parsedSolucion || reporte);
            } else {
                const fallback = localStorage.getItem(`report_data_${cleanId}`);
                if (fallback) setReporteData(JSON.parse(fallback));
            }

            try {
                jobDetails = await getTrabajo(cleanId);
            } catch (err) {
                console.warn("Could not fetch job details for ID", cleanId);
            }

            if (jobDetails) {
                setReporteTrabajo({
                    id: jobDetails.id,
                    sucursal: jobDetails.negocio?.nombre || businessName,
                    tecnico: jobDetails.tecnico?.name || jobDetails.trabajador?.nombre || "Técnico asignado",
                    encargado: jobDetails.contactos?.[0]?.nombre || jobDetails.negocio?.encargado || "No asignado",
                    cotizacion: jobDetails.cotizacion_aceptada
                        ? { costo: jobDetails.cotizacion_aceptada.monto, archivo: jobDetails.cotizacion_aceptada.archivo_url, notas: jobDetails.cotizacion_aceptada.notas }
                        : jobDetails.cotizacion
                });
                setReporteTaskInfo({
                    id: jobDetails.id,
                    titulo: jobDetails.titulo || "Mantenimiento General",
                    fecha: new Date(jobDetails.created_at).toLocaleDateString()
                });
            }
        } catch (error: any) {
            console.error("Error al abrir modal detalle:", error);
            showAlert("Error", "Ocurrió un error inesperado al preparar el reporte.");
            setReporteModalOpen(false);
        }
    };

    const resetRequestModal = () => {
        setIsRequestModalOpen(false);
        setIsEditingRequest(false);
        setIsSOSRequest(false);
        setFotosSOS([]);
        setFotosPreviewUrls([]);
        setEditingRequestId(null);
        setFormServices([]);
        setDeletedDbIds([]);
        setNewRequestData({ categoria: "Electricidad", cliente: businessName, fecha: new Date().toISOString().split("T")[0], descripcion: "", equipoSeleccionado: "", trabajador_id: "" });
    };

    const handleSOSRequest = () => {
        setNewRequestData({ categoria: "Electricidad", cliente: businessName, fecha: new Date().toISOString().split("T")[0], descripcion: "", equipoSeleccionado: "", trabajador_id: "" });
        setFormServices([{ id: "svc-" + Date.now(), categoria: "Electricidad", customCategoria: "", descripcion: "", equipoSeleccionado: "", fotos: [], fotosPreviewUrls: [], isMinimized: false }]);
        setIsSOSRequest(true);
        setIsEditingRequest(false);
        setIsRequestModalOpen(true);
    };

    const handleDeleteRequest = (e: React.MouseEvent, job: Trabajo) => {
        e.stopPropagation();
        const getGroupId = (descripcion?: string) => {
            if (!descripcion) return null;
            const match = descripcion.match(/\[Grupo:\s*(REQ-\d+)\]/);
            return match ? match[1] : null;
        };
        const grpId = getGroupId(job.descripcion);
        const title = grpId ? "Borrar Grupo de Solicitudes" : "Borrar Solicitud";
        const message = grpId
            ? "¿Estás seguro de que deseas borrar este grupo de solicitudes? Se eliminarán todos los servicios de la solicitud."
            : "¿Estás seguro de que deseas borrar esta solicitud?";

        showConfirm(title, message, async () => {
            try {
                if (grpId) {
                    const groupJobs = trabajosData.filter(t => {
                        const tGrpId = getGroupId(t.descripcion);
                        return tGrpId === grpId;
                    });
                    for (const gJob of groupJobs) {
                        await deleteTrabajo(Number((gJob as any).original_id || gJob.id));
                    }
                    const updated = trabajosData.filter(t => getGroupId(t.descripcion) !== grpId);
                    saveJobs(updated);
                } else {
                    await deleteTrabajo(Number((job as any).original_id || job.id));
                    saveJobs(trabajosData.filter(t => t.id !== job.id));
                }
                showAlert("Éxito", grpId ? "Grupo de solicitudes borrado exitosamente." : "Solicitud borrada exitosamente.", "success");
            } catch (error) {
                console.error("Error al borrar solicitud:", error);
                showAlert("Error", "No se pudo borrar la solicitud.", "error");
            }
        });
    };

    const handleOpenEditRequest = (e: React.MouseEvent, job: Trabajo) => {
        e.stopPropagation();
        const match = job.descripcion?.match(/\[Grupo:\s*(REQ-\d+)\]/);
        const groupId = match ? match[1] : null;
        let jobsToEdit = [job];
        if (groupId) {
            jobsToEdit = trabajosData.filter(t => t.descripcion?.includes(`[Grupo: ${groupId}]`));
        }

        const mapped = jobsToEdit.map(t => {
            const cleanDesc = t.descripcion?.replace(/\[Grupo:\s*REQ-\d+\]\s*\n?/, "") || "";
            let cleanTitle = (t.titulo || "").replace("🚨 SOS: ", "");
            const parts = cleanTitle.split(" - ");
            let cat = parts.length > 0 ? parts[0] : "Electricidad";
            let custom = "";
            if (!["Electricidad", "Plomeria", "Albañileria", "Limpieza", "Instalación", "Mantenimiento"].includes(cat)) {
                custom = cat;
                cat = "Otro";
            }
            return { id: "svc-edit-" + t.id, dbId: t.id, categoria: cat, customCategoria: custom, descripcion: cleanDesc, equipoSeleccionado: "", fotos: [] as File[], fotosPreviewUrls: parseFotoUrls(t.foto_url), isMinimized: false };
        });

        setFormServices(mapped);
        setDeletedDbIds([]);
        setNewRequestData({
            categoria: mapped[0].categoria,
            cliente: businessName,
            fecha: job.fecha ? (job.fecha.includes("/") ? job.fecha.split("/").reverse().join("-") : job.fecha) : new Date().toISOString().split("T")[0],
            descripcion: mapped[0].descripcion,
            equipoSeleccionado: "",
            trabajador_id: ""
        });
        setIsEditingRequest(true);
        setEditingRequestId(job.id);
        setIsRequestModalOpen(true);
    };

    const handleAceptarCotizacion = async (jobId: number) => {
        try {
            await updateEstadoTrabajo(jobId, { estado: "Cotización Aceptada" });
            saveJobs(trabajosData.map(job => job.id === jobId ? { ...job, estado: "Cotización Aceptada" as const } : job));
            showAlert("Cotización Aceptada", "Has aceptado la propuesta. El administrador procederá a asignarte el trabajo.", "success");
        } catch (error) {
            console.error("Error al aceptar cotización:", error);
            showAlert("Error", "Hubo un problema al aceptar la cotización.", "error");
        }
    };

    const handleRechazarCotizacion = (jobId: number) => {
        setQuoteToReject(jobId);
        setRejectionReason("");
        setShowRejectionModal(true);
    };

    const handleSubmitRejection = async () => {
        if (!quoteToReject || !rejectionReason.trim()) {
            showAlert("Atención", "Por favor ingresa un motivo para el rechazo.", "warning");
            return;
        }
        try {
            await updateEstadoTrabajo(quoteToReject, { estado: "Cotización Rechazada" });
            const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
            const token = localStorage.getItem("token");
            await fetch(`${API_URL}/trabajos/${quoteToReject}/chat`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ message: `MOTIVO DE RECHAZO: ${rejectionReason}` })
            });
            saveJobs(trabajosData.map(job => job.id === quoteToReject ? { ...job, estado: "Cotización Rechazada" as const } : job));
            setShowRejectionModal(false);
            setRejectionReason("");
            setQuoteToReject(null);
            showAlert("Información", "Propuesta rechazada. Se ha iniciado un chat de negociación.", "info");
        } catch (error) {
            console.error("Error al rechazar:", error);
            showAlert("Error", "No se pudo rechazar la propuesta.", "error");
        }
    };

    const handleConfirmRequestModal = async (modalNewRequestData: { cliente: string; fecha: string }, modalFormServices: ServiceForm[], modalDeletedDbIds: number[]) => {
        const invalidIndex = modalFormServices.findIndex(s => !s.descripcion.trim());
        if (invalidIndex !== -1) {
            showAlert("Campo Requerido", `Por favor detalla la descripción del problema para el Servicio #${invalidIndex + 1}.`, "error");
            return;
        }

        if (isEditingRequest && editingRequestId !== null) {
            try {
                const originalJob = trabajosData.find(t => t.id === editingRequestId);
                const groupMatch = originalJob?.descripcion?.match(/\[Grupo:\s*(REQ-\d+)\]/);
                let finalGroupId = groupMatch ? groupMatch[1] : null;
                if (!finalGroupId && modalFormServices.length > 1) finalGroupId = "REQ-" + Date.now();

                for (const delId of modalDeletedDbIds) {
                    try { await deleteTrabajo(delId); } catch (e) { console.error("Error deleting job in group edit:", e); }
                }

                const isEmergency = isSOSRequest;
                for (const svc of modalFormServices) {
                    let finalCat = svc.categoria === "Otro" && svc.customCategoria.trim() !== "" ? svc.customCategoria.trim() : svc.categoria;
                    let foundEq: any = null;
                    if (svc.categoria === "Mantenimiento" && svc.equipoSeleccionado) {
                        foundEq = (businessAreas || []).flatMap((a: any) => a.equipos || []).find((e: any) => String(e.id) === String(svc.equipoSeleccionado));
                        if (foundEq) {
                            finalCat = `Mantenimiento: ${foundEq.nombre}`;
                        }
                    }

                    let svcDesc = svc.descripcion;
                    if (svc.categoria === "Mantenimiento" && foundEq) {
                        const eqInfo = `${foundEq.nombre} (${foundEq.marca || ''} ${foundEq.modelo || ''})`.trim();
                        if (!svcDesc.includes(`[Equipo:`)) {
                            svcDesc = `[Equipo: ${eqInfo}]\n${svcDesc}`;
                        }
                    }

                    const descWithGroup = finalGroupId ? `[Grupo: ${finalGroupId}]\n${svcDesc}` : svcDesc;
                    if (svc.dbId) {
                        await updateTrabajo(svc.dbId, {
                            titulo: isEmergency ? `🚨 SOS: ${finalCat} - ${businessName}` : `${finalCat} - ${modalNewRequestData.cliente || businessName}`,
                            descripcion: descWithGroup,
                            fecha_programada: modalNewRequestData.fecha || null
                        });
                    } else {
                        await createTrabajo({
                            titulo: isEmergency ? `🚨 SOS: ${finalCat} - ${businessName}` : `${finalCat} - ${modalNewRequestData.cliente || businessName}`,
                            descripcion: descWithGroup,
                            prioridad: isEmergency ? "Alta" : "Media",
                            tipo: isEmergency ? "SOS" : "Nueva Solicitud",
                            negocio_id: Number(id),
                            levantamiento_equipo_id: svc.equipoSeleccionado ? Number(svc.equipoSeleccionado) : null,
                            fecha_programada: modalNewRequestData.fecha || null,
                            trabajador_id: null
                        });
                    }
                }
                showAlert("Éxito", "Solicitud editada exitosamente.", "success");
                reloadTrabajosList();
            } catch (error) {
                console.error("Error al actualizar el grupo de solicitudes:", error);
                showAlert("Error", "No se pudo actualizar alguna de las solicitudes.", "error");
            }
        } else {
            try {
                let finalGroupId: string | null = null;
                if (modalFormServices.length > 1) finalGroupId = "REQ-" + Date.now();
                const isEmergency = isSOSRequest;

                for (const svc of modalFormServices) {
                    let finalCat = svc.categoria === "Otro" && svc.customCategoria.trim() !== "" ? svc.customCategoria.trim() : svc.categoria;
                    let foundEq: any = null;
                    if (svc.categoria === "Mantenimiento" && svc.equipoSeleccionado) {
                        foundEq = (businessAreas || []).flatMap((a: any) => a.equipos || []).find((e: any) => String(e.id) === String(svc.equipoSeleccionado));
                        if (foundEq) {
                            finalCat = `Mantenimiento: ${foundEq.nombre}`;
                        }
                    }

                    let svcDesc = svc.descripcion;
                    if (svc.categoria === "Mantenimiento" && foundEq) {
                        const eqInfo = `${foundEq.nombre} (${foundEq.marca || ''} ${foundEq.modelo || ''})`.trim();
                        if (!svcDesc.includes(`[Equipo:`)) {
                            svcDesc = `[Equipo: ${eqInfo}]\n${svcDesc}`;
                        }
                    }

                    const descWithGroup = finalGroupId ? `[Grupo: ${finalGroupId}]\n${svcDesc}` : svcDesc;

                    if (svc.fotos.length > 0) {
                        const formData = new FormData();
                        formData.append("titulo", isEmergency ? `🚨 SOS: ${finalCat} - ${businessName}` : `${finalCat} - ${modalNewRequestData.cliente || businessName}`);
                        formData.append("descripcion", descWithGroup);
                        formData.append("prioridad", isEmergency ? "Alta" : "Media");
                        formData.append("tipo", isEmergency ? "SOS" : "Nueva Solicitud");
                        formData.append("negocio_id", id || "");
                        if (svc.equipoSeleccionado) formData.append("levantamiento_equipo_id", svc.equipoSeleccionado);
                        if (modalNewRequestData.fecha) formData.append("fecha_programada", modalNewRequestData.fecha);
                        svc.fotos.forEach(file => formData.append("fotos[]", file));
                        await createTrabajo(formData);
                    } else {
                        await createTrabajo({
                            titulo: isEmergency ? `🚨 SOS: ${finalCat} - ${businessName}` : `${finalCat} - ${modalNewRequestData.cliente || businessName}`,
                            descripcion: descWithGroup,
                            prioridad: isEmergency ? "Alta" : "Media",
                            tipo: isEmergency ? "SOS" : "Nueva Solicitud",
                            negocio_id: Number(id),
                            levantamiento_equipo_id: svc.equipoSeleccionado ? Number(svc.equipoSeleccionado) : null,
                            fecha_programada: modalNewRequestData.fecha || null,
                            trabajador_id: null
                        });
                    }
                }

                try {
                    const svcList = modalFormServices && modalFormServices.length > 0 ? modalFormServices : formServices;
                    const categoriasCreadas = svcList.map(s => s.categoria === "Otro" && s.customCategoria.trim() !== "" ? s.customCategoria.trim() : s.categoria).join(", ");
                    const isEncargado = user?.role === 'gerente-sucursal' || user?.role === 'encargado';
                    const roleLabel = isEncargado ? "El encargado" : "El cliente";
                    await createNotificacionByRole({
                        role: "Admin",
                        titulo: isEmergency ? "🚨 Nueva Alerta SOS" : "🔧 Nueva Solicitud de Servicio",
                        mensaje: `${roleLabel} "${user?.name || "Usuario"}" ha creado una solicitud para la sucursal "${businessName}": [${categoriasCreadas}].`,
                        enlace: isEncargado || isAutonomoAdmin(user?.role) ? `/autonomo/solicitudes` : `/menu/solicitudes`,
                        negocio_id: Number(id)
                    });
                } catch (notiError) {
                    console.error("Error al notificar al administrador:", notiError);
                }

                showAlert(
                    isEmergency ? "🚨 ¡Emergencias Enviadas!" : "✅ ¡Solicitudes Enviadas!",
                    isEmergency
                        ? "Tus alertas SOS han sido enviadas al administrador. Nos pondremos en contacto contigo a la brevedad posible."
                        : "Tus solicitudes han sido enviadas exitosamente al administrador.",
                    "success"
                );
                reloadTrabajosList();
            } catch (error: any) {
                console.error("Error creating request group:", error);
                showAlert("Error", "No se pudo crear alguna de las solicitudes.", "error");
            }
        }

        resetRequestModal();
    };

    const filteredTechnicians = tecnicosData.filter(t =>
        t.nombre.toLowerCase().includes(technicianSearch.toLowerCase())
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Lista de trabajos renderizada
    // ─────────────────────────────────────────────────────────────────────────

    const jobsListContent = flatJobs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", background: "white", borderRadius: "24px", border: "1px solid #e2e8f0", color: "#64748b", fontWeight: 600 }}>
            No se encontraron trabajos para este filtro.
        </div>
    ) : (
        flatJobs.map((trabajo, index) => (
            <JobCard
                key={trabajo.id}
                trabajo={trabajo}
                index={index}
                user={user}
                activeSlide={activeSlides[String(trabajo.id)] || 0}
                onSlideChange={(trabajoId, newSlide) => setActiveSlides(prev => ({ ...prev, [trabajoId]: newSlide }))}
                onZoomImage={setSelectedZoomImage}
                onEdit={handleOpenEditRequest}
                onDelete={handleDeleteRequest}
                onAceptarCotizacion={handleAceptarCotizacion}
                onRechazarCotizacion={handleRechazarCotizacion}
                parseFotoUrls={parseFotoUrls}
                styles={styles}
            />
        ))
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TABS — Historial, Cotizaciones, Equipos
    // ─────────────────────────────────────────────────────────────────────────

    const bannerProps = {
        businessName,
        businessImage,
        businessDetails,
        bannerY,
        getAddress: getBusinessAddress,
    };

    if (isHistorialTab) {
        return (
            <div className={styles.dashboardLayout}>
                <div className={styles.mainContainer} style={{ minHeight: "80vh", boxSizing: "border-box" }}>
                    <div className={styles.premiumHeader} style={{ marginBottom: "25px" }}>
                        <BusinessBanner {...bannerProps} label="HISTORIAL DE LA SUCURSAL" />
                    </div>
                    <div style={{ width: "100%", maxWidth: "900px", margin: "0 auto" }}>
                        <Historial businessId={Number(id)} />
                    </div>
                </div>
            </div>
        );
    }

    if (isCotizacionesTab) {
        return (
            <div className={styles.dashboardLayout}>
                <div className={styles.mainContainer} style={{ minHeight: "80vh", boxSizing: "border-box" }}>
                    <div className={styles.premiumHeader} style={{ marginBottom: "25px" }}>
                        <BusinessBanner {...bannerProps} label="COTIZACIONES DE LA SUCURSAL" />
                    </div>
                    <div style={{ width: "100%", maxWidth: "900px", margin: "0 auto" }}>
                        <Cotizaciones businessId={Number(id)} />
                    </div>
                </div>
            </div>
        );
    }

    if (isEquiposTab) {
        return (
            <div className={styles.dashboardLayout}>
                <div className={styles.mainContainer}>
                    <EquiposTab
                        id={id || ""}
                        user={user}
                        businessName={businessName}
                        businessImage={businessImage}
                        businessDetails={businessDetails}
                        bannerY={bannerY}
                        businessAreas={businessAreas}
                        allSolicitudes={allSolicitudes}
                        trabajosData={trabajosData}
                        canEdit={canEdit}
                        canEditBanner={canEditBanner}
                        persistLevantamiento={persistLevantamiento}
                        handleAddArea={handleAddArea}
                        handleAddSubArea={handleAddSubArea}
                        handleDeleteArea={handleDeleteArea}
                        editAreaName={editAreaName}
                        fileInputRef={fileInputRef}
                        isAdjustingPosition={isAdjustingPosition}
                        setIsAdjustingPosition={setIsAdjustingPosition}
                        setBannerY={setBannerY}
                        handleBannerChange={handleBannerChange}
                        saveBannerPosition={saveBannerPosition}
                        getBusinessAddress={getBusinessAddress}
                    />
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VISTA PRINCIPAL — Lista de trabajos
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className={styles.dashboardLayout}>
            <div className={styles.mainContainer}>
                {/* BANNER */}
                <div className={styles.premiumHeader}>
                    <input type="file" ref={fileInputRef} style={{ display: "none" }} accept="image/*" onChange={handleBannerChange} />
                    <BusinessBanner
                        {...bannerProps}
                        label="TRABAJOS DE LA SUCURSAL"
                        canEditBanner={canEditBanner}
                        isAdjustingPosition={isAdjustingPosition}
                        fileInputRef={fileInputRef}
                        onAdjustToggle={() => setIsAdjustingPosition(!isAdjustingPosition)}
                        onBannerYChange={setBannerY}
                        onSavePosition={async () => { await saveBannerPosition(); setIsAdjustingPosition(false); }}
                        onCancelAdjust={() => {
                            const match = businessImage?.match(/[?&]posy=(\d+)/);
                            setBannerY(match ? Number(match[1]) : 50);
                            setIsAdjustingPosition(false);
                        }}
                    />
                </div>

                {/* SEARCH & FILTER */}
                <div className={styles.headerActionsRow}>
                    <div className={styles.searchGroup}>
                        <input
                            type="text"
                            placeholder="Buscar trabajos..."
                            className={menuStyles.searchInput}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            style={{ margin: 0 }}
                        />
                        <button className={menuStyles.filterBtn} onClick={() => setIsFilterModalOpen(true)}>⚙️</button>
                    </div>
                </div>

                {/* LAYOUT PRINCIPAL */}
                <div className={styles.dashboardGrid}>
                    {/* COLUMNA IZQUIERDA */}
                    <div className={styles.leftColumn}>
                        {/* BOTONES DE ACCIÓN */}
                        {canSeeActions && (
                            <div className={styles.actionButtonsGroup}>
                                {canSeeSOS && (
                                    <button className={styles.sosBtn} onClick={handleSOSRequest} translate="no">🚨 SOS</button>
                                )}
                                {canSeeSolicitud && (
                                    <button className={styles.newRequestBtn} onClick={() => {
                                        setIsSOSRequest(false);
                                        setIsEditingRequest(false);
                                        setEditingRequestId(null);
                                        setNewRequestData({ categoria: "Electricidad", cliente: businessName, fecha: new Date().toISOString().split("T")[0], descripcion: "", equipoSeleccionado: "", trabajador_id: "" });
                                        setFormServices([{ id: "svc-" + Date.now(), categoria: "Electricidad", customCategoria: "", descripcion: "", equipoSeleccionado: "", fotos: [], fotosPreviewUrls: [], isMinimized: false }]);
                                        setFotosSOS([]);
                                        setFotosPreviewUrls([]);
                                        setIsRequestModalOpen(true);
                                    }}>
                                        <HiOutlineClipboardDocument size={18} />
                                        Solicitud
                                    </button>
                                )}
                                {canSeeEquipos && (
                                    <button className={styles.equiposBtn} onClick={() => setSearchParams({ tab: "equipos" })}>
                                        <HiOutlineArchiveBox size={18} />
                                        Equipos
                                    </button>
                                )}
                                {isTecnico && (
                                    <button className={styles.historialBtn} onClick={() => setSearchParams({ tab: "historial" })}>
                                        <HiOutlineClock size={20} />
                                        Ver Historial
                                    </button>
                                )}
                            </div>
                        )}

                        {/* RESUMEN MÓVIL */}
                        <div className={styles.mobileSummaryWrapper}>
                            <SummaryGrid
                                flatJobs={flatJobs}
                                activeSummaryTab={activeSummaryTab}
                                setActiveSummaryTab={setActiveSummaryTab}
                                user={user}
                                styles={styles}
                            />
                        </div>

                        {/* LISTADO */}
                        <div className={styles.jobsSection} style={{ marginTop: 0 }}>
                            {jobsListContent}
                        </div>
                    </div>

                    {/* COLUMNA DERECHA */}
                    <div className={styles.rightColumn}>
                        <div className={styles.desktopSummaryWrapper}>
                            <div className={styles.sideCard}>
                                <h3 className={styles.sideCardTitle}>Tablero detalles</h3>
                                <SummaryGrid
                                    flatJobs={flatJobs}
                                    activeSummaryTab={activeSummaryTab}
                                    setActiveSummaryTab={setActiveSummaryTab}
                                    user={user}
                                    styles={styles}
                                />
                            </div>
                        </div>

                        <div className={styles.sideCard}>
                            <h3 className={styles.sideCardTitle}>Trabajos Recientes</h3>
                            <div className={styles.recentJobsList}>
                                {(() => {
                                    const parseDate = (dateStr: string) => {
                                        const parts = dateStr.includes("/") ? dateStr.split("/") : dateStr.split("-");
                                        if (parts.length === 3) { const [d, m, y] = parts.map(Number); return new Date(y, m - 1, d).getTime(); }
                                        return new Date(dateStr).getTime();
                                    };
                                    const recentJobs = [...trabajosData].filter(job => job.estado !== "Eliminado").sort((a, b) => parseDate(b.fecha) - parseDate(a.fecha)).slice(0, 10);
                                    if (recentJobs.length === 0) return <div style={{ fontSize: "13px", color: "#64748b", textAlign: "center", padding: "10px 0" }}>No hay trabajos registrados.</div>;
                                    return recentJobs.map(job => {
                                        let dotColor = "#f59e0b";
                                        if (job.estado === "Finalizado") dotColor = "#10b981";
                                        else if (job.estado === "Solicitud") dotColor = "#8b5cf6";
                                        else if (["Asignado", "En Proceso"].includes(job.estado)) dotColor = "#3b82f6";
                                        return (
                                            <div key={job.id} className={styles.recentJobItem} onClick={() => {
                                                const basePath = getBasePath();
                                                if ((job as any).isMantenimiento) navigate(`${basePath}/mantenimiento-detalle/${(job as any).original_id}`);
                                                else navigate(`${basePath}/trabajo-detalle/${job.id}`);
                                            }}>
                                                <div className={styles.recentJobInfo}>
                                                    <h4 className={styles.recentJobTitle}>{job.titulo}</h4>
                                                    <div className={styles.recentJobMeta}>
                                                        <span className={styles.statusIndicatorDot} style={{ backgroundColor: dotColor }}></span>
                                                        {job.estado} • {job.fecha}
                                                    </div>
                                                </div>
                                                <span className={styles.recentJobChevron}><HiOutlineChevronRight size={16} /></span>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Modales ──────────────────────────────────────────────────── */}

            <AssignTechnicianModal
                isOpen={isModalOpen}
                selectedJobId={selectedJobId}
                trabajosData={trabajosData}
                selectedAssignments={selectedAssignments}
                selectedType={selectedType}
                filteredTechnicians={filteredTechnicians}
                technicianSearch={technicianSearch}
                onTechSearch={setTechnicianSearch}
                onTechToggle={handleTechToggle}
                onUpdateDate={handleUpdateAssignmentDate}
                onTypeChange={setSelectedType}
                onConfirm={handleConfirmAssignment}
                onClose={() => setIsModalOpen(false)}
            />

            {/* Modal Filtro */}
            {isFilterModalOpen && (
                <div className={menuStyles.modalOverlay}>
                    <div className={menuStyles.modalContent}>
                        <h2 className={menuStyles.modalTitle}>Filtro</h2>
                        <div className={menuStyles.filterSection}>
                            <span className={menuStyles.filterSubtitle}>Estatus de estado</span>
                            <div className={menuStyles.radioGroup}>
                                {(isCotizacionesTab ? ["Pagados", "En espera", "Rechazado"] : ["Completadas", "En espera", "Asignados", "Sin asignar"]).map(status => (
                                    <label key={status} className={menuStyles.radioLabel}>
                                        <input type="radio" name="filterStatus" value={status} checked={filterStatus === status} onChange={() => setFilterStatus(status)} />
                                        <span>{status}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className={menuStyles.filterSection}>
                            <span className={menuStyles.filterSubtitle}>Rango de Fechas</span>
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <input type="date" className={menuStyles.modalInput} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                                <input type="date" className={menuStyles.modalInput} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                            </div>
                        </div>
                        <div className={menuStyles.modalActions}>
                            <button className={menuStyles.applyBtn} onClick={() => setIsFilterModalOpen(false)}>Aplicar Filtro</button>
                            <button className={menuStyles.cancelBtn} onClick={() => setIsFilterModalOpen(false)}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            <NuevoServicioModal
                isOpen={isRequestModalOpen}
                isSOSRequest={isSOSRequest}
                isEditingRequest={isEditingRequest}
                initialData={newRequestData}
                initialServices={formServices}
                businessAreas={businessAreas}
                onClose={resetRequestModal}
                onConfirm={handleConfirmRequestModal}
            />

            <TechRequestModal
                isOpen={isTechRequestModalOpen}
                requestRole={requestRole}
                isSOSRequest={isSOSRequest}
                onRoleChange={setRequestRole}
                onConfirm={handleRequestTechnician}
                onClose={() => setIsTechRequestModalOpen(false)}
                styles={styles}
            />

            {reporteModalOpen && (
                <ReporteDetailModal
                    isOpen={reporteModalOpen}
                    onClose={() => setReporteModalOpen(false)}
                    trabajo={reporteTrabajo}
                    task={reporteTaskInfo}
                    reporte={reporteData}
                    userRole={user?.role ?? undefined}
                />
            )}

            <RejectionModal
                isOpen={showRejectionModal}
                rejectionReason={rejectionReason}
                onReasonChange={setRejectionReason}
                onSubmit={handleSubmitRejection}
                onClose={() => setShowRejectionModal(false)}
                styles={styles}
            />

            {/* Zoom de imagen */}
            {selectedZoomImage && (
                <div
                    style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0, 0, 0, 0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}
                    onClick={() => setSelectedZoomImage(null)}
                >
                    <img src={selectedZoomImage} alt="Zoom" style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: "12px", objectFit: "contain" }} onClick={e => e.stopPropagation()} />
                </div>
            )}
        </div>
    );
};

export default TrabajoDetalle;
