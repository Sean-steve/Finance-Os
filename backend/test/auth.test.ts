import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword} from '../src/auth.js';
import {loadConfig} from '../src/config.js';

test('local password verifiers store salted scrypt digest only',async()=>{
 const a=await hashPassword('A-strong-local-only-password-12345');
 const b=await hashPassword('A-strong-local-only-password-12345');
 assert.match(a,/^scrypt\$32768\$8\$1\$/);
 assert.notEqual(a,b,'identical passwords require independent salts');
 assert.ok(!a.includes('A-strong-local-only-password'));
});
test('production refuses first-party local authentication and same-role pooling',()=>{
 assert.throws(()=>loadConfig({NODE_ENV:'production',LOCAL_AUTH_ENABLED:'true',
 DATABASE_URL:'postgresql://finance_app@host/finance?sslmode=require',
 AUTH_DATABASE_URL:'postgresql://finance_auth@host/finance?sslmode=require',
 CORS_ALLOWED_ORIGINS:'https://example.com'}),/forbidden/i);
 assert.throws(()=>loadConfig({NODE_ENV:'test',LOCAL_AUTH_ENABLED:'true',
 DATABASE_URL:'postgresql://finance_app@localhost/finance',
 AUTH_DATABASE_URL:'postgresql://finance_app@localhost/finance'}),/different roles/i);
});
