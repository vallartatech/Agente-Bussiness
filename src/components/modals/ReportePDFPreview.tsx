import React, { useRef, useState, useEffect } from 'react';
import { HiOutlineXMark, HiOutlinePrinter, HiOutlineArrowDownTray, HiOutlinePhoto, HiOutlinePaperAirplane } from 'react-icons/hi2';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { generateMaintenanceReportPDF } from '../../utils/pdfGenerator';

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

interface ReportePDFPreviewProps {
    trabajo: any;
    reporteData: {
        id: number | string;
        reporteTienda: string;
        descripcion: string;
        materiales: string;
        refaccionesList: { pieza: string; cantidad: number; costo_estimado: string }[];
        observaciones: string;
        observacionesList?: { id: string; texto: string; imagenes: string[] }[];
        imagenes: {
            antes: string | null;
            durante: string | null;
            despues: string | null;
        };
        imagenObservacion: string | null;
        imagenesObservacion?: string[];
        firmaEmpresa: string | null;
        involucraEquipo: boolean;
        equipoInfo: {
            tipo: string;
            marca: string;
            modelo: string;
            piezas?: string;
            garantia?: string;
        } | null;
        fecha: string;
        tecnicoNombre?: string;
        tecnicoAvatar?: string | null;
        fechaInicio?: string;
        isVisita?: boolean;
        isActivityReport?: boolean;
    };
    subTareas?: any[];
    isVisita?: boolean;
    onClose: () => void;
    onSendToAdminAutonomo?: () => void;
}

const getCleanNotes = (text: string) => {
    if (!text) return '';
    const lines = text.split('\n');
    const cleanLines = lines.filter(line => !line.trim().startsWith('-'));
    return cleanLines.join('\n').trim();
};

export const getDiagnosticCategories = (trabajo: any, reporteData: any, subTareas?: any[]) => {
    const categoriesSet = new Set<string>();

    const addCat = (val: any) => {
        if (!val || typeof val !== 'string') return;
        const trimmed = val.split('|||SERVICE_DATA|||')[0].trim();
        if (trimmed && trimmed.length < 50 && !trimmed.toLowerCase().includes('sin diagnóstico')) {
            trimmed.split(/[\/,+&]/).forEach(c => {
                const cleaned = c.trim();
                if (cleaned && cleaned.length < 40 && !cleaned.toLowerCase().startsWith('punto') && !cleaned.toLowerCase().startsWith('foto')) {
                    const formatted = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
                    categoriesSet.add(formatted);
                }
            });
        }
    };

    // 1. Initial base service from trabajo
    addCat(trabajo?.servicio);
    addCat(trabajo?.categoria);
    addCat(trabajo?.tipo_servicio);
    addCat(trabajo?.nombre_servicio);
    if (trabajo?.titulo && trabajo.titulo.length < 30 && !trabajo.titulo.toLowerCase().includes('visita')) {
        addCat(trabajo.titulo);
    }

    // 2. reporteTienda
    if (reporteData?.reporteTienda && reporteData.reporteTienda.length < 40 && !reporteData.reporteTienda.includes('\n') && !reporteData.reporteTienda.includes('. [')) {
        addCat(reporteData.reporteTienda);
    }

    // 3. Extract bracket tags [Category] from descripcion
    if (reporteData?.descripcion) {
        const matches = reporteData.descripcion.match(/\[([^\]]+)\]/g);
        if (matches) {
            matches.forEach((m: string) => {
                const tag = m.replace(/[\[\]]/g, '').trim();
                if (tag && tag.length < 40 && !tag.toLowerCase().startsWith('punto') && !tag.toLowerCase().startsWith('foto')) {
                    const formatted = tag.charAt(0).toUpperCase() + tag.slice(1);
                    categoriesSet.add(formatted);
                }
            });
        }
    }

    // 4. Subtareas / ServiceData items
    if (subTareas && Array.isArray(subTareas)) {
        subTareas.forEach(st => {
            if (st.serviceData?.tipoServicio) addCat(st.serviceData.tipoServicio);
            if (st.serviceData?.items && Array.isArray(st.serviceData.items)) {
                st.serviceData.items.forEach((it: any) => {
                    const t = it.customTipo || it.tipo;
                    addCat(t);
                });
            }
            if (st.tipoActividad) addCat(st.tipoActividad);
            if (st.categoria) addCat(st.categoria);
        });
    }

    if (reporteData?.equipoInfo?.tipo) {
        addCat(reporteData.equipoInfo.tipo);
    }

    if (categoriesSet.size > 0) {
        return Array.from(categoriesSet).join(', ');
    }

    return reporteData?.reporteTienda || trabajo?.servicio || trabajo?.titulo || 'Servicio General';
};

