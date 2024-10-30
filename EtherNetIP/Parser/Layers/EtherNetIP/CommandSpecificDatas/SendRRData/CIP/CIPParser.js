import { Servicos, getService } from "../../../../../../Utils/CIPServices.js";

import { SingleServicePacketParser } from "./Servicos/SingleServicePacket.js"

/**
 * O CIP Parser é responsavél por dar parse no layer CIP
 */
export class CIPSendRRDataParser {

    /**
     * Detalhes se esse Layer CIP é valido
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
        }
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
         * Buffer do código de status recebido
         * @type {Number}
         */
        status: undefined,
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
            }
        }

        // O buffer precisa no minimo 3 bytes para ser um CIP válido
        if (buff.length < 3) {
            this.#statusCIP.isValido = false;

            this.#statusCIP.erro.descricao = 'O buffer não contém dados suficientes para ser um CIP válido';

            retornoBuffer.erro.descricao = this.#statusCIP.erro.descricao;
            return retornoBuffer;
        }

        // O primeiro byte contém o código do serviço solicitado no CIP
        const codigoService = buff.readUInt8(0);

        // Proximos 2 bytes contém o status principal da solicitação CIP
        const statusService = buff.readUint16LE(1);

        this.#campos.codigoServico = codigoService
        this.#campos.status = statusService;

        // Pega todos os bytes restantes do buffer que contém os dados do serviço solicitado
        const bufferServicoDados = buff.subarray(4);

        // Salvar os bytes do serviço recebido
        this.#campos.bufferPacketdata = bufferServicoDados;

        retornoBuffer.isSucesso = true;
        return retornoBuffer;
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
            return new SingleServicePacketParser(this.#campos.status);
        }
    }
}

export const CIPGeneralStatusCodes = {
    Sucesso: {
        hex: 0x00,
        descricao: 'Sucesso'
    },
    
}