/**
 * Representação visual do pacote EtherNet/IP
*/

/**
 * EncapsulationHeader
 *      Command              (UINT, 2 bytes, unsigned)           // Encapsulation command
 *      Length               (UINT, 2 bytes, unsigned)           // Length in bytes of the data portion of the message
 *      Session handle       (UDINT, 4 bytes, unsigned)          // Session identification (application dependent)
 *      Status               (UDINT, 4 bytes, unsigned)          // Status code
 *      Sender Context       (ARRAY[8] of octet, 8 bytes)        // Information only to the sender, length of 8
 *      Options              (UDINT, 4 bytes, unsigned)          // Options flags
 * 
 * CommandSpecificData
 *      Encapsulated data    (ARRAY[0 to 65511] of octet, variable length) // Encapsulated data portion of the message
 */

import { CommandSpecificDataRegisterSession } from "./CommandSpecificDatas/RegisterSession/RegisterSession.js";
import { CommandSpecificDataListServices } from "./CommandSpecificDatas/ListServices/ListServices.js";
import { CommandSpecificDataListIdentity } from "./CommandSpecificDatas/ListIdentity/ListIdentity.js";
import { CommandSpecificDataSendRRData } from "./CommandSpecificDatas/SendRRData/SendRRData.js";
import { TraceLog } from "../../../Utils/TraceLog.js";
import { hexDeBuffer, numeroToHex } from "../../../Utils/Utils.js";
import { getStatusCode } from "../../../Utils/CIPRespondeCodes.js";

/**
 * O Layer de EtherNet/IP (Industiral Protocol) contém as informações de encapsulamento do Header + Command Specific Data
 ** O EtherNet/IP é o primeiro layer TCP do protocolo. Ele é composto pelo header de 24 bytes obrigatorios + Command Specific Data (CSD) que é variável dependendo da requisição
 ** Header: 24 bytes
 ** Command Specific Data: Bytes variavél dependo da solicitação
 */
export class EtherNetIPLayerParser {

