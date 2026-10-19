'use strict';
const test=require('node:test'),fs=require('node:fs'),vm=require('node:vm');
test('browser modules and both entry scripts parse before shipping',()=>{
 for(const directory of ['js/core','js/game','js/net','js/storage','js/ui'])for(const filename of fs.readdirSync(directory))new vm.Script(fs.readFileSync(directory+'/'+filename,'utf8'),{filename:directory+'/'+filename});
 for(const filename of ['nuclear-sweeper-reactor.html','nuclear-sweeper-dev.html'])for(const match of fs.readFileSync(filename,'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(match[1],{filename});
 new vm.Script(fs.readFileSync('nuclear-sweeper-dev.js','utf8'),{filename:'nuclear-sweeper-dev.js'});
});
