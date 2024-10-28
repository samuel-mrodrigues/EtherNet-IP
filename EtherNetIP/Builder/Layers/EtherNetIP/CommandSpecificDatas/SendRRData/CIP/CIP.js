import { CIPConnectionManagerBuilder } from "./Servicos/CIPConnectionManager/CIPConnectionManager.js";
import { MultipleServicePacketServiceBuilder } from "./Servicos/MultipleServicePacket/MultipleServicePacket.js";
import { SingleServicePacketServiceBuilder } from "./Servicos/SingleServicePacket/SingleServicePacket.js";

/**
 * O layer CIP (Common Industrial Protocol) contém detalhes de uma solicitação CIP. Nesse caso, esse CIP Layer contém os dados encapsulados para mensagens unconnected via SendRRData
 ** O CIP segue uma estrutura dinamica dependendo do contexto, porém sempre há no minimo 3 campos:
 ** 1 Byte: Código do serviço requisitado
 ** Próximos 1 byte: Tamanho em WORDS do Request Path abaixo
 ** Próximos bytes: Request Path que seria o conteudo dinamico que varia dependendo do serviço solicitado
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
        codigoServico: undefined,
        /**
         * O serviço a ser executado nessa instancia de builder CIP.
         * @type {CIPConnectionManagerBuilder | SingleServicePacketServiceBuilder | MultipleServicePacketServiceBuilder}
         */
        servico: undefined
    }

    /**
     * Instanciar um layer CIP para SendRRData
     */
    constructor() {
        return this;
    }

    /**
     * Buildar o layer CIP para corresponder ao serviço de Connection Manager
     * @returns {CIPConnectionManagerBuilder} Retorna o Builder do Connection Manager para customizar o serviço solicitado
     */
    buildCIPConnectionManager() {
        this.#campos.codigoServico = Servicos.UnconnectedMessageRequest.hex;

        this.#campos.servico = new CIPConnectionManagerBuilder();

        return this.#campos.servico;
    }

    /**
     * Buildar o layer CIP para corresponder ao serviço de Single Service Packet
     * @returns {SingleServicePacketServiceBuilder} Retorna o Builder do Single Service Packet para customizar o serviço solicitado
     */
    buildSingleServicePacket() {
        this.#campos.codigoServico = Servicos.SingleServicePacket.hex;

        this.#campos.servico = new SingleServicePacketServiceBuilder();

        return this.#campos.servico;
    }

    /**
     * Buildar o layer CIP para corresponder ao serviço de Multiple Service Packet
     */
    buildMultipleServicePacket() {
        this.#campos.codigoServico = Servicos.MultipleServicePacket.hex;

        this.#campos.servico = new MultipleServicePacketServiceBuilder();

        return this.#campos.servico;
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

        // Vou armazenar o conteudo dinamico do serviço CIP em um array
        let bufferCorpo = Buffer.alloc(0);

        switch (this.#campos.codigoServico) {
            case Servicos.UnconnectedMessageRequest.hex: {

                /**
                 * @type {CIPConnectionManagerBuilder}
                 */
                const instanciaCIPConnectionManager = this.#campos.servico;

                // Gerar o buffer do CIP Connection Manager que é o serviço atual configurado no CIP Layer
                let gerarBufferPath = instanciaCIPConnectionManager.criarBuffer();
                if (!gerarBufferPath.isSucesso) {
                    retornoBuffer.erro.descricao = `[CIPSendRRDataBuilder] Erro ao gerar o buffer do CIP Connection Manager: ${gerarBufferPath.erro.descricao}`;
                    return retornoBuffer;
                }

                // Adicionar os bytes que apontam pro Connection Manager e os bytes gerados pelo CIP Connection Manager que correspondem somente ao COmmand Specific Data em diante 
                bufferCorpo = gerarBufferPath.sucesso.buffer
                break;
            }
            case Servicos.SingleServicePacket.hex: {

                /**
                 * @type {SingleServicePacketServiceBuilder}
                 */
                const instanciaCIPSingleServicePacket = this.#campos.servico;

                // Gerar o buffer CIP do Single Service Packet
                let gerarBufferPath = instanciaCIPSingleServicePacket.criarBuffer();
                if (!gerarBufferPath.isSucesso) {
                    retornoBuffer.erro.descricao = `[CIPSendRRDataBuilder] Erro ao gerar o buffer do Single Service Packet: ${gerarBufferPath.erro.descricao}`;
                    return retornoBuffer;
                }

                bufferCorpo = gerarBufferPath.sucesso.buffer
                break;
            }
            case Servicos.MultipleServicePacket.hex: {

                /**
                 * @type {MultipleServicePacketServiceBuilder}
                 */
                const instanciaCIPMultipleServicePacket = this.#campos.servico;

                let gerarBufferPath = instanciaCIPMultipleServicePacket.criarBuffer();
                if (!gerarBufferPath.isSucesso) {
                    retornoBuffer.erro.descricao = `[CIPSendRRDataBuilder] Erro ao gerar o buffer do Multiple Service Packet: ${gerarBufferPath.erro.descricao}`;
                    return retornoBuffer;
                }

                bufferCorpo = gerarBufferPath.sucesso.buffer
                break;
            }
            default: {

                break;
            }
        }

        // Concatenar o buffer do cabeçalho CIP com o buffer do corpo

        const bufferCompleto = bufferCorpo;

        retornoBuffer.isSucesso = true;
        retornoBuffer.sucesso.buffer = bufferCompleto;

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
 * Serviços disponiveis para utilizar no contexto atual do layer CIP
 */
export const Servicos = {
    UnconnectedMessageRequest: {
        hex: 0x52,
        descricao: 'Unconnected Message Request'
    },
    MultipleServicePacket: {
        hex: 0x0a,
        descricao: 'Multiple Service Packet'
    },
    SingleServicePacket: {
        hex: 0x4c,
        descricao: 'Single Service Packet'
    }
}