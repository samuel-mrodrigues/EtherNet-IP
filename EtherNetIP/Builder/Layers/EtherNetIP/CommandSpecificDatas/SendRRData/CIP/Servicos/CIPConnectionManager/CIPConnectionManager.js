
//O layer CIP Connection Manager pelo menos para o Unconnected Message é composto dos seguintes campos:
// 1 byte = Priority/Timeout kicks. É o mesmo byte para definir as duas configurações
// Próximos 2 bytes = Embedded Message Request Size: Tamanho em bytes da mensagem CIP encapsulada a seguir nos proximos bytes
// Próximos bytes = CIP Embedded Message Request: Mensagem CIP encapsulada, contendo o comando solicitado (tamanho variado)
// Próximos 1 bytes após CIP Embedded Message Request = Route Path Size: Tamanho em WORDs to RoutePath
// Próximos 1 bytes: Reservado para sempre ser 0x00
// Próximos 2 bytes: ROute Path, destino do dispositivo CIP receber(eu acho, tipo se tiver mais de um dispositivo conectado ao dispositivo remoto, consigo referencia-lo)

import { TraceLog } from "../../../../../../../../Utils/TraceLog.js";
import { hexDeBuffer } from "../../../../../../../../Utils/Utils.js";
import { CIPSendRRDataBuilder } from "../../CIP.js";

/**
 * Esse Layer vem após o layer CIP se o comando CIP utiliza o SendRRData(unconnected message) com a classe solicitada do Connection Manager
 ** Esse layer é composto também pelo Command Specific Data, que é variado dependendo do comando que foi solicitado
 */
export class CIPConnectionManagerBuilder {

    /**
     * Código do serviço do CIP Connection Manager(o 0x52 simboliza Unconnected Messages para o Connection Manager que é uma das unicas formas de se comunicar)
     */
    codigoServico = 0x52;

