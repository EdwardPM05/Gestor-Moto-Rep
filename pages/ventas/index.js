import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { db } from '../../lib/firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ShoppingCartIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  XCircleIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  TagIcon // Importar TagIcon
} from '@heroicons/react/24/outline';

const VentasIndexPage = () => {
  const { user } = useAuth();
  const router = useRouter();

  const [ventas, setVentas] = useState([]);
  const [filteredVentas, setFilteredVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) {
      router.push('/auth');
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(collection(db, 'ventas'), orderBy('fechaVenta', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ventasList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          fechaVenta: data.fechaVenta?.toDate ? data.fechaVenta.toDate().toLocaleDateString('es-ES') : 'N/A',
        };
      });
      setVentas(ventasList);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching ventas:", err);
      setError("Error al cargar las ventas: " + err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, router]);

  useEffect(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const filtered = ventas.filter(venta => {
      const numeroVentaMatch = venta.numeroVenta && typeof venta.numeroVenta === 'string'
        ? venta.numeroVenta.toLowerCase().includes(lowerCaseSearchTerm)
        : false;

      const clienteMatch = venta.clienteNombre && typeof venta.clienteNombre === 'string'
        ? venta.clienteNombre.toLowerCase().includes(lowerCaseSearchTerm)
        : false;

      const observacionesMatch = venta.observaciones && typeof venta.observaciones === 'string'
        ? venta.observaciones.toLowerCase().includes(lowerCaseSearchTerm)
        : false;

      const estadoMatch = venta.estado && typeof venta.estado === 'string'
        ? venta.estado.toLowerCase().includes(lowerCaseSearchTerm)
        : false;

      // Nuevo: Filtrar por tipo de venta
      const tipoVentaMatch = venta.tipoVenta && typeof venta.tipoVenta === 'string'
        ? venta.tipoVenta.toLowerCase().includes(lowerCaseSearchTerm)
        : false;

      return numeroVentaMatch || clienteMatch || observacionesMatch || estadoMatch || tipoVentaMatch;
    });
    setFilteredVentas(filtered);
  }, [searchTerm, ventas]);

  const handleViewDetails = (id) => {
    router.push(`/ventas/${id}`);
  };

  const handleAnularVenta = async (id) => {
    if (!window.confirm('¿Estás seguro de que deseas ANULAR esta venta? Esta acción es irreversible.')) {
      return;
    }

    try {
      const ventaRef = doc(db, 'ventas', id);
      // Solo actualizamos el estado a 'anulada'. La reversión de stock
      // y otras lógicas de devolución serían más complejas y se manejarían
      // en un flujo de "devoluciones" aparte si fuera necesario.
      await updateDoc(ventaRef, {
        estado: 'anulada',
        updatedAt: serverTimestamp(),
      });
      alert('Venta anulada con éxito.');
    } catch (err) {
      console.error("Error al anular venta:", err);
      setError("Error al anular la venta: " + err.message);
    }
  };

  return (
    <Layout title="Mis Ventas">
      <div className="flex flex-col mx-4 py-4">
        <div className="w-full p-6 bg-white rounded-lg shadow-md flex flex-col">

          <h1 className="text-2xl font-extrabold mb-6 text-gray-900 flex items-center">
            <ShoppingCartIcon className="h-8 w-8 text-green-600 mr-3" />
            Mis Ventas
          </h1>

          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
              <span className="block sm:inline font-medium">{error}</span>
            </div>
          )}

          <div className="mb-6 border border-gray-200 rounded-lg p-4 bg-gray-50 flex-shrink-0 flex justify-between items-center">
            <div className="relative flex-grow mr-4">
              <input
                type="text"
                placeholder="Buscar por número, cliente, observaciones, estado, tipo..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 text-base placeholder-gray-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" fill="currentColor" />
              </div>
            </div>
            <button
              onClick={() => router.push('/ventas/nueva')}
              className="inline-flex items-center px-6 py-2 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-150 ease-in-out"
            >
              <PlusIcon className="-ml-1 mr-3 h-5 w-5" aria-hidden="true" />
              Nueva Venta Directa
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-48">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
          ) : filteredVentas.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-lg">
              No hay ventas registradas que coincidan con la búsqueda.
            </div>
          ) : (
            <div className="overflow-x-auto shadow-lg ring-1 ring-black ring-opacity-5 rounded-lg overflow-y-auto max-h-[60vh]">
              <table className="min-w-full border-collapse">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">N° VENTA</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">CLIENTE</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">FECHA VENTA</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">TOTAL</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">TIPO VENTA</th> {/* <-- Nueva columna */}
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">ESTADO</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">MÉTODO PAGO</th> {/* <-- Nueva columna */}
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">REGISTRADO POR</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredVentas.map((venta, index) => (
                    <tr key={venta.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-900 text-left">
                        {venta.numeroVenta || 'N/A'}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">{venta.clienteNombre}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">{venta.fechaVenta}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black font-medium text-left">
                        S/. {parseFloat(venta.totalVenta || 0).toFixed(2)}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-center">
                        {venta.tipoVenta === 'cotizacionAprobada' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            <TagIcon className="h-4 w-4 mr-1" /> Aprobada (Cot.)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <ShoppingCartIcon className="h-4 w-4 mr-1" /> Directa
                          </span>
                        )}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-center">
                        {venta.estado === 'completada' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircleIcon className="h-4 w-4 mr-1" /> Completada
                          </span>
                        ) : venta.estado === 'anulada' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <XCircleIcon className="h-4 w-4 mr-1" /> Anulada
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-black">
                            <CurrencyDollarIcon className="h-4 w-4 mr-1" /> {venta.estado}
                          </span>
                        )}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">
                        {venta.metodoPago ? venta.metodoPago.charAt(0).toUpperCase() + venta.metodoPago.slice(1) : 'N/A'}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">{venta.empleadoId || 'Desconocido'}</td>
                      <td className="border border-gray-300 relative whitespace-nowrap px-3 py-2 text-sm font-medium text-center">
                        <div className="flex items-center space-x-2 justify-center">
                          <button
                            onClick={() => handleViewDetails(venta.id)}
                            className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50 transition duration-150 ease-in-out"
                            title="Ver Detalles de la Venta"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </button>
                          {venta.estado === 'completada' && (
                            <button
                              onClick={() => handleAnularVenta(venta.id)}
                              className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50 transition duration-150 ease-in-out ml-1"
                              title="Anular Venta"
                            >
                              <XCircleIcon className="h-5 w-5" />
                            </button>
                          )}
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

export default VentasIndexPage;