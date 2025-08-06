//pages/cotizaciones/[id].js
import { useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { db } from '../../lib/firebase';
import {
  collection,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  getDocs,
  runTransaction,
  onSnapshot,
  where,
} from 'firebase/firestore';
import {
  DocumentTextIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserIcon,
  TruckIcon,
  CreditCardIcon,
  PencilIcon,
  XMarkIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline';
import { Dialog, Transition } from '@headlessui/react';
import Select from 'react-select';

const CotizacionEditPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState(null);

  // Estados para productos
  const [productos, setProductos] = useState([]);
  const [filteredProductos, setFilteredProductos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Estados para datos de referencia
  const [clientes, setClientes] = useState([]);
  const [empleados, setEmpleados] = useState([]);

  // Estados para la cotización
  const [cotizacionData, setCotizacionData] = useState(null);
  const [itemsCotizacion, setItemsCotizacion] = useState([]);

  // Estados para el formulario
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [selectedEmpleado, setSelectedEmpleado] = useState(null);
  const [placaMoto, setPlacaMoto] = useState('');
  const [metodoPago, setMetodoPago] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [numeroCotizacion, setNumeroCotizacion] = useState('');

  // Estados para modales
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [precioVenta, setPrecioVenta] = useState(0);

  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editQuantity, setEditQuantity] = useState(1);
  const [editPrecio, setEditPrecio] = useState(0);

  // Cargar datos iniciales
  useEffect(() => {
    if (!user) {
      router.push('/auth');
      return;
    }
    if (!id || id === 'nueva') {
      router.push('/cotizaciones');
      return;
    }
    fetchInitialData();
  }, [user, router, id]);

  const fetchInitialData = async () => {
    setLoadingData(true);
    setError(null);
    try {
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

      // Cargar cotización específica
      const cotizacionRef = doc(db, 'cotizaciones', id);
      const cotizacionDoc = await getDoc(cotizacionRef);

      if (!cotizacionDoc.exists()) {
        setError('Cotización no encontrada.');
        setLoadingData(false);
        return;
      }

      const cotizacion = { id: cotizacionDoc.id, ...cotizacionDoc.data() };
      setCotizacionData(cotizacion);

      // Cargar items de la cotización
      const qItems = query(
        collection(db, 'cotizaciones', id, 'itemsCotizacion'),
        orderBy('createdAt', 'asc')
      );
      const itemsSnapshot = await getDocs(qItems);
      const itemsList = itemsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setItemsCotizacion(itemsList);

      // Sincronizar formulario
      syncFormWithCotizacion(cotizacion, clientesList, empleadosList);

    } catch (err) {
      console.error("Error al cargar datos:", err);
      setError("Error al cargar datos iniciales");
    } finally {
      setLoadingData(false);
    }
  };

  const syncFormWithCotizacion = (cotizacion, clientesList, empleadosList) => {
    setNumeroCotizacion(cotizacion.numeroCotizacion || '');
    setPlacaMoto(cotizacion.placaMoto || '');
    setMetodoPago(cotizacion.metodoPago || '');
    setObservaciones(cotizacion.observaciones || '');

    // Sincronizar cliente
    if (cotizacion.clienteId) {
      const cliente = clientesList.find(c => c.id === cotizacion.clienteId);
      if (cliente) {
        setSelectedCliente({
          value: cliente.id,
          label: `${cliente.nombre} ${cliente.apellido || ''} - ${cliente.dni || ''}`.trim()
        });
      }
    }

    // Sincronizar empleado
    if (cotizacion.empleadoAsignadoId) {
      const empleado = empleadosList.find(e => e.id === cotizacion.empleadoAsignadoId);
      if (empleado) {
        setSelectedEmpleado({
          value: empleado.id,
          label: `${empleado.nombre} ${empleado.apellido || ''} - ${empleado.puesto || ''}`.trim()
        });
      }
    }
  };

  // Búsqueda de productos con debounce
  const searchProducts = async (searchTerm) => {
    if (!searchTerm.trim()) {
      setFilteredProductos([]);
      return;
    }

    setIsSearching(true);
    try {
      const qProductos = query(collection(db, 'productos'), orderBy('nombre', 'asc'));
      const productosSnapshot = await getDocs(qProductos);
      const productosList = productosSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const searchTermLower = searchTerm.toLowerCase();
      
      const filtered = productosList.filter(producto => {
        const nombre = (producto.nombre || '').toLowerCase();
        const marca = (producto.marca || '').toLowerCase();
        const codigoTienda = (producto.codigoTienda || '').toLowerCase();
        const codigoProveedor = (producto.codigoProveedor || '').toLowerCase();
        const descripcion = (producto.descripcion || '').toLowerCase();
        const modelosCompatiblesTexto = (producto.modelosCompatiblesTexto || '').toLowerCase();

        return nombre.includes(searchTermLower) ||
              marca.includes(searchTermLower) ||
              codigoTienda.includes(searchTermLower) ||
              codigoProveedor.includes(searchTermLower) ||
              descripcion.includes(searchTermLower) ||
              modelosCompatiblesTexto.includes(searchTermLower);
      });

      setFilteredProductos(filtered);
    } catch (err) {
      console.error("Error al buscar productos:", err);
      setError("Error al buscar productos");
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim()) {
        searchProducts(searchTerm);
      } else {
        setFilteredProductos([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Actualizar datos de la cotización
  const handleUpdateNumeroCotizacion = async (nuevoNumero) => {
    if (!cotizacionData?.id) return;

    try {
      const cotizacionRef = doc(db, 'cotizaciones', cotizacionData.id);
      await updateDoc(cotizacionRef, {
        numeroCotizacion: nuevoNumero || null,
        updatedAt: serverTimestamp(),
      });
      setNumeroCotizacion(nuevoNumero);
    } catch (err) {
      console.error("Error al actualizar número:", err);
      setError("Error al actualizar número de cotización");
    }
  };

  const handleUpdateCliente = async (selectedOption) => {
    if (!cotizacionData?.id) return;

    try {
      await runTransaction(db, async (transaction) => {
        const cotizacionRef = doc(db, 'cotizaciones', cotizacionData.id);
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

  const handleUpdateEmpleado = async (selectedOption) => {
    if (!cotizacionData?.id) return;

    try {
      await runTransaction(db, async (transaction) => {
        const cotizacionRef = doc(db, 'cotizaciones', cotizacionData.id);
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

  const handleUpdatePlaca = async (nuevaPlaca) => {
    if (!cotizacionData?.id) return;

    try {
      const cotizacionRef = doc(db, 'cotizaciones', cotizacionData.id);
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

  const handleUpdateMetodoPago = async (nuevoMetodo) => {
    if (!cotizacionData?.id) return;

    try {
      const cotizacionRef = doc(db, 'cotizaciones', cotizacionData.id);
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

  const handleUpdateObservaciones = async (nuevasObservaciones) => {
    if (!cotizacionData?.id) return;

    try {
      const cotizacionRef = doc(db, 'cotizaciones', cotizacionData.id);
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

  // Funciones para productos
  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setPrecioVenta(parseFloat(product.precioVentaDefault || 0));
    setQuantity(1);
    setShowQuantityModal(true);
  };

  const handleAddProductToCotizacion = async () => {
    if (!cotizacionData?.id || !selectedProduct) return;

    try {
      const cotizacionItemsRef = collection(db, 'cotizaciones', cotizacionData.id, 'itemsCotizacion');
      const existingItemQuery = query(cotizacionItemsRef, where('productoId', '==', selectedProduct.id));
      const existingItemSnapshot = await getDocs(existingItemQuery);

      await runTransaction(db, async (transaction) => {
        const productRef = doc(db, 'productos', selectedProduct.id);
        const cotizacionRef = doc(db, 'cotizaciones', cotizacionData.id);

        const productSnap = await transaction.get(productRef);
        const cotizacionSnap = await transaction.get(cotizacionRef);

        if (!productSnap.exists() || !cotizacionSnap.exists()) {
          throw new Error("Producto o cotización no encontrada");
        }

        const productData = productSnap.data();

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
            color: productData.color || '',
            updatedAt: serverTimestamp(),
          });
        } else {
          itemRef = doc(cotizacionItemsRef);
          newQuantity = quantity;
          const newSubtotal = newQuantity * precioVenta;

          transaction.set(itemRef, {
            productoId: selectedProduct.id,
            nombreProducto: productData.nombre || selectedProduct.nombre,
            marca: productData.marca || selectedProduct.marca || '',
            codigoTienda: productData.codigoTienda || selectedProduct.codigoTienda || '',
            descripcion: productData.descripcion || selectedProduct.descripcion || '',
            color: productData.color || selectedProduct.color || '',
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

      // Refrescar items
      fetchItemsCotizacion();
      setShowQuantityModal(false);
      alert('Producto agregado exitosamente');
    } catch (err) {
      console.error("Error al agregar producto:", err);
      setError("Error al agregar producto a la cotización");
    }
  };

  const fetchItemsCotizacion = async () => {
    try {
      const qItems = query(
        collection(db, 'cotizaciones', cotizacionData.id, 'itemsCotizacion'),
        orderBy('createdAt', 'asc')
      );
      const itemsSnapshot = await getDocs(qItems);
      const itemsList = itemsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setItemsCotizacion(itemsList);

      // Actualizar datos de cotización
      const cotizacionRef = doc(db, 'cotizaciones', cotizacionData.id);
      const cotizacionDoc = await getDoc(cotizacionRef);
      if (cotizacionDoc.exists()) {
        setCotizacionData({ id: cotizacionDoc.id, ...cotizacionDoc.data() });
      }
    } catch (err) {
      console.error("Error al cargar items:", err);
    }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setEditQuantity(item.cantidad);
    setEditPrecio(parseFloat(item.precioVentaUnitario || 0));
    setShowEditItemModal(true);
  };

  const handleUpdateItem = async () => {
    if (!cotizacionData?.id || !editingItem) return;

    try {
      await runTransaction(db, async (transaction) => {
        const itemRef = doc(db, 'cotizaciones', cotizacionData.id, 'itemsCotizacion', editingItem.id);
        const cotizacionRef = doc(db, 'cotizaciones', cotizacionData.id);

        const cotizacionSnap = await transaction.get(cotizacionRef);
        if (!cotizacionSnap.exists()) {
          throw new Error("Cotización no encontrada");
        }

        const oldSubtotal = parseFloat(editingItem.subtotal || 0);
        const newSubtotal = editQuantity * editPrecio;

        transaction.update(itemRef, {
          cantidad: editQuantity,
          precioVentaUnitario: editPrecio,
          subtotal: newSubtotal,
          updatedAt: serverTimestamp(),
        });

        const currentTotal = parseFloat(cotizacionSnap.data().totalCotizacion || 0);
        const updatedTotal = currentTotal - oldSubtotal + newSubtotal;

        transaction.update(cotizacionRef, {
          totalCotizacion: parseFloat(updatedTotal.toFixed(2)),
          updatedAt: serverTimestamp(),
        });
      });

      fetchItemsCotizacion();
      setShowEditItemModal(false);
      alert('Producto actualizado exitosamente');
    } catch (err) {
      console.error("Error al actualizar item:", err);
      setError("Error al actualizar producto");
    }
  };

  const handleRemoveItem = async (itemId, subtotal) => {
    if (!cotizacionData?.id || !itemId) return;

    if (!window.confirm('¿Eliminar este producto de la cotización?')) return;

    try {
      await runTransaction(db, async (transaction) => {
        const itemRef = doc(db, 'cotizaciones', cotizacionData.id, 'itemsCotizacion', itemId);
        const cotizacionRef = doc(db, 'cotizaciones', cotizacionData.id);

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

      fetchItemsCotizacion();
      alert('Producto eliminado de la cotización');
    } catch (err) {
      console.error("Error al eliminar item:", err);
      setError("Error al eliminar producto");
    }
  };

  // Confirmar cotización
  const handleConfirmarCotizacion = async () => {
    if (!cotizacionData?.id) return;

    if (!selectedCliente) {
      alert('Por favor selecciona un cliente');
      return;
    }

    if (itemsCotizacion.length === 0) {
      alert('La cotización debe tener al menos un producto');
      return;
    }

    if (!window.confirm('¿Confirmar esta cotización? Esto la convertirá en una VENTA y afectará el stock actual.')) {
      return;
    }

    setLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        const cotizacionRef = doc(db, 'cotizaciones', cotizacionData.id);
        const cotizacionSnap = await transaction.get(cotizacionRef);

        if (!cotizacionSnap.exists()) {
          throw new Error("Cotización no encontrada.");
        }

        const currentCotizacionData = cotizacionSnap.data();
        if (currentCotizacionData.estado === 'confirmada' || currentCotizacionData.estado === 'cancelada') {
          throw new Error("Esta cotización ya ha sido confirmada o cancelada.");
        }

        const itemsCotizacionCollectionRef = collection(db, 'cotizaciones', cotizacionData.id, 'itemsCotizacion');
        const itemsCotizacionSnapshot = await getDocs(itemsCotizacionCollectionRef);

        if (itemsCotizacionSnapshot.empty) {
          throw new Error("No se encontraron productos asociados a esta cotización.");
        }

        const productoRefsAndData = [];
        for (const itemDoc of itemsCotizacionSnapshot.docs) {
          const itemData = itemDoc.data();
          const productoRef = doc(db, 'productos', itemData.productoId);
          const productoSnap = await transaction.get(productoRef);

          if (productoSnap.exists()) {
            productoRefsAndData.push({
              itemData: itemData,
              productoRef: productoRef,
              currentProductoData: productoSnap.data(),
            });
          } else {
            throw new Error(`Producto con ID ${itemData.productoId} no encontrado.`);
          }
        }

        for (const { itemData, currentProductoData } of productoRefsAndData) {
          const currentStock = typeof currentProductoData.stockActual === 'number' ? currentProductoData.stockActual : 0;
          const cantidadVendida = typeof itemData.cantidad === 'number' ? itemData.cantidad : 0;
          if (currentStock < cantidadVendida) {
            throw new Error(`Stock insuficiente para el producto "${itemData.nombreProducto}". Stock actual: ${currentStock}, Cantidad solicitada: ${cantidadVendida}.`);
          }
        }

        const newVentaRef = doc(collection(db, 'ventas'));
        transaction.set(newVentaRef, {
          cotizacionId: cotizacionData.id,
          clienteId: currentCotizacionData.clienteId,
          clienteNombre: currentCotizacionData.clienteNombre,
          totalVenta: currentCotizacionData.totalCotizacion,
          fechaVenta: serverTimestamp(),
          empleadoId: user.email || user.uid,
          observaciones: currentCotizacionData.observaciones || 'Convertido de cotización',
          estado: 'completada',
          metodoPago: currentCotizacionData.metodoPago || 'Efectivo',
          tipoVenta: 'cotizacionAprobada',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        for (const { itemData, productoRef, currentProductoData } of productoRefsAndData) {
          const currentStock = typeof currentProductoData.stockActual === 'number' ? currentProductoData.stockActual : 0;
          const cantidadVendida = typeof itemData.cantidad === 'number' ? itemData.cantidad : 0;
          const newStock = currentStock - cantidadVendida;

          transaction.update(productoRef, {
            stockActual: newStock,
            updatedAt: serverTimestamp(),
          });

          transaction.set(doc(collection(newVentaRef, 'itemsVenta')), {
            productoId: itemData.productoId,
            nombreProducto: itemData.nombreProducto,
            cantidad: itemData.cantidad,
            precioVentaUnitario: itemData.precioVentaUnitario,
            subtotal: itemData.subtotal,
            createdAt: serverTimestamp(),
          });
        }

        transaction.update(cotizacionRef, { estado: 'confirmada', updatedAt: serverTimestamp() });
      });

      alert('Cotización confirmada y convertida en Venta con éxito.');
      router.push('/cotizaciones');
    } catch (err) {
      console.error("Error al confirmar cotización:", err);
      setError("Error al confirmar la cotización. " + err.message);
      alert('Hubo un error al confirmar la cotización: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Cancelar cotización
  const handleCancelarCotizacion = async () => {
    if (!cotizacionData?.id) return;

    if (!window.confirm('¿Cancelar esta cotización? Esto la marcará como inactiva y no afectará el stock.')) {
      return;
    }

    setLoading(true);
    try {
      const cotizacionRef = doc(db, 'cotizaciones', cotizacionData.id);
      await updateDoc(cotizacionRef, {
        estado: 'cancelada',
        updatedAt: serverTimestamp(),
      });

      alert('Cotización cancelada con éxito.');
      router.push('/cotizaciones');
    } catch (err) {
      console.error("Error al cancelar cotización:", err);
      setError("Error al cancelar la cotización. " + err.message);
      alert('Hubo un error al cancelar la cotización: ' + err.message);
    } finally {
      setLoading(false);
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

  if (!user || loadingData) {
    return (
      <Layout title="Cargando...">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  if (!cotizacionData) {
    return (
      <Layout title="Cotización no encontrada">
        <div className="text-center py-12">
          <p className="text-gray-500">Cotización no encontrada</p>
          <button
            onClick={() => router.push('/cotizaciones')}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Volver a Cotizaciones
          </button>
        </div>
      </Layout>
    );
  }

  const canEdit = cotizacionData.estado === 'pendiente' || cotizacionData.estado === 'borrador';

  return (
    <Layout title={`Editar Cotización ${cotizacionData.numeroCotizacion || cotizacionData.id}`}>
      <div className="min-h-screen bg-gray-50 py-6">
        <div className="max-w-full mx-auto px-6 sm:px-8 lg:px-12">
          {error && (
            <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50">
              {error}
            </div>
          )}

          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold">Editar Cotización</h1>
                  <p className="text-blue-100">{cotizacionData.numeroCotizacion || `ID: ${cotizacionData.id}`}</p>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => router.push('/cotizaciones')}
                    className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
                  >
                    <ArrowLeftIcon className="h-5 w-5 mr-2" />
                    Volver
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-6 p-6">
              {/* Panel Izquierdo - Información de la Cotización */}
              <div className="col-span-12 lg:col-span-4">
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h2 className="text-lg font-semibold mb-4 text-gray-800">Información de la Cotización</h2>
                  
                  {/* Estado actual */}
                  <div className="mb-4 p-3 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Estado actual:</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        cotizacionData.estado === 'confirmada' ? 'bg-green-100 text-green-800' :
                        cotizacionData.estado === 'cancelada' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {cotizacionData.estado?.toUpperCase() || 'PENDIENTE'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Número de Cotización */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Número de Cotización:</label>
                      <input
                        type="text"
                        value={numeroCotizacion}
                        onChange={(e) => handleUpdateNumeroCotizacion(e.target.value)}
                        placeholder="Ej: COT-2024-001"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={!canEdit}
                      />
                    </div>

                    {/* Cliente */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Cliente:</label>
                      <Select
                        options={clienteOptions}
                        value={selectedCliente}
                        onChange={handleUpdateCliente}
                        placeholder="Seleccionar cliente..."
                        className="text-sm"
                        isClearable
                        isDisabled={!canEdit}
                      />
                    </div>

                    {/* Empleado */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Empleado:</label>
                      <Select
                        options={empleadoOptions}
                        value={selectedEmpleado}
                        onChange={handleUpdateEmpleado}
                        placeholder="Seleccionar empleado..."
                        className="text-sm"
                        isClearable
                        isDisabled={!canEdit}
                      />
                    </div>

                    {/* Placa Moto */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Placa Moto:</label>
                      <input
                        type="text"
                        value={placaMoto}
                        onChange={(e) => handleUpdatePlaca(e.target.value)}
                        placeholder="Ej: ABC-123"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={!canEdit}
                      />
                    </div>

                    {/* Método de Pago */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Método de Pago:</label>
                      <select
                        value={metodoPago}
                        onChange={(e) => handleUpdateMetodoPago(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={!canEdit}
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
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Observaciones:</label>
                      <textarea
                        value={observaciones}
                        onChange={(e) => handleUpdateObservaciones(e.target.value)}
                        placeholder="Observaciones adicionales..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows="3"
                        disabled={!canEdit}
                      />
                    </div>

                    {/* Total */}
                    <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                      <div className="text-lg font-bold text-green-800">
                        Total: S/. {parseFloat(cotizacionData.totalCotizacion || 0).toFixed(2)}
                      </div>
                    </div>

                    {/* Fechas */}
                    <div className="space-y-2 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Creada:</span>{' '}
                        {cotizacionData.fechaCreacion?.toDate?.() ? 
                          cotizacionData.fechaCreacion.toDate().toLocaleDateString('es-ES', {
                            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          }) : 'N/A'
                        }
                      </div>
                    </div>

                    {/* Botones de acción */}
                    {canEdit && (
                      <div className="space-y-3 pt-4 border-t">
                        <button
                          onClick={handleConfirmarCotizacion}
                          disabled={!selectedCliente || itemsCotizacion.length === 0 || loading}
                          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg flex items-center justify-center font-medium transition-colors"
                        >
                          <CheckCircleIcon className="h-5 w-5 mr-2" />
                          Confirmar Cotización
                        </button>
                        
                        <button
                          onClick={handleCancelarCotizacion}
                          disabled={loading}
                          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg flex items-center justify-center font-medium transition-colors"
                        >
                          <XCircleIcon className="h-5 w-5 mr-2" />
                          Cancelar Cotización
                        </button>
                      </div>
                    )}

                    {!canEdit && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p className="text-yellow-800 text-sm">
                          <strong>Nota:</strong> Esta cotización no se puede editar porque su estado es "{cotizacionData.estado}".
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Panel Derecho - Productos y Buscador */}
              <div className="col-span-12 lg:col-span-8">
                {/* Buscador de Productos (solo si se puede editar) */}
                {canEdit && (
                  <div className="bg-white border border-gray-200 rounded-lg mb-6 relative">
                    <div className="p-4">
                      <h2 className="text-lg font-semibold mb-4 text-gray-800">Buscar Productos</h2>
                      <div className="relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Buscar productos por nombre, marca, código, modelos compatibles..."
                          className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        {isSearching && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                          </div>
                        )}
                      </div>
                      
                      <div className="text-sm text-gray-600 mt-2">
                        {searchTerm.trim() === '' ? (
                          'Escribe para buscar productos...'
                        ) : (
                          `${filteredProductos.length} productos encontrados`
                        )}
                      </div>
                    </div>

                    {/* Dropdown de productos */}
                    {searchTerm.trim() !== '' && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-b-lg shadow-lg z-40 max-h-80 overflow-y-auto">
                        {isSearching ? (
                          <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                          </div>
                        ) : filteredProductos.length === 0 ? (
                          <div className="p-4 text-center text-gray-500">
                            <p>No se encontraron productos</p>
                          </div>
                        ) : (
                          <div className="max-h-80">
                            {filteredProductos.slice(0, 20).map(producto => (
                              <div
                                key={producto.id}
                                className="p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                                onClick={() => {
                                  handleSelectProduct(producto);
                                  setSearchTerm('');
                                }}
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-gray-900 truncate">
                                      {producto.nombre} ({producto.codigoTienda})
                                    </h4>
                                    <p className="text-sm text-gray-600 truncate">
                                      <span className="font-medium">Marca:</span> {producto.marca}
                                    </p>
                                    <p className="text-sm text-gray-600 truncate">
                                      <span className="font-medium">Color:</span> {producto.color || 'N/A'}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      <span className="font-medium">Stock:</span> {producto.stockActual}
                                    </p>
                                    {producto.modelosCompatiblesTexto && (
                                      <p className="text-sm text-blue-600 truncate">
                                        <span className="font-medium">Modelos:</span> {producto.modelosCompatiblesTexto}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right flex-shrink-0 ml-4">
                                    <p className="font-semibold text-green-600 text-lg">
                                      S/. {parseFloat(producto.precioVentaDefault || 0).toFixed(2)}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      Stock: {producto.stockActual || 0}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {filteredProductos.length > 20 && (
                              <div className="p-3 text-center text-sm text-gray-500 bg-gray-50">
                                Mostrando 20 de {filteredProductos.length} resultados. Refina tu búsqueda para ver más.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Items de la Cotización */}
                <div className="bg-white border border-gray-200 rounded-lg">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="text-xl font-semibold text-gray-800">
                      Productos en la Cotización
                    </h3>
                    <div className="mt-3 bg-gradient-to-r from-blue-50 to-blue-100 p-3 rounded-lg border border-blue-200">
                      <div className="text-lg font-bold text-blue-800">
                        Total: S/. {parseFloat(cotizacionData.totalCotizacion || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    {itemsCotizacion.length === 0 ? (
                      <div className="text-center py-12">
                        <ShoppingCartIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                        <h4 className="text-lg font-medium text-gray-600 mb-2">No hay productos en esta cotización</h4>
                        {canEdit ? (
                          <p className="text-gray-500">Usa el buscador arriba para encontrar y agregar productos</p>
                        ) : (
                          <p className="text-gray-500">Esta cotización no tiene productos asociados</p>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead className="bg-gray-50">
                              <tr className="border-b border-gray-300">
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide w-1/4">NOMBRE</th>
                                <th className="px-3 py-3 text-center text-sm font-semibold text-gray-600 uppercase tracking-wide w-20">CÓDIGO</th>
                                <th className="px-3 py-3 text-center text-sm font-semibold text-gray-600 uppercase tracking-wide w-24">MARCA</th>
                                <th className="px-3 py-3 text-center text-sm font-semibold text-gray-600 uppercase tracking-wide w-16">CANT.</th>
                                <th className="px-3 py-3 text-center text-sm font-semibold text-gray-600 uppercase tracking-wide w-24">P.V. UNIT.</th>
                                <th className="px-3 py-3 text-center text-sm font-semibold text-gray-600 uppercase tracking-wide w-24">COLOR</th>
                                <th className="px-3 py-3 text-center text-sm font-semibold text-gray-600 uppercase tracking-wide w-28">SUBTOTAL</th>
                                {canEdit && (
                                  <th className="px-3 py-3 text-center text-sm font-semibold text-gray-600 uppercase tracking-wide w-24">ACCIONES</th>
                                )}
                              </tr>
                            </thead>
                            
                            <tbody>
                              {itemsCotizacion.map((item, index) => (
                                <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <td className="px-4 py-3">
                                    <div className="font-medium text-gray-900 text-sm">
                                      {item.nombreProducto}
                                    </div>
                                  </td>

                                  <td className="px-3 py-3 text-center">
                                    <span className="text-sm text-gray-900 font-medium">
                                      {item.codigoTienda || 'N/A'}
                                    </span>
                                  </td>

                                  <td className="px-3 py-3 text-center">
                                    <span className="text-sm text-gray-700">
                                      {item.marca || 'Sin marca'}
                                    </span>
                                  </td>

                                  <td className="px-3 py-3 text-center">
                                    <span className="text-sm font-medium text-gray-900">
                                      {item.cantidad}
                                    </span>
                                  </td>

                                  <td className="px-3 py-3 text-center">
                                    <span className="text-sm font-medium text-gray-900">
                                      S/. {parseFloat(item.precioVentaUnitario || 0).toFixed(2)}
                                    </span>
                                  </td>

                                  <td className="px-3 py-3 text-center">
                                    <span className="text-sm text-gray-600" title={item.color || item.descripcion || 'N/A'}>
                                      {item.color || item.descripcion || "N/A"}
                                    </span>
                                  </td>

                                  <td className="px-3 py-3 text-center">
                                    <span className="text-sm font-semibold text-gray-900">
                                      S/. {parseFloat(item.subtotal || 0).toFixed(2)}
                                    </span>
                                  </td>

                                  {canEdit && (
                                    <td className="px-3 py-3 text-center">
                                      <div className="flex justify-center space-x-2">
                                        <button
                                          onClick={() => handleEditItem(item)}
                                          className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors"
                                          title="Editar"
                                        >
                                          <PencilIcon className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={() => handleRemoveItem(item.id, item.subtotal)}
                                          className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors"
                                          title="Eliminar"
                                        >
                                          <TrashIcon className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 border-t border-gray-300">
                          <div className="flex justify-between items-center">
                            <div>
                              <h3 className="text-lg font-semibold">Total de la Cotización</h3>
                              <p className="text-blue-100 text-sm">{itemsCotizacion.length} producto{itemsCotizacion.length !== 1 ? 's' : ''}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-3xl font-bold">
                                S/. {parseFloat(cotizacionData.totalCotizacion || 0).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
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
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
                  <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                    <button
                      type="button"
                      className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      onClick={() => setShowEditItemModal(false)}
                    >
                      <span className="sr-only">Cerrar</span>
                      <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                      <PencilIcon className="h-6 w-6 text-yellow-600" aria-hidden="true" />
                    </div>
                    <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                      <Dialog.Title as="h3" className="text-xl font-semibold leading-6 text-gray-900 mb-4">
                        Editar Producto
                      </Dialog.Title>
                      
                      {editingItem && (
                        <div className="mt-4">
                          <div className="bg-gray-50 p-6 rounded-lg mb-6">
                            <h4 className="font-semibold text-lg text-gray-900 mb-2">
                              {editingItem.nombreProducto}
                            </h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-medium text-gray-700">Código: </span>
                                <span className="text-gray-600">{editingItem.codigoTienda}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Marca: </span>
                                <span className="text-gray-600">{editingItem.marca}</span>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-6">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-3">
                                Cantidad
                              </label>
                              <input
                                type="number"
                                value={editQuantity}
                                onChange={(e) => setEditQuantity(parseInt(e.target.value) || 1)}
                                min="1"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-3">
                                Precio de Venta (S/.)
                              </label>
                              <input
                                type="number"
                                value={editPrecio}
                                onChange={(e) => setEditPrecio(parseFloat(e.target.value) || 0)}
                                min="0"
                                step="0.01"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                              />
                            </div>
                          </div>

                          <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 p-6 rounded-lg border border-yellow-200 mt-6">
                            <div className="flex justify-between items-center">
                              <span className="text-lg font-medium text-gray-700">Nuevo Subtotal:</span>
                              <span className="font-bold text-yellow-800 text-2xl">S/. {(editQuantity * editPrecio).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 sm:mt-6 sm:flex sm:flex-row-reverse gap-3">
                    <button
                      type="button"
                      className="inline-flex w-full justify-center rounded-md bg-yellow-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-yellow-500 sm:w-auto disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                      onClick={handleUpdateItem}
                      disabled={editQuantity <= 0 || editPrecio <= 0}
                    >
                      Actualizar
                    </button>
                    <button
                      type="button"
                      className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-6 py-3 text-base font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto transition-colors"
                      onClick={() => setShowEditItemModal(false)}
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

      
      {/* Modal de Edición de Item - VERSIÓN MEJORADA */}
      <Transition.Root show={showEditItemModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={setShowEditItemModal}>
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
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
                  <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                    <button
                      type="button"
                      className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      onClick={() => setShowEditItemModal(false)}
                    >
                      <span className="sr-only">Cerrar</span>
                      <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>
      
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                      <PencilIcon className="h-6 w-6 text-yellow-600" aria-hidden="true" />
                    </div>
                    <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                      <Dialog.Title as="h3" className="text-xl font-semibold leading-6 text-gray-900 mb-4">
                        Editar Producto
                      </Dialog.Title>
                      
                      {editingItem && (
                        <div className="mt-4">
                          <div className="bg-gray-50 p-6 rounded-lg mb-6">
                            <h4 className="font-semibold text-lg text-gray-900 mb-2">
                              {editingItem.nombreProducto}
                            </h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-medium text-gray-700">Código: </span>
                                <span className="text-gray-600">{editingItem.codigoTienda}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Marca: </span>
                                <span className="text-gray-600">{editingItem.marca}</span>
                              </div>
                            </div>
                          </div>
      
                          <div className="grid grid-cols-2 gap-6">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-3">
                                Cantidad
                              </label>
                              <input
                                type="number"
                                value={editQuantity}
                                onChange={(e) => setEditQuantity(parseInt(e.target.value) || 1)}
                                min="1"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                              />
                            </div>
      
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-3">
                                Precio de Venta (S/.)
                              </label>
                              <input
                                type="number"
                                value={editPrecio}
                                onChange={(e) => setEditPrecio(parseFloat(e.target.value) || 0)}
                                min="0"
                                step="0.01"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                              />
                            </div>
                          </div>
      
                          <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 p-6 rounded-lg border border-yellow-200 mt-6">
                            <div className="flex justify-between items-center">
                              <span className="text-lg font-medium text-gray-700">Nuevo Subtotal:</span>
                              <span className="font-bold text-yellow-800 text-2xl">S/. {(editQuantity * editPrecio).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
      
                  <div className="mt-6 sm:mt-6 sm:flex sm:flex-row-reverse gap-3">
                    <button
                      type="button"
                      className="inline-flex w-full justify-center rounded-md bg-yellow-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-yellow-500 sm:w-auto disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                      onClick={handleUpdateItem}
                      disabled={editQuantity <= 0 || editPrecio <= 0}
                    >
                      Actualizar
                    </button>
                    <button
                      type="button"
                      className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-6 py-3 text-base font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto transition-colors"
                      onClick={() => setShowEditItemModal(false)}
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
    </Layout>
  );
};

export default CotizacionEditPage;

