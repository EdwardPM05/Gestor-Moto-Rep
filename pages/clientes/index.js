// pages/clientes/index.js
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { PlusIcon, PencilIcon, TrashIcon, UserGroupIcon } from '@heroicons/react/24/outline'; // Añadido UserGroupIcon
import { useRouter } from 'next/router';

const ClientesPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredClientes, setFilteredClientes] = useState([]);

  useEffect(() => {
    const fetchClientes = async () => {
      if (!user) {
        router.push('/auth');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const q = query(collection(db, 'cliente'), orderBy('nombre', 'asc')); // Colección 'cliente' en singular
        const querySnapshot = await getDocs(q);
        const clientesList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setClientes(clientesList);
        setFilteredClientes(clientesList);
      } catch (err) {
        console.error("Error al cargar clientes:", err);
        setError("Error al cargar la información de clientes. Intente de nuevo.");
      } finally {
        setLoading(false);
      }
    };

    fetchClientes();
  }, [user, router]);

  useEffect(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const filtered = clientes.filter(cliente =>
      cliente.nombre.toLowerCase().includes(lowerCaseSearchTerm) ||
      cliente.apellido.toLowerCase().includes(lowerCaseSearchTerm) ||
      (cliente.dni && cliente.dni.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (cliente.email && cliente.email.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (cliente.telefono && cliente.telefono.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (cliente.direccion && cliente.direccion.toLowerCase().includes(lowerCaseSearchTerm))
    );
    setFilteredClientes(filtered);
  }, [searchTerm, clientes]);

  const handleDelete = async (clienteId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este cliente? Esta acción es irreversible.')) {
      try {
        await deleteDoc(doc(db, 'cliente', clienteId)); // Colección 'cliente' en singular
        setClientes(prevClientes => prevClientes.filter(c => c.id !== clienteId));
        alert('Cliente eliminado con éxito.');
      } catch (err) {
        console.error("Error al eliminar cliente:", err);
        setError("Error al eliminar el cliente. " + err.message);
        alert('Hubo un error al eliminar el cliente.');
      }
    }
  };

  if (!user) {
    return null;
  }

  return (
    <Layout title="Gestión de Clientes">
      <div className="max-w-7xl mx-auto p-4 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-gray-800 flex items-center">
          <UserGroupIcon className="h-7 w-7 text-green-500 mr-2" /> {/* Icono para Clientes */}
          Clientes
        </h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <input
            type="text"
            placeholder="Buscar clientes..."
            className="w-full md:w-1/3 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            onClick={() => router.push('/clientes/nuevo')} 
            className="ml-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Agregar Cliente
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          </div>
        ) : filteredClientes.length === 0 ? (
          <p className="text-gray-500">No se encontraron clientes.</p>
        ) : (
          <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Nombre Completo</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">DNI</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Teléfono</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Email</th>
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
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{cliente.email}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {cliente.tieneCredito ? (
                        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                          S/. {parseFloat(cliente.montoCreditoActual || 0).toFixed(2)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                          No tiene crédito
                        </span>
                      )}
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <div className="flex items-center space-x-2 justify-end">
                        <button
                          onClick={() => router.push(`/clientes/${cliente.id}`)}
                          className="text-green-600 hover:text-green-900 p-1 rounded-full hover:bg-gray-100"
                          title="Editar Cliente"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(cliente.id)}
                          className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-gray-100"
                          title="Eliminar Cliente"
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
    </Layout>
  );
};

export default ClientesPage;