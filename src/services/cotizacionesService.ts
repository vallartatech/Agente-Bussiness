import api from "./api";

export interface Cotizacion {
    id?: number;
    trabajo_id: number;
    descripcion?: string;
    monto: number | string;
    estado?: "Pendiente" | "Aprobada" | "Rechazada";
    archivo?: string;
    created_at?: string;
    updated_at?: string;
}

// 📌 Obtener TODAS las cotizaciones de un trabajo (devuelve array)
export const getCotizacionesByTrabajoId = async (trabajoId: number): Promise<Cotizacion[]> => {
    try {
        const response = await api.get(`/cotizaciones/trabajo/${trabajoId}`);
        // Si el backend devuelve un array vacío o el trabajo no tiene cotizaciones
        return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
        if (error.response && error.response.status === 404) {
            return [];
        }
        throw error;
    }
};

// 📌 Mantener compatibilidad con código anterior (alias)
export const getCotizacionByTrabajoId = getCotizacionesByTrabajoId;

// ➕ Crear una nueva cotización
export const saveCotizacion = async (data: Partial<Cotizacion> | FormData): Promise<Cotizacion> => {
    try {
        let response;
        if (data instanceof FormData) {
            const hasFile = data.get('archivo') instanceof File;
            if (!hasFile) {
                const jsonPayload: Record<string, any> = {};
                data.forEach((value, key) => {
                    if (key !== 'archivo') {
                        jsonPayload[key] = (key === 'monto' || key === 'trabajo_id') ? (isNaN(Number(value)) ? value : Number(value)) : value;
                    }
                });
                response = await api.post('/cotizaciones', jsonPayload);
            } else {
                try {
                    response = await api.post('/cotizaciones', data);
                } catch (uploadErr) {
                    console.warn('[saveCotizacion] Falló subida multipart, reintentando con payload JSON limpio:', uploadErr);
                    const jsonPayload: Record<string, any> = {};
                    data.forEach((value, key) => {
                        if (key !== 'archivo') {
                            jsonPayload[key] = (key === 'monto' || key === 'trabajo_id') ? (isNaN(Number(value)) ? value : Number(value)) : value;
                        }
                    });
                    response = await api.post('/cotizaciones', jsonPayload);
                }
            }
        } else {
            response = await api.post('/cotizaciones', data);
        }
        return response.data?.data || response.data;
    } catch (error: any) {
        console.error('[saveCotizacion] error:', error?.response?.data || error);
        throw error;
    }
};

// ✏️ Editar una cotización existente
export const updateCotizacion = async (id: number, data: FormData | Partial<Cotizacion>): Promise<Cotizacion> => {
    try {
        let response;
        if (data instanceof FormData) {
            const hasFile = data.get('archivo') instanceof File;
            if (!hasFile) {
                const jsonPayload: Record<string, any> = {};
                data.forEach((value, key) => {
                    if (key !== 'archivo') {
                        jsonPayload[key] = key === 'monto' ? (isNaN(Number(value)) ? value : Number(value)) : value;
                    }
                });
                response = await api.put(`/cotizaciones/${id}`, jsonPayload);
            } else {
                if (!data.has('_method')) {
                    data.append('_method', 'PUT');
                }
                response = await api.post(`/cotizaciones/${id}`, data);
            }
        } else {
            response = await api.put(`/cotizaciones/${id}`, data);
        }
        return response.data?.data || response.data;
    } catch (error: any) {
        console.error('[updateCotizacion] error:', error?.response?.data);
        throw error;
    }
};

// 🗑️ Eliminar una cotización
export const deleteCotizacion = async (id: number): Promise<void> => {
    await api.delete(`/cotizaciones/${id}`);
};

// ✅❌ Actualizar el estado individual (Aprobar / Rechazar) de una cotización
export const updateCotizacionStatus = async (id: number, estado: "Aprobada" | "Rechazada" | "Pendiente"): Promise<Cotizacion> => {
    const response = await api.put(`/cotizaciones/${id}/estado`, { estado });
    return response.data.data;
};
