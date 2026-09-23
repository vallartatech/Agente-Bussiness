import { useState, useEffect } from 'react';
import { getTrabajos, updateEstadoTrabajo } from '../../../services/trabajosService';
import { getMantenimientoSolicitudes } from '../../../services/mantenimientoService';
import type { Trabajo } from '../../../types/trabajo.types';

export interface TrabajosDataReturn {
    trabajosData: Trabajo[];
    setTrabajosData: React.Dispatch<React.SetStateAction<Trabajo[]>>;
    saveJobs: (data: Trabajo[]) => void;
    reloadTrabajosList: () => Promise<void>;
    allSolicitudes: any[];
}

/**
 * Hook que centraliza la carga y transformación de trabajos y solicitudes
 * de mantenimiento de una sucursal. Se re-ejecuta cuando el businessName
 * deja de estar en "Cargando..." (señal de que el negocio ya está disponible).
 */
export const useTrabajosData = (
    id: string | undefined,
    businessName: string
): TrabajosDataReturn => {
    const [trabajosData, setTrabajosData] = useState<Trabajo[]>([]);
    const [allSolicitudes, setAllSolicitudes] = useState<any[]>([]);

    // Cargar historial de solicitudes de mantenimiento
    useEffect(() => {
        const fetchHistory = async () => {
            if (!id) return;
            try {
                const solicitudesBackend = await getMantenimientoSolicitudes(Number(id));
                const mappedSolicitudes = solicitudesBackend.map((sol: any) => {
                    const mappedReportes: any[] = [];
                    [sol.visita_trabajo, sol.reparacion_trabajo].forEach(t => {
                        if (t?.reporte?.solucion) {
                            try {
                                const parsed = JSON.parse(t.reporte.solucion);
                                if (parsed.descripcion || parsed.reporteTienda) {
                                    mappedReportes.push({
                                        id: t.id,
                                        fecha: t.reporte.fecha,
                                        diagnostico: parsed.reporteTienda || t.reporte.descripcion,
                                        descripcion: parsed.descripcion || t.reporte.descripcion,
                                        materiales: parsed.materiales,
                                        tipo: t.tipo || 'Reparación',
                                        imagenes: parsed.imagenes,
                                        firmaEmpresa: parsed.firmaEmpresa,
                                        solucion: t.reporte.solucion
                                    });
                                }
                            } catch (e) {
                                console.error('Error parseando reporte:', e);
                            }
                        }
                    });

                    return {
                        ...sol,
                        id: sol.id,
                        levantamiento_equipo_id: sol.levantamiento_equipo_id || sol.levantamiento_equipo?.id || sol.equipo_id,
                        descripcion: sol.descripcion_problema,
                        descripcion_problema: sol.descripcion_problema,
                        estado: sol.estado,
                        fecha: new Date(sol.created_at).toLocaleDateString('es-MX'),
                        tipo: 'Mantenimiento',
                        reportes: mappedReportes,
                        actualTrabajoId: sol.reparacion_trabajo?.id || sol.reparacion_trabajo_id || sol.visita_trabajo?.id || sol.visita_trabajo_id
                    };
                });
                setAllSolicitudes(mappedSolicitudes);
            } catch (err) {
                console.error('Error loading maintenance history:', err);
            }
        };
        fetchHistory();
    }, [id]);

    const reloadTrabajosList = async () => {
        let mappedTrabajos: Trabajo[] = [];
        let mappedMantenimientos: Trabajo[] = [];

        // 1. Obtener trabajos normales
        try {
            const data = await getTrabajos({ negocio_id: Number(id) });

            const getGroupId = (descripcion?: string) => {
                if (!descripcion) return null;
                const match = descripcion.match(/\[Grupo:\s*(REQ-\d+)\]/i);
                return match ? match[1] : null;
            };

            const finishedGroupIds = new Set<string>();
            const acceptedGroupIds = new Set<string>();

            data.forEach((j: any) => {
                const grp = getGroupId(j.descripcion);
                if (grp) {
                    if (j.estado === 'Finalizado' || j.estado === 'Completado') {
                        finishedGroupIds.add(grp);
                    } else if (j.estado === 'Cotización Aceptada' || j.estado === 'Cotización Aprobada') {
                        acceptedGroupIds.add(grp);
                    }
                }
            });

            mappedTrabajos = data.map((j: any) => {
                const grp = getGroupId(j.descripcion);
                let actualEstado = j.estado === 'Pendiente' ? 'Solicitud' : j.estado;
                if (grp) {
                    if (finishedGroupIds.has(grp) && actualEstado !== 'Finalizado') {
                        actualEstado = 'Finalizado';
                        updateEstadoTrabajo(j.id, { estado: 'Finalizado' }).catch(() => {});
                    } else if (acceptedGroupIds.has(grp) && !['Finalizado', 'Completado', 'Cotización Aceptada'].includes(actualEstado)) {
                        actualEstado = 'Cotización Aceptada';
                        updateEstadoTrabajo(j.id, { estado: 'Cotización Aceptada' }).catch(() => {});
                    }
                }

                const isSOS = j.prioridad === 'Alta' || j.titulo?.includes('SOS');
                let displayTipo = 'Nueva Solicitud';
                if (isSOS) {
                    displayTipo = 'SOS';
                } else if (j.tipo && ['Visita', 'Trabajo', 'Mantenimiento'].includes(j.tipo)) {
                    displayTipo = j.tipo;
                } else if (actualEstado !== 'Pendiente' && actualEstado !== 'Solicitud') {
                    const isTrabajoDefinitivo =
                        ['Cotización Enviada', 'Cotización Rechazada', 'Cotización Aceptada', 'Cotización Aprobada', 'En Proceso', 'Finalizado'].includes(actualEstado) || j.visitado;
                    displayTipo = isTrabajoDefinitivo ? 'Trabajo' : 'Visita';
                }

                return {
                    id: j.id.toString(),
                    original_id: j.id,
                    titulo: j.titulo,
                    ubicacion: j.negocio
                        ? (j.negocio.nombrePlaza || j.negocio.nombre_plaza)
                            ? `${j.negocio.nombre} - ${j.negocio.nombrePlaza || j.negocio.nombre_plaza}`
                            : j.negocio.nombre
                        : businessName,
                    tecnico: j.trabajador?.nombre || 'Sin asignar',
                    tecnicoUserId: j.trabajador?.user_id || null,
                    fecha: j.fecha_programada
                        ? j.fecha_programada.includes('-')
                            ? j.fecha_programada.split('-').reverse().join('/')
                            : j.fecha_programada
                        : new Date(j.created_at).toLocaleDateString('es-MX'),
                    estado: actualEstado,
                    visitado: Boolean(j.visitado),
                    tipo: displayTipo,
                    descripcion: j.descripcion,
                    isEmergency: isSOS,
                    fechaSolicitud: j.created_at
                        ? new Date(j.created_at).toLocaleString('es-MX', {
                              day: '2-digit', month: '2-digit', year: 'numeric',
                              hour: '2-digit', minute: '2-digit', hour12: true
                          })
                        : 'No registrada',
                    foto_url: j.foto_url,
                    hora_llegada: j.hora_llegada || null,
                    negocio: j.negocio
                } as Trabajo;
            });
        } catch (error) {
            console.error('Error al obtener trabajos: ', error);
        }

        // 2. Obtener solicitudes de mantenimiento
        try {
            const mantenimientos = await getMantenimientoSolicitudes(Number(id));
            const deletedMantIds = JSON.parse(localStorage.getItem('deleted_maintenance_ids') || '[]');
            mappedMantenimientos = mantenimientos
                .filter((m: any) => !deletedMantIds.includes(String(m.id)) && !deletedMantIds.includes(Number(m.id)))
                .map((m: any) => {
                let estado = m.estado;
                if (estado === 'Pendiente') estado = 'Solicitud';

                const activeJob = m.reparacion_trabajo || m.visita_trabajo;
                const createdAt = new Date(m.created_at);
                const fechaFormateada = `${String(createdAt.getDate()).padStart(2, '0')}/${String(createdAt.getMonth() + 1).padStart(2, '0')}/${createdAt.getFullYear()}`;

                return {
                    id: `m-${m.id}`,
                    original_id: m.id,
                    titulo: `Mantenimiento: ${m.levantamiento_equipo?.nombre || 'Equipo'}`,
                    descripcion: m.descripcion_problema || '',
                    estado: estado,
                    fecha: fechaFormateada,
                    tipo: 'Mantenimiento',
                    isMantenimiento: true,
                    tecnico: activeJob?.trabajador?.nombre || 'Sin asignar',
                    tecnicoUserId: activeJob?.trabajador?.user_id || null,
                    ubicacion: businessName,
                    fechaSolicitud: createdAt.toLocaleString('es-MX', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', hour12: true
                    }),
                    foto_url: null,
                    hora_llegada: activeJob?.hora_llegada || null
                } as any;
            });
        } catch (error) {
            console.error('Error al obtener solicitudes de mantenimiento: ', error);
        }

        setTrabajosData([...mappedTrabajos, ...mappedMantenimientos]);
    };

    // Recargar cuando el negocio ya esté disponible
    useEffect(() => {
        if (businessName !== 'Cargando...') {
            reloadTrabajosList();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, businessName]);

    const saveJobs = (data: Trabajo[]) => {
        setTrabajosData(data);
    };

    return {
        trabajosData,
        setTrabajosData,
        saveJobs,
        reloadTrabajosList,
        allSolicitudes,
    };
};
