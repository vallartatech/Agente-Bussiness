import React from 'react';
import { Pencil, MoveVertical } from 'lucide-react';
import styles from '../Trabajodetalles.module.css';

interface BusinessBannerProps {
    businessName: string;
    businessImage: string | null;
    businessDetails: any;
    bannerY: number;
    label: string;
    getAddress: () => string;
    // Edición (solo visible para roles con permisos)
    canEditBanner?: boolean;
    isAdjustingPosition?: boolean;
    fileInputRef?: React.RefObject<HTMLInputElement>;
    onAdjustToggle?: () => void;
    onBannerYChange?: (y: number) => void;
    onSavePosition?: () => void;
    onCancelAdjust?: () => void;
}

/**
 * Banner premium de la sucursal. Muestra la imagen de portada con overlay de texto.
 * Si se pasan las props de edición, muestra los botones de editar/ajustar imagen.
 * Usado en las 4 vistas: trabajos, historial, cotizaciones y equipos.
 */
const BusinessBanner: React.FC<BusinessBannerProps> = ({
    businessName,
    businessImage,
    businessDetails,
    bannerY,
    label,
    getAddress,
    canEditBanner = false,
    isAdjustingPosition = false,
    fileInputRef,
    onAdjustToggle,
    onBannerYChange,
    onSavePosition,
    onCancelAdjust,
}) => {
    if (businessImage) {
        return (
            <div className={styles.bannerWrapper} style={{ position: 'relative' }}>
                <img
                    src={businessImage}
                    alt={businessName}
                    className={styles.bannerImg}
                    style={{ objectPosition: `center ${bannerY}%` }}
                />
                <div className={styles.bannerOverlay}>
                    <div className={styles.bannerContent}>
                        <span className={styles.bannerLabel}>{label}</span>
                        <h1 className={styles.bannerTitle}>{businessName}</h1>
                        {businessDetails && (
                            <p className={styles.bannerStats} style={{ margin: '4px 0 0 0' }}>
                                📍 {getAddress()}
                            </p>
                        )}
                    </div>
                </div>

                {/* Control de ajuste de encuadre */}
                {isAdjustingPosition && onBannerYChange && onSavePosition && onCancelAdjust && (
                    <div style={{
                        position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
                        background: 'rgba(15, 23, 42, 0.95)', padding: '12px 20px', borderRadius: '16px',
                        zIndex: 100, display: 'flex', alignItems: 'center', gap: 15, color: 'white',
                        border: '1px solid rgba(255, 255, 255, 0.15)', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
                    }}>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>Ajustar Encuadre Y:</span>
                        <input
                            type="range" min="0" max="100" value={bannerY}
                            onChange={(e) => onBannerYChange(Number(e.target.value))}
                            style={{ cursor: 'pointer', accentColor: '#f97316', width: '150px' }}
                        />
                        <button
                            onClick={async () => { await onSavePosition(); }}
                            style={{
                                background: '#f97316', border: 'none', color: 'white', fontWeight: 'bold',
                                cursor: 'pointer', fontSize: '12px', padding: '6px 12px', borderRadius: '8px', transition: 'background 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#ea580c'}
                            onMouseLeave={e => e.currentTarget.style.background = '#f97316'}
                        >
                            Guardar
                        </button>
                        <button
                            onClick={onCancelAdjust}
                            style={{
                                background: 'rgba(255, 255, 255, 0.15)', border: 'none', color: 'white',
                                fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', padding: '6px 12px', borderRadius: '8px'
                            }}
                        >
                            Cancelar
                        </button>
                    </div>
                )}

                {/* Botones de edición */}
                {canEditBanner && onAdjustToggle && fileInputRef && (
                    <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 8, zIndex: 50 }}>
                        <button
                            onClick={onAdjustToggle}
                            style={{
                                background: '#f97316', border: '2px solid white', borderRadius: '50%',
                                width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', color: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                            }}
                            title="Ajustar encuadre de imagen"
                        >
                            <MoveVertical size={18} color="white" style={{ width: 18, height: 18, flexShrink: 0 }} />
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                background: '#f97316', border: '2px solid white', borderRadius: '50%',
                                width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', color: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                            }}
                            title="Cambiar imagen de portada"
                        >
                            <Pencil size={18} color="white" style={{ width: 18, height: 18, flexShrink: 0 }} />
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // Sin imagen: header simple
    return (
        <div className={styles.simpleHeader} style={{ position: 'relative' }}>
            {label && (
                <span className={styles.bannerLabel} style={{ color: '#d14d13', display: 'block', marginBottom: '5px' }}>
                    {label}
                </span>
            )}
            <h1 className={styles.businessTitle}>{businessName}</h1>
            {businessDetails && (
                <p className={styles.businessSubtitle} style={{ margin: '8px 0 0 0', color: '#64748b' }}>
                    📍 {getAddress()}
                </p>
            )}
            {canEditBanner && fileInputRef && (
                <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                        position: 'absolute', top: 12, right: 12, background: '#f97316',
                        border: '2px solid white', borderRadius: '50%', width: 36, height: 36,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: 'white', zIndex: 50, boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                    }}
                    title="Añadir imagen de portada"
                >
                    <Pencil size={18} color="white" style={{ width: 18, height: 18, flexShrink: 0 }} />
                </button>
            )}
        </div>
    );
};

export default BusinessBanner;
