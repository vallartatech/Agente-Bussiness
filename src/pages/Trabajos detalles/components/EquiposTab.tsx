import React, { useState } from 'react';
import AreaVisualGrid from '../../../components/AreaVisualGrid';
import LevantamientoModal from '../../../components/LevantamientoModal';
import ReportarProblemaModal from '../../../components/ReportarProblemaModal';
import ModalSeleccionEquipo from '../../../components/modals/ModalSeleccionEquipo';
import DetalleEquipoModal from '../../../components/DetalleEquipoModal';
import HistorialEquipoModal from '../../../components/modals/HistorialEquipoModal';
import DetalleReporteModal from '../../../components/modals/DetalleReporteModal';
import ModalSeleccionEspacio from '../../../components/ModalSeleccionEspacio';
import ReporteDetailModal from '../../../components/modals/ReporteDetailModal';
import EquiposNegocio, { getMergedIntervenciones } from '../../admin/EquiposNegocio';
import { createMantenimientoSolicitud } from '../../../services/mantenimientoService';
import { getReporteByTrabajoId } from '../../../services/reportesService';
import { getTrabajo } from '../../../services/trabajosService';
import { useModal } from '../../../context/ModalContext';
import { HiOutlineBolt } from 'react-icons/hi2';
import BusinessBanner from './BusinessBanner';

interface EquiposTabProps {
    // Negocio
    id: string;
    user: any;
    businessName: string;
    businessImage: string | null;
    businessDetails: any;
    bannerY: number;
    // Levantamiento (estado vive en el padre porque también lo usa NuevoServicioModal)
    businessAreas: any[];
    allSolicitudes: any[];
    trabajosData?: any[];
    canEdit: boolean;
    canEditBanner: boolean;
    // Handlers del levantamiento
    persistLevantamiento: (data: any[], notify?: boolean) => Promise<void>;
    handleAddArea: (nombre: string) => void;
    handleAddSubArea: (nombre: string, activeAreaForSub: string | null) => void;
    handleDeleteArea: (id: string, nombre: string) => void;
    editAreaName: (id: string, oldName: string) => void;
    // Banner edición
    fileInputRef: React.RefObject<HTMLInputElement>;
    isAdjustingPosition: boolean;
    setIsAdjustingPosition: (v: boolean) => void;
    setBannerY: (v: number) => void;
    handleBannerChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    saveBannerPosition: () => Promise<void>;
    getBusinessAddress: () => string;
}

/**
 * Tab completo de Equipos / Levantamiento.
 * Maneja internamente todos sus modales y sub-estados para no contaminar
 * al componente padre.
 */
