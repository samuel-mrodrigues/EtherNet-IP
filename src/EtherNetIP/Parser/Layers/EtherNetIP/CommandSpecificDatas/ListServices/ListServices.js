/**
 * O Command Specific Data List Services retorna as disponibilidades de comunicação que o dispositivo remoto remoto suporta
 */

import { TraceLog } from "../../../../../Utils/TraceLog.js";
import { hexDeBuffer, numeroToHex } from "../../../../../Utils/Utils.js";

/**
 * TargetItems
 *      Item Count           (UINT, 2 bytes, unsigned)            // Number of items to follow
 *      Target Items         (STRUCT)                             // Interface Information
 *          Item Type Code   (UINT, 2 bytes, unsigned)            // Item Type Code
 *          Item Length      (UINT, 2 bytes, unsigned)            // Item Length
 *          Version          (UINT, 2 bytes, unsigned)            // Version of encapsulated protocol shall be set to 1
 *          Capability flags (UINT, 2 bytes, unsigned)            // Capability flags
 *          Name of service  (ARRAY[16] of USINT, 16 bytes)       // Name of service
 */

/**
 * @typedef Servico
 * @property {String} nome - Nome do serviço
 * @property {Number} versao_protocolo_encapsulamento - Versão do protocolo de encapsulamento EtherNet IP do dispositivo(sempre deve ser 1 segundo o manuel '-')
 * @property {Number} codigo_servico - Código do serviço em decimal
 * @property {Object} flags - Flags suportadas pelo serviço
 * @property {Boolean} flags.encapsulamento_cip_via_tcp - Flag que indica se o serviço suporta encapsulamento CIP via TCP
 * @property {Boolean} flags.encapsulamento_cip_via_udp - Flag que indica se o serviço suporta encapsulamento CIP via UDP
 */


export class CommandSpecificDataListServices {

