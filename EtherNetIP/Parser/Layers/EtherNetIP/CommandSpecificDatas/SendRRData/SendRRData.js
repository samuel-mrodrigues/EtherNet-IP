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

import { CIPSendRRDataParser } from "./CIP/CIPParser.js";

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
         * Itens que foram recebidos do encapsulamento
         * @type {Item[]} - Itens encapsulados no comando SendRRData
         */
        itemsEncapsulados: [],
        /**
         * O pacote CIP recebido porém em Buffer
         */
        BufferCIP: undefined
    }

    /**
     * Instanciar o payload do comando de SendRRData
     * @param {Buffer} buffer - Opcionamente um buffer para dar parse no conteudo
     */
    constructor(buffer) {
        if (buffer != undefined) this.parseBuffer(buffer);
    }

    /**
     * Retorna se esse parser está com todos os campos válidos de um comando SendRRData
     */
    isValido() {
        let status = {
            /**
             * Se o layer é valido com todos os seus campos recebidos e seu status como sucesso
             */
            isValido: false,
            /**
             * Se não é valido, motivo do erro
             */
            erro: {
                descricao: ''
            }
        }

        // Se o motivo de não ser valido for por alguma informação incorreta no buffer que faltou certos campos
        if (!this.#statusComando.isValido) {
            status.erro.descricao = `Erro no comando SendRRData: ${this.#statusComando.erro.descricao}`;
            return status;
        }

        // Se o layer estiver joia, está tudo ok
        status.isValido = true;
        return status;
    }

    /**
     * Passa um Buffer do Command Specific Data do layer EtherNet/IP e faz o parse dos campos
     * @param {Buffer} buff - Buffer com os dados do Command Specific Data
     */
    parseBuffer(buff) {
        const retornoParse = {
            isSucesso: false,
            erro: {
                descricao: ''
            }
        }

        // Tem que ter pelo menos 8 bytes que seriam 4 bytes do interface handler + 2 bytes do timeout + 2 bytes dos tipos enviados
        if (buff.length < 8) {
            this.#statusComando.isValido = false;
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
                this.#statusComando.isValido = false;
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
                this.#statusComando.isValido = false;

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

        // Extrair o Buffer CIP que contém o payload do que o dispositivo remotou devolveu.
        // O offset atual do offsetItem está localizado no ultimo item do layer SendRRData, onde consta o tipo do ultimo item e o length, então add ele + 2 me retorna a posição perfeita do próximo
        const offsetBufferCIP = offsetItem;

        // Salvar todo o restante do Buffer atual que na teoria contém os detalhes do CIP
        this.#campos.BufferCIP = buff.subarray(offsetBufferCIP);

        retornoParse.isSucesso = true;

        // Se deu certo em dar parse, pode confirmar que é valido
        this.#statusComando.isValido = true;
        return retornoParse;
    }

    /**
     * Retorna se o Command Specific Data do SendRRData é um protocolo CIP
     */
    isServicoCIP() {

        // O serviço CIP é código 0x0
        return this.#campos.interfaceHandle == 0;
    }

    /**
     * Se Command Specific Data corresponder ao tipo protocolo CIP, retorna o protoclo CIP com as informações recebidas
     */
    getAsServicoCIP() {
        if (this.isServicoCIP()) {
            const parserCIP = new CIPSendRRDataParser(this.#campos.BufferCIP);

            return parserCIP;
        }
    }
}
