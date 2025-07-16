// pages/productos/faltos.js
import React from 'react';
import Layout from '../../components/Layout'; // Asumiendo que usas Layout

const FaltosPage = () => {
  return (
    <Layout title="Productos Faltantes">
      <div>
        <h1>Página de Productos Faltantes</h1>
        <p>Aquí se listarán los productos con stock bajo o faltantes.</p>
        {/* Aquí iría la lógica para cargar y mostrar los productos faltantes */}
      </div>
    </Layout>
  );
};

export default FaltosPage;