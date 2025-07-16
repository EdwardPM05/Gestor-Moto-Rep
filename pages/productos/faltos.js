// pages/productos/faltos.js
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { useRouter } from 'next/router';
import { ExclamationTriangleIcon, ArchiveBoxIcon, MagnifyingGlassIcon, PencilIcon } from '@heroicons/react/24/outline';

const ProductosFaltantesPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [productos, setProductos] = useState([]); // Todos los productos cargados
  const [productosFaltantes, setProductosFaltantes] = useState([]); // Solo los productos que cumplen la condición
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState(''); // Para buscar dentro de los faltantes

  useEffect(() => {
    const fetchProductos = async () => {
      if (!user) {
        router.push('/auth');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const q = query(collection(db, 'productos'), orderBy('nombre', 'asc'));
        const querySnapshot = await getDocs(q);
        const productosList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProductos(productosList); // Guardar todos los productos
      } catch (err) {
        console.error("Error al cargar productos:", err);
        setError("Error al cargar los productos faltantes. Intente de nuevo.");
      } finally {
        setLoading(false);
      }
    };

    fetchProductos();
  }, [user, router]);

  useEffect(() => {
    // Filtra los productos para encontrar los "faltantes" y aplica la búsqueda
    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    const faltantes = productos.filter(producto => {
      // Condición principal: stockActual es menor o igual al stockReferencialUmbral
      const isFaltante = producto.stockActual <= producto.stockReferencialUmbral;

      // Condición de búsqueda: si el término de búsqueda coincide con algún campo
      const matchesSearch =
        producto.nombre.toLowerCase().includes(lowerCaseSearchTerm) ||
        producto.marca.toLowerCase().includes(lowerCaseSearchTerm) ||
        producto.codigoTienda.toLowerCase().includes(lowerCaseSearchTerm) ||
        (producto.codigoProveedor && producto.codigoProveedor.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (producto.ubicacion && producto.ubicacion.toLowerCase().includes(lowerCaseSearchTerm));

      return isFaltante && matchesSearch;
    });

    setProductosFaltantes(faltantes);
  }, [productos, searchTerm]); // Se ejecuta cuando 'productos' o 'searchTerm' cambian

  if (!user) {
    return null; // O un spinner/mensaje de carga, la redirección ya está en useEffect
  }

  return (
    <Layout title="Productos Faltantes">
      <div className="max-w-7xl mx-auto p-4 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-gray-800 flex items-center">
          <ExclamationTriangleIcon className="h-7 w-7 text-red-500 mr-2" />
          Productos Faltantes
        </h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <div className="mb-6 flex">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Buscar productos faltantes..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : productosFaltantes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <ArchiveBoxIcon className="h-24 w-24 text-gray-300 mb-4" />
            <p className="text-lg">¡No hay productos faltantes en este momento!</p>
            <p className="text-sm">Todo tu inventario está por encima del umbral.</p>
          </div>
        ) : (
          <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Nombre</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Marca</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Código Tienda</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Stock Actual</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Umbral</th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {productosFaltantes.map((producto) => (
                  <tr key={producto.id} className="bg-red-50 hover:bg-red-100"> {/* Resalta las filas faltantes */}
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{producto.nombre}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{producto.marca}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{producto.codigoTienda}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-red-600 font-semibold">{producto.stockActual}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{producto.stockReferencialUmbral}</td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <button
                        onClick={() => router.push(`/productos/${producto.id}`)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded-full hover:bg-gray-100"
                        title="Ver/Editar Producto"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                    </td>
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

export default ProductosFaltantesPage;