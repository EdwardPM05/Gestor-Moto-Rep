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
  addDoc,
  serverTimestamp,
  where,
  Timestamp,
  getDocs,
  getDoc,
  setDoc
} from 'firebase/firestore';
import {
  BanknotesIcon,
  CreditCardIcon,
  DevicePhoneMobileIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  MinusCircleIcon,
  PlusCircleIcon,
  EyeIcon,
  ChartBarIcon,
  BuildingStorefrontIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  LockClosedIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';

const CajaPage = () => {
  const { user } = useAuth();
  const router = useRouter();

  const [ventas, setVentas] = useState([]);
  const [retiros, setRetiros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Estados para retiro de dinero
  const [showRetiroModal, setShowRetiroModal] = useState(false);
  const [retiroAmount, setRetiroAmount] = useState('');
  const [retiroTipo, setRetiroTipo] = useState('efectivo');
  const [retiroMotivo, setRetiroMotivo] = useState('');
  const [processingRetiro, setProcessingRetiro] = useState(false);

  // Estados para detalles de ganancia
  const [showDetalleGanancia, setShowDetalleGanancia] = useState(false);
  const [detalleGananciaData, setDetalleGananciaData] = useState(null);

  // Estados para cierre de caja
  const [cajaCerrada, setCajaCerrada] = useState(false);
  const [loadingCierreCaja, setLoadingCierreCaja] = useState(false);
  const [showCierreModal, setShowCierreModal] = useState(false);

  // Estados para totales
  const [totalesDelDia, setTotalesDelDia] = useState({
    efectivo: 0,
    yape: 0,
    plin: 0,
    tarjeta: 0,
    total: 0,
    gananciaBruta: 0,
    gananciaReal: 0
  });

  const [dineroEnCaja, setDineroEnCaja] = useState({
    efectivoFisico: 0,
    digital: {
      yape: 0,
      plin: 0,
      tarjeta: 0
    },
    totalRetiros: 0
  });

  // Verificar permisos de usuario
  const isAdmin = user?.role === 'admin' || user?.email === 'admin@gmail.com';

  // Función para verificar si la caja está cerrada
  const verificarCierreCaja = async (fecha) => {
    try {
      const fechaString = fecha.toISOString().split('T')[0]; // YYYY-MM-DD
      const cierreDoc = await getDoc(doc(db, 'cierresCaja', fechaString));
      setCajaCerrada(cierreDoc.exists());
    } catch (error) {
      console.error('Error al verificar cierre de caja:', error);
      setCajaCerrada(false);
    }
  };

  // Función para cerrar la caja
  const cerrarCaja = async () => {
    if (!isAdmin) {
      alert('Solo el administrador puede cerrar la caja');
      return;
    }

    if (!window.confirm('¿Está seguro de que desea cerrar la caja del día? Esta acción no se puede deshacer.')) {
      return;
    }

    setLoadingCierreCaja(true);

    try {
      const fechaString = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD
      
      const cierreData = {
        fecha: Timestamp.fromDate(selectedDate),
        fechaString: fechaString,
        totales: totalesDelDia,
        retiros: retiros.map(retiro => ({
          id: retiro.id,
          monto: retiro.monto,
          tipo: retiro.tipo,
          motivo: retiro.motivo,
          fecha: retiro.fecha,
          realizadoPor: retiro.realizadoPor
        })),
        ventas: ventas.map(venta => ({
          id: venta.id,
          numeroVenta: venta.numeroVenta,
          clienteNombre: venta.clienteNombre,
          totalVenta: venta.totalVenta,
          metodoPago: venta.metodoPago,
          fechaVenta: venta.fechaVenta
        })),
        resumenFinal: {
          totalVentas: ventas.length,
          totalRetiros: retiros.length,
          efectivoFinal: Math.max(0, totalesDelDia.efectivo - dineroEnCaja.totalRetiros),
          digitalTotal: totalesDelDia.yape + totalesDelDia.plin + totalesDelDia.tarjeta
        },
        cerradoPor: user.email,
        fechaCierre: serverTimestamp()
      };

      await setDoc(doc(db, 'cierresCaja', fechaString), cierreData);
      
      setCajaCerrada(true);
      setShowCierreModal(false);
      alert('Caja cerrada exitosamente');

    } catch (error) {
      console.error('Error al cerrar la caja:', error);
      alert('Error al cerrar la caja: ' + error.message);
    } finally {
      setLoadingCierreCaja(false);
    }
  };

  // Función para generar reporte PDF
  const generarReportePDF = async () => {
    try {
      const { generarPDFCajaCompleta } = await import('../../components/utils/pdfGeneratorCaja');
      const fechaString = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD
      await generarPDFCajaCompleta(fechaString);
    } catch (error) {
      console.error('Error al generar PDF:', error);
      alert('Error al generar el reporte: ' + error.message);
    }
  };

  // Función para cargar items de ventas con campos ocultos
  const cargarItemsVentas = async (ventasList) => {
    const ventasConItems = [];
    
    for (const venta of ventasList) {
      try {
        // Cargar items de cada venta para obtener información de ganancia
        const itemsQuery = query(
          collection(db, 'ventas', venta.id, 'itemsVenta'),
          orderBy('createdAt', 'asc')
        );
        
        const itemsSnapshot = await getDocs(itemsQuery);
        const items = itemsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        ventasConItems.push({
          ...venta,
          items: items
        });
      } catch (error) {
        console.error(`Error al cargar items de venta ${venta.id}:`, error);
        // Si falla, incluir venta sin items
        ventasConItems.push({
          ...venta,
          items: []
        });
      }
    }
    
    return ventasConItems;
  };

  // Función actualizada para calcular totales con ganancia real desde campos ocultos
  // MODIFICACIÓN: Excluir ventas tipo "abono" del cálculo de ganancia real
  const calcularTotalesConGananciaReal = async (ventasList) => {
    let efectivo = 0, yape = 0, plin = 0, tarjeta = 0, total = 0;
    let gananciaBruta = 0, gananciaReal = 0;

    // Cargar items de ventas con información de ganancia
    const ventasConItems = await cargarItemsVentas(ventasList);

    ventasConItems.forEach(venta => {
      const totalVenta = parseFloat(venta.totalVenta || 0);
      total += totalVenta;
      gananciaBruta += totalVenta;

      // MODIFICACIÓN: Solo calcular ganancia real si NO es un abono
      if (venta.tipoVenta !== 'abono') {
        // USAR GANANCIA CALCULADA DESDE LOS CAMPOS OCULTOS
        if (venta.gananciaTotalVenta && typeof venta.gananciaTotalVenta === 'number') {
          // Si la venta tiene el campo de ganancia total calculado (NUEVO SISTEMA)
          gananciaReal += venta.gananciaTotalVenta;
        } else if (venta.items && venta.items.length > 0) {
          // Si no tiene el campo a nivel de venta, calcular desde items (SISTEMA ACTUAL)
          const gananciaVenta = venta.items.reduce((gananciaItem, item) => {
            if (item.gananciaTotal && typeof item.gananciaTotal === 'number') {
              // Usar ganancia calculada desde campos ocultos
              return gananciaItem + item.gananciaTotal;
            } else {
              // Fallback: calcular ganancia estimada (para datos antiguos)
              const precioVenta = parseFloat(item.precioVentaUnitario || 0);
              const cantidad = parseInt(item.cantidad || 0);
              const subtotal = precioVenta * cantidad;
              
              // Estimar ganancia como 40% del precio de venta (ajustar según tu margen típico)
              const gananciaEstimada = subtotal * 0.4;
              return gananciaItem + gananciaEstimada;
            }
          }, 0);
          
          gananciaReal += gananciaVenta;
        } else {
          // Fallback para ventas sin items cargados (solo si NO es abono)
          const gananciaEstimada = totalVenta * 0.4; // 40% estimado
          gananciaReal += gananciaEstimada;
        }
      }
      // NOTA: Si es abono, se suma al total y ganancia bruta, pero NO a ganancia real

      // Clasificar por método de pago (sin cambios)
      if (venta.paymentData && venta.paymentData.paymentMethods) {
        // Pagos mixtos
        venta.paymentData.paymentMethods.forEach(pm => {
          const amount = parseFloat(pm.amount || 0);
          switch (pm.method?.toLowerCase()) {
            case 'efectivo':
              efectivo += amount;
              break;
            case 'yape':
              yape += amount;
              break;
            case 'plin':
              plin += amount;
              break;
            case 'tarjeta':
            case 'tarjeta_credito':
            case 'tarjeta_debito':
              tarjeta += amount;
              break;
            default:
              break;
          }
        });
      } else {
        // Método de pago único
        switch (venta.metodoPago?.toLowerCase()) {
          case 'efectivo':
            efectivo += totalVenta;
            break;
          case 'yape':
            yape += totalVenta;
            break;
          case 'plin':
            plin += totalVenta;
            break;
          case 'tarjeta':
          case 'tarjeta_credito':
          case 'tarjeta_debito':
            tarjeta += totalVenta;
            break;
          default:
            break;
        }
      }
    });

    setTotalesDelDia({
      efectivo,
      yape,
      plin,
      tarjeta,
      total,
      gananciaBruta,
      gananciaReal
    });
  };

  // Función para obtener detalles de ganancia por venta
  const obtenerDetalleGanancia = async (ventaId) => {
    try {
      const ventaDoc = await getDoc(doc(db, 'ventas', ventaId));
      
      if (!ventaDoc.exists()) {
        return null;
      }
      
      const ventaData = ventaDoc.data();
      
      // Si la venta tiene ganancia total calculada
      if (ventaData.gananciaTotalVenta) {
        return {
          gananciaTotal: ventaData.gananciaTotalVenta,
          metodoCalculo: 'campo_oculto_venta'
        };
      }
      
      // Si no, calcular desde items
      const itemsQuery = query(collection(db, 'ventas', ventaId, 'itemsVenta'));
      const itemsSnapshot = await getDocs(itemsQuery);
      
      let gananciaCalculada = 0;
      let tieneGananciaOculta = false;
      
      itemsSnapshot.docs.forEach(itemDoc => {
        const itemData = itemDoc.data();
        if (itemData.gananciaTotal && typeof itemData.gananciaTotal === 'number') {
          gananciaCalculada += itemData.gananciaTotal;
          tieneGananciaOculta = true;
        }
      });
      
      return {
        gananciaTotal: gananciaCalculada,
        metodoCalculo: tieneGananciaOculta ? 'campos_ocultos_items' : 'estimado'
      };
    } catch (error) {
      console.error('Error al obtener detalle de ganancia:', error);
      return null;
    }
  };

  // Función para mostrar modal con detalles de ganancia de una venta específica
  const mostrarDetalleGanancia = async (venta) => {
    const detalle = await obtenerDetalleGanancia(venta.id);
    setDetalleGananciaData({
      venta: venta,
      detalle: detalle
    });
    setShowDetalleGanancia(true);
  };

  // Componente para mostrar indicador de precisión de ganancia
  const IndicadorPrecisionGanancia = ({ metodoCalculo }) => {
    switch (metodoCalculo) {
      case 'campo_oculto_venta':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            ✓ Ganancia Real
          </span>
        );
      case 'campos_ocultos_items':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            ✓ Calculada
          </span>
        );
      case 'estimado':
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            ~ Estimada
          </span>
        );
    }
  };

  // useEffect modificado para cargar ventas con cálculo de ganancia real
  useEffect(() => {
    if (!user) {
      router.push('/auth');
      return;
    }

    setLoading(true);
    setError(null);

    // Verificar si la caja está cerrada para esta fecha
    verificarCierreCaja(selectedDate);

    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const ventasQuery = query(
      collection(db, 'ventas'),
      where('fechaVenta', '>=', Timestamp.fromDate(startOfDay)),
      where('fechaVenta', '<=', Timestamp.fromDate(endOfDay)),
      where('estado', '==', 'completada'),
      orderBy('fechaVenta', 'desc')
    );

    const unsubscribeVentas = onSnapshot(ventasQuery, async (snapshot) => {
      const ventasList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        fechaVenta: doc.data().fechaVenta?.toDate ? doc.data().fechaVenta.toDate() : new Date(),
      }));
      
      setVentas(ventasList);
      
      // CALCULAR TOTALES CON GANANCIA REAL DESDE CAMPOS OCULTOS
      await calcularTotalesConGananciaReal(ventasList);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching ventas:", err);
      setError("Error al cargar las ventas: " + err.message);
      setLoading(false);
    });

    // Escuchar retiros del día (sin cambios)
    const retirosQuery = query(
      collection(db, 'retiros'),
      where('fecha', '>=', Timestamp.fromDate(startOfDay)),
      where('fecha', '<=', Timestamp.fromDate(endOfDay)),
      orderBy('fecha', 'desc')
    );

    const unsubscribeRetiros = onSnapshot(retirosQuery, (snapshot) => {
      const retirosList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        fecha: doc.data().fecha?.toDate ? doc.data().fecha.toDate() : new Date(),
      }));
      
      setRetiros(retirosList);
      calcularRetiros(retirosList);
    }, (err) => {
      console.error("Error fetching retiros:", err);
    });

    return () => {
      unsubscribeVentas();
      unsubscribeRetiros();
    };
  }, [user, router, selectedDate]);

  const calcularRetiros = (retirosList) => {
    const totalRetiros = retirosList.reduce((total, retiro) => {
      return total + parseFloat(retiro.monto || 0);
    }, 0);

    setDineroEnCaja(prev => ({
      ...prev,
      totalRetiros,
      efectivoFisico: Math.max(0, totalesDelDia.efectivo - totalRetiros)
    }));
  };

  const handleRetiroDinero = async () => {
    if (!isAdmin) {
      alert('Solo el administrador puede realizar retiros de dinero');
      return;
    }

    if (cajaCerrada) {
      alert('No se pueden realizar retiros. La caja del día ya está cerrada.');
      return;
    }

    if (!retiroAmount || !retiroMotivo.trim()) {
      alert('Por favor complete todos los campos');
      return;
    }

    const monto = parseFloat(retiroAmount);
    if (isNaN(monto) || monto <= 0) {
      alert('El monto debe ser un número positivo');
      return;
    }

    // Verificar si hay suficiente dinero disponible
    const disponible = retiroTipo === 'efectivo' 
      ? totalesDelDia.efectivo - dineroEnCaja.totalRetiros
      : retiroTipo === 'yape' ? totalesDelDia.yape
      : retiroTipo === 'plin' ? totalesDelDia.plin
      : totalesDelDia.tarjeta;

    if (monto > disponible) {
      alert(`No hay suficiente dinero disponible en ${retiroTipo.toUpperCase()}. Disponible: S/. ${disponible.toFixed(2)}`);
      return;
    }

    if (!window.confirm(`¿Confirma el retiro de S/. ${monto.toFixed(2)} en ${retiroTipo.toUpperCase()}?`)) {
      return;
    }

    setProcessingRetiro(true);

    try {
      await addDoc(collection(db, 'retiros'), {
        monto: monto,
        tipo: retiroTipo,
        motivo: retiroMotivo.trim(),
        fecha: serverTimestamp(),
        realizadoPor: user.email,
        fechaSeleccionada: Timestamp.fromDate(selectedDate)
      });

      // Limpiar formulario
      setRetiroAmount('');
      setRetiroMotivo('');
      setShowRetiroModal(false);
      alert('Retiro registrado exitosamente');

    } catch (error) {
      console.error('Error al registrar retiro:', error);
      alert('Error al registrar el retiro: ' + error.message);
    } finally {
      setProcessingRetiro(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount || 0);
  };

  const getPaymentMethodIcon = (method) => {
    switch (method?.toLowerCase()) {
      case 'efectivo':
        return <BanknotesIcon className="h-8 w-8" />;
      case 'yape':
        return <DevicePhoneMobileIcon className="h-8 w-8 text-purple-600" />;
      case 'plin':
        return <DevicePhoneMobileIcon className="h-8 w-8 text-blue-600" />;
      case 'tarjeta':
      case 'tarjeta_credito':
      case 'tarjeta_debito':
        return <CreditCardIcon className="h-8 w-8" />;
      default:
        return <CurrencyDollarIcon className="h-8 w-8" />;
    }
  };

  if (loading) {
    return (
      <Layout title="Caja">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      </Layout>
    );
  }


  return (
    <Layout title="Caja">
      <div className="flex flex-col mx-4 py-4 space-y-6">
        
        {/* Header con selector de fecha */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex flex-col sm:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 sm:mb-0">
              <BuildingStorefrontIcon className="h-8 w-8 text-green-600" />
              <h1 className="text-2xl font-bold text-gray-900">Caja del Día</h1>
              {cajaCerrada && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                  <LockClosedIcon className="h-4 w-4 mr-1" />
                  Cerrada
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <CalendarIcon className="h-5 w-5 text-gray-500" />
                <DatePicker
                  selected={selectedDate}
                  onChange={(date) => setSelectedDate(date)}
                  dateFormat="dd/MM/yyyy"
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  maxDate={new Date()}
                  disabled={false}
                />
              </div>
              
              {isAdmin && !cajaCerrada && (
                <>
                  <button
                    onClick={() => setShowRetiroModal(true)}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors"
                  >
                    <MinusCircleIcon className="h-5 w-5" />
                    <span>Retirar Dinero</span>
                  </button>
                  
                  <button
                    onClick={() => setShowCierreModal(true)}
                    className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors"
                  >
                    <LockClosedIcon className="h-5 w-5" />
                    <span>Cerrar Caja</span>
                  </button>
                </>
              )}
              
              {cajaCerrada && (
                <button
                  onClick={generarReportePDF}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors"
                >
                  <DocumentTextIcon className="h-5 w-5" />
                  <span>Generar Reporte</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Resumen de Caja - Cards principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Efectivo Físico */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">Efectivo Físico</p>
                <p className="text-2xl font-bold">{formatCurrency(Math.max(0, totalesDelDia.efectivo - dineroEnCaja.totalRetiros))}</p>
                <p className="text-green-200 text-xs mt-1">💵 Dinero en caja</p>
              </div>
              <BanknotesIcon className="h-12 w-12 text-green-200" />
            </div>
          </div>

          {/* Digital - Yape */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">Yape Digital</p>
                <p className="text-2xl font-bold">{formatCurrency(totalesDelDia.yape)}</p>
                <p className="text-purple-200 text-xs mt-1">💜 Dinero digital</p>
              </div>
              <DevicePhoneMobileIcon className="h-12 w-12 text-purple-200" />
            </div>
          </div>

          {/* Digital - Plin */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Plin Digital</p>
                <p className="text-2xl font-bold">{formatCurrency(totalesDelDia.plin)}</p>
                <p className="text-blue-200 text-xs mt-1">💙 Dinero digital</p>
              </div>
              <DevicePhoneMobileIcon className="h-12 w-12 text-blue-200" />
            </div>
          </div>

          {/* Tarjetas */}
          <div className="bg-gradient-to-br from-gray-600 to-gray-700 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-100 text-sm font-medium">Tarjetas</p>
                <p className="text-2xl font-bold">{formatCurrency(totalesDelDia.tarjeta)}</p>
                <p className="text-gray-300 text-xs mt-1">💳 Dinero digital</p>
              </div>
              <CreditCardIcon className="h-12 w-12 text-gray-300" />
            </div>
          </div>
        </div>

        {/* Ganancias y Totales */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Total del Día */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-indigo-500">
            <div className="flex items-center">
              <ChartBarIcon className="h-8 w-8 text-indigo-600 mr-3" />
              <div>
                <p className="text-gray-600 text-sm font-medium">Total del Día</p>
                <p className="text-3xl font-bold text-indigo-600">{formatCurrency(totalesDelDia.total)}</p>
              </div>
            </div>
          </div>

          {/* Ganancia Bruta */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <div className="flex items-center">
              <ArrowTrendingUpIcon className="h-8 w-8 text-green-600 mr-3" />
              <div>
                <p className="text-gray-600 text-sm font-medium">Ganancia Bruta</p>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(totalesDelDia.gananciaBruta)}</p>
              </div>
            </div>
          </div>

          {/* Ganancia Real */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-emerald-500">
            <div className="flex items-center">
              <CurrencyDollarIcon className="h-8 w-8 text-emerald-600 mr-3" />
              <div>
                <p className="text-gray-600 text-sm font-medium">Ganancia Real</p>
                <p className="text-3xl font-bold text-emerald-600">{formatCurrency(totalesDelDia.gananciaReal)}</p>
                <p className="text-xs text-gray-500 mt-1">Con campos ocultos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Retiros del día */}
        {retiros.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <ArrowTrendingDownIcon className="h-6 w-6 text-red-600 mr-2" />
              Retiros del Día
            </h3>
            
            <div className="space-y-3">
              {retiros.map((retiro) => (
                <div key={retiro.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center space-x-3">
                    <MinusCircleIcon className="h-5 w-5 text-red-600" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {formatCurrency(retiro.monto)} - {retiro.tipo.toUpperCase()}
                      </p>
                      <p className="text-sm text-gray-600">{retiro.motivo}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      {retiro.fecha?.toLocaleTimeString('es-PE', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                    <p className="text-xs text-gray-400">{retiro.realizadoPor}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-right font-semibold text-red-600">
                Total Retirado: {formatCurrency(dineroEnCaja.totalRetiros)}
              </p>
            </div>
          </div>
        )}

        {/* Lista de ventas del día */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <EyeIcon className="h-6 w-6 text-blue-600 mr-2" />
            Ventas del Día ({ventas.length})
          </h3>
          
          {ventas.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ChartBarIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No hay ventas registradas para esta fecha</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-gray-700">
                      N° Venta
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-gray-700">
                      Cliente
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-gray-700">
                      Hora
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-gray-700">
                      Método Pago
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-right text-sm font-medium text-gray-700">
                      Total
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-center text-sm font-medium text-gray-700">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ventas.map((venta, index) => (
                    <tr key={venta.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 px-4 py-2 text-sm font-medium">
                        {venta.numeroVenta || 'N/A'}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-sm">
                        {venta.clienteNombre}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-sm">
                        {venta.fechaVenta?.toLocaleTimeString('es-PE', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-sm">
                        <div className="flex items-center space-x-2">
                          {getPaymentMethodIcon(venta.metodoPago)}
                          <span>{venta.metodoPago?.toUpperCase() || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-sm text-right font-medium">
                        {formatCurrency(venta.totalVenta)}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        <button
                          onClick={() => mostrarDetalleGanancia(venta)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs flex items-center space-x-1 mx-auto"
                        >
                          <InformationCircleIcon className="h-4 w-4" />
                          <span>Detalle</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal de Cierre de Caja */}
        {showCierreModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <LockClosedIcon className="h-6 w-6 text-orange-600 mr-2" />
                    Cerrar Caja del Día
                  </h3>
                  <button
                    onClick={() => setShowCierreModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex">
                      <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-2" />
                      <div className="text-sm">
                        <p className="font-medium text-yellow-800">¿Está seguro de cerrar la caja?</p>
                        <p className="text-yellow-700 mt-1">
                          Esta acción no se puede deshacer. Una vez cerrada, no podrá realizar más retiros ni modificaciones para esta fecha.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Resumen del Día</h4>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><strong>Total Ventas:</strong> {ventas.length}</p>
                      <p><strong>Total Ingresos:</strong> {formatCurrency(totalesDelDia.total)}</p>
                      <p><strong>Total Retiros:</strong> {formatCurrency(dineroEnCaja.totalRetiros)}</p>
                      <p><strong>Efectivo Final:</strong> {formatCurrency(Math.max(0, totalesDelDia.efectivo - dineroEnCaja.totalRetiros))}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowCierreModal(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                    disabled={loadingCierreCaja}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={cerrarCaja}
                    disabled={loadingCierreCaja}
                    className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 flex items-center space-x-2"
                  >
                    {loadingCierreCaja ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Cerrando...</span>
                      </>
                    ) : (
                      <>
                        <LockClosedIcon className="h-4 w-4" />
                        <span>Cerrar Caja</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Retiro */}
        {showRetiroModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <MinusCircleIcon className="h-6 w-6 text-red-600 mr-2" />
                    Retirar Dinero
                  </h3>
                  <button
                    onClick={() => setShowRetiroModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de Dinero
                    </label>
                    <select
                      value={retiroTipo}
                      onChange={(e) => setRetiroTipo(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500"
                    >
                      <option value="efectivo">Efectivo (S/. {(totalesDelDia.efectivo - dineroEnCaja.totalRetiros).toFixed(2)} disponible)</option>
                      <option value="yape">Yape (S/. {totalesDelDia.yape.toFixed(2)} disponible)</option>
                      <option value="plin">Plin (S/. {totalesDelDia.plin.toFixed(2)} disponible)</option>
                      <option value="tarjeta">Tarjeta (S/. {totalesDelDia.tarjeta.toFixed(2)} disponible)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Monto a Retirar
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={retiroAmount}
                      onChange={(e) => setRetiroAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500"
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Motivo del Retiro *
                    </label>
                    <textarea
                      value={retiroMotivo}
                      onChange={(e) => setRetiroMotivo(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500"
                      rows="3"
                      placeholder="Describe el motivo del retiro..."
                      required
                    />
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowRetiroModal(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                    disabled={processingRetiro}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleRetiroDinero}
                    disabled={processingRetiro}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center space-x-2"
                  >
                    {processingRetiro ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Procesando...</span>
                      </>
                    ) : (
                      <>
                        <MinusCircleIcon className="h-4 w-4" />
                        <span>Retirar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Detalle de Ganancia */}
        {showDetalleGanancia && detalleGananciaData && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <InformationCircleIcon className="h-6 w-6 text-blue-600 mr-2" />
                    Detalle de Ganancia
                  </h3>
                  <button
                    onClick={() => setShowDetalleGanancia(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Información de la Venta</h4>
                    <p className="text-sm text-gray-600">
                      <strong>N° Venta:</strong> {detalleGananciaData.venta.numeroVenta || 'N/A'}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Cliente:</strong> {detalleGananciaData.venta.clienteNombre}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Total Venta:</strong> {formatCurrency(detalleGananciaData.venta.totalVenta)}
                    </p>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Ganancia Calculada</h4>
                    <p className="text-xl font-bold text-blue-600 mb-2">
                      {formatCurrency(detalleGananciaData.detalle?.gananciaTotal || 0)}
                    </p>
                    <div className="mb-2">
                      <IndicadorPrecisionGanancia 
                        metodoCalculo={detalleGananciaData.detalle?.metodoCalculo || 'estimado'} 
                      />
                    </div>
                    
                    <div className="text-xs text-gray-600 space-y-1">
                      {detalleGananciaData.detalle?.metodoCalculo === 'campo_oculto_venta' && (
                        <p>✓ Ganancia calculada desde campo oculto a nivel de venta</p>
                      )}
                      {detalleGananciaData.detalle?.metodoCalculo === 'campos_ocultos_items' && (
                        <p>✓ Ganancia calculada desde campos ocultos de items individuales</p>
                      )}
                      {detalleGananciaData.detalle?.metodoCalculo === 'estimado' && (
                        <p>⚠️ Ganancia estimada (40% del total de venta)</p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end mt-6">
                  <button
                    onClick={() => setShowDetalleGanancia(false)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CajaPage;