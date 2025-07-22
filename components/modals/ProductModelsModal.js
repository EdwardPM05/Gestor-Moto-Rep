// components/modals/ProductModelsModal.js
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export default function ProductModelsModal({ isOpen, onClose, product /* , modelosMoto ya no lo necesitamos */ }) {
  if (!isOpen || !product) return null;

  // Esta función ya no es necesaria
  // const getModeloNombre = (modeloId) => { /* ... */ };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-75" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-sm transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all relative">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 mb-4"
                >
                  Modelos Compatibles: {product.nombre}
                </Dialog.Title>

                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>

                <div className="mt-2 text-sm text-gray-500">
                  {/* CAMBIO CLAVE: Mostrar el texto libre directamente */}
                  {product.modelosCompatiblesTexto ? (
                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                      {product.modelosCompatiblesTexto.split(/[,;\n]/).map((modelo, index) =>
                        modelo.trim() ? <li key={index}>{modelo.trim()}</li> : null
                      )}
                    </ul>
                  ) : (
                    <p className="text-gray-500">No hay modelos compatibles registrados para este producto.</p>
                  )}
                </div>


              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}