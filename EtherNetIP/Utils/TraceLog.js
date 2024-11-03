import { DateParaString } from "./Utils.js"

/**
 * A classe de Trace Log é usada pra registrar um trace de logs em uma sequencia desejada
 */
export class TraceLog {

    /**
     * @type {LogTipo[]}
     */
    #logs = []

    #incrementadorId = 0;
    #incrementadorTipoId = 0;

    #listener = {
        /**
         * @type {OnMensagemAdicionada[]}
         */
        onNovasMensagens: []
    }

    constructor() {
        return this;
    }

    /**
     * Adiciona um novo tipo de log pra organizar
     ** Se já existir um com o nome, ele só será retornado
     * @param {String} tipo - O nome pra dar pro log
     */
    addTipo(tipo) {
        let tipoLog = this.#logs.find(logTipo => logTipo.getTipo() == tipo);

        if (tipoLog == undefined) {
            tipoLog = new LogTipo(this, tipo);

            this.#logs.push(tipoLog);;
        }

        return tipoLog;
    }

    /**
     * @callback OnMensagemAdicionada
     * @param {String} mensagem - Mensagem adicionada
     */

    /**
     * Adicionar um callback para escutar novas mensagens adicionadas
     * @param {OnMensagemAdicionada} funcao - Função a ser chamada quando uma nova mensagem for adicionada
     */
    onMensagem(funcao) {
        this.#listener.onNovasMensagens.push(funcao);
    }

    /**
     * Dispara um evento de nova mensagem adicionada em qualquer tipo de log
     * @param {MensagemDeLogTipo} mensagemObj - Objeto de mensagem adicionada
     */
    disparaNovaMensagemAdicionada(mensagemObj) {
        for (const listener of this.#listener.onNovasMensagens) {
            listener(mensagemObj.mensagem);
        }
    }

    /**
     * Appenda os logs de outro TraceLog
     * @param {TraceLog} tracelogInst - Classe TraceLog
     */
    appendTraceLog(tracelogInst) {
        if (!(tracelogInst instanceof TraceLog)) {
            throw new Error('O parametro passado não é uma instancia de TraceLog');
        }


        /**
         * @typedef MsgDeLogOrganizar
         * @property {MensagemDeLogTipo} mensagem - Mensagem de log
         * @property {LogTipo} tipo - Tipo de log que essa mensagem pertence
         * @property {Number} sequenciaIdNova - Sequencia em que a mensagem será adicionada
         */

        /**
         * Armazena todas as mensagens do tracer anterior em sequencia que elas foram adicionadas independente do tipo do log
         * @type {MsgDeLogOrganizar[]}
         */
        let mensagensEmOrdemDoTracer = [];

        for (const mensagemTipo of tracelogInst.getLogs()) {
            for (const mensagem of mensagemTipo.getMensagens()) {
                mensagensEmOrdemDoTracer.push({
                    mensagem: mensagem,
                    tipo: mensagemTipo
                });
            }
        }

        // Ordenar as mensagens em ordem de sequencia que foram adicionadas
        mensagensEmOrdemDoTracer.sort((a, b) => a.mensagem.sequencia - b.mensagem.sequencia);

        // Agora passo por cada uma e adiciono em seu devido tipo de Log com uma nova numeração respeitando sua ordem anterior
        for (const mensagemDeLog of mensagensEmOrdemDoTracer) {

            let logTipoPertencente = this.#logs.find(logTipo => logTipo.getTipo() == mensagemDeLog.tipo.getTipo());

            // Se o log tipo não existir, adicionar 
            if (logTipoPertencente == undefined) {

                logTipoPertencente = this.addTipo(mensagemDeLog.tipo.getTipo());
                mensagemDeLog.sequenciaIdNova = logTipoPertencente.getSequenciaID();
            }

            // Adicionar a mensagem ao tipo de log
            logTipoPertencente.add(mensagemDeLog.mensagem.mensagem, mensagemDeLog.mensagem.data);
        }

        // Passar pelos tipos de logs contidos nesse outro Trace, do mais antigo pro mais novo
        // for (const tipoLog of tracelogInst.getLogs().sort((a, b) => a.getSequenciaID() - b.getSequenciaID())) {

        //     // Encontrar o proximo nome disponivel
        //     let isProcurandoNome = true;
        //     let idIncremental = 0;
        //     let novoNomeTipo = tipoLog.getTipo();

        //     while (isProcurandoNome) {
        //         let existeLogComNome = this.#logs.find(logTipo => logTipo.getTipo() == novoNomeTipo);

        //         // Se já existir, adicionar um incremental
        //         if (existeLogComNome != undefined) {
        //             idIncremental++;
        //             novoNomeTipo = `${tipoLog.getTipo()} (Cópia ${idIncremental})`;
        //         } else {
        //             // Se não existir, nome pode ser usado
        //             isProcurandoNome = false;
        //         }
        //     }

        //     let novoTracerAppend = new LogTipo(this, novoNomeTipo);
        //     this.#logs.push(novoTracerAppend);

        //     // Atribuir o novo ID a partir do incremental atual
        //     for (const mensagemDoTipo of tipoLog.getMensagens()) {
        //         novoTracerAppend.add(mensagemDoTipo.mensagem, mensagemDoTipo.data);
        //     }
        // }

        return this;
    }

    /**
     * Incrementa o ID da mensagem de log
     */
    incrementadorMensagemProximo() {
        this.#incrementadorId++;
        return this.#incrementadorId;
    }

    /**
     * Incrementa o ID do tipo de log
     */
    incrementadorIdTipoProximo() {
        this.#incrementadorTipoId++;
        return this.#incrementadorTipoId;
    }

    /**
     * Retorna os logs tipos já armazenados
     */
    getLogs() {
        return this.#logs;
    }

    /**
     * Retorna todas as mensagens já salvas
     * @param {Boolean} isCrescente - Se deve retornar em ordem crescente(por padrão retorna decrescente se não informado o parametro)
     */
    getHistoricoOrdenado(isCrescente) {
        let mensagensOrdenadas = [];

        for (const logTipo of this.#logs) {
            let isProcurandoSequencia = true
            let indexSeqAtual = logTipo.getSequenciaID();
            let sequenciasDeTiposLogs = []

            while (isProcurandoSequencia) {

                // Achar a sequencia desse tipo de log, por exemplo se tiver 3 logs na sequencia [Gerador], [Teste1] [Teste2] e essa mensagem for do Teste2, a sequencia deve retornar [Gerador], [Teste1]
                let existeSeqAnterior = this.#logs.find(logAnt => logAnt.getSequenciaID() == (indexSeqAtual - 1))

                // Se existe uma seq anterior a essa, salvar
                if (existeSeqAnterior) {
                    sequenciasDeTiposLogs.push(existeSeqAnterior.getTipo());
                    indexSeqAtual--;
                } else {
                    // Chegou na última
                    isProcurandoSequencia = false;
                }
            }

            sequenciasDeTiposLogs.reverse();

            for (const mensagem of logTipo.getMensagens()) {
                mensagensOrdenadas.push({
                    sequenciaId: mensagem.sequencia,
                    sequenciaDoTipoLog: sequenciasDeTiposLogs,
                    sequenciaTipo: logTipo.getTipo(),
                    data: mensagem.data,
                    mensagem: mensagem.mensagem
                });
            }
        }

        return mensagensOrdenadas.sort((a, b) => {
            if (isCrescente) {
                return a.sequenciaId - b.sequenciaId;
            } else {
                return b.sequenciaId - a.sequenciaId;
            }
        }).map(mensagem => {

            let msgLog = `${DateParaString(mensagem.data, '%dia%/%mes%/%ano% %hora%:%minuto%:%segundo%:%milissegundo%')}`;

            let sequenciaDeTiposAnteriores = mensagem.sequenciaDoTipoLog.concat();

            sequenciaDeTiposAnteriores.push(mensagem.sequenciaTipo);

            if (sequenciaDeTiposAnteriores.length != 0) {

                msgLog += ` [`;
                let isFirst = true;
                for (const tipoAnterior of sequenciaDeTiposAnteriores) {

                    if (!isFirst) {
                        msgLog += `>`;
                    }

                    msgLog += `${tipoAnterior}`;
                    isFirst = false;
                }
                msgLog += `]`;
            }

            msgLog += `: ${mensagem.mensagem}`;
            return msgLog;
        });
    }
}

