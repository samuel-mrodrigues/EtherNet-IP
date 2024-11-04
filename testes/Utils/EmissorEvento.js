
/**
 * @typedef AcoesListener
 * @property {Function} excluir - Chama essa função para excluir o callback cadastrado
 * @property {String} nomeEvento - Nome do evento em que o callback foi cadastrado
 * @property {Number} idExecucao - ID do callback cadastrado. Usado para solicitar a remoção
 */

/**
 * Configurações da execução do callback
 * @typedef ParametrosExecucao
 * @property {Boolean} excluirAposExecutar - Se verdadeiro, a execução será excluida após ser executada
 * @property {expiracaoEvento} expirarAposMs - Se o callback não for chamado apos o tempo em millisegundos definido, o callback é excluido automaticamente
 * @property {Boolean} apenasUmaInstancia - Se verdadeiro, o callback só sera executado se ele atualmente não estiver sendo executado
 */

/**
 * Comportamento da expiração apos millisegundos
 * @typedef expiracaoEvento
 * @property {Number} expirarAposMs - Se o callback não for chamado apos o tempo em millisegundos definido, o callback é excluido automaticamente
 * @property {Function} callback - Callback para invocar quando a função for cancelada devido a expiração
 */

/**
 * Retorna uma promise que espera x millisegundos para resolver
 * @param {Number} ms - Tempo em millisegundos para esperar
 * @returns 
 */
export async function pausar(ms) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}


/**
 * Instancia de um novo gerenciador de eventos
 */
export class EmissorEvento {

    /**
     * Nome que identifica esse emissor de evento
     */
    #nomeId = ''

    /**
     * Lista de eventos existentes
     * @type {Evento[]}
     */
    #eventos = []

    /**
     * ID incremental para cada evento adicionado
     */
    #idEventos = 0;

    /**
     * Mostrar logs
     */
    habilitalogs = false;

    /**
     * Instanciar um novo gerenciaor de eventos
     * @param {String} nome - Um nome que identifica essa instancia
     * @param {Object} parametros - Parametros adicionais
     * @param {Boolean} parametros.habilitarLogs - Habilitar logs no console
     */
    constructor(nome, parametros) {
        if (nome == undefined) {
            this.#nomeId = `EmissorDeEvento-${Math.random().toString(36).substring(7)}`;
        } else {
            this.#nomeId = nome;
        }

        if (parametros != undefined) {
            if (parametros.habilitarLogs != undefined) {
                this.habilitalogs = parametros.habilitarLogs;
            }
        }
    }

    /**
     * Retorna um array com os eventos cadastrados atualmente.
     */
    getEventosCadastrados() {
        return this.#eventos.map((evento) => {
            return {
                nome: evento.getEventoNome(),
                callbacks: evento.getTotalExecucacoes()
            }
        });
    }

    /**
     * Adicionar um callback para ser executado quando o evento informado for disparado
     * @param {String} nomeevento - Nome do evento para disparar. Ex: 'novodado'
     * @param {Function} callback - Função a ser executada quando o evento for disparado
     * @param {ParametrosExecucao} parametros - Parametros adicionais para a execução do callback
     * @returns {AcoesListener} - Retorna um objeto com funções para interagir com o callback adicionado
     */
    addEvento(nomeevento, callback, parametros) {
        let evento = this.#eventos.find((e) => e.getEventoNome() == nomeevento);

        if (evento == undefined) {
            evento = new Evento(this, nomeevento, this.#idEventos++);
            this.log(`Criado um novo evento com nome: ${evento.getEventoNome()}, ID: ${evento.getID()}`);
            this.#idEventos++;
            this.#eventos.push(evento);
        }

        let idNovaExecucao = evento.adicionarExecucao(callback, parametros);

        /**
         * @type {AcoesListener}
         */
        const interacoesCallback = {
            excluir: () => {
                this.removeExecucao(nomeevento, idNovaExecucao);
            },
            idExecucao: idNovaExecucao,
            nomeEvento: evento.getEventoNome()
        }

        return interacoesCallback;
    }

    /**
     * Emitir um evento
     * @param {String} eventonome - Nome do evento a ser disparado
     * @param  {...any} args - Argumentos a serem passados para a execução do callback
     */
    disparaEvento(eventonome, ...args) {
        let evento = this.#eventos.find((e) => e.getEventoNome() == eventonome);

        if (evento == undefined) {
            this.log(`Evento ${eventonome} não será disparado pois não existe ninguem escutando.`);
            return;
        }

        // Executar evento
        evento.executar(...args);
    }

    /**
     * Exclui todos os callbacks de um evento
     * @param {String} eventoNome - Nome do evento para excluir junto com seus callbacks
     */
    removeEvento(eventoNome) {
        const totEve = this.#eventos.length;
        this.#eventos = this.#eventos.filter((evento) => evento.getEventoNome() != eventoNome);

        if (totEve != this.#eventos) {
            this.log(`Excluindo todos os callbacks do evento ${eventoNome}`);
        } else {
            this.log(`Evento ${eventoNome} não encontrado para excluir`);
        }
    }

    /**
     * Excluir um callback de um evento
     * @param {String} eventoNome - Nome do evento em que se encontra o callback
     * @param {String} idExecucao - ID da execução a ser excluida
     */
    removeExecucao(eventoNome, idExecucao) {
        let evento = this.#eventos.find((e) => e.getEventoNome() == eventoNome);

        if (evento == undefined) {
            this.log(`Evento ${eventoNome} não encontrado para excluir execução`);
            return;
        }

        evento.removerExecucao(idExecucao);

        // Se não houver nenhum callback, excluir o evento de uma vez
        if (evento.getTotalExecucacoes() == 0) {
            this.log(`Excluindo evento sem nenhum callback: ${eventoNome}`);
            this.#eventos = this.#eventos.filter((e) => e.getEventoNome() != eventoNome);
        }
    }

    /**
     * Mensagem para log no console
     * @param {String} msg - Mensagem para logar no console 
     */
    log(msg) {
        if (!this.habilitalogs) return

        console.log(`Emissor De Eventos -> [${this.#nomeId}] ${msg}`);
    }

    /**
     * Ativa/desativa os avisos de logs
     * @param {Boolean | undefined} bool - Se verdadeiro, ativa os logs
     */
    toggleLog(bool) {
        if (bool == undefined) {
            this.habilitalogs = !this.habilitalogs;
        } else {
            this.habilitalogs = bool;
        }
    }

    /**
     * Retorna se os logs devem ser exibidos
     */
    isLogHabilitado() {
        return this.habilitalogs;
    }
}

