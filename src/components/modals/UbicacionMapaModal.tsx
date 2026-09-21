import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
    HiOutlineXMark, 
    HiOutlineMapPin, 
    HiOutlineUser, 
    HiOutlineBuildingStorefront, 
    HiOutlineArrowTopRightOnSquare,
    HiOutlineArrowPath,
    HiOutlineCheckCircle,
    HiOutlineClock,
    HiOutlineSparkles
} from 'react-icons/hi2';


interface UbicacionMapaModalProps {
    isOpen: boolean;
    onClose: () => void;
    sucursalName: string;
    direccion: {
        calle?: string;
        numero?: string;
        colonia?: string;
        ciudad?: string;
        estado?: string;
        plaza?: string;
    };
    tecnicoName?: string;
    tecnicoCoords?: { lat: number; lng: number } | null;
    llegadaConfirmadaAt?: string | null;
    sucursalCoordsProp?: { lat: number; lng: number } | null;
    onConfirmLlegada?: (coords: { lat: number; lng: number }) => void;
    userRole?: string;
    jobId?: number | string;
}

const UbicacionMapaModal: React.FC<UbicacionMapaModalProps> = ({
    isOpen,
    onClose,
    sucursalName,
    direccion,
    tecnicoName = 'Técnico Asignado',
    tecnicoCoords,
    llegadaConfirmadaAt,
    onConfirmLlegada,
    userRole = 'encargado',
    sucursalCoordsProp,
    jobId
}) => {
    const formatLlegadaDate = (val: string | null) => {
        if (!val || val === 'Registrada') return val || '';
        const date = new Date(val);
        return isNaN(date.getTime()) ? val : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);

    // Estado reactivo para las coordenadas del técnico
    const [liveTecnicoCoords, setLiveTecnicoCoords] = useState<{ lat: number; lng: number } | null>(() => {
        if (tecnicoCoords) return tecnicoCoords;
        if (jobId) {
            const stored = localStorage.getItem(`gps_llegada_${jobId}`);
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    if (parsed.coords) return parsed.coords;
                } catch(e){}
            }
        }
        return null;
    });

    const [liveLlegadaAt, setLiveLlegadaAt] = useState<string | null>(() => {
        if (llegadaConfirmadaAt) return llegadaConfirmadaAt;
        if (jobId) {
            const stored = localStorage.getItem(`gps_llegada_${jobId}`);
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    if (parsed.at) return parsed.at;
                } catch(e){}
            }
        }
        return null;
    });

    useEffect(() => {
        if (tecnicoCoords) {
            setLiveTecnicoCoords(tecnicoCoords);
        } else if (jobId) {
            const stored = localStorage.getItem(`gps_llegada_${jobId}`);
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    if (parsed.coords) setLiveTecnicoCoords(parsed.coords);
                } catch(e){}
            }
        }

        if (llegadaConfirmadaAt) {
            setLiveLlegadaAt(llegadaConfirmadaAt);
        } else if (jobId) {
            const stored = localStorage.getItem(`gps_llegada_${jobId}`);
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    if (parsed.at) setLiveLlegadaAt(parsed.at);
                } catch(e){}
            }
        }
    }, [tecnicoCoords, llegadaConfirmadaAt, jobId, isOpen]);

    const [sucursalCoords, setSucursalCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [isGeocoding, setIsGeocoding] = useState<boolean>(true);
    const [geocodingError, setGeocodingError] = useState<string | null>(null);
    const [distanceKm, setDistanceKm] = useState<number | null>(null);
    const [isCapturingGps, setIsCapturingGps] = useState<boolean>(false);

    // Formatear dirección completa
    const fullAddress = [
        direccion.calle ? `${direccion.calle} ${direccion.numero || ''}`.trim() : '',
        direccion.colonia,
        direccion.ciudad || 'Mérida',
        direccion.estado || 'Yucatán',
        'México'
    ].filter(Boolean).join(', ');

    // 1. GEOCODIFICACIÓN DE LA SUCURSAL BASADA EN LA DIRECCIÓN REGISTRADA
    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        setIsGeocoding(true);
        setGeocodingError(null);

        if (sucursalCoordsProp) {
            setSucursalCoords(sucursalCoordsProp);
            setIsGeocoding(false);
            return;
        }

        const geocodeAddress = async () => {
            try {
                // Intento 1: Dirección completa con calle y número
                const query1 = encodeURIComponent(fullAddress);
                const res1 = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query1}&limit=1`);
                const data1 = await res1.json();

                if (data1 && data1.length > 0) {
                    if (isMounted) {
                        setSucursalCoords({
                            lat: parseFloat(data1[0].lat),
                            lng: parseFloat(data1[0].lon)
                        });
                        setIsGeocoding(false);
                    }
                    return;
                }

                // Intento 2: Colonia, Ciudad y Estado
                const fallbackAddress = [direccion.colonia, direccion.ciudad || 'Mérida', direccion.estado || 'Yucatán', 'México'].filter(Boolean).join(', ');
                const query2 = encodeURIComponent(fallbackAddress);
                const res2 = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query2}&limit=1`);
                const data2 = await res2.json();

                if (data2 && data2.length > 0) {
                    if (isMounted) {
                        setSucursalCoords({
                            lat: parseFloat(data2[0].lat),
                            lng: parseFloat(data2[0].lon)
                        });
                        setIsGeocoding(false);
                    }
                    return;
                }

                // Coordenadas por defecto (Mérida, Yucatán)
                if (isMounted) {
                    setSucursalCoords({ lat: 20.9676, lng: -89.5926 });
                    setGeocodingError('Ubicación aproximada por ciudad/estado.');
                    setIsGeocoding(false);
                }
            } catch (err) {
                console.error("Geocoding error:", err);
                if (isMounted) {
                    setSucursalCoords({ lat: 20.9676, lng: -89.5926 });
                    setGeocodingError('Error en geocodificación. Mostrando zona estándar.');
                    setIsGeocoding(false);
                }
            }
        };

        geocodeAddress();

        return () => {
            isMounted = false;
        };
    }, [isOpen, fullAddress]);

    // 2. INICIALIZAR Y ACTUALIZAR MAPA INTERACTIVO DE LEAFLET
    useEffect(() => {
        if (!isOpen || !mapContainerRef.current || !sucursalCoords) return;

        // Limpiar mapa anterior si existe
        if (mapInstanceRef.current) {
            try {
                mapInstanceRef.current.off();
                mapInstanceRef.current.remove();
            } catch (e) {}
            mapInstanceRef.current = null;
        }

        if ((mapContainerRef.current as any)._leaflet_id) {
            (mapContainerRef.current as any)._leaflet_id = null;
        }

        const map = L.map(mapContainerRef.current).setView([sucursalCoords.lat, sucursalCoords.lng], 15);
        mapInstanceRef.current = map;

        // Capa de mosaicos OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19,
            subdomains: ['a', 'b', 'c']
        }).addTo(map);

        // ICONO DE SUCURSAL 🏪
        const sucursalIcon = L.divIcon({
            className: 'custom-sucursal-marker',
            html: `
                <div style="
                    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
                    color: white;
                    width: 46px;
                    height: 46px;
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 6px 16px rgba(37, 99, 235, 0.45);
                    border: 3px solid #ffffff;
                ">
                    <span style="transform: rotate(45deg); font-size: 22px;">🏪</span>
                </div>
            `,
            iconSize: [46, 46],
            iconAnchor: [23, 46],
            popupAnchor: [0, -46]
        });

        const sucursalMarker = L.marker([sucursalCoords.lat, sucursalCoords.lng], { icon: sucursalIcon })
            .addTo(map)
            .bindPopup(`
                <div style="font-family: sans-serif; padding: 4px;">
                    <strong style="color: #1e293b; font-size: 14px; display: block; margin-bottom: 2px;">🏪 ${sucursalName}</strong>
                    <span style="color: #64748b; font-size: 11px;">${fullAddress}</span>
                </div>
            `);

        const boundsGroup: L.LatLngExpression[] = [[sucursalCoords.lat, sucursalCoords.lng]];

        // ICONO DE TÉCNICO 👷
        if (liveTecnicoCoords) {
            const tecnicoIcon = L.divIcon({
                className: 'custom-tecnico-marker',
                html: `
                    <div style="
                        background: linear-gradient(135deg, #059669 0%, #10b981 100%);
                        color: white;
                        width: 46px;
                        height: 46px;
                        border-radius: 50% 50% 50% 0;
                        transform: rotate(-45deg);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 6px 16px rgba(16, 185, 129, 0.45);
                        border: 3px solid #ffffff;
                    ">
                        <span style="transform: rotate(45deg); font-size: 22px;">👷</span>
                    </div>
                `,
                iconSize: [46, 46],
                iconAnchor: [23, 46],
                popupAnchor: [0, -46]
            });

            const horaText = liveLlegadaAt ? formatLlegadaDate(liveLlegadaAt) : 'Llegada confirmada';

            L.marker([liveTecnicoCoords.lat, liveTecnicoCoords.lng], { icon: tecnicoIcon })
                .addTo(map)
                .bindPopup(`
                    <div style="font-family: sans-serif; padding: 4px;">
                        <strong style="color: #065f46; font-size: 14px; display: block; margin-bottom: 2px;">👷 ${tecnicoName}</strong>
                        <span style="color: #047857; font-size: 11px; font-weight: bold;">Llegada confirmada: ${horaText}</span>
                    </div>
                `);

            boundsGroup.push([liveTecnicoCoords.lat, liveTecnicoCoords.lng]);

            // Dibujar línea conectora entre Técnico y Sucursal
            L.polyline([[liveTecnicoCoords.lat, liveTecnicoCoords.lng], [sucursalCoords.lat, sucursalCoords.lng]], {
                color: '#10b981',
                weight: 3,
                dashArray: '6, 8',
                opacity: 0.8
            }).addTo(map);

            // Calcular distancia en km
            const from = L.latLng(sucursalCoords.lat, sucursalCoords.lng);
            const to = L.latLng(liveTecnicoCoords.lat, liveTecnicoCoords.lng);
            const distMeters = from.distanceTo(to);
            setDistanceKm(parseFloat((distMeters / 1000).toFixed(2)));
        } else {
            setDistanceKm(null);
        }

        // Ajustar zoom para enfocar ambos marcadores
        if (boundsGroup.length > 1) {
            map.fitBounds(L.latLngBounds(boundsGroup), { padding: [60, 60] });
        } else {
            map.setView([sucursalCoords.lat, sucursalCoords.lng], 15);
        }

        return () => {
            if (mapInstanceRef.current) {
                try {
                    mapInstanceRef.current.off();
                    mapInstanceRef.current.remove();
                } catch (e) {}
                mapInstanceRef.current = null;
            }
        };
    }, [isOpen, sucursalCoords, liveTecnicoCoords, liveLlegadaAt, sucursalName, fullAddress, tecnicoName]);

    // OBTENER UBICACIÓN GPS ACTUAL DEL DISPOSITIVO
    const handleCapturarLlegadaGps = () => {
        if (!navigator.geolocation) {
            alert("La geolocalización no está soportada por este navegador.");
            return;
        }

        setIsCapturingGps(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const coords = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                const timeNow = new Date().toISOString();

                setLiveTecnicoCoords(coords);
                setLiveLlegadaAt(timeNow);
                setIsCapturingGps(false);

                if (jobId) {
                    localStorage.setItem(`gps_llegada_${jobId}`, JSON.stringify({
                        coords,
                        at: timeNow
                    }));
                }

                if (onConfirmLlegada) {
                    onConfirmLlegada(coords);
                }
            },
            (error) => {
                console.error("GPS Error:", error);
                setIsCapturingGps(false);
                alert("No se pudo obtener la ubicación GPS actual. Por favor verifica los permisos de ubicación en tu navegador.");
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
        }} onClick={onClose}>
            <div style={{
                background: '#ffffff',
                width: '100%',
                maxWidth: '920px',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '90vh',
                border: '1px solid #cbd5e1'
            }} onClick={e => e.stopPropagation()}>
                
                {/* MODAL HEADER */}
                <div style={{
                    padding: '20px 24px',
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: 'rgba(255, 255, 255, 0.15)', padding: '10px', borderRadius: '14px', display: 'flex' }}>
                            <HiOutlineMapPin size={22} color="#38bdf8" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', letterSpacing: '-0.3px', color: '#ffffff' }}>
                                Ubicación GPS y Rastreo en Tiempo Real
                            </h3>
                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                                Sucursal {sucursalName} • Coordinación de Visita Técnica
                            </span>
                        </div>
                    </div>

                    <button 
                        onClick={onClose}
                        title="Cerrar ventana del mapa"
                        style={{
                            background: '#ef4444',
                            border: '2px solid #ffffff',
                            color: '#ffffff',
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '20px',
                            fontWeight: '900',
                            lineHeight: '1',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.5)'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = '#dc2626';
                            e.currentTarget.style.transform = 'scale(1.1)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = '#ef4444';
                            e.currentTarget.style.transform = 'scale(1)';
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* INFO STATUS BAR */}
                <div style={{
                    background: '#f8fafc',
                    padding: '14px 24px',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '16px',
                    alignItems: 'center',
                    justify: 'space-between'
                }}>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {/* Indicador Sucursal */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '18px' }}>🏪</span>
                            <div>
                                <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Sucursal</span>
                                <strong style={{ fontSize: '13px', color: '#1e293b' }}>{sucursalName}</strong>
                            </div>
                        </div>

                        {/* Indicador Técnico */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '18px' }}>👷</span>
                            <div>
                                <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Técnico Asignado</span>
                                <strong style={{ fontSize: '13px', color: '#059669' }}>{tecnicoName}</strong>
                            </div>
                        </div>

                        {/* Estado Llegada */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {liveTecnicoCoords ? (
                                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '4px 10px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <HiOutlineCheckCircle color="#059669" size={16} />
                                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#047857' }}>
                                        Llegada Confirmada {liveLlegadaAt ? `(${formatLlegadaDate(liveLlegadaAt)})` : ''}
                                    </span>
                                </div>
                            ) : (
                                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '4px 10px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <HiOutlineClock color="#d97706" size={16} />
                                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#b45309' }}>
                                        Pendiente de confirmar llegada
                                    </span>
                                </div>
                            )}
                        </div>

                        {distanceKm !== null && (
                            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '4px 10px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '12px', fontWeight: '800', color: '#1d4ed8' }}>
                                    📍 Distancia: {distanceKm} km
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Botón de Google Maps */}
                    {sucursalCoords && (
                        <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${sucursalCoords.lat},${sucursalCoords.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                padding: '6px 12px',
                                borderRadius: '10px',
                                color: '#1e293b',
                                fontSize: '12px',
                                fontWeight: '700',
                                textDecoration: 'none',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
                            }}
                        >
                            Abrir en Google Maps <HiOutlineArrowTopRightOnSquare size={14} />
                        </a>
                    )}
                </div>

                {/* DIRECCIÓN Y AVISO DE GEOCODIFICACIÓN */}
                <div style={{ padding: '10px 24px', background: '#ffffff', borderBottom: '1px solid #f1f5f9', fontSize: '12px', color: '#475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <strong>📍 Dirección registrada:</strong> {fullAddress}
                    </div>
                    {isGeocoding ? (
                        <span style={{ color: '#2563eb', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <HiOutlineArrowPath className="animate-spin" size={14} /> Localizando dirección...
                        </span>
                    ) : geocodingError ? (
                        <span style={{ color: '#d97706', fontWeight: '600' }}>⚠️ {geocodingError}</span>
                    ) : (
                        <span style={{ color: '#059669', fontWeight: '700' }}>✓ Ubicación exacta de la sucursal ajustada</span>
                    )}
                </div>

                {/* ÁREA DEL MAPA */}
                <div style={{ flex: 1, minHeight: '380px', position: 'relative' }}>
                    <div ref={mapContainerRef} style={{ width: '100%', height: '100%', minHeight: '380px' }} />

                    {/* Botón Flotante para Confirmar / Capturar Ubicación GPS */}
                    <div style={{
                        position: 'absolute',
                        bottom: '20px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1000,
                        boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
                    }}>
                        <button
                            onClick={handleCapturarLlegadaGps}
                            disabled={isCapturingGps}
                            style={{
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: '#ffffff',
                                border: 'none',
                                padding: '14px 28px',
                                borderRadius: '30px',
                                fontSize: '14px',
                                fontWeight: '800',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <HiOutlineSparkles size={18} />
                            {isCapturingGps 
                                ? 'Obteniendo GPS actual...' 
                                : (liveTecnicoCoords 
                                    ? '📍 Actualizar Ubicación del Técnico (GPS)' 
                                    : '📍 Confirmar Ubicación del Técnico (GPS)'
                                  )}
                        </button>
                    </div>
                </div>

                {/* MODAL FOOTER */}
                <div style={{
                    padding: '16px 24px',
                    background: '#f8fafc',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    justify: 'space-between',
                    alignItems: 'center'
                }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                        Los íconos 🏪 Sucursal y 👷 Técnico permiten identificar y comparar ambas ubicaciones en el mapa.
                    </span>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '9px 20px',
                            background: '#0f172a',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: 'pointer'
                        }}
                    >
                        Cerrar Mapa
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UbicacionMapaModal;


