// Tipos compartidos para Trabajos / Solicitudes

export interface Trabajo {
    id: number;
    titulo: string;
    ubicacion: string;
    tecnico: string;
    tecnicoUserId?: number; // Permite un tracking fidedigno del técnico asignado
    fecha: string; // Formato DD/MM/YYYY
    estado: "En Espera" | "Finalizado" | "En Proceso" | "Asignado" | "Solicitud" | "Cotización Enviada" | "Cotización Aceptada" | "Cotización Rechazada" | "Recotización Solicitada" | "Cotización Aprobada" | "Eliminado" | "Completado" | string;
    tipo?: "Visita" | "Trabajo" | "Nueva Solicitud" | "SOS" | "Mantenimiento";
    visitado?: boolean;
    descripcion?: string;
    fechaAsignada?: string;
    horaAsignada?: string;
    cotizacion?: {
        costo: string;
        notas: string;
        archivo: string;
        fecha: string;
    };
    isEmergency?: boolean;
    asignaciones?: AsignacionTecnico[];
    fechaSolicitud?: string;
    foto_url?: string;
    // Campos extendidos usados en runtime (agrupación, mantenimiento, etc.)
    original_id?: number;
    isGroupHeader?: boolean;
    groupId?: string;
    jobsInGroup?: Trabajo[];
    isMantenimiento?: boolean;
    prioridad?: string;
    hora_llegada?: string | null;
    negocio?: any;
}

export interface AsignacionTecnico {
    tecnicoId: number;
    userId?: number;       // user_id del usuario asociado al trabajador
    tecnicoNombre: string;
    fechaAsignada: string;
    horaAsignada: string;
}

export interface Tecnico {
    id: number;
    userId?: number;       // user_id del usuario asociado al trabajador
    nombre: string;
    avatar?: string;
}
