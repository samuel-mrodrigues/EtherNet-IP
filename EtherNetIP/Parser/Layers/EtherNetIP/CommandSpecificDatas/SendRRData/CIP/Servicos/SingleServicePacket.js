/**
 * A classe SingleServicePacket é responsavél por dar parse num Buffer de Serviço unico
 */
export class SingleServicePacketParser {

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

        if (buff.length < 0) {
            retBuff.erro.descricao = 'Buffer de serviço vazio';

            this.#statusServico.erro.descricao = retBuff.erro.descricao;
            this.#statusServico.isValido = false;
            return retBuff;
        }

        // Setar o buffer do serviço
        this.#statusServico.isValido = true;

        // Salvar o buffer do Command Specific Generic especifico
        this.#campos.commandSpecificData = buff;

        retBuff.isSucesso = true;
        return retBuff;
    }

    /**
     * Retorna inteiramente o Buffer retornado do Command Specific Data
     */
    getAsCIPClassCommandSpecificData() {
        return this.#campos.commandSpecificData;
    }
}