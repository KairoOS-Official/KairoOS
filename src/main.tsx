/**
 * @author Flow (Florian) — FlowCreativeStudio
 * @see https://github.com/NayrolfRdgs
 * @discord nayrolf_rdgs
 * @signature FCS-SIG-2026:e2848c38514d22829359a8cedb77c1df2960c7ae3e946d90803516a68b87bd67
 */

/*fcs:Flow:e2848c38514d22829359a8cedb77c1df2960c7ae3e946d90803516a68b87bd67*/
console.log('%c🎨 FlowCreativeStudio', 'color:#6366f1;font-weight:bold;font-size:14px');

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
