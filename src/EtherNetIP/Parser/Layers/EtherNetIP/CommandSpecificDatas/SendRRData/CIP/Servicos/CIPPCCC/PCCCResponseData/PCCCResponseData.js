import { TraceLog } from "../../../../../../../../../Utils/TraceLog.js";
import { hexDeBuffer, numeroToHex } from "../../../../../../../../../Utils/Utils.js";

/**
 * Um Parser para o Buffer que seja do tipo PCCC Response Data
 */
export class PCCCResponseDataParser {

    /**
     * Informações de status do parse do Buffer PCCC Response Data
     */
    #statusBuffer = {
        /**
        * Se o buffer está correto e foi possível extrair todas as informações do layer Response Data PCCC
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
        tracer: undefined,
        /**
         * O Buffer original que foi tentado realizar o Parse
         * @type {Buffer}
         */
        buffer: undefined
    }

    /**
     * Os campos extraidos do Buffer PCCC Response Data
     */
    #campos = {
        /**
         * Campo Responde Code(Não sei exatamente o significado ainda)
         */
        responseCode: undefined,
        /**
         * Detalhes do status da operação solicitada no PCCC
         */
        status: {
            /**
             * Código de status da operação
             * @type {Number}
             */
            codigo: undefined
        },
        /**
         * Numero da transação original enviado (2 bytes).
         * @type {Buffer}
         */
        transactionCode: undefined,
        /**
         * O Buffer que contém os dados retornados da solicitação
         * @type {Buffer}
         */
        bufferFunctionSpecificData: undefined
    }

    /**
     * Instanciar o Parser do PCCC Response Data
     * @param {Buffer} buff - Opcionalmente informa um Buffer para realizar o parse imeditamente
     */
    constructor(buff) {
        if (buff != undefined) this.parseBuffer(buff);

        return this;
    }

    /**
     * Passar um Buffer que contém os detalhes do PCCC Response Data
     * @param {Buffer} buff 
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
            throw new Error(`O buffer passado para o PCCC ResponseData Parser não é um Buffer.`);
        }

        this.#statusBuffer.buffer = buff;

        // Tem que ter pelo menos 4 bytes, que seria o Response Code(1 byte), Status(1 byte) e Transaction Code(2 bytes) + x bytes do Function Specific Response Data
        if (buff.length < 4) {
            this.#statusBuffer.isValido = false;
            this.#statusBuffer.erro.descricao = `O Buffer não contém os 4 bytes mínimos para o PCCC Response Data`;
            retBuff.erro.descricao = this.#statusBuffer.erro.descricao;

            return retBuff;
        }

        const tracerBuffer = retBuff.tracer.addTipo(`PCCC Response Data`);

        tracerBuffer.add(`Iniciando Parser do PCCC Response Data com o Buffer: ${hexDeBuffer(buff)}, ${buff.length} bytes`);

        // Primeiro 1 byte é o Response Code que ainda não sei exatamente o significado
        this.#campos.responseCode = buff.readUInt8(0);
        tracerBuffer.add(`Lendo o Response Code ${this.#campos.responseCode} (${numeroToHex(this.#campos.responseCode, 1)}) no offset 0`);

        // Segundo 1 byte é o Status da operação solicitada
        this.#campos.status.codigo = buff.readUInt8(1);
        tracerBuffer.add(`Lendo o Status Code ${this.#campos.status.codigo} (${numeroToHex(this.#campos.status.codigo, 1)}) no offset 1`);

        let statusRetornado = getPCCCResponseStatus(this.#campos.status.codigo);
        if (statusRetornado != undefined) {
            tracerBuffer.add(`A solicitação retornou o status ${statusRetornado.hex}: ${statusRetornado.descricao}`);
        } else {
            tracerBuffer.add(`A solicitação retornou um status desconhecido: ${numeroToHex(this.#campos.status.codigo, 1)}`);
        }

        // Proximos 2 bytes são o Transaction Code
        this.#campos.transactionCode = buff.subarray(2, 4);

        // Fechou. A partir daqui, é possível que contenha dados adicionais do comando solicitado.
        this.#campos.bufferFunctionSpecificData = buff.subarray(4);
        this.#statusBuffer.isValido = true;
        retBuff.isSucesso = true;
        return retBuff;
    }

    /**
     * Retorna o Transaction Code na solicitação original
     */
    getTransactionCode() {
        return this.#campos.transactionCode.readUInt16LE();
    }

    /**
     * Se disponivel, retornar o Buffer que corresponde ao Function Specific Response Data do comando e função solicitados(Caso ele retorne algo)
     */
    getFunctionSpecificResponseData() {
        return this.#campos.bufferFunctionSpecificData;
    }

    /**
     * Retorna o Response Code retornado foi sucesso. E se não for, retorna o motivo de não ter retornado
     */
    isPCCCSucesso() {
        let retornoStatus = {
            /**
             * Se foi um sucesso a solicitação
             */
            isSucesso: false,
            /**
             * Se não deu sucesso, contém os detalhes do código de erro retornado
             */
            erro: {
                codigo: '',
                descricao: ''
            }
        }

        let codigoStatus = getPCCCResponseStatus(this.#campos.status.codigo);
        if (codigoStatus == undefined) {
            retornoStatus.erro.codigo = numeroToHex(this.#campos.status.codigo, 1);
            retornoStatus.erro.descricao = `Status desconhecido`;
            return retornoStatus;
        }

        if (codigoStatus.hex == PCCCResponseCodes.Success.hex) {
            retornoStatus.isSucesso = true;
        } else {
            retornoStatus.erro.codigo = codigoStatus.hex;
            retornoStatus.erro.descricao = codigoStatus.descricao;
        }

        return retornoStatus;
    }

    /**
     * Retorna o status PCCC da solicitação retornada.
     */
    getStatusPCCC() {
        const retStatus = {
            /**
             * Código de status retornado
             */
            codigo: '',
            /**
             * Descrição do código retornado
             */
            descricao: ''
        }

        let codigoStatus = getPCCCResponseStatus(this.#campos.status.codigo);
        if (codigoStatus == undefined) {
            retStatus.codigo = numeroToHex(this.#campos.status.codigo, 1);
            retStatus.descricao = `Status desconhecido`;
            return retStatus;
        }

        retStatus.codigo = codigoStatus.hex;
        retStatus.descricao = codigoStatus.descricao;

        return retStatus;
    }

    /**
     * Retorna o Buffer original utilizado para dar Parse
     */
    getBufferOriginal() {
        return this.#statusBuffer.buffer;
    }
}

export function getPCCCResponseStatus(codigo) {
    return Object.values(PCCCResponseCodes).find((status) => status.hex == codigo);
}

export const PCCCResponseCodes = {
    Success: {
        hex: 0x00,
        descricao: "Success no error"
    },
    Illegal_Command_Format: {
        hex: 0x10,
        descricao: "Illegal command or format"
    },
    Host_Problem: {
        hex: 0x20,
        descricao: "Host has a problem and will not communicate"
    },
    Remote_Node_Missing: {
        hex: 0x30,
        descricao: "Remote node host is missing, disconnected, or shut down"
    },
    Hardware_Fault: {
        hex: 0x40,
        descricao: "Host could not complete function due to hardware fault"
    },
    Addressing_Problem: {
        hex: 0x50,
        descricao: "Addressing problem or memory protect rungs"
    },
    Command_Protection: {
        hex: 0x60,
        descricao: "Function not allowed due to command protection selection"
    },
    Processor_Program_Mode: {
        hex: 0x70,
        descricao: "Processor is in Program mode"
    },
    Compatibility_Mode: {
        hex: 0x80,
        descricao: "Compatibility mode file missing or communication zone problem"
    },
    Remote_Node_Buffer: {
        hex: 0x90,
        descricao: "Remote node cannot buffer command"
    },
    Wait_ACK_1775KA_Buffer_Full_A0: {
        hex: 0xA0,
        descricao: "Wait ACK (1775-KA buffer full)"
    },
    Remote_Node_Download_Problem: {
        hex: 0xB0,
        descricao: "Remote node problem due to download"
    },
    Wait_ACK_1775KA_Buffer_Full_C0: {
        hex: 0xC0,
        descricao: "Wait ACK (1775-KA buffer full)"
    },
    Not_Used_D0: {
        hex: 0xD0,
        descricao: "Not used"
    },
    Not_Used_E0: {
        hex: 0xE0,
        descricao: "Not used"
    },
    Error_EXT_STS: {
        hex: 0xF0,
        descricao: "Error code in the EXT STS byte"
    }
};