/**
 * Um evento contendo suas execuções
 */
class Evento {
    /**
     * Instancia do emissor ao qual esse evento pertence
     */
    #instanciaEmissor;

    /**
     * Nome do evento de disparo
     */
    #nomeEvento = ''

    /**
     * ID numero do evento registrado. Usado para identificar o evento
     */
    #idEvento = -1;

    /**
     * Execuções de callbacks
     * @type {Execucao[]}
     */
    #execucoes = []

    /**
     * ID 9jncremental para cada execução adicionada
     */
    #contadorExecucao = 0;

    /**
     * Instancia um novo evento de disparo
     * @param {EmissorDeEvento} emissor - Instancia do emissor ao qual esse evento pertence
     * @param {String} eventonome - Nome do evento a ser disparado
     */
    constructor(emissor, eventonome, idEvento) {
        this.#instanciaEmissor = emissor;
        this.#nomeEvento = eventonome;
        this.#idEvento = idEvento;
    }

    /**
     * Adicionar uma nova execução a esse evento
     * @param {Function} funcaocallback - Função a ser executada quando o evento for disparado
     * @param {ParametrosExecucao} parametros - Parametros adicionais para a execução do callback
     * @returns {Number} - ID unico da execução adicionada
     */
    adicionarExecucao(funcaocallback, parametros) {
        const novaExecucao = new Execucao(this, this.#contadorExecucao, funcaocallback, parametros);
        this.#execucoes.push(novaExecucao);

        this.#contadorExecucao++;

        this.log(`Adicionado nova execução ${novaExecucao.getID()}`);

        return novaExecucao.getID();
    }

    /**
     * Executar esse evento, disparando todas as execuções
     */
    executar(...args) {
        this.log(`Iniciado disparo de ${this.#execucoes.length} execuções`)
        this.#execucoes.forEach((execucao) => {
            execucao.executar(...args);
        });
    }

    /**
     * Remover uma execução desse evento
     * @param {Number} id - ID da execução a ser removida 
     */
    removerExecucao(id) {
        const totais = this.#execucoes.length;
        this.#execucoes = this.#execucoes.filter((execucao) => execucao.getID() != id);

        if (totais != this.#execucoes.length) {
            this.log(`Removido execução ID ${id}`);
        }
    }

    /**
     * Retorna o nome do evento configurado
     */
    getEventoNome() {
        return this.#nomeEvento;
    }

    /**
     * ID unico do evento
     */
    getID() {
        return this.#idEvento;
    }

    /**
     * Retorna o total de callbacks cadastrados pra esse evento
     */
    getTotalExecucacoes() {
        return this.#execucoes.length;
    }

    /**
     * Logar uma mensagem no console desse evento
     * @param {String} msg 
     */
    log(msg) {
        this.#instanciaEmissor.log(`Evento -> [${this.#nomeEvento}-${this.#idEvento}] ${msg}`);
    }
}

/**
 * Uma execução de um callback definido por um usuario
 */
class Execucao {

    /**
     * Instancia do evento ao qual essa execução pertence
     */
    #instanciaEvento;

    /**
     * Um ID pra identificar essa execução
     */
    #idExecucao = -1;

