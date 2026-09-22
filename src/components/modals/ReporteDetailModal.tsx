import React, { useState } from "react";
import { 
    HiOutlineClipboardDocumentList, 
    HiOutlinePencilSquare, 
    HiOutlineIdentification, 
    HiOutlineClock, 
    HiOutlineBuildingOffice2, 
    HiOutlineWrench, 
    HiOutlineCurrencyDollar,
    HiOutlineArrowDownTray
} from "react-icons/hi2";
import { createPortal } from "react-dom";
import styles from "./ReporteDetailModal.module.css";
import { generateMaintenanceReportPDF } from "../../utils/pdfGenerator";
import { findMatchingSubReport } from "../../utils/reportUtils";

const getAvatarForTech = (nombre: string) => {
    if (!nombre || nombre.toLowerCase() === "sin asignar") return null;
    const profileKey = `profile_${nombre.replace(/\s+/g, '')}`;
    const profileData = localStorage.getItem(profileKey);
    if (profileData) {
        try {
            const data = JSON.parse(profileData);
            if (data.imagenPerfil) return data.imagenPerfil;
        } catch(e) {}
    }
    const stored = localStorage.getItem('trabajadores_list');
    if (stored) {
        try {
            const list = JSON.parse(stored);
            const worker = list.find((w: any) => w.nombre === nombre);
            if (worker && worker.avatar) return worker.avatar;
        } catch(e) {}
    }
    const initials = (nombre || 'T').trim().split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'T';
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><circle cx="40" cy="40" r="40" fill="%230e7490"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="28" font-weight="bold" fill="%23ffffff">${initials}</text></svg>`;
};

interface ReporteDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    trabajo: {
        id: number;
        sucursal?: string;
        tecnico?: string;
        encargado?: string;
        cotizacion?: {
            costo: string;
            notas: string;
            archivo: string;
        };
    };
    task: {
        id: number | string;
        titulo: string;
        fecha?: string;
    };
    reporte: any; // El objeto de reporte final o temporal
    userRole?: string;
    onEdit?: () => void;
}

const ReporteDetailModal: React.FC<ReporteDetailModalProps> = ({ 
    isOpen, 
    onClose, 
    trabajo, 
    task, 
    reporte, 
    userRole,
    onEdit 
}) => {
    const [selectedZoomImage, setSelectedZoomImage] = useState<string | null>(null);
    const [showCotizacionDetail, setShowCotizacionDetail] = useState(false);

    // Resolver reporte de manera robusta (extrayendo subReports o solucion si vienen encapsulados)
    const rep = React.useMemo(() => {
        if (!reporte) return null;
        let base = { ...reporte };
        if (reporte.solucion) {
            try {
                const parsed = typeof reporte.solucion === 'string' ? JSON.parse(reporte.solucion) : reporte.solucion;
                base = { ...base, ...parsed };
            } catch (_) {}
        }
        const matched = findMatchingSubReport(base, {
            id: task?.id,
            trabajoId: trabajo?.id,
            titulo: task?.titulo
        });
        const finalBase = matched || base;
        return {
            ...finalBase,
            id: finalBase.id || task?.id || trabajo?.id,
            fecha: finalBase.fecha || task?.fecha,
            tecnicoNombre: finalBase.tecnicoNombre || trabajo?.tecnico,
            tecnicoAvatar: finalBase.tecnicoAvatar || getAvatarForTech(finalBase.tecnicoNombre || trabajo?.tecnico || ''),
            reporteTienda: finalBase.reporteTienda || finalBase.descripcion || task?.titulo,
            descripcion: finalBase.descripcion || finalBase.reporteTienda,
            involucraEquipo: finalBase.involucraEquipo !== undefined ? finalBase.involucraEquipo : Boolean(finalBase.equipoInfo),
            equipoInfo: finalBase.equipoInfo || null,
            firmaEmpresa: (finalBase.firmaEmpresa && finalBase.firmaEmpresa !== '__PDF_LOADED_IN_STATE__')
                ? finalBase.firmaEmpresa
                : (base.firmaEmpresa && base.firmaEmpresa !== '__PDF_LOADED_IN_STATE__' ? base.firmaEmpresa : null)
        };
    }, [reporte, task, trabajo]);

    React.useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    // Determinar si es un pre-reporte (falta firma o es local)
    const isPreReport = !rep?.id && !!rep; 

    const downloadFile = async (urlOrData: string, defaultName: string) => {
        try {
            if (urlOrData.startsWith('data:')) {
                const link = document.createElement('a');
                link.href = urlOrData;
                link.download = defaultName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                return;
            }

            const response = await fetch(urlOrData);
            if (!response.ok) throw new Error('Fetch failed');
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = defaultName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (e) {
            const link = document.createElement('a');
            link.href = urlOrData;
            link.download = defaultName;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleDownloadReporte = async () => {
        if (!rep) return;

        const firma = rep.firmaEmpresa;
        if (firma && firma !== '__PDF_LOADED_IN_STATE__') {
            let ext = 'jpg';
            if (firma.startsWith('data:application/pdf') || firma.toLowerCase().includes('.pdf')) {
                ext = 'pdf';
            } else if (firma.startsWith('data:image/png') || firma.toLowerCase().includes('.png')) {
                ext = 'png';
            } else if (firma.startsWith('data:image/webp') || firma.toLowerCase().includes('.webp')) {
                ext = 'webp';
            } else if (firma.startsWith('data:image/jpeg') || firma.toLowerCase().includes('.jpeg') || firma.toLowerCase().includes('.jpg')) {
                ext = 'jpg';
            }

            const fileName = `Reporte_Firmado_${rep.id || task?.id || 'servicio'}.${ext}`;
            await downloadFile(firma, fileName);
            return;
        }

        await handleDownloadPDF();
    };

    const handleDownloadPDF = async () => {
        if (!rep) return;
        try {
            await generateMaintenanceReportPDF({
                id: rep.dbId || rep.id || task?.id || 'SD',
                fecha: rep.fecha || new Date().toLocaleDateString(),
                sucursal: trabajo?.sucursal || 'N/A',
                encargado: trabajo?.encargado || 'N/A',
                tecnico: rep.tecnicoNombre || trabajo?.tecnico || 'N/A',
                tecnicoAvatar: rep.tecnicoAvatar || getAvatarForTech(rep.tecnicoNombre || trabajo?.tecnico || ''),
                fechaInicio: rep.fechaInicio || null,
                diagnostico: rep.reporteTienda || 'N/A',
                descripcion: rep.descripcion || 'N/A',
                materiales: rep.materiales || 'N/A',
                observaciones: rep.observaciones || 'N/A',
                observacionesList: rep.observacionesList,
                imagenes: {
                    antes: rep.imagenes?.antes,
                    durante: rep.imagenes?.durante,
                    despues: rep.imagenes?.despues,
                    extra: (rep.imagenesObservacion && rep.imagenesObservacion.length > 0)
                        ? rep.imagenesObservacion
                        : rep.imagenObservacion
                },
                firmaEmpresa: rep.firmaEmpresa,
                equipo: rep.involucraEquipo ? rep.equipoInfo : (trabajo.cotizacion ? {
                    tipo: 'Servicio',
                    marca: 'N/A',
                    modelo: 'N/A'
                } : null)
            });
        } catch (error) {
            console.error("Error al generar PDF:", error);
        }
    };

    return createPortal(
        <div className={styles.premiumModalOverlay} onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
        }}>
            <div className={styles.premiumModalContent}>
                <div className={styles.premiumModalHeader}>
                    <h2>
                        <HiOutlineClipboardDocumentList size={26} />
                        Detalles del Reporte
                        {isPreReport && <span style={{ color: '#f26522', fontSize: '13px', background: '#fffbeb', padding: '4px 10px', borderRadius: '10px', border: '1px solid #fef3c7', marginLeft: '10px' }}>Pre-Reporte</span>}
                    </h2>
                    <div className={styles.headerActions}>
                        {rep && (
                            <button
                                className={styles.downloadPdfBtn}
                                onClick={handleDownloadReporte}
                                title={rep?.firmaEmpresa && rep.firmaEmpresa !== '__PDF_LOADED_IN_STATE__' ? "Descargar Reporte Firmado" : "Descargar PDF"}
                            >
                                <HiOutlineArrowDownTray size={18} />
                                <span>{rep?.firmaEmpresa && rep.firmaEmpresa !== '__PDF_LOADED_IN_STATE__' ? "Descargar Reporte" : "Descargar PDF"}</span>
                            </button>
                        )}
                        {onEdit && (userRole === 'admin' || userRole === 'tecnico') && (
                            <button className={styles.editReportBtn} onClick={onEdit}>
                                <HiOutlinePencilSquare size={18} />
                                <span>Editar Reporte</span>
                            </button>
                        )}
                        <button onClick={onClose} className={styles.closeHeaderBtn} title="Cerrar">
                            <span style={{ fontSize: '24px', fontWeight: 'bold', lineHeight: 1 }}>✕</span>
                        </button>
                    </div>
                </div>

                <div className={styles.premiumModalBody}>
                    <div className={styles.infoGrid}>
                        <div className={styles.reportDetailCard} style={{ margin: 0 }}>
                            <div className={styles.detailSectionTitle}>
                                <HiOutlineIdentification size={18} />
                                Identificación
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <span className={styles.dataLabel}>Folio de Reporte</span>
                                    <span className={styles.folioBadge}>#{rep?.id || task?.id || 'Cargando...'}</span>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span className={styles.dataLabel}>Estatus</span>
                                    <span style={{ 
                                        fontSize: '11px', 
                                        fontWeight: '800', 
                                        color: isPreReport ? '#b45309' : '#059669',
                                        background: isPreReport ? '#fffbeb' : '#ecfdf5',
                                        padding: '4px 10px',
                                        borderRadius: '8px',
                                        border: `1px solid ${isPreReport ? '#fef3c7' : '#d1fae5'}`
                                    }}>
                                        {isPreReport ? 'PENDIENTE DE FIRMA' : 'FINALIZADO'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className={styles.reportDetailCard} style={{ margin: 0 }}>
                            <div className={styles.detailSectionTitle}>
                                <HiOutlineClock size={18} />
                                Cronología
                            </div>
                            <span className={styles.dataLabel}>Fecha de Registro</span>
                            <span className={styles.dataText}>{rep?.fecha || task?.fecha || 'Cargando...'}</span>
                        </div>
                    </div>

                    <div className={styles.reportDetailCard}>
                        <div className={styles.detailSectionTitle}>
                            <HiOutlineBuildingOffice2 size={18} />
                            Información de Servicio
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div className={styles.dataBlock}>
                                <span className={styles.dataLabel}>Sucursal</span>
                                <span className={styles.dataText}>{trabajo?.sucursal || 'N/A'}</span>
                            </div>
                            <div className={styles.dataBlock}>
                                <span className={styles.dataLabel}>Tipo de Trabajo</span>
                                <span className={styles.dataText}>{task?.titulo || 'Cargando...'}</span>
                            </div>
                            <div className={styles.dataBlock}>
                                <span className={styles.dataLabel}>Técnico</span>
                                <span className={styles.dataText}>{rep?.tecnicoNombre || trabajo?.tecnico || 'N/A'}</span>
                            </div>
                            <div className={styles.dataBlock}>
                                <span className={styles.dataLabel}>Gerente / Encargado</span>
                                <span className={styles.dataText}>{trabajo?.encargado || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    {(rep?.involucraEquipo || rep?.equipoInfo || (trabajo as any)?.equipo) && (
                        <div className={styles.reportDetailCard}>
                            <div className={styles.detailSectionTitle}>
                                <HiOutlineWrench size={18} />
                                Equipo Involucrado en el Mantenimiento
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '15px' }}>
                                <div className={styles.dataBlock}>
                                    <span className={styles.dataLabel}>Tipo de Servicio</span>
                                    <span className={styles.dataText}>{rep?.equipoInfo?.tipo || 'Mantenimiento'}</span>
                                </div>
                                <div className={styles.dataBlock}>
                                    <span className={styles.dataLabel}>Marca(s)</span>
                                    <span className={styles.dataText}>{rep?.equipoInfo?.marca || (trabajo as any)?.equipo?.marca || (trabajo as any)?.equipo?.nombre || 'N/A'}</span>
                                </div>
                                <div className={styles.dataBlock}>
                                    <span className={styles.dataLabel}>Modelo(s)</span>
                                    <span className={styles.dataText}>{rep?.equipoInfo?.modelo || (trabajo as any)?.equipo?.modelo || 'N/A'}</span>
                                </div>
                                {rep?.equipoInfo?.garantia && (
                                    <div className={styles.dataBlock}>
                                        <span className={styles.dataLabel}>Garantía</span>
                                        <span className={styles.dataText}>{rep.equipoInfo.garantia} meses</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className={styles.reportDetailCard}>
                        <div className={styles.detailSectionTitle}>
                            <HiOutlineClipboardDocumentList size={18} />
                            Datos del Reporte
                        </div>
                        
                        <div className={styles.dataBlock}>
                            <span className={styles.dataLabel}>Reporte de Tienda / Hallazgo</span>
                            <div className={styles.dataBox}>{rep?.reporteTienda || rep?.descripcion || task?.titulo || 'Diagnóstico de visita completado.'}</div>
                        </div>

                        <div className={styles.dataBlock}>
                            <span className={styles.dataLabel}>Descripción del Trabajo Realizado</span>
                            <div className={styles.dataBox}>{rep?.descripcion || rep?.reporteTienda || 'Servicio ejecutado según lo acordado en la cotización.'}</div>
                        </div>

                        <div className={styles.dataBlock}>
                            <span className={styles.dataLabel}>Piezas y Refacciones</span>
                            <div className={styles.dataBox}>
                                {Array.isArray(rep?.refaccionesList) && rep.refaccionesList.length > 0 ? (
                                    <ul style={{ margin: 0, paddingLeft: '18px', lineHeight: '1.8' }}>
                                        {rep.refaccionesList.map((r: any, i: number) => (
                                            <li key={i} style={{ fontSize: '14px' }}>
                                                {r.cantidad}x {r.pieza} {r.costo_estimado ? `($${r.costo_estimado})` : ''}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Sin refacciones registradas.</span>
                                )}
                            </div>
                        </div>

                        <div className={styles.dataBlock}>
                            <span className={styles.dataLabel}>Otros Materiales</span>
                            <div className={styles.dataBox}>{rep?.materiales || 'No se utilizaron otros materiales.'}</div>
                        </div>

                        <div className={styles.dataBlock}>
                            <span className={styles.dataLabel}>Observaciones Adicionales</span>
                            <div className={styles.dataBox}>{rep?.observaciones || 'Sin observaciones adicionales.'}</div>
                        </div>
                    </div>

                    {(() => {
                        const allPhotos: { label: string; url: string }[] = [];
                        if (rep?.imagenes?.antes) allPhotos.push({ label: 'Antes', url: rep.imagenes.antes });
                        if (rep?.imagenes?.durante) allPhotos.push({ label: 'Durante', url: rep.imagenes.durante });
                        if (rep?.imagenes?.despues) allPhotos.push({ label: 'Después', url: rep.imagenes.despues });

                        if (Array.isArray(rep?.imagenes)) {
                            rep.imagenes.forEach((img: any, i: number) => {
                                const url = typeof img === 'string' ? img : (img?.ruta || img?.url);
                                if (url && !allPhotos.some(p => p.url === url)) allPhotos.push({ label: `Evidencia ${i + 1}`, url });
                            });
                        }
                        if (Array.isArray(rep?.photos)) {
                            rep.photos.forEach((img: any, i: number) => {
                                const url = typeof img === 'string' ? img : (img?.ruta || img?.url);
                                if (url && !allPhotos.some(p => p.url === url)) allPhotos.push({ label: `Evidencia ${i + 1}`, url });
                            });
                        }
                        if (rep?.imagenesObservacion && Array.isArray(rep.imagenesObservacion)) {
                            rep.imagenesObservacion.forEach((img: string, idx: number) => {
                                if (img && !allPhotos.some(p => p.url === img)) allPhotos.push({ label: `Extra ${idx + 1}`, url: img });
                            });
                        } else if (rep?.imagenObservacion) {
                            if (!allPhotos.some(p => p.url === rep.imagenObservacion)) {
                                allPhotos.push({ label: 'Extra', url: rep.imagenObservacion });
                            }
                        }

                        if (allPhotos.length === 0) return null;

                        return (
                            <div className={styles.reportDetailCard}>
                                <div className={styles.detailSectionTitle}>
                                    <HiOutlineWrench size={18} />
                                    Evidencia Fotográfica ({allPhotos.length})
                                </div>
                                <div className={styles.evidenceGrid}>
                                    {allPhotos.map((photo, idx) => (
                                        <div key={idx} className={styles.evidenceItem}>
                                            <img
                                                src={photo.url}
                                                alt={photo.label}
                                                className={styles.evidenceThumb}
                                                onClick={() => setSelectedZoomImage(photo.url)}
                                            />
                                            <span className={styles.evidenceLabel}>{photo.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {trabajo?.cotizacion && (
                        <div className={styles.approvedQuoteBox} style={{ cursor: 'pointer' }} onClick={() => setShowCotizacionDetail(!showCotizacionDetail)}>
                            <div className={styles.quoteHeader}>
                                <div className={styles.quoteTitle}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f26522', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <HiOutlineCurrencyDollar size={20} color="white" />
                                    </div>
                                    Cotización Aprobada
                                </div>
                                <div className={styles.quoteAmount} style={{ letterSpacing: 'normal' }}>
                                    {showCotizacionDetail ? `$${trabajo.cotizacion.costo}` : '$$$'}
                                </div>
                            </div>

                            {!showCotizacionDetail && (
                                <div style={{ marginTop: '10px', textAlign: 'center' }}>
                                    <span style={{ fontSize: '13px', color: '#b45309', fontWeight: 'bold', textDecoration: 'underline' }}>Ver más detalles</span>
                                </div>
                            )}

                            {showCotizacionDetail && (
                                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #fef3c7', paddingTop: '14px' }}>
                                    <div className={styles.dataBlock}>
                                        <span className={styles.dataLabel} style={{ color: '#b45309' }}>Notas Administrativas</span>
                                        <p style={{ margin: 0, fontSize: '14px', color: '#92400e', fontStyle: 'italic', lineHeight: '1.6' }}>
                                             "{trabajo.cotizacion.notas || "Sin notas adicionales."}"
                                        </p>
                                    </div>

                                    {trabajo.cotizacion.archivo &&
                                        typeof trabajo.cotizacion.archivo === 'string' &&
                                        (trabajo.cotizacion.archivo.startsWith('http://') || trabajo.cotizacion.archivo.startsWith('https://')) && (
                                        <a
                                            href={trabajo.cotizacion.archivo}
                                            target="_blank"
                                            rel="noreferrer"
                                            className={styles.quoteDocBtn}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <HiOutlineClipboardDocumentList size={18} />
                                            Ver Documento de Cotización Original
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {rep?.firmaEmpresa && rep.firmaEmpresa !== '__PDF_LOADED_IN_STATE__' && (
                        <div className={styles.reportDetailCard} style={{ marginTop: '20px', textAlign: 'center' }}>
                            <span className={styles.dataLabel}>📄 Reporte Firmado y Sellado (Empresa)</span>
                            <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '15px', marginTop: '10px', border: '1px solid #f1f5f9' }}>
                                {(rep.firmaEmpresa.startsWith('data:application/pdf') || (rep.firmaEmpresa.startsWith('http') && rep.firmaEmpresa.toLowerCase().includes('.pdf'))) ? (
                                    /* PDF: mostrar ícono + botón de descarga/visualización */
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '64px', height: '64px', background: '#fee2e2', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>
                                            📋
                                        </div>
                                        <span style={{ fontSize: '13px', color: '#374151', fontWeight: '600' }}>Reporte PDF con firma y sello</span>
                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                            <button
                                                onClick={handleDownloadReporte}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f26522', color: '#fff', padding: '8px 18px', borderRadius: '20px', fontSize: '13px', fontWeight: '700', border: 'none', cursor: 'pointer' }}
                                            >
                                                ⬇️ Descargar PDF
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const win = window.open('', '_blank');
                                                    if (win) {
                                                        win.document.write(`<iframe src="${rep.firmaEmpresa}" style="width:100%;height:100vh;border:none;"></iframe>`);
                                                        win.document.close();
                                                    }
                                                }}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#3b82f6', color: '#fff', padding: '8px 18px', borderRadius: '20px', fontSize: '13px', fontWeight: '700', border: 'none', cursor: 'pointer' }}
                                            >
                                                👁️ Ver PDF
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* Imagen: mantener el visor con zoom y botón de descarga */
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                        <img
                                            src={rep.firmaEmpresa}
                                            alt="Reporte Firmado"
                                            style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', cursor: 'zoom-in', borderRadius: '8px' }}
                                            onClick={() => setSelectedZoomImage(rep.firmaEmpresa)}
                                        />
                                        <button
                                            onClick={handleDownloadReporte}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f26522', color: '#fff', padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: '700', border: 'none', cursor: 'pointer' }}
                                        >
                                            <HiOutlineArrowDownTray size={16} /> Descargar Imagen
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Zoom Interno */}
            {selectedZoomImage && (
                <div 
                    style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', cursor: 'zoom-out' }} 
                    onClick={() => setSelectedZoomImage(null)}
                >
                    <img src={selectedZoomImage} alt="Zoom" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '12px', boxShadow: '0 0 40px rgba(0,0,0,0.5)' }} />
                    <button 
                        style={{ position: 'absolute', top: '20px', right: '20px', background: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', lineHeight: '1', paddingBottom: '3px', color: '#64748b' }}
                        onClick={() => setSelectedZoomImage(null)}
                    >
                        &times;
                    </button>
                </div>
            )}
        </div>,
        document.body
    );
};

export default ReporteDetailModal;
