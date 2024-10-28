/**
 * O Single Service Packet (0x4C) é usado para solicitar o Request Path para um recurso especifico, como uma tag do dispositivo remoto com a descrição.
 */
export class SingleServicePacketServiceBuilder {

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
     * Instanciar o construtor do Single Service Packet
     * @param {Object} parametros - Parametros do construtor para instanciar o SIngleServicePacket
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
                buffer: undefined,
                /**
                 * O tamanho em WORDs do Request Path
                 */
                requestPathWords: undefined
            },
            erro: {
                descricao: ''
            }
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

        retBuff.isSucesso = true;
        retBuff.sucesso.buffer = buff;
        retBuff.sucesso.requestPathWords = Math.ceil((2 + this.#campos.string.length) / 2);

        return retBuff;
    }
}