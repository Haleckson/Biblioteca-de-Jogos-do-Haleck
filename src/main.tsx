import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { setupConsoleSanitizer } from './utils/logger';
import { ErrorBoundary } from './components/ErrorBoundary';

setupConsoleSanitizer();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