    /**
     * Parametros de configuração desse callback
     */
    #parametros = {
        /**
         * Configurações de expiração
         */
        expiracaoCallback: {
            /**
             * Se foi definido a expiração de callback
             */
            ativado: false,
            /**
             * Tempo em millisegundos para expirar
             */
            tempoMs: -1,
            /**
             * Callback para executar após a expiração
             */
            callback: () => { }
        },
        /**
         * Se o callback deve ser excluido após ser executado
         */
        isExcluirAposExecutar: false,
        /**
         * Se o callback não deve ser executado novamente enquanto ele estiver já sendo executado
         */
        isApenasUmaExecucaoPorVez: false,
    }

    /**
     * Estado dessa execução
     */
    #estado = {
        /**
         * Se esse evento está sendo executado
         */
        isExecutando: false,
        /**
         * Se esse callback já foi executado alguma vez
         */
        isJaExecutou: false,
        /**
         * setTimeout que expira a execução do callback
         */
        setTimeoutExpiracao: -1,
    }

    /**
     * Função a ser executada quando o evento for disparado
     */
    #funcaocallback = () => { }

    /**
     * Instancia uma nova execução de um callback
     * @param {Evento} evento - Instancia do evento ao qual essa execução pertence
     * @param {Number} id - ID unico da execução
     * @param {ParametrosExecucao} parametros - Parametros adicionais para a execução do callback
     * @param {Function} callback 
     */
    constructor(evento, id, callback, parametros) {
        this.#instanciaEvento = evento;
        this.#idExecucao = id;
        this.#funcaocallback = callback;

        if (parametros != undefined) {

            // Só executar uma vez
            if (parametros.excluirAposExecutar != undefined) {
                this.#parametros.isExcluirAposExecutar = parametros.excluirAposExecutar;
            }

            // Expirar após um tempo
            if (parametros.expirarAposMs != undefined) {
                this.#parametros.expiracaoCallback.ativado = true;
                this.#parametros.expiracaoCallback.tempoMs = parametros.expirarAposMs.expirarAposMs;
                this.#parametros.expiracaoCallback.callback = parametros.expirarAposMs.callback;
                this.#ativaCancelamentoAutomatico();
            }

            // Impedir que seja executado caso já esteja sendo
            if (parametros.apenasUmaInstancia != undefined) {
                this.#parametros.isApenasUmaExecucaoPorVez = parametros.apenasUmaInstancia;
            }
        }
    }

    /**
     * Ativar o setTimeotu que cancela
     */
    #ativaCancelamentoAutomatico() {
        this.#estado.setTimeoutExpiracao = setTimeout(() => {
            this.log(`Expirado callback ID ${this.#idExecucao} pois ultrapassou o limite definido de ${this.#parametros.expiracaoCallback.tempoMs}ms`);

            this.#parametros.expiracaoCallback.callback();
            this.#cancelar();
        }, this.#parametros.expiracaoCallback.tempoMs);
    }

    /**
     * Cancelar o timeout de expiração
     */
    #paraCancelamentoAutomatico() {
        if (this.#estado.setTimeoutExpiracao == -1) return;
        clearTimeout(this.#estado.setTimeoutExpiracao);
    }

    /**
     * ID unico da execução
     */
    getID() {
        return this.#idExecucao;
    }

    /**
     * Logar uma mensagem no console dessa execução
     * @param {String} msg - Mensagem
     */
    log(msg) {
        this.#instanciaEvento.log(`Execução -> [#${this.#idExecucao}] ${msg}`);
    }

    /**
     * Excluir esse callback da lista do seu evento
     */
    #cancelar() {
        this.#paraCancelamentoAutomatico();
        this.#instanciaEvento.removerExecucao(this.#idExecucao);
        this.log(`Callback excluido`);
    }

    /**
     * Executar função callback
     */
    async executar(...args) {
        this.#paraCancelamentoAutomatico();

        if (this.#estado.isExecutando && this.#parametros.isApenasUmaExecucaoPorVez) {
            this.log(`Execução cancelada pois já está executando`);
            return;
        }

        // Seta como executando
        this.#estado.isExecutando = true;
        this.log(`Executando callback com ${args.length} argumentos.`);

        // Chamar a função callback
        try {
            await this.#funcaocallback(...args);
        } catch (ex) {
            this.log(`Erro ao executar callback: ${ex}`);
        }

        // Seta como não executando e ja executou
        this.#estado.isExecutando = false;
        this.#estado.isJaExecutou = true;
        this.log(`Execução finalizada com sucesso`);

        // Se deve ser excluido após a execução
        if (this.#parametros.isExcluirAposExecutar) {
            this.log(`Excluindo callback após execução`);
            this.#cancelar();
        }
    }

    /**
     * Se essa execução está sendo executada
     */
    isExecutando() {
        return this.#estado.isExecutando;
    }
}