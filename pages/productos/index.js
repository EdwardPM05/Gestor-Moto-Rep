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
  doc,
  updateDoc,
  where,
  serverTimestamp
} from 'firebase/firestore';
import {
  PencilIcon,
  PlusIcon,
  TrashIcon,
  PhotoIcon,
  EyeIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  ChevronUpIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/router';

import ImageModal from '../../components/modals/ImageModal';
import ProductDetailsModal from '../../components/modals/ProductDetailsModal';
import ProductModelsModal from '../../components/modals/ProductModelsModal';
import ConfirmModal from '../../components/modals/ConfirmModal';
import AlertModal from '../../components/modals/AlertModal';

const ProductosPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingPrices, setUpdatingPrices] = useState(false);

  // Estados para los filtros
  const [filterNombre, setFilterNombre] = useState('');
  const [filterCodigoProveedor, setFilterCodigoProveedor] = useState('');
  const [filterMarca, setFilterMarca] = useState('');
  const [filterCodigoTienda, setFilterCodigoTienda] = useState('');
  const [filterUbicacion, setFilterUbicacion] = useState('');
  const [filterModelosCompatibles, setFilterModelosCompatibles] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [filterMedida, setFilterMedida] = useState('');

  const [filteredProductos, setFilteredProductos] = useState([]);

  // Estados para ordenamiento
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' o 'desc'

  // Estados para la paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage, setProductsPerPage] = useState(10);
  const totalPages = Math.ceil(filteredProductos.length / productsPerPage);

  // Estados para los modales
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isProductDetailsModalOpen, setIsProductDetailsModalOpen] = useState(false);
  const [selectedProductForDetails, setSelectedProductForDetails] = useState(null);
  const [isProductModelsModalOpen, setIsProductModelsModalOpen] = useState(false);
  const [selectedProductForModels, setSelectedProductForModels] = useState(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  // Función para manejar el ordenamiento
  const handleSort = (columnKey) => {
    let newDirection = 'asc';
    
    // Si ya estamos ordenando por esta columna, cambiar dirección
    if (sortColumn === columnKey) {
      newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    }
    
    setSortColumn(columnKey);
    setSortDirection(newDirection);
    
    // Aplicar el ordenamiento
    const sortedProducts = [...filteredProductos].sort((a, b) => {
      let aValue = a[columnKey] || '';
      let bValue = b[columnKey] || '';
      
      // Convertir a string para comparación consistente
      aValue = aValue.toString().toLowerCase();
      bValue = bValue.toString().toLowerCase();
      
      // Para código de tienda, intentar comparación numérica si es posible
      if (columnKey === 'codigoTienda') {
        // Extraer números del código para ordenamiento numérico
        const aNumeric = aValue.match(/\d+/);
        const bNumeric = bValue.match(/\d+/);
        
        if (aNumeric && bNumeric) {
          const aNum = parseInt(aNumeric[0]);
          const bNum = parseInt(bNumeric[0]);
          
          if (aNum !== bNum) {
            return newDirection === 'asc' ? aNum - bNum : bNum - aNum;
          }
        }
      }
      
      // Comparación alfabética estándar
      if (aValue < bValue) {
        return newDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return newDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
    
    setFilteredProductos(sortedProducts);
    setCurrentPage(1); // Resetear a la primera página al ordenar
  };

  // Función para mostrar el icono de ordenamiento
  const getSortIcon = (columnKey) => {
    if (sortColumn !== columnKey) {
      return null;
    }
    
    return sortDirection === 'asc' ? (
      <ChevronUpIcon className="h-4 w-4 inline ml-1" />
    ) : (
      <ChevronDownIcon className="h-4 w-4 inline ml-1" />
    );
  };

  // Función para recalcular el precio de compra de un producto basado en FIFO
  const recalcularPrecioCompraFIFO = async (productoId) => {
    try {
      // Buscar todos los lotes activos del producto, ordenados por fecha de ingreso (FIFO)
      const lotesQuery = query(
        collection(db, 'lotes'),
        where('productoId', '==', productoId),
        where('stockRestante', '>', 0),
        where('estado', '==', 'activo'),
        orderBy('fechaIngreso', 'asc')
      );
      
      const lotesSnapshot = await getDocs(lotesQuery);
      
      let nuevoPrecioCompra = 0;
      let stockTotal = 0;
      
      // Si hay lotes disponibles, tomar el precio del primer lote (más antiguo)
      if (!lotesSnapshot.empty) {
        const primerLote = lotesSnapshot.docs[0].data();
        nuevoPrecioCompra = parseFloat(primerLote.precioCompraUnitario || 0);
        
        // Calcular stock total de todos los lotes activos
        lotesSnapshot.docs.forEach(doc => {
          stockTotal += parseInt(doc.data().stockRestante || 0);
        });
      }
      
      // Actualizar el producto con el nuevo precio y stock
      await updateDoc(doc(db, 'productos', productoId), {
        precioCompraDefault: nuevoPrecioCompra,
        stockActual: stockTotal,
        updatedAt: serverTimestamp()
      });
      
      return { nuevoPrecioCompra, stockTotal };
      
    } catch (error) {
      console.error(`Error al recalcular precio FIFO para producto ${productoId}:`, error);
      throw error;
    }
  };

  // Función para actualizar precios de todos los productos
  const actualizarTodosLosPrecios = async () => {
    if (!window.confirm('¿Está seguro de que desea recalcular los precios de compra de todos los productos basado en sus lotes disponibles? Esta operación puede tomar unos momentos.')) {
      return;
    }
    
    setUpdatingPrices(true);
    let actualizados = 0;
    let errores = 0;
    
    try {
      for (const producto of productos) {
        try {
          await recalcularPrecioCompraFIFO(producto.id);
          actualizados++;
        } catch (error) {
          console.error(`Error al actualizar producto ${producto.id}:`, error);
          errores++;
        }
      }
      
      // Recargar la lista de productos
      await fetchProductos();
      
      setAlertMessage(`Actualización completa: ${actualizados} productos actualizados${errores > 0 ? `, ${errores} errores` : ''}.`);
      setIsAlertModalOpen(true);
      
    } catch (error) {
      console.error('Error general al actualizar precios:', error);
      setError('Error al actualizar los precios. Intente de nuevo.');
    } finally {
      setUpdatingPrices(false);
    }
  };

  // Función para recalcular precio de un producto específico
  const recalcularProductoEspecifico = async (productoId) => {
    try {
      const resultado = await recalcularPrecioCompraFIFO(productoId);
      
      // Actualizar el producto en la lista local
      setProductos(prevProductos => 
        prevProductos.map(p => 
          p.id === productoId 
            ? { 
                ...p, 
                precioCompraDefault: resultado.nuevoPrecioCompra,
                stockActual: resultado.stockTotal 
              }
            : p
        )
      );
      
      setFilteredProductos(prevFiltered => 
        prevFiltered.map(p => 
          p.id === productoId 
            ? { 
                ...p, 
                precioCompraDefault: resultado.nuevoPrecioCompra,
                stockActual: resultado.stockTotal 
              }
            : p
        )
      );
      
      setAlertMessage(`Precio actualizado: S/. ${resultado.nuevoPrecioCompra.toFixed(2)} (Stock: ${resultado.stockTotal})`);
      setIsAlertModalOpen(true);
      
    } catch (error) {
      console.error('Error al recalcular producto específico:', error);
      setError('Error al recalcular el precio. Intente de nuevo.');
    }
  };

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
    const lowerFilterCodigoProveedor = filterCodigoProveedor.toLowerCase();
    const lowerFilterCodigoTienda = filterCodigoTienda.toLowerCase();
    const lowerFilterUbicacion = filterUbicacion.toLowerCase();
    const lowerFilterModelosCompatibles = filterModelosCompatibles.toLowerCase();
    const lowerFilterColor = filterColor.toLowerCase();
    const lowerFilterMedida = filterMedida.toLowerCase();

    const filtered = productos.filter(producto => {
      const matchesNombre = producto.nombre.toLowerCase().includes(lowerFilterNombre);
      const matchesCodigoProveedor = (producto.codigoProveedor && producto.codigoProveedor.toLowerCase().includes(lowerFilterCodigoProveedor)) || lowerFilterCodigoProveedor === '';
      const matchesCodigoTienda = producto.codigoTienda.toLowerCase().includes(lowerFilterCodigoTienda);
      const matchesUbicacion = (producto.ubicacion && producto.ubicacion.toLowerCase().includes(lowerFilterUbicacion)) || lowerFilterUbicacion === '';
      const matchesModelosCompatibles = (producto.modelosCompatiblesTexto && producto.modelosCompatiblesTexto.toLowerCase().includes(lowerFilterModelosCompatibles)) || lowerFilterModelosCompatibles === '';
      const matchesColor = (producto.color && producto.color.toLowerCase().includes(lowerFilterColor)) || lowerFilterColor === '';
      const matchesMedida = (producto.medida && producto.medida.toLowerCase().includes(lowerFilterMedida)) || lowerFilterMedida === '';

      return matchesNombre && matchesCodigoTienda && matchesCodigoProveedor && matchesUbicacion && matchesModelosCompatibles && matchesColor && matchesMedida;
    });
    
    setFilteredProductos(filtered);
    setCurrentPage(1); // Resetear a la primera página al aplicar filtros
    
    // Limpiar el ordenamiento al aplicar filtros
    setSortColumn(null);
    setSortDirection('asc');
  };

  const handleSearchClick = () => {
    applyFilters();
  };

  const handleClearFilters = () => {
    setFilterNombre('');
    setFilterCodigoProveedor('');
    setFilterCodigoTienda('');
    setFilterUbicacion('');
    setFilterModelosCompatibles('');
    setFilterColor('');
    setFilterMedida('');
    setFilteredProductos(productos);
    setCurrentPage(1);
    
    // Limpiar el ordenamiento
    setSortColumn(null);
    setSortDirection('asc');
  };

  const handleDelete = async (productId) => {
    try {
      await deleteDoc(doc(db, 'productos', productId));
      setProductos(prevProductos => prevProductos.filter(p => p.id !== productId));
      setFilteredProductos(prevFiltered => prevFiltered.filter(p => p.id !== productId));
      setAlertMessage('Producto eliminado con éxito.');
      setIsAlertModalOpen(true);
    } catch (err) {
      console.error("Error al eliminar producto:", err);
      setError("Error al eliminar el producto. " + err.message);
      setAlertMessage('Hubo un error al eliminar el producto.');
      setIsAlertModalOpen(true);
    } finally {
      setIsConfirmModalOpen(false); // Cierra el modal de confirmación
    }
  };

  const confirmDelete = (productId) => {
    setConfirmMessage('¿Estás seguro de que quieres eliminar este producto? Esta acción es irreversible.');
    setConfirmAction(() => () => handleDelete(productId));
    setIsConfirmModalOpen(true);
  };

  // Funciones para los modales
  const openImageModal = (producto) => {
  setSelectedProductForDetails(producto);
  setIsImageModalOpen(true);
};
  const closeImageModal = () => {
  setIsImageModalOpen(false);
  setSelectedProductForDetails(null);
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

  // Función para determinar si el stock está bajo
  const isLowStock = (stockActual, stockUmbral) => {
    return stockActual <= stockUmbral;
  };

  // Función para determinar si un producto tiene precio desactualizado
  const needsPriceUpdate = (producto) => {
    // Lógica para determinar si el precio podría estar desactualizado
    // Por ejemplo, si no se ha actualizado en los últimos 30 días
    const lastUpdate = producto.updatedAt?.toDate() || new Date(0);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return lastUpdate < thirtyDaysAgo;
  };

  // Lógica de paginación
  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = filteredProductos.slice(indexOfFirstProduct, indexOfLastProduct);

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <Layout title="Gestión de Productos">
      <div className="flex flex-col mx-4 py-4">
        <div className="w-full p-4 bg-white rounded-lg shadow-md flex flex-col">
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
                {/* PROVEEDOR */}
                <div className="flex-1 min-w-[140px]">
                  <label htmlFor="filterCodigoProveedor" className="block text-sm font-medium text-gray-700">C. PROVEEDOR</label>
                  <input
                    type="text"
                    id="filterCodigoProveedor"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={filterCodigoProveedor}
                    onChange={(e) => setFilterCodigoProveedor(e.target.value)}
                    placeholder="CodigoProveedor..."
                  />
                </div>
                
                {/* Color */}
                <div className="flex-1 min-w-[140px]">
                  <label htmlFor="filterColor" className="block text-sm font-medium text-gray-700">COLOR</label>
                  <input
                    type="text"
                    id="filterColor"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={filterColor}
                    onChange={(e) => setFilterColor(e.target.value)}
                    placeholder="Color..."
                  />
                </div>
                {/* Medida */}
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
              {/* Selector de productos por página */}
              <div className="flex-none min-w-[120px]">
                <label htmlFor="products-per-page" className="block text-sm font-medium text-gray-700">Mostrar:</label>
                <select
                  id="products-per-page"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm h-[42px]"
                  value={productsPerPage}
                  onChange={(e) => {
                    setProductsPerPage(Number(e.target.value));
                    setCurrentPage(1); // Resetear a la primera página al cambiar el tamaño de la página
                  }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              {/* Botones de acción */}
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
                  onClick={actualizarTodosLosPrecios}
                  disabled={updatingPrices}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 h-[42px] disabled:bg-gray-400 disabled:cursor-not-allowed"
                  title="Recalcular todos los precios basado en lotes FIFO"
                >
                  {updatingPrices ? (
                    <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                  ) : (
                    <CurrencyDollarIcon className="h-5 w-5 mr-2" aria-hidden="true" />
                  )}
                  {updatingPrices ? 'Actualizando...' : 'Actualizar Precios'}
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

          {/* Tabla de Productos */}
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredProductos.length === 0 ? (
            <p className="p-4 text-center text-gray-500">No se encontraron productos que coincidan con los filtros aplicados.</p>
          ) : (
            <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg overflow-y-auto">
              <table className="min-w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-gray-100">
                  <tr>
                    <th 
                      scope="col" 
                      className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center cursor-pointer hover:bg-gray-200 select-none"
                      onClick={() => handleSort('codigoTienda')}>
                      C. TIENDA
                      {getSortIcon('codigoTienda')}
                    </th>
                    <th 
                      scope="col" 
                      className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center cursor-pointer hover:bg-gray-200 select-none"
                      onClick={() => handleSort('nombre')}>
                      NOMBRE
                      {getSortIcon('nombre')}
                    </th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">MARCA</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">C. Proveedor</th>
                    <th className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">COLOR</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">MEDIDA</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">UBICACION</th>
                    <th 
                      scope="col" 
                      className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center cursor-pointer hover:bg-gray-200 select-none"
                      onClick={() => handleSort('stockActual')}
                    >
                      STOCK
                      {getSortIcon('stockActual')}
                    </th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">COSTO (S/.)</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">VENTA (S/.)</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">VENTA MIN (S/.)</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {currentProducts.map((producto, index) => {
                    const lowStock = isLowStock(producto.stockActual, producto.stockReferencialUmbral);
                    const rowBgClass = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                    const textColorClass = lowStock ? 'text-red-600 font-semibold' : 'text-black';
                    const priceNeedsUpdate = needsPriceUpdate(producto);
                    
                    return (
                      <tr key={producto.id} className={rowBgClass}>
                        <td className={`border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-left ${textColorClass}`}>
                          {producto.codigoTienda}
                        </td>
                        <td className={`border border-gray-300 whitespace-nowrap px-3 py-2 text-sm font-medium text-left ${textColorClass}`}>
                          {producto.nombre}
                        </td>
                        <td className={`border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-left ${textColorClass}`}>
                          {producto.marca || 'N/A'}
                        </td>
                        <td className={`border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-left ${textColorClass}`}>
                          {producto.codigoProveedor}
                        </td>
                        <td className={`border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-left ${textColorClass}`}>
                          {producto.color || 'N/A'}
                        </td>
                        <td className={`border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-left ${textColorClass}`}>
                          {producto.medida || 'N/A'}
                        </td>
                        <td className={`border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-left ${textColorClass}`}>
                          {producto.ubicacion || 'N/A'}
                        </td>
                        <td className={`border border-gray-300 whitespace-nowrap px-3 py-2 text-sm font-semibold text-center ${textColorClass}`}>
                          {producto.stockActual}
                          {lowStock && <span className="ml-1 text-red-500">⚠</span>}
                        </td>
                        <td className={`border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-center ${textColorClass} relative`}>
                          <div className="flex items-center justify-center">
                            <span>S/. {parseFloat(producto.precioCompraDefault || 0).toFixed(2)}</span>
                            {priceNeedsUpdate && (
                              <ExclamationTriangleIcon 
                                className="h-4 w-4 ml-1 text-orange-500" 
                                title="Precio podría estar desactualizado - Recalcular basado en lotes FIFO"
                              />
                            )}
                          </div>
                        </td>
                        <td className={`border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-center ${textColorClass}`}>
                          S/. {parseFloat(producto.precioVentaDefault || 0).toFixed(2)}
                        </td>
                        <td className={`border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-center ${textColorClass}`}>
                          S/. {parseFloat(producto.precioVentaMinimo || 0).toFixed(2)}
                        </td>
                        <td className="border border-gray-300 relative whitespace-nowrap px-3 py-2 text-left text-sm font-medium">
                          <div className="flex items-center space-x-1 justify-center">
                            <button
                              onClick={() => openImageModal(producto)}
                              className="text-gray-600 hover:text-gray-900 p-1 rounded-full hover:bg-gray-100"
                              title="Ver Imágenes"
                              disabled={!producto.imageUrl && (!producto.imageUrls || producto.imageUrls.length === 0)}
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
                              onClick={() => confirmDelete(producto.id)}
                              className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-gray-100"
                              title="Eliminar Producto"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Controles de paginación */}
          {filteredProductos.length > productsPerPage && (
            <div className="flex justify-between items-center mt-4">
              <p className="text-sm text-gray-700">
                Mostrando <span className="font-medium">{indexOfFirstProduct + 1}</span> a <span className="font-medium">{Math.min(indexOfLastProduct, filteredProductos.length)}</span> de <span className="font-medium">{filteredProductos.length}</span> resultados
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={goToPrevPage}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modales */}
      {isImageModalOpen && (
        <ImageModal 
          imageUrl={selectedProductForDetails?.imageUrl} 
          imageUrls={selectedProductForDetails?.imageUrls} 
          onClose={closeImageModal} 
        />
      )}
      <ProductDetailsModal isOpen={isProductDetailsModalOpen} onClose={closeProductDetailsModal} product={selectedProductForDetails} />
      <ProductModelsModal isOpen={isProductModelsModalOpen} onClose={closeProductModelsModal} product={selectedProductForModels} />
      <ConfirmModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={confirmAction} message={confirmMessage} />
      <AlertModal isOpen={isAlertModalOpen} onClose={() => setIsAlertModalOpen(false)} message={alertMessage} />
    </Layout>
  );
};

export default ProductosPage;