/**
 * @typedef MensagemDeLogTipo
 * @property {String} mensagem - Mensagem do log
 * @property {Date} data - Data em que a mensagem foi adicionada
 * @property {Number} sequencia - Sequencia unica em que a mensagem foi adicionada
 */

class LogTipo {

    /**
     * @type {TraceLog}
     */
    #instanciaTracer;

    /**
     * Tipo do log
     */
    #tipo;

    /**
     * @type {MensagemDeLogTipo[]}
     */
    #mensagens = []

    #sequenciaAdicionado = -1;

    constructor(tracer, tipo) {
        this.#instanciaTracer = tracer;
        this.#tipo = tipo;
        this.#sequenciaAdicionado = this.#instanciaTracer.incrementadorIdTipoProximo();
    }

    /**
     * Retorna a sequencia ID em que esse log foi adicionado
     */
    getSequenciaID() {
        return this.#sequenciaAdicionado;
    }

    /**
     * Nome do tipo desse log
     */
    getTipo() {
        return this.#tipo;
    }

    /**
     * Adiciona uma mensagem de log ao trace
     * @param {String} msg - Mensagem para adicionar
     * @param {Date} dat - Data em que a mensagem foi adicionado(opcional) 
     */
    add(msg, dat) {
        let conteudoMsg = '';
        if (typeof msg == 'object') {
            conteudoMsg = JSON.stringify(msg);
        } else {
            conteudoMsg = msg;
        }

        this.#mensagens.push({
            data: dat != undefined && dat instanceof Date ? dat : new Date(),
            sequencia: this.#instanciaTracer.incrementadorMensagemProximo(),
            mensagem: conteudoMsg,
        })

        this.#instanciaTracer.disparaNovaMensagemAdicionada(this.#mensagens[this.#mensagens.length - 1]);

        return this;
    }

    /**
     * Retorna as mensagens de log
     */
    getMensagens() {
        return this.#mensagens;
    }
}

// let traceLog = new TraceLog();

// const logBuff = traceLog.addTipo('EtherNetIP Bufers');

// logBuff.add(`Iniciando criação do buffer`)
// logBuff.add(`Ajeitando um bagulho`)
// logBuff.add(`Ajeitando outro bagulho`)
// logBuff.add(`Ajeitando mais um bagulho`)

// const logGeraTeste = new TraceLog();

// const logTeste = logGeraTeste.addTipo('Gerador Teste')

// logTeste.add(`Iniciando teste`)
// logTeste.add(`Teste 1`)
// logTeste.add(`Teste 2`)
// logTeste.add(`Teste 3`)
// logTeste.add(`Teste 4`)

// const logCabra = new TraceLog();
// const logCobraTeste = logCabra.addTipo('Cobra Teste');

// logCobraTeste.add('Meeeeeeh')
// logCobraTeste.add('Meeeeeeh 2')
// logCobraTeste.add('Meeeeeeh 3')

// logGeraTeste.appendTraceLog(logCabra);

// traceLog.appendTraceLog(logGeraTeste);

// logBuff.add(`Finalizando criação do buffer`)

// let logmsg = traceLog.getHistoricoOrdenado()

// console.log(logmsg);

