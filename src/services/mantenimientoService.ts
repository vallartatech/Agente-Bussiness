import api from './api';

export const createMantenimientoSolicitud = async (data: {
    cliente_id: number;
    negocio_id: number;
    levantamiento_equipo_id: number | string;
    descripcion_problema: string;
}) => {
    try {
        const response = await api.post('/mantenimiento-solicitudes', data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getMantenimientoSolicitudes = async (negocio_id?: number) => {
    try {
        const url = negocio_id ? `/mantenimiento-solicitudes?negocio_id=${negocio_id}` : '/mantenimiento-solicitudes';
        const response = await api.get(url);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getMantenimientoSolicitud = async (id: number | string) => {
    try {
        const response = await api.get(`/mantenimiento-solicitudes/${id}`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const asignarMantenimientoVisita = async (id: string, data: any) => {
    const res = await api.post(`/mantenimiento-solicitudes/${id}/asignar-visita`, data);
    return res.data;
};

// Asignar técnico para el trabajo final (reparación)
export const asignarMantenimientoReparacion = async (id: string, data: any) => {
    const res = await api.post(`/mantenimiento-solicitudes/${id}/asignar-reparacion`, data);
    return res.data;
};

// Reasignar / actualizar datos del técnico o fecha
export const actualizarMantenimientoAsignacion = async (id: string | number, data: any) => {
    const res = await api.post(`/mantenimiento-solicitudes/${id}/actualizar-asignacion`, data);
    return res.data;
};

// Cancelar la asignación (volver a Pendiente o Cotización Aceptada y eliminar trabajo asignado)
export const cancelarMantenimientoAsignacion = async (id: string | number) => {
    const res = await api.post(`/mantenimiento-solicitudes/${id}/cancelar-asignacion`);
    return res.data;
};

export const getConsumoReporte = async () => {
    const res = await api.get('/equipos-consumo');
    return res.data;
};
