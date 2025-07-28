// components/Sidebar.js
import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import {
  HomeIcon,
  CubeIcon,
  ArrowRightOnRectangleIcon,
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  UsersIcon,
  BuildingStorefrontIcon,
  DocumentTextIcon,
  BanknotesIcon,
  ChartBarIcon,
  UserGroupIcon,
  CreditCardIcon,
  ClipboardDocumentListIcon,
  PrinterIcon,
  Cog6ToothIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [openSubmenu, setOpenSubmenu] = useState(null);

  const isAdmin = user?.email === 'admin@gestormotorep.com';

  const handleLogout = async () => {
    await logout();
    router.push('/auth');
  };

  const toggleSubmenu = (submenu) => {
    setOpenSubmenu(openSubmenu === submenu ? null : submenu);
  };

  const navigateTo = (path) => {
    router.push(path);
    // Cerrar sidebar después de navegar
    if (isOpen) {
      toggleSidebar();
    }
  };

  const menuItems = [
    { name: 'Dashboard', icon: HomeIcon, path: '/dashboard', adminOnly: false },
    {
      name: 'Productos',
      icon: CubeIcon,
      adminOnly: false,
      path: '/productos'
    },
    {
      name: 'Inventario',
      icon: ClipboardDocumentListIcon,
      adminOnly: false,
      submenu: [
        { name: 'Ingresos', path: '/inventario/ingresos' },
        { name: 'Stock Actual', path: '/inventario/stock' },
        { name: 'Faltos', path: '/productos/faltos' }
      ]
    },
    {
      name: 'Cotizaciones',
      icon: DocumentTextIcon,
      adminOnly: false,
      submenu: [
        { name: 'Mis Cotizaciones', path: '/cotizaciones' },
        { name: 'Todas las Cotizaciones', path: '/cotizaciones/todas', adminOnly: true },
        { name: 'Historial', path: '/cotizaciones/historial' }
      ]
    },
    {
      name: 'Ventas',
      icon: BanknotesIcon,
      adminOnly: false,
      submenu: [
        { name: 'Ventas', path: '/ventas' },
        { name: 'Carrito de compras', path: '/ventas/pos' },
        { name: 'Ventas del Día', path: '/ventas/ventas-del-dia' }
      ]
    },
    {
      name: 'Clientes',
      icon: UsersIcon,
      adminOnly: false,
      submenu: [
        { name: 'Lista de Clientes', path: '/clientes' },
        { name: 'Clientes con Crédito', path: '/clientes/credito' }
      ]
    },
    {
      name: 'Proveedores',
      icon: BuildingStorefrontIcon,
      adminOnly: false,
      path: '/proveedores'
    },
    {
      name: 'Créditos',
      icon: CreditCardIcon,
      adminOnly: false,
      submenu: [
        { name: 'Créditos Activos', path: '/creditos/activos' },
        { name: 'Pagos de Crédito', path: '/creditos/pagos' },
        { name: 'Historial Créditos', path: '/creditos/historial' }
      ]
    },
    {
      name: 'Caja',
      icon: ChartBarIcon,
      adminOnly: isAdmin,
      submenu: [
        { name: 'Estado de Caja', path: '/caja/estado' },
        { name: 'Movimientos', path: '/caja/movimientos' },
        { name: 'Retiros', path: '/caja/retiros' },
        { name: 'Ganancias del Día', path: '/caja/ganancias-dia' },
        { name: 'Ganancias Reales', path: '/caja/ganancias-reales' }
      ]
    },
    {
      name: 'Reportes',
      icon: PrinterIcon,
      adminOnly: false,
      submenu: [
        { name: 'Reporte de Ventas', path: '/reportes/ventas' },
        { name: 'Reporte de Inventory', path: '/reportes/inventario' },
        { name: 'Reporte de Cotizaciones', path: '/reportes/cotizaciones' },
        { name: 'Reporte de Empleados', path: '/reportes/empleados' }
      ]
    }
  ];

  if (isAdmin) {
    menuItems.push({
      name: 'Empleados',
      icon: UserGroupIcon,
      adminOnly: true,
      submenu: [
        { name: 'Lista de Empleados', path: '/empleados' },
        { name: 'Agregar Empleado', path: '/empleados/agregar' },
        { name: 'Rendimiento', path: '/empleados/rendimiento' }
      ]
    });
  }

  return (
    <>
      {/* Overlay: aparece cuando el sidebar está abierto, cubre todo excepto el sidebar */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40" // Z-index 40 para estar debajo del sidebar (z-50)
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar: Siempre fijo y se superpone */}
      <div className={`
        fixed inset-y-0 left-0
        z-50                       /* Alto z-index para que siempre esté encima */
        w-64 bg-gray-900 text-white
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} /* Controla si está visible o fuera de pantalla */
      `}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700">
          <h1 className="text-xl font-bold text-blue-400">GestorMoto</h1>
          {/* Botón para cerrar el sidebar (siempre visible cuando el sidebar está abierto) */}
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-md hover:bg-gray-800"
            title="Cerrar Menú"
          >
            <ArrowLeftOnRectangleIcon className="h-5 w-5" />
          </button>
        </div>

        {/* User Info and Navigation (sin cambios) */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium">
                {user?.displayName ? user.displayName.charAt(0).toUpperCase() : user?.email.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium">{user?.displayName || 'Usuario'}</p>
              <p className="text-xs text-gray-400">{isAdmin ? 'Administrador' : 'Empleado'}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            if (item.adminOnly && !isAdmin) return null;

            return (
              <div key={item.name}>
                {item.submenu ? (
                  <div>
                    <button
                      onClick={() => toggleSubmenu(item.name)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <item.icon className="h-5 w-5" />
                        <span>{item.name}</span>
                      </div>
                      {openSubmenu === item.name ? (
                        <ChevronDownIcon className="h-4 w-4" />
                      ) : (
                        <ChevronRightIcon className="h-4 w-4" />
                      )}
                    </button>

                    <div className={`mt-2 ml-8 space-y-1 overflow-hidden transition-all duration-200 ${openSubmenu === item.name ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                      {item.submenu.map((subItem) => {
                        if (subItem.adminOnly && !isAdmin) return null;

                        return (
                          <button
                            key={subItem.name}
                            onClick={() => navigateTo(subItem.path)}
                            className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-md transition-colors"
                          >
                            {subItem.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => navigateTo(item.path)}
                    className="w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </button>
                )}
              </div>
            );
          })}
        </nav>

        {/* Logout (sin cambios) */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-gray-800 rounded-md transition-colors"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;