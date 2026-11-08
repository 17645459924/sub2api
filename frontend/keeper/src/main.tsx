import './integration/bootstrap'
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { StartupGate } from './StartupGate';
import i18n from './i18n';
import './styles/reset.scss';
import './styles/variables.scss';
import './styles/themes.scss';
import './styles/layout.scss';
import './styles/components.scss';
import './styles/global.scss';
import { useThemeStore } from './stores';

function Root() {
  const initializeTheme = useThemeStore((state) => state.initializeTheme);

  useEffect(() => {
    try {
      const storage = window.localStorage;
      storage.removeItem('cli-proxy-usage-ranking-preferences-v1');
      storage.removeItem('cli-proxy-usage-ranking-scope-v1');
      if (storage.getItem('cli-proxy-usage-tab-v1') === 'ranking') {
        storage.removeItem('cli-proxy-usage-tab-v1');
      }
    } catch {
      // 浏览器拒绝存储访问时，结束废弃排名偏好的清理。
    }
  }, []);

  useEffect(() => initializeTheme(), [initializeTheme]);

  return <StartupGate />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <Root />
    </I18nextProvider>
  </StrictMode>
);
