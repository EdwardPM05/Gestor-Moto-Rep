// pages/productos/index.js
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { db } from '../../lib/firebase';
import {
  collection,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc
} from 'firebase/firestore'; // Eliminé 'where' porque lo usaremos en el filtro JS
import {
  PencilIcon,
  PlusIcon,
  TrashIcon,
  PhotoIcon,
  XMarkIcon // Asegúrate de que XMarkIcon esté aquí
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/router';

// Componente Modal simple para la imagen
const ImageModal = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4" onClick={onClose}>
      <div className="relative bg-white p-2 rounded-lg max-w-3xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-1 bg-gray-200 rounded-full text-gray-700 hover:bg-gray-300 z-10"
          title="Cerrar"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
        <img src={imageUrl} alt="Imagen del Producto" className="max-w-full max-h-full object-contain" />
      </div>
    </div>
  );
};


const ProductosPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [productos, setProductos] = useState([]);
  const [modelosMoto, setModelosMoto] = useState([]); // Nuevo estado para modelos de moto
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModeloId, setSelectedModeloId] = useState(''); // Nuevo estado para el filtro de modelo
  const [filteredProductos, setFilteredProductos] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState('');

  useEffect(() => {
    const fetchAllData = async () => {
      if (!user) {
        router.push('/auth');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        // 1. Cargar productos
        const qProductos = query(collection(db, 'productos'), orderBy('nombre', 'asc'));
        const productosSnapshot = await getDocs(qProductos);
        const productosList = productosSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProductos(productosList);

        // 2. Cargar modelos de moto para el filtro
        const qModelos = query(collection(db, 'modelosMoto'), orderBy('marcaModelo', 'asc'));
        const modelosSnapshot = await getDocs(qModelos);
        const modelosList = modelosSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setModelosMoto(modelosList);

        setFilteredProductos(productosList); // Inicialmente, todos los productos están filtrados
      } catch (err) {
        console.error("Error al cargar datos:", err);
        setError("Error al cargar la información. Intente de nuevo.");
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [user, router]);


  // Efecto para filtrar productos cuando cambian los términos de búsqueda o el modelo seleccionado
  useEffect(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const filtered = productos.filter(producto => {
      const matchesSearchTerm =
        producto.nombre.toLowerCase().includes(lowerCaseSearchTerm) ||
        producto.marca.toLowerCase().includes(lowerCaseSearchTerm) ||
        producto.codigoTienda.toLowerCase().includes(lowerCaseSearchTerm) ||
        (producto.codigoProveedor && producto.codigoProveedor.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (producto.ubicacion && producto.ubicacion.toLowerCase().includes(lowerCaseSearchTerm));

      const matchesModelo = selectedModeloId === '' || // Si no hay modelo seleccionado, no aplica el filtro
                            (producto.modelosCompatiblesIds && producto.modelosCompatiblesIds.includes(selectedModeloId));

      return matchesSearchTerm && matchesModelo;
    });
    setFilteredProductos(filtered);
  }, [searchTerm, selectedModeloId, productos]); // Dependencias: estos estados disparan el filtrado


  const handleDelete = async (productId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este producto? Esta acción es irreversible.')) {
      try {
        await deleteDoc(doc(db, 'productos', productId));
        setProductos(prevProductos => prevProductos.filter(p => p.id !== productId));
        alert('Producto eliminado con éxito.');
      } catch (err) {
        console.error("Error al eliminar producto:", err);
        setError("Error al eliminar el producto. " + err.message);
        alert('Hubo un error al eliminar el producto.');
      }
    }
  };

  const openImageModal = (imageUrl) => {
    setCurrentImageUrl(imageUrl);
    setIsModalOpen(true);
  };

  const closeImageModal = () => {
    setIsModalOpen(false);
    setCurrentImageUrl('');
  };

  if (!user) {
    return null; // O un spinner/mensaje de carga, la redirección ya está en useEffect
  }

  return (
    <Layout title="Gestión de Productos">
      <div className="max-w-7xl mx-auto p-4 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">Productos</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-center mb-6 space-y-4 md:space-y-0 md:space-x-4">
          <input
            type="text"
            placeholder="Buscar por nombre, marca, código..."
            className="w-full md:flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="w-full md:w-1/4 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            value={selectedModeloId}
            onChange={(e) => setSelectedModeloId(e.target.value)}
          >
            <option value="">Filtrar por Modelo de Moto</option>
            {modelosMoto.map(modelo => (
              <option key={modelo.id} value={modelo.id}>
                {modelo.marcaModelo} {modelo.nombreModelo}
              </option>
            ))}
          </select>
          <button
            onClick={() => router.push('/productos/nuevo')}
            className="w-full md:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Agregar Producto
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredProductos.length === 0 ? (
          <p className="text-gray-500">No se encontraron productos.</p>
        ) : (
          <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Imagen</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Nombre</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Marca</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Código Tienda</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Stock</th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredProductos.map((producto) => (
                  <tr key={producto.id}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                      {producto.imageUrl ? (
                        <img
                          src={producto.imageUrl}
                          alt={producto.nombre}
                          className="h-12 w-12 object-cover rounded-md cursor-pointer"
                          onClick={() => openImageModal(producto.imageUrl)}
                          title="Ver imagen"
                        />
                      ) : (
                        <PhotoIcon className="h-12 w-12 text-gray-300" title="Sin imagen" />
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{producto.nombre}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{producto.marca}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{producto.codigoTienda}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <span className={`${producto.stockActual <= producto.stockReferencialUmbral ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                        {producto.stockActual}
                      </span>
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <div className="flex items-center space-x-2 justify-end">
                        <button
                          onClick={() => router.push(`/productos/${producto.id}`)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded-full hover:bg-gray-100"
                          title="Ver/Editar Producto"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(producto.id)}
                          className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-gray-100"
                          title="Eliminar Producto"
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

      {/* Modal de Imagen */}
      <ImageModal imageUrl={currentImageUrl} onClose={closeImageModal} />
    </Layout>
  );
};

export default ProductosPage;