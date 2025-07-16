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
      <div className="max-w-7xl mx-auto p-4 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-gray-800 flex items-center">
          <CreditCardIcon className="h-7 w-7 text-blue-500 mr-2" />
          Clientes con Crédito
        </h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <div className="mb-6">
          <div className="relative w-full md:w-1/3">
            <input
              type="text"
              placeholder="Buscar cliente por nombre, DNI, etc."
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
            <p className="text-lg">No hay clientes con crédito activos.</p>
          </div>
        ) : (
          <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Nombre Completo</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">DNI</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Teléfono</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Crédito Actual</th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredClientes.map((cliente) => (
                  <tr key={cliente.id}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{cliente.nombre} {cliente.apellido}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{cliente.dni}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{cliente.telefono}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm font-semibold text-blue-600">S/. {parseFloat(cliente.montoCreditoActual || 0).toFixed(2)}</td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <button
                        onClick={() => router.push(`/clientes/${cliente.id}`)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded-full hover:bg-gray-100"
                        title="Ver/Editar Cliente"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ClientesConCreditoPage;