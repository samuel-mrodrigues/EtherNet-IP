import { EtherNetIPSocket } from "../src/EtherNetIP/EtherNetIP.js";
import { hexDeBuffer } from "../src/EtherNetIP/Utils/Utils.js";
import { CompactLogixRockwell } from "../src/Controladores/Rockwell/CompactLogix/CompactLogix.js";
import { MicroLogix1400 } from "../src/Controladores/Rockwell/MicroLogix/MicroLogix1400.js";
import { CompactLogixV2 } from "../src/Controladores/Rockwell/CompactLogix/CompactLogixV2.js"

async function teste() {


    const etherNetIPMicrologix = new EtherNetIPSocket({
        conexao: {
            ip: '192.168.3.182',
            porta: 44818
        },
        isAutoReconnect: true,
        isHabilitaLogs: true
    })

    await etherNetIPMicrologix.conectar();

    const layerENIP = etherNetIPMicrologix.getNovoLayerBuilder();

    const cipPCCC = layerENIP.buildSendRRData().criarServicoCIP().buildCIPPCCC();

    cipPCCC.setServicePCCC(cipPCCC.getServicesPCCC().ExecutePCCC.hex);

    const commandData = cipPCCC.getCommandData();
    commandData.setTransactionCode(Buffer.from([0x02, 0x00]));

    commandData.setCommandCode(0x0F);
    commandData.setFunctionCode(0x29);



    commandData.setFunctionSpecificDataBuffer(Buffer.from([0x00, 0x10, 0x00, 0x00, 0x00, 0x89]))

    let respostaENIP = await etherNetIPMicrologix.enviarENIP(layerENIP);
    console.log(respostaENIP);

    // Ler

    // Ler endereço
    // const lerEnderecoBuilder = commandData.setAsCommandProtectedTyped3Address('Read');
    // lerEnderecoBuilder.setByteSize(0x02);
    // lerEnderecoBuilder.setFileNumber(Buffer.from([0x02]));
    // lerEnderecoBuilder.setFileType('Status');
    // lerEnderecoBuilder.setElementNumber(Buffer.from([1]));
    // lerEnderecoBuilder.setSubElementNumber(Buffer.from([0x00]));

    // let respostaENIP = await etherNetIPMicrologix.enviarENIP(layerENIP);
    // const respostaCIPPCCC = respostaENIP.enipReceber.enipParser.getAsSendRRData().getAsServicoCIP().getAsPCCC();
    // const responsePCCC = respostaCIPPCCC.getPCCCResponseData();
    // console.log(responsePCCC.getStatusPCCC());

    // Ler diagnostico
    // commandData.setCommandCode(0x06)
    // commandData.setFunctionCode(0x03);

    // while (true) {

    //     let respostaENIP = await etherNetIPMicrologix.enviarENIP(layerENIP);
    // }
    // const respostaCIPPCCC = respostaENIP.enipReceber.enipParser.getAsSendRRData().getAsServicoCIP().getAsPCCC();
    // const responsePCCC = respostaCIPPCCC.getPCCCResponseData();
    // console.log(responsePCCC.getStatusPCCC());

    // console.log(responsePCCC.getFunctionSpecificResponseData());
}

async function testeMicroLogix() {
    const micoLogix = new MicroLogix1400({
        ip: '192.168.3.190',
        porta: 44818,
        autoReconectar: false,
        habilitaLogs: true
    })

    let statusConecta = await micoLogix.conectar();

    if (!statusConecta.isConectou) {
        return;
    }

    // const layer = micoLogix.getENIPSocket().getNovoLayerBuilder();

    // const CIPPCCC = layer.buildSendRRData().criarServicoCIP().buildCIPPCCC();

    // // Seta a função para executar no pacote CIP PCCC(executar)
    // CIPPCCC.setServicePCCC(ServicosPCCC.ExecutePCCC.hex);

    // // O comando PCCC onde vou configurar todas as configurações da leitura
    // const CommandData = CIPPCCC.getCommandData();

    // Como é uma leitura, uso o comando e função Protected Typed 3 Address Read
    // const leituraTyped3AddressBuilder = CommandData.setAsCommandProtectedTyped3Address('Read');



    // const lerInfo = await micoLogix.readVersao();
    // console.log(lerInfo);

    // let leituraString = await micoLogix.lerDataFile('ST10:1')
    // console.log(leituraString);

    // const leituraString = await micoLogix.lerDataFile('ST10:5');
    // console.log(leituraString);
    
    // let escritaString = await micoLogix.writeDataFile('ST10:5', 'Euuu soo queeero e ser feliz, andar tranquilamente')
    // console.log(escritaString);

    const statusCriaObservador = await micoLogix.observarDataFile('ST10:5', {
        onDataFileAlterado: (valorAntigo, valorNovo) => {
            console.log(`Valor antigo: ${valorAntigo}, novo valor: ${valorNovo}`);
        },
        onErroLeitura: (erro) => {
            console.error(`Erro ao ler Data File: ${erro}`);
        }
    });
    
}

async function testeCompactLogix() {

    const novoCompat = new CompactLogixRockwell({
        ip: '192.168.3.124',
        porta: 44818,
        habilitaLogs: true
    })

    await novoCompat.conectar();

    // let testeEscreve = await novoCompat.escreveTag('PESO_BALANCA_C_NEG', {isAtomico: true, atomico: {
    //     codigoAtomico: 202,
    //     valor: 666
    // }})
    // const testeEscreve = await novoCompat.escreveMultiplasTags([
    //     {tag: 'PESO_BALANCA_C_NEG', dataType: {isAtomico: true, atomico: {codigoAtomico: 202, valor: 123}}},
    // ])

    console.log(testeEscreve);
    

}

// testeMicroLogix();
// teste();

// testeCompactLogix();

async function testeCompactLogixV2() {

    // Conectar
    const controlador = new CompactLogixV2({
        conexao: {
            ip: '192.168.3.120',
            porta: 44818
        },
        isAutoReconectar: true,
        isMostrarConsoleLogs: true
    })

    const statusConectou = await controlador.conectar();
    if (!statusConectou.isConectado) {
        console.log(`Erro ao conectar-se: ${statusConectou.erro.descricao}`);

        return;
    }

    // Ler tags
    const leTag = await controlador.lerTags(['TESTE2', 'TESTE']);
    console.log(leTag);

    // Escrever tags
    const escreveTags = await controlador.escreverTags([
        { tag: 'TESTE2', valor: 5 }
    ])
    console.log(escreveTags);

    // Observar tags
    const observaTags = await controlador.observarTag('TESTE2', {
        onAlterado: (antigo, novo) => {
            console.log(`Valor antigo: ${JSON.stringify(antigo)}, novo valor: ${JSON.stringify(novo)}`);
        }
    })

    if (observaTags.isSucesso) {
        console.log(`TAG observada com sucesso via ID ${observaTags.sucesso.idCallback}`);

        setTimeout(() => {
            console.log('Parando observação da tag TESTE2');
            controlador.pararCallbackObservacaoTag('TESTE2', observaTags.sucesso.idCallback);

            controlador.pararObservacaoTag('TESTE2');
        }, 5000);
    }

}

async function testaConexaoCompact() {
    const compact = new CompactLogixRockwell({
        ip: '192.168.3.195',
        porta: 44818,
        habilitaLogs: true,
        autoReconectar: false
    })

    const tentaConectar = await compact.conectar();
    console.log(tentaConectar);

}

// testeCompactLogix();
testeMicroLogix();