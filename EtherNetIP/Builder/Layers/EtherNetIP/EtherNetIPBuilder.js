
/**
 * 
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

import { CommandSpecificDataRegisterSessionBuilder } from "./CommandSpecificDatas/RegisterSession/RegisterSessionBuilder.js";
import { CommandSpecificDataListEntityBuilder } from "./CommandSpecificDatas/ListIdentity/ListIdentityBuilder.js";
import { CommandSpecificDataListServicesBuilder } from "./CommandSpecificDatas/ListServices/ListServices.js";
import { CommandSpecificDataSendRRDataBuilder } from "./CommandSpecificDatas/SendRRData/SendRRData.js";

/**
 * O Layer de EtherNet/IP (Industiral Protocol) contém as informações de encapsulamento do Header + Command Specific Data
 ** O EtherNet/IP é o primeiro layer TCP do protocolo. Ele é composto pelo header de 24 bytes obrigatorios + Command Specific Data (CSD) que é variável dependendo da requisição
 ** Header: 24 bytes
 ** Command Specific Data: Bytes variavél dependo da solicitação
 */
export class EtherNetIPLayerBuilder {

    /**
     * Campos para configurar no layer de EtherNet/IP
     */
    #campos = {
        /**
         * Campos contidos no cabeçalho de 24 bytes iniciais
         */
        header: {
            /**
             * O codigo do comando para solicitar
             * @type {Number}
             */
            command: undefined,
            /**
             * ID de sessão para o dispositivo reconhecer e permitir a solicitação(caso precise)
             * @type {Number}
             */
            sessionHandle: undefined,
            /**
             * O campo Sender Context é um campo de 8 bytes livre que é enviado ao dispositivo remoto, e como resposta o dispositivo remoto também retorna o mesmo Sender Contexto pra aquela requisição.
             * @type {Buffer}
             */
            senderContext: Buffer
        },
        /**
         * Automaticamente assume varios tipos dependendo do comando solicitado
         * @type {CommandSpecificDataRegisterSessionBuilder | CommandSpecificDataListEntityBuilder | CommandSpecificDataListServicesBuilder | CommandSpecificDataSendRRDataBuilder}
         */
        classeCommandSpecificData: undefined
    }

    /**
     * Os buffers que vão ser usados para enviar os bytes
     */
    #buffers = {
        /**
         * Buffer do cabeçalho de 24 bytes
         * @type {Buffer}
         */
        header: undefined,
        /**
         * Buffer variavel do Command Specific Data(é nullo até a função build ser chamada)
         * @type {Buffer}
         */
        commandSpecificData: undefined
    }

    /**
     * Instanciar um novo construtor de EtherNetIP para configurar o pacote.
     */
    constructor() {
        return this;
    }

    /**
     * Configurar o Session Handle para o dispositivo remoto reconhecer a solicitação
     * @param {Number} sessionHandle - ID de sessão para o dispositivo reconhecer e permitir a solicitação
     */
    setSessionHandle(sessionHandle) {
        if (sessionHandle == undefined) throw new Error(`É necessário informar o Session Handle para o dispositivo reconhecer a solicitação.`);
        if (typeof sessionHandle != 'number') throw new Error(`O Session Handle precisa ser um número.`);

        console.log(`Session Handle configurado para: ${sessionHandle}`);

        this.#campos.header.sessionHandle = sessionHandle;

        return this;
    }

    /**
     * Setar o campo Sender Context
     * @param {Buffer} buff - Um buffer de 8 bytes   
     */
    setSenderContext(buff) {
        if (buff == undefined) throw new Error(`É necessário informar um Buffer de 8 bytes ao campo Sender Context.`);
        if (!(buff instanceof Buffer)) throw new Error(`O Sender Context precisa ser um Buffer de 8 bytes.`);
        if (buff.length != 8) throw new Error(`O Sender Context precisa ter 8 bytes.`);

        this.#campos.header.senderContext = buff;
    }

    /**
     * Retorna o numero de sessão configurado no layer ou undefined se não foi configurado
     */
    getSessionHandle() {
        return this.#campos.header.sessionHandle;
    }

    /**
     * Builda o layer para corresponder ao Command Specific Data de um comando Register Session
     * @param {Object} parametrosRegisterSession - Informar alguns parametros de inicio para instanciar o Register Session
     * @param {Number} parametrosRegisterSession.protocolVersion - Protocolo de encapsulamento
     * @param {Number} parametrosRegisterSession.optionFlags - Flags de opções
     * @returns {CommandSpecificDataRegisterSessionBuilder}
     */
    buildRegisterSession(parametrosRegisterSession) {
        let cmdRegisterSession = new CommandSpecificDataRegisterSessionBuilder(parametrosRegisterSession);

        this.#campos.header.command = Comandos.RegisterSession.hex;
        this.#campos.classeCommandSpecificData = cmdRegisterSession;

        return cmdRegisterSession;
    }

    /**
     * Builda o layer para corresponder ao Command Specific Data de um comando List Identity
     */
    buildListIdentity() {
        let cmdListaIdentidade = new CommandSpecificDataListEntityBuilder();

        this.#campos.header.command = Comandos.ListIdentity.hex;
        this.#campos.classeCommandSpecificData = cmdListaIdentidade;

        return cmdListaIdentidade;
    }

    /**
     * Builda o layer para corresponder ao Command Specific Data de um comando List Services
     */
    buildListServices() {
        let cmdListServices = new CommandSpecificDataListServicesBuilder();

        this.#campos.header.command = Comandos.ListServices.hex;
        this.#campos.classeCommandSpecificData = cmdListServices;

        return cmdListServices;
    }

    /**
     * Builda o layer para corresponder ao Command Specific Data de um comando Send RR Data
     */
    buildSendRRData() {
        let cmdSendRRData = new CommandSpecificDataSendRRDataBuilder();

        this.#campos.header.command = Comandos.SendRRData.hex;
        this.#campos.classeCommandSpecificData = cmdSendRRData;

        return cmdSendRRData;
    }


    /**
     * Criar o buffer completo de header de encapsulamento de 24 bytes + Command Specific Data para ser enviado ao dispositivo remoto
     */
    criarBuffer() {
        let retornoBuff = {
            /**
             * Se foi possível gerar o Buffer sem erros
             */
            isSucesso: false,
            /**
             * Se sucesso, contém os dados do Buffer
             */
            sucesso: {
                buffer: undefined
            },
            erro: {
                descricao: ''
            }
        }

        // Se não foi buildado o comando para ser enviado
        if (this.#campos.classeCommandSpecificData == undefined) {
            retornoBuff.erro.descricao = `É necessario buildar algum comando no layer antes de criar o Buffer.`;
            return retornoBuff;
        }

        // Gravar no header de encapsulamento os dados do comando
        const buffCabecalho = Buffer.alloc(24);

        // Primeiros 2 bytes é o comando
        const setComandoCabecalho = (codigoCmd) => {
            buffCabecalho.writeUInt16LE(codigoCmd, 0);;
        }

        // Próximos 2 bytes é o tamanho em bytes do Command Specific Data que será enviado, nesse caso do buffer de Register Session
        let setTamanhoCommandSpecificData = (tamanho) => {
            buffCabecalho.writeUInt16LE(tamanho, 2)
        }

        // Próximos 4 bytes é o Session Handler ID
        buffCabecalho.writeUInt32LE(this.#campos.header.sessionHandle, 4);

        // Próximos 4 bytes é o status da solicitação. Como é uma requisição, eu seto como sucesso
        buffCabecalho.writeUInt32LE(0x000000, 8);

        // Próximos 8 bytes é o contexto meu atual pro dispositivo remoto saber. Eu não sei oq é isso ainda então só seto pra 0
        buffCabecalho.writeBigUInt64LE(BigInt(0x000000000000), 12)

        // Próximos 4 bytes é o options que também ainda não sei oq é então deixo como 0 como ta no manual
        buffCabecalho.writeUint32LE(0x000000, 20)

        // Salvar o buffer pra uso posterior se precisar
        this.#buffers.header = buffCabecalho;

        // Limpar o buffer do Command Specific Data
        this.#buffers.commandSpecificData = undefined;

        // Se foi configurado, fazer a tratativa para cada tipo de comando especifico
        switch (this.#campos.header.command) {
            /**
             * Buildar o Buffer do Register Session
             */
            case Comandos.RegisterSession.hex: {

                const bufferRegisterSession = this.#campos.classeCommandSpecificData.criarBuffer();
                if (!bufferRegisterSession.isSucesso) {
                    retornoBuff.erro.descricao = `Erro ao gerar Buffer para o comando Register Session: ${bufferRegisterSession.erro.descricao}`;

                    return retornoBuff;
                }

                // Se gerou o Buffer do Register Session, definir o tamanho
                setTamanhoCommandSpecificData(bufferRegisterSession.sucesso.buffer.length);

                // Setar o comando como RegisterSession
                setComandoCabecalho(Comandos.RegisterSession.hex);

                this.#buffers.commandSpecificData = bufferRegisterSession.sucesso.buffer;
                break;
            }
            /**
             * Buildar o Buffer do List Identity
             */
            case Comandos.ListIdentity.hex: {

                /**
                 * @type {CommandSpecificDataListEntityBuilder}
                 */
                const classeComando = this.#campos.classeCommandSpecificData;

                const bufferListIdentity = classeComando.criarBuffer();
                if (!bufferListIdentity.isSucesso) {
                    retornoBuff.erro.descricao = `Erro ao gerar Buffer para o comando List Identity: ${bufferListIdentity.erro.descricao}`;
                    return retornoBuff;
                }

                // Setar o tamanho do Command Specific Data
                setTamanhoCommandSpecificData(bufferListIdentity.sucesso.buffer.length);

                // Setar o comando como ListIdentity
                setComandoCabecalho(Comandos.ListIdentity.hex);

                this.#buffers.commandSpecificData = bufferListIdentity.sucesso.buffer;
                break;
            }
            /**
             * Buildar o Buffer do List Services
             */
            case Comandos.ListServices.hex: {

                /**
                 * @type {CommandSpecificDataListServicesBuilder}
                 */
                const classeComando = this.#campos.classeCommandSpecificData;

                const bufferListServices = classeComando.criarBuffer();
                if (!bufferListServices.isSucesso) {
                    retornoBuff.erro.descricao = `Erro ao gerar Buffer para o comando List Services: ${bufferListServices.erro.descricao}`;
                    return retornoBuff;
                }

                // Setar o tamanho do Command Specific Data
                setTamanhoCommandSpecificData(bufferListServices.sucesso.buffer.length);

                // Setar o comando como ListServices
                setComandoCabecalho(Comandos.ListServices.hex);

                this.#buffers.commandSpecificData = bufferListServices.sucesso.buffer;
                break;
            }
            case Comandos.SendRRData.hex: {

                /**
                 * @type {CommandSpecificDataSendRRDataBuilder}
                 */
                const classeComando = this.#campos.classeCommandSpecificData;

                const bufferSendRRData = classeComando.criarBuffer();
                if (!bufferSendRRData.isSucesso) {
                    retornoBuff.erro.descricao = `Erro ao gerar Buffer para o comando Send RR Data: ${bufferSendRRData.erro.descricao}`;
                    return retornoBuff;
                }

                // Setar o tamanho do Command Specific Data
                setTamanhoCommandSpecificData(bufferSendRRData.sucesso.buffer.length);

                // Setar o comando como SendRRData
                setComandoCabecalho(Comandos.SendRRData.hex);

                this.#buffers.commandSpecificData = bufferSendRRData.sucesso.buffer;
                break;
            }
            default: {
                retornoBuff.erro.descricao = `Não é possível construir o Buffer pois o tipo de comando (${this.#campos.header.command}) não é suportado.`
                return retornoBuff;
            }
        }

        // Após a verificação e geração do Buffer do header de encapsulamento e do Command Specific Data, juntar os dois num Buffer.
        let bufferEtherNetIP = Buffer.concat([this.#buffers.header, this.#buffers.commandSpecificData]);
        retornoBuff.isSucesso = true;
        retornoBuff.sucesso.buffer = bufferEtherNetIP;

        return retornoBuff;
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
 * Retorna se o comando informado existe no layer EtherNet/IP
 * @param {Number} comando - Código do comando 
 */
export function isComandoExiste(comando) {
    return Object.values(Comandos).find(c => c.hex == comando);
}