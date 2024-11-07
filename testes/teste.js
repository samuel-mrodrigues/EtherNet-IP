import { CompactLogixRockwell } from "./ImplementandoClasseCompactLogix.js";

const testeCompact = new CompactLogixRockwell({ ip: '192.168.3.120', porta: 44818 });

await testeCompact.getENIPSocket().conectar();
await testeCompact.getENIPSocket().autenticarENIP();


let leituras = {
    comErros: [],
    realizadas: 0
}

let escritas = {
    comErros: [],
    realizadas: 0
}

setInterval(async () => {

    testeCompact.lerTag('TESTE2').then((leituraTag) => {
        console.log(leituraTag);
        
        leituras.realizadas++;

        if (!leituraTag.isSucesso) {
            leituras.comErros.push(leituraTag);
        }
    })

    testeCompact.escreveTag('Tempo_maquina_em_producao_G1', {
        isAtomico: true,
        atomico: {
            codigoAtomico: testeCompact.getDataTypes().atomicos.DINT.codigo,
            valor: Math.floor(Math.random() * (10000 - 100 + 1)) + 100
        }
    }).then((escritaTag) => {
        console.log(escritaTag);
        
        escritas.realizadas++;

        if (!escritaTag.isSucesso) {
            escritas.comErros.push(escritaTag);
        }
    })
}, 900);

setInterval(() => {
    
    console.log(`
######[ LEITURAS ]######
Realizadas: ${leituras.realizadas}
Com erros: ${leituras.comErros.length}
#######################

######[ ESCRITAS ]######
Realizadas: ${escritas.realizadas}
Com erros: ${escritas.comErros.length}
#######################
        `);
    
}, 5000);