export const parseWorkItems = (rawDesc: string) => {
    if (!rawDesc || !rawDesc.trim() || rawDesc === 'Sin descripción de trabajo.' || rawDesc === 'Sin descripción registrada.') {
        return [];
    }
    const cleanDesc = rawDesc.split('|||SERVICE_DATA|||')[0].trim();
    if (!cleanDesc) return [];

    // Split by numbered pattern e.g. "1. ", "2. " or newlines
    const numberedMatches = cleanDesc.split(/(?=(?:^|\s+)\d+\.\s+)/g).map(s => s.trim()).filter(Boolean);
    if (numberedMatches.length > 1 || (numberedMatches.length === 1 && /^\d+\.\s+/.test(numberedMatches[0]))) {
        return numberedMatches.map(itemStr => {
            const withoutNum = itemStr.replace(/^\d+\.\s*/, '').trim();
            const tagMatch = withoutNum.match(/^\[([^\]]+)\]\s*([\s\S]*)$/);
            if (tagMatch) {
                return {
                    categoria: tagMatch[1].trim(),
                    texto: tagMatch[2].trim()
                };
            }
            return {
                categoria: '',
                texto: withoutNum
            };
        });
    }

    const lines = cleanDesc.split(/\n+/).map(l => l.trim()).filter(Boolean);
    if (lines.length > 1) {
        return lines.map(line => {
            const cleanLine = line.replace(/^\d+\.\s*/, '').trim();
            const tagMatch = cleanLine.match(/^\[([^\]]+)\]\s*([\s\S]*)$/);
            if (tagMatch) {
                return {
                    categoria: tagMatch[1].trim(),
                    texto: tagMatch[2].trim()
                };
            }
            return {
                categoria: '',
                texto: cleanLine
            };
        });
    }

    const tagMatch = cleanDesc.match(/^\[([^\]]+)\]\s*([\s\S]*)$/);
    if (tagMatch) {
        return [{
            categoria: tagMatch[1].trim(),
            texto: tagMatch[2].trim()
        }];
    }

    return [{
        categoria: '',
        texto: cleanDesc
    }];
};

export interface EvidenceItem {
    id: string | number;
    puntoNumero?: number;
    titulo: string;
    categoria?: string;
    descripcion?: string;
    foto: string;
}

export const getAllVisitEvidences = (reporteData: any, trabajo?: any): EvidenceItem[] => {
    // 1. If explicit puntosEvidencia array is passed
    if (reporteData?.puntosEvidencia && Array.isArray(reporteData.puntosEvidencia) && reporteData.puntosEvidencia.length > 0) {
        return reporteData.puntosEvidencia
            .filter((p: any) => p && p.foto)
            .map((p: any, idx: number) => ({
                id: `punto-${idx + 1}`,
                puntoNumero: p.punto || idx + 1,
                titulo: `Punto de Revisión ${p.punto || idx + 1}`,
                categoria: p.tipo || '',
                descripcion: p.descripcion || '',
                foto: p.foto
            }));
    }

    const parsedWorkItems = parseWorkItems(reporteData?.descripcion || '');

    // 2. If observacionesList is present with images
    if (reporteData?.observacionesList && Array.isArray(reporteData.observacionesList) && reporteData.observacionesList.length > 0) {
        const items: EvidenceItem[] = [];
        let count = 0;
        reporteData.observacionesList.forEach((obs: any, idx: number) => {
            const relatedWork = parsedWorkItems[idx];
            const imgs = (obs.imagenes && Array.isArray(obs.imagenes) ? obs.imagenes : (obs.foto ? [obs.foto] : [])).filter(Boolean);
            imgs.forEach((img: string) => {
                count++;
                items.push({
                    id: `obs-${idx}-${count}`,
                    puntoNumero: idx + 1,
                    titulo: `Punto de Revisión ${idx + 1}`,
                    categoria: relatedWork?.categoria || '',
                    descripcion: (obs.texto && obs.texto !== 'Sin observaciones registradas.') ? obs.texto : (relatedWork?.texto || ''),
                    foto: img
                });
            });
        });
        if (items.length > 0) return items;
    }

    // 3. Collect from standard imagenes (antes, durante, despues) and imagenesObservacion / imagenObservacion
    const allImgs: string[] = [];
    if (reporteData?.imagenes?.antes) allImgs.push(reporteData.imagenes.antes);
    if (reporteData?.imagenes?.durante) allImgs.push(reporteData.imagenes.durante);
    if (reporteData?.imagenes?.despues) allImgs.push(reporteData.imagenes.despues);
    if (reporteData?.imagenesObservacion && Array.isArray(reporteData.imagenesObservacion)) {
        reporteData.imagenesObservacion.forEach((img: string) => {
            if (img && !allImgs.includes(img)) allImgs.push(img);
        });
    }
    if (reporteData?.imagenObservacion && !allImgs.includes(reporteData.imagenObservacion)) {
        allImgs.push(reporteData.imagenObservacion);
    }

    return allImgs.filter(Boolean).map((img, idx) => {
        const work = parsedWorkItems[idx];
        return {
            id: `img-${idx + 1}`,
            puntoNumero: idx + 1,
            titulo: parsedWorkItems.length > 0 ? `Punto de Revisión ${idx + 1}` : `Foto ${idx + 1}`,
            categoria: work?.categoria || '',
            descripcion: work?.texto || '',
            foto: img
        };
    });
};

