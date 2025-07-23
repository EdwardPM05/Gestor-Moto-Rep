// pages/cotizaciones/historial.js
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { useRouter } from 'next/router';
import { EyeIcon, CheckCircleIcon, XCircleIcon, DocumentTextIcon, ClockIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

const HistorialCotizacionesPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [cotizaciones, setCotizaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCotizaciones, setFilteredCotizaciones] = useState([]);

  useEffect(() => {
    const fetchCotizaciones = async () => {
      if (!user) {
        router.push('/auth');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const cotizacionesCollectionRef = collection(db, 'cotizaciones');
        // El historial debería mostrar todas las cotizaciones (confirmadas, canceladas, pendientes)
        const qCotizaciones = query(cotizacionesCollectionRef, orderBy('fechaCreacion', 'desc'));
        const querySnapshotCotizaciones = await getDocs(qCotizaciones);

        const loadedCotizaciones = [];
        for (const docCotizacion of querySnapshotCotizaciones.docs) {
          const cotizacionData = {
            id: docCotizacion.id,
            ...docCotizacion.data(),
            fechaCreacion: docCotizacion.data().fechaCreacion?.toDate().toLocaleDateString('es-ES', {
              year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }) || 'N/A',
            fechaExpiracion: docCotizacion.data().fechaExpiracion?.toDate().toLocaleDateString('es-ES', {
              year: 'numeric', month: 'long', day: 'numeric'
            }) || 'N/A',
            estado: docCotizacion.data().estado || 'pendiente',
          };
          loadedCotizaciones.push(cotizacionData);
        }

        setCotizaciones(loadedCotizaciones);
      } catch (err) {
        console.error("Error al cargar historial de cotizaciones:", err);
        setError("Error al cargar la información del historial de cotizaciones. Intente de nuevo.");
      } finally {
        setLoading(false);
      }
    };

    fetchCotizaciones();
  }, [user, router]);

  useEffect(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const filtered = cotizaciones.filter(cotizacion => {
      const numeroCotizacionMatch = cotizacion.numeroCotizacion && typeof cotizacion.numeroCotizacion === 'string'
        ? cotizacion.numeroCotizacion.toLowerCase().includes(lowerCaseSearchTerm)
        : false;

      const clienteMatch = cotizacion.clienteNombre && typeof cotizacion.clienteNombre === 'string'
        ? cotizacion.clienteNombre.toLowerCase().includes(lowerCaseSearchTerm)
        : false;

      const observacionesMatch = cotizacion.observaciones && typeof cotizacion.observaciones === 'string'
        ? cotizacion.observaciones.toLowerCase().includes(lowerCaseSearchTerm)
        : false;

      const estadoMatch = cotizacion.estado && typeof cotizacion.estado === 'string'
        ? cotizacion.estado.toLowerCase().includes(lowerCaseSearchTerm)
        : false;

      const empleadoMatch = cotizacion.empleadoId && typeof cotizacion.empleadoId === 'string'
        ? cotizacion.empleadoId.toLowerCase().includes(lowerCaseSearchTerm)
        : false;

      return numeroCotizacionMatch || clienteMatch || observacionesMatch || estadoMatch || empleadoMatch;
    });
    setFilteredCotizaciones(filtered);
  }, [searchTerm, cotizaciones]);

  const handleViewDetails = (cotizacionId) => {
    router.push(`/cotizaciones/${cotizacionId}`);
  };

  if (!user) {
    return null;
  }

  return (
    <Layout title="Historial de Cotizaciones">
      <div className="flex flex-col mx-4 py-4">
        <div className="w-full p-6 bg-white rounded-lg shadow-md flex flex-col">

          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
              <span className="block sm:inline font-medium">{error}</span>
            </div>
          )}

          <div className="mb-6 border border-gray-200 rounded-lg p-4 bg-gray-50 flex-shrink-0">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="Buscar por número, cliente, observaciones, estado, empleado..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base placeholder-gray-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" fill="currentColor" />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredCotizaciones.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 bg-gray-50 rounded-lg p-4 shadow-inner">
              <DocumentTextIcon className="h-24 w-24 text-gray-300 mb-4" />
              <p className="text-lg font-medium">No se encontraron cotizaciones en el historial.</p>
            </div>
          ) : (
            <div className="overflow-x-auto shadow-lg ring-1 ring-black ring-opacity-5 rounded-lg overflow-y-auto max-h-[60vh]">
              <table className="min-w-full border-collapse">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">N° COTIZACIÓN</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">CLIENTE</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">FECHA CREACIÓN</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">FECHA EXPIRACIÓN</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">TOTAL</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">ESTADO</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">REGISTRADO POR</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredCotizaciones.map((cotizacion, index) => (
                    <tr key={cotizacion.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-900 text-left">
                        {cotizacion.numeroCotizacion || 'N/A'}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-gray-700 text-left">{cotizacion.clienteNombre}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-gray-700 text-left">{cotizacion.fechaCreacion}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-gray-700 text-left">{cotizacion.fechaExpiracion}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-gray-700 font-medium text-left">
                        S/. {parseFloat(cotizacion.totalCotizacion || 0).toFixed(2)}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-center">
                        {cotizacion.estado === 'confirmada' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircleIcon className="h-4 w-4 mr-1" /> Confirmada
                          </span>
                        ) : cotizacion.estado === 'cancelada' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <XCircleIcon className="h-4 w-4 mr-1" /> Cancelada
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <DocumentTextIcon className="h-4 w-4 mr-1" /> Pendiente
                          </span>
                        )}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-gray-700 text-left">{cotizacion.empleadoId || 'Desconocido'}</td>
                      <td className="border border-gray-300 relative whitespace-nowrap px-3 py-2 text-sm font-medium text-center">
                        <div className="flex items-center space-x-2 justify-center">
                          <button
                            onClick={() => handleViewDetails(cotizacion.id)}
                            className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50 transition duration-150 ease-in-out"
                            title="Ver Detalles de la Cotización"
                          >
                            <EyeIcon className="h-5 w-5" />
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

export default HistorialCotizacionesPage;