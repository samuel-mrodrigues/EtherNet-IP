import { CompactLogixRockwell } from "./ImplementandoClasseCompactLogix.js";

const testeCompact = new CompactLogixRockwell({ ip: '192.168.3.120', porta: 44818 });

await testeCompact.getENIPSocket().conectar();


testeCompact.getENIPSocket().autenticarENIP();