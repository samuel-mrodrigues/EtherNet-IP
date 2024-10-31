import { CIPGeneralStatusCodes, getStatusCode } from "../../../../../../../Utils/CIPRespondeCodes.js";

/**
 * A classe SingleServicePacket é responsavél por dar parse num Buffer de Serviço unico
 */
export class SingleServicePacketParser {

    /**
     * Se esse SingleServicePacket é valido
     ** Esse campo indica se os bytes recebidos são validos e encaixam com o que é esperado. Mensagens de buffers retornadas com erro devido ao mal uso da classe ainda são consideradas válidas. Esse campo apenas indica se
     houver algum erro ao dar parse no buffer.
     */
    #statusServico = {
        isValido: false,
        erro: {
            descricao: ''
        }
    }

    /**
     * Os campos que foram recebidos na resposta
     */
    #campos = {
        /**
         * Código de status da operação(se deu certo, erro de path, etc...)
         */
        codigoStatus: undefined,
        /**
         * Geralmente, SingleServicePacket retorna um CIP Class Generic, com o Command Specific Data do que foi solicitado.
         * @type {Buffer}
         */
        commandSpecificData: undefined
    }

    /**
     * Instanciar o parser
     * @param {Buffer} buffer - Buffer com os dados do layer CIP para dar parse
     */
    constructor(buffer) {
        if (buffer != undefined) this.parseBuffer(buffer);
    }

    /**
     * Passar um Buffer com dados do layer de serviço para dar parse
     * @param {Buffer} buff - Buffer com os dados do layer de serviço 
     */
    parseBuffer(buff) {
        const retBuff = {
            isSucesso: false,
            erro: {
                descricao: ''
            }
        }

        // Precisa ser pelo menos 2 bytes que é o codigo de status + additional status size
        if (buff.length < 2) {
            this.#statusServico.erro.descricao = `'Buffer de serviço não contém os 2 bytes minimos'`;
            this.#statusServico.isValido = false;

            retBuff.erro.descricao = this.#statusServico.erro.descricao;
            return retBuff;
        }

        // Primeiro 1 bytes é o codigo de status
        this.#campos.codigoStatus = buff.readUInt8(0);

        // Próximo 1 byte é o additional status size em WORDS que na maioria pelo que vi sempre é 0
        let additionalStatusEmWords = buff.readUInt8(1);

        // Validar se o status devolvido é valido
        let getStatusSinglePacket = getStatusCode(this.#campos.codigoStatus);
        if (getStatusSinglePacket == undefined) {
            this.#statusServico.isValido = false;
            this.#statusServico.erro.descricao = `Código de status do Single Service Packet recebido: '${this.#campos.codigoStatus}' não é um código de status válido. `;

            retBuff.erro.descricao = this.#statusServico.erro.descricao;
            return retBuff;
        }

        // Setar como valido
        this.#statusServico.isValido = true;

        // Salvar o buffer do Command Specific Generic especifico depois do Status Code
        this.#campos.commandSpecificData = buff.subarray(2);

        retBuff.isSucesso = true;
        return retBuff;
    }

    /**
     * Retorna se esse SingleServicePacket é valido, ou seja todos os campos foram corretamente parseados do Buffer.
     */
    isValido() {
        const retValido = {
            isValido: false,
            erro: {
                descricao: ''
            }
        }

        if (this.#statusServico.isValido) {
            retValido.isValido = true
        } else {
            retValido.erro.descricao = this.#statusServico.erro.descricao;
        }

        return retValido;
    }

    /**
     * Retorna o status de esse SingleServicePacket obteve sucesso na sua solicitação
     ** Lembre-se de validar se o comando é valido antes de chamar esse método
     */
    isStatusSucesso() {
        let retSucesso = {
            /**
             * Retorna se esse Service foi executado com sucesso
             */
            isSucesso: false,
            erro: {
                descricao: '',
                codigoStatus: '',
                descricaoStatus: ''
            }
        }

        const statusAtual = this.getStatus();
        if (statusAtual.codigoStatus == CIPGeneralStatusCodes.Success) {
            retSucesso.isSucesso = true;
        } else {
            retSucesso.erro.descricao = `O status do serviço solicitado não foi bem sucedido. Código de status: ${statusAtual.codigoStatus} - ${statusAtual.descricaoStatus}`;

            retSucesso.erro.codigoStatus = statusAtual.codigoStatus;
            retSucesso.erro.descricaoStatus = statusAtual.descricaoStatus;
        }

        return retSucesso;
    }

    /**
     * Retorna o status atual ocorrido nesse serviço solicitado.
     */
    getStatus() {
        let retornoCodigo = {
            /**
             * Código de status do serviço solicitado
             */
            codigoStatus: this.#campos.codigoStatus,
            /**
             * Descrição do código de status do serviço solicitado
             */
            descricaoStatus: ''
        }

        let status = getStatusCode(this.#campos.codigoStatus);
        if (status != undefined) {
            retornoCodigo.descricaoStatus = status.descricao;
        } else {
            retornoCodigo.descricaoStatus = `Código de status do Single Service Packet recebido: '${this.#campos.codigoStatus}' não é um código de status válido. `;
        }

        return retornoCodigo;
    }

    /**
     * Retorna inteiramente o Buffer retornado do Command Specific Data
     */
    getAsCIPClassCommandSpecificData() {
        return this.#campos.commandSpecificData;
    }
}