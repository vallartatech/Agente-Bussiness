import React, { useEffect, useState } from 'react';
import { getNegocio } from '../../services/negociosService';
import { getMantenimientoSolicitudes } from '../../services/mantenimientoService';
import { getTrabajos } from '../../services/trabajosService';
import HistorialEquipoModal from '../../components/modals/HistorialEquipoModal';
import {
    HiOutlineCube,
    HiOutlineShieldCheck
} from "react-icons/hi2";

export interface EquiposNegocioProps {
    businessId: number;
    businessAreas?: any[];
    solicitudesList?: any[];
    trabajosList?: any[];
    onViewReport?: (trabajoId: number, reportData?: any) => void;
}

const extractEquipmentsFromAreas = (areas: any[]) => {
    const list: any[] = [];
    if (!Array.isArray(areas)) return list;
    areas.forEach((area: any) => {
        const areaName = area.nombreArea || area.nombre || 'Área';
        if (Array.isArray(area.equipos)) {
            area.equipos.forEach((eq: any) => {
                list.push({ ...eq, areaNombre: areaName });
            });
        }
        if (Array.isArray(area.subAreas)) {
            area.subAreas.forEach((sub: any) => {
                const subName = `${areaName} - ${sub.nombreSubArea || sub.nombre || ''}`.trim();
                if (Array.isArray(sub.equipos)) {
                    sub.equipos.forEach((eq: any) => {
                        if (!list.some(existing => existing.id === eq.id)) {
                            list.push({ ...eq, areaNombre: subName });
                        }
                    });
                }
            });
        }
    });
    return list;
};

