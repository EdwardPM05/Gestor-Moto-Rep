// pages/inventario/ingresos/nuevo.js
import { useState, useEffect, useRef } from 'react';
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
} from 'firebase/firestore';
import { ArrowDownTrayIcon, PlusIcon, MagnifyingGlassIcon, TrashIcon } from '@heroicons/react/24/outline'; // Se remueven ChevronUpIcon, ChevronDownIcon

const NuevoIngresoPage = () => {
  const router = useRouter();
  const { user } = useAuth();

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);
  const [proveedores, setProveedores] = useState([]);

  const [ingresoPrincipalData, setIngresoPrincipalData] = useState({
    numeroBoleta: '',
    proveedorId: '',
    observaciones: '',
  });

  const [currentSearchTerm, setCurrentSearchTerm] = useState('');
  const [currentSearchResults, setCurrentSearchResults] = useState([]);
  const [showCurrentSearchResults, setShowCurrentSearchResults] = useState(false);
  const [selectedProductToAdd, setSelectedProductToAdd] = useState(null);

  const [itemsIngreso, setItemsIngreso] = useState([]);

  const searchResultRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        router.push('/auth');
        return;
      }
      setLoadingProducts(true);
      try {
        const qProducts = query(collection(db, 'productos'), orderBy('nombre', 'asc'));
        const productSnapshot = await getDocs(qProducts);
        const productsList = productSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProducts(productsList);

        const qProveedores = query(collection(db, 'proveedores'), orderBy('nombreEmpresa', 'asc'));
        const proveedorSnapshot = await getDocs(qProveedores);
        const proveedoresList = proveedorSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProveedores(proveedoresList);

      } catch (err) {
        console.error("Error al cargar productos o proveedores:", err);
        setError("Error al cargar datos necesarios. " + err.message);
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchData();
  }, [user, router]);

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

  const handleIngresoPrincipalChange = (e) => {
    const { name, value } = e.target;
    setIngresoPrincipalData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, e) => {
    const { name, value } = e.target;
    const newItems = [...itemsIngreso];
    let parsedValue = value;

    if (name === 'cantidad') {
      // Permitir cadena vacía para que el usuario pueda borrar el número
      if (value === '') {
        parsedValue = '';
      } else {
        parsedValue = parseInt(value, 10);
        if (isNaN(parsedValue) || parsedValue < 0) { // Asegura que sea un número entero y no negativo
            parsedValue = 0; // O puedes dejarlo como cadena vacía para validación posterior
        }
      }
    } else if (name === 'precioCompraUnitario') {
      // Permitir cadena vacía y números decimales con flexibilidad en la entrada
      if (value === '') {
        parsedValue = '';
      } else {
        // Usar parseFloat para permitir decimales
        const floatValue = parseFloat(value);
        if (isNaN(floatValue) || floatValue < 0) {
          parsedValue = '0.00'; // Valor por defecto si es inválido
        } else {
          // Mantener la cadena tal cual para permitir escribir "6." o "6.0" antes de completar
          parsedValue = value;
        }
      }
    }

    newItems[index][name] = parsedValue;

    // Recalcular subtotal solo si ambos campos son números válidos
    const cantidad = parseFloat(newItems[index].cantidad || 0);
    const precio = parseFloat(newItems[index].precioCompraUnitario || 0);

    if (!isNaN(cantidad) && !isNaN(precio)) {
      newItems[index].subtotal = (cantidad * precio).toFixed(2);
      newItems[index].stockRestanteLote = cantidad;
    } else {
      newItems[index].subtotal = '0.00';
      newItems[index].stockRestanteLote = 0;
    }

    setItemsIngreso(newItems);
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
      const exists = itemsIngreso.some(item => item.productoId === selectedProductToAdd.id);
      if (exists) {
        alert('Este producto ya ha sido añadido a la boleta. Edite la cantidad en la tabla.');
        return;
      }

      setItemsIngreso([...itemsIngreso, {
        productoId: selectedProductToAdd.id,
        nombreProducto: selectedProductToAdd.nombre,
        cantidad: 1, // Cantidad inicial predeterminada
        precioCompraUnitario: selectedProductToAdd.precioCompraDefault ? selectedProductToAdd.precioCompraDefault.toFixed(2) : '0.00', // Formato a 2 decimales
        stockRestanteLote: 1,
        subtotal: parseFloat((1 * (selectedProductToAdd.precioCompraDefault || 0)).toFixed(2)),
      }]);
      setCurrentSearchTerm('');
      setSelectedProductToAdd(null);
      setError(null);
    } else {
      setError('Por favor, seleccione un producto de la lista antes de intentar agregarlo.');
    }
  };

  const removeItem = (index) => {
    if (confirm('¿Está seguro de que desea eliminar este producto de la boleta?')) {
      const newItems = itemsIngreso.filter((_, i) => i !== index);
      setItemsIngreso(newItems);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const proveedorSeleccionado = proveedores.find(p => p.id === ingresoPrincipalData.proveedorId);
    if (!proveedorSeleccionado) {
      setError('Por favor, seleccione un proveedor válido.');
      setSaving(false);
      return;
    }

    if (itemsIngreso.length === 0) {
      setError('Debe añadir al menos un producto a la boleta.');
      setSaving(false);
      return;
    }

    // Validar ítems antes de enviar
    const validItems = itemsIngreso.every(item => {
      const cantidad = parseFloat(item.cantidad);
      const precio = parseFloat(item.precioCompraUnitario);
      return (
        item.productoId &&
        !isNaN(cantidad) && cantidad > 0 &&
        !isNaN(precio) && precio >= 0
      );
    });

    if (!validItems) {
      setError('Por favor, asegúrese de que todos los ítems tengan un producto, cantidad (>0) y precio de compra (>=0) válidos.');
      setSaving(false);
      return;
    }

    let costoTotalLote = 0;
    itemsIngreso.forEach(item => {
      costoTotalLote += parseFloat(item.subtotal || 0);
    });

    try {
      const ingresoDocRef = await addDoc(collection(db, 'ingresos'), {
        numeroBoleta: ingresoPrincipalData.numeroBoleta.trim() || null,
        proveedorId: ingresoPrincipalData.proveedorId,
        proveedorNombre: proveedorSeleccionado.nombreEmpresa,
        observaciones: ingresoPrincipalData.observaciones.trim() || null,
        costoTotalLote: parseFloat(costoTotalLote.toFixed(2)),
        fechaIngreso: serverTimestamp(),
        empleadoId: user.email || user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log("Documento principal de ingreso (Boleta) creado con ID: ", ingresoDocRef.id);

      for (const item of itemsIngreso) {
        await addDoc(collection(ingresoDocRef, 'itemsIngreso'), {
          productoId: item.productoId,
          nombreProducto: item.nombreProducto,
          cantidad: parseFloat(item.cantidad),
          precioCompraUnitario: parseFloat(item.precioCompraUnitario),
          stockRestanteLote: parseFloat(item.cantidad),
          subtotal: parseFloat(item.subtotal),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const productRef = doc(db, 'productos', item.productoId);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
          const currentStock = parseFloat(productSnap.data().stockActual || 0);
          const newStock = currentStock + parseFloat(item.cantidad);
          await updateDoc(productRef, {
            stockActual: newStock,
            updatedAt: serverTimestamp(),
          });
          console.log(`Stock de ${item.nombreProducto} actualizado a ${newStock}`);
        } else {
          console.warn(`Producto con ID ${item.productoId} no encontrado al intentar actualizar stock.`);
        }
      }

      alert('Boleta de ingreso registrada y stock(s) actualizado(s) con éxito.');
      router.push('/inventario/ingresos');
    } catch (err) {
      console.error("Error al registrar boleta de ingreso o actualizar stock:", err);
      setError("Error al registrar el ingreso. " + err.message);
      if (err.code === 'permission-denied') {
        setError('No tiene permisos para realizar esta acción. Contacte al administrador.');
      }
    } finally {
      setSaving(false);
    }
  };

  const totalGeneralBoleta = itemsIngreso.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0).toFixed(2);

  if (!user || loadingProducts) {
    return (
      <Layout title="Cargando Formulario de Ingreso">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Registrar Nueva Boleta de Ingreso">
      <div className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-lg">

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
            <span className="block sm:inline font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Top section: Numero de Boleta and Proveedor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="numeroBoleta" className="block text-sm font-medium text-gray-700 mb-1">Número de Boleta</label>
              <input
                type="text"
                name="numeroBoleta"
                id="numeroBoleta"
                value={ingresoPrincipalData.numeroBoleta}
                onChange={handleIngresoPrincipalChange}
                className="block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base placeholder-gray-400"
                placeholder="Ej: B-00001"
              />
            </div>
            <div>
              <label htmlFor="proveedorId" className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
              <select
                id="proveedorId"
                name="proveedorId"
                value={ingresoPrincipalData.proveedorId}
                onChange={handleIngresoPrincipalChange}
                required
                className="block w-full pl-4 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-lg shadow-sm bg-white"
              >
                <option value="">Seleccione un proveedor</option>
                {proveedores.map((prov) => (
                  <option key={prov.id} value={prov.id}>
                    {prov.nombreEmpresa}
                  </option>
                ))}
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
                className="block w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base placeholder-gray-400 shadow-sm"
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
              className="p-2.5 rounded-lg shadow-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
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

          {/* Table for Products in this Boleta */}
          <div className="overflow-hidden shadow-lg ring-1 ring-black ring-opacity-5 rounded-lg mt-8">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-6 pr-3 text-left text-sm font-semibold text-gray-700">Nombre Producto</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-700 w-32">Cantidad</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-700 w-36">Precio Compra</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-700 w-32">Subtotal</th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-6">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {itemsIngreso.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-6 text-base text-gray-500">
                      Utilice el buscador para añadir productos a esta boleta.
                    </td>
                  </tr>
                ) : (
                  itemsIngreso.map((item, index) => (
                    <tr key={item.productoId || `item-${index}`} className="hover:bg-gray-50">
                      <td className="py-4 pl-6 pr-3 text-sm font-medium text-gray-900">
                          {item.nombreProducto}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500">
                        {/* Input de Cantidad - Vuelve a un input normal, pero con estilo mejorado */}
                        <input
                          type="number"
                          name="cantidad"
                          value={item.cantidad}
                          onChange={(e) => handleItemChange(index, e)}
                          required
                          min="0"
                          className="w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm text-center"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500">
                        {/* Input de Precio de Compra - Corrección para permitir múltiples dígitos y decimales */}
                        <input
                          type="number"
                          name="precioCompraUnitario"
                          value={item.precioCompraUnitario}
                          onChange={(e) => handleItemChange(index, e)}
                          required
                          min="0"
                          step="0.01" // Permite decimales
                          className="w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm text-right"
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

          {/* Observaciones (Mantenido por utilidad) */}
          <div className="mt-8">
              <label htmlFor="observaciones" className="block text-sm font-medium text-gray-700 mb-1">Observaciones (Opcional)</label>
              <textarea
                id="observaciones"
                name="observaciones"
                rows="3"
                value={ingresoPrincipalData.observaciones}
                onChange={handleIngresoPrincipalChange}
                className="block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base placeholder-gray-400"
                placeholder="Notas adicionales sobre esta boleta de ingreso..."
              ></textarea>
          </div>

          {/* Total and Register Button */}
          <div className="flex justify-between items-center mt-8 pt-4 border-t border-gray-200">
            <span className="text-xl font-bold text-gray-800">Total:</span>
            <span className="text-2xl font-extrabold text-blue-700">S/. {totalGeneralBoleta}</span>
          </div>

          <div className="flex justify-center mt-8">
            <button
              type="submit"
              className="inline-flex items-center px-8 py-3 border border-transparent text-lg font-semibold rounded-lg shadow-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={saving || itemsIngreso.length === 0}
            >
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Registrando...
                </>
              ) : (
                <>
                  <ArrowDownTrayIcon className="-ml-1 mr-3 h-6 w-6" aria-hidden="true" />
                  Registrar Ingresos
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default NuevoIngresoPage;