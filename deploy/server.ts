process.traceDeprecation = true;
import path from 'path';
import express from 'express';
import { createServer } from 'https';
import { readFileSync } from 'fs';
import dayjs from 'dayjs';
import { renderFile } from 'ejs';

import helpers from '../config/helpers';
import { getClusterAuth } from './oAuthHelpers';
import { createProxyMiddleware } from 'http-proxy-middleware';
interface IProxyConfigObj {
  target: string;
  changeOrigin: boolean;
  pathRewrite: {
    [apiPart: string]: string;
  };
  logLevel: 'debug' | 'info';
  secure?: boolean;
}

let metaStr;
if (process.env['DATA_SOURCE'] === 'mock') {
  metaStr = '{ "oauth": {} }';
} else {
  const metaFile = process.env['META_FILE'] || '/srv/meta.json';
  metaStr = readFileSync(metaFile, 'utf8');
}

console.log('\nEnvironment at run time:\n');
console.log('Available to server and browser:', helpers.getEnv());
console.log('Available to server only:', helpers.getServerOnlyEnv());

const meta = JSON.parse(metaStr);
console.log('\nValues from meta.json:', meta);

const app = express();
const port =
  process.env['EXPRESS_PORT'] || (process.env['UI_TLS_ENABLED'] !== 'false' ? 8443 : 8080);
const staticDir = process.env['STATIC_DIR'] || path.join(__dirname, '../dist');

app.engine('ejs', renderFile);
app.use(express.static(staticDir));

if (process.env['DATA_SOURCE'] !== 'mock') {
  app.get('/login', async (req, res, next) => {
    try {
      const clusterAuth = await getClusterAuth(meta);
      const authorizationUri = clusterAuth.authorizeURL({
        redirect_uri: meta.oauth.redirectUrl,
        scope: meta.oauth.userScope,
      });

      res.redirect(authorizationUri);
    } catch (error) {
      console.error(error);
      const params = new URLSearchParams({ error: JSON.stringify(error) });
      const uri = `/handle-login?${params.toString()}`;
      res.redirect(uri);
      next(error);
    }
  });

  app.get('/login/callback', async (req, res) => {
    const { code } = req.query;
    const options = {
      code,
      redirect_uri: meta.oauth.redirectUrl,
    };
    try {
      const clusterAuth = await getClusterAuth(meta);
      // TODO: type for options/getToken mismatch
      const accessToken = await clusterAuth.getToken(options.redirect_uri);
      const currentUnixTime = dayjs().unix();
      const user = {
        ...accessToken.token,
        login_time: currentUnixTime,
        expiry_time: currentUnixTime + accessToken.token.expires_in,
      };
      const params = new URLSearchParams({ user: JSON.stringify(user) });
      const uri = `/handle-login?${params.toString()}`;
      res.redirect(uri);
    } catch (error: unknown) {
      console.error('Access Token Error', (error as Error).message);
      return res.status(500).json('Authentication failed');
    }
    return Promise.resolve(true);
  });
}

if (process.env['DATA_SOURCE'] !== 'mock') {
  let clusterApiProxyOptions: IProxyConfigObj = {
    target: meta.clusterApi,
    changeOrigin: true,
    pathRewrite: {
      '^/cluster-api/': '/',
    },
    logLevel: process.env.DEBUG ? 'debug' : 'info',
  };

  let inventoryApiProxyOptions: IProxyConfigObj = {
    target: meta.inventoryApi,
    changeOrigin: true,
    pathRewrite: {
      '^/inventory-api/': '/',
    },
    logLevel: process.env.DEBUG ? 'debug' : 'info',
  };

  /* TODO restore this when https://github.com/konveyor/forklift-ui/issues/281 is settled
  let inventoryPayloadApiProxyOptions = {
    target: meta.inventoryPayloadApi,
    changeOrigin: true,
    pathRewrite: {
      '^/inventory-payload-api/': '/',
    },
    logLevel: process.env.DEBUG ? 'debug' : 'info',
  };
  */

  if (process.env['NODE_ENV'] === 'development') {
    clusterApiProxyOptions = {
      ...clusterApiProxyOptions,
      secure: false,
    };

    inventoryApiProxyOptions = {
      ...inventoryApiProxyOptions,
      secure: false,
    };

    /* TODO restore this when https://github.com/konveyor/forklift-ui/issues/281 is settled
    inventoryPayloadApiProxyOptions = {
      ...inventoryPayloadApiProxyOptions,
      secure: false,
    };
    */
  }

  const clusterApiProxy = createProxyMiddleware(clusterApiProxyOptions);
  const inventoryApiProxy = createProxyMiddleware(inventoryApiProxyOptions);
  // TODO restore this when https://github.com/konveyor/forklift-ui/issues/281 is settled
  // const inventoryPayloadApiProxy = createProxyMiddleware(inventoryPayloadApiProxyOptions);

  app.use('/cluster-api/', clusterApiProxy);
  app.use('/inventory-api/', inventoryApiProxy);
  // TODO restore this when https://github.com/konveyor/forklift-ui/issues/281 is settled
  // app.use('/inventory-payload-api/', inventoryPayloadApiProxy);
}

app.get('*', (_, res) => {
  if (process.env['NODE_ENV'] === 'development' || process.env['DATA_SOURCE'] === 'mock') {
    // In dev and mock-prod modes, window._meta and window._env were populated at build time
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  } else {
    res.render('index.html.ejs', {
      _meta: helpers.sanitizeAndEncodeMeta(meta),
      _env: helpers.getEncodedEnv(),
      _app_title: helpers.getAppTitle(),
    });
  }
});

if (
  process.env['UI_TLS_ENABLED'] !== 'false' &&
  process.env['NODE_ENV'] !== 'development' &&
  process.env['DATA_SOURCE'] !== 'mock'
) {
  const options = {
    key: readFileSync(
      process.env['UI_TLS_KEY'] || '/var/run/secrets/forklift-ui-serving-cert/tls.key'
    ),
    cert: readFileSync(
      process.env['UI_TLS_CERTIFICATE'] || '/var/run/secrets/forklift-ui-serving-cert/tls.crt'
    ),
  };
  createServer(options, app).listen(port);
} else {
  app.listen(port, () => console.log(`Listening on port ${port}`));
}
