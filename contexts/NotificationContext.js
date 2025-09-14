// contexts/NotificationContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Función para verificar si una fecha es hoy
  const isToday = (dateString) => {
    if (!dateString) return false;
    const today = new Date();
    const date = new Date(dateString + 'T00:00:00');
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth();
  };

  // Función para verificar si una fecha es mañana
  const isTomorrow = (dateString) => {
    if (!dateString) return false;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = new Date(dateString + 'T00:00:00');
    return date.getDate() === tomorrow.getDate() && 
           date.getMonth() === tomorrow.getMonth();
  };

  // Función para generar notificaciones de cumpleaños
  const generateBirthdayNotifications = (clientes) => {
    const birthdayNotifications = [];
    const today = new Date();

    clientes.forEach(cliente => {
      if (!cliente.fechaNacimiento) return;

      // Notificación para cumpleaños hoy
      if (isToday(cliente.fechaNacimiento)) {
        birthdayNotifications.push({
          id: `birthday-today-${cliente.id}`,
          type: 'birthday_today',
          title: '🎉 ¡Cumpleaños Hoy!',
          message: `Hoy es el cumpleaños de ${cliente.nombre} ${cliente.apellido || ''}`.trim(),
          clienteId: cliente.id,
          clienteName: `${cliente.nombre} ${cliente.apellido || ''}`.trim(),
          date: today.toISOString(),
          read: false,
          priority: 'high'
        });
      }

      // Notificación para cumpleaños mañana
      if (isTomorrow(cliente.fechaNacimiento)) {
        birthdayNotifications.push({
          id: `birthday-tomorrow-${cliente.id}`,
          type: 'birthday_tomorrow',
          title: '🎂 Cumpleaños Mañana',
          message: `Mañana es el cumpleaños de ${cliente.nombre} ${cliente.apellido || ''}`.trim(),
          clienteId: cliente.id,
          clienteName: `${cliente.nombre} ${cliente.apellido || ''}`.trim(),
          date: today.toISOString(),
          read: false,
          priority: 'medium'
        });
      }
    });

    return birthdayNotifications;
  };

  // Función para generar notificaciones de productos faltantes
  const generateLowStockNotifications = (productos) => {
    const lowStockNotifications = [];
    const today = new Date();

    productos.forEach(producto => {
      const currentStock = typeof producto.stockActual === 'number' ? producto.stockActual : 0;
      const thresholdStock = typeof producto.stockReferencialUmbral === 'number' ? producto.stockReferencialUmbral : 0;
      
      // Condición: stockActual es menor o igual al stockReferencialUmbral
      if (currentStock <= thresholdStock) {
        // Determinar prioridad basada en qué tan crítico es el stock
        let priority = 'medium';
        let title = '⚠️ Stock Bajo';
        
        if (currentStock === 0) {
          priority = 'high';
          title = '🚨 Sin Stock';
        } else if (currentStock <= thresholdStock * 0.5) {
          priority = 'high';
          title = '🚨 Stock Crítico';
        }

        // Construir información adicional de códigos
        const codigoProveedor = producto.codigoProveedor || 'N/A';
        const codigoTienda = producto.codigoTienda || 'N/A';
        
        // Construir el mensaje con los códigos
        let message = `${producto.nombre || 'Producto'} tiene ${currentStock} unidades`;
        
        // Agregar información de códigos si están disponibles
        const codigoInfo = [];
        if (codigoProveedor !== 'N/A') {
          codigoInfo.push(`C.Prov: ${codigoProveedor}`);
        }
        if (codigoTienda !== 'N/A') {
          codigoInfo.push(`C.Tienda: ${codigoTienda}`);
        }
        
        if (codigoInfo.length > 0) {
          message += ` • ${codigoInfo.join(' • ')}`;
        }

        lowStockNotifications.push({
          id: `low-stock-${producto.id}`,
          type: 'low_stock',
          title: title,
          message: message,
          productoId: producto.id,
          productoName: producto.nombre || 'Producto sin nombre',
          currentStock: currentStock,
          thresholdStock: thresholdStock,
          codigoProveedor: codigoProveedor,
          codigoTienda: codigoTienda,
          date: today.toISOString(),
          read: false,
          priority: priority
        });
      }
    });

    return lowStockNotifications;
  };

  // Función para cargar notificaciones
  const loadNotifications = async () => {
    try {
      setLoading(true);
      
      // Cargar clientes desde Firebase
      const clientesQuery = query(collection(db, 'cliente'));
      const clientesSnapshot = await getDocs(clientesQuery);
      const clientes = clientesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Cargar productos desde Firebase
      const productosQuery = query(collection(db, 'productos'), orderBy('nombre', 'asc'));
      const productosSnapshot = await getDocs(productosQuery);
      const productos = productosSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Generar notificaciones de cumpleaños
      const birthdayNotifications = generateBirthdayNotifications(clientes);

      // Generar notificaciones de productos faltantes
      const lowStockNotifications = generateLowStockNotifications(productos);

      // Combinar todas las notificaciones
      const allNotifications = [
        ...birthdayNotifications,
        ...lowStockNotifications
        // Aquí puedes agregar más tipos de notificaciones en el futuro
      ];

      // Ordenar por prioridad y fecha
      const sortedNotifications = allNotifications.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return new Date(b.date) - new Date(a.date);
      });

      setNotifications(sortedNotifications);
      setUnreadCount(sortedNotifications.filter(n => !n.read).length);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Marcar notificación como leída
  const markAsRead = (notificationId) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true }
          : notification
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  // Marcar todas como leídas
  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
    setUnreadCount(0);
  };

  // Eliminar notificación
  const removeNotification = (notificationId) => {
    const notification = notifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  // Cargar notificaciones al inicializar y cada hora
  useEffect(() => {
    loadNotifications();
    
    // Recargar notificaciones cada hora
    const interval = setInterval(loadNotifications, 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const value = {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    removeNotification,
    refreshNotifications: loadNotifications
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;