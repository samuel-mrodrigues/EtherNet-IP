import path from "path";
import fs from "fs";

/**
 * Um logger para log de eventos
 */
export class Logger {
    /**
     * Propriedades do Logger
     */
    propriedades = {
        /**
         * O nome decorativo do Logger
         */
        nome: '',
        /**
         * Opcionalmente um logger pai desse logger para concatenar logs
         * @type {Logger}
         */
        loggerPai: undefined,
        /**
         * Se deve habilitar o salvamento
         */
        isHabilitarSalvamento: false,
        /**
         * Se deve habilitar o log do console
         */
        isHabilitarMostrarConsole: false,
        /**
         * Caminho de salvamento dos logs. Esse caminho é relativo e não contém o caminho completo.
         */
        caminhoSalvamento: ''
    }

    /**
     * Instanciar um novo Logger
     * @param {String} nomeLogger - Um nome decorativo pro Logger. O nome será utilizado nos salvamentos.
     * @param {Object} propriedades - Propriedades do logger
     * @param {Object} propriedades.loggerPai - O logger pai desse logger atual(opcional)
     * @param {Boolean} propriedades.isHabilitaSalvamento - Se por padrão a geração dos logs devem ser salvas
     * @param {Boolean} propriedades.isHabilitarLogConsole - Se por padrão a geração dos logs devem ser mostradas no console
     * @param {String} propriedades.caminhoRelativoSalvamento - O caminho por padrão de salvamento. Ex /logs/ a continuação da pasta do log será utilizada pelo nome definido no nome do Logger.
     */
    constructor(nomeLogger, propriedades) {
        this.propriedades.nome = nomeLogger;

        if (propriedades != undefined) {
            if (propriedades.isHabilitaSalvamento) this.propriedades.isHabilitarSalvamento = true;
            if (propriedades.isHabilitarLogConsole) this.propriedades.isHabilitarMostrarConsole = true;
            if (propriedades.caminhoRelativoSalvamento != undefined) this.propriedades.caminhoSalvamento = propriedades.caminhoRelativoSalvamento;
            if (propriedades.loggerPai != undefined) this.propriedades.loggerPai = propriedades.loggerPai;
        }

        if (propriedades.loggerPai == undefined && propriedades.caminhoRelativoSalvamento == '') {
            throw new Error(`É obrigatório definir o logger pai ou caminho para salvamento dos logs.`)
        }
    }

    /**
     * Log uma mensagem no console
     * @param {String} msg - Mensagem para mostrar no console
     * @param {Object} parametros - Parâmetros adicionais para mostrar no console   
     * @param {Boolean} parametros.escreverNoArquivo - Se deve escrever no arquivo de log do store também
     * @param {Boolean} parametros.mostrarNoConsole - Se deve mostrar no console a mensagem do log
     */
    log(msg, parametros) {
        let parametrosDefinidos = {
            isDeveEscreverArquivo: this.propriedades.isHabilitarSalvamento,
            isDeveMostrarConsole: this.propriedades.isHabilitarMostrarConsole
        }

        if (parametros != undefined) {
            if (parametros.escreverNoArquivo != undefined) parametrosDefinidos.isDeveEscreverArquivo = parametros.escreverNoArquivo
            if (parametros.mostrarNoConsole != undefined) parametrosDefinidos.isDeveMostrarConsole = parametros.mostrarNoConsole
        }

        let conteudoMsg = '';
        if (typeof msg == 'object') {
            try {
                conteudoMsg = JSON.stringify(msg, null)
            } catch (ex) { }
        } else {
            conteudoMsg = msg.toString();
        }

        if (parametrosDefinidos.isDeveMostrarConsole) {
            this.logConsole(`${conteudoMsg}`);
        }

        if (parametrosDefinidos.isDeveEscreverArquivo) {
            this.logArquivo(`${conteudoMsg}`);
        }

    }

    /**
     * Salvar o log no arquivo
     */
    logArquivo(conteudo) {
        const diretorioParaSalvar = this.getSalvamentoDiretorio().completo;

        if (!fs.existsSync(path.dirname(diretorioParaSalvar))) {
            fs.mkdirSync(path.dirname(diretorioParaSalvar), { recursive: true });
        }
        fs.appendFileSync(diretorioParaSalvar, `[${this.getHora()}] -> ${conteudo}\n`, { encoding: 'utf-8' });
    }

    /**
     * Logar no console algum log
     * @param {String} conteudo 
     */
    logConsole(conteudo) {

        let sequenciaDeLogs = this.getSequenciaLoggers();

        console.log(`${this.getHora()} [${sequenciaDeLogs.join('->')}] ${conteudo}`);
    }

    /**
     * Retorna um array com a sequencia de loggers pais desse logger
     * @returns {[]}
     */
    getSequenciaLoggers() {
        let seq = []
        if (this.propriedades.loggerPai != undefined) {
            seq = seq.concat(this.propriedades.loggerPai.getSequenciaLoggers())
        }
        seq.push(this.propriedades.nome);
        return seq;
    }

    /**
     * Retorna onde o arquivo será salvo
     */
    getSalvamentoDiretorio() {
        let caminhoLogTxt = ``;

        if (this.getLoggerPai() != undefined) {
            caminhoLogTxt = `${this.getLoggerPai().getSalvamentoDiretorio().diretorio}`;

            if (this.propriedades.caminhoSalvamento != '') {
                caminhoLogTxt += `\\${this.propriedades.caminhoSalvamento}\\${this.propriedades.nome}`;
            } else {
                caminhoLogTxt += `\\${this.propriedades.nome}`
            }
        } else {
            caminhoLogTxt = path.resolve(`${this.propriedades.caminhoSalvamento}\\${this.getData()}`);
        }

        return {
            diretorio: caminhoLogTxt,
            nomeArquivo: `${this.propriedades.nome}.log`,
            completo: `${caminhoLogTxt}\\${this.propriedades.nome}.log`
        }
    }

    /**
     * Retonra uma string no formato hora:minuto:segundo
     */
    getHora() {
        const dataAgora = new Date();
        return `${dataAgora.getHours().toString().padStart(2, '0')}:${dataAgora.getMinutes().toString().padStart(2, '0')}:${dataAgora.getSeconds().toString().padStart(2, '0')}`;
    }

    /**
     * Retorna uma string no formato anomesdia
     */
    getData() {
        const dataAgora = new Date();
        return `${dataAgora.getFullYear()}${(dataAgora.getMonth() + 1).toString().padStart(2, '0')}${dataAgora.getDate().toString().padStart(2, '0')}`;
    }

    /**
     * Retorna o logger pai desse logger(se houver)
     * @returns {Logger}
     */
    getLoggerPai() {
        return this.propriedades.loggerPai;
    }
}