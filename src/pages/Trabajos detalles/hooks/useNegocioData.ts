import { useState, useEffect, useRef } from 'react';
import { getNegocio, getNegocios, updateNegocio, uploadImage } from '../../../services/negociosService';
import { compressImage } from '../../../utils/imageCompression';
import { useModal } from '../../../context/ModalContext';

export interface NegocioDataReturn {
    businessName: string;
    setBusinessName: React.Dispatch<React.SetStateAction<string>>;
    businessImage: string | null;
    setBusinessImage: React.Dispatch<React.SetStateAction<string | null>>;
    businessDetails: any;
    businessAreas: any[];
    setBusinessAreas: React.Dispatch<React.SetStateAction<any[]>>;
    bannerY: number;
    setBannerY: React.Dispatch<React.SetStateAction<number>>;
    isAdjustingPosition: boolean;
    setIsAdjustingPosition: React.Dispatch<React.SetStateAction<boolean>>;
    fileInputRef: React.RefObject<HTMLInputElement>;
    handleBannerChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    saveBannerPosition: () => Promise<void>;
    getBusinessAddress: () => string;
}

/**
 * Hook que centraliza toda la información del negocio/sucursal:
 * nombre, imagen de portada, áreas del levantamiento y detalles completos.
 *
 * @param id         - ID del negocio (string de useParams)
 * @param onLoaded   - Callback que recibe el nombre ya resuelto para sincronizar
 *                     otros estados del componente padre (e.g. newRequestData.cliente)
 */
