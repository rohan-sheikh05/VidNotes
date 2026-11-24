import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

async function boot() {
  // Dev-only: `?seed=demo` replaces local data with demo content (stripped from production builds).
  if (import.meta.env.DEV && new URLSearchParams(location.search).get('seed') === 'demo') {
    const { seedDemo } = await import('./dev/seed');
    await seedDemo();
    history.replaceState(null, '', location.pathname);
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  );
}

boot();