    #campos = {
        /**
         * A prioridade do comando para Uncounnected Messages sempre deve ser 0 segundo o manual
         * @type {Number}
         */
        priority: undefined,
        /**
         * Timeout kicks? Pelo nome parece ser oq eu penso mas por padrão deixo oq ta no manual que é 0x04
         * @type {Number}
         */
        timeoutTicks: undefined,
        /**
         * Request Path é o caminho do que foi solicitado ao dispositivo. O CIP Connection Manager para Unconnected Messages é sempre a classe 0x06 instancia unica 1
         */
        requestPath: {
            /**
             * @type {Buffer}
             */
            classe: undefined,
            /**
             * @type {Buffer}
             */
            instancia: undefined
        },
        /**
         * Route Path pelo que entendi é o dispositivo que irá receber a solicitação, contendo a porta de origem e o link address?
         */
        routePath: {
            /**
             * O tipo do Route Path definido, pode 0x00 é via porta(Port Segment)
             * @type {Number}
             */
            tipoSegmento: undefined,
            /**
             * Não sei oq é, mas ta no Wireshark
             * @type {Number}
             */
            isLinkAddressExtendido: false,
            /**
             * Se tipo correspoder ao Port Segment, esse campo é o endereço da porta
             * @type {Number}
             */
            porta: undefined,
            /**
             * No Wireshark aparece como 0, no momento não vou mexer também
             * @type {Boolean}
             */
            linkAddress: undefined,
        },
        /**
         * Algum campo padrão que sempre precisa estar presente, também não sei o motivo ainda
         */
        reserved: undefined,
        /**
         * Corresponde ao CIP Embedded Message Request, no caso do comando SendRRData para Uncounnected Messages, contém a solicitação do que foi pedido ao dispositivo, por exemplo, leitura de uma tag, informações de identidade ou outras classes, é dinamico.
         */
        CIPEmbeddedMessage: {
            /**
             * O pacote CIP contém o serviço solicitado ao dispositivo
             * @type {CIPSendRRDataBuilder}
             */
            CIPServicoSolicitado: undefined
        }
    }

    /**
     * Instanciar o layer CIP Connection Manager
     * @param {Object} parametros - Parametros iniciais do comando CIP Connection Manager
     * @param {Number} parametros.priority - A prioridade do comando
     * @param {Number} parametros.timeoutTicks - O timeout ticks do CIP Connection Manager
     * @param {Number} parametros.routePath - O Route Path do CIP Connection Manager
     * @param {Number} parametros.reserved - O campo reservado do CIP Connection Manager
     */
    constructor(parametros) {

        const valoresPadroes = {
            reservrd: () => {
                this.#campos.reserved = 0x00;
            },
            priority: () => {
                this.#campos.priority = 0x04;
            },
            timeoutTicks: () => {
                this.#campos.timeoutTicks = 125;
            },
            routePath: (isLinkExtendido, linkadress, tiposeg, porta) => {
                if (isLinkExtendido) {
                    this.#campos.routePath.isLinkAddressExtendido = false;
                }

                if (linkadress) {
                    this.#campos.routePath.linkAddress = 0x00;
                }

                if (tiposeg) {
                    this.#campos.routePath.tipoSegmento = 0b000;
                }

                if (porta) {
                    this.#campos.routePath.porta = 0b0001;
                }
            },
            requestPath: (classe, instancia) => {
                if (classe) {
                    this.#campos.requestPath.classe = Buffer.from([0x20, 0x06]);
                }

                if (instancia) {
                    this.#campos.requestPath.instancia = Buffer.from([0x24, 0x01])
                }
            }
        }

        if (parametros != undefined && typeof parametros == 'object') {

            if (parametros.priority != undefined) this.setPriority(parametros.priority);
            if (parametros.timeoutTicks != undefined) this.setTimeoutTicks(parametros.timeoutTicks);
            if (parametros.routePath != undefined) this.setRoutePath(parametros.routePath);

        }

        // Configurar os campos padrão se não foi definido qual vai ser
        if (this.#campos.priority == undefined) valoresPadroes.priority();
        if (this.#campos.timeoutTicks == undefined) valoresPadroes.timeoutTicks();
        if (this.#campos.reserved == undefined) valoresPadroes.reservrd();


        if (this.#campos.routePath != undefined && typeof this.#campos.routePath == 'object') {
            if (this.#campos.routePath.isLinkAddressExtendido == undefined) valoresPadroes.routePath(true);
            if (this.#campos.routePath.linkAddress == undefined) valoresPadroes.routePath(false, true);
            if (this.#campos.routePath.tipoSegmento == undefined) valoresPadroes.routePath(false, false, true);
            if (this.#campos.routePath.porta == undefined) valoresPadroes.routePath(false, false, false, true);
        }

        // Definir o Request Path padrão se não foi definido
        if (this.#campos.requestPath.classe == undefined) valoresPadroes.requestPath(true);
        if (this.#campos.requestPath.instancia == undefined) valoresPadroes.requestPath(false, true);

        return this;
    }

    /**
     * Seta a prioridade do comando
     ** 00 = Low Priority
     ** 01 = High Priority
     ** 10 = Scheduled
     ** 11 = Urgent 
     ** Ainda não fui afundo pra entender as diferenças apesar do nome obvio, mas por padrão usar o 0 que funciona
     * @param {Number} priority 
     */
    setPriority(priority) {
        if (priority == undefined) throw new Error(`[CIPConnectionManagerBuilder] O campo priority é obrigatório`);

        if (typeof priority != 'number') throw new Error(`[CIPConnectionManagerBuilder] O campo priority deve ser um número`);

        this.#campos.priority = priority;
    }

    /**
     * Seta o campo "timeout ticks" do CIP Connection Manager. Pelo manual, o valor padrão recomendado é 0x04.
     ** Também não fui afundo pra entender o que exatamente é esse campo, mas parece que é algo com o tempo maximo que o dispositivo remoto vai precisar responder, se não conseguir ele retornará erro.
     */
    setTimeoutTicks(numero) {
        if (numero == undefined) throw new Error(`[CIPConnectionManagerBuilder] O campo timeoutTicks é obrigatório`);

        if (typeof numero != 'number') throw new Error(`[CIPConnectionManagerBuilder] O campo timeoutTicks deve ser um número`);

        this.#campos.timeoutTicks = numero;
    }

    setRoutePath(routePath) {

        this.#campos.routePath = routePath;
    }

    /**
     * Cria e instancia o serviço que será solicitado ao dispositivo remoto. Esse serviço pode ser pra ler tags, informações e qualquer outra classe que o dispositivo remoto suportar
     */
    getCIPMessage() {
        let novoCIP = new CIPSendRRDataBuilder();

        this.#campos.CIPEmbeddedMessage.CIPServicoSolicitado = novoCIP;
        return novoCIP;
    }

    /**
     * Criar o buffer do CIP Connection Manager
     */
    criarBuffer() {
        const retBuff = {
            isSucesso: false,
            sucesso: {
                /**
                 * O Buffer com os dados do CIP Connection Manager
                 * @type {Buffer}
                 */
                buffer: undefined
            },
            erro: {
                descricao: ''
            },
            /**
             * O tracer de logs contém as etapas da geração do buffer.
             * @type {TraceLog}
             */
            tracer: new TraceLog()
        }

        const tracerBuffer = retBuff.tracer.addTipo(`CIP ConnectionManagerBuilder`);

        tracerBuffer.addLog(`Iniciando a criação do buffer do CIP Connection Manager`);

        // Alocar 6 bytes pro cabeçalho do serviço CIP Connection Manager
        const bufferCabecalho = Buffer.alloc(6);

        tracerBuffer.add(`Criando um Buffer de ${bufferCabecalho.length} bytes para o cabeçalho do CIP Connection Manager`);

        // Primeiro 1 byte é oodigo do serviço
        bufferCabecalho.writeUInt8(this.codigoServico, 0);
        tracerBuffer.add(`Setando o campo codigo de serviço para ${this.codigoServico} no offset 0`);

        const tamanhoRequestPath = Math.ceil((this.#campos.requestPath.classe.length + this.#campos.requestPath.instancia.length) / 2)
        // Próximo 1 byte é o tamanho do Request Path(nesse caso é o Connection Manager)
        bufferCabecalho.writeUInt8(tamanhoRequestPath, 1);
        tracerBuffer.add(`Setando o tamanho do Request Path para ${tamanhoRequestPath} WORDs no offset 1`);

        // Próximos 4 bytes o Request Path do Connection Manager
        // 2 Bytes da Classe
        this.#campos.requestPath.classe.copy(bufferCabecalho, 2);
        tracerBuffer.add(`Setando a classe do Request Path para ${hexDeBuffer(this.#campos.requestPath.classe)} no offset 2`);

        // 2 Bytes da Instancia
        this.#campos.requestPath.instancia.copy(bufferCabecalho, 4);
        tracerBuffer.add(`Setando a instancia do Request Path para ${hexDeBuffer(this.#campos.requestPath.instancia)} no offset 4`);

        tracerBuffer.add(`Buffer de cabeçalho gerado com sucesso: ${hexDeBuffer(bufferCabecalho)}`);

        tracerBuffer.add(`Iniciando a criação do buffer do CIP Embedded Message Request`);
        // Gerar o Buffer do CIP Embedded Message Request
        let gerarBufferCIPEmbbed = this.#campos.CIPEmbeddedMessage.CIPServicoSolicitado.criarBuffer();
        if (!gerarBufferCIPEmbbed.isSucesso) {
            retBuff.erro.descricao = `[CIPConnectionManagerBuilder] Erro ao gerar o buffer do CIP Embedded Message Request: ${gerarBufferCIPEmbbed.erro.descricao}`;

            tracerBuffer.add(`Erro ao gerar o buffer do CIP Embedded Message Request: ${gerarBufferCIPEmbbed.erro.descricao}`);
            return retBuff;
        }

        let offsetPayloadCIPEmbedded = gerarBufferCIPEmbbed.sucesso.buffer.length;
        tracerBuffer.add(`Buffer do CIP Embedded Message Request gerado com sucesso: ${hexDeBuffer(gerarBufferCIPEmbbed.sucesso.buffer)}, total de ${offsetPayloadCIPEmbedded} bytes`);

        // Criar um buffer com o tamanho necessario pra caber o cabeaçho do CIP Connection Manager e o CIP Embedded Message Request
        // 1 Byte pro Priority, 1 Bytes pro timeout, 2 Bytes pro tamanho do CIP Embedded Message Request, x Bytes é o CIP Embedded Message Request, 1 Byte pro tamanho do Route Path, 1 Byte reservado, 2 Bytes pro Route Path
        // Então fica 1 + 1 + 2 + x + 1 + 1 + 2 = 8 + x bytes necessarios
        const buff = Buffer.alloc(8 + gerarBufferCIPEmbbed.sucesso.buffer.length);
        tracerBuffer.add(`Criando um Buffer de ${buff.length} bytes para o CIP Connection Manager`);

        // O 1 byte é o Priority/Timeout Kicks
        buff.writeUInt8(this.#campos.priority, 0);
        tracerBuffer.add(`Setando o campo Priority para ${this.#campos.priority} no offset 0`);

        // Proximo 1 byte é o timeout ticks
        buff.writeUInt8(this.#campos.timeoutTicks, 1);
        tracerBuffer.add(`Setando o campo Timeout Ticks para ${this.#campos.timeoutTicks} no offset 1`);

        // Proximos 2 bytes é o tamanho do CIP Embedded Message Request do serviço solicitado
        buff.writeUInt16LE(offsetPayloadCIPEmbedded, 2);
        tracerBuffer.add(`Setando o tamanho do CIP Embedded Message Request para ${offsetPayloadCIPEmbedded} bytes no offset 2`);

        // Adicionar os bytes do buffer do CIP Embedded Message Request ao buffer principal
        gerarBufferCIPEmbbed.sucesso.buffer.copy(buff, 4);
        tracerBuffer.add(`Copiando o buffer do CIP Embedded Message Request gerado ao Buffer principal no offset 4`);

        // Route path é compost por (3 bits indicam o tipo do segmento, 4 bit é se é um link address extendido, 4 bits finais é a porta)
        let routePath = (this.#campos.routePath.tipoSegmento << 5) | (this.#campos.routePath.isLinkAddressExtendido << 4) | this.#campos.routePath.porta;

        let tamanhoWordsRoutePath = Math.ceil((Buffer.from([routePath]).length) / 2)
        // Os próximos 1 bytes é o total de WORDs contido no Route Path
        buff.writeUInt8(tamanhoWordsRoutePath, 4 + offsetPayloadCIPEmbedded);
        tracerBuffer.add(`Setando o tamanho do Route Path para ${tamanhoWordsRoutePath} WORDs no offset ${4 + offsetPayloadCIPEmbedded}`);

        // O próximo 1 byte é o reservado que sempre é 0x00 segundo o manual
        buff.writeUInt8(this.#campos.reserved, 5 + offsetPayloadCIPEmbedded);
        tracerBuffer.add(`Setando o campo reservado para ${this.#campos.reserved} no offset ${5 + offsetPayloadCIPEmbedded}`);

        // Os próximos 2 bytes são o Route Path que sempre é Port (0x01): Backplane, Address (0x00)(no meu caso simples por enquanto é)
        buff.writeUInt8(routePath, 6 + offsetPayloadCIPEmbedded);
        tracerBuffer.add(`Setando o campo Route Path para ${routePath} no offset ${6 + offsetPayloadCIPEmbedded}`);

        buff.writeUInt8(this.#campos.routePath.linkAddress, 7 + offsetPayloadCIPEmbedded);
        tracerBuffer.add(`Setando o campo Link Address para ${this.#campos.routePath.linkAddress} no offset ${7 + offsetPayloadCIPEmbedded}`);
        tracerBuffer.add(`Buffer do CIP Connection Manager gerado com sucesso: ${hexDeBuffer(buff)}, total de ${buff.length} bytes`);

        // Adicionar também o cabeçalho do CIP Connection Manager (Service, Request Path Size e Request Path) ao buffer final
        const bufferFinal = Buffer.concat([bufferCabecalho, buff]);

        tracerBuffer.add(`Buffer completo do cabeçalho + CIP Embedded Message Request gerado com sucesso: ${hexDeBuffer(bufferFinal)}, total de ${bufferFinal.length} bytes`);

        retBuff.isSucesso = true;
        retBuff.sucesso.buffer = bufferFinal;
        return retBuff;
    }
}