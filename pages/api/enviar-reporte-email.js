// pages/api/enviar-reporte-email.js
const { enviarReporteCaja } = require('../../lib/emailService');
const { db } = require('../../lib/firebase');
const { doc, getDoc } = require('firebase/firestore');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { fechaReporte, incluirPDF = false } = req.body;

    if (!fechaReporte) {
      return res.status(400).json({ error: 'Fecha de reporte requerida' });
    }

    // Obtener datos del cierre de caja de Firebase
    const cierreDoc = await getDoc(doc(db, 'cierresCaja', fechaReporte));
    
    if (!cierreDoc.exists()) {
      return res.status(404).json({ error: 'No se encontró el cierre de caja para esta fecha' });
    }

    const datosCierre = cierreDoc.data();
    
    // Preparar datos para el email
    const datosReporte = {
      efectivo: datosCierre.totales?.efectivo || 0,
      yape: datosCierre.totales?.yape || 0,
      plin: datosCierre.totales?.plin || 0,
      tarjeta: datosCierre.totales?.tarjeta || 0,
      total: datosCierre.totales?.total || 0,
      gananciaBruta: datosCierre.totales?.gananciaBruta || 0,
      gananciaReal: datosCierre.totales?.gananciaReal || 0,
      numeroVentas: datosCierre.resumenFinal?.totalVentas || 0,
      totalRetiros: datosCierre.resumenFinal?.totalRetiros || 0,
      fechaCierre: datosCierre.fechaCierre,
      cerradoPor: datosCierre.cerradoPor
    };

    // Generar PDF si se solicita
    let pdfBuffer = null;
    if (incluirPDF) {
      try {
        // Aquí puedes integrar tu generador de PDF
        const { generarPDFCajaCompleta } = await import('../../components/utils/pdfGeneratorCaja');
        pdfBuffer = await generarPDFCajaCompleta(fechaReporte);
      } catch (pdfError) {
        console.error('Error generando PDF:', pdfError);
        // Continúa sin PDF si falla
      }
    }

    // Enviar email
    const resultado = await enviarReporteCaja(fechaReporte, datosReporte, pdfBuffer);

    if (resultado.success) {
      return res.status(200).json({ 
        success: true, 
        message: 'Reporte enviado por email exitosamente',
        messageId: resultado.messageId 
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        error: resultado.error 
      });
    }

  } catch (error) {
    console.error('Error en API de envío de email:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
}