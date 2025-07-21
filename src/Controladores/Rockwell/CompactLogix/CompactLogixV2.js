import { EmissorEvento } from "../../../Utils/EmissorEvento.js";
import { CompactLogixRockwell } from "./CompactLogix.js";

/**
 * Gerencia a conexão com um CompactLogix e permite ler/escrever tags, além de observar alterações de tags.
 ** Essa classe é uma camada de abstração com melhorias no desempenho de leitura e escritas de tags, além de permitir observações de tags. (Coisa que a classe base não tem)
 ** Se preferir ter mais controle sobre lógica de leituras/escritas/observações, utilize a classe `CompactLogix.js` diretamente.
 */
export class CompactLogixV2 {

    #configuracoes = {
        /**
         * Se os logs devem ser mostrados no console
         */
        isMostrarConsoleLogs: false,
        /**
         * Se em caso de perda de conexão, será tentado reconectar automaticamente
         */
        isAutoReconectar: false,
        /**
         * Endereço IP do CompactLogix
         */
        ip: '',
        /**
         * Porta de comunicação com o CompactLogix
         */
        porta: 44818,
        /**
         * Configuraçoes do comportamento da leitura de tags
         */
        leitura: {
            /**
             * Tempo em millisegundos que deve ocorrer as leituras das tags pendentes de leituras
            */
            tempoMinimoEntreLeituras: 1400
        },
        /**
         * Configurações do comportamento das escritas de tags
         */
        escrita: {
            /**
             * Tempo em millisegundos que deve ocorrer as escritas das tags pendentes de escritas
             */
            tempoMinimoEntreEscritas: 1400
        },
        /**
         * Configurações do comportamento de observações das tags
         */
        observacoes: {
            /**
             * O tempo em millisegundos que as leituras das tags observadas devem ser realizadas
             */
            tempoEntreLeituras: 1000
        }
    }

    /**
    * @callback CallbackConfirmaLeituraTag
    * @param {String} tag - Tag que foi lido
    * @param {DataTypeTag} dataType - Informações do Data Type da tag
    * @param {DataValorTag} valor - Informações do valor lido da tag
    * @param {Boolean} isLeituraSucesso - Se o retorno da tag retornou sucesso. Caso contrario, objeto erro deve conter os detalhes do erro
    * @param {Object} erro - Se ocorreu algum erro, contém detalhes do erro
    * @param {String} erro.descricao - Descrição ocorrida do erro
    */


    /**
     * Informações do Data Type de uma tag
     * @typedef DataTypeTag 
     * @property {Boolean} dataType.isAtomico - Se o Data Type é atomico
     * @property {Object} dataType.atomico - Se o Data Type for atomico, contém os detalhes do Data Type
     * @property {Number} dataType.atomico.codigoAtomico - O código especifico desse tipo de tag atomico
     * @property {String} dataType.atomico.descricao - Descrição do tipo atomico
     * @property {Boolean} dataType.atomico.isSigned - Se o valor é um número com sinal
     * @property {Number} dataType.atomico.tamanho - Tamanho em bytes do número atómico
     * @property {Boolean} dataType.isStruct - Se o Data Type é uma Struct
     * @property {Object} dataType.struct - Se o Data Type for uma Struct, contém os detalhes da Struct
     * @property {Number} dataType.struct.codigoStruct - O código especifico desse tipo de tag Struct
     * @property {String} dataType.struct.descricao - Descrição do tipo Struct
     */

    /**
     * Informações do valor de uma tag
     * @typedef DataValorTag
     * @property {Boolean} valor.isAtomico - Se o valor for atomico, contém o valor atomico
     * @property {Object} valor.atomico - Detalhes do tipo atomico
     * @property {Number} valor.atomico.numero - Valor atomico da tag(no caso um número)
     * @property {Boolean} valor.isStruct - Se o valor for uma struct
     * @property {Object} valor.struct - Se o valor for uma struct, contém os detalhes do Struct
     * @property {Boolean} valor.struct.isASCIIString82 - Se o valor for uma Struct do tipo ASCII String 82
     * @property {Object} valor.struct.ASCIIString82 - Detalhes do valor da Struct do tipo ASCII String 82
     * @property {String} valor.struct.ASCIIString82.string - String que foi lida na tag
     */

    /**
     * @typedef LeituraTagResultado
     * @property {String} tag - Tag que foi lido
     * @property {DataTypeTag} dataType - Detalhes do Data Type da tag
     * @property {DataValorTag} valor - Valor lido da tag. Esse valor é dinamico dependendo do Data Type da tag.
     * @property {Object} erro - Se ocorreu algum erro, contém detalhes do erro
     * @property {String} erro.descricao - Descrição ocorrida do erro
     * @property {Boolean} isLeituraRecebida - Se essa tag já foi confirmado o recebimento da leitura(sendo ele sucesso ou não)
     * @property {Boolean} isTagValida - Se a leitura da tag é valida e não ocorreu nenhum erro.
     */

    /**
     * @typedef PromiseLeituraTag
     * @property {Number} id - ID unico incremental
     * @property {LeituraTagResultado[]} tags - Tags da leitura
     * @property {CallbackConfirmaLeituraTag} confirmaTag - Função a ser chamada para confirmar a leitura de uma tag
     * @property {Number} idTimeout - ID do setTimeout caso demore demais para a leitura das tags 
     */

    /**
     * @callback CallbackConfirmaEscritaTag
     * @param {String} tag - A tag que foi escrita
     * @param {Boolean} isEscritaSucesso - Se a escrita foi confirmada no CompactLogix
     * @param {Object} erro - Se ocorreu um erro, contém os detalhes do erro
     * @param {String} erro.descricao - A descrição do erro
     */

    /**
     * @typedef EscritaTagResultado
     * @property {String} tag - Tag no CompactLogix
     * @property {*} valor - Valor a ser escrito na tag
     * @property {Boolean} isEscritoSucesso - Se a escrita foi confirmada no CompactLogix
     * @property {Boolean} isRecebidoConfirmacao - Se essa tag já foi confirmado o recebimento pelo dispositivo(sendo ele sucesso ou não)
     * @property {Object} erro - Se não foi possível escrever a tag, contém os detalhes do erro
     * @property {String} erro.descricao - Descrição do erro
     */

    /**
     * @typedef PromiseEscritaTag
     * @property {Number} id - ID unico incremental
     * @property {EscritaTagResultado[]} tags - Tags a serem escritas
     * @property {CallbackConfirmaEscritaTag} confirmaEscrita - Confirma a escrita de uma tag
     * @property {Number} idTimeout - ID do setTimeout caso demore demais para a escrita das tags
     */

    /**
     * @typedef CacheDataType
     * @property {String} tag - Nome da tag
     * @property {Boolean} isAtomico - Se o Data Type é atomico
     * @property {Object} atomico - Se o Data Type for atomico, contém os detalhes do Data Type
     * @property {Number} atomico.codigoAtomico - O código especifico desse tipo de tag atomico
     * @property {Boolean} isStruct - Se o Data Type é uma Struct
     * @property {Object} struct - Se o Data Type for uma Struct, contém os detalhes da Struct
     * @property {Number} struct.codigoStruct - O código especifico desse tipo de tag Struct
     */

    /**
     * @callback CallbackObservaTagValorAlterado
     * @param {DataValorTag} valorAntigo - O valor anterior da tag
     * @param {DataValorTag} valorNovo - O novo valor da tag
     */

    /**
     * @typedef CallbackObservacaoTag
     * @property {Number} id - ID unico desse callback
     * @property {CallbackObservaTagValorAlterado} onAlterado - Função a ser chamada quando o valor da tag mudar
     */

    /**
     * @typedef ObservacaoDeTag
     * @property {String} tag - Nome da tag
     * @property {DataTypeTag} dataType - Informações do Data Type da tag
     * @property {DataValorTag} valor - Valor atual da tag
     * @property {CallbackObservacaoTag[]} callbacks - Callbacks que desejam receber notificações de alterações dessa tag
     */

    /**
     * Controle de estado com o CompactLogix
     */
    #estado = {
        /**
         * Instancia do controlador CompactLogix da minha biblioteca que comunica via EtherNet IP
         * @type {CompactLogixRockwell}
         */
        controlador: undefined,
        /**
         * Estado de leituras de tags
         */
        leituras: {
            /**
             * Tags que estão na fila de pendentes para serem lidas
             * @type {PromiseLeituraTag[]}
             */
            pendentesDeLeitura: [],
            /**
             * O totalizador de lote é um ID incremental que é utilizado para identificar um lote de leituras.
             */
            totalizadorLoteId: 0,
            /**
             * Se existe uma chamada de leitura pendente para executar
             */
            isLeituraPendente: false,
            /**
             * Se a leitura está sendo executada, ou seja aguardando a resposta do CompactLogix
             */
            isLeituraExecutando: false,
            /**
             * Data da última vez que foi executado a leitura das tags no CompactLogix
             * @type {Date}
             */
            dataUltimaExecucao: undefined
        },
        /**
         * Estado de escrita de tags
         */
        escritas: {
            /**
             * Tags que estão na fila para serem escritas
             * @type {PromiseEscritaTag[]}
             */
            pendentesDeEscrita: [],
            /**
             * O totalizador de lote é um ID incremental que é utilizado para identificar um lote de escritas.
             */
            totalizadorLoteId: 0,
            /**
             * Se já existe uma chamada pendente que será executada
             */
            isEscritaPendente: false,
            /**
             * Se esta atualmente executando a escrita das tags no CompactLogix
             */
            isEscritaExecutando: false,
            /**
             * Data em que ocorreu a ultima execução de escrita de tags
             */
            dataUltimaExecucao: undefined
        },
        /**
         * Estado de observações de tags
         */
        observacoes: {
            /**
             * Tags observadas
             * @type {ObservacaoDeTag[]}
             */
            tags: [],
            /**
             * Se a leitura das tags está sendo realizada para disparar as observações
             */
            isRealizandoLeitura: false,
            /**
             * ID do setInterval criado que realiza o trigger de leitura das tags observadas
             */
            IDSetInterval: -1
        },
        /**
         * O cache de Data Types armazena os tipos das últimas tags que foram escritas/lidas.
         * 
         * O comportamento desse cache é definido assim:
         * - Se a tag não estiver no cache e for uma escrita, a chamada da função ao Compact informara para auto-reconhecer a tag, o que resultará em duas requisições (busca tipo da tag e depois escreve). Se retornar sucesso, a tag será adicionada ao cache.
         * - Se a tag não estiver no cache e for uma leitura, se o retorno da leitura for sucesso, a tag será adicionada ao cache.
         * - Se a tag existir no cache, o tipo dela será informado na requisição ao Compact se necessario(no caso de escritas), evitando overhead de 2 requisições.
         * - Se por uma rara chance o controlador retornar que o Data Type tá incorreto, é provavél que a tag no controlador foi alterado o tipo dela. Nesses casos, o cache identificara que esse erro ocorreu e atualizará o cache com o novo Data Type.
         * 
         * @type {CacheDataType[]}
         */
        cacheDataTypes: [],
        /**
         * Emissor de eventos customizado
         * @type {EmissorEvento}
         */
        emissorEventos: undefined
    }

    /**
     * Instanciar uma nova conexão com um CompactLogix
     * @param {Object} construtorOpcoes - Propriedades de conexão
     * @param {Boolean} construtorOpcoes.isMostrarConsoleLogs - Se deve mostrar logs no console
     * @param {Object} construtorOpcoes.conexao - Propriedades de conexão com o controlador CompactLogix
     * @param {String} construtorOpcoes.conexao.ip - Endereço IP do CompactLogix
     * @param {Number} construtorOpcoes.conexao.porta - Porta de comunicação com o CompactLogix
     * @param {Boolean} construtorOpcoes.isAutoReconectar - Se em caso de perca de conexão, será tentado reconectar automaticamente
     */
    constructor(construtorOpcoes) {
        if (construtorOpcoes == undefined) throw new Error('As propriedades do construtor precisam ser informadas.');
        if (construtorOpcoes.isMostrarConsoleLogs) this.#configuracoes.isMostrarConsoleLogs = construtorOpcoes.isMostrarConsoleLogs;

        if (construtorOpcoes.conexao == undefined) throw new Error('As propriedades de conexão com o CompactLogix precisam ser informadas.');
        if (construtorOpcoes.conexao.ip == undefined) throw new Error('O endereço IP do CompactLogix precisa ser informado.');
        if (construtorOpcoes.isAutoReconectar) this.#configuracoes.isAutoReconectar = construtorOpcoes.isAutoReconectar;

        // Se informado a porta opcional, eu utilizo ela, senão eu utilizo a padrão 44818
        if (construtorOpcoes.conexao.porta != undefined) this.#configuracoes.porta = construtorOpcoes.conexao.porta;

        this.#configuracoes.ip = construtorOpcoes.conexao.ip;

        this.#estado.emissorEventos = new EmissorEvento(`CompactLogix ${this.#configuracoes.ip}`);

        this.#estado.controlador = new CompactLogixRockwell({
            ip: this.#configuracoes.ip,
            porta: this.#configuracoes.porta,
            habilitaLogs: false,
            autoReconectar: this.#configuracoes.isAutoReconectar
        })

        this.#estado.controlador.onLog((msgLog) => {
            this.log(msgLog);
        })
    }

    /**
     * Iniciar a conexão com o CompactLogix
     */
    async conectar() {
        const retornoConexao = {
            /**
             * Se conectou com sucesso
             */
            isConectado: false,
            /**
             * Se não conectou, contém detalhes do erro
             */
            erro: {
                descricao: ''
            }
        }

        const retornoConectar = await this.#estado.controlador.conectar();

        if (retornoConectar.isConectou) {
            retornoConexao.isConectado = true;
        } else {
            retornoConexao.erro.descricao = retornoConectar.erro.descricao;
        }

        return retornoConexao;
    }

    /**
     * Encerrar a conexão com o CompactLogix. Independente se está conectado ou não, o Socket será destruido, leituras e escritas pendentes serão removidas.
     */
    desconectar() {
        this.#estado.controlador.desconectar();
    }

    getParametrosConexao() {
        return {
            ip: this.#configuracoes.ip,
            porta: this.#configuracoes.porta
        }
    }

    /**
     * @typedef RetLerTags
     * @property {Boolean} isSucesso - Se a leitura foi sucesso
     * @property {Object} sucesso - Tags lidas com sucesso
     * @property {LeituraTagResultado[]} sucesso.tags - Tags lidas com sucesso
     * @property {Object} erro - Descrição do erro ocorrido
     * @property {String} erro.descricao - Descrição do erro ocorrido
     */

    /**
     * Ler tags no CompactLogix
     * @param {Array<String>} tags - Array de tags string a serem lidas
     * @returns {Promise<RetLerTags>}
     */
    async lerTags(tags) {

        /**
         * @type {RetLerTags}
         */
        let retornoLeitura = {
            isSucesso: false,
            sucesso: {
                tags: []
            },
            erro: {
                descricao: ''
            }
        }

        // Precisa ser um array de tags
        if (tags == undefined || Array.isArray(tags) == false) {
            throw new Error('As tags a serem lidas não foram informadas ou não são um array.');
        }

        // Tags que vão ser adicionados na leitura
        let tagsDesejadas = [];
        for (const tagString of tags) {
            if (typeof tagString != 'string') {
                throw new Error(`As tags a serem lidas precisam ser strings. Foi informado um valor ${tagString} do tipo ${typeof tagString}`);
            }

            // Não adicionar tags repetidas
            if (tagsDesejadas.indexOf(tagString) != -1) continue

            tagsDesejadas.push(tagString);
        }

        /**
         * @type {PromiseLeituraTag}
         */
        let novaLeitura = {
            id: this.#estado.leituras.totalizadorLoteId++,
            tags: [],
            confirmaTag: () => { },
            idTimeout: -1
        }

        // Adicionar o status das tags pro retorno
        for (const tagString of tagsDesejadas) {
            novaLeitura.tags.push({
                tag: tagString,
                valor: {},
                erro: {
                    descricao: ''
                },
                isLeituraRecebida: false,
                isTagValida: false
            })
        }

        const logLeitura = (string) => {
            this.log(`[Leitura Tag] Lote #${novaLeitura.id}: ${string}`);
        }

        const promiseAguarda = new Promise((resolve) => {

            // Essa função é utilizada para confirmar a leitura de uma tag
            /**
             * @type {CallbackConfirmaLeituraTag}
             */
            const confirmaLeituraTag = (tag, datatype, valor, isLeituraSucesso, detalhesErro) => {

                // Encontrar a tag confirmada na lista de tags pendentes
                const tagObj = novaLeitura.tags.find(t => t.tag == tag);
                if (tagObj != undefined) {

                    // Se a tag já foi recebida, eu só ignoro
                    if (tagObj.isLeituraRecebida) {
                        logLeitura(`A tag ${tag} já foi confirmada anteriormente. Ignorando...`);
                        isTodosConfirmados();
                        return;
                    }

                    // Se teve sucesso na leitura, algumErro será nullo
                    if (isLeituraSucesso) {
                        logLeitura(`Tag ${tag} confirmada a leitura com sucesso.`);
                        tagObj.isTagValida = true;

                        // Adicionar o valor e o Data Type da tag
                        tagObj.valor = valor;
                        tagObj.dataType = datatype;
                    } else {
                        if (detalhesErro == undefined) {
                            detalhesErro = {
                                descricao: 'Erro da leitura não informado.'
                            }
                        }

                        logLeitura(`Tag ${tag} confirmada a leitura com erro: ${detalhesErro.descricao}`);
                        tagObj.erro.descricao = detalhesErro.descricao;
                    }

                    tagObj.isLeituraRecebida = true;

                    // Verificar se todas as tags já foram confirmadas e se sim, resolver a promise
                    isTodosConfirmados();
                } else {
                    logLeitura(`Tag ${tag} não foi encontrada na lista de tags pendentes.`);
                }
            }

            // Valida se todas as tags foram lidas
            const isTodosConfirmados = () => {
                const tagsAguardandoConfirmacao = novaLeitura.tags.filter(t => t.isLeituraRecebida == false);
                if (tagsAguardandoConfirmacao.length == 0) {
                    retornoLeitura.isSucesso = true;

                    // Cancelar o timeout de leitura
                    clearTimeout(novaLeitura.idTimeout);

                    // Remover da lista de leituras pendentes
                    this.#estado.leituras.pendentesDeLeitura = this.#estado.leituras.pendentesDeLeitura.filter(l => l.id != novaLeitura.id);

                    logLeitura(`Todas as tags foram confirmadas. Resolvendo a promise...`);
                    retornoLeitura.sucesso.tags = novaLeitura.tags;

                    return resolve(retornoLeitura);
                } else {
                    logLeitura(`Aguardando confirmações das tags ${tagsAguardandoConfirmacao.map(t => t.tag).join(', ')}...`);
                }
            }

            // Inicia um setTimeout para retornar caso demore na leitura das tags
            novaLeitura.idTimeout = setTimeout(() => {
                const tagsAguardandoConfirmacao = novaLeitura.tags.filter(t => t.isLeituraRecebida == false);

                tagsAguardandoConfirmacao.forEach(t => {
                    t.erro.descricao = 'O CompactLogix demorou para retornar a leitura da tag.';
                    t.isLeituraRecebida = true;
                })

                // Se pelo menos alguma tag ocorreu sucesso, eu considero que a leitura foi sucesso
                if (tagsAguardandoConfirmacao.length != novaLeitura.tags.length) {
                    retornoLeitura.isSucesso = true;
                } else {
                    // Se todas as tags deram erro de leitura, não devo considerar como sucesso.
                    retornoLeitura.erro.descricao = `Timeout ocorrido para todas as leituras de tags`;
                }

                logLeitura(`Timeout de leitura ocorrido para as tags: ${tagsAguardandoConfirmacao.map(t => t.tag).join(', ')}. Resolvendo promise...`);

                retornoLeitura.sucesso.tags = novaLeitura.tags.map(t => {
                    return {
                        valor: t.valor,
                        erro: t.erro,
                        isLeituraRecebida: t.isLeituraRecebida,
                        tag: t.tag,
                        isTagValida: t.isTagValida
                    }
                })
                return resolve(retornoLeitura);
            }, 5000);
            novaLeitura.confirmaTag = confirmaLeituraTag;
        })

        // Adicionar essa leitura pendente a lista para ser lida quando possível
        this.#estado.leituras.pendentesDeLeitura.push(novaLeitura);

        this.#triggerLeituraTags();
        return promiseAguarda;
    }

    /**
     * @typedef RetEscreverTags
     * @property {Boolean} isSucesso - Se a solicitação de escrita foi enviada e recebido com sucesso(não garante que tags individuais tenham sido sucesso, apenas que o dispositivo remoto retornou alguma resposta)
     * @property {Object} sucesso - Se a solicitação deu sucesso, contém os detalhes das tags solicitadas para escritas
     * @property {EscritaTagResultado[]} sucesso.tags - Tags que foram solicitadas para escrita com seus status
     * @property {Object} erro - Descrição do erro ocorrido
     * @property {String} erro.descricao - Descrição do erro ocorrido
     */

    /**
     * Escrever tags no CompactLogix
     * @param {Object[]} tags - Tags para escrever no CompactLogix
     * @param {String} tags[].tag - Tag a ser escrita
     * @param {*} tags[].valor - Valor a ser escrito na tag
     * @returns {Promise<RetEscreverTags>}
     */
    async escreverTags(tags) {

        /**
         * @type {RetEscreverTags}
         */
        let retornoEscrita = {
            isSucesso: false,
            sucesso: {
                tags: []
            },
            erro: {
                descricao: ''
            }
        }

        // Se não foi informado um array válido de tags, retornar erro
        if (tags == undefined || Array.isArray(tags) == false) {
            throw new Error('As tags a serem escritas não foram informadas ou não são um array.');
        }

        /**
         * @type {PromiseEscritaTag}
         */
        let novaEscrita = {
            id: this.#estado.escritas.totalizadorLoteId++,
            tags: [],
            confirmaEscrita: () => { }
        }

        // Adicionar as tags a serem escritas
        for (const tag of tags) {
            novaEscrita.tags.push({
                tag: tag.tag,
                valor: tag.valor,
                erro: {
                    descricao: ''
                },
                isEscritoSucesso: false,
                isRecebidoConfirmacao: false
            })
        }

        const logEscrita = (string) => {
            this.log(`[Escrita Tag] Lote #${novaEscrita.id} (${novaEscrita.tags.map(t => t.tag).join(', ')}) ${string}`);
        }

        const promiseAguardaEscrita = new Promise((resolve) => {

            // Vincular a função de confirmação de escrita de tag
            novaEscrita.confirmaEscrita = (tag, isEscritaSucesso, erro) => {
                const tagObj = novaEscrita.tags.find(t => t.tag == tag);

                if (tagObj != undefined) {

                    // Se a tag já foi recebida
                    if (tagObj.isRecebidoConfirmacao) {
                        // logEscrita(`A tag ${tag} já foi confirmada anteriormente. Ignorando...`);
                        isTudoOk();
                        return;
                    }

                    if (isEscritaSucesso) {
                        // logEscrita(`Tag '${tag}' confirmada a escrita com sucesso.`);
                        tagObj.isEscritoSucesso = true;
                    } else {
                        if (erro == undefined) {
                            erro = {
                                descricao: 'Erro da escrita não informado.'
                            }
                        }

                        // logEscrita(`Tag '${tag}' confirmada com erro. Erro: ${erro.descricao}`);
                        tagObj.erro.descricao = erro.descricao;
                    }

                    tagObj.isRecebidoConfirmacao = true;
                    isTudoOk();
                } else {
                    // logEscrita(`Tag ${tag} não foi encontrada na lista de tags pendentes de escrita.`);
                }
            }

            const isTudoOk = () => {
                // Valida se todas as escritas foram realizadas com sucesso pra retornar a mensagem
                const escritasAguardando = novaEscrita.tags.filter(t => t.isRecebidoConfirmacao == false);

                if (escritasAguardando.length == 0) {
                    retornoEscrita.isSucesso = true;

                    // Cancelar o timeout de escrita
                    clearTimeout(novaEscrita.idTimeout);

                    // Remover da lista pendente de escritas
                    this.#estado.escritas.pendentesDeEscrita = this.#estado.escritas.pendentesDeEscrita.filter(e => e.id != novaEscrita.id);

                    // logEscrita(`Todas as tags foram confirmadas. Resolvendo a promise...`);

                    retornoEscrita.sucesso.tags = novaEscrita.tags.map(t => {
                        return {
                            tag: t.tag,
                            valor: t.valor,
                            isEscritoSucesso: t.isEscritoSucesso,
                            erro: t.erro,
                            isRecebidoConfirmacao: t.isRecebidoConfirmacao
                        }
                    })

                    resolve(retornoEscrita);
                } else {
                    // logEscrita(`Aguardando confirmações das tags ${escritasAguardando.map(t => t.tag).join(', ')}...`);
                }
            }

            // Definir o timeout se demorar para receber as confirmações
            novaEscrita.idTimeout = setTimeout(() => {
                const escritasAguardando = novaEscrita.tags.filter(t => t.isRecebidoConfirmacao == false);

                escritasAguardando.forEach(t => {
                    t.erro.descricao = 'O CompactLogix demorou para retornar a escrita da tag.';
                    t.isRecebidoConfirmacao = true;
                })

                // Se pelo menos alguma tag ocorreu sucesso, eu considero que a leitura foi sucesso
                if (escritasAguardando.length != novaEscrita.tags.length) {
                    retornoEscrita.isSucesso = true;
                } else {
                    // Se todas as tags deram erro de leitura, não devo considerar com sucesso.
                    retornoEscrita.erro.descricao = `Timeout ocorrido para todas as escritas de tags`;
                }

                // logEscrita(`Timeout de escrita ocorrido para as tags: ${escritasAguardando.map(t => t.tag).join(', ')}. Resolvendo promise...`);

                retornoEscrita.sucesso.tags = novaEscrita.tags.map(t => {
                    return {
                        tag: t.tag,
                        valor: t.valor,
                        isEscritoSucesso: t.isEscritoSucesso,
                        erro: t.erro,
                        isRecebidoConfirmacao: t.isRecebidoConfirmacao,
                    }
                })

                return resolve(retornoEscrita);
            }, 5000);

        })

        // Adicionar ao array de escritas pendentes
        this.#estado.escritas.pendentesDeEscrita.push(novaEscrita);

        // Triggar a escritura de tags se possível
        this.#triggerEscreverTags();

        return promiseAguardaEscrita;
    }

    /**
     * Adicionar uma tag para ser observada e invocar seu callback quando houver alteração
     * 
     * **A tag precisa exitir e ser suportada pela blblioteca.**
     * @param {String} tag - Nome da tag
     * @param {Object} callbacks - Definir seus callbacks para executar quando certos eventos ocorrerem
     * @param {CallbackObservaTagValorAlterado} callbacks.onAlterado - Função a ser chamada quando o valor da tag mudar
     */
    async observarTag(tag, callbacks) {
        if (tag == undefined || typeof tag != 'string') {
            throw new Error('A tag a ser observada precisa ser informada e ser uma string.');
        }

        const retObservar = {
            /**
             * Se ocorreu sucesso em iniciar o processo de observação da tag. Sucesso é retornado se:
             * 
             * - A tag existe
             * - É suportada pela biblioteca
             */
            isSucesso: false,
            /**
             * Se sucesso em observar, contém detalhes do observador gerado
             */
            sucesso: {
                /**
                 * ID de callback unico para permitir cancelar depois
                 */
                idCallback: undefined
            },
            /**
             * Se ocorreu algum erro, contém detalhes adicionais do erro
             */
            erro: {
                descricao: ''
            }
        }

        const requisitaLeituraTag = await this.lerTags([tag]);
        if (!requisitaLeituraTag.isSucesso) {

            retObservar.erro.descricao = requisitaLeituraTag.erro.descricao;
            return retObservar;
        }

        const tagEncontrada = requisitaLeituraTag.sucesso.tags.find(t => t.tag == tag);
        if (tagEncontrada == undefined) {
            retObservar.erro.descricao = `A tag ${tag} não foi encontrada na solicitação de leitura ao controlador, não será possível observar.`;
            return retObservar;
        }

        if (!tagEncontrada.isTagValida) {
            retObservar.erro.descricao = `A tag ${tag} não foi lida com sucesso, motivo: ${tagEncontrada.erro.descricao}.`;
            return retObservar;
        }

        // Se for valida, adicionar as observações
        let tagObservada = this.#estado.observacoes.tags.find(t => t.tag == tag);
        if (tagObservada == undefined) {
            tagObservada = {
                tag: tag,
                dataType: tagEncontrada.dataType,
                valor: tagEncontrada.valor,
                callbacks: [],
            }

            this.#estado.observacoes.tags.push(tagObservada);
        }

        /**
         * @type {CallbackObservacaoTag}
         */
        const novoCallback = {
            id: tagObservada.callbacks.length + 1,
            onAlterado: callbacks.onAlterado
        }

        tagObservada.callbacks.push(novoCallback);

        retObservar.isSucesso = true;
        retObservar.sucesso.idCallback = novoCallback.id;

        if (this.#estado.observacoes.IDSetInterval == -1) {
            this.iniciarObservadorInterval();
        }
        return retObservar;
    }

    /**
     * Excluir um callback adicionado de observação para uma tag
     * @param {String} tag - Tag original que foi observada
     * @param {Number} id - ID do callback a ser removido
     */
    pararCallbackObservacaoTag(tag, id) {
        const exclusaoCallback = {
            isExcluido: false,
            erro: {
                descricao: ''
            }
        }

        const tagAlvo = this.#estado.observacoes.tags.find(t => t.tag == tag);
        if (tagAlvo == undefined) {
            exclusaoCallback.erro.descricao = `A tag ${tag} não está sendo observada.`;
            return exclusaoCallback;
        }

        const callbackAlvo = tagAlvo.callbacks.find(c => c.id == id);
        if (callbackAlvo == undefined) {
            exclusaoCallback.erro.descricao = `O callback com ID ${id} não foi encontrado na tag ${tag}.`;
            return exclusaoCallback;
        }

        tagAlvo.callbacks = tagAlvo.callbacks.filter(c => c.id != id);

        if (tagAlvo.callbacks.length == 0) {
            this.pararObservacaoTag(tag);
        }

        exclusaoCallback.isExcluido = true;
        return exclusaoCallback;
    }

    /**
     * Excluir todos os callbacks de uma tag observada
     * @param {String} tag 
     */
    pararObservacaoTag(tag) {
        const exclusaoTag = {
            isExcluido: false,
            erro: {
                descricao: ''
            }
        }

        const tagAlvo = this.#estado.observacoes.tags.find(t => t.tag == tag);
        if (tagAlvo == undefined) {
            exclusaoTag.erro.descricao = `A tag ${tag} não está sendo observada.`;
            return exclusaoTag;
        }

        tagAlvo.callbacks = [];

        exclusaoTag.isExcluido = true;

        this.#estado.observacoes.tags = this.#estado.observacoes.tags.filter(t => t.tag != tag);
        return exclusaoTag;
    }

    /**
     * Verificar se uma tag está sendo observada
     * @param {String} tag - Nome da tag a ser verificada
     */
    isTagObservada(tag) {
        return this.#estado.observacoes.tags.find(t => t.tag == tag) != undefined
    }

    /**
     * Inicia o setInterval que verifica por alterações nas tags
     */
    iniciarObservadorInterval() {
        if (this.#estado.observacoes.IDSetInterval != -1) {
            clearInterval(this.#estado.observacoes.IDSetInterval);
            this.#estado.observacoes.IDSetInterval = -1;
        }

        this.#estado.observacoes.IDSetInterval = setInterval(() => {
            this.#triggerObservacaoTags();
        }, this.#configuracoes.observacoes.tempoEntreLeituras);

        this.log(`Iniciado observador de tags com intervalo de ${this.#configuracoes.observacoes.tempoEntreLeituras}ms.`);
    }

    /**
     * Inicia a leitura das tags que estão pendentes
     */
    async #triggerLeituraTags() {

        // Se já tiver uma chamada de leitura pendente, não deixar iniciar outra
        if (this.#estado.leituras.isLeituraPendente) {
            this.log(`Já existe uma chamada de leitura pendente. Ignorando...`);
            return;
        }

        // Se já tiver uma chamada de leitura em execução e aguardando a resposta do CompactLogix
        if (this.#estado.leituras.isLeituraExecutando) {
            this.log(`Já existe uma chamada de leitura em execução no CompactLogix. Ignorando...`);
            return;
        }

        if (this.#estado.leituras.pendentesDeLeitura.length == 0) {
            this.log(`Não existem leituras pendentes para serem lidas.`);
            return;
        }

        let dataAgra = new Date();
        const diffMsUltimaExecucao = dataAgra.getTime() - (this.#estado.leituras.dataUltimaExecucao != undefined ? this.#estado.leituras.dataUltimaExecucao.getTime() : this.#configuracoes.leitura.tempoMinimoEntreLeituras + 1);

        // Se o tempo desde a ultima leitura ainda não atingiu o tempo minimo de espera
        if (this.#estado.leituras.dataUltimaExecucao != undefined && (diffMsUltimaExecucao < this.#configuracoes.leitura.tempoMinimoEntreLeituras)) {
            this.#estado.leituras.isLeituraPendente = true;
            let diffRestante = this.#configuracoes.leitura.tempoMinimoEntreLeituras - diffMsUltimaExecucao;

            setTimeout(() => {
                this.#estado.leituras.isLeituraPendente = false;
                this.#triggerLeituraTags();
            }, diffRestante);

            return;
        }

        this.#estado.leituras.dataUltimaExecucao = dataAgra;
        this.log(`Iniciando leitura de tags pendentes...`);
        this.#estado.leituras.isLeituraExecutando = true;
        this.#estado.emissorEventos.disparaEvento('trigger-leitura-tags-executando');

        /**
         * Array de string contendo as tags para ler
         * @type {String[]}
         */
        const listaDeTagsParaLer = [];

        // Pra cada leitura pendente, coletar as tags que preciso adicionar no TagGroup pra solicitar
        for (const leituraTag of this.#estado.leituras.pendentesDeLeitura) {
            leituraTag.tags.forEach(tag => {
                if (listaDeTagsParaLer.indexOf(tag.tag) == -1) {
                    listaDeTagsParaLer.push(tag.tag);
                }
            });
        }

        // Iniciar a solicitação de leitura
        const retornoLeituraTags = await this.#estado.controlador.lerMultiplasTags(listaDeTagsParaLer);

        // Passar por todas as tags solicitadas e verificar no retorno da leitura multipla
        for (const leituraDeTag of listaDeTagsParaLer) {

            // Encontrar os lotes de leituras pendentes que possuem essa tag no meio
            const loteLeiturasDessaTag = this.#estado.leituras.pendentesDeLeitura.filter(l => l.tags.find(t => t.tag == leituraDeTag) != undefined);

            this.log(`Leitura da tag ${leituraDeTag} tem ${loteLeiturasDessaTag.length} callbacks pendentes.`);


            // Se a leitura múltipla não deu certo, nenhuma tag foi lida. Retorno o erro
            if (!retornoLeituraTags.isSucesso) {

                // Passar em cada lote, e confirmar para o lote que a leitura retornou erro
                for (const loteLeitura of loteLeiturasDessaTag) {
                    loteLeitura.confirmaTag(leituraDeTag, undefined, undefined, false, {
                        descricao: retornoLeituraTags.erro.descricao
                    })
                }

                continue;
            }

            // Beleza, se a leitura multipla deu certo, isso me diz que pelo menos o dispositivo retornou o resultado das tags lidas
            const resultadoTagLida = retornoLeituraTags.sucesso.tags.find(t => t.tag == leituraDeTag);

            // Por algum motivo a tag lida não foi retornado no retorno da leitura multipla(não devia acontecer)
            if (resultadoTagLida == undefined) {

                for (const loteLeitura of loteLeiturasDessaTag) {
                    loteLeitura.confirmaTag(leituraDeTag, undefined, undefined, false, {
                        descricao: `Não foi retornado nenhuma informação da tag na solicitação de leitura do controlador.`
                    })
                }

                continue;
            }

            // Se a leitura da tag retornado não deu sucesso
            if (!resultadoTagLida.isSucesso) {

                for (const loteLeitura of loteLeiturasDessaTag) {
                    loteLeitura.confirmaTag(leituraDeTag, undefined, undefined, false, {
                        descricao: resultadoTagLida.erro.descricao
                    })
                }

                continue;
            }

            // Atualizar o cache com as informações do Data Type da tag lida
            if (resultadoTagLida.sucesso.isAtomico) {
                this.atualizarCacheTagDataType(leituraDeTag, {
                    isAtomico: true,
                    atomico: {
                        codigoAtomico: resultadoTagLida.sucesso.atomico.dataType.codigo
                    }
                })
            } else if (resultadoTagLida.sucesso.isStruct) {
                this.atualizarCacheTagDataType(leituraDeTag, {
                    isStruct: true,
                    struct: {
                        codigoStruct: resultadoTagLida.sucesso.struct.dataTypeStruct.codigoTipoStruct
                    }
                })
            }

            // Leitura confirmada com sucesso
            for (const loteLeitura of loteLeiturasDessaTag) {

                if (resultadoTagLida.sucesso.isAtomico) {
                    loteLeitura.confirmaTag(leituraDeTag, {
                        isAtomico: true,
                        atomico: {
                            codigoAtomico: resultadoTagLida.sucesso.atomico.dataType.codigo,
                            descricao: resultadoTagLida.sucesso.atomico.dataType.descricao,
                            isSigned: resultadoTagLida.sucesso.atomico.dataType.isSigned,
                            tamanho: resultadoTagLida.sucesso.atomico.dataType.tamanho
                        }
                    }, {
                        isAtomico: true,
                        atomico: {
                            numero: resultadoTagLida.sucesso.atomico.valor
                        }
                    }, true);

                } else if (resultadoTagLida.sucesso.isStruct) {

                    // Verificar o tipo da Struct
                    switch (resultadoTagLida.sucesso.struct.dataTypeStruct.codigoTipoStruct) {
                        case this.#estado.controlador.getDataTypes().structs.ASCIISTRING82.codigoTipoStruct: {

                            loteLeitura.confirmaTag(leituraDeTag, {
                                isStruct: true,
                                struct: {
                                    codigoStruct: resultadoTagLida.sucesso.struct.dataTypeStruct.codigoTipoStruct,
                                    descricao: resultadoTagLida.sucesso.struct.dataTypeStruct.descricao
                                }
                            }, {
                                isStruct: true,
                                struct: {
                                    isASCIIString82: true,
                                    ASCIIString82: {
                                        string: resultadoTagLida.sucesso.struct.valor.stringConteudo
                                    }
                                }
                            }, true)
                            break;
                        }
                        // Se for um Data Type Struct não suportado, retorno como erro
                        default: {
                            loteLeitura.confirmaTag(leituraDeTag, undefined, undefined, false, {
                                descricao: `Data Type Struct não suportado para leitura: ${resultadoTagLida.sucesso.struct.dataTypeStruct}.`
                            })

                            break;
                        }
                    }
                } else {
                    loteLeitura.confirmaTag(leituraDeTag, undefined, undefined, false, {
                        descricao: `Data Type não suportado para leitura da tag`
                    })
                }
            }
        }

        this.#estado.leituras.isLeituraExecutando = false;
        this.#estado.emissorEventos.disparaEvento('trigger-leitura-tags-finalizado');
    }

    /**
     * Inicia a escrita das tags que estão pendentes
     */
    async #triggerEscreverTags() {
        if (this.#estado.escritas.isEscritaPendente) {
            this.log(`Já existe uma chamada de escrita pendente. Ignorando...`);
            return;
        }

        if (this.#estado.escritas.isEscritaExecutando) {
            this.log(`Já existe uma chamada de escrita em execução no CompactLogix. Ignorando...`);
            return;
        }

        if (this.#estado.escritas.pendentesDeEscrita.length == 0) {
            this.log(`Não existem escritas pendentes para executar o trigger de escrita.`);
            return;
        }

        let dataAgra = new Date();
        const diffMsUltimaExecucao = dataAgra.getTime() - (this.#estado.escritas.dataUltimaExecucao != undefined ? this.#estado.escritas.dataUltimaExecucao.getTime() : this.#configuracoes.escrita.tempoMinimoEntreEscritas + 1);

        // Se o tempo desde a ultima escrita ainda não atingiu o tempo minimo de espera
        if (this.#estado.escritas.dataUltimaExecucao != undefined && (diffMsUltimaExecucao < this.#configuracoes.escrita.tempoMinimoEntreEscritas)) {
            this.#estado.escritas.isEscritaPendente = true;
            let diffRestante = this.#configuracoes.escrita.tempoMinimoEntreEscritas - diffMsUltimaExecucao;

            setTimeout(() => {
                this.#estado.escritas.isEscritaPendente = false;
                this.#triggerEscreverTags();
            }, diffRestante);

            return;
        }

        this.#estado.escritas.dataUltimaExecucao = dataAgra;
        this.log(`Iniciando escrita de tags pendentes...`);
        this.#estado.escritas.isEscritaExecutando = true;
        this.#estado.emissorEventos.disparaEvento('trigger-escreve-tags-executando')

        /**
         * @typedef TagParaEscrever
         * @property {String} tag - Nome da tag
         * @property {*} valor - Valor a ser escrito na tag
         */

        /**
         * Tags para adicionar no grupo
         * @type {TagParaEscrever[]}
         */
        const tagsParaEscrever = []

        for (const tagEscrever of this.#estado.escritas.pendentesDeEscrita) {
            tagEscrever.tags.forEach(tag => {
                tagsParaEscrever.push({
                    tag: tag.tag,
                    valor: tag.valor
                })
            });
        }

        this.log(`Iniciando escrita de ${tagsParaEscrever.length} tags...`);

        const retornoEscritaTags = await this.#estado.controlador.escreveMultiplasTags(tagsParaEscrever.map(t => {

            // Verificar a existencia do DataType no cache
            const existeDataTypeCache = this.#estado.cacheDataTypes.find(cT => cT.tag == t.tag);
            let dataTypePadrao = {
                isResolverAutomaticamente: true,
                resolverAutomaticamente: {
                    valor: t.valor
                }
            }

            // Se existir, definir no objeto o data type com seu valor correto
            if (existeDataTypeCache != undefined) {
                this.log(`Tag ${t.tag} encontrada no cache de Data Types.`);

                // Tipo atomicos
                if (existeDataTypeCache.isAtomico) {
                    dataTypePadrao = {
                        isAtomico: true,
                        atomico: {
                            codigoAtomico: existeDataTypeCache.atomico.codigoAtomico,
                            valor: t.valor
                        }
                    }

                } else if (existeDataTypeCache.isStruct) {
                    // Structs
                    dataTypePadrao = {
                        isStruct: true,
                        struct: {
                            codigoStruct: existeDataTypeCache.struct.codigoStruct,
                            classeStruct: {}
                        }
                    }

                    // Identificar o tipo da Struct
                    switch (existeDataTypeCache.struct.codigoStruct) {

                        // Se for uma String ASCII 82
                        case this.#estado.controlador.getDataTypes().structs.ASCIISTRING82.codigoTipoStruct: {

                            const classeStructASCIIString82 = {
                                string: t.valor
                            }

                            dataTypePadrao.struct.classeStruct = classeStructASCIIString82;
                            break;
                        }
                        default: {

                            break;
                        }
                    }
                }
            }

            return {
                tag: t.tag,
                dataType: dataTypePadrao
            }
        }))

        // Passar por cada tag solicitada e verificar se houve retorno na resposta da solicitação de escrita
        for (const tagParaEscrever of tagsParaEscrever) {

            // Encontrar os lotes de escritas pendentes que possuem essa tag no meio
            const loteEscritasDessaTag = this.#estado.escritas.pendentesDeEscrita.filter(l => l.tags.find(t => t.tag == tagParaEscrever.tag) != undefined);

            this.log(`Escrita da tag ${tagParaEscrever.tag} tem ${loteEscritasDessaTag.length} callbacks pendentes.`);

            // Se a escrita múltipla não deu certo, nenhuma tag foi escrita. Retorno o erro
            if (!retornoEscritaTags.isSucesso) {

                // Passar em cada lote, e confirmar para o lote que a leitura retornou erro
                for (const loteEscrita of loteEscritasDessaTag) {
                    loteEscrita.confirmaEscrita(tagParaEscrever.tag, false, {
                        descricao: retornoEscritaTags.erro.descricao
                    })
                }

                continue;
            }

            // Beleza, se a escrita multipla deu certo, isso me diz que pelo menos o dispositivo retornou o resultado das tags escritas
            const resultadoTagEscrita = retornoEscritaTags.sucesso.tags.find(t => t.tag == tagParaEscrever.tag);

            // Por algum motivo a tag escrita não foi retornado no retorno da escrita multipla(não devia acontecer)
            if (resultadoTagEscrita == undefined) {

                for (const loteEscrita of loteEscritasDessaTag) {
                    loteEscrita.confirmaEscrita(tagParaEscrever.tag, false, {
                        descricao: `Não foi retornado nenhuma informação da tag na solicitação de escrita do controlador.`
                    })
                }

                continue;
            }

            // Se a escrita da tag retornado não deu sucesso
            if (!resultadoTagEscrita.isSucesso) {

                // Fazer uma validação caso o erro retornado seja pq a tag mudou seu Data Type(raro mas pode acontecer)
                if (resultadoTagEscrita.erro.isSingleServicePacketStatusErro) {
                    if (resultadoTagEscrita.erro.SingleServicePacketStatusErro.isDataTypeIncorreto) {
                        this.deleteCacheTagDataType(tagParaEscrever.tag);
                    }
                }

                for (const loteEscrita of loteEscritasDessaTag) {
                    loteEscrita.confirmaEscrita(tagParaEscrever.tag, false, {
                        descricao: resultadoTagEscrita.erro.descricao
                    })
                }

                continue;
            }

            // Atualizar o cache com as informações do Data Type da tag escrita
            if (resultadoTagEscrita.dataTypeDados.isAtomico) {
                this.atualizarCacheTagDataType(tagParaEscrever.tag, {
                    isAtomico: true,
                    atomico: {
                        codigoAtomico: resultadoTagEscrita.dataTypeDados.atomico.codigoAtomico
                    }
                })
            } else if (resultadoTagEscrita.dataTypeDados.isStruct) {
                this.atualizarCacheTagDataType(tagParaEscrever.tag, {
                    isStruct: true,
                    struct: {
                        codigoStruct: resultadoTagEscrita.dataTypeDados.struct.codigoStruct
                    }
                })
            }

            // Leitura confirmada com sucesso
            for (const loteEscrita of loteEscritasDessaTag) {
                loteEscrita.confirmaEscrita(tagParaEscrever.tag, true);
            }
        }

        this.#estado.escritas.isEscritaExecutando = false;
        this.#estado.emissorEventos.disparaEvento('trigger-escreve-tags-finalizado')
    }

    /**
     * Realiza a leitura de todas as tags na lista de observações e dispara seus callbacks
     */
    async #triggerObservacaoTags() {
        if (this.#estado.observacoes.isRealizandoLeitura) {
            this.log(`Já existe uma leitura de observação em andamento. Ignorando...`);
            return;
        }

        if (this.#estado.observacoes.tags.length == 0) {
            this.log(`Não existem tags para observar.`);
            return;
        }

        this.#estado.observacoes.isRealizandoLeitura = true;

        this.log(`Iniciando trigger de observação de tags...`);

        const tagsParaLer = this.#estado.observacoes.tags.map(t => t.tag);

        const requisitaLeituraTags = await this.lerTags(tagsParaLer);
        if (!requisitaLeituraTags.isSucesso) {

            this.#estado.observacoes.isRealizandoLeitura = false;
            return;
        }

        for (const tagLida of tagsParaLer) {

            const observacoesTag = this.#estado.observacoes.tags.find(t => t.tag == tagLida);
            const resultadoLeitura = requisitaLeituraTags.sucesso.tags.find(t => t.tag == tagLida);

            if (observacoesTag == undefined) continue;
            if (resultadoLeitura == undefined) continue;

            if (!resultadoLeitura.isTagValida) {
                continue;
            }

            let isValorAlterado = false;

            // Verificar se o valor da tag foi alterado
            if (resultadoLeitura.dataType.isAtomico) {
                if (resultadoLeitura.valor.atomico.numero != observacoesTag.valor.atomico.numero) {
                    isValorAlterado = true;
                }

            } else if (resultadoLeitura.dataType.isStruct) {
                if (resultadoLeitura.valor.struct.isASCIIString82) {
                    if (resultadoLeitura.valor.struct.ASCIIString82.string != observacoesTag.valor.struct.ASCIIString82.string) {
                        isValorAlterado = true;
                    }
                }
            }

            // Se alterado
            if (isValorAlterado) {

                // Notificar todos os callbacks
                observacoesTag.callbacks.forEach(c => {
                    if (c.onAlterado != undefined && typeof c.onAlterado == 'function') {
                        c.onAlterado(observacoesTag.valor, resultadoLeitura.valor);
                    }
                })

                // Salvar o novo valor recebido
                observacoesTag.valor = resultadoLeitura.valor;
            }
        }

        this.#estado.observacoes.isRealizandoLeitura = false;
    }

    /**
     * Atualiza a informação do DataType de uma tag no cache
     * @param {String} tag - Nome da tag 
     * @param {Object} dataType - Informações do DataType da tag
     * @param {Boolean} dataType.isAtomico - Se a tag é um tipo atomico
     * @param {Object} dataType.atomico - Informações do tipo atomico
     * @param {Number} dataType.atomico.codigoAtomico - Código do tipo atomico
     * @param {Boolean} dataType.isStruct - Se a tag é um tipo struct
     * @param {Object} dataType.struct - Informações do tipo struct
     * @param {Number} dataType.struct.codigoStruct - Código do tipo struct
     */
    atualizarCacheTagDataType(tag, dataType) {

        let tagCache = this.#estado.cacheDataTypes.find(t => t.tag == tag);
        let isAdicionou = false;
        let isMudouType = false;

        if (tagCache == undefined) {
            tagCache = {
                tag: tag,
                isAtomico: false,
                atomico: {
                    codigoAtomico: -1
                },
                isStruct: false,
                struct: {
                    codigoStruct: -1
                }
            }

            this.#estado.cacheDataTypes.push(tagCache);

            isAdicionou = true;
        }

        if (dataType.isAtomico) {

            let isPrecisaAtualizar = true;
            if (!isAdicionou) {
                if (tagCache.isAtomico != dataType.isAtomico || tagCache.atomico.codigoAtomico != dataType.atomico.codigoAtomico) {
                    isMudouType = true;
                } else {
                    isPrecisaAtualizar = false;
                }
            }

            if (isPrecisaAtualizar) {
                tagCache.isAtomico = true;
                tagCache.atomico.codigoAtomico = dataType.atomico.codigoAtomico;

                tagCache.isStruct = false;
                tagCache.struct.codigoStruct = -1;
            }
        } else if (dataType.isStruct) {

            let isPrecisaAtualizar = true;
            if (!isAdicionou) {
                if (tagCache.isStruct != dataType.isStruct || tagCache.struct.codigoStruct != dataType.struct.codigoStruct) {
                    isMudouType = true;
                } else {
                    isPrecisaAtualizar = false;
                }
            }

            if (isPrecisaAtualizar) {
                tagCache.isStruct = true;
                tagCache.struct.codigoStruct = dataType.struct.codigoStruct;

                tagCache.isAtomico = false;
                tagCache.atomico.codigoAtomico = -1;
            }
        }

        if (isAdicionou) {
            this.#estado.emissorEventos.disparaEvento('cache-datatypes-tags-adicionado', tagCache)
            this.log(`Tag ${tag} adicionada ao cache de Data Types.`);
        }

        if (isMudouType) {
            this.#estado.emissorEventos.disparaEvento('cache-datatypes-tags-tipoalterado', tagCache)
            this.log(`Tag ${tag} teve seu tipo de Data Type alterado no cache.`);
        }
    }

    /**
     * Remover uma tag do cache de Data Types
     * @param {String} tag 
     */
    deleteCacheTagDataType(tag) {
        let antes = this.#estado.cacheDataTypes.length
        this.#estado.cacheDataTypes = this.#estado.cacheDataTypes.filter(t => t.tag != tag);

        if (antes != this.#estado.cacheDataTypes.length) {
            this.log(`Tag ${tag} removida do cache de Data Types.`);
        }
    }

    /**
     * Retorna informações do DataType da tag no cache(se existir)
     * @param {String} tag - Nome da tag para buscar no cache
     */
    getCacheTagDataType(tag) {
        return this.#estado.cacheDataTypes.find(t => t.tag == tag);
    }

    /**
     * Retorna o cache de Data Types das tags
     */
    getCacheTagsDataTypes() {
        return this.#estado.cacheData;
    }

    /**
     * Retorna informações do estado de leitura atual
     */
    getEstadoLeituras() {
        return this.#estado.leituras;
    }

    /**
     * Retorna informações do estado de escrita atual
     */
    getEstadoEscritas() {
        return this.#estado.escritas;
    }

    /**
     * Retorna a classe controladora CompactLogix
     */
    getControlador() {
        return this.#estado.controlador;
    }

    /**
     * @typedef {Object} EventosOn
     * @property {string} log - Mensagem de log emitida
     * @property {undefined} `trigger-leitura-tags-executando`
     * @property {undefined} `trigger-leitura-tags-finalizado`
     * @property {undefined} `trigger-escreve-tags-executando`
     * @property {undefined} `trigger-escreve-tags-finalizado`
     * @property {CacheDataType} `cache-datatypes-tags-adicionado` - Detalhes da nova Tag adicionada
     * @property {CacheDataType} `cache-datatypes-tags-tipoalterado` - Novos detalhes da Tag que teve o tipo alterado
     */

    /**
     * Adicionar um listener para um evento
     * 
     * Lista de eventos suportados:
     * - **log**: Disparado quando um evento de log é emitido(como logs do EtherNetIP, leitura e escrita e mensagens de erros ou status)
     * - **trigger-leitura-tags-executando**: Disparado quando a leitura de tags está sendo solicitado ao CompactLogix
     * - **trigger-leitura-tags-finalizado**: Disparado quando a leitura de tags foi finalizada, e todas as tags obtiveram resposta(sendo sucesso ou não.)
     * - **trigger-escreve-tags-executando**: Disparado quando a escrita de tags está sendo solicitado ao CompactLogix
     * - **trigger-escreve-tags-finalizado**: Disparado quando a escrita de tags foi finalizada, e todas as tags obtiveram resposta(sendo sucesso ou não.)
     * - **cache-datatypes-tags-adicionado**: Disparado quando uma tag foi adicionada ao cache de Data Types
     * - **cache-datatypes-tags-tipoalterado**: Disparado quando o tipo de Data Type de uma tag foi alterado no cache
     * 
     * @template {keyof EventosOn} evento
     * @param {evento} ev - Evento a ser escutado 
     * @param {(data: EventosOn[evento]) => void} callback - Callback para executar
     * 
     * Guarde o retorno da função caso queira excluir o listener
     */
    on(ev, callback) {
        return this.#estado.emissorEventos.addEvento(ev, callback);
    }

    /**
     * Retornar todas as estatisticas atuais dos estados
     */
    getEstatisticasEstados() {
        const retEstatisticas = {
            /**
             * Estatisticas de leitura
             */
            leituras: {
                /**
                 * Quantidade pendentes de tags aguardando leitura
                 */
                pendentes: 0,
                /**
                 * Se está sendo executado as leituras das tags pendentes
                 */
                isExecutandoLeitura: this.#estado.leituras.isLeituraExecutando
            },
            /**
             * Estatísticas de escritas
             */
            escritas: {
                /**
                 * Quantidade pendentes de tags aguardando escrita
                 */
                pendentes: 0,
                /**
                 * Se está sendo executado as escritas das tags pendentes
                 */
                isExecutandoEscrita: this.#estado.escritas.isEscritaExecutando
            },
            /**
             * Estatísticas do cache de Data Types de tags
             */
            cacheDataTypes: {
                /**
                 * Quantidade de tags no cache de Data Types
                 */
                quantidade: this.#estado.cacheDataTypes.length,
                /**
                 * Tags no cache de Data Types
                 */
                tags: this.#estado.cacheDataTypes
            }
        }

        retEstatisticas.escritas.pendentes = this.#estado.escritas.pendentesDeEscrita.reduce((acc, valor) => {
            return acc + valor.tags.length;
        }, 0)

        retEstatisticas.leituras.pendentes = this.#estado.leituras.pendentesDeLeitura.reduce((acc, valor) => {
            return acc + valor.tags.length;
        }, 0)

        return retEstatisticas;
    }

    /**
     * Anotar um log no console
     * @param {String} msg 
     */
    log(msg) {

        this.#estado.emissorEventos.disparaEvento('log', msg);
        if (!this.#configuracoes.isMostrarConsoleLogs) return;

        let dataAgora = new Date();
        let dataFormatada = `${dataAgora.getDate().toString().padStart(2, '0')}/${(dataAgora.getMonth() + 1).toString().padStart(2, '0')}/${dataAgora.getFullYear()} ${dataAgora.getHours().toString().padStart(2, '0')}:${dataAgora.getMinutes().toString().padStart(2, '0')}:${dataAgora.getSeconds().toString().padStart(2, '0')}`;

        let conteudoMsg = ''
        if (typeof msg == 'object') {
            conteudoMsg = JSON.stringify(msg);
        } else {
            conteudoMsg = msg;
        }


        console.log(`[${dataFormatada} [CompactLogix ${this.#configuracoes.ip}] ${conteudoMsg}`);
    }
}