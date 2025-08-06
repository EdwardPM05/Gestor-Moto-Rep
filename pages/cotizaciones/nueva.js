// pages/cotizaciones/nueva.js

import { useState, useEffect, Fragment } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { db } from '../../lib/firebase';
import {
  collection,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
  addDoc,
  serverTimestamp,
  runTransaction,
  where,
  updateDoc,
  onSnapshot,
} from 'firebase/firestore';
import {
  PlusIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ShoppingCartIcon,
  UserIcon,
  TruckIcon,
  CreditCardIcon,
  DocumentTextIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/router';
import { Dialog, Transition } from '@headlessui/react';
import Select from 'react-select';

const NuevaCotizacionPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estados para productos
  const [productos, setProductos] = useState([]);
  const [filteredProductos, setFilteredProductos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [productLimit, setProductLimit] = useState(20);
  const [displayedProducts, setDisplayedProducts] = useState([]);

  // Estados para datos de referencia
  const [clientes, setClientes] = useState([]);
  const [empleados, setEmpleados] = useState([]);

  // Estados para cotizaciones
  const [cotizacionesPendientes, setCotizacionesPendientes] = useState([]);
  const [cotizacionActiva, setCotizacionActiva] = useState(null);
  const [itemsCotizacionActiva, setItemsCotizacionActiva] = useState([]);

  // Estados para el formulario de cotización
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [selectedEmpleado, setSelectedEmpleado] = useState(null);
  const [placaMoto, setPlacaMoto] = useState('');
  const [metodoPago, setMetodoPago] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // Estados para modal de cantidad
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [precioVenta, setPrecioVenta] = useState(0);

  // Cargar datos iniciales
  useEffect(() => {
    if (!user) {
      router.push('/auth');
      return;
    }
    fetchInitialData();
  }, [user, router]);

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Cargar productos
      const qProductos = query(collection(db, 'productos'), orderBy('nombre', 'asc'));
      const productosSnapshot = await getDocs(qProductos);
      const productosList = productosSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProductos(productosList);
      setFilteredProductos(productosList);

      // Cargar clientes
      const qClientes = query(collection(db, 'cliente'), orderBy('nombre', 'asc'));
      const clientesSnapshot = await getDocs(qClientes);
      const clientesList = clientesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setClientes(clientesList);

      // Cargar empleados
      const qEmpleados = query(collection(db, 'empleado'), orderBy('nombre', 'asc'));
      const empleadosSnapshot = await getDocs(qEmpleados);
      const empleadosList = empleadosSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEmpleados(empleadosList);

    } catch (err) {
      console.error("Error al cargar datos iniciales:", err);
      setError("Error al cargar datos iniciales");
    } finally {
      setLoading(false);
    }
  };

  // Escuchar cotizaciones pendientes
  useEffect(() => {
    if (!user) return;

    const qPendientes = query(
      collection(db, 'cotizaciones'),
      where('estado', '==', 'borrador'),
      orderBy('fechaCreacion', 'desc')
    );

    const unsubscribe = onSnapshot(qPendientes, (snapshot) => {
      const cotizacionesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCotizacionesPendientes(cotizacionesList);
    });

    return () => unsubscribe();
  }, [user]);

  // Escuchar cambios en cotización activa
  useEffect(() => {
    if (!cotizacionActiva?.id) {
      setItemsCotizacionActiva([]);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'cotizaciones', cotizacionActiva.id), async (docSnap) => {
      if (docSnap.exists()) {
        const cotizacionData = { id: docSnap.id, ...docSnap.data() };
        setCotizacionActiva(cotizacionData);

        // Cargar items
        const qItems = query(
          collection(db, 'cotizaciones', cotizacionActiva.id, 'itemsCotizacion'), 
          orderBy('createdAt', 'asc')
        );
        const itemsSnapshot = await getDocs(qItems);
        const itemsList = itemsSnapshot.docs.map(itemDoc => ({
          id: itemDoc.id,
          ...itemDoc.data()
        }));
        setItemsCotizacionActiva(itemsList);
      }
    });

    return () => unsubscribe();
  }, [cotizacionActiva?.id]);

  // Sincronizar formulario con cotización activa
  useEffect(() => {
    if (cotizacionActiva) {
      // Sincronizar cliente
      const cliente = clientes.find(c => c.id === cotizacionActiva.clienteId);
      setSelectedCliente(cliente ? {
        value: cliente.id,
        label: `${cliente.nombre} ${cliente.apellido || ''} - ${cliente.dni || ''}`.trim()
      } : null);

      // Sincronizar empleado
      const empleado = empleados.find(e => e.id === cotizacionActiva.empleadoAsignadoId);
      setSelectedEmpleado(empleado ? {
        value: empleado.id,
        label: `${empleado.nombre} ${empleado.apellido || ''} - ${empleado.puesto || ''}`.trim()
      } : null);

      setPlacaMoto(cotizacionActiva.placaMoto || '');
      setMetodoPago(cotizacionActiva.metodoPago || '');
      setObservaciones(cotizacionActiva.observaciones || '');
    }
  }, [cotizacionActiva, clientes, empleados]);

  // Filtrar productos
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredProductos(productos);
    } else {
      const filtered = productos.filter(producto =>
        producto.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (producto.marca && producto.marca.toLowerCase().includes(searchTerm.toLowerCase())) ||
        producto.codigoTienda.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (producto.codigoProveedor && producto.codigoProveedor.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredProductos(filtered);
    }
  }, [searchTerm, productos]);

  // Aplicar límite de productos mostrados
  useEffect(() => {
    const limited = filteredProductos.slice(0, productLimit);
    setDisplayedProducts(limited);
  }, [filteredProductos, productLimit]);

  // Crear nueva cotización
  const handleNuevaCotizacion = async () => {
    setLoading(true);
    try {
      // Crear fecha de expiración (7 días desde hoy)
      const fechaExpiracion = new Date();
      fechaExpiracion.setDate(fechaExpiracion.getDate() + 7);

      const newCotizacionRef = await addDoc(collection(db, 'cotizaciones'), {
        numeroCotizacion: `COT-${Date.now().toString().slice(-8)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        clienteId: null,
        clienteNombre: 'Cliente Pendiente',
        clienteDNI: null,
        totalCotizacion: 0,
        fechaCreacion: serverTimestamp(),
        fechaExpiracion: fechaExpiracion,
        empleadoId: user.email || user.uid,
        estado: 'borrador',
        metodoPago: null,
        placaMoto: null,
        observaciones: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setCotizacionActiva({ id: newCotizacionRef.id });
      alert('Nueva cotización creada exitosamente');
    } catch (err) {
      console.error("Error al crear cotización:", err);
      setError("Error al crear nueva cotización");
    } finally {
      setLoading(false);
    }
  };

  // Seleccionar cotización pendiente
  const handleSelectCotizacion = (cotizacion) => {
    setCotizacionActiva(cotizacion);
  };

  // Actualizar cliente
  const handleUpdateCliente = async (selectedOption) => {
    if (!cotizacionActiva?.id) return;

    try {
      await runTransaction(db, async (transaction) => {
        const cotizacionRef = doc(db, 'cotizaciones', cotizacionActiva.id);
        let clientData = { nombre: 'Cliente Pendiente', apellido: '', dni: null };

        if (selectedOption) {
          const clientRef = doc(db, 'cliente', selectedOption.value);
          const clientSnap = await transaction.get(clientRef);
          if (clientSnap.exists()) {
            clientData = clientSnap.data();
          }
        }

        const clientNombre = `${clientData.nombre} ${clientData.apellido || ''}`.trim();

        transaction.update(cotizacionRef, {
          clienteId: selectedOption?.value || null,
          clienteNombre: clientNombre,
          clienteDNI: clientData.dni || null,
          updatedAt: serverTimestamp(),
        });
      });

      setSelectedCliente(selectedOption);
    } catch (err) {
      console.error("Error al actualizar cliente:", err);
      setError("Error al actualizar cliente");
    }
  };

  // Actualizar empleado
  const handleUpdateEmpleado = async (selectedOption) => {
    if (!cotizacionActiva?.id) return;

    try {
      await runTransaction(db, async (transaction) => {
        const cotizacionRef = doc(db, 'cotizaciones', cotizacionActiva.id);
        let employeeData = { nombre: '', apellido: '', puesto: '' };

        if (selectedOption) {
          const employeeRef = doc(db, 'empleado', selectedOption.value);
          const employeeSnap = await transaction.get(employeeRef);
          if (employeeSnap.exists()) {
            employeeData = employeeSnap.data();
          }
        }

        const employeeNombre = `${employeeData.nombre} ${employeeData.apellido || ''}`.trim();

        transaction.update(cotizacionRef, {
          empleadoAsignadoId: selectedOption?.value || null,
          empleadoAsignadoNombre: employeeNombre || null,
          empleadoAsignadoPuesto: employeeData.puesto || null,
          updatedAt: serverTimestamp(),
        });
      });

      setSelectedEmpleado(selectedOption);
    } catch (err) {
      console.error("Error al actualizar empleado:", err);
      setError("Error al actualizar empleado");
    }
  };

  // Actualizar placa de moto
  const handleUpdatePlaca = async (nuevaPlaca) => {
    if (!cotizacionActiva?.id) return;

    try {
      const cotizacionRef = doc(db, 'cotizaciones', cotizacionActiva.id);
      await updateDoc(cotizacionRef, {
        placaMoto: nuevaPlaca || null,
        updatedAt: serverTimestamp(),
      });
      setPlacaMoto(nuevaPlaca);
    } catch (err) {
      console.error("Error al actualizar placa:", err);
      setError("Error al actualizar placa");
    }
  };

  // Actualizar método de pago
  const handleUpdateMetodoPago = async (nuevoMetodo) => {
    if (!cotizacionActiva?.id) return;

    try {
      const cotizacionRef = doc(db, 'cotizaciones', cotizacionActiva.id);
      await updateDoc(cotizacionRef, {
        metodoPago: nuevoMetodo,
        updatedAt: serverTimestamp(),
      });
      setMetodoPago(nuevoMetodo);
    } catch (err) {
      console.error("Error al actualizar método de pago:", err);
      setError("Error al actualizar método de pago");
    }
  };

  // Actualizar observaciones
  const handleUpdateObservaciones = async (nuevasObservaciones) => {
    if (!cotizacionActiva?.id) return;

    try {
      const cotizacionRef = doc(db, 'cotizaciones', cotizacionActiva.id);
      await updateDoc(cotizacionRef, {
        observaciones: nuevasObservaciones,
        updatedAt: serverTimestamp(),
      });
      setObservaciones(nuevasObservaciones);
    } catch (err) {
      console.error("Error al actualizar observaciones:", err);
      setError("Error al actualizar observaciones");
    }
  };

  // Abrir modal de cantidad
  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setPrecioVenta(parseFloat(product.precioVentaDefault || 0));
    setQuantity(1);
    setShowQuantityModal(true);
  };

  // Agregar producto a cotización
  const handleAddProductToCotizacion = async () => {
    if (!cotizacionActiva?.id || !selectedProduct) return;

    try {
      const cotizacionItemsRef = collection(db, 'cotizaciones', cotizacionActiva.id, 'itemsCotizacion');
      const existingItemQuery = query(cotizacionItemsRef, where('productoId', '==', selectedProduct.id));
      const existingItemSnapshot = await getDocs(existingItemQuery);

      await runTransaction(db, async (transaction) => {
        const productRef = doc(db, 'productos', selectedProduct.id);
        const cotizacionRef = doc(db, 'cotizaciones', cotizacionActiva.id);

        const productSnap = await transaction.get(productRef);
        const cotizacionSnap = await transaction.get(cotizacionRef);

        if (!productSnap.exists() || !cotizacionSnap.exists()) {
          throw new Error("Producto o cotización no encontrada");
        }

        let itemRef;
        let newQuantity;
        let oldSubtotal = 0;

        if (!existingItemSnapshot.empty) {
          const existingItemDoc = existingItemSnapshot.docs[0];
          itemRef = existingItemDoc.ref;
          const existingItemData = existingItemDoc.data();
          oldSubtotal = parseFloat(existingItemData.subtotal || 0);
          newQuantity = existingItemData.cantidad + quantity;
          const newSubtotal = newQuantity * precioVenta;

          transaction.update(itemRef, {
            cantidad: newQuantity,
            subtotal: newSubtotal,
            precioVentaUnitario: precioVenta,
            updatedAt: serverTimestamp(),
          });
        } else {
          itemRef = doc(cotizacionItemsRef);
          newQuantity = quantity;
          const newSubtotal = newQuantity * precioVenta;

          transaction.set(itemRef, {
            productoId: selectedProduct.id,
            nombreProducto: selectedProduct.nombre,
            marca: selectedProduct.marca || '',
            cantidad: newQuantity,
            precioVentaUnitario: precioVenta,
            subtotal: newSubtotal,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        const currentTotal = parseFloat(cotizacionSnap.data().totalCotizacion || 0);
        const finalItemSubtotal = newQuantity * precioVenta;
        const updatedTotal = currentTotal - oldSubtotal + finalItemSubtotal;

        transaction.update(cotizacionRef, {
          totalCotizacion: parseFloat(updatedTotal.toFixed(2)),
          updatedAt: serverTimestamp(),
        });
      });

      setShowQuantityModal(false);
      alert('Producto agregado exitosamente');
    } catch (err) {
      console.error("Error al agregar producto:", err);
      setError("Error al agregar producto a la cotización");
    }
  };

  // Eliminar item de cotización
  const handleRemoveItem = async (itemId, subtotal) => {
    if (!cotizacionActiva?.id || !itemId) return;

    if (!window.confirm('¿Eliminar este producto de la cotización?')) return;

    try {
      await runTransaction(db, async (transaction) => {
        const itemRef = doc(db, 'cotizaciones', cotizacionActiva.id, 'itemsCotizacion', itemId);
        const cotizacionRef = doc(db, 'cotizaciones', cotizacionActiva.id);

        const cotizacionSnap = await transaction.get(cotizacionRef);
        if (!cotizacionSnap.exists()) {
          throw new Error("Cotización no encontrada");
        }

        const currentTotal = parseFloat(cotizacionSnap.data().totalCotizacion || 0);
        const updatedTotal = currentTotal - parseFloat(subtotal);

        transaction.delete(itemRef);
        transaction.update(cotizacionRef, {
          totalCotizacion: parseFloat(updatedTotal.toFixed(2)),
          updatedAt: serverTimestamp(),
        });
      });

      alert('Producto eliminado de la cotización');
    } catch (err) {
      console.error("Error al eliminar item:", err);
      setError("Error al eliminar producto");
    }
  };

  // Guardar cotización como pendiente - MODIFICADO
  const handleGuardarCotizacion = async () => {
    if (!cotizacionActiva?.id) return;

    if (!selectedCliente) {
      alert('Por favor selecciona un cliente');
      return;
    }

    if (itemsCotizacionActiva.length === 0) {
      alert('La cotización debe tener al menos un producto');
      return;
    }

    if (!window.confirm('¿Guardar esta cotización como PENDIENTE? Podrás confirmarla desde el índice de cotizaciones.')) {
      return;
    }

    try {
      const cotizacionRef = doc(db, 'cotizaciones', cotizacionActiva.id);
      await updateDoc(cotizacionRef, {
        estado: 'pendiente', // Cambio aquí: de 'confirmada' a 'pendiente'
        metodoPago: metodoPago || 'efectivo',
        placaMoto: placaMoto || null,
        observaciones: observaciones || '',
        fechaGuardado: serverTimestamp(), // Nueva fecha para cuando se guarda como pendiente
        updatedAt: serverTimestamp(),
      });

      alert('Cotización guardada como PENDIENTE exitosamente. Ve al índice de cotizaciones para confirmarla.');
      
      // Limpiar formulario
      setCotizacionActiva(null);
      setItemsCotizacionActiva([]);
      setSelectedCliente(null);
      setSelectedEmpleado(null);
      setPlacaMoto('');
      setMetodoPago('');
      setObservaciones('');
      
      // Opcional: redirigir al índice de cotizaciones
      router.push('/cotizaciones');
      
    } catch (err) {
      console.error("Error al guardar cotización:", err);
      alert('Error al guardar cotización: ' + err.message);
    }
  };

  const clienteOptions = clientes.map(cliente => ({
    value: cliente.id,
    label: `${cliente.nombre} ${cliente.apellido || ''} - ${cliente.dni || ''}`.trim()
  }));

  const empleadoOptions = empleados.map(empleado => ({
    value: empleado.id,
    label: `${empleado.nombre} ${empleado.apellido || ''} - ${empleado.puesto || ''}`.trim()
  }));

  if (!user) return null;

  return (
    <Layout title="Nueva Cotización">
      <div className="flex h-screen bg-gray-100 fixed inset-0 overflow-hidden" style={{ top: '64px', height: 'calc(100vh - 64px)' }}>
        {error && (
          <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50">
            {error}
          </div>
        )}

        {/* Panel Izquierdo - Cotizaciones Pendientes */}
        <div className="w-80 bg-white shadow-lg flex flex-col flex-shrink-0">
          <div className="p-4 bg-blue-600 text-white flex-shrink-0">
            <h2 className="text-lg font-semibold mb-3">Cotizaciones Borrador</h2>
            <button
              onClick={handleNuevaCotizacion}
              className="w-full bg-blue-500 hover:bg-blue-400 text-white px-4 py-2 rounded-lg flex items-center justify-center"
              disabled={loading}
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Nueva Cotización
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {cotizacionesPendientes.length === 0 ? (
              <p className="text-gray-500 text-center">No hay cotizaciones en borrador</p>
            ) : (
              <div className="space-y-3">
                {cotizacionesPendientes.map(cotizacion => (
                  <div
                    key={cotizacion.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      cotizacionActiva?.id === cotizacion.id
                        ? 'bg-blue-50 border-blue-500'
                        : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                    }`}
                    onClick={() => handleSelectCotizacion(cotizacion)}
                  >
                    <div className="font-medium text-sm">{cotizacion.numeroCotizacion}</div>
                    <div className="text-xs text-gray-600">{cotizacion.clienteNombre}</div>
                    <div className="text-xs font-semibold">S/. {parseFloat(cotizacion.totalCotizacion || 0).toFixed(2)}</div>
                    <div className="text-xs text-gray-500">
                      {cotizacion.fechaCreacion?.toDate?.() ? 
                        cotizacion.fechaCreacion.toDate().toLocaleDateString() : 
                        'Fecha N/A'
                      }
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Información de Cotización Activa */}
          {cotizacionActiva && (
            <div className="border-t p-4 bg-gray-50 flex-shrink-0 max-h-96 overflow-y-auto custom-scrollbar">
              <h3 className="font-semibold text-sm mb-3">Cotización Activa</h3>
              
              {/* Cliente */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">Cliente:</label>
                <Select
                  options={clienteOptions}
                  value={selectedCliente}
                  onChange={handleUpdateCliente}
                  placeholder="Seleccionar cliente..."
                  className="text-xs"
                  isClearable
                />
              </div>

              {/* Empleado */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">Empleado:</label>
                <Select
                  options={empleadoOptions}
                  value={selectedEmpleado}
                  onChange={handleUpdateEmpleado}
                  placeholder="Seleccionar empleado..."
                  className="text-xs"
                  isClearable
                />
              </div>

              {/* Placa Moto */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">Placa Moto:</label>
                <input
                  type="text"
                  value={placaMoto}
                  onChange={(e) => handleUpdatePlaca(e.target.value)}
                  placeholder="Ej: ABC-123"
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                />
              </div>

              {/* Método de Pago */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">Método de Pago:</label>
                <select
                  value={metodoPago}
                  onChange={(e) => handleUpdateMetodoPago(e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                >
                  <option value="">Seleccionar...</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="yape">Yape</option>
                  <option value="plin">Plin</option>
                </select>
              </div>

              {/* Observaciones */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">Observaciones:</label>
                <textarea
                  value={observaciones}
                  onChange={(e) => handleUpdateObservaciones(e.target.value)}
                  placeholder="Observaciones adicionales..."
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  rows="2"
                />
              </div>

              {/* Total */}
              <div className="mb-3 p-2 bg-blue-50 rounded">
                <div className="text-xs font-semibold">
                  Total: S/. {parseFloat(cotizacionActiva.totalCotizacion || 0).toFixed(2)}
                </div>
              </div>

              {/* BOTÓN MODIFICADO: Ahora guarda como pendiente */}
              <button
                onClick={handleGuardarCotizacion}
                disabled={!selectedCliente || itemsCotizacionActiva.length === 0}
                className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center justify-center text-sm"
              >
                <DocumentTextIcon className="h-4 w-4 mr-2" />
                Guardar como Pendiente
              </button>
              
              {/* Botón para ir al índice de cotizaciones */}
              <button
                onClick={() => router.push('/cotizaciones')}
                className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center text-sm"
              >
                <CheckIcon className="h-4 w-4 mr-2" />
                Ver Todas las Cotizaciones
              </button>
            </div>
          )}
        </div>

        {/* Panel Derecho - Productos y Items */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Buscador de Productos */}
          <div className="bg-white shadow-sm p-4 flex-shrink-0">
            <div className="flex items-center space-x-4 mb-3">
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar productos por nombre, marca, código..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="text-sm text-gray-600 whitespace-nowrap">
                Mostrando {displayedProducts.length} de {filteredProductos.length}
              </div>
            </div>
            
            {/* Control de límite de productos */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Mostrar:</span>
                <select
                  value={productLimit}
                  onChange={(e) => setProductLimit(parseInt(e.target.value))}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value={10}>10 productos</option>
                  <option value={20}>20 productos</option>
                  <option value={50}>50 productos</option>
                  <option value={100}>100 productos</option>
                </select>
              </div>
              
              {filteredProductos.length > productLimit && (
                <div className="text-xs text-orange-600">
                  Hay {filteredProductos.length - productLimit} productos más. Usa el buscador o aumenta el límite.
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 flex min-h-0">
            {/* Lista de Productos */}
            <div className="flex-1 bg-white flex flex-col min-w-0">
              <div className="p-4 flex-shrink-0">
                <h3 className="text-lg font-semibold mb-4">Seleccionar Productos</h3>
              </div>
              
              <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {displayedProducts.map(producto => (
                      <div
                        key={producto.id}
                        className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer flex-shrink-0"
                        onClick={() => handleSelectProduct(producto)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 truncate">{producto.nombre}</h4>
                            <p className="text-sm text-gray-600 truncate">{producto.marca || 'Sin marca'}</p>
                            <p className="text-xs text-gray-500">Código: {producto.codigoTienda}</p>
                            <p className="text-xs text-gray-500">Stock: {producto.stockActual || 0}</p>
                          </div>
                          <div className="text-right flex-shrink-0 ml-4">
                            <p className="font-semibold text-green-600">
                              S/. {parseFloat(producto.precioVentaDefault || 0).toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500">
                              Costo: S/. {parseFloat(producto.precioCompraDefault || 0).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {displayedProducts.length === 0 && !loading && (
                      <div className="text-center py-8 text-gray-500">
                        No se encontraron productos
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Lista de Items de la Cotización Activa */}
            {cotizacionActiva && (
              <div className="w-96 bg-gray-50 border-l flex flex-col flex-shrink-0">
                <div className="p-4 flex-shrink-0">
                  <h3 className="text-lg font-semibold mb-4">Items de la Cotización</h3>
                </div>
                
                <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
                  {itemsCotizacionActiva.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No hay productos en esta cotización</p>
                  ) : (
                    <div className="space-y-3">
                      {itemsCotizacionActiva.map(item => (
                        <div key={item.id} className="bg-white p-3 rounded-lg border flex-shrink-0">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1 min-w-0">
                              <h5 className="font-medium text-gray-900 truncate">{item.nombreProducto}</h5>
                              <p className="text-sm text-gray-600 truncate">{item.marca}</p>
                            </div>
                            <button
                              onClick={() => handleRemoveItem(item.id, item.subtotal)}
                              className="text-red-500 hover:text-red-700 p-1 flex-shrink-0"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-gray-500">Cantidad:</span>
                              <span className="ml-1 font-medium">{item.cantidad}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Precio:</span>
                              <span className="ml-1 font-medium">S/. {parseFloat(item.precioVentaUnitario || 0).toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t">
                            <div className="text-right">
                              <span className="text-gray-500">Subtotal:</span>
                              <span className="ml-2 font-bold text-green-600">
                                S/. {parseFloat(item.subtotal || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal de Cantidad y Precio */}
        <Transition.Root show={showQuantityModal} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={setShowQuantityModal}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
            </Transition.Child>

            <div className="fixed inset-0 z-50 overflow-y-auto">
              <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                  enterTo="opacity-100 translate-y-0 sm:scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                  leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                >
                  <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                    <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                      <button
                        type="button"
                        className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        onClick={() => setShowQuantityModal(false)}
                      >
                        <span className="sr-only">Cerrar</span>
                        <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="sm:flex sm:items-start">
                      <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                        <ShoppingCartIcon className="h-6 w-6 text-blue-600" aria-hidden="true" />
                      </div>
                      <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                        <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
                          Agregar Producto a Cotización
                        </Dialog.Title>
                        
                        {selectedProduct && (
                          <div className="mt-4">
                            <div className="bg-gray-50 p-3 rounded-lg mb-4">
                              <h4 className="font-medium text-gray-900">{selectedProduct.nombre}</h4>
                              <p className="text-sm text-gray-600">{selectedProduct.marca || 'Sin marca'}</p>
                              <p className="text-sm text-gray-500">Stock disponible: {selectedProduct.stockActual || 0}</p>
                            </div>

                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Cantidad
                                </label>
                                <input
                                  type="number"
                                  value={quantity}
                                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                                  min="1"
                                  max={selectedProduct.stockActual || 999}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Precio de Venta (S/.)
                                </label>
                                <input
                                  type="number"
                                  value={precioVenta}
                                  onChange={(e) => setPrecioVenta(parseFloat(e.target.value) || 0)}
                                  min="0"
                                  step="0.01"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                              </div>

                              <div className="bg-blue-50 p-3 rounded-lg">
                                <div className="text-sm text-gray-600">
                                  <div className="flex justify-between">
                                    <span>Subtotal:</span>
                                    <span className="font-semibold">S/. {(quantity * precioVenta).toFixed(2)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                      <button
                        type="button"
                        className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto"
                        onClick={handleAddProductToCotizacion}
                        disabled={!cotizacionActiva || quantity <= 0 || precioVenta <= 0}
                      >
                        Agregar a Cotización
                      </button>
                      <button
                        type="button"
                        className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                        onClick={() => setShowQuantityModal(false)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition.Root>
      </div>
    </Layout>
  );
};

export default NuevaCotizacionPage;