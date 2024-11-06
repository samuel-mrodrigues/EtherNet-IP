import { Socket } from "net";
import { EmissorEvento } from "./Utils/EmissorEvento.js";

import { EtherNetIPLayerBuilder } from "../EtherNetIP/Builder/Layers/EtherNetIP/EtherNetIPBuilder.js";
import { EtherNetIPLayerParser } from "../EtherNetIP/Parser/Layers/EtherNetIP/EtherNetIPParser.js";
import { hexDeBuffer } from "../EtherNetIP/Utils/Utils.js";
import { CIPGeneralStatusCodes } from "../EtherNetIP/Utils/CIPRespondeCodes.js";

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
            habilitarLogsConsole: true
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
                sessionHandlerID: -1,
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
        }
    }

    /**
     * Parametros de conexão com o dispositivo EtherNet/IP
     * @param {Object} parametros
     * @param {Object} parametros.conexao - Informações de conexão com o hoist
     * @param {String} parametros.conexao.ip - Endereço IP
     * @param {Number} parametros.conexao.porta - Porta 
     * @param {Boolean} parametros.isHabilitaLogs - Habilita logs no console
     */
    constructor(parametros) {
        if (parametros == undefined || typeof parametros != 'object') throw new Error('Os parametros de conexão pelo menos devem ser informados');
        if (parametros.conexao == undefined || typeof parametros.conexao != 'object') throw new Error('Os parametros de conexão com o host devem ser informados');

        if (parametros.conexao.ip == undefined) throw new Error('Endereço IP do host não informado');
        if (parametros.conexao.porta == undefined) throw new Error('Porta do host não informada');

        this.#configuracao.ip = parametros.conexao.ip;
        this.#configuracao.porta = parametros.conexao.porta;

        if (parametros.isHabilitaLogs != undefined && typeof parametros.isHabilitaLogs == 'boolean') {
            this.#configuracao.logs.habilitarLogsConsole = parametros.isHabilitaLogs;
        }
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
     */
    async conectar() {
        const retornoConexao = {
            isConectou: false,
            erro: {
                descricao: ''
            }
        }

        let resolvePromise = undefined;

        // Se já estiver tentando conectar
        if (this.#estado.conexao.isConectando) {
            retornoConexao.erro.descricao = 'Já existe uma tentativa de conexão pendente ativa.';

            this.log('Solicitado tentativa de iniciar conexão porém já existe uma tentativa de conexão pendente.');
            return retornoConexao;
        }

        this.log('Tentando estabelecer conexão...');

        // Atualiza os estados de conexão
        this.#estado.conexao.isConectando = true;
        this.#estado.conexao.isConectado = false;
        this.#estado.conexao.isJaTentouConectar = true;
        this.#estado.conexao.detalhesErro.descricao = '';

        const novoSocket = new Socket()
        this.#estado.socket = novoSocket;

        novoSocket.on('close', (houveErro) => {
            this.#onConexaoFechada(houveErro);
            resolvePromise()
        })

        novoSocket.on('data', (dados) => {
            this.#onConexaoDadosRecebidos(dados);
        })

        novoSocket.on('error', (erro) => {
            this.#onConexaoErro(erro);
        })

        novoSocket.on('ready', () => {
            this.#onConexaoEstabelecida();
            resolvePromise()
        })

        novoSocket.connect({ host: this.#configuracao.ip, port: this.#configuracao.porta });

        return new Promise((resolve) => {

            resolvePromise = resolve;
        })
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
                descricao: ''
            }
        }

        // Se já tiver uma solicitação de autenticação pendente
        if (this.#estado.ethernetIP.autenticacao.isAutenticando) {
            detalhesAutentica.erro.descricao = 'Já existe uma solicitação de autenticação pendente.';

            this.log('Solicitado autenticação porém já existe uma solicitação de autenticação pendente.');
            return detalhesAutentica;
        }

        this.#estado.ethernetIP.autenticacao.isAutenticando = true;
        this.#estado.ethernetIP.autenticacao.isAutenticado = false;
        this.#estado.ethernetIP.autenticacao.isJaTentouAutenticar = true;
        this.#estado.ethernetIP.autenticacao.detalhesErro.descricao = '';

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

        const sessionHandlerID = ENIPResposta.getSessionHandlerID();
        this.#estado.ethernetIP.autenticacao.sessionHandlerID = sessionHandlerID;
        this.#estado.ethernetIP.autenticacao.isAutenticando = false;
        this.#estado.ethernetIP.autenticacao.isAutenticado = true;
        this.#estado.ethernetIP.autenticacao.detalhesErro.descricao = '';

        detalhesAutentica.autenticado.sessionHandlerID = sessionHandlerID;
        detalhesAutentica.isAutenticou = true;

        this.log(`Autenticado com sucesso com o dispositivo EtherNet/IP. Session Handle ID: ${sessionHandlerID}`);

        return detalhesAutentica;
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
        if (!etherNetIPParser.isValido().isValido) {
            this.log(`Recebido um pacote EtherNet/IP inválido: ${etherNetIPParser.isValido().erro.descricao}. Stack de erro: ${etherNetIPParser.isValido().tracer.getHistoricoOrdenado().join(' -> ')}`);
            return;
        }


        // Extrair o Sender Context do pacote recebido
        const senderContextBuffer = etherNetIPParser.getSenderContext();
        console.log(senderContextBuffer);

        // Ler os 5 bytes que contém o ID unico da requisição original
        let enipIDUnico = senderContextBuffer.readUIntLE(0, 5);

        // O ID do ENIP é composto por 8 digitos do timestamp + 4 digitos aleatório
        const enipIDUnicoStr = enipIDUnico.toString().padStart(12, '0');
        const enipTimeStampOriginal = enipIDUnicoStr.substring(0, 8);
        const enipDigitoAleatorio = enipIDUnicoStr.substring(8);

        this.log(`Recebido um pacote EtherNet/IP com ENIP ID: ${enipIDUnico}`);

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

        let ctdMsg = '';
        if (typeof msg == 'object') {
            ctdMsg = JSON.stringify(msg);
        } else {
            ctdMsg = msg;
        }

        console.log(`[EtherNetIPSocket ${this.#configuracao.ip}:${this.#configuracao.porta}] ${ctdMsg}`);
    }
}

/**
 * Comunicação com o controlador CompactLogix da Rockwell
 */
export class CompactLogixRockwell {

    /**
     * @type {EtherNetIPSocket} - Socket de comunicação com o dispositivo remoto no protocolo EtherNet/IP
     */
    #ENIPSocket;

