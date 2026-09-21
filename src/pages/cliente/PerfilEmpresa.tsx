import React from 'react';
import PerfilEmpresaUnificado from '../PerfilEmpresa/PerfilEmpresaUnificado';

const PerfilEmpresa: React.FC = () => {
    return (
        <PerfilEmpresaUnificado 
            config={{
                isAutonomo: false,
                canDelete: true,
                useMapLocation: false,
                notificationRoleTarget: 'admin' // Envía la notificación al rol de admin
            }} 
        />
    );
};

export type { Equipment, LevantamientoData, LevantamientoSeccion, LevantamientoSubArea, BusinessData } from '../PerfilEmpresa/PerfilEmpresaUnificado';
export default PerfilEmpresa;
