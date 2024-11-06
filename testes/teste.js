import { CompactLogixRockwell } from "./ImplementandoClasseCompactLogix.js";

const testeCompact = new CompactLogixRockwell({ ip: '192.168.3.120', porta: 44818 });

await testeCompact.getENIPSocket().conectar();
await testeCompact.getENIPSocket().autenticarENIP();

let escreveTag = await testeCompact.lerMultiplasTags(['TESTE', 'TESTE2'])
console.log(escreveTag);



// let leituraTag = await testeCompact.lerTag('dasdsad');
// console.log(leituraTag);
