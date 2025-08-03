// pages/productos/index.js

import { useState, useEffect, Fragment } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { db } from '../../lib/firebase';
import {
  collection,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
  limit,
  addDoc,
  serverTimestamp,
  runTransaction,
  where,
  getDoc,
  updateDoc,
  onSnapshot,
} from 'firebase/firestore';
import {
  PencilIcon,
  PlusIcon,
  TrashIcon,
  PhotoIcon,
  EyeIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ShoppingCartIcon,
  DocumentTextIcon,
  CreditCardIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/router';

import ImageModal from '../../components/modals/ImageModal';
import ProductDetailsModal from '../../components/modals/ProductDetailsModal';
import ProductModelsModal from '../../components/modals/ProductModelsModal';
import ActiveQuotationPanel from '../../components/panels/ActiveQuotationPanel';

const ProductosPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clientes, setClientes] = useState([]);

  // Estados de filtro (sin cambios)
  const [filterNombre, setFilterNombre] = useState('');
  const [filterMarca, setFilterMarca] = useState('');
  const [filterCodigoTienda, setFilterCodigoTienda] = useState('');
  const [filterUbicacion, setFilterUbicacion] = useState('');
  const [filterModelosCompatibles, setFilterModelosCompatibles] = useState('');
  const [filterCodigoProveedor, setFilterCodigoProveedor] = useState('');
  const [filterMedida, setFilterMedida] = useState('');
  const [productsPerPage, setProductsPerPage] = useState(20);
  const [filteredProductos, setFilteredProductos] = useState([]);

  // ESTADOS PARA LA COTIZACIÓN ACTIVA
  const [activeQuotationId, setActiveQuotationId] = useState(null);
  const [activeQuotation, setActiveQuotation] = useState(null);
  const [activeQuotationItems, setActiveQuotationItems] = useState([]);
  const [showQuotationPanel, setShowQuotationPanel] = useState(false);
  const [pendingQuotations, setPendingQuotations] = useState([]);

    const handleOpenPanel = () => {
    setShowQuotationPanel(true);
  };

  const handleClosePanel = () => {
    setShowQuotationPanel(false);
  };

  // Función para cargar productos y clientes
  const fetchInitialData = async () => {
    if (!user) {
      router.push('/auth');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Cargar Productos
      const qProductos = query(
        collection(db, 'productos'),
        orderBy('nombre', 'asc'),
        limit(productsPerPage)
      );
      const productosSnapshot = await getDocs(qProductos);
      const productosList = productosSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProductos(productosList);
      setFilteredProductos(productosList);

      // Cargar Clientes
      const qClientes = query(collection(db, 'cliente'), orderBy('nombre', 'asc'));
      const clienteSnapshot = await getDocs(qClientes);
      const clientesList = clienteSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setClientes(clientesList);

    } catch (err) {
      console.error("Error al cargar datos iniciales:", err);
      setError("Error al cargar la información inicial. Intente de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  // Efecto para cargar datos iniciales
  useEffect(() => {
    fetchInitialData();
  }, [user, router, productsPerPage]);

  // NEW EFFECT: Listen for changes in ALL pending quotations
  useEffect(() => {
    if (!user) return;

    const qPendingQuotations = query(
      collection(db, 'cotizaciones'),
      where('estado', '==', 'borrador'), // Filter for 'borrador' (draft) status
      orderBy('fechaCreacion', 'desc')
    );

    const unsubscribePending = onSnapshot(qPendingQuotations, (snapshot) => {
      const quotesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPendingQuotations(quotesList);
    }, (err) => {
      console.error("Error al escuchar cotizaciones pendientes:", err);
    });

    return () => unsubscribePending();
  }, [user]);

  // Efecto para escuchar cambios en la cotización activa
  useEffect(() => {
    if (!activeQuotationId) {
      setActiveQuotation(null);
      setActiveQuotationItems([]);
      return;
    }

    const unsubscribeQuotation = onSnapshot(doc(db, 'cotizaciones', activeQuotationId), async (docSnap) => {
      if (docSnap.exists()) {
        const quotationData = { id: docSnap.id, ...docSnap.data() };
        setActiveQuotation(quotationData);

        const qItems = query(collection(db, 'cotizaciones', activeQuotationId, 'itemsCotizacion'), orderBy('createdAt', 'asc'));
        const itemsSnapshot = await getDocs(qItems);
        const itemsList = itemsSnapshot.docs.map(itemDoc => ({
          id: itemDoc.id,
          ...itemDoc.data(),
          subtotal: parseFloat(itemDoc.data().subtotal || 0).toFixed(2)
        }));
        setActiveQuotationItems(itemsList);
        setShowQuotationPanel(true);
      } else {
        setActiveQuotationId(null);
        setActiveQuotation(null);
        setActiveQuotationItems([]);
        setShowQuotationPanel(false);
      }
    }, (err) => {
      console.error("Error al escuchar cotización activa:", err);
      setError("Error al cargar la cotización activa.");
    });

    return () => unsubscribeQuotation();
  }, [activeQuotationId]);


  // Lógica de filtrado (sin cambios)
  const applyFilters = () => {
    const lowerFilterNombre = filterNombre.toLowerCase();
    const lowerFilterMarca = filterMarca.toLowerCase();
    const lowerFilterCodigoTienda = filterCodigoTienda.toLowerCase();
    const lowerFilterUbicacion = filterUbicacion.toLowerCase();
    const lowerFilterModelosCompatibles = filterModelosCompatibles.toLowerCase();
    const lowerFilterCodigoProveedor = filterCodigoProveedor.toLowerCase();
    const lowerFilterMedida = filterMedida.toLowerCase();

    const filtered = productos.filter(producto => {
      const matchesNombre = producto.nombre.toLowerCase().includes(lowerFilterNombre);
      const matchesMarca = (producto.marca && producto.marca.toLowerCase().includes(lowerFilterMarca)) || lowerFilterMarca === '';
      const matchesCodigoTienda = producto.codigoTienda.toLowerCase().includes(lowerFilterCodigoTienda);
      const matchesUbicacion = (producto.ubicacion && producto.ubicacion.toLowerCase().includes(lowerFilterUbicacion)) || lowerFilterUbicacion === '';
      const matchesModelosCompatibles = (producto.modelosCompatiblesTexto && producto.modelosCompatiblesTexto.toLowerCase().includes(lowerFilterModelosCompatibles)) || lowerFilterModelosCompatibles === '';
      const matchesCodigoProveedor = (producto.codigoProveedor && producto.codigoProveedor.toLowerCase().includes(lowerFilterCodigoProveedor)) || lowerFilterCodigoProveedor === '';
      const matchesMedida = (producto.medida && producto.medida.toLowerCase().includes(lowerFilterMedida)) || lowerFilterMedida === '';

      return matchesNombre && matchesCodigoTienda && matchesMarca && matchesUbicacion && matchesModelosCompatibles && matchesCodigoProveedor && matchesMedida;
    });
    setFilteredProductos(filtered);
  };

  const handleSearchClick = () => {
    applyFilters();
  };

  const handleClearFilters = () => {
    setFilterNombre('');
    setFilterMarca('');
    setFilterCodigoTienda('');
    setFilterUbicacion('');
    setFilterModelosCompatibles('');
    setFilterCodigoProveedor('');
    setFilterMedida('');
    setFilteredProductos(productos);
  };

  const handleDelete = async (productId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este producto? Esta acción es irreversible.')) {
      try {
        await deleteDoc(doc(db, 'productos', productId));
        setProductos(prevProductos => prevProductos.filter(p => p.id !== productId));
        setFilteredProductos(prevFiltered => prevFiltered.filter(p => p.id !== productId));
        alert('Producto eliminado con éxito.');
      } catch (err) {
        console.error("Error al eliminar producto:", err);
        setError("Error al eliminar el producto. " + err.message);
        alert('Hubo un error al eliminar el producto.');
      }
    }
  };

  // Funciones para los modales de imagen, detalles y modelos (sin cambios)
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState('');
  const [isProductDetailsModalOpen, setIsProductDetailsModalOpen] = useState(false);
  const [selectedProductForDetails, setSelectedProductForDetails] = useState(null);
  const [isProductModelsModalOpen, setIsProductModelsModalOpen] = useState(false);
  const [selectedProductForModels, setSelectedProductForModels] = useState(null);

  const openImageModal = (imageUrl) => {
    setCurrentImageUrl(imageUrl);
    setIsImageModalOpen(true);
  };
  const closeImageModal = () => {
    setIsImageModalOpen(false);
    setCurrentImageUrl('');
  };

  const openProductDetailsModal = (product) => {
    setSelectedProductForDetails(product);
    setIsProductDetailsModalOpen(true);
  };
  const closeProductDetailsModal = () => {
    setSelectedProductForDetails(null);
    setIsProductDetailsModalOpen(false);
  };

  const openProductModelsModal = (product) => {
    setSelectedProductForModels(product);
    setIsProductModelsModalOpen(true);
  };
  const closeProductModelsModal = () => {
    setSelectedProductForModels(null);
    setIsProductModelsModalOpen(false);
  };

  // --- LÓGICA DE GESTIÓN DE COTIZACIONES ---

  // Función para iniciar una nueva cotización
  const handleNuevaCotizacion = async () => {
    if (!user) {
      alert("Debe iniciar sesión para crear una cotización.");
      router.push('/auth');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const newQuotationRef = await addDoc(collection(db, 'cotizaciones'), {
        numeroCotizacion: `COT-${Date.now().toString().slice(-8)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        clienteId: null,
        clienteNombre: 'Cliente Pendiente',
        clienteDNI: null,
        totalCotizacion: 0,
        fechaCreacion: serverTimestamp(),
        empleadoId: user.email || user.uid,
        estado: 'borrador', // Initial status
        metodoPago: null, // Add method of payment, initially null
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setActiveQuotationId(newQuotationRef.id);
      setShowQuotationPanel(true);
      alert(`Nueva cotización borrador creada: ${newQuotationRef.id}. Seleccione un cliente y un método de pago.`);

    } catch (err) {
      console.error("Error al crear nueva cotización:", err);
      setError("Error al crear nueva cotización: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle selecting an existing pending quotation
  const handleSelectPendingQuotation = (quotationId) => {
    setActiveQuotationId(quotationId);
    setShowQuotationPanel(true);
  };

  // NUEVA FUNCIÓN: Actualizar el cliente de la cotización activa
  const handleUpdateQuotationClient = async (quotationId, newClientId) => {
    if (!quotationId) return;

    setLoading(true);
    setError(null);

    try {
      await runTransaction(db, async (transaction) => {
        const quotationRef = doc(db, 'cotizaciones', quotationId);
        let clientData = { nombre: 'Cliente Pendiente', apellido: '', dni: null, numeroDocumento: null };

        // --- ALL READS FIRST ---
        const quotationSnap = await transaction.get(quotationRef);

        if (!quotationSnap.exists()) {
          throw new Error("La cotización no existe.");
        }

        if (newClientId) {
          const clientRef = doc(db, 'cliente', newClientId);
          const clientSnap = await transaction.get(clientRef);
          if (!clientSnap.exists()) {
            throw new Error("El cliente seleccionado no existe.");
          }
          clientData = clientSnap.data();
        }

        const clientNombre = `${clientData.nombre} ${clientData.apellido || ''}`.trim();

        // --- ALL WRITES AFTER ALL READS ---
        transaction.update(quotationRef, {
          clienteId: newClientId || null,
          clienteNombre: clientNombre,
          clienteDNI: clientData.dni || clientData.numeroDocumento || null,
          updatedAt: serverTimestamp(),
        });
      });
      alert('Cliente de cotización actualizado.');
    } catch (err) {
      console.error("Error al actualizar cliente de cotización:", err);
      setError("Error al actualizar cliente: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // NEW FUNCTION: Update payment method for active quotation
  const handleUpdateQuotationPaymentMethod = async (quotationId, newMetodoPago) => {
    if (!quotationId) return;

    setLoading(true);
    setError(null);

    try {
      const quotationRef = doc(db, 'cotizaciones', quotationId);
      await updateDoc(quotationRef, {
        metodoPago: newMetodoPago,
        updatedAt: serverTimestamp(),
      });
      alert('Método de pago de cotización actualizado.');
    } catch (err) {
      console.error("Error al actualizar método de pago de cotización:", err);
      setError("Error al actualizar método de pago: " + err.message);
    } finally {
      setLoading(false);
    }
  };


  // FIX: handleAddProductToActiveQuotation to ensure reads before writes
  const handleAddProductToActiveQuotation = async (product, quantity = 1) => {
    if (!activeQuotationId) {
      alert("Por favor, selecciona o crea una cotización primero.");
      return;
    }
    if (!user) {
      alert("Debe iniciar sesión para añadir productos.");
      router.push('/auth');
      return;
    }
    if (quantity <= 0) {
      alert('La cantidad debe ser mayor a 0.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // --- IMPORTANT: Perform queries (reads) OUTSIDE the transaction if they involve multiple documents ---
      const quotationItemsCollectionRef = collection(db, 'cotizaciones', activeQuotationId, 'itemsCotizacion');
      const existingItemQuery = query(quotationItemsCollectionRef, where('productoId', '==', product.id));
      const existingItemSnapshot = await getDocs(existingItemQuery); // Use getDocs() here, NOT transaction.get()

      await runTransaction(db, async (transaction) => {
        const productRef = doc(db, 'productos', product.id);
        const quotationRef = doc(db, 'cotizaciones', activeQuotationId);

        // --- ALL READS INSIDE TRANSACTION FIRST ---
        const productSnap = await transaction.get(productRef);
        const quotationSnap = await transaction.get(quotationRef);

        if (!productSnap.exists()) {
          throw new Error(`El producto "${product.nombre}" no se encontró en el inventario.`);
        }
        if (!quotationSnap.exists()) {
          throw new Error("La cotización activa no existe.");
        }

        const currentStock = typeof productSnap.data().stockActual === 'number' ? productSnap.data().stockActual : 0;
        if (currentStock < quantity) {
          console.warn(`Advertencia: Stock insuficiente para "${product.nombre}". Stock actual: ${currentStock}, Cantidad solicitada: ${quantity}.`);
        }

        let itemRef;
        let newQuantity;
        let oldSubtotal = 0;
        const productPrice = parseFloat(product.precioVentaDefault || 0);

        // Use the existingItemSnapshot obtained BEFORE the transaction
        if (!existingItemSnapshot.empty && existingItemSnapshot.docs.length > 0) {
          const existingItemDoc = existingItemSnapshot.docs[0];
          itemRef = existingItemDoc.ref; // This ref is valid because it was obtained outside the transaction
          const existingItemData = existingItemDoc.data();
          oldSubtotal = parseFloat(existingItemData.subtotal || 0);
          newQuantity = existingItemData.cantidad + quantity;
          const newSubtotal = newQuantity * productPrice;

          // Prepare update data for existing item
          const itemUpdateData = {
            cantidad: newQuantity,
            subtotal: newSubtotal,
            updatedAt: serverTimestamp(),
          };
          // --- WRITE FOR EXISTING ITEM ---
          transaction.update(itemRef, itemUpdateData);
        } else {
          itemRef = doc(quotationItemsCollectionRef); // Create new doc ref for subcollection
          newQuantity = quantity;
          const newSubtotal = newQuantity * productPrice;

          // Prepare set data for new item
          const itemSetData = {
            productoId: product.id,
            nombreProducto: product.nombre,
            cantidad: newQuantity,
            precioVentaUnitario: productPrice,
            subtotal: newSubtotal,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          // --- WRITE FOR NEW ITEM ---
          transaction.set(itemRef, itemSetData);
        }

        // Calculate updated total for the main quotation document
        const currentTotal = parseFloat(quotationSnap.data().totalCotizacion || 0);
        const finalItemSubtotal = newQuantity * productPrice;
        const updatedTotal = currentTotal - oldSubtotal + finalItemSubtotal;

        // --- WRITE FOR MAIN QUOTATION ---
        transaction.update(quotationRef, {
          totalCotizacion: parseFloat(updatedTotal.toFixed(2)),
          updatedAt: serverTimestamp(),
        });
      });

      // REMOVED: alert(`"${product.nombre}" añadido a la cotización activa.`);
    } catch (err) {
      console.error("Error al añadir producto a cotización:", err);
      setError("Error al añadir producto a cotización: " + err.message);
      alert('Hubo un error al añadir el producto a la cotización: ' + err.message); // Keep alert for errors
    } finally {
      setLoading(false);
    }
  };

  // Función para remover un ítem de la cotización activa
  const handleRemoveItemFromQuotation = async (itemId, subtotalToRemove) => {
    if (!activeQuotationId || !itemId) return;

    if (!window.confirm('¿Estás seguro de que quieres eliminar este producto de la cotización?')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await runTransaction(db, async (transaction) => {
        const itemRef = doc(db, 'cotizaciones', activeQuotationId, 'itemsCotizacion', itemId);
        const quotationRef = doc(db, 'cotizaciones', activeQuotationId);

        // --- READS FIRST ---
        const quotationSnap = await transaction.get(quotationRef);
        const itemSnap = await transaction.get(itemRef);

        if (!itemSnap.exists()) {
            throw new Error("El ítem a eliminar no existe en la cotización.");
        }
        if (!quotationSnap.exists()) {
            throw new Error("La cotización activa no existe.");
        }

        const currentTotal = parseFloat(quotationSnap.data().totalCotizacion || 0);
        const updatedTotal = currentTotal - parseFloat(subtotalToRemove);

        // --- WRITES AFTER ALL READS ---
        transaction.delete(itemRef);
        transaction.update(quotationRef, {
          totalCotizacion: parseFloat(updatedTotal.toFixed(2)),
          updatedAt: serverTimestamp(),
        });
      });
      alert('Producto eliminado de la cotización.');
    } catch (err) {
      console.error("Error al eliminar ítem de cotización:", err);
      setError("Error al eliminar producto de la cotización: " + err.message);
      alert('Hubo un error al eliminar el producto de la cotización: ' + err.message); // Keep alert for errors
    } finally {
      setLoading(false);
    }
  };

  // Función para actualizar la cantidad de un ítem en la cotización activa
  const handleUpdateItemQuantityInQuotation = async (itemId, newQuantity, productPrice) => {
    if (!activeQuotationId || !itemId || newQuantity < 0) return;

    setLoading(true);
    setError(null);

    try {
      await runTransaction(db, async (transaction) => {
        const itemRef = doc(db, 'cotizaciones', activeQuotationId, 'itemsCotizacion', itemId);
        const quotationRef = doc(db, 'cotizaciones', activeQuotationId);

        // --- READS FIRST ---
        const itemSnap = await transaction.get(itemRef);
        const quotationSnap = await transaction.get(quotationRef);

        if (!itemSnap.exists()) {
          throw new Error("Ítem de cotización no encontrado.");
        }
        if (!quotationSnap.exists()) {
          throw new Error("La cotización activa no existe.");
        }

        const oldSubtotal = parseFloat(itemSnap.data().subtotal || 0);
        const newSubtotal = newQuantity * parseFloat(productPrice);

        // --- WRITES AFTER ALL READS ---
        transaction.update(itemRef, {
          cantidad: newQuantity,
          subtotal: newSubtotal,
          updatedAt: serverTimestamp(),
        });

        const currentTotal = parseFloat(quotationSnap.data().totalCotizacion || 0);
        const updatedTotal = currentTotal - oldSubtotal + newSubtotal;

        transaction.update(quotationRef, {
          totalCotizacion: parseFloat(updatedTotal.toFixed(2)),
          updatedAt: serverTimestamp(),
        });
      });
      alert('Cantidad actualizada en la cotización.');
    } catch (err) {
      console.error("Error al actualizar cantidad en cotización:", err);
      setError("Error al actualizar cantidad: " + err.message);
      alert('Hubo un error al actualizar la cantidad: ' + err.message); // Keep alert for errors
    } finally {
      setLoading(false);
    }
  };

  // MODIFICACIÓN CRÍTICA: handleFinalizeQuotation ahora incluye la lógica de stock y venta
  const handleFinalizeQuotation = async (quotationId, metodoPago) => {
    if (!quotationId) return;

    if (!window.confirm(`¿Estás seguro de que quieres FINALIZAR esta cotización con método de pago: ${metodoPago || 'No especificado'}? Esto la convertirá en una VENTA y afectará el stock actual.`)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await runTransaction(db, async (transaction) => {
        const cotizacionRef = doc(db, 'cotizaciones', quotationId);
        const cotizacionSnap = await transaction.get(cotizacionRef);

        if (!cotizacionSnap.exists()) {
          throw new Error("Cotización no encontrada.");
        }

        const currentCotizacionData = cotizacionSnap.data();
        // Prevent re-finalizing if already confirmed or canceled
        if (currentCotizacionData.estado === 'confirmada' || currentCotizacionData.estado === 'cancelada') {
          throw new Error("Esta cotización ya ha sido confirmada o cancelada.");
        }

        // Fetch items associated with this quotation
        const itemsCotizacionCollectionRef = collection(db, 'cotizaciones', quotationId, 'itemsCotizacion');
        const itemsCotizacionSnapshot = await getDocs(itemsCotizacionCollectionRef); // Query outside transaction

        if (itemsCotizacionSnapshot.empty) {
          throw new Error("No se encontraron productos asociados a esta cotización. No se puede finalizar.");
        }

        const productoRefsAndData = [];
        for (const itemDoc of itemsCotizacionSnapshot.docs) {
          const itemData = itemDoc.data();
          const productoRef = doc(db, 'productos', itemData.productoId);
          const productoSnap = await transaction.get(productoRef); // Read product data within transaction

          if (productoSnap.exists()) {
            productoRefsAndData.push({
              itemData: itemData,
              productoRef: productoRef,
              currentProductoData: productoSnap.data(),
            });
          } else {
            throw new Error(`Producto con ID ${itemData.productoId} no encontrado en inventario. No se puede finalizar la cotización.`);
          }
        }

        // Pre-check stock availability for all products
        for (const { itemData, currentProductoData } of productoRefsAndData) {
            const currentStock = typeof currentProductoData.stockActual === 'number' ? currentProductoData.stockActual : 0;
            const cantidadVendida = typeof itemData.cantidad === 'number' ? itemData.cantidad : 0;
            if (currentStock < cantidadVendida) {
                throw new Error(`Stock insuficiente para el producto "${itemData.nombreProducto}". Stock actual: ${currentStock}, Cantidad solicitada: ${cantidadVendida}.`);
            }
        }

        // Create new Sale document
        const newVentaRef = doc(collection(db, 'ventas'));
        transaction.set(newVentaRef, {
            cotizacionId: quotationId,
            clienteId: currentCotizacionData.clienteId,
            clienteNombre: currentCotizacionData.clienteNombre,
            totalVenta: currentCotizacionData.totalCotizacion,
            fechaVenta: serverTimestamp(),
            empleadoId: user.email || user.uid,
            observaciones: currentCotizacionData.observaciones || 'Convertido de cotización',
            estado: 'completada',
            metodoPago: metodoPago || currentCotizacionData.metodoPago || 'Efectivo', // Use selected method or existing
            tipoVenta: currentCotizacionData.tipoVenta || 'cotizacionAprobada',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        // Update product stock and add items to sale subcollection
        for (const { itemData, productoRef, currentProductoData } of productoRefsAndData) {
            const currentStock = typeof currentProductoData.stockActual === 'number' ? currentProductoData.stockActual : 0;
            const cantidadVendida = typeof itemData.cantidad === 'number' ? itemData.cantidad : 0;
            const newStock = currentStock - cantidadVendida;

            // DEBUGGING LOG: Check stock values
            console.log(`[Finalizar Cotización - ProductosPage] Producto: ${itemData.nombreProducto}, Stock Actual: ${currentStock}, Cantidad Vendida: ${cantidadVendida}, Nuevo Stock: ${newStock}`);

            transaction.update(productoRef, {
                stockActual: newStock,
                updatedAt: serverTimestamp(),
            });

            transaction.set(doc(collection(newVentaRef, 'itemsVenta')), {
                productoId: itemData.productoId,
                nombreProducto: itemData.nombreProducto,
                cantidad: itemData.cantidad,
                precioVentaUnitario: itemData.precioVentaUnitario,
                subtotal: itemData.subtotal,
                createdAt: serverTimestamp(),
            });
        }

        // Update quotation status to 'confirmada'
        transaction.update(cotizacionRef, {
          estado: 'confirmada',
          metodoPago: metodoPago, // Ensure metodoPago is saved with finalization
          fechaFinalizacion: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      alert('Cotización finalizada y convertida en Venta con éxito. Stock actualizado.');
      setActiveQuotationId(null); // Clear the active quotation after finalizing
      setShowQuotationPanel(false); // Hide the panel
      // RE-FETCH PRODUCTS TO UPDATE STOCK DISPLAY
      fetchInitialData(); // <--- ADDED THIS LINE
    } catch (err) {
      console.error("Error al finalizar cotización:", err);
      setError("Error al finalizar la cotización: " + err.message);
      // More specific error message for the user
      alert(`Hubo un error al finalizar la cotización: ${err.message}. Por favor, verifica el stock de los productos y tus permisos de Firestore.`);
    } finally {
      setLoading(false);
    }
  };


  if (!user) {
    return null;
  }

  return (
    <Layout title="Gestión de Productos con Transacciones">
      <div className="flex flex-col mx-4 py-4">
        <div className="w-full p-4 bg-white rounded-lg shadow-md flex flex-col">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {/* Sección de Filtros y Botones */}
          <div className="mb-4 border border-gray-200 rounded-lg p-4 bg-gray-50 flex-shrink-0">
            <div className="flex flex-wrap items-end gap-3 md:gap-4">
              <div className="flex flex-wrap items-end gap-3 md:gap-4 flex-grow">
                {/* Filtros de Productos */}
                <div className="flex-1 min-w-[140px]">
                  <label htmlFor="filterNombre" className="block text-sm font-medium text-gray-700">NOMBRE</label>
                  <input
                    type="text"
                    id="filterNombre"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={filterNombre}
                    onChange={(e) => setFilterNombre(e.target.value)}
                    placeholder="Nombre..."
                  />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label htmlFor="filterMarca" className="block text-sm font-medium text-gray-700">MARCA</label>
                  <input
                    type="text"
                    id="filterMarca"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={filterMarca}
                    onChange={(e) => setFilterMarca(e.target.value)}
                    placeholder="Marca..."
                  />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label htmlFor="filterCodigoTienda" className="block text-sm font-medium text-gray-700">C. TIENDA</label>
                  <input
                    type="text"
                    id="filterCodigoTienda"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={filterCodigoTienda}
                    onChange={(e) => setFilterCodigoTienda(e.target.value)}
                    placeholder="Cód. Tienda..."
                  />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label htmlFor="filterCodigoProveedor" className="block text-sm font-medium text-gray-700">C. PROVEEDOR</label>
                  <input
                    type="text"
                    id="filterCodigoProveedor"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={filterCodigoProveedor}
                    onChange={(e) => setFilterCodigoProveedor(e.target.value)}
                    placeholder="Cód. Proveedor..."
                  />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label htmlFor="filterMedida" className="block text-sm font-medium text-gray-700">MEDIDA</label>
                  <input
                    type="text"
                    id="filterMedida"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={filterMedida}
                    onChange={(e) => setFilterMedida(e.target.value)}
                    placeholder="Medida..."
                  />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label htmlFor="filterUbicacion" className="block text-sm font-medium text-gray-700">UBICACION</label>
                  <input
                    type="text"
                    id="filterUbicacion"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={filterUbicacion}
                    onChange={(e) => setFilterUbicacion(e.target.value)}
                    placeholder="Ubicación..."
                  />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label htmlFor="filterModelosCompatibles" className="block text-sm font-medium text-gray-700">MODELOS COMPATIBLES</label>
                  <input
                    type="text"
                    id="filterModelosCompatibles"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={filterModelosCompatibles}
                    onChange={(e) => setFilterModelosCompatibles(e.target.value)}
                    placeholder="Ej: Yamaha, Honda..."
                  />
                </div>
              </div>

              {/* Selector de productos por página */}
              <div className="flex-none min-w-[120px]">
                <label htmlFor="products-per-page" className="block text-sm font-medium text-gray-700">Mostrar:</label>
                <select
                  id="products-per-page"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm h-[42px]"
                  value={productsPerPage}
                  onChange={(e) => setProductsPerPage(Number(e.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              {/* Botones de acción: Buscar, Limpiar, Agregar Producto, Nueva Cotización, Nueva Venta */}
              <div className="flex-none flex items-end space-x-2">
                <button
                  onClick={handleSearchClick}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 h-[42px]"
                  title="Buscar"
                >
                  <MagnifyingGlassIcon className="h-5 w-5 mr-2" aria-hidden="true" />
                  Buscar
                </button>
                <button
                  onClick={handleClearFilters}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 h-[42px]"
                  title="Limpiar Filtros"
                >
                  <ArrowPathIcon className="h-5 w-5 mr-2" aria-hidden="true" />
                  Limpiar Filtros
                </button>
                <button
                  onClick={() => router.push('/productos/nuevo')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 h-[42px]"
                  title="Agregar Producto al Inventario"
                >
                  <PlusIcon className="h-5 w-5 mr-2" aria-hidden="true" />
                  Agregar Producto
                </button>
                {/* Botones para abrir paneles de transacción */}
                <button
                  onClick={handleNuevaCotizacion}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 h-[42px]"
                  title="Generar Nueva Cotización"
                >
                  <DocumentTextIcon className="h-5 w-5 mr-2" aria-hidden="true" />
                  Nueva Cotización
                </button>
                <button
                  onClick={() => { /* Lógica para Nueva Venta */ alert('Añadir a Venta (en desarrollo)'); }}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 h-[42px]"
                  title="Generar Nueva Venta"
                >
                  <ShoppingCartIcon className="h-5 w-5 mr-2" aria-hidden="true" />
                  Nueva Venta
                </button>
                <button
                  onClick={handleOpenPanel}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 h-[42px]"
                  title="Abrir Panel de Cotizaciones"
                >
                  <ClipboardDocumentListIcon className="h-5 w-5 mr-2" aria-hidden="true" />
                  Abrir Cotizaciones
                </button>
              </div>
            </div>
          </div>

          {/* Contenedor principal con la tabla de productos y el panel de cotización */}
          <div className="flex flex-row flex-grow relative">
            {/* Tabla de Productos */}
            <div className={`flex-grow ${showQuotationPanel ? 'w-2/3 pr-4' : 'w-full'}`}>
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : filteredProductos.length === 0 ? (
                <p className="p-4 text-center text-gray-500">No se encontraron productos que coincidan con los filtros aplicados.</p>
              ) : (
                <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg overflow-y-auto max-h-[calc(100vh-250px)]">
                  <table className="min-w-full border-collapse">
                    <thead className="bg-blue-100 sticky top-0 z-10">
                      <tr>
                        <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-blue-800 text-center">NOMBRE</th>
                        <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-blue-800 text-center">MARCA</th>
                        <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-blue-800 text-center">C. TIENDA</th>
                        <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-blue-800 text-center">C. PROVEEDOR</th>
                        <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-blue-800 text-center">MEDIDA</th>
                        <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-blue-800 text-center">UBICACION</th>
                        <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-blue-800 text-center">STOCK</th>
                        <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-blue-800 text-center">COSTO (S/.)</th>
                        <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-blue-800 text-center">VENTA (S/.)</th>
                        <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-blue-800 text-center">AÑADIR A...</th>
                        <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-blue-800 text-center">ACCIONES DE PRODUCTO</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {filteredProductos.map((producto, index) => (
                        <tr
                          key={producto.id}
                          className={`${producto.stockActual <= producto.stockReferencialUmbral ? 'bg-red-100 text-red-800' : (index % 2 === 0 ? 'bg-white' : 'bg-gray-50')}`}
                        >
                          <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm font-medium text-black text-left">{producto.nombre}</td>
                          <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">{producto.marca || 'N/A'}</td>
                          <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">{producto.codigoTienda}</td>
                          <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">{producto.codigoProveedor || 'N/A'}</td>
                          <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">{producto.medida || 'N/A'}</td>
                          <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">{producto.ubicacion || 'N/A'}</td>
                          <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm font-semibold text-center">
                            {producto.stockActual}
                          </td>
                          <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-center">
                            S/. {parseFloat(producto.precioCompraDefault || 0).toFixed(2)}
                          </td>
                          <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-center">
                            S/. {parseFloat(producto.precioVentaDefault || 0).toFixed(2)}
                          </td>
                          {/* CELDA CON BOTONES PARA AÑADIR A TRANSACCIÓN */}
                          <td className="border border-gray-300 relative whitespace-nowrap px-2 py-1 text-center">
                            <div className="flex justify-center space-x-1">
                              <button
                                onClick={() => { /* Lógica para añadir a Venta */ alert('Añadir a Venta (en desarrollo)'); }}
                                className="text-green-600 hover:text-green-900 p-1 rounded-full hover:bg-gray-100"
                                title="Añadir a Venta"
                              >
                                <ShoppingCartIcon className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => handleAddProductToActiveQuotation(producto)}
                                className="text-blue-600 hover:text-blue-900 p-1 rounded-full hover:bg-gray-100"
                                title="Añadir a Cotización Activa"
                                disabled={!activeQuotationId}
                              >
                                <DocumentTextIcon className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => { /* Lógica para añadir a Crédito */ alert('Añadir a Crédito (en desarrollo)'); }}
                                className="text-yellow-600 hover:text-yellow-900 p-1 rounded-full hover:bg-gray-100"
                                title="Añadir a Crédito (Próximamente)"
                                disabled
                              >
                                <CreditCardIcon className="h-5 w-5" />
                              </button>
                            </div>
                          </td>
                          {/* CELDAS DE ACCIONES DE PRODUCTO EXISTENTES */}
                          <td className="border border-gray-300 relative whitespace-nowrap px-3 py-2 text-left text-sm font-medium ">
                            <div className="flex items-center space-x-1 justify-center">
                              <button
                                onClick={() => openImageModal(producto.imageUrl)}
                                className="text-gray-600 hover:text-gray-900 p-1 rounded-full hover:bg-gray-100 "
                                title="Ver Imagen"
                                disabled={!producto.imageUrl}
                              >
                                <PhotoIcon className="h-5 w-5" />
                              </button>

                              <button
                                onClick={() => openProductModelsModal(producto)}
                                className="text-purple-600 hover:text-purple-900 p-1 rounded-full hover:bg-gray-100"
                                title="Ver Modelos Compatibles"
                                disabled={!producto.modelosCompatiblesTexto || producto.modelosCompatiblesTexto.trim() === ''}
                              >
                                <ListBulletIcon className="h-5 w-5" />
                              </button>

                              <button
                                onClick={() => openProductDetailsModal(producto)}
                                className="text-emerald-600 hover:text-emerald-900 p-1 rounded-full hover:bg-gray-100"
                                title="Ver Detalles Completos"
                              >
                                <EyeIcon className="h-5 w-5" />
                              </button>

                              <button
                                onClick={() => router.push(`/productos/${producto.id}`)}
                                className="text-blue-600 hover:text-blue-900 p-1 rounded-full hover:bg-gray-100"
                                title="Editar Producto"
                              >
                                <PencilIcon className="h-5 w-5" />
                              </button>

                              <button
                                onClick={() => handleDelete(producto.id)}
                                className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-gray-100"
                                title="Eliminar Producto"
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


            {/* Panel de Cotización Activa */}
            <ActiveQuotationPanel
              isOpen={showQuotationPanel}
              onClose={() => setShowQuotationPanel(false)}
              activeQuotation={activeQuotation}
              activeQuotationItems={activeQuotationItems}
              clientes={clientes}
              setActiveQuotationId={setActiveQuotationId}
              onUpdateQuotationClient={handleUpdateQuotationClient}
              onRemoveItem={handleRemoveItemFromQuotation}
              onUpdateItemQuantity={handleUpdateItemQuantityInQuotation}
              pendingQuotations={pendingQuotations}
              onSelectPendingQuotation={handleSelectPendingQuotation}
              onUpdateQuotationPaymentMethod={handleUpdateQuotationPaymentMethod}
              onFinalizeQuotation={handleFinalizeQuotation} // Now this function handles the full finalization logic
            />
          </div>
        </div>
      </div>

      {/* Modales existentes */}
      <ImageModal imageUrl={currentImageUrl} onClose={closeImageModal} />
      <ProductDetailsModal isOpen={isProductDetailsModalOpen} onClose={closeProductDetailsModal} product={selectedProductForDetails} />
      <ProductModelsModal isOpen={isProductModelsModalOpen} onClose={closeProductModelsModal} product={selectedProductForModels} />
    </Layout>
  );
};

export default ProductosPage;
