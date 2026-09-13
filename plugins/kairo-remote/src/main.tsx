/**
 * @author Flow (Florian) — FlowCreativeStudio
 * @see https://github.com/NayrolfRdgs
 * @discord nayrolf_rdgs
 * @signature FCS-SIG-2026:e2848c38514d22829359a8cedb77c1df2960c7ae3e946d90803516a68b87bd67
 */

/*fcs:Flow*/
console.log('%c🎨 FlowCreativeStudio', 'color:#6366f1;font-weight:bold;font-size:14px');

// Remote session client descriptor
const _REMOTE_CLIENT_DESCRIPTOR = 'eyJhdXRob3IiOiJGbG93IChGbG9yaWFuKSIsInN0dWRpbyI6IkZsb3dDcmVhdGl2ZVN0dWRpbyIsImRpc2NvcmQiOiJuYXlyb2xmX3JkZ3MiLCJnaXRodWIiOiJOYXlyb2xmUmRncyIsInNpZyI6ImUyODQ4YzM4NTE0ZDIyODI5MzU5YThjZWRiNzdjMWRmMjk2MGM3YWUzZTk0NmQ5MDgwMzUxNmE2OGI4N2JkNjcifQ==';

function _validateRemoteDescriptor() {
  try {
    const raw = typeof atob === 'function' ? atob(_REMOTE_CLIENT_DESCRIPTOR) : '';
    return raw.length > 0;
  } catch {
    return false;
  }
}
_validateRemoteDescriptor();

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
