// pages/inventario/stock/[productId].js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../../contexts/AuthContext';
import Layout from '../../../components/Layout';
import { db } from '../../../lib/firebase';
import { collection, getDocs, query, where, doc, getDoc, orderBy } from 'firebase/firestore';
import { ArrowLeftIcon, CubeTransparentIcon } from '@heroicons/react/24/outline'; // Iconos

const ProductLotesDetail = () => {
  const router = useRouter();
  const { productId } = router.query; // Obtener el ID del producto de la URL
  const { user } = useAuth();

  const [product, setProduct] = useState(null);
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProductAndLotes = async () => {
      if (!user || !productId) {
        // Redirigir si no hay usuario o productId no está disponible todavía
        if (!user) router.push('/auth');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        // 1. Obtener detalles del producto principal
        const productRef = doc(db, 'productos', productId);
        const productSnap = await getDoc(productRef);

        if (!productSnap.exists()) {
          setError("Producto no encontrado.");
          setLoading(false);
          return;
        }
        setProduct({ id: productSnap.id, ...productSnap.data() });

        // 2. Buscar ítems de ingreso (lotes) para este producto
        // Esto es un poco más complejo porque los itemsIngreso están en subcolecciones.
        // Necesitamos recorrer todos los documentos de 'ingresos' y sus 'itemsIngreso'.

        const allIngresosRefs = collection(db, 'ingresos');
        const querySnapshotIngresos = await getDocs(allIngresosRefs);

        const loadedLotes = [];
        for (const docIngreso of querySnapshotIngresos.docs) {
          const itemsIngresoCollectionRef = collection(db, 'ingresos', docIngreso.id, 'itemsIngreso');
          const qItemsIngreso = query(
            itemsIngresoCollectionRef,
            where('productoId', '==', productId), // Filtrar por el ID del producto actual
            orderBy('createdAt', 'asc') // O ordenar por stockRestanteLote, o fecha de vencimiento
          );
          const querySnapshotItemsIngreso = await getDocs(qItemsIngreso);

          querySnapshotItemsIngreso.docs.forEach(docItem => {
            loadedLotes.push({
              id: docItem.id,
              lotePrincipalId: docIngreso.id, // ID del documento principal de ingreso
              fechaIngresoPrincipal: docIngreso.data().fechaIngreso?.toDate().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) || 'N/A',
              observacionesLotePrincipal: docIngreso.data().observaciones || 'Sin observaciones',
              ...docItem.data()
            });
          });
        }
        // Opcional: Ordenar los lotes para la vista (ej. por stock restante, o por fecha de ingreso)
        // Por ejemplo, para FIFO, podrías ordenar por fecha de ingreso principal
        loadedLotes.sort((a, b) => {
            if (a.fechaIngresoPrincipal && b.fechaIngresoPrincipal) {
                // Convertir la cadena de fecha formateada a un objeto Date para comparar
                const dateA = new Date(a.fechaIngresoPrincipal);
                const dateB = new Date(b.fechaIngresoPrincipal);
                return dateA.getTime() - dateB.getTime();
            }
            return 0;
        });

        setLotes(loadedLotes);

      } catch (err) {
        console.error("Error al cargar detalles de producto y lotes:", err);
        setError("Error al cargar la información de los lotes. " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProductAndLotes();
  }, [user, productId, router]); // Dependencia productId para re-fetch cuando cambie

  if (!user || loading) {
    return (
      <Layout title="Cargando Detalles del Lote">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Error">
        <div className="max-w-7xl mx-auto p-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <span className="block sm:inline">{error}</span>
          <button onClick={() => router.back()} className="mt-4 text-sm text-red-800 hover:underline flex items-center">
            <ArrowLeftIcon className="h-4 w-4 mr-1" /> Volver
          </button>
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout title="Producto no encontrado">
        <p className="text-gray-500 text-center py-10">Producto no encontrado.</p>
        <button onClick={() => router.back()} className="mt-4 text-sm text-gray-800 hover:underline flex items-center">
            <ArrowLeftIcon className="h-4 w-4 mr-1" /> Volver al Stock
          </button>
      </Layout>
    );
  }

  return (
    <Layout title={`Lotes de ${product.nombre}`}>
      <div className="max-w-7xl mx-auto p-4 bg-white rounded-lg shadow-md">
        <div className="flex items-center mb-6">
          <button
            onClick={() => router.push('/inventario/stock')}
            className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-1" />
            Volver al Stock
          </button>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center">
            <CubeTransparentIcon className="h-7 w-7 text-indigo-500 mr-2" />
            Lotes de: {product.nombre} ({product.codigoTienda})
          </h1>
        </div>

        <div className="mb-6 p-4 bg-gray-50 rounded-md border border-gray-200">
          <p className="text-gray-700"><strong>Stock Total:</strong> <span className="font-semibold text-lg text-indigo-700">{product.stockActual || 0} unidades</span></p>
          <p className="text-gray-600">Precio Venta por defecto: S/. {parseFloat(product.precioVenta || 0).toFixed(2)}</p>
          <p className="text-gray-600">Descripción: {product.descripcion || 'N/A'}</p>
        </div>

        {lotes.length === 0 ? (
          <p className="text-gray-500">No se encontraron lotes para este producto.</p>
        ) : (
          <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Lote ID Principal</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Cantidad Inicial</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Stock Restante</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Precio Compra Unit.</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Fecha Ingreso Lote</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Lote Interno</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Obs. Lote Principal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {lotes.map((lote) => (
                  <tr key={lote.id}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{lote.lotePrincipalId}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{lote.cantidad}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm font-semibold" style={{ color: lote.stockRestanteLote <= 0 ? 'red' : 'inherit' }}>
                        {lote.stockRestanteLote || 0}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">S/. {parseFloat(lote.precioCompraUnitario || 0).toFixed(2)}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{lote.fechaIngresoPrincipal}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{lote.lote || 'N/A'}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{lote.observacionesLotePrincipal || 'N/A'}</td>
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

export default ProductLotesDetail;