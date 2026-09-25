import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Keep-alive: ping el backend cada 9 minutos solo en producción (evita que Railway hiberne el servidor)
if (import.meta.env.PROD) {
  const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'https://mantenere-backend-production.up.railway.app';
  const keepAlive = () => fetch(`${BACKEND_URL}/ping`, { method: 'GET', cache: 'no-cache' }).catch(() => {});
  keepAlive(); // ping inmediato al cargar la app en producción
  setInterval(keepAlive, 9 * 60 * 1000); // ping cada 9 minutos
}

// Safeguard against Google Translate / browser extensions mutating DOM and breaking React removeChild / insertBefore
if (typeof Node === 'function' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      if (console) {
        console.warn('Cannot remove child: not a child of this node', child, this);
      }
      return child;
    }
    return originalRemoveChild.apply(this, arguments as any) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (console) {
        console.warn('Cannot insert before: reference node is not a child of this node', referenceNode, this);
      }
      return newNode;
    }
    return originalInsertBefore.apply(this, arguments as any) as T;
  };
}

createRoot(document.getElementById('root')!).render(
  <App />
)