    /**
     * Status se os campos pra compor o ListServices é valido
     */
    #statusComando = {
        isValido: false,
        // Se não for valido contém os detalhes do erro
        erro: {
            descricao: ''
        },
        /**
         * O tracer contém o passo a passo do parser do buffer
         * @type {TraceLog}
         */
        tracer: undefined
    }

    /**
     * Campos que existem no ListService
     */
    #campos = {
        /**
         * Número de serviços retornados
         */
        contadorTotServicos: undefined,
        /**
         * Serviços retornados e suas funções
         * @type {Servico[]}
         */
        servicos: []
    }

    /**
     * Instanciar o payload do comando de List Services
     * @param {Buffer} buffer - Opcionamente um buffer para dar parse
     */
    constructor(buff) {
        if (buff != undefined) this.parseBuffer(buff);

        return this;
    }

    /**
     * Retorna se o parser do Buffer foi validado com sucesso.
     */
    isValido() {
        const isValido = {
            /**
             * Se o parser do buffer foi validado com sucesso
             */
            isValido: false,
            /**
             * Detalhes do erro de validação do parser se houve algum
             */
            erro: {
                descricao: ''
            },
            /**
             * O tracer contém detalhes do passo a passo do parser do buffer
             * @type {TraceLog}
             */
            tracer: undefined
        }

        isValido.tracer = this.#statusComando.tracer;

        if (this.#statusComando.isValido) {
            isValido.isValido = true;
        } else {
            isValido.erro.descricao = this.#statusComando.erro.descricao;
        }
        return isValido;
    }


    /**
     * Passar um Buffer de Command Specific Data do tipo ListServices e fazer o parse dos campos
     * @param {Buffer} buff - Buffer com os dados do Command Specific Data
     */
    parseBuffer(buff) {
        const retoParse = {
            /**
             * Se foi possível gerar o Buffer com sucesso
             */
            isSucesso: false,
            erro: {
                descricao: ''
            },
            /**
             * Detalhes do parse do Buffer
             */
            tracer: new TraceLog()
        }

        const tracerBuffer = retoParse.tracer.addTipo(`ListServices Parser`);
        this.#statusComando.tracer = retoParse.tracer;

        tracerBuffer.add(`Iniciando parse de ListServices com o Buffer: ${hexDeBuffer(buff)}`);

        // Os 2 primeiros bytes do Buffer tem a quantidade de serviços retornados, se não tiver nem pelo menos isso não deve ser um Buffer valido
        if (buff.length < 2) {
            this.#statusComando.isValido = false;
            this.#statusComando.erro.descricao = 'Buffer não contém os 2 bytes minimos do Command Specific Data do comando List Services';

            retoParse.erro.descricao = this.#statusComando.erro.descricao;

            tracerBuffer.add(`Buffer recebido não tem os 2 bytes minimos para o Command Specific Data do List Services`);
            return retoParse;
        }

        // Le os 2 primeiros bytes do Buffer com a quantidade de serviços
        let intServicosExistentes = buff.readUInt16LE(0);
        tracerBuffer.add(`Lendo quantidade de serviços existentes: ${intServicosExistentes} (${numeroToHex(intServicosExistentes, 2)}) no offset 0`);

        // O offset está atualmente na quantidade, só somo se entrar no for 
        let offsetServicoAtual = 0;

        const servicosEncontrados = [];

        // Passar por cada serviço retornado
        // Segundo o manual, um serviço(não sei se mais) que sempre deve ter é o Communications que descreve quais protocolos suporta para a troca de informação via TCP/UDP
        for (let servicoIndex = 0; servicoIndex < intServicosExistentes; servicoIndex++) {

            /**
            * @type {Servico}
            */
            let novoServ = {
                nome: '',
                codigo_servico: -1,
                versao_protocolo_encapsulamento: -1,
                flags: {
                    encapsulamento_cip_via_tcp: false,
                    encapsulamento_cip_via_udp: false
                }
            }

            let tipoServico;
            let tamanhoPayload;
            let versaoProtocoloEncapsulamento;
            let flagsSuportadasNoServico;
            let nomeServico;

            // Os proximos 2 bytes é o tipo do serviço
            try {
                tipoServico = buff.readUInt16LE(offsetServicoAtual + 2);

                tracerBuffer.add(`Lendo tipo de serviço número ${servicoIndex}: ${tipoServico} (${numeroToHex(tipoServico, 2)}) no offset ${offsetServicoAtual + 2}`);
            } catch (ex) {
                if (ex instanceof RangeError) {
                    this.#statusComando.erro.descricao = `Erro ao ler buffer do tipo de serviço número ${servicoIndex}. O Buffer não tem range de ${offsetServicoAtual} até ${offsetServicoAtual + 2}, o maximo atual é ${buff.length}`;

                    tracerBuffer.add(`Erro ao ler buffer do tipo de serviço número ${servicoIndex}. O Buffer não tem range de ${offsetServicoAtual} até ${offsetServicoAtual + 2}, o maximo atual é ${buff.length}`);
                } else {
                    this.#statusComando.erro.descricao = `Erro desconhecido ao ler buffer de serviço número ${servicoIndex}. ${ex.message}`;

                    tracerBuffer.add(`Erro desconhecido ao ler buffer de serviço número ${servicoIndex}. ${ex.message}`);
                }

                retoParse.erro.descricao = this.#statusComando.erro.descricao;
                return retoParse;
            }

            // Os proximos 2 bytes é o tamanho em bytes do payload de versão + flags + nome do serviço
            try {
                tamanhoPayload = buff.readUInt16LE(offsetServicoAtual + 4);

                tracerBuffer.add(`Lendo tamanho do payload do serviço número ${servicoIndex}: ${tamanhoPayload} (${numeroToHex(tamanhoPayload, 2)}) no offset ${offsetServicoAtual + 4}`);
            } catch (ex) {
                if (ex instanceof RangeError) {
                    this.#statusComando.erro.descricao = `Erro ao ler buffer do tamanho do payload do serviço número ${servicoIndex}. O Buffer não tem range de ${offsetServicoAtual + 4} até ${offsetServicoAtual + 6}, o maximo atual é ${buff.length}`;

                    tracerBuffer.add(`Erro ao ler buffer do tamanho do payload do serviço número ${servicoIndex}. O Buffer não tem range de ${offsetServicoAtual + 4} até ${offsetServicoAtual + 6}, o maximo atual é ${buff.length}`);
                } else {
                    this.#statusComando.erro.descricao = `Erro desconhecido ao ler buffer do tamanho do payload do serviço número ${servicoIndex}. ${ex.message}`;

                    tracerBuffer.add(`Erro desconhecido ao ler buffer do tamanho do payload do serviço número ${servicoIndex}. ${ex.message}`);
                }

                retoParse.erro.descricao = this.#statusComando.erro.descricao;
                return retoParse;
            }

            // Os proximos 2 bytes é a versão do protocolo de encapsulamento
            try {
                versaoProtocoloEncapsulamento = buff.readUInt16LE(offsetServicoAtual + 6);

                tracerBuffer.add(`Lendo versão do protocolo de encapsulamento do serviço número ${servicoIndex}: ${versaoProtocoloEncapsulamento} (${numeroToHex(versaoProtocoloEncapsulamento, 2)}) no offset ${offsetServicoAtual + 6}`);
            } catch (ex) {
                if (ex instanceof RangeError) {
                    this.#statusComando.erro.descricao = `Erro ao ler buffer da versão do protocolo de encapsulamento do serviço número ${servicoIndex}. O Buffer não tem range de ${offsetServicoAtual + 6} até ${offsetServicoAtual + 8}, o maximo atual é ${buff.length}`;

                    tracerBuffer.add(`Erro ao ler buffer da versão do protocolo de encapsulamento do serviço número ${servicoIndex}. O Buffer não tem range de ${offsetServicoAtual + 6} até ${offsetServicoAtual + 8}, o maximo atual é ${buff.length}`);
                } else {
                    this.#statusComando.erro.descricao = `Erro desconhecido ao ler buffer da versão do protocolo de encapsulamento do serviço número ${servicoIndex}. ${ex.message}`;

                    tracerBuffer.add(`Erro desconhecido ao ler buffer da versão do protocolo de encapsulamento do serviço número ${servicoIndex}. ${ex.message}`);
                }

                retoParse.erro.descricao = this.#statusComando.erro.descricao;
                return retoParse;
            }

            // Os proximos 2 bytes é as flags suportadas pelo serviço
            try {
                flagsSuportadasNoServico = buff.readUInt16LE(offsetServicoAtual + 8);

                tracerBuffer.add(`Lendo flags suportadas pelo serviço número ${servicoIndex}: ${flagsSuportadasNoServico} (${numeroToHex(flagsSuportadasNoServico, 2)}) no offset ${offsetServicoAtual + 8}`);
            } catch (ex) {
                if (ex instanceof RangeError) {
                    this.#statusComando.erro.descricao = `Erro ao ler buffer das flags suportadas pelo serviço número ${servicoIndex}. O Buffer não tem range de ${offsetServicoAtual + 8} até ${offsetServicoAtual + 10}, o maximo atual é ${buff.length}`;

                    tracerBuffer.add(`Erro ao ler buffer das flags suportadas pelo serviço número ${servicoIndex}. O Buffer não tem range de ${offsetServicoAtual + 8} até ${offsetServicoAtual + 10}, o maximo atual é ${buff.length}`);
                } else {
                    this.#statusComando.erro.descricao = `Erro desconhecido ao ler buffer das flags suportadas pelo serviço número ${servicoIndex}. ${ex.message}`;

                    tracerBuffer.add(`Erro desconhecido ao ler buffer das flags suportadas pelo serviço número ${servicoIndex}. ${ex.message}`);
                }

                retoParse.erro.descricao = this.#statusComando.erro.descricao;
                return retoParse;
            }

            // Os proximos 16 bytes é o nome do serviço
            try {
                nomeServico = buff.toString('ascii', offsetServicoAtual + 10, (offsetServicoAtual + 10) + 16);

                tracerBuffer.add(`Lendo nome do serviço número ${servicoIndex}: ${nomeServico} no offset ${offsetServicoAtual + 10}`);
            } catch (ex) {
                if (ex instanceof RangeError) {
                    this.#statusComando.erro.descricao = `Erro ao ler buffer do nome do serviço número ${servicoIndex}. O Buffer não tem range de ${offsetServicoAtual + 10} até ${(offsetServicoAtual + 10) + 16}, o maximo atual é ${buff.length}`;

                    tracerBuffer.add(`Erro ao ler buffer do nome do serviço número ${servicoIndex}. O Buffer não tem range de ${offsetServicoAtual + 10} até ${(offsetServicoAtual + 10) + 16}, o maximo atual é ${buff.length}`);
                } else {
                    this.#statusComando.erro.descricao = `Erro desconhecido ao ler buffer do nome do serviço número ${servicoIndex}. ${ex.message}`;

                    tracerBuffer.add(`Erro desconhecido ao ler buffer do nome do serviço número ${servicoIndex}. ${ex.message}`);
                }

                retoParse.erro.descricao = this.#statusComando.erro.descricao;
                return retoParse;
            }

            // Se todos os bytes estiverem certos, então prossigo pra salvar esse serviço no array e avanço o offset pra pegar os proximos se houver(n sei se tem)

            // Se tiver mais serviços, mover o offset para o proximo serviço
            // Offset do serviço anterior + tamanho do payload dele + 2 bytes do tamanho do payload do serviço atual
            offsetServicoAtual = offsetServicoAtual + tamanhoPayload + 2 + 2;


            novoServ.nome = nomeServico.replace(/[^a-zA-Z0-9]/g, '');
            novoServ.versao_protocolo_encapsulamento = versaoProtocoloEncapsulamento;
            novoServ.codigo_servico = tipoServico;
            novoServ.flags = {
                ...novoServ.flags,
                encapsulamento_cip_via_tcp: (flagsSuportadasNoServico & (1 << 5)) !== 0,
                encapsulamento_cip_via_udp: (flagsSuportadasNoServico & (1 << 8)) !== 0
            }

            servicosEncontrados.push(novoServ);

            tracerBuffer.add(`Serviço ${servicoIndex} parseado com sucesso: ${JSON.stringify(novoServ)}`);
        }

        tracerBuffer.add(`Todos os serviços foram parseados com sucesso. Total de serviços encontrados: ${intServicosExistentes}`);

        // Qualquer erro de verificação de algum serviço deve considerar esse comando como invalido!
        // Após a verificação de todos os serviços e garantir que todos o Buffer seja valido, eu salvo os serviços recebidos.

        this.#campos.contadorTotServicos = intServicosExistentes;
        this.#campos.servicos = servicosEncontrados;

        this.#statusComando.isValido = true;

        retoParse.isSucesso = true;
        return retoParse;
    }

    /**
     * Criar um buffer com os campos do Command Specific Data do List Services
     * @param {Object} parametros - Parametros para setar no Buffer
     */
    criarBuffer() {
        const retornoBuff = {
            /**
             * Se deu pra criar com sucesso o Buffer
            */
            isSucesso: false,
            /**
             * 
             */
            sucesso: {
                buffer: undefined
            },
            /**
             * Detalhes do erro ocorrido
             */
            erro: {
                descricao: ''
            }
        }

        let buffer = Buffer.alloc(0);

        retornoBuff.isSucesso = true;
        retornoBuff.sucesso.buffer = buffer;
        return retornoBuff;
    }

    /**
     * Retorna o total de serviços retornados pelo dispositivo
     */
    getNumeroServicos() {
        return this.#campos.contadorTotServicos;
    }

    /**
     * Retorna todos os serviços que foram retornados pelo dispositivo remoto
     */
    getServicos() {
        return this.#campos.servicos;
    }

    /**
     * Retorna exatamente o serviço de comunicação(codigo 0x100) que descreve se o dispositivo suporta os tipos de comunicações TCP e UDP
     ** Retorna undefined se não for encontrado o serviço de comunicação
     */
    getServicoComunicacao() {
        return this.#campos.servicos.find(servico => servico.codigo_servico == 0x100);
    }
}