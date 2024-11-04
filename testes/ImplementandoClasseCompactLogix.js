import { Socket } from "net";
import { EmissorEvento } from "./Utils/EmissorEvento.js";

import { EtherNetIPLayerBuilder } from "../EtherNetIP/Builder/Layers/EtherNetIP/EtherNetIPBuilder.js";
import { EtherNetIPLayerParser } from "../EtherNetIP/Parser/Layers/EtherNetIP/EtherNetIPParser.js";
import { hexDeBuffer } from "../EtherNetIP/Utils/Utils.js";

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

        // Dar parse no Buffer recebido
        const etherNetIPParser = new EtherNetIPLayerParser(buffer);

        // Só aceito se for um Buffer de um pacote EtherNet/IP válido
        if (!etherNetIPParser.isValido()) {
            this.log(`Recebido um pacote EtherNet/IP inválido: ${etherNetIPParser.isValido().erro.descricao}. Stack de erro: ${etherNetIPParser.isValido().tracer.getHistoricoOrdenado().join(' -> ')}`);
            return;
        }

        // Extrair o Sender Context do pacote recebido
        const senderContextBuffer = etherNetIPParser.getSenderContext();

        // Ler os 5 bytes que contém o ID unico da requisição original
        const enipIDUnico = senderContextBuffer.readUIntLE(0, 5);

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
     * @typedef DataTypeTag
     * @property {Number} codigo - Codigo do DataType no controlador
     * @property {String} descricao - Descrição do DataType
     * @property {Number} tamanho - Tamanho do tipo do DataType em bytes 
     */

    #dataTypes = {
        /**
         * Tipos de DataTypes numericos suportados
         * Contém o código do tipo de dado, a descrição e o tamanho em bytes
         */
        numeros: {
            BOOL: {
                codigo: 193,
                descricao: 'Boolean',
                tamanho: 1
            },
            SINT: {
                codigo: 194,
                descricao: 'Small Int',
                tamanho: 1
            },
            INT: {
                codigo: 195,
                descricao: 'Int',
                tamanho: 2
            },
            DINT: {
                codigo: 196,
                descricao: 'Double Int',
                tamanho: 4
            },
            LINT: {
                codigo: 197,
                descricao: 'Long Int',
                tamanho: 8
            },
            USINT: {
                codigo: 198,
                descricao: 'Unsigned Small Int',
                tamanho: 1
            },
            UINT: {
                codigo: 199,
                descricao: 'Unsigned Int',
                tamanho: 2
            },
            UDINT: {
                codigo: 200,
                descricao: 'Unsigned Double Int',
                tamanho: 4
            },
            REAL: {
                codigo: 202,
                descricao: 'Real',
                tamanho: 4
            }
        }
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
     * Retornar o Socket de comunicação com o dispositivo EtherNet/IP
     */
    getENIPSocket() {
        return this.#ENIPSocket;
    }

    /**
     * Realizar a leitura de uma tag do CompactLogix
     * @param {String} tag - Tag a ser lida
     */
    async lerTag(tag) {
        const retornoTag = {
            /**
             * Se deu sucesso em realizar a leitura da tag 
             */
            isSucesso: false,
            /**
             * Se sucesso, contém os dados da tag lida
             */
            sucesso: {
                /** */
                valor: ''
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
                 * Se o erro ocorrido foi devido a algum dos layers do pacote ENIP. É somente para erros de parse dos Buffers recebidos e suas camadas e garantir que os bytes recebidos estão em conformidade. Por exemplo
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
                }
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

        // Enviar o pacote ENIP
        let statusEnviaENIP = await this.getENIPSocket().enviarENIP(layerENIP);

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

                return retornoTag;
            }
        }

        // Se chegou aqui, eu tenho o pacote ENIP de resposta do controlador. Agora preciso verificar se ele retornou sucesso ou não na operação de leitura
        const ENIPResposta = statusEnviaENIP.enipReceber.enipParser;

        // O comando que deve ser retornado é um SendRRData. Na teoria isso nunca deveria cair aqui pq a resposta do ENIP sempre deve corresponder a solicitação original, se enviou um SendRRData, deve receber um SendRRData
        if (!ENIPResposta.isSendRRData()) {
            retornoTag.erro.descricao = 'O pacote de resposta não é um SendRRData.';
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
            return retornoTag;
        }

        // Obrigatoriamente deve ser um serviço CIP que contém os dados encapsulados da informação de leitura da tag(já que a comunicação no momento com o Compact tá sendo via CIP)
        if (!ENIPSendRRData.isServicoCIP()) {
            retornoTag.erro.descricao = 'O pacote de resposta não contém um serviço CIP';
            return retornoTag;
        }

        // Obter as informações do Serviço CIP que contém nessa altura do jogo, o CIP Connection Manager com as informações solicitadas
        const ENIPCIP = ENIPSendRRData.getAsServicoCIP();
        if (!ENIPCIP.isValido().isValido) {

            retornoTag.erro.descricao = `O pacote CIP não é valido, alguma informação no Buffer está incorreta: ${ENIPCIP.isValido().erro.descricao}`;
            retornoTag.erro.isErroLayers = true;
            retornoTag.erro.erroLayers.isCIPInvalido = true;
            retornoTag.erro.erroLayers.CIPInvalido.trace = ENIPCIP.isValido().tracer.getHistoricoOrdenado();
            return retornoTag;
        }

        // Por último, o pacote CIP deve encapsular o Single Service Packet que foi a informação da tag requisitada

        if (!ENIPCIP.isSingleServicePacket()) {
            retornoTag.erro.descricao = 'O pacote de resposta não contém um Single Service Packet';
            return retornoTag;
        }
        const ENIPSingleService = ENIPCIP.getAsSingleServicePacket();

        // Validar se é deu pra dar parse no Buffer sem erros.
        if (!ENIPSingleService.isValido().isValido) {

            retornoTag.erro.descricao = `O pacote Single Service Packet não é valido, alguma informação no Buffer está incorreta: ${ENIPSingleService.isValido().erro.descricao}`;
            retornoTag.erro.isErroLayers = true;
            retornoTag.erro.erroLayers.isSingleServicePacket = true;
            retornoTag.erro.erroLayers.singleServicePacket.trace = ENIPSingleService.isValido().tracer.getHistoricoOrdenado();
            return retornoTag;
        }

        let detalhesStatus = ENIPSingleService.isStatusSucesso();
        // Ok pronto! Se chegou aqui, todas as camadas do pacote ENIP foram processadas com sucesso. Analisar se a ação de leitura foi bem sucedida ou não
        if (!detalhesStatus.isSucesso) {

            retornoTag.erro.isStatusInvalido = true;
            retornoTag.erro.statusInvalido.codigoDeErro = detalhesStatus.erro.codigoStatus
            retornoTag.erro.statusInvalido.descricaoStatus = `${detalhesStatus.erro.descricaoStatus} - ${detalhesStatus.erro.descricao}`;

            return retornoTag;
        }

        // Se chegou aqui, a leitura foi bem sucedida e o valor da tag está no buffer de dados do Single Service Packet
        

        return retornoTag;
    }

    /**
     * Retorna informações de um Data Type
     * @param {Number} codigo 
     * @returns {DataTypeTag}
     */
    getDataType(codigo) {
        for (const dataTypesTipo in this.#dataTypes) {

            let existeDataType = Object.values(this.#dataTypes[dataTypesTipo]).find((type) => type.codigo == codigo);
            if (existeDataType != undefined) return dataTypesTipo;
        }
    }
}