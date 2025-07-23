// pages/inventario/stock/index.js
import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import Layout from '../../../components/Layout';
import { db } from '../../../lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { ClipboardDocumentListIcon, EyeIcon, MagnifyingGlassIcon, ArchiveBoxIcon } from '@heroicons/react/24/outline';
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
      (producto.nombre && producto.nombre.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (producto.codigoTienda && producto.codigoTienda.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (producto.marca && producto.marca.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (producto.descripcion && producto.descripcion.toLowerCase().includes(lowerCaseSearchTerm))
    );
    setFilteredProductos(filtered);
  }, [searchTerm, productos]);

  const handleVerLotes = (productId) => {
    router.push(`/inventario/stock/${productId}`);
  };

  // Función para determinar la clase de la fila basada en el stock
  const getRowClassName = (producto, index) => {
    const currentStock = typeof producto.stockActual === 'number' ? producto.stockActual : 0;
    const thresholdStock = typeof producto.stockReferencialUmbral === 'number' ? producto.stockReferencialUmbral : 0;

    if (currentStock <= thresholdStock) {
      return 'bg-red-50'; // Stock bajo o igual al umbral (rojo claro)
    } else {
      // Si el stock es bueno, volvemos al sombreado alternado base
      return index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
    }
  };

  // Función para determinar la clase del texto del stock
  const getStockTextClassName = (producto) => {
    const currentStock = typeof producto.stockActual === 'number' ? producto.stockActual : 0;
    const thresholdStock = typeof producto.stockReferencialUmbral === 'number' ? producto.stockReferencialUmbral : 0;

    if (currentStock <= thresholdStock) {
      return 'font-bold text-red-700'; // Número rojo más oscuro para stock bajo
    } else {
      return 'font-bold text-green-700'; // Número verde para stock suficiente
    }
  };

  if (!user) {
    return null;
  }

  return (
    <Layout title="Stock Actual de Productos">
      <div className="flex flex-col mx-4 py-4">
        <div className="w-full p-6 bg-white rounded-lg shadow-md flex flex-col">


          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
              <span className="block sm:inline font-medium">{error}</span>
            </div>
          )}

          <div className="mb-6 border border-gray-200 rounded-lg p-4 bg-gray-50 flex-shrink-0 flex items-center">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="Buscar producto por nombre, código o marca..."
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : filteredProductos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 bg-gray-50 rounded-lg p-4 shadow-inner">
              <ArchiveBoxIcon className="h-24 w-24 text-gray-300 mb-4" />
              <p className="text-lg font-medium">No se encontraron productos en el inventario.</p>
              <p className="text-sm text-gray-400">Pruebe a ajustar su búsqueda o agregue nuevos productos.</p>
            </div>
          ) : (
            <div className="overflow-x-auto shadow-lg ring-1 ring-black ring-opacity-5 rounded-lg overflow-y-auto max-h-[70vh]">
              <table className="min-w-full border-collapse">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">PRODUCTO</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">MARCA</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">STOCK ACTUAL</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">PRECIO VENTA (S/.)</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredProductos.map((producto, index) => (
                    <tr key={producto.id} className={getRowClassName(producto, index)}> {/* Aplica la clase de color de fila */}
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm font-medium text-black text-left">
                        {producto.nombre} {producto.codigoTienda ? `(${producto.codigoTienda})` : ''}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">{producto.marca || 'N/A'}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">
                        <span className={getStockTextClassName(producto)}> {/* Aplica la clase del texto del stock */}
                          {producto.stockActual || 0}
                        </span>
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">S/. {parseFloat(producto.precioVentaDefault  || 0).toFixed(2)}</td>
                      <td className="border border-gray-300 relative whitespace-nowrap px-3 py-2 text-sm font-medium text-center">
                        <button
                          onClick={() => handleVerLotes(producto.id)}
                          className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50 transition duration-150 ease-in-out inline-flex items-center"
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
      </div>
    </Layout>
  );
};

export default StockActualPage;