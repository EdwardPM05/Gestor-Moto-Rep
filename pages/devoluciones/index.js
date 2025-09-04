import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { db } from '../../lib/firebase';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  getDoc,
  where,
  getDocs,
  runTransaction, // ← AGREGAR ESTA LÍNEA
  limit
} from 'firebase/firestore';
import {
  ArrowLeftIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  FunnelIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const DevolucionesIndexPage = () => {
  const { user } = useAuth();
  const router = useRouter();

  const [devoluciones, setDevoluciones] = useState([]);
  const [filteredDevoluciones, setFilteredDevoluciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados para filtros
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [limitPerPage, setLimitPerPage] = useState(20);
  const [selectedEstado, setSelectedEstado] = useState('all');
  const [selectedMotivo, setSelectedMotivo] = useState('all');

  useEffect(() => {
    if (!user) {
      router.push('/auth');
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(collection(db, 'devoluciones'), orderBy('fechaSolicitud', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const devolucionesList = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        
        // Obtener información de la venta relacionada
        let ventaData = null;
        if (data.ventaId) {
          try {
            const ventaDoc = await getDoc(doc(db, 'ventas', data.ventaId));
            if (ventaDoc.exists()) {
              ventaData = ventaDoc.data();
            }
          } catch (err) {
            console.warn(`Error al obtener venta ${data.ventaId}:`, err);
          }
        }

        const devolucionData = {
          id: docSnap.id,
          ...data,
          fechaSolicitud: data.fechaSolicitud?.toDate ? data.fechaSolicitud.toDate() : new Date(),
          fechaSolicitudFormatted: data.fechaSolicitud?.toDate ? 
            data.fechaSolicitud.toDate().toLocaleDateString('es-ES') : 'N/A',
          fechaProcesamiento: data.fechaProcesamiento?.toDate ? data.fechaProcesamiento.toDate() : null,
          fechaProcesamientoFormatted: data.fechaProcesamiento?.toDate ? 
            data.fechaProcesamiento.toDate().toLocaleDateString('es-ES') : null,
          // Datos de la venta relacionada
          numeroVentaOriginal: ventaData?.numeroVenta || data.numeroVenta || 'N/A',
          clienteNombre: ventaData?.clienteNombre || data.clienteNombre || 'Cliente no encontrado',
          totalVentaOriginal: ventaData?.totalVenta || 0
        };

        devolucionesList.push(devolucionData);
      }

      setDevoluciones(devolucionesList);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching devoluciones:", err);
      setError("Error al cargar las devoluciones: " + err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, router]);

  // Función para manejar cambios en filtros de período
  const handleFilterChange = (period) => {
    setFilterPeriod(period);
    const today = new Date();
    
    switch (period) {
      case 'day':
        setStartDate(new Date(today.setHours(0, 0, 0, 0)));
        setEndDate(new Date(today.setHours(23, 59, 59, 999)));
        break;
      case 'week':
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        setStartDate(startOfWeek);
        setEndDate(new Date());
        break;
      case 'month':
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        setStartDate(startOfMonth);
        setEndDate(new Date());
        break;
      case 'all':
      default:
        setStartDate(null);
        setEndDate(null);
        break;
    }
  };

  // Función para filtrar devoluciones
  useEffect(() => {
    let filtered = [...devoluciones];

    // Filtro por término de búsqueda
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(devolucion => {
        const numeroDevolucionMatch = devolucion.numeroDevolucion && typeof devolucion.numeroDevolucion === 'string'
          ? devolucion.numeroDevolucion.toLowerCase().includes(lowerCaseSearchTerm)
          : false;

        const numeroVentaMatch = devolucion.numeroVentaOriginal && typeof devolucion.numeroVentaOriginal === 'string'
          ? devolucion.numeroVentaOriginal.toLowerCase().includes(lowerCaseSearchTerm)
          : false;

        const clienteMatch = devolucion.clienteNombre && typeof devolucion.clienteNombre === 'string'
          ? devolucion.clienteNombre.toLowerCase().includes(lowerCaseSearchTerm)
          : false;

        const motivoMatch = devolucion.motivo && typeof devolucion.motivo === 'string'
          ? devolucion.motivo.toLowerCase().includes(lowerCaseSearchTerm)
          : false;

        return numeroDevolucionMatch || numeroVentaMatch || clienteMatch || motivoMatch;
      });
    }

    // Filtro por fecha
    if (startDate && endDate) {
      filtered = filtered.filter(devolucion => {
        const fechaSolicitud = devolucion.fechaSolicitud;
        if (!fechaSolicitud) return false;
        
        const devolucionDate = new Date(fechaSolicitud);
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        devolucionDate.setHours(12, 0, 0, 0);
        
        return devolucionDate >= start && devolucionDate <= end;
      });
    }

    // Filtro por estado
    if (selectedEstado !== 'all') {
      filtered = filtered.filter(devolucion => devolucion.estado === selectedEstado);
    }

    // Filtro por motivo
    if (selectedMotivo !== 'all') {
      filtered = filtered.filter(devolucion => devolucion.motivo === selectedMotivo);
    }

    // Limitar cantidad por página
    const limitedFiltered = filtered.slice(0, limitPerPage);
    
    setFilteredDevoluciones(limitedFiltered);
  }, [searchTerm, devoluciones, startDate, endDate, selectedEstado, selectedMotivo, limitPerPage]);

  const handleViewDetails = (id) => {
    router.push(`/devoluciones/${id}`);
  };


  const devolverStockLIFO = async (productoId, cantidadADevolver, transaction) => {
  try {
    // Obtener lotes del producto ordenados del más reciente al más antiguo
    // Priorizamos lotes que tengan espacio (stockRestante < stockOriginal)
    const lotesQuery = query(
      collection(db, 'lotes'),
      where('productoId', '==', productoId),
      where('estado', 'in', ['activo', 'agotado']), // Incluir agotados que puedan recibir devolución
      orderBy('fechaIngreso', 'desc') // Del más reciente al más antiguo (LIFO)
    );
    
    const lotesSnapshot = await getDocs(lotesQuery);
    let cantidadPendiente = cantidadADevolver;
    const movimientos = [];
    
    // Devolver a los lotes más recientes primero
    for (const loteDoc of lotesSnapshot.docs) {
      if (cantidadPendiente <= 0) break;
      
      const lote = loteDoc.data();
      const stockOriginal = lote.stockOriginal || lote.stockRestante || 0;
      const stockActual = lote.stockRestante || 0;
      const espacioDisponible = stockOriginal - stockActual;
      
      // Solo usar lotes que tengan espacio disponible
      if (espacioDisponible <= 0) continue;
      
      const cantidadARestaurar = Math.min(cantidadPendiente, espacioDisponible);
      const nuevoStock = stockActual + cantidadARestaurar;
      
      // Actualizar el lote
      const loteRef = doc(db, 'lotes', loteDoc.id);
      transaction.update(loteRef, {
        stockRestante: nuevoStock,
        estado: nuevoStock > 0 ? 'activo' : 'agotado',
        updatedAt: serverTimestamp()
      });
      
      // Registrar el movimiento para auditoría
      movimientos.push({
        loteId: loteDoc.id,
        numeroLote: lote.numeroLote,
        cantidadRestaurada: cantidadARestaurar,
        stockAnterior: stockActual,
        stockNuevo: nuevoStock,
        precioCompraUnitario: lote.precioCompraUnitario
      });
      
      cantidadPendiente -= cantidadARestaurar;
    }
    
    // Si aún queda cantidad pendiente, crear un nuevo lote temporal para la devolución
    if (cantidadPendiente > 0) {
      console.warn(`⚠️ Quedan ${cantidadPendiente} unidades sin asignar a lotes existentes. Creando lote temporal.`);
      
      // Crear nuevo lote temporal para la cantidad restante
      const nuevoLoteRef = doc(collection(db, 'lotes'));
      const numeroLoteTemp = `DEV-${Date.now().toString().slice(-6)}`;
      
      transaction.set(nuevoLoteRef, {
        numeroLote: numeroLoteTemp,
        productoId: productoId,
        stockOriginal: cantidadPendiente,
        stockRestante: cantidadPendiente,
        fechaIngreso: serverTimestamp(),
        precioCompraUnitario: 0, // Precio 0 para devoluciones sin lote original
        estado: 'activo',
        tipoLote: 'devolucion', // Marcador especial
        creadoPorDevolucion: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      movimientos.push({
        loteId: nuevoLoteRef.id,
        numeroLote: numeroLoteTemp,
        cantidadRestaurada: cantidadPendiente,
        stockAnterior: 0,
        stockNuevo: cantidadPendiente,
        esLoteNuevo: true,
        precioCompraUnitario: 0
      });
      
      cantidadPendiente = 0;
    }
    
    return movimientos;
  } catch (error) {
    console.error(`Error al devolver stock LIFO para producto ${productoId}:`, error);
    throw error;
  }
};

// Función para recalcular precio de compra después de devolución
const recalcularPrecioCompraDespuesDevolucion = async (productoId, transaction) => {
  try {
    // Buscar el primer lote disponible (más antiguo) después de la devolución
    const lotesQuery = query(
      collection(db, 'lotes'),
      where('productoId', '==', productoId),
      where('stockRestante', '>', 0),
      where('estado', '==', 'activo'),
      orderBy('fechaIngreso', 'asc'),
      limit(1)
    );
    
    const lotesSnapshot = await getDocs(lotesQuery);
    let nuevoPrecioCompra = 0;
    
    if (!lotesSnapshot.empty) {
      const primerLoteDisponible = lotesSnapshot.docs[0].data();
      nuevoPrecioCompra = parseFloat(primerLoteDisponible.precioCompraUnitario || 0);
    }
    
    // Actualizar el precio de compra del producto
    const productRef = doc(db, 'productos', productoId);
    transaction.update(productRef, {
      precioCompraDefault: nuevoPrecioCompra,
      updatedAt: serverTimestamp()
    });
    
  } catch (error) {
    console.error(`Error al recalcular precio de compra para producto ${productoId}:`, error);
  }
};






// FUNCIÓN CORREGIDA: Devolver stock SIEMPRE a lotes existentes (LIFO)
const calcularDistribucionStockLIFO = (lotesDatos, cantidadADevolver) => {
  let cantidadPendiente = cantidadADevolver;
  const distribucion = [];
  
  console.log(`🔍 Calculando distribución LIFO para ${cantidadADevolver} unidades`);
  console.log(`📦 Lotes disponibles:`, lotesDatos.map(l => ({
    numeroLote: l.numeroLote,
    stockOriginal: l.stockOriginal,
    stockRestante: l.stockRestante,
    estado: l.estado,
    espacioDisponible: (l.stockOriginal || 0) - (l.stockRestante || 0)
  })));
  
  // Ordenar lotes del más RECIENTE al más ANTIGUO (LIFO)
  const lotesOrdenados = [...lotesDatos].sort((a, b) => {
    const fechaA = a.fechaIngreso?.toDate ? a.fechaIngreso.toDate() : new Date(a.fechaIngreso);
    const fechaB = b.fechaIngreso?.toDate ? b.fechaIngreso.toDate() : new Date(b.fechaIngreso);
    return fechaB - fechaA; // Más reciente primero
  });
  
  // Procesar lotes del más reciente al más antiguo
  for (const lote of lotesOrdenados) {
    if (cantidadPendiente <= 0) break;
    
    const stockOriginal = parseInt(lote.stockOriginal || 0);
    const stockActual = parseInt(lote.stockRestante || 0);
    
    // CLAVE: Solo considerar lotes que tienen espacio para recibir devolución
    // El espacio disponible es: stockOriginal - stockActual
    const espacioDisponible = stockOriginal - stockActual;
    
    console.log(`📦 Evaluando lote ${lote.numeroLote}:`, {
      stockOriginal,
      stockActual,
      espacioDisponible,
      estado: lote.estado
    });
    
    // Si no hay espacio en este lote, continuar al siguiente
    if (espacioDisponible <= 0) {
      console.log(`⚠️ Lote ${lote.numeroLote} sin espacio disponible (lleno)`);
      continue;
    }
    
    // Calcular cuánto podemos restaurar en este lote
    const cantidadARestaurar = Math.min(cantidadPendiente, espacioDisponible);
    const nuevoStock = stockActual + cantidadARestaurar;
    
    distribucion.push({
      loteId: lote.loteId,
      numeroLote: lote.numeroLote,
      cantidadRestaurada: cantidadARestaurar,
      stockAnterior: stockActual,
      stockNuevo: nuevoStock,
      precioCompraUnitario: parseFloat(lote.precioCompraUnitario || 0),
      fechaIngreso: lote.fechaIngreso
    });
    
    cantidadPendiente -= cantidadARestaurar;
    
    console.log(`✅ Asignado a lote ${lote.numeroLote}: ${cantidadARestaurar} unidades`);
    console.log(`📊 Stock: ${stockActual} -> ${nuevoStock}, Pendiente: ${cantidadPendiente}`);
  }
  
  // 🚨 CAMBIO IMPORTANTE: Si queda cantidad pendiente, NO crear lote nuevo
  // En su lugar, mostrar advertencia y rechazar la devolución
  if (cantidadPendiente > 0) {
    const error = `❌ ERROR: No hay espacio suficiente en los lotes existentes para devolver ${cantidadPendiente} unidades restantes. 
    
La devolución no se puede procesar porque excede la capacidad de los lotes originales.

Opciones:
1. Revisar si la cantidad a devolver es correcta
2. Verificar que los lotes tengan el stock original correcto
3. Contactar al administrador del sistema

Distribución calculada hasta ahora:
${distribucion.map(d => `- Lote ${d.numeroLote}: ${d.cantidadRestaurada} unidades`).join('\n')}
`;
    
    console.error(error);
    throw new Error(`No hay espacio suficiente en lotes existentes. Faltan ${cantidadPendiente} unidades por asignar.`);
  }
  
  console.log(`✅ DISTRIBUCIÓN COMPLETA: Todo asignado a lotes existentes`);
  
  return {
    distribucion,
    necesitaLoteNuevo: false, // NUNCA crear lote nuevo
    cantidadParaLoteNuevo: 0
  };
};

// FUNCIÓN PRINCIPAL MODIFICADA - Sin creación de lotes nuevos
const handleAprobarDevolucion = async (devolucionId) => {
  if (!window.confirm('¿Está seguro de que desea APROBAR esta devolución? Esto restaurará el stock SOLO a lotes existentes según LIFO.')) {
    return;
  }

  try {
    await runTransaction(db, async (transaction) => {
      console.log('🚀 INICIANDO APROBACIÓN DE DEVOLUCIÓN:', devolucionId);
      
      // FASE 1: LECTURAS
      const devolucionRef = doc(db, 'devoluciones', devolucionId);
      const devolucionSnap = await transaction.get(devolucionRef);
      
      if (!devolucionSnap.exists()) {
        throw new Error('Devolución no encontrada');
      }
      
      const devolucionData = devolucionSnap.data();
      
      if (devolucionData.estado !== 'solicitada') {
        throw new Error('Solo se pueden aprobar devoluciones en estado "solicitada"');
      }

      // Leer items de devolución
      const itemsQuery = query(
        collection(db, 'devoluciones', devolucionId, 'itemsDevolucion'),
        orderBy('createdAt', 'asc')
      );
      const itemsSnapshot = await getDocs(itemsQuery);
      
      if (itemsSnapshot.empty) {
        throw new Error('No se encontraron items en esta devolución');
      }

      const itemsData = itemsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Leer productos
      const productSnapshots = {};
      for (const item of itemsData) {
        const productRef = doc(db, 'productos', item.productoId);
        const productSnap = await transaction.get(productRef);
        productSnapshots[item.productoId] = productSnap;
      }

      // Leer lotes de todos los productos
      const lotesData = {};
      for (const item of itemsData) {
        console.log(`📖 Cargando lotes para producto: ${item.nombreProducto}`);
        
        const lotesQuery = query(
          collection(db, 'lotes'),
          where('productoId', '==', item.productoId),
          orderBy('fechaIngreso', 'desc') // Más reciente primero para LIFO
        );
        
        const lotesSnapshot = await getDocs(lotesQuery);
        lotesData[item.productoId] = lotesSnapshot.docs.map(doc => ({
          loteId: doc.id,
          ...doc.data()
        }));
        
        console.log(`📦 Encontrados ${lotesData[item.productoId].length} lotes`);
        
        // Mostrar espacio disponible en cada lote
        lotesData[item.productoId].forEach(lote => {
          const espacioDisponible = (lote.stockOriginal || 0) - (lote.stockRestante || 0);
          console.log(`  📦 ${lote.numeroLote}: Stock=${lote.stockRestante}/${lote.stockOriginal}, Espacio=${espacioDisponible}, Precio=S/.${lote.precioCompraUnitario}`);
        });
      }

      // FASE 2: VALIDACIÓN Y CÁLCULOS
      const planDeRestauracion = [];
      
      for (const item of itemsData) {
        const cantidadADevolver = parseFloat(item.cantidadADevolver || 0);
        if (cantidadADevolver <= 0) continue;

        console.log(`\n🔄 PROCESANDO: ${item.nombreProducto}`);
        console.log(`📊 Cantidad a devolver: ${cantidadADevolver}`);

        const lotes = lotesData[item.productoId] || [];
        
        try {
          const { distribucion } = calcularDistribucionStockLIFO(lotes, cantidadADevolver);
          
          planDeRestauracion.push({
            item: item,
            distribucion: distribucion
          });
          
          console.log(`✅ Plan generado para ${item.nombreProducto}`);
          
        } catch (error) {
          // Si no hay espacio suficiente, rechazar toda la devolución
          throw new Error(`❌ ${item.nombreProducto}: ${error.message}\n\nLa devolución completa ha sido rechazada.`);
        }
      }

      // FASE 3: ESCRITURAS (solo si todo se pudo validar)
      console.log('\n✍️ FASE 3: Ejecutando escrituras...');

      const todosLosMovimientos = [];

      for (const plan of planDeRestauracion) {
        const { item, distribucion } = plan;
        
        console.log(`\n✍️ Escribiendo cambios para: ${item.nombreProducto}`);
        
        // Actualizar lotes existentes ÚNICAMENTE
        for (const dist of distribucion) {
          const loteRef = doc(db, 'lotes', dist.loteId);
          transaction.update(loteRef, {
            stockRestante: dist.stockNuevo,
            estado: dist.stockNuevo > 0 ? 'activo' : 'agotado',
            updatedAt: serverTimestamp()
          });
          
          console.log(`✍️ LOTE RESTAURADO: ${dist.numeroLote} stock ${dist.stockAnterior} -> ${dist.stockNuevo}`);
        }

        // Actualizar stock total del producto
        const productSnap = productSnapshots[item.productoId];
        if (productSnap.exists()) {
          const currentStock = productSnap.data().stockActual || 0;
          const newStock = currentStock + parseFloat(item.cantidadADevolver);
          
          const productRef = doc(db, 'productos', item.productoId);
          transaction.update(productRef, {
            stockActual: newStock,
            updatedAt: serverTimestamp()
          });
          
          console.log(`✍️ PRODUCTO ACTUALIZADO: stock ${currentStock} -> ${newStock}`);
        }

        // Preparar auditoría
        todosLosMovimientos.push({
          productoId: item.productoId,
          nombreProducto: item.nombreProducto,
          movimientos: distribucion,
          gananciaDevolucion: item.gananciaDevolucion || 0,
          gananciaUnitaria: item.gananciaUnitaria || 0,
          precioCompraUnitario: item.precioCompraUnitario || 0
        });
      }

      // Actualizar estado de la devolución
      transaction.update(devolucionRef, {
        estado: 'aprobada',
        fechaProcesamiento: serverTimestamp(),
        procesadoPor: user.email || user.uid,
        updatedAt: serverTimestamp()
      });

      // Crear registros de auditoría
      for (const productoMovimiento of todosLosMovimientos) {
        for (const movimiento of productoMovimiento.movimientos) {
          const movimientoRef = doc(collection(db, 'movimientosLotes'));
          transaction.set(movimientoRef, {
            devolucionId: devolucionId,
            numeroDevolucion: devolucionData.numeroDevolucion,
            productoId: productoMovimiento.productoId,
            nombreProducto: productoMovimiento.nombreProducto,
            loteId: movimiento.loteId,
            numeroLote: movimiento.numeroLote,
            cantidadRestaurada: movimiento.cantidadRestaurada,
            stockAnteriorLote: movimiento.stockAnterior,
            stockNuevoLote: movimiento.stockNuevo,
            precioCompraUnitario: movimiento.precioCompraUnitario,
            esLoteNuevo: false, // SIEMPRE false
            gananciaUnitaria: productoMovimiento.gananciaUnitaria,
            gananciaDevolucion: productoMovimiento.gananciaDevolucion,
            tipoMovimiento: 'devolucion-aprobada-lifo',
            fechaMovimiento: serverTimestamp(),
            empleadoId: user.email || user.uid,
            createdAt: serverTimestamp()
          });
        }
      }

      console.log('✅ TRANSACCIÓN COMPLETADA - SOLO LOTES EXISTENTES RESTAURADOS');
    });

    alert(`✅ Devolución aprobada exitosamente.\n📦 Stock restaurado ÚNICAMENTE a lotes existentes con LIFO.\n🚫 No se crearon lotes nuevos.`);
    
  } catch (err) {
    console.error('❌ Error al aprobar devolución:', err);
    setError('Error al aprobar devolución: ' + err.message);
    alert('❌ Error al aprobar devolución: ' + err.message);
  }
};





















  const handleRechazarDevolucion = async (id) => {
    const motivo = window.prompt('Ingrese el motivo del rechazo (opcional):');
    if (!window.confirm('¿Está seguro de que desea RECHAZAR esta devolución?')) {
      return;
    }

    try {
      const devolucionRef = doc(db, 'devoluciones', id);
      await updateDoc(devolucionRef, {
        estado: 'rechazada',
        motivoRechazo: motivo || null,
        fechaProcesamiento: serverTimestamp(),
        procesadoPor: user.email || user.uid,
        updatedAt: serverTimestamp(),
      });
      alert('Devolución rechazada.');
    } catch (err) {
      console.error("Error al rechazar devolución:", err);
      setError("Error al rechazar la devolución: " + err.message);
    }
  };

  const getEstadoBadge = (estado) => {
    switch (estado) {
      case 'solicitada':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <ClockIcon className="h-4 w-4 mr-1" /> Solicitada
          </span>
        );
      case 'en_revision':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <ExclamationTriangleIcon className="h-4 w-4 mr-1" /> En Revisión
          </span>
        );
      case 'aprobada':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircleIcon className="h-4 w-4 mr-1" /> Aprobada
          </span>
        );
      case 'rechazada':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircleIcon className="h-4 w-4 mr-1" /> Rechazada
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {estado}
          </span>
        );
    }
  };

  const getMotivoBadge = (motivo) => {
    const motivoLabels = {
      'no_quiere': 'No le gustó',
      'defectuoso': 'Producto defectuoso',
      'empaque_abierto': 'Empaque abierto',
      'descripcion_incorrecta': 'Descripción incorrecta',
      'otro': 'Otro motivo'
    };

    const colors = {
      'no_quiere': 'bg-purple-100 text-purple-800',
      'defectuoso': 'bg-red-100 text-red-800',
      'empaque_abierto': 'bg-orange-100 text-orange-800',
      'descripcion_incorrecta': 'bg-blue-100 text-blue-800',
      'otro': 'bg-gray-100 text-gray-800'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[motivo] || 'bg-gray-100 text-gray-800'}`}>
        {motivoLabels[motivo] || motivo}
      </span>
    );
  };

  const clearFilters = () => {
    setFilterPeriod('all');
    setStartDate(null);
    setEndDate(null);
    setSelectedEstado('all');
    setSelectedMotivo('all');
    setSearchTerm('');
    setLimitPerPage(20);
  };

  return (
    <Layout title="Devoluciones">
      <div className="flex flex-col mx-4 py-4">
        <div className="w-full p-6 bg-white rounded-lg shadow-md flex flex-col">

          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
              <span className="block sm:inline font-medium">{error}</span>
            </div>
          )}

          {/* Panel de Filtros */}
          <div className="mb-6 border border-gray-200 rounded-lg p-6 bg-gray-50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <FunnelIcon className="h-5 w-5 mr-2" />
                Filtros
              </h3>
              <button 
                onClick={clearFilters}
                className="inline-flex items-center px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 hover:text-red-800 transition-colors duration-200 border border-red-200"
              >
                <FunnelIcon className="h-4 w-4 mr-2" />
                Limpiar filtros
              </button>
            </div>

            {/* Contenedor de Botones, Fechas y Limitador */}
            <div className="flex flex-wrap items-center gap-2 md:gap-4 justify-center md:justify-start mb-6">
                        
              {/* Botones de Filtro */}
              <div className="flex space-x-2 flex-wrap">
                <button
                  onClick={() => handleFilterChange('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    filterPeriod === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                  }`}
                >
                  Todas
                </button>
                <button
                  onClick={() => handleFilterChange('day')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    filterPeriod === 'day'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                  }`}
                >
                  Hoy
                </button>
                <button
                  onClick={() => handleFilterChange('week')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    filterPeriod === 'week'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                  }`}
                >
                  Esta Semana
                </button>
                <button
                  onClick={() => handleFilterChange('month')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    filterPeriod === 'month'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                  }`}
                >
                  Este Mes
                </button>
              </div>

              {/* Selectores de Fecha */}
              <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:space-x-2 mt-2 md:mt-0">
                <DatePicker
                  selected={startDate}
                  onChange={(date) => {
                    setStartDate(date);
                    setFilterPeriod('custom');
                  }}
                  selectsStart
                  startDate={startDate}
                  endDate={endDate}
                  placeholderText="Fecha de inicio"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                <DatePicker
                  selected={endDate}
                  onChange={(date) => {
                    setEndDate(date);
                    setFilterPeriod('custom');
                  }}
                  selectsEnd
                  startDate={startDate}
                  endDate={endDate}
                  minDate={startDate}
                  placeholderText="Fecha de fin"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>

              {/* Selector de límite por página */}
              <div className="flex-none min-w-[50px]">
                <select
                  id="limit-per-page"
                  className="mt-0 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm h-[38px]"
                  value={limitPerPage}
                  onChange={(e) => {
                    setLimitPerPage(Number(e.target.value));
                  }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {/* Filtros adicionales */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Filtro por Estado */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select
                  value={selectedEstado}
                  onChange={(e) => setSelectedEstado(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="all">Todos los estados</option>
                  <option value="solicitada">Solicitada</option>
                  <option value="en_revision">En Revisión</option>
                  <option value="aprobada">Aprobada</option>
                  <option value="rechazada">Rechazada</option>
                </select>
              </div>

              {/* Filtro por Motivo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
                <select
                  value={selectedMotivo}
                  onChange={(e) => setSelectedMotivo(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="all">Todos los motivos</option>
                  <option value="no_quiere">No le gustó</option>
                  <option value="defectuoso">Producto defectuoso</option>
                  <option value="empaque_abierto">Empaque abierto</option>
                  <option value="descripcion_incorrecta">Descripción incorrecta</option>
                  <option value="otro">Otro motivo</option>
                </select>
              </div>
            </div>

            {/* Barra de búsqueda */}
            <div className="flex justify-between items-center">
              <div className="relative flex-grow mr-4">
                <input
                  type="text"
                  placeholder="Buscar por número de devolución, venta, cliente..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 text-base placeholder-gray-400"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" fill="currentColor" />
                </div>
              </div>
              <button
                onClick={() => router.push('/devoluciones/nueva')}
                className="inline-flex items-center px-6 py-2 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition duration-150 ease-in-out"
              >
                <PlusIcon className="-ml-1 mr-3 h-5 w-5" aria-hidden="true" />
                Nueva Devolución
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-48">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
            </div>
          ) : filteredDevoluciones.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-lg">
              No hay devoluciones registradas que coincidan con los filtros aplicados.
            </div>
          ) : (
            <div className="overflow-x-auto shadow-lg ring-1 ring-black ring-opacity-5 rounded-lg overflow-y-auto max-h-[60vh]">
              <table className="min-w-full border-collapse">
                <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">N° DEVOLUCIÓN</th>
                  <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">N° VENTA ORIGINAL</th>
                  <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">CLIENTE</th>
                  <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">FECHA SOLICITUD</th>
                  <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">MONTO A DEVOLVER</th>
                  <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">MOTIVO</th>
                  <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">ESTADO</th>
                  <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">PROCESADO POR</th>
                  <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">ACCIONES</th>
                </tr>
                </thead>
                <tbody className="bg-white">
                {filteredDevoluciones.map((devolucion, index) => (
                    <tr key={devolucion.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-900 text-left">
                        {devolucion.numeroDevolucion || 'N/A'}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">
                        {devolucion.numeroVentaOriginal}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">
                        {devolucion.clienteNombre}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">
                        {devolucion.fechaSolicitudFormatted}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black font-medium text-left">
                        S/. {parseFloat(devolucion.montoADevolver || 0).toFixed(2)}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-center">
                        {getMotivoBadge(devolucion.motivo)}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-center">
                        {getEstadoBadge(devolucion.estado)}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">
                        {devolucion.procesadoPor || devolucion.solicitadoPor || 'N/A'}
                      </td>
                      <td className="border border-gray-300 relative whitespace-nowrap px-3 py-2 text-sm font-medium text-center">
                        <div className="flex items-center space-x-2 justify-center">
                          <button
                            onClick={() => handleViewDetails(devolucion.id)}
                            className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50 transition duration-150 ease-in-out"
                            title="Ver Detalles"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </button>
                          {devolucion.estado === 'solicitada' && (
                            <>
                              <button
                                onClick={() => handleAprobarDevolucion(devolucion.id)}
                                className="text-green-600 hover:text-green-800 p-2 rounded-full hover:bg-green-50 transition duration-150 ease-in-out"
                                title="Aprobar Devolución"
                              >
                                <CheckCircleIcon className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => handleRechazarDevolucion(devolucion.id)}
                                className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50 transition duration-150 ease-in-out"
                                title="Rechazar Devolución"
                              >
                                <XCircleIcon className="h-5 w-5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default DevolucionesIndexPage;