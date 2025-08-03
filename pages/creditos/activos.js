// pages/clientes/activos.js
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import {
  UsersIcon,
  CreditCardIcon,
  DocumentTextIcon,
  CubeIcon,
  XMarkIcon,
  PrinterIcon,
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

// Modal de selección de cliente para PDF
const ClientePDFModal = ({ isOpen, onClose, clientes, onGeneratePDF, loading }) => {
  const [selectedClienteId, setSelectedClienteId] = useState('');

  if (!isOpen) return null;

  const handleGenerate = () => {
    if (!selectedClienteId) {
      alert('Por favor, selecciona un cliente.');
      return;
    }
    const cliente = clientes.find(c => c.id === selectedClienteId);
    if (cliente) {
      onGeneratePDF(cliente);
      onClose();
      setSelectedClienteId('');
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Generar Reporte de Crédito</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        <div className="p-4">
          <label htmlFor="cliente-select" className="block text-sm font-medium text-gray-700 mb-2">
            Seleccionar Cliente:
          </label>
          <select
            id="cliente-select"
            value={selectedClienteId}
            onChange={(e) => setSelectedClienteId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">-- Seleccionar Cliente --</option>
            {clientes.map(cliente => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nombre} {cliente.apellido} - S/. {parseFloat(cliente.montoCreditoActual || 0).toFixed(2)}
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex justify-end gap-3 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleGenerate}
            disabled={!selectedClienteId || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
          >
            <PrinterIcon className="h-4 w-4 mr-2" />
            {loading ? 'Generando...' : 'Generar PDF'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ClientesConCreditoActivos = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [alertMessage, setAlertMessage] = useState('');
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const showAlert = (message) => setAlertMessage(message);
  const closeAlert = () => setAlertMessage('');

  // Redirigir si no está autenticado
  useEffect(() => {
    if (!user) {
      router.push('/auth');
    }
  }, [user, router]);

  // Escucha los cambios en la colección de clientes
  useEffect(() => {
    if (!user) return;

    setLoading(true);
    setError(null);

    const qClientes = query(
      collection(db, 'cliente'),
      where('tieneCredito', '==', true)
    );

    const unsubscribeClientes = onSnapshot(qClientes, (querySnapshot) => {
      const clientesList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        montoCreditoActual: doc.data().montoCreditoActual || 0,
      }));

      clientesList.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
      setClientes(clientesList);
      setLoading(false);
    }, (err) => {
      setError("Error al cargar la lista de clientes con crédito. " + err.message);
      setClientes([]);
      setLoading(false);
    });

    return () => {
      unsubscribeClientes();
    };
  }, [user]);

  // Generar PDF detallado para un cliente específico
  const generarPDFCliente = async (cliente) => {
    setGeneratingPDF(true);
    
    try {
      // Obtener todos los créditos activos del cliente
      const qCreditos = query(
        collection(db, 'creditos'),
        where('clienteId', '==', cliente.id),
        where('estado', '==', 'activo'),
        orderBy('fechaCreacion', 'desc')
      );
      
      const creditosSnapshot = await getDocs(qCreditos);
      const creditos = [];
      
      // Para cada crédito, obtener sus items
      for (const creditoDoc of creditosSnapshot.docs) {
        const creditoData = { id: creditoDoc.id, ...creditoDoc.data() };
        
        // Obtener items del crédito
        const qItems = query(
          collection(db, 'creditos', creditoDoc.id, 'itemsCredito'),
          orderBy('createdAt', 'asc')
        );
        const itemsSnapshot = await getDocs(qItems);
        const items = itemsSnapshot.docs.map(itemDoc => ({
          id: itemDoc.id,
          ...itemDoc.data()
        }));
        
        creditos.push({
          ...creditoData,
          items: items
        });
      }

      if (creditos.length === 0) {
        showAlert('Este cliente no tiene créditos activos para generar reporte.');
        return;
      }

      // Generar PDF
      await generarPDF(cliente, creditos);
      
    } catch (error) {
      console.error('Error al generar PDF del cliente:', error);
      showAlert('Error al generar el reporte PDF. Por favor, inténtalo de nuevo.');
    } finally {
      setGeneratingPDF(false);
    }
  };

  // Función para generar el PDF con diseño profesional
  const generarPDF = async (cliente, creditos) => {
    try {
      const jsPDF = (await import('jspdf')).default;
      
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.width;
      const pageHeight = pdf.internal.pageSize.height;
      
      // Colores
      const primaryColor = [41, 128, 185]; // Azul
      const secondaryColor = [52, 152, 219]; // Azul claro
      const textColor = [44, 62, 80]; // Gris oscuro
      
      let currentY = 20;
      
      // ENCABEZADO DE LA EMPRESA
      pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.rect(0, 0, pageWidth, 35, 'F');
      
      // Logo/Título de la empresa
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('MOTORES & REPUESTOS SAC', pageWidth/2, 15, { align: 'center' });
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text('RUC: 20123456789', pageWidth/2, 22, { align: 'center' });
      pdf.text('Av. Los Motores 456, San Borja, Lima', pageWidth/2, 28, { align: 'center' });
      
      currentY = 45;
      
      // TÍTULO DEL REPORTE
      pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('REPORTE DETALLADO DE CRÉDITOS', pageWidth/2, currentY, { align: 'center' });
      currentY += 15;
      
      // INFORMACIÓN DEL CLIENTE
      const clienteBoxY = currentY;
      pdf.setFillColor(245, 245, 245);
      pdf.rect(20, clienteBoxY, pageWidth - 40, 35, 'F');
      pdf.setDrawColor(200, 200, 200);
      pdf.rect(20, clienteBoxY, pageWidth - 40, 35, 'S');
      
      currentY += 8;
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('INFORMACIÓN DEL CLIENTE', 25, currentY);
      currentY += 8;
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Cliente: ${cliente.nombre} ${cliente.apellido || ''}`, 25, currentY);
      pdf.text(`Fecha: ${new Date().toLocaleDateString('es-PE')}`, pageWidth - 80, currentY);
      currentY += 6;
      pdf.text(`DNI: ${cliente.dni || 'N/A'}`, 25, currentY);
      pdf.text(`Teléfono: ${cliente.telefono || 'N/A'}`, pageWidth - 80, currentY);
      currentY += 6;
      pdf.text(`Email: ${cliente.email || 'N/A'}`, 25, currentY);
      currentY += 15;
      
      // RESUMEN GENERAL
      const montoTotal = creditos.reduce((total, credito) => total + (credito.totalCredito || 0), 0);
      
      pdf.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      pdf.rect(20, currentY, pageWidth - 40, 20, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('RESUMEN GENERAL', 25, currentY + 8);
      pdf.text(`Total Créditos: ${creditos.length}`, 25, currentY + 15);
      pdf.text(`MONTO TOTAL ADEUDADO: S/. ${montoTotal.toFixed(2)}`, pageWidth - 25, currentY + 15, { align: 'right' });
      currentY += 35;
      
      // DETALLE DE CRÉDITOS
      pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('DETALLE DE CRÉDITOS ACTIVOS', 20, currentY);
      currentY += 10;
      
      // Para cada crédito
      creditos.forEach((credito, creditoIndex) => {
        // Verificar si necesitamos nueva página
        if (currentY > pageHeight - 60) {
          pdf.addPage();
          currentY = 20;
        }
        
        // Encabezado del crédito
        pdf.setFillColor(240, 240, 240);
        pdf.rect(20, currentY, pageWidth - 40, 12, 'F');
        pdf.setDrawColor(200, 200, 200);
        pdf.rect(20, currentY, pageWidth - 40, 12, 'S');
        
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`CRÉDITO #${creditoIndex + 1}: ${credito.numeroCredito || 'N/A'}`, 25, currentY + 8);
        
        const fechaCredito = credito.fechaCreacion?.toDate ? 
          credito.fechaCreacion.toDate().toLocaleDateString('es-PE') : 
          new Date(credito.fechaCreacion).toLocaleDateString('es-PE');
        pdf.text(`Fecha: ${fechaCredito}`, pageWidth - 25, currentY + 8, { align: 'right' });
        currentY += 18;
        
        // Tabla de productos del crédito
        if (credito.items && credito.items.length > 0) {
          // Encabezados de la tabla
          const tableHeaders = ['Producto', 'Cant.', 'P. Unit.', 'Subtotal'];
          const colWidths = [90, 25, 35, 35];
          const startX = 25;
          
          pdf.setFillColor(230, 230, 230);
          pdf.rect(startX, currentY, colWidths.reduce((a, b) => a + b, 0), 8, 'F');
          pdf.setDrawColor(180, 180, 180);
          pdf.rect(startX, currentY, colWidths.reduce((a, b) => a + b, 0), 8, 'S');
          
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          let currentX = startX;
          tableHeaders.forEach((header, index) => {
            pdf.text(header, currentX + colWidths[index]/2, currentY + 5, { align: 'center' });
            if (index < tableHeaders.length - 1) {
              currentX += colWidths[index];
              pdf.line(currentX, currentY, currentX, currentY + 8);
            }
          });
          currentY += 8;
          
          // Filas de productos
          pdf.setFont('helvetica', 'normal');
          credito.items.forEach((item, itemIndex) => {
            if (currentY > pageHeight - 20) {
              pdf.addPage();
              currentY = 20;
            }
            
            const rowHeight = 8;
            if (itemIndex % 2 === 0) {
              pdf.setFillColor(250, 250, 250);
              pdf.rect(startX, currentY, colWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');
            }
            
            pdf.setDrawColor(200, 200, 200);
            pdf.rect(startX, currentY, colWidths.reduce((a, b) => a + b, 0), rowHeight, 'S');
            
            currentX = startX;
            // Producto
            const productName = item.nombreProducto || 'N/A';
            pdf.text(productName.length > 35 ? productName.substring(0, 32) + '...' : productName, 
                    currentX + 2, currentY + 5);
            currentX += colWidths[0];
            pdf.line(currentX, currentY, currentX, currentY + rowHeight);
            
            // Cantidad
            pdf.text(String(item.cantidad || 0), currentX + colWidths[1]/2, currentY + 5, { align: 'center' });
            currentX += colWidths[1];
            pdf.line(currentX, currentY, currentX, currentY + rowHeight);
            
            // Precio unitario
            pdf.text(`S/. ${parseFloat(item.precioVentaUnitario || 0).toFixed(2)}`, 
                    currentX + colWidths[2]/2, currentY + 5, { align: 'center' });
            currentX += colWidths[2];
            pdf.line(currentX, currentY, currentX, currentY + rowHeight);
            
            // Subtotal
            pdf.text(`S/. ${parseFloat(item.subtotal || 0).toFixed(2)}`, 
                    currentX + colWidths[3]/2, currentY + 5, { align: 'center' });
            
            currentY += rowHeight;
          });
          
          // Total del crédito
          pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          pdf.rect(startX + colWidths[0] + colWidths[1], currentY, colWidths[2] + colWidths[3], 10, 'F');
          pdf.setTextColor(255, 255, 255);
          pdf.setFont('helvetica', 'bold');
          pdf.text('TOTAL CRÉDITO:', startX + colWidths[0] + colWidths[1] + 5, currentY + 7);
          pdf.text(`S/. ${parseFloat(credito.totalCredito || 0).toFixed(2)}`, 
                  startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] - 5, currentY + 7, { align: 'right' });
          
          currentY += 20;
          pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
        } else {
          pdf.setFontSize(9);
          pdf.text('No hay productos registrados en este crédito.', 30, currentY);
          currentY += 15;
        }
      });
      
      // PIE DE PÁGINA CON TOTAL GENERAL
      if (currentY > pageHeight - 40) {
        pdf.addPage();
        currentY = 20;
      }
      
      pdf.setFillColor(220, 53, 69);
      pdf.rect(20, currentY, pageWidth - 40, 20, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('TOTAL GENERAL A PAGAR:', 25, currentY + 13);
      pdf.text(`S/. ${montoTotal.toFixed(2)}`, pageWidth - 25, currentY + 13, { align: 'right' });
      
      // Información adicional
      currentY += 30;
      pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Reporte generado el ${new Date().toLocaleString('es-PE')} por ${user.email || 'Sistema'}`, 
              pageWidth/2, currentY, { align: 'center' });
      
      // Guardar PDF
      const fileName = `reporte-credito-${cliente.nombre.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      showAlert(`Reporte PDF generado exitosamente para ${cliente.nombre} ${cliente.apellido || ''}`);
      
    } catch (error) {
      console.error('Error al generar PDF:', error);
      showAlert('Error al generar el reporte PDF. Por favor, inténtalo de nuevo.');
    }
  };

  if (!user) return null;

  return (
    <Layout title="Clientes con Crédito">
      <CustomAlert message={alertMessage} onClose={closeAlert} />
      <ClientePDFModal 
        isOpen={showPDFModal}
        onClose={() => setShowPDFModal(false)}
        clientes={clientes.filter(c => c.montoCreditoActual > 0)}
        onGeneratePDF={generarPDFCliente}
        loading={generatingPDF}
      />
      
      <div className="flex flex-col mx-4 py-4">
        <div className="w-full p-4 bg-white rounded-lg shadow-md flex flex-col">

          {/* Header principal */}
          <div className="flex flex-col md:flex-row items-center justify-between mb-6 pb-4 border-b border-gray-200">
            <div className="flex items-center mb-4 md:mb-0">
              <UsersIcon className="h-8 w-8 text-blue-600 mr-2" />
              <h1 className="text-xl font-bold text-gray-700">Sistema de Créditos Activos</h1>
            </div>

            {/* Botón de Reporte */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => setShowPDFModal(true)}
                disabled={clientes.filter(c => c.montoCreditoActual > 0).length === 0}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center text-sm w-full sm:w-auto disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <DocumentTextIcon className="h-4 w-4 mr-2" />
                Generar Reporte PDF
              </button>
            </div>
          </div>

          {/* Estadísticas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <CreditCardIcon className="h-6 w-6 text-red-600 mr-3" />
                <div>
                  <h3 className="text-sm font-semibold text-red-800">Total Adeudado</h3>
                  <p className="text-xl font-bold text-red-600">
                    S/. {clientes.reduce((total, cliente) => total + (cliente.montoCreditoActual || 0), 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <UsersIcon className="h-6 w-6 text-blue-600 mr-3" />
                <div>
                  <h3 className="text-sm font-semibold text-blue-800">Clientes con Crédito</h3>
                  <p className="text-xl font-bold text-blue-600">{clientes.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <CubeIcon className="h-6 w-6 text-green-600 mr-3" />
                <div>
                  <h3 className="text-sm font-semibold text-green-800">Promedio por Cliente</h3>
                  <p className="text-xl font-bold text-green-600">
                    S/. {clientes.length > 0 ?
                      (clientes.reduce((total, cliente) => total + (cliente.montoCreditoActual || 0), 0) / clientes.length).toFixed(2) :
                      '0.00'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {/* Sin resultados */}
          {!loading && !error && clientes.length === 0 && (
            <p className="p-4 text-center text-gray-500">No hay clientes con crédito pendiente en este momento.</p>
          )}

          {/* Tabla de clientes */}
          {!loading && !error && clientes.length > 0 && (
            <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full border-collapse">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-left">NOMBRE</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">DNI</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">MONTO DEBIDO</th>
                    <th scope="col" className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 text-center">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {clientes.map((cliente, index) => (
                    <tr key={cliente.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100 transition-colors`}>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-left">
                        <div className="font-semibold">{cliente.nombre || 'N/A'} {cliente.apellido || ''}</div>
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-black text-center">
                        {cliente.dni || 'N/A'}
                      </td>
                      <td className="border border-gray-300 whitespace-nowrap px-3 py-2 text-sm text-center">
                        <span className="font-bold text-red-600">
                          S/. {parseFloat(cliente.montoCreditoActual || 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-sm text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => router.push(`/creditos/${cliente.id}`)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs flex items-center"
                          >
                            <CreditCardIcon className="h-3 w-3 mr-1" />
                            Ver Detalle
                          </button>
                          {cliente.montoCreditoActual > 0 && (
                            <button
                              onClick={() => generarPDFCliente(cliente)}
                              disabled={generatingPDF}
                              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs flex items-center disabled:bg-gray-400"
                            >
                              <PrinterIcon className="h-3 w-3 mr-1" />
                              PDF
                            </button>
                          )}
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

export default ClientesConCreditoActivos;