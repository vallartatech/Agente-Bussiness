import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ShieldCheck,
    Users,
    Layers,
    Clock,
    BarChart3,
    Calculator,
    ChevronDown,
    CheckCircle2,
    ArrowRight,
    Phone,
    Mail,
    MapPin,
    Menu as MenuIcon,
    X
} from 'lucide-react';
import logoAgente from '../../assets/imagenes/logo-agente-business.png';
import './Home.css';

const Home: React.FC = () => {
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    // Block scroll on landing-page-container when mobile menu is open
    useEffect(() => {
        const scrollContainer = document.querySelector('.landing-page-container') as HTMLElement;
        if (scrollContainer) {
            if (isMobileMenuOpen) {
                scrollContainer.style.overflowY = 'hidden';
            } else {
                scrollContainer.style.overflowY = 'auto';
            }
        }
        return () => {
            if (scrollContainer) {
                scrollContainer.style.overflowY = 'auto';
            }
        };
    }, [isMobileMenuOpen]);

    // Observer setup for scroll animations
    useEffect(() => {
        const observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.15
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, observerOptions);

        const revealElements = document.querySelectorAll('.reveal-on-scroll');
        revealElements.forEach((el) => observer.observe(el));

        // Detect scrolling inside our custom scrolling container
        const scrollContainer = document.querySelector('.landing-page-container');
        const handleScroll = () => {
            if (scrollContainer && scrollContainer.scrollTop > 50) {
                setScrolled(true);
            } else {
                setScrolled(false);
            }
        };

        if (scrollContainer) {
            scrollContainer.addEventListener('scroll', handleScroll);
        }

        return () => {
            revealElements.forEach((el) => observer.unobserve(el));
            if (scrollContainer) {
                scrollContainer.removeEventListener('scroll', handleScroll);
            }
        };
    }, []);

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
        setIsMobileMenuOpen(false);
    };

    const handleContactSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        alert('¡Mensaje enviado con éxito! Nos pondremos en contacto contigo pronto.');
    };

    return (
        <div className="landing-page-container">
            {/* Header / Navbar */}
            <header className={`landing-header ${scrolled ? 'scrolled' : ''}`}>
                <div className="navbar-content">
                    <div className="logo-container" onClick={() => scrollToSection('inicio')}>
                        <img src={logoAgente} alt="Agente Business Logo" className="navbar-logo" />
                    </div>

                    {/* Desktop Menu */}
                    <nav className="desktop-nav">
                        <button onClick={() => scrollToSection('inicio')} className="nav-link">Inicio</button>
                        <button onClick={() => scrollToSection('servicios')} className="nav-link">Servicios</button>
                        <button onClick={() => scrollToSection('proceso')} className="nav-link">Proceso</button>
                        <button onClick={() => scrollToSection('estadisticas')} className="nav-link">Estadísticas</button>
                        <button onClick={() => scrollToSection('contacto')} className="nav-link">Contacto</button>
                    </nav>

                    <div className="nav-actions">
                        <button className="login-btn-outline" onClick={() => navigate('/inicio-sesion')}>
                            Iniciar Sesión
                        </button>
                        <button className="mobile-menu-toggle" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                            {isMobileMenuOpen ? <X size={24} /> : <MenuIcon size={24} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                <div className={`mobile-nav ${isMobileMenuOpen ? 'open' : ''}`}>
                    <button onClick={() => scrollToSection('inicio')} className="mobile-link">Inicio</button>
                    <button onClick={() => scrollToSection('servicios')} className="mobile-link">Servicios</button>
                    <button onClick={() => scrollToSection('proceso')} className="mobile-link">Proceso</button>
                    <button onClick={() => scrollToSection('estadisticas')} className="mobile-link">Estadísticas</button>
                    <button onClick={() => scrollToSection('contacto')} className="mobile-link">Contacto</button>
                    <button className="mobile-login-btn" onClick={() => navigate('/inicio-sesion')}>
                        Iniciar Sesión
                    </button>
                </div>
            </header>

            {/* Hero Section */}
            <section id="inicio" className="hero-section">
                <div className="hero-overlay"></div>
                <div className="hero-content">
                    <h1 className="hero-title reveal-on-scroll">
                        Bienvenido a <span className="gradient-text">Agente Business</span>
                    </h1>
                    <p className="hero-subtitle reveal-on-scroll">
                        Soluciones integrales para la gestión y mantenimiento de tus espacios comerciales e industriales.
                        Garantizamos calidad, eficiencia y control en cada proyecto.
                    </p>
                    <div className="hero-buttons reveal-on-scroll">
                        <button className="cta-primary" onClick={() => navigate('/inicio-sesion')}>
                            Comenzar Ahora <ArrowRight size={18} className="btn-icon" />
                        </button>
                        <button className="cta-secondary" onClick={() => scrollToSection('servicios')}>
                            Ver Servicios
                        </button>
                    </div>
                </div>
                <div className="scroll-indicator" onClick={() => scrollToSection('servicios')}>
                    <span>Desliza para explorar</span>
                    <ChevronDown size={24} className="bounce-arrow" />
                </div>
            </section>

            {/* Services / Cards Section */}
            <section id="servicios" className="services-section">
                <div className="section-container">
                    <div className="section-header reveal-on-scroll">
                        <span className="badge">Nuestros Servicios</span>
                        <h2>Soluciones a tu Medida</h2>
                        <p>Diseñamos herramientas robustas para la optimización de procesos de mantenimiento.</p>
                    </div>

                    <div className="cards-grid">
                        {/* Service Card 1 */}
                        <div className="service-card reveal-on-scroll" style={{ transitionDelay: '100ms' }}>
                            <div className="card-icon-wrapper">
                                <ShieldCheck size={32} />
                            </div>
                            <h3>Mantenimiento Preventivo</h3>
                            <p>Programación y control de rutinas preventivas para evitar paros costosos y alargar la vida útil de tus activos.</p>
                        </div>

                        {/* Service Card 2 */}
                        <div className="service-card reveal-on-scroll" style={{ transitionDelay: '200ms' }}>
                            <div className="card-icon-wrapper">
                                <Users size={32} />
                            </div>
                            <h3>Gestión de Personal</h3>
                            <p>Asignación eficiente de tareas, seguimiento del personal técnico y monitoreo en tiempo real de su ubicación y estado.</p>
                        </div>

                        {/* Service Card 3 */}
                        <div className="service-card reveal-on-scroll" style={{ transitionDelay: '300ms' }}>
                            <div className="card-icon-wrapper">
                                <Layers size={32} />
                            </div>
                            <h3>Control de Inventario</h3>
                            <p>Administración digital de repuestos, consumibles y stock crítico, agilizando los tiempos de reparación.</p>
                        </div>

                        {/* Service Card 4 */}
                        <div className="service-card reveal-on-scroll" style={{ transitionDelay: '400ms' }}>
                            <div className="card-icon-wrapper">
                                <Clock size={32} />
                            </div>
                            <h3>Soporte Inmediato</h3>
                            <p>Canal directo para emergencias operativas, asegurando respuestas rápidas que disminuyan el tiempo muerto.</p>
                        </div>

                        {/* Service Card 5 */}
                        <div className="service-card reveal-on-scroll" style={{ transitionDelay: '500ms' }}>
                            <div className="card-icon-wrapper">
                                <BarChart3 size={32} />
                            </div>
                            <h3>Métricas & Reportes</h3>
                            <p>Generación de reportes detallados, análisis de costos, y KPI operativos para la toma de decisiones estratégicas.</p>
                        </div>

                        {/* Service Card 6 */}
                        <div className="service-card reveal-on-scroll" style={{ transitionDelay: '600ms' }}>
                            <div className="card-icon-wrapper">
                                <Calculator size={32} />
                            </div>
                            <h3>Presupuestos Claros</h3>
                            <p>Cálculo de cotizaciones de mano de obra y refacciones con total transparencia para agilizar procesos contables.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section id="proceso" className="process-section">
                <div className="section-container">
                    <div className="section-header reveal-on-scroll">
                        <span className="badge">Flujo de Trabajo</span>
                        <h2>¿Cómo Funciona?</h2>
                        <p>Una plataforma ágil diseñada para optimizar cada paso de la gestión de tus servicios.</p>
                    </div>

                    <div className="process-steps">
                        <div className="step-item reveal-on-scroll">
                            <div className="step-number">01</div>
                            <h4>Registro y Configuración</h4>
                            <p>Registra tu negocio, agrega tus sucursales y da de alta tus equipos o activos a mantener.</p>
                        </div>

                        <div className="step-item reveal-on-scroll">
                            <div className="step-number">02</div>
                            <h4>Generación de Reportes</h4>
                            <p>Crea tickets de fallas o agenda programaciones preventivas de forma simple en pocos clics.</p>
                        </div>

                        <div className="step-item reveal-on-scroll">
                            <div className="step-number">03</div>
                            <h4>Asignación & Trabajo</h4>
                            <p>El sistema notifica al técnico idóneo para resolver la orden, quien registra su progreso digitalmente.</p>
                        </div>

                        <div className="step-item reveal-on-scroll">
                            <div className="step-number">04</div>
                            <h4>Cierre & Validación</h4>
                            <p>Verifica los reportes fotográficos de finalización, valida la calidad del servicio y descarga reportes en PDF.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Statistics Section */}
            <section id="estadisticas" className="stats-section">
                <div className="section-container">
                    <div className="stats-grid">
                        <div className="stat-card reveal-on-scroll">
                            <span className="stat-number">0</span>
                            <span className="stat-label">Negocios e Instalaciones</span>
                        </div>
                        <div className="stat-card reveal-on-scroll" style={{ transitionDelay: '150ms' }}>
                            <span className="stat-number">0%</span>
                            <span className="stat-label">Eficiencia en Tiempos</span>
                        </div>
                        <div className="stat-card reveal-on-scroll" style={{ transitionDelay: '300ms' }}>
                            <span className="stat-number">0</span>
                            <span className="stat-label">Trabajos Completados</span>
                        </div>
                        <div className="stat-card reveal-on-scroll" style={{ transitionDelay: '450ms' }}>
                            <span className="stat-number">24/7</span>
                            <span className="stat-label">Monitoreo y Soporte</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Contact Section */}
            <section id="contacto" className="contact-section">
                <div className="section-container">
                    <div className="contact-layout">
                        <div className="contact-info reveal-on-scroll">
                            <span className="badge">Contacto</span>
                            <h2>¿Listo para optimizar tu gestión?</h2>
                            <p>Ponte en contacto con nuestro equipo para demostraciones, planes empresariales o soporte.</p>

                            <div className="info-list">
                                <div className="info-item">
                                    <Phone className="info-icon" />
                                    <div>
                                        <h4>Llámanos</h4>
                                        <p>+52 (999) 123-4567</p>
                                    </div>
                                </div>
                                <div className="info-item">
                                    <Mail className="info-icon" />
                                    <div>
                                        <h4>Escríbenos</h4>
                                        <p>contacto@agentebusiness.com</p>
                                    </div>
                                </div>
                                <div className="info-item">
                                    <MapPin className="info-icon" />
                                    <div>
                                        <h4>Oficinas</h4>
                                        <p>Mérida, Yucatán, México</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="contact-form-wrapper reveal-on-scroll">
                            <form onSubmit={handleContactSubmit} className="contact-form">
                                <h3>Envíanos un mensaje</h3>
                                <div className="form-group">
                                    <label htmlFor="name">Nombre Completo</label>
                                    <input type="text" id="name" required placeholder="Ingresa tu nombre" />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="email">Correo Electrónico</label>
                                    <input type="email" id="email" required placeholder="ejemplo@correo.com" />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="message">Mensaje</label>
                                    <textarea id="message" rows={4} required placeholder="¿En qué podemos ayudarte?"></textarea>
                                </div>
                                <button type="submit" className="form-submit-btn">
                                    Enviar Mensaje
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="landing-footer">
                <div className="footer-container">
                    <div className="footer-top">
                        <div className="footer-brand">
                            <img src={logoAgente} alt="Logo Agente Business" className="footer-logo" />
                            <p>Plataforma líder en el control, planificación y ejecución de mantenimiento integral para empresas exigentes.</p>
                        </div>
                        <div className="footer-links-col">
                            <h4>Navegación</h4>
                            <ul>
                                <li><button onClick={() => scrollToSection('inicio')}>Inicio</button></li>
                                <li><button onClick={() => scrollToSection('servicios')}>Servicios</button></li>
                                <li><button onClick={() => scrollToSection('proceso')}>Cómo Funciona</button></li>
                                <li><button onClick={() => scrollToSection('contacto')}>Contacto</button></li>
                            </ul>
                        </div>
                        <div className="footer-links-col">
                            <h4>Enlaces Útiles</h4>
                            <ul>
                                <li><button onClick={() => navigate('/inicio-sesion')}>Iniciar Sesión</button></li>
                                <li><button onClick={() => navigate('/registro-sesion')}>Solicitar Acceso</button></li>
                                <li><a href="#terminos" onClick={(e) => e.preventDefault()}>Términos de Servicio</a></li>
                                <li><a href="#privacidad" onClick={(e) => e.preventDefault()}>Política de Privacidad</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="footer-bottom">
                        <p>&copy; {new Date().getFullYear()} Agente Business. Todos los derechos reservados.</p>
                        <p>Diseño premium desarrollado para una experiencia empresarial de alto nivel.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Home;
