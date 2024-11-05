import { CompactLogixRockwell } from "./ImplementandoClasseCompactLogix.js";

const testeCompact = new CompactLogixRockwell({ ip: '192.168.3.120', porta: 44818 });

await testeCompact.getENIPSocket().conectar();
await testeCompact.getENIPSocket().autenticarENIP();

let escreveTag = await testeCompact.escreveTag('TESTE32', {
    isAtomico: true,
    atomico: {
        codigoAtomico: testeCompact.getDataTypes().atomicos.DINT.codigo,
        valor: 22
    }
})
console.log(escreveTag);


// let leituraTag = await testeCompact.lerTag('CACETE');
// console.log(leituraTag);
