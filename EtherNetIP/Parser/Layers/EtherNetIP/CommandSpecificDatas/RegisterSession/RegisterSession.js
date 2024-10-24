/**
 * O Register Session possui um Command Specific Data com dois campos
 */

/**
 * Command Specific Data
 *      Protocol version      (UINT, 2 bytes, unsigned)           // Requested protocol version shall be set to 1
 *      Options flags         (UINT, 2 bytes, unsigned)           // Session options shall be set to 0
 *                                                               // Bits 0-7 are reserved for legacy (RA)
 *                                                               // Bits 8-15 are reserved for future expansion
 *                                                               // NOTE: This field is not the same as the option flags in the encapsulation header
 */

/**
 * Representação dos campos do Command Specific Data do comando Register Session
 */
export class CommandSpecificDataRegisterSession {

    /**
     * Detalhes se o Command Specific Data do comando Register Session é valido
     */
    #statusComando = {
        /**
         * Se está valido com todas as informações necessárias
         */
        isValido: false,
        /**
         * Se não é valido, motivo do erro
         */
        erro: {
            descricao: ''
        }
    }

    /**
     * Os campos contidos no Command Specific Data recebido do Buffer
     */
    #campos = {
        /**
         * Versão do protocolo de comunicação, segundo o manual sempre deve ser 1
         */
        protocolVersion: undefined,
        /**
         * Flags de opções da sessão, segundo o manual deve estar tudo como 0 
         */
        optionFlags: undefined
    }

    /**
     * Instanciar o payload do comando de Register Session
     * @param {Buffer} buffer - Opcionamente um buffer para dar parse no conteudo
     */
    constructor(buffer) {
        if (buffer != undefined) this.parseBuffer(buffer);
    }

    /**
     * Passa um Buffer do Command Specific Data do layer EtherNet/IP e faz o parse dos campos
     * @param {Buffer} buff - Buffer com os dados do Command Specific Data
     */
    parseBuffer(buff) {
        let retornoParse = {
            isSucesso: false,
            erro: {
                descricao: ''
            }
        }

        // O buffer deve ter no minimo 4 bytes.
        if (buff.length < 4) {
            this.#statusComando.erro.descricao = 'Buffer não contém os 4 bytes minimos do Command Specific Data do comando Register Session';

            retornoParse.erro.descricao = this.#statusComando.erro.descricao;
            return retornoParse;
        }

        const protocolVersion = buff.readUInt16LE(0);
        const optionFlags = buff.readUInt16LE(2);

        this.#campos.protocolVersion = protocolVersion;
        this.#campos.optionFlags = optionFlags;

        this.#statusComando.isValido = true;

        retornoParse.isSucesso = true;
        return retornoParse;
    }

    /**
     * Retorna se o comando esta formatado com todos os campos necessários corretos
     */
    isValido() {
        let retornoOk = {
            isValido: false,
            erro: {
                descricao: ''
            }
        }

        // Se algum campo ficou faltando, validar se não é valido
        if (!this.#statusComando.isValido) {
            retornoOk.erro.descricao = this.#statusComando.erro.descricao;
            return retornoOk;
        }

        // Se os campos forem validos, validar os campos
        if (this.#campos.protocolVersion != 1) {
            retornoOk.erro.descricao = `Protocol Version ${this.#campos.protocolVersion} não é suportado. Deve ser 1`;
            return retornoOk;
        }

        // Se os campos estão preenchidos e o protocol version for 1, ta tudo certo!
        retornoOk.isValido = true;
        return retornoOk;
    }

    /**
     * Retorna a versão do protocolo usada no encapsulamento. Deve sempre ser 1 segundo o manual.
     */
    getProtocolVersion() {
        return this.#campos.protocolVersion;
    }

    /**
     * Retorna os bits de flags opcionais setadas da sessão (atualmente não uso pra nada)
     */
    getOptionFlags() {
        return this.#campos.optionFlags;
    }
}