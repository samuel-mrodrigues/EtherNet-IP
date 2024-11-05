import { TraceLog } from "../../../../../../../../Utils/TraceLog.js";
import { hexDeBuffer, numeroToHex } from "../../../../../../../../Utils/Utils.js";

/**
 * O Single Service Packet é usado para solicitar o Request Path para um recurso especifico, como uma tag do dispositivo remoto com a descrição.
 */
export class SingleServicePacketServiceBuilder {
    /**
     * Campos utilizado pelo SingleServicePacket
     */
    #campos = {
        /**
         * Código do serviço do SingleServicePacket
         */
        codigoServico: undefined,
        /**
         * O que vai ser solicitado
         */
        atributoNome: '',
        /**
         * A classe generica permite customizar o comando a ser enviado ao dispositivo
         */
        CIPGenericClass: {
            /**
             * Buffer para appendar ao fim do Request Path para o serviço
             */
            buffer: undefined
        }
    }

    /**
     * Opções de comportamento
     */
    #opcoes = {

    }

    /**
     * Instanciar o construtor do Single Service Packet
     */
    constructor() {
        return this;
    }

    /**
     * Obter a string do que vai ser solicitado no serviço
     */
    getStringPath() {
        return this.#campos.atributoNome;
    }

    /**
     * Obter o buffer do CIP Generic Data
     */
    getCIPGenericData() {
        return this.#campos.CIPGenericClass.buffer;
    }

    /**
     * Seta o Buffer do CIP Generic Data
     * @param {Buffer} buffer - Buffer do CIP Generic Data
     */
    setCIPGenericDataBuffer(buffer) {
        if (buffer == undefined) throw new Error('Buffer do CIP Generic Data deve ser informado');
        if (Buffer.isBuffer(buffer) == false) throw new Error('Buffer do CIP Generic Data deve ser um Buffer');
    }

    /**
     * Define o codigo de serviço do Single Service Packet, que no caso seria um Get ou Set
     * @param {Number} codigo - Código valido do serviço Single Service Packet
     */
    setCodigoServico(codigo) {
        if (getSingleServiceCode(codigo) == undefined) {
            throw new Error(`Código de serviço informado '${codigo}' é inválido`);
        }

        this.#campos.codigoServico = codigo;
    }

    /**
     * Define o serviço como um Get Attribute
     * @param {Object} propriedades - Propriedades para incluir no Get Attribute
     * @param {String} propriedades.nome - O nome do recurso que vai ser solicitado no dispositivo remoto
     * @param {Buffer} propriedades.CIPGenericBuffer - O buffer do CIP Generic Data que vai ser enviado no Get Attribute
     */
    setAsGetAttribute(propriedades) {
        this.setCodigoServico(SingleServiceCodes.Get.hex);

        // Verificar se o usuario informou as propriedades necessarias
        if (propriedades == undefined) throw new Error('Propriedades para Get Attribute não foram informadas. É necessario informar o nome do recurso que deseja solicitar');
        if (propriedades.nome == undefined) throw new Error('O nome do recurso que deseja solicitar deve ser informado');
        if (typeof propriedades.nome != 'string') throw new Error('O nome do recurso que deseja solicitar deve ser uma string');

        if (propriedades.CIPGenericBuffer == undefined) throw new Error('O buffer do CIP Generic Data deve ser informado');
        if (Buffer.isBuffer(propriedades.CIPGenericBuffer) == false) throw new Error('O buffer do CIP Generic Data deve ser um Buffer');

        this.#campos.atributoNome = propriedades.nome;

        this.#campos.CIPGenericClass.buffer = propriedades.CIPGenericBuffer;
    }

    /**
     * Define o serviço como um Set Attribute
     * @param {Object} propriedades - Propriedades para incluir no Set Attribute
     * @param {String} propriedades.nome - O nome do recurso que vai ser solicitado no dispositivo remoto
     * @param {Buffer} propriedades.CIPGenericBuffer - O buffer do CIP Generic Data que vai ser enviado no Set Attribute
     */
    setAsSetAttribute(propriedades) {
        this.setCodigoServico(SingleServiceCodes.Set.hex);

        // Verificar se o usuario informou as propriedades necessarias
        if (propriedades == undefined) throw new Error('Propriedades para Set Attribute não foram informadas. É necessario informar o DataType e o novo valor desejado');

        if (propriedades.nome == undefined) throw new Error('O nome do recurso que deseja solicitar deve ser informado');
        if (typeof propriedades.nome != 'string') throw new Error('O nome do recurso que deseja solicitar deve ser uma string');

        if (propriedades.CIPGenericBuffer == undefined) throw new Error('O buffer do CIP Generic Data deve ser informado');
        if (Buffer.isBuffer(propriedades.CIPGenericBuffer) == false) throw new Error('O buffer do CIP Generic Data deve ser um Buffer');

        this.#campos.atributoNome = propriedades.nome;

        this.#campos.CIPGenericClass.buffer = propriedades.CIPGenericBuffer;
        return this;
    }

    /**
     * Retorna o codigo de serviço configurado atual
     */
    getCodigoServico() {
        return this.#campos.codigoServico;
    }

    /**
     * Criar o buffer Request Path para o serviço Single Service Packet
     */
    criarBuffer() {
        const retBuff = {
            isSucesso: false,
            sucesso: {
                /**
                 * O Buffer com os dados do Single Service Packet
                 * @type {Buffer}
                 */
                buffer: undefined
            },
            erro: {
                descricao: ''
            },
            /**
             * O log de rastreamento de execução da geração do Buffer
             * @type {TraceLog}
             */
            tracer: new TraceLog()
        }

        const tracerLogBuff = retBuff.tracer.addTipo(`SingleServicePacketBuilder`);

        tracerLogBuff.add(`Iniciando a criação do buffer do serviço Single Service Packet`);

        // O cabeçalho do serviço Single Service Packet
        const bufferCabecalho = Buffer.alloc(2);

        tracerLogBuff.add(`Criando o cabeçalho do serviço Single Service Packet de ${bufferCabecalho.length} bytes`);

        // O 1 byte do cabeçalho é o tipo do service
        bufferCabecalho.writeUInt8(this.#campos.codigoServico, 0);
        tracerLogBuff.add(`Setando campo de código de serviço para ${getSingleServiceCode(this.#campos.codigoServico).descricao} (${numeroToHex(this.#campos.codigoServico, 1)}) no offset 0`);

        let tamanhoDoRequestPath = Math.ceil((this.#campos.atributoNome.length + 2) / 2);

        // O 2 byte é o tamanho do Request Path abaixo em words
        bufferCabecalho.writeUInt8(tamanhoDoRequestPath, 1);
        tracerLogBuff.add(`Setando campo de tamanho do Request Path para ${tamanhoDoRequestPath} words (${this.#campos.atributoNome}) no offset 1`);

        tracerLogBuff.add(`Cabeçalho do serviço Single Service Packet gerado com sucesso: ${hexDeBuffer(bufferCabecalho)}`);

        // Alocar um buffer pra caber o +1 byte do data type e o +1 Request Path 
        let valorParaAlocarBytes = 2 + Buffer.from(this.#campos.atributoNome).length;
        let isStringImpar = Buffer.from(this.#campos.atributoNome).length % 2 !== 0;
        if (isStringImpar) valorParaAlocarBytes += 1;  // Se o tamanho da string for ímpar, adicionar um byte de preenchimento

        const buffRequestPath = Buffer.alloc(valorParaAlocarBytes);

        tracerLogBuff.add(`Criando o buffer do Request Path de ${buffRequestPath.length} bytes`);

        // Definir o 1 byte como o data type String
        buffRequestPath.writeUInt8(0x91, 0);  // ANSI Extended Symbol Segment (0x91)
        tracerLogBuff.add(`Setando campo de data type para 0x91 no offset 0`);

        // O próximo 1 byte é o tamanho em bytes do simbolo solicitado
        buffRequestPath.writeUInt8(Buffer.from(this.#campos.atributoNome).length, 1);
        tracerLogBuff.add(`Setando campo de tamanho do simbolo solicitado para ${Buffer.from(this.#campos.atributoNome).length} (${this.#campos.atributoNome}) bytes no offset 1`);

        // Os próximos bytes são o Request Path da string solicitada
        Buffer.from(this.#campos.atributoNome).copy(buffRequestPath, 2);
        tracerLogBuff.add(`Setando o campo do Request Path do simbolo solicitado ${hexDeBuffer(Buffer.from(this.#campos.atributoNome))} (${this.#campos.atributoNome}) para o buffer no offset 2`);

        tracerLogBuff.add(`Buffer do Request Path gerado com sucesso: ${hexDeBuffer(buffRequestPath)}`);

        // Dependendo do serviço solicitado, o CIP GenericData contém informações adicionais necessarias para executar alguma operação.
        // Gerlamente pro serviço Get, é só alocado um Buffer vazio 0x0100, e pro Set, é alocado um buffer com informações da tag que vai ser alterada, como o seu tipo, tamanho e novo valor;
        /**
         * @type {Buffer}
         */
        let bufferCIPGenericData;

        // Se for um Get, eu appendo um array de 2 bytes vazio ao CIP Generic Data
        if (this.isGetAttribute()) {
            bufferCIPGenericData = this.#campos.CIPGenericClass.buffer

            tracerLogBuff.add(`Criando o buffer do CIP Generic Data para o serviço Get Attribute de ${bufferCIPGenericData.length} bytes: ${hexDeBuffer(bufferCIPGenericData)}`);
        } else {
            // Se for um Set, eu preciso atribuir o valor que vai ser setado
            bufferCIPGenericData = this.#campos.CIPGenericClass.buffer;

            tracerLogBuff.add(`Criando o buffer do CIP Generic Data para o serviço Set Attribute de ${bufferCIPGenericData.length} bytes: ${hexDeBuffer(bufferCIPGenericData)}`);
        }

        tracerLogBuff.add(`Buffer do CIP Generic Data gerado com sucesso: ${hexDeBuffer(bufferCIPGenericData)}`);

        const buffFinal = Buffer.concat([bufferCabecalho, buffRequestPath, bufferCIPGenericData]);

        tracerLogBuff.add(`Buffer completo(Cabeçalho + Request Path + CIP Generic Data) gerado com sucesso: ${hexDeBuffer(buffFinal)}`);

        tracerLogBuff.add(`Builder SingleServicePacket finalizado`);

        retBuff.isSucesso = true;
        retBuff.sucesso.buffer = buffFinal;
        return retBuff;
    }

    /**
     * Verifica se o serviço é um Get Attribute
     */
    isGetAttribute() {
        return this.#campos.codigoServico == SingleServiceCodes.Get.hex;
    }

    /**
     * Verifica se o serviço é um Set Attribute
     */
    isSetAttribute() {
        return this.#campos.codigoServico == SingleServiceCodes.Set.hex;
    }
}

export const SingleServiceCodes = {
    Get: {
        hex: 0x4c,
        descricao: 'Get_Attribute'
    },
    Set: {
        hex: 0x4d,
        descricao: 'Set_Attribute'
    }
}

/**
 * Tipos de DataTypes numericos suportados
 * Contém o código do tipo de dado, a descrição e o tamanho em bytes
 */
export const DataTypesNumericos = {
    BOOL: {
        codigo: 193,
        descricao: 'Boolean',
        tamanho: 1
    },
    SINT: {
        codigo: 194,
        descricao: 'Small Int',
        tamanho: 1
    },
    INT: {
        codigo: 195,
        descricao: 'Int',
        tamanho: 2
    },
    DINT: {
        codigo: 196,
        descricao: 'Double Int',
        tamanho: 4
    },
    LINT: {
        codigo: 197,
        descricao: 'Long Int',
        tamanho: 8
    },
    USINT: {
        codigo: 198,
        descricao: 'Unsigned Small Int',
        tamanho: 1
    },
    UINT: {
        codigo: 199,
        descricao: 'Unsigned Int',
        tamanho: 2
    },
    UDINT: {
        codigo: 200,
        descricao: 'Unsigned Double Int',
        tamanho: 4
    },
    REAL: {
        codigo: 202,
        descricao: 'Real',
        tamanho: 4
    }
}

/**
 * Retorna informações de um Data Type
 * @param {Number} codigo 
 */
export function getDataType(codigo) {
    return Object.values(DataTypesNumericos).find((type) => type.codigo == codigo);
}

/**
 * Retorna o código do serviço Single Service Packet se existir
 * @param {Number} codigo 
 */
function getSingleServiceCode(codigo) {
    return Object.values(SingleServiceCodes).find((service) => service.hex == codigo);
}