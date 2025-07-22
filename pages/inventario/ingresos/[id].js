// pages/inventario/ingresos/[id].js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../../contexts/AuthContext';
import Layout from '../../../components/Layout';
import { db } from '../../../lib/firebase';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { ArrowLeftIcon, CubeTransparentIcon } from '@heroicons/react/24/outline'; // Importa el icono de flecha izquierda

const IngresoDetailsPage = () => {
  const router = useRouter();
  const { id } = router.query; // Obtiene el ID del ingreso de la URL
  const { user } = useAuth();

  const [ingreso, setIngreso] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchIngresoDetails = async () => {
      if (!user) {
        router.push('/auth');
        return;
      }
      if (!id) return; // Espera hasta que el ID esté disponible

      setLoading(true);
      setError(null);
      try {
        // 1. Obtener el documento principal del ingreso
        const ingresoDocRef = doc(db, 'ingresos', id);
        const ingresoDocSnap = await getDoc(ingresoDocRef);

        if (!ingresoDocSnap.exists()) {
          setError('Boleta de ingreso no encontrada.');
          setLoading(false);
          return;
        }

        const ingresoData = {
          id: ingresoDocSnap.id,
          ...ingresoDocSnap.data(),
          fechaIngreso: ingresoDocSnap.data().fechaIngreso?.toDate().toLocaleDateString('es-ES', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
          }) || 'N/A',
        };
        setIngreso(ingresoData);

        // 2. Obtener los ítems de la subcolección 'itemsIngreso'
        const itemsIngresoCollectionRef = collection(db, 'ingresos', id, 'itemsIngreso');
        const qItemsIngreso = query(itemsIngresoCollectionRef, orderBy('nombreProducto', 'asc'));
        const querySnapshotItemsIngreso = await getDocs(qItemsIngreso);

        const loadedItems = querySnapshotItemsIngreso.docs.map(docItem => ({
          id: docItem.id,
          ...docItem.data(),
        }));
        setItems(loadedItems);

      } catch (err) {
        console.error("Error al cargar detalles del ingreso:", err);
        setError("Error al cargar los detalles de la boleta de ingreso. Intente de nuevo.");
      } finally {
        setLoading(false);
      }
    };

    fetchIngresoDetails();
  }, [id, user, router]); // Dependencia del ID de la URL y el usuario

  if (!user) {
    return null; // O un spinner/mensaje de carga mientras redirige
  }

  if (loading) {
    return (
      <Layout title="Cargando Detalles de Ingreso">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Error al Cargar Ingreso">
        <div className="max-w-4xl mx-auto p-4 bg-white rounded-lg shadow-md">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
          <button
            onClick={() => router.push('/inventario/ingresos')}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <ArrowLeftIcon className="-ml-1 mr-2 h-5 w-5" />
            Volver a Ingresos
          </button>
        </div>
      </Layout>
    );
  }

  if (!ingreso) {
      return (
          <Layout title="Boleta No Encontrada">
              <div className="max-w-4xl mx-auto p-4 bg-white rounded-lg shadow-md">
                  <p className="text-gray-600">No se pudo cargar la boleta de ingreso.</p>
                  <button
                      onClick={() => router.push('/inventario/ingresos')}
                      className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                      <ArrowLeftIcon className="-ml-1 mr-2 h-5 w-5" />
                      Volver a Ingresos
                  </button>
              </div>
          </Layout>
      );
  }

  return (
    <Layout title={`Detalles de Boleta: ${ingreso.id.substring(0, 8)}...`}>
      <div className="max-w-4xl mx-auto p-4 bg-white rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center">
            <CubeTransparentIcon className="h-7 w-7 text-green-600 mr-2" />
            Detalles de Boleta de Ingreso
          </h1>
          <button
            onClick={() => router.push('/inventario/ingresos')}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            <ArrowLeftIcon className="-ml-1 mr-2 h-5 w-5" />
            Volver a Boletas
          </button>
        </div>

        {/* Detalles de la Boleta Principal */}
        <div className="bg-blue-50 p-4 rounded-md border border-blue-200 mb-6">
          <h2 className="text-xl font-semibold text-blue-800 mb-4">Información de la Boleta</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
            <div>
              <p><strong className="font-medium">ID de Boleta:</strong> {ingreso.id}</p>
              <p><strong className="font-medium">Proveedor:</strong> {ingreso.proveedorNombre || 'N/A'}</p>
              {/* Si habilitaste numeroBoleta: <p><strong className="font-medium">N° Boleta:</strong> {ingreso.numeroBoleta || 'N/A'}</p> */}
              <p><strong className="font-medium">Costo Total:</strong> S/. {parseFloat(ingreso.costoTotalLote || 0).toFixed(2)}</p>
            </div>
            <div>
              <p><strong className="font-medium">Fecha de Ingreso:</strong> {ingreso.fechaIngreso}</p>
              <p><strong className="font-medium">Registrado Por:</strong> {ingreso.empleadoId || 'Desconocido'}</p>
              <p><strong className="font-medium">Observaciones:</strong> {ingreso.observaciones || 'Sin observaciones'}</p>
            </div>
          </div>
        </div>

        {/* Lista de Productos en esta Boleta */}
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
          <CubeTransparentIcon className="h-6 w-6 text-indigo-600 mr-2" />
          Productos en esta Boleta
        </h2>

        {items.length === 0 ? (
          <p className="text-gray-500">No hay productos registrados para esta boleta.</p>
        ) : (
          <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Producto</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Cantidad</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Precio Compra Unitario</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Lote Producto</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{item.nombreProducto}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{item.cantidad}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">S/. {parseFloat(item.precioCompraUnitario || 0).toFixed(2)}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{item.lote || 'N/A'}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">S/. {parseFloat(item.subtotal || 0).toFixed(2)}</td>
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

export default IngresoDetailsPage;