// pages/proveedores/index.js
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { PlusIcon, PencilIcon, TrashIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline'; // Añadido BuildingOfficeIcon
import { useRouter } from 'next/router';

const ProveedoresPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredProveedores, setFilteredProveedores] = useState([]);

  useEffect(() => {
    const fetchProveedores = async () => {
      if (!user) {
        router.push('/auth');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const q = query(collection(db, 'proveedores'), orderBy('nombreEmpresa', 'asc'));
        const querySnapshot = await getDocs(q);
        const proveedoresList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProveedores(proveedoresList);
        setFilteredProveedores(proveedoresList);
      } catch (err) {
        console.error("Error al cargar proveedores:", err);
        setError("Error al cargar los proveedores. Intente de nuevo.");
      } finally {
        setLoading(false);
      }
    };

    fetchProveedores();
  }, [user, router]);

  useEffect(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const filtered = proveedores.filter(proveedor =>
      proveedor.nombreEmpresa.toLowerCase().includes(lowerCaseSearchTerm) ||
      (proveedor.contactoPrincipal && proveedor.contactoPrincipal.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (proveedor.ruc && proveedor.ruc.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (proveedor.email && proveedor.email.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (proveedor.telefono && proveedor.telefono.toLowerCase().includes(lowerCaseSearchTerm))
    );
    setFilteredProveedores(filtered);
  }, [searchTerm, proveedores]);

  const handleDelete = async (proveedorId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este proveedor? Esta acción es irreversible.')) {
      try {
        await deleteDoc(doc(db, 'proveedores', proveedorId));
        setProveedores(prevProveedores => prevProveedores.filter(p => p.id !== proveedorId));
        alert('Proveedor eliminado con éxito.');
      } catch (err) {
        console.error("Error al eliminar proveedor:", err);
        setError("Error al eliminar el proveedor. " + err.message);
        alert('Hubo un error al eliminar el proveedor.');
      }
    }
  };

  if (!user) {
    return null;
  }

  return (
    <Layout title="Gestión de Proveedores">
      <div className="max-w-7xl mx-auto p-4 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-gray-800 flex items-center">
          <BuildingOfficeIcon className="h-7 w-7 text-indigo-500 mr-2" />
          Proveedores
        </h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <input
            type="text"
            placeholder="Buscar proveedores..."
            className="w-full md:w-1/3 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            onClick={() => router.push('/proveedores/nuevo')}
            className="ml-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Agregar Proveedor
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : filteredProveedores.length === 0 ? (
          <p className="text-gray-500">No se encontraron proveedores.</p>
        ) : (
          <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Empresa</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Contacto</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">RUC</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Teléfono</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Email</th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredProveedores.map((proveedor) => (
                  <tr key={proveedor.id}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{proveedor.nombreEmpresa}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{proveedor.contactoPrincipal}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{proveedor.ruc}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{proveedor.telefono}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{proveedor.email}</td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <div className="flex items-center space-x-2 justify-end">
                        <button
                          onClick={() => router.push(`/proveedores/${proveedor.id}`)}
                          className="text-indigo-600 hover:text-indigo-900 p-1 rounded-full hover:bg-gray-100"
                          title="Editar Proveedor"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(proveedor.id)}
                          className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-gray-100"
                          title="Eliminar Proveedor"
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

export default ProveedoresPage;