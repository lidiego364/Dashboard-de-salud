# vendor

`anthropic-sdk.js` es el SDK oficial de Anthropic para JavaScript (`@anthropic-ai/sdk` 0.131.0, licencia MIT) empaquetado para el navegador. Expone `window.Anthropic` y la app lo carga solo al pedir un análisis de fotos.

Para regenerarlo:

```sh
npm install @anthropic-ai/sdk@0.131.0 esbuild
echo "import Anthropic from '@anthropic-ai/sdk'; window.Anthropic = Anthropic;" > entry.js
npx esbuild entry.js --bundle --minify --format=iife --platform=browser --target=es2020 --outfile=anthropic-sdk.js
```
