/**
 * O serviço Classe é usado pra solicitar outros serviços em geral que não possuem um builder dedicado a eles. É algo mais manual.
 */
export class ClasseServiceBuilder {

    /**
     * Campos necessarios para o serviço Classe
     */
    #campos = {
        /**
         * A classe que será solicitada do dispositivo
         * @type {Buffer}
         */
        classe: undefined,
        /**
         * Numero da instancia da classe solicitada.
         * @type {Buffer}
         */
        instancia: undefined,
        /**
         * Código de serviço solicitado
         * @type {Number}
         */
        codigoServico: undefined
    }

    /**
     * Instanciar o construtor do serviço Classe -> Instancia
     * @param {Object} parametros - Parametros para instanciar o serviço Classe com a classe e instancia desejados
     * @param {Buffer} parametros.classe - Classe que será solicitada (Exemplo: Connection Manager: 0x06)
     * @param {Buffer} parametros.instancia - Numero da instancia da classe solicitada (Exemplo: 0x01)
     * @param {Number} parametros.servicoCode - Código do serviço solicitado
     */
    constructor(parametros) {
        if (parametros != undefined && typeof parametros == 'object') {

            if (parametros.classe == undefined) throw new Error('Classe não pode ser nula');
            if (parametros.instancia == undefined) throw new Error('Instancia não pode ser nula');

            if (!(parametros.classe instanceof Buffer)) throw new Error('Classe precisa ser um Buffer de bytes com a representação da classe desejada');
            if (!(parametros.instancia instanceof Buffer)) throw new Error('Instancia precisa ser um Buffer de bytes com a representação da instancia desejada');

            this.setClasse(parametros.classe);
            this.setInstancia(parametros.instancia);
        }

        return this;
    }

    /**
     * Setar a Classe desejado no dispositivo remoto. Exemplo: Connection Manager: 0x06
     * @param {Buffer} classe - Um buffer representando o caminho da classe
     */
    setClasse(classe) {
        if (classe == undefined) throw new Error('Classe não pode ser nula');
        if (!(classe instanceof Buffer)) throw new Error('Classe precisa ser um Buffer de bytes com a representação da classe desejada');

        this.#campos.classe = classe;

        return this;
    }

    /**
     * Setar a instancia desejada da classe solicitada no dispositivo remoto. Exemplo: 0x01 seria a instancia original da classe atual setada, é necessario pois algumas classes podem ter varias instancias.
     * @param {Buffer} instancia - Um buffer representando o caminho da instancia da classe
     */
    setInstancia(instancia) {
        if (instancia == undefined) throw new Error('Instancia não pode ser nula');
        if (!(instancia instanceof Buffer)) throw new Error('Instancia precisa ser um Buffer de bytes com a representação da instancia desejada');

        this.#campos.instancia = instancia;

        return this;
    }

    /**
     * Setar o código de serviço solicitado
     * @param {Number} number - Numero do codigo de serviço, tipo 0x4c, 0x01, etc... dependo do serviço 
     */
    setCodigoServico(cod) {
        if (cod == undefined) throw new Error('Código de serviço não pode ser nulo');

        this.#campos.codigoServico = cod;

        return this;
    }

    /**
     * Criar o buffer Request Path para o serviço Classe
     */
    criarBuffer() {
        const retBuff = {
            isSucesso: false,
            sucesso: {
                /**
                 * O Buffer gerado com as informações da classe e instancia solicitados
                 * @type {Buffer}
                 */
                buffer: undefined
            },
            erro: {
                descricao: ''
            }
        }


        // O buffer do cabeçalho do serviço
        const bufferCabecalho = Buffer.alloc(2);

        // O 1 byte do cabeçalho é o código do service
        bufferCabecalho.writeUInt8(this.#campos.codigoServico, 0);

        // O 2 byte é o tamanho do Request Path abaixo em words
        bufferCabecalho.writeUInt8(Math.ceil((this.#campos.instancia.length + this.#campos.classe.length) / 2), 1);

        // O Request Path solicitado
        const bufferRequestPath = Buffer.alloc(this.#campos.instancia.length + this.#campos.classe.length);

        // Seta os bytes da classe e instancia no buffer
        this.#campos.classe.copy(bufferRequestPath, 0);
        this.#campos.instancia.copy(bufferRequestPath, this.#campos.classe.length);

        let bufferCompleto = Buffer.concat([bufferCabecalho, bufferRequestPath]);

        retBuff.isSucesso = true;
        retBuff.sucesso.buffer = bufferCompleto;

        return retBuff;
    }
}

export const CodigosDeServicoClasses = {

}