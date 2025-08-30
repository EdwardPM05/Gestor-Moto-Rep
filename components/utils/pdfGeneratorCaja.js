// utils/pdfGeneratorCaja.js
import { doc, getDoc } from 'firebase/firestore';
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

// Función principal para generar el PDF de caja
const generarPDFCaja = async (cierreData) => {
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
        // ENCABEZADO: INFORMACIÓN DE LA EMPRESA Y REPORTE
        // =========================================================================

        pdf.setFont(fontName, 'bold');
        pdf.setFontSize(12);
        
        // Título de la empresa (izquierda)
        pdf.text('MOTORES & REPUESTOS SAC', margin, currentY);
        
        // Tipo de reporte (derecha)
        pdf.text('REPORTE DE CAJA', pageWidth - margin, currentY, { align: 'right' });
        currentY += 5;

        pdf.setFontSize(8);
        pdf.setFont(fontName, 'normal');
        
        // Detalles de la empresa (izquierda)
        pdf.text('R.U.C: 20123456789', margin, currentY);
        pdf.text('Email: motoresrepuestos@mail.com', margin, currentY + 4);
        pdf.text('Dirección: Av. Los Motores 456, San Borja', margin, currentY + 8);
        pdf.text('Teléfono: 999 888 777', margin, currentY + 12);
        currentY += 16;
        
        // Información del reporte (abajo del encabezado)
        pdf.setFontSize(8);
        pdf.setFont(fontName, 'bold');
        
        const fechaCierre = cierreData.fecha?.toDate ? 
            cierreData.fecha.toDate().toLocaleDateString('es-PE') : 
            (cierreData.fechaString ? new Date(cierreData.fechaString).toLocaleDateString('es-PE') : new Date().toLocaleDateString('es-PE'));
        
        pdf.text('FECHA DE CAJA:', margin, currentY);
        pdf.setFont(fontName, 'normal');
        pdf.text(fechaCierre, margin + 25, currentY);

        pdf.setFont(fontName, 'bold');
        pdf.text('CERRADA POR:', pageWidth / 2, currentY);
        pdf.setFont(fontName, 'normal');
        pdf.text(cierreData.cerradoPor || 'N/A', pageWidth / 2 + 20, currentY);
        currentY += 5;

        pdf.setFont(fontName, 'bold');
        pdf.text('FECHA DE CIERRE:', margin, currentY);
        pdf.setFont(fontName, 'normal');
        const fechaCierreCompleta = cierreData.fechaCierre?.toDate ? 
            cierreData.fechaCierre.toDate().toLocaleString('es-PE') : 
            new Date().toLocaleString('es-PE');
        pdf.text(fechaCierreCompleta, margin + 30, currentY);
        currentY += 5;

        // Línea divisora
        pdf.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 8;

        // =========================================================================
        // RESUMEN DE TOTALES
        // =========================================================================

        pdf.setFontSize(10);
        pdf.setFont(fontName, 'bold');
        pdf.text('RESUMEN DE TOTALES DEL DÍA', margin, currentY);
        currentY += 8;

        pdf.setFontSize(9);
        pdf.setFont(fontName, 'normal');

        // Crear tabla de resumen
        const resumenData = [
            ['MÉTODO DE PAGO', 'MONTO'],
            ['Efectivo', `S/. ${(cierreData.totales?.efectivo || 0).toFixed(2)}`],
            ['Yape', `S/. ${(cierreData.totales?.yape || 0).toFixed(2)}`],
            ['Plin', `S/. ${(cierreData.totales?.plin || 0).toFixed(2)}`],
            ['Tarjetas', `S/. ${(cierreData.totales?.tarjeta || 0).toFixed(2)}`],
        ];

        // Anchos de columnas para resumen
        const resumenColWidths = [totalWidth * 0.6, totalWidth * 0.4];
        const resumenColPositions = [margin, margin + resumenColWidths[0]];

        // Dibujar tabla de resumen
        resumenData.forEach((row, index) => {
            if (index === 0) {
                pdf.setFont(fontName, 'bold');
                pdf.setFillColor(240, 240, 240);
                pdf.rect(margin, currentY - 3, totalWidth, 6, 'F');
            } else {
                pdf.setFont(fontName, 'normal');
            }
            
            pdf.text(row[0], resumenColPositions[0] + 2, currentY);
            pdf.text(row[1], resumenColPositions[1] + resumenColWidths[1] - 2, currentY, { align: 'right' });
            
            // Líneas de la tabla
            pdf.line(margin, currentY + 2, pageWidth - margin, currentY + 2);
            
            currentY += 6;
        });

        // Total general
        pdf.setFont(fontName, 'bold');
        pdf.setFillColor(220, 220, 220);
        pdf.rect(margin, currentY - 3, totalWidth, 6, 'F');
        pdf.text('TOTAL GENERAL', resumenColPositions[0] + 2, currentY);
        pdf.text(`S/. ${(cierreData.totales?.total || 0).toFixed(2)}`, resumenColPositions[1] + resumenColWidths[1] - 2, currentY, { align: 'right' });
        pdf.line(margin, currentY + 2, pageWidth - margin, currentY + 2);
        currentY += 10;

        // =========================================================================
        // GANANCIAS
        // =========================================================================

        pdf.setFont(fontName, 'bold');
        pdf.text('ANÁLISIS DE GANANCIAS', margin, currentY);
        currentY += 6;

        pdf.setFont(fontName, 'normal');
        pdf.text('Ganancia Bruta:', margin + 5, currentY);
        pdf.text(`S/. ${(cierreData.totales?.gananciaBruta || 0).toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' });
        currentY += 5;

        pdf.text('Ganancia Real:', margin + 5, currentY);
        pdf.text(`S/. ${(cierreData.totales?.gananciaReal || 0).toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' });
        currentY += 8;

        // =========================================================================
        // RETIROS DEL DÍA
        // =========================================================================

        if (cierreData.retiros && cierreData.retiros.length > 0) {
            pdf.setFont(fontName, 'bold');
            pdf.text('RETIROS DEL DÍA', margin, currentY);
            currentY += 8;

            // Headers de la tabla de retiros
            const retirosHeaders = ['HORA', 'TIPO', 'MONTO', 'MOTIVO', 'REALIZADO POR'];
            const retirosColWidths = [
                totalWidth * 0.15, // Hora
                totalWidth * 0.15, // Tipo
                totalWidth * 0.15, // Monto
                totalWidth * 0.35, // Motivo
                totalWidth * 0.20  // Realizado por
            ];

            const retirosColPositions = [margin];
            for (let i = 0; i < retirosColWidths.length - 1; i++) {
                retirosColPositions.push(retirosColPositions[i] + retirosColWidths[i]);
            }

            pdf.setFontSize(8);
            pdf.setFont(fontName, 'bold');
            
            // Línea superior de la tabla
            pdf.line(margin, currentY, pageWidth - margin, currentY);
            currentY += 3;

            // Encabezados de retiros
            retirosHeaders.forEach((header, index) => {
                const x = retirosColPositions[index];
                const maxWidth = retirosColWidths[index] - 2;
                
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

            // Procesar retiros
            cierreData.retiros.forEach((retiro) => {
                if (currentY > pageHeight - 30) {
                    pdf.addPage();
                    currentY = 15;
                }

                const fechaRetiro = retiro.fecha?.toDate ? retiro.fecha.toDate() : new Date();
                const horaRetiro = fechaRetiro.toLocaleTimeString('es-PE', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });

                const retiroData = [
                    horaRetiro,
                    retiro.tipo?.toUpperCase() || 'N/A',
                    `S/. ${(retiro.monto || 0).toFixed(2)}`,
                    retiro.motivo || 'N/A',
                    retiro.realizadoPor || 'N/A'
                ];

                retiroData.forEach((data, index) => {
                    const x = retirosColPositions[index];
                    const maxWidth = retirosColWidths[index] - 2;
                    
                    let displayText = String(data);
                    if (pdf.getTextWidth(displayText) > maxWidth) {
                        if (index === 3) { // Motivo - caso especial
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
                    
                    const alignment = index === 2 ? 'right' : 'left';
                    const textX = alignment === 'right' ? x + retirosColWidths[index] - 1 : x + 1;
                    
                    pdf.text(displayText, textX, currentY, { align: alignment });
                });
                
                currentY += 5;
            });

            pdf.line(margin, currentY, pageWidth - margin, currentY);
            currentY += 5;

            // Total de retiros
            pdf.setFont(fontName, 'bold');
            pdf.text('TOTAL RETIROS:', margin + 5, currentY);
            const totalRetiros = cierreData.retiros.reduce((total, retiro) => total + (retiro.monto || 0), 0);
            pdf.text(`S/. ${totalRetiros.toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' });
            currentY += 10;
        }

        // =========================================================================
        // RESUMEN FINAL
        // =========================================================================

        if (currentY > pageHeight - 50) {
            pdf.addPage();
            currentY = 15;
        }

        pdf.setFont(fontName, 'bold');
        pdf.text('RESUMEN FINAL DE CAJA', margin, currentY);
        currentY += 8;

        pdf.setFont(fontName, 'normal');
        
        // Crear tabla de resumen final
        const resumenFinal = cierreData.resumenFinal || {};
        const dineroInicial = cierreData.dineroInicial || 0;

        pdf.text('Dinero Inicial:', margin + 5, currentY);
        pdf.text(`S/. ${dineroInicial.toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' });
        currentY += 5;
        
        pdf.text('Total de Ventas del Día:', margin + 5, currentY);
        pdf.text(`${resumenFinal.totalVentas || 0}`, pageWidth - margin, currentY, { align: 'right' });
        currentY += 5;

        pdf.text('Total de Retiros:', margin + 5, currentY);
        pdf.text(`${resumenFinal.totalRetiros || 0}`, pageWidth - margin, currentY, { align: 'right' });
        currentY += 5;

        pdf.text('Efectivo Final en Caja:', margin + 5, currentY);
        pdf.text(`S/. ${(resumenFinal.efectivoFinal || 0).toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' });
        currentY += 5;

        pdf.text('Total Digital (Yape + Plin + Tarjeta):', margin + 5, currentY);
        pdf.text(`S/. ${(resumenFinal.digitalTotal || 0).toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' });
        currentY += 10;

        // =========================================================================
        // INFORMACIÓN ADICIONAL
        // =========================================================================
        
        pdf.setFont(fontName, 'bold');
        pdf.setFontSize(8);
        pdf.text('INFORMACIÓN IMPORTANTE:', margin, currentY);
        currentY += 6;
        
        pdf.setFont(fontName, 'normal');
        pdf.setFontSize(8);
        pdf.text('• Este reporte refleja el estado de la caja al momento del cierre.', margin + 5, currentY);
        currentY += 4;
        pdf.text('• Los montos digitales (Yape, Plin, Tarjeta) se mantienen en las cuentas respectivas.', margin + 5, currentY);
        currentY += 4;
        pdf.text('• El efectivo final debe coincidir con el dinero físico en caja.', margin + 5, currentY);
        currentY += 4;
        pdf.text('• Conserve este documento para auditorías y controles internos.', margin + 5, currentY);
        currentY += 8;

        // Pie de página
        pdf.setFontSize(8);
        pdf.setFont(fontName, 'normal');
        pdf.text(`Reporte generado el ${new Date().toLocaleString('es-PE')}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        
        return pdf;
        
    } catch (error) {
        console.error('Error al generar PDF de caja:', error);
        throw error;
    }
};

// Función principal exportada - MANTENER ORIGINAL
export const generarPDFCajaCompleta = async (fechaString) => {
    try {
        // Obtener datos del cierre de caja desde Firestore
        const cierreDoc = await getDoc(doc(db, 'cierresCaja', fechaString));
        
        if (!cierreDoc.exists()) {
            throw new Error('No se encontró el cierre de caja para esta fecha');
        }
        
        const cierreData = cierreDoc.data();
        
        const pdf = await generarPDFCaja(cierreData);
        
        // Guardar PDF
        const fechaSufijo = fechaString.replace(/\//g, '-');
        const fileName = `reporte-caja-${fechaSufijo}.pdf`;
        pdf.save(fileName);
        
        return `Reporte de caja generado exitosamente para ${fechaString}`;
        
    } catch (error) {
        console.error('Error al generar PDF de caja:', error);
        throw new Error('Error al generar el reporte de caja. Por favor, inténtalo de nuevo.');
    }
};

export default { generarPDFCajaCompleta };