export default function ReportePDFPreview({ trabajo, reporteData, subTareas, isVisita: isVisitaProp, onClose, onSendToAdminAutonomo }: ReportePDFPreviewProps) {
    const isVisita = isVisitaProp ?? reporteData?.isVisita ?? (trabajo?.tipo === 'Visita' || trabajo?.originalTipo === 'Visita');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [customLogo, setCustomLogo] = useState<string | null>(null);

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    setCustomLogo(ev.target.result as string);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const [isGenerating, setIsGenerating] = useState(false);

    const handleDownload = async () => {
        setIsGenerating(true);
        try {
            const pageElements = document.querySelectorAll('#print-reporte-pdf .pdf-page');
            if (!pageElements || pageElements.length === 0) return;

            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
            const pdfWidth = pdf.internal.pageSize.getWidth();

            for (let i = 0; i < pageElements.length; i++) {
                const pageEl = pageElements[i] as HTMLElement;
                const canvas = await html2canvas(pageEl, {
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                    scrollX: 0,
                    scrollY: 0,
                    windowWidth: 1200,
                    onclone: (clonedDoc) => {
                        const printContainer = clonedDoc.getElementById('print-reporte-pdf');
                        if (printContainer) {
                            printContainer.style.transform = 'none';
                            printContainer.style.position = 'static';
                            printContainer.style.margin = '0';
                            printContainer.style.padding = '0';
                        }
                        const clonedPages = clonedDoc.querySelectorAll('.pdf-page');
                        clonedPages.forEach((p) => {
                            (p as HTMLElement).style.boxShadow = 'none';
                            (p as HTMLElement).style.margin = '0';
                            (p as HTMLElement).style.transform = 'none';
                        });
                    }
                });

                const imgData = canvas.toDataURL('image/jpeg', 0.92);
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                if (i > 0) {
                    pdf.addPage();
                }

                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
            }

            const dynamicFolio = `TRB-${(trabajo?.id || '').toString().padStart(5, '0')}`;
            pdf.save(`Reporte_${dynamicFolio}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const [screenWidth, setScreenWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setScreenWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const allVisitEvidences = getAllVisitEvidences(reporteData, trabajo);
    const mainImgsExist = !isVisita && !!(reporteData.imagenes?.antes || reporteData.imagenes?.durante || reporteData.imagenes?.despues);
    const hasObs = (reporteData.observacionesList && reporteData.observacionesList.length > 0) || reporteData.observaciones?.trim() || reporteData.imagenesObservacion?.length || reporteData.imagenObservacion;
    const hasEvidences = allVisitEvidences.length > 0;
    const totalPages = (mainImgsExist || hasObs || hasEvidences) ? 2 : 1;

    const isMobile = screenWidth < 768;
    const availableWidth = isMobile ? screenWidth - 30 : 800;
    const scale = availableWidth < 800 ? availableWidth / 800 : 1;
    const totalHeight = totalPages === 2 ? (1122.5 * 2 + 30) : 1122.5;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', flexDirection: 'column',
            alignItems: 'center', padding: '15px', backdropFilter: 'blur(5px)', overflowY: 'auto',
            boxSizing: 'border-box'
        }}>
            {/* Styles for clean A4 print preview */}
            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #print-reporte-pdf, #print-reporte-pdf * {
                        visibility: visible;
                    }
                    #print-reporte-pdf {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        background: transparent !important;
                    }
                    .pdf-page {
                        page-break-after: always;
                        break-after: page;
                        box-shadow: none !important;
                        border: none !important;
                        border-radius: 0 !important;
                        margin: 0 !important;
                        padding: 40px !important;
                        min-height: 297mm !important;
                        background: #fff !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>

            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleLogoUpload} 
                accept="image/*" 
                style={{ display: 'none' }} 
            />

            {/* Header Actions */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'center', gap: '10px', width: '100%', maxWidth: '800px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <button onClick={onClose} style={{ padding: '10px 15px', background: '#64748b', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', flex: '1 1 auto', justifyContent: 'center' }}>
                    <HiOutlineXMark size={18} /> CERRAR
                </button>
                <button onClick={() => fileInputRef.current?.click()} style={{ padding: '10px 15px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', flex: '1 1 auto', justifyContent: 'center' }}>
                    <HiOutlinePhoto size={18} /> CAMBIAR LOGO
                </button>
                {onSendToAdminAutonomo && (
                    <button onClick={onSendToAdminAutonomo} style={{ padding: '10px 15px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', flex: '1 1 auto', justifyContent: 'center' }}>
                        <HiOutlinePaperAirplane size={18} /> ENVIAR A ADMIN
                    </button>
                )}
                <button onClick={handleDownload} disabled={isGenerating} style={{ padding: '10px 15px', background: isGenerating ? '#94a3b8' : '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: isGenerating ? 'not-allowed' : 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', flex: '1 1 auto', justifyContent: 'center' }}>
                    <HiOutlineArrowDownTray size={18} /> {isGenerating ? 'GENERANDO...' : 'DESCARGAR'}
                </button>
                <button onClick={() => window.print()} style={{ padding: '10px 15px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', flex: '1 1 auto', justifyContent: 'center' }}>
                    <HiOutlinePrinter size={18} /> IMPRIMIR
                </button>
            </div>

            {/* Container that handles the scaled height and centering */}
            <div className="no-print" style={{ 
                width: '100%', 
                maxWidth: '800px',
                height: `${totalHeight * scale}px`, 
                overflow: 'hidden', 
                marginBottom: '40px',
                position: 'relative',
                display: 'flex',
                justifyContent: 'center',
                flexShrink: 0
            }}>
                {/* A4 Report sheet, scaled down on mobile */}
                <div id="print-reporte-pdf" style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '30px', 
                    width: '800px', 
                    minWidth: '800px', 
                    flexShrink: 0,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top center',
                    position: 'absolute',
                    top: 0
                }}>
                    
                    {/* PAGE 1 */}
                    <div className="pdf-page" style={{ position: 'relative', background: '#fff', padding: '50px', boxSizing: 'border-box', border: '1px solid #e2e8f0', borderRadius: '12px', minHeight: '297mm', fontFamily: 'Arial, sans-serif', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', width: '800px', minWidth: '800px' }}>
                    {/* Header Banner */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', padding: '15px 30px', margin: '-50px -50px 30px -50px', color: 'white' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            {customLogo ? (
                                <img src={customLogo} alt="Logo" style={{ maxHeight: '50px', maxWidth: '120px', objectFit: 'contain' }} />
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <div style={{ color: '#f59e0b', fontWeight: '900', fontSize: '22px', borderRight: '1px solid #475569', paddingRight: '10px', marginRight: '10px', lineHeight: 1.1 }}>
                                        AGENTE<br/>BUSINESS.
                                    </div>
                                    <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: '600', maxWidth: '80px', lineHeight: 1.2 }}>
                                        MANTENIMIENTO INFRAESTRUCTURA
                                    </div>
                                </div>
                            )}
                        </div>
                        {(() => {
                            const isVisita = trabajo?.tipo === 'Visita' || trabajo?.originalTipo === 'Visita';
                            return (
                                <div style={{ textAlign: 'right' }}>
                                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'white' }}>
                                        {isVisita ? 'COTIZACIÓN DE SERVICIO' : 'REPORTE DE SERVICIO'}
                                    </h2>
                                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '2px' }}>FECHA: {reporteData.fecha}</span>
                                </div>
                            );
                        })()}
                    </div>

                    <div style={{ borderBottom: '3px solid #c99b21', margin: '-30px -50px 25px -50px' }} />

                    {/* Grid info section */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
                        <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>Información General</h4>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: '#475569', flex: 1 }}>
                                    <div><strong>Sucursal:</strong> {trabajo?.negocio?.nombre || trabajo?.sucursal || '---'}</div>
                                    <div><strong>Encargado:</strong> {trabajo?.negocio?.encargado || trabajo?.encargado || '---'}</div>
                                    <div><strong>Técnico:</strong> {reporteData.tecnicoNombre || trabajo?.tecnico || trabajo?.trabajador?.nombre || '---'}</div>
                                    {reporteData.fechaInicio && (
                                        <div><strong>Inició:</strong> {reporteData.fechaInicio}</div>
                                    )}
                                </div>
                                {(() => {
                                    const techName = reporteData.tecnicoNombre || trabajo?.tecnico || trabajo?.trabajador?.nombre || '';
                                    const techAvatar = reporteData.tecnicoAvatar || getAvatarForTech(techName);
                                    if (techAvatar) {
                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '65px', textAlign: 'center', flexShrink: 0 }}>
                                                <img src={techAvatar} alt="Técnico" style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #cbd5e1', background: '#fff' }} />
                                                <span style={{ fontSize: '8px', fontWeight: 'bold', color: '#94a3b8' }}>TÉCNICO</span>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>
                        </div>

                        {(() => {
                            const isVisita = trabajo?.tipo === 'Visita' || trabajo?.originalTipo === 'Visita' || reporteData.isVisita;
                            const llegadaTask = subTareas?.find((t: any) => t.serviceData?.horaLlegada);
                            const diagnosticCategories = getDiagnosticCategories(trabajo, reporteData, subTareas);
                            return (
                                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                    <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>Detalles del Servicio</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: '#475569' }}>
                                        <div><strong>{isVisita ? 'Diagnóstico / Visita:' : 'Diagnóstico / Reporte:'}</strong> {diagnosticCategories}</div>
                                        {llegadaTask && (
                                            <div><strong>Hora de Llegada:</strong> {llegadaTask.serviceData.horaLlegada}</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Trabajo a Realizar / Realizado (Ubicado arriba de Materiales y Refacciones Cotizados) */}
                    {(() => {
                        const isVisita = trabajo?.tipo === 'Visita' || trabajo?.originalTipo === 'Visita' || reporteData.isVisita;
                        const workItems = parseWorkItems(reporteData.descripcion);

                        return (
                            <div style={{ marginBottom: '22px' }}>
                                <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase' }}>
                                    {isVisita ? 'Trabajo a Realizar' : 'Trabajo Realizado'}
                                </h4>
                                <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                    {workItems.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {workItems.map((item, idx) => (
                                                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '12px', color: '#334155', lineHeight: '1.4' }}>
                                                    <span style={{
                                                        background: '#1e293b',
                                                        color: '#ffffff',
                                                        minWidth: '20px',
                                                        height: '20px',
                                                        borderRadius: '50%',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '11px',
                                                        fontWeight: '800',
                                                        flexShrink: 0,
                                                        marginTop: '1px'
                                                    }}>
                                                        {idx + 1}
                                                    </span>
                                                    <div style={{ flex: 1 }}>
                                                        {item.categoria && (
                                                            <span style={{
                                                                background: '#e0f2fe',
                                                                color: '#0369a1',
                                                                border: '1px solid #bae6fd',
                                                                padding: '1px 7px',
                                                                borderRadius: '4px',
                                                                fontSize: '11px',
                                                                fontWeight: '700',
                                                                marginRight: '6px',
                                                                display: 'inline-block'
                                                            }}>
                                                                {item.categoria}
                                                            </span>
                                                        )}
                                                        <span style={{ whiteSpace: 'pre-wrap' }}>{item.texto || item.categoria}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                                            {isVisita ? 'Sin descripción de trabajo a realizar.' : 'Sin descripción de trabajo realizado.'}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Refacciones y Piezas Table */}
                    {(() => {
                        const isVisita = trabajo?.tipo === 'Visita' || trabajo?.originalTipo === 'Visita';
                        const totalAmount = (reporteData.refaccionesList || []).reduce((acc: number, ref: any) => {
                            const qty = Number(ref.cantidad || 1);
                            const unitPrice = parseFloat(ref.costo_estimado) || 0;
                            return acc + (qty * unitPrice);
                        }, 0);
                        const subtotal = totalAmount / 1.16;
                        const iva = totalAmount - subtotal;

                        return (
                            <div style={{ marginBottom: '25px' }}>
                                <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase' }}>
                                    {isVisita ? 'Materiales y Refacciones Cotizados' : 'Refacciones y Materiales Utilizados'}
                                </h4>
                                {reporteData.refaccionesList.length > 0 ? (
                                    <>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                                            <thead>
                                                <tr style={{ background: '#1e293b', color: 'white' }}>
                                                    <th style={{ padding: '8px 12px', width: '50px' }}>NO</th>
                                                    <th style={{ padding: '8px 12px' }}>CONCEPTO</th>
                                                    <th style={{ padding: '8px 12px', width: '70px', textAlign: 'center' }}>CANT</th>
                                                    <th style={{ padding: '8px 12px', width: '100px', textAlign: 'right' }}>PRECIO/U</th>
                                                    <th style={{ padding: '8px 12px', width: '100px', textAlign: 'right' }}>PRECIO</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {reporteData.refaccionesList.map((ref, idx) => {
                                                    const qty = Number(ref.cantidad || 1);
                                                    const unitPrice = parseFloat(ref.costo_estimado) || 0;
                                                    const totalPrice = qty * unitPrice;
                                                    return (
                                                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#f8fafc' : '#fff' }}>
                                                            <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{idx + 1}</td>
                                                            <td style={{ padding: '8px 12px', textTransform: 'uppercase' }}>{ref.pieza}</td>
                                                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>{qty}</td>
                                                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>{unitPrice > 0 ? `$${unitPrice.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : 'N/A'}</td>
                                                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>{totalPrice > 0 ? `$${totalPrice.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : 'N/A'}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                        
                                        {isVisita && totalAmount > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '15px' }}>
                                                <div style={{ width: '220px', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
                                                    <div style={{ display: 'flex', borderBottom: '1px solid #cbd5e1', background: '#f8fafc', fontSize: '11px' }}>
                                                        <div style={{ width: '55%', padding: '6px 8px', fontWeight: 'bold', textAlign: 'right', color: '#475569' }}>SUBTOTAL</div>
                                                        <div style={{ width: '45%', padding: '6px 8px', textAlign: 'right', fontWeight: 'bold', color: '#1e293b' }}>${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                                                    </div>
                                                    <div style={{ display: 'flex', borderBottom: '1px solid #cbd5e1', background: '#fff', fontSize: '11px' }}>
                                                        <div style={{ width: '55%', padding: '6px 8px', fontWeight: 'bold', textAlign: 'right', color: '#475569' }}>IVA (16%)</div>
                                                        <div style={{ width: '45%', padding: '6px 8px', textAlign: 'right', color: '#475569' }}>${iva.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                                                    </div>
                                                    <div style={{ display: 'flex', background: '#1e293b', color: '#fff', fontSize: '12px' }}>
                                                        <div style={{ width: '55%', padding: '6px 8px', fontWeight: 'bold', textAlign: 'right' }}>TOTAL</div>
                                                        <div style={{ width: '45%', padding: '6px 8px', textAlign: 'right', fontWeight: 'bold' }}>${totalAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#64748b' }}>
                                        No se registraron refacciones.
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* Otros materiales */}
                    {reporteData.materiales && !isVisita && (
                        <div style={{ marginBottom: '25px', background: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                            <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase' }}>Otros Materiales o Consumibles</h4>
                            <p style={{ margin: 0, fontSize: '12px', color: '#475569', whiteSpace: 'pre-wrap' }}>{reporteData.materiales}</p>
                        </div>
                    )}

                    {/* Especificaciones del equipo */}
                    {reporteData.involucraEquipo && reporteData.equipoInfo && (
                        <div style={{ marginBottom: '25px', background: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase' }}>Especificaciones del Equipo</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', fontSize: '12px', color: '#475569' }}>
                                <div><strong>Tipo:</strong> {reporteData.equipoInfo.tipo}</div>
                                <div><strong>Marca:</strong> {reporteData.equipoInfo.marca}</div>
                                <div><strong>Modelo:</strong> {reporteData.equipoInfo.modelo}</div>
                            </div>
                        </div>
                    )}

                    {/* Observaciones */}
                    <div style={{ marginBottom: '25px', background: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase' }}>
                            {isVisita ? 'Detalles o Notas Adicionales' : 'Observaciones Finales'}
                        </h4>
                        <p style={{ margin: 0, fontSize: '12px', color: '#475569', whiteSpace: 'pre-wrap' }}>
                            {isVisita 
                                ? ((reporteData.observaciones && reporteData.observaciones !== 'Sin observaciones' && reporteData.observaciones !== 'N/A') 
                                    ? reporteData.observaciones 
                                    : (getCleanNotes(reporteData.materiales) || 'Sin detalles o notas adicionales.'))
                                : (hasObs 
                                    ? 'Se anexan reportes fotográficos y observaciones en la hoja de Testigos Fotográficos.'
                                    : 'Sin observaciones adicionales.')
                            }
                        </p>
                    </div>

                    {/* Exclusivo Tienda */}
                    {!isVisita && (
                        <div style={{ marginTop: '20px', borderTop: '1px solid #cbd5e1', paddingTop: '15px' }}>
                                <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase', background: '#f8fafc', padding: '6px 12px', border: '1px solid #cbd5e1' }}>Exclusivo Tienda</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '11px', color: '#475569' }}>
                                    <div>
                                        <h5 style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>CALIFICACIÓN AL TÉCNICO Y A SU TRABAJO EN ESCALA DEL 1 AL 10</h5>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {[
                                                "Presentacion",
                                                "Trato del tecnico",
                                                "Disponibilidad",
                                                "Trabajo Realizado",
                                                "Limpieza del trabajo"
                                            ].map((item, idx) => (
                                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span>{item}</span>
                                                    <span style={{ borderBottom: '1px solid #cbd5e1', width: '120px', height: '12px' }}></span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <h5 style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>CALIFICACIÓN A LA EMPRESA</h5>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span>Tiempo de respuesta</span>
                                                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                                    <span>CALIFICACION</span>
                                                    <span style={{ borderBottom: '1px solid #cbd5e1', width: '40px', height: '12px' }}></span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span>Has visto mejoras con respecto al mantenimiento</span>
                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                    <span style={{ border: '1px solid #cbd5e1', padding: '2px 6px', fontSize: '9px', fontWeight: 'bold' }}>SI</span>
                                                    <span style={{ border: '1px solid #cbd5e1', padding: '2px 6px', fontSize: '9px', fontWeight: 'bold' }}>NO</span>
                                                    <span>CALIFICACION</span>
                                                    <span style={{ borderBottom: '1px solid #cbd5e1', width: '40px', height: '12px' }}></span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span>Estas satisfecho con tu proveedor</span>
                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                    <span style={{ border: '1px solid #cbd5e1', padding: '2px 6px', fontSize: '9px', fontWeight: 'bold' }}>SI</span>
                                                    <span style={{ border: '1px solid #cbd5e1', padding: '2px 6px', fontSize: '9px', fontWeight: 'bold' }}>NO</span>
                                                    <span>CALIFICACION</span>
                                                    <span style={{ borderBottom: '1px solid #cbd5e1', width: '40px', height: '12px' }}></span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ marginTop: '12px' }}>
                                    <strong style={{ fontSize: '10px', color: '#1e293b' }}>CONSEJO HACIA EL PROVEEDOR PARA SER MAS EFICIENTE:</strong>
                                    <div style={{ borderBottom: '1px solid #cbd5e1', height: '18px', marginTop: '4px' }}></div>
                                    <div style={{ borderBottom: '1px solid #cbd5e1', height: '18px' }}></div>
                                    <div style={{ borderBottom: '1px solid #cbd5e1', height: '18px' }}></div>
                                    <div style={{ borderBottom: '1px solid #cbd5e1', height: '18px' }}></div>
                                </div>
                            </div>
                        )}

                    {/* Firmas / Validación */}
                    {!isVisita && (
                        <div style={{ marginTop: '30px', borderTop: '1px solid #cbd5e1', paddingTop: '15px' }}>
                            <h4 style={{ margin: '0 0 15px 0', fontSize: '11px', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase', textAlign: 'center' }}>Validación y Conformidad</h4>
                            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', marginTop: '15px' }}>
                                <div style={{ textAlign: 'center', width: '200px' }}>
                                    <div style={{ borderBottom: '1px solid #475569', height: '60px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '5px' }}>
                                        {reporteData.firmaEmpresa && !reporteData.firmaEmpresa.startsWith('data:application/pdf') && (
                                            <img src={reporteData.firmaEmpresa} alt="Firma" style={{ maxHeight: '55px', maxWidth: '180px', objectFit: 'contain' }} />
                                        )}
                                    </div>
                                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', display: 'block', marginTop: '6px' }}>FIRMA ENCARGADO / SUCURSAL</span>
                                </div>
                                <div style={{ border: '1px solid #cbd5e1', width: '150px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '10px' }}>
                                    SELLO SUCURSAL
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Page Footer */}
                    <div style={{ position: 'absolute', bottom: '20px', left: 0, right: 0, textAlign: 'center', fontSize: '10px', color: '#94a3b8' }}>
                        Mantenere - Reporte de Servicio Digital | Página 1 de {totalPages}
                    </div>
                </div>

                {/* PAGE 2 */}
                {(mainImgsExist || hasObs || hasEvidences) && (
                    <div className="pdf-page" style={{ position: 'relative', background: '#fff', padding: '50px', boxSizing: 'border-box', border: '1px solid #e2e8f0', borderRadius: '12px', minHeight: '297mm', fontFamily: 'Arial, sans-serif', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', width: '800px', minWidth: '800px' }}>
                        {/* Header Banner */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', padding: '15px 30px', margin: '-50px -50px 30px -50px', color: 'white' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                {customLogo ? (
                                    <img src={customLogo} alt="Logo" style={{ maxHeight: '50px', maxWidth: '120px', objectFit: 'contain' }} />
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <div style={{ color: '#f59e0b', fontWeight: '900', fontSize: '22px', borderRight: '1px solid #475569', paddingRight: '10px', marginRight: '10px', lineHeight: 1.1 }}>
                                            AGENTE<br/>BUSINESS.
                                        </div>
                                        <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: '600', maxWidth: '80px', lineHeight: 1.2 }}>
                                            MANTENIMIENTO INFRAESTRUCTURA
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'white' }}>
                                    {isVisita ? 'REGISTRO DE VISITA' : 'TESTIGOS FOTOGRÁFICOS'}
                                </h2>
                                <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '2px' }}>FECHA: {reporteData.fecha}</span>
                            </div>
                        </div>

                        <div style={{ borderBottom: '3px solid #c99b21', margin: '-30px -50px 25px -50px' }} />

                        {/* Section Header */}
                        <h4 style={{ margin: '0 0 16px 0', fontSize: '12px', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
                            {isVisita ? 'Registro Fotográfico de la Visita' : 'Testigos Fotográficos del Servicio'}
                        </h4>

                        {/* 1. ETAPAS PRINCIPALES DEL SERVICIO (Antes, Durante, Después) */}
                        {mainImgsExist && (
                            <div style={{ marginBottom: '22px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                                    {/* 1. Antes */}
                                    <div style={{
                                        background: '#f8fafc',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '10px',
                                        padding: '10px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: '11px', fontWeight: '800', color: '#1e293b' }}>
                                                1. Antes (Estado Inicial)
                                            </span>
                                            <span style={{ fontSize: '9px', fontWeight: '700', color: '#0369a1', background: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>
                                                Inicial
                                            </span>
                                        </div>
                                        {reporteData.imagenes?.antes ? (
                                            <img 
                                                src={reporteData.imagenes.antes} 
                                                alt="Antes (Estado Inicial)" 
                                                style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }} 
                                            />
                                        ) : (
                                            <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', borderRadius: '6px', color: '#94a3b8', fontSize: '11px', fontStyle: 'italic', border: '1px dashed #cbd5e1' }}>
                                                Sin fotografía
                                            </div>
                                        )}
                                    </div>

                                    {/* 2. Durante */}
                                    <div style={{
                                        background: '#f8fafc',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '10px',
                                        padding: '10px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: '11px', fontWeight: '800', color: '#1e293b' }}>
                                                2. Durante (Proceso)
                                            </span>
                                            <span style={{ fontSize: '9px', fontWeight: '700', color: '#ca8a04', background: '#fef9c3', padding: '1px 6px', borderRadius: '4px' }}>
                                                Proceso
                                            </span>
                                        </div>
                                        {reporteData.imagenes?.durante ? (
                                            <img 
                                                src={reporteData.imagenes.durante} 
                                                alt="Durante (Proceso)" 
                                                style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }} 
                                            />
                                        ) : (
                                            <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', borderRadius: '6px', color: '#94a3b8', fontSize: '11px', fontStyle: 'italic', border: '1px dashed #cbd5e1' }}>
                                                Sin fotografía
                                            </div>
                                        )}
                                    </div>

                                    {/* 3. Después */}
                                    <div style={{
                                        background: '#f8fafc',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '10px',
                                        padding: '10px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: '11px', fontWeight: '800', color: '#1e293b' }}>
                                                3. Después (Finalizado)
                                            </span>
                                            <span style={{ fontSize: '9px', fontWeight: '700', color: '#15803d', background: '#dcfce7', padding: '1px 6px', borderRadius: '4px' }}>
                                                Final
                                            </span>
                                        </div>
                                        {reporteData.imagenes?.despues ? (
                                            <img 
                                                src={reporteData.imagenes.despues} 
                                                alt="Después (Finalizado)" 
                                                style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }} 
                                            />
                                        ) : (
                                            <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', borderRadius: '6px', color: '#94a3b8', fontSize: '11px', fontStyle: 'italic', border: '1px dashed #cbd5e1' }}>
                                                Sin fotografía
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 2. VISITAS / DIAGNÓSTICOS CON PUNTOS DE REVISIÓN (Si no hubo fases antes/durante/despues) */}
                        {!mainImgsExist && allVisitEvidences.length > 0 && (
                            <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: allVisitEvidences.length <= 4 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', 
                                gap: '16px', 
                                marginBottom: '20px' 
                            }}>
                                {allVisitEvidences.map((evi, idx) => (
                                    <div key={evi.id || idx} style={{
                                        background: '#f8fafc',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '10px',
                                        padding: '12px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                            <span style={{ fontSize: '11px', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase' }}>
                                                {evi.titulo || `Punto ${idx + 1}`}
                                            </span>
                                            {evi.categoria && (
                                                <span style={{
                                                    background: '#e0f2fe',
                                                    color: '#0369a1',
                                                    border: '1px solid #bae6fd',
                                                    padding: '1px 6px',
                                                    borderRadius: '4px',
                                                    fontSize: '9px',
                                                    fontWeight: '700'
                                                }}>
                                                    {evi.categoria}
                                                </span>
                                            )}
                                        </div>
                                        <img 
                                            src={evi.foto} 
                                            alt={evi.titulo || `Evidencia ${idx + 1}`} 
                                            style={{
                                                width: '100%',
                                                height: allVisitEvidences.length <= 4 ? '160px' : '120px',
                                                objectFit: 'cover',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                background: '#fff'
                                            }} 
                                        />
                                        {evi.descripcion && (
                                            <p style={{
                                                margin: 0,
                                                fontSize: '10px',
                                                color: '#475569',
                                                lineHeight: '1.3',
                                                whiteSpace: 'pre-wrap',
                                                maxHeight: '40px',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }}>
                                                {evi.descripcion}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 3. OBSERVACIONES ADICIONALES (Oculto en reportes de visita ya que los puntos de revisión contienen las fotos y notas completas) */}
                        {!isVisita && (
                            reporteData.observacionesList && reporteData.observacionesList.length > 0 ? (
                                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <h5 style={{ margin: '0 0 4px 0', fontSize: '11px', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase' }}>
                                        Observaciones Adicionales ({reporteData.observacionesList.length})
                                    </h5>
                                    {reporteData.observacionesList.map((obs, idx) => {
                                        const imgs = (obs.imagenes && Array.isArray(obs.imagenes) ? obs.imagenes : (obs.foto ? [obs.foto] : [])).filter(Boolean);
                                        return (
                                            <div key={obs.id || idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#334155' }}>
                                                        📝 Observación #{idx + 1}
                                                    </span>
                                                </div>
                                                {obs.texto && obs.texto.trim() && obs.texto !== 'Sin observaciones registradas.' && (
                                                    <p style={{ margin: 0, fontSize: '11px', color: '#475569', background: '#fff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap' }}>
                                                        {obs.texto}
                                                    </p>
                                                )}
                                                {imgs.length > 0 && (
                                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '2px' }}>
                                                        {imgs.map((img: string, imgIdx: number) => (
                                                            <div key={imgIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                                                <img 
                                                                    src={img} 
                                                                    alt={`Obs #${idx + 1} Foto ${imgIdx + 1}`} 
                                                                    style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }} 
                                                                />
                                                                <span style={{ fontSize: '9px', color: '#64748b', fontWeight: '600' }}>Foto {imgIdx + 1}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                /* Fallback para observaciones en texto plano */
                                reporteData.observaciones && reporteData.observaciones.trim() && !reporteData.observaciones.toLowerCase().includes('sin observaciones') && (
                                    <div style={{ marginTop: '12px', background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                        <h5 style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase' }}>Observaciones Adicionales</h5>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#475569', whiteSpace: 'pre-wrap' }}>{reporteData.observaciones}</p>
                                        {((reporteData.imagenesObservacion && reporteData.imagenesObservacion.length > 0) || reporteData.imagenObservacion) && (
                                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
                                                {(reporteData.imagenesObservacion || [reporteData.imagenObservacion]).filter(Boolean).map((img, imgIdx) => (
                                                    <img key={imgIdx} src={img} alt={`Extra ${imgIdx + 1}`} style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }} />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            )
                        )}

                        {/* Mensaje si no hay evidencias ni observaciones */}
                        {!mainImgsExist && allVisitEvidences.length === 0 && !hasObs && (
                            <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                                No se registraron evidencias fotográficas ni observaciones adicionales.
                            </div>
                        )}

                        {/* Page Footer */}
                        <div style={{ position: 'absolute', bottom: '20px', left: 0, right: 0, textAlign: 'center', fontSize: '10px', color: '#94a3b8' }}>
                            Mantenere - Reporte de Servicio Digital | Página 2 de {totalPages}
                        </div>
                    </div>
                )}

            </div>
        </div>
    </div>
  );
}
