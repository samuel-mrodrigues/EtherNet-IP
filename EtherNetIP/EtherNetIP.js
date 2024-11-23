import { Socket } from "net";
import { EmissorEvento } from "../Utils/EmissorEvento.js";

import { EtherNetIPLayerBuilder } from "./Builder/Layers/EtherNetIP/EtherNetIPBuilder.js";
import { EtherNetIPLayerParser, Status } from "./Parser/Layers/EtherNetIP/EtherNetIPParser.js";

/**
 * Uma classe auxiliar para tratar com a comunicação para o protocolo EtherNet IP(Industrial Protocol)
 */
export class EtherNetIPSocket {

    /**
     * @callback CallbackConexaoEstabelecida
     */

    /**
     * @callback CallbackConexaoFechada
     */

    /**
     * @callback CallbackConexaoErro
     * @param {String} descricao - Descrição do erro ocorrido
     */

    /**
     * @callback CallbackConexaoNovoPacoteEtherNetIP
     * @param {EtherNetIPLayerParser} enipParser - Parser do pacote EtherNet/IP recebido
     * @param {Object} enipID - Detalhes do ID unico do pacote EtherNet/IP
     * @param {Number} enipID.ID - O ID unico do pacote EtherNet/IP
     * @param {String} enipID.digitoAleatorio - 4 digitos aleatórios usado para compor o ID
     * @param {String} enipID.dateTime - 8 digitos do timestamp em millisegundos usado para compor o ID
     */

    /**
     * @callback CallbackLog
     * @param {String} mensagem - Mensagem de log disparada
     */