    /**
     * Status do layer com as informações atuais
     ** Esse campo indica se os bytes recebidos são validos e encaixam com o que é esperado. Mensagens de buffers retornadas com erro devido ao mau uso da classe ainda são consideradas válidas. Esse campo apenas indica se
     houver algum erro ao dar parse no buffer.
     */
    #statusLayer = {
        /**
         * Se as informações do layer são válidas
         */
        isValido: false,
        /**
         * Se não é valido, motivo do erro
         */
        erro: {
            descricao: ''
        },
        /**
         * O tracer registra como foi a etapa de parse dos bytes recebidos
         * @type {TraceLog}
         */
        tracer: undefined
    }

    /**
     * Os campos existentes no layer do EthernetIP
     */
    #campos = {
        /**
         * Campos do header de encapsulamento
         */
        header: {
            /**
             * O codigo do comando solicitado
             * @type {Number}
            */
            codigoComando: undefined,
            /**
             * Tamanho em bytes do offset do Buffer do inicio do Command Specific Data até o ultimo Buffer.(Ignora o tamanho do proprio Header)
             * @type {Number}
             */
            tamanhoBytes: undefined,
            /**
             * O identificador da sessão
             * @type {Number}
             */
            sessaoHandlerID: undefined,
            /**
             * Status da requisição, se deu sucesso ou algum erro
             * @type {Number}
             */
            statusCodigo: undefined,
            /**
             * O Sender Context de 8 bytes original que o dispositivo recebeu e devolveu novamente
             * @type {Buffer}
             */
            contextoRemetente: undefined,
            /**
             * Opções de flags adicionais(sei lá oq tem aqui)
             * @type {Number}
             */
            opcoes: undefined
        },
        /**
         * Campos do Command Specific Data. Os campos variam dependendo do comando solicitado
         * @type {Buffer} - Buffer com os dados específicos do comando
         */
        commandSpecificData: undefined
    }

    /**
     * Instancia um novo layer de EtherNet/IP
     * @param {Buffer} buffer - Opcionalmente um buffer de uma solicitação EtherNet/IP válida para dar parse.
     */
    constructor(buffer) {
        if (buffer != undefined) this.parseBuffer(buffer);

        return this;
    }

    /**
     * Passa um Buffer de uma solicitação EtherNet/IP e faz o parse dos campos
     ** Se o buffer contém os 24 bytes, porém algumas informações forem invalidas(tipo comando, tamanho bytes, etcc) ele ainda será sucesso. O parse apenas garante que os bytes estejam no Buffer.
     * @param {Buffer} buff - Buffer com pelo menos os 24 bytes do Header de Encapsulamento
     */
    parseBuffer(buff) {
        let retornoParse = {
            isSucesso: false,
            erro: {
                descricao: ''
            },
            /**
             * O trace log contém as etapas do parser dos bytes recebidos no Socket
             */
            tracer: new TraceLog()
        }

        this.#statusLayer.tracer = retornoParse.tracer;
        const tracerBuff = retornoParse.tracer.addTipo(`EtherNetIP Parser`);

        tracerBuff.add(`Iniciando o parser de Buffer EtherNet/IP: ${hexDeBuffer(buff)}`);

        // Se o buffer não tiver os 24 bytes inicias, ele não é um buffer válido
        if (buff.length < 24) {
            this.#statusLayer.isValido = false;
            this.#statusLayer.erro.descricao = 'Buffer não contém os 24 bytes iniciais do Header de Encapsulamento';

            retornoParse.erro.descricao = this.#statusLayer.erro.descricao;

            tracerBuff.add(`Buffer não contém os 24 bytes iniciais do Header de Encapsulamento`);
            return retornoParse;
        }

        tracerBuff.add(`O Buffer recebido contém ${buff.length} bytes. Iniciando a leitura do Header de Encapsulamento`);

        // Pegar os campos do Header de Encapsulamento

        // O comando é os primeiros 2 bytes do buffer
        const comando = buff.readUInt16LE(0);
        tracerBuff.add(`Lido o comando do Header de Encapsulamento de 2 bytes: '${comando}' (${numeroToHex(comando, 2)}) no offset 0`);

        // O tamanho em bytes do Command Specific Data é os proximos 2 bytes
        const tamanhoBytes = buff.readUInt16LE(2);
        tracerBuff.add(`Lido o tamanho do Command Specific Data do Header de Encapsulamento de 2 bytes: '${tamanhoBytes}' (${numeroToHex(tamanhoBytes, 2)}) no offset 2`);

        // O Session Handler ID é os proximos 4 bytes
        const sessionHandler = buff.readUInt32LE(4);
        tracerBuff.add(`Lido o Session Handler ID do Header de Encapsulamento de 4 bytes: '${sessionHandler}' (${numeroToHex(sessionHandler, 4)}) no offset 4`);

        // O status é os proximos 4 bytes
        const status = buff.readUInt32LE(8);
        tracerBuff.add(`Lido o Status do Header de Encapsulamento de 4 bytes: '${status}' (${numeroToHex(status, 4)}) no offset 8`);

        // O contexto do remetente é os proximos 8 bytes
        const contextoSender = buff.subarray(12, 20);
        tracerBuff.add(`Lido o Contexto do Header de Encapsulamento de 8 bytes: ${contextoSender.readBigUint64LE()} '${hexDeBuffer(contextoSender)}' no offset 12`);

        // As opções são os proximos 4 bytes e últimos bytes do header de encapsulamento
        const options = buff.readUInt32LE(20);
        tracerBuff.add(`Lido as Opções do Header de Encapsulamento de 4 bytes: '${options}' (${numeroToHex(options, 4)}) no offset 20`);

        // Se o comando recebido  existe
        if (isComandoExiste(comando)) {

            // se existir, preencher no campo
            this.#campos.header.codigoComando = comando;
        } else {
            this.#statusLayer.isValido = false;
            this.#statusLayer.erro.descricao = `Comando ${comando} não existe no layer EtherNet/IP`;

            retornoParse.erro.descricao = this.#statusLayer.erro.descricao;

            tracerBuff.add(`Comando ${comando} (${numeroToHex(comando, 2)}) não existe no layer EtherNet/IP`);
            return retornoParse;
        }

        // Se o status retornado existe
        const statusLayer = isStatusExiste(status);

        if (statusLayer != undefined) {
            // se existir, preencher no campo
            this.#campos.header.statusCodigo = status;
        } else {
            this.#statusLayer.isValido = false;
            this.#statusLayer.erro.descricao = `Status ${status} não existe no layer EtherNet/IP`;

            retornoParse.erro.descricao = this.#statusLayer.erro.descricao;

            tracerBuff.add(`Status ${status} (${numeroToHex(status, 4)}) não existe no layer EtherNet/IP`);
            return retornoParse;
        }

        // Se o status não for sucesso, devo ignorar ela e não devolvo nenhuma resposta ao dispositivo
        if (status != Status.Sucess.hex) {
            tracerBuff.add(`Status diferente de sucesso 0x0. Codigo ${statusLayer.hex}: ${statusLayer.descricao}). Prosseguindo...`);
            // this.#statusLayer.isValido = false;
            // this.#statusLayer.erro.descricao = `Status diferente de sucesso 0x0. Codigo ${statusLayer.hex}: ${statusLayer.descricao})`;
            // this.#campos.header.statusCodigo = status;

            // retornoParse.erro.descricao = this.#statusLayer.erro.descricao;

            // tracerBuff.add(`Status diferente de sucesso 0x0. Codigo ${statusLayer.hex}: ${statusLayer.descricao})`);
            // return retornoParse;
        }

        tracerBuff.add(`Header de Encapsulamento lido com sucesso.`);

        // O Command Specific Data vem após os 4 bytes do options do header. Ele contém informações relacionados ao tipo da requisição recebida/solicitada e em diante contém os outros layers também.
        // O tamanho maximo é de 0 a 65511 bytes
        let commandSpecificData = buff.subarray(24, buff.length);
        tracerBuff.add(`Lido o Command Specific Data do Buffer de ${commandSpecificData.length} bytes`);

        // O tamanho em bytes do Buffer de Command Specific Data até o fim do Buffer deve corresponder ao tamanho informado no header de encapsulamento
        if (commandSpecificData.length != tamanhoBytes) {
            this.#statusLayer.isValido = false;
            this.#statusLayer.erro.descricao = `Tamanho do Command Specific Data (${commandSpecificData.length} bytes) em diante não corresponde ao tamanho informado no Header de Encapsulamento (${tamanhoBytes} bytes).`;

            retornoParse.erro.descricao = this.#statusLayer.erro.descricao;

            tracerBuff.add(`Tamanho do Command Specific Data (${commandSpecificData.length} bytes) em diante não corresponde ao tamanho informado no Header de Encapsulamento (${tamanhoBytes} bytes).`);
            return retornoParse;
        }

        // A partir daqui, é um buffer EtherNet IP válido, salvar as outras informações nos seus devidos campos
        this.#campos.header.tamanhoBytes = tamanhoBytes;
        this.#campos.header.sessaoHandlerID = sessionHandler;
        this.#campos.header.contextoRemetente = contextoSender;
        this.#campos.header.opcoes = options;
        this.#campos.commandSpecificData = commandSpecificData;

        this.#statusLayer.isValido = true;

        retornoParse.isSucesso = true;

        tracerBuff.add(`Buffer EtherNet/IP lido com sucesso. Comando: ${comando} - ${isComandoExiste(comando).descricao}, Tamanho Bytes: ${tamanhoBytes}, Session Handler ID: ${sessionHandler}, Status: ${status} - ${statusLayer.descricao} (${numeroToHex(status, 4)}), Contexto: ${contextoSender.readBigUInt64LE()} (${hexDeBuffer(contextoSender)}), Opções: ${options} (${numeroToHex(options, 4)})`);

        tracerBuff.add(`Parser EtherNet/IP finalizado.`);
        return retornoParse;
    }

    /**
     * Retorna se o layer EtherNet/IP é válido.
     */
    isValido() {
        let status = {
            /**
             * Se o layer é valido com todos os seus campos recebidos
             */
            isValido: false,
            /**
             * Se não é valido, motivo do erro
             */
            erro: {
                descricao: ''
            },
            /**
             * O tracer contém os detalhes das etapas de geração do Buffer
             * @type {TraceLog}
             */
            tracer: undefined
        }

        status.tracer = this.#statusLayer.tracer;

        // Se o motivo de não ser valido for por alguma informação incorreta no buffer que faltou certos campos
        if (!this.#statusLayer.isValido) {
            status.erro.descricao = `Erro no layer: ${this.#statusLayer.erro.descricao}`;
            return status;
        }

        status.isValido = true;
        return status;
    }

    /**
     * Retorna o comando contido no layer
     */
    getComando() {
        return isComandoExiste(this.#campos.header.codigoComando);
    }

    /**
     * Retorna o total de bytes após os 24 bytes do Header de Encapsulamento
     */
    getTamanhoBytes() {
        return this.#campos.header.tamanhoBytes;
    }

    /**
     * Retorna o numero da sessão ID utilizado para identificar a sessão em uma solicitação
     */
    getSessionHandlerID() {
        return this.#campos.header.sessaoHandlerID;
    }

    /**
     * Retorna o contexto setado no cabeçalho EtherNet/IP
     */
    getSenderContext() {
        return this.#campos.header.contextoRemetente;
    }

    /**
     * Retorna todo o conteudo do Buffer após os 24 bytes do Header de Encapsulamento (Command Specific Data) que é variavel baseado no comando da requisição
     */
    getCommandSpecificData() {
        return this.#campos.commandSpecificData;
    }

    /**
     * Se Command Specific Data representar um comando de Register Session, retorna uma instancia de RegisterSession com as informações de sessão
     ** Se não for um comando de Register Session, retorna undefined
     */
    getAsRegisterSession() {
        if (this.#campos.header.codigoComando == Comandos.RegisterSession.hex) {
            return new CommandSpecificDataRegisterSession(this.#campos.commandSpecificData);
        }

        return undefined;
    }

    /**
     * Se o comando no layer representa um comando de Register Session
     */
    isRegisterSession() {
        return this.#campos.header.codigoComando == Comandos.RegisterSession.hex;
    }

    /**
     * Se Command Specific Data representar um comando de List Services, retorna uma instancia de ListServices com as informações de serviços disponíveis
     */
    getAsListServices() {
        if (this.#campos.header.codigoComando == Comandos.ListServices.hex) {
            return new CommandSpecificDataListServices(this.#campos.commandSpecificData);
        }

        return undefined;
    }

    /**
     * Se o comando no layer representa um comando de List Services
     */
    isListServices() {
        return this.#campos.header.codigoComando == Comandos.ListServices.hex;
    }

    /**
     * Se o comando no layer representa um comando de List Identity
     */
    isListIdentity() {
        return this.#campos.header.codigoComando == Comandos.ListIdentity.hex;
    }

    /**
     * Se Command Specific Data representar um comando de List Identity, retorna uma instancia de ListIdentity com as informações do dispositivo
     */
    getAsListIdentity() {
        if (this.#campos.header.codigoComando == Comandos.ListIdentity.hex) {
            return new CommandSpecificDataListIdentity(this.#campos.commandSpecificData);
        }
    }

    /**
     * Se o comando no layer representa um comando de Send RR Data
     */
    isSendRRData() {
        return this.#campos.header.codigoComando == Comandos.SendRRData.hex;
    }

    /**
     * Se Command Specific Data representar um comando de Send RR Data, retorna uma instancia de SendRRData com as informações da solicitação
     */
    getAsSendRRData() {
        if (this.#campos.header.codigoComando == Comandos.SendRRData.hex) {
            return new CommandSpecificDataSendRRData(this.#campos.commandSpecificData);
        }
    }

    /**
     * Retorna as informações do estado de sucesso
     ** Lembre-se de checar antes de o layer EtherNet IP é valido
     */
    getStatus() {
        let retornoStatus = {
            codigo: this.#campos.header.statusCodigo,
            mensagem: ''
        }

        let statusAtual = isStatusExiste(this.#campos.header.statusCodigo);
        if (statusAtual != undefined) {
            retornoStatus.mensagem = statusAtual.descricao;
        } else {
            retornoStatus.mensagem = 'Status desconhecido.';
        }

        return retornoStatus;
    }

    /**
     * Retorna se esse layer EtherNet IP tem um status de sucesso 
     */
    isStatusSucesso() {
        const retornoSucesso = {
            /**
             * Se o status é sucesso (0x0)
             */
            isSucesso: false,
            /**
             * Se nao for sucesso, contém os detalhes do status de erro recebido
             */
            erro: {
                /**
                 * Uma descrição detalhada do porque o status não é sucesso
                 */
                descricao: '',
                /**
                 * O status atual recebido
                 */
                statusAtual: {
                    codigo: '',
                    descricao: ''
                }
            }
        }

        let statusAtual = this.getStatus();
        if (statusAtual.codigo == Status.Sucess.hex) {
            retornoSucesso.isSucesso = true;
        } else {
            retornoSucesso.erro.descricao = `O status atual não é sucesso. Codigo ${statusAtual.codigo}: ${statusAtual.mensagem}`;

            retornoSucesso.erro.statusAtual = {
                codigo: statusAtual.codigo,
                descricao: statusAtual.mensagem
            }
        }

        return retornoSucesso;
    }

    /**
     * Printa no console de forma bontinha as informações do layer EtherNet/IP
     */
    printLayer() {
        let trataNullo = (valor) => {
            if (valor == undefined) return 'Nullo';
            return valor;
        }

        let logMsg = `########## EtherNet/IP Layer ##########\n`;
        logMsg += `  Header:\n`;
        logMsg += `    Comando: ${trataNullo(this.#campos.header.codigoComando)} - ${trataNullo(trataNullo(isComandoExiste(this.#campos.header.codigoComando)).descricao)}\n`;
        logMsg += `    Tamanho Bytes: ${trataNullo(this.#campos.header.tamanhoBytes)}\n`;
        logMsg += `    Session Handler ID: ${trataNullo(this.#campos.header.sessaoHandlerID)}\n`;
        logMsg += `    Status: ${trataNullo(this.#campos.header.statusCodigo)} - ${trataNullo(trataNullo(isStatusExiste(this.#campos.header.statusCodigo)).descricao)}\n`;
        logMsg += `    Contexto Livre: ${trataNullo(trataNullo(this.#campos.header.contextoRemetente).toString('hex'))}\n`;
        logMsg += `    Opções: ${trataNullo(this.#campos.header.opcoes)}\n`;
        logMsg += `  Command Specific Data:\n`;
        logMsg += `    Dados: ${trataNullo(trataNullo(this.#campos.commandSpecificData).toString('hex'))}\n`;
        logMsg += `#######################################\n`;

        return logMsg;
    }
}

/**
 * Comandos suportados pelo layer EtherNet/IP
 */
export const Comandos = {
    NOP: {
        hex: 0x0000,
        descricao: 'NOP',
    },
    ListServices: {
        hex: 0x0004,
        descricao: 'List Services',
    },
    ListIdentity: {
        hex: 0x0063,
        descricao: 'List Identity',
    },
    ListInterfaces: {
        hex: 0x0064,
        descricao: 'List Interfaces',
    },
    RegisterSession: {
        hex: 0x0065,
        descricao: 'Register Session',
    },
    UnRegisterSession: {
        hex: 0x0066,
        descricao: 'UnRegister Session',
    },
    SendRRData: {
        hex: 0x006F,
        descricao: 'Send RR Data',
    },
    SendUnitData: {
        hex: 0x0070,
        descricao: 'Send Unit Data',
    },
    IndicateStatus: {
        hex: 0x0072,
        descricao: 'Indicate Status',
    },
}

/**
 * Código de status da solicitação no layer EtherNet/IP
 */
export const Status = {
    Sucess: {
        hex: 0x00000000,
        descricao: 'Success',
    },
    InvalidCommand: {
        hex: 0x00000001,
        descricao: 'Invalid Command',
    },
    InsufficientMemory: {
        hex: 0x00000002,
        descricao: 'Insufficient Memory',
    },
    IncorrectData: {
        hex: 0x00000003,
        descricao: 'Incorrect Data',
    },
    InvalidSessionHandle: {
        hex: 0x00000064,
        descricao: 'Invalid Session Handle',
    },
    InvalidLength: {
        hex: 0x00000065,
        descricao: 'Invalid Length',
    },
    InvalidProtocolVersion: {
        hex: 0x00000069,
        descricao: 'Invalid Protocol Version',
    },
}

/**
 * Retorna se o comando informado existe no layer EtherNet/IP
 * @param {Number} comando - Código do comando 
 */
export function isComandoExiste(comando) {
    return Object.values(Comandos).find(c => c.hex == comando);
}

/**
 * Retorna se o status informado existe no layer EtherNet/IP
 * @param {Number} status 
 */
export function isStatusExiste(status) {
    return Object.values(Status).find(s => s.hex == status);
}