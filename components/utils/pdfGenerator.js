// utils/pdfGenerator.js
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

// Función para cargar la fuente SimplifiedArabic
const loadCustomFont = async (pdf) => {
    try {
        // Intentar diferentes rutas y nombres de archivo
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
                    
                    // Verificar que el ArrayBuffer no esté vacío
                    if (fontData.byteLength === 0) {
                        console.warn(`Archivo de fuente vacío: ${fontPath}`);
                        continue;
                    }
                    
                    // Convertir a base64
                    const fontBase64 = arrayBufferToBase64(fontData);
                    
                    // Intentar registrar la fuente
                    try {
                        const fileName = fontPath.split('/').pop();
                        pdf.addFileToVFS(fileName, fontBase64);
                        pdf.addFont(fileName, 'SimplifiedArabic', 'normal');
                        
                        // Usar la misma fuente para bold si no tenemos una versión separada
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
        return 'times'; // Fallback más elegante que helvetica
    }
};

// Función auxiliar para convertir ArrayBuffer a base64 con validación mejorada
const arrayBufferToBase64 = (buffer) => {
    try {
        if (!buffer || buffer.byteLength === 0) {
            throw new Error('Buffer vacío o inválido');
        }
        
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        
        // Procesar en chunks para evitar problemas de memoria con archivos grandes
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

// Función para generar el PDF con un diseño de cotización ACTUALIZADA CON ABONOS
const generarPDF = async (cliente, creditos, abonos = [], periodo = '') => {
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
        // ENCABEZADO: INFORMACIÓN DE LA EMPRESA, CRÉDITO Y VENDEDOR
        // =========================================================================

        pdf.setFont(fontName, 'bold');
        pdf.setFontSize(12);
        
        // Título de la empresa (izquierda)
        pdf.text('MOTORES & REPUESTOS SAC', margin, currentY);
        
        // Número de crédito (derecha) - modificado para incluir período si aplica
        const tituloReporte = periodo ? `REPORTE CRÉDITOS - ${periodo.toUpperCase()}` : `CRÉDITO Nro. ${creditos[0]?.numeroCredito || 'N/A'}`;
        pdf.text(tituloReporte, pageWidth - margin, currentY, { align: 'right' });
        currentY += 5;

        pdf.setFontSize(8);
        pdf.setFont(fontName, 'normal');
        
        // Detalles de la empresa (izquierda)
        pdf.text('R.U.C: 20123456789', margin, currentY);
        pdf.text('Email: motoresrepuestos@mail.com', margin, currentY + 4);
        pdf.text('Dirección: Av. Los Motores 456, San Borja', margin, currentY + 8);
        pdf.text('Teléfono: 999 888 777', margin, currentY + 12);
        pdf.text('Credito realizado en tienda Av.Los Motores 456 San Borja', margin, currentY + 16);
        currentY += 20;
        

        // Información de la cotización (abajo del encabezado)
        pdf.setFontSize(8);
        pdf.setFont(fontName, 'normal');
        
        const fechaCreacion = creditos[0]?.fechaCreacion?.toDate ? 
            creditos[0].fechaCreacion.toDate().toLocaleDateString('es-PE') : 
            new Date().toLocaleDateString('es-PE');
        
        pdf.text('FECHA DE CREACIÓN:', margin, currentY);
        pdf.setFont(fontName, 'normal');
        pdf.text(fechaCreacion, margin + 33, currentY);

        pdf.setFont(fontName, 'normal');
        pdf.text('FORMA DE PAGO:', pageWidth / 2, currentY);
        pdf.setFont(fontName, 'normal');
        pdf.text('  Todos los medios de pago', pageWidth / 2 + 25, currentY);
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
        pdf.text(`${cliente.nombre} ${cliente.apellido || ''}`, margin + 15, currentY);
        currentY += 5;
        
        pdf.setFont(fontName, 'bold');
        pdf.text('DNI:', margin, currentY);
        pdf.setFont(fontName, 'normal');
        pdf.text(String(cliente.dni || 'N/A'), margin + 15, currentY);
        currentY += 5;
        
        // =========================================================================
        // TABLA DE ITEMS - CORREGIDA LA ALINEACIÓN
        // =========================================================================

        // Headers de la tabla
        const tableHeaders = ['Cód. Tienda', 'Descripción', 'Color', 'Marca', 'Ubicación', 'Medida', 'Cant.', 'P. Unitario', 'P. Total'];
        
        // Anchos de columnas ajustados
        const colWidths = [
            totalWidth * 0.12, // Cód. Tienda
            totalWidth * 0.30, // Descripción - más ancho para texto largo
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
            const maxWidth = colWidths[index] - 2; // Dejar margen interno
            
            // Truncar texto si es muy largo para el encabezado
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
        let totalOriginalCredito = 0;

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
        for (const credito of creditos) {
            if (credito.items && credito.items.length > 0) {
                for (const item of credito.items) {
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
                        const maxWidth = colWidths[index] - 2; // Margen interno
                        const alignment = alignments[index];
                        
                        // Truncar texto si es muy largo
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
                        let textX = x + 1; // Margen izquierdo por defecto
                        if (alignment === 'center') {
                            textX = x + (colWidths[index] / 2);
                        } else if (alignment === 'right') {
                            textX = x + colWidths[index] - 1; // Margen derecho
                        }
                        
                        pdf.text(displayText, textX, currentY, { align: alignment });
                    });
                    
                    totalOriginalCredito += parseFloat(item.subtotal || 0);
                    currentY += 5;
                }
            }
        }

        pdf.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 8;

        // =========================================================================
        // SECCIÓN DE DESGLOSE FINANCIERO (NUEVA)
        // =========================================================================
        
        // Calcular totales de abonos
        const totalAbonos = abonos.reduce((sum, abono) => sum + (abono.monto || 0), 0);
        const saldoPendiente = totalOriginalCredito - totalAbonos;
        
        
        pdf.setFontSize(8);
        
        // TOTAL ORIGINAL
        pdf.setTextColor(0, 0, 0);
        pdf.text('TOTAL DEL CRÉDITO:', margin + 10, currentY);
        pdf.text(`S/. ${totalOriginalCredito.toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' });
        currentY += 6;
        
        // TOTAL ABONADO
        pdf.setTextColor(0, 150, 0); // Verde para abonos
        pdf.text('TOTAL ABONADO:', margin + 10, currentY);
        pdf.text(`S/. ${totalAbonos.toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' });
        currentY += 6;
        
        // SALDO PENDIENTE
        pdf.setTextColor(200, 0, 0); // Rojo para saldo pendiente
        pdf.text('SALDO PENDIENTE:', margin + 10, currentY);
        pdf.text(`S/. ${saldoPendiente.toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' });
        currentY += 8;
        
        // Resetear color del texto
        pdf.setTextColor(0, 0, 0);

        // =========================================================================
        // HISTORIAL DE ABONOS (SI EXISTEN)
        // =========================================================================
        
        if (abonos && abonos.length > 0) {
            // Verificar si necesitamos nueva página
            if (currentY > pageHeight - 60) {
                pdf.addPage();
                currentY = 15;
            }
            
            pdf.setFont(fontName, 'bold');
            pdf.setFontSize(8);
            pdf.text('HISTORIAL DE ABONOS:', margin, currentY);
            currentY += 6;
            
            // Encabezados de la tabla de abonos
            pdf.setFontSize(8);
            pdf.setFont(fontName, 'bold');
            
            const abonosHeaders = ['Fecha', 'Monto', 'Método de Pago', 'Estado'];
            const abonosColWidths = [40, 30, 40, 30];
            const abonosColPositions = [margin + 10];
            for (let i = 0; i < abonosColWidths.length - 1; i++) {
                abonosColPositions.push(abonosColPositions[i] + abonosColWidths[i]);
            }
            
            pdf.line(margin, currentY, pageWidth - margin, currentY);
            currentY += 3;
            
            abonosHeaders.forEach((header, index) => {
                pdf.text(header, abonosColPositions[index] + 1, currentY);
            });
            currentY += 3;
            
            pdf.line(margin, currentY, pageWidth - margin, currentY);
            currentY += 4;
            
            // Datos de abonos
            pdf.setFont(fontName, 'normal');
            abonos.forEach((abono) => {
                if (currentY > pageHeight - 20) {
                    pdf.addPage();
                    currentY = 15;
                }
                
                // Fecha
                const fechaAbono = abono.fecha?.toDate ? 
                    abono.fecha.toDate().toLocaleDateString('es-PE') : 
                    (abono.fecha && new Date(abono.fecha.seconds * 1000).toLocaleDateString('es-PE')) || 'N/A';
                pdf.text(fechaAbono, abonosColPositions[0] + 1, currentY);
                
                // Monto
                pdf.setTextColor(0, 0, 0);
                pdf.text(`S/. ${(abono.monto || 0).toFixed(2)}`, abonosColPositions[1] + 1, currentY);
                pdf.setTextColor(0, 0, 0);
                
                // Método de pago
                pdf.text((abono.metodoPago || 'N/A').charAt(0).toUpperCase() + (abono.metodoPago || 'N/A').slice(1), abonosColPositions[2] + 1, currentY);
                
                // Estado
                pdf.text('Pagado', abonosColPositions[3] + 1, currentY);
                
                currentY += 5;
            });
            
            pdf.line(margin, currentY, pageWidth - margin, currentY);
            currentY += 8;
        }

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
        pdf.text('• Este documento es un resumen del estado actual de su crédito.', margin + 5, currentY);
        currentY += 4;
        pdf.text('• Para cualquier consulta o aclaración, comuníquese con nosotros.', margin + 5, currentY);
        currentY += 4;
        pdf.text('• Conserve este documento para sus registros.', margin + 5, currentY);
        currentY += 8;

        // Pie de página
        pdf.setFontSize(8);
        pdf.setFont(fontName, 'normal');
        pdf.text(`Reporte generado el ${new Date().toLocaleString('es-PE')}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        
        // Guardar PDF
        const fechaSufijo = new Date().toISOString().split('T')[0];
        const periodoSufijo = periodo ? `-${periodo.toLowerCase().replace(/\s+/g, '-')}` : '';
        const clienteSufijo = cliente ? `-${cliente.nombre.replace(/\s+/g, '-')}` : '-todos-los-clientes';
        const fileName = `reporte-creditos${clienteSufijo}${periodoSufijo}-${fechaSufijo}.pdf`;
        pdf.save(fileName);
        
        return true;
        
    } catch (error) {
        console.error('Error al generar PDF:', error);
        throw error;
    }
};

// Función principal para generar PDF de un cliente específico - ACTUALIZADA
export const generarPDFCliente = async (cliente, creditos, abonos = [], periodo = '') => {
    try {
        await generarPDF(cliente, creditos, abonos, periodo);
        return `Reporte PDF generado exitosamente para ${cliente.nombre} ${cliente.apellido || ''}`;
    } catch (error) {
        throw new Error('Error al generar el reporte PDF. Por favor, inténtalo de nuevo.');
    }
};

// Función para generar PDF de múltiples clientes (por período)
export const generarPDFPorPeriodo = async (clientesConCreditos, periodo) => {
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
        
        let currentY = 15;

        // Encabezado del reporte
        pdf.setFont(fontName, 'bold');
        pdf.setFontSize(14);
        pdf.text('MOTORES & REPUESTOS SAC', pageWidth / 2, currentY, { align: 'center' });
        currentY += 8;

        pdf.setFontSize(12);
        pdf.text(`REPORTE DE CRÉDITOS - ${periodo.toUpperCase()}`, pageWidth / 2, currentY, { align: 'center' });
        currentY += 10;

        pdf.setFontSize(8);
        pdf.setFont(fontName, 'normal');
        pdf.text(`Fecha de generación: ${new Date().toLocaleDateString('es-PE')}`, pageWidth / 2, currentY, { align: 'center' });
        currentY += 10;

        // Tabla de resumen
        const tableHeaders = ['Cliente', 'DNI', 'Monto Adeudado'];
        const colWidths = [60, 40, 40];
        const colPositions = [margin];
        for (let i = 0; i < colWidths.length - 1; i++) {
            colPositions.push(colPositions[i] + colWidths[i]);
        }
        
        pdf.setFont(fontName, 'bold');
        pdf.setFontSize(9);
        
        // Línea superior de la tabla
        pdf.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 4;

        // Encabezados
        tableHeaders.forEach((header, index) => {
            pdf.text(header, colPositions[index] + 2, currentY);
        });
        currentY += 4;

        // Línea de separación
        pdf.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 4;

        pdf.setFont(fontName, 'normal');
        let totalGeneral = 0;

        // Datos de los clientes
        clientesConCreditos.forEach((cliente, index) => {
            if (currentY > pageHeight - 20) {
                pdf.addPage();
                currentY = 15;
            }

            // Nombre del cliente
            pdf.text(`${cliente.nombre} ${cliente.apellido || ''}`, colPositions[0] + 2, currentY);
            // DNI
            pdf.text(String(cliente.dni || 'N/A'), colPositions[1] + 2, currentY);
            // Monto adeudado
            const monto = parseFloat(cliente.montoCreditoActual || 0);
            pdf.text(`S/. ${monto.toFixed(2)}`, colPositions[2] + 2, currentY);
            
            totalGeneral += monto;
            currentY += 5;

            // Línea de separación cada 5 filas
            if ((index + 1) % 5 === 0) {
                pdf.setDrawColor(200, 200, 200);
                pdf.line(margin, currentY, pageWidth - margin, currentY);
                currentY += 2;
                pdf.setDrawColor(0, 0, 0);
            }
        });

        // Línea final de la tabla
        pdf.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 6;

        // Total general
        pdf.setFont(fontName, 'bold');
        pdf.setFontSize(11);
        pdf.text('TOTAL GENERAL:', pageWidth - margin - 60, currentY);
        pdf.text(`S/. ${totalGeneral.toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' });

        // Estadísticas adicionales
        currentY += 10;
        pdf.setFontSize(9);
        pdf.text(`Total de clientes con crédito: ${clientesConCreditos.length}`, margin, currentY);
        currentY += 4;
        pdf.text(`Promedio por cliente: S/. ${clientesConCreditos.length > 0 ? (totalGeneral / clientesConCreditos.length).toFixed(2) : '0.00'}`, margin, currentY);

        // Guardar PDF
        const fechaSufijo = new Date().toISOString().split('T')[0];
        const periodoSufijo = periodo.toLowerCase().replace(/\s+/g, '-');
        const fileName = `reporte-creditos-${periodoSufijo}-${fechaSufijo}.pdf`;
        pdf.save(fileName);
        
        return `Reporte PDF generado exitosamente - ${periodo}`;
        
    } catch (error) {
        console.error('Error al generar PDF por período:', error);
        throw new Error('Error al generar el reporte PDF. Por favor, inténtalo de nuevo.');
    }
};

export default { generarPDFCliente, generarPDFPorPeriodo };