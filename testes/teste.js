import { hexDeBuffer } from "../EtherNetIP/Utils/Utils.js";
import { CompactLogixRockwell } from "../Controladores/CompactLogix/CompactLogix.js";

async function testeSondaTags() {

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
}

async function testeCarai() {
    const testeCompact = new CompactLogixRockwell({ ip: '192.168.3.120', porta: 44818 });

    testeCompact.getENIPSocket().toggleAutoReconnect(true)
    await testeCompact.getENIPSocket().conectar();

    let teste = await testeCompact.escreveMultiplasTags([{
        tag: 'TESTE2',
        dataType: {
            isAtomico: true,
            atomico: {
                codigoAtomico: testeCompact.getDataTypes().atomicos.DINT.codigo,
                valor: 55
            }
        }
    }, {
        tag: 'TESTECUSCUS',
        dataType: {
            isAtomico: true,
            atomico: {
                codigoAtomico: testeCompact.getDataTypes().atomicos.DINT.codigo,
                valor: 22
            }
        }
    }])

    console.log(teste);

}

async function testeEscritaUmaTag() {
    const testeCompact = new CompactLogixRockwell({ ip: '192.168.3.120', porta: 44818 });

    testeCompact.getENIPSocket().toggleAutoReconnect(true)
    await testeCompact.getENIPSocket().conectar();

    // let leituraValor = await testeCompact.escreveMultiplasTags([
    //     {tag: 'BD_D5_MOTIVO_DIA4[2]', dataType: {isAtomico: true, atomico: {codigoAtomico: testeCompact.getDataTypes().atomicos.DINT.codigo, valor: 1}}},
    //     {tag: 'BD_D5_MOTIVO_DIA4[3]', dataType: {isAtomico: true, atomico: {codigoAtomico: testeCompact.getDataTypes().atomicos.DINT.codigo, valor: 2}}},
    // ])
    // console.log(leituraValor);
    
    let leituraValor = await testeCompact.lerMultiplasTags(['BD_D5_MOTIVO_DIA4[2]', 'BD_D5_MOTIVO_DIA4[3]', 'TESTE2', 'TESTE[2]', 'BD_D5_MOTIVO_DIA4[44]'])
    console.log(leituraValor);
    
    
    return;

    let valorAtual = await testeCompact.escreveTag('BD_D5_MOTIVO_DIA4[2]', {
        isAtomico: true,
        atomico: {
            codigoAtomico: testeCompact.getDataTypes().atomicos.DINT.codigo,
            valor: 55
        }
    })

    console.log(valorAtual);
    
}

// testeCarai();
// testeUmaEscrita();
testeEscritaUmaTag();