    #configuracao = {
        ip: '',
        porta: 0,
        logs: {
            habilitarLogsConsole: false
        }
    }

    #estado = {
        /**
         * @type {Socket} - Socket de comunicação com o dispositivo remoto
         */
        socket: undefined,
        emissorEvento: new EmissorEvento('EtherNetIPSocket'),
        /**
         * Estado da conexão do Socket(apenas a conexão bruta TCP, não tem relação com a autenticação EtherNet/IP)
         */
        conexao: {
            /**
             * Indica se já tentou conectar alguma vez
             */
            isJaTentouConectar: false,
            /**
             * Indica se a conexão foi estabelecida
             */
            isConectado: false,
            /**
             * Indica se está tentando estabelecer a conexão
             */
            isConectando: false,
            /**
             * Se não estiver conectado e nem tentando conectar e já tentou conectar, contém detalhes do motivo de não estar conectado.
             */
            detalhesErro: {
                descricao: ''
            }
        },
        /**
         * Estado da conexão EtherNet/IP
         */
        ethernetIP: {
            /**
             * Detalhes de autenticação com o dispositivo EtherNet IP
             */
            autenticacao: {
                /**
                 * ID numerico do Session Handler
                 */
                sessionHandlerID: 0,
                /**
                 * Indica se está autenticado com o dispositivo EtherNet/IP
                 */
                isAutenticado: false,
                /**
                 * Indica se está tentando autenticar com o dispositivo EtherNet/IP
                 */
                isAutenticando: false,
                /**
                 * Indica se já tentou autenticar com o dispositivo EtherNet/IP
                 */
                isJaTentouAutenticar: false,
                /**
                 * Se não estiver autenticado e nem tentando autenticar e já tentou autenticar, contém detalhes do motivo de não estar autenticado.
                 */
                detalhesErro: {
                    descricao: ''
                }
            }
        },
        /**
         * Algumas configurações do comportamento do Socket EtherNet/IP
         */
        opcoes: {
            /**
             * Se o Socket deve tentar reconectar automaticamente quando a conexão cair
             */
            autoReconectar: false,
            /**
             * Se foi forçado a desconexão via algum metodo, o Socket não deve tentar reconectar automaticamente
             */
            desconectadoManualmente: false,
            /**
             * O setInterval ID que verifica o estado da conexão
             */
            setIntervalIDVerificaConexao: -1
        }
    }

    /**
     * Parametros de conexão com o dispositivo EtherNet/IP
     * @param {Object} parametros
     * @param {Object} parametros.conexao - Informações de conexão com o hoist
     * @param {String} parametros.conexao.ip - Endereço IP
     * @param {Number} parametros.conexao.porta - Porta 
     * @param {Boolean} parametros.isHabilitaLogs - Habilita logs no console
     * @param {Boolean} parametros.isAutoReconnect - Se deve tentar reconectar automaticamente quando: 1. A conexão TCP cair ou 2. A sessão EtherNet/IP desautenticar por algum motivo
     */
    constructor(parametros) {
        if (parametros == undefined || typeof parametros != 'object') throw new Error('Os parametros de conexão pelo menos devem ser informados');
        if (parametros.conexao == undefined || typeof parametros.conexao != 'object') throw new Error('Os parametros de conexão com o host devem ser informados');

        if (parametros.conexao.ip == undefined) throw new Error('Endereço IP do host não informado');
        if (parametros.conexao.porta == undefined) throw new Error('Porta do host não informada');

        if (parametros.isAutoReconnect) {
            this.toggleAutoReconnect(true);
        }

        this.#configuracao.ip = parametros.conexao.ip;
        this.#configuracao.porta = parametros.conexao.porta;

        if (parametros.isHabilitaLogs != undefined && typeof parametros.isHabilitaLogs == 'boolean') {
            this.#configuracao.logs.habilitarLogsConsole = parametros.isHabilitaLogs;
        }
    }

    /**
     * Ativa/desativa a reconexão automatica com o dispositivo EtherNet/IP quando a conexão cair.
     * @param {Boolean} bool - Se deve ativar ou desativar a reconexão automatica
     */
    toggleAutoReconnect(bool = false) {
        this.#estado.opcoes.autoReconectar = bool;

        if (bool) {
            this.log('Reconexão automatica ativada.');

            if (this.#estado.opcoes.setIntervalIDVerificaConexao == -1) {
                this.#estado.opcoes.setIntervalIDVerificaConexao = setInterval(() => {

                    // Só deve tentar reconectar SE já foi manualmente informado a tentativa de conectar
                    if (!this.#estado.conexao.isJaTentouConectar) {
                        this.log('Reconexão automatica desativada pois ainda não foi tentado conectar manualmente.');
                        return;
                    }

                    // Se a conexão TCP não tiver conectada, iniciar
                    if (!this.#estado.conexao.isConectado) {
                        this.log('Reconectando automaticamente...');
                        this.conectar();
                    }

                    // Se por algum motivo estiver com a sessão desautenticada, tentar autenticar novamente
                    if (!this.#estado.ethernetIP.autenticacao.isAutenticado && !this.#estado.ethernetIP.autenticacao.isAutenticando && this.#estado.conexao.isConectado) {
                        this.log('Reautenticando automaticamente...');
                        this.autenticarENIP();
                    }
                }, 5000);
            }
        } else {
            this.log('Reconexão automatica desativada.');
            clearInterval(this.#estado.opcoes.setIntervalIDVerificaConexao);
        }
    }

    /**
     * Ativa/desativa os logs no console
     * @param {Boolean} bool 
     */
    toggleLogs(bool = false) {

        this.#configuracao.logs.habilitarLogsConsole = bool;
    }

    /**
     * Retorna um layer builder de EtherNet/IP para ser utilizado. Já vem configurado as informações básicas do cabeçalho.
     */
    getNovoLayerBuilder() {
        const novoLayer = new EtherNetIPLayerBuilder();

        if (this.#estado.ethernetIP.autenticacao.isAutenticado) {
            novoLayer.setSessionHandle(this.#estado.ethernetIP.autenticacao.sessionHandlerID);
        }

        return novoLayer;
    }

    /**
     * @typedef RetornoEnviarENIP
     * @property {Boolean} isSucesso - Se a operação de enviar o pacote ENIP no Socket e receber a resposta foi bem sucedida.
     * @property {Object} enipEnviar - Informações do ENIP enviado
     * @property {Boolean} enipEnviar.isEnviou - Se o pacote ENIP foi escrito no socket com sucesso
     * @property {EtherNetIPLayerBuilder} enipEnviar.enipBuilder - O builder ENIP enviado com as informações atualizadas
     * @property {Object} enipEnviar.erro - Se ocorreu erros no envio ou recebimento do pacote ENIP, contém detalhes do erro
     * @property {String} enipEnviar.erro.descricao - Descrição do erro generalizado
     * @property {Boolean} enipEnviar.erro.isWriteSocket - Se o erro ocorrido foi ao escrever no socket
     * @property {Boolean} enipEnviar.erro.isGerarBuffer - Se o erro ocorrido foi devido a geração do Buffer
     * @property {Object} enipEnviar.erro.erroGerarBuffer - Detalhes do erro ao gerar o Buffer do pacote ENIP
     * @property {Array<String>} enipEnviar.erro.erroGerarBuffer.traceLog - Histórico de logs do erro ao gerar o Buffer do pacote ENIP
     * @property {Object} enipReceber - Informações do ENIP recebido
     * @property {Boolean} enipReceber.isRecebeu - Se a resposta do pacote ENIP solicitado foi recebida com sucesso
     * @property {EtherNetIPLayerParser} enipReceber.enipParser - O parser ENIP recebido com as informações atualizadas
     * @property {Object} enipReceber.erro - Se ocorreu erros no envio ou recebimento do pacote ENIP, contém detalhes do erro
     * @property {String} enipReceber.erro.descricao - Descrição do erro generalizado
     * @property {Boolean} enipReceber.erro.isDemorouResposta - Se o erro ocorrido foi devido a demora na resposta do pacote ENIP
     * @property {Object} enipDetalhes - Detalhes do ENIP enviado
     * @property {Object} enipDetalhes.idENIP - O ID único gerado para identificar a requisição ENIP
     * @property {Number} enipDetalhes.idENIP.ID - O ID único gerado para identificar a requisição ENIP
     * @property {String} enipDetalhes.idENIP.digitoAleatorio - 4 digitos aleatórios usado para compor o ID
     * @property {String} enipDetalhes.idENIP.dateTime - 8 digitos do timestamp em millisegundos usado para compor o ID
     */

    /**
     * Envia um pacote EtherNet/IP para o dispositivo
     * @param {EtherNetIPLayerBuilder} enip - O Builder do pacote EtherNet/IP para enviar
     * @returns {Promise<RetornoEnviarENIP>} - Status do envio do pacote EtherNet/IP
     */
    async enviarENIP(enip) {

        /**
         * @type {RetornoEnviarENIP}
         */
        const envioStatus = {
            isSucesso: false,
            enipEnviar: {
                isEnviou: false,
                enipBuilder: undefined,
                erro: {
                    descricao: ''
                },
            },
            enipReceber: {
                isRecebeu: false,
                enipParser: undefined,
                erro: {
                    descricao: ''
                },
            },
            enipDetalhes: {
                idENIP: {
                    dateTime: undefined,
                    digitoAleatorio: undefined,
                    ID: undefined
                }
            }
        }

        if (enip == undefined || !(enip instanceof EtherNetIPLayerBuilder)) throw new Error('O pacote EtherNet/IP deve ser informado');

        if (!this.#estado.conexao.isConectado) {
            envioStatus.enipEnviar.erro.descricao = 'Não é possível enviar pacotes EtherNet/IP pois não está conectado.';
            return envioStatus;
        }

        const getUniqueIDENIP = this.getNovoIDENIP();

        // Salvar no retorno as informações do ID unico ENIP
        envioStatus.enipDetalhes.idENIP = {
            ...envioStatus.enipDetalhes.idENIP,
            ID: getUniqueIDENIP.ID,
            digitoAleatorio: getUniqueIDENIP.digitoAleatorio,
            dateTime: getUniqueIDENIP.dateTime
        }

        // Criar um Buffer de 8 bytes para o Sender Context
        let sessionContextoBuff = Buffer.alloc(8);

        // Escrever nos primeiros 5 bytes o ID gerado
        sessionContextoBuff.writeUIntLE(getUniqueIDENIP.ID, 0, 5);

        // Setar o contexto pra identificar posteriormente o recebimento da requisição
        enip.setSenderContext(sessionContextoBuff);

        // Criar o Buffer completo
        const bufferENIP = enip.criarBuffer();

        envioStatus.enipEnviar.enipBuilder = enip;

        // Se não foi possível criar o buffer do ENIP
        if (!bufferENIP.isSucesso) {
            envioStatus.enipEnviar.erro.descricao = `Erro ao criar Buffer do pacote EtherNet/IP: ${bufferENIP.erro.descricao}`;

            envioStatus.enipEnviar.erro.isGerarBuffer = true;
            envioStatus.enipEnviar.erro.erroGerarBuffer.traceLog = bufferENIP.tracer.getHistoricoOrdenado();

            this.log(`Erro ao criar Buffer do pacote EtherNet/IP: ${bufferENIP.erro.descricao}. Tracelog: ${bufferENIP.tracer.getHistoricoOrdenado().join(' -> ')}`);
            return envioStatus;
        }

        const tempoBaseDeAguardarENIP = 9000;

        // Se gerou com sucesso o Buffer, enviar ao dispositivo
        return new Promise((resolve) => {
            this.#estado.socket.write(bufferENIP.sucesso.buffer, (err) => {
                if (err) {
                    envioStatus.enipEnviar.erro.descricao = `Erro ao escrever no Socket o pacote EtherNet/IP: ${err.message}`;
                    envioStatus.enipEnviar.erro.isWriteSocket = true;

                    this.log(`Erro ao escrever no Socket o pacote EtherNet/IP: ${err.message}`);
                    return resolve(envioStatus);
                }

                // Aqui escreveu com sucesso
                envioStatus.enipEnviar.isEnviou = true;
                this.log(`Pacote EtherNet/IP enviado com sucesso com ENIP ID: ${getUniqueIDENIP.ID}. Aguardando resposta...`);

                //---- Adicionar um listener que aguarda a execução do pacote ENIP
                this.#estado.emissorEvento.addEvento(`novo_pacote_enip:${getUniqueIDENIP.ID}`, (enipParser, enipID) => {

                    // Se for recebido a confrmiação do pacote ENIP
                    this.log(`Pacote EtherNet/IP confirmado o recebimento: ${enipID.ID}.`);

                    envioStatus.enipReceber.isRecebeu = true;
                    envioStatus.enipReceber.enipParser = enipParser;

                    envioStatus.isSucesso = true;

                    return resolve(envioStatus);
                }, {
                    excluirAposExecutar: true,
                    expirarAposMs: {
                        expirarAposMs: tempoBaseDeAguardarENIP,
                        // Cria um callback de expiração junto pra caso o pacote não seja recebido no tempo definido
                        callback: () => {
                            this.log(`Tempo de espera do pacote EtherNet/IP com Sender Context ID: ${getUniqueIDENIP.ID} expirou. Não foi recebido a resposta :( `);

                            envioStatus.enipReceber.erro.descricao = `Tempo de espera pacote EtherNet/IP expirou. Não foi recebido a resposta em ${tempoBaseDeAguardarENIP} ms.`;
                            envioStatus.enipReceber.erro.isDemorouResposta = true;

                            return resolve(envioStatus);
                        }
                    }
                });
                // -----

            });
        })
    }

    /**
     * Retorna um número para ser utilizado no Sender Context do cabeçalho ENIP, afim de identificar a resposta do dispositivo quando chegar 
     ** O ID é composto de 8 digitos do timestamp atual em milissegundos + 4 digitos aleatório, fechando 12 digitos.
     */
    getNovoIDENIP() {
        /**
         * Detalhes do ENIP
         */
        let enipID = {
            /**
             * O numero ID gerado dos 8 digitos timestamp + 4 digitos aleatório
             * @type {Number}
             */
            ID: undefined,
            /**
             * 4 digitos aleatórios usado para compor o ID
             * @type {String}
             */
            digitoAleatorio: undefined,
            /** 
             * 8 digitos do timestamp em millisegundos usado para compor o ID 
             * @type {String}
             */
            dateTime: undefined,
            /**
             * Buffer de 5 bytes UINT com o ID armazenado como LE
             * @type {Buffer}
             */
            buffer: undefined
        }

        const dataAgoraMillis = new Date().getTime().toString().substring(5);
        const digitoAleatorio = Math.floor(Math.random() * 10000).toString().padStart(4, '0');

        const novoId = parseInt(`${dataAgoraMillis}${digitoAleatorio}`);

        const bufferIdNumero = Buffer.alloc(5);
        bufferIdNumero.writeUIntLE(novoId, 0, 5);

        enipID.ID = novoId;
        enipID.digitoAleatorio = digitoAleatorio;
        enipID.dateTime = dataAgoraMillis;
        enipID.buffer = bufferIdNumero;

        return enipID;
    }

    /**
     * Conecta com o dispositivo EtherNet/IP
     * @returns {Promise<conectarRetorno>} - Status da conexão com o dispositivo EtherNet/IP
     */
    async conectar() {
        /**
         * @typedef conectarRetorno
         * @property {Boolean} isConectou - Se a conexão foi estabelecida com sucesso
         * @property {Object} erro - Se ocorreu erros na conexão, contém detalhes do erro
         * @property {String} erro.descricao - Descrição do erro generalizado
         * @property {Boolean} erro.isSemConexao - A conexão com o dispositivo demorou
         * @property {Boolean} erro.isFalhaAutenticar - A conexão foi TCP foi estabelecida, porém não foi possível autenticar o Register Session
         * @property {Boolean} erro.isJaAutenticando - Já existe uma solicitação de autenticação pendente
         * @property {Boolean} erro.isDispositivoRecusou - O dispositivo recusou a conexão
         */

        /**
         * @type {conectarRetorno}
         */
        const retornoConexao = {
            isConectou: false,
            erro: {
                descricao: '',
                isFalhaAutenticar: false,
                isSemConexao: false,
                isDispositivoRecusou: false,
                isJaAutenticando: false
            }
        }

        let resolvePromise = undefined;

        // Se já tiver um Socket conectado, remover ele
        if (this.#estado.conexao.isConectado) {

            if (this.#estado.ethernetIP.autenticacao.isAutenticado) {
                await this.desautenticarENIP();
            }

            await this.desconectar();
        }

        // Se já estiver tentando conectar
        if (this.#estado.conexao.isConectando) {
            retornoConexao.erro.descricao = 'Já existe uma tentativa de conexão pendente ativa.';
            retornoConexao.erro.isJaAutenticando = true;

            this.log('Solicitado tentativa de iniciar conexão porém já existe uma tentativa de conexão pendente.');
            return retornoConexao;
        }

        this.log('Tentando estabelecer conexão...');
        this.#estado.opcoes.desconectadoManualmente = false;

        // Atualiza os estados de conexão
        this.#estado.conexao.isConectando = true;
        this.#estado.conexao.isConectado = false;
        this.#estado.conexao.isJaTentouConectar = true;
        this.#estado.conexao.detalhesErro.descricao = '';

        this.#estado.ethernetIP.autenticacao.isAutenticado = false;
        this.#estado.ethernetIP.autenticacao.isAutenticando = false;
        this.#estado.ethernetIP.autenticacao.sessionHandlerID = 0;

        const novoSocket = new Socket()
        this.#estado.socket = novoSocket;

        novoSocket.on('close', (houveErro) => {
            this.#onConexaoFechada(houveErro);
            resolvePromise(retornoConexao)
        })

        novoSocket.on('data', (dados) => {
            this.#onConexaoDadosRecebidos(dados);
        })

        novoSocket.on('error', (erro) => {
            switch (erro.code) {
                case 'ETIMEDOUT': {
                    retornoConexao.erro.descricao = 'Tempo de conexão com o dispositivo expirou.';
                    retornoConexao.erro.isSemConexao = true;
                    break;
                }
                case 'ECONNREFUSED': {
                    retornoConexao.erro.descricao = 'O dispositivo recusou a conexão.';
                    retornoConexao.erro.isDispositivoRecusou = true;
                    break;
                }
                default: {
                    retornoConexao.erro.descricao = erro.message;
                    break;
                }
            }
            this.#onConexaoErro(erro);
        })

        novoSocket.on('ready', async () => {
            this.#onConexaoEstabelecida();

            let retornoAutentica = await this.autenticarENIP();
            if (retornoAutentica.isAutenticou) {
                retornoConexao.isConectou = true;
            } else {
                retornoConexao.erro.descricao = `${retornoAutentica.erro.descricao}`;
            }

            resolvePromise(retornoConexao)
        })

        novoSocket.connect({ host: this.#configuracao.ip, port: this.#configuracao.porta });

        return new Promise((resolve) => {

            resolvePromise = resolve;
        })
    }

    /**
     * Desconecta com o dispositivo EtherNet/IP. É enviado a solicitação de UnRegisterSession e depois é destruido o Socket.
     */
    async desconectar() {
        await this.desautenticarENIP();

        this.#estado.opcoes.desconectadoManualmente = true;
        this.#estado.socket.destroy();
    }

    /**
     * Enviar a solicitação de RegisterSession ao dispositivo para obter o Session Handle
     */
    async autenticarENIP() {
        const detalhesAutentica = {
            /**
             * Se foi possível se autenticar
             */
            isAutenticou: false,
            /**
             * Detalhes da autenticação se sucesso
             */
            autenticado: {
                /**
                 * ID numerico do Session Handler
                 */
                sessionHandlerID: undefined
            },
            erro: {
                descricao: '',
                /**
                 * Se já está autenticado
                 */
                isJaAutenticado: false
            }
        }

        // Se já tiver uma solicitação de autenticação pendente
        if (this.#estado.ethernetIP.autenticacao.isAutenticando) {
            detalhesAutentica.erro.descricao = 'Já existe uma solicitação de autenticação pendente.';

            this.log('Solicitado autenticação porém já existe uma solicitação de autenticação pendente.');
            return detalhesAutentica;
        }

        // Se já estiver conectado, não precisa autenticar
        if (this.#estado.ethernetIP.autenticacao.isAutenticado) {
            detalhesAutentica.erro.descricao = 'Já está autenticado com o dispositivo EtherNet/IP.';
            detalhesAutentica.erro.isJaAutenticado = true;

            this.log('Solicitado autenticação porém já está autenticado.');
            return detalhesAutentica;
        }

        this.#estado.ethernetIP.autenticacao.isAutenticando = true;
        this.#estado.ethernetIP.autenticacao.isAutenticado = false;
        this.#estado.ethernetIP.autenticacao.isJaTentouAutenticar = true;
        this.#estado.ethernetIP.autenticacao.detalhesErro.descricao = '';
        this.#estado.ethernetIP.autenticacao.sessionHandlerID = 0;

        // Enviar a solicitação de RegisterSession ao dispositivo para obter o Session Handle
        this.log('Autenticando com o dispositivo EtherNet/IP...');

        const novoPacoteENIP = new EtherNetIPLayerBuilder();
        novoPacoteENIP.buildRegisterSession({ optionFlags: Buffer.from([0x00, 0x00]), protocolVersion: 1 });

        let statusEnviaENIP = await this.enviarENIP(novoPacoteENIP);

        // Se não deu sucesso, analisar o motivo do erro
        if (!statusEnviaENIP.isSucesso) {

            // Se o erro foi pq não conseguiu enviar o ENIP
            if (!statusEnviaENIP.enipEnviar.isEnviou) {

                // Se o erro foi pq deu erro ao escrever o buffer no socket
                if (statusEnviaENIP.enipEnviar.erro.isWriteSocket) {
                    detalhesAutentica.erro.descricao = `Ocorreu um erro ao enviar o Buffer do pacote EtherNet/IP do comando RegisterSession pro Socket: ${statusEnviaENIP.enipEnviar.erro.descricao}`;
                } else if (statusEnviaENIP.enipEnviar.erro.isGerarBuffer) {
                    detalhesAutentica.erro.descricao = `Ocorreu um erro ao gerar o Buffer do pacote EtherNet/IP do comando RegisterSession: ${statusEnviaENIP.enipEnviar.erro.descricao}. Tracelog: ${statusEnviaENIP.enipEnviar.erro.erroGerarBuffer.traceLog.join(' -> ')}`;
                } else {
                    // Para qualquer outro erro genérico
                    detalhesAutentica.erro.descricao = `Ocorreu um erro ao enviar o pacote EtherNet/IP do comando RegisterSession: ${statusEnviaENIP.enipEnviar.erro.descricao}`;
                }

                this.#estado.ethernetIP.autenticacao.isAutenticando = false;
                this.#estado.ethernetIP.autenticacao.detalhesErro.descricao = detalhesAutentica.erro.descricao;
                this.log(detalhesAutentica.erro.descricao);
                return detalhesAutentica;
            }

            // Se o erro foi pq não conseguiu receber a resposta ENIP da solicitação inicial
            if (!statusEnviaENIP.enipReceber.isRecebeu) {

                // Demorou a resposta do servidor
                if (statusEnviaENIP.enipReceber.erro.isDemorouResposta) {
                    detalhesAutentica.erro.descricao = `Tempo de espera da resposta do pacote EtherNet/IP do comando RegisterSession expirou: ${statusEnviaENIP.enipReceber.erro.descricao}`;
                } else {
                    // Para qualquer outro erro genérico
                    detalhesAutentica.erro.descricao = `Ocorreu um erro ao receber a resposta do pacote EtherNet/IP do comando RegisterSession: ${statusEnviaENIP.enipReceber.erro.descricao}`;
                }

                this.#estado.ethernetIP.autenticacao.isAutenticando = false;
                this.#estado.ethernetIP.autenticacao.detalhesErro.descricao = detalhesAutentica.erro.descricao;
                this.log(detalhesAutentica.erro.descricao);
                return detalhesAutentica;
            }
        }

        // Se sucesso, eu tenho as informações de autenticação do RegisterSession, que seria no caso apenas o Session Handle ID.
        // Como as informações ficam no cabeçalho EtherNet IP, eu não preciso verificar se o comando é um RegisterSession válido, pois caso contrario não teria nem recebido o pacote de resposta e ele
        // teria sido descartado.

        const ENIPResposta = statusEnviaENIP.enipReceber.enipParser;

        // Validar se o ENIP retornou sucesso
        if (!ENIPResposta.isStatusSucesso().isSucesso) {

            // Ele retorna status de erro 1 se for tentar autenticar novamente, mesmo já estando autenticado. Apesar que eu verifico ali em cima antes se já ta conectado, mas é uma redundância, vai que né..
            if (ENIPResposta.getStatus().codigo == 1) {
                detalhesAutentica.erro.descricao = `Já existe uma sessão autenticada com o dispositivo EtherNet/IP.`;
                detalhesAutentica.erro.isJaAutenticado = true;
            } else {
                detalhesAutentica.erro.descricao = `O pacote EtherNet/IP do comando RegisterSession retornou um erro: ${ENIPResposta.isStatusSucesso().erro.descricao}`;
            }

            this.#estado.ethernetIP.autenticacao.isAutenticando = false;
            this.#estado.ethernetIP.autenticacao.detalhesErro.descricao = detalhesAutentica.erro.descricao;
            return detalhesAutentica;
        }

        const sessionHandlerID = ENIPResposta.getSessionHandlerID();
        this.#estado.ethernetIP.autenticacao.sessionHandlerID = sessionHandlerID;
        this.#estado.ethernetIP.autenticacao.isAutenticando = false;
        this.#estado.ethernetIP.autenticacao.isAutenticado = true;
        this.#estado.ethernetIP.autenticacao.detalhesErro.descricao = '';

        detalhesAutentica.autenticado.sessionHandlerID = sessionHandlerID;
        detalhesAutentica.isAutenticou = true;

        this.log(`Autenticado com sucesso com o dispositivo EtherNet/IP. Session Handle ID: ${sessionHandlerID}`);
        this.#estado.emissorEvento.disparaEvento('autenticado');

        return detalhesAutentica;
    }

    /**
     * Enviar a solicitação de UnRegisterSession com o Session Handler atual
     */
    async desautenticarENIP() {
        const detalhesDesautentica = {
            /**
             * Se foi possível desautenticar
             */
            isDesautenticou: false,
            /**
             * Se não foi possível desautenticar, contém detalhes do erro
             */
            erro: {
                descricao: ''
            }
        }

        // Preparar o pacote ENIP
        const layerENIP = this.getNovoLayerBuilder();
        layerENIP.buildUnRegisterSession();

        // Enviar o pacote ENIP
        let statusEnviaENIP = await this.enviarENIP(layerENIP);

        if (!statusEnviaENIP.isSucesso) {

            if (!statusEnviaENIP.enipEnviar.isEnviou) {
                detalhesDesautentica.erro.descricao = `Ocorreu um erro ao enviar o pacote EtherNet/IP do comando UnRegisterSession: ${statusEnviaENIP.enipEnviar.erro.descricao}`;
                return detalhesDesautentica;
            }

            // Não preciso checar o recebimento pois não é devolvido uma resposta do UnRegisterSession. Na teoria nunca deve cair aqui e somete no if acima
            detalhesDesautentica.erro.descricao = `Ocorreu um erro desconhecido ao desautenticar`;
            return detalhesDesautentica;
        }

        // Se o pacote foi enviado com sucesso, então foi desautenticado
        detalhesDesautentica.isDesautenticou = true;
        this.log(`Desautenticado com sucesso com o dispositivo EtherNet/IP com o Session Handler ${this.#estado.ethernetIP.autenticacao.sessionHandlerID}`);

        this.#estado.ethernetIP.autenticacao.isAutenticado = false;
        this.#estado.ethernetIP.autenticacao.sessionHandlerID = 0;
        this.#estado.emissorEvento.disparaEvento('desautenticado');

        return detalhesDesautentica;
    }

    /**
     * Retorna as informações de conexão atual
     */
    getEstadoConexao() {
        const estadoConexao = {
            isConectado: this.#estado.conexao.isConectado,
            isConectando: this.#estado.conexao.isConectando,
            isJaTentouConectar: this.#estado.conexao.isJaTentouConectar,
            detalhesErro: this.#estado.conexao.detalhesErro.descricao,
            mensagemStatus: ''
        }

        if (estadoConexao.isConectado) {
            estadoConexao.mensagemStatus = 'Conectado';
        } else if (estadoConexao.isConectando) {
            estadoConexao.mensagemStatus = 'Conectando...';
        } else {
            if (estadoConexao.isJaTentouConectar) {
                estadoConexao.mensagemStatus = `Desconectado pelo motivo: ${this.#estado.conexao.detalhesErro.descricao}`;
            } else {
                estadoConexao.mensagemStatus = 'Nenhuma tentativa de conexão foi feita ainda.';
            }
        }

        return estadoConexao;
    }

    /**
     * Retorna as informações de autenticação atual
     */
    getEstadoAutenticacao() {
        const estadoAutenticacao = {
            isAutenticado: this.#estado.ethernetIP.autenticacao.isAutenticado,
            isAutenticando: this.#estado.ethernetIP.autenticacao.isAutenticando,
            isJaTentouAutenticar: this.#estado.ethernetIP.autenticacao.isJaTentouAutenticar,
            detalhesErro: this.#estado.ethernetIP.autenticacao.detalhesErro.descricao,
            mensagemStatus: ''
        }

        if (estadoAutenticacao.isAutenticado) {
            estadoAutenticacao.mensagemStatus = 'Autenticado';
        } else if (estadoAutenticacao.isAutenticando) {
            estadoAutenticacao.mensagemStatus = 'Autenticando...';
        } else {
            if (estadoAutenticacao.isJaTentouAutenticar) {
                estadoAutenticacao.mensagemStatus = `Não autenticado pelo motivo: ${this.#estado.ethernetIP.autenticacao.detalhesErro.descricao}`;
            } else {
                estadoAutenticacao.mensagemStatus = 'Nenhuma tentativa de autenticação foi feita ainda.';
            }
        }

        return estadoAutenticacao;
    }

    /**
     * Retorna o ID do Session Handler atual
     */
    getSessionHandlerID() {
        return this.#estado.ethernetIP.autenticacao.sessionHandlerID;
    }

    /**
     * Adicionar um callback para quando a conexão for estabelecida
     * @param {CallbackConexaoEstabelecida} cb 
     */
    onConectado(cb) {
        return this.#estado.emissorEvento.addEvento('conectado', cb);
    }

    /**
     * Adicionar um callback para quando a conexão for fechada
     * @param {CallbackConexaoFechada} cb 
     */
    onDesconectado(cb) {
        return this.#estado.emissorEvento.addEvento('desconectado', cb);
    }

    /**
     * Adicionar um callback para quando receber um novo pacote ENIP(pacotes invalidos são descartados e ignorados)
     * @param {CallbackConexaoNovoPacoteEtherNetIP} cb 
     */
    onNovoPacoteENIP(cb) {
        return this.#estado.emissorEvento.addEvento('novo_pacote_enip', cb);
    }

    /**
     * Adicionar um callback para quando a autenticação RegisterSession for estabelecida
     * @param {*} cb - Callback que será executado
     */
    onAutenticado(cb) {
        return this.#estado.emissorEvento.addEvento('autenticado', cb);
    }

    /**
     * Adicionar um callback para quando a desautenticação UnRegisterSession for executada
     * @param {*} cb - Callback que será executado
     */
    onDesautenticado(cb) {
        return this.#estado.emissorEvento.addEvento('desautenticado', cb);
    }

    /**
     * Adicionar um callback para quando ocorrer um erro na conexão
     * @param {CallbackConexaoErro} cb
     */
    onErro(cb) {
        return this.#estado.emissorEvento.addEvento('erro', cb);
    }

    /**
     * Adicionar um callback para quando ocorrer um disparo de log
     * @param {CallbackLog} cb
     */
    onLog(cb) {
        return this.#estado.emissorEvento.addEvento('log', cb);
    }

    /**
     * Quando acontecer um erro de conexão
     * @param {Error} erro 
     */
    #onConexaoErro(erro) {
        this.#estado.conexao.detalhesErro.descricao = erro.message;

        this.log(`Conexão ocorreu um erro: ${erro.message}`);
        this.#estado.emissorEvento.disparaEvento('erro', erro.message);
    }

    /**
     * Quando a conexão é fechada
     */
    #onConexaoFechada() {
        this.#estado.conexao.isConectado = false;
        this.#estado.conexao.isConectando = false;

        this.log('Conexão fechada.');
        this.#estado.emissorEvento.disparaEvento('desconectado');

        // Se tiver setado pra reconectar quando a conexão sair
        if (this.#estado.opcoes.autoReconectar && !this.#estado.opcoes.desconectadoManualmente) {
            this.log('Reconectando automaticamente...');
            this.conectar();
        }
    }

    /**
     * Quando a conexão é estabelecida
     */
    #onConexaoEstabelecida() {
        this.#estado.conexao.isConectado = true;
        this.#estado.conexao.isConectando = false;

        this.log('Conexão estabelecida com sucesso.');
        this.#estado.emissorEvento.disparaEvento('conectado');
    }

    /**
     * Quando uma nova sequencia de bytes é recebida
     * @param {Buffer} buffer 
     */
    #onConexaoDadosRecebidos(buffer) {

        // Se receber um buffer nada avé
        if (buffer.length < 4) {
            this.log(`Recebido um pacote EtherNet/IP inválido: Tamanho do pacote menor que 4 bytes, descartando...`);
            return;
        }

        // As vezes pode ocorrer de eu receber mais de um pacote ENIP no mesmo buffer quando o dispositivo remoto recebe muitas solicitações em pouco tempo, então ele manda junto pra economizar recursos.
        // Vou validar o próximos 2 bytes a partir do offset 2 do Buffer que se for um EtherNet IP válido, vai conter o tamanho em bytes de todo o pacote ENIP, e ai eu corto do offset 0 até o seu tamanho final
        let possivelBytesPayloadDoENIP = buffer.readUInt16LE(2);

        // O tamanho total do Buffer passado no evento deve corresponder ao tamanho do payload ENIP + o cabeçalho do EtherNet/IP, que é composto por:
        // 2 bytes do comando
        // 2 bytes do tamanho do payload do pacote ENIP
        // 4 bytes do session handler id
        // 4 bytes do status da solicitação ENIP
        // 8 bytes do sender context
        // 4 bytes do options
        // + o tamanho do payload do pacote ENIP
        const tamanhoPacoteTotal = possivelBytesPayloadDoENIP + 24;

        // Se o tamanho do buffer não corresponder ao tamanho total do pacote ENIP, eu vou cortar a parte que corresponderia provalemente ao pacote ENIP, e chamar novamente o evento de nova mensagem recebida com o restante do buffer
        if (buffer.length != tamanhoPacoteTotal) {

            // Pegar o restante dos bytes que vai sobrar
            const restanteDoBuffer = buffer.subarray(tamanhoPacoteTotal);

            // Cortar o buffer do tamanho do pacote ENIP válido
            const novoBufferCorreto = buffer.subarray(0, tamanhoPacoteTotal);

            this.log(`Recebido provavelmente mais de um pacote EtherNet/IP no mesmo Buffer: Tamanho do pacote esperado era ${tamanhoPacoteTotal} bytes, porém o Buffer recebido tem ${buffer.length} bytes. Prosseguindo com os primeiros ${tamanhoPacoteTotal} bytes e invocando novamente o evento de nova mensagem recebida com os ${restanteDoBuffer.length} bytes restantes.`);
            buffer = novoBufferCorreto;

            this.#onConexaoDadosRecebidos(restanteDoBuffer);
        }

        // Dar parse no Buffer recebido
        const etherNetIPParser = new EtherNetIPLayerParser(buffer);

        // Só aceito se for um Buffer de um pacote EtherNet/IP válido
        // if (!etherNetIPParser.isValido().isValido) {
        //     this.log(`Recebido um pacote EtherNet/IP inválido: ${etherNetIPParser.isValido().erro.descricao}. Stack de erro: ${etherNetIPParser.isValido().tracer.getHistoricoOrdenado().join(' -> ')}`);
        //     return;
        // }


        // Extrair o Sender Context do pacote recebido
        const senderContextBuffer = etherNetIPParser.getSenderContext();

        // Ler os 5 bytes que contém o ID unico da requisição original
        let enipIDUnico = senderContextBuffer.readUIntLE(0, 5);

        // O ID do ENIP é composto por 8 digitos do timestamp + 4 digitos aleatório
        const enipIDUnicoStr = enipIDUnico.toString().padStart(12, '0');
        const enipTimeStampOriginal = enipIDUnicoStr.substring(0, 8);
        const enipDigitoAleatorio = enipIDUnicoStr.substring(8);

        this.log(`Recebido um pacote EtherNet/IP com ENIP ID: ${enipIDUnico}`);

        // Dar uma validada no pacote ENIP recebido se por acaso o erro for devido ao Session Handle invalido
        if (etherNetIPParser.isValido().isValido) {
            if (etherNetIPParser.getStatus().codigo == Status.InvalidSessionHandle.hex) {
                this.#estado.ethernetIP.autenticacao.isAutenticado = false;
            }
        }

        // Emitir o evento que esse pacote foi recebido para quem quiser
        this.#estado.emissorEvento.disparaEvento(`novo_pacote_enip:${enipIDUnico}`, etherNetIPParser, {
            ID: enipIDUnico,
            digitoAleatorio: enipDigitoAleatorio,
            dateTime: enipTimeStampOriginal
        });

        // Emitir de forma global o pacote pra quem tambem tiver interesse
        this.#estado.emissorEvento.disparaEvento('novo_pacote_enip', etherNetIPParser, {
            ID: enipIDUnico,
            digitoAleatorio: enipDigitoAleatorio,
            dateTime: enipTimeStampOriginal
        });
    }

    log(msg) {
        this.#estado.emissorEvento.disparaEvento('log', msg);
        if (!this.#configuracao.logs.habilitarLogsConsole) return;

        let dataAgora = new Date();
        let dataFormatada = `${dataAgora.getDate().toString().padStart(2, '0')}/${(dataAgora.getMonth() + 1).toString().padStart(2, '0')}/${dataAgora.getFullYear()} ${dataAgora.getHours().toString().padStart(2, '0')}:${dataAgora.getMinutes().toString().padStart(2, '0')}:${dataAgora.getSeconds().toString().padStart(2, '0')}`;

        let ctdMsg = '';
        if (typeof msg == 'object') {
            ctdMsg = JSON.stringify(msg);
        } else {
            ctdMsg = msg;
        }

        console.log(`[${dataFormatada}] [EtherNetIPSocket ${this.#configuracao.ip}:${this.#configuracao.porta}] ${ctdMsg}`);
    }
}