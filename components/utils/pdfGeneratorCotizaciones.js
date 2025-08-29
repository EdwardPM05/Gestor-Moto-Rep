// utils/pdfGeneratorCotizaciones.js - VERSIÓN CORREGIDA
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

// Función para cargar la fuente SimplifiedArabic (igual que en ventas)
const loadCustomFont = async (pdf) => {
    try {
        const fontPaths = [
            '/fonts/SimplifiedArabic.ttf',
            '/fonts/Simplified Arabic.ttf', 
            '/fonts/simplified-arabic.ttf',
            '/fonts/SimplifiedArabic-Regular.ttf'
        ];
        
        let fontLoaded = false;
        
        for (const fontPath of fontPaths) {
            try {
                console.log(`Intentando cargar fuente desde: ${fontPath}`);
                const response = await fetch(fontPath);
                
                if (response.ok) {
                    const fontData = await response.arrayBuffer();
                    
                    if (fontData.byteLength === 0) {
                        console.warn(`Archivo de fuente vacío: ${fontPath}`);
                        continue;
                    }
                    
                    const fontBase64 = arrayBufferToBase64(fontData);
                    
                    try {
                        const fileName = fontPath.split('/').pop();
                        pdf.addFileToVFS(fileName, fontBase64);
                        pdf.addFont(fileName, 'SimplifiedArabic', 'normal');
                        pdf.addFont(fileName, 'SimplifiedArabic', 'bold');
                        
                        console.log(`✅ Fuente SimplifiedArabic cargada exitosamente desde: ${fontPath}`);
                        fontLoaded = true;
                        break;
                        
                    } catch (fontRegisterError) {
                        console.warn(`Error registrando fuente ${fontPath}:`, fontRegisterError.message);
                        continue;
                    }
                }
            } catch (fetchError) {
                console.warn(`No se pudo cargar ${fontPath}:`, fetchError.message);
                continue;
            }
        }
        
        if (fontLoaded) {
            return 'SimplifiedArabic';
        } else {
            throw new Error('No se pudo cargar ninguna variante de SimplifiedArabic');
        }
        
    } catch (error) {
        console.error('Error cargando SimplifiedArabic:', error.message);
        console.log('🔄 Usando fuente Times como alternativa elegante');
        return 'times';
    }
};

// Función auxiliar para convertir ArrayBuffer a base64
const arrayBufferToBase64 = (buffer) => {
    try {
        if (!buffer || buffer.byteLength === 0) {
            throw new Error('Buffer vacío o inválido');
        }
        
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        
        const chunkSize = 0x8000; // 32KB chunks
        for (let i = 0; i < len; i += chunkSize) {
            const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
            binary += String.fromCharCode.apply(null, chunk);
        }
        
        return btoa(binary);
    } catch (error) {
        console.error('Error convirtiendo ArrayBuffer a base64:', error);
        throw error;
    }
};

// FUNCIÓN CORREGIDA PARA MANEJAR FECHAS DE FIRESTORE
const formatFirestoreDate = (timestamp) => {
    try {
        if (!timestamp) {
            return new Date().toLocaleDateString('es-PE');
        }

        // Si es un Timestamp de Firestore
        if (timestamp.toDate && typeof timestamp.toDate === 'function') {
            return timestamp.toDate().toLocaleDateString('es-PE');
        }
        
        // Si es un objeto con seconds y nanoseconds (formato Firestore)
        if (timestamp.seconds !== undefined) {
            return new Date(timestamp.seconds * 1000).toLocaleDateString('es-PE');
        }
        
        // Si es una fecha estándar
        if (timestamp instanceof Date) {
            return timestamp.toLocaleDateString('es-PE');
        }
        
        // Si es un string o número, intentar parsearlo
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('es-PE');
        }
        
        // Si no se puede parsear, devolver fecha actual
        console.warn('No se pudo parsear la fecha:', timestamp);
        return new Date().toLocaleDateString('es-PE');
        
    } catch (error) {
        console.error('Error formateando fecha:', error);
        return new Date().toLocaleDateString('es-PE');
    }
};

