import { CompactLogixRockwell } from "./ImplementandoClasseCompactLogix.js";

const testeCompact = new CompactLogixRockwell({ ip: '192.168.3.120', porta: 44818 });

console.log(`Iniciando conexão...`);
testeCompact.getENIPSocket().conectar();
