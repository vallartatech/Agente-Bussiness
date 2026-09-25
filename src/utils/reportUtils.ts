export interface SubReportTarget {
    id?: string | number;
    baseId?: string | number;
    trabajoId?: string | number;
    pointIndex?: number;
    titulo?: string;
    descripcion?: string;
}

/**
 * Busca de forma precisa el reporte de un sub-punto/tarea dentro del objeto de reporte
 * evitando la repetición o contaminación de imágenes y datos de otros trabajos o puntos.
 */
export const findMatchingSubReport = (parsed: any, target: SubReportTarget): any => {
    if (!parsed) return null;

    const subId = target.id !== undefined && target.id !== null ? String(target.id) : '';
    const baseId = target.baseId !== undefined && target.baseId !== null ? String(target.baseId) : '';
    const trabajoId = target.trabajoId !== undefined && target.trabajoId !== null ? String(target.trabajoId) : '';
    const pIdx = target.pointIndex !== undefined && target.pointIndex !== null
        ? Number(target.pointIndex)
        : (subId.includes('_') ? Number(subId.split('_')[1]) : null);

    const isSubPoint = Boolean((pIdx !== null && pIdx !== undefined && !isNaN(pIdx)) || subId.includes('_'));

    let match: any = null;

    // 1. Si existe diccionario subReports acumulado
    if (parsed.subReports && typeof parsed.subReports === 'object') {
        const sr = parsed.subReports;

        // Búsqueda por clave exacta con trabajoId
        if (trabajoId && pIdx && sr[`${trabajoId}_${pIdx}`]) match = sr[`${trabajoId}_${pIdx}`];
        else if (trabajoId && subId && sr[`${trabajoId}_${subId}`]) match = sr[`${trabajoId}_${subId}`];
        // Búsqueda por clave exacta con baseId
        else if (baseId && pIdx && sr[`${baseId}_${pIdx}`]) match = sr[`${baseId}_${pIdx}`];
        else if (baseId && subId && sr[`${baseId}_${subId}`]) match = sr[`${baseId}_${subId}`];
        // Búsqueda por subId exacto
        else if (subId && sr[subId]) match = sr[subId];
        // Búsqueda por clave de índice simple
        else if (pIdx && sr[String(pIdx)]) match = sr[String(pIdx)];
        else if (pIdx && sr[`pt_${pIdx}`]) match = sr[`pt_${pIdx}`];
        // Búsqueda por clave que termine en el subId o índice
        else if (pIdx) {
            const entry = Object.entries(sr).find(([k]) => k.endsWith(`_${pIdx}`) || k === String(pIdx));
            if (entry) match = entry[1];
        }
    }

    // 2. Coincidencia directa de subtareaId en el objeto raíz
    if (!match && parsed.subtareaId) {
        if (parsed.subtareaId === subId) match = parsed;
        else if (trabajoId && pIdx && parsed.subtareaId === `${trabajoId}_${pIdx}`) match = parsed;
        else if (baseId && pIdx && parsed.subtareaId === `${baseId}_${pIdx}`) match = parsed;
        else if (!isSubPoint && (parsed.subtareaId === trabajoId || parsed.subtareaId === baseId)) match = parsed;
    }

    // 3. Fallback a nivel de trabajo general SOLO si NO es un sub-punto múltiple
    if (!match && !isSubPoint) {
        match = { ...parsed };
    }

    if (match) {
        // Heredar firmaEmpresa del objeto raíz si el sub-reporte no tiene una propia
        const rootFirma = parsed.firmaEmpresa && parsed.firmaEmpresa !== '__PDF_LOADED_IN_STATE__' ? parsed.firmaEmpresa : null;
        const matchFirma = match.firmaEmpresa && match.firmaEmpresa !== '__PDF_LOADED_IN_STATE__' ? match.firmaEmpresa : null;

        let imagenes = match.imagenes;
        if (!imagenes && !isSubPoint && parsed.imagenes) {
            imagenes = parsed.imagenes;
        }

        let equipoInfo = match.equipoInfo || (!isSubPoint ? parsed.equipoInfo : null) || null;
        let involucraEquipo = match.involucraEquipo !== undefined ? match.involucraEquipo : Boolean(equipoInfo);

        match = {
            ...match,
            imagenes,
            equipoInfo,
            involucraEquipo,
            firmaEmpresa: matchFirma || rootFirma || null,
            tecnicoNombre: match.tecnicoNombre || parsed.tecnicoNombre,
            tecnicoAvatar: match.tecnicoAvatar || parsed.tecnicoAvatar,
            fecha: match.fecha || parsed.fecha
        };
        return match;
    }

    return null;
};

