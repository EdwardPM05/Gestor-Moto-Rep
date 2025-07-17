// pages/inventario/salidas/nueva.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../../contexts/AuthContext';
import Layout from '../../../components/Layout';
import { db } from '../../../lib/firebase';
import {
  collection,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  getDoc,
  where,
  runTransaction
} from 'firebase/firestore';
import { MinusIcon, PlusIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

const NuevaSalidaPage = () => {
  const router = useRouter();
  const { user } = useAuth();

  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]); // Todos los productos cargados
  const [clientes, setClientes] = useState([]);

  // Estado para la Salida Principal
  const [salidaPrincipalData, setSalidaPrincipalData] = useState({
    clienteId: '', // Este será 'cliente-no-registrado' si se selecciona
    observaciones: '',
    tipoSalida: 'venta',
    metodoPago: 'efectivo',
    esCotizacion: false, // Por defecto, NO es una cotización
  });

  // Estado para los ítems de Salida (productos a extraer)
  const [itemsSalida, setItemsSalida] = useState([
    {
      productoId: '',
      nombreProducto: '',
      cantidadARetirar: '',
      precioVentaUnitario: '',
      lotesDisponibles: [], // Lotes de ingreso cargados para este producto
      lotesSeleccionados: [], // Lotes específicos de los que se extraerá stock
      subtotalVenta: '',
      subtotalCosto: '',
      searchTerm: '', // Término de búsqueda para el buscador de productos
      searchResults: [], // Resultados de búsqueda para el buscador de productos
      showSearchResults: false, // Controla la visibilidad de los resultados del buscador
    }
  ]);

  // Referencias para cerrar el buscador de productos al hacer clic fuera
  const searchInputRefs = useRef([]);

  // Cargar productos y clientes al inicio
  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        router.push('/auth');
        return;
      }
      setLoadingData(true);
      try {
        const qProducts = query(collection(db, 'productos'), orderBy('nombre', 'asc'));
        const productSnapshot = await getDocs(qProducts);
        const productsList = productSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProducts(productsList);

        const qClientes = query(collection(db, 'cliente'), orderBy('nombre', 'asc'));
        const clienteSnapshot = await getDocs(qClientes);
        const clientesList = clienteSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setClientes(clientesList);

      } catch (err) {
        console.error("Error al cargar datos necesarios:", err);
        setError("Error al cargar datos necesarios. " + err.message);
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [user, router]);


  // Debounce para la búsqueda de productos - inicialización de refs
  // Esto asegura que cada campo de búsqueda tenga su propio timer para el debounce.
  const debouncedFilterProducts = useRef({});
  useEffect(() => {
      itemsSalida.forEach((_, index) => {
          if (!debouncedFilterProducts.current[index]) {
            debouncedFilterProducts.current[index] = setTimeout(() => {}, 0); // Inicializar si no existe
          }
      });
  }, [itemsSalida.length]);


  // Función para filtrar productos mientras se escribe (debounce para rendimiento)
  const filterProducts = useCallback((term, index) => {
    const newItems = [...itemsSalida];
    newItems[index].searchTerm = term;
    newItems[index].showSearchResults = true;

    if (term.length > 1) { // Empieza a buscar después de 1 carácter
      const lowerCaseTerm = term.toLowerCase();
      const results = products.filter(p =>
        p.nombre.toLowerCase().includes(lowerCaseTerm) ||
        (p.codigoTienda && p.codigoTienda.toLowerCase().includes(lowerCaseTerm))
      ).slice(0, 10); // Limita a 10 resultados para no sobrecargar
      newItems[index].searchResults = results;
    } else {
      newItems[index].searchResults = [];
    }
    setItemsSalida(newItems);
  }, [products, itemsSalida]); // itemsSalida es una dependencia porque la función opera sobre una copia del estado


  // Manejador de cambios para los datos de la Salida Principal (cliente, tipoSalida, etc.)
  const handleSalidaPrincipalChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSalidaPrincipalData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Manejador de cambios para los campos de cada ítem de producto (cantidad, precio)
  const handleItemChange = (index, e) => {
    const { name, value } = e.target;
    const newItems = [...itemsSalida];
    newItems[index][name] = value;

    if (name === 'cantidadARetirar' || name === 'precioVentaUnitario') {
      const cantidad = parseFloat(newItems[index].cantidadARetirar || 0);
      const precioVenta = parseFloat(newItems[index].precioVentaUnitario || 0);
      newItems[index].subtotalVenta = (cantidad * precioVenta).toFixed(2);
    }
    setItemsSalida(newItems);
  };


  // Función que se ejecuta cuando se selecciona un producto del buscador
  const handleProductSelect = async (index, selectedProductData) => {
    const selectedProductId = selectedProductData.id;
    const newItems = [...itemsSalida];

    newItems[index].productoId = selectedProductId;
    newItems[index].nombreProducto = selectedProductData.nombre;
    newItems[index].precioVentaUnitario = selectedProductData.precioVenta || ''; // Autocompletar precio de venta
    newItems[index].searchTerm = selectedProductData.nombre; // Llenar el input con el nombre
    newItems[index].searchResults = [];
    newItems[index].showSearchResults = false; // Ocultar resultados

    if (selectedProductId) {
      const loadedLotes = [];
      try {
        // Obtenemos todos los documentos de ingresos para buscar los ítems de ingreso
        const allIngresosRefs = collection(db, 'ingresos');
        const querySnapshotIngresos = await getDocs(allIngresosRefs);

        for (const docIngreso of querySnapshotIngresos.docs) {
          const itemsIngresoCollectionRef = collection(db, 'ingresos', docIngreso.id, 'itemsIngreso');
          const qItemsIngreso = query(
            itemsIngresoCollectionRef,
            where('productoId', '==', selectedProductId),
            where('stockRestanteLote', '>', 0),
            orderBy('createdAt', 'asc') // Ordenar por fecha de creación del item de ingreso (FIFO)
          );
          const querySnapshotItemsIngreso = await getDocs(qItemsIngreso);

          querySnapshotItemsIngreso.docs.forEach(docItem => {
            loadedLotes.push({
              id: docItem.id, // ID del itemIngreso
              lotePrincipalId: docIngreso.id, // ID del Ingreso principal
              fechaIngreso: docIngreso.data().fechaIngreso?.toDate() || new Date(0), // Usar Date para ordenar
              loteInterno: docItem.data().lote || 'N/A', // Campo lote en el itemIngreso
              stockRestante: docItem.data().stockRestanteLote,
              precioCompraUnitario: docItem.data().precioCompraUnitario,
            });
          });
        }
        // Ordenar por fecha real para asegurar FIFO (First-In, First-Out)
        loadedLotes.sort((a, b) => a.fechaIngreso.getTime() - b.fechaIngreso.getTime());

        newItems[index].lotesDisponibles = loadedLotes;
        newItems[index].lotesSeleccionados = [];
        newItems[index].cantidadARetirar = ''; // Resetear cantidad al cambiar de producto

      } catch (err) {
        console.error("Error al cargar lotes para el producto:", err);
        setError("Error al cargar lotes para el producto. " + err.message);
        newItems[index].lotesDisponibles = [];
      }
    } else {
      newItems[index].lotesDisponibles = [];
      newItems[index].lotesSeleccionados = [];
      newItems[index].cantidadARetirar = '';
    }
    setItemsSalida(newItems);
  };

  // Función para asignar lotes automáticamente usando la estrategia FIFO
  const assignLotesAutomatically = useCallback((itemIndex, requestedQuantity) => {
    const newItems = [...itemsSalida];
    const item = newItems[itemIndex];
    item.lotesSeleccionados = []; // Reiniciar lotes seleccionados
    let remainingQuantityToAssign = parseFloat(requestedQuantity || 0);
    let totalCostoCalculado = 0;
    let currentError = null;

    if (!item.productoId || remainingQuantityToAssign <= 0) {
        item.subtotalCosto = 0;
        setItemsSalida(newItems);
        return;
    }

    const sortedLotes = [...item.lotesDisponibles].sort((a, b) => a.fechaIngreso.getTime() - b.fechaIngreso.getTime()); // FIFO

    for (const lote of sortedLotes) {
      if (remainingQuantityToAssign <= 0) break;

      const qtyFromThisLote = Math.min(remainingQuantityToAssign, lote.stockRestante);
      if (qtyFromThisLote > 0) {
        item.lotesSeleccionados.push({
          loteDocId: lote.id, // ID del itemIngreso
          lotePrincipalId: lote.lotePrincipalId, // ID del ingreso principal
          qty: qtyFromThisLote,
          precioCompraUnitario: lote.precioCompraUnitario,
        });
        remainingQuantityToAssign -= qtyFromThisLote;
        totalCostoCalculado += qtyFromThisLote * lote.precioCompraUnitario;
      }
    }

    // Si aún queda cantidad por asignar, significa que no hay suficiente stock en los lotes
    if (remainingQuantityToAssign > 0) {
      currentError = `No hay suficiente stock en los lotes disponibles para cubrir la cantidad solicitada del producto "${item.nombreProducto}". Faltan ${remainingQuantityToAssign} unidades.`;
    }

    item.subtotalCosto = totalCostoCalculado.toFixed(2);
    setItemsSalida(newItems);
    // Solo actualiza el error global si hay un problema con este ítem o si el error anterior era de stock y ya no lo es
    if (currentError) {
        setError(currentError);
    } else if (error && error.includes("No hay suficiente stock")) { // Si no hay error o el error era de stock, limpiar
        setError(null);
    }
  }, [itemsSalida, error]); // `itemsSalida` y `error` como dependencia para que useCallback tenga acceso al estado más reciente


  // Trigger la asignación automática cuando la cantidad a retirar cambia (con debounce)
  useEffect(() => {
    itemsSalida.forEach((item, index) => {
      // Solo si hay un producto seleccionado y una cantidad válida
      if (item.productoId && parseFloat(item.cantidadARetirar) > 0) {
        // Limpia cualquier debounce anterior para este índice
        clearTimeout(debouncedFilterProducts.current[index]);
        debouncedFilterProducts.current[index] = setTimeout(() => {
          assignLotesAutomatically(index, item.cantidadARetirar);
        }, 300); // 300ms de debounce
      } else {
         // Si la cantidad es 0 o vacía, resetear lotes seleccionados y costo
         const newItems = [...itemsSalida];
         if (newItems[index]) {
             newItems[index].lotesSeleccionados = [];
             newItems[index].subtotalCosto = '0.00';
             setItemsSalida(newItems);
         }
      }
    });
  }, [itemsSalida.map(item => `${item.productoId}-${item.cantidadARetirar}`).join(','), assignLotesAutomatically]); // Dependencia más precisa para activar el efecto


  // Función para añadir un nuevo ítem de producto al formulario
  const addItem = () => {
    setItemsSalida([...itemsSalida, {
      productoId: '', nombreProducto: '', cantidadARetirar: '', precioVentaUnitario: '',
      lotesDisponibles: [], lotesSeleccionados: [], subtotalVenta: '', subtotalCosto: '',
      searchTerm: '', searchResults: [], showSearchResults: false
    }]);
  };

  // Función para eliminar un ítem de producto del formulario
  const removeItem = (index) => {
    if (itemsSalida.length > 1) { // Asegura que siempre haya al menos un ítem
      const newItems = itemsSalida.filter((_, i) => i !== index);
      setItemsSalida(newItems);
      setError(null); // Limpiar cualquier error específico de ese ítem si se elimina
    } else {
      setError("Debe haber al menos un producto en la salida.");
    }
  };

  // Manejar clics fuera del buscador de productos para ocultar resultados
  useEffect(() => {
    const handleClickOutside = (event) => {
      itemsSalida.forEach((item, index) => {
        if (item.showSearchResults && searchInputRefs.current[index] && !searchInputRefs.current[index].contains(event.target)) {
          const newItems = [...itemsSalida];
          newItems[index].showSearchResults = false;
          setItemsSalida(newItems);
        }
      });
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [itemsSalida]);


  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // --- Validaciones Preliminares (antes de la transacción) ---
    // Si es 'venta' y clienteId está vacío, lanzamos un error pidiendo un cliente
    // o que elija la opción "Cliente de la Calle"
    if (salidaPrincipalData.tipoSalida === 'venta' && !salidaPrincipalData.clienteId) {
      setError('Para una salida de tipo "Venta", debe seleccionar un cliente o la opción "Cliente de la Calle".');
      setSaving(false);
      return;
    }

    if (itemsSalida.length === 0) {
      setError('Debe añadir al menos un producto a la salida.');
      setSaving(false);
      return;
    }

    // Validar cada ítem antes de la transacción (especialmente la cantidad y precios)
    for (const item of itemsSalida) {
      if (!item.productoId) {
        setError('Por favor, seleccione un producto para todos los ítems.');
        setSaving(false);
        return;
      }
      const requestedQty = parseFloat(item.cantidadARetirar);
      if (isNaN(requestedQty) || requestedQty <= 0) {
        setError(`La cantidad a retirar para el producto "${item.nombreProducto}" debe ser un número positivo.`);
        setSaving(false);
        return;
      }
      if (parseFloat(item.precioVentaUnitario) <= 0) {
        setError(`El precio de venta unitario para el producto "${item.nombreProducto}" debe ser mayor a cero.`);
        setSaving(false);
        return;
      }
      // Validar asignación de lotes solo si NO es una cotización
      if (!salidaPrincipalData.esCotizacion) {
          if (item.lotesSeleccionados.length === 0) {
            setError(`No se pudieron asignar lotes para el producto "${item.nombreProducto}". Asegúrese de que haya stock disponible.`);
            setSaving(false);
            return;
          }
          const assignedQty = item.lotesSeleccionados.reduce((sum, lot) => sum + lot.qty, 0);
          if (assignedQty !== requestedQty) {
            setError(`La cantidad asignada de lotes (${assignedQty}) no coincide con la cantidad a retirar (${requestedQty}) para el producto "${item.nombreProducto}". Por favor, verifique el stock disponible.`);
            setSaving(false);
            return;
          }
      }
    }

    let totalVentaCalculado = 0;
    let totalCostoCalculado = 0;

    itemsSalida.forEach(item => {
      totalVentaCalculado += parseFloat(item.subtotalVenta || 0);
      totalCostoCalculado += parseFloat(item.subtotalCosto || 0);
    });

    try {
      await runTransaction(db, async (transaction) => {
        // --- FASE 1: TODAS LAS LECTURAS ---
        // Obtener referencias y datos actuales de todos los productos y lotes que se modificarán.
        const productRefs = {};
        const productSnaps = {};
        const itemIngresoRefs = {};
        const itemIngresoSnaps = {};

        // Validar y leer productos y sus lotes de ingreso SI y SOLO SI NO es una cotización
        if (!salidaPrincipalData.esCotizacion) {
          console.log("Detectado: NO es una cotización. Leyendo stocks para descontar.");
          for (const item of itemsSalida) {
            // Leer y validar el stock del producto principal
            const productRef = doc(db, 'productos', item.productoId);
            productRefs[item.productoId] = productRef; // Guardar referencia para uso posterior
            productSnaps[item.productoId] = await transaction.get(productRef); // Leer el documento

            if (!productSnaps[item.productoId].exists()) {
              throw new Error(`Producto con ID ${item.productoId} no encontrado.`);
            }

            const currentStock = parseFloat(productSnaps[item.productoId].data().stockActual || 0);
            if (currentStock < parseFloat(item.cantidadARetirar)) {
              throw new Error(`Stock insuficiente para el producto "${item.nombreProducto}". Stock actual: ${currentStock}, intentando retirar: ${item.cantidadARetirar}.`);
            }

            // Leer y validar los lotes de ingreso específicos de los que se extraerá stock
            for (const loteSelected of item.lotesSeleccionados) {
              const itemIngresoRef = doc(db, 'ingresos', loteSelected.lotePrincipalId, 'itemsIngreso', loteSelected.loteDocId);
              itemIngresoRefs[loteSelected.loteDocId] = itemIngresoRef; // Guardar referencia
              itemIngresoSnaps[loteSelected.loteDocId] = await transaction.get(itemIngresoRef); // Leer el documento

              if (!itemIngresoSnaps[loteSelected.loteDocId].exists()) {
                throw new Error(`Lote de ingreso con ID ${loteSelected.loteDocId} no encontrado para el producto ${item.nombreProducto}.`);
              }
              const currentStockRestanteLote = parseFloat(itemIngresoSnaps[loteSelected.loteDocId].data().stockRestanteLote || 0);
              if (currentStockRestanteLote < loteSelected.qty) {
                throw new Error(`Stock restante insuficiente en el lote ${loteSelected.loteDocId} para el producto "${item.nombreProducto}".`);
              }
            }
          }
        } else {
            console.log("Detectado: Es una cotización. No se leerán stocks para descuento.");
        }


        // --- FASE 2: TODAS LAS ESCRITURAS ---
        console.log("Iniciando fase de escrituras de la transacción.");

        // 1. Crear el documento principal de la salida (siempre se crea)
        const salidaDocRef = doc(collection(db, 'salidas'));
        transaction.set(salidaDocRef, {
          clienteId: salidaPrincipalData.clienteId || null, // Guardará 'cliente-no-registrado' o el ID real
          observaciones: salidaPrincipalData.observaciones || null,
          tipoSalida: salidaPrincipalData.tipoSalida,
          metodoPago: salidaPrincipalData.metodoPago,
          esCotizacion: salidaPrincipalData.esCotizacion,
          totalVenta: parseFloat(totalVentaCalculado.toFixed(2)),
          totalCosto: parseFloat(totalCostoCalculado.toFixed(2)),
          fechaSalida: serverTimestamp(),
          empleadoId: user.email || user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        console.log("Documento principal de salida creado con ID: ", salidaDocRef.id);

        // 2. Crear los ítems de salida (siempre se crean, tanto para ventas como cotizaciones)
        for (const item of itemsSalida) {
          const itemSalidaDocRef = doc(collection(salidaDocRef, 'itemsSalida'));
          transaction.set(itemSalidaDocRef, {
            productoId: item.productoId,
            nombreProducto: item.nombreProducto,
            cantidad: parseFloat(item.cantidadARetirar),
            precioVentaUnitario: parseFloat(item.precioVentaUnitario),
            subtotalVenta: parseFloat(item.subtotalVenta),
            subtotalCosto: parseFloat(item.subtotalCosto),
            lotesExtraidos: item.lotesSeleccionados.map(l => ({
              loteDocId: l.loteDocId,
              qty: l.qty,
              precioCompraUnitario: l.precioCompraUnitario,
            })),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          console.log(`Item de salida "${item.nombreProducto}" creado para salida ID: ${salidaDocRef.id}`);

          // 3. Actualizar stock de productos y lotes (SOLO si NO es una cotización)
          if (!salidaPrincipalData.esCotizacion) {
            console.log(`Actualizando stock para producto "${item.nombreProducto}" (ID: ${item.productoId})`);
            const productSnap = productSnaps[item.productoId]; // Usar el snapshot leído previamente en la Fase 1
            const currentStock = parseFloat(productSnap.data().stockActual || 0);
            const newStock = currentStock - parseFloat(item.cantidadARetirar);

            transaction.update(productRefs[item.productoId], { // Usar la referencia guardada
              stockActual: newStock,
              updatedAt: serverTimestamp(),
            });
            console.log(`Stock de "${item.nombreProducto}" actualizado a ${newStock}`);

            for (const loteSelected of item.lotesSeleccionados) {
              console.log(`Actualizando stock de lote "${loteSelected.loteDocId}" para producto "${item.nombreProducto}"`);
              const itemIngresoSnap = itemIngresoSnaps[loteSelected.loteDocId]; // Usar el snapshot leído previamente
              const currentStockRestanteLote = parseFloat(itemIngresoSnap.data().stockRestanteLote || 0);
              const newStockRestanteLote = currentStockRestanteLote - loteSelected.qty;

              transaction.update(itemIngresoRefs[loteSelected.loteDocId], { // Usar la referencia guardada
                stockRestanteLote: newStockRestanteLote,
                updatedAt: serverTimestamp(),
              });
              console.log(`Stock restante del lote "${loteSelected.loteDocId}" actualizado a ${newStockRestanteLote}`);
            }
          } else {
            console.log(`Es una cotización, por lo tanto, NO se actualiza el stock para "${item.nombreProducto}".`);
          }
        }
      });

      alert('Salida registrada con éxito.');
      router.push('/inventario/salidas');
    } catch (err) {
      console.error("Error al registrar salida o actualizar stock:", err);
      setError("Error al registrar la salida: " + err.message);
      if (err.code === 'permission-denied') {
        setError('No tiene permisos para realizar esta acción. Contacte al administrador.');
      }
    } finally {
      setSaving(false);
    }
  };


  if (!user || loadingData) {
    return (
      <Layout title="Cargando Formulario de Salida">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Registrar Nueva Salida">
      <div className="max-w-4xl mx-auto p-4 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-gray-800 flex items-center">
          <MinusIcon className="h-7 w-7 text-red-500 mr-2" />
          Registrar Nueva Salida
        </h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Datos de la Salida Principal */}
          <div className="bg-red-50 p-4 rounded-md border border-red-200">
            <h2 className="text-lg font-semibold text-red-800 mb-4">Detalles de la Salida</h2>
            <div>
              <label htmlFor="tipoSalida" className="block text-sm font-medium text-gray-700">Tipo de Salida</label>
              <select
                id="tipoSalida"
                name="tipoSalida"
                value={salidaPrincipalData.tipoSalida}
                onChange={handleSalidaPrincipalChange}
                required
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm rounded-md"
              >
                <option value="venta">Venta</option>
                <option value="consumoInterno">Consumo Interno</option>
                <option value="desperdicio">Desperdicio</option>
              </select>
            </div>
            {salidaPrincipalData.tipoSalida === 'venta' && (
              <div className="mt-4">
                <label htmlFor="clienteId" className="block text-sm font-medium text-gray-700">Cliente</label>
                <select
                  id="clienteId"
                  name="clienteId"
                  value={salidaPrincipalData.clienteId}
                  onChange={handleSalidaPrincipalChange}
                  // No se usa 'required' aquí en HTML, la validación se hace en JS
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm rounded-md"
                >
                  <option value="">Seleccione un cliente registrado...</option>
                  <option value="cliente-no-registrado">Cliente de la Calle / No registrado</option> {/* Nueva opción para cliente no registrado */}
                  {clientes.map((cli) => (
                    // Excluir el cliente 'cliente-no-registrado' de la lista si ya se cargó,
                    // para evitar duplicidad y asegurar que solo aparezca una vez explícitamente.
                    cli.id !== 'cliente-no-registrado' && (
                      <option key={cli.id} value={cli.id}>
                        {cli.nombre} {cli.apellido} ({cli.dni})
                      </option>
                    )
                  ))}
                </select>
              </div>
            )}
            <div className="mt-4">
              <label htmlFor="metodoPago" className="block text-sm font-medium text-gray-700">Método de Pago</label>
              <select
                id="metodoPago"
                name="metodoPago"
                value={salidaPrincipalData.metodoPago}
                onChange={handleSalidaPrincipalChange}
                required
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm rounded-md"
              >
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="credito">Crédito</option>
              </select>
            </div>
            <div className="mt-4 flex items-center">
              <input
                id="esCotizacion"
                name="esCotizacion"
                type="checkbox"
                checked={salidaPrincipalData.esCotizacion}
                onChange={handleSalidaPrincipalChange}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
              />
              <label htmlFor="esCotizacion" className="ml-2 block text-sm text-gray-900">
                Es una Cotización (no afecta stock)
              </label>
            </div>
            <div className="mt-4">
              <label htmlFor="observaciones" className="block text-sm font-medium text-gray-700">Observaciones (Opcional)</label>
              <textarea
                name="observaciones"
                id="observaciones"
                value={salidaPrincipalData.observaciones}
                onChange={handleSalidaPrincipalChange}
                rows="3"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
              ></textarea>
            </div>
          </div>

          {/* Ítems de la Salida */}
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Productos a Retirar</h2>
          {itemsSalida.map((item, index) => (
            <div key={index} className="border border-gray-200 p-4 rounded-md space-y-4 relative">
              {itemsSalida.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="absolute top-2 right-2 text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-gray-100"
                  title="Eliminar este producto de la salida"
                >
                  <TrashIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              )}
              <h3 className="text-md font-medium text-gray-700">Producto #{index + 1}</h3>

              {/* BUSCADOR DE PRODUCTOS */}
              <div className="relative" ref={el => searchInputRefs.current[index] = el}>
                <label htmlFor={`searchTerm-${index}`} className="block text-sm font-medium text-gray-700">Buscar Producto</label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <input
                    type="text"
                    id={`searchTerm-${index}`}
                    name="searchTerm"
                    value={item.searchTerm}
                    onChange={(e) => {
                      const newItems = [...itemsSalida];
                      newItems[index].searchTerm = e.target.value;
                      newItems[index].productoId = ''; // Resetear el producto seleccionado al cambiar el texto
                      newItems[index].nombreProducto = '';
                      newItems[index].precioVentaUnitario = '';
                      newItems[index].lotesDisponibles = [];
                      newItems[index].lotesSeleccionados = [];
                      newItems[index].cantidadARetirar = '';
                      setItemsSalida(newItems);
                      clearTimeout(debouncedFilterProducts.current[index]);
                      debouncedFilterProducts.current[index] = setTimeout(() => {
                          filterProducts(e.target.value, index);
                      }, 300);
                    }}
                    onFocus={() => {
                        const newItems = [...itemsSalida];
                        newItems[index].showSearchResults = true;
                        setItemsSalida(newItems);
                    }}
                    placeholder="Escriba el nombre o código del producto..."
                    className="flex-1 block w-full rounded-none rounded-l-md border-gray-300 focus:ring-red-500 focus:border-red-500 sm:text-sm"
                  />
                  <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                    <MagnifyingGlassIcon className="h-5 w-5" />
                  </span>
                </div>

                {item.showSearchResults && item.searchResults.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                    {item.searchResults.map((productResult) => (
                      <li
                        key={productResult.id}
                        className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-red-50 hover:text-red-900"
                        onClick={() => handleProductSelect(index, productResult)}
                      >
                        <span className="font-normal block truncate">
                          {productResult.nombre} ({productResult.codigoTienda}) - Stock: {productResult.stockActual || 0}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {item.searchTerm.length > 1 && item.searchResults.length === 0 && item.showSearchResults && (
                    <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md py-2 px-3 text-sm text-gray-500">
                        No se encontraron productos.
                    </div>
                )}
              </div>
              {/* FIN BUSCADOR DE PRODUCTOS */}

              {item.productoId && ( // Mostrar el resto de campos si un producto ha sido seleccionado
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor={`cantidadARetirar-${index}`} className="block text-sm font-medium text-gray-700">Cantidad a Retirar</label>
                      <input
                        type="number"
                        name="cantidadARetirar"
                        id={`cantidadARetirar-${index}`}
                        value={item.cantidadARetirar}
                        onChange={(e) => handleItemChange(index, e)}
                        required
                        min="1"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                      />
                      {/* Advertencia visual si la cantidad excede el stock total */}
                      {item.productoId && products.find(p => p.id === item.productoId)?.stockActual < parseFloat(item.cantidadARetirar || 0) && (
                          <p className="mt-1 text-sm text-red-600">¡Advertencia! La cantidad a retirar ({item.cantidadARetirar}) excede el stock total del producto ({products.find(p => p.id === item.productoId)?.stockActual || 0}).</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor={`precioVentaUnitario-${index}`} className="block text-sm font-medium text-gray-700">Precio de Venta Unitario</label>
                      <input
                        type="number"
                        name="precioVentaUnitario"
                        id={`precioVentaUnitario-${index}`}
                        value={item.precioVentaUnitario}
                        onChange={(e) => handleItemChange(index, e)}
                        required
                        step="0.01"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                      />
                    </div>
                  </div>

                  {item.cantidadARetirar > 0 && (
                    <div className="border-t border-gray-200 pt-4 mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Lotes Seleccionados (Asignación Automática - FIFO):</h4>
                      {error && error.includes("No hay suficiente stock") && ( // Mostrar el error específico de stock aquí
                        <p className="text-red-500 text-sm mb-2">{error}</p>
                      )}
                      {item.lotesSeleccionados.length > 0 ? (
                        <ul className="list-disc list-inside text-sm text-gray-600">
                          {item.lotesSeleccionados.map((lote, idx) => (
                            <li key={idx}>
                              Lote Ingreso ID: **{lote.lotePrincipalId}** (Item: **{lote.loteDocId.substring(0, 5)}...**) - Cantidad: **{lote.qty}** unidades (Precio Compra: S/. {parseFloat(lote.precioCompraUnitario || 0).toFixed(2)})
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500">No hay lotes disponibles o no se ha asignado stock aún.</p>
                      )}
                    </div>
                  )}

                  <div className="text-right text-sm font-medium text-gray-700">
                    Subtotal Venta Ítem: S/. {parseFloat(item.subtotalVenta || 0).toFixed(2)} <br />
                    Costo Estimado Ítem: S/. {parseFloat(item.subtotalCosto || 0).toFixed(2)}
                  </div>
                </>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addItem}
            className="w-full flex items-center justify-center px-4 py-2 border border-dashed border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Añadir otro producto a la salida
          </button>

          <div className="flex justify-end space-x-4 mt-8">
            <button
              type="button"
              onClick={() => router.push('/inventario/salidas')}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              disabled={saving}
            >
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Registrando...
                </>
              ) : (
                <>
                  <MinusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                  Registrar Salida
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default NuevaSalidaPage;