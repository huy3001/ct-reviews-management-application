import { PERMISSIONS, entryPointUriPath } from './src/constants';

/**
 * @type {import('@commercetools-frontend/application-config').ConfigOptionsForCustomApplication}
 */
const config = {
  name: 'Reviews',
  entryPointUriPath,
  cloudIdentifier: 'aws-us',
  mcApiUrl: 'https://mc-api.us-east-2.aws.commercetools.com',
  env: {
    development: {
      initialProjectKey: 'huy-test-project',
    },
    production: {
      applicationId: 'cmudsqags000201xpymdzeijq',
      url: 'https://reviews-custom-application.vercel.app',
    },
  },
  oAuthScopes: {
    view: ['view_products'],
    manage: ['manage_products'],
  },
  icon: '${path:@commercetools-frontend/assets/application-icons/star.svg}',
  mainMenuLink: {
    defaultLabel: 'Reviews',
    labelAllLocales: [],
    permissions: [PERMISSIONS.View],
  },
};

export default config;
