import { Servicos, getService } from "../../../../../../Utils/CIPServices.js";

import { SingleServicePacketParser } from "./Servicos/SingleServicePacket.js";
import { MultipleServicePacketParser } from "./Servicos/MultipleServicePacket.js";
import { TraceLog } from "../../../../../../Utils/TraceLog.js";
import { hexDeBuffer, numeroToHex } from "../../../../../../Utils/Utils.js";

/**
 * O CIP Parser é responsavél por dar parse no layer CIP
 */
export class CIPSendRRDataParser {

    /**
     * Detalhes se esse Layer CIP é valido
     ** Esse campo indica se os bytes recebidos são validos e encaixam com o que é esperado. Mensagens de buffers retornadas com erro devido ao mau uso da classe ainda são consideradas válidas. Esse campo apenas indica se
     houver algum erro ao dar parse no buffer.
     */
    #statusCIP = {
        /**
         * Se o buffer está correto e foi retornado o codigo de status realizado com sucesso.
         */
        isValido: false,
        /**
         * Detalhes do erro ocorrido.
         */
        erro: {
            descricao: ''
        },
        /**
         * O tracer contém detalhes do parse do Buffer, util pra debugar.
         * @type {TraceLog}
         */
        tracer: undefined
    }

    /**
     * Status de campos recebidos
     */
    #campos = {
        /**
         * Código do servio do CIP
         * @type {Number}
         */
        codigoServico: undefined,
        /**
         * Buffer contendo os dados do serviço solicitado
         */
        bufferPacketdata: undefined
    }

    /**
     * Instanciar o parser
     * @param {Buffer} buff - Buffer com os dados do layer CIP para dar parse
     */
    constructor(buff) {
        if (buff != undefined) this.parseBuffer(buff);
    }

    /**
     * Passar um Buffer com dados do layer CIP para dar parse
     * @param {Buffer} buff - Buffer com os dados do layer CIP
     */
    parseBuffer(buff) {
        const retornoBuffer = {
            /**
             * Se deu certo em dar parse nesse layer CIP
             */
            isSucesso: false,
            erro: {
                descricao: ''
            },
            /**
             * Tracer com detalhes do parse do buffer
             */
            tracer: new TraceLog()
        }

        this.#statusCIP.tracer = retornoBuffer.tracer;

        const tracerBuffer = retornoBuffer.tracer.addTipo(`CIP Parser`);

        tracerBuffer.add(`Iniciando parser de CIP para o Buffer: ${hexDeBuffer(buff)}, ${buff.length} bytes`);

        // O buffer precisa no minimo 3 bytes para ser um CIP válido
        if (buff.length < 3) {
            this.#statusCIP.isValido = false;
            this.#statusCIP.erro.descricao = `O buffer não contém ao minimo 3 bytes de dados suficientes para ser um CIP válido. Ele tem apenas ${buff.length} bytes`;

            retornoBuffer.erro.descricao = this.#statusCIP.erro.descricao;

            tracerBuffer.add(`O Buffer era esperado ter ao menos 3 bytes, mas tem apenas ${buff.length} bytes.`);
            return retornoBuffer;
        }

        // O primeiro byte contém o código do serviço solicitado no CIP

        // Pego os 7 bits menos significativos que indicam o código do serviço, pois o 1 bit indica se é requisição(0) ou resposta(1)
        const codigoService = buff.readUInt8(0) & 0x7F;
        this.#campos.codigoServico = codigoService;

        const tipoServicoSolicitado = getService(codigoService);

        tracerBuffer.add(`Lendo o código de serviço solicitado: ${codigoService} (${numeroToHex(codigoService, 1)}) - ${tipoServicoSolicitado != undefined? tipoServicoSolicitado.descricao : 'Serviço desconhecido'})`);

        // Pega todos os bytes restantes do buffer que contém os dados do serviço solicitado
        const bufferServicoDados = buff.subarray(2);

        tracerBuffer.add(`Buffer de dados relacionado ao serviço específico: ${hexDeBuffer(bufferServicoDados)}, ${bufferServicoDados.length} bytes`);

        // Salvar os bytes do serviço recebido
        this.#campos.bufferPacketdata = bufferServicoDados;

        retornoBuffer.isSucesso = true;

        tracerBuffer.add(`Parser de CIP finalizado!`);
        return retornoBuffer;
    }

    /**
     * Retorna se esse CIP encapsulado é valido, ou seja todos os campos foram corretamente parseados do Buffer.
     */
    isValido() {
        const retValido = {
            isValido: false,
            erro: {
                descricao: ''
            },
            /**
             * Tracer com detalhes do parse do buffer
             */
            tracer: undefined
        }

        retValido.tracer = this.#statusCIP.tracer;

        if (this.#statusCIP.isValido) {
            retValido.isValido = true;
        } else {
            retValido.erro.descricao = this.#statusCIP.erro.descricao;
        }
        return retValido;
    }

    /**
     * Retorna se o comando recebido corresponde ao serviço de Single Service Packet
     */
    isSingleServicePacket() {
        return this.#campos.codigoServico == Servicos.SingleServicePacket.hex;
    }

    /**
     * Retorna o serviço como SingleServicePacket
     */
    getAsSingleServicePacket() {
        if (this.isSingleServicePacket()) {
            return new SingleServicePacketParser(this.#campos.bufferPacketdata);
        }
    }

    /**
     * Retorna se o comando recebido corresponde ao serviço de Multiple Service Packet
     */
    isMultipleServicePacket() {
        return this.#campos.codigoServico == Servicos.MultipleServicePacket.hex;
    }

    /**
     * Retorna o serviço como MultipleServicePacket
     */
    getAsMultipleServicePacket() {
        if (this.isMultipleServicePacket()) {
            return new MultipleServicePacketParser(this.#campos.bufferPacketdata);
        }
    }
}