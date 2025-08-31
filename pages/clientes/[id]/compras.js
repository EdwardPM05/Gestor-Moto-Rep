import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import Layout from '../../../components/Layout';
import { collection, query, where, onSnapshot, doc, getDocs } from 'firebase/firestore';
import { ArrowLeftIcon, ShoppingBagIcon, ChevronDownIcon, ChevronUpIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const ComprasPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const [cliente, setCliente] = useState(null);
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Estado para controlar qué venta está expandida para ver los detalles de los productos
  const [expandedVentaId, setExpandedVentaId] = useState(null);
  
  // Estados para la paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [limitPerPage, setLimitPerPage] = useState(10);

  // Redirigir si el usuario no está autenticado
  useEffect(() => {
    if (!user) {
      router.push('/auth');
    }
  }, [user, router]);

  // Manejador para expandir/colapsar los detalles de una venta
  const handleToggleExpand = (ventaId) => {
    setExpandedVentaId(expandedVentaId === ventaId ? null : ventaId);
  };

  // Cargar datos del cliente y sus ventas
  useEffect(() => {
    if (!id || !user) {
      return;
    }

    setLoading(true);
    setError(null);
    setExpandedVentaId(null); // Resetear el estado de expansión al cambiar de cliente
    setCurrentPage(1); // Resetear la página al cambiar de cliente

    // Listener para los datos del cliente, usando el ID del router
    const clienteRef = doc(db, 'cliente', id);
    const unsubscribeCliente = onSnapshot(clienteRef, (docSnap) => {
      if (docSnap.exists()) {
        setCliente({ id: docSnap.id, ...docSnap.data() });
      } else {
        console.error("Cliente no encontrado.");
        setError("Cliente no encontrado.");
        setCliente(null);
      }
    }, (err) => {
      console.error("Error al escuchar el cliente:", err);
      setError("Error al cargar la información del cliente. " + err.message);
    });

    // Listener para las ventas del cliente
    // Se requiere un índice en Firestore para 'ventas' en el campo 'clienteId'
    const qVentas = query(collection(db, 'ventas'), where('clienteId', '==', id));
    const unsubscribeVentas = onSnapshot(qVentas, async (querySnapshot) => {
      // Usamos Promise.all para esperar que todas las subcolecciones de itemsVenta se carguen
      const ventasWithItemsPromises = querySnapshot.docs.map(async (docVenta) => {
        const ventaData = {
          id: docVenta.id,
          ...docVenta.data(),
          fechaVenta: docVenta.data().fechaVenta?.toDate() || null,
        };

        // Fetch de la subcolección 'itemsVenta' para cada venta
        const itemsVentaSnapshot = await getDocs(collection(docVenta.ref, 'itemsVenta'));
        const items = itemsVentaSnapshot.docs.map(docItem => ({
          id: docItem.id,
          ...docItem.data()
        }));

        // Retornamos el objeto de venta con los items cargados
        return { ...ventaData, items };
      });

      const ventasList = await Promise.all(ventasWithItemsPromises);

      ventasList.sort((a, b) => b.fechaVenta - a.fechaVenta);
      
      setVentas(ventasList);
      setLoading(false);
    }, (err) => {
      console.error("Error al escuchar las ventas:", err);
      setError("Error al cargar las ventas del cliente. Es posible que falte un índice en Firestore. " + err.message);
      setVentas([]);
      setLoading(false);
    });

    // Función de limpieza para desuscribirse de los listeners
    return () => {
      unsubscribeCliente();
      unsubscribeVentas();
    };

  }, [id, user]);

  // Resetear a la primera página cuando cambie el límite por página
  useEffect(() => {
    setCurrentPage(1);
  }, [limitPerPage]);

  // Calcular datos de paginación
  const totalVentas = ventas.length;
  const totalPages = Math.ceil(totalVentas / limitPerPage);
  const startIndex = (currentPage - 1) * limitPerPage;
  const endIndex = startIndex + limitPerPage;
  const ventasPaginadas = ventas.slice(startIndex, endIndex);

  // Funciones de navegación de páginas
  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      setExpandedVentaId(null); // Colapsar cualquier venta expandida al cambiar página
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <Layout title={`Compras de ${cliente?.nombre || 'Cliente'}`}>
      <div className="flex flex-col mx-4 py-4">
        <div className="w-full p-4 bg-white rounded-lg shadow-md flex flex-col">
          {/* Encabezado de la página */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
            <div className="flex items-center">
              <ShoppingBagIcon className="h-8 w-8 text-indigo-600 mr-2" />
              <h1 className="text-xl font-bold text-gray-700">
                Historial de Compras de {cliente ? `${cliente.nombre} ${cliente.apellido}` : '...'}
              </h1>
            </div>
            <button
              onClick={() => router.push('/clientes')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <ArrowLeftIcon className="-ml-1 mr-2 h-5 w-5" />
              Volver a Clientes
            </button>
          </div>

          {loading && (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {!loading && !error && ventas.length === 0 && (
            <p className="p-4 text-center text-gray-500">Este cliente aún no ha realizado compras.</p>
          )}

          {!loading && !error && ventas.length > 0 && (
            <>
              {/* Controles de paginación superiores */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-700">
                    Mostrando {startIndex + 1}-{Math.min(endIndex, totalVentas)} de {totalVentas} compras
                  </span>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label htmlFor="limit-per-page" className="text-sm font-medium text-gray-700">
                      Por página:
                    </label>
                    {/* Selector de límite por página */}
                    <div className="flex-none min-w-[50px]">
                      <select
                        id="limit-per-page"
                        className="mt-0 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm h-[38px]"
                        value={limitPerPage}
                        onChange={(e) => {
                          setLimitPerPage(Number(e.target.value));
                        }}
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg overflow-y-auto">
                <table className="min-w-full border-collapse">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center"></th>
                      <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">FECHA DE VENTA</th>
                      <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">TOTAL</th>
                      <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">MÉTODO DE PAGO</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {ventasPaginadas.map((venta, index) => (
                      <>
                        <tr 
                          key={venta.id} 
                          className={`
                            ${expandedVentaId === venta.id 
                              ? 'bg-blue-50 border-2 border-blue-200' 
                              : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                            } 
                            hover:bg-gray-100 transition-colors
                          `}
                        >
                          {/* Celda para el botón de expansión */}
                          <td className="border border-gray-300 w-10 px-1 py-2 text-sm text-black text-center">
                            {venta.items?.length > 0 && (
                              <button 
                                onClick={() => handleToggleExpand(venta.id)} 
                                className={`focus:outline-none p-1 rounded ${expandedVentaId === venta.id ? 'bg-blue-200' : ''}`}
                              >
                                {expandedVentaId === venta.id ? (
                                  <ChevronUpIcon className="h-5 w-5 text-blue-600" />
                                ) : (
                                  <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                                )}
                              </button>
                            )}
                          </td>
                          <td className={`border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-center ${expandedVentaId === venta.id ? 'font-bold' : ''}`}>
                            {venta.fechaVenta ? venta.fechaVenta.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}
                          </td>
                          <td className={`border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-center font-bold ${expandedVentaId === venta.id ? 'text-blue-700' : ''}`}>
                            S/. {parseFloat(venta.totalVenta || 0).toFixed(2)}
                          </td>
                          <td className={`border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-center ${expandedVentaId === venta.id ? 'font-semibold' : ''}`}>
                            {venta.metodoPago || 'N/A'}
                          </td>
                        </tr>
                        {/* Fila expandible para mostrar los detalles de la compra */}
                        {expandedVentaId === venta.id && venta.items && (
                          <tr>
                            <td colSpan="4" className="border-0 p-0">
                              {/* Contenedor con fondo distintivo y borde */}
                              <div className="bg-gradient-to-r from-blue-100 via-blue-50 to-blue-100 border-l-4 border-blue-400 mx-2 mb-2 rounded-lg shadow-inner">
                                <div className="p-4">
                                  {/* Header con información de la venta seleccionada */}
                                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-blue-200">
                                    <h4 className="text-sm font-bold text-blue-800">
                                      📦 Productos comprados el {venta.fechaVenta ? venta.fechaVenta.toLocaleDateString('es-ES', { 
                                        weekday: 'long',
                                        day: '2-digit', 
                                        month: 'long', 
                                        year: 'numeric' 
                                      }) : 'N/A'}
                                    </h4>
                                  </div>
                                  
                                  {/* Tabla de productos con fondo distintivo */}
                                  <div className="overflow-x-auto rounded-lg">
                                    <table className="min-w-full border-collapse bg-white shadow-sm rounded-lg overflow-hidden">
                                      <thead className="bg-blue-200">
                                        <tr>
                                          <th scope="col" className="border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-800 text-left">Producto</th>
                                          <th scope="col" className="border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-800 text-center">Cantidad</th>
                                          <th scope="col" className="border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-800 text-center">Precio Unitario</th>
                                          <th scope="col" className="border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-800 text-center">Subtotal</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {venta.items.map((item, itemIndex) => (
                                          <tr key={itemIndex} className={itemIndex % 2 === 0 ? 'bg-white' : 'bg-blue-25'}>
                                            <td className="border border-blue-200 px-3 py-2 text-sm text-gray-800 font-medium">{item.nombreProducto}</td>
                                            <td className="border border-blue-200 px-3 py-2 text-sm text-gray-700 text-center">{item.cantidad}</td>
                                            <td className="border border-blue-200 px-3 py-2 text-sm text-gray-700 text-center">S/. {parseFloat(item.precioVentaUnitario || 0).toFixed(2)}</td>
                                            <td className="border border-blue-200 px-3 py-2 text-sm text-gray-800 text-center font-semibold">S/. {(parseFloat(item.cantidad) * parseFloat(item.precioVentaUnitario)).toFixed(2)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Controles de paginación inferiores */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-700">
                    Página {currentPage} de {totalPages}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={goToPreviousPage}
                      disabled={currentPage === 1}
                      className={`inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                        currentPage === 1
                          ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                          : 'text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                      }`}
                    >
                      <ChevronLeftIcon className="h-5 w-5 mr-1" />
                      Anterior
                    </button>

                    {/* Números de página */}
                    <div className="flex gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }

                        return (
                          <button
                            key={pageNum}
                            onClick={() => goToPage(pageNum)}
                            className={`px-3 py-2 text-sm font-medium rounded-md ${
                              currentPage === pageNum
                                ? 'bg-indigo-600 text-white'
                                : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={goToNextPage}
                      disabled={currentPage === totalPages}
                      className={`inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                        currentPage === totalPages
                          ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                          : 'text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                      }`}
                    >
                      Siguiente
                      <ChevronRightIcon className="h-5 w-5 ml-1" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ComprasPage;