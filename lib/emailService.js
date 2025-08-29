// lib/emailService.js - VERSIÓN CORREGIDA
// Este archivo SOLO debe ejecutarse en el servidor (API routes)

// Verificar que estamos en el servidor
if (typeof window !== 'undefined') {
  throw new Error('Este módulo solo puede ejecutarse en el servidor');
}

const nodemailer = require('nodemailer'); // Usar require en lugar de import

// Configuración del servicio de email
const createTransporter = () => {
  // Verificar variables de entorno
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    throw new Error('Variables de entorno GMAIL_USER y GMAIL_APP_PASSWORD son requeridas');
  }

  return nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
};

const enviarReporteCaja = async (fechaReporte, datosReporte, pdfBuffer = null) => {
  try {
    const transporter = createTransporter();

    const fechaFormateada = new Date(fechaReporte).toLocaleDateString('es-PE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
          .header { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 20px; background-color: white; }
          .summary-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .summary-table th, .summary-table td { 
            border: 1px solid #ddd; 
            padding: 12px; 
            text-align: left; 
          }
          .summary-table th { background-color: #f2f2f2; font-weight: bold; }
          .total-row { background-color: #e8f5e8; font-weight: bold; }
          .ganancia-row { background-color: #fff3cd; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; }
          .highlight { color: #28a745; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2 style="color: #28a745; margin: 0;">📊 Reporte de Caja</h2>
          <p style="margin: 10px 0 0 0; color: #666;">${fechaFormateada}</p>
        </div>
        
        <div class="content">
          <h3 style="color: #333; border-bottom: 2px solid #28a745; padding-bottom: 10px;">Resumen del Día</h3>
          
          <table class="summary-table">
            <thead>
              <tr>
                <th style="width: 60%;">Concepto</th>
                <th style="width: 40%; text-align: right;">Monto</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>💵 Efectivo</td>
                <td style="text-align: right;">S/. ${(datosReporte.efectivo || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td>💜 Yape</td>
                <td style="text-align: right;">S/. ${(datosReporte.yape || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td>💙 Plin</td>
                <td style="text-align: right;">S/. ${(datosReporte.plin || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td>💳 Tarjetas</td>
                <td style="text-align: right;">S/. ${(datosReporte.tarjeta || 0).toFixed(2)}</td>
              </tr>
              <tr class="total-row">
                <td><strong>📈 Total Ingresos</strong></td>
                <td style="text-align: right;"><strong>S/. ${(datosReporte.total || 0).toFixed(2)}</strong></td>
              </tr>
              ${datosReporte.totalRetiros > 0 ? `
              <tr style="background-color: #f8d7da;">
                <td>📤 Total Retiros</td>
                <td style="text-align: right;">-S/. ${datosReporte.totalRetiros.toFixed(2)}</td>
              </tr>
              <tr style="background-color: #d4edda;">
                <td><strong>💰 Efectivo Final en Caja</strong></td>
                <td style="text-align: right;"><strong>S/. ${Math.max(0, datosReporte.efectivo - datosReporte.totalRetiros).toFixed(2)}</strong></td>
              </tr>
              ` : ''}
              <tr class="ganancia-row">
                <td>💰 Ganancia Bruta</td>
                <td style="text-align: right;">S/. ${(datosReporte.gananciaBruta || 0).toFixed(2)}</td>
              </tr>
              <tr class="ganancia-row">
                <td><strong>✨ Ganancia Real</strong></td>
                <td style="text-align: right;"><strong class="highlight">S/. ${(datosReporte.gananciaReal || 0).toFixed(2)}</strong></td>
              </tr>
            </tbody>
          </table>

          <h3 style="color: #333; border-bottom: 2px solid #17a2b8; padding-bottom: 10px;">Estadísticas del Día</h3>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px;">
            <p><strong>📊 Número de ventas:</strong> ${datosReporte.numeroVentas || 0}</p>
            <p><strong>🎯 Ticket promedio:</strong> S/. ${datosReporte.numeroVentas > 0 ? ((datosReporte.total || 0) / datosReporte.numeroVentas).toFixed(2) : '0.00'}</p>
            <p><strong>💳 Método más usado:</strong> ${obtenerMetodoPagoMasUsado(datosReporte)}</p>
            ${datosReporte.totalRetiros > 0 ? `<p><strong>📤 Número de retiros:</strong> ${datosReporte.numeroRetiros || 0}</p>` : ''}
          </div>

          <div class="footer">
            <p><small>📅 Reporte generado automáticamente el ${new Date().toLocaleString('es-PE')}.</small></p>
            <p><small>🏪 Sistema de Gestión - Reporte de Caja Diario</small></p>
            ${datosReporte.cerradoPor ? `<p><small>👤 Caja cerrada por: ${datosReporte.cerradoPor}</small></p>` : ''}
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"Sistema de Caja" <${process.env.GMAIL_USER}>`,
      to: 'epittman341@gmail.com',
      subject: `📊 Reporte de Caja - ${fechaFormateada} - S/. ${(datosReporte.total || 0).toFixed(2)}`,
      html: htmlContent,
      attachments: pdfBuffer ? [{
        filename: `reporte-caja-${fechaReporte}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }] : []
    };

    console.log('Enviando email a:', mailOptions.to);
    const result = await transporter.sendMail(mailOptions);
    console.log('Email enviado exitosamente:', result.messageId);
    
    return { 
      success: true, 
      messageId: result.messageId,
      recipient: 'epittman341@gmail.com'
    };

  } catch (error) {
    console.error('Error detallado enviando email:', error);
    return { 
      success: false, 
      error: error.message,
      details: error.stack
    };
  }
};

// Función auxiliar para determinar el método de pago más usado
const obtenerMetodoPagoMasUsado = (datos) => {
  const metodos = {
    'Efectivo': datos.efectivo || 0,
    'Yape': datos.yape || 0,
    'Plin': datos.plin || 0,
    'Tarjeta': datos.tarjeta || 0
  };
  
  const metodoPrincipal = Object.keys(metodos).reduce((a, b) => metodos[a] > metodos[b] ? a : b);
  return `${metodoPrincipal} (S/. ${metodos[metodoPrincipal].toFixed(2)})`;
};

module.exports = {
  enviarReporteCaja
};