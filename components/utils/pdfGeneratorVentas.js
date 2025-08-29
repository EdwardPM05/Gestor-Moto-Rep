// utils/pdfGeneratorVentas.js
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

// Función para cargar la fuente SimplifiedArabic
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

// Función para obtener los items de la venta
const getVentaItems = async (ventaId) => {
    try {
        const itemsRef = collection(db, 'ventas', ventaId, 'itemsVenta');
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
        console.error('Error al obtener items de la venta:', error);
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

// Función para obtener etiqueta del tipo de venta
const getTipoVentaLabel = (tipo) => {
    const tipos = {
        directa: 'VENTA DIRECTA',
        cotizacionAprobada: 'COTIZACIÓN APROBADA',
        abono: 'ABONO A CRÉDITO',
        credito: 'VENTA A CRÉDITO'
    };
    return tipos[tipo] || tipo?.toUpperCase() || 'VENTA DIRECTA';
};

// Función principal para generar el PDF de venta
const generarPDFVenta = async (ventaData, clienteData = null) => {
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
        // ENCABEZADO: INFORMACIÓN DE LA EMPRESA Y VENTA
        // =========================================================================

        pdf.setFont(fontName, 'bold');
        pdf.setFontSize(12);
        
        // Título de la empresa (izquierda)
        pdf.text('MOTORES & REPUESTOS SAC', margin, currentY);
        
        // Número de venta (derecha)
        const numeroVenta = ventaData.numeroVenta || `V-${ventaData.id?.slice(-8) || 'N/A'}`;
        pdf.text(`VENTA Nro. ${numeroVenta}`, pageWidth - margin, currentY, { align: 'right' });
        currentY += 5;

        pdf.setFontSize(8);
        pdf.setFont(fontName, 'normal');
        
        // Detalles de la empresa (izquierda)
        pdf.text('R.U.C: 20123456789', margin, currentY);
        pdf.text('Email: motoresrepuestos@mail.com', margin, currentY + 4);
        pdf.text('Dirección: Av. Los Motores 456, San Borja', margin, currentY + 8);
        pdf.text('Teléfono: 999 888 777', margin, currentY + 12);
        pdf.text('Venta realizada en tienda Av.Los Motores 456 San Borja', margin, currentY + 16);
        currentY += 20;
        
        // Información de la venta (abajo del encabezado)
        pdf.setFontSize(8);
        pdf.setFont(fontName, 'normal');
        
        const fechaVenta = ventaData.fechaVenta?.toDate ? 
            ventaData.fechaVenta.toDate().toLocaleDateString('es-PE') : 
            (ventaData.fechaVenta ? new Date(ventaData.fechaVenta).toLocaleDateString('es-PE') : new Date().toLocaleDateString('es-PE'));
        
        pdf.text('FECHA DE VENTA:', margin, currentY);
        pdf.setFont(fontName, 'normal');
        pdf.text(fechaVenta, margin + 30, currentY);

        pdf.setFont(fontName, 'normal');
        pdf.text('TIPO DE VENTA:', pageWidth / 2, currentY);
        pdf.setFont(fontName, 'normal');
        pdf.text(getTipoVentaLabel(ventaData.tipoVenta), pageWidth / 2 + 25, currentY);
        currentY += 5;

        // Método de pago
        pdf.setFont(fontName, 'normal');
        pdf.text('MÉTODO DE PAGO:', margin, currentY);
        
        // Manejar métodos de pago mixtos
        let metodoPagoTexto = '';
        if (ventaData.paymentData && ventaData.paymentData.isMixedPayment && ventaData.paymentData.paymentMethods) {
            const metodosActivos = ventaData.paymentData.paymentMethods
                .filter(pm => pm.amount > 0)
                .map(pm => `${getMetodoPagoLabel(pm.method)}: S/. ${pm.amount.toFixed(2)}`)
                .join(', ');
            metodoPagoTexto = metodosActivos || 'PAGO MIXTO';
        } else if (ventaData.paymentData && ventaData.paymentData.paymentMethods && ventaData.paymentData.paymentMethods.length > 0) {
            metodoPagoTexto = getMetodoPagoLabel(ventaData.paymentData.paymentMethods[0].method);
        } else {
            metodoPagoTexto = getMetodoPagoLabel(ventaData.metodoPago);
        }
        
        pdf.setFont(fontName, 'normal');
        pdf.text(metodoPagoTexto, margin + 35, currentY);
        currentY += 5;

        // Estado de la venta
        pdf.setFont(fontName, 'normal');
        pdf.text('ESTADO:', pageWidth / 2, currentY);
        pdf.setFont(fontName, 'normal');
        const estadoTexto = ventaData.estado === 'completada' ? 'COMPLETADA' : 
                           ventaData.estado === 'anulada' ? 'ANULADA' : 
                           ventaData.estado?.toUpperCase() || 'PENDIENTE';
        pdf.text(estadoTexto, pageWidth / 2 + 15, currentY);
        currentY += 5;

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
            ventaData.clienteNombre || 'Cliente General';
        pdf.text(clienteNombre, margin + 15, currentY);
        currentY += 5;
        
        if (clienteData && clienteData.dni) {
            pdf.setFont(fontName, 'bold');
            pdf.text('DNI:', margin, currentY);
            pdf.setFont(fontName, 'normal');
            pdf.text(String(clienteData.dni), margin + 15, currentY);
            currentY += 5;
        }

        if (ventaData.observaciones) {
            pdf.setFont(fontName, 'bold');
            pdf.text('OBSERVACIONES:', margin, currentY);
            pdf.setFont(fontName, 'normal');
            // Dividir texto largo en múltiples líneas si es necesario
            const maxWidth = totalWidth - 30;
            const lines = pdf.splitTextToSize(ventaData.observaciones, maxWidth);
            pdf.text(lines, margin + 30, currentY);
            currentY += lines.length * 4;
        }
        
        currentY += 5;
        
        // =========================================================================
        // TABLA DE ITEMS
        // =========================================================================

        // Obtener items de la venta
        const items = await getVentaItems(ventaData.id);
        
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
        let totalVenta = 0;

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
                productDetails.codigoTienda || 'N/A',
                item.nombreProducto || 'N/A',
                productDetails.color || 'N/A',
                productDetails.marca || 'N/A',
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
            
            totalVenta += parseFloat(item.subtotal || 0);
            currentY += 5;
        }

        pdf.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 8;

        // =========================================================================
        // TOTAL DE LA VENTA
        // =========================================================================
        
        pdf.setFontSize(10);
        pdf.setFont(fontName, 'bold');
        
        // TOTAL DE LA VENTA
        pdf.setTextColor(0, 0, 0);
        pdf.text('TOTAL DE LA VENTA:', margin + 10, currentY);
        pdf.text(`S/. ${(ventaData.totalVenta || totalVenta).toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' });
        currentY += 8;
        
        // Resetear color del texto
        pdf.setTextColor(0, 0, 0);

        // =========================================================================
        // INFORMACIÓN ADICIONAL
        // =========================================================================
        
        if (currentY > pageHeight - 40) {
            pdf.addPage();
            currentY = 15;
        }
        
        pdf.setFont(fontName, 'bold');
        pdf.setFontSize(8);
        pdf.text('INFORMACIÓN IMPORTANTE:', margin, currentY);
        currentY += 6;
        
        pdf.setFont(fontName, 'normal');
        pdf.setFontSize(8);
        pdf.text('• Este documento es un comprobante de su compra.', margin + 5, currentY);
        currentY += 4;
        pdf.text('• Para cualquier reclamo o consulta, comuníquese con nosotros.', margin + 5, currentY);
        currentY += 4;
        pdf.text('• Conserve este documento como garantía de su compra.', margin + 5, currentY);
        currentY += 4;
        
        if (ventaData.tipoVenta === 'cotizacionAprobada') {
            pdf.text('• Esta venta fue generada a partir de una cotización aprobada.', margin + 5, currentY);
            currentY += 4;
        }
        
        currentY += 4;

        // Pie de página
        pdf.setFontSize(8);
        pdf.setFont(fontName, 'normal');
        pdf.text(`Comprobante generado el ${new Date().toLocaleString('es-PE')}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        
        // Guardar PDF
        const fechaSufijo = new Date().toISOString().split('T')[0];
        const clienteSufijo = clienteNombre.replace(/\s+/g, '-').toLowerCase();
        const fileName = `venta-${numeroVenta.replace(/[^a-zA-Z0-9]/g, '-')}-${clienteSufijo}-${fechaSufijo}.pdf`;
        pdf.save(fileName);
        
        return true;
        
    } catch (error) {
        console.error('Error al generar PDF de venta:', error);
        throw error;
    }
};

// Función principal exportada
export const generarPDFVentaCompleta = async (ventaId, ventaData = null, clienteData = null) => {
    try {
        // Si no se proporciona ventaData, obtenerla desde Firestore
        let venta = ventaData;
        if (!venta && ventaId) {
            const ventaDoc = await getDoc(doc(db, 'ventas', ventaId));
            if (ventaDoc.exists()) {
                venta = { id: ventaDoc.id, ...ventaDoc.data() };
            } else {
                throw new Error('Venta no encontrada');
            }
        }
        
        if (!venta) {
            throw new Error('No se pudo obtener la información de la venta');
        }
        
        // Si no se proporciona clienteData y hay un clienteId, obtenerlo
        let cliente = clienteData;
        if (!cliente && venta.clienteId && venta.clienteId !== 'general') {
            try {
                const clienteDoc = await getDoc(doc(db, 'clientes', venta.clienteId));
                if (clienteDoc.exists()) {
                    cliente = clienteDoc.data();
                }
            } catch (error) {
                console.warn('No se pudo obtener información del cliente:', error);
            }
        }
        
        await generarPDFVenta(venta, cliente);
        return `Comprobante de venta generado exitosamente para ${venta.clienteNombre || 'Cliente General'}`;
        
    } catch (error) {
        console.error('Error al generar PDF de venta:', error);
        throw new Error('Error al generar el comprobante de venta. Por favor, inténtalo de nuevo.');
    }
};

export default { generarPDFVentaCompleta };