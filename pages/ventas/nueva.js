import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { db } from '../../lib/firebase';
import {
  collection,
  getDoc, // Aunque no se usa directamente aquí, se mantiene si se usa en otro lugar
  doc,
  addDoc, // Aunque no se usa directamente aquí con runTransaction, se mantiene si se usa en otro lugar
  serverTimestamp,
  query,
  orderBy,
  getDocs,
  runTransaction, // Importado correctamente
} from 'firebase/firestore';
import { ShoppingCartIcon, PlusIcon, MagnifyingGlassIcon, TrashIcon, ArrowLeftIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';

const NuevaVentaPage = () => {
  const router = useRouter();
  const { user } = useAuth();

  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);
  const [clientes, setClientes] = useState([]);

  // Se asume que esta es para una VENTA DIRECTA, por lo tanto 'metodoPago' ya tiene un default.
  // El 'tipoVenta' se establecerá explícitamente en el submit.
  const [ventaPrincipalData, setVentaPrincipalData] = useState({
    numeroVenta: '',
    clienteId: '',
    observaciones: '',
    metodoPago: 'efectivo', // <-- Método de pago predeterminado para ventas directas
  });

  const [currentSearchTerm, setCurrentSearchTerm] = useState('');
  const [currentSearchResults, setCurrentSearchResults] = useState([]);
  const [showCurrentSearchResults, setShowCurrentSearchResults] = useState(false);
  const [selectedProductToAdd, setSelectedProductToAdd] = useState(null);

  const [itemsVenta, setItemsVenta] = useState([]);

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

        // Inicializar con cliente 'cliente-no-registrado' si existe
        setVentaPrincipalData(prev => ({
          ...prev,
          clienteId: clientesList.find(c => c.id === 'cliente-no-registrado')?.id || '',
        }));

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
  }, [user, router.isReady]);

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

  const handleVentaPrincipalChange = (e) => {
    const { name, value } = e.target;
    setVentaPrincipalData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, e) => {
    const { name, value } = e.target;
    const newItems = [...itemsVenta];
    let parsedValue = value;

    if (name === 'cantidad') {
      if (value === '') {
        parsedValue = '';
      } else {
        parsedValue = parseInt(value, 10);
        if (isNaN(parsedValue) || parsedValue < 0) {
          parsedValue = 0;
        }
        // La validación de stock disponible contra el stock REAL del producto
        // se hará de forma más robusta dentro de la transacción de Firebase para evitar condiciones de carrera.
        // Aquí es solo una validación inicial para la UX.
        const productInList = products.find(p => p.id === newItems[index].productoId);
        if (productInList && parsedValue > (productInList.stockActual || 0)) {
          alert(`Cantidad máxima para ${productInList.nombre} es ${productInList.stockActual || 0}.`);
          parsedValue = (productInList.stockActual || 0); // Limitar a stock disponible
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

    // Recalcular subtotal
    const cantidad = parseFloat(newItems[index].cantidad || 0);
    const precio = parseFloat(newItems[index].precioVentaUnitario || 0);

    if (!isNaN(cantidad) && !isNaN(precio)) {
      newItems[index].subtotal = (cantidad * precio).toFixed(2);
    } else {
      newItems[index].subtotal = '0.00';
    }

    setItemsVenta(newItems);
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
      const exists = itemsVenta.some(item => item.productoId === selectedProductToAdd.id);
      if (exists) {
        alert('Este producto ya ha sido añadido a la venta. Edite la cantidad en la tabla.');
        return;
      }

      if ((selectedProductToAdd.stockActual || 0) <= 0) {
        alert(`No hay stock disponible para ${selectedProductToAdd.nombre}.`);
        return;
      }

      setItemsVenta(prevItems => [
        ...prevItems,
        {
          id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          productoId: selectedProductToAdd.id,
          nombreProducto: selectedProductToAdd.nombre,
          cantidad: 1, // Por defecto 1
          precioVentaUnitario: selectedProductToAdd.precioVentaDefault !== undefined
            ? parseFloat(selectedProductToAdd.precioVentaDefault).toFixed(2)
            : '0.00',
          subtotal: parseFloat((1 * (selectedProductToAdd.precioVentaDefault || 0)).toFixed(2)),
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
    if (window.confirm('¿Está seguro de que desea eliminar este producto de la venta?')) {
      setItemsVenta(prevItems => prevItems.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const clienteSeleccionado = clientes.find(c => c.id === ventaPrincipalData.clienteId);
    if (!clienteSeleccionado) {
      setError('Por favor, seleccione un cliente válido.');
      setSaving(false);
      return;
    }

    if (itemsVenta.length === 0) {
      setError('Debe añadir al menos un producto a la venta.');
      setSaving(false);
      return;
    }

    const validItems = itemsVenta.every(item => {
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

    let totalVenta = itemsVenta.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0);

    try {
      await runTransaction(db, async (transaction) => {
        // --- FASE 1: TODAS LAS LECTURAS ---
        // Se recopilan todas las referencias de los productos y se leen sus documentos
        const productRefs = itemsVenta.map(item => doc(db, 'productos', item.productoId));
        const productSnaps = await Promise.all(productRefs.map(ref => transaction.get(ref)));

        // Mapa para verificar stock y obtener datos de productos
        const productStockMap = new Map();
        for (let i = 0; i < productSnaps.length; i++) {
          const productSnap = productSnaps[i];
          const item = itemsVenta[i];

          if (!productSnap.exists()) {
            throw new Error(`El producto "${item.nombreProducto}" (ID: ${item.productoId}) no se encontró en el inventario. No se puede completar la venta.`);
          }

          const currentStock = typeof productSnap.data().stockActual === 'number' ? productSnap.data().stockActual : 0;
          const cantidadVendida = parseFloat(item.cantidad);

          if (currentStock < cantidadVendida) {
            throw new Error(`Stock insuficiente para el producto "${item.nombreProducto}". Stock actual: ${currentStock}, Cantidad solicitada: ${cantidadVendida}.`);
          }
          productStockMap.set(item.productoId, {
            ref: productRefs[i],
            currentStock: currentStock
          });
        }

        // --- FASE 2: TODAS LAS ESCRITURAS ---

        // Generar un número de venta si no se proporcionó
        let finalNumeroVenta = ventaPrincipalData.numeroVenta.trim();
        if (!finalNumeroVenta) {
          // Genera un número de venta único, puedes usar una lógica más robusta si necesitas secuencia
          finalNumeroVenta = `VDIR-${Date.now().toString().slice(-8)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        }

        const newVentaRef = doc(collection(db, 'ventas')); // Firestore generará el ID automáticamente
        transaction.set(newVentaRef, {
          numeroVenta: finalNumeroVenta,
          clienteId: ventaPrincipalData.clienteId,
          clienteNombre: clienteSeleccionado.nombre + (clienteSeleccionado.apellido ? ' ' + clienteSeleccionado.apellido : ''),
          clienteDNI: clienteSeleccionado.dni || clienteSeleccionado.numeroDocumento || null,
          observaciones: ventaPrincipalData.observaciones.trim() || null,
          metodoPago: ventaPrincipalData.metodoPago, // Heredado del estado local para ventas directas
          totalVenta: parseFloat(totalVenta.toFixed(2)),
          fechaVenta: serverTimestamp(),
          empleadoId: user.email || user.uid,
          estado: 'completada', // Una venta directa siempre se crea como completada
          tipoVenta: 'ventaDirecta', // <-- ¡Campo para indicar que es una venta directa!
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Actualizar el stock de productos y añadir los ítems a la subcolección
        for (const item of itemsVenta) {
          const { ref, currentStock } = productStockMap.get(item.productoId);
          const cantidadVendida = parseFloat(item.cantidad);
          const newStock = currentStock - cantidadVendida;

          transaction.update(ref, {
            stockActual: newStock,
            updatedAt: serverTimestamp(),
          });

          // Asegúrate de que estás agregando a la subcolección de la nueva venta
          transaction.set(doc(collection(newVentaRef, 'itemsVenta')), {
            productoId: item.productoId,
            nombreProducto: item.nombreProducto,
            cantidad: cantidadVendida,
            precioVentaUnitario: parseFloat(item.precioVentaUnitario),
            subtotal: parseFloat(item.subtotal),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      });

      alert('Venta registrada con éxito y stock actualizado.');
      router.push('/ventas');
    } catch (err) {
      console.error("Error al registrar venta:", err);
      setError("Error al registrar la venta. " + (err.code === 'permission-denied' ? 'No tiene permisos para realizar esta acción. Contacte al administrador.' : err.message));
    } finally {
      setSaving(false);
    }
  };

  const totalGeneralVenta = itemsVenta.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0).toFixed(2);

  if (!router.isReady || !user || loadingData) {
    return (
      <Layout title="Cargando Formulario de Venta">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Registrar Nueva Venta Directa">
      <div className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-lg">

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Registrar Nueva Venta Directa</h2>
          <button
            onClick={() => router.push('/ventas')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            <ArrowLeftIcon className="-ml-1 mr-2 h-5 w-5 text-gray-500" aria-hidden="true" />
            Volver a Ventas
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
            <span className="block sm:inline font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Top section: Numero de Venta, Cliente, Metodo de Pago */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="numeroVenta" className="block text-sm font-medium text-gray-700 mb-1">Número de Venta (Opcional)</label>
              <input
                type="text"
                name="numeroVenta"
                id="numeroVenta"
                value={ventaPrincipalData.numeroVenta}
                onChange={handleVentaPrincipalChange}
                className="block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 text-base placeholder-gray-400"
                placeholder="Se autogenerará si está vacío"
              />
            </div>
            <div>
              <label htmlFor="clienteId" className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
              <select
                id="clienteId"
                name="clienteId"
                value={ventaPrincipalData.clienteId}
                onChange={handleVentaPrincipalChange}
                required
                className="block w-full pl-4 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 rounded-lg shadow-sm bg-white"
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
              <label htmlFor="metodoPago" className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
              <select
                id="metodoPago"
                name="metodoPago"
                value={ventaPrincipalData.metodoPago}
                onChange={handleVentaPrincipalChange}
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
                className="block w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-green-500 focus:border-green-500 text-base placeholder-gray-400 shadow-sm"
                placeholder="Buscar producto por nombre o código..."
                autoComplete="off"
              />
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
              </div>
            </div>
            <button
              type="button"
              onClick={addProductToItems}
              className="p-2.5 rounded-lg shadow-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              title="Añadir producto a la lista"
              disabled={!selectedProductToAdd}
            >
              <PlusIcon className="h-6 w-6" aria-hidden="true" />
            </button>

            {showCurrentSearchResults && currentSearchResults.length > 0 && (
              <ul className="absolute top-full z-10 mt-2 w-full bg-white shadow-xl max-h-60 rounded-lg py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                {currentSearchResults.map((product) => (
                  <li
                    key={product.id}
                    className="cursor-pointer select-none relative py-2 px-4 hover:bg-green-50 text-gray-900"
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

          {/* Table for Products in this Venta */}
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
                {itemsVenta.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-6 text-base text-gray-500">
                      Utilice el buscador para añadir productos a esta venta.
                    </td>
                  </tr>
                ) : (
                  itemsVenta.map((item, index) => (
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
                          className="w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm text-center"
                          placeholder="0"
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
                          className="w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm text-right"
                          placeholder="0.00"
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
              value={ventaPrincipalData.observaciones}
              onChange={handleVentaPrincipalChange}
              className="block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 text-base placeholder-gray-400"
              placeholder="Notas adicionales sobre esta venta..."
            ></textarea>
          </div>

          {/* Total and Save Button */}
          <div className="flex justify-between items-center mt-8 pt-4 border-t border-gray-200">
            <span className="text-xl font-bold text-gray-800">Total:</span>
            <span className="text-2xl font-extrabold text-green-700">S/. {totalGeneralVenta}</span>
          </div>

          <div className="flex justify-center mt-8">
            <button
              type="submit"
              className={`inline-flex items-center px-8 py-3 border border-transparent text-lg font-semibold rounded-lg shadow-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed`}
              disabled={saving || itemsVenta.length === 0 || !ventaPrincipalData.clienteId}
            >
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Registrando Venta...
                </>
              ) : (
                <>
                  <ShoppingCartIcon className="-ml-1 mr-3 h-6 w-6" aria-hidden="true" />
                  Registrar Venta Directa
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default NuevaVentaPage;