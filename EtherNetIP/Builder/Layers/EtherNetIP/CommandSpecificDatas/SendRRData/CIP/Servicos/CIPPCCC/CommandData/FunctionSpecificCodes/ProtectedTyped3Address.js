import { TraceLog } from "../../../../../../../../../../Utils/TraceLog.js";
import { hexDeBuffer, numeroToHex } from "../../../../../../../../../../Utils/Utils.js";

/**
 * Um builder para o código de função para interagir com endereços lógicos
 */
export class ProtectedTyped3AddressBuilder {

    /**
     * Instanciar o builder
     */
    constructor() {
        return this;
    }

    /**
     * Campos configuravéis para gerar o Buffer do Function Specific Data
     */
    #campos = {
        /**
         * **Documentação do DF1: The size of data to be read (in bytes), not including the address fields or other overhead bytes.**
         * 
         * A partir de quantos bytes em multiplo de 0x02 será retornado. 
         * 
         * 
         * A partir do elementNumber, ele ira retornar x endereços pra cada 0x02 bytes no byteSize. 
         * 
         * - Exemplo 1: elementNumber como 3(N7:3 por exemplo) e se byteSize for 0x02,(2), irá retornar somente o N7:3.
         * 
         * - Exemplo 2: elementNumber como 3(N7:3 por exemplo) e se byteSize for 0x04,(4), irá retornar N7:3 e N7:4.
         * @type {Number}
         */
        byteSize: undefined,
        /**
         * **Documentação do DF1: Addresses files 0-254 only. For higher addresses, setting this
byte to FF expands this field to three bytes total. Use the
second and third bytes for the expanded file address (low
address byte first)**.
         *
         * Indica de qual data file será buscado o endereço. Cada número representa um dos tipos de data, tipo 7 representa os N7:1, N7:2 que são numeros Int, pros outros é parecido mas sei lá n lembro como sao os outros datafiles
         * @type {Buffer}
         */
        fileNumber: undefined,
        /**
         * **Documentação do DF1: Use one of the these values for this field. Do not use any other values; doing so may result in unpredictable results.**
         * 
         * Indica o tipo do File Number solicitado. Segundo o manual, é obrigatorio setar para um dos valores pre existentes que são:
         * 
         * - 80-83 hex: reserved
         * - 84 hex: status
         * - 85 hex: bit
         * - 86 hex: timer
         * - 87 hex: counter
         * - 88 hex: control
         * - 89 hex: integer
         * - 8A hex: floating point
         * - 8B hex: output logical by slot
         * - 8C hex: input logical by slot
         * - 8D hex: string
         * - 8E hex: ASCII
         * - 8F hex: BCD
         * 
         */
        fileType: undefined,
        /**
         * **Documentação do DF1: Addresses elements 0-254 only. For higher addresses, setting
this byte to FF expands this field to three bytes. Use the second
and third bytes for the expanded element address (low address
byte first).**
         *
         * Indica o número da posição inicial da leitura. Exemplo, se for 3, irá ler a partir do N7:3 até o sizeByte
         * @type {Buffer}
         */
        elementNumber: undefined,
        /**
         * **Documentação do DF1: Addresses sub-elements 0-254 only. For higher addresses,
setting this byte to FF expands this field to three bytes. Use the
second and third bytes for the expanded sub-element address
(low address byte first).**
         * 
         * NÂO SEI AINDA(Deve ser algo de array '-')
         * @type {Buffer}
         */
        subElementNumber: undefined,
        /**
         * Se for um Read, o data não precisa ser enviado. Se for um Write, deve conter os dados a serem escritos
         * @type {Buffer}
         */
        data: undefined
    }

    /**
     * Seta o campo Byte Size, que seria a quantidade de endereços que serão interagidos a partir do Element Number
     *
     * **Documentação do DF1: The size of data to be read (in bytes), not including the address fields or other overhead bytes.**
     * @param {Number} byteSize 
     */
    setByteSize(byteSize) {
        if (isNaN(byteSize)) throw new Error(`O byteSize deve ser um número`);

        this.#campos.byteSize = byteSize;
    }

    /**
     * Seta o numero que identifica o data file solicitado. Tipo N7:1 solicita o data file number 7
     * @param {Buffer} fileNumber 
     */
    setFileNumber(fileNumber) {
        if (!Buffer.isBuffer(fileNumber)) throw new Error(`O fileNumber deve ser um Buffer com o número do data file solicitado`);

        this.#campos.fileNumber = fileNumber;
    }

    /**
     * Seta o tipo do file number solicitado correspondete ao File Number
     * @param {Number | keyof FileTypes} fileType - Numero do file type ou String do file type desejado
     */
    setFileType(fileType) {

        let tipoDefinido;
        if (isNaN(fileType)) {
            tipoDefinido = FileTypes[fileType];

            if (tipoDefinido == undefined) throw new Error(`O fileType pelo tipo String '${fileType}' não é um fileType válido. Tipos válidos: ${Object.keys(FileTypes).join(', ')}`);
        } else {
            tipoDefinido = (Object.values(FileTypes).find(x => x.hex == fileType));

            if (tipoDefinido == undefined) throw new Error(`O fileType pelo número ${fileType} não é um fileType válido. Tipos válidos: ${Object.values(FileTypes).map(x => `${x.descricao}: ${x.hex}`).join(', ')}`);
        }

        this.#campos.fileType = tipoDefinido.hex;

    }

    /**
     * Seta o index do número do elemento que será interagido, tipo N7:0, 0 seria o elemento
     * @param {Buffer} elementNumber 
     */
    setElementNumber(elementNumber) {
        if (!Buffer.isBuffer(elementNumber)) throw new Error(`O elementNumber deve ser um Buffer com o número do elemento solicitado`);

        this.#campos.elementNumber = elementNumber;
    }

    /**
     * Seta o sub element number. Ainda não sei oq significa mas deve ser algo com arrays
     * @param {Number} subElementNumber 
     */
    setSubElementNumber(subElementNumber) {
        if (!Buffer.isBuffer(subElementNumber)) throw new Error(`O subElementNumber deve ser um Buffer com o número do sub elemento solicitado`);

        this.#campos.subElementNumber = subElementNumber;
    }

    /**
     * Seta o Buffer que será appendado no final do Function Specific Data. Para casos de escrita, contém informações do valor que será escrito, para leituras até onde vi não precisa informar.
     * @param {Buffer} buffDados
     */
    setData(buffDados) {
        if (!Buffer.isBuffer(buffDados)) throw new Error(`O buffDados deve ser um Buffer`);

        this.#campos.data = buffDados;
    }

    /**
     * Criar o Buffer do Function Specific Data para o Protected Typed 3 Address
     */
    criarBuffer() {
        const retBuff = {
            isSucesso: false,
            sucesso: {
                /**
                 * O Buffer com os dados do Function Specific Data
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

        const traceLog = retBuff.tracer.addTipo(`Protected Typed 3 Address Builder`);

        traceLog.add(`Iniciando a criação do buffer do Function Specific Data`);
        if (this.#campos.byteSize == undefined) {
            retBuff.erro.descricao = `O byteSize não foi setado`;

            traceLog.add(`O campo Byte Size não foi especificado`);
            return retBuff;
        }

        if (this.#campos.fileNumber == undefined) {
            retBuff.erro.descricao = `O fileNumber não foi setado`;

            traceLog.add(`O campo File Number não foi especificado`);
            return retBuff;
        }

        if (this.#campos.fileType == undefined) {
            retBuff.erro.descricao = `O fileType não foi setado`;

            traceLog.add(`O campo File Type não foi especificado`);
            return retBuff;
        }

        if (this.#campos.elementNumber == undefined) {
            retBuff.erro.descricao = `O elementNumber não foi setado`;

            traceLog.add(`O campo Element Number não foi especificado`);
            return retBuff;
        }

        if (this.#campos.subElementNumber == undefined) {
            retBuff.erro.descricao = `O subElementNumber não foi setado`;

            traceLog.add(`O campo Sub Element Number não foi especificado`);
            return retBuff;
        }

        // O tamanho do buffer deve ser:
        // 1 Byte = Byte Size que sempre é 1 byte
        // x Bytes = File Number que pode ser variavel dependendo do contexto, mas geralmente é 1 pra maioria das situações 
        // 1 Byte = File Type que sempre é 1 byte
        // x Bytes = Element Number que pode ser variavel dependendo do contexto, mas geralmente é 1 pra maioria das situações
        // x Bytes = Sub Element Number que pode ser variavel dependendo do contexto, mas geralmente é 1 pra maioria das situações
        // x Bytes = Data que vai ser enviado junto se existente
        let tamanhoTotalBuffer = 1 + this.#campos.fileNumber.length + 1 + this.#campos.elementNumber.length + this.#campos.subElementNumber.length

        // Se foi especificado o payload de Data para appendar junto
        if (this.#campos.data != undefined) {
            tamanhoTotalBuffer += this.#campos.data.length;
        }

        const bufferFunctionData = Buffer.alloc(tamanhoTotalBuffer);
        traceLog.add(`Criando um Buffer de ${tamanhoTotalBuffer} bytes para o Function Specific Data`);

        bufferFunctionData.writeUInt8(this.#campos.byteSize, 0);
        traceLog.add(`Setando o campo Byte Size para ${this.#campos.byteSize} (${numeroToHex(this.#campos.byteSize, 1)}) no offset 0`);

        this.#campos.fileNumber.copy(bufferFunctionData, 1);
        traceLog.add(`Setando o campo File Number para ${hexDeBuffer(this.#campos.fileNumber)} no offset 1`);
        let offsetAtual = 1 + this.#campos.fileNumber.length;

        bufferFunctionData.writeUInt8(this.#campos.fileType, offsetAtual);
        let fileTypeInfo = getFileType(this.#campos.fileType);
        traceLog.add(`Setando o campo File Type para ${this.#campos.fileType} (${numeroToHex(this.#campos.fileType, 1)}) (${fileTypeInfo.descricao}: ${fileTypeInfo.hex}) no offset ${offsetAtual}`);
        offsetAtual += 1;

        this.#campos.elementNumber.copy(bufferFunctionData, offsetAtual);
        traceLog.add(`Setando o campo Element Number para ${hexDeBuffer(this.#campos.elementNumber)} no offset ${offsetAtual}`);
        offsetAtual += this.#campos.elementNumber.length;

        this.#campos.subElementNumber.copy(bufferFunctionData, offsetAtual);
        traceLog.add(`Setando o campo Sub Element Number para ${hexDeBuffer(this.#campos.subElementNumber)} no offset ${offsetAtual}`);
        offsetAtual += this.#campos.subElementNumber.length;

        if (this.#campos.data != undefined) {
            this.#campos.data.copy(bufferFunctionData, offsetAtual);
            traceLog.add(`Setando o campo Data para ${hexDeBuffer(this.#campos.data)} no offset ${offsetAtual}`);
        } else {
            traceLog.add(`Não foi especificado um campo Data, ignorando...`);
        }

        traceLog.add(`Function Specific Data gerado: ${hexDeBuffer(bufferFunctionData)}. Total de ${bufferFunctionData.length} bytes`);

        retBuff.isSucesso = true;
        retBuff.sucesso.buffer = bufferFunctionData;
        return retBuff;
    }
}

/**
 * Tipos de File Types disponiveis
 */
export const FileTypes = {
    Status: {
        hex: 0x84,
        descricao: "Status"
    },
    Bit: {
        hex: 0x85,
        descricao: "Bit"
    },
    Timer: {
        hex: 0x86,
        descricao: "Timer"
    },
    Counter: {
        hex: 0x87,
        descricao: "Counter"
    },
    Control: {
        hex: 0x88,
        descricao: "Control"
    },
    Integer: {
        hex: 0x89,
        descricao: "Integer"
    },
    FloatingPoint: {
        hex: 0x8A,
        descricao: "Floating Point"
    },
    OutputLogicalBySlot: {
        hex: 0x8B,
        descricao: "Output Logical By Slot"
    },
    InputLogicalBySlot: {
        hex: 0x8C,
        descricao: "Input Logical By Slot"
    },
    String: {
        hex: 0x8D,
        descricao: "String"
    },
    ASCII: {
        hex: 0x8E,
        descricao: "ASCII"
    },
    BCD: {
        hex: 0x8F,
        descricao: "BCD"
    }
}


function getFileType(codigo) {
    return Object.values(FileTypes).find(x => x.hex == codigo);
}