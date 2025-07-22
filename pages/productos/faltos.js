// pages/productos/faltantes.js
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { useRouter } from 'next/router';
import { ExclamationTriangleIcon, ArchiveBoxIcon, MagnifyingGlassIcon, PencilIcon, EyeIcon, PhotoIcon } from '@heroicons/react/24/outline'; // Añadidos iconos para Acciones

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
      // Asegurarse de que stockActual y stockReferencialUmbral son números válidos
      const currentStock = typeof producto.stockActual === 'number' ? producto.stockActual : 0;
      const thresholdStock = typeof producto.stockReferencialUmbral === 'number' ? producto.stockReferencialUmbral : 0;
      const isFaltante = currentStock <= thresholdStock;

      // Condición de búsqueda: si el término de búsqueda coincide con algún campo
      const matchesSearch =
        (producto.nombre && producto.nombre.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (producto.marca && producto.marca.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (producto.codigoTienda && producto.codigoTienda.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (producto.codigoProveedor && producto.codigoProveedor.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (producto.ubicacion && producto.ubicacion.toLowerCase().includes(lowerCaseSearchTerm));

      return isFaltante && matchesSearch;
    });

    setProductosFaltantes(faltantes);
  }, [productos, searchTerm]);

  if (!user) {
    return null;
  }

  return (
    <Layout title="Productos Faltantes">
      <div className="flex flex-col mx-4 py-4">
        <div className="w-full p-6 bg-white rounded-lg shadow-md flex flex-col">
          <h1 className="text-2xl font-extrabold mb-6 text-gray-900 flex items-center">
            <ExclamationTriangleIcon className="h-8 w-8 text-red-600 mr-3" />
            Productos Faltantes
          </h1>

          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
              <span className="block sm:inline font-medium">{error}</span>
            </div>
          )}

          <div className="mb-6 border border-gray-200 rounded-lg p-4 bg-gray-50 flex-shrink-0 flex items-center">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="Buscar por nombre, marca, código..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base placeholder-gray-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : productosFaltantes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 bg-gray-50 rounded-lg p-4 shadow-inner">
              <ArchiveBoxIcon className="h-24 w-24 text-gray-300 mb-4" />
              <p className="text-lg font-medium">¡No hay productos faltantes en este momento!</p>
              <p className="text-sm text-gray-400">Todo tu inventario está por encima del umbral establecido.</p>
            </div>
          ) : (
            <div className="overflow-x-auto shadow-lg ring-1 ring-black ring-opacity-5 rounded-lg overflow-y-auto max-h-[70vh]">
              <table className="min-w-full border-collapse">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-left">Nombre</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-left">Marca</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-left">Código Tienda</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-left">Cód. Proveedor</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-left">Medida</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-left">Ubicación</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-left">Stock</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-left">Umbral Mínimo</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-left">Costo (S/.)</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-left">Venta (S/.)</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {productosFaltantes.map((producto, index) => (
                    <tr key={producto.id} className={index % 2 === 0 ? 'bg-white' : 'bg-red-50'}>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-900 text-left">{producto.nombre || 'N/A'}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-gray-700 text-left">{producto.marca || 'N/A'}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-gray-700 text-left">{producto.codigoTienda || 'N/A'}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-gray-700 text-left">{producto.codigoProveedor || 'N/A'}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-gray-700 text-left">{producto.medida || 'N/A'}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-gray-700 text-left">{producto.ubicacion || 'N/A'}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-red-600 font-bold text-left">{producto.stockActual || 0}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-gray-700 text-left">{producto.stockReferencialUmbral || 0}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-gray-700 text-left">S/. {parseFloat(producto.costo || 0).toFixed(2)}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-gray-700 text-left">S/. {parseFloat(producto.precioVenta || 0).toFixed(2)}</td>
                      <td className="border border-gray-300 relative whitespace-nowrap px-3 py-2 text-sm font-medium text-center">
                        <div className="flex items-center space-x-2 justify-center">
                           {/* Botón para editar (el lápiz) */}
                          <button
                            onClick={() => router.push(`/productos/${producto.id}`)}
                            className="text-green-600 hover:text-green-800 p-2 rounded-full hover:bg-green-50 transition duration-150 ease-in-out"
                            title="Editar Producto"
                          >
                            <PencilIcon className="h-5 w-5" />
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

export default ProductosFaltantesPage;