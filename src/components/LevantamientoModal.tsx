import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './LevantamientoModal.module.css';
import {
    HiOutlineXMark,
    HiOutlinePlus,
    HiOutlineTrash,
    HiOutlineFolderPlus,
    HiOutlineChevronRight,
    HiOutlineArchiveBox,
    HiOutlineCheckCircle,
    HiOutlineCamera,
    HiOutlinePhoto,
    HiOutlineChevronLeft,
    HiOutlinePencil
} from "react-icons/hi2";
import type { Equipment, LevantamientoData, LevantamientoSeccion, LevantamientoSubArea } from '../pages/PerfilEmpresa/PerfilEmpresaUnificado';
import DetalleEquipoModal from './DetalleEquipoModal';
import { useModal } from '../context/ModalContext';

interface LevantamientoModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: LevantamientoData;
    initialSectionId?: string | null;
    onSave: (newData: LevantamientoData) => void;
    isReadOnly?: boolean;
    initialEquipmentId?: string | null;
    initialSubAreaId?: string | null;
}

const LevantamientoModal: React.FC<LevantamientoModalProps> = ({ isOpen, onClose, data, initialSectionId, onSave, isReadOnly = false, initialEquipmentId, initialSubAreaId }) => {
    const { showConfirm, showPrompt } = useModal();

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const [sections, setSections] = useState<LevantamientoData>([]);
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
    const [activeSubAreaId, setActiveSubAreaId] = useState<string | null>(null);

    const [isAddingSection, setIsAddingSection] = useState(false);
    const [newSectionName, setNewSectionName] = useState('');

    const [isAddingSubArea, setIsAddingSubArea] = useState(false);
    const [newSubAreaName, setNewSubAreaName] = useState('');

    const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
    const [viewingEquipment, setViewingEquipment] = useState<Equipment | null>(null);

    const [equipmentForm, setEquipmentForm] = useState<Equipment>({
        nombre: '',
        marca: '',
        modelo: '',
        serie: '',
        anioFabricacion: '',
        anioUso: '',
        foto: '',
        fotoPlaca: '',
        categoria_id: '',
        subAreaId: '',
        nombreSubArea: ''
    });

    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const fileInputPlacaRef = React.useRef<HTMLInputElement>(null);

    // Normalize incoming data structure (ensuring subAreas exist)
    const normalizeData = (raw: LevantamientoData): LevantamientoData => {
        return (raw || []).map(sec => {
            let subAreas = sec.subAreas || [];
            if (subAreas.length === 0) {
                subAreas = [{
                    id: `sub_gen_${sec.id}`,
                    nombreSubArea: 'GENERAL',
                    equipos: sec.equipos || []
                }];
            }
            return {
                ...sec,
                subAreas,
                equipos: sec.equipos || []
            };
        });
    };

    useEffect(() => {
        if (isOpen) {
            const normalized = normalizeData(data);
            setSections(normalized);

            const isMobile = window.innerWidth <= 768;

            let targetSec: any = null;
            if (initialSectionId) {
                targetSec = normalized.find(s => s.id === initialSectionId);
            }
            if (!targetSec && !isMobile && normalized.length > 0) {
                targetSec = normalized[0];
            }

            const activeSecId = targetSec ? targetSec.id : null;
            setActiveSectionId(activeSecId);

            if (targetSec) {
                if (initialSubAreaId && targetSec.subAreas?.find((sub: any) => sub.id === initialSubAreaId)) {
                    setActiveSubAreaId(initialSubAreaId);
                } else if (targetSec.subAreas && targetSec.subAreas.length > 0) {
                    setActiveSubAreaId(targetSec.subAreas[0].id);
                } else {
                    setActiveSubAreaId(null);
                }
            } else {
                setActiveSubAreaId(null);
            }
        }
    }, [isOpen, data, initialSectionId, initialSubAreaId]);

    // Initial equipment selection edit
    useEffect(() => {
        if (isOpen && initialEquipmentId && sections.length > 0) {
            for (const section of sections) {
                const subAreas = section.subAreas || [];
                for (const sub of subAreas) {
                    const eq = sub.equipos.find(e => e.id === initialEquipmentId);
                    if (eq) {
                        setActiveSectionId(section.id);
                        setActiveSubAreaId(sub.id);
                        setEditingEquipment(eq);
                        setEquipmentForm({
                            ...eq,
                            subAreaId: sub.id,
                            nombreSubArea: sub.nombreSubArea,
                            categoria_id: eq.categoria_id || ''
                        });
                        return;
                    }
                }
            }
        }
    }, [isOpen, initialEquipmentId, sections]);

    const resetEquipmentForm = (targetSubAreaId?: string | null) => {
        const currentSubId = targetSubAreaId || activeSubAreaId || '';
        const currentSec = sections.find(s => s.id === activeSectionId);
        const currentSub = currentSec?.subAreas?.find(sub => sub.id === currentSubId);

        setEquipmentForm({
            nombre: '',
            marca: '',
            modelo: '',
            serie: '',
            anioFabricacion: '',
            anioUso: '',
            foto: '',
            fotoPlaca: '',
            categoria_id: '',
            subAreaId: currentSubId,
            nombreSubArea: currentSub?.nombreSubArea || 'GENERAL'
        });
        setEditingEquipment(null);
    };

    // AREA ACTIONS
    const handleAddSection = () => {
        if (!newSectionName.trim()) return;
        const newSecId = `sec_${Date.now()}`;
        const newSubId = `sub_${Date.now()}`;
        const newSection: LevantamientoSeccion = {
            id: newSecId,
            nombreArea: newSectionName.trim().toUpperCase(),
            subAreas: [
                {
                    id: newSubId,
                    nombreSubArea: 'GENERAL',
                    equipos: []
                }
            ],
            equipos: []
        };
        const updated = [...sections, newSection];
        setSections(updated);
        setActiveSectionId(newSecId);
        setActiveSubAreaId(newSubId);
        setNewSectionName('');
        setIsAddingSection(false);
        // Persistir inmediatamente en el servidor
        onSave(updated);
    };

    const handleEditSection = (id: string, currentName: string) => {
        showPrompt(
            "Editar Nombre de Área",
            "Ingresa el nuevo nombre para el área:",
            currentName,
            (newName: string) => {
                if (!newName || !newName.trim()) return;
                const cleanName = newName.trim().toUpperCase();
                const updated = sections.map(s => s.id === id ? { ...s, nombreArea: cleanName } : s);
                setSections(updated);
                onSave(updated);
            },
            () => { },
            "Guardar",
            "Cancelar"
        );
    };

    const handleDeleteSection = (id: string, nombreArea: string) => {
        showConfirm(
            "¿Eliminar área?",
            `¿Estás seguro de que deseas eliminar el área "${nombreArea}" y todas sus sub-áreas y equipos?`,
            () => {
                const updated = sections.filter((s: LevantamientoSeccion) => s.id !== id);
                setSections(updated);
                if (activeSectionId === id) {
                    const nextSec = updated.length > 0 ? updated[0] : null;
                    setActiveSectionId(nextSec ? nextSec.id : null);
                    setActiveSubAreaId(nextSec && nextSec.subAreas && nextSec.subAreas.length > 0 ? nextSec.subAreas[0].id : null);
                }
                // Persistir inmediatamente en el servidor
                onSave(updated);
            },
            () => { },
            "Sí, eliminar",
            "Cancelar"
        );
    };

    // SUB-AREA ACTIONS
    const handleAddSubArea = () => {
        if (!activeSectionId || !newSubAreaName.trim()) return;
        const newSubId = `sub_${Date.now()}`;
        const newSub: LevantamientoSubArea = {
            id: newSubId,
            nombreSubArea: newSubAreaName.trim().toUpperCase(),
            equipos: []
        };
        const updatedSections = sections.map(sec => {
            if (sec.id === activeSectionId) {
                const currentSubAreas = sec.subAreas || [];
                return {
                    ...sec,
                    subAreas: [...currentSubAreas, newSub]
                };
            }
            return sec;
        });
        setSections(updatedSections);
        setActiveSubAreaId(newSubId);
        setNewSubAreaName('');
        setIsAddingSubArea(false);
        // Persistir inmediatamente en el servidor
        onSave(updatedSections);
    };

    const handleEditSubArea = (subId: string, currentName: string) => {
        showPrompt(
            "Editar Nombre de Sub-área",
            "Ingresa el nuevo nombre para la sub-área:",
            currentName,
            (newName: string) => {
                if (!newName || !newName.trim()) return;
                const cleanName = newName.trim().toUpperCase();
                const updatedSections = sections.map(sec => {
                    if (sec.id === activeSectionId) {
                        const updatedSubs = (sec.subAreas || []).map(sub =>
                            sub.id === subId ? { ...sub, nombreSubArea: cleanName } : sub
                        );
                        const updatedEquipos = (sec.equipos || []).map(eq =>
                            eq.subAreaId === subId ? { ...eq, nombreSubArea: cleanName } : eq
                        );
                        return {
                            ...sec,
                            subAreas: updatedSubs,
                            equipos: updatedEquipos
                        };
                    }
                    return sec;
                });
                setSections(updatedSections);
                onSave(updatedSections);
            },
            () => { },
            "Guardar",
            "Cancelar"
        );
    };

    const handleDeleteSubArea = (subId: string, nombreSubArea: string) => {
        showConfirm(
            "¿Eliminar sub-área?",
            `¿Estás seguro de que deseas eliminar la sub-área "${nombreSubArea}" y sus equipos?`,
            () => {
                const updatedSections = sections.map(sec => {
                    if (sec.id === activeSectionId) {
                        const remainingSubs = (sec.subAreas || []).filter(sub => sub.id !== subId);
                        const remainingEquipos = (sec.equipos || []).filter(e => e.subAreaId !== subId);
                        return {
                            ...sec,
                            subAreas: remainingSubs,
                            equipos: remainingEquipos
                        };
                    }
                    return sec;
                });
                setSections(updatedSections);
                const activeSec = updatedSections.find(s => s.id === activeSectionId);
                setActiveSubAreaId(activeSec && activeSec.subAreas && activeSec.subAreas.length > 0 ? activeSec.subAreas[0].id : null);
                // Persistir inmediatamente en el servidor
                onSave(updatedSections);
            },
            () => { },
            "Sí, eliminar",
            "Cancelar"
        );
    };

    // EQUIPMENT ACTIONS
    const handleAddOrUpdateEquipment = () => {
        if (!activeSectionId || !equipmentForm.nombre || !equipmentForm.marca) return;

        const activeSec = sections.find(s => s.id === activeSectionId);
        let targetSubId = equipmentForm.subAreaId || activeSubAreaId;

        // Fallback subArea if missing
        if (!targetSubId && activeSec?.subAreas && activeSec.subAreas.length > 0) {
            targetSubId = activeSec.subAreas[0].id;
        }

        const targetSub = activeSec?.subAreas?.find(sub => sub.id === targetSubId);

        const finalForm: Equipment = {
            ...equipmentForm,
            subAreaId: targetSubId || `sub_gen_${activeSectionId}`,
            nombreSubArea: targetSub?.nombreSubArea || 'GENERAL',
            subCategoria: equipmentForm.subCategoria || 'Aparatos Eléctricos',
            categoria: null
        };

        const updatedSections = sections.map(sec => {
            if (sec.id === activeSectionId) {
                let currentSubAreas = sec.subAreas || [];
                if (currentSubAreas.length === 0) {
                    currentSubAreas = [{ id: `sub_gen_${sec.id}`, nombreSubArea: 'GENERAL', equipos: [] }];
                }

                const updatedSubAreas = currentSubAreas.map(sub => {
                    if (sub.id === targetSubId) {
                        let updatedEquipos;
                        if (editingEquipment) {
                            updatedEquipos = sub.equipos.map(e => e.id === editingEquipment.id ? { ...finalForm, id: e.id } : e);
                        } else {
                            updatedEquipos = [...sub.equipos, { ...finalForm, id: `eq_${Date.now()}` }];
                        }
                        return { ...sub, equipos: updatedEquipos };
                    }
                    return sub;
                });

                // Sync main section.equipos for backward compatibility
                const allSectionEquipos = updatedSubAreas.flatMap(sub => sub.equipos);

                return {
                    ...sec,
                    subAreas: updatedSubAreas,
                    equipos: allSectionEquipos
                };
            }
            return sec;
        });

        setSections(updatedSections);
        resetEquipmentForm(targetSubId);
        // Persistir inmediatamente en el servidor
        onSave(updatedSections);
    };

    const handleDeleteEquipmentFromSubArea = (eqId: string, eqName: string) => {
        showConfirm(
            "¿Eliminar equipo?",
            `¿Estás seguro de borrar esta información? Una vez hecho, ya no se puede recuperar.`,
            () => {
                const updatedSections = sections.map(sec => {
                    if (sec.id === activeSectionId) {
                        const updatedSubAreas = (sec.subAreas || []).map(sub => ({
                            ...sub,
                            equipos: sub.equipos.filter(e => e.id !== eqId)
                        }));
                        return {
                            ...sec,
                            subAreas: updatedSubAreas,
                            equipos: updatedSubAreas.flatMap(s => s.equipos)
                        };
                    }
                    return sec;
                });
                setSections(updatedSections);
                // Persistir inmediatamente en el servidor
                onSave(updatedSections);
            },
            () => { },
            "Sí, eliminar",
            "Cancelar"
        );
    };

    const startEditEquipment = (eq: Equipment) => {
        setEditingEquipment(eq);
        setEquipmentForm({
            ...eq,
            categoria_id: eq.categoria_id || ''
        });
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (equipmentForm.foto && equipmentForm.foto.startsWith('blob:')) {
                URL.revokeObjectURL(equipmentForm.foto);
            }
            const tempUrl = URL.createObjectURL(file);
            setEquipmentForm((prev: Equipment) => ({ ...prev, foto: tempUrl, fotoFile: file }));
        }
    };

    const handlePlacaPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (equipmentForm.fotoPlaca && equipmentForm.fotoPlaca.startsWith('blob:')) {
                URL.revokeObjectURL(equipmentForm.fotoPlaca);
            }
            const tempUrl = URL.createObjectURL(file);
            setEquipmentForm((prev: Equipment) => ({ ...prev, fotoPlaca: tempUrl, fotoPlacaFile: file }));
        }
    };

    const handleFinalSave = () => {
        onSave(sections);
        onClose();
    };

    const activeSection = sections.find(s => s.id === activeSectionId);
    const activeSubAreas = activeSection?.subAreas || [];
    const activeSubArea = activeSubAreas.find(sub => sub.id === activeSubAreaId) || activeSubAreas[0];
    const displayEquipos = activeSubArea ? activeSubArea.equipos : (activeSection?.equipos || []);

    if (!isOpen) return null;

    return createPortal(
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '960px' }}>
                <div className={styles.modalHeader}>
                    <div>
                        <h3 className={styles.modalTitle}>Levantamientos por Áreas y Sub-áreas</h3>
                        <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Gestiona la estructura de áreas, sub-áreas y catálogo de equipos/activos.</p>
                    </div>
                    <button
                        className={styles.closeButton}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onClose();
                        }}
                        title="Cerrar"
                        type="button"
                    >
                        <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffffff' }}>✕</span>
                    </button>
                </div>

                <div className={styles.modalSplitBody}>
                    {/* SIDEBAR: ÁREAS */}
                    <div className={`${styles.sidebar} ${activeSectionId ? styles.mobileHidden : ''}`}>
                        <div className={styles.sidebarHeader}>
                            <span>ÁREAS GENERALES</span>
                            {!isReadOnly && (
                                <button onClick={() => setIsAddingSection(true)} className={styles.miniAddBtn} title="Agregar Área">
                                    <HiOutlinePlus size={16} color="#ffffff" />
                                </button>
                            )}
                        </div>

                        {isAddingSection && (
                            <div className={styles.newSectionInput}>
                                <input
                                    autoFocus
                                    placeholder="Nombre del área (Ej: COCINA)..."
                                    value={newSectionName}
                                    onChange={e => setNewSectionName(e.target.value.toUpperCase())}
                                    onKeyDown={e => e.key === 'Enter' && handleAddSection()}
                                />
                                <div className={styles.inputActions}>
                                    <button onClick={handleAddSection} title="Confirmar"><HiOutlineCheckCircle size={20} color="#10b981" /></button>
                                    <button onClick={() => setIsAddingSection(false)} title="Cancelar"><HiOutlineXMark size={20} color="#ef4444" /></button>
                                </div>
                            </div>
                        )}

                        <div className={styles.sectionsList}>
                            {sections.map((s: LevantamientoSeccion) => (
                                <div
                                    key={s.id}
                                    className={`${styles.sectionItem} ${activeSectionId === s.id ? styles.sectionItemActive : ''}`}
                                    onClick={() => {
                                        if (activeSectionId !== s.id) {
                                            setActiveSectionId(s.id);
                                            const subs = s.subAreas || [];
                                            setActiveSubAreaId(subs.length > 0 ? subs[0].id : null);
                                            resetEquipmentForm(subs.length > 0 ? subs[0].id : null);
                                        }
                                    }}
                                >
                                    <span className={styles.sectionName}>📂 {s.nombreArea}</span>
                                    <div className={styles.sectionActions}>
                                        {!isReadOnly && (
                                            <>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleEditSection(s.id, s.nombreArea); }}
                                                    className={styles.secActionBtn}
                                                    title="Editar Nombre del Área"
                                                >
                                                    <HiOutlinePencil size={15} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteSection(s.id, s.nombreArea); }}
                                                    className={`${styles.secActionBtn} ${styles.secDeleteBtn}`}
                                                    title="Borrar Área"
                                                >
                                                    <HiOutlineTrash size={15} />
                                                </button>
                                            </>
                                        )}
                                        <HiOutlineChevronRight className={styles.chevron} size={14} color="#cbd5e1" />
                                    </div>
                                </div>
                            ))}
                            {sections.length === 0 && !isAddingSection && (
                                <div className={styles.sidebarEmpty}>
                                    <p>No hay áreas creadas.</p>
                                    <button onClick={() => setIsAddingSection(true)}>Crear primera área</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* MAIN: SUB-ÁREAS Y EQUIPOS */}
                    <div className={`${styles.mainContent} ${!activeSectionId ? styles.mobileHidden : ''}`}>
                        {activeSection ? (
                            <>
                                <button
                                    className={styles.mobileBackBtn}
                                    onClick={() => setActiveSectionId(null)}
                                >
                                    <HiOutlineChevronLeft size={18} /> Volver a Áreas
                                </button>

                                <div className={styles.contentHeader} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800' }}>
                                            Área: <span style={{ color: '#2563eb' }}>{activeSection.nombreArea}</span>
                                        </h4>
                                        <span className={styles.badge}>{activeSection.equipos.length} equipos totales</span>
                                    </div>

                                    {/* BARRA DE SUB-ÁREAS EN FILAS CON SCROLL */}
                                    <div className={styles.subAreasCard}>
                                        <div className={styles.subAreasHeader}>
                                            <span className={styles.subAreasLabel}>
                                                <span>🔹</span> Sub-áreas disponibles ({activeSubAreas.length}):
                                            </span>
                                            {!isReadOnly && !isAddingSubArea && (
                                                <button
                                                    onClick={() => setIsAddingSubArea(true)}
                                                    className={styles.subAreaNewBtn}
                                                >
                                                    <HiOutlinePlus size={14} /> Nueva Sub-área
                                                </button>
                                            )}
                                        </div>

                                        <div className={styles.subAreasScrollGrid}>
                                            {activeSubAreas.map((sub) => {
                                                const isActive = activeSubAreaId === sub.id;
                                                return (
                                                    <div
                                                        key={sub.id}
                                                        onClick={() => {
                                                            setActiveSubAreaId(sub.id);
                                                            resetEquipmentForm(sub.id);
                                                        }}
                                                        className={`${styles.subAreaPill} ${isActive ? styles.subAreaPillActive : ''}`}
                                                    >
                                                        <span>{sub.nombreSubArea}</span>
                                                        <span className={styles.subAreaBadge}>
                                                            {sub.equipos.length}
                                                        </span>
                                                        {!isReadOnly && (
                                                            <div className={styles.subAreaActions} onClick={e => e.stopPropagation()}>
                                                                <button
                                                                    onClick={() => handleEditSubArea(sub.id, sub.nombreSubArea)}
                                                                    className={styles.subAreaActionBtn}
                                                                    title="Editar Sub-área"
                                                                >
                                                                    <HiOutlinePencil size={13} />
                                                                </button>
                                                                {activeSubAreas.length > 1 && (
                                                                    <button
                                                                        onClick={() => handleDeleteSubArea(sub.id, sub.nombreSubArea)}
                                                                        className={`${styles.subAreaActionBtn} ${styles.subAreaDeleteBtn}`}
                                                                        title="Eliminar Sub-área"
                                                                    >
                                                                        <HiOutlineTrash size={13} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}

                                            {!isReadOnly && isAddingSubArea && (
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#ffffff', padding: '3px 6px', borderRadius: '8px', border: '1px solid #2563eb' }}>
                                                    <input
                                                        autoFocus
                                                        placeholder="Nombre de sub-área..."
                                                        value={newSubAreaName}
                                                        onChange={e => setNewSubAreaName(e.target.value.toUpperCase())}
                                                        onKeyDown={e => e.key === 'Enter' && handleAddSubArea()}
                                                        style={{ padding: '3px 6px', borderRadius: '4px', border: 'none', fontSize: '12px', outline: 'none', fontWeight: 600, width: '140px' }}
                                                    />
                                                    <button onClick={handleAddSubArea} style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', padding: '3px 6px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}>✓</button>
                                                    <button onClick={() => setIsAddingSubArea(false)} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', padding: '3px 6px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* LISTA DE EQUIPOS DE LA SUB-ÁREA */}
                                <div className={styles.scrollArea}>
                                    {displayEquipos.length === 0 ? (
                                        <div className={styles.emptyContent}>
                                            <HiOutlineArchiveBox size={36} />
                                            <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
                                                No hay equipos registrados en la sub-área <strong>{activeSubArea?.nombreSubArea || 'selección'}</strong>.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className={styles.gridEquipos}>
                                            {displayEquipos.map((eq: Equipment) => (
                                                <div key={eq.id} className={styles.eqCard} onClick={() => setViewingEquipment(eq)} style={{ cursor: 'pointer' }}>
                                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                            {eq.foto && <img src={eq.foto} alt="Eq" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} />}
                                                            <div className={styles.eqInfo}>
                                                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                                    <strong>{eq.nombre}</strong>
                                                                    {eq.subCategoria && (
                                                                        <span className={styles.catBadge} style={{ background: '#fffbe6', color: '#b45309', border: '1px solid #fef08a' }}>
                                                                            🏷️ {eq.subCategoria}
                                                                        </span>
                                                                    )}
                                                                    {eq.nombreSubArea && (
                                                                        <span className={styles.catBadge} style={{ background: '#eff6ff', color: '#1d4ed8' }}>🔹 {eq.nombreSubArea}</span>
                                                                    )}
                                                                </div>
                                                                <span>{eq.marca} • {eq.modelo}</span>
                                                            </div>
                                                        </div>
                                                        {!isReadOnly && eq.id && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteEquipmentFromSubArea(eq.id!, eq.nombre);
                                                                }}
                                                                style={{ background: '#fef2f2', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: '#ef4444', display: 'flex' }}
                                                                title="Eliminar equipo"
                                                            >
                                                                <HiOutlineTrash size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* FORMULARIO ALTA EQUIPO / ACTIVO */}
                                {!isReadOnly && (
                                    <div className={styles.eqFormContainer}>
                                        <h5>{editingEquipment ? 'Editar Equipo' : 'Nuevo Equipo / Activo'}</h5>
                                        <div className={styles.eqFormGrid}>
                                            <div className={styles.inputGroup}>
                                                <label>Sub-área del Equipo</label>
                                                <select
                                                    value={equipmentForm.subAreaId || activeSubAreaId || ''}
                                                    onChange={e => {
                                                        const targetSub = activeSubAreas.find(s => s.id === e.target.value);
                                                        setEquipmentForm({
                                                            ...equipmentForm,
                                                            subAreaId: e.target.value,
                                                            nombreSubArea: targetSub?.nombreSubArea || 'GENERAL'
                                                        });
                                                    }}
                                                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#ffffff', color: '#0f172a', fontWeight: '600' }}
                                                >
                                                    {activeSubAreas.map(sub => (
                                                        <option key={sub.id} value={sub.id}>
                                                            🔹 {sub.nombreSubArea}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className={styles.inputGroup}>
                                                <label>Subcategoría del Activo</label>
                                                <select
                                                    value={equipmentForm.subCategoria || 'Aparatos Eléctricos'}
                                                    onChange={e => setEquipmentForm({ ...equipmentForm, subCategoria: e.target.value })}
                                                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#ffffff', color: '#0f172a', fontWeight: '600' }}
                                                >
                                                    <option value="Aparatos Eléctricos">⚡ Aparatos Eléctricos / Electrónicos</option>
                                                    <option value="Inmobiliaria">🪑 Inmobiliaria / Muebles</option>
                                                    <option value="Refrigeración">❄️ Refrigeración y Climas</option>
                                                    <option value="Equipos de Cocina">🔥 Equipos de Cocina / Operación</option>
                                                    <option value="Iluminación">💡 Luminaria e Iluminación</option>
                                                    <option value="Maquinaria">🛠️ Maquinaria y Herramientas</option>
                                                    <option value="Otros">🏷️ Otros Activos</option>
                                                </select>
                                            </div>

                                            <div className={styles.inputGroup}>
                                                <label>Nombre del Equipo</label>
                                                <input
                                                    value={equipmentForm.nombre || ''}
                                                    onChange={e => setEquipmentForm({ ...equipmentForm, nombre: e.target.value.toUpperCase() })}
                                                    placeholder="EJ: ESTUFA 4 QUEMADORES"
                                                />
                                            </div>
                                            <div className={styles.inputGroup}>
                                                <label>Marca</label>
                                                <input
                                                    value={equipmentForm.marca || ''}
                                                    onChange={e => setEquipmentForm({ ...equipmentForm, marca: e.target.value.toUpperCase() })}
                                                    placeholder="EJ: CORIAT"
                                                />
                                            </div>
                                            <div className={styles.inputGroup}>
                                                <label>Modelo</label>
                                                <input
                                                    value={equipmentForm.modelo || ''}
                                                    onChange={e => setEquipmentForm({ ...equipmentForm, modelo: e.target.value.toUpperCase() })}
                                                    placeholder="EJ: MASTER 4"
                                                />
                                            </div>
                                            <div className={styles.inputGroup}>
                                                <label>Número de Serie</label>
                                                <input
                                                    value={equipmentForm.serie || ''}
                                                    onChange={e => setEquipmentForm({ ...equipmentForm, serie: e.target.value.toUpperCase() })}
                                                    placeholder="EJ: SN-45892"
                                                />
                                            </div>
                                            <div className={styles.inputGroup}>
                                                <label>Año Fabricación</label>
                                                <input
                                                    value={equipmentForm.anioFabricacion || ''}
                                                    onChange={e => setEquipmentForm({ ...equipmentForm, anioFabricacion: e.target.value.toUpperCase() })}
                                                    placeholder="EJ: 2020"
                                                />
                                            </div>
                                            <div className={styles.inputGroup}>
                                                <label>Años en uso</label>
                                                <input
                                                    value={equipmentForm.anioUso || ''}
                                                    onChange={e => setEquipmentForm({ ...equipmentForm, anioUso: e.target.value.toUpperCase() })}
                                                    placeholder="EJ: 4 AÑOS"
                                                />
                                            </div>
                                            <div className={styles.inputGroup} style={{ gridColumn: 'span 3' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                                    <div>
                                                        <label>Foto del Equipo</label>
                                                        <div className={styles.photoUploadWrapper}>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                ref={fileInputRef}
                                                                style={{ display: 'none' }}
                                                                onChange={handlePhotoChange}
                                                            />
                                                            <button className={styles.photoBtn} onClick={() => fileInputRef.current?.click()} type="button">
                                                                {equipmentForm.foto ? <HiOutlinePhoto size={20} color="#475569" /> : <HiOutlineCamera size={20} color="#475569" />}
                                                                {equipmentForm.foto ? 'CAMBIAR FOTO' : 'SUBIR FOTO'}
                                                            </button>
                                                            {equipmentForm.foto && (
                                                                <div className={styles.photoPreview}>
                                                                    <img src={equipmentForm.foto} alt="Preview" />
                                                                    <button onClick={() => setEquipmentForm((prev: Equipment) => ({ ...prev, foto: '', fotoFile: undefined }))} className={styles.removePhoto} title="Quitar">
                                                                        <HiOutlineXMark size={18} color="#ffffff" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label>Foto de Placa de Datos</label>
                                                        <div className={styles.photoUploadWrapper}>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                ref={fileInputPlacaRef}
                                                                style={{ display: 'none' }}
                                                                onChange={handlePlacaPhotoChange}
                                                            />
                                                            <button className={styles.photoBtn} onClick={() => fileInputPlacaRef.current?.click()} type="button">
                                                                {equipmentForm.fotoPlaca ? <HiOutlinePhoto size={20} color="#475569" /> : <HiOutlineCamera size={20} color="#475569" />}
                                                                {equipmentForm.fotoPlaca ? 'CAMBIAR PLACA' : 'SUBIR PLACA'}
                                                            </button>
                                                            {equipmentForm.fotoPlaca && (
                                                                <div className={styles.photoPreview}>
                                                                    <img src={equipmentForm.fotoPlaca} alt="Preview Placa" />
                                                                    <button onClick={() => setEquipmentForm((prev: Equipment) => ({ ...prev, fotoPlaca: '', fotoPlacaFile: undefined }))} className={styles.removePhoto} title="Quitar">
                                                                        <HiOutlineXMark size={18} color="#ffffff" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={styles.formFooter}>
                                            {editingEquipment && <button onClick={() => resetEquipmentForm()} className={styles.btnCancel}>Cancelar</button>}
                                            <button
                                                onClick={handleAddOrUpdateEquipment}
                                                className={styles.btnAddEq}
                                                disabled={!equipmentForm.nombre || !equipmentForm.marca}
                                            >
                                                {editingEquipment ? 'Actualizar Equipo' : 'Agregar Equipo / Activo'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* BOTÓN GUARDAR LEVANTAMIENTO EN EL CONTENIDO */}
                                <div className={styles.contentSaveContainer}>
                                    {!isReadOnly ? (
                                        <button className={styles.primaryBtn} onClick={handleFinalSave}>
                                            Guardar Levantamientos Completo
                                        </button>
                                    ) : (
                                        <button className={styles.primaryBtn} onClick={onClose}>
                                            Cerrar Vista
                                        </button>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className={styles.selectPrompt}>
                                <div className={styles.selectPromptIconContainer}>
                                    <HiOutlineFolderPlus size={40} />
                                </div>
                                <h3>Selecciona o crea un área</h3>
                                <p>Crea áreas y sub-áreas para organizar los equipos de la empresa.</p>
                            </div>
                        )}
                    </div>
                </div>
                <DetalleEquipoModal
                    isOpen={!!viewingEquipment}
                    onClose={() => setViewingEquipment(null)}
                    equipment={viewingEquipment}
                    onEdit={!isReadOnly ? () => {
                        if (viewingEquipment) {
                            startEditEquipment(viewingEquipment);
                            setViewingEquipment(null);
                        }
                    } : undefined}
                />
            </div>
        </div>,
        document.body
    );
};

export default LevantamientoModal;
