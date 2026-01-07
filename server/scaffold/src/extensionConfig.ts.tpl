import routes from './routes';
import locales from './locales';

const menus = __MENUS__;

const extensionConfig = {
  menus,
  routes,
  locales,
  isCheckLicense: true,
};

export default extensionConfig;
