/**
 * SendRRData possui um Command Specific Data com 3 campos
 */

/**
 * EncapsulationPacket
 *      Interface handle       (UDINT, 4 bytes, unsigned)           // Shall be 0 for CIP
 *      Timeout                (UINT, 2 bytes, unsigned)            // Operation timeout
 *      Encapsulated packet     (ARRAY of octet, variable length)    // See Common Packet Format specification in section 2-6
 */

// O Encapsulated packet segue esse formato:

/**
 * ItemType
 *      Type ID              (UINT, 2 bytes, unsigned)            // Type of item encapsulated
 *      Length               (UINT, 2 bytes, unsigned)            // Length in bytes of the Data Field
 *      Data                 (Variable length)                    // The data (if length > 0)
 */

/**
 * @typedef Item
 * @property {number} idTipo - Tipo do item encapsulado
 * @property {number} tamanho - Tamanho em bytes do campo de dados encapsulado nos layers pra frente
 * @property {Buffer} dados - Dados do campo encapsulado (se necessário)
 */

export class CommandSpecificDataSendRRData {

    /**
     * Se o comando de SendRRData é valido ou não
     */
    #statusComando = {
        isValido: false,
        erro: {
            descricao: ''
        }
    }

    /**
     * Campos do Command Specific Data do comando SendRRData
     */
    #campos = {
        /**
         * ID do handle da interface (sempre CIP que é 0x0)
         */
        interfaceHandle: undefined,
        /**
         * Timeout em segundos que esse comando deve aguarda para expirar
         */
        timeout: undefined,
        /**
         * @type {Item[]} - Itens encapsulados no comando SendRRData
         */
        itemsEncapsulados: []
    }

    /**
     * Instanciar o payload do comando de SendRRData
     * @param {Buffer} buffer - Opcionamente um buffer para dar parse no conteudo
     */
    constructor(buffer) {
        if (buffer != undefined) this.parseBuffer(buffer);

    }

    /**
     * Passa um Buffer do Command Specific Data do layer EtherNet/IP e faz o parse dos campos
     * @param {Buffer} buff - Buffer com os dados do Command Specific Data
     */
    parseBuffer(buff) {
        let retornoParse = {
            isSucesso: false,
            erro: {
                descricao: ''
            }
        }

        // Tem que ter pelo menos 8 bytes que seriam 4 bytes do interface handler + 2 bytes do timeout + 2 bytes dos tipos enviados
        if (buff.length < 8) {
            this.#statusComando.erro.descricao = 'Buffer não contém os 8 bytes minimos do Command Specific Data do comando SendRRData';

            retornoParse.erro.descricao = this.#statusComando.erro.descricao;
            return retornoParse;
        }

        // Os primeiros 4 bytes são do interface handle (geralmente é só 0 que significa CIP)
        let interfaceHandle = buff.readUInt32LE(0);

        // Os próximos 2 bytes são do timeout em segundos pelo tempo maximo de aguardo da requisição
        let timeoutTempo = buff.readUInt16LE(4);

        // Os próximos 2 bytes é a quantidade de itens que foram encapsulados
        let totalItemsEncapsulados = buff.readInt16LE(6);

        /**
         * @type {Item[]}
         */
        const itensEncapsulados = [];

        let offsetItem = 8;
        for (let indexItemEncapsulado = 0; indexItemEncapsulado < totalItemsEncapsulados; indexItemEncapsulado++) {

            /**
             * Tipo ID do item encapsulado
             */
            let tipoId;
            /**
             * Tamanho em bytes do pacote encapsulado no layer pra frente
             */
            let tamanhoBytesEncapsulamento;

            try {
                // Ler os próximos 2 bytes que são o tipo ID do item encapsulado
                tipoId = buff.readUInt16LE(offsetItem);
            } catch (ex) {
                if (ex instanceof RangeError) {
                    this.#statusComando.erro.descricao = `Erro ao ler o tipo ID do item encapsulado no index ${indexItemEncapsulado} do buffer da posição ${offsetItem} até ${offsetItem + 2}, o buffer só tem ${buff.length} bytes`;

                    retornoParse.erro.descricao = this.#statusComando.erro.descricao;
                } else {
                    this.#statusComando.erro.descricao = `Erro desconhecido ao ler o tipo ID do item encapsulado no index ${indexItemEncapsulado} do buffer: ${ex.message}`
                }

                return retornoParse;
            }

            try {
                // Ler os próximos 2 bytes que são o tamanho em bytes do pacote encapsulado no layer pra frente do tipo da mensagem encapsulada
                tamanhoBytesEncapsulamento = buff.readUInt16LE(offsetItem + 2);
            } catch (ex) {
                if (ex instanceof RangeError) {
                    this.#statusComando.erro.descricao = `Erro ao ler o tamanho em bytes do pacote encapsulado no layer pra frente no index ${indexItemEncapsulado} do buffer da posição ${offsetItem} até ${offsetItem + 2}, o buffer só tem ${buff.length} bytes`;

                    retornoParse.erro.descricao = this.#statusComando.erro.descricao;
                } else {
                    this.#statusComando.erro.descricao = `Erro desconhecido ao ler o tamanho em bytes do pacote encapsulado no layer pra frente no index ${indexItemEncapsulado} do buffer: ${ex.message}`
                }

                return retornoParse;
            }

            // Se conseguiu ler tranquilo os codigos de eventos, adicionar a lista de itens encapsulados
            /**
             * @type {Item}
             */
            const itemEncapsulado = {
                idTipo: tipoId,
                tamanho: tamanhoBytesEncapsulamento,
                dados: undefined
            }

            itensEncapsulados.push(itemEncapsulado);

            // Aumentar o offset para o próximo item encapsulado
            offsetItem += 4;
        }

        // Se chegou até aqui, é porque conseguiu ler todos os campos do Command Specific Data
        this.#campos.interfaceHandle = interfaceHandle;
        this.#campos.itemsEncapsulados = itensEncapsulados;
        this.#campos.timeout = timeoutTempo;

        this.#statusComando.isValido = true;

        retornoParse.isSucesso = true;
        return retornoParse;
    }

    /**
     * Criar um Buffer SendRRData com os parametros desejados
     * @param {Object} parametros - Parametros desejados
     * @param {Number} parametros.timeout - Timeout em segundos de expiração do pacote
     * @param {Object[]} parametros.itensEncapsular - Itens para encapsular no pacote
     * @param {Number} parametros.itensEncapsular[].idTipo - ID do tipo do item encapsulado
     * @param {Number} parametros.itensEncapsular[].tamanho - Tamanho em bytes do item encapsulado
     */
    criarBuffer(parametros) {
        let retornoBuff = {
            isSucesso: false,
            /**
             * Se sucesso, contém o Buffer do Command Specific Data do comando SendRRData
             */
            sucesso: {
                buffer: undefined
            },
            erro: {
                descricao: ''
            }
        }

        if (parametros == undefined) {
            throw new Error('Parametros para criação do Buffer não podem ser nulos');
        }

        const novoBuff = Buffer.alloc(100);

        // Zerar os campos do Buffer
        this.#campos.interfaceHandle = 0;
        this.#campos.itemsEncapsulados = [];
        this.#campos.timeout = 0;

        // Vou primeiro atualizar todos os campos com os valores que vou querer enviar

        // Se foi informado um timeout, setar no campo
        if (parametros.timeout != undefined && typeof parametros.timeout == 'number') {
            this.#campos.timeout = parametros.timeout;
        }

        // Se foi informado itens para encapsular, setar no campo
        if (parametros.itensEncapsular != undefined && Array.isArray(parametros.itensEncapsular)) {
            for (const itemEncapsular of parametros.itensEncapsular) {
                if (isExisteItem(itemEncapsular.idTipo) == undefined) {
                    throw new Error(`ID do tipo do item encapsulado ${itemEncapsular.idTipo} não é um item de encapsulação valido`);
                }

                this.#campos.itemsEncapsulados.push({
                    idTipo: itemEncapsular.idTipo,
                    tamanho: itemEncapsular.tamanho,
                    dados: itemEncapsular.dados
                })
            }
        }

        // Aopos realizar a tratativa e atualização dos campos, montar o Buffer com os dados de campos atuais;

        // Os primeiros 4 bytes são do interface handle que é sempre 0, pois representa uma instrução CIP
        novoBuff.writeUInt32LE(this.#campos.interfaceHandle, 0);

        // Os próximos 2 bytes são do timeout em segundos
        novoBuff.writeUInt16LE(this.#campos.timeout, 4);

        // Os próximos 2 bytes são a quantidade de itens encapsulados
        novoBuff.writeUInt16LE(this.#campos.itemsEncapsulados.length, 6);

        // As próximas sequencias de bytes são um array de itens encapsulados

        // Offset aonde vou começar a escrever o primeiro item
        let offsetItem = 8;
        for (const itemParaEncapsular of this.#campos.itemsEncapsulados) {

            // Escrevo nos próximos 2 bytes o tipo do ID de encapsulamento
            novoBuff.writeUInt16LE(itemParaEncapsular.idTipo, offsetItem);

            // Escrevo o tamanho do payload que ele contém nos layers pra frente
            novoBuff.writeUInt16LE(itemParaEncapsular.tamanho, offsetItem + 2);

            // Pula o offset pra +2 pro próximo ID de item
            offsetItem += 2;
        }

        // Após inserir os itens de encapsulamento no Buffer, ele está pronto e deve ser um Command Specific Data do SendRRData valido

        retornoBuff.isSucesso = true;
        retornoBuff.sucesso.buffer = novoBuff;

        // Cortar o buffer para o tamanho exato do que foi escrito
        retornoBuff.sucesso.buffer = novoBuff.subarray(0, offsetItem);
        return retornoBuff;
    }
}

export const Items = {
    Null: {
        hex: 0x0000,
        descricao: 'Null'
    },
    UnconnectedMessage: {
        hex: 0x00B2,
        descricao: 'Unconnected Message'
    }
}

/**
 * Verifica se um código é de um item de encapsulação valido e retorna ele
 */
function isExisteItem(codigo) {
    Object.values(Items).find(i => i.hex == codigo);
}