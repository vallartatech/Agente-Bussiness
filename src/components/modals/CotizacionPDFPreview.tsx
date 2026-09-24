import React, { useRef, useState, useEffect } from 'react';
import { HiOutlineXMark, HiOutlinePrinter, HiOutlineArrowDownTray } from 'react-icons/hi2';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { getDiagnosticCategories, parseWorkItems } from './ReportePDFPreview';

interface CotizacionPDFPreviewProps {
    trabajo: any;
    subTareas?: any[];
    costo: string | number;
    notas?: string;
    materials?: any[];
    manoObra?: string | number;
    acceptedItems?: any[];
    titulo?: string;
    propuestaIndex?: number;
    categoria?: string;
    equipo?: { nombre: string; marca?: string; modelo?: string; area?: string } | null;
    fotos?: { url: string; label?: string }[] | string[];
    isCombinado?: boolean;
    itemsList?: any[];
    onClose: () => void;
}

export default function CotizacionPDFPreview({
    trabajo,
    subTareas,
    costo,
    notas,
    materials = [],
    manoObra = 0,
    acceptedItems,
    titulo,
    propuestaIndex,
    categoria,
    equipo,
    fotos = [],
    isCombinado = false,
    itemsList = [],
    onClose
}: CotizacionPDFPreviewProps) {
    const pdfRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [screenWidth, setScreenWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setScreenWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleDownload = async () => {
        if (!pdfRef.current) return;
        setIsGenerating(true);
        try {
            const canvas = await html2canvas(pdfRef.current, { 
                scale: 2, 
                useCORS: true, 
                allowTaint: true,
                backgroundColor: '#ffffff',
                scrollX: 0,
                scrollY: 0,
                windowWidth: 1200,
                onclone: (clonedDoc) => {
                    const el = clonedDoc.querySelector('[style*="transform"]') as HTMLElement;
                    if (el) {
                        el.style.transform = 'none';
                        el.style.position = 'static';
                        el.style.margin = '0';
                    }
                }
            });
            const imgData = canvas.toDataURL('image/jpeg', 0.92);
            
            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            if (pdfHeight <= pageHeight) {
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
            } else {
                let position = 0;
                let heightLeft = pdfHeight;
                while (heightLeft > 0) {
                    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
                    heightLeft -= pageHeight;
                    position -= pageHeight;
                    if (heightLeft > 0) {
                        pdf.addPage();
                    }
                }
            }

            const folioSuffix = isCombinado ? 'Combinada' : `Propuesta_${propuestaIndex || 1}`;
            pdf.save(`Cotizacion_${folioSuffix}_${trabajo?.id || 'Nuevo'}.pdf`);
        } catch (error) {
            console.error('Error generating preview:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    // Calculate totals
    const totalAmount = parseFloat(String(costo)) || 0;
    const subtotal = totalAmount / 1.16;
    const iva = totalAmount - subtotal;

    const isMobile = screenWidth < 768;
    const availableWidth = isMobile ? screenWidth - 30 : 800;
    const scale = availableWidth < 800 ? availableWidth / 800 : 1;

    const defaultDiagnostic = getDiagnosticCategories(trabajo, { reporteTienda: trabajo?.titulo, descripcion: trabajo?.descripcion }, subTareas);
    const diagnosticText = isCombinado
        ? `Cotización Integral — Múltiples Especialidades`
        : (categoria ? `${categoria} — ${titulo || 'Servicio Técnico'}` : defaultDiagnostic);

    const validMaterials = (materials || []).filter((m: any) => m && m.material && String(m.material).trim() !== '');

    // Normalize fotos array
    const normalizedFotos: { url: string; label: string }[] = (fotos || []).map((f: any, idx: number) => {
        if (typeof f === 'string') {
            return { url: f, label: `Evidencia #${idx + 1}` };
        }
        return { url: f.url, label: f.label || `Evidencia #${idx + 1}` };
    }).filter(f => f.url && f.url.trim() !== '');

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', flexDirection: 'column',
            alignItems: 'center', padding: '15px', backdropFilter: 'blur(5px)', overflowY: 'auto',
            boxSizing: 'border-box'
        }}>
            {/* Header Actions */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', width: '100%', maxWidth: '800px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <button onClick={onClose} style={{ padding: '10px 15px', background: '#64748b', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', flex: '1 1 auto', justifyContent: 'center' }}>
                    <HiOutlineXMark size={18} /> REGRESAR
                </button>
                <button onClick={handleDownload} disabled={isGenerating} style={{ padding: '10px 15px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', flex: '1 1 auto', justifyContent: 'center' }}>
                    <HiOutlineArrowDownTray size={18} /> {isGenerating ? 'GENERANDO...' : 'GUARDAR (DESCARGAR)'}
                </button>
                <button onClick={() => window.print()} style={{ padding: '10px 15px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', flex: '1 1 auto', justifyContent: 'center' }}>
                    <HiOutlinePrinter size={18} /> IMPRIMIR
                </button>
            </div>

            {/* Container that handles the scaled height and centering */}
            <div style={{ 
                width: '100%', 
                maxWidth: '800px',
                minHeight: `${1131 * scale}px`, 
                marginBottom: '40px',
                position: 'relative',
                display: 'flex',
                justifyContent: 'center',
                flexShrink: 0
            }}>
                {/* A4 PDF Canvas Container with shadow, scaled down on mobile */}
                <div style={{ 
                    boxShadow: '0 20px 40px rgba(0,0,0,0.2)', 
                    width: '800px', 
                    minWidth: '800px', 
                    flexShrink: 0,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top center',
                    position: 'relative'
                }}>
                    <div 
                        ref={pdfRef}
                        style={{
                            background: '#fff', width: '800px', minHeight: '1131px',
                            padding: '50px', boxSizing: 'border-box', position: 'relative',
                            fontFamily: 'Arial, sans-serif'
                        }}
                    >
                    {/* Header Banner */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', padding: '15px 30px', margin: '-50px -50px 30px -50px', color: 'white' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <div style={{ color: '#f59e0b', fontWeight: '900', fontSize: '22px', borderRight: '1px solid #475569', paddingRight: '10px', marginRight: '10px', lineHeight: 1.1 }}>
                                    AGENTE<br/>BUSINESS.
                                </div>
                                <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: '600', maxWidth: '80px', lineHeight: 1.2 }}>
                                    MANTENIMIENTO INFRAESTRUCTURA
                                </div>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: 'white' }}>
                                {isCombinado ? 'COTIZACIÓN INTEGRAL DE SERVICIO' : `COTIZACIÓN DE SERVICIO — PROPUESTA #${propuestaIndex || 1}`}
                            </h2>
                            <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '2px' }}>
                                FECHA: {new Date().toLocaleDateString('es-MX')}
                            </span>
                        </div>
                    </div>

                    <div style={{ borderBottom: '3px solid #c99b21', margin: '-30px -50px 25px -50px' }} />

                    {/* Grid info section */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '22px' }}>
                        <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>Información General</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: '#475569' }}>
                                <div><strong>Sucursal:</strong> {trabajo?.sucursal || trabajo?.negocio?.nombre || 'N/A'}</div>
                                <div><strong>Encargado:</strong> {trabajo?.encargado || trabajo?.cliente || trabajo?.negocio?.encargado || 'Cliente General'}</div>
                                <div><strong>Técnico Responsable:</strong> {trabajo?.tecnico || 'Técnico Asignado'}</div>
                            </div>
                        </div>
                        <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>Detalles del Servicio</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: '#475569' }}>
                                <div><strong>Diagnóstico / Visita:</strong> {diagnosticText}</div>
                                {(() => {
                                    const llegadaTask = subTareas?.find((t: any) => t.serviceData?.horaLlegada);
                                    if (llegadaTask) {
                                        return <div><strong>Hora de Levantamiento:</strong> {llegadaTask.serviceData.horaLlegada}</div>;
                                    }
                                    return null;
                                })()}
                                {equipo && (
                                    <div><strong>Equipo:</strong> {equipo.nombre} {equipo.marca ? `(${equipo.marca})` : ''}</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Trabajo a Realizar */}
                    <div style={{ marginBottom: '22px' }}>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase' }}>
                            {isCombinado ? 'Desglose de Propuestas a Realizar' : 'Trabajo a Realizar'}
                        </h4>
                        <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                            {isCombinado && itemsList && itemsList.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {itemsList.map((it: any, idx: number) => (
                                        <div key={idx} style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 14px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ background: '#1e293b', color: '#ffffff', fontSize: '11px', fontWeight: '800', padding: '2px 7px', borderRadius: '4px' }}>
                                                        PROPUESTA #{idx + 1}
                                                    </span>
                                                    {it.categoria && (
                                                        <span style={{
                                                            background: it.categoria.includes('Mantenimiento') ? '#eff6ff' : (it.categoria.includes('Plomería') ? '#fff7ed' : '#eef2ff'),
                                                            color: it.categoria.includes('Mantenimiento') ? '#1d4ed8' : (it.categoria.includes('Plomería') ? '#c2410c' : '#4338ca'),
                                                            border: '1px solid currentColor',
                                                            padding: '1px 8px',
                                                            borderRadius: '10px',
                                                            fontSize: '11px',
                                                            fontWeight: '800'
                                                        }}>
                                                            {it.categoria}
                                                        </span>
                                                    )}
                                                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>{it.titulo}</strong>
                                                </div>
                                                <strong style={{ fontSize: '13.5px', color: '#f26522' }}>
                                                    ${(Number(it.total) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </strong>
                                            </div>
                                            {it.equipo && (
                                                <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '6px', padding: '6px 10px', fontSize: '11px', color: '#475569', display: 'flex', gap: '12px', marginTop: '6px' }}>
                                                    <span><strong>Equipo:</strong> {it.equipo.nombre}</span>
                                                    {it.equipo.marca && <span><strong>Marca:</strong> {it.equipo.marca}</span>}
                                                    {it.equipo.modelo && <span><strong>Modelo:</strong> {it.equipo.modelo}</span>}
                                                    {it.equipo.area && <span><strong>Área:</strong> {it.equipo.area}</span>}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ background: '#1e293b', color: '#ffffff', minWidth: '22px', height: '22px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800' }}>
                                            {propuestaIndex || 1}
                                        </span>
                                        {categoria && (
                                            <span style={{
                                                background: categoria.includes('Mantenimiento') ? '#eff6ff' : (categoria.includes('Plomería') ? '#fff7ed' : '#eef2ff'),
                                                color: categoria.includes('Mantenimiento') ? '#1d4ed8' : (categoria.includes('Plomería') ? '#c2410c' : '#4338ca'),
                                                border: '1px solid currentColor',
                                                padding: '2px 9px',
                                                borderRadius: '10px',
                                                fontSize: '11.5px',
                                                fontWeight: '800'
                                            }}>
                                                {categoria}
                                            </span>
                                        )}
                                        <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>{titulo || trabajo?.titulo || 'Servicio Técnico'}</strong>
                                    </div>
                                    {equipo && (
                                        <div style={{ background: '#fff', border: '1.5px solid #bfdbfe', borderRadius: '8px', padding: '8px 12px', fontSize: '11.5px', color: '#1e3a8a', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginTop: '6px' }}>
                                            <div><span style={{ color: '#64748b', fontSize: '10px', fontWeight: '800', display: 'block' }}>EQUIPO:</span> <strong>{equipo.nombre}</strong></div>
                                            {equipo.marca && <div><span style={{ color: '#64748b', fontSize: '10px', fontWeight: '800', display: 'block' }}>MARCA:</span> <strong>{equipo.marca}</strong></div>}
                                            {equipo.modelo && <div><span style={{ color: '#64748b', fontSize: '10px', fontWeight: '800', display: 'block' }}>MODELO:</span> <strong>{equipo.modelo}</strong></div>}
                                            {equipo.area && <div><span style={{ color: '#64748b', fontSize: '10px', fontWeight: '800', display: 'block' }}>ÁREA:</span> <strong>{equipo.area}</strong></div>}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Table Heading */}
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase' }}>
                        MATERIALES Y REFACCIONES COTIZADOS
                    </h4>

                    {/* Table */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left', marginBottom: '15px' }}>
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
                            {isCombinado && itemsList && itemsList.length > 0 ? (
                                <>
                                    {itemsList.map((it: any, itIdx: number) => {
                                        const pMats = (it.materials || []).filter((m: any) => m && m.material && String(m.material).trim() !== '');
                                        const pLabor = parseFloat(String(it.manoObra)) || 0;
                                        return (
                                            <React.Fragment key={itIdx}>
                                                <tr style={{ background: '#f1f5f9', borderTop: '2px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>
                                                    <td colSpan={5} style={{ padding: '6px 12px', fontWeight: '800', color: '#1e293b', fontSize: '11.5px' }}>
                                                        PROPUESTA #{itIdx + 1}: {it.titulo} {it.categoria ? `— ${it.categoria}` : ''}
                                                    </td>
                                                </tr>
                                                {pMats.map((m: any, mIdx: number) => {
                                                    const qty = parseFloat(m.piezas) || 1;
                                                    const price = parseFloat(m.precio) || 0;
                                                    const total = qty * price;
                                                    return (
                                                        <tr key={`m_${mIdx}`} style={{ borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                                                            <td style={{ padding: '6px 12px', fontSize: '11px', color: '#64748b' }}>{itIdx + 1}.{mIdx + 1}</td>
                                                            <td style={{ padding: '6px 12px' }}>
                                                                <span style={{ fontSize: '9px', background: '#fef3c7', color: '#b45309', padding: '1px 5px', borderRadius: '3px', marginRight: '5px', fontWeight: 'bold' }}>MATERIAL</span>
                                                                {m.material}
                                                            </td>
                                                            <td style={{ padding: '6px 12px', textAlign: 'center' }}>{qty}</td>
                                                            <td style={{ padding: '6px 12px', textAlign: 'right' }}>${price.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                            <td style={{ padding: '6px 12px', textAlign: 'right' }}>${total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                        </tr>
                                                    );
                                                })}
                                                {pLabor > 0 && (
                                                    <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                                                        <td style={{ padding: '6px 12px', fontSize: '11px', color: '#64748b' }}>{itIdx + 1}.{pMats.length + 1}</td>
                                                        <td style={{ padding: '6px 12px' }}>
                                                            <span style={{ fontSize: '9px', background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '3px', marginRight: '5px', fontWeight: 'bold' }}>MANO DE OBRA</span>
                                                            Mano de Obra / Servicio Técnico — {it.titulo}
                                                        </td>
                                                        <td style={{ padding: '6px 12px', textAlign: 'center' }}>1</td>
                                                        <td style={{ padding: '6px 12px', textAlign: 'right' }}>${pLabor.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                        <td style={{ padding: '6px 12px', textAlign: 'right' }}>${pLabor.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </>
                            ) : acceptedItems && acceptedItems.length > 0 ? (
                                acceptedItems.map((item: any, idx: number) => {
                                    const qty = parseFloat(String(item.cantidad || '1').replace(/[^0-9.]/g, '')) || 1;
                                    const price = parseFloat(item.precio) || 0;
                                    const total = qty * price;
                                    return (
                                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#f8fafc' : '#fff' }}>
                                            <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{idx + 1}</td>
                                            <td style={{ padding: '8px 12px', textTransform: 'uppercase' }}>
                                                <span style={{ fontSize: '10px', background: item.tipo === 'concepto' ? '#e0f2fe' : '#fef3c7', color: item.tipo === 'concepto' ? '#0369a1' : '#b45309', padding: '2px 6px', borderRadius: '4px', marginRight: '6px', fontWeight: 'bold' }}>
                                                    {item.tipo === 'concepto' ? 'SERVICIO' : 'MATERIAL'}
                                                </span>
                                                {item.nombre}
                                            </td>
                                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>{qty}</td>
                                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>${price.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>${total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <>
                                    {validMaterials.map((m: any, idx: number) => {
                                        const qty = parseFloat(m.piezas) || 1;
                                        const price = parseFloat(m.precio) || 0;
                                        const total = qty * price;
                                        return (
                                            <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#f8fafc' : '#fff' }}>
                                                <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{idx + 1}</td>
                                                <td style={{ padding: '8px 12px', textTransform: 'uppercase' }}>
                                                    <span style={{ fontSize: '10px', background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px', marginRight: '6px', fontWeight: 'bold' }}>MATERIAL</span>
                                                    {m.material}
                                                </td>
                                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>{qty}</td>
                                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>${price.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>${total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            </tr>
                                        );
                                    })}
                                    {parseFloat(String(manoObra)) > 0 && (
                                        <tr style={{ borderBottom: '1px solid #e2e8f0', background: validMaterials.length % 2 === 0 ? '#f8fafc' : '#fff' }}>
                                            <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{validMaterials.length + 1}</td>
                                            <td style={{ padding: '8px 12px', textTransform: 'uppercase' }}>
                                                <span style={{ fontSize: '10px', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', marginRight: '6px', fontWeight: 'bold' }}>SERVICIO</span>
                                                MANO DE OBRA / SERVICIO TÉCNICO {titulo ? `— ${titulo}` : ''}
                                            </td>
                                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>1</td>
                                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>${parseFloat(String(manoObra)).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>${parseFloat(String(manoObra)).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>
                                    )}
                                    {validMaterials.length === 0 && parseFloat(String(manoObra)) <= 0 && (
                                        <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                                            <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>1</td>
                                            <td style={{ padding: '8px 12px', textTransform: 'uppercase' }}>{titulo || trabajo?.titulo || 'SERVICIO DE MANTENIMIENTO INTEGRAL'}</td>
                                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>1</td>
                                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>
                                    )}
                                </>
                            )}
                        </tbody>
                    </table>

                    {/* Totals Section */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '15px' }}>
                        <div style={{ width: '240px', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', borderBottom: '1px solid #cbd5e1', background: '#f8fafc', fontSize: '11px' }}>
                                <div style={{ width: '55%', padding: '6px 8px', fontWeight: 'bold', textAlign: 'right', color: '#475569' }}>SUBTOTAL</div>
                                <div style={{ width: '45%', padding: '6px 8px', textAlign: 'right', fontWeight: 'bold', color: '#1e293b' }}>${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            </div>
                            <div style={{ display: 'flex', borderBottom: '1px solid #cbd5e1', background: '#fff', fontSize: '11px' }}>
                                <div style={{ width: '55%', padding: '6px 8px', fontWeight: 'bold', textAlign: 'right', color: '#475569' }}>IVA (16%)</div>
                                <div style={{ width: '45%', padding: '6px 8px', textAlign: 'right', color: '#475569' }}>${iva.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            </div>
                            <div style={{ display: 'flex', background: '#1e293b', color: '#fff', fontSize: '12px' }}>
                                <div style={{ width: '55%', padding: '7px 8px', fontWeight: 'bold', textAlign: 'right' }}>TOTAL</div>
                                <div style={{ width: '45%', padding: '7px 8px', textAlign: 'right', fontWeight: 'bold' }}>${totalAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            </div>
                        </div>
                    </div>

                    {/* Detalles o notas adicionales */}
                    {notas && (
                        <div style={{ marginTop: '22px' }}>
                            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase' }}>
                                DETALLES O NOTAS ADICIONALES
                            </h4>
                            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '11.5px', color: '#475569', minHeight: '40px', whiteSpace: 'pre-wrap' }}>
                                {notas}
                            </div>
                        </div>
                    )}

                    {/* Evidencia Fotográfica del Técnico */}
                    {normalizedFotos.length > 0 && (
                        <div style={{ marginTop: '25px', pageBreakInside: 'avoid' }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                📷 EVIDENCIA FOTOGRÁFICA DEL TÉCNICO ({normalizedFotos.length})
                            </h4>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: normalizedFotos.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))',
                                gap: '12px'
                            }}>
                                {normalizedFotos.map((imgObj, fIdx) => (
                                    <div key={fIdx} style={{
                                        background: '#f8fafc',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '8px',
                                        padding: '8px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}>
                                        <img
                                            src={imgObj.url}
                                            alt={imgObj.label}
                                            crossOrigin="anonymous"
                                            style={{
                                                width: '100%',
                                                maxHeight: normalizedFotos.length === 1 ? '220px' : '140px',
                                                objectFit: 'cover',
                                                borderRadius: '6px',
                                                border: '1px solid #e2e8f0'
                                            }}
                                        />
                                        <span style={{ fontSize: '10px', color: '#475569', fontWeight: '700', textAlign: 'center', lineHeight: '1.2' }}>
                                            {imgObj.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Footer decoration */}
                    <div style={{ marginTop: '30px', borderTop: '1px solid #e2e8f0', paddingTop: '15px', fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>
                        Este documento es una cotización preliminar elaborada por Agente Business y está sujeta a cambios y aprobación final.
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}
