import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import styles from "./PerfilEmpresaUnificado.module.css";
import { createNotificacionEcosistema } from "../../services/notificacionesService";
import MapLocationPicker from "../../components/MapLocationPicker";
import { useAuth } from "../../context/AuthContext";
import { useModal } from "../../context/ModalContext";
import { isAutonomoAdmin } from "../../utils/roles";

import { 
    HiOutlineMapPin, 
    HiOutlineBolt, 
    HiOutlineInformationCircle,
    HiOutlineCamera,
    HiOutlineUserGroup,
    HiOutlineKey,
    HiOutlinePaperAirplane,
    HiOutlineEye,
    HiOutlineEyeSlash,
    HiOutlineExclamationTriangle,
    HiOutlinePencilSquare,
    HiOutlineTrash,
    HiOutlineClipboardDocumentList
} from "react-icons/hi2";

import { createNegocio, updateNegocio, getNegocio, uploadImage, deleteNegocio } from "../../services/negociosService";
import { createNotificacionByRole } from "../../services/notificacionesService";
import { asignarEncargadoSucursal, getEncargadoSucursal } from "../../services/usersService";
import LevantamientoModal from "../../components/LevantamientoModal";
import DetalleEquipoModal from "../../components/DetalleEquipoModal";
import ModalSeleccionEquipo from "../../components/modals/ModalSeleccionEquipo";
import ReportarProblemaModal from "../../components/ReportarProblemaModal";
import HistorialEquipoModal from "../../components/modals/HistorialEquipoModal";
import DetalleReporteModal from "../../components/modals/DetalleReporteModal";
import { saveSafeLocalInfo, stripBlobUrls } from "../../utils/storageHelper";
import { createMantenimientoSolicitud, getMantenimientoSolicitudes } from "../../services/mantenimientoService";
import { getTrabajos } from "../../services/trabajosService";
import { getReporteByTrabajoId } from "../../services/reportesService";
import LevantamientoFlotaMockup from "../../components/LevantamientoFlotaMockup";
import AreaVisualGrid from '../../components/AreaVisualGrid';
import ModalSeleccionEspacio from '../../components/ModalSeleccionEspacio';

export interface PerfilEmpresaConfig {
    isAutonomo?: boolean;
    canDelete?: boolean;
    useMapLocation?: boolean;
    notificationRoleTarget?: string;
}

export interface Equipment {
    id?: string;
    nombre: string;
    marca: string;
    modelo: string;
    serie: string;
    anioFabricacion: string;
    anioUso: string;
    foto?: string;
    fotoFile?: File;
    fotoPlaca?: string;
    fotoPlacaFile?: File;
    categoria_id?: number | string | null;
    categoria?: { id: number; nombre: string } | null;
    subAreaId?: string;
    nombreSubArea?: string;
    subCategoria?: string;
}

export interface LevantamientoSubArea {
    id: string;
    nombreSubArea: string;
    equipos: Equipment[];
}

export interface LevantamientoSeccion {
    id: string;
    nombreArea: string;
    subAreas?: LevantamientoSubArea[];
    equipos: Equipment[];
}

export type LevantamientoData = LevantamientoSeccion[];

export interface BusinessData {
    nombreSucursal?: string;
    tipo?: string;
    encargado?: string;
    estado?: string;
    ciudad?: string;
    nombrePlaza?: string;
    gerente?: string;
    telefonoGerente?: string;
    subgerente?: string;
    telefonoSubgerente?: string;
    calle?: string;
    numero?: string;
    colonia?: string;
    referencia?: string;
    manzana?: string;
    lote?: string;
    calleAv?: string;
    cp?: string;
    levantamiento?: LevantamientoData;
    imagenPerfil?: string;
    imagenPerfilFile?: File;
    imagen_portada?: string;
    imagenPortadaFile?: File;
    ownerEmail?: string;
}

