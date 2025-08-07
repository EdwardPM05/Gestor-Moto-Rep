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
    doc,
    getDoc
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
            // Reemplazar alert con el modal de alerta personalizado
            onClose();
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
    
    // Función auxiliar para obtener los detalles del producto desde Firestore
    const getProductDetails = async (productoId) => {
        if (!productoId) return {};
        try {
            const docRef = doc(db, "productos", productoId); // Asume que tienes una colección llamada "productos"
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                return docSnap.data();
            } else {
                console.log("No such document!");
                return {};
            }
        } catch (error) {
            console.error("Error al obtener detalles del producto:", error);
            return {};
        }
    };

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

    // Función para generar el PDF con un diseño de cotización
    const generarPDF = async (cliente, creditos) => {
        try {
            const { jsPDF } = await import('jspdf');
            
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: 'a4',
            });
            const pageWidth = pdf.internal.pageSize.width;
            const pageHeight = pdf.internal.pageSize.height;
            const margin = 10; // Margen reducido
            const totalWidth = pageWidth - 2 * margin;
            
            let currentY = 15;

            // =========================================================================
            // ENCABEZADO: INFORMACIÓN DE LA EMPRESA, CRÉDITO Y VENDEDOR
            // =========================================================================

            // Configuración de la fuente por defecto
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(12); // Fuente más pequeña
            
            // Título de la empresa (izquierda)
            pdf.text('MOTORES & REPUESTOS SAC', margin, currentY);
            
            // Número de crédito (derecha)
            pdf.text(`CRÉDITO Nro. ${creditos[0]?.numeroCredito || 'N/A'}`, pageWidth - margin, currentY, { align: 'right' });
            currentY += 5;

            pdf.setFontSize(8); // Fuente más pequeña para los detalles
            pdf.setFont('helvetica', 'normal');
            
            // Detalles de la empresa (izquierda)
            pdf.text('R.U.C: 20123456789', margin, currentY);
            pdf.text('Email: motoresrepuestos@mail.com', margin, currentY + 4);
            pdf.text('Dirección: Av. Los Motores 456, San Borja', margin, currentY + 8);
            pdf.text('Teléfono: 999 888 777', margin, currentY + 12);
            pdf.text('Credito realizado en tienda Av.Los Motores 456 San Borja', margin, currentY + 16);
            currentY += 20;
            

            // Información de la cotización (abajo del encabezado)
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            
            const fechaCreacion = creditos[0]?.fechaCreacion?.toDate ? 
                creditos[0].fechaCreacion.toDate().toLocaleDateString('es-PE') : 
                new Date().toLocaleDateString('es-PE');
            
            pdf.text('FECHA DE CREACIÓN:', margin, currentY);
            pdf.setFont('helvetica', 'normal');
            pdf.text(fechaCreacion, margin + 33, currentY);

            pdf.setFont('helvetica', 'normal');
            pdf.text('FORMA DE PAGO:', pageWidth / 2, currentY);
            pdf.setFont('helvetica', 'normal');
            pdf.text('  Todos los medios de pago', pageWidth / 2 + 25, currentY);
            currentY += 5;

            // Línea divisora
            pdf.line(margin, currentY, pageWidth - margin, currentY);
            currentY += 5;

            // =========================================================================
            // INFORMACIÓN DEL CLIENTE
            // =========================================================================

            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'bold');
            pdf.text('CLIENTE:', margin, currentY);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`${cliente.nombre} ${cliente.apellido || ''}`, margin + 15, currentY);
            currentY += 5;
            
            pdf.setFont('helvetica', 'bold');
            pdf.text('DNI:', margin, currentY);
            pdf.setFont('helvetica', 'normal');
            // Corrección: se convierte el DNI a string para evitar errores con jsPDF
            pdf.text(String(cliente.dni || 'N/A'), margin + 15, currentY);
            currentY += 7;
            
            // =========================================================================
            // TABLA DE ITEMS
            // =========================================================================

            // Se cambian los encabezados de la tabla
            const tableHeaders = ['Cód. Tienda', 'Descripcion', 'Color', 'Medida', 'Marca', 'Ubicación', 'Cant.', 'P. Unitario', 'P. Total'];
            
            // Se ajustan los anchos de las columnas para que sean más compactos
            const colWidths = [
                totalWidth * 0.15, // Cód. Tienda (Nuevo)
                totalWidth * 0.23, // Item (ajustado para ser más ancho)
                totalWidth * 0.1,  // Color
                totalWidth * 0.13, // Medida
                totalWidth * 0.1,  // Marca
                totalWidth * 0.1,  // Ubicación (ajustado)
                totalWidth * 0.05, // Cant. (ajustado para ser más pequeño)
                totalWidth * 0.08, // Precio Unitario (ajustado)
                totalWidth * 0.06  // Precio Total (ajustado)
            ];
            let currentX = margin;

            pdf.setFontSize(8); // Fuente más pequeña para la tabla
            pdf.setFont('helvetica', 'bold');
            
            // Línea de la tabla
            pdf.setDrawColor(0, 0, 0);
            pdf.line(margin, currentY, pageWidth - margin, currentY);
            currentY += 3;

            // Encabezados de la tabla
            tableHeaders.forEach((header, index) => {
                pdf.text(header, currentX, currentY);
                currentX += colWidths[index];
            });
            currentY += 3;

            // Línea de la tabla
            pdf.setDrawColor(0, 0, 0);
            pdf.line(margin, currentY, pageWidth - margin, currentY);
            currentY += 3;
            
            pdf.setFont('helvetica', 'normal');
            let totalGeneral = 0;

            for (const credito of creditos) {
                // Se usa 'items' como se llama el array de productos
                if (credito.items && credito.items.length > 0) {
                    for (const item of credito.items) {
                        // Obtener los detalles del producto usando el productoId
                        const productDetails = await getProductDetails(item.productoId);
                        
                        // Añadir nueva página si es necesario
                        if (currentY > pageHeight - 30) { // Se reduce el espacio de seguridad
                            pdf.addPage();
                            currentY = 15;
                            // Volver a dibujar los encabezados en la nueva página
                            currentX = margin;
                            pdf.setFont('helvetica', 'bold');
                            pdf.setFontSize(8);
                            pdf.line(margin, currentY, pageWidth - margin, currentY);
                            currentY += 3;
                            tableHeaders.forEach((header, idx) => {
                                pdf.text(header, currentX, currentY);
                                currentX += colWidths[idx];
                            });
                            currentY += 3;
                            pdf.line(margin, currentY, pageWidth - margin, currentY);
                            currentY += 3;
                            pdf.setFont('helvetica', 'normal');
                        }
                        
                        currentX = margin;
                        // Nuevo campo: Código de Tienda
                        pdf.text(productDetails.codigoTienda || 'N/A', currentX, currentY);
                        currentX += colWidths[0];
                        // Campo Item
                        pdf.text(item.nombreProducto || 'N/A', currentX, currentY);
                        currentX += colWidths[1];
                        // Nuevas columnas - se usan los datos de productDetails
                        pdf.text(productDetails.color || 'N/A', currentX, currentY, { align: 'left' });
                        currentX += colWidths[2];
                        pdf.text(productDetails.medida || 'N/A', currentX, currentY, { align: 'left' });
                        currentX += colWidths[3];
                        pdf.text(productDetails.marca || 'N/A', currentX, currentY, { align: 'left' });
                        currentX += colWidths[4];
                        pdf.text(productDetails.ubicacion || 'N/A', currentX, currentY, { align: 'left' });
                        currentX += colWidths[5];
                        pdf.text(String(item.cantidad || 0), currentX, currentY, { align: 'left' });
                        currentX += colWidths[6];
                        
                        // Se cambia el texto a "Precio Unitario"
                        pdf.text(`S/. ${parseFloat(item.precioVentaUnitario || 0).toFixed(2)}`, currentX, currentY, { align: 'left' });
                        currentX += colWidths[7];
                        
                        // Se cambia el texto a "Precio Total"
                        pdf.text(`S/. ${parseFloat(item.subtotal || 0).toFixed(2)}`, currentX, currentY, { align: 'left' });
                        
                        totalGeneral += parseFloat(item.subtotal || 0);
                        currentY += 5; // Espacio entre filas reducido
                    }
                }
            }

            currentY += 5;
            pdf.line(margin, currentY, pageWidth - margin, currentY);
            currentY += 5;

            // =========================================================================
            // TOTALES
            // =========================================================================
            
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10); // Fuente más pequeña para los totales
            
            // Se corrige la posición para que no se superponga con la línea
            pdf.text('TOTAL:', pageWidth - margin - 50, currentY);
            pdf.text(`S/. ${totalGeneral.toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' });
            currentY += 6;

            // Pie de página
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`Reporte generado el ${new Date().toLocaleString('es-PE')}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
            
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
