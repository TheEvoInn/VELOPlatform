import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { clearLegacyMockData } from '@/lib/mockData';

// Purge all legacy localStorage mock data on startup — platform runs on real backend only
clearLegacyMockData();

createRoot(document.getElementById("root")!).render(<App />);
