// pages/productos/[id].js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { db, storage } from '../../lib/firebase';
import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  query,
  getDocs,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { PhotoIcon, TrashIcon, XMarkIcon, PlusIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';

const AddEditProductoPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [modelosMoto, setModelosMoto] = useState([]); // Lista de todos los modelos de moto disponibles

  const DEFAULT_STOCK_UMBRAL = 4; // Valor por defecto para el umbral de stock bajo

  // Estado del formulario para un producto
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    medida: '',
    marca: '',
    codigoTienda: '',
    codigoProveedor: '',
    precioCompraDefault: 0,
    precioVentaDefault: 0,
    stockActual: 0,
    stockReferencialUmbral: DEFAULT_STOCK_UMBRAL, // Establecer el valor por defecto inicial aquí
    ubicacion: '',
    imageUrl: '',
    modelosCompatiblesIds: [], // Array de IDs de modelos compatibles
  });

  const [selectedImageFile, setSelectedImageFile] = useState(null); // Para el archivo de imagen a subir
  const [imagePreviewUrl, setImagePreviewUrl] = useState(''); // Para la previsualización de la imagen

  const isEditing = id !== 'nuevo';

  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        router.push('/auth');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // 1. Cargar todos los modelos de moto disponibles
        const qModelos = query(collection(db, 'modelosMoto'), orderBy('marcaModelo', 'asc'));
        const modelosSnapshot = await getDocs(qModelos);
        const fetchedModelos = modelosSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setModelosMoto(fetchedModelos);

        // 2. Si estamos editando, cargar los datos del producto
        if (isEditing) {
          const productDocRef = doc(db, 'productos', id);
          const productDocSnap = await getDoc(productDocRef);

          if (productDocSnap.exists()) {
            const productData = productDocSnap.data();
            setFormData({
              nombre: productData.nombre || '',
              descripcion: productData.descripcion || '',
              medida: productData.medida || '',
              marca: productData.marca || '',
              codigoTienda: productData.codigoTienda || '',
              codigoProveedor: productData.codigoProveedor || '',
              precioCompraDefault: productData.precioCompraDefault || 0, // Ya asumimos que es Number
              precioVentaDefault: productData.precioVentaDefault || 0,   // Ya asumimos que es Number
              stockActual: productData.stockActual || 0,
              // Usa el valor del documento, si no existe o es nulo, usa el DEFAULT_STOCK_UMBRAL
              stockReferencialUmbral: productData.stockReferencialUmbral ?? DEFAULT_STOCK_UMBRAL,
              ubicacion: productData.ubicacion || '',
              imageUrl: productData.imageUrl || '',
              // Asegura que modelosCompatiblesIds sea un array, incluso si está vacío en Firestore
              modelosCompatiblesIds: productData.modelosCompatiblesIds || [],
            });
            setImagePreviewUrl(productData.imageUrl || ''); // Establecer la URL de previsualización
          } else {
            setError('Producto no encontrado.');
            router.push('/productos'); // Redirigir si el producto no existe
          }
        } else {
          // Si es un nuevo producto, asegúrate de que stockReferencialUmbral tenga el valor por defecto
          // Esto ya se hace en la inicialización del useState, pero lo reaseguramos aquí si se reseteara.
          setFormData(prev => ({
            ...prev,
            stockReferencialUmbral: DEFAULT_STOCK_UMBRAL
          }));
        }
      } catch (err) {
        console.error("Error al cargar datos:", err);
        setError("Error al cargar la información. Intente de nuevo.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, isEditing, user, router]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file)); // Crear URL para previsualización
    } else {
      setSelectedImageFile(null);
      setImagePreviewUrl(formData.imageUrl || ''); // Volver a la URL original si no hay archivo nuevo
    }
  };

  const handleRemoveImage = () => {
    setSelectedImageFile(null);
    setImagePreviewUrl('');
    setFormData((prev) => ({ ...prev, imageUrl: '' }));
  };

  const handleModeloSelection = (e) => {
    const { value, checked } = e.target;
    setFormData((prev) => {
      const currentModels = prev.modelosCompatiblesIds;
      if (checked) {
        return {
          ...prev,
          modelosCompatiblesIds: [...currentModels, value],
        };
      } else {
        return {
          ...prev,
          modelosCompatiblesIds: currentModels.filter((modelId) => modelId !== value),
        };
      }
    });
  };

  const uploadImage = async (file) => {
    if (!file) return null;
    // Usa el ID del producto si estamos editando, o un timestamp si es nuevo
    const filePath = `productos/${id !== 'nuevo' ? id : Date.now()}-${file.name}`;
    const imageRef = storageRef(storage, filePath);
    await uploadBytes(imageRef, file);
    return await getDownloadURL(imageRef);
  };

  const handleDeleteOldImage = async (oldImageUrl) => {
    if (!oldImageUrl) return;
    try {
      const oldImageRef = storageRef(storage, oldImageUrl);
      await deleteObject(oldImageRef);
      console.log('Antigua imagen eliminada de Storage.');
    } catch (err) {
      console.warn('No se pudo eliminar la antigua imagen de Storage (puede que no exista o no haya permisos):', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      let finalImageUrl = formData.imageUrl;

      // Lógica de subida y eliminación de imágenes
      if (selectedImageFile) {
        // Si hay una imagen existente y se está subiendo una nueva, eliminar la antigua
        if (isEditing && formData.imageUrl && formData.imageUrl !== imagePreviewUrl) {
          await handleDeleteOldImage(formData.imageUrl);
        }
        finalImageUrl = await uploadImage(selectedImageFile);
      } else if (isEditing && !imagePreviewUrl && formData.imageUrl) {
        // Si se está editando y el preview está vacío pero antes había una imagen, eliminarla
        await handleDeleteOldImage(formData.imageUrl);
        finalImageUrl = '';
      }

      // Preparar los datos a guardar. Asumimos que los campos numéricos ya son Number
      const productDataToSave = {
        ...formData,
        imageUrl: finalImageUrl,
        updatedAt: serverTimestamp(),
      };

      // Si se está agregando un nuevo producto, añadir el timestamp de creación
      if (!isEditing) {
        productDataToSave.createdAt = serverTimestamp();
      }

      if (isEditing) {
        // Editar producto existente
        await updateDoc(doc(db, 'productos', id), productDataToSave);
        console.log("Producto actualizado con ID: ", id);
      } else {
        // Agregar nuevo producto
        const docRef = await addDoc(collection(db, 'productos'), productDataToSave);
        console.log("Producto agregado con ID: ", docRef.id);
      }
      router.push('/productos'); // Redirigir a la lista después de guardar
    } catch (err) {
      console.error("Error al guardar producto:", err);
      // Incluir el mensaje de error de Firebase para depuración
      setError("Error al guardar el producto. Verifique los campos e intente de nuevo. Detalle: " + err.message);
      if (err.code === 'permission-denied') {
        setError('No tiene permisos para realizar esta acción. Contacte al administrador.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (!user || loading) {
    return (
      <Layout title={isEditing ? "Cargando Producto" : "Cargando Formulario"}>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={isEditing ? "Editar Producto" : "Agregar Producto"}>
      <div className="max-w-4xl mx-auto p-4 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">
          {isEditing ? `Editar Producto: ${formData.nombre}` : 'Agregar Nuevo Producto'}
        </h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Sección de Información Básica */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="nombre" className="block text-sm font-medium text-gray-700">Nombre del Producto</label>
              <input type="text" name="nombre" id="nombre" value={formData.nombre} onChange={handleChange} required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
            </div>
            <div>
              <label htmlFor="marca" className="block text-sm font-medium text-gray-700">Marca</label>
              <input type="text" name="marca" id="marca" value={formData.marca} onChange={handleChange} required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700">Descripción</label>
              <textarea name="descripcion" id="descripcion" rows="3" value={formData.descripcion} onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"></textarea>
            </div>
            <div>
              <label htmlFor="medida" className="block text-sm font-medium text-gray-700">Medida (opcional)</label>
              <input type="text" name="medida" id="medida" value={formData.medida} onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
            </div>
            <div>
              <label htmlFor="ubicacion" className="block text-sm font-medium text-gray-700">Ubicación (Andamio)</label>
              <input type="text" name="ubicacion" id="ubicacion" value={formData.ubicacion} onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
            </div>
          </div>

          {/* Sección de Códigos y Precios */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="codigoTienda" className="block text-sm font-medium text-gray-700">Código de Tienda</label>
              <input type="text" name="codigoTienda" id="codigoTienda" value={formData.codigoTienda} onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
            </div>
            <div>
              <label htmlFor="codigoProveedor" className="block text-sm font-medium text-gray-700">Código de Proveedor (opcional)</label>
              <input type="text" name="codigoProveedor" id="codigoProveedor" value={formData.codigoProveedor} onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
            </div>
            <div>
              <label htmlFor="precioCompraDefault" className="block text-sm font-medium text-gray-700">Precio de Compra Default</label>
              <input type="number" name="precioCompraDefault" id="precioCompraDefault" value={formData.precioCompraDefault} onChange={handleChange} required step="0.01" min="0"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
            </div>
            <div>
              <label htmlFor="precioVentaDefault" className="block text-sm font-medium text-gray-700">Precio de Venta Default</label>
              <input type="number" name="precioVentaDefault" id="precioVentaDefault" value={formData.precioVentaDefault} onChange={handleChange} required step="0.01" min="0"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
            </div>
            <div>
              <label htmlFor="stockActual" className="block text-sm font-medium text-gray-700">Stock Actual</label>
              <input type="number" name="stockActual" id="stockActual" value={formData.stockActual} onChange={handleChange} required min="0"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
            </div>
            <div>
              <label htmlFor="stockReferencialUmbral" className="block text-sm font-medium text-gray-700">Umbral de Stock Bajo</label>
              <input type="number" name="stockReferencialUmbral" id="stockReferencialUmbral" value={formData.stockReferencialUmbral} onChange={handleChange} required min="0"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
            </div>
          </div>

          {/* Sección de Modelos Compatibles */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Modelos Compatibles</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-md border border-gray-200 max-h-60 overflow-y-auto">
              {modelosMoto.length > 0 ? (
                modelosMoto.map((modelo) => (
                  <div key={modelo.id} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`modelo-${modelo.id}`}
                      value={modelo.id}
                      checked={formData.modelosCompatiblesIds.includes(modelo.id)}
                      onChange={handleModeloSelection}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor={`modelo-${modelo.id}`} className="ml-2 text-sm text-gray-700">
                      {modelo.marcaModelo} {modelo.nombreModelo}
                    </label>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 col-span-full">No hay modelos de moto registrados. <a onClick={() => router.push('/productos/modelos')} className="text-blue-600 hover:underline cursor-pointer">Crea uno aquí.</a></p>
              )}
            </div>
          </div>

          {/* Sección de Imagen del Producto */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Imagen del Producto (opcional)</h2>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md relative">
              {imagePreviewUrl ? (
                <>
                  <img src={imagePreviewUrl} alt="Previsualización del producto" className="max-h-48 max-w-full object-contain" />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md text-gray-600 hover:text-red-500 hover:bg-gray-100 transition-colors"
                    title="Eliminar imagen"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </>
              ) : (
                <div className="space-y-1 text-center">
                  <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                    >
                      <span>Subir una imagen</span>
                      <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleImageChange} accept="image/*" />
                    </label>
                    <p className="pl-1">o arrastrar y soltar</p>
                  </div>
                  <p className="text-xs text-gray-500">PNG, JPG, GIF hasta 10MB</p>
                </div>
              )}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex justify-end space-x-4 mt-8">
            <button
              type="button"
              onClick={() => router.push('/productos')}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={saving}
            >
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isEditing ? 'Actualizando...' : 'Agregando...'}
                </>
              ) : (
                <>
                  <CloudArrowUpIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                  {isEditing ? 'Actualizar Producto' : 'Agregar Producto'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default AddEditProductoPage;