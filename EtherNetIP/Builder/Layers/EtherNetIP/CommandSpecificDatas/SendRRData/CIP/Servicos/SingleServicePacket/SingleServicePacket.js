/**
 * O Single Service Packet (0x4C) é usado para solicitar o Request Path para um recurso especifico, como uma tag do dispositivo remoto com a descrição.
 */
export class SingleServicePacketServiceBuilder {

    /**
     * Código do serviço do SingleServicePacket
     */
    codigoServico = undefined;

    /**
     * Campos utilizado pelo SingleServicePacket
     */
    #campos = {
        /**
         * O que vai ser solicitado
         */
        string: ''
    }

    /**
     * Opções de comportamento
     */
    #opcoes = {
        /**
         * Incluir ao fim do Buffer 2 bytes que representam o CIP Class Generic, que por algum motivo é sempre [0x01, 0x00]
         */
        isIncluirCIPClassGeneric: false
    }

    /**
     * Instanciar o construtor do Single Service Packet
     * @param {Object} parametros - Parametros do construtor para instanciar o SIngleServicePacket
     * @param {Number} parametros.codigoServico - O código do serviço do Single Service Packet 
     * @param {String} parametros.string - O nome do recurso que vai ser solicitado no dispositivo remoto 
     */
    constructor(parametros) {
        if (parametros != undefined && typeof parametros == 'object') {

            if (parametros.string != undefined) this.setString(string);
        }

        return this;
    }

    /**
     * Definir a string do que vai ser solicitado no serviço
     * @param {String} string - O nome do recurso. Caso seja uma tag, informar tipo "MINHA_TAG"
     */
    setString(string) {
        this.#campos.string = string;

        return this;
    }

    /**
     * Obter a string do que vai ser solicitado no serviço
     */
    getStringPath() {
        return this.#campos.string;
    }

    /**
     * Define o codigo de serviço do Single Service Packet, que no caso seria um Get ou Set
     * @param {Number} codigo - Código valido do serviço Single Service Packet
     */
    setCodigoServico(codigo) {
        if (getSingleServiceCode(codigo) == undefined) {
            throw new Error(`Código de serviço informado '${codigo}' é inválido`);
        }

        this.codigoServico = codigo;
    }

    /**
     * Retorna o codigo de serviço configurado atual
     */
    getCodigoServico() {
        return this.codigoServico;
    }


    /**
     * Define se o CIP Class Generic deve ser incluido ao fim do buffer do Single Service Packet
     * @param {Boolean} bool 
     */
    setIncluirCIPGenericVazio(bool) {
        this.#opcoes.isIncluirCIPClassGeneric = bool;
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
            }
        }

        // O cabeçalho do serviço Single Service Packet
        const bufferCabecalho = Buffer.alloc(2);

        // O 1 byte do cabeçalho é o tipo do service
        bufferCabecalho.writeUInt8(this.codigoServico, 0);  // Single Service Packet (0x4C)

        // O 2 byte é o tamanho do Request Path abaixo em words
        const setTamanhoRequestPath = (tamanhoWords) => {
            bufferCabecalho.writeUInt8(tamanhoWords, 1);
        }

        // Alocar um buffer pra caber o +1 byte do data type e o +1 Request Path 
        let valorParaAlocarBytes = 2 + Buffer.from(this.#campos.string).length;
        let isStringImpar = Buffer.from(this.#campos.string).length % 2 !== 0;
        if (isStringImpar) valorParaAlocarBytes += 1;  // Se o tamanho da string for ímpar, adicionar um byte de preenchimento

        let buff = Buffer.alloc(valorParaAlocarBytes);

        // Definir o 1 byte como o data type String
        buff.writeUInt8(0x91, 0);  // ANSI Extended Symbol Segment (0x91)

        // O próximo 1 byte é o tamanho em bytes do simbolo solicitado
        buff.writeUInt8(Buffer.from(this.#campos.string).length, 1);

        // Os próximos bytes são o Request Path da string solicitada
        Buffer.from(this.#campos.string).copy(buff, 2);

        // O tamanho do Single Service Packet requisitado (no caso se data type for string)
        let tamanhoRequestPath = Math.ceil((this.#campos.string.length + 2) / 2);

        // Seta o tamanho no cabeçalho do serviço
        setTamanhoRequestPath(tamanhoRequestPath);

        retBuff.sucesso.requestPathWords = tamanhoRequestPath;
        retBuff.isSucesso = true;

        if (this.#opcoes.isIncluirCIPClassGeneric) {
            // Eu concateno o buffer com um byte de preenchimento que seria o CIP Class Generic
            retBuff.sucesso.buffer = Buffer.concat([bufferCabecalho, buff, Buffer.from([0x01, 0x00])]);
        } else {
            // Se não precisar incluir o CIP Class Generic
            retBuff.sucesso.buffer = Buffer.concat([bufferCabecalho, buff]);
        }

        return retBuff;
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
 * Retorna o código do serviço Single Service Packet se existir
 * @param {Number} codigo 
 */
function getSingleServiceCode(codigo) {
    return Object.values(SingleServiceCodes).find((service) => service.hex == codigo);
}