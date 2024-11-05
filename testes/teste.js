import { CompactLogixRockwell } from "./ImplementandoClasseCompactLogix.js";

const testeCompact = new CompactLogixRockwell({ ip: '192.168.3.120', porta: 44818 });

await testeCompact.getENIPSocket().conectar();
await testeCompact.getENIPSocket().autenticarENIP();

// let leituraTag = await testeCompact.lerTag('BD_G2_NOME_OPERADOR');

let leituraTag = await testeCompact.lerTag('TEMPO2_MANUTENCAO_DISA3');
console.log(leituraTag);