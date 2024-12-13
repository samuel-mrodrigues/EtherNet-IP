
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
import { CommandSpecificDataUnRegisterSessionBuilder } from "./CommandSpecificDatas/UnRegisterSession/UnRegisterSession.js";
import { CommandSpecificDataListEntityBuilder } from "./CommandSpecificDatas/ListIdentity/ListIdentityBuilder.js";
import { CommandSpecificDataListServicesBuilder } from "./CommandSpecificDatas/ListServices/ListServices.js";
import { CommandSpecificDataSendRRDataBuilder } from "./CommandSpecificDatas/SendRRData/SendRRData.js";
import { TraceLog } from "../../../Utils/TraceLog.js";
import { hexDeBuffer, numeroToHex } from "../../../Utils/Utils.js";

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
            senderContext: undefined
        },
        /**
         * Automaticamente assume varios tipos dependendo do comando solicitado
         * @type {CommandSpecificDataRegisterSessionBuilder | CommandSpecificDataListEntityBuilder | CommandSpecificDataListServicesBuilder | CommandSpecificDataSendRRDataBuilder | CommandSpecificDataUnRegisterSessionBuilder}
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
     * @param {Object} parametros - Parametros iniciais para configurar o Layer
     * @param {Number} parametros.sessionHandleID - ID do Session Handle para o dispositivo reconhecer a solicitação
     * @param {Buffer} parametros.senderContext - Sender Context customizado
     */
    constructor(parametros) {
        const valoresPadroes = {
            senderContext: () => {
                this.#campos.header.senderContext = Buffer.alloc(8);
            },
            sessionHandle: () => {
                this.#campos.header.sessionHandle = 0;
            }
        }

        // Validar os parametros iniciais informados se existem
        if (parametros != undefined && typeof parametros == 'object') {

            if (parametros.senderContext != undefined) {
                if (!(parametros.senderContext instanceof Buffer)) throw new Error(`O Sender Context precisa ser um Buffer de 8 bytes.`);
                if (parametros.senderContext.length != 8) throw new Error(`O Sender Context precisa ter 8 bytes.`);

                this.#campos.header.senderContext = parametros.senderContext;
            }

            if (parametros.sessionHandleID != undefined) {

                if (typeof parametros.sessionHandleID != 'number') throw new Error(`O Session Handle precisa ser um número.`);

                this.#campos.header.sessionHandle = parametros.sessionHandleID;
            }
        }

        // Validar os campos se estão configurados, se não, setar os valores padrões
        if (this.#campos.header.senderContext == undefined) {
            valoresPadroes.senderContext();
        }

        if (this.#campos.header.sessionHandle == undefined) {

            valoresPadroes.sessionHandle();
        }

        return this;
    }

    /**
     * Configurar o Session Handle para o dispositivo remoto reconhecer a solicitação
     * @param {Number} sessionHandle - ID de sessão para o dispositivo reconhecer e permitir a solicitação
     */
    setSessionHandle(sessionHandle) {
        if (sessionHandle == undefined) throw new Error(`É necessário informar o Session Handle para o dispositivo reconhecer a solicitação.`);
        if (typeof sessionHandle != 'number') throw new Error(`O Session Handle precisa ser um número.`);

        this.#campos.header.sessionHandle = sessionHandle; return this;
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
     * @param {Buffer} parametrosRegisterSession.optionFlags - Flags de opções
     * @returns {CommandSpecificDataRegisterSessionBuilder}
     */
    buildRegisterSession(parametrosRegisterSession) {
        let cmdRegisterSession = new CommandSpecificDataRegisterSessionBuilder(parametrosRegisterSession);

        this.#campos.header.command = Comandos.RegisterSession.hex;
        this.#campos.classeCommandSpecificData = cmdRegisterSession;
        return cmdRegisterSession;
    }

    /**
     * Builda o layer para corresponder ao Command Specific Data de um comando UnRegister Session
     */
    buildUnRegisterSession() {
        let cmdUnRegisterSession = new CommandSpecificDataUnRegisterSessionBuilder();

        this.#campos.header.command = Comandos.UnRegisterSession.hex;
        this.#campos.classeCommandSpecificData = cmdUnRegisterSession;
        return cmdUnRegisterSession;
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
                /**
                 * Buffer com os bytes do pacote EtherNet/IP
                 * @type {Buffer}
                 */
                buffer: undefined
            },
            erro: {
                descricao: ''
            },
            /**
             * O Trace Log contém os logs de execução do processo de criação do Buffer, incluido erros se houve.
             */
            tracer: new TraceLog()
        }

        // Pra anotar o log de cada passo
        const tracerGeraBuffer = retornoBuff.tracer.addTipo('EtherNetIPBuilder');

        tracerGeraBuffer.add(`Iniciando processo de criação do Buffer com as seguintes informações. Comando: ${this.#campos.header.command}, Session Handle: ${this.#campos.header.sessionHandle}, Sender Context: (${hexDeBuffer(this.#campos.header.senderContext)})`);

        // Se não foi buildado o comando para ser enviado
        if (this.#campos.classeCommandSpecificData == undefined) {
            retornoBuff.erro.descricao = `É necessario buildar algum comando no layer antes de criar o Buffer.`;

            tracerGeraBuffer.add(`Não foi possível gerar o Buffer pois não foi buildado nenhum comando.`);
            return retornoBuff;
        }

        // Gravar no header de encapsulamento os dados do comando
        const buffCabecalho = Buffer.alloc(24);
        tracerGeraBuffer.add(`Alocando um Buffer de 24 bytes pro cabeçalho`)

        // Primeiros 2 bytes é o comando
        const setComandoCabecalho = (codigoCmd) => {
            tracerGeraBuffer.add(`Setando o comando no cabeçalho como ${codigoCmd} (${numeroToHex(codigoCmd, 2)}) no offset 0`);
            buffCabecalho.writeUInt16LE(codigoCmd, 0);;
        }

        // Próximos 2 bytes é o tamanho em bytes do Command Specific Data que será enviado, nesse caso do buffer de Register Session
        let setTamanhoCommandSpecificData = (tamanho) => {
            tracerGeraBuffer.add(`Setando o tamanho do Command Specific Data como ${tamanho} (${numeroToHex(tamanho, 2)}) no offset 2`);
            buffCabecalho.writeUInt16LE(tamanho, 2)
        }

        // Próximos 4 bytes é o Session Handler ID
        buffCabecalho.writeUInt32LE(this.#campos.header.sessionHandle, 4);
        tracerGeraBuffer.add(`Setando o Session Handler ID como ${this.#campos.header.sessionHandle} (${numeroToHex(this.#campos.header.sessionHandle, 4)}) no offset 4`);

        // Próximos 4 bytes é o status da solicitação. Como é uma requisição, eu seto como sucesso
        let statusSucesso = 0x000000;
        buffCabecalho.writeUInt32LE(0x000000, 8);
        tracerGeraBuffer.add(`Setando o Status como ${statusSucesso} (${numeroToHex(statusSucesso, 4)}) no offset 8`);

        // Próximos 8 bytes é o contexto livre que pode ser customizado pelo usuario e é retornado pelas respostas do dispositivo remoto
        // let contextoId = this.#campos.header.senderContext;
        let contextoId = this.#campos.header.senderContext.readBigUInt64LE(0);
        buffCabecalho.writeBigUInt64LE(BigInt(contextoId), 12);
        tracerGeraBuffer.add(`Setando o Sender Context como ${contextoId} (${numeroToHex(contextoId, 8)}) no offset 12`);

        // Próximos 4 bytes é o options que também ainda não sei oq é então deixo como 0 como ta no manual
        let optionsNaoSeiOqE = 0x000000;
        buffCabecalho.writeUint32LE(optionsNaoSeiOqE, 20);
        tracerGeraBuffer.add(`Setando o Options como ${optionsNaoSeiOqE} (${numeroToHex(optionsNaoSeiOqE, 4)}) no offset 20`);

        // Salvar o buffer pra uso posterior se precisar
        this.#buffers.header = buffCabecalho;
        tracerGeraBuffer.add(`Buffer do cabeçalho criado com sucesso: ${hexDeBuffer(buffCabecalho)}, ${buffCabecalho.length} bytes`);

        // Limpar o buffer do Command Specific Data
        this.#buffers.commandSpecificData = undefined;

        tracerGeraBuffer.add(`Preparando-se para criar o Buffer do Command Specific Data para o comando ${this.#campos.header.command} (${numeroToHex(this.#campos.header.command, 2)})...`);

        // Se foi configurado, fazer a tratativa para cada tipo de comando especifico
        switch (this.#campos.header.command) {
            /**
             * Buildar o Buffer do Register Session
             */
            case Comandos.RegisterSession.hex: {

                tracerGeraBuffer.add(`Criando o Buffer para Register Session`);

                const bufferRegisterSession = this.#campos.classeCommandSpecificData.criarBuffer();

                retornoBuff.tracer.appendTraceLog(bufferRegisterSession.tracer);
                if (!bufferRegisterSession.isSucesso) {
                    retornoBuff.erro.descricao = `Erro ao gerar Buffer para o comando Register Session: ${bufferRegisterSession.erro.descricao}`;

                    tracerGeraBuffer.add(`Erro ao gerar Buffer para o comando Register Session: ${bufferRegisterSession.erro.descricao}`);
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

                tracerGeraBuffer.add(`Criando o Buffer para List Identity`);

                /**
                 * @type {CommandSpecificDataListEntityBuilder}
                 */
                const classeComando = this.#campos.classeCommandSpecificData;

                const bufferListIdentity = classeComando.criarBuffer();

                retornoBuff.tracer.appendTraceLog(bufferListIdentity.tracer);
                if (!bufferListIdentity.isSucesso) {
                    retornoBuff.erro.descricao = `Erro ao gerar Buffer para o comando List Identity: ${bufferListIdentity.erro.descricao}`;

                    tracerGeraBuffer.add(`Erro ao gerar Buffer para o comando List Identity: ${bufferListIdentity.erro.descricao}`);
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


                tracerGeraBuffer.add(`Criando o Buffer para List Services`);

                /**
                 * @type {CommandSpecificDataListServicesBuilder}
                 */
                const classeComando = this.#campos.classeCommandSpecificData;

                const bufferListServices = classeComando.criarBuffer();

                retornoBuff.tracer.appendTraceLog(bufferListServices.tracer);
                if (!bufferListServices.isSucesso) {
                    retornoBuff.erro.descricao = `Erro ao gerar Buffer para o comando List Services: ${bufferListServices.erro.descricao}`;

                    tracerGeraBuffer.add(`Erro ao gerar Buffer para o comando List Services: ${bufferListServices.erro.descricao}`);
                    return retornoBuff;
                }

                // Setar o tamanho do Command Specific Data
                setTamanhoCommandSpecificData(bufferListServices.sucesso.buffer.length);

                // Setar o comando como ListServices
                setComandoCabecalho(Comandos.ListServices.hex);

                this.#buffers.commandSpecificData = bufferListServices.sucesso.buffer;
                break;
            }
            /**
             * Buildar o Buffer do SendRRData
             */
            case Comandos.SendRRData.hex: {

                tracerGeraBuffer.add(`Criando o Buffer para Send RR Data`);

                /**
                 * @type {CommandSpecificDataSendRRDataBuilder}
                 */
                const classeComando = this.#campos.classeCommandSpecificData;

                const bufferSendRRData = classeComando.criarBuffer();

                retornoBuff.tracer.appendTraceLog(bufferSendRRData.tracer);
                if (!bufferSendRRData.isSucesso) {
                    retornoBuff.erro.descricao = `Erro ao gerar Buffer para o comando Send RR Data: ${bufferSendRRData.erro.descricao}`;

                    tracerGeraBuffer.add(`Erro ao gerar Buffer para o comando Send RR Data: ${bufferSendRRData.erro.descricao}`);
                    return retornoBuff;
                }

                // Setar o tamanho do Command Specific Data
                setTamanhoCommandSpecificData(bufferSendRRData.sucesso.buffer.length);

                // Setar o comando como SendRRData
                setComandoCabecalho(Comandos.SendRRData.hex);

                this.#buffers.commandSpecificData = bufferSendRRData.sucesso.buffer;
                break;
            }
            /**
             * Buildar o Buffer do UnRegisterSession
             */
            case Comandos.UnRegisterSession.hex: {

                tracerGeraBuffer.add(`Criando o Buffer para UnRegister Session`);

                const bufferUnRegisterSession = this.#campos.classeCommandSpecificData.criarBuffer();

                retornoBuff.tracer.appendTraceLog(bufferUnRegisterSession.tracer);
                if (!bufferUnRegisterSession.isSucesso) {
                    retornoBuff.erro.descricao = `Erro ao gerar Buffer para o comando UnRegister Session: ${bufferUnRegisterSession.erro.descricao}`;

                    tracerGeraBuffer.add(`Erro ao gerar Buffer para o comando UnRegister Session: ${bufferUnRegisterSession.erro.descricao}`);
                    return retornoBuff;
                }

                // Se gerou o Buffer do UnregisterRegister Session, definir o tamanho
                setTamanhoCommandSpecificData(bufferUnRegisterSession.sucesso.buffer.length);

                // Setar o comando como RegisterSession
                setComandoCabecalho(Comandos.UnRegisterSession.hex);

                this.#buffers.commandSpecificData = bufferUnRegisterSession.sucesso.buffer;

                break
            }
            /**
             * Qualquer comando que não for válido.
             */
            default: {
                retornoBuff.erro.descricao = `Não é possível construir o Buffer pois o tipo de comando (${this.#campos.header.command}) não é suportado.`

                tracerGeraBuffer.add(`Não é possível construir o Buffer pois o tipo de comando (${this.#campos.header.command}) não é suportado.`);
                return retornoBuff;
            }
        }

        tracerGeraBuffer.add(`Buffer do Command Specific Data criado com sucesso: ${hexDeBuffer(this.#buffers.commandSpecificData)}, ${this.#buffers.commandSpecificData.length} bytes`);

        // Após a verificação e geração do Buffer do header de encapsulamento e do Command Specific Data, juntar os dois num Buffer.
        let bufferEtherNetIP = Buffer.concat([this.#buffers.header, this.#buffers.commandSpecificData]);

        tracerGeraBuffer.add(`Buffer completo Header + Command Specific Data criado com sucesso: ${hexDeBuffer(bufferEtherNetIP)}, ${bufferEtherNetIP.length} bytes`);

        tracerGeraBuffer.add(`Builder EtherNetIP finalizado.`);
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