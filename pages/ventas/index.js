import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { db } from '../../lib/firebase';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { generarPDFVentaCompleta } from '../../components/utils/pdfGeneratorVentas';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  getDoc,
  addDoc
} from 'firebase/firestore';
import {
  ShoppingCartIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  XCircleIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  CreditCardIcon,
  TagIcon,
  CalendarIcon,
  PrinterIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';

const VentasIndexPage = () => {
  const { user } = useAuth();
  const router = useRouter();

  const [ventas, setVentas] = useState([]);
  const [filteredVentas, setFilteredVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados para filtros
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [limitPerPage, setLimitPerPage] = useState(20);
  const [selectedMetodoPago, setSelectedMetodoPago] = useState('all');
  const [selectedTipoVenta, setSelectedTipoVenta] = useState('all');
  const [selectedEstado, setSelectedEstado] = useState('all');

  useEffect(() => {
    if (!user) {
      router.push('/auth');
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(collection(db, 'ventas'), orderBy('fechaVenta', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const ventasList = [];
      const ventasToUpdate = [];

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const ventaData = {
          id: doc.id,
          ...data,
          fechaVenta: data.fechaVenta?.toDate ? data.fechaVenta.toDate() : new Date(),
          fechaVentaFormatted: data.fechaVenta?.toDate ? data.fechaVenta.toDate().toLocaleDateString('es-ES') : 'N/A',
        };

        // Si no tiene número de venta o es N/A, marcarlo para actualización
        if (!data.numeroVenta || data.numeroVenta === 'N/A' || data.numeroVenta.trim() === '') {
          ventasToUpdate.push({
            id: doc.id,
            data: ventaData
          });
        }

        ventasList.push(ventaData);
      });

      // Actualizar ventas sin número automáticamente (sin bloquear la UI)
      if (ventasToUpdate.length > 0) {
        // Ejecutar actualizaciones en segundo plano
        ventasToUpdate.forEach(async (venta, index) => {
          const newNumeroVenta = generateSaleNumber() + `-${index}`; // Evitar duplicados
          try {
            await updateDoc(doc(db, 'ventas', venta.id), {
              numeroVenta: newNumeroVenta,
              updatedAt: serverTimestamp()
            });
            
            console.log(`Número de venta generado para ${venta.id}: ${newNumeroVenta}`);
          } catch (error) {
            console.error(`Error updating sale number for ${venta.id}:`, error);
          }
        });
      }

      setVentas(ventasList);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching ventas:", err);
      setError("Error al cargar las ventas: " + err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, router]);

  const getDisplaySaleNumber = (venta) => {
    if (venta.numeroVenta && venta.numeroVenta !== 'N/A' && venta.numeroVenta.trim() !== '') {
      return venta.numeroVenta;
    }
    
    // Generar número temporal basado en el tipo y ID
    const prefix = venta.tipoVenta === 'cotizacionAprobada' ? 'VC' : 
                  venta.tipoVenta === 'credito' ? 'VCR' : 'V';
    const shortId = venta.id.slice(-6).toUpperCase();
    
    return `${prefix}-${shortId}`;
  };

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

  // Función para verificar si una venta incluye un método de pago específico
  const ventaIncludesPaymentMethod = (venta, methodToCheck) => {
    if (!venta) return false;

    // Si es "all", siempre retorna true
    if (methodToCheck === 'all') return true;

    // Si tiene paymentData (ventas nuevas con soporte para pagos mixtos)
    if (venta.paymentData && venta.paymentData.paymentMethods) {
      // Verificar si alguno de los métodos de pago coincide
      const hasMethod = venta.paymentData.paymentMethods.some(pm => 
        pm.method && pm.method.toLowerCase() === methodToCheck.toLowerCase() && pm.amount > 0
      );
      
      if (hasMethod) return true;
    }

    // Fallback para ventas antiguas sin paymentData - usar metodoPago directo
    if (venta.metodoPago) {
      return venta.metodoPago.toLowerCase() === methodToCheck.toLowerCase();
    }

    return false;
  };

  // Función para obtener la etiqueta de display del método de pago (incluyendo mixtos)
  const getDisplayMethodLabel = (venta) => {
    if (!venta) return 'N/A';

    // Si tiene paymentData y es mixto
    if (venta.paymentData && venta.paymentData.isMixedPayment && venta.paymentData.paymentMethods) {
      const activeMethods = venta.paymentData.paymentMethods
        .filter(pm => pm.amount > 0)
        .map(pm => getMetodoPagoLabel(pm.method))
        .join(' + ');
      
      return activeMethods || 'MIXTO';
    }

    // Si tiene paymentData pero no es mixto
    if (venta.paymentData && venta.paymentData.paymentMethods && venta.paymentData.paymentMethods.length > 0) {
      return getMetodoPagoLabel(venta.paymentData.paymentMethods[0].method);
    }

    // Fallback para ventas antiguas
    return getMetodoPagoLabel(venta.metodoPago);
  };

  // Función para obtener el ícono de display del método de pago (incluyendo mixtos)
  const getDisplayMethodIcon = (venta) => {
    if (!venta) return '💰';

    // Si tiene paymentData y es mixto
    if (venta.paymentData && venta.paymentData.isMixedPayment && venta.paymentData.paymentMethods) {
      // Para mixtos, mostrar un ícono especial o el del primer método
      const firstMethod = venta.paymentData.paymentMethods.find(pm => pm.amount > 0);
      if (firstMethod) {
        return '🔀'; // Ícono especial para pagos mixtos o usar: getMetodoPagoIcon(firstMethod.method);
      }
    }

    // Si tiene paymentData pero no es mixto
    if (venta.paymentData && venta.paymentData.paymentMethods && venta.paymentData.paymentMethods.length > 0) {
      return getMetodoPagoIcon(venta.paymentData.paymentMethods[0].method);
    }

    // Fallback para ventas antiguas
    return getMetodoPagoIcon(venta.metodoPago);
  };

  // Función para filtrar ventas
  useEffect(() => {
    let filtered = [...ventas];

    // Filtro por término de búsqueda
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(venta => {
        const numeroVentaMatch = venta.numeroVenta && typeof venta.numeroVenta === 'string'
          ? venta.numeroVenta.toLowerCase().includes(lowerCaseSearchTerm)
          : false;

        const clienteMatch = venta.clienteNombre && typeof venta.clienteNombre === 'string'
          ? venta.clienteNombre.toLowerCase().includes(lowerCaseSearchTerm)
          : false;

        const observacionesMatch = venta.observaciones && typeof venta.observaciones === 'string'
          ? venta.observaciones.toLowerCase().includes(lowerCaseSearchTerm)
          : false;

        const estadoMatch = venta.estado && typeof venta.estado === 'string'
          ? venta.estado.toLowerCase().includes(lowerCaseSearchTerm)
          : false;

        const tipoVentaMatch = venta.tipoVenta && typeof venta.tipoVenta === 'string'
          ? venta.tipoVenta.toLowerCase().includes(lowerCaseSearchTerm)
          : false;

        return numeroVentaMatch || clienteMatch || observacionesMatch || estadoMatch || tipoVentaMatch;
      });
    }

    // Filtro por fecha
    if (startDate && endDate) {
      filtered = filtered.filter(venta => {
        const fechaVenta = venta.fechaVenta;
        if (!fechaVenta) return false;
        
        const ventaDate = new Date(fechaVenta);
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // Ajustar horas para comparación correcta
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        ventaDate.setHours(12, 0, 0, 0); // Mediodía para evitar problemas de zona horaria
        
        return ventaDate >= start && ventaDate <= end;
      });
    }

    // FILTRO ACTUALIZADO: Filtro por método de pago (incluyendo mixtos)
    if (selectedMetodoPago !== 'all') {
      filtered = filtered.filter(venta => ventaIncludesPaymentMethod(venta, selectedMetodoPago));
    }

    // Filtro por tipo de venta
    if (selectedTipoVenta !== 'all') {
      filtered = filtered.filter(venta => venta.tipoVenta === selectedTipoVenta);
    }

    // Filtro por estado
    if (selectedEstado !== 'all') {
      filtered = filtered.filter(venta => venta.estado === selectedEstado);
    }

    // Limitar cantidad por página
    const limitedFiltered = filtered.slice(0, limitPerPage);
    
    setFilteredVentas(limitedFiltered);
  }, [searchTerm, ventas, startDate, endDate, selectedMetodoPago, selectedTipoVenta, selectedEstado, limitPerPage]);

  const handleViewDetails = (id) => {
    router.push(`/ventas/${id}`);
  };

  const handleAnularVenta = async (id) => {
    if (!window.confirm('¿Estás seguro de que deseas ANULAR esta venta? Esta acción es irreversible.')) {
      return;
    }

    try {
      const ventaRef = doc(db, 'ventas', id);
      await updateDoc(ventaRef, {
        estado: 'anulada',
        updatedAt: serverTimestamp(),
      });
      alert('Venta anulada con éxito.');
    } catch (err) {
      console.error("Error al anular venta:", err);
      setError("Error al anular la venta: " + err.message);
    }
  };

  const getMetodoPagoLabel = (metodo) => {
    const metodos = {
      efectivo: 'EFECTIVO',
      tarjeta_credito: 'T. CRÉDITO',
      tarjeta_debito: 'T. DÉBITO',
      tarjeta: 'TARJETA',
      yape: 'YAPE',
      plin: 'PLIN',
      transferencia: 'TRANSFERENCIA',
      deposito: 'DEPÓSITO',
      cheque: 'CHEQUE',
      mixto: 'MIXTO',
      otro: 'OTRO'
    };
    return metodos[metodo?.toLowerCase()] || metodo?.toUpperCase() || 'N/A';
  };

  const getMetodoPagoIcon = (metodo) => {
    switch (metodo?.toLowerCase()) {
      case 'yape':
        return '💜';
      case 'plin':
        return '💙';
      case 'efectivo':
        return '💵';
      case 'tarjeta':
      case 'tarjeta_credito':
      case 'tarjeta_debito':
        return '💳';
      case 'transferencia':
        return '🏦';
      case 'deposito':
        return '🏛️';
      case 'cheque':
        return '📄';
      default:
        return '💰';
    }
  };

  const clearFilters = () => {
    setFilterPeriod('all');
    setStartDate(null);
    setEndDate(null);
    setSelectedMetodoPago('all');
    setSelectedTipoVenta('all');
    setSelectedEstado('all');
    setSearchTerm('');
    setLimitPerPage(20);
  };


  const generateSaleNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const timestamp = Date.now();
    
    return `V-${day}${month}${year}-${timestamp.toString().slice(-4)}`;
  };

  // 2. Añade esta función después de las funciones existentes, antes del return del componente
  const handleImprimirVenta = async (venta) => {
    try {
      // Mostrar indicador de carga
      const loadingToast = document.createElement('div');
      loadingToast.innerHTML = `
        <div class="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          <div class="flex items-center">
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Generando PDF...
          </div>
        </div>
      `;
      document.body.appendChild(loadingToast);

      // Obtener información del cliente si existe
      let clienteData = null;
      if (venta.clienteId && venta.clienteId !== 'general') {
        try {
          const clienteDoc = await getDoc(doc(db, 'clientes', venta.clienteId));
          if (clienteDoc.exists()) {
            clienteData = clienteDoc.data();
          }
        } catch (error) {
          console.warn('No se pudo obtener información del cliente:', error);
        }
      }

      // Generar PDF
      await generarPDFVentaCompleta(venta.id, venta, clienteData);
      
      // Mostrar mensaje de éxito
      document.body.removeChild(loadingToast);
      
      const successToast = document.createElement('div');
      successToast.innerHTML = `
        <div class="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          <div class="flex items-center">
            <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
            PDF generado exitosamente
          </div>
        </div>
      `;
      document.body.appendChild(successToast);
      
      setTimeout(() => {
        if (document.body.contains(successToast)) {
          document.body.removeChild(successToast);
        }
      }, 3000);

    } catch (error) {
      // Remover indicador de carga si existe
      const loadingElements = document.querySelectorAll('div[class*="fixed top-4 right-4 bg-blue-500"]');
      loadingElements.forEach(el => {
        if (document.body.contains(el.parentElement)) {
          document.body.removeChild(el.parentElement);
        }
      });

      console.error('Error al generar PDF:', error);
      
      // Mostrar mensaje de error
      const errorToast = document.createElement('div');
      errorToast.innerHTML = `
        <div class="fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          <div class="flex items-center">
            <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
            Error al generar PDF
          </div>
        </div>
      `;
      document.body.appendChild(errorToast);
      
      setTimeout(() => {
        if (document.body.contains(errorToast)) {
          document.body.removeChild(errorToast);
        }
      }, 3000);
    }
  };
  
  // 4. OPCIONAL: Si quieres un botón de impresión masiva, añade esto antes de tu tabla:
  const [selectedVentas, setSelectedVentas] = useState(new Set());

  const handleSelectVenta = (ventaId) => {
    const newSelected = new Set(selectedVentas);
    if (newSelected.has(ventaId)) {
      newSelected.delete(ventaId);
    } else {
      newSelected.add(ventaId);
    }
    setSelectedVentas(newSelected);
  };

  const handleImprimirSeleccionadas = async () => {
    if (selectedVentas.size === 0) {
      alert('Selecciona al menos una venta para imprimir');
      return;
    }

    for (const ventaId of selectedVentas) {
      const venta = filteredVentas.find(v => v.id === ventaId);
      if (venta && venta.estado !== 'anulada') {
        await handleImprimirVenta(venta);
        // Pequeña pausa entre impresiones
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    setSelectedVentas(new Set()); // Limpiar selección
  };

  return (
    <Layout title="Mis Ventas">
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* Filtro por Método de Pago - ACTUALIZADO */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Método de Pago
                </label>
                <select
                  value={selectedMetodoPago}
                  onChange={(e) => setSelectedMetodoPago(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="all">Todos los métodos</option>
                  <option value="efectivo">EFECTIVO</option>
                  <option value="tarjeta">TARJETA</option>
                  <option value="yape">YAPE</option>
                  <option value="plin">PLIN</option>
                  <option value="otro">OTRO</option>
                </select>
              </div>

              {/* Filtro por Tipo de Venta */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Venta</label>
                <select
                  value={selectedTipoVenta}
                  onChange={(e) => setSelectedTipoVenta(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="all">Todos los tipos</option>
                  <option value="directa">Directa</option>
                  <option value="cotizacionAprobada">Cotización Aprobada</option>
                  <option value="abono">Abono</option>
                </select>
              </div>

              {/* Filtro por Estado */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select
                  value={selectedEstado}
                  onChange={(e) => setSelectedEstado(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="all">Todos los estados</option>
                  <option value="completada">Completada</option>
                  <option value="anulada">Anulada</option>
                  <option value="pendiente">Pendiente</option>
                </select>
              </div>
            </div>

            {/* Barra de búsqueda */}
            <div className="flex justify-between items-center">
              <div className="relative flex-grow mr-4">
                <input
                  type="text"
                  placeholder="Buscar por número, cliente, observaciones..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 text-base placeholder-gray-400"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" fill="currentColor" />
                </div>
              </div>
              <button
                onClick={() => router.push('/ventas/nueva')}
                className="inline-flex items-center px-6 py-2 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-150 ease-in-out"
              >
                <PlusIcon className="-ml-1 mr-3 h-5 w-5" aria-hidden="true" />
                Nueva Venta Directa
              </button>
              {/* Boton de seleccionar para impresion de pdfs */}
              {selectedVentas.size > 0 && (
                <button
                  onClick={handleImprimirSeleccionadas}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out ml-2"
                >
                  <PrinterIcon className="-ml-1 mr-2 h-4 w-4" aria-hidden="true" />
                  Imprimir Seleccionadas ({selectedVentas.size})
                </button>
              )}
            </div>
          </div>


          

          {loading ? (
            <div className="flex justify-center items-center h-48">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
          ) : filteredVentas.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-lg">
              No hay ventas registradas que coincidan con los filtros aplicados.
            </div>
          ) : (
            <div className="overflow-x-auto shadow-lg ring-1 ring-black ring-opacity-5 rounded-lg overflow-y-auto max-h-[60vh]">
              <table className="min-w-full border-collapse">
                <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {/* AÑADIR AQUÍ - Nueva primera columna para checkbox maestro */}
                  <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">
                    <input
                      type="checkbox"
                      checked={selectedVentas.size === filteredVentas.filter(v => v.estado !== 'anulada').length && filteredVentas.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedVentas(new Set(filteredVentas.filter(v => v.estado !== 'anulada').map(v => v.id)));
                        } else {
                          setSelectedVentas(new Set());
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  {/* El resto de tus columnas existentes */}
                  <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">N° VENTA</th>
                  <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">CLIENTE</th>
                  <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">FECHA VENTA</th>
                  <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">TOTAL</th>
                  <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">TIPO VENTA</th>
                  <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">ESTADO</th>
                  <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">MÉTODO PAGO</th>
                  <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">REGISTRADO POR</th>
                  <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">ACCIONES</th>
                </tr>
                </thead>
                <tbody className="bg-white">
                {filteredVentas.map((venta, index) => (
                    <tr key={venta.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      {/* AÑADIR AQUÍ - Nueva primera celda para checkbox individual */}
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-center">
                        {venta.estado !== 'anulada' ? (
                          <input
                            type="checkbox"
                            checked={selectedVentas.has(venta.id)}
                            onChange={() => handleSelectVenta(venta.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-900 text-left">
                        {venta.numeroVenta || 'N/A'}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">{venta.clienteNombre}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">{venta.fechaVentaFormatted}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black font-medium text-left">
                        S/. {parseFloat(venta.totalVenta || 0).toFixed(2)}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-center">
                        {venta.tipoVenta === 'cotizacionAprobada' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            <TagIcon className="h-4 w-4 mr-1" /> Aprobada (Cot.)
                          </span>
                        ) : venta.tipoVenta === 'abono' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CreditCardIcon className="h-4 w-4 mr-1" /> Abono
                          </span>
                        ) : venta.tipoVenta === 'directa' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <ShoppingCartIcon className="h-4 w-4 mr-1" /> Directa
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-black">
                            <CurrencyDollarIcon className="h-4 w-4 mr-1" /> {venta.tipoVenta}
                          </span>
                        )}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-center">
                        {venta.estado === 'completada' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircleIcon className="h-4 w-4 mr-1" /> Completada
                          </span>
                        ) : venta.estado === 'anulada' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <XCircleIcon className="h-4 w-4 mr-1" /> Anulada
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            <span className="mr-1">{getDisplayMethodIcon(venta)}</span>
                            {venta.estado}
                          </span>
                        )}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <span className="mr-1">{getDisplayMethodIcon(venta)}</span>
                          {getDisplayMethodLabel(venta)}
                        </span>
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">{venta.empleadoId || 'Desconocido'}</td>
                      <td className="border border-gray-300 relative whitespace-nowrap px-3 py-2 text-sm font-medium text-center">
                        <div className="flex items-center space-x-2 justify-center">
                          <button
                            onClick={() => handleViewDetails(venta.id)}
                            className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50 transition duration-150 ease-in-out"
                            title="Ver Detalles de la Venta"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </button>
                          {/* NUEVO BOTÓN - Añade este botón */}
                          <button
                            onClick={() => handleImprimirVenta(venta)}
                            className="text-green-600 hover:text-green-800 p-2 rounded-full hover:bg-green-50 transition duration-150 ease-in-out"
                            title="Imprimir Comprobante PDF"
                            disabled={venta.estado === 'anulada'}
                          >
                            <PrinterIcon className="h-5 w-5" />
                          </button>
                          {venta.estado === 'completada' && (
                            <button
                              onClick={() => handleAnularVenta(venta.id)}
                              className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50 transition duration-150 ease-in-out ml-1"
                              title="Anular Venta"
                            >
                              <XCircleIcon className="h-5 w-5" />
                            </button>
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

export default VentasIndexPage;