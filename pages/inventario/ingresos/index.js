// pages/inventario/ingresos/index.js
import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import Layout from '../../../components/Layout';
import { db } from '../../../lib/firebase';
import { collection, getDocs, query, orderBy, doc, deleteDoc, runTransaction } from 'firebase/firestore';
import { PlusIcon, ArrowDownTrayIcon, TrashIcon, EyeIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/router';

const IngresosPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [ingresos, setIngresos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredIngresos, setFilteredIngresos] = useState([]);

  useEffect(() => {
    const fetchIngresos = async () => {
      if (!user) {
        router.push('/auth');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const ingresosCollectionRef = collection(db, 'ingresos');
        const qIngresos = query(ingresosCollectionRef, orderBy('fechaIngreso', 'desc'));
        const querySnapshotIngresos = await getDocs(qIngresos);

        const loadedIngresos = [];
        for (const docIngreso of querySnapshotIngresos.docs) {
          const ingresoData = {
            id: docIngreso.id,
            ...docIngreso.data(),
            // Formatear la fecha para visualización
            fechaIngreso: docIngreso.data().fechaIngreso?.toDate().toLocaleDateString('es-ES', {
              year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }) || 'N/A',
            // Asegurarse de que el estado esté presente
            estado: docIngreso.data().estado || 'pendiente', // Valor por defecto 'pendiente'
          };
          loadedIngresos.push(ingresoData);
        }

        setIngresos(loadedIngresos);
      } catch (err) {
        console.error("Error al cargar ingresos:", err);
        setError("Error al cargar la información de ingresos. Intente de nuevo.");
      } finally {
        setLoading(false);
      }
    };

    fetchIngresos();
  }, [user, router]);

  useEffect(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const filtered = ingresos.filter(ingreso => {
      const numeroBoletaMatch = ingreso.numeroBoleta && typeof ingreso.numeroBoleta === 'string'
        ? ingreso.numeroBoleta.toLowerCase().includes(lowerCaseSearchTerm)
        : false;

      const proveedorMatch = ingreso.proveedorNombre && typeof ingreso.proveedorNombre === 'string'
        ? ingreso.proveedorNombre.toLowerCase().includes(lowerCaseSearchTerm)
        : false;

      const observacionesMatch = ingreso.observaciones && typeof ingreso.observaciones === 'string'
        ? ingreso.observaciones.toLowerCase().includes(lowerCaseSearchTerm)
        : false;

      const fechaIngresoMatch = ingreso.fechaIngreso && typeof ingreso.fechaIngreso === 'string'
        ? ingreso.fechaIngreso.toLowerCase().includes(lowerCaseSearchTerm)
        : false;

      const costoTotalMatch = ingreso.costoTotalLote && typeof ingreso.costoTotalLote === 'number'
        ? ingreso.costoTotalLote.toFixed(2).includes(lowerCaseSearchTerm)
        : false;

      const estadoMatch = ingreso.estado && typeof ingreso.estado === 'string'
        ? ingreso.estado.toLowerCase().includes(lowerCaseSearchTerm)
        : false;

      return numeroBoletaMatch || proveedorMatch || observacionesMatch || fechaIngresoMatch || costoTotalMatch || estadoMatch;
    });
    setFilteredIngresos(filtered);
  }, [searchTerm, ingresos]);

  const handleConfirmarRecepcion = async (ingresoId) => {
    if (!window.confirm('¿Estás seguro de que quieres CONFIRMAR la recepción de esta boleta de ingreso? Esto agregará los productos al stock actual.')) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await runTransaction(db, async (transaction) => {
        const ingresoRef = doc(db, 'ingresos', ingresoId);
        const ingresoSnap = await transaction.get(ingresoRef);

        if (!ingresoSnap.exists()) {
          throw new Error("Boleta de ingreso no encontrada.");
        }

        const currentIngresoData = ingresoSnap.data();
        if (currentIngresoData.estado === 'recibido') {
          throw new Error("Esta boleta de ingreso ya ha sido confirmada.");
        }

        // --- INICIO DE LECTURAS (TODAS ANTES DE CUALQUIER ESCRITURA) ---
        // Obtener los ítems de ingreso asociados (fuera del transaction.get para items)
        const itemsIngresoCollectionRef = collection(db, 'ingresos', ingresoId, 'itemsIngreso');
        const itemsIngresoSnapshot = await getDocs(itemsIngresoCollectionRef); // getDocs NO es una operación de transacción
                                                                                // pero necesitamos los datos antes de las escrituras.

        if (itemsIngresoSnapshot.empty) {
          throw new Error("No se encontraron productos asociados a esta boleta de ingreso.");
        }

        // Recopilar todas las referencias de productos y sus datos actuales para lecturas
        const productoRefsAndData = [];
        const productoPromises = itemsIngresoSnapshot.docs.map(async (itemDoc) => {
          const itemData = itemDoc.data();
          const productoRef = doc(db, 'productos', itemData.productoId);
          const productoSnap = await transaction.get(productoRef); // ESTA ES LA LECTURA DENTRO DE LA TRANSACCIÓN

          if (productoSnap.exists()) {
            productoRefsAndData.push({
              itemDocRef: itemDoc.ref, // Referencia al documento del item de ingreso
              itemData: itemData,
              productoRef: productoRef,
              currentProductoData: productoSnap.data(),
            });
          } else {
            console.warn(`Producto con ID ${itemData.productoId} no encontrado para actualizar stock. Se omitirá.`);
          }
        });
        await Promise.all(productoPromises); // Esperar que todas las lecturas de productos se completen

        // --- FIN DE LECTURAS ---

        // --- INICIO DE ESCRITURAS ---
        // Ahora que todas las lecturas están hechas, podemos proceder con las escrituras
        for (const { itemDocRef, itemData, productoRef, currentProductoData } of productoRefsAndData) {
          const currentStock = typeof currentProductoData.stockActual === 'number' ? currentProductoData.stockActual : 0;
          const cantidadIngresada = typeof itemData.cantidad === 'number' ? itemData.cantidad : 0;
          const newStock = currentStock + cantidadIngresada;

          // Actualizar stock actual del producto
          transaction.update(productoRef, {
            stockActual: newStock,
            // Aquí podrías agregar lógica para actualizar el costo promedio del producto si lo manejas
          });

          // Actualizar stockRestanteLote en el itemIngreso (el lote específico)
          transaction.update(itemDocRef, { // Usar itemDocRef aquí
            stockRestanteLote: cantidadIngresada, // Al confirmar, el stock restante del lote es la cantidad ingresada
          });
        }

        // Finalmente, actualizar el estado de la boleta de ingreso a 'recibido'
        transaction.update(ingresoRef, { estado: 'recibido' });
        // --- FIN DE ESCRITURAS ---
      });

      alert('Recepción de mercadería confirmada y stock actualizado con éxito.');
      // Refrescar la lista de ingresos para reflejar el cambio de estado
      setIngresos(prevIngresos =>
        prevIngresos.map(ing =>
          ing.id === ingresoId ? { ...ing, estado: 'recibido' } : ing
        )
      );
    } catch (err) {
      console.error("Error al confirmar recepción:", err);
      setError("Error al confirmar la recepción. " + err.message);
      alert('Hubo un error al confirmar la recepción: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteIngreso = async (ingresoId, estadoIngreso) => {
    let confirmMessage = '¿Estás seguro de que quieres eliminar esta boleta de ingreso?';
    if (estadoIngreso === 'recibido') {
      confirmMessage += '\nADVERTENCIA: Esta boleta ya fue confirmada y sus productos se agregaron al stock. Eliminarla NO revertirá automáticamente el stock. Deberás ajustar el inventario manualmente si deseas corregir el stock.';
    } else {
      confirmMessage += '\nEsto eliminará todos los productos asociados y NO revertirá el stock de los productos (ya que aún no se habían agregado al stock).';
    }

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await runTransaction(db, async (transaction) => {
        const ingresoRef = doc(db, 'ingresos', ingresoId);
        // Primero, obtener y eliminar los itemsIngreso
        const itemsRef = collection(db, 'ingresos', ingresoId, 'itemsIngreso');
        const itemsSnapshot = await getDocs(itemsRef); // getDocs está fuera de la transacción, no es un transaction.get

        const deleteItemsPromises = itemsSnapshot.docs.map(itemDoc =>
          transaction.delete(doc(db, 'ingresos', ingresoId, 'itemsIngreso', itemDoc.id))
        );
        await Promise.all(deleteItemsPromises);

        // Luego, eliminar el documento de ingreso principal
        transaction.delete(ingresoRef);
      });

      alert('Boleta de ingreso eliminada con éxito.');
      setIngresos(prevIngresos => prevIngresos.filter(ing => ing.id !== ingresoId));
    } catch (err) {
      console.error("Error al eliminar boleta de ingreso:", err);
      setError("Error al eliminar la boleta de ingreso. " + err.message);
      alert('Hubo un error al eliminar la boleta de ingreso: ' + err.message);
    } finally {
      setLoading(false);
    }
  };


  const handleViewDetails = (ingresoId) => {
    router.push(`/inventario/ingresos/${ingresoId}`);
  };

  if (!user) {
    return null;
  }

  return (
    <Layout title="Registro de Ingresos de Mercadería">
      <div className="flex flex-col mx-4 py-4">
        <div className="w-full p-6 bg-white rounded-lg shadow-md flex flex-col">

          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
              <span className="block sm:inline font-medium">{error}</span>
            </div>
          )}

          <div className="mb-6 border border-gray-200 rounded-lg p-4 bg-gray-50 flex-shrink-0 flex justify-between items-center">
            <div className="relative flex-grow mr-4">
              <input
                type="text"
                placeholder="Buscar por número de boleta, proveedor, observaciones, fecha o estado..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base placeholder-gray-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <button
              onClick={() => router.push('/inventario/ingresos/nuevo')}
              className="inline-flex items-center px-6 py-2 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
            >
              <PlusIcon className="-ml-1 mr-3 h-5 w-5" aria-hidden="true" />
              Registrar Nueva Boleta
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredIngresos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 bg-gray-50 rounded-lg p-4 shadow-inner">
              <ArrowDownTrayIcon className="h-24 w-24 text-gray-300 mb-4" />
              <p className="text-lg font-medium">No se encontraron boletas de ingreso.</p>
              <p className="text-sm text-gray-400">¡Empieza registrando una nueva boleta de ingreso!</p>
            </div>
          ) : (
            <div className="overflow-x-auto shadow-lg ring-1 ring-black ring-opacity-5 rounded-lg overflow-y-auto max-h-[60vh]">
              <table className="min-w-full border-collapse">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">N° BOLETA</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">PROVEEDOR</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">FECHA DE INGRESO</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">COSTO TOTAL</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">ESTADO</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">OBSERVACIONES</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">REGISTRADO POR</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredIngresos.map((ingreso, index) => (
                    <tr key={ingreso.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-900 text-left">
                        {ingreso.numeroBoleta || 'N/A'}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-gray-700 text-left">{ingreso.proveedorNombre}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-gray-700 text-left">{ingreso.fechaIngreso}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-gray-700 font-medium text-left">
                        S/. {parseFloat(ingreso.costoTotalLote || 0).toFixed(2)}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-center">
                        {ingreso.estado === 'recibido' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircleIcon className="h-4 w-4 mr-1" /> Recibido
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <ExclamationCircleIcon className="h-4 w-4 mr-1" /> Pendiente
                          </span>
                        )}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-sm text-gray-700 text-left max-w-xs truncate" title={ingreso.observaciones || 'N/A'}>
                        {ingreso.observaciones || 'N/A'}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-gray-700 text-left">{ingreso.empleadoId || 'Desconocido'}</td>
                      <td className="border border-gray-300 relative whitespace-nowrap px-3 py-2 text-sm font-medium text-center">
                        <div className="flex items-center space-x-2 justify-center">
                          {ingreso.estado === 'pendiente' && (
                            <button
                              onClick={() => handleConfirmarRecepcion(ingreso.id)}
                              className="text-green-600 hover:text-green-800 p-2 rounded-full hover:bg-green-50 transition duration-150 ease-in-out"
                              title="Confirmar Recepción de Mercadería"
                            >
                              <CheckCircleIcon className="h-5 w-5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleViewDetails(ingreso.id)}
                            className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50 transition duration-150 ease-in-out"
                            title="Ver Detalles de la Boleta"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteIngreso(ingreso.id, ingreso.estado)}
                            className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50 transition duration-150 ease-in-out ml-1"
                            title="Eliminar Boleta de Ingreso Completa"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
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

export default IngresosPage;