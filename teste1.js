import { EtherNetIPLayerBuilder } from "./EtherNetIP/Builder/Layers/EtherNetIP/EtherNetIPBuilder.js";
import { EtherNetIPLayerParser } from "./EtherNetIP/Parser/Layers/EtherNetIP/EtherNetIPParser.js";

import net from "net"

function iniciar() {

    let sessionHandlerId = 0;

    const socketConexao = new net.Socket();
    let novoComando = new EtherNetIPLayerBuilder();

    const conectarSocket = () => {
        socketConexao.connect({ host: '192.168.3.120', port: 44818 }, () => {
            console.log(`Conexão TCP estabelecida`);

            novoComando.buildRegisterSession();
            let bufferEtherNetIP = novoComando.criarBuffer();

            console.log(`Solicitando Session Handler...`);

            // Solicitando primeiramente o sessão handler
            socketConexao.write(bufferEtherNetIP.sucesso.buffer);

            setTimeout(() => {
                console.log(`Solicitando List Identity...`);

                let sessionHandlerId = novoComando.getSessionHandle();
                novoComando = new EtherNetIPLayerBuilder();
                novoComando.setSessionHandle(sessionHandlerId);

                let comandoRRData = novoComando.buildSendRRData();
                let connectionManagerRRData = comandoRRData.criarServicoCIP().buildCIPConnectionManager();

                let servicoLerTag = connectionManagerRRData.getCIPMessage().buildSingleServicePacket();
                servicoLerTag.setString('TESTE2');

                comandoRRData.gerarItemsEncapsulados();


                let cmdPraWrite = novoComando.criarBuffer().sucesso.buffer;

                socketConexao.write(cmdPraWrite);
            }, 2000);
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
            console.log(a);
            return;

        }
    }

    conectarSocket();
}

iniciar();