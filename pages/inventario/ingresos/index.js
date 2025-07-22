// pages/inventario/ingresos/index.js
import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import Layout from '../../../components/Layout';
import { db } from '../../../lib/firebase';
import { collection, getDocs, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { PlusIcon, ArrowDownTrayIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline';
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
          };
          loadedIngresos.push(ingresoData);
        }

        setIngresos(loadedIngresos);
        setFilteredIngresos(loadedIngresos);
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

      return numeroBoletaMatch || proveedorMatch || observacionesMatch || fechaIngresoMatch || costoTotalMatch;
    });
    setFilteredIngresos(filtered);
  }, [searchTerm, ingresos]);

  const handleDeleteIngreso = async (ingresoId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta boleta de ingreso COMPLETA? Esto eliminará todos los productos asociados y NO revertirá el stock de los productos. Para revertir el stock, deberás hacerlo manualmente o implementar una función de ajuste de inventario.')) {
      setLoading(true);
      setError(null);
      try {
        const itemsRef = collection(db, 'ingresos', ingresoId, 'itemsIngreso');
        const itemsSnapshot = await getDocs(itemsRef);

        const deleteItemsPromises = itemsSnapshot.docs.map(itemDoc =>
          deleteDoc(doc(db, 'ingresos', ingresoId, 'itemsIngreso', itemDoc.id))
        );
        await Promise.all(deleteItemsPromises);

        await deleteDoc(doc(db, 'ingresos', ingresoId));

        setIngresos(prevIngresos => prevIngresos.filter(ing => ing.id !== ingresoId));
        alert('Boleta de ingreso eliminada con éxito.');
      } catch (err) {
        console.error("Error al eliminar boleta de ingreso:", err);
        setError("Error al eliminar la boleta de ingreso. " + err.message);
        alert('Hubo un error al eliminar la boleta de ingreso.');
      } finally {
        setLoading(false);
      }
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
      {/* Contenedor principal de la página, con margen horizontal */}
      <div className="flex flex-col mx-4 py-4"> {/* Mismos márgenes que clientes/index.js */}
        {/* Contenedor del card blanco */}
        <div className="w-full p-6 bg-white rounded-lg shadow-md flex flex-col"> {/* Mayor padding y sombra */}

          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
              <span className="block sm:inline font-medium">{error}</span>
            </div>
          )}

          {/* Sección de Búsqueda y Botón Agregar, con estilo de card */}
          <div className="mb-6 border border-gray-200 rounded-lg p-4 bg-gray-50 flex-shrink-0 flex justify-between items-center">
            <div className="relative flex-grow mr-4"> {/* Flex-grow y margen para el input */}
              <input
                type="text"
                placeholder="Buscar por número de boleta, proveedor, observaciones o fecha..."
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
            <div className="overflow-x-auto shadow-lg ring-1 ring-black ring-opacity-5 rounded-lg overflow-y-auto max-h-[60vh]"> {/* Ajustado para desbordamiento y altura máxima */}
              <table className="min-w-full border-collapse"> {/* Añadido border-collapse para los bordes de celda */}
                <thead className="bg-gray-50 sticky top-0 z-10"> {/* sticky top-0 para que la cabecera sea fija al hacer scroll */}
                  <tr>
                    {/* Clases para los encabezados: border border-gray-300, px-3 py-2, text-left */}
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">NUMERO DE BOLETA</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">PROVEEDOR</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">FECHA DE INGRESO</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">COSTO TOTAL</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">OBSERVACIONES</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">REGISTRADO POR</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredIngresos.map((ingreso, index) => (
                    <tr key={ingreso.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}> {/* Fondo alternado */}
                      {/* Clases para las celdas de datos: border border-gray-300, whitespace-nowrap px-3 py-2, text-sm text-black, text-left */}
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-900 text-left">
                        {ingreso.numeroBoleta || 'N/A'} {/* Muestra numeroBoleta, o 'N/A' si no existe */}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-gray-700 text-left">{ingreso.proveedorNombre}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-gray-700 text-left">{ingreso.fechaIngreso}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-gray-700 font-medium text-left">
                        S/. {parseFloat(ingreso.costoTotalLote || 0).toFixed(2)}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-sm text-gray-700 text-left max-w-xs truncate" title={ingreso.observaciones || 'N/A'}>
                        {ingreso.observaciones || 'N/A'}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-gray-700 text-left">{ingreso.empleadoId || 'Desconocido'}</td>
                      <td className="border border-gray-300 relative whitespace-nowrap px-3 py-2 text-sm font-medium text-center"> {/* Acciones centradas */}
                          <div className="flex items-center space-x-2 justify-center">
                            <button
                              onClick={() => handleViewDetails(ingreso.id)}
                              className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50 transition duration-150 ease-in-out"
                              title="Ver Detalles de la Boleta"
                            >
                              <EyeIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteIngreso(ingreso.id)}
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