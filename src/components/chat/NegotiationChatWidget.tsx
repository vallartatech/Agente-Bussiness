import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { HiOutlineChatAlt2, HiOutlineX, HiOutlinePaperAirplane, HiOutlineDocumentText } from 'react-icons/hi';
import styles from './NegotiationChatWidget.module.css';
import echo from '../../services/echo';

interface Message {
    id: number;
    trabajo_id: number;
    canal?: string;
    sender_id: number;
    message: string;
    is_quote: boolean;
    quote_amount: string | null;
    created_at: string;
    sender: {
        id: number;
        name: string;
        role_id: number;
        role?: {
            id: number;
            name: string;
        };
    };
}

interface ChatProps {
    trabajoId: number;
    currentUser: any; // User object from AuthContext
    onViewVisitInfo?: () => void;
    inlineMode?: boolean;
    forceOpen?: boolean;
    canal?: 'cliente_admin' | 'tecnico_admin' | 'general';
    allowChannelSwitch?: boolean;
    isSOS?: boolean;
}

const NegotiationChatWidget: React.FC<ChatProps> = ({
    trabajoId,
    currentUser,
    onViewVisitInfo,
    inlineMode = false,
    forceOpen = false,
    canal: initialCanalProp,
    allowChannelSwitch,
    isSOS = false
}) => {
    const [isOpen, setIsOpen] = useState(inlineMode ? true : false);

    useEffect(() => {
        if (forceOpen) {
            setIsOpen(true);
        }
    }, [forceOpen]);

    const isAdminUser = currentUser?.role === 'admin' ||
        currentUser?.role === 'autonomo' ||
        currentUser?.role === 'admin-autonomo' ||
        currentUser?.role === 'administrador-general' ||
        currentUser?.role === 'gerente-general';

    const isTechUser = currentUser?.role === 'tecnico' || currentUser?.role === 'tecnico-autonomo';
    const isClientUser = currentUser?.role === 'cliente' || currentUser?.role === 'encargado' || currentUser?.role === 'gerente-sucursal';

    // Canal inicial por defecto
    const getDefaultCanal = (): 'cliente_admin' | 'tecnico_admin' | 'general' => {
        if (isSOS) return 'general';
        if (initialCanalProp) return initialCanalProp;
        if (isTechUser) return 'tecnico_admin';
        if (isClientUser) return 'cliente_admin';
        return 'cliente_admin';
    };

    const [activeCanal, setActiveCanal] = useState<'cliente_admin' | 'tecnico_admin' | 'general'>(getDefaultCanal());

    useEffect(() => {
        if (initialCanalProp) {
            setActiveCanal(initialCanalProp);
        } else {
            setActiveCanal(getDefaultCanal());
        }
    }, [initialCanalProp, isSOS, currentUser?.role]);

    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [unreadCount, setUnreadCount] = useState(0);
    const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const prevMessagesLength = useRef(0);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
    const isFetchingRef = useRef(false);

    const fetchMessages = async (targetCanal?: string) => {
        if (!trabajoId) return;
        const channelToQuery = targetCanal || activeCanal;
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const res = await axios.get(`${API_URL}/trabajos/${trabajoId}/chat`, {
                params: { canal: channelToQuery },
                headers: { Authorization: `Bearer ${token}` }
            });
            const data: Message[] = res.data;
            setMessages(data);

            if (data.length > prevMessagesLength.current) {
                if (!isOpen) {
                    setUnreadCount(prev => prev + (data.length - prevMessagesLength.current));
                }
                prevMessagesLength.current = data.length;
            }
        } catch (error) {
            console.error("Error fetching chats:", error);
        }
    };

    useEffect(() => {
        if (!trabajoId) return;
        fetchMessages(activeCanal);
    }, [trabajoId, activeCanal]);

    useEffect(() => {
        if (!trabajoId) return;

        // Escuchar nuevos mensajes en tiempo real por WebSockets (Reverb)
        const channel = echo.private(`trabajo.${trabajoId}`);
        channel.listen('.ChatMessageSent', (e: { chat: Message }) => {
            if (e.chat) {
                const msgCanal = e.chat.canal || 'cliente_admin';
                // Si el mensaje pertenece al canal activo o estamos en SOS
                if (isSOS || msgCanal === activeCanal) {
                    setMessages(prev => {
                        if (prev.some(m => m.id === e.chat.id)) return prev;
                        return [...prev, e.chat];
                    });
                    if (!isOpen) {
                        setUnreadCount(prev => prev + 1);
                    }
                }
            }
        });

        return () => {
            channel.stopListening('.ChatMessageSent');
        };
    }, [trabajoId, activeCanal, isSOS, isOpen]);

    const scrollToBottom = () => {
        const chatBody = messagesEndRef.current?.parentElement;
        if (chatBody) {
            chatBody.scrollTop = chatBody.scrollHeight;
        }
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
            setUnreadCount(0);
        }
    }, [messages, isOpen]);

    const handleSendMessage = async () => {
        const text = inputText.trim();
        if (!text) return;

        setInputText('');
        try {
            const token = localStorage.getItem('token');
            const payload = {
                message: text,
                canal: activeCanal,
                is_quote: false,
                quote_amount: null
            };
            const res = await axios.post(`${API_URL}/trabajos/${trabajoId}/chat`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data?.id || res.data?.chat?.id) {
                const newChat = res.data.chat || res.data;
                setMessages(prev => {
                    if (prev.some(m => m.id === newChat.id)) return prev;
                    return [...prev, newChat];
                });
            } else {
                fetchMessages(activeCanal);
            }
        } catch (error) {
            console.error("Error sending message:", error);
            setInputText(text);
            setToast({ show: true, message: 'Error al enviar el mensaje.', type: 'error' });
            setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
        }
    };

    // Título y subtítulo del header
    const getHeaderInfo = () => {
        if (isSOS) {
            return {
                title: '🚨 Chat de Emergencia SOS',
                subtitle: `Trabajo #${trabajoId} · Canal Directo en Sitio`,
                icon: '🚨'
            };
        }
        if (isAdminUser) {
            if (activeCanal === 'tecnico_admin') {
                return {
                    title: '🛠️ Chat con el Técnico',
                    subtitle: `Trabajo #${trabajoId} · Coordinación y costos internos`,
                    icon: '🛠️'
                };
            }
            return {
                title: '💬 Chat con el Cliente',
                subtitle: `Trabajo #${trabajoId} · Negociación comercial y dudas`,
                icon: '💬'
            };
        }
        if (isTechUser) {
            return {
                title: '💬 Chat con Administrador',
                subtitle: `Trabajo #${trabajoId} · Coordinación de costos y servicio`,
                icon: '💬'
            };
        }
        return {
            title: '💬 Chat con Administrador',
            subtitle: `Trabajo #${trabajoId} · Consultas y dudas de la cotización`,
            icon: '💬'
        };
    };

    const header = getHeaderInfo();
    const showTabs = allowChannelSwitch !== undefined ? allowChannelSwitch : (!isSOS && isAdminUser);

    const displayedMessages = messages.filter(msg => {
        if (isSOS) return true;
        const msgCanal = msg.canal || 'cliente_admin';
        return msgCanal === activeCanal;
    });

    const handleTabChange = (newCanal: 'cliente_admin' | 'tecnico_admin') => {
        setActiveCanal(newCanal);
        fetchMessages(newCanal);
    };

    return (
        <div className={inlineMode ? styles.chatInlineContainer : styles.chatWidgetContainer}>
            {/* FAB Button */}
            {!isOpen && !inlineMode && (
                <button
                    className={styles.fabButton}
                    onClick={() => setIsOpen(true)}
                    style={{
                        width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #f26522, #d14d13)',
                        color: 'white', border: 'none', boxShadow: '0 8px 24px rgba(242, 101, 34, 0.4)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'
                    }}
                >
                    <HiOutlineChatAlt2 size={32} />
                    {unreadCount > 0 && (
                        <span className={styles.badge}>
                            {unreadCount}
                        </span>
                    )}
                </button>
            )}

            {/* Chat Box */}
            {isOpen && (
                <div className={inlineMode ? styles.chatInlineBox : styles.chatModal}>
                    {/* Header */}
                    <div className={styles.chatHeader}>
                        <div className={styles.headerInfo}>
                            <div className={styles.avatarCircle}>{header.icon}</div>
                            <div>
                                <h4 className={styles.headerTitle}>{header.title}</h4>
                                <span className={styles.headerSubtitle}>{header.subtitle}</span>
                            </div>
                        </div>
                        {!inlineMode && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {onViewVisitInfo && (
                                    <button className={styles.closeBtn} onClick={onViewVisitInfo} title="Ver Información de la Visita">
                                        <HiOutlineDocumentText size={20} />
                                    </button>
                                )}
                                <button className={styles.closeBtn} onClick={() => setIsOpen(false)} title="Cerrar Chat">
                                    <HiOutlineX size={20} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Selector de Pestañas de Canales para el Administrador */}
                    {showTabs && (
                        <div className={styles.channelTabsContainer}>
                            <button
                                type="button"
                                onClick={() => handleTabChange('cliente_admin')}
                                className={`${styles.channelTabBtn} ${activeCanal === 'cliente_admin' ? styles.channelTabBtnActive : ''}`}
                            >
                                💬 Chat Cliente
                            </button>
                            <button
                                type="button"
                                onClick={() => handleTabChange('tecnico_admin')}
                                className={`${styles.channelTabBtn} ${activeCanal === 'tecnico_admin' ? styles.channelTabBtnActive : ''}`}
                            >
                                🛠️ Chat Técnico
                            </button>
                        </div>
                    )}

                    {toast.show && (
                        <div style={{ padding: '10px', background: toast.type === 'success' ? '#10b981' : '#ef4444', color: '#fff', fontSize: '14px', fontWeight: 'bold', textAlign: 'center', animation: 'fadeIn 0.3s ease-out' }}>
                            {toast.message}
                        </div>
                    )}

                    {/* Body */}
                    <div className={styles.chatBody} style={inlineMode ? { maxHeight: '250px', minHeight: '140px', background: '#f8fafc' } : {}}>
                        {displayedMessages.length === 0 ? (
                            <div className={styles.emptyState}>
                                <div className={styles.emptyIcon}>{header.icon}</div>
                                <p>
                                    {activeCanal === 'tecnico_admin'
                                        ? 'Aún no hay mensajes con el técnico. Coordina costos o detalles del servicio.'
                                        : 'Aún no hay mensajes. Comienza la conversación sobre esta solicitud.'}
                                </p>
                            </div>
                        ) : (
                            displayedMessages.map(msg => {
                                const isMe = msg.sender_id === currentUser?.id;
                                return (
                                    <div key={msg.id} className={`${styles.messageWrapper} ${isMe ? styles.messageMe : styles.messageOther}`}>
                                        <div className={styles.senderName}>
                                            {msg.sender?.name || 'Tú'} <span style={{ opacity: 0.7, fontSize: '10px' }}>({msg.sender?.role?.name || 'Usuario'})</span>
                                        </div>
                                        <div className={`${styles.messageBubble} ${isMe ? styles.bubbleMe : styles.bubbleOther}`}>
                                            <div className={styles.messageText}>
                                                {msg.message}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Footer */}
                    <div className={styles.chatFooter}>
                        <div className={styles.inputRow}>
                            <input
                                type="text"
                                className={styles.messageInput}
                                placeholder={
                                    activeCanal === 'tecnico_admin'
                                        ? 'Escribe al técnico (ej: ¿Podemos ajustar mano de obra?)...'
                                        : 'Escribe un mensaje...'
                                }
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                            />

                            <button className={styles.sendBtn} onClick={handleSendMessage} title="Enviar Mensaje">
                                <HiOutlinePaperAirplane style={{ width: '20px', height: '20px', transform: 'rotate(90deg)', flexShrink: 0 }} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NegotiationChatWidget;
