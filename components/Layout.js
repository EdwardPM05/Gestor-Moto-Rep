// components/Layout.js
import { useState } from 'react';
import Sidebar from './Sidebar';
import { Bars3Icon } from '@heroicons/react/24/outline';
import Head from 'next/head'; // Importa Head para el título de la página

const Layout = ({ children, title = 'GestorMoto' }) => { // Agregamos 'title' prop
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <>
      <Head>
        <title>{title}</title> {/* Para el título de la pestaña del navegador */}
      </Head>

      {/* Contenedor principal con flexbox para desktop */}
      <div className="flex min-h-screen bg-gray-100"> {/* Usamos bg-gray-100 para el fondo */}
        
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />

        {/* Contenido principal (abarca el resto del espacio) */}
        <div className={`flex flex-col flex-1 overflow-hidden 
                       ${sidebarOpen ? 'ml-0' : ''} lg:ml-0`}> 
                       {/* ^^^ El sidebar fijo se manejará con el overlay y transiciones en móvil.
                           En desktop, el sidebar es estático, así que no necesitamos ml-64 aquí.
                           La clase 'flex' y 'flex-1' son las que permiten que el contenido ocupe el resto del espacio.
                           Quitamos el 'lg:ml-64' de este div porque el Sidebar.js ya se hace 'lg:static'
                           y ocupará su propio espacio en el flexbox.
                       */}

          {/* Header móvil - Visible solo en pantallas pequeñas */}
          <header className="lg:hidden bg-white shadow-sm border-b">
            <div className="flex items-center justify-between px-4 py-3">
              <button
                onClick={toggleSidebar}
                className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                <Bars3Icon className="h-6 w-6" />
              </button>
              <h1 className="text-lg font-semibold text-gray-900">GestorMoto</h1>
              <div className="w-10" /> {/* Spacer */}
            </div>
          </header>

          {/* Contenedor principal del contenido, con padding */}
          <main className="flex-1 overflow-y-auto p-6"> {/* Agregamos p-6 para padding al contenido */}
            {children}
          </main>
        </div>
      </div>
    </>
  );
};

export default Layout;