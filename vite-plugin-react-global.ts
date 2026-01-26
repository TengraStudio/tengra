/**
 * Vite plugin to ensure React is globally available before vendor bundles load
 */
import type { Plugin } from 'vite';

export function reactGlobalPlugin(): Plugin {
    return {
        name: 'react-global',
        enforce: 'pre',
        transformIndexHtml(html) {
            // Inject React loader script before any module scripts
            return html.replace(
                '<head>',
                `<head>
  <script>
    // CRITICAL: Load React synchronously before any modules
    import('react').then(React => {
      if (typeof window !== 'undefined') {
        window.React = React.default || React;
        window.__REACT_READY__ = true;
        // Dispatch event for libraries waiting for React
        window.dispatchEvent(new CustomEvent('react-ready'));
      }
    }).catch(err => console.error('[react-global] Failed to load React:', err));
    
    import('react-dom/client').then(ReactDOM => {
      if (typeof window !== 'undefined') {
        window.ReactDOM = ReactDOM.default || ReactDOM;
      }
    }).catch(err => console.error('[react-global] Failed to load ReactDOM:', err));
  </script>`
            );
        },
        // Removed transform hook - it was breaking ES modules like react-window
        // React is now properly available through normal module resolution
    };
}
