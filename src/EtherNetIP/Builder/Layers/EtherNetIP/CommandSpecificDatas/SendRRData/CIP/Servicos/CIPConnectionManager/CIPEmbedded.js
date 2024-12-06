import { TraceLog } from "../../../../../../../../Utils/TraceLog.js";
import { numeroToHex, hexDeBuffer } from "../../../../../../../../Utils/Utils.js";
import { MultipleServicePacketServiceBuilder } from "./MultipleServicePacket/MultipleServicePacket.js";
import { ServicoCustomizavelBuilder } from "./ServicoCustomizavel/ServicoCustomizavel.js";
import { SingleServicePacketServiceBuilder } from "./SingleServicePacket/SingleServicePacket.js";

/**
 * O layer CIP (Common Industrial Protocol) para Embedded é contido dentro das solicitações CIP Connection Manager(Para Unconnected Messages). É a 
 * mesma estrutura de um CIP normal, porém por questões de organização estou separando.
 ** O CIP segue uma estrutura dinamica dependendo do contexto, porém sempre há no minimo 3 campos:
 ** 1 Byte: Código do serviço requisitado
 ** Próximos 1 byte: Tamanho em WORDS do Request Path abaixo
 ** Próximos bytes: Request Path que seria o conteudo dinamico que varia dependendo do serviço solicitado
 */
export class CIPEmbeddedBuilder {

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
         * Se o serviço que vai ser utilizado é customizado(não ta usando algum Builder especifico pra uma serviço)
         * @type {Boolean}
         */
        isServicoCustomizado: false,
        /**
         * O serviço a ser executado nessa instancia de builder CIP.
         * @type {SingleServicePacketServiceBuilder | MultipleServicePacketServiceBuilder | ServicoCustomizavelBuilder}
         */
        servico: undefined
    }

    /**
     * Instancia o construtor do CIP Embedded Layer
     */
    constructor() {
        return this;
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
     * Buildar o layer CIP para corresponder a um serviço customizado
     */
    buildServicoCustomizadoPacket() {
        this.#campos.codigoServico = -1;
        this.#campos.isServicoCustomizado = true;

        this.#campos.servico = new ServicoCustomizavelBuilder();

        return this.#campos.servico;
    }

    /**
     * Criar o Buffer da mensagem Embedded
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
            },
            /**
             * O Tracer Log contém as etapas da montagem do Buffer
             * @type {TraceLog}
             */
            tracer: new TraceLog()
        }

        const tracerBuffer = retornoBuffer.tracer.addTipo('CIP Embedded Message Builder');

        tracerBuffer.add(`Iniciando a criação do Buffer CIP`)

        // Vou armazenar o conteudo dinamico do serviço CIP em um array
        let bufferCorpo = Buffer.alloc(0);

        tracerBuffer.add(`Preparando pacote pro serviço selecionado ${this.#campos.codigoServico} (${numeroToHex(this.#campos.codigoServico, 1)})`)
        switch (this.#campos.codigoServico) {
            case Servicos.SingleServicePacket.hex: {

                tracerBuffer.add(`Preparando o buffer do Single Service Packet`)

                /**
                 * @type {SingleServicePacketServiceBuilder}
                 */
                const instanciaCIPSingleServicePacket = this.#campos.servico;

                // Gerar o buffer CIP do Single Service Packet
                let gerarBufferPath = instanciaCIPSingleServicePacket.criarBuffer();

                retornoBuffer.tracer.appendTraceLog(gerarBufferPath.tracer);

                if (!gerarBufferPath.isSucesso) {
                    retornoBuffer.erro.descricao = `Erro ao gerar o buffer do Single Service Packet: ${gerarBufferPath.erro.descricao}`;

                    tracerBuffer.add(`O Single Service Packet retornou que não conseguiu gerar o seu Buffer. Motivo: ${gerarBufferPath.erro.descricao}`)
                    return retornoBuffer;
                }

                bufferCorpo = gerarBufferPath.sucesso.buffer;
                break;
            }
            case Servicos.MultipleServicePacket.hex: {
                tracerBuffer.add(`Preparando o buffer do Multiple Service Packet`)

                /**
                 * @type {MultipleServicePacketServiceBuilder}
                 */
                const instanciaCIPMultipleServicePacket = this.#campos.servico;

                let gerarBufferPath = instanciaCIPMultipleServicePacket.criarBuffer();

                retornoBuffer.tracer.appendTraceLog(gerarBufferPath.tracer);

                if (!gerarBufferPath.isSucesso) {
                    retornoBuffer.erro.descricao = `Erro ao gerar o buffer do Multiple Service Packet: ${gerarBufferPath.erro.descricao}`;

                    tracerBuffer.add(`O Multiple Service Packet retornou que não conseguiu gerar o seu Buffer. Motivo: ${gerarBufferPath.erro.descricao}`)
                    return retornoBuffer;
                }

                bufferCorpo = gerarBufferPath.sucesso.buffer;
                break;
            }
            default: {

                // Se foi setado pra ser um serviço customizado
                if (this.#campos.isServicoCustomizado) {

                    tracerBuffer.add(`Preparando o buffer do serviço customizado`)
                    /**
                     * @type {ServicoCustomizavelBuilder}
                     */
                    const instanciaServicoCustomizado = this.#campos.servico;

                    let gerarBufferPath = instanciaServicoCustomizado.criarBuffer();

                    retornoBuffer.tracer.appendTraceLog(gerarBufferPath.tracer);

                    if (!gerarBufferPath.isSucesso) {
                        retornoBuffer.erro.descricao = `Erro ao gerar o buffer do serviço customizado: ${gerarBufferPath.erro.descricao}`;

                        tracerBuffer.add(`O serviço customizado retornou que não conseguiu gerar o seu Buffer. Motivo: ${gerarBufferPath.erro.descricao}`)
                        return retornoBuffer;
                    }

                    bufferCorpo = gerarBufferPath.sucesso.buffer;
                } else {
                    retornoBuffer.erro.descricao = `Código de serviço não reconhecido: ${this.#campos.codigoServico}`;

                    retornoBuffer.tracer.appendTraceLog(gerarBufferPath.tracer);
                    tracerBuffer.add(`O código de serviço não foi reconhecido: ${this.#campos.codigoServico}`)
                    return retornoBuffer;
                }
            }
        }

        tracerBuffer.add(`Buffer do serviço solicitado foi gerado com sucesso: ${hexDeBuffer(bufferCorpo)}, com ${bufferCorpo.length} bytes`)

        // Concatenar o buffer do cabeçalho CIP com o buffer do corpo
        const bufferCompleto = bufferCorpo;

        retornoBuffer.isSucesso = true;
        retornoBuffer.sucesso.buffer = bufferCompleto;

        tracerBuffer.add(`Builder CIP finalizado.`)
        return retornoBuffer;
    }
}

export const Servicos = {
    MultipleServicePacket: {
        hex: 0x0a,
        descricao: 'Multiple Service Packet'
    },
    SingleServicePacket: {
        hex: 0x4c,
        descricao: 'Single Service Packet'
    },
}