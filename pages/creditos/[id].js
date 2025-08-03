// pages/creditos/[id].js
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db } from '../../lib/firebase'; // Asegúrate que esta ruta sea correcta
import { useAuth } from '../../contexts/AuthContext'; // Asegúrate que esta ruta sea correcta
import Layout from '../../components/Layout'; // Asegúrate que esta ruta sea correcta
import {
  collection,
  query,
  where,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  getDocs,
  orderBy,
  getDoc
} from 'firebase/firestore';
import {
  CreditCardIcon,
  ArrowDownTrayIcon,
  ShoppingCartIcon,
  CheckIcon,
  CurrencyDollarIcon,
  CubeIcon,
  ArrowLeftIcon,
  DocumentIcon // Icono para representar un crédito
} from '@heroicons/react/24/outline';

// Modal de alerta personalizado
const CustomAlert = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
      <div className="relative p-5 border w-96 shadow-lg rounded-md bg-white">
        <h3 className="lg:text-lg text-base font-bold text-gray-900">Notificación</h3>
        <p className="mt-2 text-sm text-gray-500">{message}</p>
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-auto shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
};


const ClienteCreditoDetalle = () => {
  const router = useRouter();
  const { id: clienteId } = router.query;
  const { user } = useAuth();

  const [cliente, setCliente] = useState(null);
  const [creditosConItems, setCreditosConItems] = useState([]); // Array de objetos de crédito, cada uno conteniendo sus items
  const [productosSeleccionados, setProductosSeleccionados] = useState([]); // [ {itemId, creditoId}, ... ]
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [alertMessage, setAlertMessage] = useState('');

  const showAlert = (message) => setAlertMessage(message);
  const closeAlert = () => setAlertMessage('');

  // Redirigir si no está autenticado
  useEffect(() => {
    if (!user) {
      router.push('/auth');
    }
  }, [user, router]);

  // Cargar detalles del cliente y los créditos con sus ítems
  useEffect(() => {
    if (!clienteId || !user) {
      setLoading(false);
      return;
    }

    const fetchClientAndCreditos = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch Client Details
        const clientDocRef = doc(db, 'cliente', clienteId);
        const clientDocSnap = await getDoc(clientDocRef);
        if (clientDocSnap.exists()) {
          // No actualizamos montoCreditoActual aquí inicialmente, lo calcularemos desde los ítems
          setCliente({ id: clientDocSnap.id, ...clientDocSnap.data() });
        } else {
          setError("Cliente no encontrado.");
          setLoading(false);
          return;
        }

        // 2. Fetch Active Credits for the client
        console.log("Cargando créditos para clienteId:", clienteId);
        const creditosQuery = query(
          collection(db, 'creditos'),
          where('clienteId', '==', clienteId),
          where('estado', '==', 'activo')
        );
        const creditosSnapshot = await getDocs(creditosQuery);
        
        console.log("Créditos activos encontrados para clienteId", clienteId, ":", creditosSnapshot.docs.length);

        let totalAdeudadoCalculado = 0; // Variable para sumar el monto real adeudado
        const loadedCreditosConItems = [];
        for (const creditoDoc of creditosSnapshot.docs) {
          const creditoData = { id: creditoDoc.id, ...creditoDoc.data(), items: [] };
          console.log("Procesando crédito ID:", creditoDoc.id, "para clienteId:", clienteId);

          // Fetch items for each credit
          const itemsCreditoQuery = query(
            collection(db, 'creditos', creditoDoc.id, 'itemsCredito'),
            orderBy('createdAt', 'desc') // Requires a composite index for 'itemsCredito' collection group on 'createdAt'
          );
          const itemsSnapshot = await getDocs(itemsCreditoQuery);
          console.log(`Items en subcolección 'itemsCredito' para crédito ${creditoDoc.id}:`, itemsSnapshot.docs.length);

          itemsSnapshot.forEach(itemDoc => {
            const itemData = {
              id: itemDoc.id,
              creditoId: creditoDoc.id, // Add the credit ID to the item
              ...itemDoc.data()
            };
            creditoData.items.push(itemData);
            totalAdeudadoCalculado += (itemData.subtotal || 0); // Sumar al total adeudado
          });
          loadedCreditosConItems.push(creditoData);
        }
        
        setCreditosConItems(loadedCreditosConItems);
        // Actualizar el estado del cliente con el monto calculado
        setCliente(prevCliente => ({
            ...prevCliente,
            montoCreditoActual: totalAdeudadoCalculado // Actualiza el monto con el cálculo real
        }));
        console.log("Todos los créditos con sus ítems cargados:", loadedCreditosConItems);
        console.log("Total adeudado calculado desde ítems:", totalAdeudadoCalculado);


      } catch (err) {
        console.error('Error al cargar datos del cliente y créditos:', err);
        setError("Error al cargar la información del crédito: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchClientAndCreditos();
  }, [clienteId, user]);

  // Alternar selección de producto
  // Ahora productoSeleccionado es un objeto { itemId, creditoId }
  const toggleProductoSeleccionado = (itemId, creditoId) => {
    setProductosSeleccionados(prev => {
      const isSelected = prev.some(
        (sel) => sel.itemId === itemId && sel.creditoId === creditoId
      );

      if (isSelected) {
        return prev.filter(
          (sel) => !(sel.itemId === itemId && sel.creditoId === creditoId)
        );
      } else {
        return [...prev, { itemId, creditoId }];
      }
    });
  };

  // Calcular total seleccionado
  const calcularTotalSeleccionado = () => {
    let total = 0;
    productosSeleccionados.forEach(selectedItem => {
      // Buscar el crédito y luego el ítem dentro de ese crédito
      const credito = creditosConItems.find(c => c.id === selectedItem.creditoId);
      if (credito) {
        const item = credito.items.find(i => i.id === selectedItem.itemId);
        if (item) {
          total += (item.subtotal || 0);
        }
      }
    });
    return total;
  };

  // Procesar pago y convertir a venta
  const procesarPagoCredito = async () => {
    if (productosSeleccionados.length === 0) {
      showAlert('Selecciona al menos un producto para pagar');
      return;
    }

    const totalAPagar = calcularTotalSeleccionado();
    const confirmPayment = window.confirm(
      `¿Estás seguro de procesar el pago de S/. ${totalAPagar.toFixed(2)} por los productos seleccionados?`
    );
    if (!confirmPayment) {
      return;
    }

    try {
      // Get a fresh client document to ensure we have the latest montoCreditoActual
      const clientDocRef = doc(db, 'cliente', cliente.id);
      const clientDocSnap = await getDoc(clientDocRef);
      if (!clientDocSnap.exists()) {
          showAlert("Error: Cliente no encontrado para actualizar monto.");
          return;
      }
      const currentClientData = clientDocSnap.data();
      const currentMontoCreditoActual = currentClientData.montoCreditoActual || 0;

      const itemsAPagar = [];
      productosSeleccionados.forEach(selectedItem => {
          const credito = creditosConItems.find(c => c.id === selectedItem.creditoId);
          if (credito) {
              const item = credito.items.find(i => i.id === selectedItem.itemId);
              if (item) {
                  itemsAPagar.push(item);
              }
          }
      });

      // Create the sale
      const ventaData = {
        clienteId: cliente.id,
        clienteNombre: cliente.nombre,
        clienteDNI: cliente.dni,
        metodoPago: metodoPago,
        totalVenta: totalAPagar,
        tipoVenta: 'creditoSaldado',
        estado: 'completada',
        fechaVenta: new Date(),
        observaciones: 'Convertido de crédito',
        empleadoId: user.uid,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const ventaRef = await addDoc(collection(db, 'ventas'), ventaData);
      console.log("Venta creada con ID:", ventaRef.id);

      // Create sale items
      for (const item of itemsAPagar) {
        await addDoc(collection(db, 'ventas', ventaRef.id, 'itemsVenta'), {
          productoId: item.productoId || '',
          nombreProducto: item.nombreProducto,
          cantidad: item.cantidad,
          precioVentaUnitario: item.precioVentaUnitario,
          subtotal: item.subtotal,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      console.log("Items de venta creados.");

      // Delete paid items from credit and update parent credit status
      const creditIdsToUpdate = new Set();
      for (const item of itemsAPagar) {
        if (item.creditoId && item.id) {
          await deleteDoc(doc(db, 'creditos', item.creditoId, 'itemsCredito', item.id));
          creditIdsToUpdate.add(item.creditoId);
          console.log(`Item ${item.id} deleted from credit ${item.creditoId}`);
        }
      }
      
      // Update parent credit documents if they are now empty
      for (const creditId of creditIdsToUpdate) {
        const remainingItemsQuery = query(collection(db, 'creditos', creditId, 'itemsCredito'));
        const remainingItemsSnapshot = await getDocs(remainingItemsQuery);
        if (remainingItemsSnapshot.empty) {
          console.log(`Credit ${creditId} has no more items. Updating its status.`);
          await updateDoc(doc(db, 'creditos', creditId), {
            estado: 'completado',
            updatedAt: new Date(),
          });
        }
      }

      // Update client's current credit amount
      // This part now uses the fetched currentMontoCreditoActual
      const nuevoMonto = Math.max(0, currentMontoCreditoActual - totalAPagar);
      await updateDoc(doc(db, 'cliente', cliente.id), {
        montoCreditoActual: nuevoMonto,
        updatedAt: new Date()
      });
      console.log(`Monto de crédito del cliente actualizado a S/. ${nuevoMonto.toFixed(2)}`);

      showAlert(`Pago procesado exitosamente por S/. ${totalAPagar.toFixed(2)}. Redirigiendo...`);
      setTimeout(() => {
        router.push('/creditos/activos'); // REDIRIGE A LA PÁGINA DE CRÉDITOS ACTIVOS GLOBAL
      }, 2000);

    } catch (error) {
      console.error('Error al procesar pago:', error);
      showAlert('Error al procesar el pago. Inténtalo de nuevo.');
    }
  };
  

  // Generar reporte PDF
  const generarReportePDF = async (clienteToReport, creditosToReport) => {
    if (!clienteToReport || creditosToReport.length === 0) {
      showAlert("No hay créditos o productos para generar el reporte.");
      return;
    }

    try {
      const jsPDF = (await import('jspdf')).default;
      await import('jspdf-autotable');

      const pdf = new jsPDF();
      const fechaHoy = new Date().toLocaleDateString('es-PE');
      let finalY = 20;

      pdf.setFontSize(16);
      pdf.text('REPORTE DE CRÉDITO DEL CLIENTE', 20, finalY);
      finalY += 10;
      
      pdf.setFontSize(12);
      pdf.text(`Fecha de Emisión: ${fechaHoy}`, 20, finalY);
      finalY += 10;

      pdf.text(`Cliente: ${clienteToReport.nombre} ${clienteToReport.apellido || ''}`, 20, finalY);
      finalY += 7;
      pdf.text(`DNI: ${clienteToReport.dni}`, 20, finalY);
      finalY += 7;
      // Use the actual calculated total from the state for PDF
      pdf.text(`Total Adeudado: S/. ${cliente.montoCreditoActual.toFixed(2)}`, 20, finalY); 
      finalY += 15;
      
      pdf.setFontSize(14);
      pdf.text('DETALLE DE CRÉDITOS Y PRODUCTOS', 20, finalY);
      finalY += 10;
      
      for (const credito of creditosToReport) {
        pdf.setFontSize(12);
        pdf.text(`Crédito ID: ${credito.id}`, 20, finalY);
        finalY += 7;
        pdf.text(`Fecha de Creación: ${credito.fechaCreacion?.toDate ?
            credito.fechaCreacion.toDate().toLocaleDateString('es-PE') :
            (credito.fechaCreacion && new Date(credito.fechaCreacion.seconds * 1000 + credito.fechaCreacion.nanoseconds / 1000000).toLocaleDateString('es-PE'))
        }`, 20, finalY);
        finalY += 7;
        pdf.text(`Monto Original: S/. ${credito.totalCredito?.toFixed(2)}`, 20, finalY);
        finalY += 7;
        // Calculate the outstanding balance for this specific credit by summing its items
        const saldoPendienteCredito = credito.items.reduce((sum, item) => sum + item.subtotal, 0);
        pdf.text(`Saldo Pendiente (de este crédito): S/. ${saldoPendienteCredito.toFixed(2)}`, 20, finalY);
        finalY += 10;

        if (credito.items && credito.items.length > 0) {
          const headers = [["Producto", "Cantidad", "Precio Unitario", "Subtotal"]];
          const data = credito.items.map(item => [
            item.nombreProducto,
            item.cantidad,
            `S/. ${item.precioVentaUnitario?.toFixed(2)}`,
            `S/. ${item.subtotal?.toFixed(2)}`
          ]);

          pdf.autoTable({
            startY: finalY,
            head: headers,
            body: data,
            theme: 'striped',
            styles: { fontSize: 9, cellPadding: 2, halign: 'center' },
            headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold' }
          });
          finalY = pdf.autoTable.previous.finalY + 10; // Move Y for next section
        } else {
          pdf.text('Este crédito no tiene productos pendientes.', 20, finalY);
          finalY += 10;
        }
        finalY += 5; // Add some space between credits
      }


      pdf.save(`reporte-credito-${clienteToReport.nombre}-${fechaHoy}.pdf`);

    } catch (error) {
      console.error('Error al generar PDF:', error);
      showAlert('Error al generar el reporte PDF. Por favor, inténtalo de nuevo.');
    }
  };


  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <Layout title="Cargando Crédito...">
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="ml-4 text-lg text-gray-700">Cargando detalles del crédito...</p>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Error de Crédito">
        <CustomAlert message={alertMessage || error} onClose={() => { closeAlert(); setError(null); router.push('/creditos/activos'); }} />
        <div className="flex flex-col items-center justify-center h-screen text-red-700">
          <p className="text-xl">Ocurrió un error:</p>
          <p className="text-lg">{error}</p>
          <button
            onClick={() => router.push('/creditos/activos')} // Redirige a la lista de todos los créditos activos
            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Volver a la lista de créditos
          </button>
        </div>
      </Layout>
    );
  }

  if (!cliente) {
    return (
        <Layout title="Cliente no encontrado">
            <div className="flex flex-col items-center justify-center h-screen text-gray-700">
                <p className="text-xl">Cliente no encontrado o ID inválido.</p>
                <button
                    onClick={() => router.push('/creditos/activos')} // Redirige a la lista de todos los créditos activos
                    className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                    Volver a la lista de créditos
                </button>
            </div>
        </Layout>
    );
  }

  const totalProductosEnCredito = creditosConItems.reduce((count, credito) => count + credito.items.length, 0);

  return (
    <Layout title={`Crédito - ${cliente.nombre}`}>
      <CustomAlert message={alertMessage} onClose={closeAlert} />
      <div className="flex flex-col mx-4 py-4">
        <div className="w-full p-6 bg-white rounded-lg shadow-md">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/creditos/activos')} // Redirige a la lista de todos los créditos activos
                className="mr-4 p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <CreditCardIcon className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  Crédito de {cliente.nombre} {cliente.apellido || ''}
                </h1>
                <p className="text-gray-600">DNI: {cliente.dni}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Total adeudado</p>
              <p className="text-2xl font-bold text-red-600">
                {/* Usa el montoCreditoActual calculado */}
                S/. {(cliente.montoCreditoActual || 0).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Créditos y sus productos */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <DocumentIcon className="h-5 w-5 mr-2" />
              Créditos Activos ({creditosConItems.length})
            </h2>

            {creditosConItems.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay créditos activos para este cliente.</p>
            ) : (
              <div className="space-y-6">
                {creditosConItems.map((credito) => (
                  <div key={credito.id} className="border border-gray-200 rounded-lg p-4 shadow-sm bg-gray-50">
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
                      <div>
                        <h3 className="text-lg font-bold text-gray-700 flex items-center">
                          <CreditCardIcon className="h-5 w-5 mr-2 text-indigo-600" />
                          Crédito ID: <span className="text-indigo-600 ml-2 text-sm">{credito.id}</span>
                        </h3>
                        <p className="text-sm text-gray-600">
                            Número de Crédito: {credito.numeroCredito || 'N/A'}
                        </p>
                        <p className="text-sm text-gray-600">
                            Fecha de Creación: {credito.fechaCreacion?.toDate ?
                                credito.fechaCreacion.toDate().toLocaleDateString('es-PE') :
                                (credito.fechaCreacion && new Date(credito.fechaCreacion.seconds * 1000 + credito.fechaCreacion.nanoseconds / 1000000).toLocaleDateString('es-PE'))
                            }
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Monto Original</p>
                        <p className="text-xl font-bold text-blue-600">
                            S/. {credito.totalCredito?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                    </div>

                    {/* Productos dentro de este crédito */}
                    <h4 className="font-semibold mb-2 flex items-center">
                      <CubeIcon className="h-4 w-4 mr-1 text-gray-600" />
                      Productos de este Crédito ({credito.items.length})
                    </h4>
                    {credito.items.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">Este crédito no tiene productos pendientes.</p>
                    ) : (
                      <div className="space-y-2">
                        {credito.items.map((item) => (
                          <div
                            key={item.id}
                            className={`p-3 rounded-md border-2 cursor-pointer transition-all ${
                              productosSeleccionados.some(sel => sel.itemId === item.id && sel.creditoId === credito.id)
                                ? 'border-green-500 bg-green-50'
                                : 'border-gray-200 bg-white hover:border-blue-100'
                            }`}
                            onClick={() => toggleProductoSeleccionado(item.id, credito.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <div className={`w-5 h-5 rounded-full border-2 mr-2 flex items-center justify-center ${
                                  productosSeleccionados.some(sel => sel.itemId === item.id && sel.creditoId === credito.id)
                                    ? 'border-green-500 bg-green-500'
                                    : 'border-gray-300'
                                }`}>
                                  {productosSeleccionados.some(sel => sel.itemId === item.id && sel.creditoId === credito.id) && (
                                    <CheckIcon className="h-3 w-3 text-white" />
                                  )}
                                </div>
                                <div>
                                  <h5 className="font-semibold text-gray-800 text-sm">
                                    {item.nombreProducto}
                                  </h5>
                                  <p className="text-xs text-gray-600">
                                    Cant: {item.cantidad} | P. Unit: S/. {item.precioVentaUnitario?.toFixed(2)}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-md">
                                  S/. {item.subtotal?.toFixed(2)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resumen de Selección */}
          {totalProductosEnCredito > 0 && productosSeleccionados.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center">
                <p className="text-blue-800">
                  {productosSeleccionados.length} producto(s) seleccionado(s)
                </p>
                <p className="text-blue-800 font-bold text-lg">
                  Total a pagar por seleccionados: S/. {calcularTotalSeleccionado().toFixed(2)}
                </p>
              </div>
            </div>
          )}

          {/* Métodos de Pago */}
          {totalProductosEnCredito > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 flex items-center">
                <CurrencyDollarIcon className="h-5 w-5 mr-2" />
                Método de Pago
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {['efectivo', 'tarjeta', 'transferencia'].map((metodo) => (
                  <button
                    key={metodo}
                    onClick={() => setMetodoPago(metodo)}
                    className={`p-3 rounded-lg border-2 capitalize transition-all ${
                      metodoPago === metodo
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {metodo}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Botones de Acción */}
          {totalProductosEnCredito > 0 && (
            <div className="flex flex-col md:flex-row gap-3">
              <button
                onClick={procesarPagoCredito}
                disabled={productosSeleccionados.length === 0}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center"
              >
                <ShoppingCartIcon className="h-5 w-5 mr-2" />
                Procesar Pago y Convertir a Venta
              </button>

              <button
                onClick={() => generarReportePDF(cliente, creditosConItems)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center"
              >
                <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                Generar PDF de Crédito
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ClienteCreditoDetalle;