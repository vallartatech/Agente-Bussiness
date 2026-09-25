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
