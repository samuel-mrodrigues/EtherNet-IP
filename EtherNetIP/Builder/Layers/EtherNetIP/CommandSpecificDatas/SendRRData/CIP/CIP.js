import { CIPConnectionManagerBuilder } from "./Servicos/CIPConnectionManager/CIPConnectionManager.js";
import { MultipleServicePacketServiceBuilder } from "./Servicos/MultipleServicePacket/MultipleServicePacket.js";
import { SingleServicePacketServiceBuilder } from "./Servicos/SingleServicePacket/SingleServicePacket.js";
import { ServicoCustomizavelBuilder } from "./Servicos/ServicoCustomizavel/ServicoCustomizavel.js";

import { Servicos, getService } from "../../../../../../Utils/CIPServices.js";
import { TraceLog } from "../../../../../../Utils/TraceLog.js";
import { hexDeBuffer, numeroToHex } from "../../../../../../Utils/Utils.js";

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
         * Se o serviço que vai ser utilizado é customizado(não ta usando algum Builder especifico pra uma serviço)
         * @type {Boolean}
         */
        isServicoCustomizado: false,
        /**
         * O serviço a ser executado nessa instancia de builder CIP.
         * @type {CIPConnectionManagerBuilder | SingleServicePacketServiceBuilder | MultipleServicePacketServiceBuilder | ServicoCustomizavelBuilder}
         */
        servico: undefined
    }

    /**
     * Se já foi gerado o Buffer, contém os detalhes da ultima geração dele
     */
    #ultimoBuffer = {
        /**
         * O tracer de geração ocorrido na geração desse Buffer
         * @type {TraceLog}
         */
        tracer: undefined,
        /**
         * O Buffer com os dados gerados
         * @type {Buffer}
         */
        buffer: undefined
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
     * Buildar o layer CIP para corresponder a um serviço customizado
     */
    buildServicoCustomizadoPacket() {
        this.#campos.codigoServico = -1;
        this.#campos.isServicoCustomizado = true;

        this.#campos.servico = new ServicoCustomizavelBuilder();

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
            },
            /**
             * O Tracer Log contém as etapas da montagem do Buffer
             * @type {TraceLog}
             */
            tracer: new TraceLog()
        }

        const tracerBuffer = retornoBuffer.tracer.addTipo('CIPBuilder');

        tracerBuffer.add(`Iniciando a criação do Buffer CIP`)

        // Vou armazenar o conteudo dinamico do serviço CIP em um array
        let bufferCorpo = Buffer.alloc(0);

        tracerBuffer.add(`Preparando pacote pro serviço selecionado ${this.#campos.codigoServico} (${numeroToHex(this.#campos.codigoServico, 1)})`)

        switch (this.#campos.codigoServico) {
            case Servicos.UnconnectedMessageRequest.hex: {

                tracerBuffer.add(`Preparando o buffer do CIP Connection Manager`)

                /**
                 * @type {CIPConnectionManagerBuilder}
                 */
                const instanciaCIPConnectionManager = this.#campos.servico;

                // Gerar o buffer do CIP Connection Manager que é o serviço atual configurado no CIP Layer
                let gerarBufferPath = instanciaCIPConnectionManager.criarBuffer();

                retornoBuffer.tracer.appendTraceLog(gerarBufferPath.tracer);

                if (!gerarBufferPath.isSucesso) {
                    retornoBuffer.erro.descricao = `Erro ao gerar o buffer do CIP Connection Manager: ${gerarBufferPath.erro.descricao}`;

                    tracerBuffer.add(`O CIP Connection retornou que não conseguiu gerar o seu Buffer. Motivo: ${gerarBufferPath.erro.descricao}`)
                    return retornoBuffer;
                }

                bufferCorpo = gerarBufferPath.sucesso.buffer;
                break;
            }
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

        this.#ultimoBuffer = {
            buffer: bufferCompleto,
            tracer: retornoBuffer.tracer
        }
        tracerBuffer.add(`Builder CIP finalizado.`)
        return retornoBuffer;
    }
}