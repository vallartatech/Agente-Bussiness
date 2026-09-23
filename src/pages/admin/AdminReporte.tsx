import React, { useState, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import styles from './AdminReporte.module.css';
import { createReporte, getReporteByTrabajoId } from '../../services/reportesService';
import { getActividadesByTrabajo } from '../../services/actividadesService';
import { getTrabajo } from '../../services/trabajosService';
import { createNotificacionByRole, createNotificacion } from '../../services/notificacionesService';
import { useAuth } from '../../context/AuthContext';
import { useModal } from '../../context/ModalContext';
import { isAutonomoAdmin } from '../../utils/roles';
import { 
    HiOutlineCamera, 
    HiOutlineArrowUpTray,
    HiOutlinePlus
} from 'react-icons/hi2';
import ReportePDFPreview from '../../components/modals/ReportePDFPreview';
import { findMatchingSubReport } from '../../utils/reportUtils';
import { getNegocio } from '../../services/negociosService';

const safeLocalStorageSet = (key: string, value: string) => {
    try {
        localStorage.setItem(key, value);
    } catch (e: any) {
        if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
            try {
                // 1. Limpiar todos los borradores temporales viejos
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith('report_data_temporal_') && k !== key) {
                        localStorage.removeItem(k);
                    }
                }
                localStorage.setItem(key, value);
            } catch (_) {
                try {
                    // 2. Si aún excede, limpiar firmas pesadas en base64 de la caché local (ya que se guardan en la BD)
                    const parsed = JSON.parse(value);
                    if (parsed.firmaEmpresa && parsed.firmaEmpresa.length > 50000) {
                        parsed.firmaEmpresa = '__PDF_LOADED_IN_STATE__';
                    }
                    localStorage.setItem(key, JSON.stringify(parsed));
                } catch (inner) {
                    try {
                        // 3. Fallback: remover claves viejas de reportes terminados para liberar espacio
                        for (let i = localStorage.length - 1; i >= 0; i--) {
                            const k = localStorage.key(i);
                            if (k && (k.startsWith('report_data_') || k.startsWith('report_data_temporal_')) && k !== key) {
                                localStorage.removeItem(k);
                            }
                        }
                        const parsed = JSON.parse(value);
                        if (parsed.firmaEmpresa && parsed.firmaEmpresa.length > 20000) {
                            parsed.firmaEmpresa = '__PDF_LOADED_IN_STATE__';
                        }
                        localStorage.setItem(key, JSON.stringify(parsed));
                    } catch (finalErr) {
                        console.warn("Aviso: Cuota de localStorage alcanzada, los datos se conservan en la BD.");
                    }
                }
            }
        }
    }
};

const compressImage = (
    file: File, 
    callback: (compressedBase64: string) => void,
    maxWidth = 640,
    maxHeight = 640,
    quality = 0.45
) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                }
            }
            canvas.width = Math.round(width);
            canvas.height = Math.round(height);
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'medium';
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            }
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            callback(dataUrl);
        };
        if (e.target?.result) {
            img.src = e.target.result as string;
        }
    };
    reader.readAsDataURL(file);
};

