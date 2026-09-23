import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import DetalleTrabajoUnificado from '../DetalleTrabajo/DetalleTrabajoUnificado';

interface ErrorBoundaryProps {
    children: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error, errorInfo: null };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '40px', background: '#fef2f2', border: '2px solid #ef4444', borderRadius: '16px', margin: '20px', color: '#991b1b' }}>
                    <h2 style={{ margin: '0 0 10px', fontSize: '20px', fontWeight: '800' }}>⚠️ Error al cargar el detalle del trabajo</h2>
                    <p style={{ fontWeight: '700', fontSize: '15px' }}>{this.state.error?.toString()}</p>
                    <pre style={{ background: '#fff', padding: '16px', borderRadius: '8px', fontSize: '12px', overflowX: 'auto' }}>
                        {this.state.error?.stack}
                    </pre>
                </div>
            );
        }
        return this.props.children;
    }
}

const AdminDetalleTrabajo: React.FC = () => {
    return (
        <ErrorBoundary>
            <DetalleTrabajoUnificado 
                config={{
                    basePath: '/menu',
                    initialTabDefault: 'Trabajo',
                    canCotizar: true,
                    notificarEcosistema: true
                }} 
            />
        </ErrorBoundary>
    );
};

export default AdminDetalleTrabajo;