const PerfilEmpresaUnificado: React.FC<{ config: PerfilEmpresaConfig }> = ({ config }) => {
    // ... (logic remains same until return)
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showAlert, showConfirm, showPrompt } = useModal();
    const canEdit = user?.role === 'cliente' || user?.role === 'encargado' || user?.role === 'autonomo' || isAutonomoAdmin(user?.role);

    const [formData, setFormData] = useState<BusinessData>({
        nombreSucursal: "",
        tipo: "FC",
        encargado: "",
        estado: "Yucatán",
        ciudad: "Mérida",
        nombrePlaza: "",
        gerente: "",
        telefonoGerente: "",
        subgerente: "",
        telefonoSubgerente: "",
        apellidosGerente: "",
        correo: "",
        latitud: "",
        longitud: "",
        levantamiento: []
    });

    const [isLevantamientoModalOpen, setIsLevantamientoModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'info' | 'levantamiento'>('info');
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
    const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
    const [reportingEquipment, setReportingEquipment] = useState<Equipment | null>(null);
    const [activeEquipmentId, setActiveEquipmentId] = useState<string | null>(null);
    const [imageError, setImageError] = useState(false);
    const [customTipoValue, setCustomTipoValue] = useState("");

    // Nuevos estados para Grid Visual
    const [isAreaModalOpen, setIsAreaModalOpen] = useState(false);
    const [isSubAreaModalOpen, setIsSubAreaModalOpen] = useState(false);
    const [activeAreaForSub, setActiveAreaForSub] = useState<string | null>(null);
    const [initialSubAreaId, setInitialSubAreaId] = useState<string | null>(null);

    // Bitacora (Historial) states
    const [bitacoraModalOpen, setBitacoraModalOpen] = useState(false);
    const [equipoSelectionMode, setEquipoSelectionMode] = useState<'bitacora' | 'reporte' | null>(null);
    const [equiposForSelection, setEquiposForSelection] = useState<Equipment[]>([]);
    const [selectedEqForBitacora, setSelectedEqForBitacora] = useState<Equipment | null>(null);
    const [allSolicitudes, setAllSolicitudes] = useState<any[]>([]);
    const [reporteModalOpen, setReporteModalOpen] = useState(false);
    const [selectedTrabajoId, setSelectedTrabajoId] = useState<number | null>(null);

    const [searchParams] = useSearchParams();
    const editId = searchParams.get('id');

    // --- Estado para el encargado de sucursal ---
    const [encargadoForm, setEncargadoForm] = useState({ name: '', email: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [encargadoExistente, setEncargadoExistente] = useState<{ name: string; email: string } | null>(null);
    const [encargadoLoading, setEncargadoLoading] = useState(false);

    React.useEffect(() => {
        const fetchNegocio = async () => {
            if (editId) {
                try {
                    const existing = await getNegocio(Number(editId));
                    setIsLevantamientoModalOpen(false);
                    const localData = JSON.parse(localStorage.getItem('local_negocios_info') || '{}');
                    const localInfo = stripBlobUrls(localData[editId] || {});

                    const loadedTipo = existing.tipo || "FC";
                    const standardTipos = ['FC', 'FS', 'MALL', 'W/M'];
                    const isCustom = !standardTipos.includes(loadedTipo);
                    
                    if (isCustom) {
                        setCustomTipoValue(loadedTipo);
                    }

                        // SIEMPRE priorizamos datos del servidor para el levantamiento (evita mostrar datos stale del localStorage)
                        let serverAreas = Array.isArray((existing as any).areas) && (existing as any).areas.length > 0
                            ? (existing as any).areas
                            : Array.isArray(existing.levantamiento)
                                ? existing.levantamiento
                                : [];
                        
                        serverAreas = serverAreas.map((area: any) => {
                            const subAreasMap = new Map<string, any>();
                            
                            if (area.sub_areas_json && Array.isArray(area.sub_areas_json)) {
                                area.sub_areas_json.forEach((sub: any) => {
                                    subAreasMap.set(sub.id, { ...sub, equipos: [] });
                                });
                            }

                            (area.equipos || []).forEach((eq: any) => {
                                const subId = eq.subAreaId || `sub_gen_${area.id}`;
                                const subName = eq.nombreSubArea || 'GENERAL';
                                if (!subAreasMap.has(subId)) {
                                    subAreasMap.set(subId, { id: subId, nombreSubArea: subName, equipos: [] });
                                }
                                subAreasMap.get(subId)!.equipos.push(eq);
                            });

                            let finalSubAreas = Array.from(subAreasMap.values());
                            if (finalSubAreas.length === 0) {
                                finalSubAreas = [{ id: `sub_gen_${area.id}`, nombreSubArea: 'GENERAL', equipos: area.equipos || [] }];
                            }

                            return {
                                ...area,
                                subAreas: finalSubAreas
                            };
                        });

                        setFormData(prev => ({
                            ...prev,
                            ...existing,
                            ownerEmail: existing.user?.email || "",
                            tipo: isCustom ? 'Otro' : loadedTipo,
                            nombreSucursal: existing.nombre,
                            gerente: localInfo.gerente || existing.gerente || "",
                            telefonoGerente: localInfo.telefonoGerente || existing.telefonoGerente || "",
                            subgerente: localInfo.subgerente || existing.subgerente || "",
                            telefonoSubgerente: localInfo.telefonoSubgerente || existing.telefonoSubgerente || "",
                            nombrePlaza: localInfo.nombrePlaza || existing.nombrePlaza || "",
                            manzana: localInfo.manzana || existing.manzana || "",
                            lote: localInfo.lote || existing.lote || "",
                            calleAv: localInfo.calleAv || existing.calleAv || "",
                            referencia: localInfo.referencia || existing.referencia || "",
                            levantamiento: serverAreas
                        }));
                } catch (error) {
                    console.error("Error fetching negocio:", error);
                }
            }
        };
        fetchNegocio();
    }, [editId]);

    // Cargar historial de mantenimientos para la bitácora
    React.useEffect(() => {
        if (!editId) return;
        const fetchHistory = async () => {
            try {
                const businessId = Number(editId);
                // 1. Obtener solicitudes de mantenimiento
                const solicitudesBackend = await getMantenimientoSolicitudes(businessId);
                const mappedSolicitudes = solicitudesBackend.map((sol: any) => {
                    const mappedReportes: any[] = [];
                    [sol.visita_trabajo, sol.reparacion_trabajo].forEach(t => {
                        if (t?.reporte?.solucion) {
                            try {
                                const parsed = JSON.parse(t.reporte.solucion);
                                if (parsed.descripcion || parsed.reporteTienda) {
                                    mappedReportes.push({
                                        id: t.id,
                                        problema_cliente: parsed.reporteTienda || '—',
                                        trabajo_realizado: parsed.descripcion || '—',
                                        materiales: parsed.materiales || '',
                                        refacciones: Array.isArray(parsed.refaccionesList)
                                            ? parsed.refaccionesList.map((r: any) => `${r.cantidad}x ${r.pieza}`).join(' · ')
                                            : ''
                                    });
                                }
                            } catch(e) {}
                        }
                    });
                    return {
                        ...sol,
                        reportes: mappedReportes,
                        actualTrabajoId: sol.reparacion_trabajo?.id || sol.reparacion_trabajo_id || sol.visita_trabajo?.id || sol.visita_trabajo_id
                    };
                });

                // Trabajos para historial de la empresa
                const trabajos = await getTrabajos({ negocio_id: businessId });
                const trabajosGenericos = trabajos.filter((t: any) => t.estado === 'Finalizado');
                
                const mappedGenericJobs = (await Promise.all(
                    trabajosGenericos.map(async (job: any) => {
                        try {
                            const reporte = await getReporteByTrabajoId(job.id);
                            if (reporte && reporte.solucion) {
                                const reportDataRaw = JSON.parse(reporte.solucion);
                                if (reportDataRaw.involucraEquipo && reportDataRaw.equipoInfo && reportDataRaw.equipoInfo.id) {
                                    return {
                                        id: `gen-${job.id}`,
                                        actualTrabajoId: job.id,
                                        levantamiento_equipo_id: reportDataRaw.equipoInfo.id,
                                        descripcion_problema: job.titulo,
                                        estado: job.estado,
                                        created_at: job.created_at,
                                        visitas: [],
                                        reportes: [{ falla_encontrada: reportDataRaw.problema || 'Mantenimiento General', solucion: "Finalizado" }]
                                    };
                                }
                            }
                        } catch (e) {}
                        return null;
                    })
                )).filter(Boolean);

                setAllSolicitudes([...mappedSolicitudes, ...mappedGenericJobs]);
            } catch (err) {
                console.error("Error cargando historial:", err);
            }
        };
        fetchHistory();
    }, [editId]);

    // Cargar encargado existente cuando hay editId
    React.useEffect(() => {
        if (!editId) return;
        getEncargadoSucursal(Number(editId))
            .then(data => {
                if (data?.encargado) {
                    setEncargadoExistente({ name: data.encargado.name, email: data.encargado.email });
                    setEncargadoForm(prev => ({ ...prev, name: data.encargado.name, email: data.encargado.email }));
                }
            })
            .catch(() => {}); // silencioso si no hay encargado aún
    }, [editId]);

    const handleAsignarEncargado = async () => {
        if (!editId) return;
        if (!encargadoForm.name.trim()) { showAlert('Campo Requerido', 'Ingresa el nombre del encargado', 'warning'); return; }
        if (!encargadoForm.email.trim()) { showAlert('Campo Requerido', 'Ingresa el correo del encargado', 'warning'); return; }
        if (!encargadoForm.password.trim() || encargadoForm.password.length < 8) {
            showAlert('Contraseña inválida', 'La contraseña debe tener al menos 8 caracteres', 'warning'); return;
        }
        try {
            setEncargadoLoading(true);
            await asignarEncargadoSucursal(Number(editId), encargadoForm);
            setEncargadoExistente({ name: encargadoForm.name, email: encargadoForm.email });
            setEncargadoForm(prev => ({ ...prev, password: '' }));
            showAlert('✅ Acceso Asignado', `Se asignó el acceso a ${encargadoForm.email}.`, 'success');
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'No se pudo asignar el acceso. Intenta de nuevo.';
            showAlert('Error', msg, 'error');
        } finally {
            setEncargadoLoading(false);
        }
    };

    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const bannerInputRef = React.useRef<HTMLInputElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (!canEdit) return;
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!canEdit) return;
        const file = e.target.files?.[0];
        if (file) {
            if (formData.imagenPerfil && formData.imagenPerfil.startsWith('blob:')) {
                URL.revokeObjectURL(formData.imagenPerfil);
            }
            const tempUrl = URL.createObjectURL(file);
            setFormData(prev => ({ ...prev, imagenPerfil: tempUrl, imagenPerfilFile: file }));
            setImageError(false); // <--- REINICIAR EL ERROR PARA VER EL PREVIEW
        }
    };

    const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!canEdit) return;
        const file = e.target.files?.[0];
        if (file) {
            if (formData.imagen_portada && formData.imagen_portada.startsWith('blob:')) {
                URL.revokeObjectURL(formData.imagen_portada);
            }
            const tempUrl = URL.createObjectURL(file);
            setFormData(prev => ({ ...prev, imagen_portada: tempUrl, imagenPortadaFile: file }));
        }
    };

    React.useEffect(() => {
        return () => {
            if (formData.imagenPerfil && formData.imagenPerfil.startsWith('blob:')) {
                URL.revokeObjectURL(formData.imagenPerfil);
            }
        };
    }, [formData.imagenPerfil]);

    const handleSave = async () => {
        if (!formData.nombreSucursal) { showAlert("Campo Requerido", "Por favor ingresa el nombre de la sucursal", "warning"); return; }
        if (!formData.encargado) { showAlert("Campo Requerido", `Por favor ingresa el ${formData.tipo === 'FC' ? 'encargado' : 'dueño'} de la empresa`, "warning"); return; }
        if (formData.tipo !== 'W/M') {
            if ((formData.tipo === 'FS' || formData.tipo === 'Otro') && !formData.calle) { showAlert("Campo Requerido", "Por favor ingresa la calle principal", "warning"); return; }
            if (formData.tipo !== 'FS' && formData.tipo !== 'Otro' && !formData.nombrePlaza) { showAlert("Campo Requerido", "Por favor ingresa el nombre de la plaza", "warning"); return; }
            if (!formData.estado) { showAlert("Campo Requerido", "Por favor ingresa el estado", "warning"); return; }
            if (!formData.ciudad) { showAlert("Campo Requerido", "Por favor ingresa la ciudad", "warning"); return; }
            if (!formData.calle) { showAlert("Campo Requerido", "Por favor ingresa la calle", "warning"); return; }
            if (!formData.numero) { showAlert("Campo Requerido", "Por favor ingresa el número", "warning"); return; }
            if (!formData.colonia) { showAlert("Campo Requerido", "Por favor ingresa la colonia", "warning"); return; }
            if ((formData.tipo === 'FS' || formData.tipo === 'Otro') && !formData.referencia) { showAlert("Campo Requerido", "Por favor ingresa la referencia", "warning"); return; }
        } else {
            if (!formData.calleAv) { showAlert("Campo Requerido", "Por favor ingresa la calle/Av", "warning"); return; }
            if (!formData.manzana) { showAlert("Campo Requerido", "Por favor ingresa la manzana", "warning"); return; }
            if (!formData.lote) { showAlert("Campo Requerido", "Por favor ingresa el lote", "warning"); return; }
        }
        if (!formData.cp) { showAlert("Campo Requerido", "Por favor ingresa el código postal", "warning"); return; }

        try {
            let finalImagenPerfil = formData.imagenPerfil;
            if (formData.imagenPerfilFile) {
                try { finalImagenPerfil = await uploadImage(formData.imagenPerfilFile); } catch (ign) { }
            }
            
            let finalImagenPortada = formData.imagen_portada;
            if (formData.imagenPortadaFile) {
                try { finalImagenPortada = await uploadImage(formData.imagenPortadaFile); } catch (ign) { }
            }

            const finalLevantamiento = await Promise.all((formData.levantamiento || []).map(async (section) => {
                const finalEquipos = await Promise.all(section.equipos.map(async (eq) => {
                    let eqFoto = eq.foto;
                    let eqFotoPlaca = eq.fotoPlaca;
                    
                    if (eq.fotoFile) {
                        try { eqFoto = await uploadImage(eq.fotoFile); } catch (ign) { }
                    }
                    if (eq.fotoPlacaFile) {
                        try { eqFotoPlaca = await uploadImage(eq.fotoPlacaFile); } catch (ign) { }
                    }
                    
                    return { ...eq, foto: eqFoto, fotoPlaca: eqFotoPlaca };
                }));
                const cleanSubAreas = (section.subAreas || []).map(sub => ({
                    ...sub,
                    equipos: []
                }));
                return { ...section, subAreas: cleanSubAreas, equipos: finalEquipos };
            }));
            
            const finalTipo = formData.tipo === 'Otro' ? (customTipoValue || 'Otro') : formData.tipo;

            const apiPayload = {
                nombre: formData.nombreSucursal,
                tipo: finalTipo,
                encargado: formData.encargado,
                estado: formData.estado,
                ciudad: formData.ciudad,
                calle: formData.calle,
                numero: formData.numero,
                colonia: formData.colonia,
                cp: formData.cp,
                referencia: formData.referencia,
                nombrePlaza: formData.nombrePlaza,
                gerente: formData.gerente,
                telefonoGerente: formData.telefonoGerente,
                subgerente: formData.subgerente,
                telefonoSubgerente: formData.telefonoSubgerente,
                manzana: formData.manzana,
                lote: formData.lote,
                calleAv: formData.calleAv,
                latitud: formData.latitud || '',
                longitud: formData.longitud || '',
                levantamiento: finalLevantamiento,
                imagenPerfil: finalImagenPerfil,
                imagen_portada: finalImagenPortada
            };
            const fullLocalData = {
                ...apiPayload,
                nombrePlaza: formData.nombrePlaza,
                gerente: formData.gerente,
                telefonoGerente: formData.telefonoGerente,
                subgerente: formData.subgerente,
                telefonoSubgerente: formData.telefonoSubgerente,
                manzana: formData.manzana,
                lote: formData.lote,
                calleAv: formData.calleAv,
                areas: finalLevantamiento
            };
            if (editId) {
                const updateRes = await updateNegocio(Number(editId), apiPayload);
                if (updateRes?.data?.areas) fullLocalData.areas = updateRes.data.areas;
                saveSafeLocalInfo('local_negocios_info', editId, fullLocalData, showAlert);
                showAlert("Éxito", "Información actualizada correctamente", "success");
            } else {
                const createPayload = { ...apiPayload, user_id: user?.id };
                const newNegocio = await createNegocio(createPayload);
                if (newNegocio) {
                    const actualId = newNegocio.data?.id || newNegocio.id;
                    if (actualId) {
                        if (apiPayload.levantamiento && apiPayload.levantamiento.length > 0) {
                            try {
                                const finalUpdateRes = await updateNegocio(actualId, apiPayload);
                                if (finalUpdateRes?.data?.areas) fullLocalData.areas = finalUpdateRes.data.areas;
                            } catch (e) { console.error("Error al sincronizar áreas tras creación", e); }
                        }
                        saveSafeLocalInfo('local_negocios_info', actualId, fullLocalData, showAlert);
                    }
                    // Notificar al admin que hay una nueva sucursal
                    try {
                        await createNotificacionByRole({
                            role: 'admin',
                            titulo: '🏢 Nueva Sucursal Registrada',
                            mensaje: `El cliente ${user?.name || 'un usuario'} registró una nueva sucursal: "${formData.nombreSucursal}".`,
                            enlace: `/menu/negocios`
                        });
                    } catch (notiErr) {
                        console.error("Error notificando al admin de nueva sucursal:", notiErr);
                    }
                }
                showAlert("Éxito", "Información guardada correctamente", "success");
            }
            if (user?.role === 'encargado') {
                navigate('/encargado');
            } else if (isAutonomoAdmin(user?.role)) {
                navigate('/autonomo/negocios');
            } else if (user?.role === 'admin') {
                navigate('/menu/negocios');
            } else {
                navigate('/cliente');
            }
        } catch (error) {
            console.error("Error saving negocio:", error);
            showAlert("Error", "Hubo un error al guardar en el servidor. Prueba de nuevo.", "error");
        }
    };

    const handleDeleteNegocio = () => {
        if (!editId) return;
        showConfirm(
            "Eliminar Sucursal",
            "¿Estás seguro de que deseas eliminar esta sucursal? Esta acción borrará permanentemente todo su historial, áreas y equipos registrados.",
            async () => {
                try {
                    await deleteNegocio(Number(editId));
                    // Limpiar local storage
                    const localData = JSON.parse(localStorage.getItem('local_negocios_info') || '{}');
                    delete localData[editId];
                    localStorage.setItem('local_negocios_info', JSON.stringify(localData));

                    showAlert("Éxito", "La sucursal ha sido eliminada correctamente", "success");
                    
                    if (user?.role === 'encargado') {
                        navigate('/encargado');
                    } else if (isAutonomoAdmin(user?.role)) {
                        navigate('/autonomo/negocios');
                    } else if (user?.role === 'admin') {
                        navigate('/menu/negocios');
                    } else {
                        navigate('/cliente');
                    }
                } catch (error) {
                    console.error("Error deleting negocio:", error);
                    showAlert("Error", "No se pudo eliminar la sucursal. Intenta de nuevo.", "error");
                }
            },
            () => {},
            "Eliminar",
            "Cancelar"
        );
    };

    const persistLevantamiento = async (newLevantamientoData: LevantamientoData, showNotification: boolean = false) => {
        setFormData(prev => ({ ...prev, levantamiento: newLevantamientoData }));
        
        if (!editId) return;

        try {
            const finalLevantamiento = await Promise.all(newLevantamientoData.map(async (section) => {
                const finalEquipos = await Promise.all(section.equipos.map(async (eq) => {
                    let eqFoto = eq.foto;
                    let eqFotoPlaca = eq.fotoPlaca;
                    if (eq.fotoFile) {
                        try { eqFoto = await uploadImage(eq.fotoFile); } catch (ign) { }
                    }
                    if (eq.fotoPlacaFile) {
                        try { eqFotoPlaca = await uploadImage(eq.fotoPlacaFile); } catch (ign) { }
                    }
                    return { ...eq, foto: eqFoto, fotoPlaca: eqFotoPlaca, fotoFile: undefined, fotoPlacaFile: undefined };
                }));
                const cleanSubAreas = (section.subAreas || []).map(sub => ({
                    ...sub,
                    equipos: []
                }));
                return { ...section, subAreas: cleanSubAreas, equipos: finalEquipos };
            }));

            const finalTipo = formData.tipo === 'Otro' ? (customTipoValue || 'Otro') : formData.tipo;
            // Solo enviamos levantamiento + datos básicos (NO imágenes para no sobreescribir con blob URLs)
            const imagenPerfilSafe = formData.imagenPerfil?.startsWith('blob:') ? undefined : formData.imagenPerfil;
            const imagenPortadaSafe = (formData as any).imagenPortada?.startsWith('blob:') ? undefined : (formData as any).imagenPortada;
            const apiPayload: Record<string, unknown> = {
                nombre: formData.nombreSucursal,
                tipo: finalTipo,
                encargado: formData.encargado,
                estado: formData.estado,
                ciudad: formData.ciudad,
                calle: formData.calle,
                numero: formData.numero,
                colonia: formData.colonia,
                cp: formData.cp,
                referencia: formData.referencia,
                nombrePlaza: formData.nombrePlaza,
                gerente: formData.gerente,
                telefonoGerente: formData.telefonoGerente,
                subgerente: formData.subgerente,
                telefonoSubgerente: formData.telefonoSubgerente,
                manzana: formData.manzana,
                lote: formData.lote,
                calleAv: formData.calleAv,
                levantamiento: finalLevantamiento,
            };
            if (imagenPerfilSafe) apiPayload.imagenPerfil = imagenPerfilSafe;
            if (imagenPortadaSafe) apiPayload.imagen_portada = imagenPortadaSafe;

            const updateRes = await updateNegocio(Number(editId), apiPayload);
            const serverAreasList = updateRes?.data?.areas || updateRes?.areas;
            if (serverAreasList && Array.isArray(serverAreasList)) {
                const mergedAreas = serverAreasList.map((serverArea: any) => {
                    const localArea = newLevantamientoData.find(a => 
                        String(a.id) === String(serverArea.id) || a.nombreArea === serverArea.nombreArea
                    );
                    
                    const subAreasMap = new Map<string, any>();
                    
                    if (serverArea.sub_areas_json && Array.isArray(serverArea.sub_areas_json)) {
                        serverArea.sub_areas_json.forEach((sub: any) => {
                            subAreasMap.set(sub.id, { ...sub, equipos: [] });
                        });
                    }

                    if (localArea && localArea.subAreas) {
                        localArea.subAreas.forEach(sub => {
                            if (!subAreasMap.has(sub.id)) {
                                subAreasMap.set(sub.id, { ...sub, equipos: [] });
                            }
                        });
                    }

                    (serverArea.equipos || []).forEach((eq: any) => {
                        const subId = eq.subAreaId || `sub_gen_${serverArea.id}`;
                        const subName = eq.nombreSubArea || 'GENERAL';
                        if (!subAreasMap.has(subId)) {
                            subAreasMap.set(subId, { id: subId, nombreSubArea: subName, equipos: [] });
                        }
                        subAreasMap.get(subId)!.equipos.push(eq);
                    });

                    let finalSubAreas = Array.from(subAreasMap.values());
                    if (finalSubAreas.length === 0) {
                        finalSubAreas = [{ id: `sub_gen_${serverArea.id}`, nombreSubArea: 'GENERAL', equipos: [] }];
                    }

                    return {
                        ...serverArea,
                        subAreas: finalSubAreas
                    };
                });
                setFormData(prev => ({ ...prev, levantamiento: mergedAreas }));
            }
            if (showNotification) {
                showAlert("Éxito", "Levantamiento guardado correctamente", "success");
            }
        } catch (err) {
            console.error("Error al guardar levantamiento:", err);
            if (showNotification) {
                showAlert("Error", "No se pudo sincronizar el levantamiento con el servidor", "error");
            }
        }
    };

    const handleDeleteEquipment = (eqId: string, sectionId: string) => {
        showConfirm(
            "¿Eliminar equipo?",
            "¿Estás seguro de que deseas eliminar este equipo permanentemente?",
            async () => {
                const currentLevantamiento = formData.levantamiento || [];
                const updated = currentLevantamiento.map(sec => {
                    if (sec.id === sectionId) {
                        return {
                            ...sec,
                            equipos: sec.equipos.filter(e => e.id !== eqId),
                            subAreas: (sec.subAreas || []).map(sub => ({
                                ...sub,
                                equipos: sub.equipos.filter(e => e.id !== eqId)
                            }))
                        };
                    }
                    return sec;
                });
                setFormData(prev => ({ ...prev, levantamiento: updated }));
                try {
                    await deleteEquipo(eqId);
                    showAlert("Eliminado", "Equipo eliminado correctamente", "success");
                    await persistLevantamiento(updated);
                } catch (err) {
                    console.error("Error al borrar equipo:", err);
                    showAlert("Error", "No se pudo eliminar el equipo en la base de datos", "error");
                }
            },
            () => {},
            "Sí, eliminar",
            "Cancelar"
        );
    };

    // Funciones para el Grid Visual
    const handleAddArea = (nombreArea: string) => {
        const newSecId = `sec_${Date.now()}`;
        const newSubId = `sub_${Date.now()}`;
        const newSection: LevantamientoSeccion = {
            id: newSecId,
            nombreArea: nombreArea.trim().toUpperCase(),
            subAreas: [{ id: newSubId, nombreSubArea: 'GENERAL', equipos: [] }],
            equipos: []
        };
        const updated = [...(formData.levantamiento || []), newSection];
        persistLevantamiento(updated);
        setIsAreaModalOpen(false);
    };

    const handleAddSubArea = (nombreSubArea: string) => {
        if (!activeAreaForSub) return;
        const newSubId = `sub_${Date.now()}`;
        const updated = (formData.levantamiento || []).map(sec => {
            if (sec.id === activeAreaForSub) {
                return {
                    ...sec,
                    subAreas: [...(sec.subAreas || []), { id: newSubId, nombreSubArea: nombreSubArea.trim().toUpperCase(), equipos: [] }]
                };
            }
            return sec;
        });
        persistLevantamiento(updated);
        setIsSubAreaModalOpen(false);
    };

    const handleDeleteArea = (id: string, nombreArea: string) => {
        showConfirm(
            "¿Eliminar área?",
            `¿Estás seguro de que deseas eliminar el área "${nombreArea}" y todas sus sub-áreas?`,
            () => {
                const updated = (formData.levantamiento || []).filter(s => s.id !== id);
                persistLevantamiento(updated);
            },
            () => {},
            "Sí, eliminar",
            "Cancelar"
        );
    };

    const editAreaName = (id: string, oldName: string) => {
        showPrompt(
            "Editar Área",
            "Ingresa el nuevo nombre para esta área:",
            oldName,
            (newName) => {
                if (newName && newName.trim()) {
                    const updated = (formData.levantamiento || []).map(sec => 
                        sec.id === id ? { ...sec, nombreArea: newName.trim().toUpperCase() } : sec
                    );
                    persistLevantamiento(updated);
                }
            },
            () => {},
            "Guardar Cambios",
            "Cancelar"
        );
    };

    const handleReportarProblemaSubmit = async (descripcion: string) => {
        if (!reportingEquipment || !user?.id || !editId) return;
        if (String(reportingEquipment.id).startsWith('temp_')) {
            showAlert("Atención", "Por favor primero guarda el levantamiento de la empresa antes de reportar un problema para un equipo nuevo.", "warning");
            return;
        }
        try {
            await createMantenimientoSolicitud({
                cliente_id: user.id,
                negocio_id: Number(editId),
                levantamiento_equipo_id: reportingEquipment.id!,
                descripcion_problema: descripcion
            });

            showAlert("Reporte Enviado", "El problema ha sido reportado exitosamente. El administrador revisará y agendará una visita técnica.", "success");
        } catch (error) {
            console.error(error);
            showAlert("Error", "No se pudo enviar el reporte de mantenimiento. Intenta de nuevo.", "error");
        }
    };

    return (
        <div className={styles.dashboardLayout}>
            <div className={styles.mainContainer}>
                
                {/* HEADER SECTION */}
                <header className={styles.pageHeader}>
                    <div className={styles.titleSection}>
                        <h1 className={styles.pageTitle}>
                            {editId ? "Editar Sucursal" : "Nueva Sucursal"}
                        </h1>
                    </div>
                </header>

                {/* BUSINESS PROFILE HEADER CARD */}
                <div 
                    className={styles.profileHeaderCard} 
                    style={formData.imagen_portada ? {
                        backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.9)), url(${formData.imagen_portada})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                    } : {}}
                >
                    {canEdit && (
                        <div 
                            className={styles.editBannerOverlay} 
                            onClick={() => bannerInputRef.current?.click()}
                            title="Cambiar Fondo de Sucursal"
                        >
                            <HiOutlinePencilSquare size={20} />
                        </div>
                    )}
                    <input
                        type="file"
                        accept="image/*"
                        ref={bannerInputRef}
                        style={{ display: 'none' }}
                        onChange={handleBannerChange}
                    />

                    <div className={styles.profileIconWrapper}>
                        <div className={styles.profileIcon}>
                            {formData.imagenPerfil && !imageError ? (
                                <img 
                                    src={formData.imagenPerfil} 
                                    alt="Logo" 
                                    className={styles.profileImg} 
                                    onError={() => setImageError(true)}
                                />
                            ) : (
                                "🏢"
                            )}
                        </div>
                        {canEdit && (
                            <div className={styles.editOverlay} onClick={() => fileInputRef.current?.click()}>
                                <HiOutlineCamera size={20} />
                            </div>
                        )}
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={handleImageChange}
                        />
                    </div>
                    
                    <div className={styles.businessHeaderInfo}>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Nombre de la Sucursal</label>
                            <textarea
                                name="nombreSucursal"
                                placeholder="Ej: Mantenere Center Mérida"
                                className={styles.businessNameInput}
                                value={formData.nombreSucursal || ''}
                                onChange={handleChange}
                                disabled={!canEdit}
                                rows={2}
                            />
                        </div>
                    </div>
                </div>

                {/* TABS CONTAINER */}
                <div className={styles.tabsContainer}>
                    <button
                        type="button"
                        onClick={() => setActiveTab('info')}
                        className={`${styles.tab} ${activeTab === 'info' ? styles.activeTab : ''}`}
                    >
                        Información Detallada
                    </button>
                    {editId && (
                        <button
                            type="button"
                            onClick={() => setActiveTab('flota')}
                            className={`${styles.tab} ${activeTab === 'flota' ? styles.activeTab : ''}`}
                        >
                            Levantamiento de Flota
                        </button>
                    )}
                </div>

                {activeTab === 'info' && (
                    <div className={styles.contentWrapper}>
                        
                        {/* CARD 1: INFORMACIÓN GENERAL */}
                        <div className={styles.infoCard}>
                            <h2 className={styles.sectionTitle}>
                                <HiOutlineInformationCircle /> Información General
                            </h2>
                            <div className={styles.formGrid}>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Tipo de Establecimiento</label>
                                    <select
                                        name="tipo"
                                        className={styles.select}
                                        value={formData.tipo}
                                        onChange={handleChange}
                                        disabled={!canEdit}
                                    >
                                        <option value="FC">FC (Food Court)</option>
                                        <option value="FS">FS (Freestanding)</option>
                                        <option value="MALL">MALL</option>
                                        <option value="W/M">W/M</option>
                                        <option value="Otro">Otro (Especificar)</option>
                                    </select>
                                    {formData.tipo === 'Otro' && (
                                        <input
                                            type="text"
                                            placeholder="Especifica el tipo..."
                                            className={styles.input}
                                            style={{ marginTop: '10px' }}
                                            value={customTipoValue}
                                            onChange={(e) => setCustomTipoValue(e.target.value)}
                                            disabled={!canEdit}
                                        />
                                    )}
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>
                                        {formData.tipo === 'FC' ? 'Encargado Directo' : 'Dueño de la Empresa'}
                                    </label>
                                    <input
                                        type="text"
                                        name="encargado"
                                        placeholder="Nombre completo"
                                        className={styles.input}
                                        value={formData.encargado || ''}
                                        onChange={handleChange}
                                        disabled={!canEdit}
                                    />
                                </div>
                                {['admin', 'admin-autonomo', 'gerente-general'].includes(user?.role || '') && formData.ownerEmail && (
                                    <div className={styles.inputGroup}>
                                        <label className={styles.label}>Correo del Dueño</label>
                                        <input
                                            type="email"
                                            className={styles.input}
                                            value={formData.ownerEmail}
                                            disabled={true}
                                            style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* CARD 2: UBICACIÓN */}
                        <div className={styles.infoCard}>
                            <h2 className={styles.sectionTitle}>
                                <HiOutlineMapPin /> Ubicación y Dirección
                            </h2>
                            
                            <div className={styles.formGrid}>
                                {formData.tipo !== 'W/M' ? (
                                    <>
                                        <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
                                            <label className={styles.label}>
                                                {(formData.tipo === 'FS' || formData.tipo === 'Otro') ? 'Calle Principal / Avenida' : 'Nombre de la Plaza Comercial'}
                                            </label>
                                            <input
                                                type="text"
                                                name={(formData.tipo === 'FS' || formData.tipo === 'Otro') ? 'calleAv' : 'nombrePlaza'}
                                                className={styles.input}
                                                placeholder={(formData.tipo === 'FS' || formData.tipo === 'Otro') ? 'Ej: Prolongación Montejo' : 'Ej: Plaza Altabrisa'}
                                                value={((formData.tipo === 'FS' || formData.tipo === 'Otro') ? formData.calleAv : formData.nombrePlaza) || ''}
                                                onChange={handleChange}
                                                disabled={!canEdit}
                                            />
                                        </div>

                                        <div className={styles.inputGroup}>
                                            <label className={styles.label}>Estado</label>
                                            <input type="text" name="estado" className={styles.input} value={formData.estado || ''} onChange={handleChange} disabled={!canEdit} />
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <label className={styles.label}>Ciudad / Municipio</label>
                                            <input type="text" name="ciudad" className={styles.input} value={formData.ciudad || ''} onChange={handleChange} disabled={!canEdit} />
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <label className={styles.label}>Calle</label>
                                            <input type="text" name="calle" className={styles.input} value={formData.calle || ''} onChange={handleChange} disabled={!canEdit} />
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <label className={styles.label}>Número</label>
                                            <input type="text" name="numero" className={styles.input} value={formData.numero || ''} onChange={handleChange} disabled={!canEdit} />
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <label className={styles.label}>Colonia / Fraccionamiento</label>
                                            <input type="text" name="colonia" className={styles.input} value={formData.colonia || ''} onChange={handleChange} disabled={!canEdit} />
                                        </div>
                                        {(formData.tipo === 'FS' || formData.tipo === 'Otro') && (
                                            <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
                                                <label className={styles.label}>Referencias adicionales</label>
                                                <input type="text" name="referencia" className={styles.input} placeholder="Ej: Frente al parque principal" value={formData.referencia || ''} onChange={handleChange} disabled={!canEdit} />
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <div className={styles.inputGroup}>
                                            <label className={styles.label}>Calle o Avenida</label>
                                            <input type="text" name="calleAv" className={styles.input} value={formData.calleAv || ''} onChange={handleChange} disabled={!canEdit} />
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <label className={styles.label}>Manzana</label>
                                            <input type="text" name="manzana" className={styles.input} value={formData.manzana || ''} onChange={handleChange} disabled={!canEdit} />
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <label className={styles.label}>Lote</label>
                                            <input type="text" name="lote" className={styles.input} value={formData.lote || ''} onChange={handleChange} disabled={!canEdit} />
                                        </div>
                                    </>
                                )}
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Código Postal</label>
                                    <input type="text" name="cp" className={styles.input} placeholder="97000" value={formData.cp || ''} onChange={handleChange} disabled={!canEdit} />
                                </div>

                                {/* GPS: Coordenadas de la Sucursal */}
                                {canEdit && (
                                    <div style={{ gridColumn: '1 / -1', marginTop: '8px' }}>
                                        <div style={{
                                            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                                            border: '1.5px solid #86efac',
                                            borderRadius: '16px',
                                            padding: '16px 20px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '12px'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                                <div>
                                                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#15803d', display: 'block' }}>📍 Coordenadas GPS de la Sucursal</span>
                                                    <span style={{ fontSize: '11px', color: '#4ade80' }}>
                                                        {formData.latitud && formData.longitud
                                                            ? `✓ Coordenadas registradas: ${parseFloat(formData.latitud).toFixed(6)}, ${parseFloat(formData.longitud).toFixed(6)}`
                                                            : 'Sin coordenadas — el mapa usará geocodificación por dirección (menos preciso)'}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (!navigator.geolocation) {
                                                            alert('Tu navegador no soporta geolocalización.');
                                                            return;
                                                        }
                                                        navigator.geolocation.getCurrentPosition(
                                                            (pos) => {
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    latitud: pos.coords.latitude.toString(),
                                                                    longitud: pos.coords.longitude.toString()
                                                                }));
                                                            },
                                                            () => alert('No se pudo obtener la ubicación. Verifica los permisos del navegador.'),
                                                            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                                                        );
                                                    }}
                                                    style={{
                                                        background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                                                        color: 'white',
                                                        border: 'none',
                                                        padding: '10px 18px',
                                                        borderRadius: '12px',
                                                        fontSize: '13px',
                                                        fontWeight: '800',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                    onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
                                                    onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                                                >
                                                    📡 Capturar mi Ubicación GPS Actual
                                                </button>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                                <div>
                                                    <label style={{ fontSize: '11px', fontWeight: '700', color: '#15803d', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Latitud</label>
                                                    <input
                                                        type="text"
                                                        name="latitud"
                                                        className={styles.input}
                                                        placeholder="Ej: 20.967600"
                                                        value={formData.latitud || ''}
                                                        onChange={handleChange}
                                                        style={{ fontFamily: 'monospace', fontSize: '13px' }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '11px', fontWeight: '700', color: '#15803d', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Longitud</label>
                                                    <input
                                                        type="text"
                                                        name="longitud"
                                                        className={styles.input}
                                                        placeholder="Ej: -89.592600"
                                                        value={formData.longitud || ''}
                                                        onChange={handleChange}
                                                        style={{ fontFamily: 'monospace', fontSize: '13px' }}
                                                    />
                                                </div>
                                            </div>
                                            {formData.latitud && formData.longitud && (
                                                <a
                                                    href={`https://www.google.com/maps?q=${formData.latitud},${formData.longitud}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ fontSize: '12px', color: '#16a34a', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                                                >
                                                    🗺️ Verificar en Google Maps ↗
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>



                        {/* CARD 4: ACCESO DE ENCARGADO DE SUCURSAL */}
                        {editId && canEdit && (isAutonomoAdmin(user?.role) || user?.role === 'admin' || config?.isAutonomo) && (
                            <div className={styles.infoCard}>
                                <h2 className={styles.sectionTitle}>
                                    <HiOutlineKey /> Acceso de Encargado de Sucursal
                                </h2>

                                {encargadoExistente && (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '10px',
                                        background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
                                        borderRadius: '10px', padding: '12px 16px',
                                        marginBottom: '18px', fontSize: '14px', color: '#065f46', fontWeight: 500
                                    }}>
                                        <span style={{ fontSize: '18px' }}>✅</span>
                                        <span>Encargado asignado: <strong>{encargadoExistente.name}</strong> — {encargadoExistente.email}</span>
                                    </div>
                                )}

                                <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px', lineHeight: '1.6' }}>
                                    Asigna credenciales de acceso exclusivas para esta sucursal. El encargado podrá iniciar sesión y consultar únicamente la información de esta sucursal.
                                </p>

                                <div className={styles.formGrid}>
                                    <div className={styles.inputGroup}>
                                        <label className={styles.label}>Nombre del Encargado</label>
                                        <input
                                            type="text"
                                            placeholder="Ej: Luis Ramírez"
                                            className={styles.input}
                                            value={encargadoForm.name}
                                            onChange={e => setEncargadoForm(prev => ({ ...prev, name: e.target.value }))}
                                        />
                                    </div>
                                    <div className={styles.inputGroup}>
                                        <label className={styles.label}>Correo de Acceso</label>
                                        <input
                                            type="email"
                                            placeholder="Ej: encargado@gmail.com"
                                            className={styles.input}
                                            value={encargadoForm.email}
                                            onChange={e => setEncargadoForm(prev => ({ ...prev, email: e.target.value }))}
                                        />
                                    </div>
                                    <div className={styles.inputGroup} style={{ position: 'relative' }}>
                                        <label className={styles.label}>
                                            {encargadoExistente ? 'Nueva Contraseña (mínimo 8 caracteres)' : 'Contraseña (mínimo 8 caracteres)'}
                                        </label>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="Mínimo 8 caracteres"
                                            className={styles.input}
                                            style={{ paddingRight: '42px' }}
                                            value={encargadoForm.password}
                                            onChange={e => setEncargadoForm(prev => ({ ...prev, password: e.target.value }))}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            style={{
                                                position: 'absolute', right: '12px', bottom: '12px',
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                color: '#64748b', display: 'flex', alignItems: 'center'
                                            }}
                                        >
                                            {showPassword ? <HiOutlineEyeSlash size={18} /> : <HiOutlineEye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                <div style={{ marginTop: '20px' }}>
                                    <button
                                        type="button"
                                        onClick={handleAsignarEncargado}
                                        disabled={encargadoLoading}
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                                            background: encargadoLoading ? '#94a3b8' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                                            color: 'white', border: 'none', borderRadius: '10px',
                                            padding: '12px 24px', fontWeight: 700, fontSize: '14px',
                                            cursor: encargadoLoading ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(217,119,6,0.3)'
                                        }}
                                    >
                                        <HiOutlinePaperAirplane size={18} />
                                        {encargadoLoading ? 'Guardando...' : encargadoExistente ? 'Actualizar Acceso' : 'Asignar Acceso'}
                                    </button>
                                </div>
                            </div>
                        )}

                    </div>
                )}
                
                {activeTab === 'levantamiento' && (
                    <div className={styles.contentWrapper}>
                        {/* SECCIÓN LEVANTAMIENTO PREMIUM */}
                        <div className={styles.infoCard}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
                                <div>
                                    <h2 className={styles.sectionTitle} style={{ marginBottom: '6px' }}>
                                        <HiOutlineBolt /> Levantamientos por Áreas y Sub-áreas
                                    </h2>
                                    <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                                        Estructura de áreas, sub-áreas y catálogo de equipos y activos de la sucursal.
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        className={styles.levantamientoButton}
                                        onClick={() => { setActiveSectionId(null); setIsLevantamientoModalOpen(true); }}
                                        type="button"
                                    >
                                        <HiOutlineBolt size={18} />
                                        {canEdit ? "Iniciar levantamiento" : "Ver Catálogo"}
                                    </button>
                                </div>
                            </div>

                            <div className={styles.levantamientoPreview}>
                                {(formData.levantamiento?.length || 0) > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                                        {formData.levantamiento?.map((seccion) => (
                                            <AreaVisualGrid 
                                                key={seccion.id}
                                                seccion={seccion}
                                                canEdit={canEdit}
                                                onEditArea={() => editAreaName(seccion.id, seccion.nombreArea)}
                                                onDeleteArea={() => handleDeleteArea(seccion.id, seccion.nombreArea)}
                                                onAddSubArea={() => {
                                                    setActiveSectionId(seccion.id);
                                                    setInitialSubAreaId(null);
                                                    setIsLevantamientoModalOpen(true);
                                                }}
                                                onViewInventory={(subAreaId) => {
                                                    const subArea = seccion.subAreas?.find(s => s.id === subAreaId);
                                                    if (subArea && subArea.equipos && subArea.equipos.length > 0) {
                                                        setActiveSectionId(seccion.id);
                                                        setInitialSubAreaId(subAreaId);
                                                        setSelectedEquipment(subArea.equipos as any);
                                                    } else {
                                                        setActiveSectionId(seccion.id);
                                                        setInitialSubAreaId(subAreaId);
                                                        setIsLevantamientoModalOpen(true);
                                                    }
                                                }}
                                                onVerBitacora={(subAreaId) => {
                                                    const subArea = seccion.subAreas?.find(s => s.id === subAreaId);
                                                    if (!subArea || !subArea.equipos || subArea.equipos.length === 0) return;
                                                    if (subArea.equipos.length === 1) {
                                                        setSelectedEqForBitacora(subArea.equipos[0] as any);
                                                        setBitacoraModalOpen(true);
                                                    } else {
                                                        setEquiposForSelection(subArea.equipos as any);
                                                        setEquipoSelectionMode('bitacora');
                                                    }
                                                }}
                                                onReportarProblema={(subAreaId) => {
                                                    const subArea = seccion.subAreas?.find(s => s.id === subAreaId);
                                                    if (!subArea || !subArea.equipos || subArea.equipos.length === 0) return;
                                                    if (subArea.equipos.length === 1) {
                                                        setReportingEquipment(subArea.equipos[0] as any);
                                                    } else {
                                                        setEquiposForSelection(subArea.equipos as any);
                                                        setEquipoSelectionMode('reporte');
                                                    }
                                                }}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '30px' }}>
                                        <p style={{ color: '#94a3b8', fontSize: '14px' }}>Aún no has realizado el levantamiento de áreas y equipos de esta sucursal.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                
                {activeTab === 'flota' && (
                    <div className={styles.contentWrapper}>
                        <LevantamientoFlotaMockup />
                    </div>
                )}

                {/* FLOATING ACTION BUTTONS */}
                {canEdit && (activeTab === 'info' || activeTab === 'levantamiento') && (
                    <div className={styles.floatingActions}>
                        {editId && (
                            <button 
                                className={styles.deleteNegocioButton} 
                                onClick={handleDeleteNegocio}
                            >
                                Eliminar Sucursal
                            </button>
                        )}
                        <button 
                            className={styles.saveButton} 
                            onClick={() => {
                                if (activeTab === 'info') handleSave();
                                else persistLevantamiento(formData.levantamiento || [], true);
                            }}
                        >
                            Guardar Cambios
                        </button>
                    </div>
                )}

                {/* MODALS (Functional logic preserved) */}
                <LevantamientoModal
                    isOpen={isLevantamientoModalOpen}
                    onClose={() => {
                        setIsLevantamientoModalOpen(false);
                        setActiveEquipmentId(null);
                        setInitialSubAreaId(null);
                    }}
                    data={formData.levantamiento || []}
                    initialSectionId={activeSectionId}
                    initialEquipmentId={activeEquipmentId}
                    initialSubAreaId={initialSubAreaId}
                    onSave={(newData) => persistLevantamiento(newData)}
                    isReadOnly={!canEdit}
                />

                <ReportarProblemaModal 
                    isOpen={!!reportingEquipment}
                    onClose={() => setReportingEquipment(null)}
                    equipment={reportingEquipment}
                    negocioId={editId || ''}
                    onSubmit={handleReportarProblemaSubmit}
                />

                <ModalSeleccionEquipo
                    isOpen={equipoSelectionMode !== null}
                    onClose={() => {
                        setEquipoSelectionMode(null);
                        setEquiposForSelection([]);
                    }}
                    equipos={equiposForSelection}
                    title={equipoSelectionMode === 'bitacora' ? 'Seleccionar Equipo para Bitácora' : 'Seleccionar Equipo para Reportar'}
                    onSelect={(equipo) => {
                        if (equipoSelectionMode === 'bitacora') {
                            setSelectedEqForBitacora(equipo);
                            setBitacoraModalOpen(true);
                        } else if (equipoSelectionMode === 'reporte') {
                            setReportingEquipment(equipo);
                        }
                        setEquipoSelectionMode(null);
                        setEquiposForSelection([]);
                    }}
                />

                <DetalleEquipoModal
                    isOpen={!!selectedEquipment}
                    onClose={() => setSelectedEquipment(null)}
                    equipment={selectedEquipment}
                    onEdit={canEdit ? () => {
                        setActiveSectionId(selectedSectionId);
                        setIsLevantamientoModalOpen(true);
                    } : undefined}
                    onVerHistorial={() => {
                        setSelectedEqForBitacora(selectedEquipment);
                        setBitacoraModalOpen(true);
                    }}
                />

                <HistorialEquipoModal 
                    isOpen={bitacoraModalOpen}
                    onClose={() => setBitacoraModalOpen(false)}
                    equipo={selectedEqForBitacora}
                    historial={selectedEqForBitacora ? allSolicitudes.filter(sol => String(sol.levantamiento_equipo_id) === String(selectedEqForBitacora.id)) : []}
                    onViewReport={(trabajoId) => {
                        setSelectedTrabajoId(trabajoId);
                        setReporteModalOpen(true);
                    }}
                />

                {selectedTrabajoId && (
                    <DetalleReporteModal 
                        isOpen={reporteModalOpen}
                        onClose={() => setReporteModalOpen(false)}
                        trabajoId={selectedTrabajoId}
                    />
                )}

                <ModalSeleccionEspacio 
                    isOpen={isAreaModalOpen}
                    onClose={() => setIsAreaModalOpen(false)}
                    onAdd={handleAddArea}
                    title="NUEVA ÁREA"
                    subtitle="SELECCIONA EL ÁREA A AGREGAR"
                    predefinedOptions={['COCINA', 'COMEDOR', 'RECEPCIÓN', 'BAÑOS', 'ALMACÉN', 'CUARTO DE MÁQUINAS', 'EXTERIOR', 'PASILLOS', 'BAR']}
                />

                <ModalSeleccionEspacio 
                    isOpen={isSubAreaModalOpen}
                    onClose={() => setIsSubAreaModalOpen(false)}
                    onAdd={handleAddSubArea}
                    title="NUEVA SUB-ÁREA"
                    subtitle="SELECCIONA LA SUB-ÁREA A AGREGAR"
                    predefinedOptions={['ZONA DE FRÍO', 'ZONA CALIENTE', 'LAVADO', 'PREPARACIÓN', 'CAJAS', 'BARRA', 'GENERAL']}
                />
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default PerfilEmpresaUnificado;
