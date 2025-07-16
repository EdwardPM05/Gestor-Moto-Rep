// pages/inventario/ingresos/nuevo.js
import { useState, useEffect } from 'react';
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
  getDoc, // <--- ¡Asegúrate de que getDoc esté aquí!
} from 'firebase/firestore';
import { ArrowDownTrayIcon, PlusIcon, MinusCircleIcon } from '@heroicons/react/24/outline';

const NuevoIngresoPage = () => {
  const router = useRouter();
  const { user } = useAuth();

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);

  // Estados para el formulario del INGRESO PRINCIPAL (Lote)
  const [ingresoPrincipalData, setIngresoPrincipalData] = useState({
    proveedorId: '',
    observaciones: '',
  });

  // Estados para los ITEMS del ingreso
  const [itemsIngreso, setItemsIngreso] = useState([
    { productoId: '', nombreProducto: '', cantidad: '', precioCompraUnitario: '', lote: '', stockRestanteLote: '', subtotal: '' }
  ]);
  const [proveedores, setProveedores] = useState([]); // Para el select de proveedores

  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        router.push('/auth');
        return;
      }
      setLoadingProducts(true);
      try {
        // Cargar Productos
        const qProducts = query(collection(db, 'productos'), orderBy('nombre', 'asc'));
        const productSnapshot = await getDocs(qProducts);
        const productsList = productSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProducts(productsList);

        // Cargar Proveedores
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

  const handleIngresoPrincipalChange = (e) => {
    const { name, value } = e.target;
    setIngresoPrincipalData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, e) => {
    const { name, value } = e.target;
    const newItems = [...itemsIngreso];
    newItems[index][name] = value;

    // Calcular subtotal si cantidad o precio unitario cambian
    if (name === 'cantidad' || name === 'precioCompraUnitario') {
      const cantidad = parseFloat(newItems[index].cantidad || 0);
      const precio = parseFloat(newItems[index].precioCompraUnitario || 0);
      newItems[index].subtotal = (cantidad * precio).toFixed(2);
      newItems[index].stockRestanteLote = cantidad; // Inicialmente el stock restante es la cantidad total
    }
    setItemsIngreso(newItems);
  };

  const handleProductSelect = (index, e) => {
    const selectedProductId = e.target.value;
    const selectedProduct = products.find(p => p.id === selectedProductId);
    const newItems = [...itemsIngreso];
    newItems[index].productoId = selectedProductId;
    newItems[index].nombreProducto = selectedProduct ? selectedProduct.nombre : '';
    newItems[index].precioCompraUnitario = selectedProduct ? selectedProduct.precioCompraDefault || '' : ''; // Autocompletar precio de compra
    setItemsIngreso(newItems);
  };

  const addItem = () => {
    setItemsIngreso([...itemsIngreso, { productoId: '', nombreProducto: '', cantidad: '', precioCompraUnitario: '', lote: '', stockRestanteLote: '', subtotal: '' }]);
  };

  const removeItem = (index) => {
    if (itemsIngreso.length > 1) { // No permitir eliminar el último ítem
      const newItems = itemsIngreso.filter((_, i) => i !== index);
      setItemsIngreso(newItems);
    } else {
      setError("Debe haber al menos un producto en el ingreso.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Validar datos principales del ingreso
    if (!ingresoPrincipalData.proveedorId) {
      setError('Por favor, seleccione un proveedor.');
      setSaving(false);
      return;
    }

    // Validar ítems
    const validItems = itemsIngreso.every(item =>
      item.productoId && parseFloat(item.cantidad) > 0 && parseFloat(item.precioCompraUnitario) > 0
    );
    if (!validItems) {
      setError('Por favor, asegúrese de que todos los ítems tengan un producto, cantidad y precio de compra válidos.');
      setSaving(false);
      return;
    }

    let costoTotalLote = 0;
    itemsIngreso.forEach(item => {
      costoTotalLote += parseFloat(item.subtotal || 0);
    });

    try {
      // 1. Crear el documento principal del ingreso (el "lote")
      const ingresoDocRef = await addDoc(collection(db, 'ingresos'), {
        proveedorId: ingresoPrincipalData.proveedorId,
        observaciones: ingresoPrincipalData.observaciones || null,
        costoTotalLote: parseFloat(costoTotalLote.toFixed(2)),
        fechaIngreso: serverTimestamp(),
        empleadoId: user.email || user.uid, // O user.displayName
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log("Documento principal de ingreso creado con ID: ", ingresoDocRef.id);

      // 2. Para cada ítem, agregarlo a la subcolección 'itemsIngreso' y actualizar el stock del producto
      for (const item of itemsIngreso) {
        // Añadir el ítem a la subcolección
        await addDoc(collection(ingresoDocRef, 'itemsIngreso'), {
          productoId: item.productoId,
          nombreProducto: item.nombreProducto,
          cantidad: parseFloat(item.cantidad),
          precioCompraUnitario: parseFloat(item.precioCompraUnitario),
          lote: item.lote || null,
          stockRestanteLote: parseFloat(item.cantidad), // Inicialmente el stock restante es la cantidad total ingresada
          subtotal: parseFloat(item.subtotal),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Actualizar el stock del producto principal
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
          // Considerar una lógica de rollback o notificación de error más robusta aquí
        }
      }

      alert('Ingreso registrado y stock(s) actualizado(s) con éxito.');
      router.push('/inventario/ingresos');
    } catch (err) {
      console.error("Error al registrar ingreso o actualizar stock:", err);
      setError("Error al registrar el ingreso. " + err.message);
      if (err.code === 'permission-denied') {
        setError('No tiene permisos para realizar esta acción. Contacte al administrador.');
      }
    } finally {
      setSaving(false);
    }
  };

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
    <Layout title="Registrar Nuevo Ingreso">
      <div className="max-w-4xl mx-auto p-4 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-gray-800 flex items-center">
          <ArrowDownTrayIcon className="h-7 w-7 text-blue-500 mr-2" />
          Registrar Nuevo Ingreso
        </h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Datos del Ingreso Principal (Lote) */}
          <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
            <h2 className="text-lg font-semibold text-blue-800 mb-4">Detalles del Lote de Ingreso</h2>
            <div>
              <label htmlFor="proveedorId" className="block text-sm font-medium text-gray-700">Proveedor</label>
              <select
                id="proveedorId"
                name="proveedorId"
                value={ingresoPrincipalData.proveedorId}
                onChange={handleIngresoPrincipalChange}
                required
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="">Seleccione un proveedor</option>
                {proveedores.map((prov) => (
                  <option key={prov.id} value={prov.id}>
                    {prov.nombreEmpresa}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4">
              <label htmlFor="observaciones" className="block text-sm font-medium text-gray-700">Observaciones (Opcional)</label>
              <textarea
                name="observaciones"
                id="observaciones"
                value={ingresoPrincipalData.observaciones}
                onChange={handleIngresoPrincipalChange}
                rows="3"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              ></textarea>
            </div>
          </div>

          {/* Ítems del Ingreso */}
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Productos en este Ingreso</h2>
          {itemsIngreso.map((item, index) => (
            <div key={index} className="border border-gray-200 p-4 rounded-md space-y-4 relative">
              {itemsIngreso.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                  title="Eliminar este ítem"
                >
                  &times; {/* Una "X" para cerrar/eliminar */}
                </button>
              )}
              <h3 className="text-md font-medium text-gray-700">Ítem #{index + 1}</h3>
              <div>
                <label htmlFor={`productoId-${index}`} className="block text-sm font-medium text-gray-700">Producto</label>
                <select
                  id={`productoId-${index}`}
                  name="productoId"
                  value={item.productoId}
                  onChange={(e) => handleProductSelect(index, e)}
                  required
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  <option value="">Seleccione un producto</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.nombre} ({product.codigoTienda})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={`cantidad-${index}`} className="block text-sm font-medium text-gray-700">Cantidad</label>
                  <input type="number" name="cantidad" id={`cantidad-${index}`} value={item.cantidad} onChange={(e) => handleItemChange(index, e)} required min="1"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                </div>
                <div>
                  <label htmlFor={`precioCompraUnitario-${index}`} className="block text-sm font-medium text-gray-700">Precio de Compra Unitario</label>
                  <input type="number" name="precioCompraUnitario" id={`precioCompraUnitario-${index}`} value={item.precioCompraUnitario} onChange={(e) => handleItemChange(index, e)} required step="0.01"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                </div>
              </div>

              <div>
                <label htmlFor={`lote-${index}`} className="block text-sm font-medium text-gray-700">Lote del producto (Opcional)</label>
                <input type="text" name="lote" id={`lote-${index}`} value={item.lote} onChange={(e) => handleItemChange(index, e)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                <p className="mt-1 text-xs text-gray-500">Identificador único para este grupo de productos específicos (ej: Lote A-123)</p>
              </div>
              <div className="text-right text-sm font-medium text-gray-700">
                Subtotal Ítem: S/. {parseFloat(item.subtotal || 0).toFixed(2)}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addItem}
            className="w-full flex items-center justify-center px-4 py-2 border border-dashed border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Añadir otro producto al ingreso
          </button>

          <div className="flex justify-end space-x-4 mt-8">
            <button
              type="button"
              onClick={() => router.push('/inventario/ingresos')}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
                  <ArrowDownTrayIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                  Registrar Ingreso
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