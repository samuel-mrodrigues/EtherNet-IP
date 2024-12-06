import { CIPConnectionManagerBuilder } from "./Servicos/CIPConnectionManager/CIPConnectionManager.js";
import { TraceLog } from "../../../../../../Utils/TraceLog.js";
import { hexDeBuffer, numeroToHex } from "../../../../../../Utils/Utils.js";
import { CIPPCCCBuilder } from "./Servicos/CIPPCCC/CIPPCCC.js";

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
         * @type {CIPConnectionManagerBuilder | CIPPCCCBuilder}
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
        this.#campos.codigoServico = Servicos.ConnectionManager.hex;

        this.#campos.servico = new CIPConnectionManagerBuilder();

        return this.#campos.servico;
    }

    /**
     * Buildar o layer CIP para corresponder ao serviço de CIP PCCC
     * @returns {CIPPCCCBuilder} Retorna o Builder do CIP PCCC para customizar o serviço solicitado
     */
    buildCIPPCCC() {
        this.#campos.codigoServico = Servicos.PCCC.hex;

        this.#campos.servico = new CIPPCCCBuilder();

        return this.#campos.servico;
    }

    /**
     * Constrói o Buffer de bytes variaveis para o CIP Layer do SendRRData para Unconnected Messages
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

        tracerBuffer.add(`Iniciando a criação do Buffer CIP`);

        // Vou armazenar o conteudo dinamico do serviço CIP em um array
        let bufferCorpo = Buffer.alloc(0);

        tracerBuffer.add(`Preparando pacote pro serviço selecionado ${this.#campos.codigoServico} (${numeroToHex(this.#campos.codigoServico, 1)})`);

        switch (this.#campos.codigoServico) {
            case Servicos.ConnectionManager.hex: {

                tracerBuffer.add(`Preparando o buffer do CIP Connection Manager`);

                /**
                 * @type {CIPConnectionManagerBuilder}
                 */
                const instanciaCIPConnectionManager = this.#campos.servico;

                // Gerar o buffer do CIP Connection Manager que é o serviço atual configurado no CIP Layer
                let gerarBufferPath = instanciaCIPConnectionManager.criarBuffer();

                retornoBuffer.tracer.appendTraceLog(gerarBufferPath.tracer);

                if (!gerarBufferPath.isSucesso) {
                    retornoBuffer.erro.descricao = `Erro ao gerar o buffer do CIP Connection Manager: ${gerarBufferPath.erro.descricao}`;

                    tracerBuffer.add(`O CIP Connection retornou que não conseguiu gerar o seu Buffer. Motivo: ${gerarBufferPath.erro.descricao}`);
                    return retornoBuffer;
                }

                bufferCorpo = gerarBufferPath.sucesso.buffer;
                break;
            }
            case Servicos.PCCC.hex: {

                tracerBuffer.add(`Preparando o buffer do CIP PCCC`);

                /**
                 * @type {CIPPCCCBuilder}
                 */
                const instanciaCIPPCCC = this.#campos.servico;

                // Gerar o buffer do CIP PCCC que é o serviço atual configurado no CIP Layer
                let gerarBufferPath = instanciaCIPPCCC.criarBuffer();

                retornoBuffer.tracer.appendTraceLog(gerarBufferPath.tracer);

                if (!gerarBufferPath.isSucesso) {
                    retornoBuffer.erro.descricao = `Erro ao gerar o buffer do CIP PCCC: ${gerarBufferPath.erro.descricao}`;

                    tracerBuffer.add(`O CIP PCCC retornou que não conseguiu gerar o seu Buffer. Motivo: ${gerarBufferPath.erro.descricao}`);
                    return retornoBuffer;
                }

                bufferCorpo = gerarBufferPath.sucesso.buffer;
                break;
            }
            default: {

                tracerBuffer.add(`O código de servoço ${numeroToHex(this.#campos.codigoServico, 1)} não foi encontrado no Builder CIP.`);

                retornoBuffer.erro.descricao = `O código de servoço ${numeroToHex(this.#campos.codigoServico, 1)} não foi encontrado no Builder CIP. Não será permitido a continuação da geração do Buffer.`;
                return retornoBuffer;
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
    ConnectionManager: {
        hex: 0x52,
        descricao: 'CIP Connection Manager'
    },
    PCCC: {
        hex: 0x4B,
        descricao: 'CIP PCCC'
    }
}