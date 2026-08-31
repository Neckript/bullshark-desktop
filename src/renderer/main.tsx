import { createRoot } from 'react-dom/client';
import './theme.css';
import { Router } from './router';
createRoot(document.getElementById('root')!).render(<Router />);
