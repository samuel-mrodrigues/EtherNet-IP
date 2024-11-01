import { TraceLog } from "../../../../../../../../Utils/TraceLog";
import { hexDeBuffer } from "../../../../../../../../Utils/Utils";

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
            },
            /**
             * O trace contendo o log da etapa de criação do buffer
             * @type {TraceLog}
             */
            tracer: new TraceLog()
        }

        const tracerBuffer = retBuff.tracer.addTipo('Classe Generica');

        // O buffer do cabeçalho do serviço
        const bufferCabecalho = Buffer.alloc(2);

        tracerBuffer.addLog(`Criando buffer do cabeçalho do serviço de ${bufferCabecalho.length} bytes`);

        // O 1 byte do cabeçalho é o código do service
        bufferCabecalho.writeUInt8(this.#campos.codigoServico, 0);
        tracerBuffer.add(`Setando o campo de código de serviço para ${hexDeBuffer(bufferCabecalho)} no offset 0`);

        // O 2 byte é o tamanho do Request Path abaixo em words
        bufferCabecalho.writeUInt8(Math.ceil((this.#campos.instancia.length + this.#campos.classe.length) / 2), 1);
        tracerBuffer.add(`Setando o campo de tamanho do Request Path para ${hexDeBuffer(bufferCabecalho)} no offset 1`);

        tracerBuffer.add(`Buffer do cabeçalho do serviço criado com sucesso: ${hexDeBuffer(bufferCabecalho)}`);

        // O Request Path solicitado
        const bufferRequestPath = Buffer.alloc(this.#campos.instancia.length + this.#campos.classe.length);
        tracerBuffer.add(`Criando buffer do Request Path do serviço de ${bufferRequestPath.length} bytes`);

        // Seta os bytes da classe e instancia no buffer
        this.#campos.classe.copy(bufferRequestPath, 0);
        tracerBuffer.add(`Setando o campo de classe para ${hexDeBuffer(bufferRequestPath)} no offset 0`);

        this.#campos.instancia.copy(bufferRequestPath, this.#campos.classe.length);
        tracerBuffer.add(`Setando o campo de instancia para ${hexDeBuffer(this.#campos.instancia)} no offset ${this.#campos.classe.length}`);

        tracerBuffer.add(`Buffer do Request Path do serviço criado com sucesso: ${hexDeBuffer(bufferRequestPath)}`);

        let bufferCompleto = Buffer.concat([bufferCabecalho, bufferRequestPath]);

        tracerBuffer.add(`Buffer final do Cabeçalho + Request Path: ${hexDeBuffer(bufferCompleto)}`);

        retBuff.isSucesso = true;
        retBuff.sucesso.buffer = bufferCompleto;

        return retBuff;
    }
}

export const CodigosDeServicoClasses = {

}