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

    const isSubPoint = Boolean((pIdx !== null && pIdx !== undefined && !isNaN(pIdx) && pIdx > 1) || subId.includes('_'));

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
        // Búsqueda por trabajoId o baseId simple
        else if (trabajoId && sr[trabajoId]) match = sr[trabajoId];
        else if (baseId && sr[baseId]) match = sr[baseId];

        // Fallback inteligente en subReports:
        if (!match) {
            const srValues = Object.values(sr).filter(Boolean);
            if (srValues.length === 1) {
                // Si solo hay un sub-reporte registrado, ¡es ese!
                match = srValues[0];
            } else if (pIdx !== null && pIdx !== undefined && pIdx >= 1 && pIdx <= srValues.length) {
                match = srValues[pIdx - 1];
            } else if (!isSubPoint && srValues.length > 0) {
                match = srValues[0];
            }
        }
    }

    // 2. Coincidencia directa de subtareaId en el objeto raíz
    if (!match && parsed.subtareaId) {
        if (parsed.subtareaId === subId) match = parsed;
        else if (trabajoId && pIdx && parsed.subtareaId === `${trabajoId}_${pIdx}`) match = parsed;
        else if (baseId && pIdx && parsed.subtareaId === `${baseId}_${pIdx}`) match = parsed;
        else if (!isSubPoint && (parsed.subtareaId === trabajoId || parsed.subtareaId === baseId)) match = parsed;
    }

    // 3. Fallback a nivel de trabajo general
    if (!match) {
        if (!isSubPoint || !parsed.subtareaId || parsed.subtareaId === subId || parsed.subtareaId === trabajoId) {
            match = { ...parsed };
            // Si el objeto raíz no tiene imágenes directamente pero tiene subReports, extraer datos del primer subReport
            if ((!match.imagenes || (!match.imagenes.antes && !match.imagenes.durante && !match.imagenes.despues)) && parsed.subReports && typeof parsed.subReports === 'object') {
                const srVals = Object.values(parsed.subReports);
                if (srVals.length > 0 && typeof srVals[0] === 'object') {
                    match = { ...(srVals[0] as object), ...match };
                }
            }
        }
    }

    if (match) {
        // Heredar firmaEmpresa del objeto raíz si el sub-reporte no tiene una propia
        const rootFirma = parsed.firmaEmpresa && parsed.firmaEmpresa !== '__PDF_LOADED_IN_STATE__' ? parsed.firmaEmpresa : null;
        const matchFirma = match.firmaEmpresa && match.firmaEmpresa !== '__PDF_LOADED_IN_STATE__' ? match.firmaEmpresa : null;

        let imagenes = match.imagenes;
        if ((!imagenes || (!imagenes.antes && !imagenes.durante && !imagenes.despues)) && parsed.imagenes) {
            imagenes = parsed.imagenes;
        }

        let equipoInfo = match.equipoInfo || parsed.equipoInfo || null;
        let involucraEquipo = match.involucraEquipo !== undefined ? match.involucraEquipo : (parsed.involucraEquipo !== undefined ? parsed.involucraEquipo : Boolean(equipoInfo));

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
