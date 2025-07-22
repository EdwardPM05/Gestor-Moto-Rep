// pages/productos/index.js
import { useState, useEffect, Fragment } from 'react';
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
} from 'firebase/firestore';
import {
  PencilIcon,
  PlusIcon,
  TrashIcon,
  PhotoIcon,
  EyeIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/router';

import ImageModal from '../../components/modals/ImageModal';
import ProductDetailsModal from '../../components/modals/ProductDetailsModal';
import ProductModelsModal from '../../components/modals/ProductModelsModal';

const ProductosPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estados individuales para cada filtro
  const [filterNombre, setFilterNombre] = useState('');
  const [filterMarca, setFilterMarca] = useState('');
  const [filterCodigoTienda, setFilterCodigoTienda] = useState('');
  const [filterUbicacion, setFilterUbicacion] = useState('');
  const [filterModelosCompatibles, setFilterModelosCompatibles] = useState('');
  const [filterCodigoProveedor, setFilterCodigoProveedor] = useState('');
  const [filterMedida, setFilterMedida] = useState('');


  const [filteredProductos, setFilteredProductos] = useState([]);

  // Función para cargar todos los productos
  const fetchProductos = async () => {
    if (!user) {
      router.push('/auth');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const qProductos = query(collection(db, 'productos'), orderBy('nombre', 'asc'));
      const productosSnapshot = await getDocs(qProductos);
      const productosList = productosSnapshot.docs.map(doc => ({
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

  useEffect(() => {
    fetchProductos();
  }, [user, router]);

  // Lógica de filtrado combinada
  const applyFilters = () => {
    const lowerFilterNombre = filterNombre.toLowerCase();
    const lowerFilterMarca = filterMarca.toLowerCase();
    const lowerFilterCodigoTienda = filterCodigoTienda.toLowerCase();
    const lowerFilterUbicacion = filterUbicacion.toLowerCase();
    const lowerFilterModelosCompatibles = filterModelosCompatibles.toLowerCase();
    const lowerFilterCodigoProveedor = filterCodigoProveedor.toLowerCase();
    const lowerFilterMedida = filterMedida.toLowerCase();


    const filtered = productos.filter(producto => {
      const matchesNombre = producto.nombre.toLowerCase().includes(lowerFilterNombre);
      const matchesMarca = (producto.marca && producto.marca.toLowerCase().includes(lowerFilterMarca)) || lowerFilterMarca === '';
      const matchesCodigoTienda = producto.codigoTienda.toLowerCase().includes(lowerFilterCodigoTienda);
      const matchesUbicacion = (producto.ubicacion && producto.ubicacion.toLowerCase().includes(lowerFilterUbicacion)) || lowerFilterUbicacion === '';
      const matchesModelosCompatibles = (producto.modelosCompatiblesTexto && producto.modelosCompatiblesTexto.toLowerCase().includes(lowerFilterModelosCompatibles)) || lowerFilterModelosCompatibles === '';
      const matchesCodigoProveedor = (producto.codigoProveedor && producto.codigoProveedor.toLowerCase().includes(lowerFilterCodigoProveedor)) || lowerFilterCodigoProveedor === '';
      const matchesMedida = (producto.medida && producto.medida.toLowerCase().includes(lowerFilterMedida)) || lowerFilterMedida === '';


      return matchesNombre && matchesCodigoTienda && matchesMarca && matchesUbicacion && matchesModelosCompatibles && matchesCodigoProveedor && matchesMedida;
    });
    setFilteredProductos(filtered);
  };

  const handleSearchClick = () => {
    applyFilters();
  };

  const handleClearFilters = () => {
    setFilterNombre('');
        setFilterMarca('');
    setFilterCodigoTienda('');
    setFilterUbicacion('');
    setFilterModelosCompatibles('');
    setFilterCodigoProveedor('');
    setFilterMedida('');
    setFilteredProductos(productos);
  };

  const handleDelete = async (productId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este producto? Esta acción es irreversible.')) {
      try {
        await deleteDoc(doc(db, 'productos', productId));
        setProductos(prevProductos => prevProductos.filter(p => p.id !== productId));
        setFilteredProductos(prevFiltered => prevFiltered.filter(p => p.id !== productId));
        alert('Producto eliminado con éxito.');
      } catch (err) {
        console.error("Error al eliminar producto:", err);
        setError("Error al eliminar el producto. " + err.message);
        alert('Hubo un error al eliminar el producto.');
      }
    }
  };

  // Funciones para los modales (sin cambios en su comportamiento, solo cómo se invocan)
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [currentImageUrl, setCurrentImageUrl ] = useState('');
  const [isProductDetailsModalOpen, setIsProductDetailsModalOpen] = useState(false);
  const [selectedProductForDetails, setSelectedProductForDetails] = useState(null);
  const [isProductModelsModalOpen, setIsProductModelsModalOpen] = useState(false);
  const [selectedProductForModels, setSelectedProductForModels] = useState(null);

  const openImageModal = (imageUrl) => {
    setCurrentImageUrl(imageUrl);
    setIsImageModalOpen(true);
  };
  const closeImageModal = () => {
    setIsImageModalOpen(false);
    setCurrentImageUrl('');
  };

  const openProductDetailsModal = (product) => {
    setSelectedProductForDetails(product);
    setIsProductDetailsModalOpen(true);
  };
  const closeProductDetailsModal = () => {
    setSelectedProductForDetails(null);
    setIsProductDetailsModalOpen(false);
  };

  const openProductModelsModal = (product) => {
    setSelectedProductForModels(product);
    setIsProductModelsModalOpen(true);
  };
  const closeProductModelsModal = () => {
    setSelectedProductForModels(null);
    setIsProductModelsModalOpen(false);
  };

  if (!user) {
    return null;
  }

  return (
    <Layout title="Gestión de Productos">
      {/* Contenedor principal de la página, con margen horizontal */}
      {/* Eliminamos 'h-full' y 'flex-1' para que la altura se ajuste al contenido */}
      <div className="flex flex-col mx-4 py-4"> {/* Ajuste aquí: eliminado h-full, flex-1, añadido py-4 */}
        {/* Contenedor del card blanco. También eliminamos 'h-full' y 'flex-1' */}
        <div className="w-full p-4 bg-white rounded-lg shadow-md flex flex-col"> {/* Ajuste aquí: eliminado h-full, flex-1 */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {/* Sección de Filtros y Botones */}
          <div className="mb-4 border border-gray-200 rounded-lg p-4 bg-gray-50 flex-shrink-0">
            <div className="flex flex-wrap items-end gap-3 md:gap-4">
              <div className="flex flex-wrap items-end gap-3 md:gap-4 flex-grow">
                {/* Nombre */}
                <div className="flex-1 min-w-[140px]">
                  <label htmlFor="filterNombre" className="block text-sm font-medium text-gray-700">NOMBRE</label>
                  <input
                    type="text"
                    id="filterNombre"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={filterNombre}
                    onChange={(e) => setFilterNombre(e.target.value)}
                    placeholder="Nombre..."
                  />
                </div>
                {/* Marca */}
                <div className="flex-1 min-w-[140px]">
                  <label htmlFor="filterMarca" className="block text-sm font-medium text-gray-700">MARCA</label>
                  <input
                    type="text"
                    id="filterMarca"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={filterMarca}
                    onChange={(e) => setFilterMarca(e.target.value)}
                    placeholder="Marca..."
                  />
                </div>
                {/* Código Tienda */}
                <div className="flex-1 min-w-[140px]">
                  <label htmlFor="filterCodigoTienda" className="block text-sm font-medium text-gray-700">C. TIENDA</label>
                  <input
                    type="text"
                    id="filterCodigoTienda"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={filterCodigoTienda}
                    onChange={(e) => setFilterCodigoTienda(e.target.value)}
                    placeholder="Cód. Tienda..."
                  />
                </div>
                {/* Código Proveedor */}
                <div className="flex-1 min-w-[140px]">
                  <label htmlFor="filterCodigoProveedor" className="block text-sm font-medium text-gray-700">C. PROVEEDOR</label>
                  <input
                    type="text"
                    id="filterCodigoProveedor"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={filterCodigoProveedor}
                    onChange={(e) => setFilterCodigoProveedor(e.target.value)}
                    placeholder="Cód. Proveedor..."
                  />
                </div>
                {/* NUEVO CAMPO DE FILTRO: MEDIDA */}
                <div className="flex-1 min-w-[140px]">
                  <label htmlFor="filterMedida" className="block text-sm font-medium text-gray-700">MEDIDA</label>
                  <input
                    type="text"
                    id="filterMedida"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={filterMedida}
                    onChange={(e) => setFilterMedida(e.target.value)}
                    placeholder="Medida..."
                  />
                </div>
                {/* Ubicación */}
                <div className="flex-1 min-w-[140px]">
                  <label htmlFor="filterUbicacion" className="block text-sm font-medium text-gray-700">UBICACION</label>
                  <input
                    type="text"
                    id="filterUbicacion"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={filterUbicacion}
                    onChange={(e) => setFilterUbicacion(e.target.value)}
                    placeholder="Ubicación..."
                  />
                </div>
                {/* Modelos Compatibles (Texto Libre como input) */}
                <div className="flex-1 min-w-[140px]">
                  <label htmlFor="filterModelosCompatibles" className="block text-sm font-medium text-gray-700">MODELOS COMPATIBLES</label>
                  <input
                    type="text"
                    id="filterModelosCompatibles"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={filterModelosCompatibles}
                    onChange={(e) => setFilterModelosCompatibles(e.target.value)}
                    placeholder="Ej: Yamaha, Honda..."
                  />
                </div>
              </div>

              {/* Botones de acción: Buscar (icono), Limpiar (icono), Agregar (icono) */}
              <div className="flex-none flex items-end space-x-2">
                <button
                  onClick={handleSearchClick}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 h-[42px]"
                  title="Buscar"
                >
                  <MagnifyingGlassIcon className="h-5 w-5 mr-2" aria-hidden="true" />
                  Buscar
                </button>
                <button
                  onClick={handleClearFilters}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 h-[42px]"
                  title="Limpiar Filtros"
                >
                  <ArrowPathIcon className="h-5 w-5 mr-2" aria-hidden="true" />
                  Limpiar Filtros
                </button>
                <button
                  onClick={() => router.push('/productos/nuevo')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 h-[42px]"
                  title="Agregar Producto"
                >
                  <PlusIcon className="h-5 w-5 mr-2" aria-hidden="true" />
                  Agregar Producto
                </button>
              </div>
            </div>
          </div>

          {/* Tabla de Productos - Ahora se adapta a la altura del contenido */}
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredProductos.length === 0 ? (
            <p className="p-4 text-center text-gray-500">No se encontraron productos que coincidan con los filtros aplicados.</p>
          ) : (
            // Contenedor de la tabla, con scroll horizontal y vertical si es necesario
            <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg overflow-y-auto">
              <table className="min-w-full border-collapse">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">NOMBRE</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">MARCA</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">C. TIENDA</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">C. PROVEEDOR</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">MEDIDA</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">UBICACION</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">STOCK</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">COSTO (S/.)</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">VENTA (S/.)</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredProductos.map((producto, index) => (
                    <tr
                      key={producto.id}
                      className={`${producto.stockActual <= producto.stockReferencialUmbral ? 'bg-red-100 text-red-800' : (index % 2 === 0 ? 'bg-white' : 'bg-gray-50')}`}
                    >
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm font-medium text-black text-center">{producto.nombre}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-center">{producto.marca || 'N/A'}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-center">{producto.codigoTienda}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-center">{producto.codigoProveedor || 'N/A'}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-center">{producto.medida || 'N/A'}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-center">{producto.ubicacion || 'N/A'}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm font-semibold text-center">
                        {producto.stockActual}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-center">
                        S/. {parseFloat(producto.precioCompraDefault || 0).toFixed(2)}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-center">
                        S/. {parseFloat(producto.precioVentaDefault || 0).toFixed(2)}
                      </td>
                      <td className="border border-gray-300 relative whitespace-nowrap px-3 py-2 text-left text-sm font-medium ">
                        <div className="flex items-center space-x-1 justify-center"> {/* CAMBIO: justify-end a justify-center */}
                          <button
                            onClick={() => openImageModal(producto.imageUrl)}
                            className="text-gray-600 hover:text-gray-900 p-1 rounded-full hover:bg-gray-100 "
                            title="Ver Imagen"
                            disabled={!producto.imageUrl}
                          >
                            <PhotoIcon className="h-5 w-5" />
                          </button>

                          <button
                            onClick={() => openProductModelsModal(producto)}
                            className="text-purple-600 hover:text-purple-900 p-1 rounded-full hover:bg-gray-100"
                            title="Ver Modelos Compatibles"
                            disabled={!producto.modelosCompatiblesTexto || producto.modelosCompatiblesTexto.trim() === ''}
                          >
                            <ListBulletIcon className="h-5 w-5" />
                          </button>

                          <button
                            onClick={() => openProductDetailsModal(producto)}
                            className="text-emerald-600 hover:text-emerald-900 p-1 rounded-full hover:bg-gray-100"
                            title="Ver Detalles Completos"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </button>

                          <button
                            onClick={() => router.push(`/productos/${producto.id}`)}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded-full hover:bg-gray-100"
                            title="Editar Producto"
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
      </div>

      {/* Modales */}
      <ImageModal imageUrl={currentImageUrl} onClose={closeImageModal} />
      <ProductDetailsModal isOpen={isProductDetailsModalOpen} onClose={closeProductDetailsModal} product={selectedProductForDetails} />
      <ProductModelsModal isOpen={isProductModelsModalOpen} onClose={closeProductModelsModal} product={selectedProductForModels} />
    </Layout>
  );
};

export default ProductosPage;