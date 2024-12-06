import { CIPGeneralStatusCodes, getStatusCode } from "../../../../../../../../Utils/CIPRespondeCodes.js";
import { TraceLog } from "../../../../../../../../Utils/TraceLog.js"
import { hexDeBuffer } from "../../../../../../../../Utils/Utils.js";
import { PCCCResponseDataParser } from "./PCCCResponseData/PCCCResponseData.js";

/**
 * O CIP PCCC Parser é responsavél por dar parse em um Buffer que seja um layer CIP PCCC
 */
export class CIPPCCCParser {

    /**
     * Informações de status do parse do CIP PCCC
     */
    #statusPCCC = {
        /**
        * Se o buffer está correto e foi possível extrair todas as informações do layer CIP PCCC.
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
     * Campos que fazem parte do layer CIP PCCC
     */
    #campos = {
        /**
         * Código do serviço recebido no CIP
         * @type {Number}
         */
        codigoServico: undefined,
        /**
         * Informações do status da solicitação CIP. Esse status é que fica no layer CIP logo após o CIP PCCC
         */
        status: {
            /**
             * O código de status CIP
             * @type {Number}
             */
            codigo: undefined,
            /**
             * Opcionalmente, um additional status é retornado nos casos em que a solicitação não foi bem sucedida.
             * @type {Buffer}
             */
            additionalStatus: undefined
        },
        /**
         * Informações do Requestor que foi enviado na solicitação inicial
         */
        requestor: {
            /**
             * Requestor ID Length (1 byte)
             * @type {Number}
             */
            length: undefined,
            /**
             * CIP Vendor ID (2 bytes)
             * @type {Buffer}
             */
            CIPVendorID: undefined,
            /**
             * CIP Serial Number (4 bytes)
             * @type {Buffer}
             */
            CIPSerialNumber: undefined
        },
        /**
         * Informações do PCCC Response Data recebido
         * @type {Buffer}
         */
        responseData: undefined
    }

    /**
     * Instanciar o Parser do layer CIP PCCC
     * @param {Buffer} buff - Opcionalmente informa um Buffer para realizar o parse imeditamente
     */
    constructor(buff) {
        if (buff != undefined) this.parseBuffer(buff);
    }

    /**
     * Retorna o Parser PCCC Response Data com as informações recebidas
     */
    getPCCCResponseData() {
        return new PCCCResponseDataParser(this.#campos.responseData);
    }

    /**
     * Passar um Buffer com dados do layer CIP PCCC para dar parse
     * @param {Buffer} buff - Buffer com os dados do layer CIP PCCC
     */
    parseBuffer(buff) {
        const retBuff = {
            /**
             * Se deu certo em dar parse nesse layer CIP PCCC
             */
            isSucesso: false,
            erro: {
                descricao: ''
            },
            /**
             * Detalhes do parse do buffer
             */
            tracer: new TraceLog()
        }

        if (!Buffer.isBuffer(buff)) {
            throw new Error(`O buffer passado para o CIP PCCC Parser não é um Buffer.`);
        }

        const tracerBuffer = retBuff.tracer.addTipo(`CIP PCCC Parser`);

        tracerBuffer.add(`Iniciando Parser do CIP PCCC com o Buffer: ${hexDeBuffer(buff)}, ${buff.length} bytes`);

        // Pelo menos uns 5 bytes tem que ter
        if (buff.length < 5) {

            tracerBuffer.add(`O buffer passado para o CIP PCCC Parser não tem o minimo de 5 bytes. Tamanho do buffer: ${buff.length} bytes.`);
            this.#statusPCCC.erro.descricao = `O buffer passado para o CIP PCCC Parser não tem o minimo de 5 bytes. Tamanho do buffer: ${buff.length} bytes.`;

            retBuff.erro.descricao = this.#statusPCCC.erro.descricao;
            return retBuff;
        }

        // O código de serviço é o 1 byte
        const codigoServico = buff.readUInt8(0);
        tracerBuffer.add(`Lendo o campo de código de serviço do CIP PCCC: ${codigoServico}.`);

        // Próximo 1 byte é o código de status da solicitação CIP
        const codigoStatus = buff.readUInt8(1);
        this.#campos.status.codigo = codigoStatus;

        const detalhesStatus = getStatusCode(codigoStatus);
        if (detalhesStatus != undefined) {
            tracerBuffer.add(`Lendo o campo de código de status do CIP PCCC: ${codigoStatus} - ${detalhesStatus.descricao}.`);
        } else {
            tracerBuffer.add(`Lendo o campo de código de status do CIP PCCC: ${codigoStatus}. - Status Desconhecido.`);
        }

        // Próximo 1 byte é o additional status size em WORDS
        let additionalStatusEmWords = buff.readUInt8(2);

        // A partir de qual offset começa o PCCC Data
        let offsetPCCCData = 0;

        // Se o tamanho em Words do Additional Status for maior que 0, então tem mais dados depois do status
        if (additionalStatusEmWords > 0) {
            let additionalStatusBuffer = buff.subarray(3, 5);
            this.#campos.status.additionalStatus = additionalStatusBuffer;

            tracerBuffer.add(`Lendo o campo de additional status do CIP PCCC: ${hexDeBuffer(additionalStatusBuffer)}.`);

            offsetPCCCData = 5;
        } else {
            offsetPCCCData = 4;
        }
        // --------------------------

        // O Buffer do Requestor que tem os detalhes de quem enviou a requisição. No caso como foi essa propria biblioteca, os valores sempre serão os padrões
        const bufferRequestorInfo = buff.subarray(offsetPCCCData, offsetPCCCData + 7);
        if (bufferRequestorInfo.length != 7) {  

            tracerBuffer.add(`O buffer de Requestor Info não tem 7 bytes. Tamanho do buffer: ${bufferRequestorInfo.length} bytes.`);
            this.#statusPCCC.erro.descricao = `O buffer de Requestor Info não tem 7 bytes. Tamanho do buffer: ${bufferRequestorInfo.length} bytes.`;

            retBuff.erro.descricao = this.#statusPCCC.erro.descricao;
            return retBuff;
        }

        // 1 Byte é o tamanho do Requestor ID
        this.#campos.requestor.length = bufferRequestorInfo.readUInt8(0);

        // 2 Bytes é o CIP Vendor ID
        this.#campos.requestor.CIPVendorID = bufferRequestorInfo.subarray(1, 3);

        // 4 Bytes é o CIP Serial Number
        this.#campos.requestor.CIPSerialNumber = bufferRequestorInfo.subarray(3, 7);

        // Os próximos bytes são o PCCC Response Data
        const bufferPCCCData = buff.subarray(offsetPCCCData + 7);
        this.#campos.responseData = bufferPCCCData;

        tracerBuffer.add(`Lendo o campo de PCCC Response Data do CIP PCCC: ${hexDeBuffer(bufferPCCCData)}, ${bufferPCCCData.length} bytes.`);

        tracerBuffer.add(`Finalizando o parse do CIP PCCC.`);

        this.#statusPCCC.isValido = true;

        retBuff.isSucesso = true;
        return retBuff;
    }

    /**
     * Retorna se esse SingleServicePacket é valido, ou seja todos os campos foram corretamente parseados do Buffer.
     */
    isValido() {
        const retValido = {
            isValido: false,
            erro: {
                descricao: ''
            },
            /**
             * Detalhes do processamento do Buffer para debug
             * @type {TraceLog}
             */
            tracer: undefined
        }

        retValido.tracer = this.#statusPCCC.tracer;

        if (this.#statusPCCC.isValido) {
            retValido.isValido = true
        } else {
            retValido.erro.descricao = this.#statusPCCC.erro.descricao;
        }

        return retValido;
    }

    /**
     * Retorna se a operação no layer CIP PCCC retornou sucesso. Não é o status de sucesso do CIP PCCC e sim o status do CIP mesmo.
     */
    isStatusSucesso() {
        let retSucesso = {
            /**
             * Retorna se o layer CIP foi executado com sucesso
             */
            isSucesso: false,
            erro: {
                descricao: '',
                codigoStatus: '',
                descricaoStatus: ''
            }
        }

        const statusAtual = this.getStatus();
        if (statusAtual.codigoStatus == CIPGeneralStatusCodes.Success.hex) {
            retSucesso.isSucesso = true;
        } else {
            retSucesso.erro.descricao = `O status do serviço solicitado não foi bem sucedido. Código de status: ${statusAtual.codigoStatus} - ${statusAtual.descricaoStatus}`;

            retSucesso.erro.codigoStatus = statusAtual.codigoStatus;
            retSucesso.erro.descricaoStatus = statusAtual.descricaoStatus;
        }

        return retSucesso;
    }

    /**
     * Retorna o status atual ocorrido nesse serviço solicitado.
     */
    getStatus() {
        let retornoCodigo = {
            /**
             * Código de status do serviço solicitado
             */
            codigoStatus: this.#campos.status.codigo,
            /**
             * O additional status code de 2 bytes, que pode ser undefined ou não dependendo do código de status
             */
            additionalStatusCode: {
                buffer: this.#campos.status.additionalStatus,
            },
            /**
             * Descrição do código de status do serviço solicitado
             */
            descricaoStatus: ''
        }

        let status = getStatusCode(this.#campos.codigoStatus);
        if (status != undefined) {
            retornoCodigo.descricaoStatus = status.descricao;
        } else {
            retornoCodigo.descricaoStatus = `Código de status do Single Service Packet recebido: '${this.#campos.codigoStatus}' não é um código de status válido. `;
        }

        return retornoCodigo;
    }

    /**
     * Retorna as informações do Requestor ID retornados
     */
    getRequestor() {    
        const retRequestor = {
            /**
             * Tamanho do Requestor ID
             */
            length: undefined,
            /**
             * CIP Vendor ID
             */
            CIPVendorID: undefined,
            /**
             * CIP Serial Number
             */
            CIPSerialNumber: undefined
        }

        retRequestor.length = this.#campos.requestor.length;
        retRequestor.CIPVendorID = this.#campos.requestor.CIPVendorID.readUInt16LE();
        retRequestor.CIPSerialNumber = this.#campos.requestor.CIPSerialNumber.readUInt32LE();

        return retRequestor;
    }
}