    #configuracao = {
        ip: '',
        porta: 0
    }

    /**
     * @typedef DataTypeTagAtomico
     * @property {Number} codigo - Codigo do DataType no controlador
     * @property {String} descricao - Descrição do DataType
     * @property {Number} tamanho - Tamanho do tipo do DataType em bytes 
     * @property {Boolean} isSigned - Se o DataType é um número com sinal
     */

    /**
     * @typedef DataTypeTagStruct
     * @property {Number} codigoTipoStruct - O código de identificação desse tipo de Struct. Todas as tags Struct possuem o Data Type Code 672, o codigoStruct é um identificador único para cada tipo de Struct
     * @property {String} descricao - Descrição do DataType
     */

    /**
     * @typedef DataTypeTagStructASCIIString82
     * @property {String} stringConteudo - Conteudo da string
     * @property {Number} tamanho - Tamanho total da string em bytes
     */


    #dataTypes = {
        /**
         * Tipos de DataTypes atomicos(numeros) suportados
         * Contém o código do tipo de dado, a descrição e o tamanho em bytes
         */
        atomicos: {
            /**
             * Boolean, tamanho 1, unsigned 
             */
            BOOL: {
                codigo: 193,
                descricao: 'Boolean',
                tamanho: 1,
                isSigned: false
            },
            /**
             * Small Int, tamanho 1, signed
             */
            SINT: {
                codigo: 194,
                descricao: 'Small Int',
                tamanho: 1,
                isSigned: true
            },
            /**
             * Int, tamanho 2, signed
             */
            INT: {
                codigo: 195,
                descricao: 'Int',
                tamanho: 2,
                isSigned: true
            },
            /**
             * Double Int, tamanho 4, signed
             */
            DINT: {
                codigo: 196,
                descricao: 'Double Int',
                tamanho: 4,
                isSigned: true
            },
            /**
             * Long Int, tamanho 8, signed
             */
            LINT: {
                codigo: 197,
                descricao: 'Long Int',
                tamanho: 8,
                isSigned: true
            },
            /**
             * Unsigned Small Int, tamanho 1, unsigned
             */
            USINT: {
                codigo: 198,
                descricao: 'Unsigned Small Int',
                tamanho: 1,
                isSigned: false
            },
            /**
             * Unsigned Int, tamanho 2, unsigned
             */
            UINT: {
                codigo: 199,
                descricao: 'Unsigned Int',
                tamanho: 2,
                isSigned: false
            },
            /**
             * Unsigned Double Int, tamanho 4, unsigned
             */
            UDINT: {
                codigo: 200,
                descricao: 'Unsigned Double Int',
                tamanho: 4,
                isSigned: false
            },
            /**
             * Unsigned Long Int, tamanho 8, unsigned
             */
            REAL: {
                codigo: 202,
                descricao: 'Real',
                tamanho: 4,
                isSigned: true
            }
        },
        /**
         * Structs são tipos "objetos", que contém apenas mais que um simples numero
         */
        structs: {
            ASCIISTRING82: {
                descricao: 'String ASCII de 82 bytes',
                codigoTipoStruct: 4046
            }
        }
    }

    #estado = {
        /**
         * Emissor de eventos do CompactLogix
         */
        emissorEvento: new EmissorEvento(),
    }

    /**
     * Parametros de conexão com o controlador CompactLogix
     * @param {Object} parametros
     * @param {String} parametros.ip - Endereço IP do controlador CompactLogix
     * @param {Number} parametros.porta - Porta de comunicação com o controlador CompactLogix
     */
    constructor(parametros) {
        if (parametros == undefined || typeof parametros != 'object') throw new Error('Parâmetros de conexão não informados');
        if (parametros.ip == undefined) throw new Error('Endereço IP não informado');
        if (parametros.porta == undefined) throw new Error('Porta de comunicação não informada');

        this.#configuracao.ip = parametros.ip;
        this.#configuracao.porta = parametros.porta;

        this.#ENIPSocket = new EtherNetIPSocket({
            isHabilitaLogs: true,
            conexao: {
                ip: this.#configuracao.ip,
                porta: this.#configuracao.porta
            }
        });
    }

    /**
     * @callback CallbackLog
     * @param {String} mensagem - Mensagem disparada no log
     */

    /**
     * Adicionar um callback para quando um log for disparado
     * @param {CallbackLog} cb 
     */
    onLog(cb) {
        this.#estado.emissorEvento.addEvento('log', cb);
    }

    /**
     * Retornar o Socket de comunicação com o dispositivo EtherNet/IP
     */
    getENIPSocket() {
        return this.#ENIPSocket;
    }

    /**
     * Realizar a leitura de uma unica tag do CompactLogix
     * @param {String} tag - Tag a ser lida
     */
    async lerTag(tag) {
        if (tag == undefined) throw new Error('Tag a ser lida não informada');
        if (typeof tag != 'string') throw new Error('Tag a ser lida deve ser uma string');
        if (tag == '') throw new Error('Tag a ser lida não pode ser vazia');

        const retornoTag = {
            /**
             * Se deu sucesso em realizar a leitura da tag 
             */
            isSucesso: false,
            tagSolicitada: tag,
            /**
             * Detalhes dos tempos de leitura da tag
             */
            msDetalhes: {
                /**
                 * Data atual em millisegundos de quando a leitura foi iniciada e o pacote ENIP foi enviada
                 * @type {Number}
                 */
                dateTimeInicio: new Date().getTime(),
                /**
                 * Data atual em millisegundos de quando o pacote ENIP foi recebido e parseado
                 * @type {Number}
                 */
                dateTimeFim: undefined,
                /**
                 * Tempo em ms total de leitura da tag
                 */
                totalMsLeitura: undefined
            },
            /**
             * Se sucesso, contém os dados da tag lida
             */
            sucesso: {
                tag: {
                    /**
                     * Se o valor lido é atomico(numeros DataType de 193 a 202)
                     */
                    isAtomico: false,
                    /**
                     * Se isAtomico, contém os detalhes do valor lido
                     */
                    atomico: {
                        /**
                         * O valor númerico
                         */
                        valor: undefined,
                        /**
                         * O DataType do valor lido
                         */
                        dataType: undefined
                    },
                    /**
                     * Se o valor lido é do tipo de uma Struct
                     */
                    isStruct: false,
                    /**
                     * Se Struct, contém os detalhes da Struct
                     */
                    struct: {
                        /**
                         * O Data Type da Struct lido
                         * @type {DataTypeTagStruct}
                         */
                        dataTypeStruct: undefined,
                        /**
                         * O valor da Struct lido. Esse campo é dinamico depenendo do tipo da Struct
                         * @type {DataTypeTagStructASCIIString82}
                         */
                        valor: undefined
                    }
                }
            },
            /**
             * Detalhes especificos do tipo do erro que foi ocorrido se isSucesso não for true
             */
            erro: {
                descricao: '',
                /**
                 * Se foi erro ao enviar o pacote ENIP
                 */
                isEnviarENIP: false,
                /**
                 * Se o erro foi causado devido a falha ao enviar o pacote ENIP, contém os detalhes extras desse erro
                */
                enviarENIP: {
                    /**
                     * Se foi erro ao escrever o pacote ENIP no socket
                     */
                    isWriteSocket: false,
                    /**
                     * Se foi erro ao gerar o buffer do pacote ENIP
                     */
                    isGerarBuffer: false,
                    /**
                     * Detalhes do erro ao gerar o Buffer do pacote ENIP se isGerarBuffer for true
                     */
                    gerarBuffer: {
                        /**
                         * Histórico de logs do erro ao gerar o Buffer do pacote ENIP
                         */
                        traceLog: []
                    }
                },
                /**
                 * Se foi erro ao receber o pacote ENIP
                 */
                isReceberENIP: false,
                /**
                 * Se o erro foi causado devido a falha ao receber o pacote ENIP, contém os detalhes extras desse erro. Esse erro só verifica pelo campo principal ENIP, os layers encapsulados posteriormente podem ter erros próprios,
                 * porém a garantia aqui é que o pacote ENIP foi recebido com sucesso
                */
                receberENIP: {
                    /**
                     * Se foi erro ao receber o pacote ENIP
                     */
                    isDemorouResposta: false
                },
                /**
                 * Se o erro ocorrido foi devido a algum dos layers do pacote ENIP recebido estarem incorretos. É somente para erros de parse dos Buffers recebidos e suas camadas e garantir que os bytes recebidos estão em conformidade. Por exemplo
                 * se foi requisitado ler uma tag que não existe, o controlador vai responder com um status de invalido no SingleServicePacket, então não caira em tratativas dos erros, e sim de status.
                 */
                isErroLayers: false,
                /**
                 * Se isErroLayers, contém qual layer ocorreu o erro
                 */
                erroLayers: {
                    /**
                     * Se o layer do SendRRData é valido
                     */
                    isSendRRDataInvalido: false,
                    /**
                     * Se o erro foi causado por falha ao processar o Buffer SendRRData
                     */
                    sendRRDataInvalido: {
                        /**
                         * Array de mensagens com o historico de cada etapa do processamento do Buffer, conterá onde ocorreu o erro no Buffer
                         */
                        trace: []
                    },
                    /**
                     * Se o layer do CIP é valido
                     */
                    isCIPInvalido: false,
                    /**
                     * Se o erro foi causado por falha ao processar o Buffer CIP
                     */
                    CIPInvalido: {
                        /**
                         * Array de mensagens com o historico de cada etapa do processamento do Buffer, conterá onde ocorreu o erro no Buffer
                         */
                        trace: []
                    },
                    /**
                     * Se o layer Single Service Packet é valido
                     */
                    isSingleServicePacket: false,
                    /**
                     * Se o erro foi causado por falha ao processar o Buffer Single Service Packet
                     */
                    singleServicePacket: {
                        /**
                         * Array de mensagens com o historico de cada etapa do processamento do Buffer, conterá onde ocorreu o erro no Buffer
                         */
                        trace: []
                    }
                },
                /**
                 * Se o erro foi causado devido a um erro de status, ou seja os layers estão todos em conformidade, porém o dispositivo retornou um status diferente de sucesso para a operação de leitura da tag
                 */
                isStatusInvalido: false,
                /**
                 * Se isStatusInvalido, contém os detalhes do status invalido
                 */
                statusInvalido: {
                    /**
                     * A descrição basica do erro original ocorrido
                     */
                    descricaoStatus: '',
                    /**
                     * Código do erro recebido conforme CIP Response Codes
                     */
                    codigoDeErro: undefined
                },
                /**
                 * Se o erro foi causado devido a um erro de conversão do Buffer recebido no ENIP para o valor real(numero, string, array, etc..)
                 */
                isConverterValor: false
            }
        }

        const layerENIP = this.getENIPSocket().getNovoLayerBuilder();
        const layerConnectionManager = layerENIP.buildSendRRData().criarServicoCIP().buildCIPConnectionManager();

        // O Single Service Packet eu configuro qual vai ser a tag solicitada
        const layerServicePacket = layerConnectionManager.getCIPMessage().buildSingleServicePacket();

        // Pra ler uma tag pelo menos no CompactLogix, o CIP Generic data deve ser só o Request Path pra string da tag, e o CIP Class Generic é só um array vazio já que não precisa enviar informações
        layerServicePacket.setAsGetAttribute({
            nome: `${tag}`,
            CIPGenericBuffer: Buffer.from([0x01, 0x00])
        })

        this.log(`Lendo tag ${tag}...`);

        // Enviar o pacote ENIP
        let statusEnviaENIP = await this.getENIPSocket().enviarENIP(layerENIP);

        retornoTag.msDetalhes.dateTimeFim = new Date().getTime();

        retornoTag.msDetalhes.totalMsLeitura = retornoTag.msDetalhes.dateTimeFim - retornoTag.msDetalhes.dateTimeInicio;

        // Analisar se o envio e o recebimento dos pacotes ENIPs obtiveram sucesso
        if (!statusEnviaENIP.isSucesso) {
            // Se deu erro ao processar o ENIP, verificar.

            // Se deu erro ao processar o ENIP, verificar.
            if (!statusEnviaENIP.enipEnviar.isEnviou) {

                if (statusEnviaENIP.enipEnviar.erro.isWriteSocket) {
                    // O erro foi causado na hora de usar o Write pra escrever no Socket
                    retornoTag.erro.enviarENIP.isWriteSocket = true;
                } else if (statusEnviaENIP.enipEnviar.erro.isGerarBuffer) {
                    // O erro foi causado na geração do Buffer do Builder do ENIP. Algum campo invalido provavelmente
                    retornoTag.erro.enviarENIP.isGerarBuffer = true;
                    retornoTag.erro.enviarENIP.gerarBuffer.traceLog = statusEnviaENIP.enipEnviar.erro.erroGerarBuffer.traceLog;
                }

                retornoTag.erro.descricao = `O envio do ENIP retornou: ${statusEnviaENIP.enipEnviar.erro.descricao}`;
                retornoTag.erro.isEnviarENIP = true;

                this.log(`Ocorreu um erro ao ler a tag ${tag}: ${retornoTag.erro.descricao}`);
                return retornoTag;
            }

            // Se deu erro ao receber o ENIP, verificar.
            if (!statusEnviaENIP.enipReceber.isRecebeu) {
                if (statusEnviaENIP.enipReceber.erro.isDemorouResposta) {
                    // O erro foi causado por demorar a resposta do pacote ENIP
                    retornoTag.erro.receberENIP.isDemorouResposta = true;
                }

                retornoTag.erro.descricao = `O recebimento do ENIP retornou: ${statusEnviaENIP.enipReceber.erro.descricao}`;
                retornoTag.erro.isReceberENIP = true;

                this.log(`Ocorreu um erro ao ler a tag ${tag}: ${retornoTag.erro.descricao}`);
                return retornoTag;
            }
        }

        // Se chegou aqui, eu tenho o pacote ENIP de resposta do controlador. Agora preciso verificar se ele retornou sucesso ou não na operação de leitura
        const ENIPResposta = statusEnviaENIP.enipReceber.enipParser;

        // O comando que deve ser retornado é um SendRRData. Na teoria isso nunca deveria cair aqui pq a resposta do ENIP sempre deve corresponder a solicitação original, se enviou um SendRRData, deve receber um SendRRData
        if (!ENIPResposta.isSendRRData()) {
            retornoTag.erro.descricao = 'O pacote de resposta não é um SendRRData.';
            retornoTag.erro.isErroLayers = true;
            retornoTag.erro.erroLayers.isSendRRDataInvalido = true;

            this.log(`Ocorreu um erro ao ler a tag ${tag}: ${retornoTag.erro.descricao}`);
            return retornoTag;
        }

        // Obter as informações do SendRRData
        const ENIPSendRRData = ENIPResposta.getAsSendRRData();

        // Se retornou um SendRRData, validar se o parser conseguiu extrair as informações corretamente
        if (!ENIPSendRRData.isValido().isValido) {
            // Se não for valido, isso significa que deu algum erro em dar parse no Buffer recebido pro SendRRData

            retornoTag.erro.descricao = `O pacote SendRRData não é valido, alguma informação no Buffer está incorreta: ${ENIPSendRRData.isValido().erro.descricao}`;
            retornoTag.erro.isErroLayers = true;
            retornoTag.erro.erroLayers.isSendRRDataInvalido = true;
            retornoTag.erro.erroLayers.sendRRDataInvalido.trace = ENIPSendRRData.isValido().tracer.getHistoricoOrdenado();

            this.log(`Ocorreu um erro ao ler a tag ${tag}: ${retornoTag.erro.descricao}`);
            return retornoTag;
        }

        // Obrigatoriamente deve ser um serviço CIP que contém os dados encapsulados da informação de leitura da tag(já que a comunicação no momento com o Compact tá sendo via CIP)
        if (!ENIPSendRRData.isServicoCIP()) {
            retornoTag.erro.descricao = 'O pacote de resposta não contém um serviço CIP';

            retornoTag.erro.isErroLayers = true;
            retornoTag.erro.erroLayers.isCIPInvalido = true;

            this.log(`Ocorreu um erro ao ler a tag ${tag}: ${retornoTag.erro.descricao}`);
            return retornoTag;
        }

        // Obter as informações do Serviço CIP que contém nessa altura do jogo, o CIP Connection Manager com as informações solicitadas
        const ENIPCIP = ENIPSendRRData.getAsServicoCIP();
        if (!ENIPCIP.isValido().isValido) {

            retornoTag.erro.descricao = `O pacote CIP não é valido, alguma informação no Buffer está incorreta: ${ENIPCIP.isValido().erro.descricao}`;
            retornoTag.erro.isErroLayers = true;
            retornoTag.erro.erroLayers.isCIPInvalido = true;
            retornoTag.erro.erroLayers.CIPInvalido.trace = ENIPCIP.isValido().tracer.getHistoricoOrdenado();

            this.log(`Ocorreu um erro ao ler a tag ${tag}: ${retornoTag.erro.descricao}`);
            return retornoTag;
        }

        // Validar o código de status do CIP, pois tem alguns status que são erros fatais e não tem como prosseguir
        if (ENIPCIP.getStatusCIP().codigo != CIPGeneralStatusCodes.Success.hex) {

            // O erro grave deve ser marcado como true se foi retornado um código de status que invalidou toda a operação e impede de prosseguir com a leitura da tag
            let isErroGrave = false;

            switch (ENIPCIP.getStatusCIP().codigo) {

                // O Connection Failure é um erro fatal que não tem como prosseguir
                case CIPGeneralStatusCodes.ConnectionFailure.hex: {
                    isErroGrave = true;
                    retornoTag.erro.descricao = `O pacote CIP retornou Connection Failure -- ${ENIPCIP.getStatusCIP().codigo}: ${ENIPCIP.getStatusCIP().descricao}`;
                    break;
                }
                // O dispositivo não conseguiu processar a solicitação por falta de recursos
                case CIPGeneralStatusCodes.ResourceUnavailable.hex: {
                    isErroGrave = true;
                    retornoTag.erro.descricao = `O pacote CIP retornou Resource Unavailable -- ${ENIPCIP.getStatusCIP().codigo}: ${ENIPCIP.getStatusCIP().descricao}`;
                    break;
                }
                // O Path Segment error não é fatal, o caminho pro Request Path é invalido, então a informação pode ser prosseguida pelo SingleServicePacket adiante
                case CIPGeneralStatusCodes.PathSegmentError.hex: {
                    retornoTag.erro.descricao = `O pacote CIP retornou Path Segment Error -- ${ENIPCIP.getStatusCIP().codigo}: ${ENIPCIP.getStatusCIP().descricao}`;
                    break;
                }
                // O Partial Transfer não entendi ainda em que situações ocorre, por isso evito de prosseguir
                case CIPGeneralStatusCodes.PartialTransfer.hex: {
                    isErroGrave = true;
                    retornoTag.erro.descricao = `O pacote CIP retornou Partial Transfer(Ainda não é suportado) -- ${ENIPCIP.getStatusCIP().codigo}: ${ENIPCIP.getStatusCIP().descricao}`;
                    break;
                }
                // O Connection Lost é um erro fatal que não tem como prosseguir
                case CIPGeneralStatusCodes.ConnectionLost.hex: {
                    isErroGrave = true;
                    retornoTag.erro.descricao = `O pacote CIP retornou Connection Lost -- ${ENIPCIP.getStatusCIP().codigo}: ${ENIPCIP.getStatusCIP().descricao}`;
                    break;
                }
                // Reply Data Too Large é um erro fatal também pq não terei os dados pra prosseguir com o processamento
                case CIPGeneralStatusCodes.ReplyDataTooLarge.hex: {
                    isErroGrave = true;
                    retornoTag.erro.descricao = `O pacote CIP retornou Reply Data Too Large -- ${ENIPCIP.getStatusCIP().codigo}: ${ENIPCIP.getStatusCIP().descricao}`;
                    break;
                }
                // Como o valor vai ta quebrado pela metade, não aceito a resposta e marco como erro grave
                case CIPGeneralStatusCodes.FragmentationOfAPrimitiveValue.hex: {
                    isErroGrave = true;
                    retornoTag.erro.descricao = `O pacote CIP retornou Fragmentation Of A Primitive Value -- ${ENIPCIP.getStatusCIP().codigo}: ${ENIPCIP.getStatusCIP().descricao}`;
                    break;
                }
                // Qualquer outro erro diferentão estranho que eu não conheço, marcar como erro grave
                default: {
                    retornoTag.erro.descricao = `O pacote CIP retornou com o status desconhecido ${ENIPCIP.getStatusCIP().codigo}: ${ENIPCIP.getStatusCIP().descricao}`;
                    isErroGrave = true;
                    break;
                }
            }

            // Se erro grave tiver setado, retornar como erro de status invalido
            if (isErroGrave) {

                retornoTag.erro.isStatusInvalido = true;
                retornoTag.erro.statusInvalido.codigoDeErro = ENIPCIP.getStatusCIP().codigo;
                retornoTag.erro.statusInvalido.descricaoStatus = ENIPCIP.getStatusCIP().descricao;

                this.log(`Ocorreu um erro ao ler a tag ${tag}: ${retornoTag.erro.descricao}`);
                return retornoTag;
            }
        }

        // Por último, o pacote CIP deve encapsular o Single Service Packet que foi a informação da tag requisitada

        if (!ENIPCIP.isSingleServicePacket()) {
            retornoTag.erro.descricao = 'O pacote de resposta não contém um Single Service Packet';

            retornoTag.erro.isErroLayers = true;
            retornoTag.erro.erroLayers.isSingleServicePacket = true;

            this.log(`Ocorreu um erro ao ler a tag ${tag}: ${retornoTag.erro.descricao}`);
            return retornoTag;
        }
        const ENIPSingleService = ENIPCIP.getAsSingleServicePacket();

        // Validar se é deu pra dar parse no Buffer sem erros.
        if (!ENIPSingleService.isValido().isValido) {

            retornoTag.erro.descricao = `O pacote Single Service Packet não é valido, alguma informação no Buffer está incorreta: ${ENIPSingleService.isValido().erro.descricao}`;
            retornoTag.erro.isErroLayers = true;
            retornoTag.erro.erroLayers.isSingleServicePacket = true;
            retornoTag.erro.erroLayers.singleServicePacket.trace = ENIPSingleService.isValido().tracer.getHistoricoOrdenado();

            this.log(`Ocorreu um erro ao ler a tag ${tag}: ${retornoTag.erro.descricao}`);
            return retornoTag;
        }

        let detalhesStatus = ENIPSingleService.isStatusSucesso();
        // Ok pronto! Se chegou aqui, todas as camadas do pacote ENIP foram processadas com sucesso. Analisar se a ação de leitura foi bem sucedida ou não
        if (!detalhesStatus.isSucesso) {

            retornoTag.erro.isStatusInvalido = true;
            retornoTag.erro.statusInvalido.codigoDeErro = detalhesStatus.erro.codigoStatus
            retornoTag.erro.statusInvalido.descricaoStatus = `${detalhesStatus.erro.descricaoStatus} - ${detalhesStatus.erro.descricao}`;

            retornoTag.erro.descricao = `O pacote Single Service Packet retornou um status de erro: ${detalhesStatus.erro.descricao}`;
            this.log(`Ocorreu um erro ao ler a tag ${tag}: ${detalhesStatus.erro.descricao}`);
            return retornoTag;
        }

        // Converter o Buffer que contém as informações da tag lida
        let converteBufferPraValor = this.#converteDataTypeToValor(ENIPSingleService.getAsCIPClassCommandSpecificData());

        // Se não foi possível converter o valor
        if (!converteBufferPraValor.isConvertido) {

            retornoTag.erro.isConverterValor = true;
            retornoTag.erro.descricao = `Não foi possível converter o valor do Buffer: ${converteBufferPraValor.erro.descricao}`;

            this.log(`Ocorreu um erro ao ler a tag ${tag}: ${retornoTag.erro.descricao}`);
            return retornoTag;
        }

        // Finalmente, se tudo deu certo, estou com o valor em mãos
        if (converteBufferPraValor.conversao.isAtomico) {
            retornoTag.sucesso.tag.isAtomico = true;

            retornoTag.sucesso.tag.atomico.valor = converteBufferPraValor.conversao.atomico.valor;
            retornoTag.sucesso.tag.atomico.dataType = converteBufferPraValor.conversao.atomico.dataType;

            this.log(`Tag ${tag} (Tipo Atomico ${converteBufferPraValor.conversao.atomico.dataType.codigo} - ${converteBufferPraValor.conversao.atomico.dataType.descricao}) lida com sucesso com o número ${converteBufferPraValor.conversao.atomico.valor} em ${retornoTag.msDetalhes.totalMsLeitura}ms`);
        } else if (converteBufferPraValor.conversao.isStruct) {

            retornoTag.sucesso.tag.isStruct = true;

            retornoTag.sucesso.tag.struct.dataTypeStruct = converteBufferPraValor.conversao.struct.dataType;

            // Analisar o tipo da Struct e devolver corretamente no retorno
            if (converteBufferPraValor.conversao.struct.structData.codigoTipoStruct == this.#dataTypes.structs.ASCIISTRING82.codigoTipoStruct) {

                /**
                 * @type {DataTypeTagStructASCIIString82}
                 */
                let structTipoString = {
                    stringConteudo: converteBufferPraValor.conversao.struct.structData.stringConteudo,
                    tamanho: converteBufferPraValor.conversao.struct.structData.tamanho
                }
                retornoTag.sucesso.tag.struct.valor = structTipoString

                this.log(`Tag ${tag} (Tipo Struct ${converteBufferPraValor.conversao.struct.dataType.codigoTipoStruct} - ${converteBufferPraValor.conversao.struct.dataType.descricao}) lida com sucesso com a string ${structTipoString.stringConteudo} em ${retornoTag.msDetalhes.totalMsLeitura}ms`);
            }
        } else {
            retornoTag.erro.descricao = 'O valor lido não é nem atomico nem uma struct';
            retornoTag.erro.isConverterValor = true;

            this.log(`Ocorreu um erro ao ler a tag ${tag}: ${retornoTag.erro.descricao}`);
            return retornoTag;
        }

        retornoTag.isSucesso = true;
        return retornoTag;
    }

    /**
     * Solicita multiplas tags para serem lidas
     * @param {Array<String>} tags - Array de tags a serem lidas
     */
    async lerMultiplasTags(tags) {
        if (tags == undefined) throw new Error('Tags a serem lidas não informadas');
        if (!Array.isArray(tags)) throw new Error('Tags a serem lidas devem ser um array');
        if (tags.length == 0) throw new Error('Array de tags a serem lidas não pode ser vazio');

        // Verificar se alguma tag do Array não é uma string
        if (tags.some(tag => typeof tag != 'string')) throw new Error('Todas as tags a serem lidas devem ser strings');

        const retornoLeituraMultipla = {
            /**
             * Se pelo menos a requisição de leitura chegou ao dispositivo remoto e retornou uma resposta(mesmo que seja uma resposta de erro)
             */
            isSucesso: false,
            /**
             * Se ocorreu algum erro durante a requisição
             */
            erro: {
                descricao: ''
            }
        }

        const layerENIP = this.getENIPSocket().getNovoLayerBuilder();

        // O Connection Manager é o primeiro layer que deve ser enviado
        const layerConnectionManager = layerENIP.buildSendRRData().criarServicoCIP().buildCIPConnectionManager();

        // Adicionar o Multiple Service Packet que é o pacote que contém as informações de leitura de multiplas tags
        const layerMultipleService = layerConnectionManager.getCIPMessage().buildMultipleServicePacket();
        layerMultipleService.setAsMessageRouter();

        // Um for em cada tag solicitada para adicionar ao Multiple Service
        for (const tag of tags) {

            // Adiciona um Single Service ao Multiple Service
            let layerSingleService = layerMultipleService.addSingleServicePacket();

            // Configurar para retornar as informações da tag desejada
            layerSingleService.servico.setAsGetAttribute({
                nome: tag,
                CIPGenericBuffer: Buffer.from([0x01, 0x00])
            })
        }

        // Ok, adicionar os layers, tentar enviar o ENIP

        const statusEnviaENIP = await this.getENIPSocket().enviarENIP(layerENIP);

        // Se ocorreu algum tipo de erro durante o envio ou rcebimento do ENIP
        if (!statusEnviaENIP.isSucesso) {

            // Se o erro foi devido ao envio do ENIP
            if (!statusEnviaENIP.enipEnviar.isEnviou) {

                retornoLeituraMultipla.erro.descricao = `Erro ao enviar o pacote ENIP: ${statusEnviaENIP.enipEnviar.erro.descricao}`;
                return retornoLeituraMultipla;
            }

            // Se o erro foi devido ao não recebimento da resposta da solicitação ENIP
            if (statusEnviaENIP.enipReceber.isRecebeu) {

                retornoLeituraMultipla.erro.descricao = `Erro ao receber o pacote ENIP: ${statusEnviaENIP.enipReceber.erro.descricao}`;
                return retornoLeituraMultipla;
            }
        }

        // Se chegou aqui, o pacote ENIP foi enviado e recebido com sucesso. Agora é analisar o conteúdo da resposta nos próximos layers
        const ENIPResposta = statusEnviaENIP.enipReceber.enipParser;

        // O comando da resposta deve ser um SendRRData
        if (!ENIPResposta.isSendRRData()) {
            retornoLeituraMultipla.erro.descricao = 'O pacote de resposta não é um SendRRData';

            return retornoLeituraMultipla;
        }

        // Obter as informações do SendRRData
        const ENIPSendRRData = ENIPResposta.getAsSendRRData();

        // Validar se o parser conseguiu extrair as informações corretamente
        if (!ENIPSendRRData.isValido().isValido) {
            retornoLeituraMultipla.erro.descricao = `O pacote SendRRData não é valido, alguma informação no Buffer está incorreta: ${ENIPSendRRData.isValido().erro.descricao}`;

            return retornoLeituraMultipla;
        }

        // Obrigatoriamente deve ser um serviço CIP que contém os dados encapsulados da informação de leitura da tag(já que a comunicação no momento com o Compact tá sendo via CIP)
        if (!ENIPSendRRData.isServicoCIP()) {
            retornoLeituraMultipla.erro.descricao = 'O pacote de resposta não contém um serviço CIP';

            return retornoLeituraMultipla;
        }

        // Obter as informações do Serviço CIP que contém nessa altura do jogo, o CIP Connection Manager com as informações solicitadas
        const ENIPCIP = ENIPSendRRData.getAsServicoCIP();

        if (!ENIPCIP.isValido().isValido) {
            retornoLeituraMultipla.erro.descricao = `O pacote CIP não é valido, alguma informação no Buffer está incorreta: ${ENIPCIP.isValido().erro.descricao}`;

            return retornoLeituraMultipla;
        }

        // Validar o código de status do CIP, pois tem alguns status que são erros fatais e não tem como prosseguir
        if (ENIPCIP.getStatusCIP().codigo != CIPGeneralStatusCodes.Success.hex) {

            /**
             * Se o erro retornado é fatal e não da pra continuar a função de leitura das tags
             */
            let isErroFatal = false;

            switch (ENIPCIP.getStatusCIP().codigo) {
                // O unico erro que permite continuar a leitura das tags é o Path Segment Error, que é um erro de caminho da tag, e como nesse caso são Multiple Service, uma pode ter dado erro porém outras não
                case CIPGeneralStatusCodes.PathSegmentError.hex: {
                    break
                }
                // Pra qualquer outro tipo de erro, eu não permito continuar
                default: {

                    retornoLeituraMultipla.erro.descricao = `O pacote CIP retornou um status de erro: ${ENIPCIP.getStatusCIP().codigo} - ${ENIPCIP.getStatusCIP().descricao}`;
                    isErroFatal = true;
                    break;
                }
            }

            if (isErroFatal) {
                return retornoLeituraMultipla;
            }
        }

        // Ok, validado o código de status do CIP, agora devo ter um Multiple Service Packet encapsulado com os dados de cada Single Service

        if (!ENIPCIP.isMultipleServicePacket()) {
            retornoLeituraMultipla.erro.descricao = 'O pacote de resposta não contém um Multiple Service Packet';

            return retornoLeituraMultipla;
        }

        // Obter o Multiple Service Packet com as informações dos serviços solicitados
        const ENIPMultipleService = ENIPCIP.getAsMultipleServicePacket();
        if (!ENIPMultipleService.isValido().isValido) {
            retornoLeituraMultipla.erro.descricao = `O pacote Multiple Service Packet não é valido, alguma informação no Buffer está incorreta: ${ENIPMultipleService.isValido().erro.descricao}`;

            return retornoLeituraMultipla;
        }

        /**
         * @typedef TagLidaMultipla
         * @property {String} tag - Tag lida
         * @property {Boolean} isSucesso - Se a leitura da tag foi bem sucedida
         * @property {Object} sucesso - Se isSucesso for true, contém os detalhes da tag lida
         * @property {Boolean} sucesso.isAtomico - Se o valor lido é atomico(numeros DataType de 193 a 202)
         * @property {Object} sucesso.atomico - Se isAtomico for true, contém os detalhes do valor lido
         * @property {Number} sucesso.atomico.valor - O valor númerico
         * @property {DataTypeTagAtomico} sucesso.atomico.dataType - O DataType do valor lido
         * @property {Boolean} sucesso.isStruct - Se o valor lido é do tipo de uma Struct
         * @property {Object} sucesso.struct - Se isStruct for true, contém os detalhes da Struct
         * @property {DataTypeTagStruct} sucesso.struct.dataTypeStruct - O Data Type da Struct lido
         * @property {DataTypeTagStructASCIIString82} sucesso.struct.valor - O valor da Struct lido. Esse campo é dinamico depenendo do tipo da Struct
         * @property {Object} erro - Se isSucesso for false, contém os detalhes do erro ocorrido
         * @property {String} erro.descricao - Descrição do erro ocorrido
         * @property {Boolean} erro.isCIPNaoRetornado - A resposta ENIP recebida não continha um CIP com os dados dessa tag solicitada
         * @property {Boolean} erro.isCIPInvalido - O CIP Packet retornado não é valido
         * @property {Object} erro.CIPInvalido - Se isCIPInvalido, contém o motivo de ser invalido
         * @property {Array<String>} erro.CIPInvalido.trace - Trace de cada etapa do processamento do Buffer do CIP, deve ter onde ocorreu o erro de CIP invalido
         * @property {Boolean} erro.isSingleServicePacketNaoRetornado - A resposta ENIP recebida não continha um Single Service Packet com os dados dessa tag solicitada
         * @property {Boolean} erro.isSingleServicePacketInvalido - O Single Service Packet retornado tem algo erro no Buffer e não é valido
         * @property {Object} erro.singleServicePacketInvalido - Se isSingleServicePacketInvalido, contém o motivo de ser invalido
         * @property {Array<String>} erro.singleServicePacketInvalido.trace - Trace de cada etapa do processamento do Buffer do Single Service Packet, deve ter onde ocorreu o erro de Single Service Packet invalido
         */

        /**
         * @type {TagLidaMultipla[]}
         */
        const tagsLidas = [];

        for (const tag of tags) {
            tagsLidas.push({
                tag: tag,
                isSucesso: false,
                sucesso: {
                    isAtomico: false,
                    atomico: {
                        dataType: undefined,
                        valor: undefined
                    },
                    isStruct: false,
                    struct: {
                        dataTypeStruct: undefined,
                        valor: undefined
                    }
                },
                erro: {
                    descricao: 'Não foi retornado informações dessa tag na resposta ENIP.',
                    isCIPNaoRetornado: true,
                    isCIPInvalido: false,
                    CIPInvalido: {
                        trace: []
                    },
                    isSingleServicePacketNaoRetornado: false,
                    isSingleServicePacketInvalido: false,
                    singleServicePacketInvalido: {
                        trace: []
                    }
                }
            })
        }

        // Se chegou aqui, o Multiple Service Packet foi processado com sucesso. Agora devo iterar sobre os CIPs packets retornados para obter os valores de cada tag solicitada
        // Um detalhe é que, a resposta de solicitação não retorna o nome da tag solicitada, apenas o seu buffer com tipo do dado e valor, então preciso iterar em ordem que foi buildado no ENIP, que é só o for of nas tags solicitadas
        for (let indexServiceCIP = 0; indexServiceCIP < ENIPMultipleService.getServicesPackets().length; indexServiceCIP++) {

            const CIPPacket = ENIPMultipleService.getServicesPackets()[indexServiceCIP];
            const possivelTagSolicitada = tagsLidas[indexServiceCIP];

            // Na teoria não deveria estar como undefined, mas né
            if (possivelTagSolicitada == undefined) {
                continue;
            } else {
                // Se achou, reseta a mensagem de não encontrado
                possivelTagSolicitada.erro.isCIPNaoRetornado = false;
                possivelTagSolicitada.erro.descricao = ''
            }


            // Validar se o Single Service Packet é valido
            if (!CIPPacket.isValido().isValido) {
                possivelTagSolicitada.erro.descricao = `O pacote CIP não é valido, alguma informação no Buffer está incorreta: ${CIPPacket.isValido().erro.descricao}`;
                possivelTagSolicitada.erro.isCIPInvalido = true;
                possivelTagSolicitada.erro.CIPInvalido.trace = cipPacket.isValido().tracer.getHistoricoOrdenado();
                continue;
            }

            // É pra ser um Single Service Packet com os dados da tag lida
            if (!CIPPacket.isSingleServicePacket()) {

                possivelTagSolicitada.erro.descricao = 'O pacote de resposta não contém um Single Service Packet';
                possivelTagSolicitada.erro.isSingleServicePacketNaoRetornado = true;
                continue;
            }

            // Se for valido e for um Single Service Packet, analisar as informações da tag lida
            const singleServicePacket = CIPPacket.getAsSingleServicePacket();

            // Validar se o Buffer do Single Service Packet é valido
            if (!singleServicePacket.isValido().isValido) {

                possivelTagSolicitada.erro.descricao = `O pacote Single Service Packet não é valido, alguma informação no Buffer está incorreta: ${singleServicePacket.isValido().erro.descricao}`;
                possivelTagSolicitada.erro.isSingleServicePacketInvalido = true;
                possivelTagSolicitada.erro.singleServicePacketInvalido.trace = singleServicePacket.isValido().tracer.getHistoricoOrdenado();
                continue;
            }

            // Se todas as verificaçoes acima fecharem, eu vou ter a tag, o valor e o status que ocorreu
            // Pegar o Request Path que é o nome da tag 

        }
    }

    /**
     * @typedef EscreveTagStructASCIIString82
     * @property {String} string - String a ser escrita
     */

    /**
     * Realizar a escrita de uma unica tag do CompactLogix
     * @param {String} tag - Tag a ser escrita
     * @param {Object} dataType - Data Type da tag para escrever
     * @param {Boolean} dataType.isAtomico - Se o Data Type é atomico ou não
     * @param {Object} dataType.atomico - Se atomico, contém os detalhes do valor a ser escrito
     * @param {Number} dataType.atomico.codigoAtomico - Código do tipo de Data Type a ser escrito
     * @param {Number} dataType.atomico.valor - Valor a ser escrito
     * @param {Boolean} dataType.isStruct - Se o Data Type é uma Struct ou não
     * @param {Object} dataType.struct - Se for uma Struct, contém os detalhes do valor a ser escrito
     * @param {Number} dataType.struct.codigoStruct - Código do tipo de Struct a ser escrita
     * @param {EscreveTagStructASCIIString82} dataType.struct.classeStruct - Classe da Struct a ser escrita(ASCIIString82, Timer, etc..)
     */
    async escreveTag(tag, dataType) {
        /**
         * @typedef EscritaTagStructASCIIString82
         * @property {String} valor - O valor que foi gravado
         */

        if (tag == undefined) throw new Error('Tag a ser escrita não informada');
        if (typeof tag != 'string') throw new Error('Tag a ser escrita deve ser uma string');
        if (tag == '') throw new Error('Tag a ser escrita não pode ser vazia');

        if (dataType == undefined) throw new Error('Data Type da tag a ser escrita não informado');
        if (typeof dataType != 'object') throw new Error('Data Type da tag a ser escrita deve ser um objeto');

        const retornoEscrita = {
            /**
             * Se a operação de escrita foi bem sucedida.
             */
            isSucesso: false,
            msDetalhes: {
                /**
                 * Data atual em millisegundos de quando a escrita foi iniciada e o pacote ENIP foi enviada
                 * @type {Number}
                 */
                dateTimeInicio: new Date().getTime(),
                /**
                 * Data atual em millisegundos de quando o pacote ENIP foi recebido e parseado
                 * @type {Number}
                 */
                dateTimeFim: undefined,
                /**
                 * Tempo em ms total de escrita da tag
                 */
                totalMsEscrita: undefined
            },
            /**
             * Se sucesso, contém os detalhes da tag escrita
             */
            sucesso: {
                tag: {
                    /**
                     * Se o valor escrito é atomico(numeros DataType de 193 a 202)
                     */
                    isAtomico: false,
                    /**
                     * Se isAtomico, contém os detalhes do valor escrito
                     */
                    atomico: {
                        /**
                         * O valor númerico
                         */
                        valor: undefined,
                        /**
                         * O DataType do valor lido
                         * @type {DataTypeTagAtomico}
                         */
                        dataType: undefined
                    },
                    /**
                     * Se o valor escrito é do tipo de uma Struct
                     */
                    isStruct: false,
                    /**
                     * Se Struct, contém os detalhes da Struct
                     */
                    struct: {
                        /**
                         * O Data Type da Struct lido
                         * @type {DataTypeTagStruct}
                         */
                        dataTypeStruct: undefined,
                        /**
                         * O valor da Struct escrito. Esse campo é dinamico depenendo do tipo da Struct
                         * @type {EscritaTagStructASCIIString82}
                         */
                        valor: undefined
                    }
                },
            },
            /**
             * Se não sucesso, contém todos os detalhes do erro do ocorrido
             */
            erro: {
                descricao: '',
                /**
                 * Se deu erro ao enviar o pacote ENIP
                 */
                isEnviarENIP: false,
                /**
                 * Se o erro foi causado devido a falha ao enviar o pacote ENIP, contém os detalhes extras desse erro
                */
                enviarENIP: {
                    /**
                     * Se foi erro ao escrever o pacote ENIP no socket
                     */
                    isWriteSocket: false,
                    /**
                     * Se foi erro ao gerar o buffer do pacote ENIP
                     */
                    isGerarBuffer: false,
                    /**
                     * Detalhes do erro ao gerar o Buffer do pacote ENIP se isGerarBuffer for true
                     */
                    gerarBuffer: {
                        /**
                         * Histórico de logs do erro ao gerar o Buffer do pacote ENIP
                         */
                        traceLog: []
                    }
                },
                /**
                 * Se deu erro ao receber o pacote ENIP
                 */
                isReceberENIP: false,
                /**
                 * Se o erro foi causado devido a falha ao receber o pacote ENIP, contém os detalhes extras desse erro. Esse erro só verifica pelo campo principal ENIP, os layers encapsulados posteriormente podem ter erros próprios,
                 * porém a garantia aqui é que o pacote ENIP foi recebido com sucesso
                */
                receberENIP: {
                    /**
                     * Se foi erro ao receber o pacote ENIP
                     */
                    isDemorouResposta: false
                },
                /**
                 * Se o erro foi causado devido a um erro de status, ou seja os layers estão todos em conformidade, porém o dispositivo retornou um status diferente de sucesso para a operação de leitura da tag
                 */
                isStatusInvalido: false,
                /**
                 * Se isStatusInvalido, contém os detalhes do status invalido
                 */
                statusInvalido: {
                    /**
                     * A descrição basica do erro original ocorrido
                     */
                    descricaoStatus: '',
                    /**
                     * Código do erro recebido conforme CIP Response Codes
                     */
                    codigoDeErro: undefined,
                    /**
                     * Se o erro foi causado por um erro de status, contém os detalhes extras desse erro
                     */
                    statusErro: {
                        /**
                         * Se o erro foi causado por um erro de status, contém os detalhes extras desse erro
                         */
                        descricao: ''
                    }
                },
                /**
                 * Se o valor informado para escrever não é valido
                 */
                isTipoValorInvalido: false,
                /**
                 * O Data Type informado é inexistente
                 */
                isTipoDataTypeInexistente: false,
                /**
                 * Se o erro ocorrido foi devido a algum dos layers do pacote ENIP recebido estarem incorretos. É somente para erros de parse dos Buffers recebidos e suas camadas e garantir que os bytes recebidos estão em conformidade. Por exemplo
                 * se foi requisitado escrever uma tag que não existe, o controlador vai responder com um status de invalido no SingleServicePacket, então não caira em tratativas dos erros, e sim de status.
                 */
                isErroLayers: false,
                /**
                 * Se isErroLayers, contém qual layer ocorreu o erro
                 */
                erroLayers: {
                    /**
                     * Se o layer do SendRRData é valido
                     */
                    isSendRRDataInvalido: false,
                    /**
                     * Se o erro foi causado por falha ao processar o Buffer SendRRData
                     */
                    sendRRDataInvalido: {
                        /**
                         * Array de mensagens com o historico de cada etapa do processamento do Buffer, conterá onde ocorreu o erro no Buffer
                         */
                        trace: []
                    },
                    /**
                     * Se o layer do CIP é valido
                     */
                    isCIPInvalido: false,
                    /**
                     * Se o erro foi causado por falha ao processar o Buffer CIP
                     */
                    CIPInvalido: {
                        /**
                         * Array de mensagens com o historico de cada etapa do processamento do Buffer, conterá onde ocorreu o erro no Buffer
                         */
                        trace: []
                    },
                    /**
                     * Se o layer Single Service Packet é valido
                     */
                    isSingleServicePacket: false,
                    /**
                     * Se o erro foi causado por falha ao processar o Buffer Single Service Packet
                     */
                    singleServicePacket: {
                        /**
                         * Array de mensagens com o historico de cada etapa do processamento do Buffer, conterá onde ocorreu o erro no Buffer
                         */
                        trace: []
                    }
                },
            }
        }

        const layerENIP = this.getENIPSocket().getNovoLayerBuilder();
        const layerConnectionManager = layerENIP.buildSendRRData().criarServicoCIP().buildCIPConnectionManager();

        // O Single Service Packet eu configuro a tag solicitada e o valor a ser escrito
        const layerServicePacket = layerConnectionManager.getCIPMessage().buildSingleServicePacket();

        /**
         * O Buffer onde vou armazenar a operação de escrita pro CIP Generic Class
         * @type {Buffer}
         */
        let bufferDataTypeEscrita;

        // Pra setar uma tag pelo menos no CompactLogix, o CIP Generic Data deve conter as informações do tipo da Data Type e o valor correspondente. Por isso preciso fazer a tratativa pro Data Type informado

        // Tratamento para Data Types atomicos(numeros)
        if (dataType.isAtomico) {

            const detalhesDataType = this.getDataTypeAtomico(dataType.atomico.codigoAtomico);

            // Se foi informado um Data Type atomico que não existe.
            if (detalhesDataType == undefined) {
                retornoEscrita.erro.isTipoDataTypeInexistente = true;
                retornoEscrita.erro.descricao = `Data Type atomico informado não existe: ${dataType.atomico.codigoAtomico}`;
                return retornoEscrita;
            }

            // Ok, se o Data Type atomico for valido, verificar se o valor informado combina com um numero
            if (isNaN(dataType.atomico.valor)) {
                retornoEscrita.erro.isTipoValorInvalido = true;
                retornoEscrita.erro.descricao = `O valor informado (${dataType.atomico.valor}) não é um compatível para o Data Type atomico (${detalhesDataType.codigo} - ${detalhesDataType.descricao}).`;
                return retornoEscrita;
            }

            const valorParaEscrever = dataType.atomico.valor;

            // Verificar se o numero informado caberia no Data Type informado
            if (detalhesDataType.isSigned) {

                // Validar se o novo valor informado não vai ultrapassar o limite negativo do Data Type
                let valorMinimo = -(2 ** ((detalhesDataType.tamanho * 8) - 1));
                let valorMaximo = (2 ** ((detalhesDataType.tamanho * 8) - 1)) - 1;

                if (valorParaEscrever < valorMinimo) {
                    retornoEscrita.erro.descricao = `O valor informado (${valorParaEscrever}) ultrapassa o limite minimo do Data Type atomico (${detalhesDataType.codigo} - ${detalhesDataType.descricao}). Valor minimo: ${valorMinimo}`;
                    retornoEscrita.erro.isTipoValorInvalido = true;
                    return retornoEscrita;
                } else if (valorParaEscrever > valorMaximo) {
                    retornoEscrita.erro.isTipoValorInvalido = true;
                    retornoEscrita.erro.descricao = `O valor informado (${valorParaEscrever}) ultrapassa o limite maximo do Data Type atomico (${detalhesDataType.codigo} - ${detalhesDataType.descricao}). Valor maximo: ${valorMaximo}`;
                    return retornoEscrita;
                }

            } else {

                // Tratativa para numeros unsigneds
                if (valorParaEscrever < 0) {
                    retornoEscrita.erro.descricao = `O valor informado (${valorParaEscrever}) é negativo, porém o Data Type atomico (${detalhesDataType.codigo} - ${detalhesDataType.descricao}) não aceita valores negativos.`;
                    retornoEscrita.erro.isTipoValorInvalido = true;
                    return retornoEscrita
                }

                // Validar se o novo valor informado não vai ultrapassar o limite positivo do Data Type
                let valorMaximo = (2 ** (detalhesDataType.tamanho * 8)) - 1;

                if (valorParaEscrever > valorMaximo) {
                    retornoEscrita.erro.descricao = `O valor informado (${valorParaEscrever}) ultrapassa o limite maximo do Data Type atomico (${detalhesDataType.codigo} - ${detalhesDataType.descricao}). Valor maximo: ${valorMaximo}`;
                    retornoEscrita.erro.isTipoValorInvalido = true;
                    return retornoEscrita;
                }
            }

            // Após as verificações de tamanho, eu sei que o novo valor deverá caber na tag.

            // Para tipos numericos, o Buffer é composto de:
            // 2 Bytes do Data Type atomico
            // 2 Bytes do Tamanho do Data Type. Para numeros atomicos, é sempre 1.
            const bufferDataType = Buffer.alloc(4);

            bufferDataType.writeUInt16LE(detalhesDataType.codigo, 0);
            bufferDataType.writeUInt16LE(1, 2);

            // O resto do buffer é o tamanho do Data Type em bytes
            const bufferValor = Buffer.alloc(detalhesDataType.tamanho);
            bufferValor.writeUIntLE(valorParaEscrever, 0, detalhesDataType.tamanho);

            // Juntar os dois e retornar ele
            bufferDataTypeEscrita = Buffer.concat([bufferDataType, bufferValor]);

            retornoEscrita.sucesso.tag.isAtomico = true;
            retornoEscrita.sucesso.tag.atomico.valor = valorParaEscrever;
            retornoEscrita.sucesso.tag.atomico.dataType = detalhesDataType;
        } else if (dataType.isStruct) {
            // Tratamento para Data Types do tipo Struct(672)

            // Analisar o tipo da Struct informada
            switch (dataType.struct.codigoStruct) {

                // Se o Struct informado é uma String ASCII 82
                case this.#dataTypes.structs.ASCIISTRING82.codigoTipoStruct: {
                    /**
                     * @type {EscreveTagStructASCIIString82}
                     */
                    const classeStructASCIIString82 = dataType.struct.classeStruct;
                    if (classeStructASCIIString82.string == undefined) {

                        retornoEscrita.erro.isTipoValorInvalido = true;
                        retornoEscrita.erro.descricao = 'String a ser escrita não informada';
                        return retornoEscrita;
                    }

                    // Da um toString só pra garantir
                    let stringPraEscrever = classeStructASCIIString82.string.toString();

                    // Como o tamanho maximo permitido é 82, eu corto por garantia se for maior
                    if (stringPraEscrever.length > 82) {
                        stringPraEscrever = stringPraEscrever.substring(0, 82);
                    }

                    // Ok agora com as informações da Struct da string, vou montar o Buffer completo
                    // O Buffer pra escrever uma Struct String é composto de:
                    // 2 Bytes do Data Type Struct que é 672
                    // 2 Bytes do Tipo da Struct, que no caso é ASCII String 82
                    // 2 Bytes pro tamanho do Tipo da Struct, que no caso também é 1 apenas
                    // x Bytes restantes são para a string em si
                    let bufferDataType = Buffer.alloc(6);

                    // Escrever o Data Type Struct
                    bufferDataType.writeUInt16LE(672, 0);

                    // Escrever o Tipo da Struct
                    bufferDataType.writeUInt16LE(this.#dataTypes.structs.ASCIISTRING82.codigoTipoStruct, 2);

                    // Escrever o tamanho do Tipo da Struct(que é sempre 1 pra esse caso de Struct)
                    bufferDataType.writeUInt16LE(1, 4);
                    // -------

                    // Agora o resto do buffer de 88 bytes de
                    // 4 Bytes contendo o tamanho da string
                    // 84 Bytes contendo a string em si
                    let bufferString = Buffer.alloc(88);
                    bufferString.writeUInt32LE(stringPraEscrever.length, 0);

                    bufferString.write(stringPraEscrever, 4, stringPraEscrever.length);

                    // Juntar os dois buffers
                    bufferDataTypeEscrita = Buffer.concat([bufferDataType, bufferString]);

                    /**
                     * @type {EscritaTagStructASCIIString82}
                     */
                    const retornoEscritaStructASCIIString82 = {
                        valor: stringPraEscrever
                    }

                    retornoEscrita.sucesso.tag.isStruct = true;
                    retornoEscrita.sucesso.tag.struct.dataTypeStruct = this.#dataTypes.structs.ASCIISTRING82;
                    retornoEscrita.sucesso.tag.struct.valor = retornoEscritaStructASCIIString82
                    break;
                }
                default: {
                    retornoEscrita.erro.descricao = `Tipo de Struct informado não existe ou não é suportado ainda: ${dataType.struct.codigoStruct}`;
                    retornoEscrita.erro.isTipoDataTypeInexistente = true;

                    return;
                }
            }
        }

        // Configurar o Service Packet com os dados do Buffer com as alterações
        layerServicePacket.setAsSetAttribute({
            nome: `${tag}`,
            CIPGenericBuffer: bufferDataTypeEscrita
        })

        retornoEscrita.msDetalhes.dateTimeInicio = new Date().getTime();


        if (retornoEscrita.sucesso.tag.isAtomico) {
            this.log(`Tag (${tag}) [Atomico Data Type ${retornoEscrita.sucesso.tag.atomico.dataType.codigo} - ${retornoEscrita.sucesso.tag.atomico.dataType.descricao}] tentando escrever o número: ${retornoEscrita.sucesso.tag.atomico.valor}`);
        } else if (retornoEscrita.sucesso.tag.isStruct) {
            if (retornoEscrita.sucesso.tag.struct.dataTypeStruct.codigoTipoStruct == this.#dataTypes.structs.ASCIISTRING82.codigoTipoStruct) {
                this.log(`Tag (${tag}) [Struct Data Type ${retornoEscrita.sucesso.tag.struct.dataTypeStruct.codigoTipoStruct} - ${retornoEscrita.sucesso.tag.struct.dataTypeStruct.descricao}] tentando escrever a String: ${retornoEscrita.sucesso.tag.struct.valor.valor}`);
            }
        }

        // Ok, agora enviar a solicitação ENIP
        const statusEnviaENIP = await this.getENIPSocket().enviarENIP(layerENIP);

        retornoEscrita.msDetalhes.dateTimeFim = new Date().getTime();
        retornoEscrita.msDetalhes.totalMsEscrita = retornoEscrita.msDetalhes.dateTimeFim - retornoEscrita.msDetalhes.dateTimeInicio;

        // Verificar se o pacote ENIP foi enviado com sucesso
        if (!statusEnviaENIP.isSucesso) {

            // Ocorreu algum erro na transmissão do ENIP, verificar
            if (!statusEnviaENIP.enipEnviar.isEnviou) {

                if (statusEnviaENIP.enipEnviar.erro.isWriteSocket) {
                    // O erro foi causado na hora de usar o Write pra escrever no Socket
                    retornoEscrita.erro.enviarENIP.isWriteSocket = true;
                } else if (statusEnviaENIP.enipEnviar.erro.isGerarBuffer) {
                    // O erro foi causado na geração do Buffer do Builder do ENIP. Algum campo invalido provavelmente
                    retornoEscrita.erro.enviarENIP.isGerarBuffer = true;
                    retornoEscrita.erro.enviarENIP.gerarBuffer.traceLog = statusEnviaENIP.enipEnviar.erro.erroGerarBuffer.traceLog;
                }

                retornoEscrita.erro.descricao = `O envio do ENIP retornou: ${statusEnviaENIP.enipEnviar.erro.descricao} `;
                retornoEscrita.erro.isEnviarENIP = true;

                this.log(`Erro ao escrever a tag ${tag}: ${retornoEscrita.erro.descricao}`);
                return retornoEscrita;
            }

            // Se deu erro ao receber o ENIP, verificar.
            if (!statusEnviaENIP.enipReceber.isRecebeu) {

                if (statusEnviaENIP.enipReceber.erro.isDemorouResposta) {
                    // O erro foi causado por demorar a resposta do pacote ENIP
                    retornoEscrita.erro.receberENIP.isDemorouResposta = true;
                }

                retornoEscrita.erro.descricao = `O recebimento do ENIP retornou: ${statusEnviaENIP.enipReceber.erro.descricao} `;
                retornoEscrita.erro.isReceberENIP = true;

                this.log(`Erro ao escrever a tag ${tag}: ${retornoEscrita.erro.descricao}`);
                return retornoEscrita;
            }
        }

        // Se chegou aqui, eu tenho o pacote ENIP de resposta do controlador. Agora preciso verificar se ele retornou sucesso ou não na operação de escrita
        const ENIPResposta = statusEnviaENIP.enipReceber.enipParser;

        // O comando que deve ser retornado é um SendRRData. Na teoria isso nunca deveria cair aqui pq a resposta do ENIP sempre deve corresponder a solicitação original, se enviou um SendRRData, deve receber um SendRRData
        if (!ENIPResposta.isSendRRData()) {

            retornoEscrita.erro.descricao = 'O pacote de resposta não é um SendRRData.';
            retornoEscrita.erro.isErroLayers = true;
            retornoEscrita.erro.erroLayers.isSendRRDataInvalido = true;

            this.log(`Erro ao escrever a tag ${tag}: ${retornoEscrita.erro.descricao}`);
            return retornoEscrita;
        }

        // Obter as informações do SendRRData
        const ENIPSendRRData = ENIPResposta.getAsSendRRData();

        // Se retornou um SendRRData, validar se o parser conseguiu extrair as informações corretamente
        if (!ENIPSendRRData.isValido().isValido) {

            retornoEscrita.erro.descricao = `O pacote SendRRData não é valido, alguma informação no Buffer está incorreta: ${ENIPSendRRData.isValido().erro.descricao} `;
            retornoEscrita.erro.isErroLayers = true;
            retornoEscrita.erro.erroLayers.isSendRRDataInvalido = true;
            retornoEscrita.erro.erroLayers.sendRRDataInvalido.trace = ENIPSendRRData.isValido().tracer.getHistoricoOrdenado();

            this.log(`Erro ao escrever a tag ${tag}: ${retornoEscrita.erro.descricao}`);
            return retornoEscrita;
        }

        // Obrigatoriamente deve ser um serviço CIP que contém os dados encapsulados da informação de escrita da tag(já que a comunicação no momento com o Compact tá sendo via CIP)
        if (!ENIPSendRRData.isServicoCIP()) {

            retornoEscrita.erro.descricao = 'O pacote de resposta não contém um serviço CIP';
            retornoEscrita.erro.isErroLayers = true;
            retornoEscrita.erro.erroLayers.isCIPInvalido = true;

            this.log(`Erro ao escrever a tag ${tag}: ${retornoEscrita.erro.descricao}`);
            return retornoEscrita;
        }

        // Obter as informações do Serviço CIP que contém nessa altura do jogo, o CIP Connection Manager com as informações solicitadas
        const ENIPCIP = ENIPSendRRData.getAsServicoCIP();
        if (!ENIPCIP.isValido().isValido) {

            retornoEscrita.erro.descricao = `O pacote CIP não é valido, alguma informação no Buffer está incorreta: ${ENIPCIP.isValido().erro.descricao} `;
            retornoEscrita.erro.isErroLayers = true;
            retornoEscrita.erro.erroLayers.isCIPInvalido = true;
            retornoEscrita.erro.erroLayers.CIPInvalido.trace = ENIPCIP.isValido().tracer.getHistoricoOrdenado();

            this.log(`Erro ao escrever a tag ${tag}: ${retornoEscrita.erro.descricao}`);
            return retornoEscrita;
        }

        // Validar o código de status do CIP, pois tem alguns status que são erros fatais e não tem como prosseguir
        if (ENIPCIP.getStatusCIP().codigo != CIPGeneralStatusCodes.Success.hex) {

            // O erro grave deve ser marcado como true se foi retornado um código de status que invalidou toda a operação e impede de prosseguir com a leitura da tag
            let isErroGrave = false;

            switch (ENIPCIP.getStatusCIP().codigo) {

                // O Connection Failure é um erro fatal que não tem como prosseguir
                case CIPGeneralStatusCodes.ConnectionFailure.hex: {
                    isErroGrave = true;
                    retornoEscrita.erro.descricao = `O pacote CIP retornou Connection Failure-- ${ENIPCIP.getStatusCIP().codigo}: ${ENIPCIP.getStatusCIP().descricao} `;
                    break;
                }
                // O dispositivo não conseguiu processar a solicitação por falta de recursos
                case CIPGeneralStatusCodes.ResourceUnavailable.hex: {
                    isErroGrave = true;
                    retornoEscrita.erro.descricao = `O pacote CIP retornou Resource Unavailable-- ${ENIPCIP.getStatusCIP().codigo}: ${ENIPCIP.getStatusCIP().descricao} `;
                    break;
                }
                // O Path Segment error é fatal, o caminho pro Request Path é invalido, então a informação pode ser prosseguida pelo SingleServicePacket adiante
                case CIPGeneralStatusCodes.PathSegmentError.hex: {
                    retornoEscrita.erro.descricao = `O pacote CIP retornou Path Segment Error-- ${ENIPCIP.getStatusCIP().codigo}: ${ENIPCIP.getStatusCIP().descricao} `;
                    break;
                }
                // O Partial Transfer não entendi ainda em que situações ocorre, por isso evito de prosseguir
                case CIPGeneralStatusCodes.PartialTransfer.hex: {
                    isErroGrave = true;
                    retornoEscrita.erro.descricao = `O pacote CIP retornou Partial Transfer(Ainda não é suportado)-- ${ENIPCIP.getStatusCIP().codigo}: ${ENIPCIP.getStatusCIP().descricao} `;
                    break;
                }
                // O Connection Lost é um erro fatal que não tem como prosseguir
                case CIPGeneralStatusCodes.ConnectionLost.hex: {
                    isErroGrave = true;
                    retornoEscrita.erro.descricao = `O pacote CIP retornou Connection Lost-- ${ENIPCIP.getStatusCIP().codigo}: ${ENIPCIP.getStatusCIP().descricao} `;
                    break;
                }
                // Reply Data Too Large é um erro fatal também pq não terei os dados pra prosseguir com o processamento
                case CIPGeneralStatusCodes.ReplyDataTooLarge.hex: {
                    isErroGrave = true;
                    retornoEscrita.erro.descricao = `O pacote CIP retornou Reply Data Too Large-- ${ENIPCIP.getStatusCIP().codigo}: ${ENIPCIP.getStatusCIP().descricao} `;
                    break;
                }
                default: {

                    retornoEscrita.erro.descricao = `O pacote CIP retornou com o status desconhecido ${ENIPCIP.getStatusCIP().codigo}: ${ENIPCIP.getStatusCIP().descricao} `;
                    isErroGrave = true;
                    break;

                }
            }

            // Se erro grave tiver setado, retornar como erro de status invalido
            if (isErroGrave) {
                retornoEscrita.erro.isStatusInvalido = true;
                retornoEscrita.erro.statusInvalido.codigoDeErro = ENIPCIP.getStatusCIP().codigo;
                retornoEscrita.erro.statusInvalido.descricaoStatus = ENIPCIP.getStatusCIP().descricao;

                this.log(`Erro ao escrever a tag ${tag}: ${retornoEscrita.erro.descricao}`);
                return retornoEscrita;
            }

        }

        // Por último, o pacote CIP deve encapsular o Single Service Packet que foi a informação da tag escrita

        if (!ENIPCIP.isSingleServicePacket()) {
            retornoEscrita.erro.descricao = 'O pacote de resposta não contém um Single Service Packet';

            retornoEscrita.erro.isErroLayers = true;
            retornoEscrita.erro.erroLayers.isSingleServicePacket = true;

            this.log(`Erro ao escrever a tag ${tag}: ${retornoEscrita.erro.descricao}`);
            return retornoEscrita;
        }

        const ENIPSingleService = ENIPCIP.getAsSingleServicePacket();

        // Validar se é deu pra dar parse no Buffer sem erros.
        if (!ENIPSingleService.isValido().isValido) {

            retornoEscrita.erro.descricao = `O pacote Single Service Packet não é valido, alguma informação no Buffer está incorreta: ${ENIPSingleService.isValido().erro.descricao} `;
            retornoEscrita.erro.isErroLayers = true;
            retornoEscrita.erro.erroLayers.isSingleServicePacket = true;
            retornoEscrita.erro.erroLayers.singleServicePacket.trace = ENIPSingleService.isValido().tracer.getHistoricoOrdenado();

            this.log(`Erro ao escrever a tag ${tag}: ${retornoEscrita.erro.descricao}`);
            return retornoEscrita;
        }

        // Analisar se o SingleServicePacket retornou sucesso ou não
        if (!ENIPSingleService.isStatusSucesso().isSucesso) {

            retornoEscrita.erro.descricao = `O pacote Single Service Packet retornou um status de erro: ${ENIPSingleService.getStatus().codigoStatus} - ${ENIPSingleService.getStatus().descricaoStatus} `;
            retornoEscrita.erro.isStatusInvalido = true;
            retornoEscrita.erro.statusInvalido.codigoDeErro = ENIPSingleService.getStatus().codigoStatus;
            retornoEscrita.erro.statusInvalido.descricaoStatus = ENIPSingleService.getStatus().descricaoStatus;

            this.log(`Erro ao escrever a tag ${tag}: ${retornoEscrita.erro.descricao}`);
            return retornoEscrita;
        }

        // Se chegou aqui, a operação de escrita foi bem sucedida
        if (retornoEscrita.sucesso.tag.isAtomico) {
            this.log(`Tag (${tag}) [Atomico Data Type ${retornoEscrita.sucesso.tag.atomico.dataType.codigo} - ${retornoEscrita.sucesso.tag.atomico.dataType.descricao}] escrita com o número ${retornoEscrita.sucesso.tag.atomico.valor} em ${retornoEscrita.msDetalhes.totalMsEscrita}ms`);
        } else if (retornoEscrita.sucesso.tag.isStruct) {
            if (retornoEscrita.sucesso.tag.struct.dataTypeStruct.codigoTipoStruct == this.#dataTypes.structs.ASCIISTRING82.codigoTipoStruct) {
                this.log(`Tag (${tag}) [Struct Data Type ${retornoEscrita.sucesso.tag.struct.dataTypeStruct.codigoTipoStruct} - ${retornoEscrita.sucesso.tag.struct.dataTypeStruct.descricao}] escrita com a String ${retornoEscrita.sucesso.tag.struct.valor.valor} em ${retornoEscrita.msDetalhes.totalMsEscrita}ms`);
            }
        }

        retornoEscrita.isSucesso = true;
        return retornoEscrita;
    }

    /**
     * @typedef EscritaTag
     * @property {String} tag - Nome da tag para escrever
     * @property {Object} dataType - O Data Type da tag a ser escrita
     * @property {Boolean} dataType.isAtomico - Se o Data Type é atomico(numeros)
     * @property {Object} dataType.atomico - Se atomico, contém os detalhes do valor a ser escrito
     * @property {Number} dataType.atomico.codigoAtomico - Código do tipo de Data Type a ser escrito
     * @property {Number} dataType.atomico.valor - Valor númerico a ser escrito
     * @property {Boolean} dataType.isStruct - Se o Data Type é do tipo Struct
     * @property {Object} dataType.struct - Se isStruct, contém os detalhes do Data Type Struct
     * @property {Number} dataType.struct.codigoStruct - Código do tipo de Data Type Struct a ser escrito
     * @property {EscreveTagStructASCIIString82} dataType.struct.classeStruct - Se isStruct, contém a classe da Struct a ser escrita
     */

    /**
     * Escreve multiplas tags de uma vez só
     * @param {EscritaTag[]} tags - Array de tags a serem escritas
     */
    async escreveMultiplasTags(tags) {
        if (tags == undefined) throw new Error('Nenhuma tag informada para escrever');
        if (!Array.isArray(tags)) throw new Error('As tags informadas não são um array');


    }

    /**
     * Retorna os Data Types disponiveis do controlador CompactLogix
     */
    getDataTypes() {
        return this.#dataTypes;
    }

    /**
     * Retorna informações de um Data Type atomico
     * @param {Number} codigo 
     * @returns {DataTypeTagAtomico}
     */
    getDataTypeAtomico(codigo) {
        return Object.values(this.#dataTypes.atomicos).find((type) => type.codigo == codigo);
    }

    /**
     * Retorna se um Data Type ta no range pra ser um tipo atomico(numero)
     */
    isDataTypeAtomico(tipo) {
        return Object.values(this.#dataTypes.atomicos).some((type) => type.codigo == tipo);
    }

    /**
     * Retorna informações de um Data Type do tipo Struct 672
     * @param {Number} codigoStruct - Código especifico do Struct
     */
    getDataTypeStruct(codigoStruct) {
        return Object.values(this.#dataTypes.structs).find((type) => type.codigoTipoStruct == codigoStruct);
    }

    /**
     * Retorna se um Data Type especifico do Struct pertence ao tipo Struct
     * @param {Number} codigoStruct
     */
    isDataTypeStruct(codStruct) {
        return Object.values(this.#dataTypes.structs).some((type) => type.codigoTipoStruct == codStruct);
    }

    /**
     * Retorna se um código de Data Type é do tipo Struct(672)
     * @param {Number} codigo 
     */
    isStruct(codigo) {
        return codigo == 672;
    }

    /**
     * Retorna o tipo de dado de um Data Type
     * @param {Number} codigo - Código para verificar, podendo ser um Data Type Atomico ou um Data Type Struct 
     */
    getTipoDataType(codigo) {
        const dataTipo = {
            isAtomico: false,
            isStruct: false
        }

        if (codigo >= 192 && codigo <= 202) {
            if (this.isDataTypeAtomico(codigo)) {
                dataTipo.isAtomico = true;
            }
        } else if (codigo == 672) {
            dataTipo.isStruct = true;
        }

        return dataTipo;
    }

    /**
     * Converte um buffer de CIP Class Generic que contém o valor de uma tag para o valor do tipo de dado
     ** Um Buffer de Data Type é geralmente dinamico dependendo do tipo, porém por padrão os 2 bytes inicias sempre são o tipo correspondente do Data Type do valor.
     * @param {Buffer} buffer - Buffer para converter
     */
    #converteDataTypeToValor(buffer) {
        let retornoConverte = {
            /**
             * Se foi possível converter o valor com sucesso
             */
            isConvertido: false,
            /**
             * Se sucesso, contém detalhes do valor convertido
             */
            conversao: {
                /**
                 * Se o valor é atomico(Data Types do range 193 até 197, que são os numeros, int, double, real, etc..)
                 */
                isAtomico: false,
                /**
                 * Se é um valor atomico, contém os dados do valor 
                 */
                atomico: {
                    /**
                     * Valor
                     * @type {Number}
                     */
                    valor: undefined,
                    /**
                     * Detalhes do tipo do valor, se é inteiro, double int, etc...
                     * @type {DataTypeTagAtomico}
                     */
                    dataType: undefined
                },
                /**
                 * Se o valor é um Struct(Data Type 672, que é para Strings, Timers, etc.. tudo que é mais complexo que um simples numero)
                 */
                isStruct: false,
                /**
                 * Detalhes da Struct com seus dados.
                 */
                struct: {
                    /**
                     * Esse campo é dinamico dependendo do tipo da Struct, utilize o dataType para verificar o tipo se vc não sabe qual o tipo foi recebido
                     * @type {DataTypeTagStructASCIIString82}
                     */
                    structData: undefined,
                    /**
                     * Detalhes do tipo da Struct
                     * @type {DataTypeTagStruct}
                     */
                    dataType: undefined
                }
            },
            /**
             * Se não deu pra converter o valor, contém detalhes do erro
             */
            erro: {
                descricao: ''
            }
        }

        // Se o buffer não tiver pelo menos 4 bytes, não tem como ser um buffer de Data Type
        if (buffer.length < 4) {
            retornoConverte.erro.descricao = 'O buffer não contém pelo menos 4 bytes para ser um buffer de Data Type';
            return retornoConverte;
        }

        // Os primeiro 2 byte é o Tipo de Dado
        const IdDataType = buffer.readUInt16LE(0);

        let dataTypeDetalhe = this.getTipoDataType(IdDataType);
        if (dataTypeDetalhe.isAtomico) {

            // No caso de tipos numericos, os restantes dos bytes após os 2 bytes do tipo são os bytes do numero
            const detalhesDataType = this.getDataTypeAtomico(IdDataType);
            if (detalhesDataType == undefined) {
                retornoConverte.erro.descricao = `Tipo de Data Type numerico não encontrado: ${IdDataType} `;
                return retornoConverte;
            }

            // Realizar a tratativa pro valor numerico, que é a leitura do buffer a partir do 4 byte, até x bytes do tamanho do numero.
            let valorContidoNoDataType = buffer.readUIntLE(2, detalhesDataType.tamanho);

            retornoConverte.isConvertido = true;

            retornoConverte.conversao.isAtomico = true;
            retornoConverte.conversao.atomico.valor = valorContidoNoDataType;
            retornoConverte.conversao.atomico.dataType = detalhesDataType;

            return retornoConverte;
        } else if (dataTypeDetalhe.isStruct) {

            // No caso de Structs, os próximos 2 bytes indicam o tipo especifico da Struct
            const tipoDaStruct = buffer.readUInt16LE(2);

            // Pegar as informações da Struct
            const detalhesStruct = this.getDataTypeStruct(tipoDaStruct);
            if (detalhesStruct == undefined) {
                retornoConverte.erro.descricao = `Tipo de Data Type Struct não encontrado: ${tipoDaStruct} `;
                return retornoConverte;
            }

            // Aplicar uma trativa diferente para cada tipo de Struct já que cada uma tem um formato diferente
            switch (detalhesStruct.codigoTipoStruct) {

                // Tipo de Struct para String ASCII de 82 bytes
                case this.#dataTypes.structs.ASCIISTRING82.codigoTipoStruct: {

                    // Próximos 1 byte é o tamanho real total de caracteres na string
                    const tamanhoRealString = buffer.readUInt8(4);

                    // Os próximos 3 bytes depois do tamanho são 3 bytes vazios, não sei oq mas as informações da string vem depois disso
                    const conteudoString = buffer.subarray(8, 8 + tamanhoRealString).toString('utf8');

                    /**
                     * @type {DataTypeTagStructASCIIString82}
                     */
                    let typeValor = {
                        stringConteudo: conteudoString,
                        tamanho: tamanhoRealString
                    }

                    retornoConverte.isConvertido = true;
                    retornoConverte.conversao.isStruct = true;
                    retornoConverte.conversao.struct.dataType = detalhesStruct;
                    retornoConverte.conversao.struct.structData = typeValor;
                    return retornoConverte;
                }

                // Para tipos ainda não suportados ou desconhecidos
                default: {

                    retornoConverte.erro.descricao = `Tipo de Data Type Struct não suportado ou desconhecido: ${tipoDaStruct} `;
                    return retornoConverte;
                }
            }
        } else {

            // Se não achou o tipo, deve ser um tipo não suportado ou inválido
            retornoConverte.erro.descricao = `Tipo de Data Type não suportado ou desconhecido: ${IdDataType} `;
            return retornoConverte;
        }

    }

    /**
     * Logar uma mensagem
     * @param {String} msg 
     */
    log(msg) {
        let conteudoMsg = ''
        if (typeof msg == 'object') {
            conteudoMsg = JSON.stringify(msg);
        } else {
            conteudoMsg = msg;
        }

        console.log(`[CompactLogix] - ${conteudoMsg}`);
    }
}