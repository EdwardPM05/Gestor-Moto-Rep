// pages/inventario/ingresos/index.js
import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import Layout from '../../../components/Layout';
import { db } from '../../../lib/firebase';
import { collection, getDocs, query, orderBy, doc } from 'firebase/firestore'; // Importar 'doc'
import { PlusIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/router';

const IngresosPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [ingresosCompletos, setIngresosCompletos] = useState([]); // Ahora almacenará el "encabezado" y sus items
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredIngresos, setFilteredIngresos] = useState([]); // Para la tabla, usará los ítems aplanados

  useEffect(() => {
    const fetchIngresos = async () => {
      if (!user) {
        router.push('/auth');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const ingresosCollectionRef = collection(db, 'ingresos'); // Colección de nivel superior 'ingresos'
        const qIngresos = query(ingresosCollectionRef, orderBy('fechaIngreso', 'desc'));
        const querySnapshotIngresos = await getDocs(qIngresos);

        const loadedIngresosCompletos = [];
        const flattenedIngresosForTable = []; // Para la visualización en tabla, aplanaremos los ítems

        for (const docIngreso of querySnapshotIngresos.docs) {
          const ingresoData = {
            id: docIngreso.id,
            ...docIngreso.data(),
            fechaIngreso: docIngreso.data().fechaIngreso?.toDate().toLocaleDateString('es-ES', {
              year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }) || 'N/A',
            items: [] // Para almacenar los ítems de esta subcolección
          };

          // Obtener los ítems de la subcolección 'itemsIngreso'
          const itemsIngresoCollectionRef = collection(db, 'ingresos', docIngreso.id, 'itemsIngreso'); // Acceso a la subcolección
          const qItemsIngreso = query(itemsIngresoCollectionRef, orderBy('nombreProducto', 'asc')); // Ojo, ahora se ordena por nombreProducto del item
          const querySnapshotItemsIngreso = await getDocs(qItemsIngreso);

          querySnapshotItemsIngreso.docs.forEach(docItem => {
            const itemData = {
              id: docItem.id,
              ...docItem.data(),
              // Asegurarse de que las fechas de los ítems se formatean si existen
              fechaIngresoItem: docItem.data().fechaIngreso?.toDate().toLocaleDateString('es-ES', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
              }) || 'N/A'
            };
            ingresoData.items.push(itemData);

            // Aplanar para la tabla de visualización (cada ítem como una fila)
            flattenedIngresosForTable.push({
              ...itemData, // Datos del ítem
              lotePrincipalId: ingresoData.id, // ID del documento principal de ingreso
              loteObservaciones: ingresoData.observaciones || 'N/A', // Observaciones del lote principal
              fechaIngresoPrincipal: ingresoData.fechaIngreso, // Fecha del lote principal
              registradoPor: ingresoData.empleadoId || 'Desconocido', // Quién registró el lote
            });
          });
          loadedIngresosCompletos.push(ingresoData);
        }

        setIngresosCompletos(loadedIngresosCompletos);
        setFilteredIngresos(flattenedIngresosForTable); // Usar la lista aplanada para el filtro y la tabla
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
    const filtered = filteredIngresos.filter(item => { // Ahora filtramos sobre los ítems aplanados
      const nombreProductoMatch = item.nombreProducto && typeof item.nombreProducto === 'string'
                                  ? item.nombreProducto.toLowerCase().includes(lowerCaseSearchTerm)
                                  : false;

      const loteMatch = item.lote && typeof item.lote === 'string'
                          ? item.lote.toLowerCase().includes(lowerCaseSearchTerm)
                          : false;

      const observacionesMatch = item.loteObservaciones && typeof item.loteObservaciones === 'string'
                                ? item.loteObservaciones.toLowerCase().includes(lowerCaseSearchTerm)
                                : false;

      const fechaIngresoMatch = item.fechaIngresoPrincipal && typeof item.fechaIngresoPrincipal === 'string'
                                ? item.fechaIngresoPrincipal.toLowerCase().includes(lowerCaseSearchTerm)
                                : false;

      return nombreProductoMatch || loteMatch || observacionesMatch || fechaIngresoMatch;
    });
    setFilteredIngresos(filtered); // Actualiza la lista filtrada
  }, [searchTerm, ingresosCompletos]); // Dependencia actualizada a ingresosCompletos

  if (!user) {
    return null;
  }

  return (
    <Layout title="Registro de Ingresos">
      <div className="max-w-7xl mx-auto p-4 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-gray-800 flex items-center">
          <ArrowDownTrayIcon className="h-7 w-7 text-blue-500 mr-2" />
          Registro de Ingresos
        </h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <input
            type="text"
            placeholder="Buscar por producto, lote u observaciones..."
            className="w-full md:w-1/3 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            onClick={() => router.push('/inventario/ingresos/nuevo')}
            className="ml-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Registrar Nuevo Ingreso
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredIngresos.length === 0 ? (
          <p className="text-gray-500">No se encontraron registros de ingresos.</p>
        ) : (
          <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Producto</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Cantidad</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Precio Compra Unitario</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Lote (ID Principal)</th> {/* Cambiado el título */}
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Fecha de Ingreso</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Observaciones del Lote</th> {/* Nuevo campo */}
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Registrado Por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredIngresos.map((item) => (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{item.nombreProducto}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{item.cantidad}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">S/. {parseFloat(item.precioCompraUnitario || 0).toFixed(2)}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{item.lotePrincipalId}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{item.fechaIngresoPrincipal}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{item.loteObservaciones}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{item.registradoPor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default IngresosPage;