// Función auxiliar para obtener los detalles del producto desde Firestore
const getProductDetails = async (productoId) => {
    if (!productoId) return {};
    try {
        const docRef = doc(db, "productos", productoId);
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

// FUNCIÓN CORREGIDA PARA OBTENER DATOS DEL EMPLEADO
const getEmpleadoDetails = async (empleadoId) => {
    if (!empleadoId) return null;
    
    try {
        const empleadoRef = doc(db, 'empleado', empleadoId);
        const empleadoSnap = await getDoc(empleadoRef);
        
        if (empleadoSnap.exists()) {
            const data = empleadoSnap.data();
            return {
                nombre: data.nombre || '',
                apellido: data.apellido || '',
                puesto: data.puesto || '',
                nombreCompleto: `${data.nombre || ''} ${data.apellido || ''}`.trim()
            };
        }
        
        return null;
    } catch (error) {
        console.error('Error al obtener datos del empleado:', error);
        return null;
    }
};

// Función para obtener los items de la cotización
const getCotizacionItems = async (cotizacionId) => {
    try {
        const itemsRef = collection(db, 'cotizaciones', cotizacionId, 'itemsCotizacion');
        const itemsSnapshot = await getDocs(itemsRef);
        
        const items = [];
        for (const itemDoc of itemsSnapshot.docs) {
            const itemData = itemDoc.data();
            items.push({
                id: itemDoc.id,
                ...itemData
            });
        }
        
        return items;
    } catch (error) {
        console.error('Error al obtener items de la cotización:', error);
        return [];
    }
};

// Función para obtener etiqueta del método de pago
const getMetodoPagoLabel = (metodo) => {
    const metodos = {
        efectivo: 'EFECTIVO',
        tarjeta_credito: 'TARJETA DE CRÉDITO',
        tarjeta_debito: 'TARJETA DE DÉBITO',
        tarjeta: 'TARJETA',
        yape: 'YAPE',
        plin: 'PLIN',
        transferencia: 'TRANSFERENCIA BANCARIA',
        deposito: 'DEPÓSITO BANCARIO',
        cheque: 'CHEQUE',
        mixto: 'PAGO MIXTO',
        otro: 'OTRO'
    };
    return metodos[metodo?.toLowerCase()] || metodo?.toUpperCase() || 'N/A';
};

// Función para obtener etiqueta del estado de cotización
const getEstadoCotizacionLabel = (estado) => {
    const estados = {
        pendiente: 'PENDIENTE',
        borrador: 'BORRADOR',
        confirmada: 'CONFIRMADA',
        cancelada: 'CANCELADA',
        enviada: 'ENVIADA',
        aprobada: 'APROBADA',
        rechazada: 'RECHAZADA'
    };
    return estados[estado] || estado?.toUpperCase() || 'PENDIENTE';
};

// FUNCIÓN PRINCIPAL CORREGIDA PARA GENERAR EL PDF DE COTIZACIÓN
const generarPDFCotizacion = async (cotizacionData, clienteData = null) => {
    try {
        const { jsPDF } = await import('jspdf');
        
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4',
        });
        
        // Cargar fuente personalizada
        const fontName = await loadCustomFont(pdf);
        
        const pageWidth = pdf.internal.pageSize.width;
        const pageHeight = pdf.internal.pageSize.height;
        const margin = 10;
        const totalWidth = pageWidth - 2 * margin;
        
        let currentY = 15;

        // =========================================================================
        // ENCABEZADO: INFORMACIÓN DE LA EMPRESA Y COTIZACIÓN
        // =========================================================================

        pdf.setFont(fontName, 'bold');
        pdf.setFontSize(12);
        
        // Título de la empresa (izquierda)
        pdf.text('MOTORES & REPUESTOS SAC', margin, currentY);
        
        // Número de cotización (derecha)
        const numeroCotizacion = cotizacionData.numeroCotizacion || `COT-${cotizacionData.id?.slice(-8) || 'N/A'}`;
        pdf.text(`COTIZACIÓN Nro. ${numeroCotizacion}`, pageWidth - margin, currentY, { align: 'right' });
        currentY += 5;

        pdf.setFontSize(8);
        pdf.setFont(fontName, 'normal');
        
        // Detalles de la empresa (izquierda)
        pdf.text('R.U.C: 20123456789', margin, currentY);
        pdf.text('Email: motoresrepuestos@mail.com', margin, currentY + 4);
        pdf.text('Dirección: Av. Los Motores 456, San Borja', margin, currentY + 8);
        pdf.text('Teléfono: 999 888 777', margin, currentY + 12);
        pdf.text('Cotización generada en tienda Av.Los Motores 456 San Borja', margin, currentY + 16);
        currentY += 20;
        
        // INFORMACIÓN DE LA COTIZACIÓN CORREGIDA
        pdf.setFontSize(8);
        pdf.setFont(fontName, 'normal');
        
        // CORREGIR EL MANEJO DE FECHAS
        const fechaCotizacion = formatFirestoreDate(cotizacionData.fechaCreacion);
        
        pdf.text('FECHA DE COTIZACIÓN:', margin, currentY);
        pdf.text(fechaCotizacion, margin + 40, currentY);

        pdf.text('ESTADO:', pageWidth / 2, currentY);
        pdf.text(getEstadoCotizacionLabel(cotizacionData.estado), pageWidth / 2 + 15, currentY);
        currentY += 5;

        // Método de pago preferido
        pdf.text('MÉTODO DE PAGO:', margin, currentY);
        const metodoPagoTexto = getMetodoPagoLabel(cotizacionData.metodoPago);
        pdf.text(metodoPagoTexto, margin + 35, currentY);
        currentY += 5;

        // Validez de la cotización
        if (cotizacionData.validezDias) {
            pdf.text('VÁLIDA POR:', margin, currentY);
            pdf.text(`${cotizacionData.validezDias} días`, margin + 25, currentY);
            currentY += 5;
        }

        // Línea divisora
        pdf.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 5;

        // =========================================================================
        // INFORMACIÓN DEL CLIENTE
        // =========================================================================

        pdf.setFontSize(8);
        pdf.setFont(fontName, 'bold');
        pdf.text('CLIENTE:', margin, currentY);
        pdf.setFont(fontName, 'normal');
        
        const clienteNombre = clienteData ? 
            `${clienteData.nombre} ${clienteData.apellido || ''}` : 
            cotizacionData.clienteNombre || 'Cliente General';
        pdf.text(clienteNombre, margin + 15, currentY);
        currentY += 5;
        
        if (clienteData && clienteData.dni) {
            pdf.setFont(fontName, 'bold');
            pdf.text('DNI:', margin, currentY);
            pdf.setFont(fontName, 'normal');
            pdf.text(String(clienteData.dni), margin + 15, currentY);
            currentY += 5;
        }

        // CORREGIR LA INFORMACIÓN DEL EMPLEADO
        // Usar empleadoAsignadoId para obtener los datos del empleado
        if (cotizacionData.empleadoAsignadoId) {
            const empleadoData = await getEmpleadoDetails(cotizacionData.empleadoAsignadoId);
            
            if (empleadoData) {
                pdf.setFont(fontName, 'bold');
                pdf.text('EMPLEADO ASIGNADO:', margin, currentY);
                pdf.setFont(fontName, 'normal');
                pdf.text(empleadoData.nombreCompleto, margin + 40, currentY);
                currentY += 5;
            }
        }

        if (cotizacionData.placaMoto) {
            pdf.setFont(fontName, 'bold');
            pdf.text('PLACA MOTO:', pageWidth / 2, currentY - 5);
            pdf.setFont(fontName, 'normal');
            pdf.text(cotizacionData.placaMoto, pageWidth / 2 + 25, currentY - 5);
        }

        if (cotizacionData.observaciones) {
            pdf.setFont(fontName, 'bold');
            pdf.text('OBSERVACIONES:', margin, currentY);
            pdf.setFont(fontName, 'normal');
            // Dividir texto largo en múltiples líneas si es necesario
            const maxWidth = totalWidth - 30;
            const lines = pdf.splitTextToSize(cotizacionData.observaciones, maxWidth);
            pdf.text(lines, margin + 30, currentY);
            currentY += lines.length * 4;
        }
        
        currentY += 5;
        
        // =========================================================================
        // TABLA DE ITEMS
        // =========================================================================

        // Obtener items de la cotización
        const items = await getCotizacionItems(cotizacionData.id);
        
        // Headers de la tabla
        const tableHeaders = ['Cód. Tienda', 'Descripción', 'Color', 'Marca', 'Ubicación', 'Medida', 'Cant.', 'P. Unitario', 'P. Total'];
        
        // Anchos de columnas
        const colWidths = [
            totalWidth * 0.12, // Cód. Tienda
            totalWidth * 0.30, // Descripción
            totalWidth * 0.08, // Color
            totalWidth * 0.10, // Marca
            totalWidth * 0.10, // Ubicación
            totalWidth * 0.08, // Medida
            totalWidth * 0.06, // Cant.
            totalWidth * 0.08, // Precio Unitario
            totalWidth * 0.08  // Precio Total
        ];

        // Calcular posiciones X para cada columna
        const colPositions = [margin];
        for (let i = 0; i < colWidths.length - 1; i++) {
            colPositions.push(colPositions[i] + colWidths[i]);
        }

        pdf.setFontSize(8);
        pdf.setFont(fontName, 'bold');
        
        // Línea superior de la tabla
        pdf.setDrawColor(0, 0, 0);
        pdf.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 3;

        // Encabezados de la tabla
        tableHeaders.forEach((header, index) => {
            const x = colPositions[index];
            const maxWidth = colWidths[index] - 2;
            
            let displayText = header;
            if (pdf.getTextWidth(displayText) > maxWidth) {
                while (pdf.getTextWidth(displayText + '...') > maxWidth && displayText.length > 1) {
                    displayText = displayText.slice(0, -1);
                }
                displayText += '...';
            }
            
            pdf.text(displayText, x + 1, currentY);
        });
        currentY += 3;

        // Línea después de encabezados
        pdf.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 3;
        
        pdf.setFont(fontName, 'normal');
        let totalCotizacion = 0;

        // Función para dibujar encabezados en nueva página
        const drawTableHeaders = () => {
            pdf.setFont(fontName, 'bold');
            pdf.setFontSize(8);
            pdf.line(margin, currentY, pageWidth - margin, currentY);
            currentY += 3;
            
            tableHeaders.forEach((header, index) => {
                const x = colPositions[index];
                const maxWidth = colWidths[index] - 2;
                
                let displayText = header;
                if (pdf.getTextWidth(displayText) > maxWidth) {
                    while (pdf.getTextWidth(displayText + '...') > maxWidth && displayText.length > 1) {
                        displayText = displayText.slice(0, -1);
                    }
                    displayText += '...';
                }
                
                pdf.text(displayText, x + 1, currentY);
            });
            currentY += 3;
            pdf.line(margin, currentY, pageWidth - margin, currentY);
            currentY += 3;
            pdf.setFont(fontName, 'normal');
        };

        // Procesar items
        for (const item of items) {
            // Verificar si necesitamos nueva página
            if (currentY > pageHeight - 50) {
                pdf.addPage();
                currentY = 15;
                drawTableHeaders();
            }
            
            // Obtener los detalles del producto
            const productDetails = await getProductDetails(item.productoId);
            
            // Datos del item
            const itemData = [
                productDetails.codigoTienda || item.codigoTienda || 'N/A',
                item.nombreProducto || 'N/A',
                productDetails.color || item.color || 'N/A',
                productDetails.marca || item.marca || 'N/A',
                productDetails.ubicacion || 'N/A',
                productDetails.medida || 'N/A',
                String(item.cantidad || 0),
                `S/. ${parseFloat(item.precioVentaUnitario || 0).toFixed(2)}`,
                `S/. ${parseFloat(item.subtotal || 0).toFixed(2)}`
            ];
            
            // Alineaciones por columna
            const alignments = ['left', 'left', 'left', 'left', 'left', 'left', 'center', 'right', 'right'];
            
            // Escribir datos de cada columna
            itemData.forEach((data, index) => {
                const x = colPositions[index];
                const maxWidth = colWidths[index] - 2;
                const alignment = alignments[index];
                
                let displayText = String(data);
                if (pdf.getTextWidth(displayText) > maxWidth) {
                    if (index === 1) { // Descripción - caso especial
                        while (pdf.getTextWidth(displayText + '...') > maxWidth && displayText.length > 1) {
                            displayText = displayText.slice(0, -1);
                        }
                        displayText += '...';
                    } else {
                        while (pdf.getTextWidth(displayText) > maxWidth && displayText.length > 1) {
                            displayText = displayText.slice(0, -1);
                        }
                    }
                }
                
                // Calcular posición X según alineación
                let textX = x + 1;
                if (alignment === 'center') {
                    textX = x + (colWidths[index] / 2);
                } else if (alignment === 'right') {
                    textX = x + colWidths[index] - 1;
                }
                
                pdf.text(displayText, textX, currentY, { align: alignment });
            });
            
            totalCotizacion += parseFloat(item.subtotal || 0);
            currentY += 5;
        }

        pdf.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 8;

        // =========================================================================
        // TOTAL DE LA COTIZACIÓN
        // =========================================================================
        
        pdf.setFontSize(10);
        pdf.setFont(fontName, 'bold');
        
        // TOTAL DE LA COTIZACIÓN
        pdf.setTextColor(0, 0, 0);
        pdf.text('TOTAL DE LA COTIZACIÓN:', margin + 10, currentY);
        pdf.text(`S/. ${(cotizacionData.totalCotizacion || totalCotizacion).toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' });
        currentY += 8;
        
        // Resetear color del texto
        pdf.setTextColor(0, 0, 0);

        // =========================================================================
        // INFORMACIÓN ADICIONAL DE COTIZACIÓN
        // =========================================================================
        
        if (currentY > pageHeight - 50) {
            pdf.addPage();
            currentY = 15;
        }
        
        pdf.setFont(fontName, 'bold');
        pdf.setFontSize(8);
        pdf.text('TÉRMINOS Y CONDICIONES:', margin, currentY);
        currentY += 6;
        
        pdf.setFont(fontName, 'normal');
        pdf.setFontSize(8);
        pdf.text('• Esta cotización tiene una validez de 7 días desde la fecha de emisión.', margin + 5, currentY);
        currentY += 4;
        pdf.text('• Los precios están sujetos a cambios sin previo aviso.', margin + 5, currentY);
        currentY += 4;
        pdf.text('• Para confirmar su pedido, comuníquese con nosotros.', margin + 5, currentY);
        currentY += 4;
        
        if (cotizacionData.validezDias) {
            pdf.text(`• Esta cotización es válida por ${cotizacionData.validezDias} días.`, margin + 5, currentY);
            currentY += 4;
        }
        
        if (cotizacionData.estado === 'confirmada') {
            pdf.text('• Esta cotización ha sido CONFIRMADA y convertida en venta.', margin + 5, currentY);
            currentY += 4;
        }
        
        currentY += 4;

        // Pie de página
        pdf.setFontSize(8);
        pdf.setFont(fontName, 'normal');
        pdf.text(`Cotización generada el ${new Date().toLocaleString('es-PE')}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        
        // Guardar PDF
        const fechaSufijo = new Date().toISOString().split('T')[0];
        const clienteSufijo = clienteNombre.replace(/\s+/g, '-').toLowerCase();
        const fileName = `cotizacion-${numeroCotizacion.replace(/[^a-zA-Z0-9]/g, '-')}-${clienteSufijo}-${fechaSufijo}.pdf`;
        pdf.save(fileName);
        
        return true;
        
    } catch (error) {
        console.error('Error al generar PDF de cotización:', error);
        throw error;
    }
};

// FUNCIÓN PRINCIPAL EXPORTADA CORREGIDA
export const generarPDFCotizacionCompleta = async (cotizacionId, cotizacionData = null, clienteData = null) => {
    try {
        // Si no se proporciona cotizacionData, obtenerla desde Firestore
        let cotizacion = cotizacionData;
        if (!cotizacion && cotizacionId) {
            const cotizacionDoc = await getDoc(doc(db, 'cotizaciones', cotizacionId));
            if (cotizacionDoc.exists()) {
                cotizacion = { id: cotizacionDoc.id, ...cotizacionDoc.data() };
            } else {
                throw new Error('Cotización no encontrada');
            }
        }
        
        if (!cotizacion) {
            throw new Error('No se pudo obtener la información de la cotización');
        }
        
        // CORREGIR LA REFERENCIA A LA COLECCIÓN DE CLIENTES
        let cliente = clienteData;
        if (!cliente && cotizacion.clienteId && cotizacion.clienteId !== 'general') {
            try {
                const clienteDoc = await getDoc(doc(db, 'cliente', cotizacion.clienteId)); // CAMBIÉ 'clientes' por 'cliente'
                if (clienteDoc.exists()) {
                    cliente = clienteDoc.data();
                }
            } catch (error) {
                console.warn('No se pudo obtener información del cliente:', error);
            }
        }
        
        await generarPDFCotizacion(cotizacion, cliente);
        return `Cotización generada exitosamente para ${cotizacion.clienteNombre || 'Cliente General'}`;
        
    } catch (error) {
        console.error('Error al generar PDF de cotización:', error);
        throw new Error('Error al generar la cotización. Por favor, inténtalo de nuevo.');
    }
};

export default { generarPDFCotizacionCompleta };