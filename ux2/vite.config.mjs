import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// Same-origin local proxy keeps LOCAL_TEST_ONLY backend bound to localhost, without relaxing CORS.
export default defineConfig({plugins:[react()],base:'./',server:{host:'127.0.0.1',port:5173,strictPort:true,proxy:{'/finance-api':{target:'http://127.0.0.1:3101',changeOrigin:true,rewrite:path=>path.replace(/^\/finance-api/,'') ,configure:proxy=>proxy.on('proxyReq',req=>{req.removeHeader('origin');req.removeHeader('referer');})}}}});
