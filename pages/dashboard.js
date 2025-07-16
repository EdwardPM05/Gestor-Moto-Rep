// pages/dashboard.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import { 
  CubeIcon, 
  UsersIcon, 
  BanknotesIcon, 
  ExclamationTriangleIcon,
  ChartBarIcon,
  DocumentTextIcon 
} from '@heroicons/react/24/outline';

const Dashboard = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({
    totalProductos: 0,
    productosPocos: 0,
    ventasHoy: 0,
    cotizacionesPendientes: 0,
    clientesCredito: 0,
    cajaActual: 0
  });

  useEffect(() => {
    if (!user) {
      router.push('/auth');
    }
  }, [user, router]);

  // Simulación de estadísticas - después conectarás con Firebase
  useEffect(() => {
    // Aquí harías las consultas a Firebase
    setStats({
      totalProductos: 1250,
      productosPocos: 15,
      ventasHoy: 8500,
      cotizacionesPendientes: 5,
      clientesCredito: 12,
      cajaActual: 45000
    });
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Cargando...</h1>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  const isAdmin = user?.email === 'admin@gestormotorep.com';

  const statsCards = [
    {
      title: 'Total Productos',
      value: stats.totalProductos,
      icon: CubeIcon,
      color: 'bg-blue-500',
      link: '/productos'
    },
    {
      title: 'Productos Bajos',
      value: stats.productosPocos,
      icon: ExclamationTriangleIcon,
      color: 'bg-red-500',
      link: '/inventario/faltos'
    },
    {
      title: 'Ventas Hoy',
      value: `S/. ${stats.ventasHoy.toLocaleString()}`,
      icon: BanknotesIcon,
      color: 'bg-green-500',
      link: '/ventas/dia'
    },
    {
      title: 'Cotizaciones Pendientes',
      value: stats.cotizacionesPendientes,
      icon: DocumentTextIcon,
      color: 'bg-yellow-500',
      link: '/cotizaciones/mis-cotizaciones'
    },
    {
      title: 'Clientes con Crédito',
      value: stats.clientesCredito,
      icon: UsersIcon,
      color: 'bg-purple-500',
      link: '/clientes/credito'
    }
  ];

  // Solo mostrar caja si es admin
  if (isAdmin) {
    statsCards.push({
      title: 'Caja Actual',
      value: `S/. ${stats.cajaActual.toLocaleString()}`,
      icon: ChartBarIcon,
      color: 'bg-indigo-500',
      link: '/caja/estado'
    });
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Bienvenido, {user.displayName || user.email}
          </p>
          <p className="text-sm text-gray-500">
            {isAdmin ? 'Administrador' : 'Empleado'} - {new Date().toLocaleDateString('es-PE')}
          </p>
        </div>

        {/* Tarjetas de estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {statsCards.map((card, index) => (
            <div
              key={index}
              onClick={() => router.push(card.link)}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                </div>
                <div className={`${card.color} p-3 rounded-full`}>
                  <card.icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Acciones rápidas */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => router.push('/productos/agregar')}
              className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <CubeIcon className="h-5 w-5 mr-2" />
              Agregar Producto
            </button>
            <button
              onClick={() => router.push('/cotizaciones/nueva')}
              className="flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <DocumentTextIcon className="h-5 w-5 mr-2" />
              Nueva Cotización
            </button>
            <button
              onClick={() => router.push('/ventas/nueva')}
              className="flex items-center justify-center px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <BanknotesIcon className="h-5 w-5 mr-2" />
              Nueva Venta
            </button>
            <button
              onClick={() => router.push('/clientes/agregar')}
              className="flex items-center justify-center px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              <UsersIcon className="h-5 w-5 mr-2" />
              Agregar Cliente
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;