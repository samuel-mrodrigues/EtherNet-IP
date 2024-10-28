/**
 * O serviço Classe (0x52) é usado quando o serviço a ser solicitado no layer CIP atual aponta para uma classe e instancia. Por exemplo, solicitar o Connection Manager para envio de algum comando CIP.
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
        instancia: undefined
    }

    /**
     * Instanciar o construtor do serviço Classe -> Instancia
     * @param {Object} parametros - Parametros para instanciar o serviço Classe com a classe e instancia desejados
     * @param {Buffer} parametros.classe - Classe que será solicitada (Exemplo: Connection Manager: 0x06)
     * @param {Buffer} parametros.instancia - Numero da instancia da classe solicitada (Exemplo: 0x01)
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
                buffer: undefined,
                /**
                 * O tamanho em WORDs do Request Path
                 */
                tamanhoWords: undefined
            },
            erro: {
                descricao: ''
            }
        }

        const buff = Buffer.alloc(this.#campos.classe.length + this.#campos.instancia.length);

        // Inserir os bytes da classe
        this.#campos.classe.copy(buff, 0);

        // Inserir os bytes da instancia
        this.#campos.instancia.copy(buff, this.#campos.classe.length);

        retBuff.isSucesso = true;
        retBuff.sucesso.buffer = buff;
        retBuff.sucesso.tamanhoWords = buff.length / 2;

        return retBuff;
    }
}