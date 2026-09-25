import React, { useState, useEffect } from "react";
import ReporteDetailModal from "./ReporteDetailModal";
import { getTrabajo } from "../../services/trabajosService";
import { getReporteByTrabajoId } from "../../services/reportesService";

interface DetalleReporteModalProps {
    isOpen: boolean;
    onClose: () => void;
    trabajoId: number;
    reporteData?: any;
    equipo?: any;
}

const DetalleReporteModal: React.FC<DetalleReporteModalProps> = ({ isOpen, onClose, trabajoId, reporteData, equipo }) => {
    const [loading, setLoading] = useState(true);
    const [trabajo, setTrabajo] = useState<any>(null);
    const [reporte, setReporte] = useState<any>(null);
    const [taskInfo, setTaskInfo] = useState<any>(null);

    useEffect(() => {
        if (!isOpen || !trabajoId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Obtener datos del trabajo
                const jobData = await getTrabajo(trabajoId);
                
                // Formatear para el modal de detalle
                const formattedTrabajo = {
                    id: jobData.id,
                    sucursal: jobData.negocio?.nombre || 'N/A',
                    tecnico: jobData.trabajador?.nombre || jobData.tecnico?.name || 'No asignado',
                    encargado: jobData.negocio?.encargado || jobData.contactos?.[0]?.nombre || 'N/A',
                    cotizacion: jobData.cotizacion ? {
                        costo: jobData.cotizacion.costo_estimado || jobData.cotizacion.monto,
                        notas: jobData.cotizacion.notas_cliente || jobData.cotizacion.notas,
                        archivo: jobData.cotizacion.archivo_presupuesto || jobData.cotizacion.archivo_url
                    } : undefined
                };

                const formattedTask = {
                    id: reporteData?.dbId || reporteData?.id || jobData.id,
                    titulo: reporteData?.equipoInfo?.tipo || reporteData?.tipoServicio || jobData.titulo || 'Mantenimiento de Equipo',
                    fecha: reporteData?.fecha || jobData.fecha_programada || new Date(jobData.created_at).toLocaleDateString()
                };

                setTrabajo(formattedTrabajo);
                setTaskInfo(formattedTask);

                // 2. Si ya viene el reporte específico (ej. desde bitácora de equipo), usarlo directamente
                if (reporteData) {
                    setReporte(reporteData);
                } else {
                    // 3. Obtener datos del reporte desde BD
                    const reportRes = await getReporteByTrabajoId(trabajoId);
                    if (reportRes && reportRes.solucion) {
                        try {
                            const parsed = JSON.parse(reportRes.solucion);
                            setReporte({ ...parsed, dbId: reportRes.id });
                        } catch (e) {
                            setReporte({
                                id: reportRes.id,
                                descripcion: reportRes.descripcion,
                                fecha: reportRes.fecha
                            });
                        }
                    }
                }
            } catch (error) {
                console.error("Error fetching report details:", error);
                if (reporteData) {
                    setReporte(reporteData);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [isOpen, trabajoId, reporteData]);

    if (!isOpen) return null;

    if (loading) {
        return (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ background: 'white', padding: '30px', borderRadius: '15px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                    <div className="loader-mantenere"></div>
                    <p style={{ color: '#64748b', margin: 0 }}>Cargando reporte técnico...</p>
                </div>
            </div>
        );
    }

    return (
        <ReporteDetailModal 
            isOpen={isOpen}
            onClose={onClose}
            trabajo={trabajo}
            task={taskInfo}
            reporte={reporte}
        />
    );
};

export default DetalleReporteModal;