/**
 * Filtra conceptos y materiales de cotización para un punto específico
 * evitando que todos los puntos muestren todos los conceptos y sumas acumuladas.
 */
export const filterQuoteDataForPoint = (quoteData: any, pIdx: number): any => {
    if (!quoteData || typeof quoteData !== 'object') return quoteData;

    const isMatch = (item: any) => {
        if (!item) return false;
        if (item.puntoIndex !== undefined && item.puntoIndex !== null) {
            return Number(item.puntoIndex) === pIdx;
        }
        const desc = (item.descripcion || item.nombre || item.pieza || item.material || '').toString();
        const pRegex = new RegExp(`\\[Punto\\s*#?${pIdx}\\]`, 'i');
        return pRegex.test(desc);
    };

    const hasPointTags = (arr: any[]) => {
        if (!Array.isArray(arr)) return false;
        return arr.some(item => {
            if (item.puntoIndex !== undefined && item.puntoIndex !== null) return true;
            const desc = (item.descripcion || item.nombre || item.pieza || item.material || '').toString();
            return /\[Punto\s*#?\d+\]/i.test(desc);
        });
    };

    let conceptos = quoteData.conceptos;
    if (Array.isArray(conceptos) && hasPointTags(conceptos)) {
        conceptos = conceptos.filter(isMatch);
    }

    let materiales = quoteData.materiales;
    if (Array.isArray(materiales) && hasPointTags(materiales)) {
        materiales = materiales.filter(isMatch);
    }

    return {
        ...quoteData,
        conceptos: conceptos || [],
        materiales: materiales || []
    };
};

/**
 * Normaliza cadenas para comparación insensible a mayúsculas, acentos y caracteres especiales
 */
export const normalizeText = (text: string): string => (text || '')
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

/**
 * Extrae el título de una cotización almacenada en formato estructurado === TÍTULO: ... ===
 */
export const extractQuoteTitle = (desc: string, fallback: string = ''): string => {
    if (desc && (desc.startsWith('=== TÍTULO:') || desc.startsWith('=== TITULO:'))) {
        const parts = desc.split('===');
        if (parts.length >= 3) {
            return parts[1].replace(/T[ÍI]TULO:/i, '').trim();
        }
    }
    return fallback;
};

/**
 * Asocia de forma precisa una SubTarea o punto ejecutable con su respectiva Cotizacion
 */
export const getMatchingQuoteForTask = (tarea: any, cotizacionesList: any[]): any | null => {
    if (!cotizacionesList || !Array.isArray(cotizacionesList) || cotizacionesList.length === 0) return null;
    if (cotizacionesList.length === 1) return cotizacionesList[0];

    const tDesc = normalizeText(tarea.cleanDescripcion || tarea.descripcion || '');
    const tTitle = normalizeText(tarea.titulo || '');
    const pIdx = tarea.pointIndex !== undefined ? Number(tarea.pointIndex) : null;

    // 1. Coincidencia por título estructurado de la cotización
    for (const c of cotizacionesList) {
        const rawDesc = c.descripcion || '';
        const qTitle = normalizeText(extractQuoteTitle(rawDesc, ''));

        if (qTitle.length > 5) {
            if (tDesc.includes(qTitle) || qTitle.includes(tDesc)) return c;
            if (tTitle.includes(qTitle) || qTitle.includes(tTitle)) return c;
        }

        const parts = rawDesc.split('===');
        const cleanDesc = normalizeText(parts[parts.length - 1] || rawDesc);
        if (tDesc.length > 8 && (cleanDesc.includes(tDesc) || tDesc.includes(cleanDesc.slice(0, 30)))) {
            return c;
        }
    }

    // 2. Coincidencia por etiqueta [Punto X] en la cotización
    if (pIdx !== null) {
        const pRegex = new RegExp(`\\[?Punto\\s*#?${pIdx}\\]?`, 'i');
        const pointMatch = cotizacionesList.find(c => pRegex.test(c.descripcion || ''));
        if (pointMatch) return pointMatch;
    }

    // 3. Coincidencia posicional por índice de punto si el número coincide
    if (pIdx !== null && pIdx > 0 && pIdx <= cotizacionesList.length) {
        return cotizacionesList[pIdx - 1];
    }

    return null;
};

/**
 * Obtiene la lista de ítems aceptados (conceptos y materiales) por el cliente para una cotización
 */
export const getAcceptedItemsForQuote = (quote: any, trabajoId?: number | string): any[] | null => {
    if (!quote) return null;

    // 1. Buscar en descripción con marcador persistente |||ACCEPTED_ITEMS|||
    if (quote.descripcion && quote.descripcion.includes('|||ACCEPTED_ITEMS|||')) {
        try {
            const jsonPart = quote.descripcion.split('|||ACCEPTED_ITEMS|||')[1].trim();
            const parsed = JSON.parse(jsonPart);
            if (Array.isArray(parsed)) return parsed;
        } catch (_) {}
    }

    // 2. Buscar en localStorage por id de cotización
    if (quote.id) {
        try {
            const raw = localStorage.getItem(`quote_accepted_items_${quote.id}`);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (_) {}
    }

    // 3. Fallback en localStorage por id de trabajo
    if (trabajoId) {
        try {
            const raw = localStorage.getItem(`quote_accepted_items_${trabajoId}`);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (_) {}
    }

    return null;
};

/**
 * Determina si la cotización vinculada a una tarea fue aprobada / aceptada por el cliente.
 * Si fue rechazada, está pendiente o en recotización, devuelve false.
 */
export const isTaskQuoteApproved = (
    tarea: any,
    cotizacionesList: any[],
    rejectionReasonsMap?: Record<number, string>,
    recotizacionReasonsMap?: Record<number, string>
): boolean => {
    if (!cotizacionesList || !Array.isArray(cotizacionesList) || cotizacionesList.length === 0) return true;

    const matchingQuote = getMatchingQuoteForTask(tarea, cotizacionesList);
    if (!matchingQuote) {
        if (tarea.cotizacionEstado === 'Rechazada') return false;
        return cotizacionesList.some(c => c.estado === 'Aprobada');
    }

    const qId = matchingQuote.id;
    if (qId && recotizacionReasonsMap && recotizacionReasonsMap[qId]) return false;
    if (qId && rejectionReasonsMap && rejectionReasonsMap[qId]) return false;

    return matchingQuote.estado === 'Aprobada' || matchingQuote.estado === 'Aceptada';
};

/**
 * Filtra conceptos y materiales de una tarea basándose en la selección del cliente al aceptar la cotización.
 * Si el cliente desmarcó un material o concepto, se excluye de la lista activa y del subtotal.
 */
export const filterTaskItemsByAccepted = (
    tarea: any,
    acceptedItems: any[] | null
): { conceptos: any[]; materiales: any[]; refacciones: any[]; subtotal: number } => {
    let conceptos = tarea.quoteData?.conceptos || [];
    let materiales = tarea.quoteData?.materiales || [];
    let refacciones = tarea.refacciones || [];

    if (!acceptedItems || !Array.isArray(acceptedItems)) {
        let total = 0;
        conceptos.forEach((c: any) => { total += (Number(c.cantidad) || 1) * (Number(c.precio) || 0); });
        materiales.forEach((m: any) => { total += (Number(m.cantidad) || 1) * (Number(m.precio) || 0); });
        refacciones.forEach((r: any) => { total += (Number(r.cantidad) || 1) * (Number(r.costo_estimado) || 0); });
        return { conceptos, materiales, refacciones, subtotal: total };
    }

    const acceptedConceptsList = acceptedItems.filter((it: any) => it.tipo === 'concepto');
    const acceptedMaterialsList = acceptedItems.filter((it: any) => it.tipo === 'material');

    if (acceptedConceptsList.length > 0) {
        conceptos = conceptos.filter((c: any) => {
            const cName = normalizeText(c.descripcion || c.nombre || '');
            return acceptedConceptsList.some((ac: any) => {
                const acName = normalizeText(ac.nombre || '');
                return cName.includes(acName) || acName.includes(cName);
            });
        });
    }

    if (acceptedMaterialsList.length > 0) {
        materiales = materiales.filter((m: any) => {
            const mName = normalizeText(m.nombre || m.material || m.pieza || '');
            return acceptedMaterialsList.some((am: any) => {
                const amName = normalizeText(am.nombre || am.material || '');
                return mName.includes(amName) || amName.includes(mName);
            });
        });
        refacciones = refacciones.filter((r: any) => {
            const rName = normalizeText(r.pieza || r.nombre || '');
            return acceptedMaterialsList.some((am: any) => {
                const amName = normalizeText(am.nombre || am.material || '');
                return rName.includes(amName) || amName.includes(rName);
            });
        });
    } else {
        // El cliente aceptó la cotización pero desmarcó todos los materiales
        materiales = [];
        refacciones = [];
    }

    let subtotal = 0;
    conceptos.forEach((c: any) => { subtotal += (Number(c.cantidad) || 1) * (Number(c.precio) || 0); });
    materiales.forEach((m: any) => { subtotal += (Number(m.cantidad) || 1) * (Number(m.precio) || 0); });
    refacciones.forEach((r: any) => { subtotal += (Number(r.cantidad) || 1) * (Number(r.costo_estimado) || 0); });

    return { conceptos, materiales, refacciones, subtotal };
};
