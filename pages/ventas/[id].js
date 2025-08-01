import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { db } from '../../lib/firebase';
import { doc, getDoc, collection, query, getDocs, orderBy } from 'firebase/firestore';
import { ArrowLeftIcon, ReceiptPercentIcon, UserIcon, CalendarDaysIcon, TagIcon, BanknotesIcon,ShoppingCartIcon } from '@heroicons/react/24/outline'; // Importa iconos adicionales

const VentaDetailPage = () => {
  const { user } = useAuth();
  const router = useRouter();
  const { id } = router.query; // Obtiene el ID de la venta de la URL

  const [venta, setVenta] = useState(null);
  const [itemsVenta, setItemsVenta] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      router.push('/auth');
      return;
    }

    if (!id) {
      setLoading(false);
      return; // Esperar a que el ID esté disponible
    }

    const fetchVentaDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        // Obtener el documento principal de la venta
        const ventaRef = doc(db, 'ventas', id);
        const ventaSnap = await getDoc(ventaRef);

        if (!ventaSnap.exists()) {
          setError('Venta no encontrada.');
          setLoading(false);
          return;
        }

        const ventaData = ventaSnap.data();

        // Formatear la fecha
        ventaData.fechaVentaFormatted = ventaData.fechaVenta?.toDate
          ? ventaData.fechaVenta.toDate().toLocaleDateString('es-ES', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : 'N/A';

        setVenta({ id: ventaSnap.id, ...ventaData });

        // Obtener los ítems de la subcolección 'itemsVenta'
        const itemsCollectionRef = collection(db, 'ventas', id, 'itemsVenta');
        const qItems = query(itemsCollectionRef, orderBy('createdAt', 'asc')); // O el campo que uses para ordenar
        const itemsSnapshot = await getDocs(qItems);
        const fetchedItems = itemsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setItemsVenta(fetchedItems);

      } catch (err) {
        console.error("Error al cargar detalles de la venta:", err);
        setError("Error al cargar los detalles de la venta: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchVentaDetails();
  }, [id, user, router]);

  if (loading) {
    return (
      <Layout title="Cargando Venta...">
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600"></div>
          <p className="ml-4 text-lg text-gray-700">Cargando detalles de la venta...</p>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Error">
        <div className="flex flex-col items-center justify-center h-screen px-4">
          <div className="bg-red-50 border border-red-300 text-red-700 px-6 py-4 rounded-lg relative mb-6 text-center shadow-md" role="alert">
            <span className="block text-lg font-medium mb-2">¡Error!</span>
            <span className="block">{error}</span>
          </div>
          <button
            onClick={() => router.push('/ventas')}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
          >
            <ArrowLeftIcon className="-ml-1 mr-3 h-5 w-5" aria-hidden="true" />
            Volver al Historial de Ventas
          </button>
        </div>
      </Layout>
    );
  }

  if (!venta) {
    // Esto debería ser capturado por el error, pero es una fallback
    return (
      <Layout title="Venta no encontrada">
        <div className="text-center py-10">
          <p className="text-xl text-gray-600">No se pudo cargar la información de la venta.</p>
          <button
            onClick={() => router.push('/ventas')}
            className="mt-6 inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            Volver al Historial de Ventas
          </button>
        </div>
      </Layout>
    );
  }

  const getEstadoClass = (estado) => {
    switch (estado) {
      case 'completada':
        return 'bg-green-100 text-green-800';
      case 'anulada':
        return 'bg-red-100 text-red-800';
      case 'pendiente':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTipoVentaIcon = (tipoVenta) => {
    if (tipoVenta === 'cotizacionAprobada') {
      return <TagIcon className="h-5 w-5 mr-2" />;
    }
    return <ShoppingCartIcon className="h-5 w-5 mr-2" />;
  };

  return (
    <Layout title={`Detalle Venta #${venta.numeroVenta || venta.id.substring(0, 8)}`}>
      <div className="flex flex-col mx-4 py-4">
        <div className="w-full p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-6 border-b pb-4">
            <h1 className="text-3xl font-extrabold text-gray-900 flex items-center">
              Detalle de Venta
              <span className="ml-3 text-blue-700">#{venta.numeroVenta || venta.id.substring(0, 8).toUpperCase()}</span>
            </h1>
            <button
              onClick={() => router.push('/ventas')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition duration-150 ease-in-out"
            >
              <ArrowLeftIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
              Volver
            </button>
          </div>

          {/* Sección de Datos de la Venta */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 mb-8">
            <div className="flex items-center text-gray-700">
              <UserIcon className="h-5 w-5 mr-2 text-gray-500" />
              <p><span className="font-semibold">Cliente:</span> {venta.clienteNombre} {venta.clienteDNI && `(DNI: ${venta.clienteDNI})`}</p>
            </div>
            <div className="flex items-center text-gray-700">
              <CalendarDaysIcon className="h-5 w-5 mr-2 text-gray-500" />
              <p><span className="font-semibold">Fecha:</span> {venta.fechaVentaFormatted}</p>
            </div>
            <div className="flex items-center text-gray-700">
              {getTipoVentaIcon(venta.tipoVenta)}
              <p><span className="font-semibold">Tipo de Venta:</span>
                <span className={`ml-2 px-2.5 py-0.5 rounded-full text-xs font-medium ${venta.tipoVenta === 'cotizacionAprobada' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                  {venta.tipoVenta === 'cotizacionAprobada' ? 'Aprobada (Cotización)' : 'Directa'}
                </span>
              </p>
            </div>
            <div className="flex items-center text-gray-700">
              <BanknotesIcon className="h-5 w-5 mr-2 text-gray-500" />
              <p><span className="font-semibold">Método de Pago:</span> {venta.metodoPago ? venta.metodoPago.charAt(0).toUpperCase() + venta.metodoPago.slice(1) : 'N/A'}</p>
            </div>
            <div className="flex items-center text-gray-700">
              <ReceiptPercentIcon className="h-5 w-5 mr-2 text-gray-500" />
              <p><span className="font-semibold">Descuento:</span> {parseFloat(venta.descuentoPorcentaje || 0).toFixed(0)}%</p>
            </div>
            <div className="flex items-center text-gray-700">
              <p><span className="font-semibold">Registrado por:</span> {venta.empleadoId || 'Desconocido'}</p>
            </div>
            <div classNamename="flex items-center text-gray-700 md:col-span-2">
              <p><span className="font-semibold">Observaciones:</span> {venta.observaciones || 'Sin observaciones'}</p>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">Productos Vendidos</h3>
            {itemsVenta.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No hay productos registrados para esta venta.</p>
            ) : (
              <div className="overflow-x-auto shadow-sm ring-1 ring-black ring-opacity-5 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio Unitario</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {itemsVenta.map((item) => (
                      <tr key={item.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.nombreProducto}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.cantidad}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">S/. {parseFloat(item.precioVentaUnitario || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">S/. {parseFloat(item.subtotal || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Resumen Final */}
          <div className="flex justify-end items-center border-t pt-4 mt-6">
            <div className="text-right">
              <p className="text-xl font-semibold text-gray-800">
                Estado:
                <span className={`ml-2 px-3 py-1 rounded-full text-sm font-bold ${getEstadoClass(venta.estado)}`}>
                  {venta.estado.charAt(0).toUpperCase() + venta.estado.slice(1)}
                </span>
              </p>
              <p className="text-3xl font-extrabold text-green-700 mt-4">
                Total Venta: S/. {parseFloat(venta.totalVenta || 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default VentaDetailPage;