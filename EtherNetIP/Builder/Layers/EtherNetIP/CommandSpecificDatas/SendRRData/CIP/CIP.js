/**
 * O layer CIP (Common Industrial Protocol) vem logo após o layer de EtherNetIP. Nesse caso, esse CIP Layer contém os dados encapsulados para mensagens unconnected
 ** O CIP Layer para o SendRRData por padrão todos os comandos precisam ser enviados a classe Connection Manager instancia 0. Pois ela vai rotear internamente pelo CIP remoto o que precisamos.
 */
export class CIPSendRRDataBuilder {

    /**
     * Campos que contem no CIP Layer do comando SendRRData
     */
    #campos = {
        /**
         * Código HEX do serviço solicitado. Sempre é 1 byte
         * @type {Number}
         */
        servico: undefined,
        /**
         * O Request Path da classe e instancia que tá sendo solicitada no comando SendRRData do CIP
         * @type {Buffer}
         */
        requestPath: undefined
    }

    /**
     * Instanciar um layer CIP para SendRRData
     */
    constructor() {

    }

    /**
     * Seta o código de serviço que vai ser utilizado
     * @param {Number} serviceHex - Código do serviço solicitado
     */
    setServiceCode(serviceHex) {
        if (getService(serviceHex) == undefined) {
            throw new Error(`Serviço informado ${serviceHex} não é valido. Serviços válidos: ${Object.values(Servicos).map(servico => `Hex: ${servico.hex} - ${servico.descricao}`).join(', ')}`);
        }

        this.#campos.servico = serviceHex;
    }

    /**
     * Define o Request Path da classe e instancia que tá sendo solicitada no comando SendRRData do CIP para o dispositivo remoto
     ** No caso do comando SendRRData que é para unconnected messages, o Request Path deve ser a classe Connection Manager, instancia 0
     * @param {Buffer} buffer - Buffer contendo o caminho que aponta para a classe e instancia solicitada
     */
    setRequestPath(buffer) {
        this.#campos.requestPath = buffer;
    }

    /**
     * Retorna o tamanho em WORDs do Path Size configurado. Retorna nullo se Request Path não foi setado
     */
    getTamanhoPathSize() {
        if (this.#campos.requestPath == undefined) return undefined;
    }

    /**
     * Constrói o Buffer de bytes variaveis para o CIP Layer do SendRRData para Unconnected Messages
     ** O Buffer de um layer CIP para Unconnected Message é composto de 3 campos
     ** Service: 1 byte representando o serviço solicitado no dispositivo remoto
     ** Request Path Size: WORDS representando o tamanho do Request Path
     ** Request Path: Buffer contendo o path do que vai ser solicitado
     */
    criarBuffer() {
        const retornoBuffer = {
            /**
             * Se foi possível gerar o Buffer
             */
            isSucesso: false,
            /**
             * Detalhes do Buffer gerado
             */
            sucesso: {
                /**
                 * @type {Buffer}
                 */
                buffer: undefined
            },
            erro: {
                descricao: ''
            }
        }

        // Aloca uns 15 bytes que deve ser o suficiente
        let buffer = Buffer.alloc(15);

        // O 1 byte é o código do serviço solicitado
        buffer.writeUInt8(this.#campos.servico, 0);

        // Os próximos 1 bytes é o total de WORDs contido no Request Path
        buffer.writeUInt16LE(this.#campos.requestPath.length / 2, 1);

        // Os próximos bytes são o Request Path
        this.#campos.requestPath.forEach((byte, index) => {
            buffer.writeUInt8(byte, 3 + index);
        });

        retornoBuffer.isSucesso = true;
        retornoBuffer.sucesso.buffer = buffer;

        return retornoBuffer;
    }
}

/**
 * Retorna o serviço pelo código HEX se existir
 * @param {Number} hex 
 */
export function getService(hex) {
    return Object.values(Servicos).find(servico => servico.hex == hex);
}

/**
 * Serviços disponiveis para utilizar no comando SendRRData para o layer CIP 
 */
export const Servicos = {
    UnconnectedMessageRequest: {
        hex: 0x52,
        descricao: 'Unconnected Message Request'
    }
}

/**
 * Paths de requisição disponiveis para utilizar no comando SendRRData para o layer CIP
 */
export const RequestsPathsProntos = {
    /**
     * Request Path do CIP Connection Manager
     */
    CIPConnectionManager: {
        buffer: Buffer.from([0x20, 0x06, 0x24, 0x01]),
    },
    /**
     * Request Path do CIP PCCC 
     */
    PCCC: {
        buffer: Buffer.from([0x020, 0x67, 0x24, 0x01])
    }
}