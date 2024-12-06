import { TraceLog } from "../../../../../../Utils/TraceLog.js";
import { hexDeBuffer, numeroToHex } from "../../../../../../Utils/Utils.js";
import { CIPGeneralStatusCodes, getStatusCode } from "../../../../../../Utils/CIPRespondeCodes.js";
import { CIPConnectionManagerParser } from "./Servicos/CIPConnectionManager/CIPConnectionManager.js";
import { CIPPCCCParser } from "./Servicos/CIPPCCC/CIPPCCC.js";

/**
 * O CIP Parser é responsavél por dar parse no layer CIP
 */
export class CIPSendRRDataParser {

    /**
     * Detalhes se esse Layer CIP é valido
     ** Esse campo indica se os bytes recebidos são validos e encaixam com o que é esperado. Mensagens de buffers retornadas com erro devido ao mau uso da classe ainda são consideradas válidas. Esse campo apenas indica se
     houver algum erro ao dar parse no buffer.
     */
    #statusCIP = {
        /**
         * Se o buffer está correto e foi retornado o codigo de status realizado com sucesso.
         */
        isValido: false,
        /**
         * Detalhes do erro ocorrido.
         */
        erro: {
            descricao: ''
        },
        /**
         * O tracer contém detalhes do parse do Buffer, util pra debugar.
         * @type {TraceLog}
         */
        tracer: undefined
    }

    /**
     * Status de campos recebidos
     */
    #campos = {
        /**
         * Detalhes do código de status contidos no cabeçalho do serviço CIP 
         */
        statusServico: {
            /**
             * 1 Byte do código de status
             * @type {Number}
             */
            codigo: undefined,
        },
        /**
         * Buffer contendo os dados do serviço solicitado
         * @type {Buffer}
         */
        bufferCompleto: undefined
    }

    /**
     * Instanciar o parser
     * @param {Buffer} buff - Buffer com os dados do layer CIP para dar parse
     */
    constructor(buff) {
        if (buff != undefined) this.parseBuffer(buff);
    }

    /**
     * Passar um Buffer com dados do layer CIP para dar parse
     * @param {Buffer} buff - Buffer com os dados do layer CIP
     */
    parseBuffer(buff) {
        const retornoBuffer = {
            /**
             * Se deu certo em dar parse nesse layer CIP
             */
            isSucesso: false,
            erro: {
                descricao: ''
            },
            /**
             * Tracer com detalhes do parse do buffer
             */
            tracer: new TraceLog()
        }

        this.#statusCIP.tracer = retornoBuffer.tracer;

        const tracerBuffer = retornoBuffer.tracer.addTipo(`CIP Parser`);

        tracerBuffer.add(`Iniciando parser de CIP para o Buffer: ${hexDeBuffer(buff)}, ${buff.length} bytes`);

        // O buffer precisa no minimo 3 bytes para ser um CIP válido
        if (buff.length < 3) {
            this.#statusCIP.isValido = false;
            this.#statusCIP.erro.descricao = `O buffer não contém ao minimo 3 bytes de dados suficientes para ser um CIP válido. Ele tem apenas ${buff.length} bytes`;

            retornoBuffer.erro.descricao = this.#statusCIP.erro.descricao;

            tracerBuffer.add(`O Buffer era esperado ter ao menos 3 bytes, mas tem apenas ${buff.length} bytes.`);
            return retornoBuffer;
        }

        // O status do serviço solicitado é armazenado 1 byte depois do código do serviço, por algum motivo tem um byte 0x00 entre o codigo de serviço e o status do serviço
        const statusServico = buff.readUInt8(2);
        this.#campos.statusServico.codigo = statusServico;
        let detalhesStatusCode = getStatusCode(statusServico);

        tracerBuffer.add(`Lendo o código de status do serviço solicitado: ${statusServico} (${numeroToHex(statusServico, 1)}) - ${detalhesStatusCode != undefined ? detalhesStatusCode.descricao : 'Status desconhecido'})`);

        // Pega todos os bytes restantes do buffer que contém os dados do serviço solicitado
        let bufferServicoDados = Buffer.alloc(0);

        // Se tiver algumas informações a mais no Buffer, incluir elas
        if (buff.length > 3) {
            // Eu vou pegar todos os bytes recebidos pra disponibilizar pro próximo layer necessario.
            bufferServicoDados = buff.subarray(0);
        } else {
            // Se não tiver mais nada, só mando um buffer vazio
            bufferServicoDados.writeUInt8(statusServico, 0);
        }

        tracerBuffer.add(`Buffer de dados relacionado ao serviço específico: ${hexDeBuffer(bufferServicoDados)}, ${bufferServicoDados.length} bytes`);

        // Salvar os bytes do serviço recebido
        this.#campos.bufferCompleto = bufferServicoDados;

        retornoBuffer.isSucesso = true;
        this.#statusCIP.isValido = true;

        tracerBuffer.add(`Parser de CIP finalizado!`);
        return retornoBuffer;
    }

    /**
     * Retorna se esse CIP encapsulado é valido, ou seja todos os campos foram corretamente parseados do Buffer.
     */
    isValido() {
        const retValido = {
            isValido: false,
            erro: {
                descricao: ''
            },
            /**
             * Tracer com detalhes do parse do buffer
             * @type {TraceLog}
             */
            tracer: undefined
        }

        retValido.tracer = this.#statusCIP.tracer;

        if (this.#statusCIP.isValido) {
            retValido.isValido = true;
        } else {
            retValido.erro.descricao = this.#statusCIP.erro.descricao;
        }
        return retValido;
    }

    /**
     * Retorna o status do cabeçalho CIP se obteve sucesso ou não nessa solicitação. Dependendo do conteudo do CIP, o status pode refletir no fracasso total da solicitação, como leitura de UMA tag, ou apenas indicar que parte do que foi solicitado deu erro no caso de leituras de multiplas TAGS e uma delas ocorreu um erro
     */
    getStatusCIP() {
        let retornoStatus = {
            codigo: undefined,
            descricao: ''
        }

        const detalhesCodigo = getStatusCode(this.#campos.statusServico.codigo);

        if (detalhesCodigo != undefined) {
            retornoStatus.codigo = this.#campos.statusServico.codigo;
            retornoStatus.descricao = detalhesCodigo.descricao;
        }

        return retornoStatus;
    }
    
    /**
     * Retorna se o CIP retornou o status de sucesso (0x00)
     */
    isStatusSucesso() {
        const retSucesso = {
            /**
             * Se o status retornado é o Sucesso (0x00)
             */
            isSucesso: false,
            /**
             * Se isSucesso for false, contém o erro retornado pelo CIP
             */
            erro: {
                codigo: '',
                descricao: ''
            }
        }

        if (this.#campos.statusServico.codigo == CIPGeneralStatusCodes.Success.hex) {
            retSucesso.isSucesso = true;
        } else {

            const detalhesStatusCode = getStatusCode(this.#campos.statusServico.codigo);

            retSucesso.erro.codigo = this.#campos.statusServico.codigo;

            if (detalhesStatusCode != undefined) {
                retSucesso.erro.descricao = detalhesStatusCode.descricao;
            } else {
                retSucesso.erro.descricao = 'Erro desconhecido';
            }
        }

        return retSucesso;
    }

    /**
     * Retorna o serviço com dados correspondentes ao CIP Connection Manager(Unconnected Messages)
     */
    getAsConnectionManager() {
        return new CIPConnectionManagerParser(this.#campos.bufferCompleto);
    }

    /**
     * Retorna o serviço com dados correspondentes ao CIP PCCC
     */
    getAsPCCC() {
        return new CIPPCCCParser(this.#campos.bufferCompleto);
    }   
}

