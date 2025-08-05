// pages/empleados/index.js
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, deleteDoc, doc } from 'firebase/firestore';
import { PlusIcon, PencilIcon, TrashIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/router';

const EmpleadosPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredEmpleados, setFilteredEmpleados] = useState([]);

  useEffect(() => {
    const fetchEmpleados = async () => {
      if (!user) {
        // Redirigir si el usuario no está autenticado
        router.push('/auth');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const q = query(collection(db, 'empleado'));
        const querySnapshot = await getDocs(q);
        const empleadosList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')); // Ordenar por nombre en el cliente, manejando valores nulos

        setEmpleados(empleadosList);
        setFilteredEmpleados(empleadosList);
      } catch (err) {
        console.error("Error al cargar empleados:", err);
        setError("Error al cargar la información de empleados. Intente de nuevo.");
      } finally {
        setLoading(false);
      }
    };

    fetchEmpleados();
  }, [user, router]);

  useEffect(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const filtered = empleados.filter(empleado =>
      (empleado.nombre && empleado.nombre.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (empleado.apellido && empleado.apellido.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (empleado.dni && empleado.dni.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (empleado.email && empleado.email.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (empleado.telefono && empleado.telefono.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (empleado.fechaNacimiento && empleado.fechaNacimiento.toLowerCase().includes(lowerCaseSearchTerm))
    );
    setFilteredEmpleados(filtered);
  }, [searchTerm, empleados]);

  const handleDelete = async (empleadoId) => {
    // NOTA: Para una mejor experiencia de usuario, es recomendable usar un modal
    // en lugar de `window.confirm`. Mantendré el tuyo por ahora.
    // También se ha eliminado `alert` para evitar interrupciones.
    if (window.confirm('¿Estás seguro de que quieres eliminar este empleado? Esta acción es irreversible.')) {
      try {
        await deleteDoc(doc(db, 'empleado', empleadoId));
        setEmpleados(prevEmpleados => prevEmpleados.filter(e => e.id !== empleadoId));
        console.log('Empleado eliminado con éxito.');
      } catch (err) {
        console.error("Error al eliminar empleado:", err);
        setError("Error al eliminar el empleado. " + err.message);
        console.error('Hubo un error al eliminar el empleado.');
      }
    }
  };

  if (!user) {
    return null;
  }

  return (
    <Layout title="Gestión de Empleados">
      {/* Contenedor principal de la página */}
      <div className="flex flex-col mx-4 py-4">
        {/* Contenedor del card blanco */}
        <div className="w-full p-4 bg-white rounded-lg shadow-md flex flex-col">
          {/* Título de la página */}
          <div className="flex items-center mb-4">
            <UserGroupIcon className="h-8 w-8 text-indigo-600 mr-2" />
            <h1 className="text-xl font-bold text-gray-700">Gestión de Empleados</h1>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {/* Sección de Búsqueda y Botón Agregar */}
          <div className="mb-4 border border-gray-200 rounded-lg p-4 bg-gray-50 flex-shrink-0 flex justify-between items-center">
            {/* Campo de búsqueda con ID, NAME y un LABEL asociado */}
            <label htmlFor="search-empleados" className="sr-only">Buscar Empleados</label>
            <input
              type="text"
              id="search-empleados"
              name="search-empleados"
              placeholder="Buscar por nombre, DNI, email, teléfono o cumpleaños..."
              className="flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoComplete="off"
            />
            <button
              onClick={() => router.push('/empleados/nuevo')}
              className="ml-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
              Agregar Empleado
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : filteredEmpleados.length === 0 ? (
            <p className="p-4 text-center text-gray-500">No se encontraron empleados que coincidan con la búsqueda.</p>
          ) : (
            <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg overflow-y-auto">
              <table className="min-w-full border-collapse">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">NOMBRE COMPLETO</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">DNI</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">TELEFONO</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">EMAIL</th>
                    {/* Se añade la columna de Fecha de Nacimiento */}
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">FECHA DE NACIMIENTO</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">PUESTO</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredEmpleados.map((empleado, index) => (
                    <tr key={empleado.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm font-medium text-black text-left">{empleado.nombre} {empleado.apellido}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">{empleado.dni || 'N/A'}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">{empleado.telefono || 'N/A'}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">{empleado.email || 'N/A'}</td>
                      {/* Se muestra la Fecha de Nacimiento */}
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">{empleado.fechaNacimiento || 'N/A'}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">{empleado.puesto || 'N/A'}</td>
                      <td className="border border-gray-300 relative whitespace-nowrap px-3 py-2 text-sm font-medium">
                        <div className="flex items-center space-x-2 justify-center">
                          <button
                            onClick={() => router.push(`/empleados/${empleado.id}`)}
                            className="text-indigo-600 hover:text-indigo-900 p-1 rounded-full hover:bg-gray-100"
                            title="Editar Empleado"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(empleado.id)}
                            className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-gray-100"
                            title="Eliminar Empleado"
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

export default EmpleadosPage;
