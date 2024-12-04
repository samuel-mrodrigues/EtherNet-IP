import { getStatusCode } from "../../../../../../../../Utils/CIPRespondeCodes.js";
import { TraceLog } from "../../../../../../../../Utils/TraceLog.js";
import { hexDeBuffer, numeroToHex } from "../../../../../../../../Utils/Utils.js";
import { ServicoGenericoParser } from "./ServicoGenerico/ServicoGenerico.js";
import { MultipleServicePacketParser } from "./MultipleServicePacket.js";
import { SingleServicePacketParser } from "./SingleServicePacket.js";


export class CIPConnectionManagerParser {

    /**
     * Detalhes se esse Layer CIP é valido
     ** Esse campo indica se os bytes recebidos são validos e encaixam com o que é esperado. Mensagens de buffers retornadas com erro devido ao mau uso da classe ainda são consideradas válidas. Esse campo apenas indica se
     houver algum erro ao dar parse no buffer.
     */
    #statusConnectionManager = {
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
         * Código do servio do CIP
         * @type {Number}
         */
        codigoServico: undefined,
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
         */
        bufferPacketdata: undefined
    }

    /**
     * Instanciar o parser
     * @param {Buffer} buff - Buffer com os dados do layer CIP para dar parse
     */
    constructor(buff) {
        if (buff != undefined) this.parseBuffer(buff);
    }

    /**
     * Passar um Buffer com dados do layer que combinem com o Connection Manager.
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

        this.#statusConnectionManager.tracer = retornoBuffer.tracer;

        const tracerBuffer = retornoBuffer.tracer.addTipo(`CIP Connection Manager`);

        tracerBuffer.add(`Iniciando parser de CIP Connection Manager para o Buffer: ${hexDeBuffer(buff)}, ${buff.length} bytes`);

        // O buffer precisa no minimo 3 bytes para ser um CIP válido
        if (buff.length < 3) {
            this.#statusConnectionManager.isValido = false;
            this.#statusConnectionManager.erro.descricao = `O buffer não contém ao minimo 3 bytes de dados suficientes para ser um CIP válido. Ele tem apenas ${buff.length} bytes`;

            retornoBuffer.erro.descricao = this.#statusConnectionManager.erro.descricao;

            tracerBuffer.add(`O Buffer era esperado ter ao menos 3 bytes, mas tem apenas ${buff.length} bytes.`);
            return retornoBuffer;
        }

        // O primeiro byte contém o código do serviço solicitado no CIP

        // Pego os 7 bits menos significativos que indicam o código do serviço, pois o 1 bit indica se é requisição(0) ou resposta(1)
        const codigoService = buff.readUInt8(0) & 0x7F;
        this.#campos.codigoServico = codigoService;

        const tipoServicoSolicitado = getService(codigoService);

        tracerBuffer.add(`Lendo o código de serviço solicitado: ${codigoService} (${numeroToHex(codigoService, 1)}) - ${tipoServicoSolicitado != undefined ? tipoServicoSolicitado.descricao : 'Serviço desconhecido'})`);

        // O status do serviço solicitado é armazenado 1 byte depois do código do serviço, por algum motivo tem um byte 0x00 entre o codigo de serviço e o status do serviço
        const statusServico = buff.readUInt8(2);
        this.#campos.statusServico.codigo = statusServico;
        let detalhesStatusCode = getStatusCode(statusServico);

        tracerBuffer.add(`Lendo o código de status do serviço solicitado: ${statusServico} (${numeroToHex(statusServico, 1)}) - ${detalhesStatusCode != undefined ? detalhesStatusCode.descricao : 'Status desconhecido'})`);

        // Pega todos os bytes restantes do buffer que contém os dados do serviço solicitado. Que nesse cao, seria um SingleService ou MultipleService
        let bufferServicoDados = Buffer.alloc(1);

        // Se tiver algumas informações a mais no Buffer, incluir elas
        if (buff.length > 3) {
            bufferServicoDados = buff.subarray(2);
        } else {
            // Se não tiver mais nada, só mando um buffer vazio
            bufferServicoDados.writeUInt8(statusServico, 0);
        }

        tracerBuffer.add(`Buffer de dados relacionado ao serviço específico: ${hexDeBuffer(bufferServicoDados)}, ${bufferServicoDados.length} bytes`);

        // Salvar os bytes do serviço recebido
        this.#campos.bufferPacketdata = bufferServicoDados;

        retornoBuffer.isSucesso = true;
        this.#statusConnectionManager.isValido = true;

        tracerBuffer.add(`Parser do CIP Connection Manager finalizado!`);
        return retornoBuffer;
    }

    /**
     * Retorna se esse Connection Manager encapsulado é valido, ou seja todos os campos foram corretamente parseados do Buffer.
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

        retValido.tracer = this.#statusConnectionManager.tracer;

        if (this.#statusConnectionManager.isValido) {
            retValido.isValido = true;
        } else {
            retValido.erro.descricao = this.#statusConnectionManager.erro.descricao;
        }
        return retValido;
    }

    /**
    * Retorna se o comando recebido corresponde ao serviço de Single Service Packet
    */
    isSingleServicePacket() {
        return (this.#campos.codigoServico & 0xF0) == (Servicos.SingleServicePacket.hex & 0xF0);
    }

    /**
     * Retorna o serviço como SingleServicePacket
     */
    getAsSingleServicePacket() {
        if (this.isSingleServicePacket()) {
            return new SingleServicePacketParser(this.#campos.bufferPacketdata);
        }
    }

    /**
     * Retorna se o comando recebido corresponde ao serviço de Multiple Service Packet
     */
    isMultipleServicePacket() {
        return this.#campos.codigoServico == Servicos.MultipleServicePacket.hex;
    }

    /**
     * Retorna o serviço como MultipleServicePacket
     */
    getAsMultipleServicePacket() {
        if (this.isMultipleServicePacket()) {
            return new MultipleServicePacketParser(this.#campos.bufferPacketdata);
        }
    }

    /**
     * Retorna o serviço como Generico, sem aplicar nenhuma tratativa muito diferente dos outros tipos
     */
    getAsServicoGenericoPacket() {
        return new ServicoGenericoParser(this.#campos.bufferPacketdata);
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

/**
 * Retorna o serviço pelo código HEX se existir
 * @param {Number} hex 
 */
export function getService(hex) {
    return Object.values(Servicos).find(servico => servico.hex == hex);
}