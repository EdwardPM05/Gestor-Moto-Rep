// pages/_app.js
import { AuthProvider } from '../contexts/AuthContext';
import { SaleProvider } from '../contexts/SaleContext';
import '../styles/globals.css';

function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      <SaleProvider> {/* Envuelve con SaleProvider */}
        <Component {...pageProps} />
      </SaleProvider>
    </AuthProvider>
  );
}
export default MyApp;