import { hexDeBuffer } from "../EtherNetIP/Utils/Utils.js";
import { CompactLogixRockwell } from "./ImplementandoClasseCompactLogix.js";

const testeCompact = new CompactLogixRockwell({ ip: '192.168.3.120', porta: 44818 });

testeCompact.getENIPSocket().toggleAutoReconnect(true)
await testeCompact.getENIPSocket().conectar();

let novoPacote = testeCompact.getENIPSocket().getNovoLayerBuilder();

let sendRRData = novoPacote.buildSendRRData();

let servicoCIP = sendRRData.criarServicoCIP();

let connMan = servicoCIP.buildCIPConnectionManager()

let solicitaClassTeste = connMan.getCIPMessage().buildServicoCustomizadoPacket();

solicitaClassTeste.setCodigoServico(0x55)
solicitaClassTeste.setClasse(Buffer.from([0x20, 0x6b]))
solicitaClassTeste.setInstancia(Buffer.from([0x25, 0x00, 0x00, 0x02]))
solicitaClassTeste.setCIPGenericData(Buffer.from([0x02, 0x00, 0x01, 0x00, 0x02, 0x00]))


let respostaENIP = await testeCompact.getENIPSocket().enviarENIP(novoPacote);

const servicoGenerico = respostaENIP.enipReceber.enipParser.getAsSendRRData().getAsServicoCIP().getAsServicoGenericoPacket();

console.log(hexDeBuffer(servicoGenerico.getCIPClassCommandSpecificData()));

console.log(servicoGenerico);




// let leituras = {
//     comErros: [],
//     realizadas: 0
// }

// let escritas = {
//     comErros: [],
//     realizadas: 0
// }

// setInterval(async () => {

//     testeCompact.lerTag('TESTE2').then((leituraTag) => {
//         console.log(leituraTag);
        
//         leituras.realizadas++;

//         if (!leituraTag.isSucesso) {
//             leituras.comErros.push(leituraTag);
//         }
//     })

//     testeCompact.escreveTag('Tempo_maquina_em_producao_G1', {
//         isAtomico: true,
//         atomico: {
//             codigoAtomico: testeCompact.getDataTypes().atomicos.DINT.codigo,
//             valor: Math.floor(Math.random() * (10000 - 100 + 1)) + 100
//         }
//     }).then((escritaTag) => {
//         console.log(escritaTag);
        
//         escritas.realizadas++;

//         if (!escritaTag.isSucesso) {
//             escritas.comErros.push(escritaTag);
//         }
//     })
// }, 900);

// setInterval(() => {
    
//     console.log(`
// ######[ LEITURAS ]######
// Realizadas: ${leituras.realizadas}
// Com erros: ${leituras.comErros.length}
// #######################

// ######[ ESCRITAS ]######
// Realizadas: ${escritas.realizadas}
// Com erros: ${escritas.comErros.length}
// #######################
//         `);
    
// }, 5000);