export const isIntervencionForEquipo = (item: any, equipo: any): boolean => {
    if (!item || !equipo) return false;

    // 1. Coincidencia directa de ID numérico/string
    const eqId = String(equipo.id || equipo.levantamiento_equipo_id || '');
    if (eqId) {
        if (item.levantamiento_equipo_id && String(item.levantamiento_equipo_id) === eqId) return true;
        if (item.levantamiento_equipo?.id && String(item.levantamiento_equipo.id) === eqId) return true;
        if (item.equipo_id && String(item.equipo_id) === eqId) return true;
        if (item.equipo?.id && String(item.equipo.id) === eqId) return true;
    }

    // 2. Coincidencia directa por Número de Serie si existe
    const eqSerie = String(equipo.serie || equipo.numero_serie || '').trim().toLowerCase();
    if (eqSerie && eqSerie !== 'n/a' && eqSerie !== 's/n' && eqSerie !== 'sin serie' && eqSerie !== 'undefined' && eqSerie !== 'null') {
        const itemSerie = String(
            item.serie || 
            item.numero_serie || 
            item.equipo?.serie || 
            item.levantamiento_equipo?.serie || 
            item.equipoInfo?.serie || 
            ''
        ).trim().toLowerCase();
        if (itemSerie && itemSerie === eqSerie) return true;
    }

    // 3. Coincidencia por datos estructurados de equipo (equipoInfo, equipo, levantamiento_equipo)
    const itemEq = item.equipoInfo || item.equipo || item.levantamiento_equipo;
    if (itemEq) {
        const matchMarca = itemEq.marca && equipo.marca && String(itemEq.marca).trim().toLowerCase() === String(equipo.marca).trim().toLowerCase();
        const matchModelo = itemEq.modelo && equipo.modelo && String(itemEq.modelo).trim().toLowerCase() === String(equipo.modelo).trim().toLowerCase();
        const matchNombre = itemEq.nombre && equipo.nombre && String(itemEq.nombre).trim().toLowerCase() === String(equipo.nombre).trim().toLowerCase();
        const matchSerie = itemEq.serie && equipo.serie && String(itemEq.serie).trim().toLowerCase() === String(equipo.serie).trim().toLowerCase();
        if (matchSerie && matchSerie.length > 2) return true;
        if (matchMarca && (matchModelo || matchNombre)) return true;
        if (matchNombre && matchModelo) return true;
    }

    // 4. Revisar en reporte/solución parseada si contiene equipoInfo o subReports
    const repSol = item.reporte?.solucion || item.solucion;
    if (repSol) {
        try {
            const parsed = typeof repSol === 'string' ? JSON.parse(repSol) : repSol;
            if (parsed.equipoInfo) {
                const eqInfo = parsed.equipoInfo;
                const mMarca = eqInfo.marca && equipo.marca && String(eqInfo.marca).trim().toLowerCase() === String(equipo.marca).trim().toLowerCase();
                const mModelo = eqInfo.modelo && equipo.modelo && String(eqInfo.modelo).trim().toLowerCase() === String(equipo.modelo).trim().toLowerCase();
                const mNombre = eqInfo.nombre && equipo.nombre && String(eqInfo.nombre).trim().toLowerCase() === String(equipo.nombre).trim().toLowerCase();
                const mSerie = eqInfo.serie && equipo.serie && String(eqInfo.serie).trim().toLowerCase() === String(equipo.serie).trim().toLowerCase();
                if (mSerie && mSerie.length > 2) return true;
                if (mMarca && (mModelo || mNombre)) return true;
                if (mNombre && mModelo) return true;
            }
            if (parsed.subReports && typeof parsed.subReports === 'object') {
                for (const sub of Object.values(parsed.subReports) as any[]) {
                    if (sub) {
                        const subEq = sub.equipoInfo || sub.equipo;
                        if (subEq) {
                            const mMarca = subEq.marca && equipo.marca && String(subEq.marca).trim().toLowerCase() === String(equipo.marca).trim().toLowerCase();
                            const mModelo = subEq.modelo && equipo.modelo && String(subEq.modelo).trim().toLowerCase() === String(equipo.modelo).trim().toLowerCase();
                            const mNombre = subEq.nombre && equipo.nombre && String(subEq.nombre).trim().toLowerCase() === String(equipo.nombre).trim().toLowerCase();
                            const mSerie = subEq.serie && equipo.serie && String(subEq.serie).trim().toLowerCase() === String(equipo.serie).trim().toLowerCase();
                            if (mSerie && mSerie.length > 2) return true;
                            if (mMarca && (mModelo || mNombre)) return true;
                            if (mNombre && mModelo) return true;
                        }
                        const subText = `${sub.reporteTienda || ''} ${sub.titulo || ''} ${sub.hallazgo || ''}`.toLowerCase();
                        const sMarca = String(equipo.marca || '').trim().toLowerCase();
                        const sModelo = String(equipo.modelo || '').trim().toLowerCase();
                        const sNombre = String(equipo.nombre || '').trim().toLowerCase();
                        if (sMarca && sModelo && subText.includes(sMarca) && subText.includes(sModelo)) return true;
                        if (sNombre && sModelo && subText.includes(sNombre) && subText.includes(sModelo)) return true;
                        if (sNombre && sMarca && subText.includes(sNombre) && subText.includes(sMarca)) return true;
                    }
                }
            }
        } catch (_) {}
    }

    // 5. Coincidencia semántica en título y descripción
    const textToSearch = `${item.titulo || ''} ${item.descripcion || ''} ${item.descripcion_problema || ''}`.toLowerCase();
    const marca = String(equipo.marca || '').trim().toLowerCase();
    const modelo = String(equipo.modelo || '').trim().toLowerCase();
    const nombre = String(equipo.nombre || '').trim().toLowerCase();

    const hasMarca = marca.length > 1 && textToSearch.includes(marca);
    const hasModelo = modelo.length > 0 && textToSearch.includes(modelo);
    const hasNombre = nombre.length > 1 && textToSearch.includes(nombre);

    if ((hasMarca && hasModelo) || (hasMarca && hasNombre) || (hasNombre && hasModelo)) {
        return true;
    }
    if (hasNombre && (textToSearch.includes('mantenimiento') || item.tipo === 'Mantenimiento' || item.isMantenimiento)) {
        return true;
    }

    return false;
};

