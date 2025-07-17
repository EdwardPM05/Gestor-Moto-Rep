// pages/inventario/stock/index.js
import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import Layout from '../../../components/Layout';
import { db } from '../../../lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { ClipboardDocumentListIcon, EyeIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/router';

const StockActualPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredProductos, setFilteredProductos] = useState([]);

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
        setProductos(productosList);
        setFilteredProductos(productosList);
      } catch (err) {
        console.error("Error al cargar productos:", err);
        setError("Error al cargar la información de productos. Intente de nuevo.");
      } finally {
        setLoading(false);
      }
    };

    fetchProductos();
  }, [user, router]);

  useEffect(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const filtered = productos.filter(producto =>
      producto.nombre.toLowerCase().includes(lowerCaseSearchTerm) ||
      (producto.codigoTienda && producto.codigoTienda.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (producto.descripcion && producto.descripcion.toLowerCase().includes(lowerCaseSearchTerm))
    );
    setFilteredProductos(filtered);
  }, [searchTerm, productos]);

  const handleVerLotes = (productId) => {
    router.push(`/inventario/stock/${productId}`);
  };

  if (!user) {
    return null;
  }

  return (
    <Layout title="Stock Actual de Productos">
      <div className="max-w-7xl mx-auto p-4 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-gray-800 flex items-center">
          <ClipboardDocumentListIcon className="h-7 w-7 text-green-500 mr-2" />
          Stock Actual de Productos
        </h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <input
            type="text"
            placeholder="Buscar producto por nombre o código..."
            className="w-full md:w-1/3 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {/* Aquí podrías añadir botones para filtrar por bajo stock, etc. */}
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          </div>
        ) : filteredProductos.length === 0 ? (
          <p className="text-gray-500">No se encontraron productos en el inventario.</p>
        ) : (
          <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Producto (Código)</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Stock Actual</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Precio Venta</th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredProductos.map((producto) => (
                  <tr key={producto.id}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                      {producto.nombre} ({producto.codigoTienda})
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{producto.stockActual || 0}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">S/. {parseFloat(producto.precioVenta || 0).toFixed(2)}</td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <button
                        onClick={() => handleVerLotes(producto.id)}
                        className="text-indigo-600 hover:text-indigo-900 inline-flex items-center"
                        title="Ver Lotes de este Producto"
                      >
                        <EyeIcon className="h-5 w-5 mr-1" aria-hidden="true" />
                        Ver Lotes
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

export default StockActualPage;