import SwaggerParser from '@apidevtools/swagger-parser';
import { fileURLToPath } from 'node:url';
const file=fileURLToPath(new URL('../openapi/finance-os.v1.json',import.meta.url));
const result=await SwaggerParser.validate(file);
console.log('OpenAPI validated:',result.info?.title,result.info?.version,Object.keys(result.paths || {}).length,'paths');
