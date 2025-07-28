import { useState, useEffect, useRef } from 'react';
import Layout from '../../components/Layout';
import { db, storage } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, runTransaction, serverTimestamp, orderBy } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/router';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  MinusIcon,
  XMarkIcon,
  ShoppingCartIcon,
  ReceiptPercentIcon
} from '@heroicons/react/24/outline';

const POSPage = () => {
  const { user } = useAuth();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const [cart, setCart] = useState([]);
  const [total, setTotal] = useState(0);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [observations, setObservations] = useState('');
  const [descuentoPorcentaje, setDescuentoPorcentaje] = useState(0);

  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    if (!user) {
      router.push('/auth');
      return;
    }
    const fetchClients = async () => {
      setLoadingClients(true);
      try {
        const clientsCollectionRef = collection(db, 'cliente');
        const qClients = query(clientsCollectionRef, orderBy('nombre', 'asc'));
        const querySnapshotClients = await getDocs(qClients);
        const loadedClients = querySnapshotClients.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setClients(loadedClients);
      } catch (err) {
        console.error("Error al cargar clientes:", err);
        setSearchError("Error al cargar la información de clientes. Intente de nuevo.");
      } finally {
        setLoadingClients(false);
      }
    };
    fetchClients();
  }, [user, router]);

  useEffect(() => {
    const calculateTotal = () => {
      let subTotal = cart.reduce((sum, item) => sum + item.precioVenta * item.cantidad, 0);
      const descuentoMonto = subTotal * (descuentoPorcentaje / 100);
      setTotal(subTotal - descuentoMonto);
    };
    calculateTotal();
  }, [cart, descuentoPorcentaje]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setSearchError(null);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.length > 2) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(value);
      }, 500);
    } else {
      setSearchResults([]);
    }
  };

  const performSearch = async (term) => {
    setLoadingSearch(true);
    setSearchResults([]);
    try {
      const productosRef = collection(db, 'productos');
      const lowerCaseTerm = term.toLowerCase(); // Término en minúsculas
      const capitalizedTerm = term.charAt(0).toUpperCase() + term.slice(1).toLowerCase(); // Término con primera letra mayúscula
      const upperCaseTerm = term.toUpperCase(); // Término en mayúsculas

      let productResults = new Map(); // Usaremos un Map para evitar duplicados por ID

      // 1. Búsqueda por código exacto (case-insensitive para el código si es string)
      if (term.match(/^[a-zA-Z0-9-]+$/)) {
        // Asumiendo que 'codigoTienda' podría ser case-sensitive en la DB,
        // intentamos buscar las variaciones más comunes.
        const codeQueries = [
          query(productosRef, where('codigoTienda', '==', term)),
          query(productosRef, where('codigoTienda', '==', lowerCaseTerm)),
          query(productosRef, where('codigoTienda', '==', upperCaseTerm))
        ];
        
        for (const q of codeQueries) {
          const codeQuerySnapshot = await getDocs(q);
          for (const docSnapshot of codeQuerySnapshot.docs) {
            if (!productResults.has(docSnapshot.id)) { // Solo añade si no está ya
              const productData = { id: docSnapshot.id, ...docSnapshot.data() };
              let imageUrl = null;
              if (productData.imageUrl) {
                try {
                  imageUrl = await getDownloadURL(ref(storage, productData.imageUrl));
                } catch (imgError) {
                  console.warn(`No se pudo obtener la URL de la imagen para ${productData.nombre}:`, imgError);
                  imageUrl = null;
                }
              }
              productResults.set(docSnapshot.id, { ...productData, imageUrl });
            }
          }
        }
        // Si ya encontramos resultados por código, podemos detener la búsqueda por nombre
        if (productResults.size > 0) {
            setSearchResults(Array.from(productResults.values()).sort((a, b) => a.nombre.localeCompare(b.nombre)));
            setLoadingSearch(false);
            return;
        }
      }

      // 2. Búsqueda por nombre (intentando varias capitalizaciones para aproximar case-insensitivity)
      const nameQueries = [
        query(productosRef, where('nombre', '>=', lowerCaseTerm), where('nombre', '<=', lowerCaseTerm + '\uf8ff'), orderBy('nombre', 'asc')),
        query(productosRef, where('nombre', '>=', capitalizedTerm), where('nombre', '<=', capitalizedTerm + '\uf8ff'), orderBy('nombre', 'asc')),
        query(productosRef, where('nombre', '>=', upperCaseTerm), where('nombre', '<=', upperCaseTerm + '\uf8ff'), orderBy('nombre', 'asc')),
      ];

      for (const q of nameQueries) {
        const querySnapshot = await getDocs(q);
        for (const docSnapshot of querySnapshot.docs) {
          if (!productResults.has(docSnapshot.id)) { // Solo añade si no está ya
            const productData = { id: docSnapshot.id, ...docSnapshot.data() };
            let imageUrl = null;
            if (productData.imageUrl) {
              try {
                imageUrl = await getDownloadURL(ref(storage, productData.imageUrl));
              } catch (imgError) {
                console.warn(`No se pudo obtener la URL de la imagen para ${productData.nombre}:`, imgError);
                imageUrl = null;
              }
            }
            productResults.set(docSnapshot.id, { ...productData, imageUrl });
          }
        }
      }

      // Convierte el Map de resultados a un array y ordena por nombre
      setSearchResults(Array.from(productResults.values()).sort((a, b) => a.nombre.localeCompare(b.nombre)));

    } catch (err) {
      console.error("Error al buscar productos:", err);
      setSearchError("Error al buscar productos. Intente de nuevo.");
    } finally {
      setLoadingSearch(false);
    }
  };

  const addToCart = (product) => {
    setCart(prevCart => {
      const existingItemIndex = prevCart.findIndex(item => item.id === product.id);
      const currentStock = typeof product.stockActual === 'number' ? product.stockActual : 0;

      if (existingItemIndex > -1) {
        const updatedCart = [...prevCart];
        const currentQuantityInCart = updatedCart[existingItemIndex].cantidad;

        if (currentQuantityInCart < currentStock) {
          updatedCart[existingItemIndex].cantidad += 1;
        } else {
          alert(`No hay suficiente stock para ${product.nombre}. Stock disponible: ${currentStock}`);
        }
        return updatedCart;
      } else {
        if (currentStock > 0) {
          const priceToUse = typeof product.precioVentaDefault === 'number'
            ? product.precioVentaDefault
            : (typeof product.venta === 'number' ? product.venta : (typeof product.costo === 'number' ? product.costo : 0));

          return [...prevCart, { ...product, cantidad: 1, precioVenta: priceToUse }];
        } else {
          alert(`El producto ${product.nombre} no tiene stock disponible.`);
          return prevCart;
        }
      }
    });
  };

  const updateCartQuantity = (productId, change) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.id === productId) {
          const newQuantity = item.cantidad + change;
          const currentStock = typeof item.stockActual === 'number' ? item.stockActual : 0;

          if (newQuantity > 0 && newQuantity <= currentStock) {
            return { ...item, cantidad: newQuantity };
          } else if (newQuantity <= 0) {
            return null;
          } else if (newQuantity > currentStock) {
            alert(`No hay suficiente stock para ${item.nombre}. Stock disponible: ${currentStock}`);
          }
        }
        return item;
      }).filter(Boolean);
    });
  };

  const removeItemFromCart = (productId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  };

  const handleClientChange = (e) => {
    const clientId = e.target.value;
    const client = clients.find(c => c.id === clientId);
    setSelectedClient(client);
  };

  const handleConfirmSale = async () => {
    if (cart.length === 0) {
      alert('El carrito está vacío. Agregue productos para realizar una venta.');
      return;
    }
    if (!selectedClient) {
      alert('Debe seleccionar un cliente para realizar la venta.');
      return;
    }

    if (!window.confirm('¿Estás seguro de que quieres CONFIRMAR esta venta?')) {
      return;
    }

    setLoadingSearch(true); // Usamos loadingSearch para indicar el estado de la transacción
    try {
      await runTransaction(db, async (transaction) => {
        const productRefs = {}; // Objeto para almacenar las referencias a los documentos de productos
        const productSnapshots = {}; // Objeto para almacenar los snapshots de los documentos leídos

        // --- FASE 1: TODAS LAS LECTURAS ---
        for (const item of cart) {
          const productoRef = doc(db, 'productos', item.id);
          productRefs[item.id] = productoRef; // Guardamos la referencia
          productSnapshots[item.id] = await transaction.get(productoRef); // Leemos el documento
        }

        // Ahora que todas las lecturas se han completado, podemos procesar los datos
        const productsToUpdate = []; // Array para almacenar los datos actualizados de los productos

        for (const item of cart) {
          const productoSnap = productSnapshots[item.id];

          if (!productoSnap.exists()) {
            throw new Error(`Producto con ID ${item.id} no encontrado. No se puede completar la venta.`);
          }

          const currentProductData = productoSnap.data();
          const currentStock = typeof currentProductData.stockActual === 'number' ? currentProductData.stockActual : 0;
          const cantidadVendida = typeof item.cantidad === 'number' ? item.cantidad : 0;

          if (currentStock < cantidadVendida) {
            throw new Error(`Stock insuficiente para el producto "${item.nombre}". Stock actual: ${currentStock}, Cantidad solicitada: ${cantidadVendida}.`);
          }

          const newStock = currentStock - cantidadVendida;
          productsToUpdate.push({
            id: item.id,
            ref: productRefs[item.id], // Usamos la referencia guardada
            newStock: newStock,
            itemData: item // Guardamos los datos del item del carrito para la venta
          });
        }

        // --- FASE 2: TODAS LAS ESCRITURAS ---

        // 1. Crear la venta principal
        const newVentaRef = doc(collection(db, 'ventas'));
        transaction.set(newVentaRef, {
          clienteId: selectedClient.id,
          clienteNombre: selectedClient.nombre + ' ' + (selectedClient.apellido || ''), // Asegúrate de manejar el apellido si existe
          clienteDNI: selectedClient.dni || 'N/A',
          totalVenta: total,
          fechaVenta: serverTimestamp(),
          empleadoId: user.email || user.uid,
          observaciones: observations,
          estado: 'completada',
          metodoPago: paymentMethod,
          tipoVenta: 'directa',
          descuentoPorcentaje: descuentoPorcentaje,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // 2. Actualizar el stock de los productos y añadir los items de la venta
        for (const product of productsToUpdate) {
          // Actualizar stock del producto
          transaction.update(product.ref, {
            stockActual: product.newStock,
            updatedAt: serverTimestamp(),
          });

          // Añadir item a la subcolección de la venta
          transaction.set(doc(collection(newVentaRef, 'itemsVenta')), {
            productoId: product.itemData.id,
            nombreProducto: product.itemData.nombre,
            cantidad: product.itemData.cantidad,
            precioVentaUnitario: product.itemData.precioVenta,
            subtotal: product.itemData.precioVenta * product.itemData.cantidad,
            createdAt: serverTimestamp(),
          });
        }
      });

      alert('Venta registrada con éxito. Stock actualizado.');
      setCart([]);
      setSearchTerm('');
      setSearchResults([]);
      setSelectedClient(null);
      setPaymentMethod('Efectivo');
      setObservations('');
      setDescuentoPorcentaje(0);
    } catch (err) {
      console.error("Error al confirmar venta:", err);
      alert('Hubo un error al confirmar la venta: ' + err.message);
    } finally {
      setLoadingSearch(false);
    }
  };

  return (
    <Layout title="Punto de Venta (POS)">
      <div className="flex flex-col md:flex-row mx-4 py-4 min-h-[calc(100vh-8rem)]">
        {/* Sección Izquierda: Buscador de Productos y Resultados */}
        <div className="md:w-3/5 w-full p-6 bg-white rounded-lg shadow-md mb-6 md:mb-0 md:mr-4 flex flex-col">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6 border-b pb-4">Productos</h2>

          {/* Buscador de Productos */}
          <div className="mb-4 relative">
            <input
              type="text"
              placeholder="Buscar producto por nombre o código..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base placeholder-gray-400"
              value={searchTerm}
              onChange={handleSearchChange}
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
          </div>

          {searchError && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg relative mb-4" role="alert">
              <span className="block sm:inline">{searchError}</span>
            </div>
          )}

          {loadingSearch ? (
            <div className="flex justify-center items-center h-48">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto flex-grow pr-2 h-[calc(100vh-250px)]">
              {searchResults.length === 0 && searchTerm.length > 2 ? (
                <p className="col-span-full text-center text-gray-500">No se encontraron productos para "{searchTerm}".</p>
              ) : searchResults.length === 0 && searchTerm.length <= 2 ? (
                <p className="col-span-full text-center text-gray-500">Escriba al menos 3 caracteres para buscar productos.</p>
              ) : null}
              {searchResults.map((product) => (
                <div 
                  key={product.id} 
                  className="border border-gray-200 rounded-lg shadow-sm p-4 flex flex-col items-center text-center hover:shadow-md transition-shadow duration-200 
                             min-h-[220px] max-h-[280px] overflow-hidden justify-between"
                >
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.nombre} className="w-24 h-24 object-contain mb-3 rounded-md border border-gray-200" />
                  ) : (
                    <div className="w-24 h-24 bg-gray-100 flex items-center justify-center rounded-md mb-3 text-gray-400 text-xs flex-shrink-0">
                      No hay imagen
                    </div>
                  )}
                  <h3 className="text-md font-semibold text-gray-800 line-clamp-2 mb-1 flex-shrink-0">{product.nombre}</h3>
                  <p className="text-sm text-gray-600 mb-1 flex-shrink-0">Stock: <span className={product.stockActual > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{product.stockActual}</span></p>
                  <p className="text-lg font-bold text-blue-600 mb-3 flex-shrink-0">S/. {parseFloat(product.precioVentaDefault || product.venta || product.costo || 0).toFixed(2)}</p>
                  <button
                    onClick={() => addToCart(product)}
                    className="flex items-center justify-center w-full px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    disabled={product.stockActual <= 0}
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Añadir al Carrito
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sección Derecha: Carrito de Compras y Detalles de Venta */}
        <div className="md:w-2/5 w-full p-6 bg-white rounded-lg shadow-md flex flex-col">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6 border-b pb-4 flex items-center">
            <ShoppingCartIcon className="h-7 w-7 mr-2 text-blue-600" />
            Carrito de Compras
          </h2>

          {/* Selector de Cliente */}
          <div className="mb-4">
            <label htmlFor="client-select" className="block text-sm font-medium text-gray-700 mb-1">Cliente:</label>
            {loadingClients ? (
              <p className="text-gray-500">Cargando clientes...</p>
            ) : (
              <select
                id="client-select"
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md shadow-sm"
                value={selectedClient?.id || ''}
                onChange={handleClientChange}
              >
                <option value="" disabled>Seleccione un cliente</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.nombre} {client.apellido} ({client.dni})</option>
                ))}
              </select>
            )}
            {selectedClient && (
              <p className="mt-2 text-sm text-gray-600">
                Seleccionado: <span className="font-medium">{selectedClient.nombre} {selectedClient.apellido}</span>
                {selectedClient.dni && ` (DNI: ${selectedClient.dni})`}
              </p>
            )}
          </div>

          {/* Productos en el Carrito */}
          <div className="flex-grow overflow-y-auto border border-gray-200 rounded-lg p-3 mb-4 bg-gray-50 max-h-[400px]">
            {cart.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <ShoppingCartIcon className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-2">El carrito está vacío.</p>
                <p className="text-sm text-gray-400">Busca y añade productos.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {cart.map(item => (
                  <li key={item.id} className="flex items-center justify-between border-b pb-3 last:border-b-0 last:pb-0">
                    <div className="flex-1 mr-3">
                      <p className="text-sm font-medium text-gray-900">{item.nombre}</p>
                      <p className="text-xs text-gray-500">S/. {parseFloat(item.precioVenta).toFixed(2)} c/u</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateCartQuantity(item.id, -1)}
                        className="p-1 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                        disabled={item.cantidad <= 1}
                      >
                        <MinusIcon className="h-4 w-4" />
                      </button>
                      <span className="text-sm font-medium text-gray-800 w-8 text-center">{item.cantidad}</span>
                      <button
                        onClick={() => updateCartQuantity(item.id, 1)}
                        className="p-1 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                        disabled={item.cantidad >= item.stockActual}
                      >
                        <PlusIcon className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm font-semibold text-gray-900">S/. {(item.precioVenta * item.cantidad).toFixed(2)}</p>
                      <button
                        onClick={() => removeItemFromCart(item.id)}
                        className="text-red-500 hover:text-red-700 text-xs mt-1"
                        title="Eliminar producto"
                      >
                        <XMarkIcon className="h-4 w-4 inline" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Método de Pago */}
          <div className="mb-4">
            <label htmlFor="payment-method" className="block text-sm font-medium text-gray-700 mb-1">Método de Pago:</label>
            <select
              id="payment-method"
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md shadow-sm"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="Efectivo">Efectivo</option>
              <option value="Tarjeta">Tarjeta de Crédito/Débito</option>
              <option value="Yape">Yape</option>
              <option value="plin">Plin</option>
              <option value="credito">Crédito</option>
            </select>
          </div>

          {/* Descuento */}
          <div className="mb-4">
            <label htmlFor="descuento" className="block text-sm font-medium text-gray-700 mb-1">
              Descuento (%):
            </label>
            <div className="relative mt-1 rounded-md shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <ReceiptPercentIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
              </div>
              <input
                type="number"
                id="descuento"
                name="descuento"
                className="block w-full rounded-md border-gray-300 pl-10 pr-12 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="0"
                min="0"
                max="100"
                value={descuentoPorcentaje}
                onChange={(e) => setDescuentoPorcentaje(Math.max(0, Math.min(100, Number(e.target.value))))}
                aria-describedby="descuento-porcentaje"
              />
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <span className="text-gray-500 sm:text-sm" id="descuento-porcentaje">
                  %
                </span>
              </div>
            </div>
            {descuentoPorcentaje > 0 && (
              <p className="mt-1 text-sm text-gray-500">
                Descuento aplicado: S/. {((cart.reduce((sum, item) => sum + item.precioVenta * item.cantidad, 0)) * (descuentoPorcentaje / 100)).toFixed(2)}
              </p>
            )}
          </div>

          {/* Observaciones */}
          <div className="mb-4">
            <label htmlFor="observaciones" className="block text-sm font-medium text-gray-700 mb-1">Observaciones (Opcional):</label>
            <textarea
              id="observaciones"
              rows="3"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
            ></textarea>
          </div>

          {/* Total */}
          <div className="flex justify-between items-center mt-auto pt-4 border-t border-gray-200">
            <span className="text-2xl font-bold text-gray-800">Total:</span>
            <span className="text-3xl font-extrabold text-blue-700">S/. {total.toFixed(2)}</span>
          </div>

          {/* Botón de Confirmar Venta */}
          <button
            onClick={handleConfirmSale}
            className="w-full mt-4 flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={cart.length === 0 || !selectedClient || loadingSearch}
          >
            {loadingSearch ? (
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <PlusIcon className="-ml-1 mr-3 h-5 w-5" aria-hidden="true" />
            )}
            Confirmar Venta
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default POSPage;