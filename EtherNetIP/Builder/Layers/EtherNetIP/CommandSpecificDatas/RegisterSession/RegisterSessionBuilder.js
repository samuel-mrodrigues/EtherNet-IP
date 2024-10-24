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
 * Montagem de um comando Command Specific Data para o tipo de comando RegisterSession
 */
export class CommandSpecificDataRegisterSessionBuilder {

    /**
     * Campos contidos no Command Specific Data do comando Register Session
     */
    #campos = {
        /**
         * Versão do protocolo de comunicação, segundo o manual sempre deve ser 1
         * @type {Number}
         */
        protocolVersion: undefined,
        /**
         * Flags de opções da sessão, segundo o manual deve estar tudo como 0
         * @type {Buffer}
         */
        optionFlags: undefined
    }

    /**
     * Instanciar o builder
     * @param {Object} parametros - Opcionalmente iniciar o construtor já com os campos desejados no RegisterSession
     * @param {Number} parametros.protocolVersion - Versão do protocolo de encapsulamento. Segundo o manual sempre deve ser 1
     * @param {Number} parametros.optionFlags - Flags de opções envidas para configurar a sessão. Não sei exatamente oq é ainda, mas geralmente é sempre 0
     */
    constructor(parametros) {

        const valoresPadroes = {
            optionFlagPadrao: () => {
                this.#campos.optionFlags = 0x00000000;
            },
            protocolPadrao: () => {
                this.#campos.protocolVersion = 1;
            }
        }

        // Se o usuario informou um objeto valido, preencher os parametros automaticamente
        if (parametros != undefined && typeof parametros == 'object') {

            // Validar o protocol version
            if (parametros.protocolVersion != undefined) {
                if (parametros.protocolVersion != 1) throw new Error(`A versão do protocolo de comunicação deve ser 1`);

                this.#campos.protocolVersion = parametros.protocolVersion
            }

            // Validar o option flags. Ainda não sei exatamente oq vai nela então só sei que tem que ser um buffer onde cada bit 1 indica uma configuração
            if (parametros.optionFlags != undefined) {
                if (!(parametros.optionFlags instanceof Buffer)) throw new Error(`As flags de opções devem ser um Buffer com os bits setados`);
                if (parametros.optionFlags.length != 2) throw new Error(`As flags de opções devem ser um Buffer de 2 bytes`)

                this.#campos.optionFlags = parametros.optionFlags;
            }
        }

        if (this.#campos.optionFlags == undefined) valoresPadroes.optionFlagPadrao();
        if (this.#campos.protocolVersion == undefined) valoresPadroes.protocolPadrao();

        return this;
    }

    /**
     * Define a versão do protocolo de encapsulamento
     * @param {Number} protocolVersion - Numero do protocolo de encapsulamento. Segundo o manual sempre deve ser 1
     */
    setProtocolVersion(protocolVersion) {
        if (protocolVersion != 1) throw new Error(`A versão do protocolo de comunicação deve ser 1. Não há escolha kkkkk.`);

        this.#campos.protocolVersion = protocolVersion;

        return this;
    }

    /**
     * Define o campo Option Flags
     * @param {Buffer} buff - Um buffer de 2 bytes configurado com os bits habilitados.
     */
    setOptionFlags(buff) {
        if (!(buff instanceof Buffer)) throw new Error(`Os flags de opções devem ser um Buffer com os bits setados`);
        if (buff.length != 2) throw new Error(`O buffer de flags de opções deve ter 2 bytes`);

        this.#campos.optionFlags = buff;

        return this;
    }

    /**
     * Constroi um Buffer de 4 bytes com os campos do Command Specific Data de Register Session
     ** Primeiros 2 Bytes: Protocol Version
     ** Próximos 2 Bytes: Option Flags
     * @param {Object} parametros - (Opcional) Opções para construir o buffer com os campos configurados desejados. Não informe a menos que queira sobrescrever os campos definidos anteriormente via construtor ou metodos
     * @param {Number} parametros.protocolVersion - Versão do protocolo de comunicação, segundo o manual sempre deve ser 1
     * @param {Number} parametros.optionFlags - Flags de opções da sessão, segundo o manual deve estar tudo como 0
     */
    criarBuffer(parametros) {
        const retornoBuff = {
            isSucesso: false,
            sucesso: {
                /**
                 * Buffer de 4 bytes do Command Specific Data
                 * @type {Buffer}
                 */
                buffer: undefined
            },
            erro: {
                descricao: ''
            }
        }

        // O buffer tem que ser de 4 bytes. 2 Bytes do protocol version e + 2 bytes do flags de sessão
        const buff = Buffer.alloc(4);

        // O payload do Command Specific Data do RegisterSession tem só dois campos que nunca mudam os valores
        if (parametros != undefined) {
            if (parametros.flagsDeSessao != undefined) {
                this.setOptionFlags(parametros.flagsDeSessao);
            }

            if (parametros.protocolVersion != undefined) {
                this.setProtocolVersion(parametros.protocolVersion);
            }
        }

        buff.writeUInt16LE(this.#campos.protocolVersion, 0);
        buff.writeUInt16LE(this.#campos.optionFlags, 2);

        retornoBuff.isSucesso = true;
        retornoBuff.sucesso.buffer = buff;

        return retornoBuff;
    }
}