const EquiposTab: React.FC<EquiposTabProps> = ({
    id,
    user,
    businessName,
    businessImage,
    businessDetails,
    bannerY,
    businessAreas,
    allSolicitudes,
    trabajosData,
    canEdit,
    canEditBanner,
    persistLevantamiento,
    handleAddArea,
    handleAddSubArea,
    handleDeleteArea,
    editAreaName,
    fileInputRef,
    isAdjustingPosition,
    setIsAdjustingPosition,
    setBannerY,
    handleBannerChange,
    saveBannerPosition,
    getBusinessAddress,
}) => {
    const { showAlert } = useModal();

    // Sub-tabs
    const [equiposSubTab, setEquiposSubTab] = useState<'registrados' | 'levantamiento'>('registrados');

    // Estados internos del levantamiento
    const [isLevantamientoModalOpen, setIsLevantamientoModalOpen] = useState(false);
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
    const [selectedEquipment, setSelectedEquipment] = useState<any>(null);
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
    const [reportingEquipment, setReportingEquipment] = useState<any>(null);
    const [activeEquipmentId, setActiveEquipmentId] = useState<string | null>(null);
    const [initialSubAreaId, setInitialSubAreaId] = useState<string | null>(null);

    // Grid visual
    const [isAreaModalOpen, setIsAreaModalOpen] = useState(false);
    const [isSubAreaModalOpen, setIsSubAreaModalOpen] = useState(false);
    const [activeAreaForSub, setActiveAreaForSub] = useState<string | null>(null);

    // Bitácora
    const [bitacoraModalOpen, setBitacoraModalOpen] = useState(false);
    const [equipoSelectionMode, setEquipoSelectionMode] = useState<'bitacora' | 'reporte' | null>(null);
    const [equiposForSelection, setEquiposForSelection] = useState<any[]>([]);
    const [selectedEqForBitacora, setSelectedEqForBitacora] = useState<any>(null);
    const [selectedTrabajoIdForBitacora, setSelectedTrabajoIdForBitacora] = useState<number | null>(null);
    const [reporteModalOpenForBitacora, setReporteModalOpenForBitacora] = useState(false);

    // Reporte detallado (abierto desde EquiposNegocio)
    const [reporteModalOpen, setReporteModalOpen] = useState(false);
    const [reporteData, setReporteData] = useState<any>(null);
    const [reporteTrabajo, setReporteTrabajo] = useState<any>(null);
    const [reporteTaskInfo, setReporteTaskInfo] = useState<any>(null);

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleReportarProblemaSubmit = async (descripcion: string) => {
        if (!reportingEquipment || !user?.id || !id) return;
        try {
            await createMantenimientoSolicitud({
                cliente_id: user.id,
                negocio_id: Number(id),
                levantamiento_equipo_id: reportingEquipment.id!,
                descripcion_problema: descripcion
            });
            showAlert('Reporte Enviado', 'El problema ha sido reportado exitosamente. El administrador revisará y agendará una visita técnica.', 'success');
        } catch (error) {
            console.error(error);
            showAlert('Error', 'No se pudo enviar el reporte de mantenimiento. Intenta de nuevo.', 'error');
        }
    };

    const handleOpenReportDetail = async (trabajoId: number) => {
        try {
            setReporteModalOpen(true);
            setReporteData(null);
            setReporteTrabajo(null);
            setReporteTaskInfo(null);

            const cleanId = String(trabajoId).startsWith('gen-')
                ? Number(String(trabajoId).replace('gen-', ''))
                : trabajoId;

            let reporte = null;
            let jobDetails = null;

            try {
                reporte = await getReporteByTrabajoId(cleanId);
            } catch (err: any) {
                console.warn('No formal report found in DB, using fallback if available.');
            }

            if (reporte) {
                let parsedSolucion = reporte.solucion;
                if (typeof reporte.solucion === 'string') {
                    try { parsedSolucion = JSON.parse(reporte.solucion); } catch (e) { console.error('Error al parsear reporte:', e); }
                }
                setReporteData(parsedSolucion || reporte);
            } else {
                const fallback = localStorage.getItem(`report_data_${cleanId}`);
                if (fallback) setReporteData(JSON.parse(fallback));
            }

            try {
                jobDetails = await getTrabajo(cleanId);
            } catch (err) {
                console.warn('Could not fetch job details for ID', cleanId);
            }

            if (jobDetails) {
                setReporteTrabajo({
                    id: jobDetails.id,
                    sucursal: jobDetails.negocio?.nombre || businessName,
                    tecnico: jobDetails.tecnico?.name || jobDetails.trabajador?.nombre || 'Técnico asignado',
                    encargado: jobDetails.contactos?.[0]?.nombre || jobDetails.negocio?.encargado || 'No asignado',
                    cotizacion: jobDetails.cotizacion_aceptada
                        ? { costo: jobDetails.cotizacion_aceptada.monto, archivo: jobDetails.cotizacion_aceptada.archivo_url, notas: jobDetails.cotizacion_aceptada.notas }
                        : jobDetails.cotizacion
                });
                setReporteTaskInfo({
                    id: jobDetails.id,
                    titulo: jobDetails.titulo || 'Mantenimiento General',
                    fecha: new Date(jobDetails.created_at).toLocaleDateString()
                });
            }
        } catch (error: any) {
            console.error('Error al abrir modal detalle:', error);
            showAlert('Error', 'Ocurrió un error inesperado al preparar el reporte.');
            setReporteModalOpen(false);
        }
    };

    // Wrappers para modales de área que también cierran el modal de selección
    const doAddArea = (nombre: string) => {
        handleAddArea(nombre);
        setIsAreaModalOpen(false);
    };

    const doAddSubArea = (nombre: string) => {
        handleAddSubArea(nombre, activeAreaForSub);
        setIsSubAreaModalOpen(false);
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div style={{ minHeight: '80vh', boxSizing: 'border-box' }}>
            {/* Input file oculto para banner */}
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleBannerChange}
            />

            {/* Banner */}
            <div style={{ marginBottom: '25px' }}>
                <BusinessBanner
                    businessName={businessName}
                    businessImage={businessImage}
                    businessDetails={businessDetails}
                    bannerY={bannerY}
                    label="EQUIPOS EN LA SUCURSAL"
                    getAddress={getBusinessAddress}
                    canEditBanner={canEditBanner}
                    isAdjustingPosition={isAdjustingPosition}
                    fileInputRef={fileInputRef}
                    onAdjustToggle={() => setIsAdjustingPosition(!isAdjustingPosition)}
                    onBannerYChange={setBannerY}
                    onSavePosition={async () => { await saveBannerPosition(); setIsAdjustingPosition(false); }}
                    onCancelAdjust={() => setIsAdjustingPosition(false)}
                />
            </div>

            {/* Sub-tabs */}
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginBottom: '25px' }}>
                {(['registrados', 'levantamiento'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setEquiposSubTab(tab)}
                        style={{
                            padding: '10px 20px', borderRadius: '12px', border: 'none', fontWeight: 'bold', cursor: 'pointer',
                            background: equiposSubTab === tab ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' : '#e2e8f0',
                            color: equiposSubTab === tab ? 'white' : '#475569',
                            boxShadow: equiposSubTab === tab ? '0 4px 12px rgba(249, 115, 22, 0.25)' : 'none',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {tab === 'registrados' ? '📋 Inventario de Equipos' : '🛠️ Levantamiento por Áreas'}
                    </button>
                ))}
            </div>

            {/* Contenido del sub-tab */}
            {equiposSubTab === 'registrados' ? (
                <div style={{ width: '100%', maxWidth: '900px', margin: '0 auto' }}>
                    <EquiposNegocio 
                        businessId={Number(id)} 
                        businessAreas={businessAreas}
                        solicitudesList={allSolicitudes}
                        trabajosList={trabajosData}
                        onViewReport={handleOpenReportDetail} 
                    />
                </div>
            ) : (
                <div style={{ width: '100%', maxWidth: '900px', margin: '0 auto' }}>
                    <div style={{ background: 'white', padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
                            <div>
                                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                                    <HiOutlineBolt size={20} style={{ color: '#f59e0b' }} /> Levantamientos por Áreas y Sub-áreas
                                </h2>
                                <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0' }}>
                                    Estructura de áreas, sub-áreas y catálogo de equipos de la sucursal.
                                </p>
                            </div>
                            {canEdit && (
                                <button
                                    onClick={() => { setActiveSectionId(null); setIsLevantamientoModalOpen(true); }}
                                    type="button"
                                    style={{
                                        background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', color: 'white',
                                        padding: '10px 18px', borderRadius: '12px', border: 'none', fontWeight: 'bold',
                                        fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                                        boxShadow: '0 4px 12px rgba(5, 150, 105, 0.2)'
                                    }}
                                >
                                    <HiOutlineBolt size={16} /> Iniciar levantamiento
                                </button>
                            )}
                        </div>

                        <div>
                            {businessAreas.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                                    {businessAreas.map((seccion: any) => (
                                        <AreaVisualGrid
                                            key={seccion.id}
                                            seccion={seccion}
                                            canEdit={canEdit}
                                            onEditArea={() => editAreaName(seccion.id, seccion.nombreArea)}
                                            onDeleteArea={() => handleDeleteArea(seccion.id, seccion.nombreArea)}
                                            onAddSubArea={() => {
                                                setActiveSectionId(seccion.id);
                                                setInitialSubAreaId(null);
                                                setIsLevantamientoModalOpen(true);
                                            }}
                                            onViewInventory={(subAreaId) => {
                                                const subArea = seccion.subAreas?.find((s: any) => s.id === subAreaId);
                                                if (subArea?.equipos?.length > 0) {
                                                    setActiveSectionId(seccion.id);
                                                    setInitialSubAreaId(subAreaId);
                                                    setSelectedEquipment(subArea.equipos as any);
                                                } else {
                                                    setActiveSectionId(seccion.id);
                                                    setInitialSubAreaId(subAreaId);
                                                    setIsLevantamientoModalOpen(true);
                                                }
                                            }}
                                            onVerBitacora={(subAreaId) => {
                                                const subArea = seccion.subAreas?.find((s: any) => s.id === subAreaId);
                                                if (!subArea?.equipos?.length) return;
                                                if (subArea.equipos.length === 1) {
                                                    setSelectedEqForBitacora(subArea.equipos[0] as any);
                                                    setBitacoraModalOpen(true);
                                                } else {
                                                    setEquiposForSelection(subArea.equipos as any);
                                                    setEquipoSelectionMode('bitacora');
                                                }
                                            }}
                                            onReportarProblema={(subAreaId) => {
                                                const subArea = seccion.subAreas?.find((s: any) => s.id === subAreaId);
                                                if (!subArea?.equipos?.length) return;
                                                if (subArea.equipos.length === 1) {
                                                    setReportingEquipment(subArea.equipos[0] as any);
                                                } else {
                                                    setEquiposForSelection(subArea.equipos as any);
                                                    setEquipoSelectionMode('reporte');
                                                }
                                            }}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '30px' }}>
                                    <p style={{ color: '#94a3b8', fontSize: '14px' }}>
                                        Aún no se ha realizado el levantamiento de áreas y equipos de esta sucursal.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modales ─────────────────────────────────────────────────────── */}

            {reporteModalOpen && (
                <ReporteDetailModal
                    isOpen={reporteModalOpen}
                    onClose={() => setReporteModalOpen(false)}
                    trabajo={reporteTrabajo}
                    task={reporteTaskInfo}
                    reporte={reporteData}
                    userRole={user?.role ?? undefined}
                />
            )}

            <LevantamientoModal
                isOpen={isLevantamientoModalOpen}
                onClose={() => { setIsLevantamientoModalOpen(false); setActiveEquipmentId(null); setInitialSubAreaId(null); }}
                data={businessAreas}
                initialSectionId={activeSectionId}
                initialEquipmentId={activeEquipmentId}
                initialSubAreaId={initialSubAreaId}
                onSave={(newData) => persistLevantamiento(newData)}
                isReadOnly={!canEdit}
            />

            <ReportarProblemaModal
                isOpen={!!reportingEquipment}
                onClose={() => setReportingEquipment(null)}
                equipment={reportingEquipment}
                negocioId={id || ''}
                onSubmit={handleReportarProblemaSubmit}
            />

            <ModalSeleccionEquipo
                isOpen={equipoSelectionMode !== null}
                onClose={() => { setEquipoSelectionMode(null); setEquiposForSelection([]); }}
                equipos={equiposForSelection}
                title={equipoSelectionMode === 'bitacora' ? 'Seleccionar Equipo para Bitácora' : 'Seleccionar Equipo para Reportar'}
                onSelect={(equipo) => {
                    if (equipoSelectionMode === 'bitacora') {
                        setSelectedEqForBitacora(equipo);
                        setBitacoraModalOpen(true);
                    } else if (equipoSelectionMode === 'reporte') {
                        setReportingEquipment(equipo);
                    }
                    setEquipoSelectionMode(null);
                    setEquiposForSelection([]);
                }}
            />

            <DetalleEquipoModal
                isOpen={!!selectedEquipment}
                onClose={() => setSelectedEquipment(null)}
                equipment={selectedEquipment}
                onEdit={canEdit ? () => { setActiveSectionId(selectedSectionId); setIsLevantamientoModalOpen(true); } : undefined}
                onVerHistorial={() => { setSelectedEqForBitacora(selectedEquipment); setBitacoraModalOpen(true); }}
            />

            <HistorialEquipoModal
                isOpen={bitacoraModalOpen}
                onClose={() => setBitacoraModalOpen(false)}
                equipo={selectedEqForBitacora}
                historial={selectedEqForBitacora ? getMergedIntervenciones(selectedEqForBitacora, allSolicitudes, trabajosData) : []}
                onViewReport={(trabajoId) => { setSelectedTrabajoIdForBitacora(trabajoId); setReporteModalOpenForBitacora(true); }}
            />

            {selectedTrabajoIdForBitacora && (
                <DetalleReporteModal
                    isOpen={reporteModalOpenForBitacora}
                    onClose={() => setReporteModalOpenForBitacora(false)}
                    trabajoId={selectedTrabajoIdForBitacora}
                />
            )}

            <ModalSeleccionEspacio
                isOpen={isAreaModalOpen || isSubAreaModalOpen}
                onClose={() => { setIsAreaModalOpen(false); setIsSubAreaModalOpen(false); setActiveAreaForSub(null); }}
                title={isAreaModalOpen ? 'Agregar Nueva Área' : 'Agregar Nueva Sub-área'}
                subtitle={isAreaModalOpen ? 'Selecciona o escribe el nombre del área' : 'Selecciona o escribe el nombre de la sub-área'}
                predefinedOptions={isAreaModalOpen ? ['COCINA', 'COMEDOR', 'AZOTEA', 'BAÑOS', 'BODEGA'] : ['REFRIGERACIÓN', 'ESTUFAS', 'EXTRACCIÓN', 'CLIMATIZACIÓN']}
                onAdd={isAreaModalOpen ? doAddArea : doAddSubArea}
            />
        </div>
    );
};

export default EquiposTab;
