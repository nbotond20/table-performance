import { LicenseInfo } from '@mui/x-license';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const muiLicenseKey = import.meta.env.VITE_MUI_X_LICENSE_KEY;
if (muiLicenseKey) {
  LicenseInfo.setLicenseKey(muiLicenseKey);
}

createRoot(document.getElementById('root')!).render(<App />);
