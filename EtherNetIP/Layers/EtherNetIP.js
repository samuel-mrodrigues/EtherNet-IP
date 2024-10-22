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

/**
 * O Layer de EtherNet/IP (Industiral Protocol) contém as informações de encapsulamento do Header + Command Specific Data
 ** O EtherNet/IP é o primeiro layer TCP do protocolo. Ele é composto pelo header de 24 bytes obrigatorios + Command Specific Data (CSD) que é variável dependendo da requisição
 ** Header: 24 bytes
 ** Command Specific Data: Bytes variavél dependo da solicitação
 */
export class EtherNetIPLayer {

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
         */
        commandSpecificData: {

        }
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
        let isParseado = {
            isSucesso: false,
            erro: {
                descricao: ''
            }
        }

        console.log(`.`);

        // Se o buffer não tiver os 24 bytes inicias, ele não é um buffer válido
        if (buff.length < 24) {
            this.#statusLayer.isValido = false;
            this.#statusLayer.erro.descricao = 'Buffer não contém os 24 bytes iniciais do Header de Encapsulamento';

            isParseado.erro.descricao = this.#statusLayer.erro.descricao;
            return isParseado;
        }

        // Pegar os campos do Header de Encapsulamento

        // O comando é um UINT de 2 bytes
        let comando = buff.readUInt16LE(0);
        let tamanhoBytes = buff.readUInt16LE(2);
        let sessionHandler = buff.readUInt32LE(4);
        let status = buff.readUInt32LE(8);
        let contextoSender = buff.subarray(12, 20);
        let options = buff.readUInt32LE(20);

        // Se o comando recebido não existe
        if (isComandoExistente(comando)) {

            this.#statusLayer.isValido = false;
            this.#statusLayer.erro.descricao = `Comando ${comando} não existe no layer EtherNet/IP`;

            isParseado.erro.descricao = this.#statusLayer.erro.descricao;
        } else {
            // se existir, preencher no campo
            this.#campos.header.codigoComando = comando;
        }

        

        return isParseado;
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
 * Verifica se um comando existe no layer EtherNet/IP
 * @param {Number} comando - Código do comando 
 */
export function isComandoExistente(comando) {
    return Object.values(Comandos).some(c => c.hex == comando);
}