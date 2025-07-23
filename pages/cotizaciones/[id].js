import { useState, useEffect, useRef } from 'react';
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
  runTransaction, // Importar runTransaction
} from 'firebase/firestore';
import {
  DocumentTextIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  ArrowLeftIcon,
  CheckCircleIcon, // Importar CheckCircleIcon para el botón de aprobar
  CurrencyDollarIcon, // Para el método de pago
} from '@heroicons/react/24/outline';

const CotizacionFormPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const isEditing = id && id !== 'nueva';
  const { user } = useAuth();

  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);
  const [clientes, setClientes] = useState([]);

  const [cotizacionPrincipalData, setCotizacionPrincipalData] = useState({
    numeroCotizacion: '',
    clienteId: '',
    observaciones: '',
    validezDias: 30,
    estado: 'pendiente', // Por defecto 'pendiente' para nuevas
    metodoPago: 'efectivo', // <-- ¡NUEVO CAMPO! Por defecto 'efectivo'
  });

  const [currentSearchTerm, setCurrentSearchTerm] = useState('');
  const [currentSearchResults, setCurrentSearchResults] = useState([]);
  const [showCurrentSearchResults, setShowCurrentSearchResults] = useState(false);
  const [selectedProductToAdd, setSelectedProductToAdd] = useState(null);

  const [itemsCotizacion, setItemsCotizacion] = useState([]);
  const [initialItemsCotizacion, setInitialItemsCotizacion] = useState([]);

  const searchResultRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        router.push('/auth');
        return;
      }

      setLoadingData(true);
      setError(null);

      try {
        // 1. Cargar Productos
        const qProducts = query(collection(db, 'productos'), orderBy('nombre', 'asc'));
        const productSnapshot = await getDocs(qProducts);
        const productsList = productSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProducts(productsList);

        // 2. Cargar Clientes
        const qClientes = query(collection(db, 'cliente'), orderBy('nombre', 'asc'));
        const clienteSnapshot = await getDocs(qClientes);
        const clientesList = clienteSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setClientes(clientesList);

        // 3. Lógica condicional para cargar datos si es edición
        if (isEditing) {
          if (!id) {
            setLoadingData(false);
            return;
          }

          const cotizacionRef = doc(db, 'cotizaciones', id);
          const cotizacionDoc = await getDoc(cotizacionRef);

          if (!cotizacionDoc.exists()) {
            setError('Cotización no encontrada.');
            setLoadingData(false);
            return;
          }

          const cotizacionData = cotizacionDoc.data();
          setCotizacionPrincipalData({
            numeroCotizacion: cotizacionData.numeroCotizacion || '',
            clienteId: cotizacionData.clienteId || '',
            observaciones: cotizacionData.observaciones || '',
            validezDias: cotizacionData.validezDias || 30,
            estado: cotizacionData.estado || 'pendiente',
            metodoPago: cotizacionData.metodoPago || 'efectivo', // <-- Cargar método de pago
          });

          // Cargar los ítems de la subcolección de la cotización
          const qItems = query(collection(cotizacionRef, 'itemsCotizacion'), orderBy('createdAt', 'asc'));
          const itemsSnapshot = await getDocs(qItems);
          const itemsList = itemsSnapshot.docs.map(doc => ({
            id: doc.id,
            productoId: doc.data().productoId,
            nombreProducto: doc.data().nombreProducto,
            cantidad: doc.data().cantidad,
            precioVentaUnitario: doc.data().precioVentaUnitario,
            subtotal: doc.data().subtotal,
            isNew: false
          }));
          setItemsCotizacion(itemsList);
          setInitialItemsCotizacion(itemsList);
        } else {
          // Si es nueva cotización, reiniciar el formulario y establecer cliente por defecto
          setCotizacionPrincipalData({
            numeroCotizacion: '',
            clienteId: clientesList.find(c => c.id === 'cliente-no-registrado')?.id || '',
            observaciones: '',
            validezDias: 30,
            estado: 'pendiente',
            metodoPago: 'efectivo', // <-- Valor por defecto para nuevas cotizaciones
          });
          setItemsCotizacion([]);
          setInitialItemsCotizacion([]);
        }

      } catch (err) {
        console.error("Error al cargar datos:", err);
        setError("Error al cargar los datos: " + err.message);
      } finally {
        setLoadingData(false);
      }
    };

    if (router.isReady) {
      fetchData();
    }
  }, [user, router.isReady, id, isEditing]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchResultRef.current && !searchResultRef.current.contains(event.target)) {
        setShowCurrentSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleCotizacionPrincipalChange = (e) => {
    const { name, value } = e.target;
    setCotizacionPrincipalData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, e) => {
    const { name, value } = e.target;
    const newItems = [...itemsCotizacion];
    let parsedValue = value;

    if (name === 'cantidad') {
      if (value === '') {
        parsedValue = '';
      } else {
        parsedValue = parseInt(value, 10);
        if (isNaN(parsedValue) || parsedValue < 0) {
          parsedValue = 0;
        }
      }
    } else if (name === 'precioVentaUnitario') {
      if (value === '') {
        parsedValue = '';
      } else {
        const floatValue = parseFloat(value);
        if (isNaN(floatValue) || floatValue < 0) {
          parsedValue = '0.00';
        } else {
          parsedValue = value;
        }
      }
    }

    newItems[index][name] = parsedValue;

    const cantidad = parseFloat(newItems[index].cantidad || 0);
    const precio = parseFloat(newItems[index].precioVentaUnitario || 0);

    if (!isNaN(cantidad) && !isNaN(precio)) {
      newItems[index].subtotal = (cantidad * precio).toFixed(2);
    } else {
      newItems[index].subtotal = '0.00';
    }

    setItemsCotizacion(newItems);
  };

  const handleProductSearchChange = (e) => {
    const searchTerm = e.target.value;
    setCurrentSearchTerm(searchTerm);
    setSelectedProductToAdd(null);

    if (searchTerm.length > 1) {
      const filtered = products.filter(p =>
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.codigoTienda && p.codigoTienda.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setCurrentSearchResults(filtered);
      setShowCurrentSearchResults(true);
    } else {
      setCurrentSearchResults([]);
      setShowCurrentSearchResults(false);
    }
  };

  const handleProductSelectFromSearch = (product) => {
    setCurrentSearchTerm(product.nombre);
    setSelectedProductToAdd(product);
    setCurrentSearchResults([]);
    setShowCurrentSearchResults(false);
  };

  const addProductToItems = () => {
    if (selectedProductToAdd) {
      const exists = itemsCotizacion.some(item => item.productoId === selectedProductToAdd.id);
      if (exists) {
        alert('Este producto ya ha sido añadido a la cotización. Edite la cantidad en la tabla.');
        return;
      }

      setItemsCotizacion(prevItems => [
        ...prevItems,
        {
          id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          productoId: selectedProductToAdd.id,
          nombreProducto: selectedProductToAdd.nombre,
          cantidad: 1,
          precioVentaUnitario: selectedProductToAdd.precioVentaDefault !== undefined
            ? parseFloat(selectedProductToAdd.precioVentaDefault).toFixed(2)
            : '0.00',
          subtotal: parseFloat((1 * (selectedProductToAdd.precioVentaDefault || 0)).toFixed(2)),
          isNew: true
        }
      ]);
      setCurrentSearchTerm('');
      setSelectedProductToAdd(null);
      setError(null);
    } else {
      setError('Por favor, seleccione un producto de la lista antes de intentar agregarlo.');
    }
  };

  const removeItem = (index) => {
    if (window.confirm('¿Está seguro de que desea eliminar este producto de la cotización?')) {
      setItemsCotizacion(prevItems => prevItems.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const clienteSeleccionado = clientes.find(c => c.id === cotizacionPrincipalData.clienteId);
    if (!clienteSeleccionado) {
      setError('Por favor, seleccione un cliente válido.');
      setSaving(false);
      return;
    }

    if (itemsCotizacion.length === 0) {
      setError('Debe añadir al menos un producto a la cotización.');
      setSaving(false);
      return;
    }

    const validItems = itemsCotizacion.every(item => {
      const cantidad = parseFloat(item.cantidad);
      const precio = parseFloat(item.precioVentaUnitario);
      return (
        item.productoId &&
        !isNaN(cantidad) && cantidad > 0 &&
        !isNaN(precio) && precio >= 0
      );
    });

    if (!validItems) {
      setError('Por favor, asegúrese de que todos los ítems tengan un producto, cantidad (>0) y precio de venta (>=0) válidos.');
      setSaving(false);
      return;
    }

    let totalCotizacion = itemsCotizacion.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0);
    const validezMilisegundos = cotizacionPrincipalData.validezDias * 24 * 60 * 60 * 1000;
    const fechaExpiracion = new Date(Date.now() + validezMilisegundos);

    try {
      let cotizacionDocRef;

      if (isEditing) {
        cotizacionDocRef = doc(db, 'cotizaciones', id);
        await updateDoc(cotizacionDocRef, {
          numeroCotizacion: cotizacionPrincipalData.numeroCotizacion.trim() || null,
          clienteId: cotizacionPrincipalData.clienteId,
          clienteNombre: clienteSeleccionado.nombre + (clienteSeleccionado.apellido ? ' ' + clienteSeleccionado.apellido : ''),
          clienteDNI: clienteSeleccionado.dni || clienteSeleccionado.numeroDocumento || null,
          observaciones: cotizacionPrincipalData.observaciones.trim() || null,
          metodoPago: cotizacionPrincipalData.metodoPago, // <-- Guardar método de pago
          totalCotizacion: parseFloat(totalCotizacion.toFixed(2)),
          validezDias: parseInt(cotizacionPrincipalData.validezDias, 10),
          fechaExpiracion: fechaExpiracion,
          estado: cotizacionPrincipalData.estado,
          updatedAt: serverTimestamp(),
        });
        console.log("Documento principal de cotización actualizado con ID: ", id);

        const initialDbItemIds = new Set(initialItemsCotizacion.map(item => item.id));
        const currentFormItemIds = new Set(itemsCotizacion.map(item => item.id));

        for (const initialItem of initialItemsCotizacion) {
          if (!currentFormItemIds.has(initialItem.id)) {
            await deleteDoc(doc(cotizacionDocRef, 'itemsCotizacion', initialItem.id));
          }
        }

        for (const currentItem of itemsCotizacion) {
          if (currentItem.isNew) {
            await addDoc(collection(cotizacionDocRef, 'itemsCotizacion'), {
              productoId: currentItem.productoId,
              nombreProducto: currentItem.nombreProducto,
              cantidad: parseFloat(currentItem.cantidad),
              precioVentaUnitario: parseFloat(currentItem.precioVentaUnitario),
              subtotal: parseFloat(currentItem.subtotal),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            const originalItem = initialItemsCotizacion.find(item => item.id === currentItem.id);
            if (originalItem && (
              originalItem.cantidad !== parseFloat(currentItem.cantidad) ||
              originalItem.precioVentaUnitario !== parseFloat(currentItem.precioVentaUnitario) ||
              originalItem.subtotal !== parseFloat(currentItem.subtotal)
            )) {
              await updateDoc(doc(cotizacionDocRef, 'itemsCotizacion', currentItem.id), {
                cantidad: parseFloat(currentItem.cantidad),
                precioVentaUnitario: parseFloat(currentItem.precioVentaUnitario),
                subtotal: parseFloat(currentItem.subtotal),
                updatedAt: serverTimestamp(),
              });
            }
          }
        }
        alert('Cotización actualizada con éxito.');

      } else {
        // --- Lógica para CREACIÓN de nueva cotización ---
        cotizacionDocRef = await addDoc(collection(db, 'cotizaciones'), {
          numeroCotizacion: cotizacionPrincipalData.numeroCotizacion.trim() || null,
          clienteId: cotizacionPrincipalData.clienteId,
          clienteNombre: clienteSeleccionado.nombre + (clienteSeleccionado.apellido ? ' ' + clienteSeleccionado.apellido : ''),
          clienteDNI: clienteSeleccionado.dni || clienteSeleccionado.numeroDocumento || null,
          observaciones: cotizacionPrincipalData.observaciones.trim() || null,
          metodoPago: cotizacionPrincipalData.metodoPago, // <-- Guardar método de pago
          totalCotizacion: parseFloat(totalCotizacion.toFixed(2)),
          fechaCreacion: serverTimestamp(),
          validezDias: parseInt(cotizacionPrincipalData.validezDias, 10),
          fechaExpiracion: fechaExpiracion,
          empleadoId: user.email || user.uid,
          estado: 'pendiente',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        console.log("Documento principal de cotización creado con ID: ", cotizacionDocRef.id);

        for (const item of itemsCotizacion) {
          await addDoc(collection(cotizacionDocRef, 'itemsCotizacion'), {
            productoId: item.productoId,
            nombreProducto: item.nombreProducto,
            cantidad: parseFloat(item.cantidad),
            precioVentaUnitario: parseFloat(item.precioVentaUnitario),
            subtotal: parseFloat(item.subtotal),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        alert('Cotización registrada con éxito.');
      }

      router.push('/cotizaciones');
    } catch (err) {
      console.error("Error al procesar cotización:", err);
      setError("Error al procesar la cotización. " + (err.code === 'permission-denied' ? 'No tiene permisos para realizar esta acción. Contacte al administrador.' : err.message));
    } finally {
      setSaving(false);
    }
  };

  // --- NUEVA LÓGICA: Aprobar Cotización y Convertir en Venta ---
  const handleAprobarCotizacion = async () => {
    if (!window.confirm('¿Estás seguro de que quieres APROBAR esta cotización y convertirla en VENTA? Esto afectará el stock de los productos.')) {
      return;
    }

    setSaving(true);
    setError(null);

    // Asegurarse de que la cotización tiene ítems antes de aprobar
    if (itemsCotizacion.length === 0) {
      setError('No se puede aprobar una cotización sin productos.');
      setSaving(false);
      return;
    }

    const clienteAprobacion = clientes.find(c => c.id === cotizacionPrincipalData.clienteId);
    if (!clienteAprobacion) {
      setError('Cliente no encontrado para la cotización. No se puede aprobar.');
      setSaving(false);
      return;
    }

    // Calcular el total de la venta de la cotización
    const totalVentaFromCotizacion = itemsCotizacion.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0);

    try {
      await runTransaction(db, async (transaction) => {
        const cotizacionRef = doc(db, 'cotizaciones', id);
        const cotizacionSnap = await transaction.get(cotizacionRef);

        if (!cotizacionSnap.exists()) {
          throw new Error("La cotización no existe.");
        }

        const currentCotizacionData = cotizacionSnap.data();
        // Evitar que se apruebe una cotización que ya está aprobada o anulada
        if (currentCotizacionData.estado === 'aprobada') {
          throw new Error("Esta cotización ya ha sido aprobada.");
        }
        if (currentCotizacionData.estado === 'anulada') {
          throw new Error("Esta cotización ha sido anulada y no puede ser aprobada.");
        }

        // 1. Crear el documento de Venta
        const newVentaRef = doc(collection(db, 'ventas')); // Firestore generará el ID automáticamente
        transaction.set(newVentaRef, {
          numeroVenta: `VTA-${id.substring(0, 8).toUpperCase()}`, // Genera un número de venta basado en el ID de la cotización
          cotizacionId: id, // Referencia a la cotización original
          clienteId: currentCotizacionData.clienteId,
          clienteNombre: currentCotizacionData.clienteNombre,
          clienteDNI: currentCotizacionData.clienteDNI,
          totalVenta: parseFloat(totalVentaFromCotizacion.toFixed(2)),
          fechaVenta: serverTimestamp(),
          empleadoId: user.email || user.uid,
          observaciones: currentCotizacionData.observaciones || null,
          metodoPago: currentCotizacionData.metodoPago, // <-- Transferir método de pago de la cotización
          estado: 'completada', // Una cotización aprobada se convierte en venta completada
          tipoVenta: 'cotizacionAprobada', // <-- ¡NUEVO CAMPO! Tipo de venta
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // 2. Mover los ítems a la subcolección `itemsVenta` y actualizar stock
        const itemsCotizacionCollectionRef = collection(db, 'cotizaciones', id, 'itemsCotizacion');
        const itemsCotizacionSnapshot = await getDocs(itemsCotizacionCollectionRef); // Obtener los ítems actualizados de la cotización

        if (itemsCotizacionSnapshot.empty) {
          throw new Error("No se encontraron productos en esta cotización para aprobar.");
        }

        for (const itemDoc of itemsCotizacionSnapshot.docs) {
          const itemData = itemDoc.data();
          const productoRef = doc(db, 'productos', itemData.productoId);
          const productoSnap = await transaction.get(productoRef);

          if (!productoSnap.exists()) {
            throw new Error(`El producto "${itemData.nombreProducto}" (ID: ${itemData.productoId}) no se encontró en el inventario. No se puede completar la venta.`);
          }

          const currentStock = typeof productoSnap.data().stockActual === 'number' ? productoSnap.data().stockActual : 0;
          const cantidadVendida = typeof itemData.cantidad === 'number' ? itemData.cantidad : 0;
          const newStock = currentStock - cantidadVendida;

          if (newStock < 0) {
            throw new Error(`Stock insuficiente para el producto "${itemData.nombreProducto}". Stock actual: ${currentStock}, Cantidad solicitada: ${cantidadVendida}.`);
          }

          // Actualizar stock del producto
          transaction.update(productoRef, {
            stockActual: newStock,
            updatedAt: serverTimestamp(),
          });

          // Añadir el ítem a la subcolección 'itemsVenta'
          transaction.set(doc(collection(newVentaRef, 'itemsVenta')), {
            productoId: itemData.productoId,
            nombreProducto: itemData.nombreProducto,
            cantidad: cantidadVendida,
            precioVentaUnitario: parseFloat(itemData.precioVentaUnitario), // Precio unitario de la cotización
            subtotal: parseFloat(itemData.subtotal),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        // 3. Actualizar el estado de la cotización a 'aprobada'
        transaction.update(cotizacionRef, {
          estado: 'aprobada',
          updatedAt: serverTimestamp(),
          idVentaGenerada: newVentaRef.id, // Opcional: para referencia rápida a la venta generada
        });
      });

      alert('Cotización aprobada y convertida en venta con éxito.');
      router.push(`/ventas`); // Redirigir a la vista de ventas
    } catch (err) {
      console.error("Error al aprobar cotización:", err);
      setError("Error al aprobar la cotización y convertirla en venta: " + err.message);
      alert('Hubo un error al aprobar la cotización: ' + err.message);
    } finally {
      setSaving(false);
    }
  };


  const totalGeneralCotizacion = itemsCotizacion.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0).toFixed(2);

  if (!router.isReady || !user || loadingData) {
    return (
      <Layout title={isEditing ? "Cargando Cotización" : "Cargando Formulario de Cotización"}>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={isEditing ? `Editar Cotización #${id}` : "Crear Nueva Cotización"}>
      <div className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-lg">

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">{isEditing ? `Editar Cotización #${id}` : "Crear Nueva Cotización"}</h2>
          <button
            onClick={() => router.push('/cotizaciones')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <ArrowLeftIcon className="-ml-1 mr-2 h-5 w-5 text-gray-500" aria-hidden="true" />
            Volver a Cotizaciones
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
            <span className="block sm:inline font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Top section: Numero de Cotización, Cliente, Validez, Metodo de Pago, Estado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="numeroCotizacion" className="block text-sm font-medium text-gray-700 mb-1">Número de Cotización (Opcional)</label>
              <input
                type="text"
                name="numeroCotizacion"
                id="numeroCotizacion"
                value={cotizacionPrincipalData.numeroCotizacion}
                onChange={handleCotizacionPrincipalChange}
                className="block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base placeholder-gray-400"
                placeholder="Ej: C-00001"
              />
            </div>
            <div>
              <label htmlFor="clienteId" className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
              <select
                id="clienteId"
                name="clienteId"
                value={cotizacionPrincipalData.clienteId}
                onChange={handleCotizacionPrincipalChange}
                required
                className="block w-full pl-4 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-lg shadow-sm bg-white"
              >
                <option value="">Seleccione un cliente</option>
                {clientes.map((cli) => (
                  cli.id && (
                    <option key={cli.id} value={cli.id}>
                      {cli.nombre} {cli.apellido} ({cli.dni || cli.numeroDocumento || 'N/A'})
                    </option>
                  )
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="validezDias" className="block text-sm font-medium text-gray-700 mb-1">Validez (Días)</label>
              <input
                type="number"
                name="validezDias"
                id="validezDias"
                value={cotizacionPrincipalData.validezDias}
                onChange={handleCotizacionPrincipalChange}
                min="1"
                required
                className="block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base placeholder-gray-400"
              />
            </div>
            <div>
              <label htmlFor="metodoPago" className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
              <select
                id="metodoPago"
                name="metodoPago"
                value={cotizacionPrincipalData.metodoPago}
                onChange={handleCotizacionPrincipalChange}
                required
                className="block w-full pl-4 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-purple-500 focus:border-purple-500 rounded-lg shadow-sm bg-white"
              >
                <option value="efectivo">EFECTIVO</option>
                <option value="tarjeta">TARJETA</option>
                <option value="yape">YAPE</option>
                <option value="plin">PLIN</option>
                <option value="otro">OTRO</option>
              </select>
            </div>
            {isEditing && ( // Mostrar estado solo en modo edición
              <div>
                <label htmlFor="estado" className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select
                  id="estado"
                  name="estado"
                  value={cotizacionPrincipalData.estado}
                  onChange={handleCotizacionPrincipalChange}
                  className="block w-full pl-4 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-lg shadow-sm bg-white"
                  // Deshabilitar la edición del estado si ya está aprobada o anulada
                  disabled={cotizacionPrincipalData.estado === 'aprobada' || cotizacionPrincipalData.estado === 'anulada'}
                >
                  <option value="pendiente">Pendiente</option>
                  {cotizacionPrincipalData.estado === 'aprobada' && <option value="aprobada">Aprobada</option>}
                  {cotizacionPrincipalData.estado === 'anulada' && <option value="anulada">Anulada</option>}
                  {/* Permitir cambiar a "aceptada" o "rechazada" si no está ya aprobada/anulada */}
                  {cotizacionPrincipalData.estado !== 'aprobada' && cotizacionPrincipalData.estado !== 'anulada' && (
                    <>
                      <option value="aceptada">Aceptada (Manual)</option>
                      <option value="rechazada">Rechazada</option>
                      <option value="caducada">Caducada</option>
                    </>
                  )}
                </select>
              </div>
            )}
          </div>

          {/* Product Search and Add Button */}
          <div className="relative flex items-center space-x-3 mt-8" ref={searchResultRef}>
            <div className="relative flex-grow">
              <input
                type="text"
                value={currentSearchTerm}
                onChange={handleProductSearchChange}
                onFocus={() => {
                  if (currentSearchTerm.length > 1 && currentSearchResults.length > 0) {
                    setShowCurrentSearchResults(true);
                  }
                }}
                className="block w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base placeholder-gray-400 shadow-sm"
                placeholder="Buscar producto por nombre o código..."
                autoComplete="off"
                disabled={cotizacionPrincipalData.estado === 'aprobada' || cotizacionPrincipalData.estado === 'anulada'} // Deshabilitar si aprobada/anulada
              />
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
              </div>
            </div>
            <button
              type="button"
              onClick={addProductToItems}
              className="p-2.5 rounded-lg shadow-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              title="Añadir producto a la lista"
              disabled={!selectedProductToAdd || cotizacionPrincipalData.estado === 'aprobada' || cotizacionPrincipalData.estado === 'anulada'}
            >
              <PlusIcon className="h-6 w-6" aria-hidden="true" />
            </button>

            {showCurrentSearchResults && currentSearchResults.length > 0 && (
              <ul className="absolute top-full z-10 mt-2 w-full bg-white shadow-xl max-h-60 rounded-lg py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                {currentSearchResults.map((product) => (
                  <li
                    key={product.id}
                    className="cursor-pointer select-none relative py-2 px-4 hover:bg-blue-50 text-gray-900"
                    onClick={() => handleProductSelectFromSearch(product)}
                  >
                    <span className="font-medium block truncate">
                      {product.nombre} <span className="text-gray-500">({product.codigoTienda})</span>
                    </span>
                    <span className="text-sm text-gray-500">Stock: {product.stockActual || 0}</span>
                  </li>
                ))}
              </ul>
            )}
            {showCurrentSearchResults && currentSearchTerm.length > 1 && currentSearchResults.length === 0 && (
              <div className="absolute top-full z-10 mt-2 w-full bg-white shadow-lg rounded-lg py-3 px-4 text-sm text-gray-500">
                No se encontraron productos.
              </div>
            )}
          </div>

          {/* Table for Products in this Cotización */}
          <div className="overflow-hidden shadow-lg ring-1 ring-black ring-opacity-5 rounded-lg mt-8">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-6 pr-3 text-left text-sm font-semibold text-gray-700">Nombre Producto</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-700 w-32">Cantidad</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-700 w-36">Precio Venta</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-700 w-32">Subtotal</th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-6">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {itemsCotizacion.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-6 text-base text-gray-500">
                      Utilice el buscador para añadir productos a esta cotización.
                    </td>
                  </tr>
                ) : (
                  itemsCotizacion.map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="py-4 pl-6 pr-3 text-sm font-medium text-gray-900">
                        {item.nombreProducto}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500">
                        <input
                          type="number"
                          name="cantidad"
                          value={item.cantidad}
                          onChange={(e) => handleItemChange(index, e)}
                          required
                          min="0"
                          className="w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm text-center"
                          placeholder="0"
                          disabled={cotizacionPrincipalData.estado === 'aprobada' || cotizacionPrincipalData.estado === 'anulada'}
                        />
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500">
                        <input
                          type="number"
                          name="precioVentaUnitario"
                          value={item.precioVentaUnitario}
                          onChange={(e) => handleItemChange(index, e)}
                          required
                          min="0"
                          step="0.01"
                          className="w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm text-right"
                          placeholder="0.00"
                          disabled={cotizacionPrincipalData.estado === 'aprobada' || cotizacionPrincipalData.estado === 'anulada'}
                        />
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-800 font-semibold">
                        S/. {parseFloat(item.subtotal).toFixed(2)}
                      </td>
                      <td className="relative py-4 pl-3 pr-6 text-right text-sm font-medium">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50 transition duration-150 ease-in-out"
                          title="Eliminar este producto"
                          disabled={cotizacionPrincipalData.estado === 'aprobada' || cotizacionPrincipalData.estado === 'anulada'}
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Observaciones */}
          <div className="mt-8">
            <label htmlFor="observaciones" className="block text-sm font-medium text-gray-700 mb-1">Observaciones (Opcional)</label>
            <textarea
              id="observaciones"
              name="observaciones"
              rows="3"
              value={cotizacionPrincipalData.observaciones}
              onChange={handleCotizacionPrincipalChange}
              className="block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base placeholder-gray-400"
              placeholder="Notas adicionales sobre esta cotización..."
              disabled={cotizacionPrincipalData.estado === 'aprobada' || cotizacionPrincipalData.estado === 'anulada'}
            ></textarea>
          </div>

          {/* Total and Save Button */}
          <div className="flex justify-between items-center mt-8 pt-4 border-t border-gray-200">
            <span className="text-xl font-bold text-gray-800">Total:</span>
            <span className="text-2xl font-extrabold text-blue-700">S/. {totalGeneralCotizacion}</span>
          </div>

          <div className="flex justify-center mt-8 space-x-4">
            <button
              type="submit"
              className={`inline-flex items-center px-8 py-3 border border-transparent text-lg font-semibold rounded-lg shadow-lg text-white ${isEditing ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'} focus:outline-none focus:ring-2 focus:ring-offset-2 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed`}
              disabled={saving || itemsCotizacion.length === 0 || !cotizacionPrincipalData.clienteId || cotizacionPrincipalData.estado === 'aprobada' || cotizacionPrincipalData.estado === 'anulada'}
            >
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isEditing ? 'Guardando Cambios...' : 'Registrando Cotización...'}
                </>
              ) : (
                <>
                  <DocumentTextIcon className="-ml-1 mr-3 h-6 w-6" aria-hidden="true" />
                  {isEditing ? 'Actualizar Cotización' : 'Guardar Cotización'}
                </>
              )}
            </button>

            {isEditing && cotizacionPrincipalData.estado !== 'aprobada' && cotizacionPrincipalData.estado !== 'anulada' && (
              <button
                type="button"
                onClick={handleAprobarCotizacion}
                className="inline-flex items-center px-6 py-3 border border-transparent text-lg font-semibold rounded-lg shadow-lg text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={saving || itemsCotizacion.length === 0 || !cotizacionPrincipalData.clienteId}
              >
                {saving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Aprobando...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="-ml-1 mr-3 h-6 w-6" aria-hidden="true" />
                    Aprobar y Convertir en Venta
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default CotizacionFormPage;