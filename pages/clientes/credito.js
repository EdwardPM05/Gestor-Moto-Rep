// pages/clientes/credito.js
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { useRouter } from 'next/router';
import { CreditCardIcon, UserGroupIcon, MagnifyingGlassIcon, PencilIcon } from '@heroicons/react/24/outline'; // Asegúrate de importar los iconos

const ClientesConCreditoPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [clientesConCredito, setClientesConCredito] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredClientes, setFilteredClientes] = useState([]);

  useEffect(() => {
    const fetchClientesConCredito = async () => {
      if (!user) {
        router.push('/auth');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        // Query para obtener solo clientes con tieneCredito: true
        const q = query(
          collection(db, 'cliente'), // Colección 'cliente' en singular
          where('tieneCredito', '==', true),
          orderBy('nombre', 'asc')
        );
        const querySnapshot = await getDocs(q);
        const clientesList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setClientesConCredito(clientesList);
        setFilteredClientes(clientesList); // Inicialmente muestra todos los clientes con crédito
      } catch (err) {
        console.error("Error al cargar clientes con crédito:", err);
        setError("Error al cargar la información de clientes con crédito. Intente de nuevo.");
      } finally {
        setLoading(false);
      }
    };

    fetchClientesConCredito();
  }, [user, router]);

  useEffect(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const filtered = clientesConCredito.filter(cliente =>
      cliente.nombre.toLowerCase().includes(lowerCaseSearchTerm) ||
      cliente.apellido.toLowerCase().includes(lowerCaseSearchTerm) ||
      (cliente.dni && cliente.dni.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (cliente.email && cliente.email.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (cliente.telefono && cliente.telefono.toLowerCase().includes(lowerCaseSearchTerm))
    );
    setFilteredClientes(filtered);
  }, [searchTerm, clientesConCredito]);

  if (!user) {
    return null;
  }

  return (
    <Layout title="Clientes con Crédito">
      {/* Contenedor principal de la página, con margen horizontal */}
      <div className="flex flex-col mx-4 py-4">
        {/* Contenedor del card blanco */}
        <div className="w-full p-4 bg-white rounded-lg shadow-md flex flex-col">

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {/* Sección de Búsqueda, con estilo de card */}
          <div className="mb-4 border border-gray-200 rounded-lg p-4 bg-gray-50 flex-shrink-0 flex justify-between items-center">
            <div className="relative flex-grow"> {/* Usar flex-grow para que la barra de búsqueda ocupe el espacio disponible */}
              <input
                type="text"
                placeholder="Buscar por nombre, DNI, teléfono o email..." 
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredClientes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <UserGroupIcon className="h-24 w-24 text-gray-300 mb-4" />
              <p className="text-lg">No hay clientes con crédito activos o no coinciden con la búsqueda.</p>
            </div>
          ) : (
            <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg overflow-y-auto">
              <table className="min-w-full border-collapse"> {/* Añadido border-collapse */}
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    {/* Clases para los encabezados: border border-gray-300, px-3 py-2, text-center */}
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">Nombre Completo</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">DNI</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">Teléfono</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">Crédito Actual</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredClientes.map((cliente, index) => (
                    <tr key={cliente.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}> {/* Fondo alternado */}
                      {/* Clases para las celdas de datos: border border-gray-300, whitespace-nowrap px-3 py-2, text-sm text-black, text-center */}
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm font-medium text-black text-center">{cliente.nombre} {cliente.apellido}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-center">{cliente.dni || 'N/A'}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-center">{cliente.telefono || 'N/A'}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm font-semibold text-blue-600 text-center">
                        S/. {parseFloat(cliente.montoCreditoActual || 0).toFixed(2)}
                      </td>
                      <td className="border border-gray-300 relative whitespace-nowrap px-3 py-2 text-sm font-medium">
                        <div className="flex items-center space-x-2 justify-center">
                          <button
                            onClick={() => router.push(`/clientes/${cliente.id}`)}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded-full hover:bg-gray-100"
                            title="Ver/Editar Cliente"
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

export default ClientesConCreditoPage;