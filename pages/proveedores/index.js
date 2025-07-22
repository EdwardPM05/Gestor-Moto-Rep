// pages/proveedores/index.js
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { PlusIcon, PencilIcon, TrashIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';
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
        setFilteredProveedores(prevFiltered => prevFiltered.filter(p => p.id !== proveedorId));
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
      {/* Contenedor principal de la página, con margen horizontal */}
      <div className="flex flex-col mx-4 py-4">
        {/* Contenedor del card blanco */}
        <div className="w-full p-4 bg-white rounded-lg shadow-md flex flex-col">

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {/* Sección de Búsqueda y Botón Agregar */}
          <div className="mb-4 border border-gray-200 rounded-lg p-4 bg-gray-50 flex-shrink-0 flex justify-between items-center">
            <input
              type="text"
              placeholder="Buscar por nombre, contacto, RUC, email o teléfono..."
              className="flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
            <p className="p-4 text-center text-gray-500">No se encontraron proveedores que coincidan con la búsqueda.</p>
          ) : (
            <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg overflow-y-auto">
              <table className="min-w-full border-collapse"> {/* Añadido border-collapse para los bordes de celda */}
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    {/* Clases para los encabezados: border border-gray-300, px-3 py-2, text-center */}
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">NOMBRE DE EMPRESA</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">CONTACTO</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">RUC</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">TELEFONO</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">EMAIL</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredProveedores.map((proveedor, index) => (
                    <tr key={proveedor.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}> {/* Fondo alternado */}
                      {/* Clases para las celdas de datos: border border-gray-300, whitespace-nowrap px-3 py-2, text-sm text-black, text-center */}
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm font-medium text-black text-left">{proveedor.nombreEmpresa}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">{proveedor.contactoPrincipal || 'N/A'}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">{proveedor.ruc || 'N/A'}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">{proveedor.telefono || 'N/A'}</td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">{proveedor.email || 'N/A'}</td>
                      <td className="border border-gray-300 relative whitespace-nowrap px-3 py-2 text-sm font-medium">
                        <div className="flex items-center space-x-2 justify-center">
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
      </div>
    </Layout>
  );
};

export default ProveedoresPage;