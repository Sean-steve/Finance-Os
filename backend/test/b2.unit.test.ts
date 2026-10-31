import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchingRules,combineDecision} from '../src/b2.js';
const uuid='1dd230f3-a2ec-4e7e-9650-9fd16d7f82c1';
const basic={id:'a',name:'Large payment',kind:'AMOUNT',action:'WARN',conditions:{minAmountMinor:10000},active:true,version:1};
const required={...basic,id:'b',name:'Independent approval',action:'REQUIRE_APPROVAL'};
const blocker={...basic,id:'c',name:'Hard block',action:'BLOCK'};
const category={...basic,id:'d',kind:'CATEGORY',action:'WARN',conditions:{categoryId:uuid}};
test('guardrail deterministic precedence and exact scope',()=>{
 assert.equal(combineDecision([]),'NO_RESTRICTION');
 assert.equal(combineDecision([basic]),'WARNING');
 assert.equal(combineDecision([basic,required]),'APPROVAL_REQUIRED');
 assert.equal(combineDecision([basic,required,blocker]),'BLOCKED');
 assert.deepEqual(matchingRules([basic,required,blocker,category],{amountMinor:9999,categoryId:uuid}).map(x=>x.id),['d']);
 assert.deepEqual(matchingRules([basic,required,blocker,category],{amountMinor:10000,categoryId:uuid}).map(x=>x.id),['a','b','c','d']);
 assert.deepEqual(matchingRules([basic,required,blocker,category],{amountMinor:10000,categoryId:'different'}).map(x=>x.id),['a','b','c']);
});
test('unimplemented merchant, time and location evidence cannot cause false enforcement',()=>{
 const unknown={...basic,id:'unknown',kind:'MERCHANT',conditions:{merchant:'Example Co'},action:'BLOCK'};
 assert.deepEqual(matchingRules([unknown],{amountMinor:120000,categoryId:uuid}),[]);
});