export const getMergedIntervenciones = (equipo: any, solicitudes: any[] = [], trabajos: any[] = []): any[] => {
    if (!equipo) return [];

    const matchedSolicitudes = (solicitudes || []).filter(sol => isIntervencionForEquipo(sol, equipo));
    const matchedTrabajos = (trabajos || []).filter(trab => isIntervencionForEquipo(trab, equipo));

    const usedJobIds = new Set<string>();
    const merged: any[] = [];

    // 1. Agregar solicitudes de mantenimiento
    matchedSolicitudes.forEach(sol => {
        const foundReparacion = trabajos.find(t => String(t.id) === String(sol.reparacion_trabajo_id));
        const foundVisita = trabajos.find(t => String(t.id) === String(sol.visita_trabajo_id));

        const repTrab = sol.reparacion_trabajo || foundReparacion;
        const visTrab = sol.visita_trabajo || foundVisita;

        const linkedJobId = String(
            sol.actualTrabajoId ||
            (repTrab && (repTrab.reporte || repTrab.solucion) ? repTrab.id : '') ||
            (visTrab && (visTrab.reporte || visTrab.solucion) ? visTrab.id : '') ||
            sol.reparacion_trabajo_id ||
            sol.visita_trabajo_id ||
            repTrab?.id ||
            visTrab?.id ||
            ''
        );

        if (linkedJobId) {
            usedJobIds.add(linkedJobId);
            usedJobIds.add(`m-${linkedJobId}`);
        }
        usedJobIds.add(String(sol.id));
        usedJobIds.add(`m-${sol.id}`);

        merged.push({
            ...sol,
            reparacion_trabajo: repTrab,
            visita_trabajo: visTrab,
            actualTrabajoId: linkedJobId ? Number(linkedJobId) : sol.actualTrabajoId
        });
    });

    // 2. Agregar trabajos vinculados no duplicados
    matchedTrabajos.forEach(trab => {
        const cleanId = String(trab.original_id || trab.id || '').replace('m-', '').replace('gen-', '');
        if (!usedJobIds.has(cleanId) && !usedJobIds.has(String(trab.id))) {
            usedJobIds.add(cleanId);
            usedJobIds.add(String(trab.id));
            merged.push({
                ...trab,
                id: trab.original_id || trab.id,
                actualTrabajoId: Number(cleanId) || trab.id,
                descripcion_problema: trab.descripcion || trab.titulo,
                created_at: trab.fechaSolicitud || trab.fecha || new Date().toISOString(),
                estado: trab.estado || 'Finalizado'
            });
        }
    });

    const parseDate = (dStr: string) => {
        if (!dStr) return 0;
        const parts = dStr.includes("/") ? dStr.split("/") : dStr.split("-");
        if (parts.length === 3) {
            const [d, m, y] = parts.map(Number);
            return new Date(y, m - 1, d).getTime();
        }
        const d = new Date(dStr);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    merged.sort((a, b) => {
        const aFin = ['Finalizado', 'Completado', 'Finalizada', 'Terminado', 'Cancelado'].includes(a.estado);
        const bFin = ['Finalizado', 'Completado', 'Finalizada', 'Terminado', 'Cancelado'].includes(b.estado);
        if (!aFin && bFin) return -1;
        if (aFin && !bFin) return 1;
        return parseDate(b.created_at || b.fecha || b.fechaSolicitud) - parseDate(a.created_at || a.fecha || a.fechaSolicitud);
    });

    return merged;
};

const EquiposNegocio: React.FC<EquiposNegocioProps> = ({ businessId, businessAreas, solicitudesList, trabajosList, onViewReport }) => {
    const [equipos, setEquipos] = useState<any[]>([]);
    const [solicitudes, setSolicitudes] = useState<any[]>([]);
    const [trabajos, setTrabajos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedEquipo, setSelectedEquipo] = useState<any>(null);

    useEffect(() => {
        // 1. Si ya tenemos datos precargados del componente padre, usarlos al instante
        if (businessAreas && businessAreas.length > 0) {
            const extracted = extractEquipmentsFromAreas(businessAreas);
            setEquipos(extracted);
            if (solicitudesList) setSolicitudes(solicitudesList);
            if (trabajosList) setTrabajos(trabajosList);
            setLoading(false);
            return;
        }

        // 2. Si no hay precarga, consultar solo lo indispensable sin bucle N+1
        const fetchData = async () => {
            setLoading(true);
            try {
                const [negocio, solicitudesBackend, trabajosBackend] = await Promise.all([
                    getNegocio(businessId).catch(() => null),
                    solicitudesList ? Promise.resolve(solicitudesList) : getMantenimientoSolicitudes(businessId).catch(() => []),
                    trabajosList ? Promise.resolve(trabajosList) : getTrabajos({ negocio_id: businessId }).catch(() => [])
                ]);

                if (negocio && negocio.areas) {
                    setEquipos(extractEquipmentsFromAreas(negocio.areas));
                }

                if (Array.isArray(solicitudesBackend)) {
                    setSolicitudes(solicitudesBackend);
                }
                if (Array.isArray(trabajosBackend)) {
                    setTrabajos(trabajosBackend);
                }
            } catch (error: any) {
                console.error("Error al cargar equipos:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [businessId, businessAreas, solicitudesList, trabajosList]);

    const handleCardClick = (equipo: any) => {
        setSelectedEquipo(equipo);
        setModalOpen(true);
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0', gap: '15px' }}>
                <div className="loader-mantenere"></div>
                <p style={{ margin: 0, color: '#64748b', fontWeight: '500', letterSpacing: '0.5px' }}>Cargando inventario registrado...</p>
            </div>
        );
    }

    if (equipos.length === 0) {
        return (
            <div style={{ padding: '80px 40px', textAlign: 'center', background: '#fff', borderRadius: '30px', border: '1px solid #f1f5f9', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '60px', marginBottom: '20px' }}>🌫️</div>
                <h3 style={{ color: '#1e293b', fontSize: '22px', fontWeight: 'bold' }}>Sin equipos registrados</h3>
                <p style={{ color: '#64748b', maxWidth: '400px', margin: '15px auto 0', lineHeight: '1.6' }}>
                    Esta sucursal no cuenta con equipos dados de alta en su levantamiento inicial.
                </p>
            </div>
        );
    }

    return (
        <div style={{ marginTop: '25px', animation: 'fadeIn 0.5s ease-out' }}>
            <div style={{ display: 'grid', gap: '25px', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                {equipos.map((equipo, idx) => {
                    const intervenciones = getMergedIntervenciones(equipo, solicitudes, trabajos);
                    const maintenanceCount = intervenciones.length;

                    return (
                        <div key={idx}
                            onClick={() => handleCardClick(equipo)}
                            style={{
                                background: '#ffffff',
                                border: '1px solid #4d4c5590',
                                borderRadius: '24px',
                                padding: '24px',
                                boxShadow: '0 10px 30px rgba(15, 23, 42, 0.03)',
                                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '18px',
                                cursor: 'pointer'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-5px)';
                                e.currentTarget.style.boxShadow = '0 20px 40px rgba(15, 23, 42, 0.08)';
                                e.currentTarget.style.borderColor = '#f26522';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 10px 30px rgba(15, 23, 42, 0.03)';
                                e.currentTarget.style.borderColor = '#4d4c5590';
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                    {equipo.foto ? (
                                        <img
                                            src={equipo.foto}
                                            alt="equipo"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                const sibling = e.currentTarget.nextSibling as HTMLElement;
                                                if (sibling) sibling.style.display = 'flex';
                                            }}
                                            style={{ width: '60px', height: '60px', borderRadius: '12px', objectFit: 'cover' }}
                                        />
                                    ) : null}
                                    <div className="img-placeholder" style={{
                                        display: equipo.foto ? 'none' : 'flex',
                                        width: '60px',
                                        height: '60px',
                                        borderRadius: '12px',
                                        background: '#f1f5f9',
                                        border: '1px solid #e2e8f0',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#0f172a'
                                    }}>
                                        <HiOutlineCube size={28} />
                                    </div>
                                    <div>
                                        <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a', textTransform: 'capitalize' }}>
                                            {equipo.marca}
                                        </h4>
                                        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b', fontWeight: '600' }}>
                                            {equipo.nombre}
                                        </p>
                                    </div>
                                </div>
                                <span style={{
                                    padding: '6px 14px',
                                    borderRadius: '10px',
                                    fontSize: '11px',
                                    fontWeight: '800',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    background: '#0f172a',
                                    color: '#ffffff',
                                    border: 'none'
                                }}>
                                    {equipo.areaNombre}
                                </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '5px' }}>
                                <div style={{ padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <HiOutlineCube style={{ color: '#0f172a', fontSize: '18px' }} />
                                    <div style={{ fontSize: '12px' }}>
                                        <span style={{ color: '#64748b', display: 'block', fontSize: '10px', fontWeight: '600' }}>MODELO</span>
                                        <span style={{ fontWeight: '700', color: '#0f172a' }}>{equipo.modelo}</span>
                                    </div>
                                </div>
                                <div style={{
                                    padding: '12px',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '15px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    background: maintenanceCount > 0 ? '#f0fdf4' : '#f8fafc',
                                    borderColor: maintenanceCount > 0 ? '#bbf7d0' : '#e2e8f0'
                                }}>
                                    <HiOutlineShieldCheck style={{ color: maintenanceCount > 0 ? '#16a34a' : '#64748b', fontSize: '18px' }} />
                                    <div style={{ fontSize: '12px' }}>
                                        <span style={{ color: maintenanceCount > 0 ? '#15803d' : '#64748b', display: 'block', fontSize: '10px', fontWeight: '600' }}>INTERVENCIONES</span>
                                        <span style={{ fontWeight: '700', color: maintenanceCount > 0 ? '#166534' : '#0f172a' }}>{maintenanceCount}</span>
                                    </div>
                                </div>
                            </div>

                            <button type="button"
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: maintenanceCount > 0
                                        ? 'linear-gradient(135deg, #f26522 0%, #d14d13 100%)'
                                        : '#ffffff',
                                    color: maintenanceCount > 0 ? '#ffffff' : '#0f172a',
                                    border: maintenanceCount > 0 ? 'none' : '1px solid #cbd5e1',
                                    borderRadius: '14px',
                                    fontWeight: '800',
                                    fontSize: '13px',
                                    marginTop: '5px',
                                    cursor: 'pointer',
                                    boxShadow: maintenanceCount > 0 ? '0 4px 12px rgba(242, 101, 34, 0.25)' : 'none',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    if (maintenanceCount > 0) {
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                        e.currentTarget.style.boxShadow = '0 6px 14px rgba(242, 101, 34, 0.35)';
                                    } else {
                                        e.currentTarget.style.background = '#f8fafc';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (maintenanceCount > 0) {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(242, 101, 34, 0.25)';
                                    } else {
                                        e.currentTarget.style.background = '#ffffff';
                                    }
                                }}
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCardClick(equipo); }}>
                                {maintenanceCount > 0 ? 'Ver bitácora de equipo' : 'Ver Detalles de Registro'}
                            </button>
                        </div>
                    );
                })}
            </div>

            <HistorialEquipoModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                equipo={selectedEquipo}
                historial={selectedEquipo ? getMergedIntervenciones(selectedEquipo, solicitudes, trabajos) : []}
                onViewReport={onViewReport}
            />

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default EquiposNegocio;

