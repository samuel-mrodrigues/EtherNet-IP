import { DataTypesNumericos } from "./EtherNetIP/Builder/Layers/EtherNetIP/CommandSpecificDatas/SendRRData/CIP/Servicos/SingleServicePacket/SingleServicePacket.js";
import { EtherNetIPLayerBuilder } from "./EtherNetIP/Builder/Layers/EtherNetIP/EtherNetIPBuilder.js";
import { EtherNetIPLayerParser } from "./EtherNetIP/Parser/Layers/EtherNetIP/EtherNetIPParser.js";

import net from "net"

function iniciar() {

    let sessionHandlerId = 0;

    const socketConexao = new net.Socket();
    let novoComando = new EtherNetIPLayerBuilder();

    let testaSinglePacket = () => {
        let sessionHandlerId = novoComando.getSessionHandle();

        novoComando = new EtherNetIPLayerBuilder();
        novoComando.setSessionHandle(sessionHandlerId);

        let comandoRRData = novoComando.buildSendRRData();
        let connectionManagerRRData = comandoRRData.criarServicoCIP().buildCIPConnectionManager();

        let singleService = connectionManagerRRData.getCIPMessage().buildSingleServicePacket();
        singleService.setAsGetAttribute({ nome: 'TESTE2' })

        let writeDados = novoComando.criarBuffer();

        console.log(writeDados);

        let adsa = writeDados.tracer.getHistoricoOrdenado()

        console.log(adsa);

        socketConexao.write(writeDados.sucesso.buffer);
    }

    let testaMultiplePackets = () => {
        let sessionHandlerId = novoComando.getSessionHandle();

        novoComando = new EtherNetIPLayerBuilder();
        novoComando.setSessionHandle(sessionHandlerId);

        let comandoRRData = novoComando.buildSendRRData();
        let connectionManagerRRData = comandoRRData.criarServicoCIP().buildCIPConnectionManager();

        let multipleService = connectionManagerRRData.getCIPMessage().buildMultipleServicePacket().setAsMessageRouter();
        multipleService.addSingleServicePacket().servico.setAsGetAttribute({ nome: 'TESTE21' });
        multipleService.addSingleServicePacket().servico.setAsGetAttribute({ nome: 'TESTE13' });
        multipleService.addSingleServicePacket().servico.setAsGetAttribute({ nome: 'CUCUCU1' });
        multipleService.addSingleServicePacket().servico.setAsGetAttribute({ nome: 'TESTE2' });

        let cmdPraWrite = novoComando.criarBuffer();

        socketConexao.write(cmdPraWrite.sucesso.buffer);

    }

    let testeSinglePacketWrite = () => {
        let sessionHandlerId = novoComando.getSessionHandle();

        novoComando = new EtherNetIPLayerBuilder();
        novoComando.setSessionHandle(sessionHandlerId);

        let comandoRRData = novoComando.buildSendRRData();
        let connectionManagerRRData = comandoRRData.criarServicoCIP().buildCIPConnectionManager();

        let instrucaoEscreveTag = connectionManagerRRData.getCIPMessage().buildSingleServicePacket();

        instrucaoEscreveTag.setAsSetAttribute({
            nome: 'Tempo_maquina_em_producao_G1',
            datatype: DataTypesNumericos.DINT.codigo,
            valor: 55
        })

        comandoRRData.gerarItemsEncapsulados();

        let writeDados = novoComando.criarBuffer();

        socketConexao.write(writeDados.sucesso.buffer);
    }

    let testeMultiplePacketWrite = () => {
        let sessionHandlerId = novoComando.getSessionHandle();

        novoComando = new EtherNetIPLayerBuilder();
        novoComando.setSessionHandle(sessionHandlerId);

        let comandoRRData = novoComando.buildSendRRData();
        let connectionManagerRRData = comandoRRData.criarServicoCIP().buildCIPConnectionManager();

        let instrucaoMultipleServices = connectionManagerRRData.getCIPMessage().buildMultipleServicePacket().setAsMessageRouter();
        instrucaoMultipleServices.addSingleServicePacket().servico.setAsSetAttribute({ nome: 'TESTE2', datatype: DataTypesNumericos.DINT.codigo, valor: 55 });
        instrucaoMultipleServices.addSingleServicePacket().servico.setAsSetAttribute({ nome: 'Tempo_maquina_em_producao_G12', datatype: DataTypesNumericos.DINT.codigo, valor: 666 });
        instrucaoMultipleServices.addSingleServicePacket().servico.setAsSetAttribute({ nome: 'Tdasdsadas', datatype: DataTypesNumericos.DINT.codigo, valor: 99 });

        comandoRRData.gerarItemsEncapsulados();

        let writeDados = novoComando.criarBuffer();

        socketConexao.write(writeDados.sucesso.buffer);
    }

    let testeClasseGenerica = () => {
        let sessionHandlerId = novoComando.getSessionHandle();

        novoComando = new EtherNetIPLayerBuilder();
        novoComando.setSessionHandle(sessionHandlerId);

        let comandoRRData = novoComando.buildSendRRData();
        let connectionManagerRRData = comandoRRData.criarServicoCIP().buildCIPConnectionManager();

        let listIdentity = connectionManagerRRData.getCIPMessage().buildClasseGenerica();
        listIdentity.setCodigoServico(0x01).setClasse(Buffer.from([0x20, 0x01])).setInstancia(Buffer.from([0x24, 0x01]));

        comandoRRData.gerarItemsEncapsulados();

        let writeDados = novoComando.criarBuffer();

        socketConexao.write(writeDados.sucesso.buffer);
    }

    let testeListIdentity = () => {
        let sessionHandlerId = novoComando.getSessionHandle();

        novoComando = new EtherNetIPLayerBuilder();
        novoComando.setSessionHandle(sessionHandlerId);

        let comandoRRData = novoComando.buildListIdentity();

        let buff = novoComando.criarBuffer();

        socketConexao.write(buff.sucesso.buffer);
    }

    let testeListServices = () => {
        let sessionHandlerId = novoComando.getSessionHandle();

        novoComando = new EtherNetIPLayerBuilder();
        novoComando.setSessionHandle(sessionHandlerId);

        let comandoRRData = novoComando.buildListServices();

        let buff = novoComando.criarBuffer();

        socketConexao.write(buff.sucesso.buffer);
    }

    const conectarSocket = () => {
        socketConexao.connect({ host: '192.168.3.120', port: 44818 }, () => {
            console.log(`Conexão TCP estabelecida`);

            novoComando.buildRegisterSession();
            let bufferEtherNetIP = novoComando.criarBuffer();

            console.log(`Solicitando Session Handler...`);

            // Solicitando primeiramente o sessão handler
            socketConexao.write(bufferEtherNetIP.sucesso.buffer);

            setTimeout(() => {
                // testeListServices();
                testaSinglePacket();
            }, 1500);

        });

        socketConexao.on('data', (data) => {
            processaBufferRecebido(data);
        });

        socketConexao.on('end', () => {
            console.log('Conexão encerrada pelo servidor');
        });

        socketConexao.on('error', (err) => {
            console.error('Erro:', err);
        });

        socketConexao.on('timeout', () => {
            console.log('Conexão atingiu o tempo limite');
        });

        socketConexao.on('close', (hadError) => {
            console.log(`Conexão fechada${hadError ? ' devido a um erro' : ''}`);
        });
    }

    const processaBufferRecebido = (buff) => {

        const parserEIP = new EtherNetIPLayerParser(buff);

        if (!parserEIP.isValido()) {
            console.log(`Recebido um buffer que não é um protocolo EtherNet IP válido: ${parserEIP.isValido().erro.descricao}`);
            return;
        }

        // Se for valido, validar oq esse cara quer
        if (parserEIP.isRegisterSession()) {

            console.log(`Comando de register session! Sessão de ID recebido: ${parserEIP.getSessionHandlerID()}`);
            let a = parserEIP.getAsRegisterSession();

            sessionHandlerId = parserEIP.getSessionHandlerID();

            novoComando.setSessionHandle(sessionHandlerId);
            return;
        }

        if (parserEIP.isListIdentity()) {

            console.log(`Comando de List Identity recebido.`);

            let a = parserEIP.getAsListIdentity();
            console.log(a);
            return;
        }

        if (parserEIP.isListServices()) {

            console.log(`Comando de List Services recebido.`);

            let a = parserEIP.getAsListServices();
            if (a.isValido().isValido) {
                console.log(a.isValido().tracer.getHistoricoOrdenado());
            }
            console.log(a);
            return;

        }

        if (parserEIP.isSendRRData()) {

            console.log(`RRData recebido!`);


            let sendRRDataLayer = parserEIP.getAsSendRRData();

            if (sendRRDataLayer.isServicoCIP()) {
                console.log(`É um comando CIP!`);

                let cipLayer = sendRRDataLayer.getAsServicoCIP();

                if (cipLayer.isSingleServicePacket()) {
                    console.log(`É um comando Single Service Packet!`);

                    let singleServicePacket = cipLayer.getAsSingleServicePacket();

                }

                if (cipLayer.isMultipleServicePacket()) {
                    console.log(`É um comando Multiple Service Packet!`);

                    let multipleServicePacket = cipLayer.getAsMultipleServicePacket();
                }
            }
        }
    }

    conectarSocket();
}

iniciar();