const AdminReporte: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const location = useLocation();
    const trabajoId = location.state?.trabajoId;
    const { user } = useAuth();
    const { showAlert, showConfirm } = useModal();

    const [trabajoBase, setTrabajoBase] = useState<any>(null);
    const [reporteTienda, setReporteTienda] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [materiales, setMateriales] = useState('');
    const [refaccionesList, setRefaccionesList] = useState<{pieza: string, cantidad: number, costo_estimado: string}[]>([]);

    const [imagenes, setImagenes] = useState({
        antes: null as string | null,
        durante: null as string | null,
        despues: null as string | null
    });
    const [observacionesList, setObservacionesList] = useState<{ id: string; texto: string; imagenes: string[] }[]>([]);
    const [activeUploadBlockId, setActiveUploadBlockId] = useState<string | null>(null);
    const [showObservacionesInput, setShowObservacionesInput] = useState(false);
    const [firmaEmpresa, setFirmaEmpresa] = useState<string | null>(null);
    const [reporteId, setReporteId] = useState<number | null>(null);
    const [fechaInicio, setFechaInicio] = useState<string>('');
    const [involucraEquipo, setInvolucraEquipo] = useState(false);
    const [availableEquipos, setAvailableEquipos] = useState<{
        id: string | number;
        nombre: string;
        marca: string;
        modelo: string;
        serie?: string;
        area?: string;
        foto?: string;
    }[]>([]);
    const [selectedEquipoIds, setSelectedEquipoIds] = useState<(string | number)[]>([]);
    const [equipoInfo, setEquipoInfo] = useState({
        tipo: 'Instalación',
        marca: '',
        modelo: '',
        piezas: '',
        garantia: ''
    });

    const [selectedZoomImage, setSelectedZoomImage] = useState<string | null>(null);
    const [showReportePreview, setShowReportePreview] = useState(false);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [isSavingReport, setIsSavingReport] = useState(false);

    const parseFotoUrls = (fotoUrl: any): string[] => {
        if (!fotoUrl) return [];
        let urls: string[] = [];
        if (typeof fotoUrl === 'string') {
            if (fotoUrl.trim().startsWith('[')) {
                try {
                    const parsed = JSON.parse(fotoUrl);
                    if (Array.isArray(parsed)) urls = parsed;
                } catch (e) {
                    console.error("Error parsing foto_url JSON:", e);
                }
            } else {
                urls = [fotoUrl];
            }
        } else if (Array.isArray(fotoUrl)) {
            urls = fotoUrl;
        }

        const baseUrl = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8085/api').replace(/\/api\/?$/, '');
        return urls.map(url => {
            if (typeof url === 'string') {
                if (url.includes('127.0.0.1') || url.includes('localhost')) {
                    const parts = url.split('/storage/');
                    if (parts.length === 2) {
                        return `${baseUrl}/storage/${parts[1]}`;
                    }
                } else if (url.startsWith('/storage/')) {
                    return `${baseUrl}${url}`;
                } else if (url.startsWith('storage/')) {
                    return `${baseUrl}/${url}`;
                }
            }
            return url;
        });
    };

    React.useEffect(() => {
        const loadReportData = async () => {
            let initFechaInicio = '';
            setFechaInicio('');
            // --- RESET: Limpiar estados previos para evitar fugas entre reportes ---
            setReporteTienda('');
            setDescripcion('');
            setMateriales('');
            setRefaccionesList([]);
            setImagenes({ antes: null, durante: null, despues: null });
            setObservacionesList([]);
            setShowObservacionesInput(false);
            setFirmaEmpresa(null);
            setReporteId(null);
            setInvolucraEquipo(false);
            setAvailableEquipos([]);
            setSelectedEquipoIds([]);
            setEquipoInfo({
                tipo: 'Instalación',
                marca: '',
                modelo: '',
                piezas: '',
                garantia: ''
            });

            const safeId = trabajoId || id;
            const queryParams = new URLSearchParams(location.search);
            const subtareaIdParam = queryParams.get('subtareaId') || location.state?.subtareaId || location.state?.actividadId;

            try {
                // 1. Obtener Trabajo y Actividades desde el Backend (Fuente de Verdad de la Solicitud)
                const jobData = await getTrabajo(Number(safeId));
                const acts = await getActividadesByTrabajo(Number(safeId));

                const serviceMarker = "|||SERVICE_DATA|||";
                const photosMarker = "|||PHOTOS_DATA|||";
                const quoteMarker = "|||QUOTE_DATA|||";
                const techMarker = "|||TECH_NAME|||";

                let targetAct: any = null;
                let pointIndex = 0;
                let hasPointIndex = false;

                if (subtareaIdParam) {
                    const subParamStr = String(subtareaIdParam);
                    if (subParamStr.includes('_')) {
                        const [baseIdStr, pIdxStr] = subParamStr.split('_');
                        targetAct = acts.find((a: any) => String(a.id) === baseIdStr);
                        pointIndex = (parseInt(pIdxStr, 10) || 1) - 1;
                        hasPointIndex = true;
                    } else {
                        targetAct = acts.find((a: any) => String(a.id) === subParamStr);
                    }
                }

                let taskTitle = jobData.titulo || "Servicio";
                let taskCleanDesc = jobData.descripcion ? jobData.descripcion.replace(/^.*Problema reportado:\s*/i, '') : "";
                let taskPhotos: string[] = [];
                let taskRefactions: any[] = [];

                if (targetAct) {
                    taskTitle = targetAct.tipo || targetAct.titulo || jobData.titulo;
                    const rawDesc = targetAct.descripcion || "";
                    taskCleanDesc = rawDesc.split(serviceMarker)[0].split(photosMarker)[0].split(quoteMarker)[0].split(techMarker)[0].trim();

                    if (targetAct.photos && Array.isArray(targetAct.photos) && targetAct.photos.length > 0) {
                        taskPhotos = targetAct.photos;
                    } else if (targetAct.foto_url) {
                        if (typeof targetAct.foto_url === 'string') {
                            try { taskPhotos = JSON.parse(targetAct.foto_url); } catch { taskPhotos = [targetAct.foto_url]; }
                        } else if (Array.isArray(targetAct.foto_url)) {
                            taskPhotos = targetAct.foto_url;
                        }
                    }

                    if (rawDesc.includes(photosMarker)) {
                        try {
                            const parts = rawDesc.split(photosMarker);
                            const jsonContent = parts[1].split(serviceMarker)[0].split(quoteMarker)[0].split(techMarker)[0].trim();
                            const parsedPhotos = JSON.parse(jsonContent);
                            if (Array.isArray(parsedPhotos) && parsedPhotos.length > 0) {
                                taskPhotos = parsedPhotos;
                            }
                        } catch (e) {
                            console.error("Error parsing |||PHOTOS_DATA||| in AdminReporte:", e);
                        }
                    }

                    // Extraer información del punto específico de revisión si aplica (7_1, 7_2, etc.)
                    if (hasPointIndex) {
                        let sData = null;
                        if (rawDesc.includes(serviceMarker)) {
                            try {
                                const parts = rawDesc.split(serviceMarker);
                                sData = JSON.parse(parts[1].split(quoteMarker)[0].split(techMarker)[0].split(photosMarker)[0].trim());
                            } catch (e) {}
                        }

                        if (sData?.items && Array.isArray(sData.items) && sData.items[pointIndex]) {
                            const item = sData.items[pointIndex];
                            const itemTipo = (item.tipo === 'Otro' ? item.customTipo : item.tipo) || targetAct.tipo || 'Servicio';
                            taskTitle = `${itemTipo} (Punto ${pointIndex + 1})`;
                            taskCleanDesc = item.descripcion || '';
                            if (taskPhotos[pointIndex]) {
                                taskPhotos = [taskPhotos[pointIndex]];
                            }
                            if (item.marca || item.modelo) {
                                setEquipoInfo({
                                    tipo: itemTipo,
                                    marca: item.marca || '',
                                    modelo: item.modelo || '',
                                    piezas: item.pieza || '',
                                    garantia: item.garantia || ''
                                });
                                setInvolucraEquipo(true);
                            }
                        } else {
                            const regexPoint = /(?:^|\n+)(\d+)\.\s*(?:\[([^\]]+)\]\s*)?([\s\S]*?)(?=(?:\n+\d+\.\s*)|$)/g;
                            const matches = Array.from(taskCleanDesc.matchAll(regexPoint)) as RegExpMatchArray[];
                            if (matches && matches[pointIndex]) {
                                const m = matches[pointIndex];
                                const ptTipo = m[2] ? m[2].trim() : targetAct.tipo;
                                taskTitle = `${ptTipo} (Punto ${pointIndex + 1})`;
                                taskCleanDesc = m[3] ? m[3].trim() : '';
                                if (taskPhotos[pointIndex]) {
                                    taskPhotos = [taskPhotos[pointIndex]];
                                }
                            }
                        }
                    }

                    if (targetAct.refacciones && targetAct.refacciones.length > 0) {
                        taskRefactions = targetAct.refacciones.map((r: any) => ({
                            pieza: r.pieza,
                            cantidad: Number(r.cantidad) || 1,
                            costo_estimado: String(r.costo_estimado || "")
                        }));
                    } else if (targetAct.quoteData?.conceptos || targetAct.quoteData?.materiales) {
                        if (targetAct.quoteData?.conceptos) {
                            targetAct.quoteData.conceptos.forEach((c: any) => {
                                taskRefactions.push({ pieza: c.descripcion, cantidad: Number(c.cantidad) || 1, costo_estimado: String(c.precio || "") });
                            });
                        }
                        if (targetAct.quoteData?.materiales) {
                            targetAct.quoteData.materiales.forEach((m: any) => {
                                taskRefactions.push({ pieza: m.nombre, cantidad: Number(m.cantidad) || 1, costo_estimado: String(m.precio || "") });
                            });
                        }
                    }
                } else {
                    // Fallback a primera actividad si existe
                    if (acts.length > 0) {
                        const firstAct = acts[0];
                        const rawDesc = firstAct.descripcion || "";
                        taskCleanDesc = rawDesc.split(serviceMarker)[0].split(photosMarker)[0].split(quoteMarker)[0].split(techMarker)[0].trim() || taskCleanDesc;
                    }
                }

                // Configurar tarjeta superior del cliente
                setTrabajoBase({
                    ...jobData,
                    titulo: taskTitle,
                    tipo: targetAct?.tipo || jobData.tipo,
                    descripcion: taskCleanDesc,
                    foto_url: taskPhotos
                });

                // Diagnóstico Inicial estrictamente con las notas de ESTA tarea
                setReporteTienda(taskCleanDesc);

                // 1.5 Descubrir equipos de la solicitud / sucursal
                const equipMap = new Map();
                const addEq = (eq: any) => {
                    if (!eq) return;
                    const key = eq.id ? String(eq.id) : (eq.nombre || eq.marca || JSON.stringify(eq));
                    if (!equipMap.has(key)) {
                        equipMap.set(key, {
                            id: eq.id || key,
                            nombre: eq.nombre || eq.marca || 'Equipo',
                            marca: eq.marca || eq.nombre || '',
                            modelo: eq.modelo || '',
                            serie: eq.serie || '',
                            area: eq.area || eq.levantamientoArea?.nombre || eq.levantamiento_area?.nombre || '',
                            foto: eq.foto || eq.foto_url || ''
                        });
                    }
                };

                if (jobData.levantamiento_equipo || jobData.levantamientoEquipo) {
                    addEq(jobData.levantamiento_equipo || jobData.levantamientoEquipo);
                }
                const jobSol = jobData.mantenimiento_solicitud_visita || jobData.mantenimientoSolicitudVisita || jobData.mantenimiento_solicitud_reparacion || jobData.mantenimientoSolicitudReparacion;
                if (jobSol?.levantamiento_equipo || jobSol?.levantamientoEquipo) {
                    addEq(jobSol.levantamiento_equipo || jobSol.levantamientoEquipo);
                }

                if (jobData.negocio_id) {
                    try {
                        const negRes = await getNegocio(jobData.negocio_id);
                        const negData = negRes?.data || negRes;
                        const lev = negData?.levantamiento || (Array.isArray(negData?.levantamientos) ? negData.levantamientos[0] : null);
                        if (lev?.sections && Array.isArray(lev.sections)) {
                            lev.sections.forEach((sec: any) => {
                                if (sec.subAreas && Array.isArray(sec.subAreas)) {
                                    sec.subAreas.forEach((sub: any) => {
                                        if (sub.equipos && Array.isArray(sub.equipos)) {
                                            sub.equipos.forEach((eq: any) => addEq({ ...eq, area: `${sec.nombreArea || ''} - ${sub.nombreSubArea || ''}`.trim() }));
                                        }
                                    });
                                }
                                if (sec.equipos && Array.isArray(sec.equipos)) {
                                    sec.equipos.forEach((eq: any) => addEq({ ...eq, area: sec.nombreArea || '' }));
                                }
                            });
                        }
                    } catch (e) {
                        console.warn("Error fetching negocio equipments:", e);
                    }
                }

                if (equipMap.size === 0 && jobData.descripcion && typeof jobData.descripcion === 'string' && jobData.descripcion.includes('[Equipo:')) {
                    const match = jobData.descripcion.match(/\[Equipo:\s*(.+?)\]/);
                    if (match && match[1]) {
                        addEq({ id: 'desc_eq', nombre: match[1].trim(), marca: match[1].trim(), modelo: '' });
                    }
                }
                if (equipMap.size === 0 && jobData.titulo) {
                    const tMatch = jobData.titulo.match(/Mantenimiento\s*(?:\([^)]+\))?:\s*([^(]+)/i);
                    if (tMatch && tMatch[1]) {
                        addEq({ id: 'title_eq', nombre: tMatch[1].trim(), marca: tMatch[1].trim(), modelo: '' });
                    }
                }

                const listEquips = Array.from(equipMap.values());
                setAvailableEquipos(listEquips);

                // 2. Cargar el borrador / reporte guardado de ESTA tarea específica
                const subParam = subtareaIdParam ? String(subtareaIdParam) : null;
                const pIdx = hasPointIndex ? pointIndex + 1 : (subParam && subParam.includes('_') ? parseInt(subParam.split('_')[1], 10) : undefined);

                const checkKeys: string[] = [];
                if (subParam) checkKeys.push(subParam);
                if (subParam && safeId) checkKeys.push(`${safeId}_${subParam}`);
                if (safeId && pIdx !== undefined) checkKeys.push(`${safeId}_${pIdx}`);
                if (!subParam && safeId) checkKeys.push(String(safeId));

                let temporalData: string | null = null;
                for (const k of checkKeys) {
                    const raw = localStorage.getItem(`report_data_${k}`) || localStorage.getItem(`report_data_temporal_${k}`);
                    if (raw) {
                        try {
                            const parsed = JSON.parse(raw);
                            if (parsed && (parsed.isExecutionReport || parsed.isReportFinalizado || parsed.descripcion || parsed.imagenes)) {
                                // Evitar cargar borradores temporales que pertenecían a otra subtarea o punto anterior
                                if (subParam && parsed.subtareaId && parsed.subtareaId !== subParam && parsed.subtareaId !== `${safeId}_${pIdx}` && parsed.subtareaId !== `${targetAct?.id}_${pIdx}`) {
                                    continue;
                                }
                                temporalData = raw;
                                break;
                            }
                        } catch (_) {}
                    }
                }
                
                let isExplicitTaskDraft = !!temporalData;

                if (!temporalData) {
                    try {
                        const existingDb = await getReporteByTrabajoId(Number(safeId));
                        if (existingDb && (existingDb.solucion || existingDb.descripcion)) {
                            let parsedDb = null;
                            if (existingDb.solucion) {
                                parsedDb = typeof existingDb.solucion === 'string' ? JSON.parse(existingDb.solucion) : existingDb.solucion;
                            }
                            const matched = findMatchingSubReport(parsedDb, { 
                                id: subParam || safeId, 
                                pointIndex: pIdx, 
                                trabajoId: safeId,
                                baseId: targetAct?.id,
                                titulo: taskTitle 
                            });

                            if (matched && !matched.isVisita) {
                                temporalData = JSON.stringify(matched);
                                isExplicitTaskDraft = true;
                            } else if (!subParam && existingDb.descripcion && !existingDb.descripcion.startsWith('Reporte de Tarea:') && existingDb.descripcion !== 'Reporte generado') {
                                setDescripcion(existingDb.descripcion);
                            }
                        }
                    } catch (_) {}
                }

                if (temporalData && isExplicitTaskDraft) {
                    try {
                        const parsed = JSON.parse(temporalData);
                        if (parsed.fechaInicio) initFechaInicio = parsed.fechaInicio;
                        setReporteTienda(parsed.reporteTienda || taskCleanDesc);
                        setDescripcion(parsed.descripcion || '');
                        setMateriales(parsed.materiales || '');

                        setImagenes({
                            antes: parsed.imagenes?.antes || null,
                            durante: parsed.imagenes?.durante || null,
                            despues: parsed.imagenes?.despues || null
                        });

                        let loadedObsList: { id: string; texto: string; imagenes: string[] }[] = [];
                        if (parsed.observacionesList && Array.isArray(parsed.observacionesList)) {
                            loadedObsList = parsed.observacionesList;
                        } else if (parsed.observaciones || parsed.imagenObservacion || (parsed.imagenesObservacion && parsed.imagenesObservacion.length > 0)) {
                            loadedObsList = [{
                                id: Date.now().toString(),
                                texto: parsed.observaciones || '',
                                imagenes: parsed.imagenesObservacion || (parsed.imagenObservacion ? [parsed.imagenObservacion] : [])
                            }];
                        }
                        setObservacionesList(loadedObsList);
                        if (loadedObsList.length > 0) setShowObservacionesInput(true);

                        setFirmaEmpresa(parsed.firmaEmpresa || null);
                        setInvolucraEquipo(parsed.involucraEquipo !== undefined ? parsed.involucraEquipo : false);
                        if (parsed.equipoInfo) {
                            setEquipoInfo({
                                tipo: parsed.equipoInfo.tipo || 'Instalación',
                                marca: parsed.equipoInfo.marca || '',
                                modelo: parsed.equipoInfo.modelo || '',
                                piezas: parsed.equipoInfo.piezas || '',
                                garantia: parsed.equipoInfo.garantia || ''
                            });
                        }
                        if (parsed.selectedEquipoIds && Array.isArray(parsed.selectedEquipoIds)) {
                            setSelectedEquipoIds(parsed.selectedEquipoIds);
                        } else if (parsed.equipoInfo?.marca || parsed.equipoInfo?.modelo) {
                            const matching = listEquips.filter(eq => 
                                (eq.marca && parsed.equipoInfo.marca.includes(eq.marca)) || 
                                (eq.nombre && parsed.equipoInfo.marca.includes(eq.nombre))
                            );
                            if (matching.length > 0) {
                                setSelectedEquipoIds(matching.map(m => m.id));
                            }
                        }
                        setRefaccionesList(parsed.refaccionesList && parsed.refaccionesList.length > 0 ? parsed.refaccionesList : taskRefactions);
                    } catch (err) {
                        console.error("Error al parsear el reporte local de la tarea:", err);
                        setDescripcion('');
                        setMateriales('');
                        setImagenes({ antes: null, durante: null, despues: null });
                        setObservacionesList([]);
                        setFirmaEmpresa(null);
                        setRefaccionesList(taskRefactions);
                    }
                } else {
                    // Formulario completamente NUEVO y EN BLANCO para esta tarea individual
                    setReporteTienda(taskCleanDesc);
                    setDescripcion('');
                    setMateriales('');
                    setImagenes({ antes: null, durante: null, despues: null });
                    setObservacionesList([]);
                    setFirmaEmpresa(null);
                    setRefaccionesList(taskRefactions);

                    // Auto-selección inicial si hay equipos disponibles y es mantenimiento
                    const isMaintenanceJob = String(jobData.titulo || '').toLowerCase().includes('mantenimiento') || 
                                             String(targetAct?.tipo || '').toLowerCase().includes('mantenimiento') || 
                                             targetAct?.tipo === 'Instalacion' || 
                                             targetAct?.tipo === 'Instalación';
                    if (listEquips.length > 0 && isMaintenanceJob) {
                        const firstEq = listEquips[0];
                        setSelectedEquipoIds([firstEq.id]);
                        setEquipoInfo({
                            tipo: 'Mantenimiento',
                            marca: firstEq.marca || firstEq.nombre || '',
                            modelo: firstEq.modelo || '',
                            piezas: '',
                            garantia: ''
                        });
                        setInvolucraEquipo(true);
                    } else {
                        setInvolucraEquipo(false);
                    }
                }
            } catch (err) {
                console.error("Error al obtener datos de la tarea para el reporte:", err);
            }

            if (!initFechaInicio) {
                initFechaInicio = new Date().toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
            }
            setFechaInicio(initFechaInicio);
            setIsDataLoaded(true);
        };

        loadReportData();
    }, [id, trabajoId, location.search, location.state]);

    // Auto-guardado en tiempo real (debounced) para que ningún dato se pierda al salir o recargar
    React.useEffect(() => {
        if (!isDataLoaded) return;
        const safeId = trabajoId || id;
        if (!safeId) return;

        const queryParams = new URLSearchParams(location.search);
        const subtareaIdParam = queryParams.get('subtareaId') || location.state?.subtareaId || location.state?.actividadId;
        const subParam = subtareaIdParam ? String(subtareaIdParam) : null;
        const pIdx = subParam && subParam.includes('_') ? parseInt(subParam.split('_')[1], 10) : undefined;

        const timer = setTimeout(() => {
            const filteredObsList = observacionesList.filter(o => o.texto.trim() || o.imagenes.length > 0);
            const compiledObservaciones = filteredObsList.map(o => o.texto).filter(Boolean).join('\n\n');

            const draftData = {
                id,
                subtareaId: subParam || String(safeId),
                reporteTienda,
                descripcion,
                materiales,
                refaccionesList,
                observaciones: compiledObservaciones,
                imagenes,
                observacionesList: filteredObsList,
                firmaEmpresa,
                involucraEquipo,
                selectedEquipoIds,
                equipoInfo: involucraEquipo ? equipoInfo : null,
                fecha: new Date().toLocaleDateString('es-MX'),
                tecnicoNombre: trabajoBase?.trabajador?.nombre || user?.name || trabajoBase?.tecnico || 'Técnico',
                tecnicoAvatar: user?.avatar || null,
                fechaInicio: fechaInicio || new Date().toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
                isVisita: trabajoBase?.tipo === 'Visita' || trabajoBase?.originalTipo === 'Visita',
                isExecutionReport: true
            };

            const jsonStr = JSON.stringify(draftData);
            if (subParam) {
                safeLocalStorageSet(`report_data_temporal_${subParam}`, jsonStr);
                safeLocalStorageSet(`report_data_temporal_${safeId}_${subParam}`, jsonStr);
            }
            if (safeId && pIdx !== undefined) {
                safeLocalStorageSet(`report_data_temporal_${safeId}_${pIdx}`, jsonStr);
            }
            if (!subParam && safeId) {
                safeLocalStorageSet(`report_data_temporal_${safeId}`, jsonStr);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [
        isDataLoaded,
        reporteTienda,
        descripcion,
        materiales,
        refaccionesList,
        imagenes,
        observacionesList,
        firmaEmpresa,
        involucraEquipo,
        equipoInfo,
        fechaInicio,
        id,
        trabajoId,
        location.search,
        location.state
    ]);

    const handleEquipoInfoChange = (field: string, value: string) => {
        setEquipoInfo(prev => ({ ...prev, [field]: value }));
    };

    const handleToggleSelectEquipo = (eq: any) => {
        setSelectedEquipoIds(prev => {
            const exists = prev.some(id => String(id) === String(eq.id));
            const next = exists 
                ? prev.filter(id => String(id) !== String(eq.id))
                : [...prev, eq.id];
            
            const selectedObjects = availableEquipos.filter(item => next.some(id => String(id) === String(item.id)));
            
            if (selectedObjects.length > 0) {
                const combinedMarcas = selectedObjects.map(o => o.marca || o.nombre).filter(Boolean).join(', ');
                const combinedModelos = selectedObjects.map(o => o.modelo).filter(Boolean).join(', ');
                setEquipoInfo(current => ({
                    ...current,
                    tipo: 'Mantenimiento',
                    marca: combinedMarcas,
                    modelo: combinedModelos
                }));
                setInvolucraEquipo(true);
            } else {
                setEquipoInfo(current => ({
                    ...current,
                    marca: '',
                    modelo: ''
                }));
            }

            return next;
        });
    };

    const antesInputRef = useRef<HTMLInputElement>(null);
    const duranteInputRef = useRef<HTMLInputElement>(null);
    const despuesInputRef = useRef<HTMLInputElement>(null);
    const observacionInputRef = useRef<HTMLInputElement>(null);
    const firmaInputRef = useRef<HTMLInputElement>(null);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'antes' | 'durante' | 'despues') => {
        const file = e.target.files?.[0];
        if (file) {
            compressImage(file, (base64) => {
                setImagenes(prev => ({ ...prev, [type]: base64 }));
            });
        }
    };

    const addObservacionBlock = () => {
        setObservacionesList(prev => [...prev, { id: Date.now().toString() + '-' + Math.random().toString(), texto: '', imagenes: [] }]);
    };

    const removeObservacionBlock = (id: string) => {
        setObservacionesList(prev => prev.filter(o => o.id !== id));
    };

    const handleObservacionTextChange = (id: string, text: string) => {
        setObservacionesList(prev => prev.map(o => o.id === id ? { ...o, texto: text } : o));
    };

    const triggerObservacionImageUpload = (id: string) => {
        setActiveUploadBlockId(id);
        observacionInputRef.current?.click();
    };

    const handleImagenObservacionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && activeUploadBlockId) {
            Array.from(files).forEach((file) => {
                compressImage(file, (base64) => {
                    setObservacionesList(prev => prev.map(o => o.id === activeUploadBlockId ? { ...o, imagenes: [...o.imagenes, base64] } : o));
                });
            });
        }
        e.target.value = '';
    };

    const removeObservacionBlockImage = (blockId: string, imageIndex: number) => {
        setObservacionesList(prev => prev.map(o => o.id === blockId ? { ...o, imagenes: o.imagenes.filter((_, idx) => idx !== imageIndex) } : o));
    };

    const handleFirmaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.type === "application/pdf") {
                if (file.size > 35 * 1024 * 1024) {
                    showAlert("Archivo muy pesado", "El archivo PDF no debe superar los 35MB.", "warning");
                    return;
                }
                const reader = new FileReader();
                reader.onload = (ev) => {
                    setFirmaEmpresa(ev.target?.result as string);
                };
                reader.readAsDataURL(file);
            } else {
                compressImage(file, (base64) => {
                    setFirmaEmpresa(base64);
                }, 500, 300, 0.5);
            }
        }
    };

    const removeImage = (type: 'antes' | 'durante' | 'despues') => {
        setImagenes(prev => ({ ...prev, [type]: null }));
    };

    const removeFirma = () => {
        setFirmaEmpresa(null);
    };

    const handleGuardarInformacion = async (showSuccessAlert = true) => {
        const safeId = trabajoId || id;
        if (!safeId) {
            showAlert("Error", "No se encontró el ID del trabajo asociado.", "error");
            return;
        }

        const queryParams = new URLSearchParams(location.search);
        const subtareaIdParam = queryParams.get('subtareaId') || location.state?.subtareaId || location.state?.actividadId;
        const subParam = subtareaIdParam ? String(subtareaIdParam) : null;
        const pIdx = subParam && subParam.includes('_') ? parseInt(subParam.split('_')[1], 10) : undefined;
        const activeStorageKey = subParam ? String(subParam) : String(safeId);

        const filteredObsList = observacionesList.filter(o => o.texto.trim() || o.imagenes.length > 0);
        const compiledObservaciones = filteredObsList.map(o => o.texto).filter(Boolean).join('\n\n');
        const compiledImagenesObservacion = filteredObsList.reduce((acc, o) => [...acc, ...o.imagenes], [] as string[]);

        const reportData = {
            id,
            subtareaId: subParam || String(safeId),
            reporteTienda,
            descripcion,
            materiales,
            refaccionesList,
            observaciones: compiledObservaciones,
            imagenes,
            imagenObservacion: compiledImagenesObservacion[0] || null,
            imagenesObservacion: compiledImagenesObservacion,
            observacionesList: filteredObsList,
            firmaEmpresa,
            involucraEquipo,
            selectedEquipoIds,
            equipoInfo: involucraEquipo ? equipoInfo : null,
            fecha: new Date().toLocaleDateString('es-MX'),
            tecnicoNombre: trabajoBase?.trabajador?.nombre || user?.name || trabajoBase?.tecnico || 'Técnico',
            tecnicoAvatar: user?.avatar || null,
            fechaInicio: fechaInicio || new Date().toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
            isVisita: trabajoBase?.tipo === 'Visita' || trabajoBase?.originalTipo === 'Visita',
            isExecutionReport: true
        };

        const jsonStr = JSON.stringify(reportData);
        if (subParam) {
            safeLocalStorageSet(`report_data_${subParam}`, jsonStr);
            safeLocalStorageSet(`report_data_${safeId}_${subParam}`, jsonStr);
        }
        if (safeId && pIdx !== undefined) {
            safeLocalStorageSet(`report_data_${safeId}_${pIdx}`, jsonStr);
        }
        if (!subParam && safeId) {
            safeLocalStorageSet(`report_data_${safeId}`, jsonStr);
        }

        try {
            // Recopilar reportes existentes para no sobreescribir los otros puntos de la actividad/trabajo
            const cleanSubReports: Record<string, any> = {};
            try {
                const existingDbReport = await getReporteByTrabajoId(Number(safeId));
                if (existingDbReport && existingDbReport.solucion) {
                    const parsedExisting = typeof existingDbReport.solucion === 'string' ? JSON.parse(existingDbReport.solucion) : existingDbReport.solucion;
                    if (parsedExisting?.subReports && typeof parsedExisting.subReports === 'object') {
                        Object.entries(parsedExisting.subReports).forEach(([k, v]) => {
                            if (k !== 'undefined' && k !== 'null') {
                                cleanSubReports[k] = v;
                            }
                        });
                    }
                }
            } catch (_) {}

            // Sub-reporte limpio sin duplicar firma pesada innecesariamente
            const subReportEntry = {
                ...reportData,
                firmaEmpresa: undefined
            };

            if (subParam) {
                cleanSubReports[subParam] = subReportEntry;
            }
            if (safeId && pIdx !== undefined) {
                cleanSubReports[`${safeId}_${pIdx}`] = subReportEntry;
            }
            cleanSubReports[activeStorageKey] = subReportEntry;

            const dataToSave = {
                trabajo_id: Number(safeId),
                descripcion: descripcion || "Reporte generado",
                solucion: JSON.stringify({
                    ...reportData,
                    subReports: cleanSubReports
                }) 
            };
            await createReporte(dataToSave);
            if (showSuccessAlert) {
                showAlert("Éxito", "Información guardada en Base de Datos exitosamente.", "success");
            }
        } catch (error) {
            console.error(error);
            showAlert("Error", "Hubo un error al guardar en la Base de Datos.", "error");
        }
    };

    const handleGuardarYPrevisualizar = async () => {
        await handleGuardarInformacion(false);
        setShowReportePreview(true);
    };

    const handleOpenConfirm = () => {
        if (!reporteTienda || !descripcion || !firmaEmpresa) {
            showAlert("Campos Incompletos", "Por favor completa los campos principales y asegúrate de agregar la foto de la firma de la empresa.", "warning");
            return;
        }
        
        showConfirm(
            "Guardar Reporte de Tarea",
            "¿Deseas guardar el reporte de esta tarea? Volverás a la pantalla del trabajo para continuar con las demás tareas pendientes.",
            () => handleSave(),
            () => {},
            "Guardar y Volver",
            "Cancelar"
        );
    };

    const handleSave = async () => {
        const safeTrabajoId = trabajoId || id;
        if (!safeTrabajoId) return;

        const queryParams = new URLSearchParams(location.search);
        const subtareaIdParam = queryParams.get('subtareaId') || location.state?.subtareaId || location.state?.actividadId;
        const subParam = subtareaIdParam ? String(subtareaIdParam) : null;
        const pIdx = subParam && subParam.includes('_') ? parseInt(subParam.split('_')[1], 10) : undefined;
        const activeStorageKey = subParam ? String(subParam) : String(safeTrabajoId);
        const parsedActId = subParam ? parseInt(subParam.split('_')[0], 10) : undefined;

        const filteredObsList = observacionesList.filter(o => o.texto.trim() || o.imagenes.length > 0);
        const compiledObservaciones = filteredObsList.map(o => o.texto).filter(Boolean).join('\n\n');
        const compiledImagenesObservacion = filteredObsList.reduce((acc, o) => [...acc, ...o.imagenes], [] as string[]);

        const reportData = {
            id,
            subtareaId: subParam || String(safeTrabajoId),
            reporteTienda,
            descripcion,
            materiales,
            refaccionesList,
            observaciones: compiledObservaciones,
            imagenes,
            imagenObservacion: compiledImagenesObservacion[0] || null,
            imagenesObservacion: compiledImagenesObservacion,
            observacionesList: filteredObsList,
            firmaEmpresa,
            involucraEquipo,
            equipoInfo: involucraEquipo ? equipoInfo : null,
            fecha: new Date().toLocaleDateString('es-MX'),
            tecnicoNombre: trabajoBase?.trabajador?.nombre || user?.name || trabajoBase?.tecnico || 'Técnico',
            tecnicoAvatar: user?.avatar || null,
            fechaInicio: fechaInicio || new Date().toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
            isVisita: trabajoBase?.tipo === 'Visita' || trabajoBase?.originalTipo === 'Visita',
            isExecutionReport: true,
            isReportFinalizado: true
        };

        setIsSavingReport(true);
        const jsonStr = JSON.stringify(reportData);
        if (subParam) {
            safeLocalStorageSet(`report_data_${subParam}`, jsonStr);
            safeLocalStorageSet(`report_data_${safeTrabajoId}_${subParam}`, jsonStr);
            localStorage.setItem(`tarea_finalizada_${subParam}`, 'true');
            localStorage.setItem(`tarea_finalizada_${safeTrabajoId}_${subParam}`, 'true');
            localStorage.removeItem(`report_data_temporal_${subParam}`);
            localStorage.removeItem(`report_data_temporal_${safeTrabajoId}_${subParam}`);
        }
        if (safeTrabajoId && pIdx !== undefined) {
            safeLocalStorageSet(`report_data_${safeTrabajoId}_${pIdx}`, jsonStr);
            localStorage.setItem(`tarea_finalizada_${safeTrabajoId}_${pIdx}`, 'true');
            localStorage.removeItem(`report_data_temporal_${safeTrabajoId}_${pIdx}`);
        }
        if (!subParam && safeTrabajoId) {
            safeLocalStorageSet(`report_data_${safeTrabajoId}`, jsonStr);
            localStorage.setItem(`tarea_finalizada_${safeTrabajoId}`, 'true');
            localStorage.removeItem(`report_data_temporal_${safeTrabajoId}`);
        }

        // Guardar registro del reporte en la BD (acumulando todos los sub-puntos sin duplicados masivos)
        try {
            const cleanSubReports: Record<string, any> = {};
            try {
                const existingDbReport = await getReporteByTrabajoId(Number(safeTrabajoId));
                if (existingDbReport && existingDbReport.solucion) {
                    const parsedExisting = typeof existingDbReport.solucion === 'string' ? JSON.parse(existingDbReport.solucion) : existingDbReport.solucion;
                    if (parsedExisting?.subReports && typeof parsedExisting.subReports === 'object') {
                        Object.entries(parsedExisting.subReports).forEach(([k, v]) => {
                            if (k !== 'undefined' && k !== 'null') {
                                cleanSubReports[k] = v;
                            }
                        });
                    }
                }
            } catch (_) {}

            const subReportEntry = {
                ...reportData,
                firmaEmpresa: undefined
            };

            if (subParam) {
                cleanSubReports[subParam] = subReportEntry;
            }
            if (safeTrabajoId && pIdx !== undefined) {
                cleanSubReports[`${safeTrabajoId}_${pIdx}`] = subReportEntry;
            }
            cleanSubReports[activeStorageKey] = subReportEntry;

            const dataToSave = {
                trabajo_id: Number(safeTrabajoId),
                actividad_id: (parsedActId && !isNaN(parsedActId)) ? parsedActId : undefined,
                descripcion: `Reporte de Tarea: ${trabajoBase?.titulo || 'Servicio'}`,
                solucion: JSON.stringify({
                    ...reportData,
                    subReports: cleanSubReports
                }) 
            };
            await createReporte(dataToSave);
        } catch (error) {
            console.error("Error al sincronizar reporte en BD:", error);
        }

        // Sincronizar Notificaciones para Admin y Cliente sobre este reporte individual enviado
        try {
            const jobData = await getTrabajo(Number(safeTrabajoId));
            const acts = await getActividadesByTrabajo(Number(safeTrabajoId));
            const totalTasks = acts.length || 1;
            
            let completedCount = 0;
            acts.forEach((a: any) => {
                if (String(a.id) === String(activeStorageKey) || a.estado === 'Completa' || !!localStorage.getItem(`report_data_${a.id}`)) {
                    completedCount++;
                }
            });

            const taskTitle = trabajoBase?.titulo || 'Servicio';
            const progressText = `(${completedCount}/${totalTasks})`;

            await createNotificacionByRole({
                role: 'admin',
                titulo: `Reporte de Tarea Recibido ${progressText}`,
                mensaje: `El técnico ha enviado el reporte para la tarea "${taskTitle}" del Trabajo #${safeTrabajoId}.`,
                enlace: `/menu/trabajo-detalle/${safeTrabajoId}`
            });

            const clienteUserId = jobData?.negocio?.user_id;
            if (clienteUserId) {
                await createNotificacion({
                    user_id: clienteUserId,
                    titulo: `Avance de Reporte Recibido ${progressText} ✅`,
                    mensaje: `Se ha completado y enviado el reporte para "${taskTitle}" en tu sucursal.`,
                    enlace: `/cliente/historial`
                });
            }
            
            showAlert("Éxito", `Reporte de "${taskTitle}" enviado exitosamente al Administrador y Cliente ${progressText}.`, "success");
        } catch (notiErr) {
            console.error("Error al enviar notificaciones de reporte de tarea:", notiErr);
            showAlert("Éxito", "Reporte de la tarea guardado exitosamente.", "success");
        }

        const getBasePath = () => {
            if (user?.role === 'tecnico' || user?.role === 'tecnico-normal') return '/tecnico';
            if (user?.role === 'tecnico-autonomo') return '/tecnico-autonomo';
            if (isAutonomoAdmin(user?.role) || user?.role === 'autonomo') return '/autonomo';
            return '/menu';
        };
        const basePath = getBasePath();
        const targetPath = `${basePath}/trabajo-detalle/${safeTrabajoId}?tab=trabajo`;
        navigate(targetPath, { replace: true });
    };

    const cleanGroupTags = (str: string): string => {
        if (!str) return '';
        return str.replace(/^[*-\s]*\[Grupo:\s*[^\]]+\]\s*/gi, '').replace(/\*+$/g, '').trim();
    };

    return (
        <div className={styles.dashboardLayout} style={{ gap: '0', padding: '20px', height: '100%' }}>

            <input type="file" ref={antesInputRef} style={{ display: 'none' }} onChange={(e) => handleImageChange(e, 'antes')} accept="image/*" capture="environment" />
            <input type="file" ref={duranteInputRef} style={{ display: 'none' }} onChange={(e) => handleImageChange(e, 'durante')} accept="image/*" capture="environment" />
            <input type="file" ref={despuesInputRef} style={{ display: 'none' }} onChange={(e) => handleImageChange(e, 'despues')} accept="image/*" capture="environment" />
            <input type="file" ref={observacionInputRef} style={{ display: 'none' }} onChange={handleImagenObservacionChange} accept="image/*" multiple />
            <input type="file" ref={firmaInputRef} style={{ display: 'none' }} onChange={handleFirmaChange} accept="image/*,application/pdf" />

            <div className={styles.mainCard}>
                <div className={styles.bgShape1}></div>
                <div className={styles.bgShape2}></div>

                <div className={styles.contentWrapper}>
                    <div className={styles.scrollableContent}>
                        
                        {/* HEADER DE NAVEGACIÓN Y TITULO */}
                        <div className={styles.header} style={{ alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <button
                                    onClick={() => {
                                        const basePath = (user?.role === 'tecnico' || user?.role === 'tecnico-normal') ? '/tecnico' : (user?.role === 'tecnico-autonomo' ? '/tecnico-autonomo' : ((isAutonomoAdmin(user?.role) || user?.role === 'autonomo') ? '/autonomo' : '/menu'));
                                        const targetPath = `${basePath}/trabajo-detalle/${trabajoId || id}?tab=trabajo`;
                                        navigate(targetPath);
                                    }}
                                    style={{
                                        background: '#ffffff',
                                        border: '1.5px solid #cbd5e1',
                                        borderRadius: '12px',
                                        padding: '9px 16px',
                                        fontSize: '13px',
                                        fontWeight: '800',
                                        color: '#334155',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    ← Volver al Trabajo
                                </button>
                                <div>
                                    <h1 className={styles.pageTitle}>Reporte de Servicio Técnico</h1>
                                    <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b', fontWeight: '600' }}>
                                        Completa el diagnóstico, trabajo realizado y evidencia fotográfica
                                    </p>
                                </div>
                            </div>

                            <div className={styles.metaInfo}>
                                <div className={styles.folioBadge}>
                                    FOLIO: {reporteId ? `REP-${reporteId.toString().padStart(5, '0')}` : `TRB-${(trabajoId || id || '').toString().padStart(5, '0')}`}
                                </div>
                                <div className={styles.metaValue}>Fecha: {new Date().toLocaleDateString('es-MX')}</div>
                            </div>
                        </div>

                        {/* 1. INFORMACIÓN DE LA SOLICITUD DEL CLIENTE (ANCHO COMPLETO SUPERIOR) */}
                        {trabajoBase && (
                            <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 18px rgba(0,0,0,0.03)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1.5px solid #f1f5f9', paddingBottom: '12px' }}>
                                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '22px' }}>📋</span> Información de la Solicitud del Cliente
                                    </h3>
                                    <span style={{ background: '#f8fafc', color: '#64748b', fontSize: '12px', fontWeight: '800', padding: '4px 12px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                                        {trabajoBase.sucursal || 'Sucursal'}
                                    </span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>Servicio Solicitado</span>
                                        <span style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b' }}>{trabajoBase.titulo || trabajoBase.tipo || 'Servicio Técnico'}</span>
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>Técnico Asignado</span>
                                        <span style={{ fontSize: '15px', fontWeight: '800', color: '#f26522' }}>{trabajoBase.trabajador?.nombre || trabajoBase.tecnico || user?.name || 'Sin Asignar'}</span>
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>Detalles / Notas del Cliente</span>
                                        <p style={{ fontSize: '13px', color: '#475569', margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                                            "{cleanGroupTags(trabajoBase.descripcion) || 'Sin descripción adicional.'}"
                                        </p>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', borderTop: '1px dashed #e2e8f0', marginTop: '18px', paddingTop: '18px' }}>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>Ubicación / Dirección</span>
                                        <span style={{ fontSize: '13px', fontWeight: '800', color: '#334155', display: 'block' }}>
                                            {trabajoBase.negocio?.nombrePlaza || trabajoBase.negocio?.nombre_plaza ? `Plaza: ${trabajoBase.negocio.nombrePlaza || trabajoBase.negocio.nombre_plaza}` : ''}
                                        </span>
                                        <span style={{ fontSize: '13px', color: '#475569', display: 'block', marginTop: '2px' }}>
                                            {[
                                                trabajoBase.negocio?.calle && `Calle ${trabajoBase.negocio.calle}`,
                                                trabajoBase.negocio?.numero && `#${trabajoBase.negocio.numero}`,
                                                trabajoBase.negocio?.colonia && `Col. ${trabajoBase.negocio.colonia}`,
                                                trabajoBase.negocio?.ciudad && trabajoBase.negocio.ciudad,
                                                trabajoBase.negocio?.cp && `C.P. ${trabajoBase.negocio.cp}`
                                            ].filter(Boolean).join(', ') || 'Dirección registrada en sistema'}
                                        </span>
                                        {trabajoBase.negocio?.referencias && (
                                            <span style={{ display: 'inline-block', fontSize: '11px', color: '#059669', background: '#ecfdf5', padding: '4px 8px', borderRadius: '6px', marginTop: '6px', border: '1px solid #d1fae5', fontWeight: '600' }}>
                                                <strong>Ref:</strong> {trabajoBase.negocio.referencias}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>Contactos de la Empresa</span>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                                            <div>
                                                <strong>Gerente:</strong> {trabajoBase.negocio?.encargado || 'No registrado'}
                                                {trabajoBase.negocio?.telefono && (
                                                    <span style={{ color: '#f26522', display: 'block', fontWeight: '700' }}>📞 {trabajoBase.negocio.telefono}</span>
                                                )}
                                            </div>
                                            {trabajoBase.negocio?.subgerente && (
                                                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '4px' }}>
                                                    <strong>Subgerente:</strong> {trabajoBase.negocio.subgerente}
                                                    {trabajoBase.negocio.telefonoSubgerente && (
                                                        <span style={{ color: '#f26522', display: 'block', fontWeight: '700' }}>📞 {trabajoBase.negocio.telefonoSubgerente}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>Fotos Adjuntas por el Cliente</span>
                                        {parseFotoUrls(trabajoBase.foto_url).length > 0 ? (
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                {parseFotoUrls(trabajoBase.foto_url).map((url, idx) => (
                                                    <img 
                                                        key={idx}
                                                        src={url} 
                                                        alt={`Evidencia Cliente ${idx + 1}`} 
                                                        onClick={() => setSelectedZoomImage(url)}
                                                        style={{ width: '54px', height: '54px', objectFit: 'cover', borderRadius: '10px', border: '1.5px solid #cbd5e1', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', cursor: 'pointer', transition: 'transform 0.15s ease' }} 
                                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.06)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <span style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>Sin fotos adjuntas.</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 2. GRID PRINCIPAL (COLUMNAS BALANCEADAS PARA FORMULARIO Y MATERIALES) */}
                        <div className={styles.mainGrid}>
                            
                            {/* COLUMNA IZQUIERDA: DIAGNÓSTICO Y DESCRIPCIÓN DEL TRABAJO */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                
                                {/* Card Diagnóstico Inicial */}
                                <div className={styles.infoSectionCard}>
                                    <h3 className={styles.sectionTitle}>📝 Diagnóstico / Reporte Inicial</h3>
                                    <div className={styles.inputGroup} style={{ marginBottom: 0 }}>
                                        <label className={styles.label}>Reporte de tienda / Diagnóstico registrado:</label>
                                        <textarea
                                            className={styles.textarea}
                                            value={cleanGroupTags(reporteTienda) || reporteTienda}
                                            readOnly={true}
                                            style={{ backgroundColor: '#f8fafc', color: '#475569', cursor: 'not-allowed', height: '100px', fontWeight: '500' }}
                                            placeholder="Sin diagnóstico inicial registrado."
                                        />
                                    </div>
                                </div>

                                {/* Card Descripción del Trabajo */}
                                <div className={styles.infoSectionCard}>
                                    <h3 className={styles.sectionTitle}>🛠️ Descripción del Trabajo Realizado</h3>
                                    <div className={styles.inputGroup} style={{ marginBottom: 0 }}>
                                        <label className={styles.label}>Detalles de la reparación o servicio técnico:</label>
                                        <textarea
                                            className={styles.textarea}
                                            style={{ height: '180px' }}
                                            value={descripcion}
                                            onChange={(e) => setDescripcion(e.target.value)}
                                            placeholder="Describe detalladamente las acciones realizadas, correcciones aplicadas y soluciones implementadas..."
                                        />
                                    </div>
                                </div>

                            </div>

                            {/* COLUMNA DERECHA: EQUIPOS INVOLUCRADOS Y MATERIALES/REFACCIONES */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                
                                {/* Card Equipos Involucrados */}
                                <div className={styles.infoSectionCard}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '2px solid #f0f0f0', paddingBottom: '10px' }}>
                                        <h3 className={styles.sectionTitle} style={{ margin: 0, border: 'none', padding: 0 }}>⚡ Equipos Involucrados</h3>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '800', color: '#1e293b' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={involucraEquipo} 
                                                onChange={(e) => setInvolucraEquipo(e.target.checked)} 
                                                style={{ width: '18px', height: '18px', accentColor: '#f26522', cursor: 'pointer' }}
                                            />
                                            Registrar / Vincular equipo
                                        </label>
                                    </div>

                                    {involucraEquipo ? (
                                        <div style={{ marginTop: '5px' }}>
                                            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                                                <button 
                                                    type="button"
                                                    onClick={() => handleEquipoInfoChange('tipo', 'Instalación')}
                                                    style={{ 
                                                        flex: 1, padding: '9px', borderRadius: '10px', fontWeight: '800', border: 'none', fontSize: '13px', cursor: 'pointer',
                                                        background: equipoInfo.tipo === 'Instalación' ? '#1e293b' : '#f1f5f9',
                                                        color: equipoInfo.tipo === 'Instalación' ? 'white' : '#64748b'
                                                    }}
                                                >
                                                    Instalación
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => handleEquipoInfoChange('tipo', 'Mantenimiento')}
                                                    style={{ 
                                                        flex: 1, padding: '9px', borderRadius: '10px', fontWeight: '800', border: 'none', fontSize: '13px', cursor: 'pointer',
                                                        background: equipoInfo.tipo === 'Mantenimiento' ? '#1e293b' : '#f1f5f9',
                                                        color: equipoInfo.tipo === 'Mantenimiento' ? 'white' : '#64748b'
                                                    }}
                                                >
                                                    Mantenimiento
                                                </button>
                                            </div>

                                            {/* SELECTOR INTERACTIVO DE EQUIPOS DEL NEGOCIO / SOLICITUD */}
                                            {equipoInfo.tipo === 'Mantenimiento' && availableEquipos.length > 0 && (
                                                <div style={{ marginBottom: '14px', background: '#fff7ed', padding: '12px', borderRadius: '12px', border: '1.5px solid #fed7aa' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                        <span style={{ fontSize: '12px', fontWeight: '800', color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                                            📋 Equipos de la Solicitud ({availableEquipos.length})
                                                        </span>
                                                        <span style={{ fontSize: '11px', color: '#ea580c', fontWeight: '700' }}>
                                                            {selectedEquipoIds.length === 0 ? 'Ninguno seleccionado' : `${selectedEquipoIds.length} seleccionado(s)`}
                                                        </span>
                                                    </div>
                                                    <p style={{ margin: '0 0 10px 0', fontSize: '11.5px', color: '#9a3412' }}>
                                                        Marca o desmarca los equipos a los que se les realizó este mantenimiento para auto-llenar los datos:
                                                    </p>

                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                                                        {availableEquipos.map((eq) => {
                                                            const isSelected = selectedEquipoIds.some(id => String(id) === String(eq.id));
                                                            return (
                                                                <div
                                                                    key={eq.id}
                                                                    onClick={() => handleToggleSelectEquipo(eq)}
                                                                    style={{
                                                                        padding: '9px 12px',
                                                                        borderRadius: '10px',
                                                                        border: isSelected ? '2px solid #f26522' : '1.5px solid #e2e8f0',
                                                                        background: isSelected ? '#ffffff' : '#f8fafc',
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '10px',
                                                                        transition: 'all 0.15s ease',
                                                                        boxShadow: isSelected ? '0 2px 8px rgba(242, 101, 34, 0.2)' : 'none'
                                                                    }}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        onChange={() => {}} // controlado por el click del contenedor
                                                                        style={{ width: '16px', height: '16px', accentColor: '#f26522', cursor: 'pointer', flexShrink: 0 }}
                                                                    />
                                                                    <div style={{ minWidth: 0, flex: 1 }}>
                                                                        <div style={{ fontSize: '13px', fontWeight: '800', color: isSelected ? '#ea580c' : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                            {eq.nombre}
                                                                        </div>
                                                                        <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                            {eq.marca ? `Marca: ${eq.marca}` : ''} {eq.modelo ? `| Mod: ${eq.modelo}` : ''}
                                                                        </div>
                                                                        {eq.area && (
                                                                            <div style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic', marginTop: '2px' }}>
                                                                                📍 {eq.area}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                <div className={styles.inputGroup} style={{ marginBottom: '10px' }}>
                                                    <label className={styles.label}>Marca(s):</label>
                                                    <input
                                                        type="text"
                                                        className={styles.input}
                                                        value={equipoInfo.marca}
                                                        onChange={(e) => handleEquipoInfoChange('marca', e.target.value)}
                                                        placeholder="Samsung, Mirage, etc."
                                                    />
                                                </div>
                                                <div className={styles.inputGroup} style={{ marginBottom: '10px' }}>
                                                    <label className={styles.label}>Modelo(s):</label>
                                                    <input
                                                        type="text"
                                                        className={styles.input}
                                                        value={equipoInfo.modelo}
                                                        onChange={(e) => handleEquipoInfoChange('modelo', e.target.value)}
                                                        placeholder="AR12..."
                                                    />
                                                </div>
                                            </div>

                                            {equipoInfo.tipo === 'Instalación' && (
                                                <div style={{ display: 'flex', gap: '12px' }}>
                                                    <div className={styles.inputGroup} style={{ flex: 1, marginBottom: 0 }}>
                                                        <label className={styles.label}>Piezas:</label>
                                                        <input
                                                            type="number"
                                                            className={styles.input}
                                                            value={equipoInfo.piezas}
                                                            onChange={(e) => handleEquipoInfoChange('piezas', e.target.value)}
                                                            min="1"
                                                        />
                                                    </div>
                                                    <div className={styles.inputGroup} style={{ flex: 1, marginBottom: 0 }}>
                                                        <label className={styles.label}>Garantía (Meses):</label>
                                                        <input
                                                            type="number"
                                                            className={styles.input}
                                                            value={equipoInfo.garantia}
                                                            onChange={(e) => handleEquipoInfoChange('garantia', e.target.value)}
                                                            placeholder="12"
                                                            min="0"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', textAlign: 'center', color: '#94a3b8', border: '1.5px dashed #e2e8f0', fontSize: '13px', fontWeight: '600' }}>
                                            No se requiere registro de equipo específico para esta tarea.
                                        </div>
                                    )}
                                </div>

                                {/* Card Refacciones y Materiales */}
                                <div className={styles.infoSectionCard}>
                                    <h3 className={styles.sectionTitle}>🪛 Materiales y Refacciones</h3>
                                    <div className={styles.inputGroup} style={{ marginBottom: 0 }}>
                                        <label className={styles.label}>Materiales Extras / Imprevistos:</label>
                                        {refaccionesList.map((ref, i) => (
                                            <div key={i} className={styles.refaccionRow}>
                                                <input
                                                    placeholder="Material / Refacción"
                                                    value={ref.pieza}
                                                    onChange={(e) => {
                                                        const newR = [...refaccionesList];
                                                        newR[i].pieza = e.target.value;
                                                        setRefaccionesList(newR);
                                                    }}
                                                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                                                />
                                                <input
                                                    type="number"
                                                    placeholder="Cant."
                                                    value={ref.cantidad || ""}
                                                    onChange={(e) => {
                                                        const newR = [...refaccionesList];
                                                        newR[i].cantidad = Number(e.target.value);
                                                        setRefaccionesList(newR);
                                                    }}
                                                    style={{ width: '70px', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                                                />
                                                <input
                                                    type="number"
                                                    placeholder="Precio ($)"
                                                    value={ref.costo_estimado || ""}
                                                    onChange={(e) => {
                                                        const newR = [...refaccionesList];
                                                        newR[i].costo_estimado = e.target.value;
                                                        setRefaccionesList(newR);
                                                    }}
                                                    style={{ width: '100px', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                                                />

                                                <button
                                                    onClick={() => setRefaccionesList(refaccionesList.filter((_, idx) => idx !== i))}
                                                    style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => setRefaccionesList([...refaccionesList, { pieza: '', cantidad: 1, costo_estimado: '' }])}
                                            className={styles.addRefaccionBtn}
                                        >
                                            + Agregar Material Extra/Imprevisto
                                        </button>

                                        <label className={styles.label} style={{ marginTop: '12px' }}>Otros Consumibles / Observaciones de Material:</label>
                                        <textarea
                                            className={styles.textarea}
                                            style={{ height: '70px' }}
                                            value={materiales}
                                            onChange={(e) => setMateriales(e.target.value)}
                                            placeholder="Ej. Cinta aislante, solventes, tornillos de fijación..."
                                        />
                                    </div>
                                </div>

                            </div>

                        </div>

                        {/* 3. EVIDENCIA FOTOGRÁFICA Y OBSERVACIONES */}
                        <div className={styles.infoSectionCard}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '2px solid #f0f0f0', paddingBottom: '12px' }}>
                                <h3 className={styles.sectionTitle} style={{ margin: 0, border: 'none', padding: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>📸</span> Evidencia Fotográfica del Trabajo
                                </h3>
                                <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', background: '#f1f5f9', padding: '4px 12px', borderRadius: '12px' }}>
                                    Etapas del Servicio
                                </span>
                            </div>

                            <div className={styles.evidenceSubGrid}>
                                <div className={styles.evidenceSection}>
                                    <div className={styles.evidenceGrid}>
                                        <div className={styles.evidenceItem}>
                                            <span className={styles.evidenceLabel}>1. Antes (Estado Inicial)</span>
                                            <div className={styles.squareBox} onClick={() => antesInputRef.current?.click()}>
                                                {imagenes.antes ? (
                                                    <>
                                                        <img src={imagenes.antes} alt="Antes" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '14px' }} />
                                                        <button 
                                                            className={styles.deletePhotoBtn} 
                                                            onClick={(e) => { e.stopPropagation(); removeImage('antes'); }}
                                                            title="Eliminar foto"
                                                        >
                                                            ✕
                                                        </button>
                                                    </>
                                                ) : (
                                                    <div className={styles.uploadPlaceholder}>
                                                        <HiOutlineCamera />
                                                        <span className={styles.uploadText}>Cargar Foto</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className={styles.evidenceItem}>
                                            <span className={styles.evidenceLabel}>2. Durante (Proceso)</span>
                                            <div className={styles.squareBox} onClick={() => duranteInputRef.current?.click()}>
                                                {imagenes.durante ? (
                                                    <>
                                                        <img src={imagenes.durante} alt="Durante" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '14px' }} />
                                                        <button 
                                                            className={styles.deletePhotoBtn} 
                                                            onClick={(e) => { e.stopPropagation(); removeImage('durante'); }}
                                                            title="Eliminar foto"
                                                        >
                                                            ✕
                                                        </button>
                                                    </>
                                                ) : (
                                                    <div className={styles.uploadPlaceholder}>
                                                        <HiOutlineCamera />
                                                        <span className={styles.uploadText}>Cargar Foto</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className={styles.evidenceItem}>
                                            <span className={styles.evidenceLabel}>3. Después (Finalizado)</span>
                                            <div className={styles.squareBox} onClick={() => despuesInputRef.current?.click()}>
                                                {imagenes.despues ? (
                                                    <>
                                                        <img src={imagenes.despues} alt="Después" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '14px' }} />
                                                        <button 
                                                            className={styles.deletePhotoBtn} 
                                                            onClick={(e) => { e.stopPropagation(); removeImage('despues'); }}
                                                            title="Eliminar foto"
                                                        >
                                                            ✕
                                                        </button>
                                                    </>
                                                ) : (
                                                    <div className={styles.uploadPlaceholder}>
                                                        <HiOutlineCamera />
                                                        <span className={styles.uploadText}>Cargar Foto</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {!showObservacionesInput || observacionesList.length === 0 ? (
                                    <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: '10px' }}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowObservacionesInput(true);
                                                addObservacionBlock();
                                            }}
                                            className={styles.addObservacionBtn}
                                        >
                                            <HiOutlinePlus size={18} /> Agregar Observaciones Adicionales / Fotos Extra
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', borderTop: '1px solid #f1f5f9', paddingTop: '20px', marginTop: '15px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <label className={styles.label} style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#1e293b' }}>Observaciones Adicionales ({observacionesList.length})</label>
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    const hasContent = observacionesList.some(o => o.texto.trim() || o.imagenes.length > 0);
                                                    if (!hasContent) {
                                                        setShowObservacionesInput(false);
                                                        setObservacionesList([]);
                                                    } else {
                                                        showConfirm(
                                                            "Quitar Todas las Observaciones",
                                                            "Hay observaciones registradas. Si ocultas esta sección se borrará toda esa información. ¿Deseas continuar?",
                                                            () => {
                                                                setObservacionesList([]);
                                                                setShowObservacionesInput(false);
                                                            },
                                                            () => {}
                                                        );
                                                    }
                                                }}
                                                style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}
                                            >
                                                ✕ Quitar Sección
                                            </button>
                                        </div>

                                        {observacionesList.map((block, idx) => (
                                            <div 
                                                key={block.id} 
                                                style={{ 
                                                    background: '#f8fafc', 
                                                    border: '1.5px solid #e2e8f0', 
                                                    borderRadius: '16px', 
                                                    padding: '18px', 
                                                    display: 'flex', 
                                                    flexDirection: 'column', 
                                                    gap: '14px' 
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#334155' }}>📝 Observación #{idx + 1}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (block.texto.trim() || block.imagenes.length > 0) {
                                                                showConfirm(
                                                                    "Quitar Observación",
                                                                    "¿Estás seguro de que deseas eliminar esta observación?",
                                                                    () => removeObservacionBlock(block.id),
                                                                    () => {}
                                                                );
                                                            } else {
                                                                removeObservacionBlock(block.id);
                                                            }
                                                        }}
                                                        style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer', fontWeight: '700' }}
                                                    >
                                                        ✕ Eliminar
                                                    </button>
                                                </div>

                                                <textarea
                                                    className={styles.textarea}
                                                    style={{ height: '80px', width: '100%', resize: 'vertical' }}
                                                    value={block.texto}
                                                    onChange={(e) => handleObservacionTextChange(block.id, e.target.value)}
                                                    placeholder="Notas u observaciones específicas de este hallazgo..."
                                                ></textarea>

                                                <div>
                                                    <label className={styles.label} style={{ display: 'block', marginBottom: '8px', fontSize: '12px' }}>Fotos de esta Observación:</label>
                                                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                        {block.imagenes.map((img, imgIdx) => (
                                                            <div key={imgIdx} className={styles.evidenceItem} style={{ width: '90px' }}>
                                                                <span className={styles.evidenceLabel} style={{ fontSize: '11px' }}>Foto {imgIdx + 1}</span>
                                                                <div className={styles.squareBox} style={{ width: '90px', height: '90px', position: 'relative' }}>
                                                                    <img src={img} alt={`Extra ${imgIdx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }} />
                                                                    <button 
                                                                        type="button"
                                                                        className={styles.deletePhotoBtn} 
                                                                        onClick={(e) => { e.stopPropagation(); removeObservacionBlockImage(block.id, imgIdx); }}
                                                                        title="Eliminar foto"
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        <div className={styles.evidenceItem} style={{ width: '90px' }}>
                                                            <span className={styles.evidenceLabel} style={{ fontSize: '11px' }}>Agregar</span>
                                                            <div 
                                                                className={styles.squareBox} 
                                                                onClick={() => triggerObservacionImageUpload(block.id)} 
                                                                style={{ width: '90px', height: '90px', border: '2px dashed #cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                            >
                                                                <HiOutlineCamera size={24} style={{ color: '#94a3b8' }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '5px' }}>
                                            <button
                                                type="button"
                                                onClick={addObservacionBlock}
                                                style={{
                                                    background: '#e0f2fe',
                                                    color: '#0369a1',
                                                    border: '1.5px dashed #7dd3fc',
                                                    padding: '10px 20px',
                                                    borderRadius: '12px',
                                                    cursor: 'pointer',
                                                    fontSize: '13px',
                                                    fontWeight: 'bold',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px'
                                                }}
                                            >
                                                <HiOutlinePlus size={16} /> Agregar Otra Observación
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 4. VALIDACIÓN FINAL Y FIRMA AUTORIZADA */}
                        <div className={styles.infoSectionCard}>
                            <h3 className={styles.sectionTitle} style={{ borderBottom: '2px solid #f0f0f0', paddingBottom: '10px', marginBottom: '16px' }}>
                                ✍️ Firma y Validación de Conformidad
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', alignItems: 'center' }}>
                                <div>
                                    <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: '800', color: '#1e293b' }}>
                                        Sello o Firma del Cliente / Empresa
                                    </h4>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
                                        Solicita al gerente o encargado de la sucursal la firma digital o imagen del sello de conformidad para validar la entrega final del trabajo.
                                    </p>
                                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: '700', color: firmaEmpresa ? '#059669' : '#d97706', background: firmaEmpresa ? '#ecfdf5' : '#fffbe8', padding: '4px 12px', borderRadius: '20px', border: firmaEmpresa ? '1px solid #a7f3d0' : '1px solid #fde68a' }}>
                                            {firmaEmpresa ? '✓ Firma Cargada Correctamente' : '⚠️ Firma Pendiente (Requerida para entregar)'}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <div className={styles.squareBox} onClick={() => firmaInputRef.current?.click()} style={{ width: '100%', maxWidth: '380px', height: '140px', background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '18px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
                                        {firmaEmpresa ? (
                                            <>
                                                {firmaEmpresa.startsWith('data:application/pdf') ? (
                                                    <div style={{ textAlign: 'center', color: '#334155', padding: '10px' }}>
                                                        <div style={{ fontSize: '36px', marginBottom: '4px' }}>📄</div>
                                                        <div style={{ fontSize: '13px', fontWeight: '800' }}>Documento / PDF de Firma Cargado</div>
                                                    </div>
                                                ) : (
                                                    <img src={firmaEmpresa} alt="Firma" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
                                                )}
                                                <button 
                                                    className={styles.deletePhotoBtn} 
                                                    onClick={(e) => { e.stopPropagation(); removeFirma(); }}
                                                    style={{ top: '8px', right: '8px', width: '22px', height: '22px', fontSize: '13px' }}
                                                >
                                                    ✕
                                                </button>
                                            </>
                                        ) : (
                                            <div style={{ textAlign: 'center', color: '#64748b' }}>
                                                <HiOutlineArrowUpTray style={{ fontSize: '32px', color: '#94a3b8', marginBottom: '6px' }} />
                                                <div style={{ fontSize: '14px', fontWeight: '800', color: '#1e293b' }}>Clic para Cargar Firma o Sello</div>
                                                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Soporta imágenes (PNG, JPG) o PDF</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={styles.footer} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
                            <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '6px', background: '#ecfdf5', padding: '8px 14px', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
                                <span style={{ fontSize: '14px' }}>🛡️</span>
                                <span style={{ fontSize: '12px', fontWeight: '700', color: '#047857' }}>
                                    Avance respaldado automáticamente
                                </span>
                            </div>
                            <button
                                onClick={handleGuardarYPrevisualizar}
                                className={`${styles.saveButton} ${styles.pdfBtn}`}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                📄 Guardar y Previsualizar PDF
                            </button>
                            <button
                                onClick={handleOpenConfirm}
                                disabled={isSavingReport}
                                className={styles.saveButton}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: isSavingReport ? 0.7 : 1, cursor: isSavingReport ? 'not-allowed' : 'pointer' }}
                            >
                                {isSavingReport ? '⏳ Guardando Reporte...' : '💾 Guardar Reporte de Tarea'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* PREVISUALIZACION DEL PDF GENERADO */}
            {showReportePreview && (() => {
                const filteredObs = observacionesList.filter(o => o.texto.trim() || o.imagenes.length > 0);
                const compiledObservaciones = filteredObs.map(o => o.texto).filter(Boolean).join('\n\n');
                const compiledImagenesObservacion = filteredObs.reduce((acc, o) => [...acc, ...o.imagenes], [] as string[]);
                return (
                    <ReportePDFPreview
                        trabajo={trabajoBase}
                        isVisita={trabajoBase?.tipo === 'Visita' || trabajoBase?.originalTipo === 'Visita'}
                        reporteData={{
                            id: id || 0,
                            reporteTienda,
                            descripcion,
                            materiales,
                            refaccionesList,
                            observaciones: compiledObservaciones,
                            observacionesList: filteredObs,
                            imagenes,
                            imagenObservacion: compiledImagenesObservacion[0] || null,
                            imagenesObservacion: compiledImagenesObservacion,
                            firmaEmpresa,
                            involucraEquipo,
                            equipoInfo: involucraEquipo ? equipoInfo : null,
                            fecha: new Date().toLocaleDateString('es-MX'),
                            tecnicoNombre: trabajoBase?.trabajador?.nombre || user?.name || trabajoBase?.tecnico || 'Técnico',
                            tecnicoAvatar: user?.avatar || undefined,
                            fechaInicio: fechaInicio || undefined
                        }}
                        onClose={() => setShowReportePreview(false)}
                    />
                );
            })()}

            {/* ZOOM MODAL DE IMÁGENES */}
            {selectedZoomImage && (
                <div
                    style={{
                        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                        background: 'rgba(0, 0, 0, 0.85)', zIndex: 10001, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', padding: '20px',
                        backdropFilter: 'blur(5px)'
                    }}
                    onClick={() => setSelectedZoomImage(null)}
                >
                    <div 
                        style={{ 
                            position: 'relative', maxWidth: '95%', maxHeight: '95%', display: 'flex', flexDirection: 'column', 
                            alignItems: 'center', background: '#fff', padding: '30px', borderRadius: '24px', overflowY: 'auto'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setSelectedZoomImage(null)}
                            style={{ position: 'absolute', top: '15px', right: '15px', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', cursor: 'pointer', fontSize: '20px', fontWeight: 'bold' }}
                        >
                            ✕
                        </button>
                        
                        <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#1e293b', marginBottom: '20px', width: '100%', textAlign: 'left' }}>Detalles de la Evidencia</h2>
                        
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '12px', alignSelf: 'flex-start' }}>Foto Adjunta</span>
                            <img
                                src={selectedZoomImage}
                                alt="Zoomed Evidence"
                                style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: '15px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminReporte;