export const useNegocioData = (
    id: string | undefined,
    onLoaded?: (name: string) => void
): NegocioDataReturn => {
    const { showAlert } = useModal();

    const [businessName, setBusinessName] = useState('Cargando...');
    const [businessImage, setBusinessImage] = useState<string | null>(null);
    const [businessDetails, setBusinessDetails] = useState<any>(null);
    const [businessAreas, setBusinessAreas] = useState<any[]>([]);
    const [bannerY, setBannerY] = useState(50);
    const [isAdjustingPosition, setIsAdjustingPosition] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sincronizar posición Y del banner desde el parámetro en la URL de imagen
    useEffect(() => {
        if (businessImage) {
            const match = businessImage.match(/[?&]posy=(\d+)/);
            setBannerY(match ? Number(match[1]) : 50);
        }
    }, [businessImage]);

const formatAreasFromBackend = (areas: any[]) => {
    if (!Array.isArray(areas)) return [];
    return areas.map((serverArea: any) => {
        const subAreasMap = new Map<string, any>();

        if (serverArea.sub_areas_json && Array.isArray(serverArea.sub_areas_json)) {
            serverArea.sub_areas_json.forEach((sub: any) => {
                subAreasMap.set(sub.id, { ...sub, equipos: [] });
            });
        }

        if (serverArea.subAreas && Array.isArray(serverArea.subAreas)) {
            serverArea.subAreas.forEach((sub: any) => {
                if (!subAreasMap.has(sub.id)) {
                    subAreasMap.set(sub.id, { ...sub, equipos: [] });
                }
            });
        }

        (serverArea.equipos || []).forEach((eq: any) => {
            const subId = eq.subAreaId || `sub_gen_${serverArea.id}`;
            const subName = eq.nombreSubArea || 'GENERAL';
            if (!subAreasMap.has(subId)) {
                subAreasMap.set(subId, { id: subId, nombreSubArea: subName, equipos: [] });
            }
            subAreasMap.get(subId)!.equipos.push(eq);
        });

        let finalSubAreas = Array.from(subAreasMap.values());
        if (finalSubAreas.length === 0) {
            finalSubAreas = [{ id: `sub_gen_${serverArea.id}`, nombreSubArea: 'GENERAL', equipos: serverArea.equipos || [] }];
        }

        return {
            ...serverArea,
            equipos: serverArea.equipos || [],
            subAreas: finalSubAreas
        };
    });
};

    // Cargar datos del negocio
    useEffect(() => {
        if (!id) return;

        // 1. Carga inmediata desde caché local para evitar pantalla "Cargando..."
        const cachedRaw = localStorage.getItem('negocios_list');
        if (cachedRaw) {
            try {
                const cachedList = JSON.parse(cachedRaw);
                const found = cachedList.find((n: any) => n.id === Number(id));
                if (found) {
                    const plaza = found.nombrePlaza || found.nombre_plaza;
                    const fullName = plaza ? `${found.nombre} - ${plaza}` : found.nombre;
                    setBusinessName(fullName);
                    setBusinessImage(found.imagen_portada || null);
                    setBusinessDetails(found);
                    if (found.areas && found.areas.length > 0) {
                        setBusinessAreas(formatAreasFromBackend(found.areas));
                    }
                    onLoaded?.(fullName);
                }
            } catch (_) {}
        }

        // 2. Consulta directa única del negocio individual al servidor
        const fetchBusiness = async () => {
            try {
                const res = await getNegocio(Number(id));
                const individual = res?.data || res;
                if (!individual) return;

                const rawAreas = individual.areas || [];
                if (rawAreas && rawAreas.length > 0) {
                    setBusinessAreas(formatAreasFromBackend(rawAreas));
                }

                setBusinessDetails(individual);

                const indPlaza = individual.nombrePlaza || individual.nombre_plaza;
                const fullName = indPlaza ? `${individual.nombre} - ${indPlaza}` : (individual.nombre || 'Desconocido');
                setBusinessImage(individual.imagen_portada || null);
                setBusinessName(fullName);
                onLoaded?.(fullName);
            } catch (err) {
                console.error('Error cargando nombre del negocio:', err);
                if (businessName === 'Cargando...') {
                    setBusinessName('Desconocido');
                    onLoaded?.('Desconocido');
                }
            }
        };

        fetchBusiness();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const saveBannerPosition = async () => {
        if (!id || !businessImage) return;
        const baseUrl = businessImage.split(/[?#]/)[0];
        const newUrl = `${baseUrl}?posy=${bannerY}`;
        try {
            await updateNegocio(Number(id), { imagen_portada: newUrl });
            setBusinessImage(newUrl);
            showAlert('Éxito', 'Posición de portada guardada', 'success');
        } catch (error) {
            console.error('Error al guardar posición de portada:', error);
            showAlert('Error', 'No se pudo guardar la posición', 'error');
        }
    };

    const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !id) return;
        try {
            const compressedFile = await compressImage(file, 1600, 1600, 0.6);
            const url = await uploadImage(compressedFile);
            await updateNegocio(Number(id), { imagen_portada: url });
            setBusinessImage(url);
            showAlert('Éxito', 'Imagen de portada actualizada', 'success');
        } catch (error) {
            console.error('Error al actualizar imagen de portada:', error);
            showAlert('Error', 'No se pudo actualizar la imagen', 'error');
        }
    };

    const getBusinessAddress = () => {
        if (!businessDetails) return '';
        const neg = businessDetails;
        const ubicacion =
            neg.tipo === 'W/M'
                ? [neg.calleAv, neg.manzana ? `Mza ${neg.manzana}` : '', neg.lote ? `Lote ${neg.lote}` : '']
                      .filter(Boolean)
                      .join(', ')
                : [neg.calle, neg.numero ? `#${neg.numero}` : '', neg.colonia].filter(Boolean).join(', ');
        const estadoCiudad = [neg.ciudad, neg.estado].filter(Boolean).join(', ');
        return [ubicacion, estadoCiudad, neg.cp ? `CP ${neg.cp}` : ''].filter(Boolean).join(' · ');
    };

    return {
        businessName,
        setBusinessName,
        businessImage,
        setBusinessImage,
        businessDetails,
        businessAreas,
        setBusinessAreas,
        bannerY,
        setBannerY,
        isAdjustingPosition,
        setIsAdjustingPosition,
        fileInputRef,
        handleBannerChange,
        saveBannerPosition,
        getBusinessAddress,
    };
};
