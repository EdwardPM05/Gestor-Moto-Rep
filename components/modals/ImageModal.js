// components/modals/ImageModal.js
import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline'; // Asegúrate de que XMarkIcon esté importado

const ImageModal = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4" onClick={onClose}>
      <div className="relative bg-white p-2 rounded-lg max-w-3xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-1 bg-gray-200 rounded-full text-gray-700 hover:bg-gray-300 z-10"
          title="Cerrar"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
        <img src={imageUrl} alt="Imagen del Producto" className="max-w-full max-h-full object-contain" />
      </div>
    </div>
  );
};

export default ImageModal;