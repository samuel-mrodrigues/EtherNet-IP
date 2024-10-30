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

/**
 * O Layer de EtherNet/IP (Industiral Protocol) contém as informações de encapsulamento do Header + Command Specific Data
 ** O EtherNet/IP é o primeiro layer TCP do protocolo. Ele é composto pelo header de 24 bytes obrigatorios + Command Specific Data (CSD) que é variável dependendo da requisição
 ** Header: 24 bytes
 ** Command Specific Data: Bytes variavél dependo da solicitação
 */
export class EtherNetIPLayerParser {

    /**
     * Status do layer com as informações atuais
     */
    #statusLayer = {
        /**
         * Se as informações do layer são válidas
         ** No caso ao dar parse de um buffer, se o buffer é válido e contém todas as informações necessárias ele será valido
         ** No caso ao montar um Layer EtherNet IP, é necessario ter informado todos os campos necessários para ser valido
         */
        isValido: false,
        /**
         * Se não é valido, motivo do erro
         */
        erro: {
            descricao: ''
        }
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
             * Contexto atual para notificar o outro lado
             */
            contextoRemetente: undefined,
            /**
             * Opções de flags adicionais(sei lá oq tem aqui)
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
            }
        }

        // Se o buffer não tiver os 24 bytes inicias, ele não é um buffer válido
        if (buff.length < 24) {
            this.#statusLayer.isValido = false;
            this.#statusLayer.erro.descricao = 'Buffer não contém os 24 bytes iniciais do Header de Encapsulamento';

            retornoParse.erro.descricao = this.#statusLayer.erro.descricao;
            return retornoParse;
        }

        // Pegar os campos do Header de Encapsulamento

        // O comando é os primeiros 2 bytes do buffer
        const comando = buff.readUInt16LE(0);

        // O tamanho em bytes do Command Specific Data é os proximos 2 bytes
        const tamanhoBytes = buff.readUInt16LE(2);

        // O Session Handler ID é os proximos 4 bytes
        const sessionHandler = buff.readUInt32LE(4);

        // O status é os proximos 4 bytes
        const status = buff.readUInt32LE(8);

        // O contexto do remetente é os proximos 8 bytes
        const contextoSender = buff.subarray(12, 20);

        // As opções são os proximos 4 bytes e últimos bytes do header de encapsulamento
        const options = buff.readUInt32LE(20);

        // Se o comando recebido não existe
        if (isComandoExiste(comando)) {
            // se existir, preencher no campo
            this.#campos.header.codigoComando = comando;
        } else {
            this.#statusLayer.isValido = false;
            this.#statusLayer.erro.descricao = `Comando ${comando} não existe no layer EtherNet/IP`;

            retornoParse.erro.descricao = this.#statusLayer.erro.descricao;
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
            return retornoParse;
        }

        // Se o status não for sucesso, devo ignorar ela e não devolvo nenhuma resposta ao dispositivo
        if (status != Status.Sucess.hex) {
            this.#statusLayer.isValido = false;
            this.#statusLayer.erro.descricao = `Status diferente de sucesso 0x0. Codigo ${statusLayer.hex}: ${statusLayer.descricao})`;

            this.#campos.header.statusCodigo = status;

            retornoParse.erro.descricao = this.#statusLayer.erro.descricao;
            return retornoParse;
        }

        // O Command Specific Data vem após os 4 bytes do options do header. Ele contém informações relacionados ao tipo da requisição recebida/solicitada e em diante contém os outros layers também.
        // O tamanho maximo é de 0 a 65511 bytes
        let commandSpecificData = buff.subarray(24, buff.length);

        // O tamanho em bytes do Buffer de Command Specific Data até o fim do Buffer deve corresponder ao tamanho informado no header de encapsulamento
        if (commandSpecificData.length != tamanhoBytes) {
            this.#statusLayer.isValido = false;
            this.#statusLayer.erro.descricao = `Tamanho do Command Specific Data (${commandSpecificData.length} bytes) em diante não corresponde ao tamanho informado no Header de Encapsulamento (${tamanhoBytes} bytes).`;

            retornoParse.erro.descricao = this.#statusLayer.erro.descricao;
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
        return retornoParse;
    }

    /**
     * Retorna se o layer EtherNet/IP é válido.
     */
    isValido() {
        let status = {
            /**
             * Se o layer é valido com todos os seus campos recebidos e seu status como sucesso
             */
            isValido: false,
            /**
             * Se não é valido, motivo do erro
             */
            erro: {
                descricao: ''
            }
        }

        // Se o motivo de não ser valido for por alguma informação incorreta no buffer que faltou certos campos
        if (!this.#statusLayer.isValido) {
            status.erro.descricao = `Erro no layer: ${this.#statusLayer.erro.descricao}`;
            return status;
        }

        // Se o layer estiver valido, verificar se o erro não for do campo status
        if (this.#campos.header.statusCodigo != Status.Sucess.hex) {
            status.erro.descricao = `Status diferente de sucesso 0x0. Codigo ${this.#campos.header.statusCodigo}: ${isStatusExiste(this.#campos.header.statusCodigo).descricao}`;
            return status;
        }

        // Se o layer estiver joia e o status também, está tá tudo bem :D
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
        logMsg += `    Contexto Remetente: ${trataNullo(trataNullo(this.#campos.header.contextoRemetente).toString('hex'))}\n`;
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