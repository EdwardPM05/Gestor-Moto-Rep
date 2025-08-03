// pages/clientes/index.js
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, deleteDoc, doc } from 'firebase/firestore'; // Importamos `query` y `getDocs`
import { PlusIcon, PencilIcon, TrashIcon, GiftIcon, ShoppingBagIcon,UserGroupIcon } from '@heroicons/react/24/outline'; // Añadido ShoppingBagIcon para la nueva acción
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
        // Redirigir si el usuario no está autenticado
        router.push('/auth');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        // En Firestore, es mejor no usar orderBy para evitar la necesidad de índices.
        // Si no es un requisito estricto, se puede ordenar en el cliente.
        // Opcional: const q = query(collection(db, 'cliente'), orderBy('nombre', 'asc'));
        const q = query(collection(db, 'cliente')); 
        const querySnapshot = await getDocs(q);
        const clientesList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Asegurarse de que fechaNacimiento esté en un formato manejable si existe
          fechaNacimiento: doc.data().fechaNacimiento || ''
        })).sort((a, b) => a.nombre.localeCompare(b.nombre)); // Ordenar por nombre en el cliente

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
      (cliente.apellido && cliente.apellido.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (cliente.dni && cliente.dni.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (cliente.email && cliente.email.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (cliente.telefono && cliente.telefono.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (cliente.direccion && cliente.direccion.toLowerCase().includes(lowerCaseSearchTerm))
    );
    setFilteredClientes(filtered);
  }, [searchTerm, clientes]);

  // Función para formatear la fecha de cumpleaños (solo día y mes)
  const formatBirthday = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString + 'T00:00:00'); // Añadir T00:00:00 para evitar problemas de zona horaria
    if (isNaN(date.getTime())) return 'N/A'; // Verificar si la fecha es válida
    const day = date.getDate();
    const month = date.toLocaleString('es-ES', { month: 'long' });
    return `${day} de ${month}`;
  };

  const handleDelete = async (clienteId) => {
    // NOTA: Para una mejor experiencia de usuario, es recomendable usar un modal
    // en lugar de `window.confirm`. Mantendré el tuyo por ahora.
    if (window.confirm('¿Estás seguro de que quieres eliminar este cliente? Esta acción es irreversible.')) {
      try {
        await deleteDoc(doc(db, 'cliente', clienteId));
        setClientes(prevClientes => prevClientes.filter(c => c.id !== clienteId));
        // NOTA: Usa un modal o un mensaje en pantalla en lugar de `alert()`.
        alert('Cliente eliminado con éxito.');
      } catch (err) {
        console.error("Error al eliminar cliente:", err);
        setError("Error al eliminar el cliente. " + err.message);
        // NOTA: Usa un modal o un mensaje en pantalla en lugar de `alert()`.
        alert('Hubo un error al eliminar el cliente.');
      }
    }
  };

  if (!user) {
    return null;
  }

  return (
    <Layout title="Gestión de Clientes">
      {/* Contenedor principal de la página, con margen horizontal */}
      <div className="flex flex-col mx-4 py-4">
        {/* Contenedor del card blanco */}
        <div className="w-full p-4 bg-white rounded-lg shadow-md flex flex-col">
          {/* Título de la página, similar al de Productos/Proveedores */}
          <div className="flex items-center mb-4">
            <UserGroupIcon className="h-8 w-8 text-green-600 mr-2" />
            <h1 className="text-xl font-bold text-gray-700">Gestión de Clientes</h1>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {/* Sección de Búsqueda y Botón Agregar, con estilo de card */}
          <div className="mb-4 border border-gray-200 rounded-lg p-4 bg-gray-50 flex-shrink-0 flex justify-between items-center">
            <input
              type="text"
              placeholder="Buscar por nombre, DNI, teléfono, email o dirección..." 
              className="flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
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
            <p className="p-4 text-center text-gray-500">No se encontraron clientes que coincidan con la búsqueda.</p>
          ) : (
            <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg overflow-y-auto">
              <table className="min-w-full border-collapse">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">NOMBRE COMPLETO</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">DNI</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">TELEFONO</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">EMAIL</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">CUMPLEAÑOS</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">CREDITO ACTUAL</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredClientes.map((cliente, index) => (
                    <tr key={cliente.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm font-medium text-black text-left">{cliente.nombre} {cliente.apellido}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">{cliente.dni || 'N/A'}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">{cliente.telefono || 'N/A'}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">{cliente.email || 'N/A'}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">
                        {formatBirthday(cliente.fechaNacimiento)}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">
                        {cliente.tieneCredito ? (
                          <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                            S/. {parseFloat(cliente.montoCreditoActual || 0).toFixed(2)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                            No
                          </span>
                        )}
                      </td>
                      <td className="border border-gray-300 relative whitespace-nowrap px-3 py-2 text-sm font-medium">
                        <div className="flex items-center space-x-2 justify-center">
                          {/* Nuevo botón de acción para ver las compras del cliente */}
                          <button
                            onClick={() => router.push(`/clientes/${cliente.id}/compras`)}
                            className="text-indigo-600 hover:text-indigo-900 p-1 rounded-full hover:bg-gray-100"
                            title="Ver Compras"
                          >
                            <ShoppingBagIcon className="h-5 w-5" />
                          </button>
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
      </div>
    </Layout>
  );
};

export default ClientesPage;
