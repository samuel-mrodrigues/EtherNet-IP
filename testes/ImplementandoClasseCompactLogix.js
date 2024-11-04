import { Socket } from "net";
import { EmissorEvento } from "./Utils/EmissorEvento.js";

import { EtherNetIPLayerBuilder } from "../EtherNetIP/Builder/Layers/EtherNetIP/EtherNetIPBuilder.js";

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
         * Estado da conexão
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
     * @typedef {Object} EnvioStatus
     * @property {boolean} isEnviou - Se o pacote ENIP foi escrito no socket com sucesso
     * @property {Object} erro - Se não foi possível, contém detalhes do erro, como opções erradas no builder ou erro de conexão
     * @property {string} erro.descricao - Descrição do erro generalizado
     * @property {boolean} erro.isErroGerarBufferENIP - Se o erro em especifico foi causado por falha ao gerar o buffer do pacote ENIP
     * @property {Object} erro.erroGerarBufferENIP - Detalhes do erro ao gerar o buffer do pacote ENIP se foi o caso
     * @property {Array<String>} erro.erroGerarBufferENIP.traceLog - Histórico de logs do erro ao gerar o buffer do pacote ENIP
     */

    /**
     * Envia um pacote EtherNet/IP para o dispositivo
     * @param {EtherNetIPLayerBuilder} enip - O Builder do pacote EtherNet/IP para enviar
     * @returns {Promise<EnvioStatus>} - Status do envio do pacote EtherNet/IP
     */
    async enviarENIP(enip) {

        /**
         * @type {EnvioStatus}
         */
        const envioStatus = {
            /**
             * Se o pacote ENIP foi escrito no socket com sucesso
             */
            isEnviou: false,
            /**
             * Se não foi possível, contém detalhes do erro, como opções erradas no builder ou erro de conexão..
             */
            erro: {
                /**
                 * Descrição do erro generalizado
                 */
                descricao: '',
                /**
                 * Se o erro em especifico foi causado por falha ao gerar o buffer do pacote ENIP
                 */
                isErroGerarBufferENIP: false,
                /**
                 * Detalhes do erro ao gerar o buffer do pacote ENIP se foi o caso
                 */
                erroGerarBufferENIP: {
                    traceLog: []
                }
            }
        }

        if (enip == undefined || !(enip instanceof EtherNetIPLayerBuilder)) throw new Error('O pacote EtherNet/IP deve ser informado');

        if (!this.#estado.conexao.isConectado) {
            envioStatus.erro.descricao = 'Não é possível enviar pacotes EtherNet/IP pois não está conectado.';
            return envioStatus;
        }

        const bufferENIP = enip.criarBuffer();
        // Se não foi possível criar o buffer do ENIP
        if (!bufferENIP.isSucesso) {
            envioStatus.erro.descricao = `Erro ao criar Buffer do pacote EtherNet/IP: ${bufferENIP.erro.descricao}`;

            envioStatus.erro.isErroGerarBufferENIP = true;
            envioStatus.erro.erroGerarBufferENIP.traceLog = bufferENIP.tracer.getHistoricoOrdenado();

            return envioStatus;
        }

        // Se gerou com sucesso o Buffer, enviar ao dispositivo

        return new Promise((resolve) => {
            this.#estado.socket.write(bufferENIP.buffer, (err) => {
                if (err) {
                    envioStatus.erro.descricao = err.message;
                    return resolve(envioStatus);
                }

                envioStatus.isEnviou = true;
                return resolve(envioStatus);
            });
        })
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

        novoSocket.on('close', (houveErro) => {
            this.#onConexaoFechada(houveErro);
        })

        novoSocket.on('data', (dados) => {
            this.#onConexaoDadosRecebidos(dados);
        })

        novoSocket.on('error', (erro) => {
            this.#onConexaoErro(erro);
        })

        novoSocket.on('ready', () => {
            this.#onConexaoEstabelecida();
        })

        novoSocket.connect({ host: this.#configuracao.ip, port: this.#configuracao.porta });
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
        console.log(buffer);
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

    getENIPSocket() {
        return this.#ENIPSocket;
    }
}