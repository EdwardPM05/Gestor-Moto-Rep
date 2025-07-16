// pages/productos/modelos.js
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { db } from '../../lib/firebase'; // Asegúrate de que tu instancia de Firestore se exporte como 'db'
import { collection, addDoc, getDocs, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

const ModelosMotoPage = () => {
  const { user } = useAuth();
  const [modelos, setModelos] = useState([]);
  const [newMarcaModelo, setNewMarcaModelo] = useState('');
  const [newNombreModelo, setNewNombreModelo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchModelos = async () => {
      if (!user) return; // O redirigir si no hay usuario logueado
      setLoading(true);
      setError(null);
      try {
        const q = query(collection(db, 'modelosMoto'), orderBy('marcaModelo', 'asc'));
        const querySnapshot = await getDocs(q);
        const fetchedModelos = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setModelos(fetchedModelos);
      } catch (err) {
        console.error("Error fetching modelos de moto:", err);
        setError("Error al cargar los modelos de moto.");
      } finally {
        setLoading(false);
      }
    };

    fetchModelos();
  }, [user]);

  const handleAddModelo = async (e) => {
    e.preventDefault();
    if (!newMarcaModelo.trim() || !newNombreModelo.trim()) {
      alert('Ambos campos (Marca y Nombre del Modelo) son obligatorios.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await addDoc(collection(db, 'modelosMoto'), {
        marcaModelo: newMarcaModelo.trim(),
        nombreModelo: newNombreModelo.trim(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      setNewMarcaModelo('');
      setNewNombreModelo('');
      // Vuelve a cargar los modelos para actualizar la lista
      const q = query(collection(db, 'modelosMoto'), orderBy('marcaModelo', 'asc'));
      const querySnapshot = await getDocs(q);
      const fetchedModelos = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setModelos(fetchedModelos);
    } catch (err) {
      console.error("Error adding modelo de moto:", err);
      setError("Error al agregar el modelo de moto.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModelo = async (id) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este modelo de moto?')) return;
    setLoading(true);
    setError(null);
    try {
      await deleteDoc(doc(db, 'modelosMoto', id));
      setModelos(modelos.filter(modelo => modelo.id !== id));
    } catch (err) {
      console.error("Error deleting modelo de moto:", err);
      setError("Error al eliminar el modelo de moto.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout title="Cargando Modelos">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Error">
        <div className="text-center text-red-600 p-4">
          <p>{error}</p>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return <Layout title="Acceso Denegado"><p className="text-center p-4">Debes iniciar sesión para ver esta página.</p></Layout>;
  }

  return (
    <Layout title="Modelos de Moto">
      <div className="max-w-4xl mx-auto p-4 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">Gestión de Modelos de Moto</h1>

        {/* Formulario para agregar nuevo modelo */}
        <div className="mb-8 p-6 border rounded-lg bg-gray-50">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Agregar Nuevo Modelo</h2>
          <form onSubmit={handleAddModelo} className="space-y-4">
            <div>
              <label htmlFor="marcaModelo" className="block text-sm font-medium text-gray-700">
                Marca del Modelo
              </label>
              <input
                type="text"
                id="marcaModelo"
                value={newMarcaModelo}
                onChange={(e) => setNewMarcaModelo(e.target.value)}
                placeholder="Ej: Honda"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="nombreModelo" className="block text-sm font-medium text-gray-700">
                Nombre del Modelo
              </label>
              <input
                type="text"
                id="nombreModelo"
                value={newNombreModelo}
                onChange={(e) => setNewNombreModelo(e.target.value)}
                placeholder="Ej: CBR 600 RR"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={loading}
            >
              <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
              {loading ? 'Agregando...' : 'Agregar Modelo'}
            </button>
          </form>
        </div>

        {/* Lista de modelos existentes */}
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Modelos Existentes ({modelos.length})</h2>
        <div className="overflow-x-auto rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Marca
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Modelo
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {modelos.map((modelo) => (
                <tr key={modelo.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {modelo.marcaModelo}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {modelo.nombreModelo}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleDeleteModelo(modelo.id)}
                      className="text-red-600 hover:text-red-900 ml-4"
                      disabled={loading}
                      title="Eliminar modelo"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {modelos.length === 0 && !loading && (
          <p className="text-center text-gray-500 mt-4">No hay modelos de moto registrados.</p>
        )}
      </div>
    </Layout>
  );
};

export default ModelosMotoPage;