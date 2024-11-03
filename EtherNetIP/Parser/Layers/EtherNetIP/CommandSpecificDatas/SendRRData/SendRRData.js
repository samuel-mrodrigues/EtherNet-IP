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

import { getItemTipo } from "../../../../../Utils/SendRRDataItemsTipos.js";
import { TraceLog } from "../../../../../Utils/TraceLog.js";
import { hexDeBuffer, numeroToHex } from "../../../../../Utils/Utils.js";
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
     ** Esse campo indica se os bytes recebidos são validos e encaixam com o que é esperado. Mensagens de buffers retornadas com erro devido ao mau uso da classe ainda são consideradas válidas. Esse campo apenas indica se
     houver algum erro ao dar parse no buffer.
     */
    #statusComando = {
        isValido: false,
        erro: {
            descricao: ''
        },
        /**
         * O tracer contém as etapas de parse do Buffer. É útil pra acompanhar erros e os valores recebidos.
         * @type {TraceLog}
         */
        tracer: undefined
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
            },
            /**
             * O tracer contém as etapas de parse do Buffer. É útil pra acompanhar erros e os valores recebidos.
             * @type {TraceLog}
             */
            tracer: undefined
        }

        status.tracer = this.#statusComando.tracer;

        if (this.#statusComando.isValido) {
            status.isValido = true;
        } else {
            status.erro.descricao = `Erro no comando SendRRData: ${this.#statusComando.erro.descricao}`;
        }
        return status;
    }

    /**
     * Passa um Buffer do Command Specific Data do layer EtherNet/IP e faz o parse dos campos
     * @param {Buffer} buff - Buffer com os dados do Command Specific Data
     */
    parseBuffer(buff) {
        const retornoParse = {
            /**
             * Se foi possível obter pelo menos os dados do layer SendRRData
             */
            isSucesso: false,
            erro: {
                descricao: ''
            },
            /**
             * Contém os passos de parse do buffer. Útil para debug
             */
            tracer: new TraceLog()
        }

        const tracerBuffer = retornoParse.tracer.addTipo(`SendRRData Parser`);
        this.#statusComando.tracer = retornoParse.tracer;

        tracerBuffer.add(`Iniciando parser de SendRRData para o Buffer: ${hexDeBuffer(buff)}, ${buff.length} bytes`);

        // Tem que ter pelo menos 8 bytes que seriam 4 bytes do interface handler + 2 bytes do timeout + 2 bytes dos tipos enviados
        if (buff.length < 8) {
            this.#statusComando.isValido = false;
            this.#statusComando.erro.descricao = `Buffer não contém os 8 bytes minimos do Command Specific Data do comando SendRRData, atualmente foi recebido um com apenas ${buff.length} bytes`;

            retornoParse.erro.descricao = this.#statusComando.erro.descricao;
            tracerBuffer.add(`O Buffer recebido não contém os 8 bytes minimos para ser um Command Specific Data válido, possui apenas ${buff.length} bytes`);
            return retornoParse;
        }

        // Os primeiros 4 bytes são do interface handle (geralmente é só 0 que significa CIP)
        let interfaceHandle = buff.readUInt32LE(0);
        tracerBuffer.add(`Lendo o Interface Handle: ${interfaceHandle} (${numeroToHex(interfaceHandle, 4)}) no offset 0`);

        // Os próximos 2 bytes são do timeout em segundos pelo tempo maximo de aguardo da requisição
        let timeoutTempo = buff.readUInt16LE(4);
        tracerBuffer.add(`Lendo o Timeout: ${timeoutTempo} segundos (${numeroToHex(timeoutTempo, 2)}) no offset 4`);

        // Os próximos 2 bytes é a quantidade de itens que foram encapsulados
        let totalItemsEncapsulados = buff.readInt16LE(6);
        tracerBuffer.add(`Lendo a quantidade de itens encapsulados: ${totalItemsEncapsulados} (${numeroToHex(totalItemsEncapsulados, 2)}) no offset 6`);


        tracerBuffer.add(`Iniciando a verificação dos Itens Encapsulados recebidos.`);

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

                let detalhesDoItem = getItemTipo(tipoId);

                tracerBuffer.add(`Lendo o Tipo ID do item encapsulado no index ${indexItemEncapsulado}: ${tipoId} (${numeroToHex(tipoId, 2)}) (${detalhesDoItem != undefined ? `${detalhesDoItem.descricao}` : 'Item ID desconehcido'}) no offset ${offsetItem}`);
            } catch (ex) {
                this.#statusComando.isValido = false;

                if (ex instanceof RangeError) {
                    this.#statusComando.erro.descricao = `Erro ao ler o tipo ID do item encapsulado no index ${indexItemEncapsulado} do buffer da posição ${offsetItem} até ${offsetItem + 2}, o buffer só tem ${buff.length} bytes`;

                    tracerBuffer.add(`Erro ao ler o tipo ID do item encapsulado no index ${indexItemEncapsulado} do buffer da posição ${offsetItem} até ${offsetItem + 2}, o buffer só tem ${buff.length} bytes`);
                } else {
                    this.#statusComando.erro.descricao = `Erro desconhecido ao ler o tipo ID do item encapsulado no index ${indexItemEncapsulado} do buffer: ${ex.message}`

                    tracerBuffer.add(`Erro desconhecido ao ler o tipo ID do item encapsulado no index ${indexItemEncapsulado} do buffer: ${ex.message}`);
                }

                retornoParse.erro.descricao = this.#statusComando.erro.descricao;
                return retornoParse;
            }

            try {
                // Ler os próximos 2 bytes que são o tamanho em bytes do pacote encapsulado no layer pra frente do tipo da mensagem encapsulada
                tamanhoBytesEncapsulamento = buff.readUInt16LE(offsetItem + 2);

                tracerBuffer.add(`Lendo o tamanho em bytes do pacote encapsulado no layer pra frente no index ${indexItemEncapsulado}: ${tamanhoBytesEncapsulamento} (${numeroToHex(tamanhoBytesEncapsulamento, 2)}) no offset ${offsetItem}`);
            } catch (ex) {
                this.#statusComando.isValido = false;

                if (ex instanceof RangeError) {
                    this.#statusComando.erro.descricao = `Erro ao ler o tamanho em bytes do pacote encapsulado no layer pra frente no index ${indexItemEncapsulado} do buffer da posição ${offsetItem} até ${offsetItem + 2}, o buffer só tem ${buff.length} bytes`;
                    tracerBuffer.add(`Erro ao ler o tamanho em bytes do pacote encapsulado no layer pra frente no index ${indexItemEncapsulado} do buffer da posição ${offsetItem} até ${offsetItem + 2}, o buffer só tem ${buff.length} bytes`);
                } else {
                    this.#statusComando.erro.descricao = `Erro desconhecido ao ler o tamanho em bytes do pacote encapsulado no layer pra frente no index ${indexItemEncapsulado} do buffer: ${ex.message}`
                    tracerBuffer.add(`Erro desconhecido ao ler o tamanho em bytes do pacote encapsulado no layer pra frente no index ${indexItemEncapsulado} do buffer: ${ex.message}`);
                }

                retornoParse.erro.descricao = this.#statusComando.erro.descricao;
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

            let detalhesDoItem = getItemTipo(tipoId);
            tracerBuffer.add(`Item encapsulado no index ${indexItemEncapsulado} lido com sucesso. Tipo ID: ${tipoId} (${numeroToHex(tipoId, 2)}) (${detalhesDoItem != undefined ? `${detalhesDoItem.descricao}` : `Desconhecido`}), Tamanho: ${tamanhoBytesEncapsulamento} bytes (${numeroToHex(tamanhoBytesEncapsulamento, 2)})`);

            // Aumentar o offset para o próximo item encapsulado
            offsetItem += 4;
        }

        tracerBuffer.add(`Finalizado a leitura dos itens encapsulados com sucesso.`);

        // Se chegou até aqui, é porque conseguiu ler todos os campos do Command Specific Data
        this.#campos.interfaceHandle = interfaceHandle;
        this.#campos.itemsEncapsulados = itensEncapsulados;
        this.#campos.timeout = timeoutTempo;

        // Extrair o Buffer CIP que contém o payload do que o dispositivo remotou devolveu.
        const offsetBufferCIP = offsetItem;

        // Salvar todo o restante do Buffer atual que na teoria contém os detalhes do CIP
        this.#campos.BufferCIP = buff.subarray(offsetBufferCIP);

        tracerBuffer.add(`O restante do Buffer corresponde ao restante do tipo do serviço especifico: ${hexDeBuffer(this.#campos.BufferCIP)}, ${this.#campos.BufferCIP.length} bytes`);

        retornoParse.isSucesso = true;

        // Se deu certo em dar parse, pode confirmar que é valido
        this.#statusComando.isValido = true;

        tracerBuffer.add(`Finalizado o parser de SendRRData com sucesso. Interface Handle: ${interfaceHandle} (${numeroToHex(interfaceHandle, 4)}), Timeout: ${timeoutTempo} segundos (${numeroToHex(timeoutTempo, 2)}), Itens Encapsulados: ${totalItemsEncapsulados}, Buffer CIP: ${hexDeBuffer(this.#campos.BufferCIP)}, ${this.#campos.BufferCIP.length} bytes`);

        tracerBuffer.add(`Parser de SendRRData finalizado.`);
        return retornoParse;
    }

    /**
     * Retorna os itens que foram recebidos na encapsulação do comando SendRRData
     */
    getItensEncapsulados() {
        return this.#campos.itemsEncapsulados;
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
